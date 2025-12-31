from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date


# Disease-Kit item schema
class DiseaseKitItem(BaseModel):
    disease: str
    kit_type: str
    test_count: Optional[int] = 1


# Department-specific data schemas
class PCRDataCreate(BaseModel):
    diseases_list: Optional[List[DiseaseKitItem]] = []
    kit_type: Optional[str] = None
    technician_name: Optional[str] = None
    extraction_method: Optional[str] = None
    extraction: Optional[int] = None
    detection: Optional[int] = None


class PCRDataResponse(BaseModel):
    id: int
    unit_id: int
    diseases_list: Optional[List[Dict[str, Any]]] = []
    kit_type: Optional[str] = None
    technician_name: Optional[str] = None
    extraction_method: Optional[str] = None
    extraction: Optional[int] = None
    detection: Optional[int] = None
    
    class Config:
        from_attributes = True


class SerologyDataCreate(BaseModel):
    diseases_list: Optional[List[DiseaseKitItem]] = []
    kit_type: Optional[str] = None
    number_of_wells: Optional[int] = None
    tests_count: Optional[int] = None
    technician_name: Optional[str] = None


class SerologyDataResponse(BaseModel):
    id: int
    unit_id: int
    diseases_list: Optional[List[Dict[str, Any]]] = []
    kit_type: Optional[str] = None
    number_of_wells: Optional[int] = None
    tests_count: Optional[int] = None
    technician_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class MicrobiologyDataCreate(BaseModel):
    diseases_list: Optional[List[str]] = []
    batch_no: Optional[str] = None
    fumigation: Optional[str] = None  # "Before Fumigation" or "After Fumigation"
    index_list: Optional[List[str]] = []
    technician_name: Optional[str] = None


class MicrobiologyDataResponse(MicrobiologyDataCreate):
    id: int
    unit_id: int
    
    class Config:
        from_attributes = True


# Unit schemas
class UnitData(BaseModel):
    id: Optional[int] = None  # Include unit ID for updates
    unit_code: Optional[str] = None  # Include unit code to preserve during updates
    department_id: int
    house: Optional[List[str]] = None  # Multi-select houses
    age: Optional[str] = None  # Changed from int to str
    source: Optional[List[str]] = None  # Multi-select sources
    sample_type: Optional[List[str]] = None  # Multi-select sample types (organs)
    samples_number: Optional[int] = None
    notes: Optional[str] = None
    pcr_data: Optional[PCRDataCreate] = None
    serology_data: Optional[SerologyDataCreate] = None
    microbiology_data: Optional[MicrobiologyDataCreate] = None


class UnitResponse(BaseModel):
    id: int
    unit_code: str
    department_id: int
    house: Optional[List[str]] = None  # Multi-select houses
    age: Optional[str] = None  # Changed from int to str
    source: Optional[List[str]] = None  # Multi-select sources
    sample_type: Optional[List[str]] = None  # Multi-select sample types (organs)
    samples_number: Optional[int] = None
    notes: Optional[str] = None
    coa_status: Optional[str] = None  # null, 'created', 'finalized'
    pcr_data: Optional[PCRDataResponse] = None
    serology_data: Optional[SerologyDataResponse] = None
    microbiology_data: Optional[MicrobiologyDataResponse] = None
    # Edit tracking fields
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_edited_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# Sample schemas
class SampleBase(BaseModel):
    date_received: date
    company: str
    farm: str
    cycle: Optional[str] = None
    flock: Optional[str] = None
    status: str = "pending"


class SampleCreate(SampleBase):
    units: List[UnitData]


class SampleUpdate(BaseModel):
    date_received: Optional[date] = None
    company: Optional[str] = None
    farm: Optional[str] = None
    cycle: Optional[str] = None
    flock: Optional[str] = None
    status: Optional[str] = None
    units: Optional[List[UnitData]] = None


class SampleResponse(SampleBase):
    id: int
    sample_code: str
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    units: List[UnitResponse] = []
    
    class Config:
        from_attributes = True
