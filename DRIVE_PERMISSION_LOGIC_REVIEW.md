# DRIVE PERMISSION LOGIC REVIEW
**Date:** January 2, 2026  
**Component:** Drive Permission Management System

---

## OVERVIEW

The Drive permission system is designed to allow admins to control which users can access the Drive and what level of access they have.

---

## CURRENT LOGIC ARCHITECTURE

### 1. Permission Model (`DrivePermission`)

**File:** `backend/app/models/drive.py:26-56`

```python
class DrivePermission(Base):
    __tablename__ = "drive_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Access control
    has_access = Column(Boolean, default=False, nullable=False)  # 🔑 Main access toggle
    permission_level = Column(String(20), default='read', nullable=False)  # 'read', 'write', 'admin'
    
    # Folder-level access (null = all folders, array of IDs = specific folders only)
    folder_access = Column(JSON, nullable=True)  # [1, 2, 3] or null for all
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
```

**Key Fields:**
- `has_access`: Boolean toggle - **FALSE by default** (users cannot access Drive unless explicitly granted)
- `permission_level`: Access level ('read', 'write', 'admin')
- `folder_access`: Optional list of folder IDs user can access

---

## ADMIN API ENDPOINTS (Permission Management)

### 1. Get All Permissions
**Endpoint:** `GET /api/v1/drive-admin/permissions`  
**File:** `backend/app/api/v1/routers/drive_admin.py:36-62`

**What it does:**
- Returns all DrivePermission records with user details
- Shows which users have access and their permission level

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 5,
    "has_access": true,
    "permission_level": "read",
    "folder_access": [1, 2, 3],
    "username": "john_doe",
    "full_name": "John Doe",
    "role": "technician"
  }
]
```

---

### 2. Get Users WITHOUT Drive Access
**Endpoint:** `GET /api/v1/drive-admin/permissions/users-without-access`  
**File:** `backend/app/api/v1/routers/drive_admin.py:65-81`

**What it does:**
- Returns all active users who don't have a DrivePermission record
- These users currently CANNOT access Drive
- Admin can select from this list to grant access

**Response:**
```json
[
  {
    "id": 10,
    "username": "jane_smith",
    "full_name": "Jane Smith",
    "role": "manager"
  }
]
```

**Logic:**
```python
# Get all user IDs that have permissions
users_with_perm = db.query(DrivePermission.user_id).all()
user_ids_with_perm = [u[0] for u in users_with_perm]

# Get users without permissions
users = db.query(User).filter(
    User.id.notin_(user_ids_with_perm) if user_ids_with_perm else True,
    User.is_active == True
).all()
```

---

### 3. Create Permission (Grant Access)
**Endpoint:** `POST /api/v1/drive-admin/permissions`  
**File:** `backend/app/api/v1/routers/drive_admin.py:84-112`

**What it does:**
- Creates a new DrivePermission record for a user
- Grants Drive access to the user
- Sets permission level and folder restrictions

**Request Body:**
```json
{
  "user_id": 10,
  "has_access": true,
  "permission_level": "read",
  "folder_access": [1, 2, 3]  // Optional: null = all folders
}
```

**Response:**
```json
{
  "id": 2,
  "user_id": 10,
  "has_access": true,
  "permission_level": "read",
  "folder_access": [1, 2, 3],
  "created_at": "2026-01-02T10:00:00",
  "created_by": "Admin User"
}
```

**Logic:**
```python
# Check if user exists
user = db.query(User).filter(User.id == data.user_id).first()
if not user:
    raise HTTPException(status_code=404, detail="User not found")

# Check if permission already exists
existing = db.query(DrivePermission).filter(DrivePermission.user_id == data.user_id).first()
if existing:
    raise HTTPException(status_code=400, detail="Permission already exists for this user")

# Create permission
permission = DrivePermission(
    user_id=data.user_id,
    has_access=data.has_access,
    permission_level=data.permission_level,
    folder_access=data.folder_access,
    created_by=current_user.full_name
)
db.add(permission)
db.commit()
```

---

### 4. Update Permission (Modify Access)
**Endpoint:** `PUT /api/v1/drive-admin/permissions/{user_id}`  
**File:** `backend/app/api/v1/routers/drive_admin.py:115-148`

**What it does:**
- Updates existing permission for a user
- Can enable/disable access
- Can change permission level
- Can modify folder restrictions

**Request Body:**
```json
{
  "has_access": false,  // Disable access
  "permission_level": "write",
  "folder_access": null  // Allow all folders
}
```

**Logic:**
```python
permission = db.query(DrivePermission).filter(DrivePermission.user_id == user_id).first()

