# PCR Registration Form - Critical Issues Review

## Overview

Review of PCR registration form validation, data flow, and potential errors.

---

## 🔴 CRITICAL ISSUES (Must Fix)

### 1. **Backend Schema Allows Empty Kit Type**

**Location:** `backend/app/schemas/sample.py` line 17

**Issue:**
```python
class PCRDataCreate(BaseModel):
    diseases_list: Optional[List[DiseaseKitItem]] = []
    kit_type: Optional[str] = None  # ⚠️ Should be required!
```

**Problem:** Backend schema allows `kit_type` to be `None`, but frontend requires it. This creates a mismatch where:
- Frontend validation: Kit type is required ✓
- Backend schema: Kit type is optional ✗
- API calls can bypass frontend validation ✗

**Impact:** Users can submit PCR samples without kit types via direct API calls, causing:
- "Unknown" kit type in reports
- Invalid data in database
- Business logic violations

**Fix:**
```python
class PCRDataCreate(BaseModel):
    diseases_list: Optional[List[DiseaseKitItem]] = []
    kit_type: str  # Remove Optional, make required
    technician_name: str  # Also should be required
    extraction_method: str  # Also should be required
    extraction: int  # Also should be required
    detection: Optional[int] = None
```

---

### 2. **No Backend Validation for Kit Type**

**Location:** `backend/app/services/sample_service.py` lines 139-145

**Issue:**
```python
pcr_data = PCRData(
    unit_id=unit.id,
    diseases_list=diseases_list_json,
    kit_type=unit_data.pcr_data.kit_type,  # ⚠️ No validation!
    technician_name=unit_data.pcr_data.technician_name,
    extraction_method=unit_data.pcr_data.extraction_method,
    extraction=unit_data.pcr_data.extraction,
    detection=unit_data.pcr_data.detection
)
```

**Problem:** Backend doesn't validate that:
- Kit type is provided
- Kit type is not empty
- Kit type exists in the database

**Impact:** Invalid data can be saved to database.

**Fix:**
```python
# Validate PCR data before saving
if unit_data.pcr_data:
    # Validate kit type
    if not unit_data.pcr_data.kit_type or unit_data.pcr_data.kit_type.strip() == '':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kit type is required for PCR"
        )
    
    # Validate technician
    if not unit_data.pcr_data.technician_name or unit_data.pcr_data.technician_name.strip() == '':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Technician name is required for PCR"
        )
    
    # Validate extraction method
    if not unit_data.pcr_data.extraction_method or unit_data.pcr_data.extraction_method.strip() == '':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extraction method is required for PCR"
        )
    
    # Validate extraction
    if not unit_data.pcr_data.extraction or unit_data.pcr_data.extraction <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extraction value is required and must be greater than 0 for PCR"
        )
```

---

### 3. **DiseaseKitItem Allows Empty Kit Type**

**Location:** `backend/app/schemas/sample.py` lines 7-11

**Issue:**
```python
class DiseaseKitItem(BaseModel):
    disease: str
    kit_type: str  # ⚠️ Required in schema, but frontend allows empty string
    test_count: Optional[int] = 1
    wells_count: Optional[int] = None
```

**Problem:** Schema requires `kit_type` as `str`, but:
- Frontend initializes with empty string (line 78 of DiseaseKitSelector.tsx)
- Empty string is valid `str` type
- Backend doesn't check if kit_type is empty

**Impact:** Diseases can be saved with empty kit types.

**Fix:**
```python
class DiseaseKitItem(BaseModel):
    disease: str
    kit_type: str  # Keep as str, but add validator
    test_count: Optional[int] = 1
    wells_count: Optional[int] = None
    
    @field_validator('kit_type')
    @classmethod
    def validate_kit_type(cls, v: str) -> str:
        if not v or v.strip() == '':
            raise ValueError('Kit type cannot be empty')
        return v.strip()
```

---

### 4. **No Validation That Kit Type Exists**

**Location:** Backend - No validation exists

**Problem:** Backend doesn't verify that the kit type actually exists in the database.

**Impact:** Users can submit invalid kit types that don't exist in the system.

**Fix:**
```python
# In sample_service.py, before creating PCR data
if unit_data.pcr_data and unit_data.pcr_data.diseases_list:
    # Get valid kit types for PCR department
    from app.models.kit_type import KitType
    from app.models.department import Department
    
    pcr_dept = self.db.query(Department).filter(Department.code == "PCR").first()
    if not pcr_dept:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PCR department not found"
        )
    
    valid_kit_types = self.db.query(KitType).filter(
        KitType.department_id == pcr_dept.id
    ).all()
    valid_kit_names = {kt.name for kt in valid_kit_types}
    
    # Validate each disease's kit type
    for disease_item in unit_data.pcr_data.diseases_list:
        if disease_item.kit_type not in valid_kit_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid kit type '{disease_item.kit_type}' for disease '{disease_item.disease}'. Valid options: {', '.join(sorted(valid_kit_names))}"
            )
```

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **Serology Also Has Same Issues**

**Location:** `backend/app/schemas/sample.py` lines 38-43

**Issue:** Serology has the same problems as PCR:
```python
class SerologyDataCreate(BaseModel):
    diseases_list: Optional[List[DiseaseKitItem]] = []
    kit_type: Optional[str] = None  # ⚠️ Should be required
    number_of_wells: Optional[int] = None
    tests_count: Optional[int] = None
    technician_name: Optional[str] = None
```

