"""
LightGBM demand forecasting engine.

No external data files are required at deploy time. On first run:
  1. A synthetic training CSV is generated in-memory (same format as
     Kaggle Store Item Demand Forecasting).
  2. LightGBM is pretrained on that data and the model is cached to
     a temp directory for the lifetime of the process.

Storage strategy:
  - Local dev : backend/data/ (if it exists) or /tmp
  - Render    : /tmp  (ephemeral — model retrains on cold start, which
                is acceptable for a demo; production would use S3/GCS)
"""

import os
import csv
import io
import pickle
import logging
import random
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

# ── Storage paths ──────────────────────────────────────────────────────────────
# Prefer backend/data/ if writable (local dev), else use /tmp (Render)
_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_CANDIDATE = os.path.join(_BASE, "data")

def _get_data_dir() -> str:
    try:
        os.makedirs(_DATA_CANDIDATE, exist_ok=True)
        test = os.path.join(_DATA_CANDIDATE, ".writable")
        with open(test, "w") as f:
            f.write("ok")
        os.remove(test)
        return _DATA_CANDIDATE
    except OSError:
        return "/tmp"

DATA_DIR   = _get_data_dir()
MODEL_PATH = os.path.join(DATA_DIR, "lgbm_demand_model.pkl")

FEATURE_COLS = [
    "day_of_week", "month", "day_of_month",
    "rolling_mean_7d", "rolling_mean_30d",
    "lag_1", "lag_7",
]

_model: Optional[lgb.Booster] = None


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic CSV generation (no external files needed)
# ─────────────────────────────────────────────────────────────────────────────

def _generate_training_dataframe() -> pd.DataFrame:
    """
    Generate a synthetic demand dataset in-memory.
    Same format as Kaggle Store Item Demand Forecasting:
      columns: date, item, sales
    """
    random.seed(123)
    rng = np.random.default_rng(123)

    NUM_ITEMS = 20
    DAYS      = 365
    start     = date(2023, 1, 1)

    seasonal = {1:0.80,2:0.82,3:0.88,4:0.92,5:0.95,6:1.00,
                7:1.10,8:1.12,9:1.05,10:0.98,11:1.15,12:1.25}
    dow      = {0:0.95,1:0.90,2:0.92,3:0.95,4:1.05,5:1.15,6:1.10}

    rows = []
    for item in range(1, NUM_ITEMS + 1):
        base = rng.uniform(1.0, 12.0)
        for d in range(DAYS):
            dt    = start + timedelta(days=d)
            mean  = base * seasonal[dt.month] * dow[dt.weekday()]
            sales = max(0, int(rng.normal(mean, mean * 0.25)))
            rows.append({"date": dt.isoformat(), "item": item, "sales": sales})

    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering
# ─────────────────────────────────────────────────────────────────────────────

def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["item", "date"])

    df["day_of_week"]    = df["date"].dt.dayofweek
    df["month"]          = df["date"].dt.month
    df["day_of_month"]   = df["date"].dt.day
    df["rolling_mean_7d"]  = df.groupby("item")["sales"].transform(
        lambda x: x.shift(1).rolling(7,  min_periods=1).mean())
    df["rolling_mean_30d"] = df.groupby("item")["sales"].transform(
        lambda x: x.shift(1).rolling(30, min_periods=1).mean())
    df["lag_1"] = df.groupby("item")["sales"].transform(lambda x: x.shift(1))
    df["lag_7"] = df.groupby("item")["sales"].transform(lambda x: x.shift(7))

    return df.dropna(subset=FEATURE_COLS)


# ─────────────────────────────────────────────────────────────────────────────
# Pretrain
# ─────────────────────────────────────────────────────────────────────────────

def pretrain() -> lgb.Booster:
    """Train LightGBM on synthetic demand data. Saves model to DATA_DIR."""
    logger.info("Pretraining LightGBM on synthetic demand data ...")
    df = _generate_training_dataframe()
    df = _build_features(df)

    X = df[FEATURE_COLS]
    y = df["sales"]
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.1, shuffle=False)

    params = {
        "objective": "regression_l1",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 63,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_jobs": -1,
    }

    booster = lgb.train(
        params,
        lgb.Dataset(X_train, label=y_train),
        num_boost_round=200,
        valid_sets=[lgb.Dataset(X_val, label=y_val)],
        callbacks=[lgb.early_stopping(20, verbose=False), lgb.log_evaluation(-1)],
    )

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(booster, f)
    logger.info("Model saved to %s (best_iteration=%d)", MODEL_PATH, booster.best_iteration)
    return booster


