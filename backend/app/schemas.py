"""
Pydantic schemas for request validation and API response serialization.
"""

from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ─────────────────────────────────────────────
# Product
# ─────────────────────────────────────────────

class ProductCreate(BaseModel):
    sku: str
    name: str
    category: str           # fast_moving | slow_moving | perishable
    unit_price: float
    reorder_safety_buffer: int = 5


class ProductOut(ProductCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─────────────────────────────────────────────
# Batch
# ─────────────────────────────────────────────

class BatchCreate(BaseModel):
    product_id: int
    batch_number: str
    quantity: int
    received_date: date
    expiry_date: Optional[date] = None


class BatchOut(BatchCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_discount_pct: float
    product: Optional[ProductOut] = None


# ─────────────────────────────────────────────
# Sale
# ─────────────────────────────────────────────

class SaleCreate(BaseModel):
    sku: str
    quantity: int


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    batch_id: int
    quantity: int
    unit_price_at_sale: float
    timestamp: datetime


# ─────────────────────────────────────────────
# Return / Wastage
# ─────────────────────────────────────────────

class ReturnCreate(BaseModel):
    product_id: int
    batch_id: int
    quantity: int
    reason_code: str    # customer_return | expired | damaged


class ReturnOut(ReturnCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime


# ─────────────────────────────────────────────
# Inventory (aggregated response)
# ─────────────────────────────────────────────

class BatchStock(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    batch_id: int
    batch_number: str
    quantity: int
    expiry_date: Optional[date]
    days_to_expiry: Optional[int]
    current_discount_pct: float


class ProductStock(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: int
    sku: str
    name: str
    category: str
    unit_price: float
    total_quantity: int
    batches: List[BatchStock]


# ─────────────────────────────────────────────
# Reorder Recommendation
# ─────────────────────────────────────────────

class ReorderRecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    sku: str
    name: str
    recommended_qty: int
    predicted_demand_7d: float
    reasoning_text: str
    generated_at: datetime


# ─────────────────────────────────────────────
# Discount / Expiry
# ─────────────────────────────────────────────

class DiscountEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    batch_id: int
    product_name: str
    sku: str
    old_discount_pct: float
    new_discount_pct: float
    reasoning_text: str
    timestamp: datetime


# ─────────────────────────────────────────────
# Alert Feed
# ─────────────────────────────────────────────

class AlertOut(BaseModel):
    alert_type: str     # "reorder" | "discount"
    title: str
    reasoning_text: str
    timestamp: datetime
    meta: dict = {}
