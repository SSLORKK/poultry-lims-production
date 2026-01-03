# Counter Logic Review - Issues and Recommendations

## ✅ ALL ISSUES FIXED (Jan 3, 2026)

All critical issues identified below have been fixed in `counter_repository.py` and `sample_service.py`.

---

## Critical Issues Found (FIXED)

### 1. **BUG: `decrement_sample_counter` has placeholder logic** (Line 456)
```python
higher_samples = self.db.query(Sample).filter(
    Sample.year == year,
    Sample.id > 0  # ⚠️ This is a placeholder - doesn't check actual sample numbers
).all()
```
**Problem:** This doesn't actually check for higher sample numbers. It just gets all samples.
**Impact:** Counter won't decrement correctly when samples are deleted.
**Fix:** Check actual sample numbers from `sample_code`.

### 2. **BUG: `decrement_unit_counter` expects old format** (Line 508)
```python
if len(parts) == 3:  # ⚠️ Expects DEPT-YY-NUM format
    num = int(parts[2])
```
**Problem:** We changed format to `DEPTYY-NUM` (2 parts), but this still expects 3 parts.
**Impact:** Won't extract unit numbers correctly, counter won't decrement.
**Fix:** Update to handle new format.

### 3. **RACE CONDITION: Gap-finding without locks** (Lines 89-114, 196-246)
```python
def get_next_sample_number(self, year: Optional[int] = None) -> int:
    # Gets all existing numbers WITHOUT lock
    result = self.db.execute(text("""...""")).fetchall()
    
    # Finds gap in Python - multiple concurrent requests could find same gap
    existing = set(row[0] for row in result)
    for i in range(1, max(existing) + 2):
        if i not in existing:
            return i  # ⚠️ No lock - race condition!
```
**Problem:** Multiple users creating samples simultaneously could get the same gap number.
**Impact:** Duplicate sample codes when concurrent users create samples.
**Fix:** Use `FOR UPDATE` lock or retry with duplicate check.

### 4. **RACE CONDITION: Reservation system not thread-safe** (Lines 7-10, 371-437)
```python
SAMPLE_RESERVATIONS: Dict[int, Tuple[int, datetime]] = {}  # ⚠️ Global variable, no locks
```
**Problem:** Multiple threads could modify `SAMPLE_RESERVATIONS` simultaneously.
**Impact:** Lost reservations, duplicate numbers.
**Fix:** Use threading.Lock() or Redis for distributed locking.

### 5. **INCONSISTENCY: Sample creation doesn't use increment functions**
In `sample_service.py`:
```python
sample_number = self.counter_repo.get_next_sample_number(year=current_year)
# ⚠️ Uses gap-finding without lock, then checks for duplicates
existing_sample = self.sample_repo.get_by_sample_code(sample_code)
while existing_sample:
    sample_number = self.counter_repo.get_next_sample_number(year=current_year)
    # ...
```
**Problem:** Retry loop could be inefficient under high concurrency.
**Impact:** Multiple retries needed, potential performance issues.

### 6. **INCONSISTENCY: Unit code format handling**
The sync functions handle 3 formats:
- New: `DEPTYY-NUM` (e.g., `PCR26-1`)
- Old: `DEPT-YY-NUM` (e.g., `PCR-26-1`)
- Oldest: `DEPT-NUM` (e.g., `PCR-1`)

But `decrement_unit_counter` only handles the old format.

## Recommendations

### High Priority (Fix Immediately)

1. **Fix `decrement_sample_counter`:**
```python
def decrement_sample_counter(self, sample_number: int, year: Optional[int] = None) -> bool:
    if year is None:
        year = datetime.now().year
    
    counter = self.get_sample_counter(year, for_update=True)  # Add lock
    if not counter:
        return False
    
    # Check if there are any samples with higher numbers
    result = self.db.execute(text("""
        SELECT MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)) as max_num
        FROM samples
        WHERE year = :year AND sample_code LIKE 'SMP%'
    """), {"year": year}).fetchone()
    
    max_sample_number = result[0] if result and result[0] else 0
    
    # Only decrement if the deleted sample was the highest number
    if sample_number >= max_sample_number:
        counter.current_value = max(0, counter.current_value - 1)
        self.db.commit()
        return True
    
    return False
```

2. **Fix `decrement_unit_counter`:**
```python
def decrement_unit_counter(self, department_id: int, unit_number: int, year: Optional[int] = None) -> bool:
    if year is None:
        year = datetime.now().year
    
    counter = self.get_unit_counter(department_id, year, for_update=True)  # Add lock
    if not counter:
        return False
    
    from app.models.department import Department
    dept = self.db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        return False
    
    year_short = str(year % 100).zfill(2)
    
    # Check for highest unit number (handles all formats)
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
    
    # Only decrement if the deleted unit was the highest number
    if unit_number >= max_unit_number:
        counter.current_value = max(0, counter.current_value - 1)
        self.db.commit()
        return True
    
    return False
```

3. **Add locking to gap-finding functions:**
```python
def get_next_sample_number(self, year: Optional[int] = None) -> int:
    if year is None:
        year = datetime.now().year
    
    # Lock the counter to prevent race conditions
    counter = self.get_sample_counter(year, for_update=True)
    if not counter:
        counter = self.create_sample_counter(year)
        counter = self.get_sample_counter(year, for_update=True)
    
    # Get all existing sample numbers
    result = self.db.execute(text("""
        SELECT CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER) as num
        FROM samples
        WHERE year = :year AND sample_code LIKE 'SMP%'
        ORDER BY num
    """), {"year": year}).fetchall()
    
    if not result:
        counter.current_value = 1
        self.db.commit()
        return 1
    
    # Find first gap
    existing = set(row[0] for row in result)
    next_number = 1
    for i in range(1, max(existing) + 2):
        if i not in existing:
            next_number = i
            break
    
    # Update counter if needed
    if next_number > counter.current_value:
        counter.current_value = next_number
        self.db.commit()
    
    return next_number
```

### Medium Priority

4. **Use threading.Lock for reservations:**
```python
import threading

SAMPLE_RESERVATIONS: Dict[int, Tuple[int, datetime]] = {}
RESERVATION_LOCK = threading.Lock()  # Add this

def reserve_next_sample_number(self, user_id: int, year: Optional[int] = None) -> int:
    global SAMPLE_RESERVATIONS, RESERVATION_LOCK
    
    with RESERVATION_LOCK:  # Thread-safe access
        # ... existing logic
```

5. **Consider using Redis for distributed locking** (if using multiple servers)

### Low Priority

6. **Add monitoring/logging for counter operations**
7. **Add periodic counter sync job** (e.g., every hour)

## Prevention Strategies

1. **Always use `for_update=True`** when modifying counters
2. **Wrap counter operations in transactions**
3. **Add unique constraints** on sample_code and unit_code in database
4. **Implement retry logic** with exponential backoff for conflicts
5. **Add comprehensive logging** for all counter operations
6. **Run periodic integrity checks** to detect gaps/duplicates
7. **Monitor for race conditions** in production logs
