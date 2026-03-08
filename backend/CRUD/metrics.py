from fastapi import APIRouter, HTTPException
from database import conn
from models import DailyMetrics
from schemas import MetricsCreate, MetricsUpdate, MetricsResponse

metrics = APIRouter()


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy Row into a plain dict suitable for MetricsResponse."""
    keys = list(DailyMetrics.c.keys())
    return dict(zip(keys, row))


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