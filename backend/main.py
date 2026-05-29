import logging
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from backend.logging_config import setup_logging
from backend import models, schemas
from backend.database import engine, get_db, SessionLocal, db_path
from backend.rss_checker import check_feeds
import re
import requests
from sqlalchemy import text, func

# Initialize logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

# Auto-migrate our new column if it doesn't exist for older databases
with engine.connect() as conn:
    try:
        conn.execute(text("SELECT check_frequency_minutes FROM settings LIMIT 1"))
    except Exception:
        logger.info("Migrating database: adding 'check_frequency_minutes' column to settings")
        conn.execute(text("ALTER TABLE settings ADD COLUMN check_frequency_minutes INTEGER DEFAULT 5"))
        conn.commit()
    try:
        conn.execute(text("SELECT filter_target FROM feeds LIMIT 1"))
    except Exception:
        logger.info("Migrating database: adding 'filter_target' column to feeds")
        conn.execute(text("ALTER TABLE feeds ADD COLUMN filter_target VARCHAR DEFAULT 'title'"))
        conn.commit()

    try:
        conn.execute(text("SELECT timestamp FROM history LIMIT 1"))
    except Exception:
        logger.info("Migrating database: adding extra history columns")
        conn.execute(text("ALTER TABLE history ADD COLUMN timestamp VARCHAR DEFAULT ''"))
        conn.execute(text("ALTER TABLE history ADD COLUMN title VARCHAR DEFAULT ''"))
        conn.execute(text("ALTER TABLE history ADD COLUMN feed_name VARCHAR DEFAULT ''"))
        conn.execute(text("ALTER TABLE history ADD COLUMN keyword VARCHAR DEFAULT ''"))
        conn.commit()

    try:
        conn.execute(text("SELECT company FROM rss_entries LIMIT 1"))
    except Exception:
        logger.info("Migrating database: adding 'company' column to rss_entries")
        conn.execute(text("ALTER TABLE rss_entries ADD COLUMN company VARCHAR DEFAULT ''"))
        # Backfill company from [Tag] patterns in existing titles
        rows = conn.execute(text("SELECT id, title FROM rss_entries")).fetchall()
        for row in rows:
            m = re.search(r'\[([^\]]+)\]', row.title or '')
            if m:
                conn.execute(
                    text("UPDATE rss_entries SET company = :company WHERE id = :id"),
                    {"company": m.group(1), "id": row.id}
                )
        conn.commit()
        logger.info("Backfilled company column from entry titles")

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
    logger.info(f"Scheduler configured — polling every {freq} minute(s)")

