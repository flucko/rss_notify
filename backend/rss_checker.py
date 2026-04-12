import feedparser
import requests
import re
import logging
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Feed, Settings, History, Keyword

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def strip_html(text):
    return re.sub('<[^<]+?>', '', text)

def check_feeds(manual_sync=False):
    if manual_sync:
        logger.info("Starting manual RSS feed check...")
    else:
        logger.info("Starting scheduled RSS feed check...")
        
    db: Session = SessionLocal()
    preview_data = []
    
    try:
        settings_record = db.query(Settings).first()
        pushover_ready = True
        if not settings_record or not settings_record.pushover_token or not settings_record.pushover_user_key:
            logger.warning("Pushover credentials not set.")
            pushover_ready = False

        feeds = db.query(Feed).all()
        for feed in feeds:
            if not feed.keywords and not manual_sync:
                continue
                
            logger.info(f"Checking feed: {feed.name} ({feed.url})")
            try:
                parsed_feed = feedparser.parse(feed.url)
            except Exception as e:
                logger.error(f"Error parsing feed {feed.url}: {e}")
                continue
                
            feed_preview = {
                "feed_name": feed.name,
                "entries": []
            }
            
            for i, entry in enumerate(parsed_feed.entries):
                title = entry.get("title", "")
                link = entry.get("link", "")
                summary = entry.get("summary", entry.get("description", ""))
                
                clean_summary = strip_html(summary)
                
                if manual_sync and i < 5:
                    feed_preview["entries"].append({
                        "title": title,
                        "description": clean_summary,
                        "url": link
                    })
                
                if not feed.keywords:
                    continue
                    
                target_text = ""
                if feed.filter_target == "description":
                    target_text = clean_summary
                elif feed.filter_target == "both":
                    target_text = f"{title}\n{clean_summary}"
                else: 
                    target_text = title
                
                if db.query(History).filter(History.thread_url == link).first():
                    continue

                for kw in feed.keywords:
                    pattern = rf"\b{re.escape(kw.word)}\b"
                    if re.search(pattern, target_text, re.IGNORECASE):
                        logger.info(f"Match found! Keyword: '{kw.word}'")
                        
                        if pushover_ready:
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
                                    new_history = History(thread_url=link)
                                    db.add(new_history)
                                    db.commit()
                                    logger.info(f"Notification sent for: {link}")
                                else:
                                    logger.error(f"Pushover error (status {response.status_code}): {response.text}")
                            except Exception as e:
                                logger.error(f"Failed to send pushover notification: {e}")
                                
                        break
            
            if manual_sync:
                preview_data.append(feed_preview)
                
        return preview_data if manual_sync else None
        
    except Exception as e:
        logger.error(f"Error during check_feeds: {e}")
        return [] if manual_sync else None
    finally:
        db.close()
