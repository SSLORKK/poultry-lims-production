from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Date, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class MicrobiologyCOA(Base):
    __tablename__ = "microbiology_coas"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
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
    
    # Hidden indexes per disease: { disease: [index1, index2, ...] }
    hidden_indexes = Column(JSON, nullable=True)
    
    # AST (Antimicrobial Susceptibility Testing) data
    # Structure: { bacterial_isolate: string, organ: string, ast_results: [{ disk: string, mic: string, interpretation: { r: string, i: string, s: string } }] }
    ast_data = Column(JSON, nullable=True)
    
    # Metadata
    date_tested = Column(Date, nullable=True, index=True)  # Fixed: Changed from String to Date
    tested_by = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    lab_supervisor = Column(String(255), nullable=True)
    lab_manager = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)  # Fixed: Changed from String to Text for longer notes
    status = Column(String(50), default="draft", index=True)  # draft, need_approval, completed
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Composite index for common queries
    __table_args__ = (
        Index('ix_microbiology_coas_status_date', 'status', 'date_tested'),
    )
    
    # Relationships
    unit = relationship("Unit", back_populates="microbiology_coa")
