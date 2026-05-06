import feedparser
import requests
import re
import logging
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Feed, Settings, History, Keyword

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_feeds():
    logger.info("Starting scheduled RSS feed check...")
    db: Session = SessionLocal()
    try:
        settings_record = db.query(Settings).first()
        if not settings_record or not settings_record.pushover_token or not settings_record.pushover_user_key:
            logger.warning("Pushover credentials not set. Skipping feed check.")
            return

        feeds = db.query(Feed).all()
        for feed in feeds:
            if not feed.keywords:
                continue
                
            logger.info(f"Checking feed: {feed.name} ({feed.url})")
            try:
                parsed_feed = feedparser.parse(feed.url)
            except Exception as e:
                logger.error(f"Error parsing feed {feed.url}: {e}")
                continue
            
            for entry in parsed_feed.entries:
                title = entry.get("title", "")
                link = entry.get("link", "")
                
                # Check history to avoid duplicate notifications
                if db.query(History).filter(History.thread_url == link).first():
                    continue

                for kw in feed.keywords:
                    # Using word boundary matching (case-insensitive)
                    pattern = rf"\b{re.escape(kw.word)}\b"
                    if re.search(pattern, title, re.IGNORECASE):
                        logger.info(f"Match found! Keyword: '{kw.word}', Title: '{title}'")
                        
                        # Send Pushover Notification
                        payload = {
                            "token": settings_record.pushover_token,
                            "user": settings_record.pushover_user_key,
                            "title": f"RSS Match: {feed.name}",
                            "message": f"Keyword '{kw.word}' found in: {title}",
                            "url": link,
                            "url_title": "Open Thread"
                        }
                        
                        try:
                            response = requests.post("https://api.pushover.net/1/messages.json", data=payload, timeout=10)
                            if response.status_code == 200:
                                # Save to history so we don't notify again
                                new_history = History(thread_url=link)
                                db.add(new_history)
                                db.commit()
                                logger.info(f"Notification sent for: {link}")
                            else:
                                logger.error(f"Pushover error (status {response.status_code}): {response.text}")
                        except Exception as e:
                            logger.error(f"Failed to send pushover notification: {e}")
                        
                        # Once matched any keyword, skip other keywords for the same entry
                        break
    except Exception as e:
        logger.error(f"Error during check_feeds: {e}")
    finally:
        db.close()
