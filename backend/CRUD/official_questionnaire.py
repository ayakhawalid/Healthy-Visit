"""API for the official lifestyle questionnaire — daily drip + answer storage."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, HTTPException

from database import conn
from models import (
    DailyMetrics,
    LifestyleQuestionnaireAnswers,
    LifestyleQuestionnairePrompts,
    PatientProfile,
    QuestionnaireDailyDecline,
    QuestionnaireQuestionSnooze,
)
from functools import lru_cache

from official_q.catalog import get_question, to_public_dict
from official_q.conversational import (
    conversational_question_for_item,
    norm_chat_lang,
    scripted_question_line,
)
from official_q.llm_utils import invoke_chat
from official_q.parse_answer import parse_answer
from official_q.radar import radar_for_patient_rows
from official_q.schedule import RETRY_AFTER_DAYS, pick_daily_questions

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


# Max distinct questions we may log for one patient on one calendar day.
# Matches product expectation (~4–5 touches per day) and prevents repeated
# `/daily` refetches from stacking extra new questions in the same day.
_DAILY_QUESTION_CAP = 5


def _declined_today(patient_id: int, today: date) -> bool:
    row = conn.execute(
        QuestionnaireDailyDecline.select()
        .where(QuestionnaireDailyDecline.c.patient_id == patient_id)
        .where(QuestionnaireDailyDecline.c.decline_date == today)
    ).fetchone()
    return row is not None


def _question_ids_prompted_today(patient_id: int, today: date) -> List[str]:
    """Question ids already prompted today, stable order (first logged first)."""
    rows = conn.execute(
        LifestyleQuestionnairePrompts.select()
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .where(LifestyleQuestionnairePrompts.c.prompted_date == today)
        .order_by(LifestyleQuestionnairePrompts.c.id.asc())
    ).fetchall()
    keys = list(LifestyleQuestionnairePrompts.c.keys())
    seen: Set[str] = set()
    out: List[str] = []
    for r in rows:
        d = dict(zip(keys, r))
        qid = str(d["question_id"])
        if qid not in seen:
            seen.add(qid)
            out.append(qid)
    return out


def _open_question_ids_today(patient_id: int, today: date, answered_ids: Set[str]) -> List[str]:
    """Today's questions still waiting on an answer (prompt row answered=False).

    Skipped-without-answer removes the prompt row so the id drops out here; a
    new id may be logged the same day up to the daily cap.
    """
    rows = conn.execute(
        LifestyleQuestionnairePrompts.select()
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .where(LifestyleQuestionnairePrompts.c.prompted_date == today)
        .where(LifestyleQuestionnairePrompts.c.answered.is_(False))
        .order_by(LifestyleQuestionnairePrompts.c.id.asc())
    ).fetchall()
    keys = list(LifestyleQuestionnairePrompts.c.keys())
    seen: Set[str] = set()
    out: List[str] = []
    for r in rows:
        d = dict(zip(keys, r))
        qid = str(d["question_id"])
        if qid in answered_ids:
            continue
        if qid not in seen:
            seen.add(qid)
            out.append(qid)
    return out


def _snooze_until_by_qid(patient_id: int) -> Dict[str, date]:
    """First calendar day each question id may be offered again after skip."""
    rows = conn.execute(
        QuestionnaireQuestionSnooze.select().where(
            QuestionnaireQuestionSnooze.c.patient_id == patient_id
        )
    ).fetchall()
    keys = list(QuestionnaireQuestionSnooze.c.keys())
    out: Dict[str, date] = {}
    for row in rows:
        m = dict(zip(keys, row))
        qid = str(m["question_id"])
        su = m["snooze_until"]
        if qid not in out or su > out[qid]:
            out[qid] = su
    return out


def _any_prompt_row_today(patient_id: int, today: date) -> bool:
    row = conn.execute(
        LifestyleQuestionnairePrompts.select()
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .where(LifestyleQuestionnairePrompts.c.prompted_date == today)
        .limit(1)
    ).fetchone()
    return row is not None


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
    conn.execute(
        QuestionnaireQuestionSnooze.delete()
        .where(QuestionnaireQuestionSnooze.c.patient_id == patient_id)
        .where(QuestionnaireQuestionSnooze.c.question_id == question_id)
    )
    conn.commit()
    refresh_lifestyle_radar_snapshot(patient_id, today)


@official_q_router.get("/official-questionnaire/daily")
def get_daily_batch(
    patient_id: int,
    day: Optional[date] = None,
    language: Optional[str] = None,
):
    """Up to `_DAILY_QUESTION_CAP` questions per calendar day; logs prompts for retry scheduling."""
    today = day or date.today()
    lang = norm_chat_lang(language)
    prof = _profile_row(patient_id)
    study_start = prof.get("study_start_date") if prof else None

    if _declined_today(patient_id, today):
        return {
            "patient_id": patient_id,
            "date": today,
            "study_start_date": study_start.isoformat() if study_start else None,
            "questions": [],
            "session_closed_today": True,
            "daily_batch_complete": False,
        }

    answered = answered_question_ids(patient_id)
    prompts = _prompt_rows(patient_id)
    already_today = _question_ids_prompted_today(patient_id, today)
    open_qids = _open_question_ids_today(patient_id, today, answered)
    if len(already_today) >= _DAILY_QUESTION_CAP:
        # At the daily cap: only return questions that still have an open prompt
        # today (real answers already closed their prompt rows).
        qids = list(open_qids)
    else:
        qids = list(open_qids)
        remaining_slots = _DAILY_QUESTION_CAP - len(already_today)
        extra = pick_daily_questions(
            answered,
            prompts,
            today,
            study_start,
            max_questions=remaining_slots,
            exclude_qids=set(already_today),
            snooze_until_by_qid=_snooze_until_by_qid(patient_id),
        )
        for q in extra:
            if q not in answered and q not in qids:
                qids.append(q)
    _log_prompts(patient_id, qids, today)
    items = []
    for qid in qids:
        q = get_question(qid)
        if q:
            d = to_public_dict(q)
            d["conversational_prompt"] = conversational_question_for_item(q, lang)
            items.append(d)

    # Nothing left to ask today (all answered or skipped out), and we actually
    # ran a drip today — avoids treating a brand-new day as "complete".
    daily_batch_complete = bool(
        not items
        and _any_prompt_row_today(patient_id, today)
        and not open_qids
    )

    return {
        "patient_id": patient_id,
        "date": today,
        "study_start_date": study_start.isoformat() if study_start else None,
        "questions": items,
        "session_closed_today": False,
        "daily_batch_complete": daily_batch_complete,
    }


@official_q_router.post("/official-questionnaire/skip-question")
def skip_question(payload: Dict[str, Any]):
    """Remove today's open prompt for one question so the patient can get another.

    Used for **Not today** on the current item: deletes the unanswered prompt
    row for this calendar day only (no fake answer stored). Records
    `QuestionnaireQuestionSnooze` so the same question id is not picked again
    until `RETRY_AFTER_DAYS` calendar days have passed (same window as leaving
    a prompt unanswered). `/daily` may then offer a different question if the
    daily cap still has room.
    """
    patient_id = int(payload.get("patient_id", 0))
    question_id = str(payload.get("question_id", "")).strip()
    if not patient_id or not question_id:
        raise HTTPException(status_code=400, detail="patient_id and question_id are required")
    today = date.today()
    row = conn.execute(
        LifestyleQuestionnairePrompts.select()
        .where(LifestyleQuestionnairePrompts.c.patient_id == patient_id)
        .where(LifestyleQuestionnairePrompts.c.question_id == question_id)
        .where(LifestyleQuestionnairePrompts.c.prompted_date == today)
        .where(LifestyleQuestionnairePrompts.c.answered.is_(False))
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=404,
            detail="No open prompt for this question today",
        )
    row_id = row[0]
    conn.execute(LifestyleQuestionnairePrompts.delete().where(LifestyleQuestionnairePrompts.c.id == row_id))
    # Prompt row is gone, so pick_daily_questions would not see last_prompt;
    # persist the same cooldown as unanswered prompts (RETRY_AFTER_DAYS).
    snooze_first_eligible = today + timedelta(days=RETRY_AFTER_DAYS)
    snooze_existing = conn.execute(
        QuestionnaireQuestionSnooze.select()
        .where(QuestionnaireQuestionSnooze.c.patient_id == patient_id)
        .where(QuestionnaireQuestionSnooze.c.question_id == question_id)
    ).fetchone()
    if snooze_existing:
        conn.execute(
            QuestionnaireQuestionSnooze.update()
            .values(snooze_until=snooze_first_eligible)
            .where(QuestionnaireQuestionSnooze.c.id == snooze_existing[0])
        )
    else:
        conn.execute(
            QuestionnaireQuestionSnooze.insert().values(
                patient_id=patient_id,
                question_id=question_id,
                snooze_until=snooze_first_eligible,
            )
        )
    conn.commit()
    return {"ok": True, "patient_id": patient_id, "question_id": question_id}


@official_q_router.post("/official-questionnaire/decline-today")
def decline_today(payload: Dict[str, Any]):
    """Patient defers all remaining daily questions until tomorrow.

    We **do not** delete `LifestyleQuestionnairePrompts` rows: those rows are
    what `pick_daily_questions` uses to know a question was shown and left
    unanswered, so it can wait `_RETRY_AFTER_DAYS` and then offer it again.
    We only record `QuestionnaireDailyDecline` so `/daily` returns an empty
    list for the rest of the calendar day.
    """
    patient_id = int(payload.get("patient_id", 0))
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    today = date.today()
    if _declined_today(patient_id, today):
        return {"ok": True, "already_declined": True}
    conn.execute(
        QuestionnaireDailyDecline.insert().values(patient_id=patient_id, decline_date=today)
    )
    conn.commit()
    return {"ok": True, "patient_id": patient_id, "date": today.isoformat()}


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


_HE_YES_NO = {"לא": "no", "כן": "yes", "לא ידוע": "unknown"}


@lru_cache(maxsize=4096)
def _translate_option_label(label: str, lang: str) -> str:
    """Translate a Hebrew catalog option label to the requested UI language.

    Catalog options are stored in Hebrew only, so when the patient is using
    the English UI we'd otherwise leak Hebrew into the audit caption next to
    English questions and English raw replies. We use the same LLM helper
    the rest of the questionnaire uses, with an in-memory cache so each
    distinct label is translated at most once per process.
    """
    s = (label or "").strip()
    if not s or lang == "he":
        return s
    if s in _HE_YES_NO:
        return _HE_YES_NO[s]
    system = (
        "Translate the given Hebrew option label from a health questionnaire "
        "into short, natural English. Reply with ONLY the translation — no "
        "punctuation, no quotes, no extra words."
    )
    out = invoke_chat(system, s, temperature=0.0).strip()
    if not out:
        return s
    out = out.strip().strip('"').strip("'").splitlines()[0].strip()
    return out or s


def _raw_reply(parsed: Any) -> str:
    """Return the patient's exact typed reply if it was preserved."""
    if not isinstance(parsed, dict):
        return ""
    if parsed.get("empty"):
        return ""
    raw = str(parsed.get("raw") or "").strip()
    if raw:
        return raw
    if parsed.get("kind") == "text":
        return str(parsed.get("value") or "").strip()
    return ""


