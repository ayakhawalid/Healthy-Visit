import json
import os
from datetime import date as _date
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

from database import conn
from models import DailyMetrics, FantasticDailyCheckins, FantasticDailyScores, FantasticLatestAnswers
from schemas import (
    FantasticAnswerFreeTextCreate,
    FantasticAnswerResponse,
    FantasticDailyAnswerCreate,
    FantasticDailyAnswerFreeTextCreate,
    FantasticDailyAnswerResponse,
    FantasticDailyQuestionResponse,
    FantasticQuestionResponse,
)
from fantastic.scoring import QUESTIONNAIRE, interpret_score, score_answers

fantastic = APIRouter()

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def _question_by_id(qid: str):
    for q in QUESTIONNAIRE.questions:
        if q.question_id == qid:
            return q
    return None


def _get_recent_metrics(patient_id: int, limit: int = 7) -> List[dict]:
    rows = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .order_by(DailyMetrics.c.date.desc())
        .limit(limit)
    ).fetchall()
    keys = list(DailyMetrics.c.keys())
    return [dict(zip(keys, r)) for r in rows]


def _missing_count(rows: List[dict], field: str, last_n: int = 3) -> int:
    subset = rows[:last_n]
    return sum(1 for r in subset if r.get(field) is None)


def _variance(rows: List[dict], field: str, last_n: int = 7) -> Optional[float]:
    vals = [r.get(field) for r in rows[:last_n] if isinstance(r.get(field), (int, float))]
    if len(vals) < 3:
        return None
    mean = sum(vals) / len(vals)
    return sum((v - mean) ** 2 for v in vals) / len(vals)


def _answered_question_ids(patient_id: int) -> set[str]:
    rows = conn.execute(
        FantasticLatestAnswers.select().where(FantasticLatestAnswers.c.patient_id == patient_id)
    ).fetchall()
    return set(r[2] for r in rows)  # question_id


def _latest_answers_dict(patient_id: int) -> Dict[str, int]:
    rows = conn.execute(
        FantasticLatestAnswers.select().where(FantasticLatestAnswers.c.patient_id == patient_id)
    ).fetchall()
    # Table columns: id, patient_id, question_id, selected_index
    return {r[2]: int(r[3]) for r in rows}


def _upsert_latest_answer(patient_id: int, question_id: str, selected_index: int) -> None:
    existing = conn.execute(
        FantasticLatestAnswers.select()
        .where(FantasticLatestAnswers.c.patient_id == patient_id)
        .where(FantasticLatestAnswers.c.question_id == question_id)
    ).fetchone()
    if existing:
        conn.execute(
            FantasticLatestAnswers.update()
            .values(selected_index=selected_index)
            .where(FantasticLatestAnswers.c.id == existing[0])
        )
    else:
        conn.execute(
            FantasticLatestAnswers.insert().values(
                patient_id=patient_id,
                question_id=question_id,
                selected_index=selected_index,
            )
        )


def _ensure_daily_metrics_row(patient_id: int, d: _date) -> Optional[int]:
    row = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .where(DailyMetrics.c.date == d)
    ).fetchone()
    if row:
        return row[0]
    result = conn.execute(DailyMetrics.insert().values(patient_id=patient_id, date=d))
    return result.inserted_primary_key[0]


