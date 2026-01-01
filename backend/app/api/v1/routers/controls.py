from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.session import get_db
from app.models.user import User
from app.api.v1.deps import get_current_user
from app.schemas.dropdown import (
    DropdownCreate, DropdownResponse, DropdownUpdate,
    DepartmentDropdownCreate, DepartmentDropdownResponse, DepartmentDropdownUpdate,
    SignatureCreate, SignatureResponse, PINVerifyRequest, PINVerifyResponse,
    FarmCreate, FarmResponse
)
from app.repositories.dropdown_repository import DropdownRepository, DepartmentDropdownRepository
from app.models.dropdown_data import (
    Company, Farm, Flock, Cycle, Status, House, Source,
    SampleType, Disease, KitType, Technician, Signature, ExtractionMethod,
    CultureIsolationType, PathogenicFungiMold, CultureScreenedPathogen, ASTDisk,
    ASTDiskFastidious, ASTDiskStaphylococcus, ASTDiskEnterococcus
)
import bcrypt

router = APIRouter()


@router.get("/companies", response_model=List[DropdownResponse])
def get_companies(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Company)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/companies", response_model=DropdownResponse)
def create_company(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Company)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Company already exists")
    return repo.create(name=data.name)


@router.put("/companies/{item_id}", response_model=DropdownResponse)
def update_company(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Company)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Company not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/companies/{item_id}")
def delete_company(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Company)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Company deleted successfully"}


@router.get("/farms", response_model=List[FarmResponse])
def get_farms(
    company_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Farm)
    if not include_inactive:
        query = query.filter(Farm.is_active == True)
    if company_id is not None:
        query = query.filter(Farm.company_id == company_id)
    return query.all()


