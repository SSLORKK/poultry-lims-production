from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import settings
from app.api.v1.routers import auth, users, departments, samples, statistics, controls, pcr_coa, microbiology_coa, serology_coa, reports, drive, edit_history
from app.db.base import Base
from app.db.session import engine

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
