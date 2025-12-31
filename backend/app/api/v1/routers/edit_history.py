from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.models.edit_history import EditHistory
from app.models.unit import Unit
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/edit-history", tags=["edit-history"])


class EditHistoryResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    edited_by: str
    edited_at: datetime
    sample_code: Optional[str]
    unit_code: Optional[str]

    class Config:
        from_attributes = True


class EditHistoryCreate(BaseModel):
    entity_type: str
    entity_id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    sample_code: Optional[str] = None
    unit_code: Optional[str] = None


@router.get("/sample/{sample_id}", response_model=List[EditHistoryResponse])
def get_sample_edit_history(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get edit history for a specific sample"""
    history = db.query(EditHistory).filter(
        EditHistory.entity_type == "sample",
        EditHistory.entity_id == sample_id
    ).order_by(EditHistory.edited_at.desc()).all()
    return history


@router.get("/unit/{unit_id}", response_model=List[EditHistoryResponse])
def get_unit_edit_history(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get edit history for a specific unit"""
    history = db.query(EditHistory).filter(
        EditHistory.entity_type == "unit",
        EditHistory.entity_id == unit_id
    ).order_by(EditHistory.edited_at.desc()).all()
    return history


@router.get("/by-code/{code}", response_model=List[EditHistoryResponse])
def get_edit_history_by_code(
    code: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get edit history for a sample or unit by code"""
    history = db.query(EditHistory).filter(
        (EditHistory.sample_code == code) | (EditHistory.unit_code == code)
    ).order_by(EditHistory.edited_at.desc()).all()
    return history


@router.get("/sample-complete/{sample_id}", response_model=List[EditHistoryResponse])
def get_complete_sample_edit_history(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get complete edit history for a sample and ALL its units across all departments"""
    # Get all unit IDs for this sample
    unit_ids = [u.id for u in db.query(Unit.id).filter(Unit.sample_id == sample_id).all()]
    
    # Get sample history
    sample_history = db.query(EditHistory).filter(
        EditHistory.entity_type == "sample",
        EditHistory.entity_id == sample_id
    ).all()
    
    # Get all units history
    units_history = []
    if unit_ids:
        units_history = db.query(EditHistory).filter(
            EditHistory.entity_type == "unit",
            EditHistory.entity_id.in_(unit_ids)
        ).all()
    
    # Combine and sort by date
    all_history = sample_history + units_history
    all_history.sort(key=lambda x: x.edited_at, reverse=True)
    
    return all_history


@router.get("/has-edits", response_model=dict)
def check_has_edits(
    entity_type: str = Query(...),
    entity_ids: str = Query(..., description="Comma-separated list of entity IDs"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Check if entities have been edited - returns dict of entity_id: bool"""
    ids = [int(id.strip()) for id in entity_ids.split(",") if id.strip()]
    
    # Get all entities that have edit history
    edited_entities = db.query(EditHistory.entity_id).filter(
        EditHistory.entity_type == entity_type,
        EditHistory.entity_id.in_(ids)
    ).distinct().all()
    
    edited_set = {e[0] for e in edited_entities}
    
    return {str(id): id in edited_set for id in ids}


@router.get("/edited-samples", response_model=List[int])
def get_edited_sample_ids(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all sample IDs that have been edited"""
    edited = db.query(EditHistory.entity_id).filter(
        EditHistory.entity_type == "sample"
    ).distinct().all()
    return [e[0] for e in edited]


@router.get("/edited-units", response_model=List[int])
def get_edited_unit_ids(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all unit IDs that have been edited"""
    edited = db.query(EditHistory.entity_id).filter(
        EditHistory.entity_type == "unit"
    ).distinct().all()
    return [e[0] for e in edited]


@router.post("/", response_model=EditHistoryResponse)
def create_edit_history(
    data: EditHistoryCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Record an edit to a sample or unit"""
    history = EditHistory(
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        field_name=data.field_name,
        old_value=data.old_value,
        new_value=data.new_value,
        edited_by=current_user.full_name,
        sample_code=data.sample_code,
        unit_code=data.unit_code
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history
