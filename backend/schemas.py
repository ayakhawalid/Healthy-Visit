from pydantic import BaseModel
from typing import Optional
from datetime import date


class User(BaseModel):
    username: str
    email: str
    is_superuser: bool = False
    is_researcher: bool = False
    password: str = ""


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
    is_researcher: Optional[bool] = None


class ResearcherCreate(BaseModel):
    username: str
    email: str
    password: str


class UserAdminUpdate(BaseModel):
    """Admin-only partial update; omit fields you do not change."""
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class MyProfileUpdate(BaseModel):
    username: str
    email: str
    current_password: Optional[str] = None
    new_password: Optional[str] = None


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


class MetricsUpdate(BaseModel):
    date: Optional[date] = None
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


# --- FANTASTIC daily AI check-in ---
class FantasticDailyQuestionResponse(BaseModel):
    patient_id: int
    date: date
    question_id: str
    domain: str
    question_text: str
    options: list[str]
    reason: str


class FantasticDailyAnswerCreate(BaseModel):
    patient_id: int
    date: date
    question_id: str
    selected_index: int


class FantasticDailyAnswerFreeTextCreate(BaseModel):
    patient_id: int
    date: date
    question_id: str
    user_message: str


# --- Patient profile (generic onboarding data) ---
class PatientProfileUpsert(BaseModel):
    patient_id: int
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    onboarding_completed: Optional[bool] = None
    study_start_date: Optional[date] = None


class PatientProfileResponse(BaseModel):
    patient_id: int
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    onboarding_completed: bool
    study_start_date: Optional[date] = None


# --- AI onboarding chat (post-signup) ---
class OnboardingStartRequest(BaseModel):
    patient_id: int


class OnboardingStartResponse(BaseModel):
    session_id: str
    message: str


class OnboardingMessageRequest(BaseModel):
    session_id: str
    user_message: str


class OnboardingMessageResponse(BaseModel):
    message: str
    done: bool


class OnboardingSyncDashboardRequest(BaseModel):
    patient_id: int


class OnboardingSyncDashboardResponse(BaseModel):
    ok: bool = True
    created: bool = False
    score: Optional[float] = None


class OnboardingPersistSessionRequest(BaseModel):
    patient_id: int
    session_id: Optional[str] = None


class FantasticDailyAnswerResponse(BaseModel):
    patient_id: int
    date: date
    percentage: float
    grade_label: str
    domains: dict


class FantasticQuestionResponse(BaseModel):
    question_id: str
    domain: str
    question_text: str
    options: list[str]


class FantasticAnswerFreeTextCreate(BaseModel):
    patient_id: int
    question_id: str
    user_message: str


class FantasticAnswerResponse(BaseModel):
    patient_id: int
    percentage: float
    grade_label: str
    domains: dict