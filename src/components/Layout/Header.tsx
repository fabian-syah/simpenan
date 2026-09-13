import { useState } from 'react';
import { Search, LayoutGrid, List, Menu, ChevronRight, Sun, Moon, Monitor, MessageSquarePlus } from 'lucide-react';
import type { Theme } from '../../hooks/useTheme';
import type { UserQuota } from '../../types';
import { User, LogIn, LogOut, Zap } from 'lucide-react';

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
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
  onOpenFeedback?: () => void;
  user?: any | null;
  userQuota?: UserQuota | null;
  onOpenAuth?: () => void;
  onOpenUpgrade?: () => void;
  onLogout?: () => void;
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
  onMoveFiles,
  onOpenFeedback,
  user,
  userQuota,
  onOpenAuth,
  onOpenUpgrade,
  onLogout,
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

      <div className="cv-header-right" style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Search */}
        <div className="cv-search-wrapper">
          <Search size={16} className="cv-search-icon" />
          <input
            id="search-input"
            type="text"
            className="cv-search-input"
            placeholder="Cari berkas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

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

        {/* Theme toggle (Desktop Large Only) */}
        <div className="cv-toggle-group cv-header-extra">
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

        {/* Beta Feedback Button (Desktop Large Only) */}
        {onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            className="cv-btn cv-header-extra"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--cv-accent-muted)',
              border: '1px solid var(--cv-border)',
              color: 'var(--cv-accent)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Kirim Feedback & Laporan Isu Beta"
          >
            <MessageSquarePlus size={14} />
            <span>Feedback</span>
          </button>
        )}

        {/* Upgrade Button - Responsive Pill */}
        {onOpenUpgrade && (
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="cv-header-upgrade-btn"
            title="Upgrade Kapasitas Penyimpanan"
          >
            <Zap size={14} fill="currentColor" />
            <span className="cv-header-upgrade-text">Upgrade</span>
          </button>
        )}

        {/* User Account / Auth */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              className="cv-desktop-only"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                backgroundColor: 'var(--cv-bg-tertiary)',
                border: '1px solid var(--cv-border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--cv-text-primary)',
              }}
            >
              <User size={13} style={{ color: 'var(--cv-text-secondary)' }} />
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email?.split('@')[0]}
              </span>
              {userQuota && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: userQuota.tier === 'founder' ? 'var(--cv-accent-muted)' : 'var(--cv-bg-secondary)',
                    color: userQuota.tier === 'founder' ? 'var(--cv-accent)' : 'var(--cv-text-secondary)',
                    border: '1px solid var(--cv-border)',
                  }}
                >
                  {userQuota.tier === 'founder' ? 'Lifetime' : userQuota.tier}
                </span>
              )}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="cv-header-logout-btn"
                title="Keluar dari Akun"
              >
                <LogOut size={14} />
                <span className="cv-desktop-only">Keluar</span>
              </button>
            )}
          </div>
        ) : (
          onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: '#0284c7',
                border: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <LogIn size={14} />
              <span className="cv-desktop-only">Masuk / Daftar</span>
              <span className="cv-mobile-only">Masuk</span>
            </button>
          )
        )}
      </div>
    </header>
  );
}
