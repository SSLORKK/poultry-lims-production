from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate


class DepartmentRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_id(self, department_id: int) -> Optional[Department]:
        return self.db.query(Department).filter(Department.id == department_id).first()
    
    def get_by_code(self, code: str) -> Optional[Department]:
        return self.db.query(Department).filter(Department.code == code).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[Department]:
        return self.db.query(Department).offset(skip).limit(limit).all()
    
    def create(self, department_data: DepartmentCreate) -> Department:
        db_department = Department(**department_data.model_dump())
        self.db.add(db_department)
        self.db.commit()
        self.db.refresh(db_department)
        return db_department
    
    def update(self, department_id: int, department_data: DepartmentUpdate) -> Optional[Department]:
        db_department = self.get_by_id(department_id)
        if not db_department:
            return None
        
        update_data = department_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_department, field, value)
        
        self.db.commit()
        self.db.refresh(db_department)
        return db_department
    
    def delete(self, department_id: int) -> bool:
        db_department = self.get_by_id(department_id)
        if not db_department:
            return False
        
        self.db.delete(db_department)
        self.db.commit()
        return True
