from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
ENV_FILES = (BACKEND_ROOT / ".env", PROJECT_ROOT / ".env")

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
    DASHBOARD_DATASET_PATH: str = "backend/app/data/expanded_vending_sales.csv"
    MODEL_ARTIFACTS_PATH: str = "backend/app/data/model_artifacts"
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4.1-mini"
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_REQUEST_TIMEOUT_SECONDS: int = 20

    # configuration for the secrets 
    model_config = SettingsConfigDict(
        # Prefer the shared project-root .env when it exists so Docker and the
        # backend read the same database credentials. Keep backend/.env as a
        # fallback for local setups that still use the older layout.
        env_file=ENV_FILES,
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

    @property
    def dataset_path(self) -> Path:
        configured_path = Path(self.DASHBOARD_DATASET_PATH)
        if configured_path.is_absolute():
            return configured_path
        return PROJECT_ROOT / configured_path

    @property
    def model_artifacts_path(self) -> Path:
        configured_path = Path(self.MODEL_ARTIFACTS_PATH)
        if configured_path.is_absolute():
            return configured_path
        return PROJECT_ROOT / configured_path
    
settings = Settings()
