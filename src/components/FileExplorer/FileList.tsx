import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { FileRecord } from '../../types';
import { getFileCategory, formatBytes, formatDate } from '../../types';
import { getDownloadUrl } from '../../lib/api';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  Image, Video, Music, FileText, Table2, Presentation,
  FileType, Archive, Code, File, Star, MoreVertical, Download,
  Edit2, Link as LinkIcon, FolderOpen, Trash2, CloudUpload,
  Check, Play, FolderInput, X, ArrowUp, ArrowDown, Pin, Tag,
  Palette
} from 'lucide-react';

interface FileListProps {
  files: FileRecord[];
  loading: boolean;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  onFolderOpen: (path: string) => void;
  onDelete: (fileId: string) => void;
  onToggleStar: (fileId: string) => void;
  onRename: (fileId: string, currentName: string) => void;
  onShare: (fileId: string) => void;
  onPreview: (file: FileRecord) => void;
  onPlayAudio?: (file: FileRecord) => void;
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
  onBatchDelete?: (fileIds: string[]) => Promise<void>;
  onFolderHover?: (path: string) => void;
}

const ICON_MAP: Record<string, any> = {
  folder: FolderOpen,
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  spreadsheet: Table2,
  presentation: Presentation,
  pdf: FileType,
  archive: Archive,
  code: Code,
  other: File,
};

