"""
Drive Admin API Router
Manages user permissions and access control for Drive
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import secrets
from datetime import datetime

from app.db.session import get_db
from app.models.user import User
from app.models.drive import DrivePermission, DriveShareLink, DriveItem
from app.schemas.drive import (
    DrivePermissionCreate, DrivePermissionUpdate, DrivePermissionResponse,
    DrivePermissionWithUser, DriveShareLinkCreate, DriveShareLinkResponse,
    DriveAccessCheckResponse, DriveItemResponse
)
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/drive-admin", tags=["drive-admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for drive management"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage drive permissions"
        )
    return current_user


# ==================== PERMISSION MANAGEMENT ====================

@router.get("/permissions", response_model=List[DrivePermissionWithUser])
def get_all_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all drive permissions with user details"""
    permissions = db.query(DrivePermission).all()
    
    result = []
    for perm in permissions:
        user = db.query(User).filter(User.id == perm.user_id).first()
        result.append({
            "id": perm.id,
            "user_id": perm.user_id,
            "has_access": perm.has_access,
            "permission_level": perm.permission_level,
            "folder_access": perm.folder_access,
            "created_at": perm.created_at,
            "updated_at": perm.updated_at,
            "created_by": perm.created_by,
            "updated_by": perm.updated_by,
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "role": user.role.value if user else None
        })
    
    return result


@router.get("/permissions/users-without-access", response_model=List[dict])
def get_users_without_drive_permission(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all users who don't have a drive permission record yet"""
    # Get all user IDs that have permissions
    users_with_perm = db.query(DrivePermission.user_id).all()
    user_ids_with_perm = [u[0] for u in users_with_perm]
    
    # Get users without permissions
    users = db.query(User).filter(
        User.id.notin_(user_ids_with_perm) if user_ids_with_perm else True,
        User.is_active == True
    ).all()
    
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role.value} for u in users]