def _log_startup_status():
    """Log application configuration on startup."""
    logger.info("=" * 50)
    logger.info("RSS Notify starting")
    logger.info("=" * 50)
    logger.info(f"Database path: {db_path}")

    db = SessionLocal()
    try:
        settings = db.query(models.Settings).first()
        if settings:
            freq = settings.check_frequency_minutes
            pushover_status = "configured" if (settings.pushover_token and settings.pushover_user_key) else "not configured"
        else:
            freq = 5
            pushover_status = "not configured"
        logger.info(f"Check frequency: {freq} minute(s)")
        logger.info(f"Pushover credentials: {pushover_status}")

        feed_count = db.query(models.Feed).count()
        logger.info(f"Feeds configured: {feed_count}")
    except Exception as e:
        logger.warning(f"Could not read startup status: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    _log_startup_status()
    configure_scheduler()
    scheduler.start()
    logger.info("Scheduler started")
    yield
    # Shutdown
    logger.info("RSS Notify shutting down")
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

# Expose static frontend files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

@app.get("/")
def read_root():
    return FileResponse("frontend/static/index.html")

@app.get("/favorites")
def read_favorites():
    return FileResponse("frontend/static/favorites.html")

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

    pushover_status = "configured" if (settings.pushover_token and settings.pushover_user_key) else "not configured"
    logger.info(
        f"Settings updated — frequency: {settings.check_frequency_minutes}min, "
        f"pushover: {pushover_status}"
    )

    configure_scheduler()
    return settings

@app.post("/api/test-pushover")
def test_pushover(db: Session = Depends(get_db)):
    settings = db.query(models.Settings).first()
    if not settings or not settings.pushover_token or not settings.pushover_user_key:
        logger.warning("Test Pushover requested but credentials are missing")
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
            logger.info("Test Pushover notification sent successfully")
            return {"ok": True}
        else:
            logger.error(f"Test Pushover failed (status {r.status_code}): {r.text}")
            raise HTTPException(status_code=400, detail=r.text)
    except requests.RequestException as e:
        logger.error(f"Test Pushover request failed: {e}")
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
    logger.info(f"Feed created: \"{db_feed.name}\" ({db_feed.url})")
    return db_feed

@app.put("/api/feeds/{feed_id}", response_model=schemas.Feed)
def update_feed(feed_id: int, feed_update: schemas.FeedUpdate, db: Session = Depends(get_db)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    old_target = feed.filter_target
    feed.filter_target = feed_update.filter_target
    db.commit()
    db.refresh(feed)
    logger.info(f"Feed updated: \"{feed.name}\" — filter target: {old_target} → {feed.filter_target}")
    return feed

@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: int, db: Session = Depends(get_db)):
    feed = db.query(models.Feed).filter(models.Feed.id == feed_id).first()
    if feed:
        feed_name = feed.name
        db.delete(feed)
        db.commit()
        logger.info(f"Feed deleted: \"{feed_name}\" (id={feed_id})")
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
    logger.info(f"Keyword added: \"{db_keyword.word}\" → feed \"{db_feed.name}\"")
    return db_keyword

@app.delete("/api/keywords/{keyword_id}")
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    keyword = db.query(models.Keyword).filter(models.Keyword.id == keyword_id).first()
    if keyword:
        word = keyword.word
        feed_name = keyword.feed.name if keyword.feed else "unknown"
        db.delete(keyword)
        db.commit()
        logger.info(f"Keyword deleted: \"{word}\" from feed \"{feed_name}\"")
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Keyword not found")

@app.post("/api/check")
def trigger_check():
    # Trigger a manual check synchronously and return previews
    logger.info("Manual feed check triggered via API")
    previews = check_feeds(manual_sync=True)
    return {"status": "success", "previews": previews}

@app.get("/api/companies", response_model=list[schemas.CompanyInfo])
def get_companies(all_favorites: bool = False, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z"
    rows = (
        db.query(models.RSSEntry.company, func.count(models.RSSEntry.id).label("count"))
        .filter(models.RSSEntry.published_at >= cutoff)
        .filter(models.RSSEntry.company != "")
        .group_by(models.RSSEntry.company)
        .order_by(func.count(models.RSSEntry.id).desc())
        .all()
    )
    favorites = {fc.name for fc in db.query(models.FavoriteCompany).all()}
    seen = {r.company for r in rows}
    result = [{"name": r.company, "count": r.count, "is_favorite": r.company in favorites} for r in rows]
    if all_favorites:
        # Include favorited companies that have no entries in the current 7-day window
        for name in sorted(favorites - seen):
            result.append({"name": name, "count": 0, "is_favorite": True})
    return result

@app.post("/api/companies/{name}/favorite")
def toggle_favorite_company(name: str, db: Session = Depends(get_db)):
    existing = db.query(models.FavoriteCompany).filter(models.FavoriteCompany.name == name).first()
    if existing:
        db.delete(existing)
        db.commit()
        logger.info(f"Company removed from favorites: \"{name}\"")
        return {"is_favorite": False}
    fc = models.FavoriteCompany(name=name)
    db.add(fc)
    db.commit()
    logger.info(f"Company added to favorites: \"{name}\"")
    return {"is_favorite": True}

@app.get("/api/history", response_model=list[schemas.History])
def get_history(db: Session = Depends(get_db)):
    return db.query(models.History).order_by(models.History.id.desc()).limit(50).all()

@app.get("/api/entries", response_model=list[schemas.RSSEntry])
def get_entries(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z"
    return (
        db.query(models.RSSEntry)
        .filter(models.RSSEntry.published_at >= cutoff)
        .order_by(models.RSSEntry.published_at.desc())
        .limit(500)
        .all()
    )
