# import required libraries
from jose import jwt 
from typing import Any
from app.core.config import settings
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone

# initialize the hash algorithm
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Hash function
    
    params
    ------
    plain password: str 

    returns
    -------
    hashed password: str
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """ 
    Password verification function 

    params
    ------
    plain password: str
    hashed password: str 

    returns
    -------
    T/F : boolean
    """
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    if expires_delta is not None:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "sub": str(subject),
        "exp": expire
    }

    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )