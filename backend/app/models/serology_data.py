from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class SerologyData(Base):
    __tablename__ = "serology_data"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
    # Serology-specific fields
    diseases_list = Column(JSON, nullable=True)  # Array of diseases
    kit_type = Column(String(255), nullable=True)
    number_of_wells = Column(Integer, nullable=True)
    tests_count = Column(Integer, nullable=True)
    technician_name = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    
    # Relationship
    unit = relationship("Unit", back_populates="serology_data")
