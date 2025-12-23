from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime
from app.db.base import Base


class EditHistory(Base):
    __tablename__ = "edit_history"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # 'sample' or 'unit'
    entity_id = Column(Integer, nullable=False, index=True)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    edited_by = Column(String, nullable=False)
    edited_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Additional context
    sample_code = Column(String, nullable=True, index=True)  # For quick reference
    unit_code = Column(String, nullable=True, index=True)  # For quick reference
