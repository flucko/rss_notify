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
    timestamp = Column(String, default="")
    title = Column(String, default="")
    feed_name = Column(String, default="")
    keyword = Column(String, default="")

class RSSEntry(Base):
    __tablename__ = "rss_entries"
    id = Column(Integer, primary_key=True, index=True)
    feed_name = Column(String, index=True, default="")
    title = Column(String, default="")
    url = Column(String, unique=True, index=True)
    description = Column(String, default="")
    published_at = Column(String, default="")
    fetched_at = Column(String, default="")
    alerted = Column(Integer, default=0)
    keyword = Column(String, default="")
    company = Column(String, index=True, default="")

class FavoriteCompany(Base):
    __tablename__ = "favorite_companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
