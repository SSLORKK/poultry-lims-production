from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
from app.models.counter import Counter
import threading

# In-memory reservation storage: {user_id: (sample_number, timestamp)}
# This will be lost on server restart, but that's acceptable for reservations
SAMPLE_RESERVATIONS: Dict[int, Tuple[int, datetime]] = {}
RESERVATION_LOCK = threading.Lock()  # Thread-safe access to reservations
RESERVATION_TIMEOUT_MINUTES = 2  # Expire after 2 minutes of inactivity


class CounterRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_sample_counter(self, year: Optional[int] = None, for_update: bool = False) -> Optional[Counter]:
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
    
    def create_sample_counter(self, year: Optional[int] = None) -> Counter:
        if year is None:
            year = datetime.now().year
        counter = Counter(counter_type="sample", department_id=None, year=year, current_value=0)
        self.db.add(counter)
        self.db.commit()
        self.db.refresh(counter)
        return counter
    
    def create_unit_counter(self, department_id: int, year: Optional[int] = None) -> Counter:
        if year is None:
            year = datetime.now().year
        counter = Counter(counter_type="unit", department_id=department_id, year=year, current_value=0)
        self.db.add(counter)
        self.db.commit()
        self.db.refresh(counter)
        return counter
    
    def sync_sample_counter(self, year: Optional[int] = None) -> int:
        """Sync sample counter with the actual highest sample number in database"""
        if year is None:
            year = datetime.now().year
        
        from app.models.sample import Sample
        
        # Use SQL aggregation to find highest sample number efficiently
        result = self.db.execute(text("""
            SELECT MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)) as max_num
            FROM samples
            WHERE year = :year AND sample_code LIKE 'SMP%'
        """), {"year": year}).fetchone()
        
        max_number = result[0] if result and result[0] else 0
        
        # Get or create counter with lock
        counter = self.get_sample_counter(year, for_update=True)
        if not counter:
            counter = self.create_sample_counter(year)
            counter = self.get_sample_counter(year, for_update=True)
        
        # Update counter if it's lower than the max
        if counter.current_value < max_number:
            counter.current_value = max_number
            self.db.commit()
            self.db.refresh(counter)
        
        return counter.current_value
    
    def get_next_sample_number(self, year: Optional[int] = None) -> int:
        """Get the next sample number with locking to prevent race conditions
        
        OPTIMIZED: Uses single SQL query with window function to find first gap.
        Uses FOR UPDATE lock to ensure only one transaction can get the next number at a time.
        """
        if year is None:
            year = datetime.now().year
        
        # Lock the counter to prevent race conditions
        counter = self.get_sample_counter(year, for_update=True)
        if not counter:
            counter = self.create_sample_counter(year)
            counter = self.get_sample_counter(year, for_update=True)
        
        # OPTIMIZED: Single query to find first gap using SQL
        # This replaces 2 separate queries with 1 efficient query
        result = self.db.execute(text("""
            WITH numbered AS (
                SELECT CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER) as num
                FROM samples
                WHERE year = :year AND sample_code LIKE 'SMP%'
            ),
            with_max AS (
                SELECT num, MAX(num) OVER () as max_num FROM numbered
            ),
            gaps AS (
                SELECT 1 as gap_num WHERE NOT EXISTS (SELECT 1 FROM numbered WHERE num = 1)
                UNION ALL
                SELECT num + 1 FROM numbered n 
                WHERE NOT EXISTS (SELECT 1 FROM numbered WHERE num = n.num + 1)
                  AND num < (SELECT COALESCE(MAX(num), 0) FROM numbered)
                UNION ALL
                SELECT COALESCE(MAX(num), 0) + 1 FROM numbered
            )
            SELECT MIN(gap_num) as next_num FROM gaps
        """), {"year": year}).fetchone()
        
        next_num = result[0] if result and result[0] else 1
        
        # Sync counter if behind
        if counter.current_value < next_num:
            counter.current_value = next_num
        
        return next_num
    
    def set_sample_counter(self, number: int, year: Optional[int] = None, commit: bool = False) -> int:
        """Set the sample counter to a specific number (after successful creation)
        
        Args:
            number: The number to set the counter to
            year: The year for the counter
            commit: If False, don't commit - let the caller's transaction handle it
        """
        if year is None:
            year = datetime.now().year
        
        # Get counter with lock
        counter = self.get_sample_counter(year, for_update=True)
        if not counter:
            counter = self.create_sample_counter(year)
            counter = self.get_sample_counter(year, for_update=True)
        
        # Only update if the new number is higher
        if number > counter.current_value:
            counter.current_value = number
            # Only commit if explicitly requested - otherwise let caller's transaction handle it
            if commit:
                self.db.commit()
                self.db.refresh(counter)
        
        return counter.current_value
    
    def sync_unit_counter(self, department_id: int, year: Optional[int] = None) -> int:
        """Sync unit counter with the actual highest unit number in database for a department"""
        if year is None:
            year = datetime.now().year
        
        from app.models.unit import Unit
        from app.models.department import Department
        
        # Get department code
        dept = self.db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            return 0
        
        year_short = str(year % 100).zfill(2)
        
        # Use SQL aggregation to find highest unit number efficiently
        # Handle new format (DEPTYY-NUM) and old format (DEPT-YY-NUM, DEPT-number)
        # IMPORTANT: Order patterns from most specific to least specific to avoid wrong matches
        result = self.db.execute(text("""
            SELECT MAX(
                CASE 
                    WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                    WHEN unit_code LIKE :pattern_oldest THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    ELSE 0
                END
            ) as max_num
            FROM units
            WHERE department_id = :dept_id AND (
                unit_code LIKE :pattern_new OR unit_code LIKE :pattern_old OR unit_code LIKE :pattern_oldest
            )
        """), {
            "dept_id": department_id,
            "pattern_new": f"{dept.code}{year_short}-%",
            "pattern_old": f"{dept.code}-%{year_short}-%",
            "pattern_oldest": f"{dept.code}-%"
        }).fetchone()
        
        max_number = result[0] if result and result[0] else 0
        
        # Get or create counter with lock
        counter = self.get_unit_counter(department_id, year, for_update=True)
        if not counter:
            counter = self.create_unit_counter(department_id, year)
            counter = self.get_unit_counter(department_id, year, for_update=True)
        
        # Update counter if it's lower than the max
        if counter.current_value < max_number:
            counter.current_value = max_number
            self.db.commit()
            self.db.refresh(counter)
        
        return counter.current_value
    
    def get_next_unit_number(self, department_id: int, year: Optional[int] = None) -> int:
        """Get the next unit number with locking to prevent race conditions
        
        OPTIMIZED: Uses single SQL query with window function to find first gap.
        Uses FOR UPDATE lock to ensure only one transaction can get the next number at a time.
        """
        if year is None:
            year = datetime.now().year
        
        from app.models.department import Department
        
        # Get department code
        dept = self.db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            return 1
        
        # Lock the counter to prevent race conditions
        counter = self.get_unit_counter(department_id, year, for_update=True)
        if not counter:
            counter = self.create_unit_counter(department_id, year)
            counter = self.get_unit_counter(department_id, year, for_update=True)
        
        year_short = str(year % 100).zfill(2)
        
        # OPTIMIZED: Single query to find first gap using SQL
        # Handles new format (DEPTYY-NUM) and old format (DEPT-YY-NUM, DEPT-number)
        result = self.db.execute(text("""
            WITH numbered AS (
                SELECT CASE 
                    WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                    WHEN unit_code LIKE :pattern_oldest THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    ELSE 0
                END as num
                FROM units
                WHERE department_id = :dept_id AND (
                    unit_code LIKE :pattern_new OR unit_code LIKE :pattern_old OR unit_code LIKE :pattern_oldest
                )
            ),
            valid_nums AS (
                SELECT num FROM numbered WHERE num > 0
            ),
            gaps AS (
                SELECT 1 as gap_num WHERE NOT EXISTS (SELECT 1 FROM valid_nums WHERE num = 1)
                UNION ALL
                SELECT num + 1 FROM valid_nums n 
                WHERE NOT EXISTS (SELECT 1 FROM valid_nums WHERE num = n.num + 1)
                  AND num < (SELECT COALESCE(MAX(num), 0) FROM valid_nums)
                UNION ALL
                SELECT COALESCE(MAX(num), 0) + 1 FROM valid_nums
            )
            SELECT MIN(gap_num) as next_num FROM gaps
        """), {
            "dept_id": department_id,
            "pattern_new": f"{dept.code}{year_short}-%",
            "pattern_old": f"{dept.code}-%{year_short}-%",
            "pattern_oldest": f"{dept.code}-%"
        }).fetchone()
        
        next_num = result[0] if result and result[0] else 1
        
        # Sync counter if behind
        if counter.current_value < next_num:
            counter.current_value = next_num
        
        return next_num
    
    def set_unit_counter(self, department_id: int, number: int, year: Optional[int] = None, commit: bool = False) -> int:
        """Set the unit counter to a specific number (after successful creation)
        
        Args:
            department_id: The department ID
            number: The number to set the counter to
            year: The year for the counter
            commit: If False, don't commit - let the caller's transaction handle it
        """
        if year is None:
            year = datetime.now().year
        
        # Get counter with lock
        counter = self.get_unit_counter(department_id, year, for_update=True)
        if not counter:
            counter = self.create_unit_counter(department_id, year)
            counter = self.get_unit_counter(department_id, year, for_update=True)
        
        # Only update if the new number is higher
        if number > counter.current_value:
            counter.current_value = number
            # Only commit if explicitly requested - otherwise let caller's transaction handle it
            if commit:
                self.db.commit()
                self.db.refresh(counter)
        
        return counter.current_value
    
    def increment_sample_counter(self, year: Optional[int] = None) -> int:
        """Atomically increment sample counter with row-level locking and auto-sync"""
        if year is None:
            year = datetime.now().year
        
        # Auto-sync counter with database before incrementing to prevent duplicates
        self.sync_sample_counter(year)
        
        # Use FOR UPDATE to lock the row and prevent race conditions
        counter = self.get_sample_counter(year, for_update=True)
        if not counter:
            counter = self.create_sample_counter(year)
            # Re-fetch with lock after creation
            counter = self.get_sample_counter(year, for_update=True)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def increment_unit_counter(self, department_id: int, year: Optional[int] = None) -> int:
        """Atomically increment unit counter with row-level locking and auto-sync"""
        if year is None:
            year = datetime.now().year
        
        # Auto-sync counter with database before incrementing to prevent duplicates
        self.sync_unit_counter(department_id, year)
        
        # Use FOR UPDATE to lock the row and prevent race conditions
        counter = self.get_unit_counter(department_id, year, for_update=True)
        if not counter:
            counter = self.create_unit_counter(department_id, year)
            # Re-fetch with lock after creation
            counter = self.get_unit_counter(department_id, year, for_update=True)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def get_disease_counter(self, disease_name: str, year: Optional[int] = None, for_update: bool = False) -> Optional[Counter]:
        """Get counter for a specific disease type (e.g., 'salmonella', 'fungal', 'culture')"""
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
        
        # Use FOR UPDATE to lock the row and prevent race conditions
        counter = self.get_disease_counter(disease_name, year, for_update=True)
        if not counter:
            counter = self.create_disease_counter(disease_name, year)
            # Re-fetch with lock after creation
            counter = self.get_disease_counter(disease_name, year, for_update=True)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def _cleanup_expired_reservations(self):
        """Remove expired reservations (must be called within RESERVATION_LOCK)"""
        global SAMPLE_RESERVATIONS
        expired = []
        now = datetime.now()
        
        for user_id, (number, timestamp) in SAMPLE_RESERVATIONS.items():
            if now - timestamp > timedelta(minutes=RESERVATION_TIMEOUT_MINUTES):
                expired.append(user_id)
        
        for user_id in expired:
            del SAMPLE_RESERVATIONS[user_id]
    
    def reserve_next_sample_number(self, user_id: int, year: Optional[int] = None) -> int:
        """Reserve the next sample number for this user (auto-refreshes if already reserved)
        
        Thread-safe: Uses RESERVATION_LOCK to prevent race conditions.
        Uses gap-filling to avoid creating gaps in the sequence.
        """
        global SAMPLE_RESERVATIONS, RESERVATION_LOCK
        
        if year is None:
            year = datetime.now().year
        
        with RESERVATION_LOCK:
            # Clean up old reservations
            self._cleanup_expired_reservations()
            
            # Check if user already has a reservation - if yes, refresh the timestamp
            if user_id in SAMPLE_RESERVATIONS:
                number, _ = SAMPLE_RESERVATIONS[user_id]
                # Refresh the timestamp to extend the reservation
                SAMPLE_RESERVATIONS[user_id] = (number, datetime.now())
                return number  # Return existing reservation with refreshed timestamp
            
            # Use get_next_sample_number to find the next available number (fills gaps)
            # This ensures we don't create gaps in the sequence
            next_number = self.get_next_sample_number(year)
            
            # Reserve it
            SAMPLE_RESERVATIONS[user_id] = (next_number, datetime.now())
            
            return next_number
    
    def increment_sample_counter_with_reservation(self, user_id: int, year: Optional[int] = None) -> int:
        """Increment counter using reserved number, or normally if no reservation
        
        Thread-safe: Uses RESERVATION_LOCK for reservation access.
        """
        global SAMPLE_RESERVATIONS, RESERVATION_LOCK
        
        if year is None:
            year = datetime.now().year
        
        # Auto-sync counter with database first to ensure accuracy
        self.sync_sample_counter(year)
        
        with RESERVATION_LOCK:
            # Check if user has reservation
            if user_id in SAMPLE_RESERVATIONS:
                reserved_number, _ = SAMPLE_RESERVATIONS[user_id]
                
                # Get or create counter with lock
                counter = self.get_sample_counter(year, for_update=True)
                if not counter:
                    counter = self.create_sample_counter(year)
                    counter = self.get_sample_counter(year, for_update=True)
                
                # Only use reservation if it's higher than current counter
                # Otherwise increment normally to avoid conflicts
                if reserved_number > counter.current_value:
                    counter.current_value = reserved_number
                    self.db.commit()
                    self.db.refresh(counter)
                    del SAMPLE_RESERVATIONS[user_id]
                    return reserved_number
                else:
                    # Reservation is stale, remove it and increment normally
                    del SAMPLE_RESERVATIONS[user_id]
                    counter.current_value += 1
                    self.db.commit()
                    self.db.refresh(counter)
                    return counter.current_value
        
        # No reservation, increment normally
        return self.increment_sample_counter(year)
    
    def decrement_sample_counter(self, sample_number: int, year: Optional[int] = None) -> bool:
        """
        Smart decrement of sample counter.
        Only decrements if the deleted sample is the highest in the sequence for that year.
        Returns True if counter was decremented, False otherwise.
        """
        if year is None:
            year = datetime.now().year
        
        # Lock the counter to prevent race conditions
        counter = self.get_sample_counter(year, for_update=True)
        if not counter:
            return False
        
        # Use SQL to find highest sample number efficiently
        result = self.db.execute(text("""
            SELECT MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)) as max_num
            FROM samples
            WHERE year = :year AND sample_code LIKE 'SMP%'
        """), {"year": year}).fetchone()
        
        max_sample_number = result[0] if result and result[0] else 0
        
        # Only update counter if the deleted sample was the highest number
        # Set counter to the actual max (not just decrement by 1)
        if sample_number >= max_sample_number:
            counter.current_value = max_sample_number  # type: ignore[assignment]
            self.db.commit()
            self.db.refresh(counter)
            return True
        
        return False
    
    def decrement_unit_counter(self, department_id: int, unit_number: int, year: Optional[int] = None) -> bool:
        """
        Smart decrement of unit counter for a specific department.
        Only decrements if the deleted unit is the highest in the sequence for that department and year.
        Returns True if counter was decremented, False otherwise.
        """
        if year is None:
            year = datetime.now().year
        
        # Lock the counter to prevent race conditions
        counter = self.get_unit_counter(department_id, year, for_update=True)
        if not counter:
            return False
        
        from app.models.department import Department
        dept = self.db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            return False
        
        year_short = str(year % 100).zfill(2)
        
        # Use SQL to find highest unit number efficiently
        # Handle new format (DEPTYY-NUM) and old format (DEPT-YY-NUM, DEPT-number)
        # IMPORTANT: Order patterns from most specific to least specific to avoid wrong matches
        result = self.db.execute(text("""
            SELECT MAX(
                CASE 
                    WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                    WHEN unit_code LIKE :pattern_oldest THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    ELSE 0
                END
            ) as max_num
            FROM units
            WHERE department_id = :dept_id AND (
                unit_code LIKE :pattern_new OR unit_code LIKE :pattern_old OR unit_code LIKE :pattern_oldest
            )
        """), {
            "dept_id": department_id,
            "pattern_new": f"{dept.code}{year_short}-%",
            "pattern_old": f"{dept.code}-%{year_short}-%",
            "pattern_oldest": f"{dept.code}-%"
        }).fetchone()
        
        max_unit_number = result[0] if result and result[0] else 0
        
        # Only update counter if the deleted unit was the highest number
        # Set counter to the actual max (not just decrement by 1)
        if unit_number >= max_unit_number:
            counter.current_value = max_unit_number  # type: ignore[assignment]
            self.db.commit()
            self.db.refresh(counter)
            return True
        
        return False
    
    # ============================================================================
    # NEW: Database-level atomic code generation methods
    # These use PostgreSQL functions for guaranteed gap-free sequential codes
    # ============================================================================
    
    def reserve_sample_code_atomic(self, year: Optional[int] = None, session_id: Optional[str] = None) -> str:
        """
        Reserve a sample code atomically using database function.
        The code is reserved for 5 minutes and must be confirmed after successful insert.
        
        This method:
        1. Finds the first available gap in sample codes
        2. Reserves it in reserved_codes table
        3. Returns the reserved code
        
        If the sample creation fails, the reservation expires automatically.
        """
        if year is None:
            year = datetime.now().year
        
        try:
            # Use SAVEPOINT so we can rollback just this operation if it fails
            # without aborting the entire transaction
            self.db.execute(text("SAVEPOINT reserve_sample_sp"))
            result = self.db.execute(
                text("SELECT reserve_sample_code(:year, :session_id)"),
                {"year": year, "session_id": session_id}
            ).fetchone()
            
            if result and result[0]:
                self.db.execute(text("RELEASE SAVEPOINT reserve_sample_sp"))
                return result[0]
            # If no result, rollback savepoint and use fallback
            self.db.execute(text("ROLLBACK TO SAVEPOINT reserve_sample_sp"))
        except Exception:
            # Function doesn't exist yet (migration not run) - rollback savepoint and fall back
            try:
                self.db.execute(text("ROLLBACK TO SAVEPOINT reserve_sample_sp"))
            except Exception:
                pass
        
        # Fallback to old method if function doesn't exist
        sample_number = self.get_next_sample_number(year)
        year_short = year % 100
        return f"SMP{year_short:02d}-{sample_number}"
    
    def confirm_sample_code_atomic(self, code: str) -> None:
        """
        Confirm a reserved sample code after successful insert.
        This removes the reservation from the reserved_codes table.
        """
        try:
            # Use SAVEPOINT so we can rollback just this operation if it fails
            # without aborting the entire transaction
            self.db.execute(text("SAVEPOINT confirm_sample_sp"))
            self.db.execute(
                text("SELECT confirm_sample_code(:code)"),
                {"code": code}
            )
            self.db.execute(text("RELEASE SAVEPOINT confirm_sample_sp"))
        except Exception:
            # Function doesn't exist yet - rollback savepoint and ignore
            try:
                self.db.execute(text("ROLLBACK TO SAVEPOINT confirm_sample_sp"))
            except Exception:
                pass
    
    def reserve_unit_code_atomic(self, department_id: int, year: Optional[int] = None, session_id: Optional[str] = None) -> str:
        """
        Reserve a unit code atomically using database function.
        """
        if year is None:
            year = datetime.now().year
        
        try:
            # Use SAVEPOINT so we can rollback just this operation if it fails
            # without aborting the entire transaction
            self.db.execute(text("SAVEPOINT reserve_unit_sp"))
            result = self.db.execute(
                text("SELECT reserve_unit_code(:dept_id, :year, :session_id)"),
                {"dept_id": department_id, "year": year, "session_id": session_id}
            ).fetchone()
            
            if result and result[0]:
                self.db.execute(text("RELEASE SAVEPOINT reserve_unit_sp"))
                return result[0]
            # If no result, rollback savepoint and use fallback
            self.db.execute(text("ROLLBACK TO SAVEPOINT reserve_unit_sp"))
        except Exception:
            # Function doesn't exist yet - rollback savepoint and fall back
            try:
                self.db.execute(text("ROLLBACK TO SAVEPOINT reserve_unit_sp"))
            except Exception:
                pass
        
        # Fallback to old method
        from app.models.department import Department
        dept = self.db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            return ""
        
        unit_number = self.get_next_unit_number(department_id, year)
        year_short = year % 100
        return f"{dept.code}{year_short:02d}-{unit_number}"
    
    def cleanup_expired_reservations(self) -> int:
        """
        Clean up expired code reservations.
        Returns the number of reservations cleaned up.
        """
        try:
            # Use SAVEPOINT so we can rollback just this operation if it fails
            self.db.execute(text("SAVEPOINT cleanup_reservations_sp"))
            result = self.db.execute(text("SELECT cleanup_expired_reservations()")).fetchone()
            self.db.execute(text("RELEASE SAVEPOINT cleanup_reservations_sp"))
            return result[0] if result else 0
        except Exception:
            try:
                self.db.execute(text("ROLLBACK TO SAVEPOINT cleanup_reservations_sp"))
            except Exception:
                pass
            return 0
