"""
Counter Repository V2 - Atomic Database Sequences
=================================================
Completely rewritten counter logic using PostgreSQL sequences for
race-condition-free, high-performance counter operations.

Key improvements:
1. Uses PostgreSQL sequences (NEXTVAL) - atomic, no race conditions
2. No in-memory state - works across multiple workers/processes
3. O(1) performance - no table scans for gap-filling
4. Automatic yearly sequence creation
5. Fallback to legacy logic for compatibility

Author: POULTRY LIMS Team
Version: 2.0
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.exc import ProgrammingError, OperationalError
from typing import Optional, Dict, Tuple
from datetime import datetime
from app.models.counter import Counter
import logging

logger = logging.getLogger(__name__)


class CounterRepositoryV2:
    """
    Atomic counter repository using PostgreSQL sequences.
    
    Sequence naming convention:
    - Sample: sample_code_seq_{year}
    - Unit: unit_code_seq_{dept_code}_{year}
    
    Benefits over V1:
    - Zero race conditions (NEXTVAL is atomic)
    - O(1) time complexity (no table scans)
    - Works across multiple processes/workers
    - No in-memory state to lose on restart
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._sequence_cache: Dict[str, bool] = {}  # Cache for sequence existence checks
    
    # =========================================================================
    # SEQUENCE MANAGEMENT
    # =========================================================================
    
    def _ensure_sample_sequence(self, year: int) -> str:
        """Ensure sample sequence exists for the year, create if needed"""
        seq_name = f"sample_code_seq_{year}"
        
        # Check cache first
        if seq_name in self._sequence_cache:
            return seq_name
        
        try:
            # Check if sequence exists
            result = self.db.execute(text("""
                SELECT 1 FROM pg_sequences 
                WHERE schemaname = 'public' AND sequencename = :seq_name
            """), {"seq_name": seq_name}).fetchone()
            
            if not result:
                # Sequence doesn't exist - create it
                # First, find the current max sample number
                max_result = self.db.execute(text("""
                    SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)), 0)
                    FROM samples 
                    WHERE year = :year AND sample_code LIKE 'SMP%'
                """), {"year": year}).fetchone()
                
                start_value = (max_result[0] or 0) + 1
                
                # Create the sequence
                self.db.execute(text(f"""
                    CREATE SEQUENCE IF NOT EXISTS {seq_name} 
                    START WITH {start_value} 
                    INCREMENT BY 1 
                    NO MAXVALUE 
                    NO CYCLE
                """))
                self.db.commit()
                logger.info(f"Created sequence {seq_name} starting at {start_value}")
            
            self._sequence_cache[seq_name] = True
            return seq_name
            
        except Exception as e:
            logger.error(f"Error ensuring sample sequence: {e}")
            self.db.rollback()
            raise
    
    def _ensure_unit_sequence(self, department_id: int, dept_code: str, year: int) -> str:
        """Ensure unit sequence exists for the department and year"""
        seq_name = f"unit_code_seq_{dept_code.lower()}_{year}"
        
        # Check cache first
        if seq_name in self._sequence_cache:
            return seq_name
        
        try:
            # Check if sequence exists
            result = self.db.execute(text("""
                SELECT 1 FROM pg_sequences 
                WHERE schemaname = 'public' AND sequencename = :seq_name
            """), {"seq_name": seq_name}).fetchone()
            
            if not result:
                # Find current max unit number
                year_short = year % 100
                max_result = self.db.execute(text("""
                    SELECT COALESCE(MAX(
                        CASE 
                            WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                            WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                            ELSE 0
                        END
                    ), 0)
                    FROM units u
                    JOIN samples s ON u.sample_id = s.id
                    WHERE u.department_id = :dept_id AND s.year = :year
                """), {
                    "dept_id": department_id,
                    "year": year,
                    "pattern_new": f"{dept_code}{year_short:02d}-%",
                    "pattern_old": f"{dept_code}-{year_short:02d}-%"
                }).fetchone()
                
                start_value = (max_result[0] or 0) + 1
                
                # Create the sequence
                self.db.execute(text(f"""
                    CREATE SEQUENCE IF NOT EXISTS {seq_name} 
                    START WITH {start_value} 
                    INCREMENT BY 1 
                    NO MAXVALUE 
                    NO CYCLE
                """))
                self.db.commit()
                logger.info(f"Created sequence {seq_name} starting at {start_value}")
            
            self._sequence_cache[seq_name] = True
            return seq_name
            
        except Exception as e:
            logger.error(f"Error ensuring unit sequence: {e}")
            self.db.rollback()
            raise
    
    # =========================================================================
    # ATOMIC COUNTER OPERATIONS
    # =========================================================================
    
    def get_next_sample_number(self, year: Optional[int] = None) -> int:
        """
        Get next sample number using atomic NEXTVAL.
        
        This is completely race-condition free because:
        - NEXTVAL is atomic at the database level
        - Each call gets a unique number, guaranteed
        - Works across multiple connections/processes
        
        Returns:
            int: The next sample number (guaranteed unique)
        """
        if year is None:
            year = datetime.now().year
        
        try:
            seq_name = self._ensure_sample_sequence(year)
            
            # NEXTVAL is atomic - this is the key to preventing race conditions
            result = self.db.execute(text(f"SELECT nextval('{seq_name}')")).fetchone()
            next_num = result[0]
            
            # Also update the legacy counter table for compatibility
            self._sync_legacy_counter("sample", None, year, next_num)
            
            return next_num
            
        except ProgrammingError as e:
            # Sequence doesn't exist - create and retry
            logger.warning(f"Sequence error, recreating: {e}")
            self._sequence_cache.pop(f"sample_code_seq_{year}", None)
            return self.get_next_sample_number(year)
        except Exception as e:
            logger.error(f"Error getting next sample number: {e}")
            # Fallback to legacy method if sequences fail
            return self._legacy_get_next_sample_number(year)
    
    def get_next_unit_number(self, department_id: int, year: Optional[int] = None) -> int:
        """
        Get next unit number using atomic NEXTVAL.
        
        Returns:
            int: The next unit number for this department (guaranteed unique)
        """
        if year is None:
            year = datetime.now().year
        
        try:
            from app.models.department import Department
            
            # Get department code
            dept = self.db.query(Department).filter(Department.id == department_id).first()
            if not dept:
                raise ValueError(f"Department {department_id} not found")
            
            dept_code = str(dept.code)
            seq_name = self._ensure_unit_sequence(department_id, dept_code, year)
            
            # NEXTVAL is atomic
            result = self.db.execute(text(f"SELECT nextval('{seq_name}')")).fetchone()
            next_num = result[0]
            
            # Sync legacy counter
            self._sync_legacy_counter("unit", department_id, year, next_num)
            
            return next_num
            
        except ProgrammingError as e:
            logger.warning(f"Sequence error for unit, recreating: {e}")
            # Clear cache and retry
            from app.models.department import Department
            dept = self.db.query(Department).filter(Department.id == department_id).first()
            if dept:
                self._sequence_cache.pop(f"unit_code_seq_{dept.code.lower()}_{year}", None)
            return self.get_next_unit_number(department_id, year)
        except Exception as e:
            logger.error(f"Error getting next unit number: {e}")
            return self._legacy_get_next_unit_number(department_id, year)
    
    # =========================================================================
    # LEGACY COMPATIBILITY
    # =========================================================================
    
    def _sync_legacy_counter(self, counter_type: str, department_id: Optional[int], year: int, value: int):
        """Sync the legacy counter table with sequence value (for compatibility)"""
        try:
            if department_id is None:
                counter = self.db.query(Counter).filter(
                    Counter.counter_type == counter_type,
                    Counter.department_id.is_(None),
                    Counter.year == year
                ).first()
            else:
                counter = self.db.query(Counter).filter(
                    Counter.counter_type == counter_type,
                    Counter.department_id == department_id,
                    Counter.year == year
                ).first()
            
            if counter:
                if value > counter.current_value:
                    counter.current_value = value
            else:
                # Create counter record
                counter = Counter(
                    counter_type=counter_type,
                    department_id=department_id,
                    year=year,
                    current_value=value
                )
                self.db.add(counter)
            
            # Don't commit here - let the caller's transaction handle it
        except Exception as e:
            logger.warning(f"Could not sync legacy counter: {e}")
    
    def _legacy_get_next_sample_number(self, year: int) -> int:
        """Fallback to legacy counter method if sequences fail"""
        logger.warning("Using legacy sample counter method")
        
        counter = self.db.query(Counter).filter(
            Counter.counter_type == "sample",
            Counter.department_id.is_(None),
            Counter.year == year
        ).with_for_update().first()
        
        if not counter:
            counter = Counter(counter_type="sample", department_id=None, year=year, current_value=0)
            self.db.add(counter)
            self.db.flush()
        
        counter.current_value += 1
        self.db.flush()
        return counter.current_value
    
    def _legacy_get_next_unit_number(self, department_id: int, year: int) -> int:
        """Fallback to legacy counter method if sequences fail"""
        logger.warning("Using legacy unit counter method")
        
        counter = self.db.query(Counter).filter(
            Counter.counter_type == "unit",
            Counter.department_id == department_id,
            Counter.year == year
        ).with_for_update().first()
        
        if not counter:
            counter = Counter(counter_type="unit", department_id=department_id, year=year, current_value=0)
            self.db.add(counter)
            self.db.flush()
        
        counter.current_value += 1
        self.db.flush()
        return counter.current_value
    
    # =========================================================================
    # COUNTER MANAGEMENT (for admin/sync purposes)
    # =========================================================================
    
    def sync_sequence_with_database(self, year: Optional[int] = None):
        """
        Sync all sequences with actual database values.
        Call this after manual data imports or migrations.
        """
        if year is None:
            year = datetime.now().year
        
        # Sync sample sequence
        max_result = self.db.execute(text("""
            SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)), 0)
            FROM samples 
            WHERE year = :year AND sample_code LIKE 'SMP%'
        """), {"year": year}).fetchone()
        
        max_sample = max_result[0] or 0
        seq_name = f"sample_code_seq_{year}"
        
        try:
            self.db.execute(text(f"SELECT setval('{seq_name}', :val, true)"), {"val": max_sample})
            logger.info(f"Synced {seq_name} to {max_sample}")
        except Exception as e:
            logger.warning(f"Could not sync sample sequence: {e}")
        
        # Sync unit sequences for all departments
        from app.models.department import Department
        departments = self.db.query(Department).all()
        
        for dept in departments:
            year_short = year % 100
            max_result = self.db.execute(text("""
                SELECT COALESCE(MAX(
                    CASE 
                        WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                        WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                        ELSE 0
                    END
                ), 0)
                FROM units u
                JOIN samples s ON u.sample_id = s.id
                WHERE u.department_id = :dept_id AND s.year = :year
            """), {
                "dept_id": dept.id,
                "year": year,
                "pattern_new": f"{dept.code}{year_short:02d}-%",
                "pattern_old": f"{dept.code}-{year_short:02d}-%"
            }).fetchone()
            
            max_unit = max_result[0] or 0
            unit_seq_name = f"unit_code_seq_{dept.code.lower()}_{year}"
            
            try:
                self.db.execute(text(f"SELECT setval('{unit_seq_name}', :val, true)"), {"val": max_unit})
                logger.info(f"Synced {unit_seq_name} to {max_unit}")
            except Exception as e:
                logger.warning(f"Could not sync unit sequence for {dept.code}: {e}")
        
        self.db.commit()
    
    def get_current_sequence_value(self, seq_name: str) -> int:
        """Get current value of a sequence without incrementing"""
        try:
            result = self.db.execute(text(f"SELECT last_value FROM {seq_name}")).fetchone()
            return result[0] if result else 0
        except Exception:
            return 0
    
    # =========================================================================
    # BACKWARD COMPATIBLE METHODS
    # =========================================================================
    
    def get_sample_counter(self, year: Optional[int] = None, for_update: bool = False) -> Optional[Counter]:
        """Legacy method - get counter record"""
        if year is None:
            year = datetime.now().year
        query = self.db.query(Counter).filter(
            Counter.counter_type == "sample",
            Counter.department_id.is_(None),
            Counter.year == year
        )
        if for_update:
            query = query.with_for_update()
        return query.first()
    
    def get_unit_counter(self, department_id: int, year: Optional[int] = None, for_update: bool = False) -> Optional[Counter]:
        """Legacy method - get counter record"""
        if year is None:
            year = datetime.now().year
        query = self.db.query(Counter).filter(
            Counter.counter_type == "unit",
            Counter.department_id == department_id,
            Counter.year == year
        )
        if for_update:
            query = query.with_for_update()
        return query.first()
    
    def increment_sample_counter(self, year: Optional[int] = None) -> int:
        """Legacy method - now uses sequences"""
        return self.get_next_sample_number(year)
    
    def increment_unit_counter(self, department_id: int, year: Optional[int] = None) -> int:
        """Legacy method - now uses sequences"""
        return self.get_next_unit_number(department_id, year)
    
    def sync_sample_counter(self, year: Optional[int] = None) -> int:
        """Legacy method - sync sequence with database"""
        if year is None:
            year = datetime.now().year
        
        max_result = self.db.execute(text("""
            SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)), 0)
            FROM samples 
            WHERE year = :year AND sample_code LIKE 'SMP%'
        """), {"year": year}).fetchone()
        
        max_sample = max_result[0] or 0
        seq_name = f"sample_code_seq_{year}"
        
        try:
            # Ensure sequence is at least at max_sample
            current = self.db.execute(text(f"SELECT last_value FROM {seq_name}")).fetchone()
            if current and current[0] < max_sample:
                self.db.execute(text(f"SELECT setval('{seq_name}', :val, true)"), {"val": max_sample})
        except Exception:
            pass
        
        return max_sample
    
    def sync_unit_counter(self, department_id: int, year: Optional[int] = None) -> int:
        """Legacy method - sync unit sequence"""
        if year is None:
            year = datetime.now().year
        
        from app.models.department import Department
        dept = self.db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            return 0
        
        year_short = year % 100
        max_result = self.db.execute(text("""
            SELECT COALESCE(MAX(
                CASE 
                    WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                    ELSE 0
                END
            ), 0)
            FROM units u
            JOIN samples s ON u.sample_id = s.id
            WHERE u.department_id = :dept_id AND s.year = :year
        """), {
            "dept_id": department_id,
            "year": year,
            "pattern_new": f"{dept.code}{year_short:02d}-%",
            "pattern_old": f"{dept.code}-{year_short:02d}-%"
        }).fetchone()
        
        max_unit = max_result[0] or 0
        return max_unit
    
    # =========================================================================
    # RESERVATION METHODS (No longer needed with sequences, but kept for API)
    # =========================================================================
    
    def reserve_next_sample_number(self, user_id: int, year: Optional[int] = None) -> int:
        """
        With sequences, reservation is no longer needed.
        This just returns the preview of next number.
        """
        if year is None:
            year = datetime.now().year
        
        seq_name = f"sample_code_seq_{year}"
        try:
            result = self.db.execute(text(f"SELECT last_value + 1 FROM {seq_name}")).fetchone()
            return result[0] if result else 1
        except Exception:
            return 1
    
    def increment_sample_counter_with_reservation(self, user_id: int, year: Optional[int] = None) -> int:
        """With sequences, this is the same as get_next_sample_number"""
        return self.get_next_sample_number(year)
    
    # =========================================================================
    # DECREMENT METHODS (for sample deletion)
    # =========================================================================
    
    def decrement_sample_counter(self, sample_number: int, year: Optional[int] = None) -> bool:
        """
        With sequences, we don't decrement.
        Gaps are acceptable - they don't cause issues with sequences.
        This method is kept for API compatibility but does nothing.
        """
        # Sequences don't support decrement - gaps are acceptable
        # The next call to get_next_sample_number will still get a unique number
        return True
    
    def decrement_unit_counter(self, department_id: int, unit_number: int, year: Optional[int] = None) -> bool:
        """
        With sequences, we don't decrement unit counters.
        """
        return True
    
    # =========================================================================
    # DISEASE COUNTER METHODS (unchanged - these are lower volume)
    # =========================================================================
    
    def get_disease_counter(self, disease_name: str, year: Optional[int] = None, for_update: bool = False) -> Optional[Counter]:
        """Get counter for a specific disease type"""
        if year is None:
            year = datetime.now().year
        counter_type = f"microbiology_{disease_name.lower()}"
        query = self.db.query(Counter).filter(
            Counter.counter_type == counter_type,
            Counter.department_id.is_(None),
            Counter.year == year
        )
        if for_update:
            query = query.with_for_update()
        return query.first()
    
    def create_disease_counter(self, disease_name: str, year: Optional[int] = None) -> Counter:
        """Create counter for a specific disease type"""
        if year is None:
            year = datetime.now().year
        counter_type = f"microbiology_{disease_name.lower()}"
        counter = Counter(counter_type=counter_type, department_id=None, year=year, current_value=0)
        self.db.add(counter)
        self.db.commit()
        self.db.refresh(counter)
        return counter
    
    def increment_disease_counter(self, disease_name: str, year: Optional[int] = None) -> int:
        """Atomically increment disease counter with row-level locking"""
        if year is None:
            year = datetime.now().year
        
        counter = self.get_disease_counter(disease_name, year, for_update=True)
        if not counter:
            counter = self.create_disease_counter(disease_name, year)
            counter = self.get_disease_counter(disease_name, year, for_update=True)
        
        counter.current_value += 1
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value
