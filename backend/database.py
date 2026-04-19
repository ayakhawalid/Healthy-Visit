import sqlalchemy as _sql
from sqlalchemy import inspect, text

import sqlalchemy.orm as _orm

DATABASE_URL = "sqlite:///SQLite.db"

engine = _sql.create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = _orm.sessionmaker(autocommit=False, autoflush=False, bind=engine)

conn = engine.connect()


def _migrate_sqlite_columns():
    """Add columns introduced after initial deploy (SQLite has limited ALTER)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("Users"):
            return
        user_cols = {c["name"] for c in insp.get_columns("Users")}
        if "is_researcher" not in user_cols:
            conn.execute(text("ALTER TABLE Users ADD COLUMN is_researcher BOOLEAN DEFAULT 0"))
            conn.commit()
        if insp.has_table("PatientProfile"):
            pp_cols = {c["name"] for c in insp.get_columns("PatientProfile")}
            if "study_start_date" not in pp_cols:
                conn.execute(text("ALTER TABLE PatientProfile ADD COLUMN study_start_date DATE"))
                conn.commit()
        if insp.has_table("DailyMetrics"):
            dm_cols = {c["name"] for c in insp.get_columns("DailyMetrics")}
            if "lifestyle_radar_json" not in dm_cols:
                conn.execute(text("ALTER TABLE DailyMetrics ADD COLUMN lifestyle_radar_json VARCHAR"))
                conn.commit()
    except Exception:
        pass


def _migrate_users_email_unique():
    """
    Normalize emails to lowercase and add a UNIQUE index so the same email
    cannot be used by two accounts (matches application-level assert_email_unique).
    """
    try:
        insp = inspect(engine)
        if not insp.has_table("Users"):
            return
        indexes = {idx["name"] for idx in insp.get_indexes("Users")}
        if "uq_users_email" in indexes:
            return

        conn.execute(
            text(
                "UPDATE Users SET email = lower(trim(email)) "
                "WHERE email IS NOT NULL AND email != lower(trim(email))"
            )
        )
        conn.commit()

        dup = conn.execute(
            text(
                "SELECT email FROM Users WHERE email IS NOT NULL "
                "GROUP BY email HAVING count(*) > 1"
            )
        ).fetchone()
        if dup:
            import sys

            print(
                "WARNING: Users table has duplicate emails; "
                "remove duplicates before a unique email index can be applied. "
                "New signups are still blocked in application code.",
                file=sys.stderr,
            )
            return

        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON Users(email)")
        )
        conn.commit()
    except Exception:
        pass


_migrate_sqlite_columns()
_migrate_users_email_unique()