from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional, List
import re
import io
from datetime import datetime

from app.db.session import get_db
from app.models.user import User
from app.models.unit import Unit
from app.models.serology_data import SerologyData
from app.models.edit_history import EditHistory
from app.services.drive_service import DriveService
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/serology-coa", tags=["serology-coa"])

# Precompiled Regex patterns for extraction
MEAN_REGEX = re.compile(r"(?:MEAN\s*TITER|MEAN)\s*[:\-]?\s*([\d,\.]+)", re.IGNORECASE)
CV_REGEX = re.compile(r"(?:CV%|%CV|% CV|CV %)\s*[:\-]?\s*([\d,\.]+)", re.IGNORECASE)
MIN_REGEX = re.compile(r"\bMIN(?:IMUM)?\b\s*:?[\s]*(\d+(?:[.,]\d+)?)", re.IGNORECASE)
MAX_REGEX = re.compile(r"\bMAX(?:IMUM)?\b\s*:?[\s]*(\d+(?:[.,]\d+)?)", re.IGNORECASE)
MINMAX_REGEX = re.compile(r"MIN\-MAX\s*TITER\s*[:\-]?\s*(\d+)\s*-\s*(\d+)", re.IGNORECASE)

# Disease list for detection
DISEASES = [
    "FAV1", "MS", "MG", "MPV", "IBD", "IBV", "REO", "ILT", "ILT GB",
    "ILT GI", "AIV H9", "AIV H5", "ND LASOTA", "AEV", "ASTRO", "CASTV",
    "CAV", "AE", "LLAB", "FLUH5", "EDS", "NDV", "ND"
]


def detect_disease(text: str) -> Optional[str]:
    """Detect disease name from text."""
    up = text.upper()
    
    # Check for AIV H<number>
    m = re.search(r'\bAIV[\s\-_]*H\s*(\d+)', up)
    if m:
        return f"AIV H{m.group(1)}"
    
    # Check for ND LASOTA
    if re.search(r'\bND[\s\-_]*LASOTA\b', up):
        return "ND LASOTA"
    
    # Check other diseases
    for d in sorted(DISEASES, key=lambda x: -len(x)):
        tokens = d.upper().split()
        pattern = r'(?<!\w)' + r'[\s\-_]*'.join(map(re.escape, tokens)) + r'[A-Z0-9/_-]*'
        if re.search(pattern, up):
            return d
    
    return None


def extract_value(regex, text: str) -> Optional[str]:
    """Extract value using regex pattern."""
    match = regex.search(text)
    if not match:
        return None
    return match.group(1).strip() if match.group(1) else None


