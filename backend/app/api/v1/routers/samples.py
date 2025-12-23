from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.schemas.sample import SampleCreate, SampleUpdate, SampleResponse
from app.services import SampleService
from app.repositories import CounterRepository, DepartmentRepository, UnitRepository
from app.repositories.permission_repository import PermissionRepository
from app.api.v1.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/samples", tags=["samples"])


@router.get("/", response_model=List[SampleResponse])
def get_samples(
    skip: int = 0,
    limit: int = 10000,
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    year: Optional[int] = Query(None, description="Filter by year (optional, shows all years if not specified)"),
    search: Optional[str] = Query(None, description="Global search across sample code, unit code, company, farm, flock"),
    company: Optional[List[str]] = Query(None, description="Filter by company"),
    farm: Optional[List[str]] = Query(None, description="Filter by farm"),
    flock: Optional[List[str]] = Query(None, description="Filter by flock"),
    date_from: Optional[str] = Query(None, description="Filter by date received from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter by date received to (YYYY-MM-DD)"),
    age: Optional[List[str]] = Query(None, description="Filter by age"),
    sample_type: Optional[List[str]] = Query(None, description="Filter by sample type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all samples, optionally filtered by department, year, search term, and user permissions"""
    # DO NOT default to current year - only filter if explicitly specified
    # This allows frontend to show all years when year filter is not set
    
    sample_service = SampleService(db)
    samples = sample_service.get_all_samples(skip=skip, limit=limit, department_id=department_id, year=year,
                                          search=search, company=company, farm=farm, flock=flock, date_from=date_from, date_to=date_to,
                                          age=age, sample_type=sample_type)
    
    # Get user's database permissions to filter results
    permission_repo = PermissionRepository(db)
    user_permissions = permission_repo.get_user_permissions(current_user.id)  # type: ignore
    
    # Admin role has access to all departments
    if current_user.role == "admin":  # type: ignore
        return samples
    
    # Check if user has "All Samples" permission - if so, grant access to all departments
    has_all_samples_permission = False
    for perm in user_permissions:
        if perm.screen_name == "All Samples" and perm.can_read:  # type: ignore
            has_all_samples_permission = True
            break
    
    if has_all_samples_permission:
        return samples
    
    # Determine which departments the user has access to
    allowed_dept_ids = set()
    for perm in user_permissions:
        if perm.screen_name == "Database - PCR" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(1)  # PCR department ID
        elif perm.screen_name == "Database - Serology" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(2)  # Serology department ID
        elif perm.screen_name == "Database - Microbiology" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(3)  # Microbiology department ID
    
    # Filter samples to only include units from allowed departments
    filtered_samples = []
    for sample in samples:
        # Filter units based on allowed departments
        allowed_units = [unit for unit in sample.units if unit.department_id in allowed_dept_ids]
        if allowed_units:
            # Create a new sample object with filtered units
            sample_dict = sample.model_dump() if hasattr(sample, 'model_dump') else sample.dict()
            sample_dict['units'] = allowed_units
            filtered_samples.append(SampleResponse(**sample_dict))
    
    return filtered_samples


@router.get("/available-years")
def get_available_years(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all years that have samples"""
    sample_service = SampleService(db)
    years = sample_service.sample_repo.get_available_years()
    return {"years": years}


@router.get("/filter-options")
def get_filter_options(
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all unique values for filter dropdowns"""
    from sqlalchemy.orm import selectinload
    from app.models.sample import Sample
    from app.models.unit import Unit
    
    # Base query with eager loading of units
    query = db.query(Sample).options(selectinload(Sample.units))
    
    # Filter by department if specified
    if department_id is not None:
        query = query.join(Unit).filter(Unit.department_id == department_id).distinct()
    
    # Get all samples (limit to avoid performance issues)
    samples = query.limit(10000).all()
    
    # Extract unique values
    companies = set()
    farms = set()
    flocks = set()
    ages = set()
    sample_types = set()
    
    for sample in samples:
        companies.add(sample.company)  # type: ignore
        farms.add(sample.farm)  # type: ignore
        flocks.add(sample.flock)  # type: ignore
        
        for unit in sample.units:
            if department_id is None or unit.department_id == department_id:
                ages.add(unit.age)  # type: ignore
                if unit.sample_type:
                    for st in unit.sample_type:
                        sample_types.add(st)
    
    # Remove None and empty values
    companies.discard(None)
    companies.discard('')
    farms.discard(None)
    farms.discard('')
    flocks.discard(None)
    flocks.discard('')
    ages.discard(None)
    ages.discard('')
    
    return {
        "companies": sorted(list(companies)),
        "farms": sorted(list(farms)),
        "flocks": sorted(list(flocks)),
        "ages": sorted(list(ages)),
        "sample_types": sorted(list(sample_types))
    }


@router.get("/preview-codes")
def preview_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reserve and preview the next sample code for this user"""
    counter_repo = CounterRepository(db)
    dept_repo = DepartmentRepository(db)
    
    # Reserve the next sample number for this user
    reserved_number = counter_repo.reserve_next_sample_number(current_user.id)  # type: ignore
    year = datetime.now().year % 100
    next_sample_code = f"SMP{year:02d}-{reserved_number}"
    
    # Get all departments with their current unit counters
    departments = dept_repo.get_all()
    unit_counters = {}
    
    for dept in departments:
        current_counter = counter_repo.get_unit_counter(dept.id)  # type: ignore
        current_unit_value = current_counter.current_value if current_counter else 0
        unit_counters[dept.id] = {
            "department_id": dept.id,
            "department_code": dept.code,
            "department_name": dept.name,
            "next_unit_number": current_unit_value + 1
        }
    
    return {
        "next_sample_code": next_sample_code,
        "unit_counters": unit_counters,
        "reserved": True
    }


@router.get("/{sample_id}", response_model=SampleResponse)
def get_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single sample by ID with permission filtering"""
    sample_service = SampleService(db)
    sample = sample_service.get_sample_by_id(sample_id)
    
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found")
    
    # Get user's database permissions to filter results
    permission_repo = PermissionRepository(db)
    user_permissions = permission_repo.get_user_permissions(current_user.id)  # type: ignore
    
    # Admin role has access to all departments
    if current_user.role == "admin":  # type: ignore
        return sample
    
    # Check if user has "All Samples" permission - if so, grant access to all departments
    has_all_samples_permission = False
    for perm in user_permissions:
        if perm.screen_name == "All Samples" and perm.can_read:  # type: ignore
            has_all_samples_permission = True
            break
    
    if has_all_samples_permission:
        return sample
    
    # Determine which departments the user has access to
    allowed_dept_ids = set()
    for perm in user_permissions:
        if perm.screen_name == "Database - PCR" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(1)  # PCR department ID
        elif perm.screen_name == "Database - Serology" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(2)  # Serology department ID
        elif perm.screen_name == "Database - Microbiology" and perm.can_read:  # type: ignore
            allowed_dept_ids.add(3)  # Microbiology department ID
    
    # Filter units based on allowed departments
    allowed_units = [unit for unit in sample.units if unit.department_id in allowed_dept_ids]
    
    # If no units are accessible, return 403
    if not allowed_units:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this sample's data"
        )
    
    # Create a new sample object with filtered units
    sample_dict = sample.model_dump() if hasattr(sample, 'model_dump') else sample.dict()
    sample_dict['units'] = allowed_units
    return SampleResponse(**sample_dict)


@router.post("/", response_model=SampleResponse, status_code=status.HTTP_201_CREATED)
def create_sample(
    sample_data: SampleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new sample with department-specific data"""
    sample_service = SampleService(db)
    sample = sample_service.create_sample(sample_data, user_id=current_user.id)  # type: ignore
    
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create sample. Check department IDs."
        )
    
    return sample


@router.put("/{sample_id}", response_model=SampleResponse)
def update_sample(
    sample_id: int,
    sample_data: SampleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing sample"""
    sample_service = SampleService(db)
    sample = sample_service.update_sample(sample_id, sample_data, edited_by=current_user.full_name)  # type: ignore
    
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found")
    
    return sample


@router.patch("/{sample_id}", response_model=SampleResponse)
def partial_update_sample(
    sample_id: int,
    sample_data: SampleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Partially update an existing sample (e.g., status only)"""
    sample_service = SampleService(db)
    sample = sample_service.update_sample(sample_id, sample_data)
    
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found")
    
    return sample


@router.delete("/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a sample and all associated data"""
    sample_service = SampleService(db)
    success = sample_service.delete_sample(sample_id)
    
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found")
    
    return None


# Create a new router for units
units_router = APIRouter(prefix="/units", tags=["units"])


@units_router.get("/{unit_id}")
def get_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single unit by ID with all associated data"""
    from app.schemas.sample import UnitResponse
    
    unit_repo = UnitRepository(db)
    unit = unit_repo.get_by_id(unit_id)
    
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    
    return unit


@units_router.patch("/{unit_id}")
def update_unit(
    unit_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a unit's fields (e.g., coa_status)"""
    unit_repo = UnitRepository(db)
    unit = unit_repo.update(unit_id, **update_data)
    
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    
    return {"message": "Unit updated successfully", "unit_id": unit.id}


@units_router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a unit"""
    unit_repo = UnitRepository(db)
    success = unit_repo.delete(unit_id)
    
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    
    return None
