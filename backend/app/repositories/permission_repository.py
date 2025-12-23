from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.permission import UserPermission


class PermissionRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_permissions(self, user_id: int) -> List[UserPermission]:
        """Get all permissions for a user"""
        return self.db.query(UserPermission).filter(
            UserPermission.user_id == user_id
        ).all()
    
    def get_user_permission_by_screen(self, user_id: int, screen_name: str) -> Optional[UserPermission]:
        """Get a specific permission for a user and screen"""
        return self.db.query(UserPermission).filter(
            UserPermission.user_id == user_id,
            UserPermission.screen_name == screen_name
        ).first()
    
    def create_permission(self, user_id: int, screen_name: str, can_read: bool, can_write: bool) -> UserPermission:
        """Create a new permission"""
        permission = UserPermission(
            user_id=user_id,
            screen_name=screen_name,
            can_read=can_read,
            can_write=can_write
        )
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission
    
    def update_permission(self, permission: UserPermission, can_read: bool, can_write: bool) -> UserPermission:
        """Update an existing permission"""
        permission.can_read = can_read
        permission.can_write = can_write
        self.db.commit()
        self.db.refresh(permission)
        return permission
    
    def delete_user_permissions(self, user_id: int) -> None:
        """Delete all permissions for a user"""
        self.db.query(UserPermission).filter(
            UserPermission.user_id == user_id
        ).delete()
        self.db.commit()
    
    def set_user_permissions(self, user_id: int, permissions_data: List[dict]) -> List[UserPermission]:
        """Replace all permissions for a user"""
        # Delete existing permissions
        self.delete_user_permissions(user_id)
        
        # Create new permissions
        permissions = []
        for perm_data in permissions_data:
            permission = UserPermission(
                user_id=user_id,
                screen_name=perm_data['screen_name'],
                can_read=perm_data['can_read'],
                can_write=perm_data['can_write']
            )
            self.db.add(permission)
            permissions.append(permission)
        
        self.db.commit()
        for perm in permissions:
            self.db.refresh(perm)
        
        return permissions
    
    def create_default_permissions(self, user_id: int, role: str) -> List[UserPermission]:
        """Create default permissions based on user role"""
        # Define available screens
        screens = [
            "Dashboard",
            "All Samples",
            "Register Sample",
            "PCR Samples",
            "Serology Samples",
            "Microbiology Samples",
            "Database - PCR",
            "Database - Serology",
            "Database - Microbiology",
            "Controls"
        ]
        
        # Define default permissions by role
        permissions_data = []
        for screen in screens:
            if role == "admin":
                # Admin gets full access to everything
                can_read = True
                can_write = True
            elif role == "manager":
                # Manager gets full access to everything
                can_read = True
                can_write = True
            elif role == "technician":
                # Technician gets read/write on samples and COAs, read-only on others
                if screen in ["Register Sample", "PCR Samples", "Serology Samples", "Microbiology Samples"]:
                    can_read = True
                    can_write = True
                elif screen == "Controls":
                    can_read = False
                    can_write = False
                else:
                    can_read = True
                    can_write = False
            elif role == "viewer":
                # Viewer gets read-only access to everything except Controls
                can_read = screen != "Controls"
                can_write = False
            else:
                # Default: no access
                can_read = False
                can_write = False
            
            permissions_data.append({
                'screen_name': screen,
                'can_read': can_read,
                'can_write': can_write
            })
        
        return self.set_user_permissions(user_id, permissions_data)
