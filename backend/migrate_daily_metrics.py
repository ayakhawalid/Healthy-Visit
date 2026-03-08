"""
One-time migration: add missing columns to DailyMetrics so it matches models.py.
Run from backend folder: python migrate_daily_metrics.py
"""
import sqlite3

DB_PATH = "SQLite.db"

COLUMNS_TO_ADD = [
    ("sleep_quality", "INTEGER"),
    ("active_minutes", "INTEGER"),
    ("nutrition_score", "REAL"),
    ("alcohol_units", "REAL"),
    ("stress_score", "REAL"),
    ("social_support_score", "REAL"),
    ("cigarettes_per_day", "REAL"),
    ("is_smoking", "INTEGER"),  # SQLite boolean
    ("mood_score", "REAL"),
    ("work_satisfaction", "REAL"),
]

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(DailyMetrics)")
    existing = {row[1] for row in cur.fetchall()}
    for col_name, col_type in COLUMNS_TO_ADD:
        if col_name in existing:
            print(f"Column {col_name} already exists, skipping.")
            continue
        sql = f'ALTER TABLE DailyMetrics ADD COLUMN "{col_name}" {col_type}'
        cur.execute(sql)
        print(f"Added column: {col_name}")
    conn.commit()
    conn.close()
    print("Migration done.")

if __name__ == "__main__":
    main()
