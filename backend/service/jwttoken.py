import os
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from schemas import TokenData
from jose import JWTError, jwt
# from main import TokenData

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Add it to backend/.env (see backend/.env.example)."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token:str,credentials_exception):
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
		user_id: int = payload.get("id")
		username: str = payload.get("username")
		email: str = payload.get("email")
		is_superuser: bool = payload.get("is_superuser")
		is_researcher: bool = payload.get("is_researcher") or False
		if username is None:
			raise credentials_exception
		token_data = TokenData(
			id=user_id,
			username=username,
			email=email,
			is_superuser=is_superuser,
			is_researcher=is_researcher,
		)
		return token_data
	except JWTError:
	    raise credentials_exception