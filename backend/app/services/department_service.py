from sqlalchemy.orm import Session
from typing import Optional, List
from app.repositories import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.models.department import Department


class DepartmentService:
    def __init__(self, db: Session):
        self.dept_repo = DepartmentRepository(db)
    
    def get_department_by_id(self, department_id: int) -> Optional[Department]:
        return self.dept_repo.get_by_id(department_id)
    
    def get_all_departments(self, skip: int = 0, limit: int = 100) -> List[Department]:
        return self.dept_repo.get_all(skip=skip, limit=limit)
    
    def create_department(self, department_data: DepartmentCreate) -> Optional[Department]:
        if self.dept_repo.get_by_code(department_data.code):
            return None
        return self.dept_repo.create(department_data)
    
    def update_department(self, department_id: int, department_data: DepartmentUpdate) -> Optional[Department]:
        return self.dept_repo.update(department_id, department_data)
    
    def delete_department(self, department_id: int) -> bool:
        return self.dept_repo.delete(department_id)
