import uvicorn
import logging 
from fastapi import FastAPI 
from app.core.config import settings
from contextlib import asynccontextmanager
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger("app")

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

@app.get("/")
def root() -> dict[str, str]:
    logger.info("Root enpoint called")
    return {"message": f"{settings.APP_NAME} is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)