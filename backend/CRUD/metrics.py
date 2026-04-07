import re
from fastapi import APIRouter, HTTPException
from database import conn
from models import DailyMetrics
from schemas import (
    MetricsCreate,
    MetricsUpdate,
    MetricsResponse,
    TopicAnalyzeRequest,
    TopicAnalyzeResponse,
)

metrics = APIRouter()


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy Row into a plain dict suitable for MetricsResponse."""
    keys = list(DailyMetrics.c.keys())
    return dict(zip(keys, row))


def _first_number(text: str):
    m = re.search(r"(-?\d+(?:\.\d+)?)", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


def _match_scale_10(text: str, keyword: str):
    p1 = re.search(rf"{keyword}[^\d]*(\d{{1,2}}(?:\.\d+)?)", text, flags=re.IGNORECASE)
    if p1:
        return float(p1.group(1))
    p2 = re.search(r"(\d{1,2}(?:\.\d+)?)\s*/\s*10", text, flags=re.IGNORECASE)
    if p2:
        return float(p2.group(1))
    return None


def _extract_topic(topic: str, text: str):
    lower = (text or "").lower()
    structured = {"topic": topic, "raw_text": text}
    metric_payload = {}

    if topic in {"sleep", "sleep-stress-safe-sex"}:
        hours_match = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b", lower)
        hours = float(hours_match.group(1)) if hours_match else _first_number(lower)
        quality = _match_scale_10(lower, "quality")
        stress = _match_scale_10(lower, "stress")
        structured.update({"sleep_hours": hours, "sleep_quality": quality})
        if hours is not None:
            metric_payload["sleep"] = int(round(hours))
        if quality is not None:
            metric_payload["sleep_quality"] = int(round(quality))
        if stress is not None:
            metric_payload["stress_score"] = max(0.0, min(10.0, stress))

    elif topic == "nutrition":
        score_match = re.search(r"(\d{1,3}(?:\.\d+)?)\s*/\s*100", lower)
        nutrition_score = float(score_match.group(1)) if score_match else _first_number(lower)
        meals = re.search(r"(\d+)\s*(meals?)", lower)
        structured.update(
            {
                "nutrition_score": nutrition_score,
                "meals_count": int(meals.group(1)) if meals else None,
            }
        )
        if nutrition_score is not None:
            metric_payload["nutrition_score"] = max(0.0, min(100.0, float(nutrition_score)))

    elif topic in {"exercise", "activity"}:
        steps_m = re.search(r"(\d{3,6})\s*(steps?)", lower)
        minutes_m = re.search(r"(\d{1,3})\s*(minutes?|mins?)", lower)
        steps = int(steps_m.group(1)) if steps_m else None
        active_minutes = int(minutes_m.group(1)) if minutes_m else None
        structured.update({"steps": steps, "active_minutes": active_minutes})
        if steps is not None:
            metric_payload["steps"] = steps
        if active_minutes is not None:
            metric_payload["active_minutes"] = active_minutes

    elif topic in {"mental-health", "insight", "type", "career"}:
        stress = _match_scale_10(lower, "stress")
        mood = _match_scale_10(lower, "mood")
        work = _match_scale_10(lower, "work")
        structured.update({"stress_score": stress, "mood_score": mood, "work_satisfaction": work})
        if stress is not None:
            metric_payload["stress_score"] = max(0.0, min(10.0, stress))
        if mood is not None:
            metric_payload["mood_score"] = max(0.0, min(10.0, mood))
        if work is not None:
            metric_payload["work_satisfaction"] = max(0.0, min(10.0, work))

    elif topic == "symptoms":
        severity = _match_scale_10(lower, "severity")
        keywords = ["headache", "fever", "cough", "pain", "nausea", "fatigue", "dizziness"]
        symptoms = [k for k in keywords if k in lower]
        structured.update({"symptoms": symptoms, "severity": severity})
        if severity is not None:
            metric_payload["score"] = max(0.0, min(10.0, severity))

    elif topic == "medication":
        adherence = None
        if any(k in lower for k in ["missed", "forgot", "skip"]):
            adherence = False
        elif any(k in lower for k in ["took", "taken", "on time", "as prescribed"]):
            adherence = True
        meds = re.findall(r"(?:medication|medicine|drug)\s*[:\-]?\s*([a-z0-9\-\s]{3,40})", lower)
        cleaned = [m.strip(" .,!") for m in meds][:5]
        structured.update({"adherent": adherence, "mentioned_medications": cleaned})

    elif topic in {"family-history", "family-friends"}:
        conditions = ["diabetes", "hypertension", "heart disease", "stroke", "cancer", "asthma"]
        hits = [c for c in conditions if c in lower]
        structured.update({"conditions": hits})

    elif topic == "tobacco-toxics":
        cig = re.search(r"(\d+(?:\.\d+)?)\s*(cigarette|cigarettes)", lower)
        per_day = float(cig.group(1)) if cig else None
        smoking = any(k in lower for k in ["smoke", "smoked", "cigarette", "vape", "nicotine"])
        structured.update({"is_smoking": smoking, "cigarettes_per_day": per_day})
        metric_payload["is_smoking"] = bool(smoking)
        if per_day is not None:
            metric_payload["cigarettes_per_day"] = per_day

    elif topic == "alcohol":
        units_match = re.search(r"(\d+(?:\.\d+)?)\s*(units?|drinks?)", lower)
        units = float(units_match.group(1)) if units_match else _first_number(lower)
        structured.update({"alcohol_units": units})
        if units is not None:
            metric_payload["alcohol_units"] = max(0.0, units)

    return structured, metric_payload


@metrics.post("/metrics", response_model=MetricsResponse)
def create_metrics(payload: MetricsCreate):
    # Insert a new DailyMetrics row; only include fields that were provided
    values = payload.model_dump(exclude_unset=True)
    result = conn.execute(DailyMetrics.insert().values(**values))
    conn.commit()

    inserted_id = result.inserted_primary_key[0]
    row = conn.execute(
        DailyMetrics.select().where(DailyMetrics.c.id == inserted_id)
    ).fetchone()
    return _row_to_dict(row)


@metrics.get("/metrics", response_model=list[MetricsResponse])
def get_metrics(patient_id: int):
    rows = conn.execute(
        DailyMetrics.select().where(DailyMetrics.c.patient_id == patient_id)
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


@metrics.patch("/metrics/{metric_id}", response_model=MetricsResponse)
def update_metrics(metric_id: int, payload: MetricsUpdate):
    row = conn.execute(DailyMetrics.select().where(DailyMetrics.c.id == metric_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Metric not found")
    values = payload.model_dump(exclude_unset=True)
    if not values:
        return _row_to_dict(row)
    conn.execute(DailyMetrics.update().values(**values).where(DailyMetrics.c.id == metric_id))
    conn.commit()
    updated = conn.execute(DailyMetrics.select().where(DailyMetrics.c.id == metric_id)).fetchone()
    return _row_to_dict(updated)


@metrics.delete("/metrics/{metric_id}")
def delete_metrics(metric_id: int):
    row = conn.execute(DailyMetrics.select().where(DailyMetrics.c.id == metric_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Metric not found")
    conn.execute(DailyMetrics.delete().where(DailyMetrics.c.id == metric_id))
    conn.commit()
    return {"message": "Deleted"}


@metrics.post("/analyze/{topic}", response_model=TopicAnalyzeResponse)
def analyze_topic(topic: str, payload: TopicAnalyzeRequest):
    allowed = {
        "sleep",
        "nutrition",
        "exercise",
        "activity",
        "mental-health",
        "symptoms",
        "medication",
        "family-history",
        "family-friends",
        "tobacco-toxics",
        "alcohol",
        "sleep-stress-safe-sex",
        "type",
        "insight",
        "career",
    }
    if topic not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported topic")
    structured, metric_payload = _extract_topic(topic, payload.text or "")
    return {
        "topic": topic,
        "structured_data": structured,
        "metric_payload": metric_payload,
    }