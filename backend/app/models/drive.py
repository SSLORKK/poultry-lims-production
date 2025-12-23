from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, BigInteger, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


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


class DriveItem(Base):
    __tablename__ = "drive_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False)  # Support long file names
    type = Column(String(50), nullable=False)  # 'folder' or 'file'
    mime_type = Column(String(255), nullable=True)  # For files: 'application/pdf', 'image/png', etc.
    size = Column(BigInteger, nullable=True)  # File size in bytes - BigInteger for large files (up to 9 exabytes)
    path = Column(String(1000), nullable=True)  # Storage path for files - longer path support
    parent_id = Column(Integer, ForeignKey("drive_items.id"), nullable=True, index=True)  # Indexed for faster queries
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(255), nullable=True)
    
    # Description/notes
    description = Column(Text, nullable=True)
    
    # Sharing - JSON array of shared user IDs or 'public'
    is_public = Column(Boolean, default=False)
    shared_with = Column(Text, nullable=True)  # JSON array: ["user1", "user2"]
    
    # Self-referential relationship for folder hierarchy
    parent = relationship("DriveItem", remote_side=[id], backref="children")
    
    # Index for common queries
    __table_args__ = (
        # Composite index for folder listing
        # Index('ix_drive_items_parent_deleted', 'parent_id', 'is_deleted'),
    )
    
    def __repr__(self):
        return f"<DriveItem(id={self.id}, name='{self.name}', type='{self.type}')>"
