from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DriveItemBase(BaseModel):
    name: str
    description: Optional[str] = None


class DriveItemCreate(DriveItemBase):
    parent_id: Optional[int] = None
    type: str = "folder"  # 'folder' or 'file'


class DriveItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None


class DriveItemResponse(DriveItemBase):
    id: int
    type: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    path: Optional[str] = None
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_deleted: bool = False
    
    class Config:
        from_attributes = True


class DriveItemWithChildren(DriveItemResponse):
    children: List["DriveItemResponse"] = []
    
    class Config:
        from_attributes = True


class DriveUploadResponse(BaseModel):
    id: int
    name: str
    type: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    path: Optional[str] = None
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class DriveBreadcrumb(BaseModel):
    id: int
    name: str


class DriveContentsResponse(BaseModel):
    current_folder: Optional[DriveItemResponse] = None
    breadcrumbs: List[DriveBreadcrumb] = []
    items: List[DriveItemResponse] = []
    total_items: int = 0
