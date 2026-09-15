"""
Inventory router.

GET  /inventory              — Current stock per product, broken down by batch.
POST /inventory/products     — Create a new product.
POST /inventory/batches      — Add a new batch to an existing product.
POST /inventory/returns      — Log a return or wastage (does NOT count as a sale).
GET  /inventory/products     — List all products.
"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Product, Batch, ReturnOrWastage
from app.schemas import (
    ProductCreate, ProductOut,
    BatchCreate, BatchOut,
    ReturnCreate, ReturnOut,
    ProductStock, BatchStock,
)

router = APIRouter()


# ── Products ───────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.sku == payload.sku).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"SKU '{payload.sku}' already exists.")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ── Batches ────────────────────────────────────────────────────────────────────

@router.post("/batches", response_model=BatchOut, status_code=201)
def create_batch(payload: BatchCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    batch = Batch(**payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


# ── Stock Overview ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ProductStock])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    today = date.today()
    result = []

    for product in products:
        batch_stocks = []
        total_qty = 0

        for batch in sorted(
            product.batches,
            key=lambda b: (b.expiry_date or date.max),
        ):
            if batch.quantity <= 0:
                continue
            days = (
                (batch.expiry_date - today).days
                if batch.expiry_date
                else None
            )
            batch_stocks.append(BatchStock(
                batch_id=batch.id,
                batch_number=batch.batch_number,
                quantity=batch.quantity,
                expiry_date=batch.expiry_date,
                days_to_expiry=days,
                current_discount_pct=batch.current_discount_pct,
            ))
            total_qty += batch.quantity

        result.append(ProductStock(
            product_id=product.id,
            sku=product.sku,
            name=product.name,
            category=product.category,
            unit_price=product.unit_price,
            total_quantity=total_qty,
            batches=batch_stocks,
        ))

    return result


# ── Returns / Wastage ──────────────────────────────────────────────────────────

@router.post("/returns", response_model=ReturnOut, status_code=201)
def log_return(payload: ReturnCreate, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == payload.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    if batch.quantity < payload.quantity:
        raise HTTPException(status_code=409, detail="Return quantity exceeds batch stock.")

    record = ReturnOrWastage(**payload.model_dump())
    db.add(record)
    batch.quantity -= payload.quantity
    db.commit()
    db.refresh(record)
    return record
