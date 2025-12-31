from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON, Date, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class PCRCOA(Base):
    __tablename__ = "pcr_coa"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, unique=True, index=True)
    
    # COA specific fields
    test_results = Column(JSON, nullable=True)  # Structure: {disease: {sample_type: result}}
    date_tested = Column(Date, nullable=True, index=True)
    tested_by = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    lab_supervisor = Column(String(255), nullable=True)
    lab_manager = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="draft", index=True)  # draft, need_approval, finalized
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Composite index for common queries
    __table_args__ = (
        Index('ix_pcr_coa_status_date', 'status', 'date_tested'),
    )
    
    # Relationship
    unit = relationship("Unit", back_populates="pcr_coa")
