from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import threading

from backend import models, schemas
from backend.database import engine, get_db, SessionLocal
from backend.rss_checker import check_feeds
import requests
from sqlalchemy import text

models.Base.metadata.create_all(bind=engine)

# Auto-migrate our new column if it doesn't exist for older databases
with engine.connect() as conn:
    try:
        conn.execute(text("SELECT check_frequency_minutes FROM settings LIMIT 1"))
    except Exception:
        conn.execute(text("ALTER TABLE settings ADD COLUMN check_frequency_minutes INTEGER DEFAULT 5"))
        conn.commit()
    try:
        conn.execute(text("SELECT filter_target FROM feeds LIMIT 1"))
    except Exception:
        conn.execute(text("ALTER TABLE feeds ADD COLUMN filter_target VARCHAR DEFAULT 'title'"))
        conn.commit()

scheduler = BackgroundScheduler()

def configure_scheduler():
    db = SessionLocal()
    try:
        settings = db.query(models.Settings).first()
        freq = settings.check_frequency_minutes if settings else 5
    except Exception:
        freq = 5
    finally:
        db.close()
        
    try:
        scheduler.remove_job('check_feeds_job')
    except Exception:
        pass
        
    scheduler.add_job(check_feeds, 'interval', minutes=freq, id='check_feeds_job')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_scheduler()
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
        settings = models.Settings(pushover_token="", pushover_user_key="", check_frequency_minutes=5)
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
    settings.check_frequency_minutes = settings_in.check_frequency_minutes
    db.commit()
    db.refresh(settings)
    configure_scheduler()
    return settings

@app.post("/api/test-pushover")
def test_pushover(db: Session = Depends(get_db)):
    settings = db.query(models.Settings).first()
    if not settings or not settings.pushover_token or not settings.pushover_user_key:
        raise HTTPException(status_code=400, detail="Missing Pushover credentials")
        
    payload = {
        "token": settings.pushover_token,
        "user": settings.pushover_user_key,
        "title": "RSS Notify Test",
        "message": "Pushover integration is working perfectly!"
    }
    
    try:
        r = requests.post("https://api.pushover.net/1/messages.json", data=payload, timeout=10)
        if r.status_code == 200:
            return {"ok": True}
        else:
            raise HTTPException(status_code=400, detail=r.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/feeds", response_model=list[schemas.Feed])
def read_feeds(db: Session = Depends(get_db)):
    return db.query(models.Feed).all()

@app.post("/api/feeds", response_model=schemas.Feed)
def create_feed(feed: schemas.FeedCreate, db: Session = Depends(get_db)):
    db_feed = models.Feed(name=feed.name, url=feed.url, filter_target=feed.filter_target)
    db.add(db_feed)
    db.commit()
    db.refresh(db_feed)
    return db_feed

@app.put("/api/feeds/{feed_id}", response_model=schemas.Feed)
def update_feed(feed_id: int, feed_update: schemas.FeedUpdate, db: Session = Depends(get_db)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    feed.filter_target = feed_update.filter_target
    db.commit()
    db.refresh(feed)
    return feed

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
    # Trigger a manual check synchronously and return previews
    previews = check_feeds(manual_sync=True)
    return {"status": "success", "previews": previews}