if not permission:
    # Create new permission if it doesn't exist
    permission = DrivePermission(
        user_id=user_id,
        has_access=data.has_access if data.has_access is not None else False,
        permission_level=data.permission_level or 'read',
        folder_access=data.folder_access,
        created_by=current_user.full_name
    )
    db.add(permission)
else:
    # Update existing permission
    if data.has_access is not None:
        permission.has_access = data.has_access
    if data.permission_level is not None:
        permission.permission_level = data.permission_level
    if data.folder_access is not None:
        permission.folder_access = data.folder_access if data.folder_access else None
    permission.updated_by = current_user.full_name

db.commit()
```

---

### 5. Delete Permission (Revoke Access)
**Endpoint:** `DELETE /api/v1/drive-admin/permissions/{user_id}`  
**File:** `backend/app/api/v1/routers/drive_admin.py:151-165`

**What it does:**
- Removes DrivePermission record for a user
- User will NO LONGER have access to Drive

**Logic:**
```python
permission = db.query(DrivePermission).filter(DrivePermission.user_id == user_id).first()
if not permission:
    raise HTTPException(status_code=404, detail="Permission not found")

db.delete(permission)
db.commit()
```

---

## HOW THE LOGIC SHOULD WORK

### Permission Granting Flow

```
1. Admin logs in
   ↓
2. Admin navigates to Drive Settings
   ↓
3. Admin sees two lists:
   - Users WITH Drive access (already granted)
   - Users WITHOUT Drive access (can be granted)
   ↓
4. Admin selects a user WITHOUT access
   ↓
5. Admin chooses:
   - Enable/Disable access (has_access)
   - Permission level (read/write/admin)
   - Folder restrictions (optional - specific folders or all)
   ↓
6. Admin saves
   ↓
7. DrivePermission record created/updated
   ↓
8. User can now access Drive (if has_access = true)
```

### Permission Levels

| Level | Can View | Can Download | Can Upload | Can Create Folders | Can Rename | Can Move | Can Delete |
|-------|----------|--------------|------------|-------------------|-----------|---------|-----------|
| **read** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **write** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Folder Access Control

| folder_access Value | Meaning |
|---------------------|---------|
| `null` | User can access ALL folders |
| `[1, 2, 3]` | User can ONLY access folders with IDs 1, 2, 3 |
| `[]` | User cannot access ANY folders |

---

## CURRENT PROBLEM: LOGIC EXISTS BUT NOT ENFORCED

### The Issue

The permission management logic is **COMPLETELY IMPLEMENTED** in the admin API, but **NOT ENFORCED** in the main Drive API.

**What Works:**
- ✅ Admin can create permissions
- ✅ Admin can update permissions
- ✅ Admin can delete permissions
- ✅ Admin can see all permissions
- ✅ Admin can see users without access
- ✅ Database stores permissions correctly

**What Doesn't Work:**
- ❌ Drive API endpoints DON'T check permissions
- ❌ Users without `has_access = true` can still access Drive
- ❌ Users with `read` permission can still write/delete
- ❌ Users with folder restrictions can still access all folders

### Evidence

**File:** `backend/app/api/v1/routers/drive.py:18-26`

```python
@router.get("/contents", response_model=DriveContentsResponse)
def get_folder_contents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ❌ Only checks auth, NOT drive permission!
):
    """Get contents of a folder (or root if folder_id is None)"""
    service = DriveService(db)
    return service.get_folder_contents(folder_id)  # ❌ NO PERMISSION CHECK!
```

**What's Missing:**
```python
# SHOULD BE:
@router.get("/contents", response_model=DriveContentsResponse)
def get_folder_contents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission)  # ✅ Check drive permission!
):
    """Get contents of a folder (or root if folder_id is None)"""
    service = DriveService(db)
    return service.get_folder_contents(folder_id)
```

---

## REQUIRED FIX: IMPLEMENT PERMISSION ENFORCEMENT

### Step 1: Create Permission Check Dependency

**File:** `backend/app/api/v1/deps.py`

```python
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.drive import DrivePermission
from app.db.session import get_db

