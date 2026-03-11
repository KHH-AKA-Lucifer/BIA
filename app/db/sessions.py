# import required libraries 
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session 
from app.core.config import settings 

# SQL alchemy engine 
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

# Sesssion factory 
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# FastAPI dependency
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally: 
        db.close()