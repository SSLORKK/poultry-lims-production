from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, Callable
from datetime import datetime
from app.db.session import get_db
from app.core.security import decode_access_token
from app.services import UserService
from app.models.user import User, UserRole
from app.models.drive import DrivePermission

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    username = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user_service = UserService(db)
    user = user_service.get_user_by_username(username)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin access required."
        )
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication - returns None if user is not authenticated.
    Used for public endpoints that may have different behavior for logged-in users.
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            return None
        
        username = payload.get("sub")
        if username is None:
            return None
        
        user_service = UserService(db)
        user = user_service.get_user_by_username(username)
        return user
    except Exception:
        return None


# Permission level hierarchy for Drive
DRIVE_PERMISSION_LEVELS = {
    'read': 0,
    'write': 1,
    'admin': 2
}


def check_drive_permission(
    required_level: str = 'read',
    check_folder: bool = False
) -> Callable:
    """
    Dependency factory to check Drive permissions.
    
    Args:
        required_level: Minimum permission level ('read', 'write', 'admin')
        check_folder: If True, also validates folder-level access
    
    Usage:
        @router.get("/contents")
        def get_contents(
            current_user: User = Depends(check_drive_permission('read'))
        ):
            ...
    """
    async def permission_checker(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Admins bypass all Drive permission checks
        if current_user.role == UserRole.admin:
            return current_user
        
        # Get user's Drive permission
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        # Check if user has Drive access
        if not permission or not permission.has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to Drive. Please contact your administrator."
            )
        
        # Check permission level hierarchy
        user_level = DRIVE_PERMISSION_LEVELS.get(permission.permission_level, 0)
        required_level_value = DRIVE_PERMISSION_LEVELS.get(required_level, 0)
        
        if user_level < required_level_value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This operation requires '{required_level}' permission. You have '{permission.permission_level}'."
            )
        
        return current_user
    
    return permission_checker


def check_drive_folder_access(
    required_level: str = 'read'
) -> Callable:
    """
    Dependency factory to check Drive folder-level permissions.
    
    Args:
        required_level: Minimum permission level ('read', 'write', 'admin')
    
    Usage:
        @router.get("/contents")
        def get_contents(
            folder_id: Optional[int] = None,
            current_user: User = Depends(check_drive_folder_access('read')),
            db: Session = Depends(get_db)
        ):
            ...
    """
    async def permission_checker(
        folder_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Admins bypass all Drive permission checks
        if current_user.role == UserRole.admin:
            return current_user
        
        # Get user's Drive permission
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        # Check if user has Drive access
        if not permission or not permission.has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to Drive. Please contact your administrator."
            )
        
        # Check permission level hierarchy
        user_level = DRIVE_PERMISSION_LEVELS.get(permission.permission_level, 0)
        required_level_value = DRIVE_PERMISSION_LEVELS.get(required_level, 0)
        
        if user_level < required_level_value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This operation requires '{required_level}' permission. You have '{permission.permission_level}'."
            )
        
        # Check folder-level access if folder_access is specified
        if permission.folder_access is not None and folder_id is not None:
            # User has folder restrictions - check if folder_id is in allowed list
            if folder_id not in permission.folder_access:
                # Also check if any parent folder is in allowed list
                from app.models.drive import DriveItem
                current_folder = db.query(DriveItem).filter(DriveItem.id == folder_id).first()
                
                has_access = False
                while current_folder:
                    if current_folder.id in permission.folder_access:
                        has_access = True
                        break
                    if current_folder.parent_id:
                        current_folder = db.query(DriveItem).filter(
                            DriveItem.id == current_folder.parent_id
                        ).first()
                    else:
                        break
                
                if not has_access:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have access to this folder."
                    )
        
        return current_user
    
    return permission_checker
