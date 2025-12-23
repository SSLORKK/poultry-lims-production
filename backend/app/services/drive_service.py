from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from datetime import datetime

from app.models.drive import DriveItem
from app.repositories.drive_repository import DriveRepository
from app.schemas.drive import DriveItemCreate, DriveItemUpdate, DriveBreadcrumb, DriveContentsResponse


class DriveService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = DriveRepository(db)
        self.upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "drive")
        os.makedirs(self.upload_dir, exist_ok=True)

    def create_folder(self, data: DriveItemCreate, created_by: str) -> DriveItem:
        folder = DriveItem(
            name=data.name,
            type="folder",
            parent_id=data.parent_id,
            description=data.description,
            created_by=created_by,
            updated_by=created_by
        )
        return self.repository.create(folder)

    def upload_file(self, file_name: str, file_content: bytes, mime_type: str, 
                    parent_id: Optional[int], created_by: str) -> DriveItem:
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c for c in file_name if c.isalnum() or c in "._-")
        unique_name = f"{timestamp}_{safe_name}"
        
        # Create folder structure based on parent
        folder_path = self.upload_dir
        if parent_id:
            folder_path = os.path.join(self.upload_dir, str(parent_id))
        os.makedirs(folder_path, exist_ok=True)
        
        # Save file
        file_path = os.path.join(folder_path, unique_name)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Create database record
        file_item = DriveItem(
            name=file_name,
            type="file",
            mime_type=mime_type,
            size=len(file_content),
            path=file_path,
            parent_id=parent_id,
            created_by=created_by,
            updated_by=created_by
        )
        return self.repository.create(file_item)

    def get_item(self, item_id: int) -> Optional[DriveItem]:
        return self.repository.get_by_id(item_id)

    def get_folder_contents(self, folder_id: Optional[int] = None) -> DriveContentsResponse:
        items = self.repository.get_all(folder_id)
        
        current_folder = None
        breadcrumbs = []
        
        if folder_id:
            current_folder = self.repository.get_by_id(folder_id)
            if current_folder:
                breadcrumb_items = self.repository.get_breadcrumbs(folder_id)
                breadcrumbs = [DriveBreadcrumb(id=item.id, name=item.name) for item in breadcrumb_items]
        
        return DriveContentsResponse(
            current_folder=current_folder,
            breadcrumbs=breadcrumbs,
            items=items,
            total_items=len(items)
        )

    def update_item(self, item_id: int, data: DriveItemUpdate, updated_by: str) -> Optional[DriveItem]:
        item = self.repository.get_by_id(item_id)
        if not item:
            return None
        
        if data.name is not None:
            item.name = data.name
        if data.description is not None:
            item.description = data.description
        if data.parent_id is not None:
            item.parent_id = data.parent_id
        
        item.updated_by = updated_by
        item.updated_at = datetime.utcnow()
        
        return self.repository.update(item)

    def delete_item(self, item_id: int, deleted_by: str) -> bool:
        item = self.repository.get_by_id(item_id)
        if not item:
            return False
        
        # Soft delete
        self.repository.soft_delete(item, deleted_by)
        return True

    def get_file_path(self, item_id: int) -> Optional[str]:
        item = self.repository.get_by_id(item_id)
        if item and item.type == "file" and item.path:
            return item.path
        return None

    def search(self, query: str) -> List[DriveItem]:
        return self.repository.search(query)

    def move_item(self, item_id: int, new_parent_id: Optional[int], updated_by: str) -> Optional[DriveItem]:
        item = self.repository.get_by_id(item_id)
        if not item:
            return None
        
        # Prevent moving a folder into itself or its descendants
        if item.type == "folder" and new_parent_id:
            if item_id == new_parent_id:
                return None
            breadcrumbs = self.repository.get_breadcrumbs(new_parent_id)
            if any(b.id == item_id for b in breadcrumbs):
                return None
        
        item.parent_id = new_parent_id
        item.updated_by = updated_by
        item.updated_at = datetime.utcnow()
        
        return self.repository.update(item)

    def find_or_create_folder(self, name: str, parent_id: Optional[int], created_by: str) -> DriveItem:
        """Find existing folder by name and parent, or create new one."""
        existing = self.repository.find_folder_by_name(name, parent_id)
        if existing:
            return existing
        
        folder = DriveItem(
            name=name,
            type="folder",
            parent_id=parent_id,
            created_by=created_by,
            updated_by=created_by
        )
        return self.repository.create(folder)
