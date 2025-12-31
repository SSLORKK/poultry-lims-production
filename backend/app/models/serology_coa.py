from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Date, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class SerologyCOA(Base):
    """
    Certificate of Analysis for Serology tests.
    Mirrors the structure of PCRCOA and MicrobiologyCOA for consistency.
    """
    __tablename__ = "serology_coas"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
    # Test results stored as JSON: { disease: { well_number: result } }
    test_results = Column(JSON, nullable=True)
    
    # Well-level data: { disease: { well_number: { titer, interpretation, etc } } }
    well_data = Column(JSON, nullable=True)
    
    # Test report numbers for each disease: { disease: report_number }
    test_report_numbers = Column(JSON, nullable=True)
    
    # Test methods per disease: { disease: method }
    test_methods = Column(JSON, nullable=True)
    
    # Kit information per disease: { disease: kit_type }
    kit_types = Column(JSON, nullable=True)
    
    # Metadata
    date_tested = Column(Date, nullable=True)
    tested_by = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    lab_supervisor = Column(String(255), nullable=True)
    lab_manager = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="draft")  # draft, need_approval, completed
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    unit = relationship("Unit", back_populates="serology_coa")
    
    def __repr__(self):
        return f"<SerologyCOA(id={self.id}, unit_id={self.unit_id}, status='{self.status}')>"
