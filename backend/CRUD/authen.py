from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from service.jwttoken import create_access_token
from service.oauth import get_current_user
from service.hashing import Hash
from database import conn
from schemas import User
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


@auth.get("/users")
async def retrieve_all_user():
    rows = conn.execute(Users.select()).fetchall()
    return _rows_to_list(rows)


@auth.get("/user/{id}")
async def retrieve_one_user(id: int):
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)


@auth.patch("/user/{id}")
async def update_user_data(id: int, req: User):
    conn.execute(Users.update().values(
        username=req.username,
        email=req.email,
    ).where(Users.c.id == id))
    conn.commit()
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)


@auth.delete("/user/{id}")
async def delete_user_data(id: int):
    conn.execute(Users.delete().where(Users.c.id == id))
    conn.commit()
    return {"message": "User deleted"}


@auth.post("/register")
def create_user(req: User):
    conn.execute(Users.insert().values(
        username=req.username,
        email=req.email,
        is_superuser=req.is_superuser,
        password=Hash.bcrypt(req.password),
    ))
    conn.commit()
    return {"message": "User registered successfully"}

@auth.post('/login')
def login(req:OAuth2PasswordRequestForm = Depends()):
    user = conn.execute(Users.select().where(Users.c.username == req.username)).fetchone();
    if not user:
        return {"error":f"No user found with this {req.username} username"}
    if not Hash.verify(user[-1],req.password):
        return {"error":"Wrong Username or password"}
    access_token = create_access_token(data={"id": user[0], "username": user[1], "email": user[2], "is_superuser": user[3]})
    return {"access_token": access_token,"token_type": "bearer","id": user[0]}

@auth.get("/verify_token")
def read_root(current_user:User = Depends(get_current_user)):
    return current_user

@auth.patch("/change_superuser/{id}")
def change_superuser(id: int, req: User):
    if req.is_superuser:
        conn.execute(Users.update().values(is_superuser=False).where(Users.c.id == id))
    else:
        conn.execute(Users.update().values(is_superuser=True).where(Users.c.id == id))
    conn.commit()
    rows = conn.execute(Users.select().where(Users.c.id == id)).fetchall()
    return _rows_to_list(rows)