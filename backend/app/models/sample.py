from sqlalchemy import Column, Integer, String, DateTime, Date, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class Sample(Base):
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String, unique=True, index=True, nullable=False)
    year = Column(Integer, nullable=False, index=True)
    
    # Sample-level poultry fields (shared across all units)
    date_received = Column(Date, nullable=False)
    company = Column(String, nullable=False)
    farm = Column(String, nullable=False)
    cycle = Column(String, nullable=True)
    flock = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_edited_by = Column(String, nullable=True)  # Username of last editor
    
    # Relationships
    units = relationship("Unit", back_populates="sample", cascade="all, delete-orphan")
