from sqlalchemy.orm import Session
from app.models.pcr_coa import PCRCOA
from app.schemas.pcr_coa import PCRCOACreate, PCRCOAUpdate
from typing import Optional, List


class PCRCOARepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_unit_id(self, unit_id: int) -> Optional[PCRCOA]:
        return self.db.query(PCRCOA).filter(PCRCOA.unit_id == unit_id).first()

    def get_by_unit_ids(self, unit_ids: List[int]) -> List[PCRCOA]:
        """Batch fetch COAs by multiple unit IDs for performance"""
        return self.db.query(PCRCOA).filter(PCRCOA.unit_id.in_(unit_ids)).all()

    def create(self, coa_data: PCRCOACreate) -> PCRCOA:
        db_coa = PCRCOA(**coa_data.model_dump())
        self.db.add(db_coa)
        self.db.commit()
        self.db.refresh(db_coa)
        return db_coa

    def update(self, unit_id: int, coa_data: PCRCOAUpdate) -> Optional[PCRCOA]:
        db_coa = self.get_by_unit_id(unit_id)
        if not db_coa:
            return None
        
        update_data = coa_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_coa, key, value)
        
        self.db.commit()
        self.db.refresh(db_coa)
        return db_coa

    def delete(self, unit_id: int) -> bool:
        db_coa = self.get_by_unit_id(unit_id)
        if not db_coa:
            return False
        
        self.db.delete(db_coa)
        self.db.commit()
        return True
