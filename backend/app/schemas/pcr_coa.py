from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union
from datetime import date


class TestResultPool(BaseModel):
    """Pooled test result format"""
    houses: str = ""
    values: Dict[str, str] = {}  # {sample_type: result}
    pos_control: str = ""


class PCRCOABase(BaseModel):
    test_results: Optional[Dict[str, Any]] = {}  # Accepts both old format and new pooled format
    date_tested: Optional[date] = None
    tested_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    lab_supervisor: Optional[str] = None
    lab_manager: Optional[str] = None
    notes: Optional[str] = None
    status: str = "draft"


class PCRCOACreate(PCRCOABase):
    unit_id: int


class PCRCOAUpdate(BaseModel):
    test_results: Optional[Dict[str, Any]] = None  # Accepts both old format and new pooled format
    date_tested: Optional[date] = None
    tested_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    lab_supervisor: Optional[str] = None
    lab_manager: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class PCRCOAResponse(PCRCOABase):
    id: int
    unit_id: int

    class Config:
        from_attributes = True
