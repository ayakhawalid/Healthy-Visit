"""Read-only study data for researchers (21-day window per patient)."""
import json
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select

from database import conn
from models import DailyMetrics, FantasticDailyScores, PatientProfile, Users
from schemas import TokenData
from service.oauth import require_researcher

research = APIRouter()

STUDY_DAYS = 21


def _patient_profile_dict(patient_id: int) -> Optional[dict[str, Any]]:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    if not row:
        return None
    keys = list(PatientProfile.c.keys())
    return dict(zip(keys, row))


def _study_window(patient_id: int) -> tuple[date, date]:
    """Return inclusive start and exclusive end for filtering metrics (21 days)."""
    prof = _patient_profile_dict(patient_id)
    start: Optional[date] = None
    if prof:
        start = prof.get("study_start_date")
    if start is None:
        r = conn.execute(
            select(func.min(DailyMetrics.c.date)).where(DailyMetrics.c.patient_id == patient_id)
        ).fetchone()
        if r and r[0] is not None:
            start = r[0]
        else:
            start = date.today()
    end = start + timedelta(days=STUDY_DAYS)
    return start, end


def _metrics_row_to_dict(row) -> dict:
    keys = list(DailyMetrics.c.keys())
    return dict(zip(keys, row))


def _score_row_to_dict(row) -> dict:
    keys = list(FantasticDailyScores.c.keys())
    return dict(zip(keys, row))


@research.get("/research/patients")
def list_study_patients(_: TokenData = Depends(require_researcher)):
    rows = conn.execute(
        Users.select()
        .where(Users.c.is_superuser == False)  # noqa: E712
        .where(Users.c.is_researcher == False)  # noqa: E712
    ).fetchall()
    out = []
    for row in rows:
        keys = list(Users.c.keys())
        u = dict(zip(keys, row))
        pid = u["id"]
        start, end = _study_window(pid)
        prof = _patient_profile_dict(pid)
        out.append(
            {
                "id": pid,
                "username": u["username"],
                "email": u["email"],
                "study_start_date": prof.get("study_start_date").isoformat()
                if prof and prof.get("study_start_date")
                else None,
                "study_window_start": start.isoformat(),
                "study_window_end_exclusive": end.isoformat(),
            }
        )
    return out


@research.get("/research/patients/{patient_id}/metrics")
def get_patient_metrics_research(
    patient_id: int,
    _: TokenData = Depends(require_researcher),
):
    p = conn.execute(Users.select().where(Users.c.id == patient_id)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    keys = list(Users.c.keys())
    u = dict(zip(keys, p))
    if u.get("is_superuser") or u.get("is_researcher"):
        raise HTTPException(status_code=404, detail="Patient not found")

    start, end = _study_window(patient_id)
    rows = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .where(DailyMetrics.c.date >= start)
        .where(DailyMetrics.c.date < end)
        .order_by(DailyMetrics.c.date.asc())
    ).fetchall()
    return [_metrics_row_to_dict(r) for r in rows]


@research.get("/research/patients/{patient_id}/fantastic-scores")
def get_patient_fantastic_scores_research(
    patient_id: int,
    _: TokenData = Depends(require_researcher),
):
    p = conn.execute(Users.select().where(Users.c.id == patient_id)).fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    keys = list(Users.c.keys())
    u = dict(zip(keys, p))
    if u.get("is_superuser") or u.get("is_researcher"):
        raise HTTPException(status_code=404, detail="Patient not found")

    start, end = _study_window(patient_id)
    rows = conn.execute(
        FantasticDailyScores.select()
        .where(FantasticDailyScores.c.patient_id == patient_id)
        .where(FantasticDailyScores.c.date >= start)
        .where(FantasticDailyScores.c.date < end)
        .order_by(FantasticDailyScores.c.date.asc())
    ).fetchall()
    result = []
    for r in rows:
        d = _score_row_to_dict(r)
        if d.get("domains_json"):
            try:
                d["domains"] = json.loads(d["domains_json"])
            except Exception:
                d["domains"] = {}
        else:
            d["domains"] = {}
        d.pop("domains_json", None)
        result.append(d)
    return result
