from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Question(BaseModel):
    question_id: str
    domain: str
    english_text: str
    hebrew_text: str
    options: List[str] = Field(min_length=2, max_length=5)
    scores: List[int] = Field(min_length=2, max_length=5)


class Questionnaire(BaseModel):
    questions: List[Question]


class ScoreRequest(BaseModel):
    answers: Dict[str, int]


class DomainScore(BaseModel):
    domain: str
    raw_score: int
    max_score: int

    @property
    def percentage(self) -> float:
        if self.max_score == 0:
            return 0.0
        return (self.raw_score / self.max_score) * 100.0


class ScoreResponse(BaseModel):
    total_score: int
    max_score: int
    percentage: float
    grade_label: Literal[
        "Excellent", "Very good", "Good", "Fair", "Needs improvement"
    ]
    domain_scores: Dict[str, DomainScore]


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    user_message: str
    language: Literal["en", "he"] = "en"


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    mode: Literal["collecting", "post_results_chat"]
