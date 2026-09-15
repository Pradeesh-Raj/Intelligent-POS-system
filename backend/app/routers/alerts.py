"""
Alerts router.

GET /alerts — Merges recent ReorderRecommendation and DiscountEvent rows
              into a unified feed, newest first, with reasoning_text.
              This is where WhatsApp Business API / Twilio would plug in
              for production push notifications.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import AlertOut

router = APIRouter()


@router.get("/", response_model=List[AlertOut])
def get_alerts(limit: int = 50, db: Session = Depends(get_db)):
    from app.models import ReorderRecommendation, DiscountEvent, Batch, Product

    alerts: List[AlertOut] = []

    # ── Reorder alerts ─────────────────────────────────────────────────────────
    reorders = (
        db.query(ReorderRecommendation)
        .order_by(ReorderRecommendation.generated_at.desc())
        .limit(limit)
        .all()
    )
    for r in reorders:
        alerts.append(AlertOut(
            alert_type="reorder",
            title=f"Reorder {r.product.name} — {r.recommended_qty} units",
            reasoning_text=r.reasoning_text,
            timestamp=r.generated_at,
            meta={
                "product_id": r.product_id,
                "sku": r.product.sku,
                "recommended_qty": r.recommended_qty,
                "predicted_demand_7d": round(r.predicted_demand_7d, 1),
            },
        ))

    # ── Discount / expiry alerts ───────────────────────────────────────────────
    discounts = (
        db.query(DiscountEvent)
        .order_by(DiscountEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    for d in discounts:
        batch = db.query(Batch).filter(Batch.id == d.batch_id).first()
        product = db.query(Product).filter(Product.id == batch.product_id).first() if batch else None
        name = product.name if product else "Unknown product"
        alerts.append(AlertOut(
            alert_type="discount",
            title=f"Discount applied to {name} — {int(d.new_discount_pct)}% off",
            reasoning_text=d.reasoning_text,
            timestamp=d.timestamp,
            meta={
                "batch_id": d.batch_id,
                "old_pct": d.old_discount_pct,
                "new_pct": d.new_discount_pct,
            },
        ))

    # Sort by timestamp descending and return top N
    alerts.sort(key=lambda a: a.timestamp, reverse=True)
    return alerts[:limit]
