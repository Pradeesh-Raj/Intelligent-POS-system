"""
FastAPI application entrypoint.

Startup sequence:
  1. Create all DB tables (Alembic-free for the demo).
  2. Auto-seed the database if it's empty (runs once on fresh Render deploy).
  3. Start the APScheduler background job loop.

CORS: configured via ALLOWED_ORIGINS env var (comma-separated URLs).
      Defaults to localhost dev ports so local dev still works without a .env file.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import engine
from app import models  # noqa: F401
from app.routers import sales, inventory, recommendations, alerts

# ── Create tables ──────────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

# ── FastAPI ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Intelligent POS & Inventory System",
    description="FastAPI + LightGBM + epsilon-greedy bandit demo.",
    version="0.1.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# In production set ALLOWED_ORIGINS to your Vercel URL, e.g.:
#   ALLOWED_ORIGINS=https://your-app.vercel.app
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
)
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(sales.router,           prefix="/sales",           tags=["Sales"])
app.include_router(inventory.router,       prefix="/inventory",       tags=["Inventory"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"])
app.include_router(alerts.router,          prefix="/alerts",          tags=["Alerts"])


@app.get("/", tags=["Health"])
def health():
    return {"status": "ok", "service": "POS Inventory Demo"}


# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    # Auto-seed if this is a fresh database (no products yet).
    # Safe to run on every cold start — seed.py checks before inserting.
    from app.app_seed import auto_seed
    auto_seed()

    # Start the background scheduler (reorder + expiry engines every 60s).
    from app.jobs.scheduler import start
    start()


@app.on_event("shutdown")
def on_shutdown():
    from app.jobs.scheduler import stop
    stop()
