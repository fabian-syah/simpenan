import { useState } from 'react';
import { Search, LayoutGrid, List, Menu, ChevronRight, Sun, Moon, Monitor, Layers, HardDrive, MessageSquarePlus } from 'lucide-react';
import type { Theme } from '../../hooks/useTheme';
import type { StorageProvider, TargetStorageOption } from '../../types';

interface HeaderProps {
  breadcrumbs: { name: string; path: string }[];
  onNavigate: (path: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onMenuClick: () => void;
  targetProvider?: TargetStorageOption;
  onTargetProviderChange?: (provider: TargetStorageOption) => void;
  providers?: StorageProvider[];
  onOpenManageStorage?: () => void;
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
  onOpenFeedback?: () => void;
}

export function Header({
  breadcrumbs,
  onNavigate,
  viewMode,
  onViewModeChange,
  theme,
  onThemeChange,
  searchQuery,
  onSearchChange,
  onMenuClick,
  targetProvider = 'auto',
  onTargetProviderChange,
  providers,
  onOpenManageStorage,
  onMoveFiles,
  onOpenFeedback,
}: HeaderProps) {
  const [dragOverCrumbPath, setDragOverCrumbPath] = useState<string | null>(null);

  return (
    <header className="cv-header cv-bento-card">
      <div className="cv-header-left">
        {/* Mobile hamburger */}
        <button className="cv-mobile-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} />
        </button>

        {/* Breadcrumbs with Drop-to-Move Target Support */}
        <nav className="cv-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            const isDragTarget = dragOverCrumbPath === crumb.path;
            return (
              <span key={crumb.path} className="cv-breadcrumb-item">
                {i > 0 && <ChevronRight size={14} style={{ color: 'var(--cv-text-tertiary)' }} />}
                {isLast ? (
                  <span className="cv-breadcrumb-current">{crumb.name}</span>
                ) : (
                  <button
                    className={`cv-breadcrumb-link ${isDragTarget ? 'drag-target-active' : ''}`}
                    onClick={() => onNavigate(crumb.path)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverCrumbPath !== crumb.path) {
                        setDragOverCrumbPath(crumb.path);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverCrumbPath === crumb.path) {
                        setDragOverCrumbPath(null);
                      }
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverCrumbPath(null);
                      const droppedId = e.dataTransfer.getData('application/x-simpenan-file') || e.dataTransfer.getData('text/plain');
                      if (!droppedId || !onMoveFiles) return;
                      try {
                        await onMoveFiles([droppedId], crumb.path);
                      } catch (err) {
                        console.error('Failed to move to breadcrumb path:', err);
                      }
                    }}
                    title={isDragTarget ? `Lepas untuk pindahkan ke ${crumb.name}` : undefined}
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <div className="cv-header-right" style={{ flex: 1, justifyContent: 'flex-end', gap: 10 }}>
        {/* Search */}
        <div className="cv-search-wrapper">
          <Search size={16} className="cv-search-icon" />
          <input
            id="search-input"
            type="text"
            className="cv-search-input"
            placeholder="Search in Drive"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Target Storage Selector (Desktop Header, Clean & Emoji-free) */}
        {onTargetProviderChange && (
          <div className="cv-storage-select-wrapper cv-desktop-only" title="Target cloud storage backend for uploads">
            <Layers size={14} style={{ color: 'var(--cv-accent)' }} />
            <select
              value={targetProvider}
              onChange={(e) => onTargetProviderChange(e.target.value as TargetStorageOption)}
              className="cv-storage-select"
              aria-label="Select storage backend"
            >
              <option value="auto">Auto (Balanced)</option>
              {providers && providers.length > 0 ? (
                providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))
              ) : (
                <>
                  <option value="gdrive">Google Drive (5 TB)</option>
                  <option value="mega">MEGA.nz (20 GB)</option>
                  <option value="backblaze">Backblaze B2 (10 GB)</option>
                  <option value="mediafire">MediaFire (10 GB)</option>
                  <option value="filebase">Filebase (Max 25MB Video)</option>
                  <option value="supabase">Supabase (Max 50MB)</option>
                </>
              )}
            </select>
            {onOpenManageStorage && (
              <button
                type="button"
                onClick={onOpenManageStorage}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--cv-text-tertiary)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: 2,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cv-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cv-text-tertiary)')}
                title="Kelola & Tambah Akun Cloud Storage"
              >
                <HardDrive size={14} />
              </button>
            )}
          </div>
        )}

        {/* View toggle */}
        <div className="cv-toggle-group">
          <button
            className={`cv-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
            aria-label="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`cv-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List view"
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>

        {/* Theme toggle */}
        <div className="cv-toggle-group cv-desktop-only">
          <button
            className={`cv-toggle-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => onThemeChange('light')}
            title="Light theme"
            aria-label="Light theme"
          >
            <Sun size={16} />
          </button>
          <button
            className={`cv-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => onThemeChange('dark')}
            title="Dark theme"
            aria-label="Dark theme"
          >
            <Moon size={16} />
          </button>
          <button
            className={`cv-toggle-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => onThemeChange('system')}
            title="System theme"
            aria-label="System theme"
          >
            <Monitor size={16} />
          </button>
        </div>

        {/* Beta Feedback Button */}
        {onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            className="cv-btn cv-desktop-only"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Kirim Feedback & Laporan Isu Beta"
          >
            <MessageSquarePlus size={14} />
            <span>Feedback</span>
          </button>
        )}
      </div>
    </header>
  );
}
