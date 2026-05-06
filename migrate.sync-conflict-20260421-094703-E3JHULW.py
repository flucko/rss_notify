import sqlite3
import os

db_path = os.environ.get("DB_PATH", "/app/data/rss.db")
if os.environ.get("ENV") == "development":
    db_path = "./data/rss.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE settings ADD COLUMN check_frequency_minutes INTEGER DEFAULT 5")
        conn.commit()
        print("Migration successful.")
    except sqlite3.OperationalError as e:
        # It's okay if it already exists
        print(f"Operational error (might already exist): {e}")
    conn.close()
else:
    print("Database does not exist yet. No migration needed.")
