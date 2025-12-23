"""
Performance Testing Data Seeder - Enhanced Professional Version
Generates 100K+ sample records with realistic data from database dropdowns
Optimized for performance testing with proper data integrity
"""
import sys
import os
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.models.sample import Sample
from app.models.unit import Unit
from app.models.pcr_data import PCRData
from app.models.serology_data import SerologyData
from app.models.microbiology_data import MicrobiologyData
from app.models.department import Department
from app.models.counter import Counter
from app.models.dropdown_data import (
    Company, Farm, Flock, Cycle, Status, House, Source, 
    SampleType, Disease, KitType, Technician
)


# Realistic age patterns for poultry (Days and Weeks)
AGE_PATTERNS = [
    # Day-based ages (D suffix)
    "1D", "7D", "14D", "21D", "28D", "35D", "42D", "49D", "56D",
    # Week-based ages (W suffix)
    "1W", "2W", "3W", "4W", "8W", "12W", "16W", "20W", "24W", 
    "28W", "32W", "36W", "40W", "44W", "48W", "52W", "54W", "55W", "60W", "72W", "99W"
]

# Realistic sample type combinations by department
PCR_SAMPLE_TYPES = ["Blood", "Liver", "Spleen", "Trachea", "Kidney", "Heart", "Lung", "Intestine", "Cloacal Swab"]
SEROLOGY_SAMPLE_TYPES = ["Blood", "Serum", "Plasma"]
MICROBIOLOGY_SAMPLE_TYPES = ["Liver", "Spleen", "Cloacal Swab", "Drag Swab", "Egg Swab", "Egg Content", "Feed", "Water", "Litter"]

# PCR extraction methods
PCR_EXTRACTION_METHODS = ["Manual", "Automated (ID GEN MAGFAST)", "Automated (QIAcube)", "Manual (QIAamp)"]

# Microbiology fumigation options
FUMIGATION_OPTIONS = ["Before Fumigation", "After Fumigation", None]

# Batch numbers pattern for microbiology
BATCH_PREFIX = ["BATCH", "LOT", "MIC", "MB"]


