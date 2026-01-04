"""
POULTRY LIMS - Concurrent Load Testing Script
=============================================
Simulates 10 concurrent users over network creating 100K samples
Tests sample_code and unit_code counter logic for race conditions
Measures performance and identifies weak points

Author: Load Testing Module
Version: 2.0 - Concurrent Network Simulation
"""

import sys
import os
import asyncio
import aiohttp
import random
import time
import threading
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import traceback

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.db.session import SessionLocal
from app.models.sample import Sample
from app.models.unit import Unit
from app.models.department import Department
from app.models.counter import Counter
from app.repositories import CounterRepository  # V2 with atomic sequences
from app.models.dropdown_data import (
    Company, Farm, Flock, Cycle, Status, House, Source, 
    SampleType, Disease, KitType, Technician
)


# ============================================================================
# CONFIGURATION
# ============================================================================
CONFIG = {
    'BASE_URL': 'http://localhost:8000',  # API base URL
    'API_PREFIX': '/api/v1',
    'TOTAL_SAMPLES': 100000,              # Target: 100K samples
    'CONCURRENT_USERS': 10,               # Simulate 10 users
    'BATCH_SIZE': 100,                    # Samples per batch before reporting
    'REQUEST_TIMEOUT': 30,                # HTTP timeout in seconds
    'MAX_RETRIES': 3,                     # Max retries per request
    'ENABLE_DIRECT_DB_TEST': True,        # Also test direct DB inserts
    'ENABLE_API_TEST': True,              # Test via HTTP API
    'COUNTER_CHECK_INTERVAL': 1000,       # Check counters every N samples
}

# Realistic test data patterns
AGE_PATTERNS = [
    "1D", "7D", "14D", "21D", "28D", "35D", "42D", "49D", "56D",
    "1W", "2W", "3W", "4W", "8W", "12W", "16W", "20W", "24W", 
    "28W", "32W", "36W", "40W", "44W", "48W", "52W", "54W", "55W", "60W", "72W", "99W"
]

PCR_SAMPLE_TYPES = ["Blood", "Liver", "Spleen", "Trachea", "Kidney", "Heart", "Lung", "Intestine", "Cloacal Swab"]
SEROLOGY_SAMPLE_TYPES = ["Blood", "Serum", "Plasma"]
MICROBIOLOGY_SAMPLE_TYPES = ["Liver", "Spleen", "Cloacal Swab", "Drag Swab", "Egg Swab", "Egg Content", "Feed", "Water", "Litter"]
PCR_EXTRACTION_METHODS = ["Manual", "Automated (ID GEN MAGFAST)", "Automated (QIAcube)", "Manual (QIAamp)"]


# ============================================================================
# DATA CLASSES FOR TRACKING
# ============================================================================
@dataclass
class UserMetrics:
    """Metrics for individual simulated user"""
    user_id: int
    samples_created: int = 0
    units_created: int = 0
    errors: int = 0
    duplicate_errors: int = 0
    race_condition_errors: int = 0
    response_times: List[float] = field(default_factory=list)
    sample_codes_created: List[str] = field(default_factory=list)
    unit_codes_created: List[str] = field(default_factory=list)
    start_time: float = 0.0
    end_time: float = 0.0


@dataclass
class CounterIntegrityReport:
    """Report on counter integrity issues"""
    missing_sample_codes: List[int] = field(default_factory=list)
    duplicate_sample_codes: List[str] = field(default_factory=list)
    missing_unit_codes: Dict[str, List[int]] = field(default_factory=dict)
    duplicate_unit_codes: List[str] = field(default_factory=list)
    counter_vs_actual_mismatch: Dict[str, Tuple[int, int]] = field(default_factory=dict)
    gap_count: int = 0
    sequence_errors: List[str] = field(default_factory=list)


@dataclass
class LoadTestResults:
    """Complete load test results"""
    total_samples_created: int = 0
    total_units_created: int = 0
    total_errors: int = 0
    total_duplicate_errors: int = 0
    total_race_condition_errors: int = 0
    total_duration_seconds: float = 0.0
    samples_per_second: float = 0.0
    avg_response_time_ms: float = 0.0
    min_response_time_ms: float = 0.0
    max_response_time_ms: float = 0.0
    p95_response_time_ms: float = 0.0
    p99_response_time_ms: float = 0.0
    user_metrics: Dict[int, UserMetrics] = field(default_factory=dict)
    counter_integrity: CounterIntegrityReport = field(default_factory=CounterIntegrityReport)
    weak_points: List[str] = field(default_factory=list)
    errors_log: List[str] = field(default_factory=list)


