from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use an environment variable to allow local development testing without Docker
db_path = os.environ.get("DB_PATH", "/app/data/rss.db")

# If local dev, we might just want to put it in the project root's data folder
if os.environ.get("ENV") == "development":
    db_path = "./data/rss.db"
    os.makedirs("./data", exist_ok=True)
else:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
