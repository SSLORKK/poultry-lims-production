# Performance Optimization Guide

## Quick Start: Run These Commands

### 1. Add Database Indexes (CRITICAL - Run This First!)
```bash
# Inside Docker container
docker-compose exec backend python add_indexes.py

# Or locally
cd backend
python add_indexes.py
```
**Expected improvement: 10-100x faster queries**

---

## Performance Optimizations Implemented

### ✅ 1. Database Indexing (DONE)
- **Impact**: 🔥🔥🔥 HIGHEST (10-100x faster)
- **What**: Added indexes on frequently queried columns
- **Indexes Added**:
  - `idx_samples_year` - Year filtering
  - `idx_samples_year_company` - Composite index (year + company)
  - `idx_samples_year_farm` - Composite index (year + farm)
  - `idx_units_department_id` - Department filtering
  - `idx_units_age` - Age filtering
  - GIN indexes on JSON fields (house, sample_type, diseases)

### ✅ 2. Backend Filtering (DONE)
- **Impact**: 🔥🔥🔥 HIGHEST (10-50x faster)
- **What**: Filter at database level instead of frontend
- **Filters**: Company, Farm, Flock, Age, Sample Type
- **Result**: Only matching data transferred over network

### ✅ 3. Query Optimization (DONE)
- **Impact**: 🔥🔥 HIGH (3-10x faster)
- **What**: Changed from `joinedload` to `selectinload`
- **Why**: Prevents N+1 query problem
- **Result**: Fewer database queries, faster loading

### ✅ 4. Pagination (DONE)
- **Impact**: 🔥🔥 HIGH (memory & speed)
- **What**: Load data in pages (25/50/100 records)
- **Result**: Less memory, faster initial load

---

## Additional Optimizations You Can Do

### 5. Database Connection Pooling
**Impact**: 🔥 MEDIUM (2-5x faster)

Add to `backend/app/db/session.py`:
```python
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,          # Increase pool size
    max_overflow=40,       # Allow more connections
    pool_pre_ping=True,    # Check connection health
    pool_recycle=3600      # Recycle connections every hour
)
```

### 6. Response Compression (Gzip)
**Impact**: 🔥 MEDIUM (50-90% smaller responses)

Add to `backend/app/main.py`:
```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### 7. Redis Caching (Advanced)
**Impact**: 🔥🔥 HIGH for repeated queries

Install:
```bash
pip install redis fastapi-cache2
```

Cache dropdown data and statistics:
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@cache(expire=3600)  # Cache for 1 hour
async def get_dropdown_data():
    # Your code here
```

### 8. Database Query Optimization
**Impact**: 🔥 MEDIUM

Check slow queries:
```sql
-- Enable slow query logging in PostgreSQL
ALTER DATABASE your_db SET log_min_duration_statement = 1000;

-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 20;
```

### 9. Frontend Optimizations

#### a. React Query Caching (Already implemented ✅)
- Caches API responses
- Reduces duplicate requests

#### b. Debouncing (Already implemented ✅)
- 300ms for search
- 500ms for filters

#### c. Virtual Scrolling (Optional)
For very large datasets:
```bash
npm install react-virtual
```

---

## Performance Monitoring

### Check Current Performance

1. **Network Tab** (Chrome DevTools):
   - Check response sizes
   - Check response times

2. **Database Query Time**:
```python
# Add logging in backend
import time
start = time.time()
samples = query.all()
print(f"Query took: {time.time() - start:.2f}s")
```

3. **PostgreSQL Stats**:
```sql
-- Table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables 
WHERE schemaname = 'public';

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes;
```

---

## Expected Performance Results

### Before Optimization:
- 20K records: 5-10 seconds load time
- Large queries: 2-5 seconds
- Memory usage: High (all data in frontend)

### After Optimization:
- 20K records: 0.5-1 seconds load time ✅
- Large queries: 0.1-0.5 seconds ✅
- Memory usage: Low (only visible data) ✅

**Total improvement: 10-20x faster!** 🚀

---

## Checklist

- [x] Database indexes added
- [x] Backend filtering implemented
- [x] Query optimization (selectinload)
- [x] Pagination implemented
- [ ] Connection pooling increased
- [ ] Gzip compression enabled
- [ ] Redis caching (optional)
- [ ] Monitoring enabled

---

## Troubleshooting

### Indexes not improving performance?
```sql
-- Analyze tables to update statistics
ANALYZE samples;
ANALYZE units;
ANALYZE pcr_data;
ANALYZE serology_data;
ANALYZE microbiology_data;

-- Rebuild indexes
REINDEX TABLE samples;
REINDEX TABLE units;
```

### Still slow after all optimizations?
1. Check PostgreSQL configuration (`max_connections`, `shared_buffers`)
2. Monitor disk I/O (SSD vs HDD makes huge difference)
3. Check network latency
4. Consider database partitioning for very large datasets (>1M records)

---

## Need More Speed?

For extreme performance (>100K records):
1. **Materialized Views** - Pre-computed aggregations
2. **Read Replicas** - Separate read/write databases
3. **Elasticsearch** - Full-text search engine
4. **TimescaleDB** - Time-series optimizations
5. **GraphQL + DataLoader** - Batch queries

Contact your DBA or backend developer for advanced optimizations.
