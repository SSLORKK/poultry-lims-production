from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class MicrobiologyData(Base):
    __tablename__ = "microbiology_data"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True)
    
    # Microbiology-specific fields
    diseases_list = Column(JSON, nullable=True)  # Array of diseases
    batch_no = Column(String, nullable=True)
    fumigation = Column(String, nullable=True)  # "Before Fumigation" or "After Fumigation"
    index_list = Column(JSON, nullable=True)  # Dynamic inputs stored as array
    technician_name = Column(String, nullable=True)  # Technician who performed the test
    
    # Relationship
    unit = relationship("Unit", back_populates="microbiology_data")
