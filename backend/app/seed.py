"""
Seed script — generates ~90 days of realistic synthetic sales for ~20 SKUs.

Categories:
  - fast_moving  : near-daily sales, high volume (e.g., bread, soft drinks)
  - slow_moving  : sparse, irregular (e.g., specialty condiments, premium oils)
  - perishable   : short shelf life 3-10 days (e.g., dairy, bakery, fresh produce)

Also creates a handful of batches that are ALREADY near expiry as of today,
so the demo immediately shows interesting discount/expiry behavior on first run.

Usage:
    python -m app.seed
  OR
    python app/seed.py
"""

import os
import sys
import random
from datetime import date, datetime, timedelta

# Allow running directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine, SessionLocal
from app import models

random.seed(42)

TODAY = date.today()


# ─────────────────────────────────────────────────────────────────────────────
# Product definitions
# ─────────────────────────────────────────────────────────────────────────────

PRODUCTS = [
    # ── Fast-moving ───────────────────────────────────────────────────────────
    {"sku": "FM-001", "name": "White Bread Loaf",       "category": "fast_moving",  "unit_price": 2.50,  "reorder_safety_buffer": 20},
    {"sku": "FM-002", "name": "Cola 2L Bottle",          "category": "fast_moving",  "unit_price": 1.80,  "reorder_safety_buffer": 30},
    {"sku": "FM-003", "name": "Potato Chips 150g",       "category": "fast_moving",  "unit_price": 1.20,  "reorder_safety_buffer": 25},
    {"sku": "FM-004", "name": "Instant Noodles Pack",    "category": "fast_moving",  "unit_price": 0.80,  "reorder_safety_buffer": 40},
    {"sku": "FM-005", "name": "Bottled Water 1L",        "category": "fast_moving",  "unit_price": 0.60,  "reorder_safety_buffer": 50},
    {"sku": "FM-006", "name": "Eggs (Dozen)",            "category": "fast_moving",  "unit_price": 3.20,  "reorder_safety_buffer": 15},
    {"sku": "FM-007", "name": "Orange Juice 1L",         "category": "fast_moving",  "unit_price": 2.10,  "reorder_safety_buffer": 20},

    # ── Slow-moving ───────────────────────────────────────────────────────────
    {"sku": "SM-001", "name": "Truffle Olive Oil 250ml", "category": "slow_moving",  "unit_price": 12.99, "reorder_safety_buffer": 3},
    {"sku": "SM-002", "name": "Saffron 1g Pack",         "category": "slow_moving",  "unit_price": 8.50,  "reorder_safety_buffer": 2},
    {"sku": "SM-003", "name": "Anchovy Paste 100g",      "category": "slow_moving",  "unit_price": 4.20,  "reorder_safety_buffer": 3},
    {"sku": "SM-004", "name": "Matcha Powder 50g",       "category": "slow_moving",  "unit_price": 7.80,  "reorder_safety_buffer": 2},
    {"sku": "SM-005", "name": "Black Truffle Salt",      "category": "slow_moving",  "unit_price": 9.50,  "reorder_safety_buffer": 2},
    {"sku": "SM-006", "name": "Tahini 300g",             "category": "slow_moving",  "unit_price": 5.40,  "reorder_safety_buffer": 3},

    # ── Perishable ────────────────────────────────────────────────────────────
    {"sku": "PR-001", "name": "Whole Milk 2L",           "category": "perishable",   "unit_price": 2.20,  "reorder_safety_buffer": 10},
    {"sku": "PR-002", "name": "Greek Yogurt 500g",       "category": "perishable",   "unit_price": 2.80,  "reorder_safety_buffer": 8},
    {"sku": "PR-003", "name": "Sliced Cheddar 200g",     "category": "perishable",   "unit_price": 3.50,  "reorder_safety_buffer": 6},
    {"sku": "PR-004", "name": "Fresh Strawberries 400g", "category": "perishable",   "unit_price": 3.00,  "reorder_safety_buffer": 10},
    {"sku": "PR-005", "name": "Sourdough Loaf",          "category": "perishable",   "unit_price": 4.50,  "reorder_safety_buffer": 8},
    {"sku": "PR-006", "name": "Butter 250g",             "category": "perishable",   "unit_price": 2.60,  "reorder_safety_buffer": 7},
    {"sku": "PR-007", "name": "Fresh Cream 200ml",       "category": "perishable",   "unit_price": 1.90,  "reorder_safety_buffer": 5},
]