def extract_serology_data_from_pdf(pdf_content: bytes) -> List[dict]:
    """
    Extract serology test results from PDF using pdfplumber.
    Returns list of dicts with: disease, mean, cv, min, max
    """
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="pdfplumber library not installed. Please install it with: pip install pdfplumber"
        )
    
    results = []
    
    try:
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            print(f"[SEROLOGY COA] PDF has {len(pdf.pages)} pages")
            
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text() or ""
                print(f"[SEROLOGY COA] Page {page_num} text length: {len(text)} chars")
                print(f"[SEROLOGY COA] Page {page_num} text preview: {text[:500]}...")
                
                # Extract values
                mean = extract_value(MEAN_REGEX, text)
                print(f"[SEROLOGY COA] Raw mean extracted: {mean}")
                if mean:
                    mean = mean.replace(",", "").strip()
                
                cv = extract_value(CV_REGEX, text)
                print(f"[SEROLOGY COA] Raw cv extracted: {cv}")
                if cv:
                    cv = cv.replace(",", "").strip()
                
                minimum = extract_value(MIN_REGEX, text)
                maximum = extract_value(MAX_REGEX, text)
                print(f"[SEROLOGY COA] Raw min/max extracted: min={minimum}, max={maximum}")
                
                # Try MIN-MAX combined pattern if individual not found
                if not (minimum and maximum):
                    range_match = MINMAX_REGEX.search(text)
                    if range_match:
                        minimum, maximum = range_match.group(1), range_match.group(2)
                        print(f"[SEROLOGY COA] Used combined MIN-MAX pattern: min={minimum}, max={maximum}")
                
                disease = detect_disease(text)
                print(f"[SEROLOGY COA] Detected disease: {disease}")
                
                # Convert to numeric, handle potential errors
                try:
                    mean_val = float(mean) if mean else None
                except (ValueError, TypeError):
                    mean_val = None
                    print(f"[SEROLOGY COA] Failed to convert mean: {mean}")
                
                try:
                    cv_val = float(cv) if cv else None
                except (ValueError, TypeError):
                    cv_val = None
                    print(f"[SEROLOGY COA] Failed to convert cv: {cv}")
                
                try:
                    min_val = float(minimum.replace(",", "")) if minimum else None
                except (ValueError, TypeError, AttributeError):
                    min_val = None
                    print(f"[SEROLOGY COA] Failed to convert min: {minimum}")
                
                try:
                    max_val = float(maximum.replace(",", "")) if maximum else None
                except (ValueError, TypeError, AttributeError):
                    max_val = None
                    print(f"[SEROLOGY COA] Failed to convert max: {maximum}")
                
                data = {
                    "disease": disease or "Unknown",
                    "mean": mean_val,
                    "cv": cv_val,
                    "min": min_val,
                    "max": max_val,
                }
                
                print(f"[SEROLOGY COA] Page {page_num} extracted data: {data}")
                
                # Only add if we have some data
                if any([data["mean"], data["cv"], data["min"], data["max"]]):
                    results.append(data)
        
        # Remove duplicates based on disease name, keeping the one with most data
        seen = {}
        for r in results:
            disease = r["disease"]
            if disease not in seen:
                seen[disease] = r
            else:
                # Keep the one with more data
                existing_count = sum(1 for v in seen[disease].values() if v is not None)
                new_count = sum(1 for v in r.values() if v is not None)
                if new_count > existing_count:
                    seen[disease] = r
        
        final_results = list(seen.values())
        print(f"[SEROLOGY COA] Final extraction results: {final_results}")
        return final_results
        
    except Exception as e:
        print(f"[SEROLOGY COA] PDF extraction error: {e}")
        import traceback
        traceback.print_exc()
        return []


