"""
Generates the synthetic Kaggle Store Item Demand CSV slice used to
pretrain the LightGBM model. Run this once before starting the server.

Output: backend/data/kaggle_store_item_demand.csv
Format: date, store, item, sales
"""

import os
import random
import csv
from datetime import date, timedelta

random.seed(123)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(BASE_DIR, "data", "kaggle_store_item_demand.csv")

NUM_STORES = 2
NUM_ITEMS = 20
DAYS = 365  # 1 year of history

# Base demand per item (units/day at full price)
BASE_DEMAND = {i: random.uniform(1.0, 12.0) for i in range(1, NUM_ITEMS + 1)}

# Seasonal multipliers by month
SEASONAL = {
    1: 0.80, 2: 0.82, 3: 0.88, 4: 0.92, 5: 0.95, 6: 1.00,
    7: 1.10, 8: 1.12, 9: 1.05, 10: 0.98, 11: 1.15, 12: 1.25,
}

# Day-of-week multipliers (Mon=0 … Sun=6)
DOW = {0: 0.95, 1: 0.90, 2: 0.92, 3: 0.95, 4: 1.05, 5: 1.15, 6: 1.10}


def generate():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    start = date(2023, 1, 1)
    rows = []

    for store in range(1, NUM_STORES + 1):
        for item in range(1, NUM_ITEMS + 1):
            base = BASE_DEMAND[item] * random.uniform(0.85, 1.15)  # store variation
            for d in range(DAYS):
                dt = start + timedelta(days=d)
                month_mult = SEASONAL[dt.month]
                dow_mult = DOW[dt.weekday()]
                mean = base * month_mult * dow_mult
                sales = max(0, int(random.gauss(mean, mean * 0.25)))
                rows.append((dt.isoformat(), store, item, sales))

    with open(OUT_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "store", "item", "sales"])
        writer.writerows(rows)

    print(f"Generated {len(rows)} rows -> {OUT_PATH}")


if __name__ == "__main__":
    generate()
