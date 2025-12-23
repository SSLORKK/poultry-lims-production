from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class Counter(Base):
    __tablename__ = "counters"
    
    id = Column(Integer, primary_key=True, index=True)
    counter_type = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    year = Column(Integer, nullable=False)
    current_value = Column(Integer, default=0, nullable=False)
    
    department = relationship("Department", back_populates="counters")