@router.post("/farms", response_model=FarmResponse)
def create_farm(
    data: FarmCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if farm with same name exists for this company
    existing = db.query(Farm).filter(
        Farm.name == data.name,
        Farm.company_id == data.company_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Farm already exists for this company")
    
    farm = Farm(name=data.name, company_id=data.company_id)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


@router.put("/farms/{item_id}", response_model=FarmResponse)
def update_farm(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    farm = db.query(Farm).filter(Farm.id == item_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    farm.name = data.name
    db.commit()
    db.refresh(farm)
    return farm


@router.delete("/farms/{item_id}")
def delete_farm(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    farm = db.query(Farm).filter(Farm.id == item_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    db.delete(farm)
    db.commit()
    return {"message": "Farm deleted successfully"}


@router.get("/flocks", response_model=List[DropdownResponse])
def get_flocks(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Flock)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/flocks", response_model=DropdownResponse)
def create_flock(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Flock)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Flock already exists")
    return repo.create(name=data.name)


@router.put("/flocks/{item_id}", response_model=DropdownResponse)
def update_flock(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Flock)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Flock not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/flocks/{item_id}")
def delete_flock(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Flock)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Flock not found")
    return {"message": "Flock deleted successfully"}


@router.get("/cycles", response_model=List[DropdownResponse])
def get_cycles(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Cycle)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/cycles", response_model=DropdownResponse)
def create_cycle(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Cycle)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Cycle already exists")
    return repo.create(name=data.name)


@router.put("/cycles/{item_id}", response_model=DropdownResponse)
def update_cycle(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Cycle)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cycle not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/cycles/{item_id}")
def delete_cycle(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Cycle)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Cycle not found")
    return {"message": "Cycle deleted successfully"}


@router.get("/statuses", response_model=List[DropdownResponse])
def get_statuses(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Status)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/statuses", response_model=DropdownResponse)
def create_status(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Status)
    existing = repo.get_by_name(data.name)
    if existing:
        # If item exists but is inactive, reactivate it
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="Status already exists")
    return repo.create(name=data.name)


@router.put("/statuses/{item_id}", response_model=DropdownResponse)
def update_status(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Status)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Status not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/statuses/{item_id}")
def delete_status(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Status)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Status not found")
    return {"message": "Status deleted successfully"}


@router.get("/houses", response_model=List[DropdownResponse])
def get_houses(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, House)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/houses", response_model=DropdownResponse)
def create_house(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, House)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="House already exists")
    return repo.create(name=data.name)


@router.put("/houses/{item_id}", response_model=DropdownResponse)
def update_house(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, House)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="House not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/houses/{item_id}")
def delete_house(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, House)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="House not found")
    return {"message": "House deleted successfully"}


@router.get("/sources", response_model=List[DropdownResponse])
def get_sources(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Source)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/sources", response_model=DropdownResponse)
def create_source(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Source)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Source already exists")
    return repo.create(name=data.name)


@router.put("/sources/{item_id}", response_model=DropdownResponse)
def update_source(
    item_id: int,
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Source)
    item = repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Source not found")
    item.name = data.name
    db.commit()
    db.refresh(item)
    return item


@router.delete("/sources/{item_id}")
def delete_source(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Source)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Source not found")
    return {"message": "Source deleted successfully"}


@router.get("/sample-types", response_model=List[DepartmentDropdownResponse])
def get_sample_types(
    department_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, SampleType)
    if department_id:
        return repo.get_by_department(department_id, include_inactive=include_inactive)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/sample-types", response_model=DepartmentDropdownResponse)
def create_sample_type(
    data: DepartmentDropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, SampleType)
    return repo.create(name=data.name, department_id=data.department_id)


@router.delete("/sample-types/{item_id}")
def delete_sample_type(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, SampleType)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Sample type not found")
    return {"message": "Sample type deleted successfully"}


@router.get("/diseases", response_model=List[DepartmentDropdownResponse])
def get_diseases(
    department_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, Disease)
    if department_id:
        return repo.get_by_department(department_id, include_inactive=include_inactive)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/diseases", response_model=DepartmentDropdownResponse)
def create_disease(
    data: DepartmentDropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, Disease)
    return repo.create(name=data.name, department_id=data.department_id)


@router.delete("/diseases/{item_id}")
def delete_disease(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, Disease)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Disease not found")
    return {"message": "Disease deleted successfully"}


@router.get("/kit-types", response_model=List[DepartmentDropdownResponse])
def get_kit_types(
    department_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if department_id:
        from app.repositories.department_repository import DepartmentRepository
        dept_repo = DepartmentRepository(db)
        department = dept_repo.get_by_id(department_id)
        
        if not department or department.code not in ['PCR', 'SER']:
            raise HTTPException(
                status_code=400,
                detail="Kit types can only be retrieved for PCR or Serology departments"
            )
    
    repo = DepartmentDropdownRepository(db, KitType)
    if department_id:
        return repo.get_by_department(department_id, include_inactive=include_inactive)
    
    return [item for item in repo.get_all(include_inactive=include_inactive) 
            if item.department.code in ['PCR', 'SER']]


@router.post("/kit-types", response_model=DepartmentDropdownResponse)
def create_kit_type(
    data: DepartmentDropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.repositories.department_repository import DepartmentRepository
    dept_repo = DepartmentRepository(db)
    department = dept_repo.get_by_id(data.department_id)
    
    if not department or department.code not in ['PCR', 'SER']:
        raise HTTPException(
            status_code=400, 
            detail="Kit types can only be created for PCR or Serology departments"
        )
    
    repo = DepartmentDropdownRepository(db, KitType)
    return repo.create(name=data.name, department_id=data.department_id)


@router.delete("/kit-types/{item_id}")
def delete_kit_type(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DepartmentDropdownRepository(db, KitType)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Kit type not found")
    return {"message": "Kit type deleted successfully"}


@router.get("/technicians", response_model=List[DropdownResponse])
def get_technicians(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Technician)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/technicians", response_model=DropdownResponse)
def create_technician(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Technician)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Technician already exists")
    return repo.create(name=data.name)


@router.delete("/technicians/{item_id}")
def delete_technician(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Technician)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"message": "Technician deleted successfully"}


# Signature endpoints for e-signature system
@router.get("/signatures", response_model=List[SignatureResponse])
def get_signatures(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Signature)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/signatures", response_model=SignatureResponse)
def create_signature(
    data: SignatureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate PIN length (6-8 digits)
    if not data.pin.isdigit() or len(data.pin) < 6 or len(data.pin) > 8:
        raise HTTPException(
            status_code=400, 
            detail="PIN must be 6-8 digits"
        )
    
    # Check if signature with this name already exists
    existing = db.query(Signature).filter(Signature.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Signature with this name already exists")
    
    # Hash the PIN using bcrypt
    pin_bytes = data.pin.encode('utf-8')
    salt = bcrypt.gensalt()
    pin_hash = bcrypt.hashpw(pin_bytes, salt).decode('utf-8')
    
    # Create the signature
    signature = Signature(
        name=data.name,
        pin_hash=pin_hash,
        signature_image=data.signature_image,
        is_active=True
    )
    db.add(signature)
    db.commit()
    db.refresh(signature)
    
    return signature


@router.delete("/signatures/{item_id}")
def delete_signature(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, Signature)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Signature not found")
    return {"message": "Signature deleted successfully"}


@router.post("/signatures/verify-pin", response_model=PINVerifyResponse)
def verify_pin(
    data: PINVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find all active signatures and check the PIN against each one
    signatures = db.query(Signature).filter(Signature.is_active == True).all()
    
    pin_bytes = data.pin.encode('utf-8')
    
    for sig in signatures:
        # Verify PIN using bcrypt
        pin_hash_bytes = sig.pin_hash.encode('utf-8')
        if bcrypt.checkpw(pin_bytes, pin_hash_bytes):
            return PINVerifyResponse(name=str(sig.name), is_valid=True, signature_image=sig.signature_image)
    
    # No matching PIN found
    return PINVerifyResponse(name="", is_valid=False, signature_image=None)


@router.get("/signatures/by-name/{name}")
def get_signature_by_name(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get signature image by name (for auto-populating Tested By field)"""
    signature = db.query(Signature).filter(
        Signature.name == name,
        Signature.is_active == True
    ).first()
    
    if signature:
        return {"name": signature.name, "signature_image": signature.signature_image}
    return {"name": name, "signature_image": None}


@router.get("/extraction-methods", response_model=List[DropdownResponse])
def get_extraction_methods(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, ExtractionMethod)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/extraction-methods", response_model=DropdownResponse)
def create_extraction_method(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, ExtractionMethod)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Extraction method already exists")
    return repo.create(name=data.name)


@router.delete("/extraction-methods/{item_id}")
def delete_extraction_method(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, ExtractionMethod)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Extraction method not found")
    return {"message": "Extraction method deleted successfully"}


@router.get("/culture-isolation-types", response_model=List[DropdownResponse])
def get_culture_isolation_types(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureIsolationType)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/culture-isolation-types", response_model=DropdownResponse)
def create_culture_isolation_type(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureIsolationType)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Culture isolation type already exists")
    return repo.create(name=data.name)


@router.delete("/culture-isolation-types/{item_id}")
def delete_culture_isolation_type(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureIsolationType)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Culture isolation type not found")
    return {"message": "Culture isolation type deleted successfully"}


@router.get("/pathogenic-fungi-mold", response_model=List[DropdownResponse])
def get_pathogenic_fungi_mold(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, PathogenicFungiMold)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/pathogenic-fungi-mold", response_model=DropdownResponse)
def create_pathogenic_fungi_mold(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, PathogenicFungiMold)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Pathogenic Fungi & Mold already exists")
    return repo.create(name=data.name)


@router.delete("/pathogenic-fungi-mold/{item_id}")
def delete_pathogenic_fungi_mold(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, PathogenicFungiMold)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Pathogenic Fungi & Mold not found")
    return {"message": "Pathogenic Fungi & Mold deleted successfully"}


@router.get("/culture-screened-pathogens", response_model=List[DropdownResponse])
def get_culture_screened_pathogens(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureScreenedPathogen)
    return repo.get_all(include_inactive=include_inactive)


@router.post("/culture-screened-pathogens", response_model=DropdownResponse)
def create_culture_screened_pathogen(
    data: DropdownCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureScreenedPathogen)
    if repo.get_by_name(data.name):
        raise HTTPException(status_code=400, detail="Culture screened pathogen already exists")
    return repo.create(name=data.name)


@router.delete("/culture-screened-pathogens/{item_id}")
def delete_culture_screened_pathogen(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = DropdownRepository(db, CultureScreenedPathogen)
    if not repo.delete(item_id):
        raise HTTPException(status_code=404, detail="Culture screened pathogen not found")
    return {"message": "Culture screened pathogen deleted successfully"}


# AST Disk endpoints
class ASTDiskResponse(BaseModel):
    id: int
    name: str
    r_value: Optional[str] = None
    i_value: Optional[str] = None
    s_value: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class ASTDiskCreate(BaseModel):
    name: str
    r_value: Optional[str] = None
    i_value: Optional[str] = None
    s_value: Optional[str] = None


@router.get("/ast-disks", response_model=List[ASTDiskResponse])
def get_ast_disks(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ASTDisk)
    if not include_inactive:
        query = query.filter(ASTDisk.is_active == True)
    return query.order_by(ASTDisk.name).all()


@router.post("/ast-disks", response_model=ASTDiskResponse)
def create_ast_disk(
    data: ASTDiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(ASTDisk).filter(ASTDisk.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="AST Disk already exists")
    
    ast_disk = ASTDisk(
        name=data.name,
        r_value=data.r_value,
        i_value=data.i_value,
        s_value=data.s_value
    )
    db.add(ast_disk)
    db.commit()
    db.refresh(ast_disk)
    return ast_disk


@router.put("/ast-disks/{item_id}", response_model=ASTDiskResponse)
def update_ast_disk(
    item_id: int,
    data: ASTDiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ast_disk = db.query(ASTDisk).filter(ASTDisk.id == item_id).first()
    if not ast_disk:
        raise HTTPException(status_code=404, detail="AST Disk not found")
    
    ast_disk.name = data.name
    ast_disk.r_value = data.r_value
    ast_disk.i_value = data.i_value
    ast_disk.s_value = data.s_value
    db.commit()
    db.refresh(ast_disk)
    return ast_disk


@router.delete("/ast-disks/{item_id}")
def delete_ast_disk(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ast_disk = db.query(ASTDisk).filter(ASTDisk.id == item_id).first()
    if not ast_disk:
        raise HTTPException(status_code=404, detail="AST Disk not found")
    db.delete(ast_disk)
    db.commit()
    return {"message": "AST Disk deleted successfully"}


# AST Disk Fastidious endpoints
@router.get("/ast-disks-fastidious", response_model=List[ASTDiskResponse])
def get_ast_disks_fastidious(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ASTDiskFastidious)
    if not include_inactive:
        query = query.filter(ASTDiskFastidious.is_active == True)
    return query.order_by(ASTDiskFastidious.name).all()


@router.post("/ast-disks-fastidious", response_model=ASTDiskResponse)
def create_ast_disk_fastidious(
    data: ASTDiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(ASTDiskFastidious).filter(ASTDiskFastidious.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="AST Disk already exists")
    
    ast_disk = ASTDiskFastidious(
        name=data.name,
        r_value=data.r_value,
        i_value=data.i_value,
        s_value=data.s_value
    )
    db.add(ast_disk)
    db.commit()
    db.refresh(ast_disk)
    return ast_disk


@router.delete("/ast-disks-fastidious/{item_id}")
def delete_ast_disk_fastidious(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ast_disk = db.query(ASTDiskFastidious).filter(ASTDiskFastidious.id == item_id).first()
    if not ast_disk:
        raise HTTPException(status_code=404, detail="AST Disk not found")
    db.delete(ast_disk)
    db.commit()
    return {"message": "AST Disk deleted successfully"}


# AST Disk Staphylococcus endpoints
@router.get("/ast-disks-staphylococcus", response_model=List[ASTDiskResponse])
def get_ast_disks_staphylococcus(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ASTDiskStaphylococcus)
    if not include_inactive:
        query = query.filter(ASTDiskStaphylococcus.is_active == True)
    return query.order_by(ASTDiskStaphylococcus.name).all()


@router.post("/ast-disks-staphylococcus", response_model=ASTDiskResponse)
def create_ast_disk_staphylococcus(
    data: ASTDiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(ASTDiskStaphylococcus).filter(ASTDiskStaphylococcus.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="AST Disk already exists")
    
    ast_disk = ASTDiskStaphylococcus(
        name=data.name,
        r_value=data.r_value,
        i_value=data.i_value,
        s_value=data.s_value
    )
    db.add(ast_disk)
    db.commit()
    db.refresh(ast_disk)
    return ast_disk


@router.delete("/ast-disks-staphylococcus/{item_id}")
def delete_ast_disk_staphylococcus(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ast_disk = db.query(ASTDiskStaphylococcus).filter(ASTDiskStaphylococcus.id == item_id).first()
    if not ast_disk:
        raise HTTPException(status_code=404, detail="AST Disk not found")
    db.delete(ast_disk)
    db.commit()
    return {"message": "AST Disk deleted successfully"}


# AST Disk Enterococcus endpoints
@router.get("/ast-disks-enterococcus", response_model=List[ASTDiskResponse])
def get_ast_disks_enterococcus(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ASTDiskEnterococcus)
    if not include_inactive:
        query = query.filter(ASTDiskEnterococcus.is_active == True)
    return query.order_by(ASTDiskEnterococcus.name).all()


@router.post("/ast-disks-enterococcus", response_model=ASTDiskResponse)
def create_ast_disk_enterococcus(
    data: ASTDiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(ASTDiskEnterococcus).filter(ASTDiskEnterococcus.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="AST Disk already exists")
    
    ast_disk = ASTDiskEnterococcus(
        name=data.name,
        r_value=data.r_value,
        i_value=data.i_value,
        s_value=data.s_value
    )
    db.add(ast_disk)
    db.commit()
    db.refresh(ast_disk)
    return ast_disk


@router.delete("/ast-disks-enterococcus/{item_id}")
def delete_ast_disk_enterococcus(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ast_disk = db.query(ASTDiskEnterococcus).filter(ASTDiskEnterococcus.id == item_id).first()
    if not ast_disk:
        raise HTTPException(status_code=404, detail="AST Disk not found")
    db.delete(ast_disk)
    db.commit()
    return {"message": "AST Disk deleted successfully"}
