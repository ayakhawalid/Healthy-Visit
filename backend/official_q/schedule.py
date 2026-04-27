"""
Gentle 3-week drip: few questions per day, re-prompt after several days if unanswered.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple

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

# Max questions offered per calendar day (total across all /daily calls).
_MAX_PER_DAY = 5
# After a question was prompted and left unanswered, wait this many full
# calendar days before offering it again (see `eligible` in pick_daily_questions).
_RETRY_AFTER_DAYS = 4
RETRY_AFTER_DAYS = _RETRY_AFTER_DAYS  # public alias (e.g. skip snooze in CRUD)
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
    *,
    max_questions: Optional[int] = None,
    exclude_qids: Optional[Set[str]] = None,
    snooze_until_by_qid: Optional[Dict[str, date]] = None,
) -> List[str]:
    """
    Return up to `max_questions` (default `_MAX_PER_DAY`) question ids to show today.

    Unanswered questions are preferred in catalog order. If a question was
    already prompted and the patient never answered (or chose “not today”
    while it was still in the batch), `LifestyleQuestionnairePrompts` keeps
    that history: we wait `_RETRY_AFTER_DAYS` before that question id becomes
    eligible again, so other questions can run first and skipped items come
    back after a few days.
    """
    pool = daily_pool_supported()
    if not pool:
        return []

    if study_start is None:
        study_start = today

    cap = max_questions if max_questions is not None else _MAX_PER_DAY
    if cap <= 0:
        return []

    excluded = exclude_qids or set()
    snooze = snooze_until_by_qid or {}

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
        if qid in excluded:
            return False
        su = snooze.get(qid)
        if su is not None and today < su:
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
        if len(chosen) >= cap:
            break
        if eligible(qid):
            chosen.append(qid)

    # If strict window left room, fill from beginning
    if len(chosen) < cap:
        for qid in pool:
            if len(chosen) >= cap:
                break
            if eligible(qid):
                if qid not in chosen:
                    chosen.append(qid)

    return chosen[:cap]


def initial_onboarding_sequence() -> List[str]:
    return list(INITIAL_ONBOARDING_QIDS)
