from app.scoring import score_answers, interpret_score, QUESTIONNAIRE


def test_all_worst_options_needs_improvement():
    answers = {q.question_id: 0 for q in QUESTIONNAIRE.questions}
    total, max_score, percentage, _ = score_answers(answers)

    assert total <= max_score
    label = interpret_score(percentage)
    assert label == "Needs improvement"


def test_all_best_options_excellent():
    answers = {q.question_id: 4 for q in QUESTIONNAIRE.questions}
    total, max_score, percentage, _ = score_answers(answers)

    assert total == max_score
    assert 0 <= percentage <= 100
    label = interpret_score(percentage)
    assert label == "Excellent"

