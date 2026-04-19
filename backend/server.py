from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before any code reads os.environ (API keys, DB, etc.).
_BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(_BACKEND_ROOT / ".env")

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from CRUD.metrics import metrics
from CRUD.fantastic import fantastic
from CRUD.profile import profile
from CRUD.onboarding_chat import onboarding
from CRUD.research import research
from CRUD.official_questionnaire import official_q_router

from database import conn
from models import Users
from service.hashing import Hash

from CRUD.authen import auth, register_researcher_account
from schemas import ResearcherCreate
from service.jwttoken import TokenData
from service.oauth import require_superuser
from fantastic.models import (
    ChatRequest,
    ChatResponse,
    DomainScore,
    ScoreRequest,
    ScoreResponse,
)
from fantastic.scoring import QUESTIONNAIRE, interpret_score, score_answers
from fantastic.advice import generate_advice
from fantastic.conversation import handle_chat_message, SESSIONS, QUESTIONS_BY_ID

import uvicorn
import colorama

colorama.init()
origins = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
]


def _seed_admin():
    """Create default admin user (admin / asd123) if no superuser exists."""
    try:
        rows = conn.execute(Users.select()).fetchall()
        has_superuser = any(len(r) > 3 and r[3] for r in rows) if rows else False
        if not has_superuser:
            conn.execute(
                Users.insert().values(
                    username="admin",
                    email="admin@example.com",
                    is_superuser=True,
                    is_researcher=False,
                    password=Hash.bcrypt("asd123"),
                )
            )
            conn.commit()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[healthy-visit] Loaded server.py from: {_BACKEND_ROOT / 'server.py'}")
    print("[healthy-visit] /health tag should be hv-health-v4 (with server_py + openai_configured). If you still see hv-health-v2, a different process on port 9999 is running.")
    _seed_admin()
    yield


# openapi_url must not be "/api" — that would reserve GET /api and is easy to confuse with /api/* routes.
app = FastAPI(docs_url="/api/docs", openapi_url="/openapi.json", lifespan=lifespan)

_SERVER_PY = Path(__file__).resolve()
try:
    _SERVER_PY_MTIME = _SERVER_PY.stat().st_mtime
except OSError:
    _SERVER_PY_MTIME = 0.0


def _health_payload() -> dict:
    from official_q.llm_utils import openai_available

    return {
        "ok": True,
        "service": "healthy-visit-api",
        "tag": "hv-health-v4",
        "openai_configured": bool(openai_available()),
        "server_py": str(_SERVER_PY),
        "server_py_mtime": _SERVER_PY_MTIME,
    }


_NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate"}


@app.get("/health")
def health_root():
    """Prefer this URL in the browser — no /api prefix, cannot clash with include_router(..., '/api')."""
    return JSONResponse(content=_health_payload(), headers=_NO_CACHE)


@app.get("/api/health")
def api_health():
    """Same payload as GET /health (for clients that expect /api/...)."""
    return JSONResponse(content=_health_payload(), headers=_NO_CACHE)


@app.get("/")
def root():
    """Without this, GET / returns FastAPI's generic 404 JSON — confusing in the browser."""
    return {
        "service": "healthy-visit-api",
        "message": "Backend is running. Open /health or /api/health (includes openai_configured). API docs: /api/docs.",
        "health": "/health",
        "health_api_prefix": "/api/health",
        "onboarding_llm_check": "/api/onboarding/llm-status",
        "openapi_json": "/openapi.json",
        "docs": "/api/docs",
        "hint": "Use backend port (default 9999), not the React dev server (3000). Paths need the /api prefix.",
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth, prefix="/api")
app.include_router(metrics, prefix="/api")
app.include_router(fantastic, prefix="/api")
app.include_router(profile, prefix="/api")
app.include_router(onboarding, prefix="/api")
app.include_router(research, prefix="/api")
app.include_router(official_q_router, prefix="/api")


@app.post("/api/create-researcher")
def create_researcher_on_app(
    req: ResearcherCreate,
    _: TokenData = Depends(require_superuser),
):
    """Same as POST /api/register-researcher but registered on the app (avoids rare router/import 404s)."""
    return register_researcher_account(req)


# --- FANTASTIC lifestyle questionnaire & chat (no auth; login/signup stay in /api) ---
BACKEND_DIR = Path(__file__).resolve().parent
STATIC_DIR = BACKEND_DIR / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/chat-ui", include_in_schema=False)
def chat_ui():
    """Serve the FANTASTIC lifestyle chat page."""
    path = STATIC_DIR / "chat.html"
    if not path.is_file():
        return {"error": "Chat UI not found"}
    return FileResponse(path)


@app.get("/questionnaire")
def get_questionnaire():
    return QUESTIONNAIRE


@app.post("/score", response_model=ScoreResponse)
def score(score_request: ScoreRequest) -> ScoreResponse:
    total_score, max_score, percentage, domain_raw = score_answers(score_request.answers)
    grade_label = interpret_score(percentage)
    domain_scores = {
        domain: DomainScore(domain=domain, raw_score=values["raw_score"], max_score=values["max_score"])
        for domain, values in domain_raw.items()
    }
    return ScoreResponse(
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        grade_label=grade_label,
        domain_scores=domain_scores,
    )


@app.post("/score-and-advice")
def score_and_advice(score_request: ScoreRequest):
    score_response = score(score_request)
    advice_text = generate_advice(score_response)
    disclaimer = (
        "This advice is NOT a medical diagnosis and is not a substitute for "
        "professional medical care. If you have any health concerns, please "
        "consult a doctor or other licensed health professional."
    )
    return {"score": score_response, "advice": advice_text, "disclaimer": disclaimer}


@app.get("/debug-session/{session_id}")
def debug_session(session_id: str):
    if session_id not in SESSIONS:
        return {"error": "Session not found"}
    state = SESSIONS[session_id]
    stored_answers = {}
    for qid, idx in state.answers.items():
        q = QUESTIONS_BY_ID.get(qid)
        if q:
            option_text = q.options[idx] if idx < len(q.options) else "INVALID"
            score_value = q.scores[idx] if idx < len(q.scores) else 0
            stored_answers[qid] = {
                "question": q.english_text,
                "domain": q.domain,
                "selected_index": idx,
                "selected_option": option_text,
                "score_value": score_value,
                "max_possible_score": max(q.scores),
            }
    total, max_score, pct, domains = score_answers(state.answers)
    label = interpret_score(pct)
    return {
        "session_id": session_id,
        "mode": state.mode,
        "current_index": state.current_index,
        "total_questions": len(QUESTIONS_BY_ID),
        "answered_questions": len(state.answers),
        "stored_answers": stored_answers,
        "scores": {
            "total": total,
            "max": max_score,
            "percentage": pct,
            "label": label,
            "domains": domains,
        },
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        reply, state = handle_chat_message(
            session_id=request.session_id,
            user_message=request.user_message,
            language=request.language,
        )
        return ChatResponse(
            session_id=state.session_id,
            reply=reply,
            mode=state.mode,
        )
    except Exception as e:
        return ChatResponse(
            session_id=request.session_id or "error",
            reply=f"Sorry, there was a problem: {str(e)}. Please try again.",
            mode="collecting",
        )


if __name__ == "__main__":
    print("Healthy Visit backend — open http://127.0.0.1:9999/health  (tag hv-health-v4, fields server_py / openai_configured)")
    uvicorn.run("server:app", host="0.0.0.0", reload=True, port=9999)