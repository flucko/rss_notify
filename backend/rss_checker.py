import feedparser
import requests
import re
import time
import logging
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Feed, Settings, History, Keyword

logger = logging.getLogger(__name__)

def strip_html(text):
    return re.sub('<[^<]+?>', '', text)

def check_feeds(manual_sync=False):
    check_type = "manual" if manual_sync else "scheduled"
    logger.info(f"Starting {check_type} RSS feed check...")

    start_time = time.time()
    db: Session = SessionLocal()
    preview_data = []

    # Counters for run summary
    feeds_checked = 0
    entries_scanned = 0
    matches_found = 0
    notifications_sent = 0
    errors = 0

    try:
        settings_record = db.query(Settings).first()
        pushover_ready = True
        if not settings_record or not settings_record.pushover_token or not settings_record.pushover_user_key:
            logger.warning("Pushover credentials not set — notifications will be skipped")
            pushover_ready = False

        feeds = db.query(Feed).all()
        logger.info(f"Found {len(feeds)} feed(s) to process")

        for feed in feeds:
            if not feed.keywords and not manual_sync:
                logger.debug(f"Skipping feed '{feed.name}' — no keywords configured")
                continue

            feeds_checked += 1
            logger.info(f"Checking feed: {feed.name} ({feed.url})")
            try:
                parsed_feed = feedparser.parse(feed.url)
            except Exception as e:
                logger.error(f"Error parsing feed '{feed.name}' ({feed.url}): {e}")
                errors += 1
                continue

            entry_count = len(parsed_feed.entries)
            logger.debug(f"Feed '{feed.name}' returned {entry_count} entries")

            feed_preview = {
                "feed_name": feed.name,
                "entries": []
            }

            for i, entry in enumerate(parsed_feed.entries):
                entries_scanned += 1
                title = entry.get("title", "")
                link = entry.get("link", "")
                summary = entry.get("summary", entry.get("description", ""))

                clean_summary = strip_html(summary)

                logger.debug(f"  Entry {i+1}: {title[:80]}")

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
                    logger.debug(f"  Skipping (already notified): {link}")
                    continue

                for kw in feed.keywords:
                    pattern = rf"\b{re.escape(kw.word)}\b"
                    if re.search(pattern, target_text, re.IGNORECASE):
                        matches_found += 1
                        logger.info(f"Match found! Keyword: '{kw.word}' in '{title[:60]}'")

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
                                    notifications_sent += 1
                                    logger.info(f"Notification sent for: {link}")
                                else:
                                    errors += 1
                                    logger.error(f"Pushover error (status {response.status_code}): {response.text}")
                            except Exception as e:
                                errors += 1
                                logger.error(f"Failed to send pushover notification: {e}")

                        break

            if manual_sync:
                preview_data.append(feed_preview)

        elapsed = round(time.time() - start_time, 2)
        logger.info(
            f"Feed check complete — {feeds_checked} feeds checked, "
            f"{entries_scanned} entries scanned, {matches_found} match(es), "
            f"{notifications_sent} notification(s) sent, {errors} error(s) "
            f"(took {elapsed}s)"
        )
        return preview_data if manual_sync else None

    except Exception as e:
        logger.error(f"Error during check_feeds: {e}", exc_info=True)
        return [] if manual_sync else None
    finally:
        db.close()
