from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
from app.db.session import get_db
from app.models.microbiology_coa import MicrobiologyCOA
from app.models.unit import Unit
from app.models.sample import Sample
from app.repositories.counter_repository import CounterRepository
from app.api.v1.deps import get_current_user
from app.models.user import User
from pydantic import BaseModel


router = APIRouter(prefix="/microbiology-coa", tags=["microbiology-coa"])


class MicrobiologyCOACreate(BaseModel):
    unit_id: int
    test_results: Dict[str, Dict[str, str]]
    test_portions: Dict[str, Dict[str, str]] | None = None
    test_methods: Dict[str, str] | None = None
    isolate_types: Dict[str, Dict[str, str]] | None = None
    test_ranges: Dict[str, Dict[str, str]] | None = None
    date_tested: str | None = None
    tested_by: str | None = None
    reviewed_by: str | None = None
    lab_supervisor: str | None = None
    lab_manager: str | None = None
    notes: str | None = None
    status: str = "draft"


class MicrobiologyCOAUpdate(BaseModel):
    test_results: Dict[str, Dict[str, str]] | None = None
    test_portions: Dict[str, Dict[str, str]] | None = None
    test_methods: Dict[str, str] | None = None
    isolate_types: Dict[str, Dict[str, str]] | None = None
    test_ranges: Dict[str, Dict[str, str]] | None = None
    date_tested: str | None = None
    tested_by: str | None = None
    reviewed_by: str | None = None
    lab_supervisor: str | None = None
    lab_manager: str | None = None
    notes: str | None = None
    status: str | None = None


def generate_disease_code(disease_name: str) -> str:
    """Generate disease code based on disease type"""
    disease_lower = disease_name.lower()
    
    # Mapping of disease names to codes (format: Code25-1)
    disease_codes = {
        'water': 'Water',
        'culture': 'CU',
        'fungi': 'Fungi',
        'salmonella': 'Salm',
        'total count': 'Count',
        'count': 'Count',
    }
    
    # Check for known disease codes (order matters - check more specific first)
    for key, code in disease_codes.items():
        if key in disease_lower:
            return code
    
    # Generate code from first 4 letters if not found
    return disease_name[:4].upper()


def generate_test_report_numbers(diseases: list[str], counter_repo: CounterRepository) -> Dict[str, str]:
    """Generate test report numbers for each disease"""
    current_year = datetime.now().year
    year_short = current_year % 100
    
    test_report_numbers = {}
    for disease in diseases:
        # Get disease-specific counter
        counter_value = counter_repo.increment_disease_counter(disease)
        disease_code = generate_disease_code(disease)
        
        # Format: SALM25-1
        report_number = f"{disease_code}{year_short:02d}-{counter_value}"
        test_report_numbers[disease] = report_number
    
    return test_report_numbers


