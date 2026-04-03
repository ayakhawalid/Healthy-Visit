from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from service.jwttoken import create_access_token
from service.oauth import get_current_user, require_superuser
from service.hashing import Hash
from service.validation import (
    assert_email_unique,
    assert_username_unique,
    validate_email,
    validate_password,
    validate_username,
    EMAIL_RULES,
    PASSWORD_RULES,
    USERNAME_RULES,
)
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from database import conn
from schemas import User, TokenData, ResearcherCreate, UserAdminUpdate, MyProfileUpdate
from models import Users

auth = APIRouter()


def _row_to_dict(row):
    """Convert SQLAlchemy Row to a JSON-serializable dict (no password)."""
    keys = list(Users.c.keys())
    d = dict(zip(keys, row))
    d.pop("password", None)
    return d


def _rows_to_list(rows):
    return [_row_to_dict(r) for r in rows]


@auth.get("/validation-rules")
def validation_rules_public():
    """Public copy of validation rules (mirror frontend/src/utils/validation.ts)."""
    return {
        "username": USERNAME_RULES,
        "email": EMAIL_RULES,
        "password": PASSWORD_RULES,
    }


@auth.get("/users")
async def retrieve_all_user(_: TokenData = Depends(require_superuser)):
    rows = conn.execute(Users.select()).fetchall()
    return _rows_to_list(rows)


@auth.get("/user/{id}")
async def retrieve_one_user(id: int, _: TokenData = Depends(require_superuser)):
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)


@auth.patch("/user/{id}")
async def update_user_data(
    id: int,
    req: UserAdminUpdate,
    _: TokenData = Depends(require_superuser),
):
    row = conn.execute(Users.select().where(Users.c.id == id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    vals = {}
    if req.username is not None:
        u = validate_username(req.username)
        assert_username_unique(u, exclude_user_id=id)
        vals["username"] = u
    if req.email is not None:
        e = validate_email(req.email)
        assert_email_unique(e, exclude_user_id=id)
        vals["email"] = e
    if req.password is not None and str(req.password).strip() != "":
        validate_password(req.password)
        vals["password"] = Hash.bcrypt(req.password)

    if not vals:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        conn.execute(Users.update().values(**vals).where(Users.c.id == id))
        conn.commit()
    except IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
        )
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)


@auth.delete("/user/{id}")
async def delete_user_data(id: int, current: TokenData = Depends(require_superuser)):
    if current.id == id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account from this screen.",
        )
    row = conn.execute(Users.select().where(Users.c.id == id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    conn.execute(Users.delete().where(Users.c.id == id))
    conn.commit()
    return {"message": "User deleted"}


@auth.patch("/me")
def update_my_profile(req: MyProfileUpdate, current_user: TokenData = Depends(get_current_user)):
    uid = current_user.id
    row = conn.execute(Users.select().where(Users.c.id == uid)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    keys = list(Users.c.keys())
    ud = dict(zip(keys, row))

    u = validate_username(req.username)
    e = validate_email(req.email)
    assert_username_unique(u, exclude_user_id=uid)
    assert_email_unique(e, exclude_user_id=uid)

    vals = {"username": u, "email": e}
    if req.new_password is not None and str(req.new_password).strip() != "":
        if not req.current_password:
            raise HTTPException(
                status_code=400,
                detail="Current password is required to set a new password.",
            )
        validate_password(req.new_password)
        if not Hash.verify(ud["password"], req.current_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        vals["password"] = Hash.bcrypt(req.new_password)

    try:
        conn.execute(Users.update().values(**vals).where(Users.c.id == uid))
        conn.commit()
    except IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
        )
    updated = conn.execute(Users.select().where(Users.c.id == uid)).fetchone()
    access_token = create_access_token(
        data={
            "id": uid,
            "username": vals["username"],
            "email": vals["email"],
            "is_superuser": bool(ud.get("is_superuser")),
            "is_researcher": bool(ud.get("is_researcher")),
        }
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _row_to_dict(updated),
    }


@auth.post("/register")
def create_user(req: User):
    validate_password(req.password)
    username = validate_username(req.username)
    email = validate_email(req.email)
    assert_username_unique(username)
    assert_email_unique(email)

    try:
        result = conn.execute(
            Users.insert().values(
                username=username,
                email=email,
                is_superuser=False,
                is_researcher=False,
                password=Hash.bcrypt(req.password),
            )
        )
        conn.commit()
    except IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
        )
    inserted_id = None
    try:
        inserted_id = result.inserted_primary_key[0]
    except Exception:
        inserted_id = None
    return {"message": "User registered successfully", "id": inserted_id}


def register_researcher_account(req: ResearcherCreate) -> dict:
    """Shared body for researcher signup (admin-only when called from HTTP)."""
    validate_password(req.password)
    username = validate_username(req.username)
    email = validate_email(req.email)
    assert_username_unique(username)
    assert_email_unique(email)

    try:
        result = conn.execute(
            Users.insert().values(
                username=username,
                email=email,
                is_superuser=False,
                is_researcher=True,
                password=Hash.bcrypt(req.password),
            )
        )
        conn.commit()
    except IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
        )
    inserted_id = None
    try:
        inserted_id = result.inserted_primary_key[0]
    except Exception:
        inserted_id = None
    return {"message": "Researcher account created", "id": inserted_id}


@auth.post("/register-researcher")
@auth.post("/register_researcher")
def register_researcher(req: ResearcherCreate, _: TokenData = Depends(require_superuser)):
    return register_researcher_account(req)


@auth.post("/login")
def login(req: OAuth2PasswordRequestForm = Depends()):
    # OAuth2 form field is still named "username"; value can be username or email.
    ident = (req.username or "").strip()
    if not ident:
        raise HTTPException(status_code=401, detail="Username or email is required.")
    email_norm = ident.lower()
    user = conn.execute(
        Users.select().where(
            or_(Users.c.username == ident, Users.c.email == email_norm)
        )
    ).fetchone()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="No user found with this username or email.",
        )
    keys = list(Users.c.keys())
    ud = dict(zip(keys, user))
    if not Hash.verify(ud["password"], req.password):
        raise HTTPException(status_code=401, detail="Wrong password.")
    access_token = create_access_token(
        data={
            "id": ud["id"],
            "username": ud["username"],
            "email": ud["email"],
            "is_superuser": bool(ud.get("is_superuser")),
            "is_researcher": bool(ud.get("is_researcher")),
        }
    )
    return {"access_token": access_token, "token_type": "bearer", "id": ud["id"]}


@auth.get("/verify_token")
def read_root(current_user: TokenData = Depends(get_current_user)):
    return current_user.model_dump()


@auth.patch("/change_superuser/{id}")
def change_superuser(id: int, req: User, _: TokenData = Depends(require_superuser)):
    if req.is_superuser:
        conn.execute(Users.update().values(is_superuser=False).where(Users.c.id == id))
    else:
        conn.execute(
            Users.update().values(is_superuser=True, is_researcher=False).where(Users.c.id == id)
        )
    conn.commit()
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)


@auth.patch("/change_researcher/{id}")
def change_researcher(id: int, req: User, _: TokenData = Depends(require_superuser)):
    vals = {"is_researcher": req.is_researcher}
    if req.is_researcher:
        vals["is_superuser"] = False
    conn.execute(Users.update().values(**vals).where(Users.c.id == id))
    conn.commit()
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)
