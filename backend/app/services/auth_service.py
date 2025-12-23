from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta
from app.repositories import UserRepository
from app.schemas.user import LoginRequest, Token, UserCreate
from app.core.security import verify_password, create_access_token
from app.core.config import settings


class AuthService:
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)
    
    def authenticate_user(self, login_data: LoginRequest) -> Optional[Token]:
        user = self.user_repo.get_by_username(login_data.username)
        if not user:
            return None
        
        if not verify_password(login_data.password, user.hashed_password):
            return None
        
        expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        if login_data.remember_me:
            expire_minutes = 43200  # 30 days (60 * 24 * 30)
            
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role.value},
            expires_delta=timedelta(minutes=expire_minutes)
        )
        
        return Token(access_token=access_token, token_type="bearer")
    
    def register_user(self, user_data: UserCreate) -> Optional[Token]:
        existing_user = self.user_repo.get_by_username(user_data.username)
        if existing_user:
            return None
        
        existing_email = self.user_repo.get_by_email(user_data.email)
        if existing_email:
            return None
        
        user = self.user_repo.create(user_data)
        
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role.value},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        return Token(access_token=access_token, token_type="bearer")
