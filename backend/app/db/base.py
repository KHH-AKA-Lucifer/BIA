# import required libraries
from sqlalchemy.orm import DeclarativeBase
# create base Registry 
# to keep track of every table that we define in our entire app
class Base(DeclarativeBase):
    pass 