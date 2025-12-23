from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class Unit(Base):
    __tablename__ = "units"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    unit_code = Column(String, unique=True, index=True, nullable=False)
    
    # Unit-specific poultry fields (each unit can have different values)
    house = Column(JSON, nullable=True)  # Array of house names
    age = Column(String, nullable=True)  # Changed from Integer to String
    source = Column(String, nullable=True)
    sample_type = Column(JSON, nullable=True)  # Array of sample types (organs)
    samples_number = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    coa_status = Column(String, nullable=True)  # null, 'created', 'finalized'
    
    # Edit tracking fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    last_edited_by = Column(String, nullable=True)  # Username of last editor
    
    # Relationships
    sample = relationship("Sample", back_populates="units")
    department = relationship("Department", back_populates="units")
    pcr_data = relationship("PCRData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    serology_data = relationship("SerologyData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    microbiology_data = relationship("MicrobiologyData", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    pcr_coa = relationship("PCRCOA", back_populates="unit", cascade="all, delete-orphan", uselist=False)
    microbiology_coa = relationship("MicrobiologyCOA", back_populates="unit", cascade="all, delete-orphan", uselist=False)