def _pick_daily_question(patient_id: int, d: _date) -> Tuple[str, str, str]:
    """
    Adaptive selector:
    - Prioritize domains where recent DailyMetrics are missing/unstable (precision gap).
    - Within that domain, ask an *unanswered* FANTASTIC question if possible.
    """
    recent = _get_recent_metrics(patient_id, limit=7)
    answered = _answered_question_ids(patient_id)

    # Domain -> (question_ids in that domain, signals derived from DailyMetrics)
    # We keep the list small and targeted; you can expand later.
    candidates: List[Tuple[str, str, float, str]] = []
    # tuple: (domain, question_id, priority_score, reason)

    # Sleep precision: missing sleep/sleep_quality OR high variability
    sleep_missing = _missing_count(recent, "sleep", 3) + _missing_count(recent, "sleep_quality", 3)
    sleep_var = _variance(recent, "sleep", 7) or 0.0
    sleep_priority = sleep_missing * 3 + (1.0 if sleep_var >= 1.5 else 0.0)
    candidates.append((
        "SLEEP SEATBELT STRESS SAFE SEX",
        "S1",
        sleep_priority,
        f"Sleep precision gap: missing_fields_last3={sleep_missing}, sleep_variance={sleep_var:.2f}",
    ))

    # Stress precision: missing stress_score or high variability
    stress_missing = _missing_count(recent, "stress_score", 3)
    stress_var = _variance(recent, "stress_score", 7) or 0.0
    stress_priority = stress_missing * 3 + (1.0 if stress_var >= 1.0 else 0.0)
    candidates.append((
        "SLEEP SEATBELT STRESS SAFE SEX",
        "S3",
        stress_priority,
        f"Stress precision gap: missing_last3={stress_missing}, stress_variance={stress_var:.2f}",
    ))

    # Activity precision: missing active_minutes or steps
    act_missing = _missing_count(recent, "active_minutes", 3) + _missing_count(recent, "steps", 3)
    act_priority = act_missing * 2
    candidates.append((
        "Activity",
        "A2",
        act_priority,
        f"Activity precision gap: missing_fields_last3={act_missing}",
    ))

    # Nutrition precision: missing nutrition_score
    nut_missing = _missing_count(recent, "nutrition_score", 3)
    nut_priority = nut_missing * 2
    candidates.append((
        "Nutrition",
        "N1",
        nut_priority,
        f"Nutrition precision gap: missing_last3={nut_missing}",
    ))

    # Tobacco precision: if is_smoking missing OR cigarettes missing
    tob_missing = _missing_count(recent, "cigarettes_per_day", 3) + _missing_count(recent, "is_smoking", 3)
    tob_priority = tob_missing * 2
    candidates.append((
        "TOBACCO TOXICS",
        "T1",
        tob_priority,
        f"Tobacco precision gap: missing_fields_last3={tob_missing}",
    ))

    # Career/mood: if work_satisfaction missing
    work_missing = _missing_count(recent, "work_satisfaction", 3)
    work_priority = work_missing * 1.5
    candidates.append((
        "CAREER",
        "C1",
        work_priority,
        f"Career precision gap: missing_last3={work_missing}",
    ))

    # Prefer unanswered questions by adding a bonus.
    scored: List[Tuple[float, str, str, str]] = []
    for domain, qid, base, reason in candidates:
        bonus = 2.0 if qid not in answered else 0.0
        scored.append((base + bonus, domain, qid, reason))

    scored.sort(key=lambda x: x[0], reverse=True)
    best = scored[0]
    _, domain, qid, reason = best

    # Fallback safety: if something is off, pick first question in questionnaire.
    if not _question_by_id(qid):
        qid = QUESTIONNAIRE.questions[0].question_id
        domain = QUESTIONNAIRE.questions[0].domain
        reason = "Fallback to first questionnaire item."

    return qid, domain, reason


def _conversational_prompt_for(qid: str, domain: str) -> str:
    # Conversational phrasing (patient-friendly). Keep short and direct.
    prompts = {
        "S1": "How did you sleep last night?",
        "S3": "How have you been coping with stress lately?",
        "A2": "How active were you this week (walking, stairs, housework)?",
        "N1": "How would you describe your eating this week?",
        "T1": "Have you smoked tobacco recently?",
        "C1": "How satisfied do you feel with your job or daily role lately?",
    }
    return prompts.get(qid) or f"Quick check-in about {domain}: how has it been lately?"


