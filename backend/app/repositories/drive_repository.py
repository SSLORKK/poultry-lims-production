from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from app.models.drive import DriveItem


class DriveRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, item: DriveItem) -> DriveItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_by_id(self, item_id: int) -> Optional[DriveItem]:
        return self.db.query(DriveItem).filter(
            and_(DriveItem.id == item_id, DriveItem.is_deleted == False)
        ).first()

    def get_all(self, parent_id: Optional[int] = None) -> List[DriveItem]:
        query = self.db.query(DriveItem).filter(DriveItem.is_deleted == False)
        if parent_id is None:
            query = query.filter(DriveItem.parent_id == None)
        else:
            query = query.filter(DriveItem.parent_id == parent_id)
        return query.order_by(DriveItem.type.desc(), DriveItem.name).all()

    def get_folders(self, parent_id: Optional[int] = None) -> List[DriveItem]:
        query = self.db.query(DriveItem).filter(
            and_(DriveItem.is_deleted == False, DriveItem.type == "folder")
        )
        if parent_id is None:
            query = query.filter(DriveItem.parent_id == None)
        else:
            query = query.filter(DriveItem.parent_id == parent_id)
        return query.order_by(DriveItem.name).all()

    def get_files(self, parent_id: Optional[int] = None) -> List[DriveItem]:
        query = self.db.query(DriveItem).filter(
            and_(DriveItem.is_deleted == False, DriveItem.type == "file")
        )
        if parent_id is None:
            query = query.filter(DriveItem.parent_id == None)
        else:
            query = query.filter(DriveItem.parent_id == parent_id)
        return query.order_by(DriveItem.name).all()

    def update(self, item: DriveItem) -> DriveItem:
        self.db.commit()
        self.db.refresh(item)
        return item

    def soft_delete(self, item: DriveItem, deleted_by: str) -> DriveItem:
        from datetime import datetime
        # Store original parent for restore functionality
        item.original_parent_id = item.parent_id
        item.is_deleted = True
        item.deleted_at = datetime.utcnow()
        item.deleted_by = deleted_by
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_deleted_items(self, parent_id: Optional[int] = None) -> List[DriveItem]:
        """Get deleted items (recycle bin) - optionally filtered by original parent"""
        query = self.db.query(DriveItem).filter(DriveItem.is_deleted == True)
        if parent_id is not None:
            query = query.filter(DriveItem.original_parent_id == parent_id)
        return query.order_by(DriveItem.deleted_at.desc()).all()

    def get_all_deleted_items(self) -> List[DriveItem]:
        """Get all deleted items for recycle bin"""
        return self.db.query(DriveItem).filter(
            DriveItem.is_deleted == True
        ).order_by(DriveItem.deleted_at.desc()).all()

    def restore_item(self, item: DriveItem, restored_by: str) -> DriveItem:
        """Restore a deleted item from recycle bin"""
        from datetime import datetime
        item.is_deleted = False
        item.parent_id = item.original_parent_id
        item.original_parent_id = None
        item.deleted_at = None
        item.deleted_by = None
        item.updated_at = datetime.utcnow()
        item.updated_by = restored_by
        self.db.commit()
        self.db.refresh(item)
        return item

    def search_deleted(self, query: str) -> List[DriveItem]:
        """Search deleted items in recycle bin"""
        return self.db.query(DriveItem).filter(
            and_(
                DriveItem.is_deleted == True,
                DriveItem.name.ilike(f"%{query}%")
            )
        ).order_by(DriveItem.deleted_at.desc()).all()

    def hard_delete(self, item: DriveItem) -> bool:
        self.db.delete(item)
        self.db.commit()
        return True

    def get_breadcrumbs(self, item_id: int) -> List[DriveItem]:
        breadcrumbs = []
        current = self.get_by_id(item_id)
        while current:
            breadcrumbs.insert(0, current)
            if current.parent_id:
                current = self.get_by_id(current.parent_id)
            else:
                break
        return breadcrumbs

    def get_by_name(self, name: str, parent_id: Optional[int] = None) -> Optional[DriveItem]:
        """Get an item by name within a specific folder"""
        query = self.db.query(DriveItem).filter(
            and_(
                DriveItem.name == name,
                DriveItem.parent_id == parent_id,
                DriveItem.is_deleted == False
            )
        )
        return query.first()

    def search(self, query: str) -> List[DriveItem]:
        return self.db.query(DriveItem).filter(
            and_(
                DriveItem.is_deleted == False,
                DriveItem.name.ilike(f"%{query}%")
            )
        ).order_by(DriveItem.type.desc(), DriveItem.name).all()

    def find_folder_by_name(self, name: str, parent_id: Optional[int]) -> Optional[DriveItem]:
        """Find a folder by name and parent_id."""
        query = self.db.query(DriveItem).filter(
            and_(
                DriveItem.is_deleted == False,
                DriveItem.type == "folder",
                DriveItem.name == name
            )
        )
        if parent_id is None:
            query = query.filter(DriveItem.parent_id == None)
        else:
            query = query.filter(DriveItem.parent_id == parent_id)
        return query.first()
