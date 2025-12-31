from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base
import enum


class COAStatus(str, enum.Enum):
    """Enum for COA status to ensure data integrity"""
    draft = "draft"
    created = "created"
    need_approval = "need_approval"
    finalized = "finalized"


class Unit(Base):
    __tablename__ = "units"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    unit_code = Column(String(100), unique=True, index=True, nullable=False)
    
    # Unit-specific poultry fields (each unit can have different values)
    house = Column(JSON, nullable=True)  # Array of house names
    age = Column(String(50), nullable=True)  # Age can be "5 weeks", "30 days", etc.
    source = Column(JSON, nullable=True)  # Array of source names
    sample_type = Column(JSON, nullable=True)  # Array of sample types (organs)
    samples_number = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    coa_status = Column(String(50), nullable=True, index=True)  # draft, created, need_approval, finalized
    
    # Edit tracking fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    last_edited_by = Column(String(255), nullable=True)
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_units_sample_dept', 'sample_id', 'department_id'),
        Index('ix_units_coa_status', 'coa_status', 'department_id'),
    )
    
    # Relationships
    sample = relationship("Sample", back_populates="units")
    department = relationship("Department", back_populates="units")
    pcr_data = relationship("PCRData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    serology_data = relationship("SerologyData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    microbiology_data = relationship("MicrobiologyData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    pcr_coa = relationship("PCRCOA", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    serology_coa = relationship("SerologyCOA", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    microbiology_coa = relationship("MicrobiologyCOA", back_populates="unit", cascade="all, delete-orphan", uselist=False)