**Impact:** Same as PCR - invalid data can be submitted.

**Fix:** Apply same fixes as PCR.

---

### 6. **Frontend Warning Doesn't Prevent Submission**

**Location:** `DiseaseKitSelector.tsx` lines 316-325

**Issue:**
```tsx
{selectedDiseases.some(d => !d.kit_type) && (
  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
    <p className="text-xs text-orange-700 font-medium">
      Please select kit type for all diseases
    </p>
  </div>
)}
```

**Problem:** Warning is shown, but form can still be submitted if user ignores it.

**Impact:** Users might submit incomplete forms.

**Fix:** The warning is already handled by `handleSubmit` validation (line 2280-2281), so this is just a visual aid. This is actually OK.

---

### 7. **No Validation on Test Count Range**

**Location:** `DiseaseKitSelector.tsx` line 90

**Issue:**
```tsx
const newCount = Math.max(1, currentCount + delta);
```

**Problem:** Test count can be arbitrarily high. No maximum limit.

**Impact:** Users could set test count to 999999, which might cause issues.

**Fix:**
```tsx
const newCount = Math.max(1, Math.min(100, currentCount + delta));
```

---

## 🟢 MEDIUM PRIORITY ISSUES

### 8. **No Validation on Wells Count Range**

**Location:** `DiseaseKitSelector.tsx` line 109

**Issue:**
```tsx
wells_count: Math.max(0, wellsCount)
```

**Problem:** Wells count can be arbitrarily high. No maximum limit.

**Impact:** Users could set wells count to unrealistic values.

**Fix:**
```tsx
wells_count: Math.max(0, Math.min(384, wellsCount))  // Max 384 wells (standard plate)
```

---

### 9. **No Duplicate Disease Prevention**

**Location:** Frontend - No validation exists

**Problem:** User can select the same disease multiple times (though UI doesn't show duplicates).

**Impact:** Could cause duplicate entries in database.

**Fix:**
```tsx
const handleDiseaseToggle = (diseaseName: string) => {
  if (isDiseaseSelected(diseaseName)) {
    onChange(selectedDiseases.filter(d => d.disease !== diseaseName));
  } else {
    // Check if already exists (defensive)
    if (selectedDiseases.some(d => d.disease === diseaseName)) {
      return; // Already exists, don't add
    }
    // ... rest of code
  }
};
```

---

### 10. **No Validation on Technician Name Format**

**Location:** Backend - No validation exists

**Problem:** Technician name can be any string, including special characters, emojis, etc.

**Impact:** Could cause display issues or data quality problems.

**Fix:**
```python
@field_validator('technician_name')
@classmethod
def validate_technician_name(cls, v: str) -> str:
    if not v or v.strip() == '':
        raise ValueError('Technician name cannot be empty')
    if len(v.strip()) > 100:
        raise ValueError('Technician name must be less than 100 characters')
    # Allow letters, spaces, hyphens, apostrophes
    if not re.match(r'^[a-zA-Z\s\-\'\.]+$', v.strip()):
        raise ValueError('Technician name contains invalid characters')
    return v.strip()
```

---

## 🔵 LOW PRIORITY ISSUES

### 11. **No Auto-Save of Draft**

**Location:** Frontend - No feature exists

**Problem:** If user refreshes page, all form data is lost.

**Impact:** Poor user experience.

**Fix:** Implement localStorage auto-save.

---

### 12. **No Confirmation Before Submission**

**Location:** `UnifiedSampleRegistration.tsx` line 2257

**Problem:** Form submits immediately without confirmation.

**Impact:** Users might submit accidentally.

**Fix:** Add confirmation modal.

---

## Summary of Critical Fixes Needed

### Backend (sample.py):
```python
# Change from Optional to required
class PCRDataCreate(BaseModel):
    kit_type: str  # Was: Optional[str] = None
    technician_name: str  # Was: Optional[str] = None
    extraction_method: str  # Was: Optional[str] = None
    extraction: int  # Was: Optional[int] = None

# Add validator to DiseaseKitItem
class DiseaseKitItem(BaseModel):
    @field_validator('kit_type')
    @classmethod
    def validate_kit_type(cls, v: str) -> str:
        if not v or v.strip() == '':
            raise ValueError('Kit type cannot be empty')
        return v.strip()
```

### Backend (sample_service.py):
```python
# Add validation before creating PCR data
# 1. Check kit_type is not empty
# 2. Check kit_type exists in database
# 3. Check other required fields
```

---

## Testing Checklist

After fixes, verify:

- [ ] Cannot submit PCR without kit type (frontend)
- [ ] Cannot submit PCR without kit type (backend API)
- [ ] Cannot submit PCR with invalid kit type
- [ ] Cannot submit PCR without technician name
- [ ] Cannot submit PCR without extraction method
- [ ] Cannot submit PCR without extraction value
- [ ] Test count has reasonable limits (1-100)
- [ ] Wells count has reasonable limits (0-384)
- [ ] Cannot select duplicate diseases
- [ ] Technician name format is validated

---

## Files to Modify

1. `backend/app/schemas/sample.py`
   - Make PCR fields required
   - Add validators to DiseaseKitItem

2. `backend/app/services/sample_service.py`
   - Add validation before creating PCR data
   - Validate kit types exist in database

3. `frontend/src/features/samples/components/DiseaseKitSelector.tsx`
   - Add max limits to test count and wells count

4. `frontend/src/features/samples/components/UnifiedSampleRegistration.tsx`
   - Already has good validation, just review
