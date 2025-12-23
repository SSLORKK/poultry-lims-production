from sqlalchemy.orm import Session
from typing import List, Optional, Type, TypeVar, Any
from app.db.base import Base

T = TypeVar('T', bound=Base)


class DropdownRepository:
    """Generic repository for dropdown master data"""
    
    def __init__(self, db: Session, model: Type[T]):
        self.db = db
        self.model = model
    
    def get_all(self, include_inactive: bool = False) -> List[Any]:
        """Get all items, optionally including inactive ones"""
        query = self.db.query(self.model)
        if not include_inactive:
            query = query.filter(self.model.is_active == True)
        return query.order_by(self.model.name).all()
    
    def get_by_id(self, item_id: int) -> Optional[T]:
        """Get item by ID"""
        return self.db.query(self.model).filter(self.model.id == item_id).first()
    
    def get_by_name(self, name: str) -> Optional[T]:
        """Get item by name"""
        return self.db.query(self.model).filter(self.model.name == name).first()
    
    def create(self, name: str, **kwargs) -> T:
        """Create new item"""
        item = self.model(name=name, **kwargs)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def update(self, item_id: int, **kwargs) -> Optional[T]:
        """Update item"""
        item = self.get_by_id(item_id)
        if not item:
            return None
        
        for key, value in kwargs.items():
            if hasattr(item, key) and value is not None:
                setattr(item, key, value)
        
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def delete(self, item_id: int) -> bool:
        """Soft delete item by setting is_active to False"""
        item = self.get_by_id(item_id)
        if not item:
            return False
        
        item.is_active = False
        self.db.commit()
        return True
    
    def hard_delete(self, item_id: int) -> bool:
        """Permanently delete item from database"""
        item = self.get_by_id(item_id)
        if not item:
            return False
        
        self.db.delete(item)
        self.db.commit()
        return True


class DepartmentDropdownRepository(DropdownRepository):
    """Repository for department-specific dropdown data (SampleType, Disease, KitType)"""
    
    def get_by_department(self, department_id: int, include_inactive: bool = False) -> List[Any]:
        """Get all items for a specific department"""
        query = self.db.query(self.model).filter(self.model.department_id == department_id)
        if not include_inactive:
            query = query.filter(self.model.is_active == True)
        return query.order_by(self.model.name).all()
