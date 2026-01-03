from sqlalchemy.orm import Session
from typing import Optional, Tuple, Union
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.repositories.user_repository import UserRepository
from app.repositories.permission_repository import PermissionRepository
from app.schemas.user import LoginRequest, Token, TokenPair, UserCreate
from app.core.security import (
    get_password_hash, verify_password, create_access_token, create_token_pair,
    decode_refresh_token
)
from app.core.config import settings


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.permission_repo = PermissionRepository(db)
    
    def _check_account_lockout(self, user) -> None:
        """Check if account is locked and raise exception if so"""
        if user.is_locked():
            remaining = (user.locked_until - datetime.utcnow()).seconds // 60
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is locked due to too many failed attempts. Try again in {remaining + 1} minutes."
            )
    
    def _record_failed_attempt(self, user) -> None:
        """Record a failed login attempt and lock account if threshold reached"""
        user.failed_login_attempts += 1
        user.last_failed_login = datetime.utcnow()
        
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
        
        self.db.commit()
    
    def _record_successful_login(self, user) -> None:
        """Reset lockout counters on successful login"""
        user.reset_lockout()
        self.db.commit()
    
    def authenticate_user(self, login_data: LoginRequest) -> Optional[TokenPair]:
        """Authenticate user and return token pair with account lockout protection"""
        user = self.user_repo.get_by_username(login_data.username)
        
        if not user:
            # Don't reveal if username exists
            return None
        
        # Check if account is locked
        self._check_account_lockout(user)
        
        # Check if account is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact administrator."
            )
        
        # Verify password
        if not verify_password(login_data.password, user.hashed_password):
            self._record_failed_attempt(user)
            return None
        
        # Successful login - reset lockout counters
        self._record_successful_login(user)
        
        # Create token pair
        access_token, refresh_token = create_token_pair(
            data={"sub": user.username, "role": user.role.value, "user_id": user.id},
            remember_me=login_data.remember_me
        )
        
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
    
    def refresh_access_token(self, refresh_token: str) -> Optional[Token]:
        """Create new access token using refresh token"""
        payload = decode_refresh_token(refresh_token)
        if not payload:
            return None
        
        username = payload.get("sub")
        if not username:
            return None
        
        user = self.user_repo.get_by_username(username)
        if not user or not user.is_active:
            return None
        
        # Create new access token
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role.value, "user_id": user.id}
        )
        
        return Token(access_token=access_token, token_type="bearer")
    
    def register_user(self, user_data: UserCreate) -> Optional[TokenPair]:
        """Register new user and return token pair"""
        existing_user = self.user_repo.get_by_username(user_data.username)
        if existing_user:
            return None
        
        user = self.user_repo.create(user_data)
        
        # Create default permissions for the new user (including Drive screen)
        self.permission_repo.create_default_permissions(user.id, user.role.value)
        
        # Create token pair for new user
        access_token, refresh_token = create_token_pair(
            data={"sub": user.username, "role": user.role.value, "user_id": user.id},
            remember_me=False
        )
        
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
