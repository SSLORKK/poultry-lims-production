from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import get_db
from app.models.user import User
from app.services.drive_service import DriveService
from app.schemas.drive import (
    DriveItemCreate, DriveItemUpdate, DriveItemResponse, 
    DriveContentsResponse, DriveUploadResponse
)
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/drive", tags=["drive"])


@router.get("/contents", response_model=DriveContentsResponse)
def get_folder_contents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get contents of a folder (or root if folder_id is None)"""
    service = DriveService(db)
    return service.get_folder_contents(folder_id)


@router.get("/search", response_model=List[DriveItemResponse])
def search_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search for files and folders by name"""
    service = DriveService(db)
    return service.search(q)


@router.get("/{item_id}", response_model=DriveItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific drive item"""
    service = DriveService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/{item_id}/download")
def download_file(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a file or view PDF inline in browser"""
    service = DriveService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.type != "file":
        raise HTTPException(status_code=400, detail="Item is not a file")
    
    file_path = service.get_file_path(item_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # For PDF files, serve inline so they open in browser
    is_pdf = item.name.lower().endswith('.pdf') or item.mime_type == 'application/pdf'
    
    if is_pdf:
        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=\"{item.name}\""}
        )
    
    return FileResponse(
        path=file_path,
        filename=item.name,
        media_type=item.mime_type or "application/octet-stream"
    )


@router.post("/folder", response_model=DriveItemResponse)
def create_folder(
    data: DriveItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new folder"""
    service = DriveService(db)
    return service.create_folder(data, current_user.full_name)


@router.post("/upload", response_model=DriveUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    parent_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a file"""
    service = DriveService(db)
    
    # Read file content
    content = await file.read()
    
    # Get mime type
    mime_type = file.content_type or "application/octet-stream"
    
    return service.upload_file(
        file_name=file.filename,
        file_content=content,
        mime_type=mime_type,
        parent_id=parent_id,
        created_by=current_user.full_name
    )


@router.put("/{item_id}", response_model=DriveItemResponse)
def update_item(
    item_id: int,
    data: DriveItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a drive item (rename, move, update description)"""
    service = DriveService(db)
    item = service.update_item(item_id, data, current_user.full_name)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}/move", response_model=DriveItemResponse)
def move_item(
    item_id: int,
    new_parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move an item to a different folder"""
    service = DriveService(db)
    item = service.move_item(item_id, new_parent_id, current_user.full_name)
    if not item:
        raise HTTPException(status_code=400, detail="Cannot move item")
    return item


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a drive item (soft delete)"""
    service = DriveService(db)
    success = service.delete_item(item_id, current_user.full_name)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}
