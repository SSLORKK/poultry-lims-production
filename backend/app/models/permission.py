from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserPermission(Base):
    __tablename__ = "user_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    screen_name = Column(String, nullable=False, index=True)
    can_read = Column(Boolean, default=False, nullable=False)
    can_write = Column(Boolean, default=False, nullable=False)
    
    # Composite index for faster permission lookups
    __table_args__ = (
        Index('ix_user_permissions_user_screen', 'user_id', 'screen_name'),
    )
    
    # Relationship to user
    user = relationship("User", back_populates="permissions")
