from fastapi import APIRouter
from database import conn
from models import DailyMetrics
from schemas import MetricsCreate, MetricsResponse

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