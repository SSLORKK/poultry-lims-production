from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import distinct, func, or_, String
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
            
        # Global search - search across all relevant columns
        if search:
            search_term = f"%{search}%"
            # Join with Unit if not already joined (for department_id)
            if department_id is None:
                query = query.join(Unit)
            
            # Search across all relevant Sample and Unit columns
            query = query.filter(
                or_(
                    # Sample columns
                    Sample.sample_code.ilike(search_term),
                    Sample.company.ilike(search_term),
                    Sample.farm.ilike(search_term),
                    Sample.flock.ilike(search_term),
                    Sample.cycle.ilike(search_term),
                    Sample.status.ilike(search_term),
                    # Unit columns
                    Unit.unit_code.ilike(search_term),
                    Unit.age.ilike(search_term),
                    Unit.notes.ilike(search_term),
                    Unit.coa_status.ilike(search_term),
                    # Cast JSON fields to text for searching
                    func.cast(Unit.house, String).ilike(search_term),
                    func.cast(Unit.source, String).ilike(search_term),
                    func.cast(Unit.sample_type, String).ilike(search_term),
                )
            ).distinct()
        
        # Filter by department at SQL level if specified (join with units)
        if department_id is not None:
            # Only join if not already joined for search
            if not search:
                query = query.join(Unit)
            query = query.filter(Unit.department_id == department_id).distinct()
        
        # Order by ID ASC so page numbers stay stable (page 1 = oldest, last page = newest)
        query = query.order_by(Sample.id.asc())
        
        # Check if filters are applied (excluding year and department which are commonly set)
        has_filters = (
            search is not None or
            date_from is not None or
            date_to is not None or
            (company is not None and len(company) > 0) or
            (farm is not None and len(farm) > 0) or
            (flock is not None and len(flock) > 0) or
            (age is not None and len(age) > 0) or
            (sample_type is not None and len(sample_type) > 0) or
            (diseases is not None and len(diseases) > 0) or
            (kit_types is not None and len(kit_types) > 0) or
            (technicians is not None and len(technicians) > 0) or
            (extraction_methods is not None and len(extraction_methods) > 0)
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
        
        # Filter units by department, age, sample_type, source, status, house, cycle and department-specific filters at Python level
        unit_filters_applied = (
            department_id is not None or 
            (age is not None and len(age) > 0) or 
            (sample_type is not None and len(sample_type) > 0) or
            (source is not None and len(source) > 0) or
            (status is not None and len(status) > 0) or
            (house is not None and len(house) > 0) or
            (diseases is not None and len(diseases) > 0) or
            (kit_types is not None and len(kit_types) > 0) or
            (technicians is not None and len(technicians) > 0) or
            (extraction_methods is not None and len(extraction_methods) > 0)
        )
        
        sample_filters_applied = (cycle is not None and len(cycle) > 0)
        
        if unit_filters_applied or sample_filters_applied:
            filtered_samples = []
            
            for sample in samples:
                # Apply sample-level filters
                if sample_filters_applied:
                    # Apply cycle filter
                    if cycle is not None and len(cycle) > 0 and (sample.cycle is None or sample.cycle not in cycle):
                        continue
                
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
                    
                    # Apply source filter - handle both string and array sources
                    if source is not None and len(source) > 0:
                        if not unit.source:
                            continue
                        
                        # Handle both string and array source formats
                        if isinstance(unit.source, list):
                            # Source is an array, check if any source matches
                            has_match = any(s in source for s in unit.source)
                            if not has_match:
                                continue
                        else:
                            # Source is a string
                            if unit.source not in source:
                                continue
                    
                    # Apply status filter - check both sample status and unit coa_status
                    if status is not None and len(status) > 0:
                        unit_status = unit.coa_status or sample.status
                        if unit_status is None or unit_status not in status:
                            continue
                    
                    # Apply house filter - handle both string and array houses
                    if house is not None and len(house) > 0:
                        if not unit.house:
                            continue
                        
                        # Handle both string and array house formats
                        if isinstance(unit.house, list):
                            # House is an array, check if any house matches
                            has_match = any(h in house for h in unit.house)
                            if not has_match:
                                continue
                        else:
                            # House is a string
                            if unit.house not in house:
                                continue
                    
                    # Apply department-specific filters
                    # Disease filter - check PCR, Serology, and Microbiology data
                    if diseases is not None and len(diseases) > 0:
                        disease_match = False
                        
                        # Check PCR diseases
                        if unit.pcr_data and unit.pcr_data.diseases_list:
                            for disease_data in unit.pcr_data.diseases_list:
                                if isinstance(disease_data, dict) and disease_data.get('disease') in diseases:
                                    disease_match = True
                                    break
                        
                        # Check Serology diseases
                        if not disease_match and unit.serology_data and unit.serology_data.diseases_list:
                            for disease_data in unit.serology_data.diseases_list:
                                if isinstance(disease_data, dict) and disease_data.get('disease') in diseases:
                                    disease_match = True
                                    break
                        
                        # Check Microbiology diseases
                        if not disease_match and unit.microbiology_data and unit.microbiology_data.diseases_list:
                            for disease in unit.microbiology_data.diseases_list:
                                if isinstance(disease, str) and disease in diseases:
                                    disease_match = True
                                    break
                        
                        if not disease_match:
                            continue
                    
                    # Kit type filter - check PCR and Serology data
                    if kit_types is not None and len(kit_types) > 0:
                        kit_match = False
                        
                        # Check PCR kit types
                        if unit.pcr_data:
                            # Check top-level kit_type
                            if unit.pcr_data.kit_type and unit.pcr_data.kit_type in kit_types:
                                kit_match = True
                            # Check diseases_list kit_types
                            elif unit.pcr_data.diseases_list:
                                for disease_data in unit.pcr_data.diseases_list:
                                    if isinstance(disease_data, dict) and disease_data.get('kit_type') in kit_types:
                                        kit_match = True
                                        break
                        
                        # Check Serology kit types
                        if not kit_match and unit.serology_data:
                            # Check top-level kit_type
                            if unit.serology_data.kit_type and unit.serology_data.kit_type in kit_types:
                                kit_match = True
                            # Check diseases_list kit_types
                            elif unit.serology_data.diseases_list:
                                for disease_data in unit.serology_data.diseases_list:
                                    if isinstance(disease_data, dict) and disease_data.get('kit_type') in kit_types:
                                        kit_match = True
                                        break
                        
                        if not kit_match:
                            continue
                    
                    # Technician filter - check all department data
                    if technicians is not None and len(technicians) > 0:
                        tech_match = False
                        
                        # Check PCR technician
                        if unit.pcr_data and unit.pcr_data.technician_name and unit.pcr_data.technician_name in technicians:
                            tech_match = True
                        
                        # Check Serology technician
                        if not tech_match and unit.serology_data and unit.serology_data.technician_name and unit.serology_data.technician_name in technicians:
                            tech_match = True
                        
                        # Check Microbiology technician
                        if not tech_match and unit.microbiology_data and unit.microbiology_data.technician_name and unit.microbiology_data.technician_name in technicians:
                            tech_match = True
                        
                        if not tech_match:
                            continue
                    
                    # Extraction method filter - PCR specific
                    if extraction_methods is not None and len(extraction_methods) > 0:
                        if not (unit.pcr_data and unit.pcr_data.extraction_method and unit.pcr_data.extraction_method in extraction_methods):
                            continue
                    
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
