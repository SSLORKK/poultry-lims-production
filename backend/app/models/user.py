from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base
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
    
    # Relationship to permissions
    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
