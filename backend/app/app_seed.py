"""
Auto-seed wrapper called on FastAPI startup.

Checks if the database is empty; if so, runs the full seed to create
products, batches, and 90 days of synthetic sales.

Safe to call on every cold start — it no-ops if data already exists.
On Render's free tier, the PostgreSQL database persists between deploys,
so this only seeds once (on the very first deploy).
"""

import logging

logger = logging.getLogger(__name__)


def auto_seed():
    """Seed the database if it's empty. Called from main.py startup."""
    from app.db import SessionLocal
    from app import models

    db = SessionLocal()
    try:
        count = db.query(models.Product).count()
        if count > 0:
            logger.info("Database already seeded (%d products). Skipping.", count)
            return

        logger.info("Empty database detected — running seed...")
        from app.seed import seed
        seed()
        logger.info("Auto-seed complete.")
    except Exception as e:
        logger.error("Auto-seed failed: %s", e)
    finally:
        db.close()