def _normalize_free_text_to_option_index(question_id: str, user_message: str) -> int:
    q = _question_by_id(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # If no API key / LangChain available, fall back to middle option.
    if not OPENAI_API_KEY or not ChatOpenAI:
        return max(0, (len(q.options) - 1) // 2)

    options_text = "\n".join(f"{i}: {opt}" for i, opt in enumerate(q.options))
    question_text = q.english_text

    # Detect negative/positive framing to map "amazing/none" correctly.
    is_negative_question = any(word in question_text.lower() for word in [
        "excess", "overuse", "smoke", "drugs", "drive after drinking",
        "tense", "sad", "depressed", "angry", "hostile", "hurry"
    ])
    guidance = (
        f"For NEGATIVE questions: index 0 = worst, index {len(q.options) - 1} = best.\n"
        if is_negative_question else
        f"For POSITIVE questions: index 0 = worst, index {len(q.options) - 1} = best.\n"
    )

    system = (
        "You map a patient's free-text answer to one of the predefined options.\n"
        f"{guidance}"
        f"Only respond with a single integer 0-{len(q.options) - 1}. No other text."
    )
    user = (
        f"Question: {question_text}\n"
        f"Options (index: text):\n{options_text}\n\n"
        f"Patient answer:\n{user_message}\n\n"
        f"Respond with the best matching option index (0-{len(q.options) - 1})."
    )

    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        resp = llm.invoke([{"role": "system", "content": system}, {"role": "user", "content": user}])
        idx_str = (getattr(resp, "content", "") or "").strip()
        idx = int(idx_str)
        if idx < 0 or idx >= len(q.options):
            raise ValueError("index out of range")
        return idx
    except Exception:
        return max(0, (len(q.options) - 1) // 2)


def _compute_score_from_latest(patient_id: int):
    latest = _latest_answers_dict(patient_id)
    total, max_score, pct, domains = score_answers(latest)
    grade = interpret_score(pct)
    return float(pct), str(grade), domains


@fantastic.get("/fantastic/question", response_model=FantasticQuestionResponse)
def get_question(question_id: str):
    q = _question_by_id(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "question_id": q.question_id,
        "domain": q.domain,
        "question_text": _conversational_prompt_for(q.question_id, q.domain),
        "options": q.options,
    }


@fantastic.post("/fantastic/answer-free-text", response_model=FantasticAnswerResponse)
def submit_answer_free_text(payload: FantasticAnswerFreeTextCreate):
    q = _question_by_id(payload.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if not payload.user_message or not payload.user_message.strip():
        raise HTTPException(status_code=400, detail="user_message is required")
    idx = _normalize_free_text_to_option_index(payload.question_id, payload.user_message.strip())
    _upsert_latest_answer(payload.patient_id, payload.question_id, idx)
    conn.commit()
    pct, grade, domains = _compute_score_from_latest(payload.patient_id)
    return {"patient_id": payload.patient_id, "percentage": pct, "grade_label": grade, "domains": domains}


@fantastic.get("/fantastic/daily-question", response_model=FantasticDailyQuestionResponse)
def get_daily_question(patient_id: int, date: _date):
    qid, domain, reason = _pick_daily_question(patient_id, date)
    q = _question_by_id(qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "patient_id": patient_id,
        "date": date,
        "question_id": q.question_id,
        "domain": q.domain,
        "question_text": _conversational_prompt_for(q.question_id, q.domain),
        "options": q.options,
        "reason": reason,
    }


@fantastic.post("/fantastic/daily-answer", response_model=FantasticDailyAnswerResponse)
def submit_daily_answer(payload: FantasticDailyAnswerCreate):
    q = _question_by_id(payload.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if payload.selected_index < 0 or payload.selected_index >= len(q.options):
        raise HTTPException(status_code=400, detail="selected_index out of range")

    # 1) Store daily check-in row (history)
    conn.execute(
        FantasticDailyCheckins.insert().values(
            patient_id=payload.patient_id,
            date=payload.date,
            question_id=payload.question_id,
            selected_index=payload.selected_index,
        )
    )

    # 2) Upsert latest answer snapshot
    _upsert_latest_answer(payload.patient_id, payload.question_id, payload.selected_index)

    # 3) Compute updated score
    pct, grade, domains = _compute_score_from_latest(payload.patient_id)

    # 4) Save daily score snapshot
    conn.execute(
        FantasticDailyScores.insert().values(
            patient_id=payload.patient_id,
            date=payload.date,
            percentage=float(pct),
            grade_label=str(grade),
            domains_json=json.dumps(domains),
        )
    )

    # 5) Update DailyMetrics.score so your dashboard tables/graphs can reflect it immediately
    metric_id = _ensure_daily_metrics_row(payload.patient_id, payload.date)
    if metric_id is not None:
        conn.execute(
            DailyMetrics.update()
            .values(score=float(pct))
            .where(DailyMetrics.c.id == metric_id)
        )

    conn.commit()

    return {
        "patient_id": payload.patient_id,
        "date": payload.date,
        "percentage": float(pct),
        "grade_label": str(grade),
        "domains": domains,
    }


@fantastic.post("/fantastic/daily-answer-free-text", response_model=FantasticDailyAnswerResponse)
def submit_daily_answer_free_text(payload: FantasticDailyAnswerFreeTextCreate):
    q = _question_by_id(payload.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if not payload.user_message or not payload.user_message.strip():
        raise HTTPException(status_code=400, detail="user_message is required")

    idx = _normalize_free_text_to_option_index(payload.question_id, payload.user_message.strip())
    return submit_daily_answer(FantasticDailyAnswerCreate(
        patient_id=payload.patient_id,
        date=payload.date,
        question_id=payload.question_id,
        selected_index=idx,
    ))

