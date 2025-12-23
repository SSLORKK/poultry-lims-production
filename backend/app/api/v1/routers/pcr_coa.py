from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.repositories import PCRCOARepository
from app.schemas.pcr_coa import PCRCOACreate, PCRCOAUpdate, PCRCOAResponse
from typing import List

router = APIRouter(prefix="/pcr-coa", tags=["PCR COA"])


@router.get("/batch/", response_model=List[PCRCOAResponse])
def get_coas_by_unit_ids(
    unit_ids: str = Query(..., description="Comma-separated list of unit IDs"),
    db: Session = Depends(get_db)
):
    """Get multiple PCR COAs by unit IDs (batch fetch for performance)"""
    coa_repo = PCRCOARepository(db)
    # Parse comma-separated string to list of integers
    try:
        ids = [int(id.strip()) for id in unit_ids.split(',') if id.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid unit_ids format. Expected comma-separated integers."
        )
    return coa_repo.get_by_unit_ids(ids)


@router.get("/{unit_id}/", response_model=PCRCOAResponse)
def get_coa_by_unit(
    unit_id: int,
    db: Session = Depends(get_db)
):
    """Get PCR COA by unit ID"""
    coa_repo = PCRCOARepository(db)
    coa = coa_repo.get_by_unit_id(unit_id)
    
    if not coa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"COA not found for unit ID {unit_id}"
        )
    
    return coa


@router.post("/", response_model=PCRCOAResponse, status_code=status.HTTP_201_CREATED)
def create_coa(
    coa_data: PCRCOACreate,
    db: Session = Depends(get_db)
):
    """Create a new PCR COA"""
    coa_repo = PCRCOARepository(db)
    
    # Check if COA already exists for this unit
    existing_coa = coa_repo.get_by_unit_id(coa_data.unit_id)
    if existing_coa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"COA already exists for unit ID {coa_data.unit_id}"
        )
    
    return coa_repo.create(coa_data)


@router.put("/{unit_id}/", response_model=PCRCOAResponse)
def update_coa(
    unit_id: int,
    coa_data: PCRCOAUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing PCR COA"""
    coa_repo = PCRCOARepository(db)
    updated_coa = coa_repo.update(unit_id, coa_data)
    
    if not updated_coa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"COA not found for unit ID {unit_id}"
        )
    
    return updated_coa


@router.delete("/{unit_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_coa(
    unit_id: int,
    db: Session = Depends(get_db)
):
    """Delete a PCR COA"""
    coa_repo = PCRCOARepository(db)
    deleted = coa_repo.delete(unit_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"COA not found for unit ID {unit_id}"
        )
    
    return None
