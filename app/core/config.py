# import required modules
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict 

class Settings(BaseSettings):
    """
    Settings class thar inheritent the BaseSettings class.
    """

    # initialize variable, variable type and assign default values 
    # basic info
    APP_NAME: str = "Data Dashboard Backend"
    APP_ENV: str = "development"
    # git aDEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    # postgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5440
    POSTGRES_DB: str = "datadashboard"
    POSTGRES_USER: str 
    POSTGRES_PASSWORD: str 
    # JWT 
    JWT_SECRET_KEY: str 
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # LOGs
    LOG_LEVEL: str = "INFO"

    # configuration for the secrets 
    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    # decortor that turns method into a variable
    @property
    def database_url(self) -> str:
        encoded_password=quote_plus(self.POSTGRES_PASSWORD)
        return(
            f"postgresql+psycopg://{self.POSTGRES_USER}:{encoded_password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"        
            )
    
settings = Settings()