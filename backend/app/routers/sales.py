"""
Sales router.

POST /sales        — Record a sale by SKU + quantity. Decrements oldest
                     non-expired batch first (FIFO by expiry_date).
                     Fast path: never touches ML layers.
GET  /sales        — Recent sales history.
"""

from datetime import datetime, date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Product, Batch, Sale
from app.schemas import SaleCreate, SaleOut

router = APIRouter()


@router.post("/", response_model=List[SaleOut], status_code=201)
def record_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    """
    Record a sale for the given SKU.

    FIFO logic: always consume the oldest batch (lowest expiry_date, or
    received_date for non-perishables) first. A single sale may span
    multiple batches if the first batch doesn't have enough stock.
    """
    product = db.query(Product).filter(Product.sku == payload.sku).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with SKU '{payload.sku}' not found.")

    today = date.today()

    # Batches with stock, not expired, ordered FIFO (earliest expiry first)
    batches = (
        db.query(Batch)
        .filter(
            Batch.product_id == product.id,
            Batch.quantity > 0,
        )
        .order_by(
            Batch.expiry_date.asc().nullslast(),
            Batch.received_date.asc(),
        )
        .all()
    )

    # Filter out expired batches
    available = [
        b for b in batches
        if b.expiry_date is None or b.expiry_date >= today
    ]

    total_available = sum(b.quantity for b in available)
    if total_available < payload.quantity:
        raise HTTPException(
            status_code=409,
            detail=f"Insufficient stock. Requested {payload.quantity}, available {total_available}.",
        )

    created_sales: List[Sale] = []
    remaining = payload.quantity

    for batch in available:
        if remaining <= 0:
            break
        deduct = min(remaining, batch.quantity)
        effective_price = product.unit_price * (1 - batch.current_discount_pct / 100)

        sale = Sale(
            product_id=product.id,
            batch_id=batch.id,
            quantity=deduct,
            unit_price_at_sale=round(effective_price, 2),
            timestamp=datetime.utcnow(),
        )
        db.add(sale)
        batch.quantity -= deduct
        remaining -= deduct
        created_sales.append(sale)

    db.commit()
    for s in created_sales:
        db.refresh(s)

    return created_sales


@router.get("/", response_model=List[SaleOut])
def get_sales(limit: int = 100, db: Session = Depends(get_db)):
    return (
        db.query(Sale)
        .order_by(Sale.timestamp.desc())
        .limit(limit)
        .all()
    )
