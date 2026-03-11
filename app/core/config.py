# import required modules
from pydantic_settings import BaseSettings, SettingsConfigDict 

class Settings(BaseSettings):
    APP_NAME: str = "Data Dashboard Backend"
    APP_ENV: str = "development"
    DEBUG: bool = True

    API_V1_STR: str = "/api/v1"

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "datadashboard"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    JWT_SECRET_KEY: str = "change_this_to_a_long_random_secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file = ".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @property
    def database_url(self) -> str:
        return(
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"        
            )
    
settings = Settings()