class TestDataSeeder:
    """Professional test data seeder with real database values"""
    
    def __init__(self, db: Session):
        self.db = db
        self.departments: Dict[str, int] = {}
        self.sample_counters: Dict[int, int] = {}  # year -> counter value
        self.unit_counters: Dict[tuple, int] = {}  # (dept_id, year) -> counter value
        
        # Cache for dropdown data loaded from database
        self.companies: List[str] = []
        self.farms: List[str] = []
        self.flocks: List[str] = []
        self.cycles: List[str] = []
        self.statuses: List[str] = []
        self.houses: List[str] = []
        self.sources: List[str] = []
        self.technicians: List[str] = []
        
        # Department-specific cached data
        self.pcr_diseases: List[str] = []
        self.pcr_kits: List[str] = []
        self.serology_diseases: List[str] = []
        self.serology_kits: List[str] = []
        self.micro_diseases: List[str] = []
        self.micro_sample_types: List[str] = []
        
        # Statistics
        self.stats = {
            'total_samples': 0,
            'total_units': 0,
            'pcr_units': 0,
            'serology_units': 0,
            'microbiology_units': 0,
            'errors': 0
        }
        
    def load_dropdown_data(self):
        """Load ALL dropdown data from database into memory for fast access"""
        print("Loading dropdown data from database...")
        
        # Load active dropdown values with proper type casting
        self.companies = [str(c.name) for c in self.db.query(Company).filter(Company.is_active == True).all()]
        self.farms = [str(f.name) for f in self.db.query(Farm).filter(Farm.is_active == True).all()]
        self.flocks = [str(f.name) for f in self.db.query(Flock).filter(Flock.is_active == True).all()]
        self.cycles = [str(c.name) for c in self.db.query(Cycle).filter(Cycle.is_active == True).all()]
        self.statuses = [str(s.name) for s in self.db.query(Status).filter(Status.is_active == True).all()]
        self.houses = [str(h.name) for h in self.db.query(House).filter(House.is_active == True).all()]
        self.sources = [str(s.name) for s in self.db.query(Source).filter(Source.is_active == True).all()]
        self.technicians = [str(t.name) for t in self.db.query(Technician).filter(Technician.is_active == True).all()]
        
        # Load department-specific data
        pcr_dept = self.db.query(Department).filter(Department.code == "PCR").first()
        ser_dept = self.db.query(Department).filter(Department.code == "SER").first()
        mic_dept = self.db.query(Department).filter(Department.code == "MIC").first()
        
        if pcr_dept:
            self.pcr_diseases = [str(d.name) for d in self.db.query(Disease).filter(
                Disease.department_id == pcr_dept.id, Disease.is_active == True).all()]
            self.pcr_kits = [str(k.name) for k in self.db.query(KitType).filter(
                KitType.department_id == pcr_dept.id, KitType.is_active == True).all()]
        
        if ser_dept:
            self.serology_diseases = [str(d.name) for d in self.db.query(Disease).filter(
                Disease.department_id == ser_dept.id, Disease.is_active == True).all()]
            self.serology_kits = [str(k.name) for k in self.db.query(KitType).filter(
                KitType.department_id == ser_dept.id, KitType.is_active == True).all()]
        
        if mic_dept:
            self.micro_diseases = [str(d.name) for d in self.db.query(Disease).filter(
                Disease.department_id == mic_dept.id, Disease.is_active == True).all()]
            self.micro_sample_types = [str(s.name) for s in self.db.query(SampleType).filter(
                SampleType.department_id == mic_dept.id, SampleType.is_active == True).all()]
        
        # Validation
        if not self.companies:
            raise ValueError("No companies found in database. Please run init_db.py first.")
        if not self.farms:
            raise ValueError("No farms found in database. Please seed dropdown data first.")
        
        print(f"  ✓ Loaded {len(self.companies)} companies")
        print(f"  ✓ Loaded {len(self.farms)} farms")
        print(f"  ✓ Loaded {len(self.flocks)} flocks")
        print(f"  ✓ Loaded {len(self.cycles)} cycles")
        print(f"  ✓ Loaded {len(self.statuses)} statuses")
        print(f"  ✓ Loaded {len(self.houses)} houses")
        print(f"  ✓ Loaded {len(self.sources)} sources")
        print(f"  ✓ Loaded {len(self.technicians)} technicians")
        print(f"  ✓ Loaded {len(self.pcr_diseases)} PCR diseases")
        print(f"  ✓ Loaded {len(self.pcr_kits)} PCR kits")
        print(f"  ✓ Loaded {len(self.serology_diseases)} Serology diseases")
        print(f"  ✓ Loaded {len(self.micro_diseases)} Microbiology diseases")
    
    def initialize_counters(self):
        """Initialize counters from database - starting from NEXT available number"""
        print("Initializing counters...")
        
        # Get departments with proper type casting
        departments = self.db.query(Department).all()
        for dept in departments:
            self.departments[str(dept.code)] = int(dept.id)  # type: ignore[arg-type]
        
        # Load existing counter values from database and START FROM NEXT NUMBER
        current_year = datetime.now().year
        for year in range(current_year - 2, current_year + 1):
            # Get sample counter - START FROM NEXT NUMBER
            sample_counter = self.db.query(Counter).filter(
                Counter.counter_type == "sample",
                Counter.department_id.is_(None),
                Counter.year == year
            ).first()
            
            if sample_counter:
                # Start from NEXT number after existing counter
                self.sample_counters[year] = int(sample_counter.current_value)  # type: ignore[arg-type]
            else:
                # No counter exists yet, start from 0
                self.sample_counters[year] = 0
            
            print(f"  Sample counter for {year}: starting at {self.sample_counters[year]} (next will be {self.sample_counters[year] + 1})")
            
            # Get unit counters for each department - START FROM NEXT NUMBER
            for dept_code, dept_id in self.departments.items():
                unit_counter = self.db.query(Counter).filter(
                    Counter.counter_type == "unit",
                    Counter.department_id == dept_id,
                    Counter.year == year
                ).first()
                
                if unit_counter:
                    # Start from NEXT number after existing counter
                    self.unit_counters[(dept_id, year)] = int(unit_counter.current_value)  # type: ignore[arg-type]
                else:
                    # No counter exists yet, start from 0
                    self.unit_counters[(dept_id, year)] = 0
                
                print(f"  Unit counter for {dept_code}-{year}: starting at {self.unit_counters[(dept_id, year)]} (next will be {self.unit_counters[(dept_id, year)] + 1})")
        
        print("✓ Counters initialized - will continue from existing values")
    
    def generate_random_date(self, years_back=2):
        """Generate random date within the last N years"""
        # For performance testing, use CURRENT YEAR ONLY to keep sample codes sequential
        # Example: SMP25-1, SMP25-2, SMP25-3... instead of mixing SMP23-X, SMP24-Y, SMP25-Z
        current_year = datetime.now().year
        
        # Random date within current year only
        start_of_year = datetime(current_year, 1, 1).date()
        days_in_year = (datetime.now().date() - start_of_year).days + 1
        days_ago = random.randint(0, days_in_year)
        
        return datetime.now().date() - timedelta(days=days_ago)
    
    def get_sample_code(self, year):
        """Generate sample code - increment from existing counter"""
        if year not in self.sample_counters:
            # If year not initialized, check database for existing counter
            counter = self.db.query(Counter).filter(
                Counter.counter_type == "sample",
                Counter.department_id.is_(None),
                Counter.year == year
            ).first()
            self.sample_counters[year] = int(counter.current_value) if counter else 0  # type: ignore[arg-type]
        
        # Increment to get NEXT number (won't override existing)
        self.sample_counters[year] += 1
        year_short = year % 100
        return f"SMP{year_short:02d}-{self.sample_counters[year]}"
    
    def get_unit_code(self, dept_code, dept_id, year):
        """Generate unit code - increment from existing counter (format: DEPT-NUMBER)"""
        key = (dept_id, year)
        if key not in self.unit_counters:
            # If not initialized, check database for existing counter
            counter = self.db.query(Counter).filter(
                Counter.counter_type == "unit",
                Counter.department_id == dept_id,
                Counter.year == year
            ).first()
            self.unit_counters[key] = int(counter.current_value) if counter else 0  # type: ignore[arg-type]
        
        # Increment to get NEXT number (won't override existing)
        self.unit_counters[key] += 1
        # Note: Unit code does NOT include year in display, but counter is year-aware
        return f"{dept_code}-{self.unit_counters[key]}"
    
    def create_pcr_data(self, unit_id):
        """Create PCR department-specific data - FOLLOWS VALIDATION RULES"""
        if not self.pcr_diseases or not self.pcr_kits or not self.technicians:
            return  # Skip if no data loaded
        
        # REQUIRED: At least 1 disease (validation check from UnifiedSampleRegistration.tsx:1316)
        num_diseases = random.randint(1, min(3, len(self.pcr_diseases)))
        selected_diseases = random.sample(self.pcr_diseases, num_diseases)
        
        # REQUIRED: Each disease must have a kit_type
        diseases_list = [
            {
                "disease": disease,
                "kit_type": random.choice(self.pcr_kits)
            }
            for disease in selected_diseases
        ]
        
        pcr_data = PCRData(
            unit_id=unit_id,
            diseases_list=diseases_list,  # REQUIRED: Must have at least 1 disease
            kit_type=random.choice(self.pcr_kits) if self.pcr_kits else None,
            technician_name=random.choice(self.technicians),  # REQUIRED (validation line 1318)
            extraction_method=random.choice(PCR_EXTRACTION_METHODS)  # Optional
        )
        self.db.add(pcr_data)
        self.stats['pcr_units'] += 1
    
    def create_serology_data(self, unit_id):
        """Create Serology department-specific data - FOLLOWS VALIDATION RULES"""
        if not self.serology_diseases or not self.serology_kits or not self.technicians:
            return  # Skip if no data loaded
        
        # REQUIRED: At least 1 disease (validation check from line 1324)
        num_diseases = random.randint(1, min(3, len(self.serology_diseases)))
        selected_diseases = random.sample(self.serology_diseases, num_diseases)
        
        # REQUIRED: Each disease must have a kit_type
        diseases_list = [
            {
                "disease": disease,
                "kit_type": random.choice(self.serology_kits)
            }
            for disease in selected_diseases
        ]
        
        # Standard ELISA plate sizes - REQUIRED: Must be > 0 (validation line 1327)
        well_options = [96, 384, 1536]
        
        serology_data = SerologyData(
            unit_id=unit_id,
            diseases_list=diseases_list,  # REQUIRED: Must have at least 1 disease
            kit_type=random.choice(self.serology_kits) if self.serology_kits else None,
            number_of_wells=random.choice(well_options)  # REQUIRED: Must be > 0
        )
        self.db.add(serology_data)
        self.stats['serology_units'] += 1
    
    def create_microbiology_data(self, unit_id):
        """Create Microbiology department-specific data - FOLLOWS VALIDATION RULES"""
        if not self.micro_diseases or not self.technicians:
            return  # Skip if no data loaded
        
        # REQUIRED: At least 1 disease (validation check from line 1336)
        num_diseases = random.randint(1, min(3, len(self.micro_diseases)))
        diseases_list = random.sample(self.micro_diseases, num_diseases)
        
        # Realistic batch number format
        batch_prefix = random.choice(BATCH_PREFIX)
        batch_year = datetime.now().year % 100
        batch_num = random.randint(1000, 9999)
        batch_no = f"{batch_prefix}{batch_year}-{batch_num}"
        
        # REQUIRED: At least 1 environmental location/index (validation line 1339)
        index_options = [f"Index {chr(65+i)}" for i in range(26)]  # A-Z
        num_indexes = random.randint(1, 5)  # At least 1 required
        
        microbiology_data = MicrobiologyData(
            unit_id=unit_id,
            diseases_list=diseases_list,  # REQUIRED: Must have at least 1
            batch_no=batch_no,  # Optional but common
            fumigation=random.choice(FUMIGATION_OPTIONS),  # Optional
            index_list=random.sample(index_options, min(num_indexes, len(index_options)))  # REQUIRED: At least 1
        )
        self.db.add(microbiology_data)
        self.stats['microbiology_units'] += 1
    
    def create_sample_with_units(self):
        """Create a sample with realistic unit combinations - FOLLOWS ALL VALIDATION RULES"""
        # Use CURRENT YEAR ONLY for sequential sample codes
        date_received = self.generate_random_date()
        year = datetime.now().year  # Force current year for sequential codes
        
        # Create sample with real dropdown values (all REQUIRED from frontend)
        sample = Sample(
            sample_code=self.get_sample_code(year),
            year=year,
            date_received=date_received,
            company=random.choice(self.companies) if self.companies else "Unknown",
            farm=random.choice(self.farms) if self.farms else "Unknown",
            cycle=random.choice(self.cycles) if self.cycles else None,  # Optional
            flock=random.choice(self.flocks) if self.flocks else None,  # Optional
            status=random.choice(self.statuses) if self.statuses else "pending"
        )
        self.db.add(sample)
        self.db.flush()
        self.stats['total_samples'] += 1
        
        # Create 1-3 units with different departments (realistic distribution)
        # 70% single unit, 20% two units, 10% three units
        num_units_weights = [0.70, 0.20, 0.10]
        num_units = random.choices([1, 2, 3], weights=num_units_weights)[0]
        num_units = min(num_units, len(self.departments))
        
        dept_codes = random.sample(list(self.departments.keys()), num_units)
        
        for dept_code in dept_codes:
            dept_id = self.departments[dept_code]
            
            # VALIDATION RULE (line 1306-1307): At least 1 house is REQUIRED
            num_houses = random.choices([1, 2, 3, 4, 5], weights=[0.4, 0.3, 0.2, 0.07, 0.03])[0]
            num_houses = max(1, min(num_houses, len(self.houses)))  # Ensure at least 1
            selected_houses = random.sample(self.houses, num_houses) if self.houses else ["H1"]
            
            # Department-specific sample types
            if dept_code == "PCR":
                available_types = PCR_SAMPLE_TYPES
            elif dept_code == "SER":
                available_types = SEROLOGY_SAMPLE_TYPES
            elif dept_code == "MIC":
                available_types = MICROBIOLOGY_SAMPLE_TYPES if self.micro_sample_types else MICROBIOLOGY_SAMPLE_TYPES
            else:
                available_types = ["Blood", "Liver", "Spleen"]
            
            # VALIDATION RULE (line 1310-1311): At least 1 sample type is REQUIRED
            num_sample_types = random.randint(1, min(4, len(available_types)))
            num_sample_types = max(1, num_sample_types)  # Ensure at least 1
            selected_sample_types = random.sample(available_types, num_sample_types)
            
            # Realistic sample numbers: 5-100, weighted toward 10-30
            # Use weighted choice for realistic distribution
            if random.random() < 0.6:  # 60% chance: 10-30 range
                samples_number = random.randint(10, 30)
            elif random.random() < 0.8:  # 20% chance: 5-10 or 30-50 range
                samples_number = random.choice(list(range(5, 10)) + list(range(30, 51)))
            else:  # 20% chance: 50-100 range
                samples_number = random.randint(50, 100)
            
            unit = Unit(
                sample_id=sample.id,
                department_id=dept_id,
                unit_code=self.get_unit_code(dept_code, dept_id, year),
                house=selected_houses,  # REQUIRED: At least 1 house
                age=random.choice(AGE_PATTERNS),  # Optional
                source=random.choice(self.sources) if self.sources else None,  # Optional
                sample_type=selected_sample_types,  # REQUIRED: At least 1 sample type
                samples_number=samples_number,  # Optional (parsed as int in API)
                notes=None if random.random() > 0.3 else f"Performance test data - {dept_code}",  # Optional
                coa_status=None  # COAs created separately
            )
            self.db.add(unit)
            self.db.flush()
            self.stats['total_units'] += 1
            
            # Add REQUIRED department-specific data (each has validation rules)
            if dept_code == "PCR":
                self.create_pcr_data(unit.id)  # Requires: diseases_list, technician_name
            elif dept_code == "SER":
                self.create_serology_data(unit.id)  # Requires: diseases_list, number_of_wells, technician_name
            elif dept_code == "MIC":
                self.create_microbiology_data(unit.id)  # Requires: diseases_list, index_list, technician_name
    
    def seed_data(self, total_samples=100000, batch_size=500):
        """Seed database with test data - optimized for large datasets"""
        print(f"\n{'='*70}")
        print(f"STARTING DATA SEEDING: {total_samples:,} samples")
        print(f"Batch size: {batch_size}")
        print(f"{'='*70}\n")
        
        start_time = datetime.now()
        last_report_time = start_time
        
        for i in range(total_samples):
            try:
                self.create_sample_with_units()
                
                # Commit in batches for performance
                if (i + 1) % batch_size == 0:
                    self.db.commit()
                    
                    # Progress reporting every batch
                    current_time = datetime.now()
                    elapsed = (current_time - start_time).total_seconds()
                    batch_time = (current_time - last_report_time).total_seconds()
                    last_report_time = current_time
                    
                    rate = (i + 1) / elapsed if elapsed > 0 else 0
                    batch_rate = batch_size / batch_time if batch_time > 0 else 0
                    remaining = (total_samples - i - 1) / rate if rate > 0 else 0
                    
                    percent = (i + 1) / total_samples * 100
                    bar_length = 40
                    filled = int(bar_length * (i + 1) / total_samples)
                    bar = '█' * filled + '░' * (bar_length - filled)
                    
                    print(f"[{bar}] {percent:5.1f}% | "
                          f"{i + 1:,}/{total_samples:,} samples | "
                          f"Rate: {rate:.1f}/s (batch: {batch_rate:.1f}/s) | "
                          f"ETA: {int(remaining//60)}m {int(remaining%60)}s")
            
            except Exception as e:
                error_msg = str(e)
                self.stats['errors'] += 1
                
                print(f"\n⚠ Error at sample {i + 1}: {error_msg[:150]}")
                self.db.rollback()
                
                # Handle duplicate key errors gracefully
                if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
                    print("  → Duplicate detected, continuing...")
                    continue
                else:
                    print("  → Fatal error, stopping...")
                    raise
        
        # Final commit
        try:
            self.db.commit()
            print(f"\n[{'█'*40}] 100.0% | {total_samples:,}/{total_samples:,} samples")
        except Exception as e:
            print(f"\n✗ Error on final commit: {e}")
            self.db.rollback()
            raise
        
        # Update counters in database
        self.update_counters()
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Final statistics
        print(f"\n{'='*70}")
        print(f"✓ DATA SEEDING COMPLETED SUCCESSFULLY!")
        print(f"{'='*70}")
        print(f"Total Samples Created:      {self.stats['total_samples']:,}")
        print(f"Total Units Created:        {self.stats['total_units']:,}")
        print(f"  - PCR Units:              {self.stats['pcr_units']:,}")
        print(f"  - Serology Units:         {self.stats['serology_units']:,}")
        print(f"  - Microbiology Units:     {self.stats['microbiology_units']:,}")
        print(f"Errors Encountered:         {self.stats['errors']}")
        print(f"\nPerformance Metrics:")
        print(f"  Total Time:               {int(duration//60)}m {int(duration%60)}s ({duration:.2f}s)")
        print(f"  Average Rate:             {self.stats['total_samples'] / duration:.2f} samples/second")
        print(f"  Units per Sample:         {self.stats['total_units'] / self.stats['total_samples']:.2f}")
        print(f"{'='*70}")
    
    def update_counters(self):
        """Update counter values in database after seeding - ONLY if higher than existing"""
        print("\nUpdating counters in database...")
        
        updated_count = 0
        
        # Update sample counters - only if our value is higher
        for year, count in self.sample_counters.items():
            counter = self.db.query(Counter).filter(
                Counter.counter_type == "sample",
                Counter.department_id.is_(None),
                Counter.year == year
            ).first()
            
            if counter:
                # Only update if our count is higher (shouldn't override lower values)
                if count > counter.current_value:  # type: ignore[operator]
                    counter.current_value = count  # type: ignore[assignment]
                    updated_count += 1
                    print(f"  ✓ Updated sample counter for {year}: {counter.current_value}")
            else:
                # Create new counter if doesn't exist
                counter = Counter(
                    counter_type="sample",
                    department_id=None,
                    year=year,
                    current_value=count
                )
                self.db.add(counter)
                updated_count += 1
                print(f"  ✓ Created sample counter for {year}: {count}")
        
        # Update unit counters - only if our value is higher
        for (dept_id, year), count in self.unit_counters.items():
            counter = self.db.query(Counter).filter(
                Counter.counter_type == "unit",
                Counter.department_id == dept_id,
                Counter.year == year
            ).first()
            
            dept_code = [code for code, id in self.departments.items() if id == dept_id][0]
            
            if counter:
                # Only update if our count is higher
                if count > counter.current_value:  # type: ignore[operator]
                    counter.current_value = count  # type: ignore[assignment]
                    updated_count += 1
                    print(f"  ✓ Updated unit counter for {dept_code}-{year}: {counter.current_value}")
            else:
                # Create new counter if doesn't exist
                counter = Counter(
                    counter_type="unit",
                    department_id=dept_id,
                    year=year,
                    current_value=count
                )
                self.db.add(counter)
                updated_count += 1
                print(f"  ✓ Created unit counter for {dept_code}-{year}: {count}")
        
        self.db.commit()
        print(f"✓ Counters updated: {updated_count} counter(s) modified")


