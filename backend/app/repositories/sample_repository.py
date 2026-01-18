from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import distinct, func, or_, String, case
from typing import Optional, List, Set, Tuple
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
               technicians: Optional[List[str]] = None, extraction_methods: Optional[List[str]] = None,
               pcr_result: Optional[List[str]] = None, microbiology_result: Optional[List[str]] = None) -> List[Sample]:
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
            
        # Result-based filtering (PCR and Microbiology)
        # This requires fetching candidates and filtering in Python due to complex JSON structure
        matching_unit_ids_pcr = None
        matching_unit_ids_micro = None
        
        if pcr_result and len(pcr_result) > 0:
            allowed_ids, matching_unit_ids_pcr = self._get_pcr_filtered_sample_ids(pcr_result, year)
            query = query.filter(Sample.id.in_(allowed_ids))
            
        if microbiology_result and len(microbiology_result) > 0:
            allowed_ids, matching_unit_ids_micro = self._get_microbiology_filtered_sample_ids(microbiology_result, year)
            query = query.filter(Sample.id.in_(allowed_ids))

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
        
        # FIXED: Apply unit-level filters BEFORE pagination using EXISTS subqueries
        # This ensures filtering works across ALL pages, not just current page
        
        # Department filter - MUST be applied at SQL level for correct pagination
        if department_id is not None:
            query = query.filter(Sample.units.any(Unit.department_id == department_id))
        
        # Age filter at SQL level
        if age and len(age) > 0:
            query = query.filter(Sample.units.any(Unit.age.in_(age)))
        
        # Sample type filter at SQL level (handles both string and array)
        if sample_type and len(sample_type) > 0:
            from sqlalchemy import cast
            from sqlalchemy.dialects.postgresql import ARRAY
            # Use OR for each sample type to handle array fields
            sample_type_conditions = []
            for st in sample_type:
                sample_type_conditions.append(Unit.sample_type.contains([st]))
                sample_type_conditions.append(Unit.sample_type == st)
            query = query.filter(Sample.units.any(or_(*sample_type_conditions)))
        
        # Source filter at SQL level
        if source and len(source) > 0:
            source_conditions = []
            for s in source:
                source_conditions.append(Unit.source.contains([s]))
                source_conditions.append(Unit.source == s)
            query = query.filter(Sample.units.any(or_(*source_conditions)))
        
        # House filter at SQL level
        if house and len(house) > 0:
            house_conditions = []
            for h in house:
                house_conditions.append(Unit.house.contains([h]))
                house_conditions.append(Unit.house == h)
            query = query.filter(Sample.units.any(or_(*house_conditions)))
        
        # Status filter - check both sample status and unit coa_status
        if status and len(status) > 0:
            query = query.filter(
                or_(
                    Sample.status.in_(status),
                    Sample.units.any(Unit.coa_status.in_(status))
                )
            )
        
        # Cycle filter at sample level
        if cycle and len(cycle) > 0:
            query = query.filter(Sample.cycle.in_(cycle))
        
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
        
        # Apply pagination AFTER all filters
        samples = query.offset(skip).limit(limit).all()
        
        # Post-processing: filter which units to return (not which samples)
        # This only affects the units shown, not which samples are included
        
        PCR_DEPT_ID = 1
        MICRO_DEPT_ID = 3
        
        if department_id is not None:
            for sample in samples:
                sample.units = [u for u in sample.units if u.department_id == department_id]
        
        # Filter units based on result filters
        if matching_unit_ids_pcr is not None:
            for sample in samples:
                # Keep unit if it's NOT a PCR unit OR if it IS a PCR unit and it's in the matching set
                sample.units = [u for u in sample.units if u.department_id != PCR_DEPT_ID or u.id in matching_unit_ids_pcr]
                
        if matching_unit_ids_micro is not None:
            for sample in samples:
                # Keep unit if it's NOT a Micro unit OR if it IS a Micro unit and it's in the matching set
                sample.units = [u for u in sample.units if u.department_id != MICRO_DEPT_ID or u.id in matching_unit_ids_micro]
        
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
    
    def get_serology_samples(self, skip: int = 0, limit: int = 100, year: Optional[int] = None,
                             search: Optional[str] = None, company: Optional[List[str]] = None,
                             farm: Optional[List[str]] = None, flock: Optional[List[str]] = None,
                             date_from: Optional[str] = None, date_to: Optional[str] = None,
                             age: Optional[List[str]] = None, sample_type: Optional[List[str]] = None,
                             source: Optional[List[str]] = None, status: Optional[List[str]] = None,
                             house: Optional[List[str]] = None, cycle: Optional[List[str]] = None,
                             diseases: Optional[List[str]] = None, technicians: Optional[List[str]] = None) -> List[Sample]:
        """Get Serology samples with department-specific optimized SQL query"""
        from app.models.serology_data import SerologyData
        
        # Serology department ID = 2
        SEROLOGY_DEPT_ID = 2
        
        query = self.db.query(Sample).options(
            selectinload(Sample.units).selectinload(Unit.department),
            selectinload(Sample.units).selectinload(Unit.serology_data)
        )
        
        # MUST have Serology units
        query = query.filter(Sample.units.any(Unit.department_id == SEROLOGY_DEPT_ID))
        
        # Year filter
        if year is not None:
            query = query.filter(Sample.year == year)
        
        # Date range filter
        if date_from is not None:
            query = query.filter(Sample.date_received >= date_from)
        if date_to is not None:
            query = query.filter(Sample.date_received <= date_to)
        
        # Sample-level filters
        if company and len(company) > 0:
            query = query.filter(Sample.company.in_(company))
        if farm and len(farm) > 0:
            query = query.filter(Sample.farm.in_(farm))
        if flock and len(flock) > 0:
            query = query.filter(Sample.flock.in_(flock))
        if cycle and len(cycle) > 0:
            query = query.filter(Sample.cycle.in_(cycle))
        
        # Unit-level filters using EXISTS (Serology department only)
        if age and len(age) > 0:
            query = query.filter(Sample.units.any(
                (Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.age.in_(age))
            ))
        
        if sample_type and len(sample_type) > 0:
            st_conditions = []
            for st in sample_type:
                st_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.sample_type.contains([st])))
                st_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.sample_type == st))
            query = query.filter(Sample.units.any(or_(*st_conditions)))
        
        if source and len(source) > 0:
            src_conditions = []
            for s in source:
                src_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.source.contains([s])))
                src_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.source == s))
            query = query.filter(Sample.units.any(or_(*src_conditions)))
        
        if house and len(house) > 0:
            h_conditions = []
            for h in house:
                h_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.house.contains([h])))
                h_conditions.append((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.house == h))
            query = query.filter(Sample.units.any(or_(*h_conditions)))
        
        # Status filter
        if status and len(status) > 0:
            query = query.filter(
                or_(
                    Sample.status.in_(status),
                    Sample.units.any((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.coa_status.in_(status)))
                )
            )
        
        # Serology-specific: diseases filter (from serology_data.diseases_list JSON)
        if diseases and len(diseases) > 0:
            for disease in diseases:
                query = query.filter(
                    Sample.units.any(
                        (Unit.department_id == SEROLOGY_DEPT_ID) & 
                        (Unit.serology_data.has(SerologyData.diseases_list.contains([{"disease": disease}])))
                    )
                )
        
        # Serology-specific: technicians filter (from serology_data.technician_name)
        if technicians and len(technicians) > 0:
            query = query.filter(
                Sample.units.any(
                    (Unit.department_id == SEROLOGY_DEPT_ID) & 
                    (Unit.serology_data.has(SerologyData.technician_name.in_(technicians)))
                )
            )
        
        # Search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Sample.sample_code == search.strip(),
                    Sample.units.any((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.unit_code == search.strip())),
                    Sample.sample_code.ilike(f"{search.strip()}%"),
                    Sample.units.any((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.unit_code.ilike(f"{search.strip()}%"))),
                    Sample.sample_code.ilike(search_term),
                    Sample.units.any((Unit.department_id == SEROLOGY_DEPT_ID) & (Unit.unit_code.ilike(search_term))),
                    Sample.company.ilike(search_term),
                    Sample.farm.ilike(search_term),
                    Sample.flock.ilike(search_term),
                    Sample.cycle.ilike(search_term),
                )
            )
        
        # Order and paginate
        query = query.order_by(Sample.id.asc())
        samples = query.offset(skip).limit(limit).all()
        
        # Post-process: keep only Serology units
        for sample in samples:
            sample.units = [u for u in sample.units if u.department_id == SEROLOGY_DEPT_ID]
        
        return samples
    
    def _get_pcr_filtered_sample_ids(self, results: List[str], year: Optional[int]) -> Tuple[List[int], Set[int]]:
        """Helper to find sample IDs that match PCR result filters by parsing JSON COA data"""
        from app.models.pcr_coa import PCRCOA
        from app.models.unit import Unit
        from app.models.sample import Sample

        # Get all COA results (optionally filtered by year)
        query = self.db.query(PCRCOA.unit_id, PCRCOA.test_results)
        if year:
            query = query.join(PCRCOA.unit).join(Unit.sample).filter(Sample.year == year)
        
        coas = query.all()
        matching_unit_ids = set()
        
        want_positive = "Positive" in results
        want_negative = "Negative" in results
        
        for unit_id, test_results in coas:
            if not test_results:
                continue
            
            is_pos = False
            is_neg = False
            
            def check_value(val):
                if not val: return False, False
                s_val = str(val).upper().strip()
                if s_val in ['N/A', 'NA', '', '-']: return False, False
                # Check if negative: NEG, NEG., NEGATIVE
                if s_val in ['NEG', 'NEG.', 'NEGATIVE']:
                    return False, True # is_pos, is_neg
                # Check if positive: POS, POS., POSITIVE
                if s_val in ['POS', 'POS.', 'POSITIVE']:
                    return True, False
                # Check if numeric CT value (also positive)
                if s_val.startswith('CT:'):
                    return True, False
                
                # Check for just numbers (CT values)
                # It might be a float or int string
                try:
                    # Clean up string before checking float
                    clean_val = s_val.replace(',', '.')
                    float(clean_val)
                    return True, False
                except ValueError:
                    # Not a number
                    pass
                    
                return False, False

            # Iterate JSON structure
            # Structure can be: {disease: {sample_type: value}} OR {disease: [{houses:..., values:{...}}]}
            for disease_key, disease_data in test_results.items():
                # Don't skip keys with ||| as they might be valid disease keys (Disease|||KitType)
                
                pools = []
                if isinstance(disease_data, list):
                    pools = disease_data
                elif isinstance(disease_data, dict):
                    if 'values' in disease_data:
                         pools = [disease_data]
                    else:
                         # Old format or simple dict, treat disease_data as values
                         pools = [{'values': disease_data}]
                else:
                    continue
                
                for pool in pools:
                    values = pool.get('values', {}) if isinstance(pool, dict) else pool
                    if not isinstance(values, dict): continue

                    for k, v in values.items():
                        if k.lower() in ['pos_control', 'neg_control', 'pos. control']: continue
                        p, n = check_value(v)
                        if p: is_pos = True
                        if n: is_neg = True

            # If filtering for Positive, we want units that HAVE a positive result
            # If filtering for Negative, we want units that HAVE a negative result
            # (Logic matches frontend: shows row if any result matches)
            if (want_positive and is_pos) or (want_negative and is_neg):
                matching_unit_ids.add(unit_id)
        
        if not matching_unit_ids:
            return [], set()
            
        sample_ids = self.db.query(Unit.sample_id).filter(Unit.id.in_(matching_unit_ids)).distinct().all()
        return [s[0] for s in sample_ids], matching_unit_ids

    def _get_microbiology_filtered_sample_ids(self, results: List[str], year: Optional[int]) -> Tuple[List[int], Set[int]]:
        """Helper to find sample IDs that match Microbiology result filters"""
        from app.models.microbiology_coa import MicrobiologyCOA
        from app.models.unit import Unit
        from app.models.sample import Sample

        query = self.db.query(MicrobiologyCOA.unit_id, MicrobiologyCOA.test_results)
        if year:
            query = query.join(MicrobiologyCOA.unit).join(Unit.sample).filter(Sample.year == year)
            
        coas = query.all()
        matching_unit_ids = set()
        
        # Positive (RED) = Detected, Over Limit
        # Negative (GREEN) = Not Detected, Within Limit
        want_positive = "Positive" in results
        want_negative = "Negative" in results
        
        positive_values = ['DETECTED', 'OVER LIMIT']
        negative_values = ['NOT DETECTED', 'WITHIN LIMIT']
        
        for unit_id, test_results in coas:
            if not test_results:
                continue
                
            # test_results: { disease: { index: result } }
            has_positive = False
            has_negative = False
            
            for disease, indices in test_results.items():
                if not isinstance(indices, dict): continue
                for idx, res in indices.items():
                    if not res: continue
                    upper_res = str(res).upper().strip()
                    if upper_res in positive_values:
                        has_positive = True
                    elif upper_res in negative_values:
                        has_negative = True
            
            # Match if user wants positive and unit has positive, or wants negative and unit has negative
            if (want_positive and has_positive) or (want_negative and has_negative):
                matching_unit_ids.add(unit_id)
                
        if not matching_unit_ids:
            return [], set()

        sample_ids = self.db.query(Unit.sample_id).filter(Unit.id.in_(matching_unit_ids)).distinct().all()
        return [s[0] for s in sample_ids], matching_unit_ids
