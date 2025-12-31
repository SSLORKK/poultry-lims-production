from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class PCRData(Base):
    __tablename__ = "pcr_data"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
    # PCR-specific fields
    diseases_list = Column(JSON, nullable=True)  # Array of {disease, kit_type} objects
    technician_name = Column(String(255), nullable=True)
    extraction_method = Column(String(255), nullable=True)
    extraction = Column(Integer, nullable=True)  # Number of extractions
    detection = Column(Integer, nullable=True)  # Number of detections
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    
    # Relationship
    unit = relationship("Unit", back_populates="pcr_data")
