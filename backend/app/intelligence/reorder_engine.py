"""
Reorder engine.

For each product:
  1. Get predicted 7-day demand from the LightGBM model.
  2. Get current total stock from live Batch rows.
  3. recommended_qty = max(0, predicted_7d - current_stock + safety_buffer)
  4. Flag as "slow-moving" if trailing-30-day sales < 20% of category average.
  5. Generate a specific, data-grounded reasoning_text.
  6. Store/update a ReorderRecommendation row.
"""

import logging
from datetime import date, timedelta, datetime

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Product, Batch, Sale, ReorderRecommendation

logger = logging.getLogger(__name__)


def _current_stock(product_id: int, db: Session) -> int:
    today = date.today()
    total = (
        db.query(func.sum(Batch.quantity))
        .filter(
            Batch.product_id == product_id,
            Batch.quantity > 0,
        )
        .scalar()
    ) or 0
    return int(total)


def _trailing_sales(product_id: int, days: int, db: Session) -> float:
    cutoff = datetime.utcnow() - timedelta(days=days)
    total = (
        db.query(func.sum(Sale.quantity))
        .filter(Sale.product_id == product_id, Sale.timestamp >= cutoff)
        .scalar()
    ) or 0
    return float(total)


def _category_avg_30d(category: str, db: Session) -> float:
    """Average 30-day sales across all products in the same category."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    products = db.query(Product).filter(Product.category == category).all()
    if not products:
        return 1.0
    totals = []
    for p in products:
        t = (
            db.query(func.sum(Sale.quantity))
            .filter(Sale.product_id == p.id, Sale.timestamp >= cutoff)
            .scalar()
        ) or 0
        totals.append(float(t))
    return sum(totals) / len(totals) if totals else 1.0


def _build_reasoning(
    product_name: str,
    daily_avg_14d: float,
    current_stock: int,
    recommended_qty: int,
    is_slow: bool,
    predicted_7d: float,
    safety_buffer: int,
) -> str:
    if recommended_qty <= 0:
        return (
            f"{product_name} has {current_stock} units in stock. "
            f"Predicted demand over the next 7 days is {predicted_7d:.0f} units — "
            f"no reorder needed yet."
        )

    if is_slow:
        return (
            f"{product_name} is slow-moving (avg {daily_avg_14d:.1f} units/day over 14 days). "
            f"Only {current_stock} units left; ordering {recommended_qty} as a conservative buffer."
        )

    avg_str = f"{daily_avg_14d:.1f}" if daily_avg_14d >= 0.1 else "<0.1"
    return (
        f"Selling ~{avg_str} units/day over the last 14 days; "
        f"{current_stock} left in stock. "
        f"Predicted demand: {predicted_7d:.0f} units next 7 days — "
        f"reordering {recommended_qty} to cover demand + {safety_buffer}-unit safety buffer."
    )


def run_reorder_engine(db: Session):
    """
    Run the full reorder engine for all products.
    Writes/updates ReorderRecommendation rows in the DB.
    """
    from app.intelligence.forecasting import predict_7d

    products = db.query(Product).all()

    for product in products:
        try:
            predicted_7d = predict_7d(product.id, db)
            current_stock = _current_stock(product.id, db)
            safety_buffer = product.reorder_safety_buffer

            recommended_qty = max(0, int(predicted_7d - current_stock + safety_buffer))

            # Slow-moving check: 30d sales < 20% of category average
            sales_30d = _trailing_sales(product.id, 30, db)
            cat_avg = _category_avg_30d(product.category, db)
            is_slow = sales_30d < 0.2 * cat_avg

            # 14-day average daily sales for the reasoning text
            sales_14d = _trailing_sales(product.id, 14, db)
            daily_avg_14d = sales_14d / 14.0

            reasoning = _build_reasoning(
                product_name=product.name,
                daily_avg_14d=daily_avg_14d,
                current_stock=current_stock,
                recommended_qty=recommended_qty,
                is_slow=is_slow,
                predicted_7d=predicted_7d,
                safety_buffer=safety_buffer,
            )

            # Upsert: delete old recommendation and insert fresh
            db.query(ReorderRecommendation).filter(
                ReorderRecommendation.product_id == product.id
            ).delete()

            rec = ReorderRecommendation(
                product_id=product.id,
                recommended_qty=recommended_qty,
                predicted_demand_7d=predicted_7d,
                reasoning_text=reasoning,
                generated_at=datetime.utcnow(),
            )
            db.add(rec)

        except Exception as e:
            logger.error("Reorder engine error for product %d: %s", product.id, e)

    db.commit()
    logger.info("Reorder engine completed for %d products.", len(products))
