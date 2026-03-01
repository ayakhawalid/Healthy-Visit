from typing import Dict, Tuple

import json
from pathlib import Path

from .models import Questionnaire


DATA_PATH = Path(__file__).with_name("fantastic_questions.json")


def load_questionnaire() -> Questionnaire:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    questionnaire = Questionnaire.model_validate(data)
    return questionnaire


QUESTIONNAIRE = load_questionnaire()


def interpret_score(percentage: float) -> str:
    if percentage >= 85:
        return "Excellent"
    if percentage >= 70:
        return "Very good"
    if percentage >= 55:
        return "Good"
    if percentage >= 35:
        return "Fair"
    return "Needs improvement"


def score_answers(
    answers: Dict[str, int]
) -> Tuple[int, int, float, Dict[str, Dict[str, int]]]:
    total_score = 0
    max_score = 0
    domain_scores: Dict[str, Dict[str, int]] = {}

    questions_by_id = {q.question_id: q for q in QUESTIONNAIRE.questions}

    for q in QUESTIONNAIRE.questions:
        domain_entry = domain_scores.setdefault(
            q.domain, {"raw_score": 0, "max_score": 0}
        )
        domain_entry["max_score"] += max(q.scores)
        max_score += max(q.scores)

        selected_index = answers.get(q.question_id)
        if selected_index is None:
            selected_index = 0
        if selected_index < 0:
            selected_index = 0
        if selected_index >= len(q.scores):
            selected_index = len(q.scores) - 1

        score_value = q.scores[selected_index]
        total_score += score_value
        domain_entry["raw_score"] += score_value

    percentage = 0.0 if max_score == 0 else (total_score / max_score) * 100.0
    return total_score, max_score, percentage, domain_scores
