from sqlalchemy import Column, Integer, String, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base


class Counter(Base):
    __tablename__ = "counters"
    
    id = Column(Integer, primary_key=True, index=True)
    counter_type = Column(String, nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    current_value = Column(Integer, default=0, nullable=False)
    
    # Composite index and unique constraint for counter lookups
    __table_args__ = (
        Index('ix_counters_type_dept_year', 'counter_type', 'department_id', 'year'),
        UniqueConstraint('counter_type', 'department_id', 'year', name='uq_counters_type_dept_year'),
    )
    
    department = relationship("Department", back_populates="counters")
