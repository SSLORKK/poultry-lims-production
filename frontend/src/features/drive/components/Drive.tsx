import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorDisplay } from '../../../components/common/ApiErrorDisplay';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { usePermissions } from '../../../hooks/usePermissions';
interface DriveItem {
  id: number;
  name: string;
  type: 'folder' | 'file';
  mime_type?: string;
  size?: number;
  path?: string;
  parent_id?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  description?: string;
  shared_with?: string[];
  is_public?: boolean;
  color?: string;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ClipboardItem {
  item: DriveItem;
  action: 'copy' | 'cut';
}

interface Breadcrumb {
  id: number;
  name: string;
}

interface DriveContents {
  current_folder?: DriveItem;
  breadcrumbs: Breadcrumb[];
  items: DriveItem[];
  total_items: number;
}

type SortField = 'name' | 'updated_at' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';

// Helper function to highlight matching text in search results
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const Drive = () => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { canWrite } = usePermissions();
  const canEdit = canWrite('Drive') || user?.role === 'admin' || user?.role === 'manager';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [newName, setNewName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<DriveItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ item: DriveItem; position: ContextMenuPosition } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsItem, setDetailsItem] = useState<DriveItem | null>(null);
  const [_showMoveModal, setShowMoveModal] = useState(false);
  const [_moveItem, setMoveItem] = useState<DriveItem | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorItem, setColorItem] = useState<DriveItem | null>(null);
  
  // Drag and drop for moving items
  const [draggedItem, setDraggedItem] = useState<DriveItem | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  // Fetch folder contents
  const { data: contents, isLoading, error, refetch } = useQuery<DriveContents>({
    queryKey: ['drive', currentFolderId],
    queryFn: async () => {
      const params = currentFolderId ? `?folder_id=${currentFolderId}` : '';
      const response = await apiClient.get(`/drive/contents${params}`);
      return response.data;
    }
  });


  // Debounce search input for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300); // 300ms debounce delay
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search query with debounced value for faster response
  const { data: searchResults, isLoading: isSearching } = useQuery<DriveItem[]>({
    queryKey: ['drive-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const response = await apiClient.get(`/drive/search?q=${encodeURIComponent(debouncedSearch)}`);
      return response.data;
    },
    enabled: debouncedSearch.length > 1, // Start search after 2 characters
    staleTime: 30000, // Cache results for 30 seconds
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.post('/drive/folder', {
        name,
        parent_id: currentFolderId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive', currentFolderId] });
      setShowNewFolderModal(false);
      setNewFolderName('');
    }
  });

  // Upload file mutation - supports uploading to specific folder
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, targetFolderId }: { file: File; targetFolderId?: number | null }) => {
      const formData = new FormData();
      formData.append('file', file);
      const folderId = targetFolderId !== undefined ? targetFolderId : currentFolderId;
      if (folderId) {
        formData.append('parent_id', folderId.toString());
      }
      const response = await apiClient.post('/drive/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive'] });
      setUploading(false);
      setUploadProgress(0);
    },
    onError: () => {
      setUploading(false);
      setUploadProgress(0);
    }
  });

  // Move item mutation
  const moveMutation = useMutation({
    mutationFn: async ({ id, newParentId }: { id: number; newParentId: number | null }) => {
      const response = await apiClient.put(`/drive/${id}/move`, null, {
        params: { new_parent_id: newParentId }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive'] });
      setShowMoveModal(false);
      setMoveItem(null);
      setDraggedItem(null);
      setDropTargetId(null);
    }
  });

  // Copy item mutation
  const copyMutation = useMutation({
    mutationFn: async ({ id, targetFolderId }: { id: number; targetFolderId: number | null }) => {
      const response = await apiClient.post(`/drive/${id}/copy`, null, {
        params: { target_folder_id: targetFolderId }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive'] });
      setClipboard(null);
    }
  });

  // Update color mutation
  const updateColorMutation = useMutation({
    mutationFn: async ({ id, color }: { id: number; color: string }) => {
      const response = await apiClient.put(`/drive/${id}`, { color });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive', currentFolderId] });
      setShowColorPicker(false);
      setColorItem(null);
    }
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiClient.put(`/drive/${id}`, { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive', currentFolderId] });
      setShowRenameModal(false);
      setRenameItem(null);
      setNewName('');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/drive/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive', currentFolderId] });
      setShowDeleteModal(false);
      setDeleteItem(null);
    }
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploading(true);
      Array.from(files).forEach(file => {
        uploadFileMutation.mutate({ file, targetFolderId: currentFolderId });
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFileMutation, currentFolderId]);

  const handleDownload = async (item: DriveItem) => {
    try {
      // For PDF files, open directly in browser with authentication
      const isPdf = item.name.toLowerCase().endsWith('.pdf') || item.mime_type === 'application/pdf';
      
      const response = await apiClient.get(`/drive/${item.id}/download`, {
        responseType: 'blob'
      });
      
      if (isPdf) {
        // Open PDF in new tab
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Cleanup after a delay to allow the browser to load the PDF
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } else {
        // For other files, download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', item.name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Use Iraq timezone (Asia/Baghdad)
    const iraqTimeOptions: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Baghdad'
    };
    const iraqDateOptions: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'Asia/Baghdad'
    };
    
    if (days === 0) return `Today, ${date.toLocaleTimeString('en-US', iraqTimeOptions)}`;
    if (days === 1) return `Yesterday, ${date.toLocaleTimeString('en-US', iraqTimeOptions)}`;
    return date.toLocaleDateString('en-US', iraqDateOptions);
  };

  const getFileIcon = (item: DriveItem) => {
    if (item.type === 'folder') {
      return (
        <svg className="h-6 w-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    }
    
    const mime = item.mime_type || '';
    if (mime.startsWith('image/')) {
      return (
        <svg className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    }
    if (mime === 'application/pdf') {
      return (
        <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (mime.includes('spreadsheet') || mime.includes('excel')) {
      return (
        <svg className="h-6 w-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (mime.includes('word') || mime.includes('document')) {
      return (
        <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    // Compressed/Archive files
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip') || mime.includes('compressed') || item.name.match(/\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/i)) {
      return (
        <svg className="h-6 w-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4 2a1 1 0 00-1 1v1h2V7a1 1 0 00-1-1zM7 9v1h2V9H7zm0 2v1h2v-1H7zm0 2v2h2v-2H7z" clipRule="evenodd" />
        </svg>
      );
    }
    // Video files
    if (mime.startsWith('video/') || item.name.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/i)) {
      return (
        <svg className="h-6 w-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
      );
    }
    // Audio files
    if (mime.startsWith('audio/') || item.name.match(/\.(mp3|wav|ogg|flac|aac|wma)$/i)) {
      return (
        <svg className="h-6 w-6 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
      );
    }
    // Presentation files
    if (mime.includes('presentation') || mime.includes('powerpoint') || item.name.match(/\.(ppt|pptx|odp)$/i)) {
      return (
        <svg className="h-6 w-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    // Text files
    if (mime.startsWith('text/') || item.name.match(/\.(txt|csv|json|xml|md|log)$/i)) {
      return (
        <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="h-6 w-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  };

  const getFileType = (item: DriveItem) => {
    if (item.type === 'folder') return 'Folder';
    const mime = item.mime_type || '';
    const name = item.name.toLowerCase();
    if (mime.startsWith('image/')) return 'Image';
    if (mime === 'application/pdf') return 'PDF';
    if (mime.includes('spreadsheet') || mime.includes('excel') || name.match(/\.(xls|xlsx|ods)$/)) return 'Spreadsheet';
    if (mime.includes('word') || mime.includes('document') || name.match(/\.(doc|docx|odt)$/)) return 'Document';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip') || mime.includes('compressed') || name.match(/\.(zip|rar|7z|tar|gz|bz2|xz|tgz)$/)) return 'Archive';
    if (mime.startsWith('video/') || name.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/)) return 'Video';
    if (mime.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|flac|aac|wma)$/)) return 'Audio';
    if (mime.includes('presentation') || mime.includes('powerpoint') || name.match(/\.(ppt|pptx|odp)$/)) return 'Presentation';
    if (mime.startsWith('text/') || name.match(/\.(txt|csv|json|xml|md|log)$/)) return 'Text';
    return 'File';
  };

  // Sort and filter items
  const sortedAndFilteredItems = useMemo(() => {
    let items = searchQuery.length > 2 ? searchResults || [] : contents?.items || [];
    
    // Filter by search query locally as well
    if (searchQuery && searchQuery.length <= 2) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(query));
    }

    // Sort items - folders first, then by selected field
    return [...items].sort((a, b) => {
      // Folders always come first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.mime_type || '').localeCompare(b.mime_type || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contents?.items, searchResults, searchQuery, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      item,
      position: { x: e.clientX, y: e.clientY }
    });
  }, []);

  // Context menu actions
  const handleCopy = (item: DriveItem) => {
    setClipboard({ item, action: 'copy' });
    setContextMenu(null);
  };

  const handleCut = (item: DriveItem) => {
    setClipboard({ item, action: 'cut' });
    setContextMenu(null);
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    
    if (clipboard.action === 'copy') {
      copyMutation.mutate({ id: clipboard.item.id, targetFolderId: currentFolderId });
    } else {
      moveMutation.mutate({ id: clipboard.item.id, newParentId: currentFolderId });
    }
    setContextMenu(null);
  };

  // Drag and drop handlers for file upload
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging for external files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDropTargetId(null);

    // Handle file upload from desktop
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setUploading(true);
      Array.from(files).forEach(file => {
        uploadFileMutation.mutate({ file, targetFolderId: currentFolderId });
      });
      return;
    }

    // Handle internal item move
    if (draggedItem && dropTargetId !== null) {
      moveMutation.mutate({ id: draggedItem.id, newParentId: dropTargetId });
    }
    setDraggedItem(null);
  }, [uploadFileMutation, currentFolderId, draggedItem, dropTargetId, moveMutation]);

  // Item drag handlers for moving within drive
  const handleItemDragStart = useCallback((e: React.DragEvent, item: DriveItem) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id.toString());
    setDraggedItem(item);
  }, []);

  const handleItemDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTargetId(null);
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.id !== folderId) {
      setDropTargetId(folderId);
    }
  }, [draggedItem]);

  const handleFolderDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Handle file upload from desktop
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setUploading(true);
      Array.from(files).forEach(file => {
        uploadFileMutation.mutate({ file, targetFolderId: folderId });
      });
      setDropTargetId(null);
      return;
    }

    // Handle internal item move
    if (draggedItem && draggedItem.id !== folderId) {
      moveMutation.mutate({ id: draggedItem.id, newParentId: folderId });
    }
    setDraggedItem(null);
    setDropTargetId(null);
  }, [draggedItem, moveMutation, uploadFileMutation]);

  // Select item handler
  const toggleSelectItem = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all handler
  const selectAll = () => {
    if (selectedItems.size === sortedAndFilteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedAndFilteredItems.map(item => item.id)));
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const displayItems = sortedAndFilteredItems;

  return (
    <div 
      ref={dropZoneRef}
      className={`h-full min-h-screen transition-colors ${isDragging ? 'bg-blue-50' : 'bg-gray-50'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Drop files to upload</h3>
            <p className="text-gray-500">Release to upload your files to this folder</p>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              Drive
            </h1>
            <p className="text-gray-500 mt-1">Manage and access your files securely</p>
          </div>
        </div>

        {/* Navigation Bar with Back Button and Breadcrumbs */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => {
              if (contents?.breadcrumbs && contents.breadcrumbs.length > 1) {
                setCurrentFolderId(contents.breadcrumbs[contents.breadcrumbs.length - 2].id);
              } else {
                setCurrentFolderId(null);
              }
            }}
            disabled={!currentFolderId}
            className={`p-2 rounded-lg transition-colors ${
              currentFolderId 
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Home
            </button>
            {contents?.breadcrumbs?.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`font-medium ${idx === (contents?.breadcrumbs?.length || 0) - 1 ? 'text-gray-800' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Quick Paste Button when clipboard has content */}
          {clipboard && (
            <button
              onClick={handlePaste}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Paste here
            </button>
          )}
        </div>

        {/* Search and Actions Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search with loading indicator */}
            <div className="flex-1 w-full lg:max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 placeholder-gray-400"
                />
                {isSearching ? (
                  <svg className="absolute left-4 top-3.5 h-5 w-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {debouncedSearch && searchResults && (
                <p className="text-xs text-gray-500 mt-1 ml-2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{debouncedSearch}"
                </p>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:block">Sort:</span>
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(dir);
                }}
                className="px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="updated_at-desc">Modified (Newest)</option>
                <option value="updated_at-asc">Modified (Oldest)</option>
                <option value="size-desc">Size (Largest)</option>
                <option value="size-asc">Size (Smallest)</option>
              </select>
            </div>

            {/* Actions - Only show for users with edit permission */}
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="hidden sm:inline">New Folder</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 font-medium shadow-sm"
                  disabled={uploading}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">{uploading ? `${uploadProgress}%` : 'Upload'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">Uploading files...</p>
                <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files and Folders List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1">
          {/* List Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {contents?.current_folder ? contents.current_folder.name : 'My Files'}
              </h2>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {displayItems.length} {displayItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{selectedItems.size} selected</span>
                <button 
                  onClick={() => setSelectedItems(new Set())}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Loading your files...</p>
            </div>
          ) : error ? (
            <div className="p-8">
              <ApiErrorDisplay error={error} onRetry={() => refetch()} />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No results found' : 'This folder is empty'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                {searchQuery 
                  ? `No files or folders match "${searchQuery}"`
                  : canEdit ? 'Drag and drop files here or use the upload button to add files' : 'No files in this folder'}
              </p>
              {!searchQuery && canEdit && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowNewFolderModal(true)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    New Folder
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Files
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                    selectedItems.has(item.id) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-transparent hover:border-gray-200 bg-gray-50 hover:bg-white'
                  }`}
                  onClick={() => item.type === 'folder' ? setCurrentFolderId(item.id) : null}
                  onDoubleClick={() => item.type === 'file' && handleDownload(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  {/* Selection Checkbox */}
                  <div 
                    className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-opacity ${
                      selectedItems.has(item.id) ? 'opacity-100 bg-blue-500 border-blue-500' : 'opacity-0 group-hover:opacity-100 border-gray-300 bg-white'
                    }`}
                    onClick={(e) => toggleSelectItem(item.id, e)}
                  >
                    {selectedItems.has(item.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* File Icon */}
                  <div className="flex justify-center mb-3">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                      item.type === 'folder' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      {item.type === 'folder' ? (
                        <svg className="w-10 h-10 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      ) : (
                        <span className="transform scale-150">{getFileIcon(item)}</span>
                      )}
                    </div>
                  </div>

                  {/* File Name with search highlighting */}
                  <p className="text-sm font-medium text-gray-900 text-center truncate" title={item.name}>
                    {debouncedSearch ? highlightText(item.name, debouncedSearch) : item.name}
                  </p>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {item.type === 'folder' ? 'Folder' : formatFileSize(item.size)}
                  </p>

                  {/* Quick Actions - Only show for users with edit permission */}
                  {canEdit && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameItem(item);
                          setNewName(item.name);
                          setShowRenameModal(true);
                        }}
                        className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 mr-1"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteItem(item);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === displayItems.length && displayItems.length > 0}
                        onChange={selectAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                      Type
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors w-28"
                      onClick={() => handleSort('size')}
                    >
                      <div className="flex items-center gap-2">
                        Size
                        {getSortIcon('size')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors w-40"
                      onClick={() => handleSort('updated_at')}
                    >
                      <div className="flex items-center gap-2">
                        Modified
                        {getSortIcon('updated_at')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Modified By
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`group transition-all cursor-pointer ${
                        dropTargetId === item.id && item.type === 'folder'
                          ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset'
                          : draggedItem?.id === item.id
                            ? 'opacity-50 bg-gray-100'
                            : selectedItems.has(item.id) 
                              ? 'bg-blue-50' 
                              : 'hover:bg-gray-50'
                      }`}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, item)}
                      onDragEnd={handleItemDragEnd}
                      onDragOver={item.type === 'folder' ? (e) => handleFolderDragOver(e, item.id) : undefined}
                      onDragLeave={item.type === 'folder' ? handleFolderDragLeave : undefined}
                      onDrop={item.type === 'folder' ? (e) => handleFolderDrop(e, item.id) : undefined}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => toggleSelectItem(item.id, e as any)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div 
                          className="flex items-center cursor-pointer group/name"
                          onClick={() => item.type === 'folder' && setCurrentFolderId(item.id)}
                          onDoubleClick={() => item.type === 'file' && handleDownload(item)}
                        >
                          <span className="mr-3 flex-shrink-0">{getFileIcon(item)}</span>
                          <span className="text-sm font-medium text-gray-900 group-hover/name:text-blue-600 truncate max-w-xs">
                            {debouncedSearch ? highlightText(item.name, debouncedSearch) : item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                          item.type === 'folder' 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {getFileType(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(item.size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(item.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.updated_by || item.created_by || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.type === 'file' && (
                            <button
                              onClick={() => handleDownload(item)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => {
                                  setRenameItem(item);
                                  setNewName(item.name);
                                  setShowRenameModal(true);
                                }}
                                className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                title="Rename"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteItem(item);
                                  setShowDeleteModal(true);
                                }}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 ${
                newFolderName && (/[<>:"/\\|?*]/.test(newFolderName) || contents?.items?.some(i => i.name.toLowerCase() === newFolderName.trim().toLowerCase()))
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              }`}
              autoFocus
            />
            {newFolderName && /[<>:"/\\|?*]/.test(newFolderName) && (
              <p className="text-xs text-red-600 mb-2">Name cannot contain: {'< > : " / \\ | ? *'}</p>
            )}
            {newFolderName && contents?.items?.some(i => i.name.toLowerCase() === newFolderName.trim().toLowerCase()) && (
              <p className="text-xs text-red-600 mb-2">A folder or file with this name already exists</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
                disabled={!newFolderName.trim() || createFolderMutation.isPending || /[<>:"/\\|?*]/.test(newFolderName) || contents?.items?.some(i => i.name.toLowerCase() === newFolderName.trim().toLowerCase())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && renameItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Rename {renameItem.type === 'folder' ? 'Folder' : 'File'}</h3>
            <input
              type="text"
              placeholder="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 ${
                newName && (/[<>:"/\\|?*]/.test(newName) || (contents?.items?.some(i => i.id !== renameItem.id && i.name.toLowerCase() === newName.trim().toLowerCase())))
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              }`}
              autoFocus
            />
            {newName && /[<>:"/\\|?*]/.test(newName) && (
              <p className="text-xs text-red-600 mb-2">Name cannot contain: {'< > : " / \\ | ? *'}</p>
            )}
            {newName && contents?.items?.some(i => i.id !== renameItem.id && i.name.toLowerCase() === newName.trim().toLowerCase()) && (
              <p className="text-xs text-red-600 mb-2">A folder or file with this name already exists</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameItem(null);
                  setNewName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => newName.trim() && renameMutation.mutate({ id: renameItem.id, name: newName.trim() })}
                disabled={!newName.trim() || renameMutation.isPending || /[<>:"/\\|?*]/.test(newName) || contents?.items?.some(i => i.id !== renameItem.id && i.name.toLowerCase() === newName.trim().toLowerCase())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {renameMutation.isPending ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Delete {deleteItem.type === 'folder' ? 'Folder' : 'File'}</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-semibold">{deleteItem.name}</span>?
              {deleteItem.type === 'folder' && ' All contents will be deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[100] min-w-[200px]"
          style={{
            left: Math.min(contextMenu.position.x, window.innerWidth - 220),
            top: Math.min(contextMenu.position.y, window.innerHeight - 400)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Copy */}
          <button
            onClick={() => handleCopy(contextMenu.item)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>

          {/* Cut */}
          <button
            onClick={() => handleCut(contextMenu.item)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            Cut
          </button>

          {/* Paste - only show if clipboard has content */}
          {clipboard && (
            <button
              onClick={handlePaste}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Paste {clipboard.action === 'cut' ? '(Move)' : '(Copy)'}
            </button>
          )}

          <div className="border-t border-gray-100 my-1" />

          {/* Move */}
          <button
            onClick={() => {
              setMoveItem(contextMenu.item);
              setShowMoveModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Move to...
          </button>

          {/* Rename */}
          <button
            onClick={() => {
              setRenameItem(contextMenu.item);
              setNewName(contextMenu.item.name);
              setShowRenameModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rename
          </button>

          <div className="border-t border-gray-100 my-1" />

          {/* Download - only for files */}
          {contextMenu.item.type === 'file' && (
            <button
              onClick={() => {
                handleDownload(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}

          <div className="border-t border-gray-100 my-1" />

          {/* Folder Color - only for folders */}
          {contextMenu.item.type === 'folder' && (
            <button
              onClick={() => {
                setColorItem(contextMenu.item);
                setShowColorPicker(true);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Folder Color
            </button>
          )}

          {/* Details */}
          <button
            onClick={() => {
              setDetailsItem(contextMenu.item);
              setShowDetailsModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Details
          </button>

          <div className="border-t border-gray-100 my-1" />

          {/* Delete */}
          <button
            onClick={() => {
              setDeleteItem(contextMenu.item);
              setShowDeleteModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && detailsItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                detailsItem.type === 'folder' ? 'bg-yellow-100' : 'bg-blue-100'
              }`}>
                {detailsItem.type === 'folder' ? (
                  <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                ) : (
                  <span className="transform scale-150">{getFileIcon(detailsItem)}</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 truncate">{detailsItem.name}</h3>
                <p className="text-sm text-gray-500">{getFileType(detailsItem)}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setDetailsItem(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Size</p>
                  <p className="text-sm font-medium text-gray-900">{formatFileSize(detailsItem.size)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-900">{getFileType(detailsItem)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm font-medium text-gray-900">
                  {detailsItem.created_at ? new Date(detailsItem.created_at).toLocaleString() : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1">by {detailsItem.created_by || 'Unknown'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Last Modified</p>
                <p className="text-sm font-medium text-gray-900">
                  {detailsItem.updated_at ? new Date(detailsItem.updated_at).toLocaleString() : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1">by {detailsItem.updated_by || detailsItem.created_by || 'Unknown'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Access</p>
                {detailsItem.shared_with && detailsItem.shared_with.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {detailsItem.shared_with.map((user, idx) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-900">Private (Only you)</p>
                )}
              </div>

              {detailsItem.path && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Location</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{detailsItem.path}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Folder Color Picker Modal */}
      {showColorPicker && colorItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Choose Folder Color</h3>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {['#FCD34D', '#F87171', '#60A5FA', '#34D399', '#A78BFA', '#FB923C', '#F472B6', '#2DD4BF', '#818CF8', '#94A3B8'].map((color) => (
                <button
                  key={color}
                  onClick={() => updateColorMutation.mutate({ id: colorItem.id, color })}
                  className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${
                    colorItem.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => updateColorMutation.mutate({ id: colorItem.id, color: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Reset to Default
              </button>
              <button
                onClick={() => {
                  setShowColorPicker(false);
                  setColorItem(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clipboard Indicator */}
      {clipboard && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div>
            <p className="text-sm font-medium">{clipboard.item.name}</p>
            <p className="text-xs text-gray-400">{clipboard.action === 'cut' ? 'Ready to move' : 'Ready to paste'}</p>
          </div>
          <button
            onClick={() => setClipboard(null)}
            className="ml-2 p-1 hover:bg-gray-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Drive;
