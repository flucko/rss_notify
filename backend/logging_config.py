import logging
import os


def setup_logging():
    """Configure logging for the entire application.

    Format: 2026-04-14 09:15:03 [INFO] backend.rss_checker: message
    Level: Configurable via LOG_LEVEL env var (default: INFO)
    """
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,  # Override any prior basicConfig calls
    )

    # Quiet noisy third-party loggers
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
