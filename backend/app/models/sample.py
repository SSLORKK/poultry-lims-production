from sqlalchemy import Column, Integer, String, DateTime, Date, Text, Index, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base
import enum


class SampleStatus(str, enum.Enum):
    """Enum for sample status to ensure data integrity"""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    on_hold = "on_hold"


class Sample(Base):
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String(100), unique=True, index=True, nullable=False)
    year = Column(Integer, nullable=False, index=True)
    
    # Sample-level poultry fields (shared across all units)
    date_received = Column(Date, nullable=False, index=True)
    company = Column(String(255), nullable=False, index=True)
    farm = Column(String(255), nullable=False, index=True)
    cycle = Column(String(100), nullable=True)
    flock = Column(String(100), nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_edited_by = Column(String(255), nullable=True)
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_samples_company_farm', 'company', 'farm'),
        Index('ix_samples_date_status', 'date_received', 'status'),
        Index('ix_samples_year_status', 'year', 'status'),
    )
    
    # Relationships
    units = relationship("Unit", back_populates="sample", cascade="all, delete-orphan")
