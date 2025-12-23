from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class PCRData(Base):
    __tablename__ = "pcr_data"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True)
    
    # PCR-specific fields
    diseases_list = Column(JSON, nullable=True)  # Array of {disease, kit_type} objects
    kit_type = Column(String, nullable=True)  # Deprecated, kept for compatibility
    technician_name = Column(String, nullable=True)
    extraction_method = Column(String, nullable=True)
    extraction = Column(Integer, nullable=True)  # Number of extractions
    detection = Column(Integer, nullable=True)  # Number of detections
    
    # Relationship
    unit = relationship("Unit", back_populates="pcr_data")
