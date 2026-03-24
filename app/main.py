import uvicorn
import logging 
import os
from sqlalchemy import text 
from sqlalchemy.orm import Session
from app.db.sessions  import get_db
from fastapi import FastAPI, Depends  
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from contextlib import asynccontextmanager
from app.core.logging import setup_logging
from app.api.v1.auth import router as auth_router
from app.api.v1.user import router as users_router
from app.api.v1.dashboard import router as dashboard_router

setup_logging()
logger = logging.getLogger("app")

# CORS configuration based on environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT == "production":
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
else:
    # Development: allow localhost variants
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- START UP --- 
    logger.info("Starting application...")
    logger.info("App name: %s", settings.APP_NAME)
    logger.info("Environment: %s", settings.APP_ENV)
    # logger.info("Debug mode: %s", settings.DEBUG)
    # the app stays active whie serving requests
    yield
    # --- SHUTDOWN ---
    logger.info("Shutting down application...")

app = FastAPI(
    title=settings.APP_NAME,
    #debug=settings.DEBUG, # security reason
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)


@app.get("/")
def root() -> dict[str, str]:
    logger.info("Root enpoint called")
    return {"message": f"{settings.APP_NAME} is running"}

@app.get("/health/db")
def check_db(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    logger.info("Database connection successful.")
    return {"database": "connected"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8010, reload=True)