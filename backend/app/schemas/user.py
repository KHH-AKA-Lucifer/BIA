# import requried libraries
from pydantic import BaseModel

class UpdateUserRoleRequest(BaseModel):
    """
    Function for user role. 

    params
    ------
    BaseModel: object inheritance. 

    returns
    -------
    None
    """
    role: str

class UserStatusResponse(BaseModel):
    """
    Function for user status. 

    params
    ------
    BaseModel: object inheritance. 

    returns
    -------
    None
    """
    message: str 