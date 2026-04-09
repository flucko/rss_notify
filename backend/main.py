from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import threading

from backend import models, schemas
from backend.database import engine, get_db
from backend.rss_checker import check_feeds

models.Base.metadata.create_all(bind=engine)

scheduler = BackgroundScheduler()
# Check feeds every 5 minutes
scheduler.add_job(check_feeds, 'interval', minutes=5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

# Expose static frontend files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

@app.get("/")
def read_root():
    # Serve index.html
    return FileResponse("frontend/static/index.html")

# --- API Routes ---

@app.get("/api/settings", response_model=schemas.Settings)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.Settings).first()
    if not settings:
        settings = models.Settings(pushover_token="", pushover_user_key="")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@app.post("/api/settings", response_model=schemas.Settings)
def update_settings(settings_in: schemas.SettingsCreate, db: Session = Depends(get_db)):
    settings = db.query(models.Settings).first()
    if not settings:
        settings = models.Settings()
        db.add(settings)
    settings.pushover_token = settings_in.pushover_token
    settings.pushover_user_key = settings_in.pushover_user_key
    db.commit()
    db.refresh(settings)
    return settings

@app.get("/api/feeds", response_model=list[schemas.Feed])
def read_feeds(db: Session = Depends(get_db)):
    return db.query(models.Feed).all()

@app.post("/api/feeds", response_model=schemas.Feed)
def create_feed(feed: schemas.FeedCreate, db: Session = Depends(get_db)):
    db_feed = models.Feed(name=feed.name, url=feed.url)
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    return db_feed

@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: int, db: Session = Depends(get_db)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if feed:
        db.delete(feed)
        db.commit()
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Feed not found")

@app.post("/api/feeds/{feed_id}/keywords", response_model=schemas.Keyword)
def create_keyword(feed_id: int, keyword: schemas.KeywordCreate, db: Session = Depends(get_db)):
    db_feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if not db_feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    db_keyword = models.Keyword(word=keyword.word, feed_id=feed_id)
    db.add(db_keyword)
    db.commit()
    db.refresh(db_keyword)
    return db_keyword

@app.delete("/api/keywords/{keyword_id}")
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    keyword = db.query(models.Keyword).filter(models.Keyword.id == keyword_id).first()
    if keyword:
        db.delete(keyword)
        db.commit()
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Keyword not found")

@app.post("/api/check")
def trigger_check():
    # Trigger a manual check in a new thread
    t = threading.Thread(target=check_feeds)
    t.start()
    return {"status": "started"}
