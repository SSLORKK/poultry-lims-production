from pydantic import BaseModel, field_validator, EmailStr
from typing import Optional
from app.models.user import UserRole
import re


# Shared password validation constants
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
WEAK_PASSWORDS = ['password', '12345678', 'qwerty', 'admin123', 'letmein', 'welcome', '123456789']


def validate_password(password: str) -> str:
    """
    Shared password validation function.
    Validates password meets security requirements:
    - Minimum 8 characters
    - Maximum 128 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    - Not in common weak passwords list
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f'Password must be at least {PASSWORD_MIN_LENGTH} characters long')
    if len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError(f'Password must not exceed {PASSWORD_MAX_LENGTH} characters')
    if not re.search(r'[A-Z]', password):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', password):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', password):
        raise ValueError('Password must contain at least one digit')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'/~`]', password):
        raise ValueError('Password must contain at least one special character')
    if password.lower() in WEAK_PASSWORDS:
        raise ValueError('Password is too common. Please choose a stronger password.')
    return password


def validate_username_format(username: str) -> str:
    """
    Shared username validation function.
    Validates username format:
    - Minimum 3 characters
    - Maximum 50 characters
    - Only alphanumeric, underscores, dots, and hyphens
    """
    if len(username) < 3:
        raise ValueError('Username must be at least 3 characters long')
    if len(username) > 50:
        raise ValueError('Username must not exceed 50 characters')
    if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        raise ValueError('Username can only contain letters, numbers, underscores, dots, and hyphens')
    return username


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.technician
    profile_picture: Optional[str] = None


class UserCreate(UserBase):
    password: str
    email: Optional[EmailStr] = None  # Optional email for notifications
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password meets security requirements"""
        return validate_password(v)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        return validate_username_format(v)


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        """Validate password meets security requirements (if provided)"""
        if v is None:
            return v
        return validate_password(v)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        """Validate username format (if provided)"""
        if v is None:
            return v
        return validate_username_format(v)


class UserResponse(UserBase):
    id: int
    is_active: bool = True
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class TokenPair(BaseModel):
    """Access token + Refresh token pair"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token"""
    refresh_token: str
