# Deep QA Review of Counter Logic - Critical Issues Found

## ✅ FIXED ISSUES (Jan 3, 2026)

### 1. ✅ **Unit Code Pattern Matching Bug - FIXED**
**Status:** FIXED - Added comments documenting correct pattern order
**Note:** The pattern order was already correct (most specific to least specific). Added documentation to prevent future issues.

### 2. ✅ **Counter Decrement Logic Bug - FIXED**
**Status:** FIXED - Now sets counter to actual max instead of decrementing by 1
**Fix Applied:**
```python
# Before: counter.current_value = max(0, counter.current_value - 1)
# After:  counter.current_value = max_sample_number
```

### 3. ✅ **Reservation System Race Condition - FIXED**
**Status:** FIXED - Now uses gap-filling via `get_next_sample_number()`
**Fix Applied:**
```python
# Before: next_number = current_value + 1 + len(SAMPLE_RESERVATIONS)
# After:  next_number = self.get_next_sample_number(year)
```

---

## 🔴 REMAINING CRITICAL ISSUES

### 4. **Long Lock Hold Time - Performance Issue**
**Location:** `counter_repository.py` lines 100-123, 221-262

**Problem:** `get_next_sample_number()` and `get_next_unit_number()` hold the FOR UPDATE lock while:
1. Querying all existing numbers
2. Building a set in Python
3. Iterating to find gaps

With 10,000 samples, this could hold the lock for seconds.

**Impact:** High concurrency → lock contention → slow performance.

**Fix:** Use SQL to find gaps directly, or use a different strategy.

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **No Database Unique Constraints**
**Problem:** No unique constraint on `sample_code` or `unit_code` in database schema.

**Impact:** If all retry logic fails, duplicates can still be created.

**Fix:** Add unique constraints:
```sql
ALTER TABLE samples ADD CONSTRAINT unique_sample_code UNIQUE (sample_code);
ALTER TABLE units ADD CONSTRAINT unique_unit_code UNIQUE (unit_code);
```

### 6. **Reservation Lost on Server Restart**
**Location:** `counter_repository.py` line 10

**Problem:** `SAMPLE_RESERVATIONS` is in-memory, lost on restart.

**Impact:** Users with active reservations lose them, might get different numbers.

**Fix:** Use Redis or database table for reservations.

### 7. **No Validation on Sample/Unit Code Format**
**Problem:** No validation that sample_code matches `SMPYY-NUM` format.

**Impact:** Manual DB edits or bugs could create invalid codes.

**Fix:** Add validation in models or services.

### 8. **Year Boundary Issue at Dec 31/Jan 1**
**Problem:** If sample is created at 23:59:59 on Dec 31, year might be inconsistent.

**Impact:** Sample could have wrong year, wrong counter.

**Fix:** Use UTC time consistently, or pass year explicitly.

---

## 🟢 MEDIUM PRIORITY ISSUES

### 9. **Counter Not Updated After Sample Creation**
**Location:** `sample_service.py` lines 86-87

**Problem:** Counter is never updated after sample creation. Relies on `get_next_sample_number()` scanning DB.

**Impact:** Counter table doesn't reflect actual state. Only synced when `sync_sample_counter()` is called.

**Fix:** Consider updating counter after successful creation.

### 10. **No Logging for Counter Operations**
**Problem:** No logs when counters are incremented/decremented/synced.

**Impact:** Hard to debug issues in production.

**Fix:** Add logging at INFO level.

### 11. **No Monitoring/Metrics**
**Problem:** No metrics on counter operations, lock wait times, retry counts.

**Impact:** Can't detect performance issues proactively.

**Fix:** Add Prometheus metrics or similar.

### 12. **No Rollback on Partial Failure**
**Location:** `sample_service.py` lines 90-159

**Problem:** If sample creation succeeds but unit creation fails, sample is orphaned.

**Impact:** Gaps in sample numbers, wasted IDs.

**Fix:** Use proper transaction rollback.

---

## 🔵 LOW PRIORITY / NICE TO HAVE

### 13. **Integer Overflow Risk**
**Problem:** `current_value` could overflow if > 2^31 samples.

**Impact:** After 2 billion samples, counter breaks.

**Fix:** Use BIGINT, or add overflow check.

### 14. **No Batch Operations Support**
**Problem:** Can't create multiple samples efficiently.

**Impact:** Bulk imports are slow.

**Fix:** Add batch creation API.

### 15. **No Counter Reset Function**
**Problem:** Can't reset counters for testing or new year.

**Impact:** Manual DB edits needed.

**Fix:** Add admin function to reset counters.

---

## 🧪 TEST SCENARIOS TO VERIFY

### Concurrency Tests:
1. 10 users create samples simultaneously → no duplicates
2. User A reserves, User B creates → no conflict
3. User A creates, User B deletes highest → counter correct
4. User A deletes, User B creates → no gap issue

### Edge Cases:
1. Create first sample of year → counter = 1
2. Create sample with gaps → fills gap
3. Delete highest sample → counter decrements correctly
4. Delete middle sample → counter unchanged
5. Delete all samples → counter = 0
6. Create sample at year boundary → correct year

### Error Cases:
1. Database connection fails during creation → no orphaned data
2. Counter table missing → auto-created
3. Invalid sample_code in DB → handled gracefully
4. Concurrent delete of same sample → no double decrement

---

## 📊 SUMMARY

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 4 | Pattern bug, Decrement bug, Reservation race, Long lock |
| 🟡 High | 4 | No unique constraints, Lost reservations, No validation, Year boundary |
| 🟢 Medium | 4 | Counter not updated, No logging, No metrics, No rollback |
| 🔵 Low | 3 | Overflow, No batch, No reset |

**Total Issues Found: 15**

**Recommended Action:** Fix all 🔴 Critical issues before deploying to production.
