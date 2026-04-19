import json
from sqlalchemy import Table, Column, MetaData, ForeignKey
from sqlalchemy.sql.sqltypes import Boolean, Integer, String, Float, Date
from database import engine

meta = MetaData()

Users = Table('Users', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('username', String),
    Column('email', String, unique=True),
    Column('is_superuser',Boolean),
    Column('is_researcher', Boolean, nullable=False, default=False),
    Column('password', String),
)

DailyMetrics = Table('DailyMetrics', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('date', Date),
    Column('steps', Integer, nullable=True),
    Column('sleep', Integer, nullable=True),  
    Column('sleep_quality', Integer, nullable=True),
    Column('score', Float, nullable=True),    
    Column('active_minutes', Integer, nullable=True),
    Column('nutrition_score', Float, nullable=True),
    Column('alcohol_units', Float, nullable=True),
    Column('stress_score', Float, nullable=True),
    Column('social_support_score', Float, nullable=True),
    Column('cigarettes_per_day', Float, nullable=True),
    Column('is_smoking', Boolean, nullable=True),
    Column('mood_score', Float, nullable=True),
    Column('work_satisfaction', Float, nullable=True),
    Column('lifestyle_radar_json', String, nullable=True),
)

# Stores generic patient info collected in onboarding.
PatientProfile = Table('PatientProfile', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('height_cm', Float, nullable=True),
    Column('weight_kg', Float, nullable=True),
    Column('onboarding_completed', Boolean, nullable=False, default=False),
    Column('study_start_date', Date, nullable=True),
)

# --- FANTASTIC AI tracking persistence ---
# Stores the latest selected option index for each FANTASTIC question per patient.
FantasticLatestAnswers = Table('FantasticLatestAnswers', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('question_id', String, nullable=False),
    Column('selected_index', Integer, nullable=False),
)

# Stores the daily check-in answer that the AI asked today (auditable history).
FantasticDailyCheckins = Table('FantasticDailyCheckins', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('date', Date, nullable=False),
    Column('question_id', String, nullable=False),
    Column('selected_index', Integer, nullable=False),
)

# Stores the computed daily FANTASTIC score snapshot.
FantasticDailyScores = Table('FantasticDailyScores', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('date', Date, nullable=False),
    Column('percentage', Float, nullable=False),
    Column('grade_label', String, nullable=False),
    Column('domains_json', String, nullable=True),
)

# Official lifestyle questionnaire (שאלון הערכת התנהגויות בריאות) — answers + gentle drip tracking
LifestyleQuestionnaireAnswers = Table('LifestyleQuestionnaireAnswers', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('question_id', String, nullable=False),
    Column('value_json', String, nullable=False),
    Column('answered_at', Date, nullable=False),
)

LifestyleQuestionnairePrompts = Table('LifestyleQuestionnairePrompts', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('patient_id', Integer, ForeignKey('Users.id')),
    Column('question_id', String, nullable=False),
    Column('prompted_date', Date, nullable=False),
    Column('answered', Boolean, nullable=False, default=False),
)

meta.create_all(engine)