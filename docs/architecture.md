# System Architecture

This document describes the four-layer architecture of the Intelligent POS & Inventory System.

## Layer 1: Capture

```
React POS Screen
  - Camera barcode scan (html5-qrcode) OR manual SKU entry
  - POST /sales  →  writes a Sale row + decrements Batch.qty (FIFO by expiry_date)
  - Checkout writes are INSTANT and never wait on ML layers
```

## Layer 2: Processing (SQLite via SQLAlchemy)

Tables:
| Table | Description |
|---|---|
| `products` | Master product catalog with SKU, category, unit_price |
| `batches` | Individual stock batches with expiry_date and current_discount_pct |
| `sales` | Each sale line-item, linked to product + batch |
| `returns_wastage` | Returns/write-offs (not counted as sales) |
| `reorder_recommendations` | ML-generated reorder suggestions |
| `discount_events` | Bandit-generated discount decisions |

A background job (APScheduler, every 60 seconds in demo / nightly in production)
aggregates raw Sale rows into per-SKU demand series for the forecasting model.

## Layer 3: Intelligence

### Forecasting (LightGBM)
- Pre-trained on a local CSV slice mimicking Kaggle Store Item Demand Forecasting format
- Features: day_of_week, month, day_of_month, rolling_mean_7d, rolling_mean_30d, lag_1, lag_7
- Retrainable on live Sale data via `forecasting.retrain(db)`
- Outputs: predicted total demand for next 7 days per product

### Reorder Engine
```
recommended_qty = max(0, predicted_7d_demand - current_stock + safety_buffer)
```
Also flags slow-movers: products whose 30-day sales are below 20% of their category average.
Each recommendation carries a data-grounded `reasoning_text`.

### Expiry Engine + Contextual Bandit
- Scans all batches expiring within 7 days
- Epsilon-greedy bandit (epsilon=0.1) selects a discount arm: [0%, 10%, 20%, 30%, 40%]
- Context features: days_to_expiry, current_stock, recent_velocity (units/day)
- Reward: simulated units sold at that discount tier
- Bandit state is persisted in `backend/data/bandit_state.json`
- Each discount carries a plain-language `reasoning_text`

## Layer 4: Interface (React + Vite + Tailwind)

| Page | Description |
|---|---|
| POS | Camera scan + manual SKU entry, recent sales list |
| Dashboard | Stock table with batch-level expiry color-coding, inventory chart |
| Recommendations | Reorder cards + discount cards, each with prominent `reasoning_text` |
| Alerts | Unified feed of reorder + discount events, newest-first |

## Production vs. Demo Substitutions

| Component | Demo | Production |
|---|---|---|
| Database | SQLite | PostgreSQL + TimescaleDB |
| Alerts | In-app feed | WhatsApp Business API / Twilio |
| Training data | Synthetic CSV (14,600 rows) | Full Kaggle Favorita dataset |
| Scheduler interval | 60 seconds | Nightly retrain, hourly expiry scan |
| Auth | None | JWT + role-based access |