# Sales velocity per category: (min_units_per_day, max_units_per_day, sale_probability)
VELOCITY = {
    "fast_moving": (3, 12, 0.90),   # sells 90% of days, 3-12 units
    "slow_moving": (1, 3,  0.20),   # sells 20% of days, 1-3 units
    "perishable":  (4, 15, 0.85),   # sells 85% of days, 4-15 units
}

# Shelf life ranges in days per category
SHELF_LIFE = {
    "fast_moving": (180, 365),   # non-perishable effectively
    "slow_moving": (365, 730),   # long shelf life
    "perishable":  (3, 10),      # short!
}


def _make_batches(product_id: int, category: str, db) -> list:
    """Create 2-3 batches per product covering the 90-day period."""
    batches = []
    n_batches = random.randint(2, 3)
    shelf_min, shelf_max = SHELF_LIFE[category]

    for i in range(n_batches):
        received = TODAY - timedelta(days=random.randint(5, 90))
        shelf_days = random.randint(shelf_min, shelf_max)
        expiry = (received + timedelta(days=shelf_days)) if category == "perishable" else None

        # Give perishables a chance to still have some stock
        qty = random.randint(10, 60) if category in ("fast_moving", "perishable") else random.randint(5, 20)

        batch = models.Batch(
            product_id=product_id,
            batch_number=f"BATCH-{product_id:03d}-{i+1:02d}",
            quantity=qty,
            received_date=received,
            expiry_date=expiry,
            current_discount_pct=0.0,
        )
        db.add(batch)
        db.flush()
        batches.append(batch)

    return batches


def _add_near_expiry_batch(product, db):
    """
    Add a batch that expires within the next 1-5 days so the demo
    immediately has something interesting to show in the expiry engine.
    """
    days_left = random.randint(1, 5)
    expiry = TODAY + timedelta(days=days_left)
    received = expiry - timedelta(days=random.randint(3, 8))
    qty = random.randint(8, 25)

    batch = models.Batch(
        product_id=product.id,
        batch_number=f"BATCH-{product.id:03d}-NEAR",
        quantity=qty,
        received_date=received,
        expiry_date=expiry,
        current_discount_pct=0.0,
    )
    db.add(batch)
    db.flush()
    return batch


def _generate_sales(product, batches, db):
    """Generate 90 days of synthetic Sale rows for a product."""
    vel_min, vel_max, prob = VELOCITY[product.category]

    for day_offset in range(90, 0, -1):
        sale_date = TODAY - timedelta(days=day_offset)

        if random.random() > prob:
            continue  # no sale this day

        units_sold = random.randint(vel_min, vel_max)

        # FIFO: consume from the batch with earliest expiry
        available = sorted(
            [b for b in batches if b.quantity > 0],
            key=lambda b: (b.expiry_date or date.max, b.received_date),
        )

        for batch in available:
            if units_sold <= 0:
                break
            deduct = min(units_sold, batch.quantity)
            effective_price = product.unit_price * (1 - batch.current_discount_pct / 100)

            sale = models.Sale(
                product_id=product.id,
                batch_id=batch.id,
                quantity=deduct,
                unit_price_at_sale=round(effective_price, 2),
                timestamp=datetime.combine(sale_date, datetime.min.time()).replace(
                    hour=random.randint(8, 20),
                    minute=random.randint(0, 59),
                ),
            )
            db.add(sale)
            batch.quantity -= deduct
            units_sold -= deduct


def seed():
    print("Creating tables ...")
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Skip if already seeded
        if db.query(models.Product).count() > 0:
            print("Database already seeded. Delete pos_inventory.db to re-seed.")
            return

        print(f"Seeding {len(PRODUCTS)} products ...")
        perishable_products = []

        for p_def in PRODUCTS:
            product = models.Product(**p_def)
            db.add(product)
            db.flush()

            batches = _make_batches(product.id, p_def["category"], db)
            _generate_sales(product, batches, db)

            if p_def["category"] == "perishable":
                perishable_products.append(product)

        # Force a few near-expiry batches for demo impact
        near_expiry_targets = perishable_products[:4]
        print(f"Adding {len(near_expiry_targets)} near-expiry batches for demo …")
        for p in near_expiry_targets:
            _add_near_expiry_batch(p, db)

        db.commit()
        print("[OK] Seed complete!")
        print(f"   Products : {db.query(models.Product).count()}")
        print(f"   Batches  : {db.query(models.Batch).count()}")
        print(f"   Sales    : {db.query(models.Sale).count()}")
        print(f"   Near-expiry batches: {near_expiry_targets[0].name if near_expiry_targets else 'N/A'} ...")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
