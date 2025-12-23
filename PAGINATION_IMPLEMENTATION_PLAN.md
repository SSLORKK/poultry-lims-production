# Pagination and Search Implementation Plan

## Files That Need Updates

### 1. PCRSamples.tsx
- **Location**: `frontend/src/features/samples/components/PCRSamples.tsx`
- **Current State**: Has frontend pagination only (lines 406-411), frontend search only (lines 343-351)
- **Changes Needed**:
  - Add `skip` and `limit` parameters to API call (lines 85-125)
  - Add `search` parameter to API call
  - Remove frontend search logic (lines 343-351)
  - Remove `pageSize` state (line 51)
  - Remove `paginatedRows` calculation (lines 406-409)
  - Remove `totalPages` calculation (line 411)
  - Update pagination UI to match AllSamples.tsx pattern
  - Add `page` and `debouncedSearch` to useEffect dependencies

### 2. SerologySamples.tsx
- **Location**: `frontend/src/features/samples/components/SerologySamples.tsx`
- **Changes Needed**: Same as PCRSamples.tsx

### 3. MicrobiologySamples.tsx  
- **Location**: `frontend/src/features/samples/components/MicrobiologySamples.tsx`
- **Changes Needed**: Same as PCRSamples.tsx

### 4. Database.tsx
- **Location**: `frontend/src/features/database/components/Database.tsx`
- **Changes Needed**: Same modifications if it has a similar structure

## Implementation Details

### Backend API Changes (Already Done)
✅ Added `search` parameter to `/samples/` endpoint
✅ Added search logic in `SampleRepository.get_all()`
✅ Backend supports `skip` and `limit` for pagination

### Frontend Changes Template

For each file, we need to:

1. **Add pagination params to fetchSamples:**
```typescript
const fetchSamples = async () => {
  const params: any = { 
    year: selectedYear, 
    department_id: X,  // 1=PCR, 2=Serology, 3=Microbiology
    skip: (page - 1) * 100,
    limit: 100
  };
  
  // Add global search
  if (debouncedSearch) {
    params.search = debouncedSearch;
  }
  
  // ... rest of filters
};
```

2. **Remove pageSize state:**
```typescript
// REMOVE THIS LINE:
const [pageSize, setPageSize] = useState(25);
```

3. **Update useEffect dependencies:**
```typescript
useEffect(() => {
  fetchSamples();
}, [selectedYear, selectedCompanies, ..., page, debouncedSearch]);
```

4. **Remove frontend search from filteredRows:**
```typescript
const filteredRows = useMemo(() => {
  let filtered = unitRows;
  
  // REMOVE global search - now handled by backend
  // if (debouncedSearch) { ... }
  
  // Keep other frontend filters...
}, [unitRows, selectedSources, ...]);  // Remove debouncedSearch from deps
```

5. **Remove paginatedRows and totalPages:**
```typescript
// REMOVE THESE:
const paginatedRows = useMemo(() => {
  const start = (page - 1) * pageSize;
  return filteredRows.slice(start, start + pageSize);
}, [filteredRows, page, pageSize]);

const totalPages = Math.ceil(filteredRows.length / pageSize);
```

6. **Update table to use filteredRows:**
```typescript
// Change from:
{paginatedRows.map((row) => ...)}

// To:
{filteredRows.map((row: UnitRow) => ...)}
```

7. **Update pagination UI:**
```typescript
{filteredRows.length > 0 && (
  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
    <div className="text-sm text-gray-600">
      Showing <span className="font-semibold text-gray-800">{filteredRows.length}</span> records
      {filteredRows.length === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
    </div>
    
    <div className="flex items-center gap-4">
      <div className="flex gap-2">
        <button onClick={() => setPage(1)} disabled={page === 1}>
          &laquo;
        </button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          &lsaquo;
        </button>
        
        {/* Numbered page buttons */}
        {Array.from({ length: 5 }, (_, i) => {
          const pageNum = Math.max(1, page - 2) + i;
          return (
            <button 
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}
            >
              {pageNum}
            </button>
          );
        })}
        
        <button onClick={() => setPage((p) => p + 1)} disabled={filteredRows.length < 100}>
          &rsaquo;
        </button>
        <button onClick={() => setPage((p) => p + 10)} disabled={filteredRows.length < 100}>
          &raquo;
        </button>
      </div>
    </div>
  </div>
)}
```

## Testing Checklist

After applying changes to each screen:

- [ ] PCRSamples: Search works across all pages
- [ ] PCRSamples: Pagination loads 100 records at a time
- [ ] PCRSamples: Page buttons work correctly
- [ ] SerologySamples: Same as above
- [ ] MicrobiologySamples: Same as above
- [ ] Database: Same as above
- [ ] All screens: Filters work with pagination
- [ ] All screens: Export functions work with filtered data

## Order of Implementation

1. PCRSamples.tsx (department_id = 1)
2. SerologySamples.tsx (department_id = 2)
3. MicrobiologySamples.tsx (department_id = 3)
4. Database.tsx (if applicable)