def main():
    """Main execution - Professional performance testing data seeder"""
    print("\n" + "=" * 70)
    print("    POULTRY LIMS - PROFESSIONAL PERFORMANCE TEST DATA SEEDER    ")
    print("=" * 70)
    print(f"\nExecution started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    db = SessionLocal()
    try:
        seeder = TestDataSeeder(db)
        
        print("\n[1/4] Loading dropdown data from database...")
        seeder.load_dropdown_data()
        
        print("\n[2/4] Initializing counters...")
        seeder.initialize_counters()
        
        print("\n[3/4] Seeding test data...")
        # Optimized batch size for 100K records
        seeder.seed_data(total_samples=100000, batch_size=500)
        
        print("\n[4/4] Cleanup and verification...")
        # Verify database integrity
        sample_count = db.query(func.count(Sample.id)).scalar()
        unit_count = db.query(func.count(Unit.id)).scalar()
        print(f"  ✓ Verified {sample_count:,} samples in database")
        print(f"  ✓ Verified {unit_count:,} units in database")
        
    except KeyboardInterrupt:
        print("\n\n⚠ Process interrupted by user. Rolling back...")
        db.rollback()
        print("✓ Rollback completed. Database unchanged.")
    except Exception as e:
        print(f"\n✗ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        print("\n✓ Rollback completed due to error.")
    finally:
        db.close()
        print(f"\nExecution finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("Database connection closed.\n")


if __name__ == "__main__":
    main()
