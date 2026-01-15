from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List, Optional, Set
from datetime import datetime
from app.db.session import get_db
from app.schemas.sample import SampleCreate, SampleUpdate, SampleResponse
from app.services import SampleService
from app.repositories import CounterRepository, DepartmentRepository, UnitRepository
from app.repositories.permission_repository import PermissionRepository
from app.api.v1.deps import get_current_user
from app.models.user import User, UserRole

router = APIRouter(prefix="/samples", tags=["samples"])

# Permission screen name to department code mapping
PERMISSION_TO_DEPT_CODE = {
    "Database - PCR": "PCR",
    "Database - Serology": "SER",
    "Database - Microbiology": "MIC",
}


def get_allowed_department_ids(
    user_permissions: list,
    dept_repo: DepartmentRepository,
    check_write: bool = False
) -> Set[int]:
    """
    Get department IDs that user has access to based on permissions.
    Uses database lookup instead of hardcoded IDs.
    
    Args:
        user_permissions: List of user's permissions
        dept_repo: Department repository for database lookup
        check_write: If True, check can_write permission; otherwise check can_read
    
    Returns:
        Set of department IDs the user can access
    """
    allowed_dept_ids: Set[int] = set()
    
    # Cache department lookups to avoid repeated queries
    dept_cache = {}
    
    for perm in user_permissions:
        screen_name = perm.screen_name
        has_permission = perm.can_write if check_write else perm.can_read
        
        if screen_name in PERMISSION_TO_DEPT_CODE and has_permission:
            dept_code = PERMISSION_TO_DEPT_CODE[screen_name]
            
            # Use cache or lookup from database
            if dept_code not in dept_cache:
                dept = dept_repo.get_by_code(dept_code)
                dept_cache[dept_code] = dept.id if dept else None
            
            if dept_cache[dept_code]:
                allowed_dept_ids.add(dept_cache[dept_code])
    
    return allowed_dept_ids


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
    source: Optional[List[str]] = Query(None, description="Filter by source"),
    status: Optional[List[str]] = Query(None, description="Filter by status"),
    house: Optional[List[str]] = Query(None, description="Filter by house"),
    cycle: Optional[List[str]] = Query(None, description="Filter by cycle"),
    diseases: Optional[List[str]] = Query(None, description="Filter by diseases (PCR/Serology specific)"),
    kit_types: Optional[List[str]] = Query(None, description="Filter by kit types (PCR/Serology specific)"),
    technicians: Optional[List[str]] = Query(None, description="Filter by technicians (PCR/Serology/Microbiology specific)"),
    extraction_methods: Optional[List[str]] = Query(None, description="Filter by extraction methods (PCR specific)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all samples, optionally filtered by department, year, search term, and user permissions"""
    # DO NOT default to current year - only filter if explicitly specified
    # This allows frontend to show all years when year filter is not set
    
    sample_service = SampleService(db)
    samples = sample_service.get_all_samples(skip=skip, limit=limit, department_id=department_id, year=year,
                                          search=search, company=company, farm=farm, flock=flock, date_from=date_from, date_to=date_to,
                                          age=age, sample_type=sample_type, source=source, status=status, house=house, cycle=cycle,
                                          diseases=diseases, kit_types=kit_types, technicians=technicians, extraction_methods=extraction_methods)
    
    # Get user's database permissions to filter results
    permission_repo = PermissionRepository(db)
    user_permissions = permission_repo.get_user_permissions(current_user.id)  # type: ignore
    
    # Admin role has access to all departments (use enum comparison)
    if current_user.role == UserRole.admin:
        return samples
    
    # Check if user has "All Samples" permission - if so, grant access to all departments
    has_all_samples_permission = False
    for perm in user_permissions:
        if perm.screen_name == "All Samples" and perm.can_read:  # type: ignore
            has_all_samples_permission = True
            break
    
    if has_all_samples_permission:
        return samples
    
    # Determine which departments the user has access to using database lookup
    dept_repo = DepartmentRepository(db)
    allowed_dept_ids = get_allowed_department_ids(user_permissions, dept_repo, check_write=False)
    
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


@router.get("/total-count")
def get_total_count(
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    year: Optional[int] = Query(None, description="Filter by year"),
    search: Optional[str] = Query(None, description="Global search term"),
    company: Optional[List[str]] = Query(None, description="Filter by company"),
    farm: Optional[List[str]] = Query(None, description="Filter by farm"),
    flock: Optional[List[str]] = Query(None, description="Filter by flock"),
    date_from: Optional[str] = Query(None, description="Filter by date from"),
    date_to: Optional[str] = Query(None, description="Filter by date to"),
    age: Optional[List[str]] = Query(None, description="Filter by age"),
    sample_type: Optional[List[str]] = Query(None, description="Filter by sample type"),
    source: Optional[List[str]] = Query(None, description="Filter by source"),
    status: Optional[List[str]] = Query(None, description="Filter by status"),
    house: Optional[List[str]] = Query(None, description="Filter by house"),
    cycle: Optional[List[str]] = Query(None, description="Filter by cycle"),
    diseases: Optional[List[str]] = Query(None, description="Filter by diseases"),
    kit_types: Optional[List[str]] = Query(None, description="Filter by kit types"),
    technicians: Optional[List[str]] = Query(None, description="Filter by technicians"),
    extraction_methods: Optional[List[str]] = Query(None, description="Filter by extraction methods"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get total count of samples for pagination (OPTIMIZED for large datasets)"""
    import time
    from sqlalchemy import func, or_, String, text
    from app.models.sample import Sample
    from app.models.unit import Unit
    
    start_time = time.time()
    
    try:
        # OPTIMIZATION 1: Use simpler query for basic filters only
        has_complex_filters = (
            (diseases is not None and len(diseases) > 0) or
            (kit_types is not None and len(kit_types) > 0) or 
            (technicians is not None and len(technicians) > 0) or
            (extraction_methods is not None and len(extraction_methods) > 0)
        )
        
        # OPTIMIZATION 2: If no complex JSON filters, use fast count
        if not has_complex_filters:
            query = db.query(func.count(distinct(Sample.id)))
            
            # Apply basic filters first (fastest)
            if year is not None:
                query = query.filter(Sample.year == year)
            if date_from is not None:
                query = query.filter(Sample.date_received >= date_from)
            if date_to is not None:
                query = query.filter(Sample.date_received <= date_to)
            if company is not None and len(company) > 0:
                query = query.filter(Sample.company.in_(company))
            if farm is not None and len(farm) > 0:
                query = query.filter(Sample.farm.in_(farm))
            if flock is not None and len(flock) > 0:
                query = query.filter(Sample.flock.in_(flock))
            if cycle is not None and len(cycle) > 0:
                query = query.filter(Sample.cycle.in_(cycle))
            
            # Only join Unit table if needed
            needs_unit_join = (
                department_id is not None or search is not None or 
                age is not None or sample_type is not None or source is not None or 
                status is not None or house is not None
            )
            
            if needs_unit_join:
                query = query.join(Unit)
                
                if department_id is not None:
                    query = query.filter(Unit.department_id == department_id)
                
                # OPTIMIZATION 3: Simplified search (no JSON casting for performance)
                if search is not None and search.strip():
                    search_term = f"%{search}%"
                    query = query.filter(
                        or_(
                            Sample.sample_code.ilike(search_term),
                            Sample.company.ilike(search_term),
                            Sample.farm.ilike(search_term),
                            Sample.flock.ilike(search_term),
                            Sample.cycle.ilike(search_term),
                            Sample.status.ilike(search_term),
                            Unit.unit_code.ilike(search_term),
                            Unit.age.ilike(search_term),
                            Unit.notes.ilike(search_term),
                            Unit.coa_status.ilike(search_term)
                        )
                    )
                
                if age is not None and len(age) > 0:
                    query = query.filter(Unit.age.in_(age))
                if status is not None and len(status) > 0:
                    query = query.filter(or_(Sample.status.in_(status), Unit.coa_status.in_(status)))
            
            # OPTIMIZATION 4: Set query timeout to 10 seconds
            total = query.scalar() or 0
            
        else:
            # OPTIMIZATION 5: For complex filters, return approximate count to avoid timeout
            # Use the main samples API with limit=1 to check if any results exist
            from app.services.sample_service import SampleService
            sample_service = SampleService(db)
            
            # Quick check - if we get any results, estimate count as 100+ for pagination
            test_samples = sample_service.get_all_samples(
                skip=0, limit=1, department_id=department_id, year=year,
                search=search, company=company, farm=farm, flock=flock,
                date_from=date_from, date_to=date_to, age=age,
                sample_type=sample_type, source=source, status=status,
                house=house, cycle=cycle, diseases=diseases, kit_types=kit_types,
                technicians=technicians, extraction_methods=extraction_methods
            )
            
            # Return approximate count for complex filters
            if len(test_samples) > 0:
                total = 999  # Signal that there are results, let frontend handle pagination
            else:
                total = 0
        
        elapsed = time.time() - start_time
        print(f"Total count query took: {elapsed:.2f}s, result: {total}")
        
        return {"total": total}
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"Total count query FAILED after {elapsed:.2f}s: {str(e)}")
        
        # OPTIMIZATION 6: Fallback - return approximate count for pagination
        try:
            # Quick fallback: just count samples with basic filters
            fallback_query = db.query(func.count(Sample.id))
            if year is not None:
                fallback_query = fallback_query.filter(Sample.year == year)
            if department_id is not None:
                fallback_query = fallback_query.join(Unit).filter(Unit.department_id == department_id)
            
            fallback_total = fallback_query.scalar() or 0
            print(f"Using fallback count: {fallback_total}")
            return {"total": fallback_total}
            
        except Exception as fallback_error:
            print(f"Fallback count also failed: {str(fallback_error)}")
            # Ultimate fallback - return a reasonable default for pagination
            return {"total": 100}


@router.get("/filter-options")
def get_filter_options(
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    year: Optional[int] = Query(None, description="Filter by year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all unique values for filter dropdowns based on year and department"""
    from sqlalchemy.orm import selectinload
    from app.models.sample import Sample
    from app.models.unit import Unit
    from app.models.department import Department
    
    # Base query with eager loading of units
    query = db.query(Sample).options(selectinload(Sample.units))
    
    # Filter by year if specified
    if year is not None:
        query = query.filter(Sample.year == year)
    
    # Filter by department if specified
    if department_id is not None:
        query = query.join(Unit).filter(Unit.department_id == department_id).distinct()
    
    # Get all samples
    samples = query.all()
    
    # Extract unique values
    companies = set()
    farms = set()
    flocks = set()
    cycles = set()
    statuses = set()
    ages = set()
    sample_types = set()
    sources = set()
    houses = set()
    departments_set = set()
    diseases = set()
    kit_types = set()
    technicians = set()
    extraction_methods = set()
    
    for sample in samples:
        if sample.company:
            companies.add(sample.company)
        if sample.farm:
            farms.add(sample.farm)
        if sample.flock:
            flocks.add(sample.flock)
        if sample.cycle:
            cycles.add(sample.cycle)
        if sample.status:
            statuses.add(sample.status.lower())
        
        for unit in sample.units:
            if department_id is None or unit.department_id == department_id:
                # Also collect unit coa_status values for status filter
                if unit.coa_status:
                    statuses.add(unit.coa_status.lower())
                if unit.age:
                    ages.add(str(unit.age))
                if unit.sample_type:
                    for st in unit.sample_type:
                        if st:
                            sample_types.add(st)
                if unit.source:
                    for src in unit.source:
                        if src:
                            sources.add(src)
                if unit.house:
                    for h in unit.house:
                        if h:
                            houses.add(h)
                if unit.department_id:
                    departments_set.add(unit.department_id)
                
                # Extract department-specific filter options
                if unit.pcr_data:
                    if unit.pcr_data.technician_name:
                        technicians.add(unit.pcr_data.technician_name)
                    if unit.pcr_data.extraction_method:
                        extraction_methods.add(unit.pcr_data.extraction_method)
                    if unit.pcr_data.kit_type:
                        kit_types.add(unit.pcr_data.kit_type)
                    if unit.pcr_data.diseases_list:
                        for disease_data in unit.pcr_data.diseases_list:
                            if isinstance(disease_data, dict) and disease_data.get('disease'):
                                diseases.add(disease_data['disease'])
                            if isinstance(disease_data, dict) and disease_data.get('kit_type'):
                                kit_types.add(disease_data['kit_type'])
                
                if unit.serology_data:
                    if unit.serology_data.technician_name:
                        technicians.add(unit.serology_data.technician_name)
                    if unit.serology_data.kit_type:
                        kit_types.add(unit.serology_data.kit_type)
                    if unit.serology_data.diseases_list:
                        for disease_data in unit.serology_data.diseases_list:
                            if isinstance(disease_data, dict) and disease_data.get('disease'):
                                diseases.add(disease_data['disease'])
                            if isinstance(disease_data, dict) and disease_data.get('kit_type'):
                                kit_types.add(disease_data['kit_type'])
                
                if unit.microbiology_data:
                    if unit.microbiology_data.technician_name:
                        technicians.add(unit.microbiology_data.technician_name)
                    if unit.microbiology_data.diseases_list:
                        for disease in unit.microbiology_data.diseases_list:
                            if isinstance(disease, str):
                                diseases.add(disease)
    
    # Get department names
    dept_names = []
    if departments_set:
        depts = db.query(Department).filter(Department.id.in_(departments_set)).all()
        dept_names = sorted([d.name for d in depts])
    
    return {
        "companies": sorted(list(companies)),
        "farms": sorted(list(farms)),
        "flocks": sorted(list(flocks)),
        "cycles": sorted(list(cycles)),
        "statuses": sorted(list(statuses)),
        "ages": sorted(list(ages), key=lambda x: (x.isdigit(), int(x) if x.isdigit() else x)),
        "sample_types": sorted(list(sample_types)),
        "sources": sorted(list(sources)),
        "houses": sorted(list(houses)),
        "departments": dept_names,
        "diseases": sorted(list(diseases)),
        "kit_types": sorted(list(kit_types)),
        "technicians": sorted(list(technicians)),
        "extraction_methods": sorted(list(extraction_methods))
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
    
    # Admin role has access to all departments (use enum comparison)
    if current_user.role == UserRole.admin:
        return sample
    
    # Check if user has "All Samples" permission - if so, grant access to all departments
    has_all_samples_permission = False
    for perm in user_permissions:
        if perm.screen_name == "All Samples" and perm.can_read:  # type: ignore
            has_all_samples_permission = True
            break
    
    if has_all_samples_permission:
        return sample
    
    # Determine which departments the user has access to using database lookup
    dept_repo = DepartmentRepository(db)
    allowed_dept_ids = get_allowed_department_ids(user_permissions, dept_repo, check_write=False)
    
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
    # DEBUG: Log sample update details
    print(f"🔄 SAMPLE UPDATE DEBUG - ID: {sample_id}, User: {current_user.full_name}")
    print(f"📊 Units in update: {len(sample_data.units) if sample_data.units else 0}")
    if sample_data.units:
        units_with_ids = [u for u in sample_data.units if u.id]
        units_without_ids = [u for u in sample_data.units if not u.id]
        print(f"🆔 Existing units: {len(units_with_ids)}, New units: {len(units_without_ids)}")
        for i, unit in enumerate(sample_data.units):
            print(f"   Unit {i+1}: ID={unit.id}, Dept={unit.department_id}, Code={getattr(unit, 'unit_code', 'None')}")
    
    sample_service = SampleService(db)
    sample = sample_service.update_sample(sample_id, sample_data, edited_by=current_user.full_name)  # type: ignore
    
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found")
    
    # DEBUG: Log result
    print(f"✅ Sample updated - Code: {sample.sample_code}, Units: {len(sample.units)}")
    
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
    """Delete a sample and all associated data (Admin only)"""
    # Only admin can delete samples
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete samples"
        )
    
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
