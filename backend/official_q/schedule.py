"""
Gentle 3-week drip: few questions per day, re-prompt after several days if unanswered.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional, Set, Tuple

from official_q.catalog import (
    DAILY_POOL_QIDS,
    INITIAL_ONBOARDING_QIDS,
    QUESTIONS,
    SUPPLEMENTAL_QIDS,
)

# Kinds the current API/chat can collect without a special multi-field UI.
_SUPPORTED_KINDS = frozenset(
    {"single_choice", "multi_choice", "number", "text", "yes_no_detail"}
)

# Skip composite blocks until a dedicated UI exists.
_SKIP_QIDS = frozenset({"61"})

_MAX_PER_DAY = 2
_RETRY_AFTER_DAYS = 4
_MAX_PROMPTS_BEFORE_BACKOFF = 6


def _study_day_index(study_start: date, today: date) -> int:
    return max(0, (today - study_start).days)


def daily_pool_supported() -> List[str]:
    out: List[str] = []
    for qid in DAILY_POOL_QIDS:
        if qid in _SKIP_QIDS or qid in SUPPLEMENTAL_QIDS:
            continue
        q = QUESTIONS.get(qid)
        if not q or q.kind not in _SUPPORTED_KINDS:
            continue
        out.append(qid)
    return out


def pick_daily_questions(
    answered_ids: Set[str],
    prompt_rows: List[Tuple[str, date, bool]],  # (question_id, prompted_date, answered)
    today: date,
    study_start: Optional[date],
) -> List[str]:
    """
    Return up to _MAX_PER_DAY question ids to show today.
    Unanswered questions are preferred in catalog order.
    If a question was prompted several times without an answer, wait _RETRY_AFTER_DAYS before prompting again.
    """
    pool = daily_pool_supported()
    if not pool:
        return []

    if study_start is None:
        study_start = today

    # After day 21, still allow slow catch-up but cap volume
    day_idx = _study_day_index(study_start, today)

    # Build prompt stats per question
    from collections import defaultdict

    last_prompt: dict[str, date] = {}
    prompt_count: dict[str, int] = {}
    for qid, pdate, was_answered in prompt_rows:
        if was_answered:
            continue
        prompt_count[qid] = prompt_count.get(qid, 0) + 1
        if qid not in last_prompt or pdate > last_prompt[qid]:
            last_prompt[qid] = pdate

    chosen: List[str] = []

    def eligible(qid: str) -> bool:
        if qid in answered_ids:
            return False
        if qid in chosen:
            return False
        lp = last_prompt.get(qid)
        if lp is None:
            return True
        days_since = (today - lp).days
        if days_since == 0:
            return True
        cnt = prompt_count.get(qid, 0)
        if cnt >= _MAX_PROMPTS_BEFORE_BACKOFF and days_since < _RETRY_AFTER_DAYS * 2:
            return False
        if days_since < _RETRY_AFTER_DAYS:
            return False
        return True

    # Slight bias: earlier study days get a bit more from the start of the pool
    start_bias = min(len(pool), max(0, day_idx * 2))

    for qid in pool[start_bias:] + pool[:start_bias]:
        if len(chosen) >= _MAX_PER_DAY:
            break
        if eligible(qid):
            chosen.append(qid)

    # If strict window left room, fill from beginning
    if len(chosen) < _MAX_PER_DAY:
        for qid in pool:
            if len(chosen) >= _MAX_PER_DAY:
                break
            if eligible(qid):
                if qid not in chosen:
                    chosen.append(qid)

    return chosen[:_MAX_PER_DAY]


def initial_onboarding_sequence() -> List[str]:
    return list(INITIAL_ONBOARDING_QIDS)
