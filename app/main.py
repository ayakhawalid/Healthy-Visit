from typing import Dict

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .models import (
    ScoreRequest,
    ScoreResponse,
    DomainScore,
    ChatRequest,
    ChatResponse,
)
from .scoring import QUESTIONNAIRE, interpret_score, score_answers
from .advice import generate_advice
from .conversation import handle_chat_message


app = FastAPI(
    title="FANTASTIC Health Bot Backend",
    description=(
        "Scores the FANTASTIC lifestyle questionnaire and (later) "
        "provides generic, non-diagnostic lifestyle advice."
    ),
    version="0.2.0",
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def root_chat_ui():
    """
    Serve the simple browser chat UI.
    """
    return FileResponse("static/chat.html")


@app.get("/questionnaire")
def get_questionnaire():
    """
    Return the full questionnaire structure (for building a frontend form).
    """
    return QUESTIONNAIRE


@app.post("/score", response_model=ScoreResponse)
def score(score_request: ScoreRequest) -> ScoreResponse:
    total_score, max_score, percentage, domain_raw = score_answers(
        score_request.answers
    )
    grade_label = interpret_score(percentage)

    domain_scores: Dict[str, DomainScore] = {}
    for domain, values in domain_raw.items():
        domain_scores[domain] = DomainScore(
            domain=domain,
            raw_score=values["raw_score"],
            max_score=values["max_score"],
        )

    return ScoreResponse(
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        grade_label=grade_label,  # type: ignore[arg-type]
        domain_scores=domain_scores,
    )


@app.post("/score-and-advice")
def score_and_advice(score_request: ScoreRequest):
    """
    Score the answers and return both the numeric results and AI-generated,
    non-diagnostic lifestyle advice.
    """
    score_response = score(score_request)
    advice_text = generate_advice(score_response)

    disclaimer = (
        "This advice is NOT a medical diagnosis and is not a substitute for "
        "professional medical care. If you have any health concerns, please "
        "consult a doctor or other licensed health professional."
    )

    return {
        "score": score_response,
        "advice": advice_text,
        "disclaimer": disclaimer,
    }


@app.get("/debug-session/{session_id}")
def debug_session(session_id: str):
    """
    Debug endpoint to see what answers were stored for a session.
    """
    from .conversation import SESSIONS, QUESTIONS_BY_ID
    from .scoring import score_answers, interpret_score
    
    if session_id not in SESSIONS:
        return {"error": "Session not found"}
    
    state = SESSIONS[session_id]
    
    # Show what was stored
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
    
    # Compute scores
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
    """
    Conversational endpoint that walks through the FANTASTIC questionnaire
    in a natural way and then switches to post-results coaching chat.
    """
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
        import traceback
        error_msg = f"Server error: {str(e)}\n{traceback.format_exc()}"
        return ChatResponse(
            session_id=request.session_id or "error",
            reply=f"Sorry, there was a problem: {str(e)}. Please check the server logs.",
            mode="collecting",
        )