def check_drive_permission(
    required_level: str = 'read',
    check_folder_access: bool = False
):
    """
    Check if user has Drive access permission.
    
    Args:
        required_level: Minimum permission level ('read', 'write', 'admin')
        check_folder_access: If True, also check folder-level access
    """
    async def check(
        folder_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        # Admins bypass all checks
        if current_user.role == UserRole.admin:
            return current_user
        
        # Check if user has drive permission record
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        # No permission record or access disabled
        if not permission or not permission.has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to Drive. Please contact your administrator."
            )
        
        # Check permission level hierarchy
        level_hierarchy = {'read': 0, 'write': 1, 'admin': 2}
        user_level = level_hierarchy.get(permission.permission_level, 0)
        required_level_value = level_hierarchy.get(required_level, 0)
        
        if user_level < required_level_value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This operation requires '{required_level}' permission. You have '{permission.permission_level}'."
            )
        
        # Check folder access if required
        if check_folder_access and permission.folder_access is not None:
            if folder_id is None or folder_id not in permission.folder_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this folder."
                )
        
        return current_user
    
    return check
```

### Step 2: Update Drive Endpoints

**File:** `backend/app/api/v1/routers/drive.py`

```python
from app.api.v1.deps import check_drive_permission

# Read operations - require 'read' permission
@router.get("/contents", response_model=DriveContentsResponse)
def get_folder_contents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read', check_folder_access=True))
):
    """Get contents of a folder (or root if folder_id is None)"""
    service = DriveService(db)
    return service.get_folder_contents(folder_id)

@router.get("/search", response_model=List[DriveItemResponse])
def search_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read'))
):
    """Search for files and folders by name"""
    service = DriveService(db)
    return service.search(q)

@router.get("/{item_id}", response_model=DriveItemResponse)
def get_item(
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
def download_file(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('read'))
):
    """Download a file or view PDF inline in browser"""
    service = DriveService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # ... rest of download logic

# Write operations - require 'write' permission
@router.post("/folder", response_model=DriveItemResponse)
def create_folder(
    data: DriveItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write', check_folder_access=True))
):
    """Create a new folder"""
    service = DriveService(db)
    return service.create_folder(data, current_user.full_name)

@router.post("/upload", response_model=DriveUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    parent_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write', check_folder_access=True))
):
    """Upload a file"""
    service = DriveService(db)
    # ... upload logic

@router.put("/{item_id}", response_model=DriveItemResponse)
def update_item(
    item_id: int,
    data: DriveItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('write'))
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
    current_user: User = Depends(check_drive_permission('write'))
):
    """Move an item to a different folder"""
    service = DriveService(db)
    item = service.move_item(item_id, new_parent_id, current_user.full_name)
    if not item:
        raise HTTPException(status_code=400, detail="Cannot move item")
    return item

# Delete operations - require 'admin' permission
@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_drive_permission('admin'))
):
    """Delete a drive item (soft delete)"""
    service = DriveService(db)
    success = service.delete_item(item_id, current_user.full_name)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}
```

---

## SUMMARY

### Current State

✅ **Logic is CORRECTLY IMPLEMENTED:**
- Admin can see all users
- Admin can grant/revoke Drive access
- Admin can set permission levels (read/write/admin)
- Admin can restrict folder access
- Database stores permissions correctly

❌ **Enforcement is MISSING:**
- Drive API doesn't check permissions
- Any authenticated user can access Drive
- Permission levels are ignored
- Folder restrictions are ignored

### What Needs to Be Done

1. Create `check_drive_permission()` dependency in `deps.py`
2. Add permission checks to all Drive API endpoints
3. Enforce permission level hierarchy (read < write < admin)
4. Enforce folder access restrictions
5. Return proper error messages when access is denied

### Expected Behavior After Fix

| User | has_access | permission_level | Can Access Drive? |
|------|------------|------------------|-------------------|
| User A | `true` | `read` | ✅ Yes (view/download only) |
| User B | `true` | `write` | ✅ Yes (full access except delete) |
| User C | `true` | `admin` | ✅ Yes (full access) |
| User D | `false` | any | ❌ No (access denied) |
| User E | (no record) | - | ❌ No (access denied) |

---

**Report Generated:** January 2, 2026