# ============================================================================
# DROPDOWN DATA CACHE
# ============================================================================
class DropdownCache:
    """Caches dropdown data for fast access"""
    
    def __init__(self):
        self.companies: List[str] = []
        self.farms: List[str] = []
        self.flocks: List[str] = []
        self.cycles: List[str] = []
        self.statuses: List[str] = []
        self.houses: List[str] = []
        self.sources: List[str] = []
        self.technicians: List[str] = []
        self.departments: Dict[str, int] = {}  # code -> id
        self.pcr_diseases: List[str] = []
        self.pcr_kits: List[str] = []
        self.serology_diseases: List[str] = []
        self.serology_kits: List[str] = []
        self.micro_diseases: List[str] = []
        
    def load_from_db(self, db: Session):
        """Load all dropdown data from database"""
        print("Loading dropdown data from database...")
        
        self.companies = [str(c.name) for c in db.query(Company).filter(Company.is_active == True).all()]
        self.farms = [str(f.name) for f in db.query(Farm).filter(Farm.is_active == True).all()]
        self.flocks = [str(f.name) for f in db.query(Flock).filter(Flock.is_active == True).all()]
        self.cycles = [str(c.name) for c in db.query(Cycle).filter(Cycle.is_active == True).all()]
        self.statuses = [str(s.name) for s in db.query(Status).filter(Status.is_active == True).all()]
        self.houses = [str(h.name) for h in db.query(House).filter(House.is_active == True).all()]
        self.sources = [str(s.name) for s in db.query(Source).filter(Source.is_active == True).all()]
        self.technicians = [str(t.name) for t in db.query(Technician).filter(Technician.is_active == True).all()]
        
        # Load departments
        departments = db.query(Department).all()
        for dept in departments:
            self.departments[str(dept.code)] = int(dept.id)
        
        # Load department-specific data
        pcr_dept = db.query(Department).filter(Department.code == "PCR").first()
        ser_dept = db.query(Department).filter(Department.code == "SER").first()
        mic_dept = db.query(Department).filter(Department.code == "MIC").first()
        
        if pcr_dept:
            self.pcr_diseases = [str(d.name) for d in db.query(Disease).filter(
                Disease.department_id == pcr_dept.id, Disease.is_active == True).all()]
            self.pcr_kits = [str(k.name) for k in db.query(KitType).filter(
                KitType.department_id == pcr_dept.id, KitType.is_active == True).all()]
        
        if ser_dept:
            self.serology_diseases = [str(d.name) for d in db.query(Disease).filter(
                Disease.department_id == ser_dept.id, Disease.is_active == True).all()]
            self.serology_kits = [str(k.name) for k in db.query(KitType).filter(
                KitType.department_id == ser_dept.id, KitType.is_active == True).all()]
        
        if mic_dept:
            self.micro_diseases = [str(d.name) for d in db.query(Disease).filter(
                Disease.department_id == mic_dept.id, Disease.is_active == True).all()]
        
        # Validation
        if not self.companies:
            raise ValueError("No companies found in database!")
        if not self.farms:
            raise ValueError("No farms found in database!")
        
        print(f"  ✓ Loaded {len(self.companies)} companies, {len(self.farms)} farms")
        print(f"  ✓ Loaded {len(self.departments)} departments")
        print(f"  ✓ Loaded diseases: PCR={len(self.pcr_diseases)}, SER={len(self.serology_diseases)}, MIC={len(self.micro_diseases)}")


