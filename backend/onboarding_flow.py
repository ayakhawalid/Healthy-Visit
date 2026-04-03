"""
AI-driven onboarding: warm conversation + structured capture of height/weight
and a short set of FANTASTIC questions (free-text mapped via existing helpers).
"""
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, Literal, Optional, Tuple

from dotenv import load_dotenv

from database import conn
from models import PatientProfile

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

from CRUD.fantastic import (
    _conversational_prompt_for,
    _normalize_free_text_to_option_index,
    _question_by_id,
    _upsert_latest_answer,
)

FANTASTIC_QIDS = ("S1", "S3", "N1", "A2", "F1")

ONBOARDING_SESSIONS: Dict[str, "OnboardingSession"] = {}


@dataclass
class OnboardingSession:
    session_id: str
    patient_id: int
    phase: Literal["demographics", "fantastic", "done"] = "demographics"
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    fantastic_index: int = 0
    history: list = field(default_factory=list)


def _invoke_chat(system: str, user: str, temperature: float = 0.5) -> str:
    if not OPENAI_API_KEY or not ChatOpenAI:
        return ""
    try:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=temperature)
        r = llm.invoke(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        return (getattr(r, "content", None) or "").strip()
    except Exception:
        return ""


def opening_message() -> str:
    system = (
        "You are a warm, brief health onboarding coach for an app called Healthy Visit. "
        "Write a friendly greeting (2–3 short sentences) and naturally ask for the person's "
        "height in centimeters and weight in kilograms. Sound human and supportive, not clinical. "
        "Do not mention questionnaires or scoring."
    )
    user = "Start the conversation."
    out = _invoke_chat(system, user, temperature=0.7)
    if out:
        return out
    return (
        "Hi — welcome to Healthy Visit. I'm here to get a quick sense of how you're doing. "
        "Could you share your height (in cm) and your weight (in kg)? You can type them in one message."
    )


def _parse_demographics_json(raw: str) -> Tuple[Optional[float], Optional[float], str]:
    """Try to parse LLM JSON for height_cm, weight_kg, reply."""
    height = weight = None
    if not raw:
        return None, None, ""
    reply = raw.strip()
    try:
        # strip markdown fences
        t = raw.strip()
        if "```" in t:
            t = re.sub(r"^```(?:json)?\s*", "", t)
            t = re.sub(r"\s*```$", "", t)
        data = json.loads(t)
        if isinstance(data, dict):
            reply = str(data.get("reply") or reply)
            h = data.get("height_cm")
            w = data.get("weight_kg")
            if h is not None:
                height = float(h)
            if w is not None:
                weight = float(w)
    except Exception:
        pass
    return height, weight, reply


def _regex_extract_numbers(text: str) -> Tuple[Optional[float], Optional[float]]:
    """Fallback: find plausible height (cm) and weight (kg)."""
    height = weight = None
    t = text.lower()
    cm = re.search(r"(\d{2,3})\s*(?:cm|centimeters?)?", t)
    if cm:
        h = float(cm.group(1))
        if 80 <= h <= 250:
            height = h
    kg = re.search(r"(\d{2,3}(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)?", t)
    if kg:
        w = float(kg.group(1))
        if 30 <= w <= 300:
            weight = w
    return height, weight


def demographics_turn(
    sess: OnboardingSession, user_message: str
) -> Tuple[str, bool]:
    """
    Returns (assistant_message, transition_to_fantastic).
    """
    system = """You are a warm onboarding coach. The patient is sharing height/weight or clarifying.
You must respond with ONLY a JSON object (no markdown), keys:
- "reply": string, your short friendly message (1-3 sentences).
- "height_cm": number or null (height in centimeters, 80-250 if known).
- "weight_kg": number or null (weight in kilograms, 30-300 if known).

If the user gave only one value, acknowledge and ask naturally for the other.
If both are unclear, ask again gently."""
    user = (
        f"Known so far: height_cm={sess.height_cm}, weight_kg={sess.weight_kg}.\n"
        f"Patient message: {user_message}\n"
        "Extract any new numbers. Update reply accordingly."
    )
    raw = _invoke_chat(system, user, temperature=0.35)
    h, w, reply = _parse_demographics_json(raw or user_message)

    if h is None and sess.height_cm is None:
        rh, rw = _regex_extract_numbers(user_message)
        if h is None:
            h = rh
        if w is None:
            w = rw
    else:
        if w is None and sess.weight_kg is None:
            _, rw = _regex_extract_numbers(user_message)
            w = rw
        if h is None and sess.height_cm is None:
            rh, _ = _regex_extract_numbers(user_message)
            h = rh

    if h is not None and 80 <= h <= 250:
        sess.height_cm = h
    if w is not None and 30 <= w <= 300:
        sess.weight_kg = w

    if not reply or reply == user_message:
        reply = (
            "Thanks — could you also share your height in cm and weight in kg when you can?"
        )

    # Persist partial profile
    if sess.height_cm is not None or sess.weight_kg is not None:
        _upsert_profile_partial(sess.patient_id, sess.height_cm, sess.weight_kg)

    ready = sess.height_cm is not None and sess.weight_kg is not None
    if ready:
        # One cohesive AI message: thanks + transition + first lifestyle question (still Q index 0)
        qid = FANTASTIC_QIDS[0]
        q = _question_by_id(qid)
        topic_hint = _conversational_prompt_for(qid, q.domain if q else "")
        system = (
            "You are a warm onboarding coach. The patient just shared height and weight. "
            "Write ONE message with 3 short paragraphs separated by blank lines: "
            "(1) thank them briefly, "
            "(2) one sentence that you'll ask a few simple lifestyle questions, "
            "(3) ask the first question naturally — about how they slept recently — "
            "without sounding like a formal survey. "
            "Do not mention scoring or questionnaires."
        )
        user = f"Height_cm={sess.height_cm}, weight_kg={sess.weight_kg}. Guide for first question: {topic_hint}"
        combined = _invoke_chat(system, user, temperature=0.65)
        if not combined:
            combined = (
                f"{reply}\n\n{_fantastic_intro_ai()}\n\n{topic_hint}"
            )
        return combined, True

    return reply, False


def _fantastic_intro_ai() -> str:
    system = (
        "Write one short friendly sentence transitioning to a few simple lifestyle questions. "
        "No bullet points."
    )
    out = _invoke_chat(system, "Transition from demographics to lifestyle.", temperature=0.6)
    return out or "Great — I’ll ask a few quick things about sleep, stress, food, activity, and support."


def _upsert_profile_partial(patient_id: int, height_cm: Optional[float], weight_kg: Optional[float]) -> None:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    vals = {}
    if height_cm is not None:
        vals["height_cm"] = height_cm
    if weight_kg is not None:
        vals["weight_kg"] = weight_kg
    if not vals:
        return
    if row:
        conn.execute(
            PatientProfile.update().values(**vals).where(PatientProfile.c.id == row[0])
        )
    else:
        conn.execute(
            PatientProfile.insert().values(patient_id=patient_id, **vals, onboarding_completed=False)
        )
    conn.commit()


def _mark_onboarding_done(patient_id: int) -> None:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    today = date.today()
    if row:
        keys = list(PatientProfile.c.keys())
        d = dict(zip(keys, row))
        upd = {"onboarding_completed": True}
        if d.get("study_start_date") is None:
            upd["study_start_date"] = today
        conn.execute(
            PatientProfile.update()
            .values(**upd)
            .where(PatientProfile.c.id == row[0])
        )
    else:
        conn.execute(
            PatientProfile.insert().values(
                patient_id=patient_id,
                onboarding_completed=True,
                study_start_date=today,
            )
        )
    conn.commit()


def fantastic_turn(sess: OnboardingSession, user_message: str) -> Tuple[str, bool]:
    """Process answer for current FANTASTIC question; return (message, done)."""
    qid = FANTASTIC_QIDS[sess.fantastic_index]
    idx = _normalize_free_text_to_option_index(qid, user_message.strip())
    _upsert_latest_answer(sess.patient_id, qid, idx)
    conn.commit()

    sess.fantastic_index += 1
    if sess.fantastic_index >= len(FANTASTIC_QIDS):
        sess.phase = "done"
        _mark_onboarding_done(sess.patient_id)
        farewell = _farewell_ai()
        return farewell, True

    next_qid = FANTASTIC_QIDS[sess.fantastic_index]
    q = _question_by_id(next_qid)
    topic = _conversational_prompt_for(next_qid, q.domain if q else "")
    ack = _acknowledge_and_ask_ai(user_message, topic)
    return ack, False


def _acknowledge_and_ask_ai(prev_answer: str, next_question_topic: str) -> str:
    system = (
        "You are a warm coach. Briefly acknowledge what the patient said (one short sentence), "
        "then naturally ask the next question. Stay under 3 sentences. "
        "Do not repeat the exact rubric wording; paraphrase the intent."
    )
    user = f"They said: {prev_answer}\nNext topic to ask (guide): {next_question_topic}"
    out = _invoke_chat(system, user, temperature=0.65)
    if out:
        return out
    return f"Thanks for sharing. {next_question_topic}"


def _farewell_ai() -> str:
    system = (
        "Write a short warm closing (2 sentences): onboarding is done, they can sign in, "
        "and tracking will continue with wearables and daily check-ins."
    )
    out = _invoke_chat(system, "Done.", temperature=0.6)
    if out:
        return out
    return (
        "That’s everything for now — you can sign in. Your dashboard will fill in more "
        "as we sync wearables and daily questions over the next few weeks."
    )


def start_session(patient_id: int) -> Tuple[str, str]:
    sid = str(uuid.uuid4())
    sess = OnboardingSession(session_id=sid, patient_id=patient_id)
    ONBOARDING_SESSIONS[sid] = sess
    msg = opening_message()
    sess.history.append({"role": "assistant", "content": msg})
    return sid, msg


def handle_message(session_id: str, user_message: str) -> Tuple[str, bool]:
    sess = ONBOARDING_SESSIONS.get(session_id)
    if not sess:
        raise ValueError("session_not_found")
    if sess.phase == "done":
        return "You’ve already finished onboarding. You can sign in.", True

    user_message = (user_message or "").strip()
    if not user_message:
        return "Please type a short answer.", False

    sess.history.append({"role": "user", "content": user_message})

    if sess.phase == "demographics":
        reply, go_fantastic = demographics_turn(sess, user_message)
        if go_fantastic:
            sess.phase = "fantastic"
            sess.history.append({"role": "assistant", "content": reply})
            return reply, False

        sess.history.append({"role": "assistant", "content": reply})
        return reply, False

    # fantastic
    reply, done = fantastic_turn(sess, user_message)
    sess.history.append({"role": "assistant", "content": reply})
    return reply, done


def get_session(session_id: str) -> Optional[OnboardingSession]:
    return ONBOARDING_SESSIONS.get(session_id)


def sync_dashboard_metrics(patient_id: int) -> dict:
    """
    Ensure today's DailyMetrics row exists so the patient dashboard can render.
    If the patient has any FANTASTIC answers (complete or partial), set score to the current %.
    """
    from datetime import date

    from models import DailyMetrics

    from CRUD.fantastic import _compute_score_from_latest, _latest_answers_dict

    today = date.today()
    row = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .where(DailyMetrics.c.date == today)
    ).fetchone()

    latest = _latest_answers_dict(patient_id)
    score = None
    if latest:
        pct, _, _ = _compute_score_from_latest(patient_id)
        score = float(pct)

    if row:
        if score is not None:
            conn.execute(
                DailyMetrics.update()
                .values(score=score)
                .where(DailyMetrics.c.id == row[0])
            )
            conn.commit()
        return {"created": False, "score": score}

    conn.execute(
        DailyMetrics.insert().values(patient_id=patient_id, date=today, score=score)
    )
    conn.commit()
    return {"created": True, "score": score}


def persist_onboarding_session(session_id: Optional[str], patient_id: int) -> None:
    """
    Flush in-memory session demographics to PatientProfile (height/weight) if present,
    then sync today's metric row so partial onboarding data appears on the dashboard.
    """
    sess = ONBOARDING_SESSIONS.get(session_id) if session_id else None
    if sess and sess.patient_id == patient_id:
        if sess.height_cm is not None or sess.weight_kg is not None:
            _upsert_profile_partial(patient_id, sess.height_cm, sess.weight_kg)
    sync_dashboard_metrics(patient_id)
