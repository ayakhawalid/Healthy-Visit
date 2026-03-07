import json
from sqlalchemy import Table, Column, MetaData, ForeignKey
from sqlalchemy.sql.sqltypes import Boolean, Integer, String, Float, Date
from database import engine

meta = MetaData()

Users = Table('Users', meta,
    Column('id', Integer, unique=True, primary_key=True),
    Column('username',String),
    Column('email', String),
    Column('is_superuser',Boolean),
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
    Column('work_satisfaction', Float, nullable=True) 
)

meta.create_all(engine)