from pydantic import BaseModel
from typing import List


class PermissionBase(BaseModel):
    screen_name: str
    can_read: bool = False
    can_write: bool = False


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True


class UserPermissionsResponse(BaseModel):
    user_id: int
    permissions: List[PermissionResponse]


class UserPermissionsUpdate(BaseModel):
    permissions: List[PermissionBase]