@router.post("/upload/{unit_id}")
async def upload_serology_coa(
    unit_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a serology COA PDF, extract data, save to Drive, and link with sample.
    """
    # Verify unit exists and has serology data
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    if not unit.serology_data:
        raise HTTPException(status_code=400, detail="Unit does not have serology data")
    
    # Check file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Read file content
    content = await file.read()
    
    # Extract data from PDF
    extracted_data = extract_serology_data_from_pdf(content)
    
    # Get or create the Serology Results folder structure in Drive
    drive_service = DriveService(db)
    current_year = datetime.now().year
    
    # Find or create "Serology Results" folder
    serology_folder = drive_service.find_or_create_folder("Serology Results", None, current_user.full_name)
    
    # Find or create year subfolder
    year_folder = drive_service.find_or_create_folder(str(current_year), serology_folder.id, current_user.full_name)
    
    # Generate filename with sample code and unit code
    sample_code = unit.sample.sample_code if unit.sample else "Unknown"
    filename = f"{sample_code}_{unit.unit_code}_Serology_COA.pdf"
    
    # Upload file to Drive
    upload_result = drive_service.upload_file(
        file_name=filename,
        file_content=content,
        mime_type="application/pdf",
        parent_id=year_folder.id,
        created_by=current_user.full_name
    )
    
    # Update serology data with extracted values and file link
    serology_data = unit.serology_data
    
    # Log extracted data for debugging
    print(f"[SEROLOGY COA] Extracted data from PDF: {extracted_data}")
    print(f"[SEROLOGY COA] Existing diseases_list: {serology_data.diseases_list}")
    
    # Update diseases_list with extracted mean, cv, min, max values
    if serology_data.diseases_list:
        updated_diseases = []
        
        for disease in serology_data.diseases_list:
            disease_name = disease.get('disease', '')
            
            # Try to find matching extracted data by disease name
            matched = None
            if extracted_data:
                for ext in extracted_data:
                    ext_disease = ext.get('disease', '').upper()
                    db_disease = disease_name.upper()
                    # Match if either contains the other, or if they share common keywords
                    if (ext_disease in db_disease or db_disease in ext_disease or 
                        ext_disease == db_disease or
                        any(word in db_disease for word in ext_disease.split() if len(word) > 2)):
                        matched = ext
                        print(f"[SEROLOGY COA] Matched disease: {disease_name} -> {ext_disease}")
                        break
            
            # If no match found but we have extracted data, use the first result
            # (assuming one PDF = one disease result for this unit)
            if not matched and extracted_data and len(extracted_data) > 0:
                matched = extracted_data[0]
                print(f"[SEROLOGY COA] No exact match for {disease_name}, using first extracted: {matched}")
            
            if matched:
                updated_diseases.append({
                    **disease,
                    'mean': matched.get('mean'),
                    'cv': matched.get('cv'),
                    'min': matched.get('min'),
                    'max': matched.get('max'),
                    'coa_file_id': upload_result.id
                })
            else:
                updated_diseases.append({
                    **disease,
                    'coa_file_id': upload_result.id
                })
        
        # Track edit history for serology COA upload
        old_diseases_str = str(serology_data.diseases_list)
        new_diseases_str = str(updated_diseases)
        if old_diseases_str != new_diseases_str:
            sample_code = unit.sample.sample_code if unit.sample else None
            edit_history = EditHistory(
                entity_type='unit',
                entity_id=unit_id,
                field_name='serology_coa_upload',
                old_value=old_diseases_str,
                new_value=new_diseases_str,
                edited_by=current_user.full_name,
                sample_code=sample_code,
                unit_code=unit.unit_code
            )
            db.add(edit_history)
        
        serology_data.diseases_list = updated_diseases
        # Flag the JSON field as modified so SQLAlchemy detects the change
        flag_modified(serology_data, 'diseases_list')
        print(f"[SEROLOGY COA] Updated diseases_list: {updated_diseases}")
    
    db.commit()
    
    return {
        "success": True,
        "file_id": upload_result.id,
        "file_name": filename,
        "extracted_data": extracted_data,
        "message": f"PDF uploaded successfully. Extracted {len(extracted_data)} disease results."
    }


@router.get("/file/{unit_id}")
def get_serology_coa_file(
    unit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the COA file info for a serology unit."""
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    if not unit.serology_data or not unit.serology_data.diseases_list:
        return {"file_id": None, "has_coa": False}
    
    # Check if any disease has a COA file linked
    for disease in unit.serology_data.diseases_list:
        if disease.get('coa_file_id'):
            return {
                "file_id": disease.get('coa_file_id'),
                "has_coa": True
            }
    
    return {"file_id": None, "has_coa": False}


@router.put("/update-results/{unit_id}")
async def update_serology_results(
    unit_id: int,
    results: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually update serology results (mean, cv, min, max) for diseases.
    Used when PDF extraction doesn't capture all data.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    if not unit.serology_data:
        raise HTTPException(status_code=400, detail="Unit does not have serology data")
    
    serology_data = unit.serology_data
    
    if serology_data.diseases_list:
        updated_diseases = []
        for disease in serology_data.diseases_list:
            disease_name = disease.get('disease', '')
            # Find matching result from input
            matched = None
            for res in results:
                if res.get('disease', '').upper() == disease_name.upper():
                    matched = res
                    break
            
            if matched:
                updated_diseases.append({
                    **disease,
                    'mean': matched.get('mean', disease.get('mean')),
                    'cv': matched.get('cv', disease.get('cv')),
                    'min': matched.get('min', disease.get('min')),
                    'max': matched.get('max', disease.get('max'))
                })
            else:
                updated_diseases.append(disease)
        
        # Track edit history for serology results update
        old_diseases_str = str(serology_data.diseases_list)
        new_diseases_str = str(updated_diseases)
        if old_diseases_str != new_diseases_str:
            # Get sample code and unit code for edit history
            sample_code = unit.sample.sample_code if unit.sample else None
            unit_code = unit.unit_code
            
            edit_history = EditHistory(
                entity_type='unit',
                entity_id=unit_id,
                field_name='serology_results',
                old_value=old_diseases_str,
                new_value=new_diseases_str,
                edited_by=current_user.full_name,
                sample_code=sample_code,
                unit_code=unit_code
            )
            db.add(edit_history)
        
        serology_data.diseases_list = updated_diseases
        flag_modified(serology_data, 'diseases_list')
        db.commit()
    
    return {"success": True, "message": "Results updated successfully"}
