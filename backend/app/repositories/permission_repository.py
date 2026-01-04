from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.permission import UserPermission
from app.models.drive import DrivePermission


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
    
    def sync_drive_permission(self, user_id: int, can_read: bool, can_write: bool) -> None:
        """
        Sync Drive screen permission with DrivePermission table.
        When Drive permission is granted via UserPermission, also create/update DrivePermission.
        """
        drive_perm = self.db.query(DrivePermission).filter(
            DrivePermission.user_id == user_id
        ).first()
        
        if can_read or can_write:
            # User has Drive access - create or update DrivePermission
            if not drive_perm:
                # Create new DrivePermission
                drive_perm = DrivePermission(
                    user_id=user_id,
                    has_access=True,
                    permission_level='write' if can_write else 'read',
                    folder_access=None  # All folders by default
                )
                self.db.add(drive_perm)
            else:
                # Update existing DrivePermission
                drive_perm.has_access = True
                drive_perm.permission_level = 'write' if can_write else 'read'
        else:
            # User lost Drive access - disable DrivePermission
            if drive_perm:
                drive_perm.has_access = False
        
        self.db.commit()
    
    def create_default_permissions(self, user_id: int, role: str) -> List[UserPermission]:
        """Create default permissions for all screens based on role"""
        # All available screens in the system
        ALL_SCREENS = [
            'Dashboard',
            'All Samples',
            'Register Sample',
            'PCR Samples',
            'Serology Samples',
            'Microbiology Samples',
            'Database - PCR',
            'Database - Serology',
            'Database - Microbiology',
            'Drive',
            'Drive Admin',
            'Controls',
            'Reports'
        ]
        
        # Create permissions for all screens - default to no access
        # Admin can then configure specific access via Permissions Editor
        permissions_data = []
        for screen in ALL_SCREENS:
            # Default: No access for new users (admin will configure)
            can_read = False
            can_write = False
            
            # Give Dashboard read access by default for all roles
            if screen == 'Dashboard':
                can_read = True
            
            # Admin role gets full access to everything
            if role == 'admin':
                can_read = True
                can_write = True
            
            permissions_data.append({
                'screen_name': screen,
                'can_read': can_read,
                'can_write': can_write
            })
        
        # Set permissions
        result = self.set_user_permissions(user_id, permissions_data)
        
        # Sync Drive permission with DrivePermission table
        drive_perm = next((p for p in permissions_data if p['screen_name'] == 'Drive'), None)
        if drive_perm:
            self.sync_drive_permission(user_id, drive_perm['can_read'], drive_perm['can_write'])
        
        return result
