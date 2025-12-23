from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON, Date
from sqlalchemy.orm import relationship
from app.db.base import Base


class PCRCOA(Base):
    __tablename__ = "pcr_coa"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True)
    
    # COA specific fields
    test_results = Column(JSON, nullable=True)  # Structure: {disease: {sample_type: result}}
    date_tested = Column(Date, nullable=True)
    tested_by = Column(String, nullable=True)  # Technician name
    reviewed_by = Column(String, nullable=True)
    lab_supervisor = Column(String, nullable=True)
    lab_manager = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="draft")  # draft, finalized
    
    # Relationship
    unit = relationship("Unit", back_populates="pcr_coa")
