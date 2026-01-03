from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
import traceback
import logging
import os
from app.core.config import settings
from app.api.v1.routers import auth, users, departments, samples, statistics, controls, pcr_coa, microbiology_coa, serology_coa, reports, drive, drive_admin, edit_history
from app.db.base import Base
from app.db.session import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import all models so SQLAlchemy knows about them
from app.models import user, department, unit, sample, counter, dropdown_data, pcr_data, serology_data, microbiology_data
from app.models import pcr_coa as pcr_coa_model
from app.models import microbiology_coa as microbiology_coa_model

# Tables already exist from init_db.py - don't recreate!
# Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    # Configure for large file uploads (2GB max)
    max_upload_size=2 * 1024 * 1024 * 1024  # 2GB in bytes
)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Security headers to prevent common attacks
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Add HSTS header in production
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS Configuration - use specific origins, not wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# Add Gzip compression for responses > 1KB (50-90% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(departments.router, prefix=settings.API_V1_STR)
app.include_router(samples.router, prefix=settings.API_V1_STR)
app.include_router(samples.units_router, prefix=settings.API_V1_STR)
app.include_router(statistics.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(controls.router, prefix=f"{settings.API_V1_STR}/controls", tags=["controls"])
app.include_router(pcr_coa.router, prefix=settings.API_V1_STR)
app.include_router(microbiology_coa.router, prefix=settings.API_V1_STR)
app.include_router(serology_coa.router, prefix=settings.API_V1_STR)
app.include_router(drive.router, prefix=settings.API_V1_STR)
app.include_router(drive_admin.router, prefix=settings.API_V1_STR)
app.include_router(edit_history.router, prefix=settings.API_V1_STR)

# Mount static files for profile pictures
uploads_path = Path("uploads")
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/")
def root():
    return {"message": "LIMS API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Global exception handler - sanitized for production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with sanitized error info"""
    # Get the full traceback for logging
    tb = traceback.format_exc()
    
    # Always log the full error details server-side
    logger.error(f"Unhandled exception on {request.method} {request.url.path}")
    logger.error(f"Error type: {type(exc).__name__}")
    logger.error(f"Error message: {str(exc)}")
    logger.error(f"Traceback:\n{tb}")
    
    # Check environment for response detail level
    is_development = settings.ENVIRONMENT == "development"
    
    if is_development:
        # More details in development for debugging
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_type": type(exc).__name__,
                "message": str(exc),
                "detail": "Internal server error - check logs for details"
            }
        )
    else:
        # Sanitized response in production - no sensitive info
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "An unexpected error occurred",
                "detail": "Please contact support if the problem persists"
            }
        )
