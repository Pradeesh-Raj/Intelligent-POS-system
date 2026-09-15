"""
Expiry-based discount engine using the contextual bandit.

For every batch within N days of expiry (default 7):
  1. Compute context: days_to_expiry, current_stock, recent_velocity.
  2. Ask the bandit for the best discount arm.
  3. Apply the discount to the Batch row.
  4. Simulate reward (units sold at that tier) and update bandit.
  5. Generate a specific, data-grounded reasoning_text.
  6. Log a DiscountEvent row.
"""

import logging
from datetime import date, timedelta, datetime

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Batch, Product, Sale, DiscountEvent
from app.intelligence.bandit import get_bandit, ARMS

logger = logging.getLogger(__name__)

EXPIRY_WINDOW_DAYS = 7  # check batches expiring within this many days


def _recent_velocity(product_id: int, batch_id: int, db: Session, days: int = 7) -> float:
    """Average daily units sold for this product over the last `days` days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    total = (
        db.query(func.sum(Sale.quantity))
        .filter(Sale.product_id == product_id, Sale.timestamp >= cutoff)
        .scalar()
    ) or 0
    return float(total) / days


def _build_discount_reasoning(
    product_name: str,
    batch_number: str,
    days_to_expiry: int,
    current_stock: int,
    velocity: float,
    old_pct: float,
    new_pct: float,
) -> str:
    velocity_str = f"{velocity:.1f}" if velocity >= 0.1 else "<0.1"

    if new_pct == 0:
        return (
            f"{product_name} (batch {batch_number}): expires in {days_to_expiry} day(s), "
            f"{current_stock} units left, selling ~{velocity_str}/day. "
            f"No discount needed at current sell-through rate."
        )

    days_to_clear = (current_stock / velocity) if velocity > 0 else float("inf")
    urgency = ""
    if days_to_clear > days_to_expiry:
        urgency = (
            f" At current rate, stock will NOT clear before expiry — "
            f"applying {int(new_pct)}% off to accelerate sell-through."
        )
    else:
        urgency = f" Maintaining {int(new_pct)}% discount to ensure clearance before expiry."

    change_note = ""
    if new_pct > old_pct:
        change_note = f" Discount increased from {int(old_pct)}% (bandit learned higher tier sells faster)."
    elif new_pct < old_pct:
        change_note = f" Discount reduced from {int(old_pct)}% (recent sell-through was strong)."

    return (
        f"{product_name} (batch {batch_number}): expires in {days_to_expiry} day(s), "
        f"{current_stock} units left, selling ~{velocity_str}/day."
        f"{urgency}{change_note}"
    )


def run_expiry_engine(db: Session, window_days: int = EXPIRY_WINDOW_DAYS):
    """
    Scan all batches expiring within `window_days` days.
    Apply bandit-selected discounts and log DiscountEvent rows.
    """
    bandit = get_bandit()
    today = date.today()
    cutoff = today + timedelta(days=window_days)

    near_expiry_batches = (
        db.query(Batch)
        .filter(
            Batch.expiry_date != None,
            Batch.expiry_date <= cutoff,
            Batch.expiry_date >= today,
            Batch.quantity > 0,
        )
        .all()
    )

    logger.info("Expiry engine: found %d near-expiry batches.", len(near_expiry_batches))

    for batch in near_expiry_batches:
        product = db.query(Product).filter(Product.id == batch.product_id).first()
        if not product:
            continue

        days_to_expiry = (batch.expiry_date - today).days
        velocity = _recent_velocity(product.id, batch.id, db)
        current_stock = batch.quantity

        context = {
            "days_to_expiry": days_to_expiry,
            "current_stock": current_stock,
            "velocity": velocity,
        }

        arm_idx = bandit.select_arm(batch.id, context)
        new_discount = bandit.get_arm_discount(arm_idx)
        old_discount = batch.current_discount_pct

        # Simulate reward for this arm and update bandit
        reward = bandit.simulate_reward(
            discount_pct=new_discount,
            days_to_expiry=days_to_expiry,
            velocity=velocity,
            current_stock=current_stock,
        )
        bandit.update(batch.id, arm_idx, reward)

        # Apply discount to batch
        batch.current_discount_pct = new_discount

        # Build reasoning
        reasoning = _build_discount_reasoning(
            product_name=product.name,
            batch_number=batch.batch_number,
            days_to_expiry=days_to_expiry,
            current_stock=current_stock,
            velocity=velocity,
            old_pct=old_discount,
            new_pct=new_discount,
        )

        # Log DiscountEvent
        event = DiscountEvent(
            batch_id=batch.id,
            old_discount_pct=old_discount,
            new_discount_pct=new_discount,
            reasoning_text=reasoning,
            timestamp=datetime.utcnow(),
        )
        db.add(event)
        logger.debug(
            "Batch %d (%s): %g%% → %g%% discount | reward=%.2f",
            batch.id, product.name, old_discount, new_discount, reward,
        )

    db.commit()
    logger.info("Expiry engine completed.")
