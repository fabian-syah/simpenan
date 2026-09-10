import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileRecord } from '../../types';
import { getFileCategory, formatBytes, formatDate } from '../../types';
import { getDownloadUrl } from '../../lib/api';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  Image, Video, Music, FileText, Table2, Presentation,
  FileType, Archive, Code, File, Star, MoreVertical, Download,
  Edit2, Link as LinkIcon, FolderOpen, Trash2, CloudUpload,
  Check, Play, FolderInput, X
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

  // Filter files by search query
  const filteredFiles = searchQuery
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  // Silky 60fps Scroll Reveal observer
  useScrollReveal([filteredFiles, viewMode]);

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
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  }, [filteredFiles]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
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

  if (filteredFiles.length === 0) {
    return <EmptyState searchQuery={searchQuery} />;
  }

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="cv-file-grid cv-stagger">
          {filteredFiles.map((file, idx) => (
            <FileCard
              key={file.id}
              file={file}
              index={idx}
              isSelected={selectedIds.has(file.id)}
              isDragOver={dragOverFolderId === file.id}
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
          ))}
        </div>
      ) : (
        <div className="cv-stagger">
          <div className="cv-file-list-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className={`cv-select-checkbox ${selectedIds.size > 0 && selectedIds.size === filteredFiles.length ? 'checked' : ''}`}
                onClick={selectedIds.size === filteredFiles.length ? clearSelection : selectAll}
                title={selectedIds.size === filteredFiles.length ? 'Batal pilih semua' : 'Pilih semua'}
                aria-label="Toggle select all"
              >
                {selectedIds.size > 0 && <Check size={11} strokeWidth={3} />}
              </button>
              <span>Nama Berkas</span>
            </div>
            <span>Ukuran</span>
            <span>Dimodifikasi</span>
            <span>Penyimpanan</span>
          </div>
          {filteredFiles.map((file, idx) => (
            <FileRow
              key={file.id}
              file={file}
              index={idx}
              isSelected={selectedIds.has(file.id)}
              isDragOver={dragOverFolderId === file.id}
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
          ))}
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="cv-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file.is_folder ? (
            <button className="cv-context-item" onClick={() => {
              onFolderOpen(contextMenu.file.path);
              setContextMenu(null);
            }}>
              <FolderOpen size={15} /> Open Folder
            </button>
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
                <Download size={15} /> Download
              </a>
              <button className="cv-context-item" onClick={() => {
                onShare(contextMenu.file.id);
                setContextMenu(null);
              }}>
                <LinkIcon size={15} /> Get Share Link
              </button>
            </>
          )}
          <button className="cv-context-item" onClick={() => {
            onRename(contextMenu.file.id, contextMenu.file.name);
            setContextMenu(null);
          }}>
            <Edit2 size={15} /> Rename
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
            {contextMenu.file.is_starred ? 'Remove Star' : 'Add Star'}
          </button>
          <div className="cv-context-divider" />
          <button className="cv-context-item danger" onClick={() => {
            onDelete(contextMenu.file.id);
            setContextMenu(null);
          }}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================
// File Card (Grid View) with Video Thumbnail & Drag & Drop
// ============================================================
function FileCard({
  file,
  index,
  isSelected,
  isDragOver,
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

  return (
    <div
      className={`cv-file-card cv-scroll-reveal ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ transitionDelay: `${Math.min((index % 12) * 35, 350)}ms` }}
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

        <div style={{ display: 'flex', gap: 2 }}>
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
        <div className={`cv-file-icon-box ${category}`}>
          <Icon size={22} />
        </div>
      )}

      <div className="cv-file-name" title={file.name}>{file.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <span className="cv-file-meta">
          {file.is_folder ? 'Folder' : formatBytes(file.size_bytes)}
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
// File Row (List View) with Multi-Select & Drag & Drop
// ============================================================
function FileRow({
  file,
  index,
  isSelected,
  isDragOver,
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

        <div className={`cv-file-icon-box ${category}`} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}>
          <Icon size={16} />
        </div>
        <span className="cv-file-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file.name}
        </span>
        <button
          className={`cv-star-btn ${file.is_starred ? 'starred' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleStar(file.id); }}
          style={{ marginLeft: 4 }}
          aria-label={file.is_starred ? 'Hapus bintang' : 'Beri bintang'}
        >
          <Star size={12} fill={file.is_starred ? 'currentColor' : 'none'} />
        </button>
      </div>
      <span className="cv-file-meta" style={{ fontSize: 13 }}>
        {file.is_folder ? '—' : formatBytes(file.size_bytes)}
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
function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="cv-empty-state cv-scroll-reveal is-revealed">
      <div className="cv-empty-icon-wrap">
        {searchQuery ? <File size={36} /> : <CloudUpload size={36} />}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--cv-text-primary)' }}>
        {searchQuery ? 'Tidak ada berkas yang cocok' : 'Folder ini masih kosong'}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--cv-text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
        {searchQuery
          ? `Tidak ditemukan berkas "${searchQuery}". Periksa ejaan atau cari kata kunci lain.`
          : 'Tarik & letakkan berkas ke layar ini, atau tekan tombol Unggah untuk mulai menyimpan.'}
      </div>
    </div>
  );
}
