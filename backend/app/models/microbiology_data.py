from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class MicrobiologyData(Base):
    __tablename__ = "microbiology_data"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
    # Microbiology-specific fields
    diseases_list = Column(JSON, nullable=True)  # Array of diseases
    batch_no = Column(String(100), nullable=True)
    fumigation = Column(String(50), nullable=True)  # "Before Fumigation" or "After Fumigation"
    index_list = Column(JSON, nullable=True)  # Dynamic inputs stored as array
    technician_name = Column(String(255), nullable=True)  # Technician who performed the test
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    
    # Relationship
    unit = relationship("Unit", back_populates="microbiology_data")
