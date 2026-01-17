from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import distinct, func, or_, String, case
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
               sample_type: Optional[List[str]] = None, source: Optional[List[str]] = None, status: Optional[List[str]] = None, 
               house: Optional[List[str]] = None, cycle: Optional[List[str]] = None,
               diseases: Optional[List[str]] = None, kit_types: Optional[List[str]] = None,
               technicians: Optional[List[str]] = None, extraction_methods: Optional[List[str]] = None) -> List[Sample]:
        """Get samples with intelligent filtering: 
        - Returns samples ordered by ID ASC (oldest first, so page numbers stay stable)
        - Page 1 = oldest samples, last page = newest samples
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
            
        # FIXED: Unit code search using EXISTS to avoid DISTINCT + JOIN conflicts
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    # PRIORITY 1: Exact matches
                    Sample.sample_code == search.strip(),
                    Sample.units.any(Unit.unit_code == search.strip()),
                    
                    # PRIORITY 2: Starts with search
                    Sample.sample_code.ilike(f"{search.strip()}%"),
                    Sample.units.any(Unit.unit_code.ilike(f"{search.strip()}%")),
                    
                    # PRIORITY 3: Contains search
                    Sample.sample_code.ilike(search_term),
                    Sample.units.any(Unit.unit_code.ilike(search_term)),
                    
                    # PRIORITY 4: Other sample columns
                    Sample.company.ilike(search_term),
                    Sample.farm.ilike(search_term),
                    Sample.flock.ilike(search_term),
                    Sample.cycle.ilike(search_term),
                    Sample.status.ilike(search_term),
                    
                    # PRIORITY 5: Unit text fields via EXISTS
                    Sample.units.any(Unit.age.ilike(search_term)),
                    Sample.units.any(Unit.notes.ilike(search_term)),
                    Sample.units.any(Unit.coa_status.ilike(search_term)),
                )
            )
        
        # Department filtering will be handled at Python level to avoid JOIN conflicts
        
        # FIXED: Order by exact match priority for sample_code only (avoid DISTINCT + ORDER BY conflict)
        if search:
            # Only use Sample.sample_code in CASE to avoid DISTINCT conflict with Unit columns
            exact_match_priority = case(
                (Sample.sample_code == search.strip(), 1),
                (Sample.sample_code.ilike(f"{search.strip()}%"), 2),
                else_=3
            )
            # Order by: exact sample code matches first, then by ID
            query = query.order_by(exact_match_priority.asc(), Sample.id.asc())
        else:
            # No search: order by ID ASC so page numbers stay stable
            query = query.order_by(Sample.id.asc())
        
        # SIMPLIFIED: Direct SQL pagination only, handle unit filtering at Python level
        samples = query.offset(skip).limit(limit).all()
        
        # Apply post-processing filters on units if needed
        if department_id is not None or age or sample_type or source or status or house or cycle or diseases or kit_types or technicians or extraction_methods:
            # Filter samples based on their units
            filtered_samples = []
            for sample in samples:
                # Check if sample has units matching the filters
                matching_units = []
                for unit in sample.units:
                    # Department filter
                    if department_id is not None and unit.department_id != department_id:
                        continue
                    
                    # Age filter
                    if age and (not unit.age or unit.age not in age):
                        continue
                    
                    # Sample type filter
                    if sample_type and (not unit.sample_type or not any(st in sample_type for st in (unit.sample_type if isinstance(unit.sample_type, list) else [unit.sample_type]))):
                        continue
                    
                    # Source filter
                    if source and (not unit.source or not any(s in source for s in (unit.source if isinstance(unit.source, list) else [unit.source]))):
                        continue
                    
                    # Status filter
                    if status and (unit.coa_status not in status if unit.coa_status else sample.status not in status):
                        continue
                    
                    # House filter
                    if house and (not unit.house or not any(h in house for h in (unit.house if isinstance(unit.house, list) else [unit.house]))):
                        continue
                    
                    matching_units.append(unit)
                
                # Include sample if it has matching units
                if matching_units:
                    sample.units = matching_units
                    filtered_samples.append(sample)
            
            return filtered_samples
        
        return samples
    
    def get_by_id(self, sample_id: int) -> Optional[Sample]:
        """Get sample by ID with optimized eager loading"""
        return self.db.query(Sample).options(
            selectinload(Sample.units).selectinload(Unit.department),
            selectinload(Sample.units).selectinload(Unit.pcr_data),
            selectinload(Sample.units).selectinload(Unit.serology_data),
            selectinload(Sample.units).selectinload(Unit.microbiology_data),
            selectinload(Sample.units).selectinload(Unit.microbiology_coa)
        ).filter(Sample.id == sample_id).first()
    
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