# ============================================================================
# COUNTER LOGIC ANALYZER
# ============================================================================
class CounterAnalyzer:
    """Analyzes counter logic for race conditions and weak points"""
    
    def __init__(self, db: Session):
        self.db = db
        self.current_year = datetime.now().year
        self.year_short = self.current_year % 100
        
    def get_all_sample_codes(self, year: int = None) -> List[str]:
        """Get all sample codes for a year"""
        if year is None:
            year = self.current_year
        result = self.db.execute(text("""
            SELECT sample_code FROM samples WHERE year = :year ORDER BY id
        """), {"year": year}).fetchall()
        return [r[0] for r in result]
    
    def get_all_unit_codes(self, dept_id: int, year: int = None) -> List[str]:
        """Get all unit codes for a department and year"""
        if year is None:
            year = self.current_year
        result = self.db.execute(text("""
            SELECT u.unit_code FROM units u
            JOIN samples s ON u.sample_id = s.id
            WHERE u.department_id = :dept_id AND s.year = :year
            ORDER BY u.id
        """), {"dept_id": dept_id, "year": year}).fetchall()
        return [r[0] for r in result]
    
    def extract_sample_number(self, sample_code: str) -> int:
        """Extract number from sample code (SMP25-123 -> 123)"""
        try:
            parts = sample_code.split('-')
            if len(parts) == 2:
                return int(parts[1])
        except (ValueError, IndexError):
            pass
        return 0
    
    def extract_unit_number(self, unit_code: str, dept_code: str) -> int:
        """Extract number from unit code (PCR25-123 -> 123)"""
        try:
            parts = unit_code.split('-')
            if len(parts) == 2:
                return int(parts[1])
            elif len(parts) == 3:
                return int(parts[2])
        except (ValueError, IndexError):
            pass
        return 0
    
    def check_counter_integrity(self, departments: Dict[str, int]) -> CounterIntegrityReport:
        """Comprehensive counter integrity check"""
        report = CounterIntegrityReport()
        
        print("\n" + "=" * 70)
        print("COUNTER INTEGRITY ANALYSIS")
        print("=" * 70)
        
        # Check sample codes
        sample_codes = self.get_all_sample_codes()
        sample_numbers = [self.extract_sample_number(sc) for sc in sample_codes]
        sample_numbers = [n for n in sample_numbers if n > 0]
        
        if sample_numbers:
            max_sample = max(sample_numbers)
            expected_numbers = set(range(1, max_sample + 1))
            actual_numbers = set(sample_numbers)
            
            # Find gaps (missing numbers)
            gaps = expected_numbers - actual_numbers
            report.missing_sample_codes = sorted(list(gaps))
            report.gap_count = len(gaps)
            
            # Find duplicates
            seen = set()
            for sc in sample_codes:
                if sc in seen:
                    report.duplicate_sample_codes.append(sc)
                seen.add(sc)
            
            print(f"\n[SAMPLE CODES]")
            print(f"  Total samples: {len(sample_codes)}")
            print(f"  Max sample number: {max_sample}")
            print(f"  Gaps found: {len(gaps)}")
            if gaps and len(gaps) <= 20:
                print(f"  Gap numbers: {sorted(list(gaps))[:20]}")
            elif gaps:
                print(f"  First 20 gaps: {sorted(list(gaps))[:20]}...")
            print(f"  Duplicate codes: {len(report.duplicate_sample_codes)}")
            
            # Check counter vs actual
            counter = self.db.query(Counter).filter(
                Counter.counter_type == "sample",
                Counter.department_id.is_(None),
                Counter.year == self.current_year
            ).first()
            
            if counter:
                counter_value = counter.current_value
                if counter_value != max_sample:
                    report.counter_vs_actual_mismatch['sample'] = (counter_value, max_sample)
                    print(f"  ⚠ MISMATCH: Counter={counter_value}, Actual Max={max_sample}")
                else:
                    print(f"  ✓ Counter matches actual max: {counter_value}")
        
        # Check unit codes for each department
        print(f"\n[UNIT CODES]")
        for dept_code, dept_id in departments.items():
            unit_codes = self.get_all_unit_codes(dept_id)
            unit_numbers = [self.extract_unit_number(uc, dept_code) for uc in unit_codes]
            unit_numbers = [n for n in unit_numbers if n > 0]
            
            if unit_numbers:
                max_unit = max(unit_numbers)
                expected = set(range(1, max_unit + 1))
                actual = set(unit_numbers)
                gaps = expected - actual
                
                if gaps:
                    report.missing_unit_codes[dept_code] = sorted(list(gaps))
                
                # Check for duplicates
                seen = set()
                for uc in unit_codes:
                    if uc in seen:
                        report.duplicate_unit_codes.append(uc)
                    seen.add(uc)
                
                print(f"  {dept_code}: Total={len(unit_codes)}, Max={max_unit}, Gaps={len(gaps)}, Duplicates={len([u for u in report.duplicate_unit_codes if dept_code in u])}")
                
                # Check counter vs actual
                counter = self.db.query(Counter).filter(
                    Counter.counter_type == "unit",
                    Counter.department_id == dept_id,
                    Counter.year == self.current_year
                ).first()
                
                if counter:
                    counter_value = counter.current_value
                    if counter_value != max_unit:
                        report.counter_vs_actual_mismatch[f'unit_{dept_code}'] = (counter_value, max_unit)
                        print(f"    ⚠ MISMATCH: Counter={counter_value}, Actual Max={max_unit}")
        
        return report
    
    def analyze_weak_points(self, report: CounterIntegrityReport) -> List[str]:
        """Identify weak points in counter logic based on test results"""
        weak_points = []
        
        # Check for race condition indicators
        if report.duplicate_sample_codes:
            weak_points.append(
                f"CRITICAL: {len(report.duplicate_sample_codes)} duplicate sample codes found. "
                "Race condition in get_next_sample_number() - FOR UPDATE lock may not be working correctly."
            )
        
        if report.duplicate_unit_codes:
            weak_points.append(
                f"CRITICAL: {len(report.duplicate_unit_codes)} duplicate unit codes found. "
                "Race condition in get_next_unit_number() - FOR UPDATE lock may not be working correctly."
            )
        
        # Check for gap-filling issues
        if report.gap_count > 0:
            weak_points.append(
                f"WARNING: {report.gap_count} gaps in sample code sequence. "
                "Gap-filling logic may have performance issues under concurrent load. "
                "The CTE query in get_next_sample_number() has O(n) complexity."
            )
        
        # Check for counter sync issues
        if report.counter_vs_actual_mismatch:
            for key, (counter_val, actual_val) in report.counter_vs_actual_mismatch.items():
                weak_points.append(
                    f"WARNING: Counter mismatch for {key}: stored={counter_val}, actual_max={actual_val}. "
                    "Counter sync logic may be failing under concurrent load."
                )
        
        # Known architectural weak points
        weak_points.append(
            "INFO: The gap-filling CTE query scans all samples for the year. "
            "At 100K+ samples, this becomes a performance bottleneck."
        )
        
        weak_points.append(
            "INFO: In-memory SAMPLE_RESERVATIONS is process-local. "
            "Multi-process deployments (gunicorn workers) will have separate reservation stores, causing conflicts."
        )
        
        weak_points.append(
            "INFO: The FOR UPDATE lock is held per-query, not per-transaction. "
            "Two concurrent get_next_sample_number() calls could return the same number if the INSERT happens later."
        )
        
        return weak_points


