from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class MicrobiologyCOA(Base):
    __tablename__ = "microbiology_coas"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True)
    
    # Test results stored as JSON: { disease: { index: result } }
    test_results = Column(JSON, nullable=True)
    
    # Test portions for Salmonella: { disease: { index: portion } }
    test_portions = Column(JSON, nullable=True)
    
    # Test report numbers for each disease: { disease: report_number }
    test_report_numbers = Column(JSON, nullable=True)

    # Extended Microbiology Data
    test_methods = Column(JSON, nullable=True)
    isolate_types = Column(JSON, nullable=True)
    test_ranges = Column(JSON, nullable=True)
    
    # Metadata
    
    # Metadata
    date_tested = Column(String, nullable=True)
    tested_by = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)
    lab_supervisor = Column(String, nullable=True)
    lab_manager = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="draft")  # draft, need_approval, completed
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    unit = relationship("Unit", back_populates="microbiology_coa")