def load_model() -> lgb.Booster:
    global _model
    if _model is not None:
        return _model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        logger.info("Loaded cached model from %s", MODEL_PATH)
    else:
        _model = pretrain()
    return _model


# ─────────────────────────────────────────────────────────────────────────────
# Retrain on live sales
# ─────────────────────────────────────────────────────────────────────────────

def retrain(db_session) -> lgb.Booster:
    global _model
    from app.models import Sale
    from sqlalchemy import func as sa_func

    rows = (
        db_session.query(
            sa_func.date(Sale.timestamp).label("date"),
            Sale.product_id.label("item"),
            sa_func.sum(Sale.quantity).label("sales"),
        )
        .group_by(sa_func.date(Sale.timestamp), Sale.product_id)
        .all()
    )

    if len(rows) < 30:
        logger.info("Insufficient live data (%d rows) — using pre-trained model.", len(rows))
        return load_model()

    df = pd.DataFrame(rows, columns=["date", "item", "sales"])
    df["sales"] = df["sales"].astype(float)
    df = _build_features(df)
    if df.empty:
        return load_model()

    base = load_model()
    _model = lgb.train(
        {"objective":"regression_l1","metric":"mae","learning_rate":0.03,
         "num_leaves":31,"verbose":-1,"n_jobs":-1},
        lgb.Dataset(df[FEATURE_COLS], label=df["sales"]),
        num_boost_round=50,
        init_model=base,
    )
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(_model, f)
    logger.info("Model retrained on %d live rows.", len(df))
    return _model


# ─────────────────────────────────────────────────────────────────────────────
# Predict 7-day demand
# ─────────────────────────────────────────────────────────────────────────────

def predict_7d(product_id: int, db_session) -> float:
    from app.models import Sale
    from sqlalchemy import func as sa_func

    model = load_model()

    rows = (
        db_session.query(
            sa_func.date(Sale.timestamp).label("date"),
            sa_func.sum(Sale.quantity).label("sales"),
        )
        .filter(Sale.product_id == product_id)
        .group_by(sa_func.date(Sale.timestamp))
        .order_by(sa_func.date(Sale.timestamp))
        .all()
    )

    if not rows:
        return 7.0  # ~1 unit/day default

    df = pd.DataFrame(rows, columns=["date", "sales"])
    df["date"]  = pd.to_datetime(df["date"])
    df["sales"] = df["sales"].astype(float)

    full_range = pd.date_range(df["date"].min(), df["date"].max())
    df = df.set_index("date").reindex(full_range, fill_value=0).reset_index()
    df.columns = ["date", "sales"]
    df["item"] = product_id

    today = pd.Timestamp(date.today())
    predicted_total = 0.0

    for i in range(1, 8):
        pred_date = today + timedelta(days=i)
        tmp = pd.concat([
            df,
            pd.DataFrame({"date":[pred_date],"sales":[0.0],"item":[product_id]}),
        ], ignore_index=True).sort_values("date")

        tmp["day_of_week"]    = tmp["date"].dt.dayofweek
        tmp["month"]          = tmp["date"].dt.month
        tmp["day_of_month"]   = tmp["date"].dt.day
        tmp["rolling_mean_7d"]  = tmp["sales"].shift(1).rolling(7,  min_periods=1).mean()
        tmp["rolling_mean_30d"] = tmp["sales"].shift(1).rolling(30, min_periods=1).mean()
        tmp["lag_1"] = tmp["sales"].shift(1)
        tmp["lag_7"] = tmp["sales"].shift(7)
        tmp = tmp.fillna(0)

        pred = float(max(0.0, model.predict(tmp.iloc[[-1]][FEATURE_COLS])[0]))
        predicted_total += pred
        df = pd.concat([
            df,
            pd.DataFrame({"date":[pred_date],"sales":[pred],"item":[product_id]}),
        ], ignore_index=True)

    return round(predicted_total, 2)
