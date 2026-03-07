from pydantic import BaseModel
from typing import Optional
from datetime import date


class User(BaseModel):
    username: str
    email: str
    is_superuser: bool
    password: str


class Login(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_superuser: Optional[bool] = None


class MetricsCreate(BaseModel):
    patient_id: int
    date: date
    steps: Optional[int] = None
    sleep: Optional[int] = None
    score: Optional[float] = None
    active_minutes: Optional[int] = None
    nutrition_score: Optional[float] = None
    alcohol_units: Optional[float] = None
    stress_score: Optional[float] = None
    social_support_score: Optional[float] = None
    cigarettes_per_day: Optional[float] = None
    mood_score: Optional[float] = None
    work_satisfaction: Optional[float] = None
    raw_data: Optional[str] = None
    sleep_quality: Optional[int] = None
    is_smoking: Optional[bool] = None


class MetricsResponse(BaseModel):
    id: int
    patient_id: int
    date: date
    steps: Optional[int] = None
    sleep: Optional[int] = None
    score: Optional[float] = None
    active_minutes: Optional[int] = None
    nutrition_score: Optional[float] = None
    alcohol_units: Optional[float] = None
    stress_score: Optional[float] = None
    social_support_score: Optional[float] = None
    cigarettes_per_day: Optional[float] = None
    mood_score: Optional[float] = None
    work_satisfaction: Optional[float] = None
    raw_data: Optional[str] = None
    sleep_quality: Optional[int] = None
    is_smoking: Optional[bool] = None