# ============================================================================
# CONCURRENT USER SIMULATOR (Direct DB)
# ============================================================================
class DirectDBUserSimulator:
    """Simulates a user creating samples directly via database"""
    
    def __init__(self, user_id: int, cache: DropdownCache, total_samples: int):
        self.user_id = user_id
        self.cache = cache
        self.total_samples = total_samples
        self.metrics = UserMetrics(user_id=user_id)
        self.lock = threading.Lock()
        
    def generate_sample_payload(self, dept_code: str, dept_id: int) -> Dict[str, Any]:
        """Generate sample payload for a specific department"""
        
        # Select houses (1-3)
        num_houses = random.randint(1, min(3, len(self.cache.houses)))
        houses = random.sample(self.cache.houses, num_houses) if self.cache.houses else ["H1"]
        
        # Select sample types based on department
        if dept_code == "PCR":
            available_types = PCR_SAMPLE_TYPES
        elif dept_code == "SER":
            available_types = SEROLOGY_SAMPLE_TYPES
        else:
            available_types = MICROBIOLOGY_SAMPLE_TYPES
        
        num_types = random.randint(1, min(3, len(available_types)))
        sample_types = random.sample(available_types, num_types)
        
        # Build unit data
        unit = {
            "department_id": dept_id,
            "house": houses,
            "age": random.choice(AGE_PATTERNS),
            "source": random.choice(self.cache.sources) if self.cache.sources else None,
            "sample_type": sample_types,
            "samples_number": random.randint(10, 50),
            "notes": f"Load test - User {self.user_id}"
        }
        
        # Add department-specific data
        if dept_code == "PCR" and self.cache.pcr_diseases and self.cache.pcr_kits:
            diseases_list = [
                {"disease": random.choice(self.cache.pcr_diseases), "kit_type": random.choice(self.cache.pcr_kits)}
                for _ in range(random.randint(1, 2))
            ]
            unit["pcr_data"] = {
                "diseases_list": diseases_list,
                "kit_type": random.choice(self.cache.pcr_kits),
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test Tech",
                "extraction_method": random.choice(PCR_EXTRACTION_METHODS),
                "extraction": random.randint(1, 100),
                "detection": random.randint(1, 100)
            }
        elif dept_code == "SER" and self.cache.serology_diseases and self.cache.serology_kits:
            diseases_list = [
                {"disease": random.choice(self.cache.serology_diseases), "kit_type": random.choice(self.cache.serology_kits), "test_count": 1, "wells_count": 96}
                for _ in range(random.randint(1, 2))
            ]
            unit["serology_data"] = {
                "diseases_list": diseases_list,
                "kit_type": random.choice(self.cache.serology_kits),
                "number_of_wells": 96,
                "tests_count": len(diseases_list),
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test Tech"
            }
        elif dept_code == "MIC" and self.cache.micro_diseases:
            unit["microbiology_data"] = {
                "diseases_list": random.sample(self.cache.micro_diseases, min(2, len(self.cache.micro_diseases))),
                "batch_no": f"BATCH{datetime.now().year % 100}-{random.randint(1000, 9999)}",
                "fumigation": random.choice(["Before Fumigation", "After Fumigation", None]),
                "index_list": [f"Index {chr(65 + i)}" for i in range(random.randint(1, 3))],
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test Tech"
            }
        
        return {
            "date_received": datetime.now().strftime("%Y-%m-%d"),
            "company": random.choice(self.cache.companies),
            "farm": random.choice(self.cache.farms),
            "cycle": random.choice(self.cache.cycles) if self.cache.cycles else None,
            "flock": random.choice(self.cache.flocks) if self.cache.flocks else None,
            "status": random.choice(self.cache.statuses) if self.cache.statuses else "pending",
            "units": [unit]
        }
    
    def create_sample_direct_db(self, db: Session) -> Tuple[bool, str, float]:
        """Create a single sample directly via database with V2 atomic counter logic"""
        from app.repositories.unit_repository import UnitRepository
        from app.models.pcr_data import PCRData
        from app.models.serology_data import SerologyData
        from app.models.microbiology_data import MicrobiologyData
        
        start_time = time.time()
        
        try:
            # V2: Use atomic sequence-based counter - guaranteed unique
            counter_repo = CounterRepository(db)
            unit_repo = UnitRepository(db)
            current_year = datetime.now().year
            year_short = current_year % 100
            
            # V2: Atomic NEXTVAL - no race conditions possible
            sample_number = counter_repo.get_next_sample_number(year=current_year)
            sample_code = f"SMP{year_short:02d}-{sample_number}"
            
            # Select random department
            dept_code = random.choice(list(self.cache.departments.keys()))
            dept_id = self.cache.departments[dept_code]
            
            # Create sample
            sample = Sample(
                sample_code=sample_code,
                year=current_year,
                date_received=datetime.now().date(),
                company=random.choice(self.cache.companies),
                farm=random.choice(self.cache.farms),
                cycle=random.choice(self.cache.cycles) if self.cache.cycles else None,
                flock=random.choice(self.cache.flocks) if self.cache.flocks else None,
                status=random.choice(self.cache.statuses) if self.cache.statuses else "pending"
            )
            db.add(sample)
            db.flush()
            
            # V2: Atomic NEXTVAL - no race conditions possible
            unit_number = counter_repo.get_next_unit_number(dept_id, year=current_year)
            unit_code = f"{dept_code}{year_short:02d}-{unit_number}"
            
            # Create unit
            houses = random.sample(self.cache.houses, min(2, len(self.cache.houses))) if self.cache.houses else ["H1"]
            sample_types = random.sample(PCR_SAMPLE_TYPES if dept_code == "PCR" else SEROLOGY_SAMPLE_TYPES if dept_code == "SER" else MICROBIOLOGY_SAMPLE_TYPES, 2)
            
            unit = Unit(
                sample_id=sample.id,
                department_id=dept_id,
                unit_code=unit_code,
                house=houses,
                age=random.choice(AGE_PATTERNS),
                source=random.choice(self.cache.sources) if self.cache.sources else None,
                sample_type=sample_types,
                samples_number=random.randint(10, 50),
                notes=f"Load test - User {self.user_id}"
            )
            db.add(unit)
            db.flush()
            
            # Add department-specific data
            if dept_code == "PCR" and self.cache.pcr_diseases and self.cache.pcr_kits:
                pcr_data = PCRData(
                    unit_id=unit.id,
                    diseases_list=[{"disease": random.choice(self.cache.pcr_diseases), "kit_type": random.choice(self.cache.pcr_kits)}],
                    kit_type=random.choice(self.cache.pcr_kits),
                    technician_name=random.choice(self.cache.technicians) if self.cache.technicians else "Test",
                    extraction_method=random.choice(PCR_EXTRACTION_METHODS),
                    extraction=random.randint(1, 100),
                    detection=random.randint(1, 100)
                )
                db.add(pcr_data)
            elif dept_code == "SER" and self.cache.serology_diseases and self.cache.serology_kits:
                ser_data = SerologyData(
                    unit_id=unit.id,
                    diseases_list=[{"disease": random.choice(self.cache.serology_diseases), "kit_type": random.choice(self.cache.serology_kits)}],
                    kit_type=random.choice(self.cache.serology_kits),
                    number_of_wells=96,
                    tests_count=1,
                    technician_name=random.choice(self.cache.technicians) if self.cache.technicians else "Test"
                )
                db.add(ser_data)
            elif dept_code == "MIC" and self.cache.micro_diseases:
                mic_data = MicrobiologyData(
                    unit_id=unit.id,
                    diseases_list=random.sample(self.cache.micro_diseases, min(2, len(self.cache.micro_diseases))),
                    batch_no=f"BATCH{year_short}-{random.randint(1000, 9999)}",
                    fumigation=random.choice(["Before Fumigation", "After Fumigation", None]),
                    index_list=[f"Index {chr(65 + i)}" for i in range(random.randint(1, 3))],
                    technician_name=random.choice(self.cache.technicians) if self.cache.technicians else "Test"
                )
                db.add(mic_data)
            
            db.commit()
            
            elapsed = time.time() - start_time
            
            with self.lock:
                self.metrics.samples_created += 1
                self.metrics.units_created += 1
                self.metrics.sample_codes_created.append(sample_code)
                self.metrics.unit_codes_created.append(unit_code)
                self.metrics.response_times.append(elapsed * 1000)  # Convert to ms
            
            return True, sample_code, elapsed
            
        except Exception as e:
            db.rollback()
            elapsed = time.time() - start_time
            error_msg = str(e)
            
            with self.lock:
                self.metrics.errors += 1
                if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                    self.metrics.duplicate_errors += 1
                if "race" in error_msg.lower() or "RACE_CONDITION" in error_msg:
                    self.metrics.race_condition_errors += 1
            
            return False, error_msg, elapsed


