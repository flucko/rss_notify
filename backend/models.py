from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    pushover_token = Column(String, default="")
    pushover_user_key = Column(String, default="")
    check_frequency_minutes = Column(Integer, default=5)

class Feed(Base):
    __tablename__ = "feeds"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String, unique=True, index=True)
    filter_target = Column(String, default="title")
    
    keywords = relationship("Keyword", back_populates="feed", cascade="all, delete-orphan")

class Keyword(Base):
    __tablename__ = "keywords"
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, index=True)
    feed_id = Column(Integer, ForeignKey("feeds.id"))
    
    feed = relationship("Feed", back_populates="keywords")

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    thread_url = Column(String, unique=True, index=True)
