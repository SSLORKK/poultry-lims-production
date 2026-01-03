from pydantic_settings import BaseSettings
from typing import Optional, List
import os
import secrets


class Settings(BaseSettings):
    PROJECT_NAME: str = "LIMS API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment mode
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Security - SECRET_KEY must be set via environment variable in production
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-" + secrets.token_hex(16))
    ALGORITHM: str = "HS256"
    
    # Token expiration settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))  # 30 minutes for access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7 days for refresh tokens
    REMEMBER_ME_EXPIRE_DAYS: int = int(os.getenv("REMEMBER_ME_EXPIRE_DAYS", "30"))  # 30 days for remember me
    
    # CORS - comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5000")
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    LOGIN_RATE_LIMIT: str = os.getenv("LOGIN_RATE_LIMIT", "5/minute")
    
    # Account lockout
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("LOCKOUT_DURATION_MINUTES", "15"))
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Validate SECRET_KEY in production
if settings.ENVIRONMENT == "production":
    if not os.getenv("SECRET_KEY"):
        raise ValueError("SECRET_KEY environment variable must be set in production!")
    if len(settings.SECRET_KEY) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters long in production!")
    if "dev-secret" in settings.SECRET_KEY or "change-in-production" in settings.SECRET_KEY:
        raise ValueError("SECRET_KEY contains default/dev values - set a secure key in production!")
