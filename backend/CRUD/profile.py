from fastapi import APIRouter, HTTPException

from database import conn
from models import PatientProfile
from schemas import PatientProfileResponse, PatientProfileUpsert

profile = APIRouter()


def _row_to_dict(row) -> dict:
    keys = list(PatientProfile.c.keys())
    d = dict(zip(keys, row))
    return {
        "patient_id": d["patient_id"],
        "height_cm": d.get("height_cm"),
        "weight_kg": d.get("weight_kg"),
        "onboarding_completed": bool(d.get("onboarding_completed")),
        "study_start_date": d.get("study_start_date"),
    }


@profile.get("/profile", response_model=PatientProfileResponse)
def get_profile(patient_id: int):
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    if not row:
        # Return an empty default profile
        return {
            "patient_id": patient_id,
            "height_cm": None,
            "weight_kg": None,
            "onboarding_completed": False,
            "study_start_date": None,
        }
    return _row_to_dict(row)


@profile.post("/profile", response_model=PatientProfileResponse)
def upsert_profile(payload: PatientProfileUpsert):
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == payload.patient_id)
    ).fetchone()
    values = payload.model_dump(exclude_unset=True)
    # patient_id is required; keep it.
    if row:
        # Don't allow changing patient_id
        values.pop("patient_id", None)
        conn.execute(
            PatientProfile.update()
            .values(**values)
            .where(PatientProfile.c.id == row[0])
        )
        conn.commit()
        updated = conn.execute(
            PatientProfile.select().where(PatientProfile.c.id == row[0])
        ).fetchone()
        return _row_to_dict(updated)
    conn.execute(
        PatientProfile.insert().values(**values)
    )
    conn.commit()
    created = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == payload.patient_id)
    ).fetchone()
    return _row_to_dict(created)

