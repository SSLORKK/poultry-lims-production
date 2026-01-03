# DRIVE SYSTEM ENHANCEMENT GUIDE
**Date:** January 2, 2026  
**Purpose:** Transform Drive into a professional file management system with proper permission controls

---

## TABLE OF CONTENTS

1. [Drive UI/UX Enhancements](#drive-uiux-enhancements)
2. [Drive Feature Enhancements](#drive-feature-enhancements)
3. [Permission System Integration](#permission-system-integration)
4. [Screen Permission Management](#screen-permission-management)
5. [Implementation Roadmap](#implementation-roadmap)

---

## DRIVE UI/UX ENHANCEMENTS

### 1. Professional File Browser Interface

#### Features to Implement:

**A. Modern Grid/List View Toggle**
```typescript
// Drive browser component
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

<DriveViewToggle mode={viewMode} onChange={setViewMode} />
```

**Grid View Features:**
- Large file/folder icons
- Thumbnail previews for images
- File type icons with colors
- Hover effects with quick actions
- Drag-and-drop support

**List View Features:**
- Detailed file information columns
- Sortable headers
- Multi-select checkboxes
- Bulk action toolbar

**B. Breadcrumb Navigation**
```typescript
<DriveBreadcrumbs 
  items={[
    { id: null, name: 'Home' },
    { id: 1, name: 'Documents' },
    { id: 5, name: 'Reports' }
  ]}
  onNavigate={handleBreadcrumbClick}
/>
```

**C. Advanced Search Bar**
```typescript
<DriveSearchBar
  placeholder="Search files and folders..."
  filters={{
    type: ['file', 'folder'],
    dateRange: { start, end },
    sizeRange: { min, max },
    mimeType: ['application/pdf', 'image/*']
  }}
  onSearch={handleSearch}
/>
```

**D. File Preview Panel**
```typescript
<FilePreviewPanel
  file={selectedFile}
  onClose={() => setSelectedFile(null)}
  actions={{
    download: handleDownload,
    share: handleShare,
    rename: handleRename,
    delete: handleDelete
  }}
/>
```

**E. Context Menu (Right-Click)**
```typescript
<ContextMenu
  items={[
    { icon: 'download', label: 'Download', action: handleDownload },
    { icon: 'share', label: 'Share', action: handleShare },
    { icon: 'rename', label: 'Rename', action: handleRename },
    { icon: 'move', label: 'Move to...', action: handleMove },
    { icon: 'delete', label: 'Delete', action: handleDelete },
    { icon: 'info', label: 'Properties', action: showProperties }
  ]}
/>
```

---

### 2. Professional File Upload Interface

**A. Drag-and-Drop Upload Zone**
```typescript
<Dropzone
  onDrop={handleFileDrop}
  maxSize={100 * 1024 * 1024}  // 100MB
  maxFiles={10}
  accept={{
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    'application/vnd.ms-excel': ['.xls', '.xlsx'],
    'application/msword': ['.doc', '.docx']
  }}
>
  <UploadZoneUI />
</Dropzone>
```

**B. Upload Progress Tracking**
```typescript
<UploadProgress
  files={uploadQueue}
  onRetry={handleRetry}
  onCancel={handleCancel}
/>
```

**C. File Type Validation**
```typescript
const ALLOWED_FILE_TYPES = {
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'],
  archives: ['.zip', '.rar', '.7z'],
  data: ['.csv', '.json', '.xml']
};
```

---

### 3. Advanced File Operations

**A. Multi-Select Operations**
```typescript
<DriveToolbar
  selectedItems={selectedItems}
  actions={{
    download: handleBulkDownload,
    move: handleBulkMove,
    delete: handleBulkDelete,
    share: handleBulkShare
  }}
/>
```

**B. File Versioning**
```typescript
interface FileVersion {
  id: number;
  file_id: number;
  version: number;
  uploaded_by: string;
  uploaded_at: Date;
  file_size: number;
  comment?: string;
}

<FileVersionHistory
  fileId={selectedFile.id}
  versions={versions}
  onRestore={handleRestoreVersion}
/>
```

**C. File Properties Panel**
```typescript
<FileProperties
  file={selectedFile}
  properties={{
    name: string,
    type: string,
    size: number,
    created: Date,
    modified: Date,
    owner: string,
    path: string,
    mime_type: string,
    checksum: string
  }}
/>
```

---

## DRIVE FEATURE ENHANCEMENTS

### 1. Advanced Sharing System

**A. Share Link Management**
```typescript
interface ShareLink {
  id: number;
  token: string;
  is_public: boolean;
  requires_login: boolean;
  allowed_users: number[];
  expires_at?: Date;
  view_count: number;
  download_count: number;
  can_download: boolean;
}

<ShareLinkDialog
  file={selectedFile}
  onCreate={handleCreateShareLink}
  onManage={handleManageShareLinks}
/>
```

**Share Link Options:**
- Public link (anyone can access)
- Login required link
- Specific users only
- Expiration date
- Download permission toggle
- View count tracking

**B. Folder Sharing**
```typescript
<FolderShareDialog
  folder={selectedFolder}
  users={allUsers}
  permissions={{
    read: ['user1', 'user2'],
    write: ['user3'],
    admin: ['admin']
  }}
  onGrant={handleGrantFolderAccess}
  onRevoke={handleRevokeFolderAccess}
/>
```

**C. Recent Activity Feed**
```typescript
<DriveActivityFeed
  filters={{
    type: ['upload', 'download', 'share', 'delete'],
    dateRange: { start, end },
    user: userId
  }}
/>
```

---

### 2. Advanced Search & Filtering

**A. Full-Text Search**
```typescript
interface SearchFilters {
  query: string;
  fileTypes: string[];
  dateRange: { start: Date; end: Date };
  sizeRange: { min: number; max: number };
  owner: string;
  tags: string[];
}

<AdvancedSearch
  filters={filters}
  onSearch={handleAdvancedSearch}
  onSavedSearch={handleSaveSearch}
/>
```

**B. Smart Filters**
- Recently modified
- Recently uploaded
- Large files (>10MB)
- Files shared with me
- My files
- Starred files
- Archived files

**C. Saved Searches**
```typescript
<SavedSearches
  searches={savedSearches}
  onApply={handleApplySavedSearch}
  onDelete={handleDeleteSavedSearch}
/>
```

---

### 3. File Organization Features

**A. Tags & Labels**
```typescript
interface FileTag {
  id: number;
  name: string;
  color: string;
}

<FileTags
  file={selectedFile}
  availableTags={allTags}
  onAdd={handleAddTag}
  onRemove={handleRemoveTag}
  onCreate={handleCreateTag}
/>
```

**B. Favorites/Starred Files**
```typescript
<StarredFiles
  files={starredFiles}
  onUnstar={handleUnstar}
/>
```

**C. File Categories**
- Documents
- Images
- Reports
- Certificates
- SOPs
- Templates

---

### 4. Drive Analytics Dashboard

**A. Storage Usage**
```typescript
<StorageUsage
  used={storageUsed}
  total={storageTotal}
  breakdown={{
    documents: 45,
    images: 30,
    videos: 15,
    other: 10
  }}
/>
```

**B. Activity Charts**
```typescript
<DriveActivityChart
  data={{
    uploads: [10, 15, 20, 25, 30],
    downloads: [50, 60, 55, 70, 80],
    shares: [5, 8, 12, 10, 15]
  }}
  timeRange="30d"
/>
```

**C. User Activity Report**
```typescript
<UserActivityReport
  userId={userId}
  metrics={{
    filesUploaded: 150,
    filesDownloaded: 320,
    storageUsed: 500 * 1024 * 1024,
    lastActivity: Date
  }}
/>
```

---

## PERMISSION SYSTEM INTEGRATION

### 1. Drive Permission Model Enhancement

**Current Model:**
```python
class DrivePermission(Base):
    has_access = Column(Boolean, default=False)
    permission_level = Column(String(20), default='read')
    folder_access = Column(JSON, nullable=True)
```

**Enhanced Model:**
```python
class DrivePermission(Base):
    __tablename__ = "drive_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Access control
    has_access = Column(Boolean, default=False, nullable=False)
    permission_level = Column(String(20), default='read', nullable=False)
    
    # Folder access
    folder_access = Column(JSON, nullable=True)  # [1, 2, 3] or null for all
    
    # Quotas and limits
    storage_quota_mb = Column(Integer, default=1024)  # 1GB default
    storage_used_mb = Column(Integer, default=0)
    max_file_size_mb = Column(Integer, default=100)  # 100MB default
    max_files = Column(Integer, default=1000)
    
    # Sharing permissions
    can_share_files = Column(Boolean, default=False)
    can_share_folders = Column(Boolean, default=False)
    can_create_public_links = Column(Boolean, default=False)
    
    # Download permissions
    can_download = Column(Boolean, default=True)
    download_quota_mb = Column(Integer, default=10240)  # 10GB per month
    
    # Upload permissions
    can_upload = Column(Boolean, default=True)
    upload_quota_mb = Column(Integer, default=5120)  # 5GB per month
    
    # Delete permissions
    can_delete_own = Column(Boolean, default=True)
    can_delete_any = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Temporary access
    
    # Audit
    last_accessed_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0)
```

---

### 2. Permission Level Matrix

| Permission | None | Read | Write | Admin |
|------------|------|------|-------|-------|
| **View Files** | ❌ | ✅ | ✅ | ✅ |
| **Download Files** | ❌ | ✅ | ✅ | ✅ |
| **Upload Files** | ❌ | ❌ | ✅ | ✅ |
| **Create Folders** | ❌ | ❌ | ✅ | ✅ |
| **Rename Items** | ❌ | ❌ | ✅ | ✅ |
| **Move Items** | ❌ | ❌ | ✅ | ✅ |
| **Delete Own Files** | ❌ | ❌ | ✅ | ✅ |
| **Delete Any Files** | ❌ | ❌ | ❌ | ✅ |
| **Share Files** | ❌ | ❌ | ✅ | ✅ |
| **Share Folders** | ❌ | ❌ | ❌ | ✅ |
| **Create Public Links** | ❌ | ❌ | ❌ | ✅ |
| **Manage Permissions** | ❌ | ❌ | ❌ | ✅ |
| **View Analytics** | ❌ | ❌ | ❌ | ✅ |

---

### 3. Enhanced Permission Check Dependency

```python
# backend/app/api/v1/deps.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.drive import DrivePermission
from app.db.session import get_db
from typing import Optional

def check_drive_permission(
    required_level: str = 'read',
    check_folder_access: bool = False,
    check_quota: bool = False
):
    """
    Enhanced permission check with quota validation.
    
    Args:
        required_level: Minimum permission level ('read', 'write', 'admin')
        check_folder_access: If True, also check folder-level access
        check_quota: If True, check storage quota before operations
    """
    async def check(
        folder_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        # Admins bypass all checks
        if current_user.role == UserRole.admin:
            return current_user
        
        # Check if permission exists
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        # No permission or access disabled
        if not permission or not permission.has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to Drive. Please contact your administrator."
            )
        
        # Check if permission is expired
        if permission.expires_at and permission.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your Drive access has expired. Please contact your administrator."
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
        
        # Check storage quota if required
        if check_quota:
            if permission.storage_used_mb >= permission.storage_quota_mb:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"You have reached your storage quota ({permission.storage_quota_mb} MB)."
                )
        
        # Update access tracking
        permission.last_accessed_at = datetime.utcnow()
        permission.access_count += 1
        db.commit()
        
        return current_user
    
    return check


def check_drive_upload_permission():
    """Check if user can upload files (quota and permission)"""
    async def check(
        file_size_mb: float,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role == UserRole.admin:
            return current_user
        
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        if not permission or not permission.has_access:
            raise HTTPException(status_code=403, detail="No Drive access")
        
        if not permission.can_upload:
            raise HTTPException(status_code=403, detail="Upload permission denied")
        
        # Check file size limit
        if file_size_mb > permission.max_file_size_mb:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {permission.max_file_size_mb} MB"
            )
        
        # Check storage quota
        if permission.storage_used_mb + file_size_mb > permission.storage_quota_mb:
            raise HTTPException(
                status_code=413,
                detail=f"Insufficient storage quota. Available: {permission.storage_quota_mb - permission.storage_used_mb} MB"
            )
        
        return current_user
    
    return check


def check_drive_delete_permission(item_owner_id: int):
    """Check if user can delete a specific item"""
    async def check(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role == UserRole.admin:
            return current_user
        
        permission = db.query(DrivePermission).filter(
            DrivePermission.user_id == current_user.id
        ).first()
        
        if not permission or not permission.has_access:
            raise HTTPException(status_code=403, detail="No Drive access")
        
        # Check if user can delete any files (admin level)
        if permission.can_delete_any:
            return current_user
        
        # Check if user can delete own files (write level)
        if permission.can_delete_own and item_owner_id == current_user.id:
            return current_user
        
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this file"
        )
    
    return check
```

---

## SCREEN PERMISSION MANAGEMENT

### 1. Enhanced UserPermission Model

**Current Model:**
```python
class UserPermission(Base):
    user_id = Column(Integer, ForeignKey("users.id"))
    screen_name = Column(String(100))
    can_read = Column(Boolean, default=False)
    can_write = Column(Boolean, default=False)
```

**Enhanced Model:**
```python
class UserPermission(Base):
    __tablename__ = "user_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Screen identification
    screen_name = Column(String(100), nullable=False, index=True)
    screen_category = Column(String(50), nullable=True)  # 'database', 'reports', 'drive', 'controls'
    screen_icon = Column(String(50), nullable=True)
    screen_order = Column(Integer, default=0)
    
    # Permissions
    can_read = Column(Boolean, default=False, nullable=False)
    can_write = Column(Boolean, default=False, nullable=False)
    can_delete = Column(Boolean, default=False, nullable=False)
    can_export = Column(Boolean, default=False, nullable=False)
    
    # Drive-specific permissions (for Drive screen)
    drive_permission_level = Column(String(20), nullable=True)  # 'read', 'write', 'admin'
    drive_folder_access = Column(JSON, nullable=True)
    drive_storage_quota_mb = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Composite index for faster lookups
    __table_args__ = (
        Index('ix_user_permissions_user_screen', 'user_id', 'screen_name'),
    )
```

---

### 2. Screen Categories

| Category | Screens | Description |
|----------|---------|-------------|
| **Database** | Database - PCR, Database - Serology, Database - Microbiology | Sample and test data management |
| **Reports** | All Reports, PCR COA, Serology COA, Microbiology COA | Report generation and viewing |
| **Drive** | Drive | File management system |
| **Controls** | Companies, Farms | Dropdown data management |

---

### 3. Permission Management API

**A. Get User Permissions by Category**
```python
@router.get("/permissions/by-category/{category}", response_model=List[dict])
def get_permissions_by_category(
    category: str,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get all permissions for a specific screen category"""
    query = db.query(UserPermission).filter(
        UserPermission.screen_category == category
    )
    
    if user_id:
        query = query.filter(UserPermission.user_id == user_id)
    
    permissions = query.all()
    
    return [{
        "screen_name": perm.screen_name,
        "screen_icon": perm.screen_icon,
        "can_read": perm.can_read,
        "can_write": perm.can_write,
        "can_delete": perm.can_delete,
        "can_export": perm.can_export,
        "drive_permission_level": perm.drive_permission_level,
        "drive_folder_access": perm.drive_folder_access,
        "drive_storage_quota_mb": perm.drive_storage_quota_mb
    } for perm in permissions]
```

**B. Grant Screen Permission**
```python
@router.post("/permissions/grant-screen")
def grant_screen_permission(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Grant screen permission with optional Drive-specific settings.
    
    Request:
    {
        "user_id": 5,
        "screen_name": "Drive",
        "can_read": true,
        "can_write": true,
        "drive_permission_level": "write",
        "drive_folder_access": [1, 2, 3],
        "drive_storage_quota_mb": 2048
    }
    """
    user_id = data["user_id"]
    screen_name = data["screen_name"]
    
    # Check if permission exists
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.screen_name == screen_name
    ).first()
    
    if existing:
        # Update existing
        existing.can_read = data.get("can_read", existing.can_read)
        existing.can_write = data.get("can_write", existing.can_write)
        existing.can_delete = data.get("can_delete", existing.can_delete)
        existing.can_export = data.get("can_export", existing.can_export)
        
        # Drive-specific settings
        if screen_name == "Drive":
            existing.drive_permission_level = data.get("drive_permission_level")
            existing.drive_folder_access = data.get("drive_folder_access")
            existing.drive_storage_quota_mb = data.get("drive_storage_quota_mb")
        
        existing.updated_by = current_user.full_name
    else:
        # Create new
        permission = UserPermission(
            user_id=user_id,
            screen_name=screen_name,
            screen_category=data.get("screen_category"),
            can_read=data.get("can_read", False),
            can_write=data.get("can_write", False),
            can_delete=data.get("can_delete", False),
            can_export=data.get("can_export", False),
            drive_permission_level=data.get("drive_permission_level"),
            drive_folder_access=data.get("drive_folder_access"),
            drive_storage_quota_mb=data.get("drive_storage_quota_mb"),
            created_by=current_user.full_name
        )
        db.add(permission)
    
    db.commit()
    
    # Sync with DrivePermission table
    if screen_name == "Drive":
        sync_drive_permission(db, user_id, data)
    
    return {"message": "Permission granted successfully"}
```

**C. Sync Drive Permission**
```python
def sync_drive_permission(db: Session, user_id: int, data: dict):
    """
    Sync UserPermission Drive settings with DrivePermission table.
    """
    drive_permission = db.query(DrivePermission).filter(
        DrivePermission.user_id == user_id
    ).first()
    
    if not drive_permission:
        # Create DrivePermission
        drive_permission = DrivePermission(
            user_id=user_id,
            has_access=data.get("can_read", False),
            permission_level=data.get("drive_permission_level", "read"),
            folder_access=data.get("drive_folder_access"),
            storage_quota_mb=data.get("drive_storage_quota_mb", 1024),
            can_upload=data.get("can_write", False),
            can_download=data.get("can_read", True),
            can_delete_own=data.get("can_write", False),
            can_delete_any=False,
            can_share_files=data.get("can_write", False),
            can_share_folders=False,
            can_create_public_links=False
        )
        db.add(drive_permission)
    else:
        # Update DrivePermission
        drive_permission.has_access = data.get("can_read", drive_permission.has_access)
        drive_permission.permission_level = data.get("drive_permission_level", drive_permission.permission_level)
        drive_permission.folder_access = data.get("drive_folder_access", drive_permission.folder_access)
        drive_permission.storage_quota_mb = data.get("drive_storage_quota_mb", drive_permission.storage_quota_mb)
        drive_permission.can_upload = data.get("can_write", drive_permission.can_upload)
        drive_permission.updated_by = data.get("updated_by")
    
    db.commit()
```

---

### 4. Frontend Permission Management UI

**A. Permission Management Dashboard**
```typescript
<PermissionManagementDashboard>
  {/* User Selection */}
  <UserSelector
    users={allUsers}
    selectedUser={selectedUser}
    onSelect={setSelectedUser}
  />
  
  {/* Screen Categories */}
  <ScreenCategoryTabs
    categories={['database', 'reports', 'drive', 'controls']}
    activeCategory={activeCategory}
    onChange={setActiveCategory}
  />
  
  {/* Permission Matrix */}
  <PermissionMatrix
    user={selectedUser}
    category={activeCategory}
    screens={screens}
    permissions={userPermissions}
    onChange={handlePermissionChange}
  />
  
  {/* Drive-Specific Settings */}
  {activeCategory === 'drive' && (
    <DrivePermissionSettings
      user={selectedUser}
      permissionLevel={drivePermissionLevel}
      folderAccess={folderAccess}
      storageQuota={storageQuota}
      onChange={handleDriveSettingsChange}
    />
  )}
</PermissionManagementDashboard>
```

**B. Permission Matrix Component**
```typescript
<PermissionMatrix
  screens={[
    { name: 'Database - PCR', icon: 'flask' },
    { name: 'Database - Serology', icon: 'vial' },
    { name: 'Database - Microbiology', icon: 'bacteria' }
  ]}
  permissions={['can_read', 'can_write', 'can_delete', 'can_export']}
  userPermissions={permissions}
  onChange={(screen, permission, value) => {
    updatePermission(screen, permission, value);
  }}
/>
```

**C. Drive Permission Settings**
```typescript
<DrivePermissionSettings
  permissionLevel="write"
  folderAccess={[1, 2, 3]}
  storageQuota={2048}
  onChange={(settings) => {
    updateDriveSettings(settings);
  }}
>
  {/* Permission Level Selector */}
  <PermissionLevelSelector
    levels={['read', 'write', 'admin']}
    selected={settings.permissionLevel}
    onChange={handlePermissionLevelChange}
  />
  
  {/* Folder Access Selector */}
  <FolderAccessSelector
    folders={allFolders}
    selected={settings.folderAccess}
    onChange={handleFolderAccessChange}
    mode="multi"  // 'all' or 'multi'
  />
  
  {/* Storage Quota Slider */}
  <StorageQuotaSlider
    min={256}
    max={10240}
    value={settings.storageQuota}
    onChange={handleQuotaChange}
    unit="MB"
  />
  
  {/* Additional Permissions */}
  <ToggleGroup>
    <Toggle
      label="Can Upload"
      checked={settings.can_upload}
      onChange={handleUploadToggle}
    />
    <Toggle
      label="Can Download"
      checked={settings.can_download}
      onChange={handleDownloadToggle}
    />
    <Toggle
      label="Can Share Files"
      checked={settings.can_share_files}
      onChange={handleShareToggle}
    />
  </ToggleGroup>
</DrivePermissionSettings>
```

---

### 5. Frontend Route Protection

```typescript
// ProtectedRoute with screen permission check
interface ProtectedRouteProps {
  children: React.ReactNode;
  screenName: string;
  requirePermission?: 'read' | 'write' | 'delete' | 'export';
}

export function ProtectedRoute({ 
  children, 
  screenName, 
  requirePermission = 'read' 
}: ProtectedRouteProps) {
  const { user, permissions } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Check if user has permission for this screen
    const screenPerm = permissions.find(p => p.screen_name === screenName);
    
    if (!screenPerm) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    
    // Check required permission level
    const hasRequiredPerm = screenPerm[requirePermission === 'read' ? 'can_read' : 
                              requirePermission === 'write' ? 'can_write' :
                              requirePermission === 'delete' ? 'can_delete' :
                              'can_export'];
    
    setHasAccess(hasRequiredPerm);
    setLoading(false);
  }, [user, permissions, screenName, requirePermission]);
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!hasAccess) {
    return <AccessDeniedScreen screenName={screenName} />;
  }
  
  return <>{children}</>;
}

// Usage
<Route
  path="/drive"
  element={
    <ProtectedRoute screenName="Drive" requirePermission="read">
      <DrivePage />
    </ProtectedRoute>
  }
/>
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Critical Security (Week 1)
- [ ] Implement `check_drive_permission()` dependency
- [ ] Add permission checks to all Drive API endpoints
- [ ] Fix role checks to use UserRole enum
- [ ] Add permission level validation
- [ ] Test permission enforcement

### Phase 2: Drive UI Enhancements (Week 2-3)
- [ ] Implement grid/list view toggle
- [ ] Add breadcrumb navigation
- [ ] Create drag-and-drop upload zone
- [ ] Build file preview panel
- [ ] Implement context menu
- [ ] Add multi-select operations

### Phase 3: Advanced Features (Week 4-5)
- [ ] Implement share link management
- [ ] Add folder sharing
- [ ] Create activity feed
- [ ] Build advanced search
- [ ] Add tags and labels
- [ ] Implement favorites

### Phase 4: Permission System (Week 6)
- [ ] Enhance DrivePermission model
- [ ] Add quota management
- [ ] Implement permission sync
- [ ] Create permission management UI
- [ ] Build permission matrix
- [ ] Add route protection

### Phase 5: Analytics & Monitoring (Week 7)
- [ ] Build storage usage dashboard
- [ ] Create activity charts
- [ ] Implement user activity reports
- [ ] Add audit logging
- [ ] Create admin analytics

---

## SUMMARY

### Key Enhancements Needed

**Drive Professional Features:**
1. Modern UI with grid/list views, breadcrumbs, search
2. Drag-and-drop upload with progress tracking
3. Advanced sharing (public links, folder sharing)
4. File versioning and history
5. Tags, favorites, and smart filters
6. Analytics dashboard

**Permission System:**
1. Enhanced DrivePermission model with quotas
2. Permission level matrix (read/write/admin)
3. Screen permission management UI
4. Drive-specific settings per screen permission
5. Automatic sync between UserPermission and DrivePermission
6. Route protection with permission checks

**Admin Controls:**
1. Grant/revoke Drive access per user
2. Set permission levels (read/write/admin)
3. Configure folder restrictions
4. Set storage quotas
5. Manage upload/download permissions
6. Control sharing capabilities

---

**Guide Created:** January 2, 2026  
**Estimated Implementation Time:** 7 weeks for all enhancements
