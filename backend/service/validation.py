"""
Shared account validation rules (keep in sync with frontend/src/utils/validation.ts).
"""
from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException

USERNAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{2,31}$")
EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)
PASSWORD_SPECIAL_PATTERN = re.compile(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]")

USERNAME_RULES = (
    "3–32 characters; letters, digits, and underscores only; "
    "must start with a letter or underscore."
)
EMAIL_RULES = "Use a valid email address (e.g. name@domain.com)."
PASSWORD_RULES = (
    "8–128 characters; at least one uppercase letter, one lowercase letter, "
    "one digit, and one special character (!@#$%^&* etc.)."
)


def validate_username(value: str) -> str:
    s = (value or "").strip()
    if not USERNAME_PATTERN.fullmatch(s):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid username. {USERNAME_RULES}",
        )
    return s


def validate_email(value: str) -> str:
    s = (value or "").strip().lower()
    if len(s) > 254:
        raise HTTPException(status_code=400, detail="Email is too long.")
    if not EMAIL_PATTERN.fullmatch(s):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid email. {EMAIL_RULES}",
        )
    return s


def validate_password(value: str) -> str:
    if value is None:
        raise HTTPException(status_code=400, detail="Password is required.")
    if len(value) < 8:
        raise HTTPException(
            status_code=400,
            detail=f"Password too short. {PASSWORD_RULES}",
        )
    if len(value) > 128:
        raise HTTPException(
            status_code=400,
            detail=f"Password too long. {PASSWORD_RULES}",
        )
    if not re.search(r"[a-z]", value):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one lowercase letter.",
        )
    if not re.search(r"[A-Z]", value):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one uppercase letter.",
        )
    if not re.search(r"\d", value):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one digit.",
        )
    if not PASSWORD_SPECIAL_PATTERN.search(value):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one special character (!@#$%^&* etc.).",
        )
    return value


def row_by_username(username: str):
    from database import conn
    from models import Users

    return conn.execute(
        Users.select().where(Users.c.username == username)
    ).fetchone()


def row_by_email(email: str):
    from database import conn
    from models import Users

    return conn.execute(
        Users.select().where(Users.c.email == email)
    ).fetchone()


def assert_username_unique(username: str, exclude_user_id: Optional[int] = None) -> None:
    from models import Users

    row = row_by_username(username)
    if not row:
        return
    keys = list(Users.c.keys())
    uid = dict(zip(keys, row))["id"]
    if exclude_user_id is not None and uid == exclude_user_id:
        return
    raise HTTPException(status_code=400, detail="This username is already taken.")


def assert_email_unique(email: str, exclude_user_id: Optional[int] = None) -> None:
    row = row_by_email(email)
    if not row:
        return
    from models import Users

    keys = list(Users.c.keys())
    uid = dict(zip(keys, row))["id"]
    if exclude_user_id is not None and uid == exclude_user_id:
        return
    raise HTTPException(status_code=400, detail="This email is already registered.")
