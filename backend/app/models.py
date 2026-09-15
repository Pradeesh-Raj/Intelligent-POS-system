"""
SQLAlchemy ORM models for the Intelligent POS & Inventory System.

Tables:
  - Product          : master product catalog
  - Batch            : individual stock batches with expiry tracking
  - Sale             : each checkout transaction line
  - ReturnOrWastage  : returns and write-offs (not counted as sales)
  - ReorderRecommendation : ML-generated reorder suggestions per product
  - DiscountEvent    : bandit-generated discount decisions per batch
"""

from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime,
    ForeignKey, Text, func
)
from sqlalchemy.orm import relationship
from app.db import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    category = Column(String(64), nullable=False)       # fast_moving | slow_moving | perishable
    unit_price = Column(Float, nullable=False)
    reorder_safety_buffer = Column(Integer, default=5)  # extra units above forecast demand

    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="product")
    returns = relationship("ReturnOrWastage", back_populates="product")
    recommendations = relationship("ReorderRecommendation", back_populates="product", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String(64), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    received_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)          # None for non-perishables
    current_discount_pct = Column(Float, default=0.0)  # 0, 10, 20, 30, or 40

    product = relationship("Product", back_populates="batches")
    sales = relationship("Sale", back_populates="batch")
    returns = relationship("ReturnOrWastage", back_populates="batch")
    discount_events = relationship("DiscountEvent", back_populates="batch", cascade="all, delete-orphan")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price_at_sale = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)

    product = relationship("Product", back_populates="sales")
    batch = relationship("Batch", back_populates="sales")


class ReturnOrWastage(Base):
    __tablename__ = "returns_wastage"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason_code = Column(String(64), nullable=False)   # e.g. "customer_return", "expired", "damaged"
    timestamp = Column(DateTime, default=func.now(), nullable=False)

    product = relationship("Product", back_populates="returns")
    batch = relationship("Batch", back_populates="returns")


class ReorderRecommendation(Base):
    __tablename__ = "reorder_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    recommended_qty = Column(Integer, nullable=False)
    predicted_demand_7d = Column(Float, nullable=False)
    reasoning_text = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=func.now(), nullable=False)

    product = relationship("Product", back_populates="recommendations")


class DiscountEvent(Base):
    __tablename__ = "discount_events"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    old_discount_pct = Column(Float, nullable=False)
    new_discount_pct = Column(Float, nullable=False)
    reasoning_text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)

    batch = relationship("Batch", back_populates="discount_events")
