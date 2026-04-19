from fastapi import APIRouter, HTTPException

from official_q.llm_utils import openai_available

from onboarding_flow import (
    handle_message,
    persist_onboarding_session,
    start_session,
    sync_dashboard_metrics,
)
from schemas import (
    OnboardingMessageRequest,
    OnboardingMessageResponse,
    OnboardingPersistSessionRequest,
    OnboardingStartRequest,
    OnboardingStartResponse,
    OnboardingSyncDashboardRequest,
    OnboardingSyncDashboardResponse,
)

onboarding = APIRouter()


@onboarding.get("/onboarding/llm-status")
def onboarding_llm_status():
    """True when OPENAI_API_KEY is set and ChatOpenAI can load — unrelated to JWT login."""
    return {"openai_configured": bool(openai_available())}


@onboarding.post("/onboarding/start", response_model=OnboardingStartResponse)
def onboarding_start(payload: OnboardingStartRequest):
    if not payload.patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    eff_lang = payload.language if payload.language is not None else "he"
    session_id, message, lang = start_session(payload.patient_id, language=eff_lang)
    return {"session_id": session_id, "message": message, "language": lang}


@onboarding.post("/onboarding/message", response_model=OnboardingMessageResponse)
def onboarding_message(payload: OnboardingMessageRequest):
    if not payload.session_id or not payload.user_message or not payload.user_message.strip():
        raise HTTPException(status_code=400, detail="session_id and user_message are required")
    try:
        message, done = handle_message(
            payload.session_id,
            payload.user_message,
        )
    except ValueError as e:
        if str(e) == "session_not_found":
            raise HTTPException(status_code=404, detail="Session expired or not found. Start again.")
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": message, "done": done}


@onboarding.post("/onboarding/sync-dashboard", response_model=OnboardingSyncDashboardResponse)
def onboarding_sync_dashboard(payload: OnboardingSyncDashboardRequest):
    r = sync_dashboard_metrics(payload.patient_id)
    return {"ok": True, "created": r["created"], "score": r.get("score")}


@onboarding.post("/onboarding/persist-session")
def onboarding_persist_session(payload: OnboardingPersistSessionRequest):
    persist_onboarding_session(payload.session_id, payload.patient_id)
    return {"ok": True}
