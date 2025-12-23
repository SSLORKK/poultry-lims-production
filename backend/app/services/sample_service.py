from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from fastapi import HTTPException, status
from app.repositories import SampleRepository, DepartmentRepository, CounterRepository
from app.repositories.unit_repository import UnitRepository
from app.schemas.sample import SampleCreate, SampleUpdate
from app.models.sample import Sample
from app.models.pcr_data import PCRData
from app.models.serology_data import SerologyData
from app.models.microbiology_data import MicrobiologyData
from app.models.edit_history import EditHistory


class SampleService:
    def __init__(self, db: Session):
        self.db = db
        self.sample_repo = SampleRepository(db)
        self.unit_repo = UnitRepository(db)
        self.dept_repo = DepartmentRepository(db)
        self.counter_repo = CounterRepository(db)
    
    def get_sample_by_id(self, sample_id: int) -> Optional[Sample]:
        return self.sample_repo.get_by_id(sample_id)
    
    def get_all_samples(self, skip: int = 0, limit: int = 100, department_id: Optional[int] = None, year: Optional[int] = None,
                       search: Optional[str] = None, company: Optional[List[str]] = None, farm: Optional[List[str]] = None, flock: Optional[List[str]] = None,
                       date_from: Optional[str] = None, date_to: Optional[str] = None, age: Optional[List[str]] = None,
                       sample_type: Optional[List[str]] = None) -> List[Sample]:
        """Get all samples, optionally filtered by department, year, and search term at SQL level"""
        return self.sample_repo.get_all(skip=skip, limit=limit, department_id=department_id, year=year,
                                      search=search, company=company, farm=farm, flock=flock, date_from=date_from, date_to=date_to,
                                      age=age, sample_type=sample_type)
    
    def create_sample(self, sample_data: SampleCreate, user_id: int) -> Optional[Sample]:
        # Validate all departments exist upfront before creating anything
        for unit_data in sample_data.units:
            department = self.dept_repo.get_by_id(unit_data.department_id)
            if not department:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with ID {unit_data.department_id} not found"
                )
        
        # Use reserved sample number if exists, otherwise increment normally
        sample_number = self.counter_repo.increment_sample_counter_with_reservation(user_id)
        current_year = datetime.now().year
        year_short = current_year % 100  # Get last 2 digits of year
        sample_code = f"SMP{year_short:02d}-{sample_number}"
        
        # Create sample with sample-level poultry fields only
        sample = Sample(
            sample_code=sample_code,
            year=current_year,
            date_received=sample_data.date_received,
            company=sample_data.company,
            farm=sample_data.farm,
            cycle=sample_data.cycle,
            flock=sample_data.flock,
            status=sample_data.status
        )
        
        self.db.add(sample)
        self.db.flush()  # Flush to get the sample.id
        
        # Create units with unit-specific fields and department codes
        for unit_data in sample_data.units:
            # Department is guaranteed to exist (validated earlier)
            department = self.dept_repo.get_by_id(unit_data.department_id)
            if not department:
                continue  # Skip if somehow not found (shouldn't happen)
            
            # Generate unit code
            unit_counter = self.counter_repo.increment_unit_counter(unit_data.department_id)
            unit_code = f"{department.code}-{unit_counter}"
            
            # Create unit with unit-specific fields
            unit = self.unit_repo.create(
                sample_id=sample.id,  # type: ignore[arg-type]
                department_id=unit_data.department_id,
                unit_code=unit_code,
                house=unit_data.house,
                age=unit_data.age,
                source=unit_data.source,
                sample_type=unit_data.sample_type,
                samples_number=unit_data.samples_number,
                notes=unit_data.notes
            )
            
            # Flush to get unit.id for department data
            self.db.flush()
            
            # Create department-specific data linked to this unit
            if unit_data.pcr_data is not None and str(department.code) == "PCR":
                # Convert DiseaseKitItem objects to dict for JSON storage
                diseases_list_json = [item.model_dump() for item in unit_data.pcr_data.diseases_list] if unit_data.pcr_data.diseases_list else []
                pcr_data = PCRData(
                    unit_id=unit.id,
                    diseases_list=diseases_list_json,
                    kit_type=unit_data.pcr_data.kit_type,
                    technician_name=unit_data.pcr_data.technician_name,
                    extraction_method=unit_data.pcr_data.extraction_method,
                    extraction=unit_data.pcr_data.extraction,
                    detection=unit_data.pcr_data.detection
                )
                self.db.add(pcr_data)
            
            if unit_data.serology_data is not None and str(department.code) == "SER":
                # Convert DiseaseKitItem objects to dict for JSON storage
                diseases_list_json = [item.model_dump() for item in unit_data.serology_data.diseases_list] if unit_data.serology_data.diseases_list else []
                serology_data = SerologyData(
                    unit_id=unit.id,
                    diseases_list=diseases_list_json,
                    kit_type=unit_data.serology_data.kit_type,
                    number_of_wells=unit_data.serology_data.number_of_wells,
                    tests_count=unit_data.serology_data.tests_count
                )
                self.db.add(serology_data)
            
            if unit_data.microbiology_data is not None and str(department.code) == "MIC":
                microbiology_data = MicrobiologyData(
                    unit_id=unit.id,
                    diseases_list=unit_data.microbiology_data.diseases_list,
                    batch_no=unit_data.microbiology_data.batch_no,
                    fumigation=unit_data.microbiology_data.fumigation,
                    index_list=unit_data.microbiology_data.index_list,
                    technician_name=unit_data.microbiology_data.technician_name
                )
                self.db.add(microbiology_data)
        
        self.db.commit()
        self.db.refresh(sample)
        
        return sample
    
    def update_sample(self, sample_id: int, sample_data: SampleUpdate, edited_by: str = None) -> Optional[Sample]:
        sample = self.sample_repo.get_by_id(sample_id)
        if not sample:
            return None
        
        # Track changes for edit history
        changes = []
        
        # Update sample-level fields and track changes
        for field in ['date_received', 'company', 'farm', 'cycle', 'flock', 'status']:
            new_value = getattr(sample_data, field, None)
            if new_value is not None:
                old_value = getattr(sample, field, None)
                # Convert values to string for comparison
                old_str = str(old_value) if old_value is not None else ''
                new_str = str(new_value) if new_value is not None else ''
                if old_str != new_str:
                    changes.append({
                        'field_name': field,
                        'old_value': old_str,
                        'new_value': new_str
                    })
                setattr(sample, field, new_value)
        
        # Record edit history for sample-level changes
        if edited_by and changes:
            for change in changes:
                edit_history = EditHistory(
                    entity_type='sample',
                    entity_id=sample_id,
                    field_name=change['field_name'],
                    old_value=change['old_value'],
                    new_value=change['new_value'],
                    edited_by=edited_by,
                    sample_code=sample.sample_code
                )
                self.db.add(edit_history)
        
        # Track who edited the sample
        if edited_by:
            sample.last_edited_by = edited_by
        
        # Update units if provided
        if sample_data.units is not None and len(sample_data.units) > 0:
            # Create a map of existing units by ID for quick lookup
            existing_units_map = {unit.id: unit for unit in sample.units}
            
            # Track which units have been processed
            processed_unit_ids = set()
            
            for unit_data in sample_data.units:
                department = self.dept_repo.get_by_id(unit_data.department_id)
                if not department:
                    continue
                
                # Check if this is an existing unit (has ID) or new unit
                if unit_data.id and unit_data.id in existing_units_map:
                    # Update existing unit, preserve unit_code
                    existing_unit = existing_units_map[unit_data.id]
                    
                    # Track unit-level field changes for edit history
                    unit_changes = []
                    unit_fields = ['house', 'age', 'source', 'sample_type', 'samples_number', 'notes']
                    for field in unit_fields:
                        new_val = getattr(unit_data, field, None)
                        old_val = getattr(existing_unit, field, None)
                        old_str = str(old_val) if old_val is not None else ''
                        new_str = str(new_val) if new_val is not None else ''
                        if old_str != new_str:
                            unit_changes.append({
                                'field_name': field,
                                'old_value': old_str,
                                'new_value': new_str
                            })
                    
                    existing_unit.department_id = unit_data.department_id
                    existing_unit.house = unit_data.house
                    existing_unit.age = unit_data.age
                    existing_unit.source = unit_data.source
                    existing_unit.sample_type = unit_data.sample_type
                    existing_unit.samples_number = unit_data.samples_number
                    existing_unit.notes = unit_data.notes
                    
                    # Track who edited the unit
                    if edited_by:
                        existing_unit.last_edited_by = edited_by
                    
                    # Record edit history for unit-level changes
                    if edited_by and unit_changes:
                        for change in unit_changes:
                            edit_history = EditHistory(
                                entity_type='unit',
                                entity_id=existing_unit.id,
                                field_name=change['field_name'],
                                old_value=change['old_value'],
                                new_value=change['new_value'],
                                edited_by=edited_by,
                                sample_code=sample.sample_code,
                                unit_code=existing_unit.unit_code
                            )
                            self.db.add(edit_history)
                    
                    # Store old department-specific data for comparison
                    old_pcr_data = existing_unit.pcr_data
                    old_serology_data = existing_unit.serology_data
                    old_microbiology_data = existing_unit.microbiology_data
                    
                    # Get old technician name before deleting
                    old_pcr_technician = old_pcr_data.technician_name if old_pcr_data else None
                    old_mic_technician = old_microbiology_data.technician_name if old_microbiology_data else None
                    
                    # Update department-specific data
                    if existing_unit.pcr_data:
                        self.db.delete(existing_unit.pcr_data)
                    if existing_unit.serology_data:
                        self.db.delete(existing_unit.serology_data)
                    if existing_unit.microbiology_data:
                        self.db.delete(existing_unit.microbiology_data)
                    
                    self.db.flush()
                    
                    # Create new department-specific data
                    if unit_data.pcr_data is not None and str(department.code) == "PCR":
                        diseases_list_json = [item.model_dump() for item in unit_data.pcr_data.diseases_list] if unit_data.pcr_data.diseases_list else []
                        # Preserve technician name if not provided
                        technician_name = unit_data.pcr_data.technician_name if unit_data.pcr_data.technician_name else old_pcr_technician
                        
                        # Track PCR-specific field changes for edit history
                        if edited_by and old_pcr_data:
                            old_pcr_diseases = old_pcr_data.diseases_list or []
                            if str(old_pcr_diseases) != str(diseases_list_json):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_diseases_list',
                                    old_value=str(old_pcr_diseases), new_value=str(diseases_list_json),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_pcr_data.kit_type or '') != str(unit_data.pcr_data.kit_type or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_kit_type',
                                    old_value=str(old_pcr_data.kit_type or ''), new_value=str(unit_data.pcr_data.kit_type or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_pcr_data.technician_name or '') != str(technician_name or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_technician_name',
                                    old_value=str(old_pcr_data.technician_name or ''), new_value=str(technician_name or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_pcr_data.extraction_method or '') != str(unit_data.pcr_data.extraction_method or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_extraction_method',
                                    old_value=str(old_pcr_data.extraction_method or ''), new_value=str(unit_data.pcr_data.extraction_method or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_pcr_data.extraction or '') != str(unit_data.pcr_data.extraction or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_extraction',
                                    old_value=str(old_pcr_data.extraction or ''), new_value=str(unit_data.pcr_data.extraction or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_pcr_data.detection or '') != str(unit_data.pcr_data.detection or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='pcr_detection',
                                    old_value=str(old_pcr_data.detection or ''), new_value=str(unit_data.pcr_data.detection or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                        
                        pcr_data = PCRData(
                            unit_id=existing_unit.id,
                            diseases_list=diseases_list_json,
                            kit_type=unit_data.pcr_data.kit_type,
                            technician_name=technician_name,
                            extraction_method=unit_data.pcr_data.extraction_method,
                            extraction=unit_data.pcr_data.extraction,
                            detection=unit_data.pcr_data.detection
                        )
                        self.db.add(pcr_data)
                    
                    if unit_data.serology_data is not None and str(department.code) == "SER":
                        diseases_list_json = [item.model_dump() for item in unit_data.serology_data.diseases_list] if unit_data.serology_data.diseases_list else []
                        
                        # Track Serology-specific field changes for edit history
                        if edited_by and old_serology_data:
                            old_ser_diseases = old_serology_data.diseases_list or []
                            if str(old_ser_diseases) != str(diseases_list_json):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='serology_diseases_list',
                                    old_value=str(old_ser_diseases), new_value=str(diseases_list_json),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_serology_data.kit_type or '') != str(unit_data.serology_data.kit_type or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='serology_kit_type',
                                    old_value=str(old_serology_data.kit_type or ''), new_value=str(unit_data.serology_data.kit_type or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_serology_data.number_of_wells or '') != str(unit_data.serology_data.number_of_wells or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='serology_number_of_wells',
                                    old_value=str(old_serology_data.number_of_wells or ''), new_value=str(unit_data.serology_data.number_of_wells or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            if str(old_serology_data.tests_count or '') != str(unit_data.serology_data.tests_count or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='serology_tests_count',
                                    old_value=str(old_serology_data.tests_count or ''), new_value=str(unit_data.serology_data.tests_count or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                        
                        serology_data = SerologyData(
                            unit_id=existing_unit.id,
                            diseases_list=diseases_list_json,
                            kit_type=unit_data.serology_data.kit_type,
                            number_of_wells=unit_data.serology_data.number_of_wells,
                            tests_count=unit_data.serology_data.tests_count
                        )
                        self.db.add(serology_data)
                    
                    if unit_data.microbiology_data is not None and str(department.code) == "MIC":
                        # Preserve technician name if not provided
                        technician_name = unit_data.microbiology_data.technician_name if unit_data.microbiology_data.technician_name else old_mic_technician
                        
                        # Track microbiology-specific field changes for edit history
                        if edited_by and old_microbiology_data:
                            old_index_list = old_microbiology_data.index_list or []
                            new_index_list = unit_data.microbiology_data.index_list or []
                            if str(old_index_list) != str(new_index_list):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='microbiology_index_list',
                                    old_value=str(old_index_list), new_value=str(new_index_list),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            
                            old_diseases = old_microbiology_data.diseases_list or []
                            new_diseases = unit_data.microbiology_data.diseases_list or []
                            if str(old_diseases) != str(new_diseases):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='microbiology_diseases_list',
                                    old_value=str(old_diseases), new_value=str(new_diseases),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            
                            if str(old_microbiology_data.batch_no or '') != str(unit_data.microbiology_data.batch_no or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='microbiology_batch_no',
                                    old_value=str(old_microbiology_data.batch_no or ''), new_value=str(unit_data.microbiology_data.batch_no or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            
                            if str(old_microbiology_data.fumigation or '') != str(unit_data.microbiology_data.fumigation or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='microbiology_fumigation',
                                    old_value=str(old_microbiology_data.fumigation or ''), new_value=str(unit_data.microbiology_data.fumigation or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                            
                            if str(old_microbiology_data.technician_name or '') != str(technician_name or ''):
                                edit_history = EditHistory(
                                    entity_type='unit', entity_id=existing_unit.id, field_name='microbiology_technician_name',
                                    old_value=str(old_microbiology_data.technician_name or ''), new_value=str(technician_name or ''),
                                    edited_by=edited_by, sample_code=sample.sample_code, unit_code=existing_unit.unit_code
                                )
                                self.db.add(edit_history)
                        
                        microbiology_data = MicrobiologyData(
                            unit_id=existing_unit.id,
                            diseases_list=unit_data.microbiology_data.diseases_list,
                            batch_no=unit_data.microbiology_data.batch_no,
                            fumigation=unit_data.microbiology_data.fumigation,
                            index_list=unit_data.microbiology_data.index_list,
                            technician_name=technician_name
                        )
                        self.db.add(microbiology_data)
                    
                    processed_unit_ids.add(unit_data.id)
                else:
                    # Create new unit (only for newly added units during edit)
                    unit_counter = self.counter_repo.increment_unit_counter(unit_data.department_id)
                    unit_code = f"{department.code}-{unit_counter}"
                    
                    unit = self.unit_repo.create(
                        sample_id=sample.id,  # type: ignore[arg-type]
                        department_id=unit_data.department_id,
                        unit_code=unit_code,
                        house=unit_data.house,
                        age=unit_data.age,
                        source=unit_data.source,
                        sample_type=unit_data.sample_type,
                        samples_number=unit_data.samples_number,
                        notes=unit_data.notes
                    )
                    
                    self.db.flush()
                    
                    # Create department-specific data for new unit
                    if unit_data.pcr_data is not None and str(department.code) == "PCR":
                        diseases_list_json = [item.model_dump() for item in unit_data.pcr_data.diseases_list] if unit_data.pcr_data.diseases_list else []
                        pcr_data = PCRData(
                            unit_id=unit.id,
                            diseases_list=diseases_list_json,
                            kit_type=unit_data.pcr_data.kit_type,
                            technician_name=unit_data.pcr_data.technician_name,
                            extraction_method=unit_data.pcr_data.extraction_method,
                            extraction=unit_data.pcr_data.extraction,
                            detection=unit_data.pcr_data.detection
                        )
                        self.db.add(pcr_data)
                    
                    if unit_data.serology_data is not None and str(department.code) == "SER":
                        diseases_list_json = [item.model_dump() for item in unit_data.serology_data.diseases_list] if unit_data.serology_data.diseases_list else []
                        serology_data = SerologyData(
                            unit_id=unit.id,
                            diseases_list=diseases_list_json,
                            kit_type=unit_data.serology_data.kit_type,
                            number_of_wells=unit_data.serology_data.number_of_wells,
                            tests_count=unit_data.serology_data.tests_count
                        )
                        self.db.add(serology_data)
                    
                    if unit_data.microbiology_data is not None and str(department.code) == "MIC":
                        microbiology_data = MicrobiologyData(
                            unit_id=unit.id,
                            diseases_list=unit_data.microbiology_data.diseases_list,
                            batch_no=unit_data.microbiology_data.batch_no,
                            fumigation=unit_data.microbiology_data.fumigation,
                            index_list=unit_data.microbiology_data.index_list,
                            technician_name=unit_data.microbiology_data.technician_name
                        )
                        self.db.add(microbiology_data)
            
            # Delete units that were removed (not in the update)
            for existing_unit in sample.units:
                if existing_unit.id not in processed_unit_ids:
                    # Delete department-specific data first
                    if existing_unit.pcr_data:
                        self.db.delete(existing_unit.pcr_data)
                    if existing_unit.serology_data:
                        self.db.delete(existing_unit.serology_data)
                    if existing_unit.microbiology_data:
                        self.db.delete(existing_unit.microbiology_data)
                    # Delete the unit itself
                    self.db.delete(existing_unit)
        
        self.db.commit()
        self.db.refresh(sample)
        
        return sample
    
    def delete_sample(self, sample_id: int) -> bool:
        return self.sample_repo.delete(sample_id)
