# Intelligent POS & Inventory Management System

A working demo of an AI-powered POS and inventory system for small retail stores.

## Key Differentiators

1. **Sales history → specific reorder number** (not just "stock is low") via LightGBM demand forecasting
2. **Automatic expiry-based discounting** via an epsilon-greedy contextual bandit that learns which discount tier clears stock fastest
3. **Plain-language "why" explanation** for every recommendation — no generic placeholder text

---

## Quick Start

### Prerequisites
- Python 3.11+ (tested on 3.13)
- Node.js 18+

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install --only-binary :all: -r requirements.txt

# Generate training data CSV
python generate_csv.py

# Seed the database (90 days of synthetic sales, 20 SKUs)
python -m app.seed

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend will be available at: http://localhost:8000
API docs (Swagger UI): http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

The frontend will be available at: http://localhost:5173

---

## Project Structure

```
pos-inventory-demo/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + startup/shutdown hooks
│   │   ├── models.py                # SQLAlchemy ORM (6 tables)
│   │   ├── schemas.py               # Pydantic request/response schemas
│   │   ├── db.py                    # SQLite engine/session setup
│   │   ├── routers/
│   │   │   ├── sales.py             # POST /sales (FIFO batch depletion)
│   │   │   ├── inventory.py         # GET /inventory, product/batch CRUD
│   │   │   ├── recommendations.py   # GET /recommendations (reorder + discount)
│   │   │   └── alerts.py            # GET /alerts (unified feed)
│   │   ├── intelligence/
│   │   │   ├── forecasting.py       # LightGBM train/retrain/predict_7d
│   │   │   ├── bandit.py            # Epsilon-greedy bandit (from scratch)
│   │   │   ├── reorder_engine.py    # forecast + stock → reorder qty + reasoning
│   │   │   └── expiry_engine.py     # expiry scan → discount via bandit + reasoning
│   │   ├── jobs/
│   │   │   └── scheduler.py         # APScheduler: 60s cycle (demo)
│   │   └── seed.py                  # 90-day synthetic sales generator
│   ├── data/
│   │   ├── kaggle_store_item_demand.csv  # synthetic training slice
│   │   ├── lgbm_demand_model.pkl         # saved model (created on first run)
│   │   └── bandit_state.json             # bandit Q-values (persisted)
│   ├── generate_csv.py              # generates the training CSV
│   ├── requirements.txt
│   └── pos_inventory.db             # SQLite DB (created on first run)
├── frontend/
│   └── src/
│       ├── pages/   (POS, Dashboard, Recommendations, Alerts)
│       ├── components/ (Navbar, StockTable, RecommendationCard, AlertFeed)
│       └── api/client.js
├── docs/
│   └── architecture.md
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| POST | `/sales/` | Record a sale by SKU + quantity |
| GET | `/sales/` | Recent sales history |
| GET | `/inventory/` | Stock overview with batch-level expiry |
| GET | `/inventory/products` | List all products |
| POST | `/inventory/products` | Create a product |
| POST | `/inventory/batches` | Add a batch |
| POST | `/inventory/returns` | Log a return/wastage |
| GET | `/recommendations/` | Run both engines, return results |
| GET | `/recommendations/reorder` | Reorder recommendations only |
| GET | `/recommendations/discounts` | Discount recommendations only |
| GET | `/alerts/` | Unified alert feed |

---

## What the Seed Script Does

`app/seed.py` generates a realistic 90-day sales history for **20 SKUs** across **3 categories**:

| Category | Examples | Sales Pattern |
|---|---|---|
| `fast_moving` | White Bread, Cola, Chips | Near-daily sales, 3-12 units/day |
| `slow_moving` | Truffle Oil, Saffron | ~20% of days, 1-3 units/day |
| `perishable` | Milk, Yogurt, Strawberries | 85% of days, 4-15 units/day, 3-10 day shelf life |

Also adds **4 near-expiry batches** (expires within 1-5 days) so the demo shows discount recommendations on first run.

---

## Demo-Simplified vs. Production Design

| Component | Demo (this build) | Production |
|---|---|---|
| **Database** | SQLite (file-based, zero setup) | PostgreSQL + TimescaleDB (time-series optimized) |
| **Alerts** | In-app feed only | WhatsApp Business API / Twilio SMS |
| **Training data** | Synthetic 14,600-row CSV | Full Kaggle Favorita dataset (several GB) |
| **Scheduler interval** | Every 60 seconds (visible for judges) | Nightly retrain at 2 AM, hourly expiry scan |
| **Authentication** | None | JWT + role-based access control |
| **Barcode scanner** | Camera (html5-qrcode) + manual entry | USB/Bluetooth scanner via HID input |
| **Bandit library** | From scratch (~150 lines) | Production: Vowpal Wabbit or Ray RLlib |

These are deliberate scope decisions for a working demo — not oversights.

---

## Architecture Overview

See [docs/architecture.md](docs/architecture.md) for the full four-layer design.

## Tech Stack

- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0, SQLite, APScheduler
- **ML**: LightGBM 4.5, scikit-learn, pandas, numpy
- **Frontend**: React 18, Vite 6, Tailwind CSS 3, Recharts, html5-qrcode, lucide-react
