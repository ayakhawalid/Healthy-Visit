from fastapi import Depends, HTTPException, status
from service.jwttoken import verify_token
from fastapi.security import OAuth2PasswordBearer
from schemas import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def _credentials_exception():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    return verify_token(token, _credentials_exception())


def require_superuser(token_data: TokenData = Depends(get_current_user)) -> TokenData:
    if not token_data.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return token_data


def require_researcher(token_data: TokenData = Depends(get_current_user)) -> TokenData:
    if not token_data.is_researcher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Researcher access required")
    return token_data