def _saved_as(parsed: Any, lang: str = "he") -> str:
    """Return the parser's conclusion as a short audit-friendly string.

    This is what scoring sees — the chosen option label, multi-select
    labels, parsed number, free-text value, or "(no answer)" — so the
    patient can verify the LLM mapping next to their own raw reply. When
    `lang == "en"` we translate Hebrew catalog option labels so the audit
    caption matches the rest of the UI.
    """
    if not isinstance(parsed, dict):
        return ""
    if parsed.get("empty"):
        return "(no answer)" if lang == "en" else "(אין תשובה)"
    kind = parsed.get("kind")
    if kind == "text":
        return str(parsed.get("value") or "").strip()
    if kind == "single_choice":
        label = parsed.get("label")
        if label:
            return _translate_option_label(str(label), lang)
        idx = parsed.get("index")
        return (f"option {idx}" if lang == "en" else f"אפשרות {idx}") if idx is not None else ""
    if kind == "yes_no_detail":
        idx = parsed.get("index")
        detail = str(parsed.get("detail") or "").strip()
        if lang == "en":
            base = "yes" if idx == 1 else "no"
        else:
            base = "כן" if idx == 1 else "לא"
        return f"{base} — {detail}" if detail else base
    if kind == "multi_choice":
        labels = parsed.get("labels") or []
        if isinstance(labels, list) and labels:
            return ", ".join(
                _translate_option_label(str(x), lang)
                for x in labels
                if str(x).strip()
            )
        idxs = parsed.get("indices") or []
        if isinstance(idxs, list) and idxs:
            prefix = "option" if lang == "en" else "אפשרות"
            return ", ".join(f"{prefix} {i}" for i in idxs)
        return ""
    if kind == "number":
        v = parsed.get("value")
        if v is None:
            return "(no number parsed)" if lang == "en" else "(לא זוהה מספר)"
        try:
            fv = float(v)
            return f"{int(fv)}" if fv.is_integer() else f"{fv}"
        except (TypeError, ValueError):
            return str(v)
    value = parsed.get("value")
    if isinstance(value, (str, int, float)):
        return str(value).strip()
    return ""


