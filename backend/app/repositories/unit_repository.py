from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql.sqltypes import Integer
from app.models.unit import Unit
from typing import List, Optional, Union, Any


class UnitRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(
        self, 
        sample_id: Union[int, "Integer"],
        department_id: int, 
        unit_code: str,
        house: Optional[Union[List[str], str]] = None,
        age: Optional[str] = None,  # Changed from int to str
        source: Optional[str] = None,
        sample_type: Optional[Union[List[str], str]] = None,
        samples_number: Optional[int] = None,
        notes: Optional[str] = None
    ) -> Unit:
        unit = Unit(
            sample_id=sample_id,
            department_id=department_id,
            unit_code=unit_code,
            house=house,
            age=age,
            source=source,
            sample_type=sample_type,
            samples_number=samples_number,
            notes=notes
        )
        self.db.add(unit)
        return unit
    
    def get_by_id(self, unit_id: int) -> Optional[Unit]:
        return self.db.query(Unit).options(
            joinedload(Unit.sample),
            joinedload(Unit.department),
            joinedload(Unit.pcr_data),
            joinedload(Unit.serology_data),
            joinedload(Unit.microbiology_data)
        ).filter(Unit.id == unit_id).first()
    
    def get_by_sample_id(self, sample_id: int) -> List[Unit]:
        return self.db.query(Unit).filter(Unit.sample_id == sample_id).all()
    
    def get_by_department_id(self, department_id: int) -> List[Unit]:
        return self.db.query(Unit).filter(Unit.department_id == department_id).all()
    
    def update(self, unit_id: int, **kwargs) -> Optional[Unit]:
        unit = self.get_by_id(unit_id)
        if not unit:
            return None
        
        for key, value in kwargs.items():
            if hasattr(unit, key):
                setattr(unit, key, value)
        
        self.db.commit()
        self.db.refresh(unit)
        return unit
    
    def delete(self, unit_id: int) -> bool:
        unit = self.get_by_id(unit_id)
        if unit:
            self.db.delete(unit)
            self.db.commit()
            return True
        return False
