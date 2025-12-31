from pydantic import BaseModel, field_validator
from typing import Optional
from app.models.user import UserRole
import re


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.technician
    profile_picture: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None


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
