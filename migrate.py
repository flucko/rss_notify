import sqlite3
import os
import logging

from backend.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

db_path = os.environ.get("DB_PATH", "/app/data/rss.db")
if os.environ.get("ENV") == "development":
    db_path = "./data/rss.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE settings ADD COLUMN check_frequency_minutes INTEGER DEFAULT 5")
        conn.commit()
        logger.info("Migration successful: added 'check_frequency_minutes' column")
    except sqlite3.OperationalError as e:
        # It's okay if it already exists
        logger.info(f"Migration skipped (column may already exist): {e}")
    conn.close()
else:
    logger.info("Database does not exist yet — no migration needed")

