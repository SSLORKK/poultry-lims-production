from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, BigInteger, Table, JSON, Index, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base
import enum


class DriveItemType(str, enum.Enum):
    """Enum for drive item type to ensure data integrity"""
    folder = "folder"
    file = "file"


# Association table for folder sharing (many-to-many)
drive_item_shares = Table(
    'drive_item_shares',
    Base.metadata,
    Column('drive_item_id', Integer, ForeignKey('drive_items.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('permission', String, default='read'),  # 'read', 'write', 'admin'
    Column('shared_at', DateTime, default=datetime.utcnow),
    Column('shared_by', String, nullable=True)
)


class DrivePermission(Base):
    """
    Manages user-level access permissions to Drive.
    Each user can have:
    - has_access: Boolean to enable/disable Drive access entirely
    - permission_level: 'read', 'write', or 'admin'
    - folder_access: JSON array of folder IDs the user can access (null = all folders)
    """
    __tablename__ = "drive_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Access control
    has_access = Column(Boolean, default=False, nullable=False)
    permission_level = Column(String(20), default='read', nullable=False)  # 'read', 'write', 'admin'
    
    # Folder-level access (null = all folders, array of IDs = specific folders only)
    folder_access = Column(JSON, nullable=True)  # [1, 2, 3] or null for all
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    
    # Relationship
    user = relationship("User", backref="drive_permission")
    
    def __repr__(self):
        return f"<DrivePermission(user_id={self.user_id}, has_access={self.has_access}, level='{self.permission_level}')>"


class DriveShareLink(Base):
    """
    Manages shareable links for Drive items.
    When a link is shared, this table tracks who can access it.
    """
    __tablename__ = "drive_share_links"

    id = Column(Integer, primary_key=True, index=True)
    drive_item_id = Column(Integer, ForeignKey("drive_items.id"), nullable=False, index=True)
    
    # Unique share token for the link
    share_token = Column(String(64), unique=True, nullable=False, index=True)
    
    # Access control
    is_public = Column(Boolean, default=False, nullable=False)  # If true, anyone can access
    requires_login = Column(Boolean, default=True, nullable=False)  # If true, user must be logged in
    allowed_users = Column(JSON, nullable=True)  # Specific user IDs that can access
    
    # Expiration
    expires_at = Column(DateTime, nullable=True)  # Null = never expires
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)
    
    # Usage tracking
    view_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime, nullable=True)
    last_accessed_by = Column(String(255), nullable=True)
    
    # Relationship
    drive_item = relationship("DriveItem", backref="share_links")
    
    def __repr__(self):
        return f"<DriveShareLink(id={self.id}, token='{self.share_token[:8]}...', item_id={self.drive_item_id})>"


class DriveItem(Base):
    __tablename__ = "drive_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False, index=True)  # Support long file names, indexed for search
    type = Column(String(50), nullable=False, index=True)  # 'folder' or 'file'
    mime_type = Column(String(255), nullable=True, index=True)  # For files: 'application/pdf', 'image/png', etc.
    size = Column(BigInteger, nullable=True)  # File size in bytes - BigInteger for large files (up to 9 exabytes)
    path = Column(String(1000), nullable=True)  # Storage path for files - longer path support
    parent_id = Column(Integer, ForeignKey("drive_items.id"), nullable=True, index=True)  # Indexed for faster queries
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    created_by = Column(String(255), nullable=True, index=True)
    updated_by = Column(String(255), nullable=True)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(255), nullable=True)
    
    # Description/notes
    description = Column(Text, nullable=True)
    
    # Sharing - JSON array of shared user IDs or 'public'
    is_public = Column(Boolean, default=False, index=True)
    shared_with = Column(Text, nullable=True)  # JSON array: ["user1", "user2"]
    
    # Self-referential relationship for folder hierarchy
    parent = relationship("DriveItem", remote_side=[id], backref="children")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_drive_items_parent_deleted', 'parent_id', 'is_deleted'),
        Index('ix_drive_items_parent_type', 'parent_id', 'type'),
        Index('ix_drive_items_name_search', 'name', 'is_deleted'),
    )
    
    def __repr__(self):
        return f"<DriveItem(id={self.id}, name='{self.name}', type='{self.type}')>"