# ============================================================================
# HTTP API USER SIMULATOR
# ============================================================================
class HTTPUserSimulator:
    """Simulates a user creating samples via HTTP API"""
    
    def __init__(self, user_id: int, cache: DropdownCache, auth_token: str = None):
        self.user_id = user_id
        self.cache = cache
        self.auth_token = auth_token
        self.metrics = UserMetrics(user_id=user_id)
        self.base_url = CONFIG['BASE_URL']
        self.api_prefix = CONFIG['API_PREFIX']
        
    def get_headers(self) -> Dict[str, str]:
        """Get HTTP headers with auth token"""
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers
    
    def generate_sample_payload(self) -> Dict[str, Any]:
        """Generate a sample creation payload"""
        dept_code = random.choice(list(self.cache.departments.keys()))
        dept_id = self.cache.departments[dept_code]
        
        # Select houses
        houses = random.sample(self.cache.houses, min(2, len(self.cache.houses))) if self.cache.houses else ["H1"]
        
        # Select sample types based on department
        if dept_code == "PCR":
            sample_types = random.sample(PCR_SAMPLE_TYPES, 2)
        elif dept_code == "SER":
            sample_types = random.sample(SEROLOGY_SAMPLE_TYPES, 2)
        else:
            sample_types = random.sample(MICROBIOLOGY_SAMPLE_TYPES, 2)
        
        unit = {
            "department_id": dept_id,
            "house": houses,
            "age": random.choice(AGE_PATTERNS),
            "source": random.choice(self.cache.sources) if self.cache.sources else None,
            "sample_type": sample_types,
            "samples_number": random.randint(10, 50),
            "notes": f"Load test - User {self.user_id}"
        }
        
        # Add department-specific data
        if dept_code == "PCR" and self.cache.pcr_diseases and self.cache.pcr_kits:
            unit["pcr_data"] = {
                "diseases_list": [{"disease": random.choice(self.cache.pcr_diseases), "kit_type": random.choice(self.cache.pcr_kits)}],
                "kit_type": random.choice(self.cache.pcr_kits),
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test",
                "extraction_method": random.choice(PCR_EXTRACTION_METHODS),
                "extraction": random.randint(1, 100),
                "detection": random.randint(1, 100)
            }
        elif dept_code == "SER" and self.cache.serology_diseases and self.cache.serology_kits:
            unit["serology_data"] = {
                "diseases_list": [{"disease": random.choice(self.cache.serology_diseases), "kit_type": random.choice(self.cache.serology_kits), "test_count": 1, "wells_count": 96}],
                "kit_type": random.choice(self.cache.serology_kits),
                "number_of_wells": 96,
                "tests_count": 1,
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test"
            }
        elif dept_code == "MIC" and self.cache.micro_diseases:
            unit["microbiology_data"] = {
                "diseases_list": random.sample(self.cache.micro_diseases, min(2, len(self.cache.micro_diseases))),
                "batch_no": f"BATCH{datetime.now().year % 100}-{random.randint(1000, 9999)}",
                "fumigation": random.choice(["Before Fumigation", "After Fumigation", None]),
                "index_list": [f"Index {chr(65 + i)}" for i in range(random.randint(1, 3))],
                "technician_name": random.choice(self.cache.technicians) if self.cache.technicians else "Test"
            }
        
        return {
            "date_received": datetime.now().strftime("%Y-%m-%d"),
            "company": random.choice(self.cache.companies),
            "farm": random.choice(self.cache.farms),
            "cycle": random.choice(self.cache.cycles) if self.cache.cycles else None,
            "flock": random.choice(self.cache.flocks) if self.cache.flocks else None,
            "status": random.choice(self.cache.statuses) if self.cache.statuses else "pending",
            "units": [unit]
        }
    
    async def create_sample_http(self, session: aiohttp.ClientSession) -> Tuple[bool, str, float]:
        """Create a single sample via HTTP API"""
        start_time = time.time()
        
        try:
            payload = self.generate_sample_payload()
            url = f"{self.base_url}{self.api_prefix}/samples/"
            
            async with session.post(
                url,
                json=payload,
                headers=self.get_headers(),
                timeout=aiohttp.ClientTimeout(total=CONFIG['REQUEST_TIMEOUT'])
            ) as response:
                elapsed = time.time() - start_time
                
                if response.status == 200 or response.status == 201:
                    data = await response.json()
                    sample_code = data.get('sample_code', 'unknown')
                    
                    self.metrics.samples_created += 1
                    self.metrics.units_created += len(data.get('units', []))
                    self.metrics.sample_codes_created.append(sample_code)
                    self.metrics.response_times.append(elapsed * 1000)
                    
                    return True, sample_code, elapsed
                else:
                    error_text = await response.text()
                    self.metrics.errors += 1
                    
                    if "duplicate" in error_text.lower() or "unique" in error_text.lower():
                        self.metrics.duplicate_errors += 1
                    
                    return False, f"HTTP {response.status}: {error_text[:200]}", elapsed
                    
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            self.metrics.errors += 1
            return False, "Timeout", elapsed
        except Exception as e:
            elapsed = time.time() - start_time
            self.metrics.errors += 1
            return False, str(e), elapsed


