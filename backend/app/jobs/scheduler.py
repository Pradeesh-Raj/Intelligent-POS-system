"""
APScheduler background job runner.

Runs the reorder engine and expiry engine every 60 seconds so that
during a live demo, judges can watch recommendations refresh without
manually hitting any endpoint.

Production note: In production, the nightly retrain would run via a
cron schedule (e.g., 2 AM) and the expiry scan would run hourly.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.db import SessionLocal

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler(timezone="UTC")


def _run_engines():
    """Called by APScheduler every 60 seconds."""
    db = SessionLocal()
    try:
        from app.intelligence.reorder_engine import run_reorder_engine
        from app.intelligence.expiry_engine import run_expiry_engine

        logger.info("[Scheduler] Running reorder engine …")
        run_reorder_engine(db)

        logger.info("[Scheduler] Running expiry engine …")
        run_expiry_engine(db)

        logger.info("[Scheduler] Cycle complete.")
    except Exception as e:
        logger.error("[Scheduler] Error during engine run: %s", e)
    finally:
        db.close()


def start():
    """Start the background scheduler. Called on FastAPI startup."""
    if _scheduler.running:
        return
    _scheduler.add_job(
        _run_engines,
        trigger=IntervalTrigger(seconds=60),
        id="engine_cycle",
        name="Reorder + Expiry Engine Cycle",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Scheduler] Started — engine cycle every 60 seconds.")
    # Run once immediately on startup so data is available right away
    _run_engines()


def stop():
    """Stop the scheduler. Called on FastAPI shutdown."""
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped.")
