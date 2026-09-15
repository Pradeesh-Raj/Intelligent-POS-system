"""
Recommendations router.

GET /recommendations/reorder   — Run reorder engine; returns per-product
                                  reorder quantities with reasoning_text.
GET /recommendations/discounts — Run expiry engine; returns per-batch
                                  discount decisions with reasoning_text.
GET /recommendations           — Both combined.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import ReorderRecommendationOut, DiscountEventOut

router = APIRouter()


@router.get("/reorder", response_model=List[ReorderRecommendationOut])
def get_reorder_recommendations(db: Session = Depends(get_db)):
    from app.intelligence.reorder_engine import run_reorder_engine
    run_reorder_engine(db)
    from app.models import ReorderRecommendation, Product
    rows = (
        db.query(ReorderRecommendation)
        .order_by(ReorderRecommendation.generated_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for r in rows:
        result.append(ReorderRecommendationOut(
            id=r.id,
            product_id=r.product_id,
            sku=r.product.sku,
            name=r.product.name,
            recommended_qty=r.recommended_qty,
            predicted_demand_7d=r.predicted_demand_7d,
            reasoning_text=r.reasoning_text,
            generated_at=r.generated_at,
        ))
    return result


@router.get("/discounts", response_model=List[DiscountEventOut])
def get_discount_recommendations(db: Session = Depends(get_db)):
    from app.intelligence.expiry_engine import run_expiry_engine
    run_expiry_engine(db)
    from app.models import DiscountEvent, Batch, Product
    rows = (
        db.query(DiscountEvent)
        .order_by(DiscountEvent.timestamp.desc())
        .limit(50)
        .all()
    )
    result = []
    for d in rows:
        batch = db.query(Batch).filter(Batch.id == d.batch_id).first()
        product = db.query(Product).filter(Product.id == batch.product_id).first() if batch else None
        result.append(DiscountEventOut(
            id=d.id,
            batch_id=d.batch_id,
            product_name=product.name if product else "Unknown",
            sku=product.sku if product else "Unknown",
            old_discount_pct=d.old_discount_pct,
            new_discount_pct=d.new_discount_pct,
            reasoning_text=d.reasoning_text,
            timestamp=d.timestamp,
        ))
    return result


@router.get("/", response_model=dict)
def get_all_recommendations(db: Session = Depends(get_db)):
    from app.intelligence.reorder_engine import run_reorder_engine
    from app.intelligence.expiry_engine import run_expiry_engine
    run_reorder_engine(db)
    run_expiry_engine(db)

    from app.models import ReorderRecommendation, DiscountEvent, Batch, Product

    reorder_rows = (
        db.query(ReorderRecommendation)
        .order_by(ReorderRecommendation.generated_at.desc())
        .limit(50).all()
    )
    discount_rows = (
        db.query(DiscountEvent)
        .order_by(DiscountEvent.timestamp.desc())
        .limit(50).all()
    )

    reorders = []
    for r in reorder_rows:
        reorders.append(ReorderRecommendationOut(
            id=r.id,
            product_id=r.product_id,
            sku=r.product.sku,
            name=r.product.name,
            recommended_qty=r.recommended_qty,
            predicted_demand_7d=r.predicted_demand_7d,
            reasoning_text=r.reasoning_text,
            generated_at=r.generated_at,
        ))

    discounts = []
    for d in discount_rows:
        batch = db.query(Batch).filter(Batch.id == d.batch_id).first()
        product = db.query(Product).filter(Product.id == batch.product_id).first() if batch else None
        discounts.append(DiscountEventOut(
            id=d.id,
            batch_id=d.batch_id,
            product_name=product.name if product else "Unknown",
            sku=product.sku if product else "Unknown",
            old_discount_pct=d.old_discount_pct,
            new_discount_pct=d.new_discount_pct,
            reasoning_text=d.reasoning_text,
            timestamp=d.timestamp,
        ))

    return {"reorder": reorders, "discounts": discounts}