@official_q_router.get("/official-questionnaire/history")
def get_history(patient_id: int, language: Optional[str] = None):
    """Every question this patient has already answered, oldest first.

    Returned entries include the catalog metadata the frontend needs to
    display the question text in either language plus a human-readable
    rendering of the saved answer, so the daily-metrics chat can replay
    past Q+A pairs grouped by subject.
    """
    lang = norm_chat_lang(language)
    rows = conn.execute(
        LifestyleQuestionnaireAnswers.select()
        .where(LifestyleQuestionnaireAnswers.c.patient_id == patient_id)
        .order_by(LifestyleQuestionnaireAnswers.c.answered_at.asc())
    ).fetchall()
    keys = list(LifestyleQuestionnaireAnswers.c.keys())
    answers: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(zip(keys, r))
        qid = str(d["question_id"])
        q = get_question(qid)
        if not q:
            continue
        try:
            parsed = json.loads(d.get("value_json") or "{}")
        except (TypeError, ValueError):
            parsed = {}
        raw_answer = _raw_reply(parsed)
        saved_as = _saved_as(parsed, lang)
        answered_at = d.get("answered_at")
        answers.append(
            {
                "question_id": qid,
                "part": q.part,
                "domain": q.domain,
                "hebrew": q.hebrew,
                "kind": q.kind,
                "options": q.options,
                "answered_at": answered_at.isoformat() if answered_at else None,
                "raw_answer": raw_answer,
                "saved_as": saved_as,
                "conversational_prompt": scripted_question_line(q, lang),
                "value": parsed,
            }
        )
    return {"patient_id": patient_id, "answers": answers}


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
