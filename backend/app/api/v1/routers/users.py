from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from pathlib import Path
from app.db.session import get_db
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.permission import UserPermissionsResponse, UserPermissionsUpdate
from app.services import UserService
from app.repositories.permission_repository import PermissionRepository
from app.api.v1.deps import get_current_user, get_current_admin_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user_service = UserService(db)
    return user_service.get_all_users(skip=skip, limit=limit)


@router.get("/sharing/list", response_model=List[UserResponse])
def get_users_for_sharing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active users for sharing purposes. Available to all authenticated users."""
    user_service = UserService(db)
    all_users = user_service.get_all_users(skip=0, limit=1000)
    # Return only active users
    return [u for u in all_users if u.is_active]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user_service = UserService(db)
    user = user_service.create_user(user_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user_service = UserService(db)
    user = user_service.update_user(user_id, user_data)
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user_service = UserService(db)
    success = user_service.delete_user(user_id)
    
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return {"message": "User deleted successfully"}


@router.get("/{user_id}/permissions", response_model=UserPermissionsResponse)
def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get permissions for a specific user. Users can access their own permissions, admins can access anyone's."""
    # Allow users to access their own permissions, or require admin for others
    if current_user.id != user_id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user's permissions"
        )
    
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    permission_repo = PermissionRepository(db)
    permissions = permission_repo.get_user_permissions(user_id)
    
    # If no permissions exist, create default ones
    if not permissions:
        permissions = permission_repo.create_default_permissions(user_id, user.role.value)
    
    return UserPermissionsResponse(
        user_id=user_id,
        permissions=permissions
    )


@router.put("/{user_id}/permissions", response_model=UserPermissionsResponse)
def update_user_permissions(
    user_id: int,
    permissions_update: UserPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update permissions for a specific user"""
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    permission_repo = PermissionRepository(db)
    
    # Convert permissions to dict format
    permissions_data = [
        {
            'screen_name': perm.screen_name,
            'can_read': perm.can_read,
            'can_write': perm.can_write
        }
        for perm in permissions_update.permissions
    ]
    
    # Set new permissions
    updated_permissions = permission_repo.set_user_permissions(user_id, permissions_data)
    
    return UserPermissionsResponse(
        user_id=user_id,
        permissions=updated_permissions
    )


@router.post("/me/profile-picture", response_model=UserResponse)
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload profile picture for the current user"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, GIF, and WebP images are allowed"
        )
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to start
    
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must not exceed 5MB"
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("backend/uploads/profile_pictures")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename: user_id + original extension
    file_extension = Path(file.filename).suffix
    filename = f"user_{current_user.id}{file_extension}"
    file_path = upload_dir / filename
    
    # Delete old profile picture if it exists
    if current_user.profile_picture:
        # Handle both old path format and new format
        old_path = current_user.profile_picture
        if old_path.startswith('/uploads/'):
            old_file_path = Path("backend" + old_path)
        else:
            old_file_path = Path(old_path)
        if old_file_path.exists():
            old_file_path.unlink()
    
    # Save new file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update user's profile_picture in database with URL path (not filesystem path)
    current_user.profile_picture = f"/uploads/profile_pictures/{filename}"
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.delete("/me/profile-picture", response_model=UserResponse)
def delete_profile_picture(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete profile picture for the current user"""
    if not current_user.profile_picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile picture to delete"
        )
    
    # Delete file from filesystem - handle both path formats
    old_path = current_user.profile_picture
    if old_path.startswith('/uploads/'):
        file_path = Path("backend" + old_path)
    else:
        file_path = Path(old_path)
    if file_path.exists():
        file_path.unlink()
    
    # Update user's profile_picture in database
    current_user.profile_picture = None
    db.commit()
    db.refresh(current_user)
    
    return current_user