export const FOLDER_COLORS = [
  { name: 'Sky Blue', color: '#38bdf8' },
  { name: 'Indigo', color: '#818cf8' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Rose', color: '#ef4444' },
];

export const PREDEFINED_TAGS = [
  { name: 'Penting', color: '#ef4444' },
  { name: 'Kerja', color: '#3b82f6' },
  { name: 'Pribadi', color: '#8b5cf6' },
  { name: 'Selesai', color: '#10b981' },
  { name: 'Arsip', color: '#64748b' },
  { name: 'Anime', color: '#ec4899' },
];

function getBroadCategory(mimeType: string | null, isFolder: boolean): 'folder' | 'video' | 'audio' | 'document' | 'image' | 'archive' | 'other' {
  if (isFolder) return 'folder';
  const cat = getFileCategory(mimeType, false);
  if (cat === 'video') return 'video';
  if (cat === 'audio') return 'audio';
  if (cat === 'image') return 'image';
  if (cat === 'archive') return 'archive';
  if (['document', 'pdf', 'spreadsheet', 'presentation', 'code'].includes(cat)) return 'document';
  return 'other';
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const cleanQuery = query.toLowerCase().trim();
  const cleanText = text.toLowerCase();

  // 1. Direct substring match
  if (cleanText.includes(cleanQuery)) return true;

  // 2. Normalized match (without symbols/spaces)
  const normQuery = cleanQuery.replace(/[\s._\-[\]()]+/g, '');
  const normText = cleanText.replace(/[\s._\-[\]()]+/g, '');
  if (normText.includes(normQuery)) return true;

  // 3. Subsequence match
  let qIdx = 0;
  for (let i = 0; i < cleanText.length && qIdx < cleanQuery.length; i++) {
    if (cleanText[i] === cleanQuery[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === cleanQuery.length;
}

export function FileList({
  files,
  loading,
  viewMode,
  searchQuery,
  onFolderOpen,
  onDelete,
  onToggleStar,
  onRename,
  onShare,
  onPreview,
  onPlayAudio,
  onMoveFiles,
  onBatchDelete,
  onFolderHover,
}: FileListProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileRecord } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drag & drop state
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Batch move modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetMoveFolder, setTargetMoveFolder] = useState<string>('/');

  // Batch 2: Category Filter ('all' | 'video' | 'audio' | 'document' | 'image' | 'archive')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'video' | 'audio' | 'document' | 'image' | 'archive'>('all');

  // Batch 2: Storage Provider Filter ('all' | 'mega' | 'mediafire' | 'backblaze' | 'filebase' | 'supabase')
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Batch 2: Multi-Column Sorting
  const [sortField, setSortField] = useState<'name' | 'size' | 'updated' | 'type'>(() => {
    return (localStorage.getItem('cv_sort_field') as any) || 'name';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('cv_sort_dir') as any) || 'asc';
  });

  // Batch 2: Folder Colors & Tags & Pinned Quick Access State (Persisted in localStorage)
  const [folderColors, setFolderColors] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('cv_folder_colors') || '{}');
    } catch {
      return {};
    }
  });

  const [fileTags, setFileTags] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('cv_file_tags') || '{}');
    } catch {
      return {};
    }
  });

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cv_pinned_ids') || '[]');
    } catch {
      return [];
    }
  });

  const setFolderColor = (folderId: string, color: string) => {
    const updated = { ...folderColors, [folderId]: color };
    setFolderColors(updated);
    localStorage.setItem('cv_folder_colors', JSON.stringify(updated));
  };

  const toggleFileTag = (fileId: string, tagName: string) => {
    const existing = fileTags[fileId] || [];
    const nextTags = existing.includes(tagName)
      ? existing.filter(t => t !== tagName)
      : [...existing, tagName];
    const updated = { ...fileTags, [fileId]: nextTags };
    setFileTags(updated);
    localStorage.setItem('cv_file_tags', JSON.stringify(updated));
  };

  const togglePin = (fileId: string) => {
    const nextPins = pinnedIds.includes(fileId)
      ? pinnedIds.filter(id => id !== fileId)
      : [...pinnedIds, fileId];
    setPinnedIds(nextPins);
    localStorage.setItem('cv_pinned_ids', JSON.stringify(nextPins));
  };

  // Real-time Category Counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: files.length,
      video: 0,
      audio: 0,
      document: 0,
      image: 0,
      archive: 0,
    };
    for (const f of files) {
      if (f.is_folder) continue;
      const bCat = getBroadCategory(f.mime_type, false);
      if (bCat in counts) {
        counts[bCat as keyof typeof counts]++;
      }
    }
    return counts;
  }, [files]);

  // Sorting handler
  const handleSortChange = (field: 'name' | 'size' | 'updated' | 'type') => {
    if (sortField === field) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
      localStorage.setItem('cv_sort_dir', nextDir);
    } else {
      setSortField(field);
      setSortDirection('asc');
      localStorage.setItem('cv_sort_field', field);
      localStorage.setItem('cv_sort_dir', 'asc');
    }
  };

  // Filter & Sort Pipeline (Fuzzy Search + Category + Provider + Sort)
  const sortedAndFilteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        // 1. Fuzzy Smart Search
        if (searchQuery && !fuzzyMatch(file.name, searchQuery)) {
          return false;
        }
        // 2. Category Filter
        if (categoryFilter !== 'all') {
          if (file.is_folder) return false;
          if (getBroadCategory(file.mime_type, false) !== categoryFilter) return false;
        }
        // 3. Provider Filter
        if (providerFilter !== 'all') {
          if (!file.is_folder && file.provider_id !== providerFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Folders always pinned to the top!
        if (a.is_folder !== b.is_folder) {
          return a.is_folder ? -1 : 1;
        }
        let cmp = 0;
        if (sortField === 'name') {
          cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortField === 'size') {
          cmp = (a.size_bytes || 0) - (b.size_bytes || 0);
        } else if (sortField === 'updated') {
          const tA = new Date(a.updated_at || a.created_at || 0).getTime();
          const tB = new Date(b.updated_at || b.created_at || 0).getTime();
          cmp = tA - tB;
        } else if (sortField === 'type') {
          const extA = a.name.split('.').pop()?.toLowerCase() || '';
          const extB = b.name.split('.').pop()?.toLowerCase() || '';
          cmp = extA.localeCompare(extB);
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [files, searchQuery, categoryFilter, providerFilter, sortField, sortDirection]);

  // Pinned items in the current view
  const pinnedFiles = useMemo(() => {
    return files.filter(f => pinnedIds.includes(f.id));
  }, [files, pinnedIds]);

  // Silky 60fps Scroll Reveal observer
  useScrollReveal([sortedAndFilteredFiles, viewMode]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Selection toggle
  const toggleSelect = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sortedAndFilteredFiles.map((f) => f.id)));
  }, [sortedAndFilteredFiles]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileRecord) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 240;
    const menuHeight = 340;
    const clampedX = Math.max(10, Math.min(e.clientX, (window.innerWidth || 360) - menuWidth - 10));
    const clampedY = Math.max(10, Math.min(e.clientY, (window.innerHeight || 600) - menuHeight - 10));
    setContextMenu({ x: clampedX, y: clampedY, file });
  }, []);

  const handleDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_folder) {
      onFolderOpen(file.path);
    } else {
      const cat = getFileCategory(file.mime_type, false);
      if (cat === 'audio' && onPlayAudio) {
        onPlayAudio(file);
      } else if (
        cat === 'image' ||
        cat === 'video' ||
        cat === 'pdf' ||
        cat === 'document' ||
        cat === 'code' ||
        file.name.toLowerCase().endsWith('.pdf')
      ) {
        onPreview(file);
      }
    }
  }, [onFolderOpen, onPlayAudio, onPreview]);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, file: FileRecord) => {
    e.dataTransfer.setData('application/x-simpenan-file', file.id);
    e.dataTransfer.setData('text/plain', file.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folder: FileRecord) => {
    if (!folder.is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== folder.id) {
      setDragOverFolderId(folder.id);
    }
  }, [dragOverFolderId]);

  const handleDragLeave = useCallback((e: React.DragEvent, folder: FileRecord) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolderId === folder.id) {
      setDragOverFolderId(null);
    }
  }, [dragOverFolderId]);

  const handleDrop = useCallback(async (e: React.DragEvent, folder: FileRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (!folder.is_folder || !onMoveFiles) return;

    const droppedId = e.dataTransfer.getData('application/x-simpenan-file') || e.dataTransfer.getData('text/plain');
    if (!droppedId || droppedId === folder.id) return;

    // Filter out target folder itself if selected
    const idsToMove = (selectedIds.has(droppedId) ? Array.from(selectedIds) : [droppedId]).filter(id => id !== folder.id);
    if (idsToMove.length === 0) return;

    try {
      await onMoveFiles(idsToMove, folder.path);
      clearSelection();
    } catch (err) {
      console.error('Failed to move files via drag-and-drop:', err);
    }
  }, [selectedIds, onMoveFiles, clearSelection]);

  // Batch delete handler
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = `Hapus ${selectedIds.size} berkas yang dipilih secara permanen?`;
    if (!window.confirm(confirmMsg)) return;

    if (onBatchDelete) {
      await onBatchDelete(Array.from(selectedIds));
    } else {
      for (const id of selectedIds) {
        onDelete(id);
      }
    }
    clearSelection();
  }, [selectedIds, onBatchDelete, onDelete, clearSelection]);

  // Batch move submit
  const handleBatchMoveSubmit = useCallback(async () => {
    if (selectedIds.size === 0 || !onMoveFiles) return;
    try {
      await onMoveFiles(Array.from(selectedIds), targetMoveFolder);
      setShowMoveModal(false);
      clearSelection();
    } catch (err) {
      console.error('Failed to move files in batch:', err);
    }
  }, [selectedIds, onMoveFiles, targetMoveFolder, clearSelection]);

  // Available folder options in current view for batch move modal
  const folderOptions = files.filter(f => f.is_folder);

  if (loading) {
    return (
      <div className={viewMode === 'grid' ? 'cv-file-grid' : ''}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="cv-skeleton" style={{
            height: viewMode === 'grid' ? 140 : 48,
            marginBottom: viewMode === 'list' ? 4 : 0,
          }} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Batch 2: Category Filter Tabs & Multi-Column Sorting Toolbar */}
      <div className="cv-filter-bar">
        <div className="cv-category-tabs">
          <button
            className={`cv-cat-tab ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            <span>Semua</span>
            <span className="cv-cat-count">{categoryCounts.all}</span>
          </button>
          <button
            className={`cv-cat-tab ${categoryFilter === 'video' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('video')}
          >
            <span>Video</span>
            <span className="cv-cat-count">{categoryCounts.video}</span>
          </button>
          <button
            className={`cv-cat-tab ${categoryFilter === 'audio' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('audio')}
          >
            <span>Audio</span>
            <span className="cv-cat-count">{categoryCounts.audio}</span>
          </button>
          <button
            className={`cv-cat-tab ${categoryFilter === 'document' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('document')}
          >
            <span>Dokumen</span>
            <span className="cv-cat-count">{categoryCounts.document}</span>
          </button>
          <button
            className={`cv-cat-tab ${categoryFilter === 'image' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('image')}
          >
            <span>Gambar</span>
            <span className="cv-cat-count">{categoryCounts.image}</span>
          </button>
          <button
            className={`cv-cat-tab ${categoryFilter === 'archive' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('archive')}
          >
            <span>Arsip</span>
            <span className="cv-cat-count">{categoryCounts.archive}</span>
          </button>
        </div>

        <div className="cv-filter-controls">
          {/* Storage Provider Filter */}
          <select
            className="cv-filter-select"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            title="Filter Berdasarkan Cloud Storage Provider"
            aria-label="Filter Berdasarkan Cloud Storage Provider"
          >
            <option value="all">Semua Cloud</option>
            <option value="mega">MEGA.nz</option>
            <option value="mediafire">MediaFire</option>
            <option value="backblaze">Backblaze B2</option>
            <option value="filebase">Filebase (IPFS)</option>
            <option value="supabase">Supabase</option>
          </select>

          {/* Sort Field Selector */}
          <select
            className="cv-filter-select"
            value={sortField}
            onChange={(e) => {
              const val = e.target.value as any;
              setSortField(val);
              localStorage.setItem('cv_sort_field', val);
            }}
            title="Pilih Kolom Urutan"
            aria-label="Pilih Kolom Urutan"
          >
            <option value="name">Nama</option>
            <option value="size">Ukuran</option>
            <option value="updated">Dimodifikasi</option>
            <option value="type">Tipe / Ekstensi</option>
          </select>

          {/* Sort Direction Toggle Button */}
          <button
            className="cv-btn cv-btn-secondary"
            onClick={() => {
              const next = sortDirection === 'asc' ? 'desc' : 'asc';
              setSortDirection(next);
              localStorage.setItem('cv_sort_dir', next);
            }}
            title={sortDirection === 'asc' ? 'Urutan Naik (A-Z)' : 'Urutan Turun (Z-A)'}
            aria-label="Toggle Urutan"
            style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
      </div>

      {/* Batch 2: Pinned Quick Access Section */}
      {pinnedFiles.length > 0 && (
        <div className="cv-pinned-section cv-stagger">
          <div className="cv-pinned-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pin size={13} style={{ transform: 'rotate(45deg)' }} />
              <span>Akses Cepat Disematkan ({pinnedFiles.length})</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--cv-text-tertiary)' }}>
              Klik ganda untuk membuka
            </span>
          </div>
          <div className="cv-pinned-grid">
            {pinnedFiles.map((pf) => {
              const cat = getFileCategory(pf.mime_type, pf.is_folder);
              const PfIcon = ICON_MAP[cat] || File;
              const folderColor = pf.is_folder ? folderColors[pf.id] : undefined;
              return (
                <div
                  key={pf.id}
                  className="cv-pinned-chip"
                  onClick={() => handleDoubleClick(pf)}
                  title={`Buka ${pf.name}`}
                >
                  <div
                    className={`cv-file-icon-box ${cat}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      flexShrink: 0,
                      background: folderColor ? `${folderColor}22` : undefined,
                      color: folderColor || undefined,
                    }}
                  >
                    <PfIcon size={14} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {pf.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(pf.id);
                    }}
                    title="Lepas sematan"
                    aria-label="Lepas sematan"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--cv-text-tertiary)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sortedAndFilteredFiles.length === 0 ? (
        <EmptyState searchQuery={searchQuery} categoryFilter={categoryFilter} />
      ) : viewMode === 'grid' ? (
        <div className="cv-file-grid cv-stagger">
          {sortedAndFilteredFiles.map((file, idx) => {
            // Calculate child items count for folders
            const childCount = file.is_folder
              ? files.filter(f => f.path.startsWith(file.path + '/') && f.path !== file.path).length
              : undefined;
            return (
              <FileCard
                key={file.id}
                file={file}
                index={idx}
                isSelected={selectedIds.has(file.id)}
                isDragOver={dragOverFolderId === file.id}
                isPinned={pinnedIds.includes(file.id)}
                folderColor={folderColors[file.id]}
                tags={fileTags[file.id]}
                childCount={childCount}
                onSelect={toggleSelect}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onToggleStar={onToggleStar}
                onHover={onFolderHover}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            );
          })}
        </div>
      ) : (
        <div className="cv-stagger">
          <div className="cv-file-list-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className={`cv-select-checkbox ${selectedIds.size > 0 && selectedIds.size === sortedAndFilteredFiles.length ? 'checked' : ''}`}
                onClick={selectedIds.size === sortedAndFilteredFiles.length ? clearSelection : selectAll}
                title={selectedIds.size === sortedAndFilteredFiles.length ? 'Batal pilih semua' : 'Pilih semua'}
                aria-label="Toggle select all"
              >
                {selectedIds.size > 0 && <Check size={11} strokeWidth={3} />}
              </button>
              <span className="cv-sortable-th" onClick={() => handleSortChange('name')}>
                Nama Berkas {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </span>
            </div>
            <span className="cv-sortable-th" onClick={() => handleSortChange('size')}>
              Ukuran {sortField === 'size' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </span>
            <span className="cv-sortable-th" onClick={() => handleSortChange('updated')}>
              Dimodifikasi {sortField === 'updated' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </span>
            <span className="cv-sortable-th" onClick={() => handleSortChange('type')}>
              Penyimpanan {sortField === 'type' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </span>
          </div>
          {sortedAndFilteredFiles.map((file, idx) => {
            const childCount = file.is_folder
              ? files.filter(f => f.path.startsWith(file.path + '/') && f.path !== file.path).length
              : undefined;
            return (
              <FileRow
                key={file.id}
                file={file}
                index={idx}
                isSelected={selectedIds.has(file.id)}
                isDragOver={dragOverFolderId === file.id}
                isPinned={pinnedIds.includes(file.id)}
                folderColor={folderColors[file.id]}
                tags={fileTags[file.id]}
                childCount={childCount}
                onSelect={toggleSelect}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onToggleStar={onToggleStar}
                onHover={onFolderHover}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            );
          })}
        </div>
      )}

      {/* Floating Batch Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="cv-batch-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#f8fafc' }}>
              {selectedIds.size} berkas dipilih
            </span>
            <button
              onClick={clearSelection}
              className="cv-btn cv-btn-ghost"
              style={{ padding: '3px 8px', fontSize: 12, height: 'auto' }}
            >
              Batal
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.2)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowMoveModal(true)}
              className="cv-btn cv-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12.5 }}
            >
              <FolderInput size={15} />
              <span>Pindahkan</span>
            </button>

            <button
              onClick={handleBatchDelete}
              className="cv-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: 12.5,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.35)',
              }}
            >
              <Trash2 size={15} />
              <span>Hapus ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Batch Move Modal */}
      {showMoveModal && (
        <div
          className="cv-modal-overlay"
          onClick={() => setShowMoveModal(false)}
          style={{ zIndex: 10020, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="cv-modal-content cv-bento-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 440, padding: 22, borderRadius: 18 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                Pindahkan {selectedIds.size} Berkas ke:
              </h3>
              <button
                onClick={() => setShowMoveModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--cv-text-tertiary)', cursor: 'pointer' }}
                aria-label="Tutup modal pindahkan"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 20 }}>
              <div
                onClick={() => setTargetMoveFolder('/')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  background: targetMoveFolder === '/' ? 'rgba(56, 189, 248, 0.15)' : 'var(--cv-bg-secondary)',
                  border: `1px solid ${targetMoveFolder === '/' ? 'var(--cv-accent)' : 'var(--cv-border)'}`,
                  color: targetMoveFolder === '/' ? 'var(--cv-accent)' : 'var(--cv-text-primary)',
                }}
              >
                <FolderOpen size={16} />
                <span>Direktori Utama (/)</span>
              </div>

              {folderOptions.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setTargetMoveFolder(f.path)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    background: targetMoveFolder === f.path ? 'rgba(56, 189, 248, 0.15)' : 'var(--cv-bg-secondary)',
                    border: `1px solid ${targetMoveFolder === f.path ? 'var(--cv-accent)' : 'var(--cv-border)'}`,
                    color: targetMoveFolder === f.path ? 'var(--cv-accent)' : 'var(--cv-text-primary)',
                  }}
                >
                  <FolderOpen size={16} />
                  <span>{f.name}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowMoveModal(false)}
                className="cv-btn cv-btn-ghost"
              >
                Batal
              </button>
              <button
                onClick={handleBatchMoveSubmit}
                className="cv-btn cv-btn-primary"
              >
                Pindahkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu with Batch 2 Enhancements */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="cv-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file.is_folder ? (
            <>
              <button className="cv-context-item" onClick={() => {
                onFolderOpen(contextMenu.file.path);
                setContextMenu(null);
              }}>
                <FolderOpen size={15} /> Buka Folder
              </button>

              {/* Batch 2: Folder Color Picker Palette */}
              <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 600, color: 'var(--cv-text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Palette size={12} /> Warna Folder:
              </div>
              <div className="cv-color-palette">
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c.color}
                    type="button"
                    className="cv-color-dot"
                    style={{
                      background: c.color,
                      borderColor: folderColors[contextMenu.file.id] === c.color ? '#ffffff' : 'transparent',
                      transform: folderColors[contextMenu.file.id] === c.color ? 'scale(1.15)' : undefined,
                    }}
                    title={c.name}
                    aria-label={`Pilih warna folder ${c.name}`}
                    onClick={() => {
                      setFolderColor(contextMenu.file.id, c.color);
                      setContextMenu(null);
                    }}
                  />
                ))}
              </div>
              <div className="cv-context-divider" />
            </>
          ) : (
            <>
              <a
                className="cv-context-item"
                href={getDownloadUrl(contextMenu.file.id)}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none' }}
                onClick={() => setContextMenu(null)}
              >
                <Download size={15} /> Unduh
              </a>
              <button className="cv-context-item" onClick={() => {
                onShare(contextMenu.file.id);
                setContextMenu(null);
              }}>
                <LinkIcon size={15} /> Bagikan Link
              </button>

              {/* Batch 2: Custom Tag / Label Selector */}
              <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 600, color: 'var(--cv-text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Tag size={12} /> Label / Tag:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 10px 8px' }}>
                {PREDEFINED_TAGS.map(t => {
                  const isAssigned = (fileTags[contextMenu.file.id] || []).includes(t.name);
                  return (
                    <button
                      key={t.name}
                      type="button"
                      className="cv-tag-badge"
                      style={{
                        background: isAssigned ? t.color : `${t.color}22`,
                        color: isAssigned ? '#ffffff' : t.color,
                        border: `1px solid ${t.color}`,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                      onClick={() => {
                        toggleFileTag(contextMenu.file.id, t.name);
                      }}
                    >
                      {isAssigned ? '✓ ' : '+ '}{t.name}
                    </button>
                  );
                })}
              </div>
              <div className="cv-context-divider" />
            </>
          )}

          {/* Batch 2: Pin / Unpin Quick Access */}
          <button className="cv-context-item" onClick={() => {
            togglePin(contextMenu.file.id);
            setContextMenu(null);
          }}>
            <Pin size={15} style={{ transform: 'rotate(45deg)' }} />
            {pinnedIds.includes(contextMenu.file.id) ? 'Lepas Sematan' : 'Sematkan ke Akses Cepat'}
          </button>

          <button className="cv-context-item" onClick={() => {
            onRename(contextMenu.file.id, contextMenu.file.name);
            setContextMenu(null);
          }}>
            <Edit2 size={15} /> Ganti Nama
          </button>

          <button className="cv-context-item" onClick={() => {
            setSelectedIds(new Set([contextMenu.file.id]));
            setShowMoveModal(true);
            setContextMenu(null);
          }}>
            <FolderInput size={15} /> Pindahkan
          </button>

          <button className="cv-context-item" onClick={() => {
            onToggleStar(contextMenu.file.id);
            setContextMenu(null);
          }}>
            <Star size={15} />
            {contextMenu.file.is_starred ? 'Hapus Bintang' : 'Beri Bintang'}
          </button>

          <div className="cv-context-divider" />

          <button className="cv-context-item danger" onClick={() => {
            onDelete(contextMenu.file.id);
            setContextMenu(null);
          }}>
            <Trash2 size={15} /> Hapus
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================
// File Card (Grid View) with Video Thumbnail, Folder Color & Tags
// ============================================================
function FileCard({
  file,
  index,
  isSelected,
  isDragOver,
  isPinned,
  folderColor,
  tags,
  childCount,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onToggleStar,
  onHover,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  file: FileRecord;
  index: number;
  isSelected: boolean;
  isDragOver: boolean;
  isPinned?: boolean;
  folderColor?: string;
  tags?: string[];
  childCount?: number;
  onSelect: (id: string) => void;
  onDoubleClick: (f: FileRecord) => void;
  onContextMenu: (e: React.MouseEvent, f: FileRecord) => void;
  onToggleStar: (id: string) => void;
  onHover?: (path: string) => void;
  onDragStart: (e: React.DragEvent, f: FileRecord) => void;
  onDragEnd?: () => void;
  onDragOver: (e: React.DragEvent, f: FileRecord) => void;
  onDragLeave: (e: React.DragEvent, f: FileRecord) => void;
  onDrop: (e: React.DragEvent, f: FileRecord) => void;
}) {
  const category = getFileCategory(file.mime_type, file.is_folder);
  const Icon = ICON_MAP[category] || File;
  const isVideo = category === 'video';
  const [thumbError, setThumbError] = useState(false);

  const customAccentColor = file.is_folder && folderColor ? folderColor : undefined;

  return (
    <div
      className={`cv-file-card cv-scroll-reveal ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{
        transitionDelay: `${Math.min((index % 12) * 35, 350)}ms`,
        borderColor: customAccentColor ? `${customAccentColor}55` : undefined,
        boxShadow: customAccentColor ? `0 4px 16px ${customAccentColor}15` : undefined,
      }}
      draggable
      onDragStart={(e) => onDragStart(e, file)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, file)}
      onDragLeave={(e) => onDragLeave(e, file)}
      onDrop={(e) => onDrop(e, file)}
      onDoubleClick={() => onDoubleClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
      onMouseEnter={() => {
        if (file.is_folder) onHover?.(file.path);
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Selection Checkbox */}
        <button
          type="button"
          className={`cv-select-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(file.id);
          }}
          title={isSelected ? 'Batal pilih' : 'Pilih berkas'}
          aria-label={isSelected ? 'Batal pilih' : 'Pilih berkas'}
        >
          {isSelected && <Check size={11} strokeWidth={3} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPinned && (
            <span
              title="Disematkan di Akses Cepat"
              style={{
                color: 'var(--cv-accent)',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: 4,
                background: 'rgba(56, 189, 248, 0.15)',
              }}
            >
              <Pin size={12} style={{ transform: 'rotate(45deg)' }} />
            </span>
          )}
          <button
            className={`cv-star-btn ${file.is_starred ? 'starred' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleStar(file.id); }}
            title={file.is_starred ? 'Hapus bintang' : 'Beri bintang'}
            aria-label={file.is_starred ? 'Hapus bintang' : 'Beri bintang'}
          >
            <Star size={14} fill={file.is_starred ? 'currentColor' : 'none'} />
          </button>
          <button
            className="cv-star-btn"
            style={{ opacity: 0.6 }}
            onClick={(e) => { e.stopPropagation(); onContextMenu(e, file); }}
            aria-label="Buka menu konteks"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* YouTube-like Video Thumbnail Preview */}
      {isVideo && !thumbError ? (
        <div className="cv-video-thumb-container">
          <img
            src={`/api/files/thumbnail?id=${file.id}`}
            alt={file.name}
            className="cv-video-thumb-img"
            loading="lazy"
            onError={() => setThumbError(true)}
          />
          <div className="cv-video-play-badge">
            <Play size={14} fill="white" style={{ marginLeft: 2 }} />
          </div>
        </div>
      ) : (
        <div
          className={`cv-file-icon-box ${category}`}
          style={{
            background: customAccentColor ? `${customAccentColor}22` : undefined,
            color: customAccentColor || undefined,
            borderColor: customAccentColor ? `${customAccentColor}55` : undefined,
          }}
        >
          <Icon size={22} />
        </div>
      )}

      <div className="cv-file-name" title={file.name}>{file.name}</div>

      {/* Tag Badges */}
      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2, marginBottom: 4 }}>
          {tags.map((t) => {
            const tagDef = PREDEFINED_TAGS.find(pt => pt.name === t);
            const tagColor = tagDef?.color || '#38bdf8';
            return (
              <span
                key={t}
                className="cv-tag-badge"
                style={{
                  background: `${tagColor}22`,
                  color: tagColor,
                  border: `1px solid ${tagColor}44`,
                }}
              >
                {t}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <span className="cv-file-meta">
          {file.is_folder ? (childCount && childCount > 0 ? `${childCount} item` : 'Folder') : formatBytes(file.size_bytes)}
        </span>
        {file.provider_id && (
          <span className={`cv-provider-badge ${file.provider_id}`}>
            {file.provider_id === 'mega' ? 'MEGA.nz' : file.provider_id === 'mediafire' ? 'MediaFire' : file.provider_id === 'backblaze' ? 'Backblaze' : file.provider_id === 'filebase' ? 'Filebase' : 'Supabase'}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// File Row (List View) with Multi-Select, Tags & Custom Color
// ============================================================
function FileRow({
  file,
  index,
  isSelected,
  isDragOver,
  isPinned,
  folderColor,
  tags,
  childCount,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onToggleStar,
  onHover,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  file: FileRecord;
  index: number;
  isSelected: boolean;
  isDragOver: boolean;
  isPinned?: boolean;
  folderColor?: string;
  tags?: string[];
  childCount?: number;
  onSelect: (id: string) => void;
  onDoubleClick: (f: FileRecord) => void;
  onContextMenu: (e: React.MouseEvent, f: FileRecord) => void;
  onToggleStar: (id: string) => void;
  onHover?: (path: string) => void;
  onDragStart: (e: React.DragEvent, f: FileRecord) => void;
  onDragEnd?: () => void;
  onDragOver: (e: React.DragEvent, f: FileRecord) => void;
  onDragLeave: (e: React.DragEvent, f: FileRecord) => void;
  onDrop: (e: React.DragEvent, f: FileRecord) => void;
}) {
  const category = getFileCategory(file.mime_type, file.is_folder);
  const Icon = ICON_MAP[category] || File;
  const customAccentColor = file.is_folder && folderColor ? folderColor : undefined;

  return (
    <div
      className={`cv-file-row cv-scroll-reveal ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ transitionDelay: `${Math.min((index % 15) * 25, 300)}ms` }}
      draggable
      onDragStart={(e) => onDragStart(e, file)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, file)}
      onDragLeave={(e) => onDragLeave(e, file)}
      onDrop={(e) => onDrop(e, file)}
      onDoubleClick={() => onDoubleClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
      onMouseEnter={() => {
        if (file.is_folder) onHover?.(file.path);
      }}
    >
      <div className="cv-file-name-col">
        <button
          type="button"
          className={`cv-select-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(file.id);
          }}
          title={isSelected ? 'Batal pilih' : 'Pilih berkas'}
          aria-label={isSelected ? 'Batal pilih' : 'Pilih berkas'}
          style={{ flexShrink: 0 }}
        >
          {isSelected && <Check size={11} strokeWidth={3} />}
        </button>

        <div
          className={`cv-file-icon-box ${category}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: customAccentColor ? `${customAccentColor}22` : undefined,
            color: customAccentColor || undefined,
            borderColor: customAccentColor ? `${customAccentColor}55` : undefined,
          }}
        >
          <Icon size={16} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span className="cv-file-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.name}
          </span>
          {isPinned && (
            <span
              title="Disematkan di Akses Cepat"
              style={{
                color: 'var(--cv-accent)',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 3px',
                borderRadius: 4,
                background: 'rgba(56, 189, 248, 0.15)',
                flexShrink: 0,
              }}
            >
              <Pin size={11} style={{ transform: 'rotate(45deg)' }} />
            </span>
          )}
          {/* Tag Badges in row */}
          {tags && tags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {tags.map((t) => {
                const tagDef = PREDEFINED_TAGS.find(pt => pt.name === t);
                const tagColor = tagDef?.color || '#38bdf8';
                return (
                  <span
                    key={t}
                    className="cv-tag-badge"
                    style={{
                      background: `${tagColor}22`,
                      color: tagColor,
                      border: `1px solid ${tagColor}44`,
                      fontSize: 9.5,
                      padding: '1px 5px',
                    }}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <button
          className={`cv-star-btn ${file.is_starred ? 'starred' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleStar(file.id); }}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          aria-label={file.is_starred ? 'Hapus bintang' : 'Beri bintang'}
        >
          <Star size={12} fill={file.is_starred ? 'currentColor' : 'none'} />
        </button>
      </div>
      <span className="cv-file-meta" style={{ fontSize: 13 }}>
        {file.is_folder ? (childCount && childCount > 0 ? `${childCount} item` : '—') : formatBytes(file.size_bytes)}
      </span>
      <span className="cv-file-meta" style={{ fontSize: 13 }}>
        {formatDate(file.updated_at)}
      </span>
      <span>
        {file.provider_id ? (
          <span className={`cv-provider-badge ${file.provider_id}`}>
            {file.provider_id === 'mega' ? 'MEGA.nz' : file.provider_id === 'mediafire' ? 'MediaFire' : file.provider_id === 'backblaze' ? 'Backblaze' : file.provider_id === 'filebase' ? 'Filebase' : 'Supabase'}
          </span>
        ) : (
          <span className="cv-file-meta">—</span>
        )}
      </span>
    </div>
  );
}

// ============================================================
// Empty State (Atmospheric Cloud)
// ============================================================
function EmptyState({ searchQuery, categoryFilter }: { searchQuery: string; categoryFilter?: string }) {
  return (
    <div className="cv-empty-state cv-scroll-reveal is-revealed">
      <div className="cv-empty-icon-wrap">
        {searchQuery ? <File size={36} /> : <CloudUpload size={36} />}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--cv-text-primary)' }}>
        {searchQuery
          ? 'Tidak ada berkas yang cocok'
          : categoryFilter && categoryFilter !== 'all'
          ? `Tidak ada berkas di kategori ${categoryFilter}`
          : 'Folder ini masih kosong'}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--cv-text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
        {searchQuery
          ? `Tidak ditemukan berkas "${searchQuery}". Periksa ejaan atau cari kata kunci lain.`
          : categoryFilter && categoryFilter !== 'all'
          ? 'Coba ganti filter kategori atau unggah berkas yang sesuai.'
          : 'Tarik & letakkan berkas ke layar ini, atau tekan tombol Unggah untuk mulai menyimpan.'}
      </div>
    </div>
  );
}
