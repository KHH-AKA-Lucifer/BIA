# import required libraries 
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    email : EmailStr
    password: str = Field(min_length=8, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email:  EmailStr
    is_active: bool
    is_superuser: bool

    model_config = {
        "from_attributes": True
    }