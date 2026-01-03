from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


# Valid permission levels for Drive
VALID_PERMISSION_LEVELS = ['read', 'write', 'admin']


def validate_permission_level(value: str) -> str:
    """
    Validate that permission_level is one of: read, write, admin
    """
    if value not in VALID_PERMISSION_LEVELS:
        raise ValueError(f"permission_level must be one of: {', '.join(VALID_PERMISSION_LEVELS)}")
    return value


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
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    original_parent_id: Optional[int] = None
    
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
    was_renamed: bool = False
    replaced_existing: bool = False
    
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


# Drive Permission Schemas
class DrivePermissionBase(BaseModel):
    has_access: bool = False
    permission_level: str = 'read'  # 'read', 'write', 'admin'
    folder_access: Optional[List[int]] = None  # null = all folders
    
    @field_validator('permission_level')
    @classmethod
    def validate_permission_level_field(cls, v: str) -> str:
        """Validate permission_level is valid"""
        return validate_permission_level(v)


class DrivePermissionCreate(DrivePermissionBase):
    user_id: int


class DrivePermissionUpdate(BaseModel):
    has_access: Optional[bool] = None
    permission_level: Optional[str] = None
    folder_access: Optional[List[int]] = None
    
    @field_validator('permission_level')
    @classmethod
    def validate_permission_level_field(cls, v: Optional[str]) -> Optional[str]:
        """Validate permission_level is valid (if provided)"""
        if v is None:
            return v
        return validate_permission_level(v)


class DrivePermissionResponse(DrivePermissionBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class DrivePermissionWithUser(DrivePermissionResponse):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    
    class Config:
        from_attributes = True


# Drive Share Link Schemas
class DriveShareLinkCreate(BaseModel):
    drive_item_id: int
    is_public: bool = False
    requires_login: bool = True
    allowed_users: Optional[List[int]] = None
    expires_at: Optional[datetime] = None


class DriveShareLinkResponse(BaseModel):
    id: int
    drive_item_id: int
    share_token: str
    is_public: bool
    requires_login: bool
    allowed_users: Optional[List[int]] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    view_count: int = 0
    last_accessed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DriveAccessCheckResponse(BaseModel):
    has_access: bool
    reason: Optional[str] = None
    permission_level: Optional[str] = None
