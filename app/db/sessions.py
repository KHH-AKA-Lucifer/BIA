# import required libraries 
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session 
from app.core.config import settings 

# SQL alchemy engine 
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True, # health check to database connection pipeline
)

# Sesssion factory 
SessionLocal = sessionmaker(
    autocommit=False, # without db.commit(), changes will not be applied
    autoflush=False,  # more manual control over automatic synchronization
    bind=engine,      # use the created engine
)

# FastAPI dependency
def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally: 
        db.close()