from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import logging
import os
import shutil
from pathlib import Path

from app.db.session import get_db
from app.models.user import User
from app.services.drive_service import DriveService
from app.schemas.drive import (
    DriveItemCreate, DriveItemUpdate, DriveItemResponse, 
    DriveContentsResponse, DriveUploadResponse
)
from app.api.v1.deps import (
    get_current_user, 
    check_drive_permission,
    check_drive_folder_access
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive", tags=["drive"])


@router.get("/contents", response_model=DriveContentsResponse)
async def get_folder_contents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_folder_access('read'))
):
    """Get contents of a folder (or root if folder_id is None)"""
    logger.info(f"User '{current_user.username}' accessing Drive folder: {folder_id or 'root'}")
    service = DriveService(db)
    return service.get_folder_contents(folder_id)


@router.get("/search", response_model=List[DriveItemResponse])
async def search_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read'))
):
    """Search for files and folders by name"""
    logger.info(f"User '{current_user.username}' searching Drive: '{q}'")
    service = DriveService(db)
    return service.search(q)


@router.get("/{item_id}", response_model=DriveItemResponse)
async def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read'))
):
    """Get a specific drive item"""
    service = DriveService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/{item_id}/download")
async def download_file(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read'))
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
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    logger.info(f"User '{current_user.username}' downloading file: {item.name} (ID: {item_id}, Size: {item.size} bytes)")
    
    # For large files (>100MB), use streaming response for better performance
    file_size = os.path.getsize(file_path)
    use_streaming = file_size > 100 * 1024 * 1024  # 100MB threshold
    
    # For PDF files, serve inline so they open in browser
    is_pdf = item.name.lower().endswith('.pdf') or item.mime_type == 'application/pdf'
    
    if use_streaming:
        def iterfile():
            """Generator that yields chunks of the file"""
            with open(file_path, 'rb') as f:
                while chunk := f.read(1024 * 1024):  # 1MB chunks
                    yield chunk
        
        return StreamingResponse(
            iterfile(),
            media_type=item.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"{'inline' if is_pdf else 'attachment'}; filename=\"{item.name}\"",
                "Content-Length": str(file_size)
            }
        )
    
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
async def create_folder(
    data: DriveItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
):
    """Create a new folder (requires 'write' permission)"""
    logger.info(f"User '{current_user.username}' creating folder: {data.name}")
    service = DriveService(db)
    return service.create_folder(data, current_user.full_name)


@router.post("/upload", response_model=DriveUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    parent_id: Optional[int] = Form(None),
    duplicate_handling: Optional[str] = Form(None),  # 'keep_both', 'replace', or None
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
):
    """Upload a file (requires 'write' permission)"""
    service = DriveService(db)
    
    # Read file content
    content = await file.read()
    
    # Check for duplicate file
    original_name = file.filename
    existing_file = service.repository.get_by_name(original_name, parent_id)
    
    # Handle duplicate based on strategy
    if existing_file and duplicate_handling == 'replace':
        # Delete existing file (move to recycle bin)
        logger.info(f"Replacing existing file: {original_name}")
        service.delete_item(existing_file.id, current_user.full_name)
        was_renamed = False
        replaced_existing = True
    elif existing_file and not duplicate_handling:
        # No strategy specified, auto-rename (default behavior)
        was_renamed = True
        replaced_existing = False
    else:
        was_renamed = False
        replaced_existing = False
    
    logger.info(f"User '{current_user.username}' uploading file: {original_name} ({len(content)} bytes) - Strategy: {duplicate_handling or 'auto-rename'}")
    
    # Get mime type
    mime_type = file.content_type or "application/octet-stream"
    
    result = service.upload_file(
        file_name=original_name,
        file_content=content,
        mime_type=mime_type,
        parent_id=parent_id,
        created_by=current_user.full_name
    )
    
    # Add metadata about rename/replace
    result.was_renamed = was_renamed
    result.replaced_existing = replaced_existing
    
    return result


@router.put("/{item_id}", response_model=DriveItemResponse)
async def update_item(
    item_id: int,
    data: DriveItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
):
    """Update a drive item (rename, move, update description) - requires 'write' permission"""
    logger.info(f"User '{current_user.username}' updating item ID: {item_id}")
    service = DriveService(db)
    item = service.update_item(item_id, data, current_user.full_name)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}/move", response_model=DriveItemResponse)
async def move_item(
    item_id: int,
    new_parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
):
    """Move an item to a different folder (requires 'write' permission)"""
    logger.info(f"User '{current_user.username}' moving item ID: {item_id} to folder: {new_parent_id or 'root'}")
    service = DriveService(db)
    item = service.move_item(item_id, new_parent_id, current_user.full_name)
    if not item:
        raise HTTPException(status_code=400, detail="Cannot move item")
    return item


@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
):
    """Delete a drive item (soft delete) - requires 'write' permission"""
    logger.info(f"User '{current_user.username}' deleting item ID: {item_id}")
    service = DriveService(db)
    success = service.delete_item(item_id, current_user.full_name)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item moved to Recycle Bin"}


# ============= RECYCLE BIN ENDPOINTS (Admin Only) =============

@router.get("/recycle-bin/contents", response_model=List[DriveItemResponse])
async def get_recycle_bin_contents(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Get all items in recycle bin - requires 'admin' permission"""
    logger.info(f"Admin '{current_user.username}' accessing Recycle Bin")
    service = DriveService(db)
    return service.get_recycle_bin_contents()


@router.get("/recycle-bin/search", response_model=List[DriveItemResponse])
async def search_recycle_bin(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Search items in recycle bin - requires 'admin' permission"""
    logger.info(f"Admin '{current_user.username}' searching Recycle Bin: '{q}'")
    service = DriveService(db)
    return service.search_recycle_bin(q)


@router.post("/recycle-bin/{item_id}/restore", response_model=DriveItemResponse)
async def restore_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Restore an item from recycle bin - requires 'admin' permission"""
    logger.info(f"Admin '{current_user.username}' restoring item ID: {item_id}")
    service = DriveService(db)
    item = service.restore_item(item_id, current_user.full_name)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in Recycle Bin")
    return item


@router.delete("/recycle-bin/{item_id}/permanent")
async def permanent_delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Permanently delete an item from recycle bin - requires 'admin' permission"""
    logger.info(f"Admin '{current_user.username}' permanently deleting item ID: {item_id}")
    service = DriveService(db)
    success = service.permanent_delete(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found in Recycle Bin")
    return {"message": "Item permanently deleted"}


@router.delete("/recycle-bin/empty")
async def empty_recycle_bin(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Empty entire recycle bin - requires 'admin' permission"""
    logger.info(f"Admin '{current_user.username}' emptying Recycle Bin")
    service = DriveService(db)
    count = service.empty_recycle_bin()
    return {"message": f"Recycle Bin emptied. {count} items permanently deleted."}
