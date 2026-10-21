"""
Reset the database to only have one admin user, taken from backend/.env
(ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD).
Run from the backend directory: python reset_db_admin_only.py
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from database import conn
from models import Users
from service.hashing import Hash

def main():
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        sys.exit("ADMIN_PASSWORD is not set in backend/.env; refusing to reset.")
    username = os.getenv("ADMIN_USERNAME", "admin")
    # Delete all users
    conn.execute(Users.delete())
    conn.commit()
    conn.execute(
        Users.insert().values(
            username=username,
            email=os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower(),
            is_superuser=True,
            is_researcher=False,
            password=Hash.bcrypt(password),
        )
    )
    conn.commit()
    print(f"Database reset: only admin user '{username}' remains")

if __name__ == "__main__":
    main()