# ============================================================================
# MAIN LOAD TESTER
# ============================================================================
class ConcurrentLoadTester:
    """Main load testing orchestrator"""
    
    def __init__(self):
        self.cache = DropdownCache()
        self.results = LoadTestResults()
        self.samples_created = 0
        self.progress_lock = threading.Lock()
        self.start_time = None
        
    def initialize(self):
        """Initialize test environment"""
        db = SessionLocal()
        try:
            self.cache.load_from_db(db)
        finally:
            db.close()
    
    def print_progress(self, current: int, total: int, rate: float, errors: int):
        """Print progress bar"""
        percent = current / total * 100
        bar_length = 40
        filled = int(bar_length * current / total)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f"\r[{bar}] {percent:5.1f}% | {current:,}/{total:,} | Rate: {rate:.1f}/s | Errors: {errors}", end='')
    
    def run_direct_db_test(self, samples_per_user: int) -> Dict[int, UserMetrics]:
        """Run direct database test with concurrent threads"""
        print(f"\n{'=' * 70}")
        print(f"DIRECT DATABASE TEST - {CONFIG['CONCURRENT_USERS']} concurrent users")
        print(f"{'=' * 70}")
        
        users = []
        for i in range(CONFIG['CONCURRENT_USERS']):
            user = DirectDBUserSimulator(user_id=i + 1, cache=self.cache, total_samples=samples_per_user)
            users.append(user)
        
        total_samples = samples_per_user * CONFIG['CONCURRENT_USERS']
        completed = 0
        errors = 0
        start_time = time.time()
        
        def run_user(user: DirectDBUserSimulator):
            """Run a single user's test"""
            nonlocal completed, errors
            user.metrics.start_time = time.time()
            
            for i in range(samples_per_user):
                # Each iteration gets its own session
                db = SessionLocal()
                try:
                    success, result, elapsed = user.create_sample_direct_db(db)
                    
                    with self.progress_lock:
                        completed += 1
                        if not success:
                            errors += 1
                        
                        # Print progress every BATCH_SIZE samples
                        if completed % CONFIG['BATCH_SIZE'] == 0:
                            elapsed_total = time.time() - start_time
                            rate = completed / elapsed_total if elapsed_total > 0 else 0
                            self.print_progress(completed, total_samples, rate, errors)
                finally:
                    db.close()
            
            user.metrics.end_time = time.time()
        
        # Run users concurrently with thread pool
        print(f"\nStarting {CONFIG['CONCURRENT_USERS']} concurrent threads...")
        with ThreadPoolExecutor(max_workers=CONFIG['CONCURRENT_USERS']) as executor:
            futures = [executor.submit(run_user, user) for user in users]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"\n⚠ Thread error: {e}")
        
        print()  # New line after progress bar
        
        # Collect metrics
        metrics = {}
        for user in users:
            metrics[user.user_id] = user.metrics
        
        return metrics
    
    async def run_http_test(self, samples_per_user: int, auth_token: str = None) -> Dict[int, UserMetrics]:
        """Run HTTP API test with concurrent async requests"""
        print(f"\n{'=' * 70}")
        print(f"HTTP API TEST - {CONFIG['CONCURRENT_USERS']} concurrent users")
        print(f"{'=' * 70}")
        
        users = []
        for i in range(CONFIG['CONCURRENT_USERS']):
            user = HTTPUserSimulator(user_id=i + 1, cache=self.cache, auth_token=auth_token)
            users.append(user)
        
        total_samples = samples_per_user * CONFIG['CONCURRENT_USERS']
        completed = 0
        errors = 0
        start_time = time.time()
        
        async def run_user(user: HTTPUserSimulator):
            """Run a single user's HTTP test"""
            nonlocal completed, errors
            user.metrics.start_time = time.time()
            
            async with aiohttp.ClientSession() as session:
                for i in range(samples_per_user):
                    success, result, elapsed = await user.create_sample_http(session)
                    
                    completed += 1
                    if not success:
                        errors += 1
                    
                    # Print progress
                    if completed % CONFIG['BATCH_SIZE'] == 0:
                        elapsed_total = time.time() - start_time
                        rate = completed / elapsed_total if elapsed_total > 0 else 0
                        self.print_progress(completed, total_samples, rate, errors)
                    
                    # Small delay to prevent overwhelming the server
                    await asyncio.sleep(0.01)
            
            user.metrics.end_time = time.time()
        
        # Run users concurrently
        print(f"\nStarting {CONFIG['CONCURRENT_USERS']} concurrent async tasks...")
        await asyncio.gather(*[run_user(user) for user in users])
        
        print()  # New line after progress bar
        
        # Collect metrics
        metrics = {}
        for user in users:
            metrics[user.user_id] = user.metrics
        
        return metrics
    
    def analyze_results(self, user_metrics: Dict[int, UserMetrics]) -> LoadTestResults:
        """Analyze test results and generate report"""
        results = LoadTestResults()
        results.user_metrics = user_metrics
        
        # Aggregate metrics
        all_response_times = []
        for user_id, metrics in user_metrics.items():
            results.total_samples_created += metrics.samples_created
            results.total_units_created += metrics.units_created
            results.total_errors += metrics.errors
            results.total_duplicate_errors += metrics.duplicate_errors
            results.total_race_condition_errors += metrics.race_condition_errors
            all_response_times.extend(metrics.response_times)
        
        # Calculate statistics
        if all_response_times:
            results.avg_response_time_ms = statistics.mean(all_response_times)
            results.min_response_time_ms = min(all_response_times)
            results.max_response_time_ms = max(all_response_times)
            
            sorted_times = sorted(all_response_times)
            p95_idx = int(len(sorted_times) * 0.95)
            p99_idx = int(len(sorted_times) * 0.99)
            results.p95_response_time_ms = sorted_times[p95_idx] if p95_idx < len(sorted_times) else sorted_times[-1]
            results.p99_response_time_ms = sorted_times[p99_idx] if p99_idx < len(sorted_times) else sorted_times[-1]
        
        # Run counter integrity check
        db = SessionLocal()
        try:
            analyzer = CounterAnalyzer(db)
            results.counter_integrity = analyzer.check_counter_integrity(self.cache.departments)
            results.weak_points = analyzer.analyze_weak_points(results.counter_integrity)
        finally:
            db.close()
        
        return results
    
    def print_report(self, results: LoadTestResults, duration: float):
        """Print comprehensive test report"""
        print("\n" + "=" * 70)
        print("LOAD TEST RESULTS SUMMARY")
        print("=" * 70)
        
        results.total_duration_seconds = duration
        results.samples_per_second = results.total_samples_created / duration if duration > 0 else 0
        
        print(f"\n[PERFORMANCE METRICS]")
        print(f"  Total Duration:           {int(duration // 60)}m {int(duration % 60)}s ({duration:.2f}s)")
        print(f"  Total Samples Created:    {results.total_samples_created:,}")
        print(f"  Total Units Created:      {results.total_units_created:,}")
        print(f"  Throughput:               {results.samples_per_second:.2f} samples/second")
        
        print(f"\n[RESPONSE TIMES]")
        print(f"  Average:                  {results.avg_response_time_ms:.2f} ms")
        print(f"  Min:                      {results.min_response_time_ms:.2f} ms")
        print(f"  Max:                      {results.max_response_time_ms:.2f} ms")
        print(f"  P95:                      {results.p95_response_time_ms:.2f} ms")
        print(f"  P99:                      {results.p99_response_time_ms:.2f} ms")
        
        print(f"\n[ERROR SUMMARY]")
        print(f"  Total Errors:             {results.total_errors}")
        print(f"  Duplicate Key Errors:     {results.total_duplicate_errors}")
        print(f"  Race Condition Errors:    {results.total_race_condition_errors}")
        error_rate = (results.total_errors / results.total_samples_created * 100) if results.total_samples_created > 0 else 0
        print(f"  Error Rate:               {error_rate:.2f}%")
        
        print(f"\n[PER-USER BREAKDOWN]")
        for user_id, metrics in sorted(results.user_metrics.items()):
            user_duration = metrics.end_time - metrics.start_time if metrics.end_time > 0 else 0
            user_rate = metrics.samples_created / user_duration if user_duration > 0 else 0
            print(f"  User {user_id}: {metrics.samples_created} samples, {metrics.errors} errors, {user_rate:.1f}/s")
        
        print(f"\n[COUNTER INTEGRITY]")
        ci = results.counter_integrity
        print(f"  Sample Code Gaps:         {ci.gap_count}")
        print(f"  Duplicate Sample Codes:   {len(ci.duplicate_sample_codes)}")
        print(f"  Duplicate Unit Codes:     {len(ci.duplicate_unit_codes)}")
        if ci.counter_vs_actual_mismatch:
            print(f"  Counter Mismatches:       {len(ci.counter_vs_actual_mismatch)}")
            for key, (counter, actual) in ci.counter_vs_actual_mismatch.items():
                print(f"    - {key}: Counter={counter}, Actual={actual}")
        
        print(f"\n[IDENTIFIED WEAK POINTS]")
        for i, wp in enumerate(results.weak_points, 1):
            print(f"  {i}. {wp}")
        
        print("\n" + "=" * 70)
    
    def run_full_test(self, total_samples: int = None):
        """Run the complete load test"""
        if total_samples is None:
            total_samples = CONFIG['TOTAL_SAMPLES']
        
        samples_per_user = total_samples // CONFIG['CONCURRENT_USERS']
        
        print("\n" + "=" * 70)
        print("    POULTRY LIMS - CONCURRENT LOAD TESTING")
        print("    Simulating 10 Users Over Network with 100K Samples")
        print("=" * 70)
        print(f"\nConfiguration:")
        print(f"  Total Samples:       {total_samples:,}")
        print(f"  Concurrent Users:    {CONFIG['CONCURRENT_USERS']}")
        print(f"  Samples per User:    {samples_per_user:,}")
        print(f"  Test Mode:           {'Direct DB' if CONFIG['ENABLE_DIRECT_DB_TEST'] else ''} {'+ HTTP API' if CONFIG['ENABLE_API_TEST'] else ''}")
        print(f"\nStarted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Initialize
        self.initialize()
        
        start_time = time.time()
        all_metrics = {}
        
        # Run direct DB test
        if CONFIG['ENABLE_DIRECT_DB_TEST']:
            db_metrics = self.run_direct_db_test(samples_per_user)
            all_metrics.update(db_metrics)
        
        # Run HTTP API test (if enabled and API is available)
        if CONFIG['ENABLE_API_TEST']:
            try:
                # Try to get auth token first
                # For now, skip HTTP test if no auth setup
                print("\n[HTTP API Test] Skipped - requires authentication setup")
            except Exception as e:
                print(f"\n[HTTP API Test] Error: {e}")
        
        duration = time.time() - start_time
        
        # Analyze and report
        results = self.analyze_results(all_metrics)
        self.print_report(results, duration)
        
        print(f"\nFinished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return results


# ============================================================================
# QUICK COUNTER VALIDATION TEST
# ============================================================================
def quick_counter_test(num_samples: int = 1000):
    """Quick test to validate V2 atomic counter logic under concurrent access"""
    print("\n" + "=" * 70)
    print("QUICK COUNTER RACE CONDITION TEST (V2 Atomic Sequences)")
    print("=" * 70)
    print("Testing PostgreSQL NEXTVAL atomic sequences...")
    
    results = {
        'sample_numbers': [],
        'duplicates': [],
        'errors': []
    }
    lock = threading.Lock()
    
    def get_sample_number(thread_id: int):
        """Thread to get next sample number"""
        db = SessionLocal()
        try:
            repo = CounterRepository(db)
            for i in range(num_samples // 10):
                try:
                    num = repo.get_next_sample_number()
                    with lock:
                        if num in results['sample_numbers']:
                            results['duplicates'].append((thread_id, num))
                        results['sample_numbers'].append(num)
                except Exception as e:
                    with lock:
                        results['errors'].append((thread_id, str(e)))
        finally:
            db.close()
    
    # Run concurrent threads
    threads = []
    start = time.time()
    for i in range(10):
        t = threading.Thread(target=get_sample_number, args=(i,))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    duration = time.time() - start
    
    print(f"\nResults:")
    print(f"  Total numbers generated: {len(results['sample_numbers'])}")
    print(f"  Unique numbers:          {len(set(results['sample_numbers']))}")
    print(f"  Duplicates found:        {len(results['duplicates'])}")
    print(f"  Errors:                  {len(results['errors'])}")
    print(f"  Duration:                {duration:.2f}s")
    
    if results['duplicates']:
        print(f"\n  ⚠ RACE CONDITION DETECTED!")
        print(f"  Duplicate numbers: {results['duplicates'][:10]}...")
    else:
        print(f"\n  ✓ No race conditions detected in get_next_sample_number()")
    
    return results


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='POULTRY LIMS Concurrent Load Tester')
    parser.add_argument('--samples', type=int, default=100000, help='Total samples to create')
    parser.add_argument('--users', type=int, default=10, help='Number of concurrent users')
    parser.add_argument('--quick-test', action='store_true', help='Run quick counter validation only')
    parser.add_argument('--db-only', action='store_true', help='Run direct DB test only (skip HTTP)')
    
    args = parser.parse_args()
    
    CONFIG['TOTAL_SAMPLES'] = args.samples
    CONFIG['CONCURRENT_USERS'] = args.users
    CONFIG['ENABLE_API_TEST'] = not args.db_only
    
    if args.quick_test:
        quick_counter_test()
        return
    
    tester = ConcurrentLoadTester()
    results = tester.run_full_test()
    
    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = f"load_test_report_{timestamp}.json"
    
    # Convert results to serializable dict
    report_data = {
        'timestamp': timestamp,
        'total_samples': results.total_samples_created,
        'total_units': results.total_units_created,
        'total_errors': results.total_errors,
        'duplicate_errors': results.total_duplicate_errors,
        'race_condition_errors': results.total_race_condition_errors,
        'duration_seconds': results.total_duration_seconds,
        'samples_per_second': results.samples_per_second,
        'avg_response_time_ms': results.avg_response_time_ms,
        'p95_response_time_ms': results.p95_response_time_ms,
        'p99_response_time_ms': results.p99_response_time_ms,
        'weak_points': results.weak_points,
        'counter_integrity': {
            'gap_count': results.counter_integrity.gap_count,
            'duplicate_sample_codes': len(results.counter_integrity.duplicate_sample_codes),
            'duplicate_unit_codes': len(results.counter_integrity.duplicate_unit_codes),
            'counter_mismatches': len(results.counter_integrity.counter_vs_actual_mismatch)
        }
    }
    
    with open(report_file, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    main()
