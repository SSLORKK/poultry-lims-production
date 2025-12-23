from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import distinct, func, or_
from typing import Optional, List
from app.models.sample import Sample
from app.models.unit import Unit
from app.schemas.sample import SampleUpdate


class SampleRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_id(self, sample_id: int) -> Optional[Sample]:
        """Get sample by ID with optimized eager loading"""
        return self.db.query(Sample).options(
            selectinload(Sample.units).selectinload(Unit.department),
            selectinload(Sample.units).selectinload(Unit.pcr_data),
            selectinload(Sample.units).selectinload(Unit.serology_data),
            selectinload(Sample.units).selectinload(Unit.microbiology_data)
        ).filter(Sample.id == sample_id).first()
    
    def get_by_sample_code(self, sample_code: str) -> Optional[Sample]:
        return self.db.query(Sample).filter(Sample.sample_code == sample_code).first()
    
    def get_all(self, skip: int = 0, limit: int = 100, department_id: Optional[int] = None, year: Optional[int] = None, 
               search: Optional[str] = None, company: Optional[List[str]] = None, farm: Optional[List[str]] = None, flock: Optional[List[str]] = None, 
               date_from: Optional[str] = None, date_to: Optional[str] = None, age: Optional[List[str]] = None, 
               sample_type: Optional[List[str]] = None) -> List[Sample]:
        """Get samples with intelligent filtering: 
        - No filters (only year/department): Returns last 100 samples ordered by ID DESC (most recent first)
        - Any other filter applied: Returns ALL matching records
        - Year filter is always applied but doesn't count as a 'filter' for limit logic
        """
        # Use selectinload instead of joinedload for better performance with collections
        query = self.db.query(Sample).options(
            selectinload(Sample.units).selectinload(Unit.department),
            selectinload(Sample.units).selectinload(Unit.pcr_data),
            selectinload(Sample.units).selectinload(Unit.serology_data),
            selectinload(Sample.units).selectinload(Unit.microbiology_data)
        )
        
        # Filter by year
        if year is not None:
            query = query.filter(Sample.year == year)
        
        # Filter by date range
        if date_from is not None:
            query = query.filter(Sample.date_received >= date_from)
        if date_to is not None:
            query = query.filter(Sample.date_received <= date_to)
        
        # Apply sample-level filters (company, farm, flock)
        if company is not None and len(company) > 0:
            query = query.filter(Sample.company.in_(company))
        
        if farm is not None and len(farm) > 0:
            query = query.filter(Sample.farm.in_(farm))
        
        if flock is not None and len(flock) > 0:
            query = query.filter(Sample.flock.in_(flock))
            
        # Global search
        if search:
            search_term = f"%{search}%"
            # Join with Unit if not already joined (for department_id)
            if department_id is None:
                query = query.join(Unit)
            
            query = query.filter(
                or_(
                    Sample.sample_code.ilike(search_term),
                    Sample.company.ilike(search_term),
                    Sample.farm.ilike(search_term),
                    Sample.flock.ilike(search_term),
                    Unit.unit_code.ilike(search_term)
                )
            ).distinct()
        
        # Filter by department at SQL level if specified (join with units)
        if department_id is not None:
            # Only join if not already joined for search
            if not search:
                query = query.join(Unit)
            query = query.filter(Unit.department_id == department_id).distinct()
        
        # Order by ID DESC to get latest created samples first
        query = query.order_by(Sample.id.desc())
        
        # Check if filters are applied (excluding year and department which are commonly set)
        has_filters = (
            search is not None or
            date_from is not None or
            date_to is not None or
            (company is not None and len(company) > 0) or
            (farm is not None and len(farm) > 0) or
            (flock is not None and len(flock) > 0) or
            (age is not None and len(age) > 0) or
            (sample_type is not None and len(sample_type) > 0)
        )
        
        # Get samples based on filter status
        # If search is active, we still want pagination to work, but we might want to return more results if needed
        # For now, we'll respect the limit/skip for search results too, to avoid performance issues
        if has_filters:
            # If filters are applied, we still want to support pagination!
            # The previous logic returned ALL records if filters were applied, which defeats the purpose of pagination
            # We should apply skip/limit even with filters
            samples = query.offset(skip).limit(limit).all()
        else:
            # No filters: apply default limit for performance
            samples = query.offset(skip).limit(limit).all()
        
        # Filter units by department, age, and sample_type at Python level
        if department_id is not None or (age is not None and len(age) > 0) or (sample_type is not None and len(sample_type) > 0):
            filtered_samples = []
            
            for sample in samples:
                # Filter units based on criteria
                filtered_units = []
                for unit in sample.units:
                    # Apply department filter if specified
                    if department_id is not None and unit.department_id != department_id:
                        continue
                    
                    # Apply age filter
                    if age is not None and len(age) > 0 and (unit.age is None or unit.age not in age):
                        continue
                    
                    # Apply sample type filter - check if unit has ANY of the selected sample types
                    if sample_type is not None and len(sample_type) > 0:
                        # unit.sample_type is a JSON array like ['Liver', 'Heart']
                        # sample_type is selected filters like ['Liver', 'Spleen']
                        # Keep unit if it has at least one matching sample type
                        if not unit.sample_type:
                            continue  # Skip if unit has no sample types
                        
                        # Check if any of the unit's sample types match the filter
                        has_match = False
                        for unit_st in unit.sample_type:
                            if unit_st in sample_type:
                                has_match = True
                                break
                        
                        if not has_match:
                            continue  # Skip this unit if no match found
                    
                    filtered_units.append(unit)
                
                # Only include sample if it has matching units
                if filtered_units:
                    # Replace sample.units with filtered units
                    sample.units = filtered_units
                    filtered_samples.append(sample)
            
            # Return filtered results
            return filtered_samples
        
        return samples
    
    def create(self, sample_code: str, patient_name: Optional[str] = None, 
               patient_info: Optional[str] = None) -> Sample:
        db_sample = Sample(
            sample_code=sample_code,
            patient_name=patient_name,
            patient_info=patient_info
        )
        self.db.add(db_sample)
        self.db.commit()
        self.db.refresh(db_sample)
        return db_sample
    
    def update(self, sample_id: int, sample_data: SampleUpdate) -> Optional[Sample]:
        db_sample = self.get_by_id(sample_id)
        if not db_sample:
            return None
        
        update_data = sample_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_sample, field, value)
        
        self.db.commit()
        self.db.refresh(db_sample)
        return db_sample
    
    def delete(self, sample_id: int) -> bool:
        db_sample = self.get_by_id(sample_id)
        if not db_sample:
            return False
        
        self.db.delete(db_sample)
        self.db.commit()
        return True
    
    def get_available_years(self) -> List[int]:
        """Get all distinct years that have samples"""
        years = self.db.query(distinct(Sample.year)).order_by(Sample.year.desc()).all()
        return [year[0] for year in years]
