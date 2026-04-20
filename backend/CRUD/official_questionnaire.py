"""API for the official lifestyle questionnaire — daily drip + answer storage."""
from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, HTTPException

from database import conn
from models import DailyMetrics, LifestyleQuestionnaireAnswers, LifestyleQuestionnairePrompts, PatientProfile
from official_q.catalog import get_question, to_public_dict
from official_q.conversational import norm_chat_lang, scripted_question_line
from official_q.parse_answer import parse_answer
from official_q.radar import radar_for_patient_rows
from official_q.schedule import pick_daily_questions

official_q_router = APIRouter()


def _profile_row(patient_id: int) -> Optional[dict]:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    if not row:
        return None
    keys = list(PatientProfile.c.keys())
    return dict(zip(keys, row))


def answered_question_ids(patient_id: int) -> Set[str]:
    rows = conn.execute(
        LifestyleQuestionnaireAnswers.select().where(
            LifestyleQuestionnaireAnswers.c.patient_id == patient_id
        )
    ).fetchall()
    keys = list(LifestyleQuestionnaireAnswers.c.keys())
    out: Set[str] = set()
    for r in rows:
        d = dict(zip(keys, r))
        out.add(str(d["question_id"]))
    return out


def _prompt_rows(patient_id: int) -> List[Tuple[str, date, bool]]:
    rows = conn.execute(
        LifestyleQuestionnairePrompts.select()
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .order_by(LifestyleQuestionnairePrompts.c.prompted_date.desc())
    ).fetchall()
    keys = list(LifestyleQuestionnairePrompts.c.keys())
    out: List[Tuple[str, date, bool]] = []
    for r in rows:
        d = dict(zip(keys, r))
        out.append((str(d["question_id"]), d["prompted_date"], bool(d["answered"])))
    return out


def _log_prompts(patient_id: int, qids: List[str], today: date) -> None:
    for qid in qids:
        existing = conn.execute(
            LifestyleQuestionnairePrompts.select()
            .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
            .where(LifestyleQuestionnairePrompts.c.question_id == qid)
            .where(LifestyleQuestionnairePrompts.c.prompted_date == today)
        ).fetchone()
        if existing:
            continue
        conn.execute(
            LifestyleQuestionnairePrompts.insert().values(
                patient_id=patient_id,
                question_id=qid,
                prompted_date=today,
                answered=False,
            )
        )
    conn.commit()


def refresh_lifestyle_radar_snapshot(patient_id: int, d: date) -> None:
    """Recompute 10-axis radar from all saved answers and store JSON on today's DailyMetrics row."""
    rows = conn.execute(
        LifestyleQuestionnaireAnswers.select().where(
            LifestyleQuestionnaireAnswers.c.patient_id == patient_id
        )
    ).fetchall()
    radar = radar_for_patient_rows(rows)
    payload = json.dumps(radar, ensure_ascii=False)
    row = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .where(DailyMetrics.c.date == d)
    ).fetchone()
    if row:
        conn.execute(
            DailyMetrics.update()
            .values(lifestyle_radar_json=payload)
            .where(DailyMetrics.c.id == row[0])
        )
    else:
        conn.execute(
            DailyMetrics.insert().values(
                patient_id=patient_id,
                date=d,
                lifestyle_radar_json=payload,
            )
        )
    conn.commit()


def upsert_official_answer(patient_id: int, question_id: str, value: Dict[str, Any], today: date) -> None:
    payload = json.dumps(value, ensure_ascii=False)
    existing = conn.execute(
        LifestyleQuestionnaireAnswers.select()
        .where(LifestyleQuestionnaireAnswers.c.patient_id == patient_id)
        .where(LifestyleQuestionnaireAnswers.c.question_id == question_id)
    ).fetchone()
    if existing:
        conn.execute(
            LifestyleQuestionnaireAnswers.update()
            .values(value_json=payload, answered_at=today)
            .where(LifestyleQuestionnaireAnswers.c.id == existing[0])
        )
    else:
        conn.execute(
            LifestyleQuestionnaireAnswers.insert().values(
                patient_id=patient_id,
                question_id=question_id,
                value_json=payload,
                answered_at=today,
            )
        )
    # Mark any prompts for this question as answered
    conn.execute(
        LifestyleQuestionnairePrompts.update()
        .values(answered=True)
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .where(LifestyleQuestionnairePrompts.c.question_id == question_id)
        .where(LifestyleQuestionnairePrompts.c.answered.is_(False))
    )
    conn.commit()
    refresh_lifestyle_radar_snapshot(patient_id, today)


@official_q_router.get("/official-questionnaire/daily")
def get_daily_batch(
    patient_id: int,
    day: Optional[date] = None,
    language: Optional[str] = None,
):
    """Up to two questions for today; logs prompts for retry scheduling."""
    today = day or date.today()
    lang = norm_chat_lang(language)
    prof = _profile_row(patient_id)
    study_start = prof.get("study_start_date") if prof else None
    answered = answered_question_ids(patient_id)
    prompts = _prompt_rows(patient_id)
    qids = pick_daily_questions(answered, prompts, today, study_start)
    _log_prompts(patient_id, qids, today)
    items = []
    for qid in qids:
        q = get_question(qid)
        if q:
            d = to_public_dict(q)
            d["conversational_prompt"] = scripted_question_line(q, lang)
            items.append(d)
    return {
        "patient_id": patient_id,
        "date": today,
        "study_start_date": study_start.isoformat() if study_start else None,
        "questions": items,
    }


@official_q_router.post("/official-questionnaire/answer")
def submit_answer(payload: Dict[str, Any]):
    patient_id = int(payload.get("patient_id", 0))
    question_id = str(payload.get("question_id", "")).strip()
    user_message = str(payload.get("user_message", "")).strip()
    if not patient_id or not question_id:
        raise HTTPException(status_code=400, detail="patient_id and question_id are required")
    q = get_question(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Unknown question_id")
    if not user_message:
        raise HTTPException(status_code=400, detail="user_message is required")
    value = parse_answer(q, user_message)
    today = date.today()
    upsert_official_answer(patient_id, question_id, value, today)
    return {"ok": True, "patient_id": patient_id, "question_id": question_id, "parsed": value}


@official_q_router.get("/official-questionnaire/radar-profile")
def get_radar_profile(patient_id: int):
    """Latest 10 domain scores (0–100) aligned with Excel radar sheet; nulls until data exists."""
    rows = conn.execute(
        LifestyleQuestionnaireAnswers.select().where(
            LifestyleQuestionnaireAnswers.c.patient_id == patient_id
        )
    ).fetchall()
    domains = radar_for_patient_rows(rows)
    return {"patient_id": patient_id, "domains": domains}


@official_q_router.get("/official-questionnaire/progress")
def get_progress(patient_id: int):
    answered = answered_question_ids(patient_id)
    from official_q.catalog import PRIMARY_ORDER

    primary_set = set(PRIMARY_ORDER)
    answered_primary = answered & primary_set
    total = len(PRIMARY_ORDER)
    return {
        "patient_id": patient_id,
        "answered_count": len(answered_primary),
        "total_primary": total,
        "answered_ids": sorted(answered_primary, key=lambda x: int(x)),
    }