@router.get("/batch/")
def get_microbiology_coas_batch(
    unit_ids: str = Query(..., description="Comma-separated list of unit IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get multiple Microbiology COAs by unit IDs (batch fetch for performance)"""
    try:
        ids = [int(id.strip()) for id in unit_ids.split(',') if id.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid unit IDs format"
        )
    
    coas = db.query(MicrobiologyCOA).filter(MicrobiologyCOA.unit_id.in_(ids)).all()
    
    return [
        {
            "id": coa.id,
            "unit_id": coa.unit_id,
            "test_results": coa.test_results or {},
            "test_portions": coa.test_portions or {},
            "test_methods": coa.test_methods or {},
            "isolate_types": coa.isolate_types or {},
            "test_ranges": coa.test_ranges or {},
            "test_report_numbers": coa.test_report_numbers or {},
            "date_tested": coa.date_tested,
            "tested_by": coa.tested_by,
            "reviewed_by": coa.reviewed_by,
            "lab_supervisor": coa.lab_supervisor,
            "lab_manager": coa.lab_manager,
            "notes": coa.notes,
            "status": coa.status,
        }
        for coa in coas
    ]


@router.get("/{unit_id}")
def get_microbiology_coa(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get Microbiology COA for a specific unit"""
    # First check if unit exists
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit with ID {unit_id} not found"
        )
    
    # Check if COA exists
    coa = db.query(MicrobiologyCOA).filter(MicrobiologyCOA.unit_id == unit_id).first()
    
    if coa:
        return {
            "id": coa.id,
            "unit_id": coa.unit_id,
            "test_results": coa.test_results or {},
            "test_portions": coa.test_portions or {},
            "test_methods": coa.test_methods or {},
            "isolate_types": coa.isolate_types or {},
            "test_ranges": coa.test_ranges or {},
            "test_report_numbers": coa.test_report_numbers or {},
            "date_tested": coa.date_tested,
            "tested_by": coa.tested_by,
            "reviewed_by": coa.reviewed_by,
            "lab_supervisor": coa.lab_supervisor,
            "lab_manager": coa.lab_manager,
            "notes": coa.notes,
            "status": coa.status,
            "created_at": coa.created_at.isoformat() if coa.created_at is not None else None,
            "updated_at": coa.updated_at.isoformat() if coa.updated_at is not None else None
        }
    else:
        return None


@router.post("/")
def create_microbiology_coa(
    coa_data: MicrobiologyCOACreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Microbiology COA"""
    # Check if unit exists
    unit = db.query(Unit).filter(Unit.id == coa_data.unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit with ID {coa_data.unit_id} not found"
        )
    
    # Check if COA already exists for this unit
    existing_coa = db.query(MicrobiologyCOA).filter(
        MicrobiologyCOA.unit_id == coa_data.unit_id
    ).first()
    
    if existing_coa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Microbiology COA already exists for unit {coa_data.unit_id}"
        )
    
    # Generate test report numbers for each disease
    counter_repo = CounterRepository(db)
    diseases = list(coa_data.test_results.keys()) if coa_data.test_results else []
    test_report_numbers = generate_test_report_numbers(diseases, counter_repo)
    
    # Create new COA
    new_coa = MicrobiologyCOA(
        unit_id=coa_data.unit_id,
        test_results=coa_data.test_results,
        test_portions=coa_data.test_portions,
        test_methods=coa_data.test_methods,
        isolate_types=coa_data.isolate_types,
        test_ranges=coa_data.test_ranges,
        test_report_numbers=test_report_numbers,
        date_tested=coa_data.date_tested,
        tested_by=coa_data.tested_by,
        reviewed_by=coa_data.reviewed_by,
        lab_supervisor=coa_data.lab_supervisor,
        lab_manager=coa_data.lab_manager,
        notes=coa_data.notes,
        status=coa_data.status
    )
    
    db.add(new_coa)
    
    # Update unit's COA status
    unit.coa_status = coa_data.status  # type: ignore
    
    db.commit()
    db.refresh(new_coa)
    
    return {
        "id": new_coa.id,
        "unit_id": new_coa.unit_id,
        "test_results": new_coa.test_results,
        "test_portions": new_coa.test_portions,
        "test_methods": new_coa.test_methods or {},
        "isolate_types": new_coa.isolate_types or {},
        "test_ranges": new_coa.test_ranges or {},
        "test_report_numbers": new_coa.test_report_numbers,
        "date_tested": new_coa.date_tested,
        "tested_by": new_coa.tested_by,
        "reviewed_by": new_coa.reviewed_by,
        "lab_supervisor": new_coa.lab_supervisor,
        "lab_manager": new_coa.lab_manager,
        "notes": new_coa.notes,
        "status": new_coa.status
    }


@router.put("/{coa_id}")
def update_microbiology_coa(
    coa_id: int,
    coa_data: MicrobiologyCOAUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing Microbiology COA"""
    coa = db.query(MicrobiologyCOA).filter(MicrobiologyCOA.id == coa_id).first()
    
    if not coa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Microbiology COA with ID {coa_id} not found"
        )
    
    # Update fields if provided
    # Update fields
    if coa_data.test_results is not None:
        coa.test_results = coa_data.test_results  # type: ignore
    if coa_data.test_portions is not None:
        coa.test_portions = coa_data.test_portions  # type: ignore
    if coa_data.test_methods is not None:
        coa.test_methods = coa_data.test_methods  # type: ignore
    if coa_data.isolate_types is not None:
        coa.isolate_types = coa_data.isolate_types  # type: ignore
    if coa_data.test_ranges is not None:
        coa.test_ranges = coa_data.test_ranges  # type: ignore
    if coa_data.date_tested is not None:
        coa.date_tested = coa_data.date_tested  # type: ignore
    if coa_data.tested_by is not None:
        coa.tested_by = coa_data.tested_by  # type: ignore
    if coa_data.reviewed_by is not None:
        coa.reviewed_by = coa_data.reviewed_by  # type: ignore
    if coa_data.lab_supervisor is not None:
        coa.lab_supervisor = coa_data.lab_supervisor  # type: ignore
    if coa_data.lab_manager is not None:
        coa.lab_manager = coa_data.lab_manager  # type: ignore
    if coa_data.notes is not None:
        coa.notes = coa_data.notes  # type: ignore
    if coa_data.status is not None:
        coa.status = coa_data.status  # type: ignore
        # Update unit's COA status
        unit = db.query(Unit).filter(Unit.id == coa.unit_id).first()
        if unit:
            unit.coa_status = coa_data.status  # type: ignore
    
    db.commit()
    db.refresh(coa)
    
    return {
        "id": coa.id,
        "unit_id": coa.unit_id,
        "test_results": coa.test_results,
        "test_portions": coa.test_portions,
        "test_methods": coa.test_methods or {},
        "isolate_types": coa.isolate_types or {},
        "test_ranges": coa.test_ranges or {},
        "test_report_numbers": coa.test_report_numbers,
        "date_tested": coa.date_tested,
        "tested_by": coa.tested_by,
        "reviewed_by": coa.reviewed_by,
        "lab_supervisor": coa.lab_supervisor,
        "lab_manager": coa.lab_manager,
        "notes": coa.notes,
        "status": coa.status
    }
