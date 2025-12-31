from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
import traceback
import logging
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
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# Global exception handler for detailed error messages
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with detailed error info"""
    # Get the full traceback
    tb = traceback.format_exc()
    
    # Log the error with full details
    logger.error(f"Unhandled exception on {request.method} {request.url.path}")
    logger.error(f"Error type: {type(exc).__name__}")
    logger.error(f"Error message: {str(exc)}")
    logger.error(f"Traceback:\n{tb}")
    
    # Determine the error location from traceback
    error_location = "Unknown"
    tb_lines = tb.split("\n")
    for i, line in enumerate(tb_lines):
        if "File" in line and "/app/" in line:
            error_location = line.strip()
    
    # Return detailed error response
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "error_type": type(exc).__name__,
            "message": str(exc),
            "location": error_location,
            "path": str(request.url.path),
            "method": request.method,
            "detail": "An internal server error occurred. Check backend logs for full traceback."
        }
    )