@router.post("/permissions", response_model=DrivePermissionResponse)
def create_permission(
    data: DrivePermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new drive permission for a user"""
    # Check if user exists
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if permission already exists
    existing = db.query(DrivePermission).filter(DrivePermission.user_id == data.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Permission already exists for this user")
    
    permission = DrivePermission(
        user_id=data.user_id,
        has_access=data.has_access,
        permission_level=data.permission_level,
        folder_access=data.folder_access,
        created_by=current_user.full_name
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return permission


@router.put("/permissions/{user_id}", response_model=DrivePermissionResponse)
def update_permission(
    user_id: int,
    data: DrivePermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update drive permission for a user"""
    permission = db.query(DrivePermission).filter(DrivePermission.user_id == user_id).first()
    
    if not permission:
        # Create new permission if it doesn't exist
        permission = DrivePermission(
            user_id=user_id,
            has_access=data.has_access if data.has_access is not None else False,
            permission_level=data.permission_level or 'read',
            folder_access=data.folder_access,
            created_by=current_user.full_name
        )
        db.add(permission)
    else:
        # Update existing permission
        if data.has_access is not None:
            permission.has_access = data.has_access
        if data.permission_level is not None:
            permission.permission_level = data.permission_level
        if data.folder_access is not None:
            permission.folder_access = data.folder_access if data.folder_access else None
        permission.updated_by = current_user.full_name
    
    db.commit()
    db.refresh(permission)
    
    return permission


@router.delete("/permissions/{user_id}")
def delete_permission(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete drive permission for a user (removes all access)"""
    permission = db.query(DrivePermission).filter(DrivePermission.user_id == user_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    db.delete(permission)
    db.commit()
    
    return {"message": "Permission deleted successfully"}


# ==================== FOLDER ACCESS MANAGEMENT ====================

@router.get("/folders", response_model=List[DriveItemResponse])
def get_all_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all folders for permission assignment"""
    folders = db.query(DriveItem).filter(
        DriveItem.type == "folder",
        DriveItem.is_deleted == False
    ).order_by(DriveItem.name).all()
    
    return folders


# ==================== SHARE LINK MANAGEMENT ====================

@router.get("/share-links", response_model=List[DriveShareLinkResponse])
def get_all_share_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all share links"""
    links = db.query(DriveShareLink).order_by(DriveShareLink.created_at.desc()).all()
    return links


@router.post("/share-links", response_model=DriveShareLinkResponse)
def create_share_link(
    data: DriveShareLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new share link for a drive item"""
    # Check if item exists
    item = db.query(DriveItem).filter(DriveItem.id == data.drive_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Drive item not found")
    
    # Generate unique token
    share_token = secrets.token_urlsafe(32)
    
    link = DriveShareLink(
        drive_item_id=data.drive_item_id,
        share_token=share_token,
        is_public=data.is_public,
        requires_login=data.requires_login,
        allowed_users=data.allowed_users,
        expires_at=data.expires_at,
        created_by=current_user.full_name
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    
    return link


@router.delete("/share-links/{link_id}")
def delete_share_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a share link"""
    link = db.query(DriveShareLink).filter(DriveShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    db.delete(link)
    db.commit()
    
    return {"message": "Share link deleted successfully"}


# ==================== ACCESS VERIFICATION ====================

@router.get("/check-access/{item_id}", response_model=DriveAccessCheckResponse)
def check_user_access(
    item_id: int,
    user_id: Optional[int] = None,
    share_token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if a user has access to a specific drive item.
    Used for link sharing security verification.
    """
    # Get the item
    item = db.query(DriveItem).filter(DriveItem.id == item_id).first()
    if not item:
        return DriveAccessCheckResponse(has_access=False, reason="Item not found")
    
    # If checking with share token
    if share_token:
        link = db.query(DriveShareLink).filter(DriveShareLink.share_token == share_token).first()
        if not link:
            return DriveAccessCheckResponse(has_access=False, reason="Invalid share link")
        
        # Check expiration
        if link.expires_at and link.expires_at < datetime.utcnow():
            return DriveAccessCheckResponse(has_access=False, reason="Share link has expired")
        
        # Check if public
        if link.is_public:
            return DriveAccessCheckResponse(has_access=True, reason="Public link", permission_level="read")
        
        # Check if login required and user is logged in
        if link.requires_login and not current_user:
            return DriveAccessCheckResponse(has_access=False, reason="Login required")
        
        # Check if user is in allowed list
        if link.allowed_users and current_user.id not in link.allowed_users:
            return DriveAccessCheckResponse(has_access=False, reason="User not in allowed list")
        
        # Update link access tracking
        link.view_count += 1
        link.last_accessed_at = datetime.utcnow()
        link.last_accessed_by = current_user.full_name if current_user else "anonymous"
        db.commit()
        
        return DriveAccessCheckResponse(has_access=True, reason="Valid share link", permission_level="read")
    
    # Check user's drive permission
    check_user_id = user_id or current_user.id
    
    # Admins have full access
    user = db.query(User).filter(User.id == check_user_id).first()
    if user and user.role == "admin":
        return DriveAccessCheckResponse(has_access=True, reason="Admin access", permission_level="admin")
    
    permission = db.query(DrivePermission).filter(DrivePermission.user_id == check_user_id).first()
    
    if not permission or not permission.has_access:
        return DriveAccessCheckResponse(has_access=False, reason="No drive access permission")
    
    # Check folder-level access
    if permission.folder_access:
        # Get the folder chain for the item
        folder_ids = []
        current_item = item
        while current_item:
            if current_item.type == "folder":
                folder_ids.append(current_item.id)
            if current_item.parent_id:
                current_item = db.query(DriveItem).filter(DriveItem.id == current_item.parent_id).first()
            else:
                break
        
        # Check if any folder in the chain is in the allowed list
        if not any(fid in permission.folder_access for fid in folder_ids):
            return DriveAccessCheckResponse(has_access=False, reason="No access to this folder")
    
    return DriveAccessCheckResponse(
        has_access=True, 
        reason="Has permission", 
        permission_level=permission.permission_level
    )


@router.get("/verify-share/{share_token}", response_model=DriveAccessCheckResponse)
def verify_share_link(
    share_token: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Verify if a share link is valid and if the current user can access it.
    This endpoint is called when someone opens a shared link.
    """
    link = db.query(DriveShareLink).filter(DriveShareLink.share_token == share_token).first()
    
    if not link:
        return DriveAccessCheckResponse(has_access=False, reason="Invalid or expired share link")
    
    # Check expiration
    if link.expires_at and link.expires_at < datetime.utcnow():
        return DriveAccessCheckResponse(has_access=False, reason="Share link has expired")
    
    # Check if public
    if link.is_public:
        # Update tracking
        link.view_count += 1
        link.last_accessed_at = datetime.utcnow()
        link.last_accessed_by = current_user.full_name if current_user else "anonymous"
        db.commit()
        return DriveAccessCheckResponse(has_access=True, reason="Public access", permission_level="read")
    
    # Check if login required
    if link.requires_login and not current_user:
        return DriveAccessCheckResponse(has_access=False, reason="Please log in to access this file")
    
    # Check if user is in allowed list
    if link.allowed_users:
        if not current_user or current_user.id not in link.allowed_users:
            return DriveAccessCheckResponse(has_access=False, reason="You don't have permission to access this file")
    
    # Update tracking
    link.view_count += 1
    link.last_accessed_at = datetime.utcnow()
    link.last_accessed_by = current_user.full_name if current_user else "anonymous"
    db.commit()
    
    return DriveAccessCheckResponse(has_access=True, reason="Access granted", permission_level="read")
