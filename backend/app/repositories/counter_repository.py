from sqlalchemy.orm import Session
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
from app.models.counter import Counter

# In-memory reservation storage: {user_id: (sample_number, timestamp)}
# This will be lost on server restart, but that's acceptable for reservations
SAMPLE_RESERVATIONS: Dict[int, Tuple[int, datetime]] = {}
RESERVATION_TIMEOUT_MINUTES = 2  # Expire after 2 minutes of inactivity


class CounterRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_sample_counter(self, year: Optional[int] = None) -> Optional[Counter]:
        if year is None:
            year = datetime.now().year
        return self.db.query(Counter).filter(
            Counter.counter_type == "sample",
            Counter.department_id.is_(None),
            Counter.year == year
        ).first()
    
    def get_unit_counter(self, department_id: int, year: Optional[int] = None) -> Optional[Counter]:
        if year is None:
            year = datetime.now().year
        return self.db.query(Counter).filter(
            Counter.counter_type == "unit",
            Counter.department_id == department_id,
            Counter.year == year
        ).first()
    
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
    
    def increment_sample_counter(self, year: Optional[int] = None) -> int:
        if year is None:
            year = datetime.now().year
        counter = self.get_sample_counter(year)
        if not counter:
            counter = self.create_sample_counter(year)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def increment_unit_counter(self, department_id: int, year: Optional[int] = None) -> int:
        if year is None:
            year = datetime.now().year
        counter = self.get_unit_counter(department_id, year)
        if not counter:
            counter = self.create_unit_counter(department_id, year)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def get_disease_counter(self, disease_name: str, year: Optional[int] = None) -> Optional[Counter]:
        """Get counter for a specific disease type (e.g., 'salmonella', 'fungal', 'culture')"""
        if year is None:
            year = datetime.now().year
        counter_type = f"microbiology_{disease_name.lower()}"
        return self.db.query(Counter).filter(
            Counter.counter_type == counter_type,
            Counter.department_id.is_(None),
            Counter.year == year
        ).first()
    
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
        """Increment counter for a specific disease and return new value"""
        if year is None:
            year = datetime.now().year
        counter = self.get_disease_counter(disease_name, year)
        if not counter:
            counter = self.create_disease_counter(disease_name, year)
        
        counter.current_value += 1  # type: ignore[assignment]
        self.db.commit()
        self.db.refresh(counter)
        return counter.current_value  # type: ignore[return-value]
    
    def _cleanup_expired_reservations(self):
        """Remove expired reservations"""
        global SAMPLE_RESERVATIONS
        expired = []
        now = datetime.now()
        
        for user_id, (number, timestamp) in SAMPLE_RESERVATIONS.items():
            if now - timestamp > timedelta(minutes=RESERVATION_TIMEOUT_MINUTES):
                expired.append(user_id)
        
        for user_id in expired:
            del SAMPLE_RESERVATIONS[user_id]
    
    def reserve_next_sample_number(self, user_id: int, year: Optional[int] = None) -> int:
        """Reserve the next sample number for this user (auto-refreshes if already reserved)"""
        global SAMPLE_RESERVATIONS
        
        if year is None:
            year = datetime.now().year
        
        # Clean up old reservations
        self._cleanup_expired_reservations()
        
        # Check if user already has a reservation - if yes, refresh the timestamp
        if user_id in SAMPLE_RESERVATIONS:
            number, _ = SAMPLE_RESERVATIONS[user_id]
            # Refresh the timestamp to extend the reservation
            SAMPLE_RESERVATIONS[user_id] = (number, datetime.now())
            return number  # Return existing reservation with refreshed timestamp
        
        # Get current counter value
        counter = self.get_sample_counter(year)
        current_value: int = int(counter.current_value) if counter and counter.current_value else 0  # type: ignore
        
        # Next number is current + 1 + count of active reservations
        next_number: int = current_value + 1 + len(SAMPLE_RESERVATIONS)
        
        # Reserve it
        SAMPLE_RESERVATIONS[user_id] = (next_number, datetime.now())
        
        return next_number
    
    def increment_sample_counter_with_reservation(self, user_id: int, year: Optional[int] = None) -> int:
        """Increment counter using reserved number, or normally if no reservation"""
        global SAMPLE_RESERVATIONS
        
        if year is None:
            year = datetime.now().year
        
        # Check if user has reservation
        if user_id in SAMPLE_RESERVATIONS:
            reserved_number, _ = SAMPLE_RESERVATIONS[user_id]
            
            # Get or create counter
            counter = self.get_sample_counter(year)
            if not counter:
                counter = self.create_sample_counter(year)
            
            # Set counter to reserved number
            counter.current_value = reserved_number  # type: ignore[assignment]
            self.db.commit()
            self.db.refresh(counter)
            
            # Remove reservation
            del SAMPLE_RESERVATIONS[user_id]
            
            return reserved_number
        
        # No reservation, increment normally
        return self.increment_sample_counter(year)
