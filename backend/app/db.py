"""
Database engine and session setup.

Local dev  : SQLite (file-based, zero setup)
Production : PostgreSQL on Render — set DATABASE_URL env var to the
             Render internal connection string.

SQLAlchemy is designed for a drop-in swap: no other code changes needed.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Render sets DATABASE_URL automatically when you attach a PostgreSQL instance.
# Locally it falls back to SQLite.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(BASE_DIR, 'pos_inventory.db')}"
)

# Render's PostgreSQL URL starts with "postgres://", but SQLAlchemy 2.x
# requires "postgresql://". Fix it transparently.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL doesn't support that arg.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
