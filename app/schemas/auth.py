# import required libraries 
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    """
    Schema class or user registration.

    params
    ------
    BaseModel: object inheritance

    returns
    -------
    None
    """
    # email
    email : EmailStr
    # password with min 8 character to max 128 character
    password: str = Field(min_length=8, max_length=128)

class UserLogin(BaseModel):
    """
    Schema class for user login

    params
    ------
    BaseModel: object inheritance

    returns
    -------
    None
    """
    # email
    email: EmailStr
    # password
    password: str

class TokenResponse(BaseModel):
    """
    Schema class for token response 

    params
    ------
    BaseModel: object inheritance 

    returns
    -------
    None
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    """
    Schema class for refresh token request 

    params
    ------
    BaseModel: object inheritance 

    returns
    -------
    None
    """
    refresh_token: str

class UserResponse(BaseModel):
    """
    Schema class for user response 

    params
    ------
    BaseModel: object inheritance. 

    returns
    -------
    None
    """
    #   response schemas
    id: int
    email:  EmailStr
    role: str 
    is_active: bool
    is_superuser: bool
    # config for extracting data from ORM objects
    model_config = {
        "from_attributes": True
    }

class ChangePasswordRequest(BaseModel):
    """
    Function for changing password. 

    params
    ------
    BaseModel: object inheritance. 

    returns
    -------
    None
    """
    current_password: str
    new_password: str 