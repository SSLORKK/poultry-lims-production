from sqlalchemy import Column, Integer, String, Enum, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    technician = "technician"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.technician, nullable=False)
    profile_picture = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Account lockout fields for brute force protection
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_failed_login = Column(DateTime, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Relationship to permissions
    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
    
    def is_locked(self) -> bool:
        """Check if account is currently locked"""
        if self.locked_until is None:
            return False
        return datetime.utcnow() < self.locked_until
    
    def reset_lockout(self):
        """Reset lockout counters on successful login"""
        self.failed_login_attempts = 0
        self.locked_until = None
        self.last_failed_login = None
        self.last_login = datetime.utcnow()
