from sqlalchemy.orm import Session
from typing import Optional, List
from app.repositories import UserRepository
from app.repositories.permission_repository import PermissionRepository
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.models.user import User


class UserService:
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)
        self.permission_repo = PermissionRepository(db)
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.user_repo.get_by_id(user_id)
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.user_repo.get_by_username(username)
    
    def get_all_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.user_repo.get_all(skip=skip, limit=limit)
    
    def create_user(self, user_data: UserCreate) -> Optional[User]:
        if self.user_repo.get_by_username(user_data.username):
            return None
        
        # Create the user
        user = self.user_repo.create(user_data)
        
        # Create default permissions for the user
        if user:
            self.permission_repo.create_default_permissions(user.id, user.role.value)
        
        return user
    
    def update_user(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        return self.user_repo.update(user_id, user_data)
    
    def delete_user(self, user_id: int) -> bool:
        return self.user_repo.delete(user_id)
