from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import LoginRequest, Token, TokenPair, RefreshTokenRequest, UserCreate, UserResponse
from app.services import AuthService
from app.api.v1.deps import get_current_user
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return access + refresh tokens.
    
    Account will be locked after 5 failed attempts for 15 minutes.
    """
    # Log login attempt (without password)
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"Login attempt for user '{login_data.username}' from IP {client_ip}")
    
    auth_service = AuthService(db)
    
    try:
        token_pair = auth_service.authenticate_user(login_data)
    except HTTPException:
        # Re-raise HTTPExceptions (like account locked)
        raise
    
    if not token_pair:
        logger.warning(f"Failed login attempt for user '{login_data.username}' from IP {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    logger.info(f"Successful login for user '{login_data.username}'")
    return token_pair


@router.post("/refresh", response_model=Token)
def refresh_token(token_request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Get new access token using refresh token.
    
    Use this when access token expires but refresh token is still valid.
    """
    auth_service = AuthService(db)
    new_token = auth_service.refresh_access_token(token_request.refresh_token)
    
    if not new_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please login again."
        )
    
    return new_token


@router.post("/register", response_model=TokenPair)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.
    
    Password requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter  
    - At least one digit
    - At least one special character
    """
    auth_service = AuthService(db)
    token_pair = auth_service.register_user(user_data)
    
    if not token_pair:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    logger.info(f"New user registered: '{user_data.username}'")
    return token_pair


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's information"""
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout current user.
    
    Note: This endpoint confirms logout on the server side.
    Client should also clear stored tokens.
    """
    logger.info(f"User '{current_user.username}' logged out")
    return {"message": "Successfully logged out", "detail": "Please clear your tokens on the client side"}
