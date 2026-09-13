import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  HardDrive,
  Clock,
  Star,
  Trash2,
  Cloud,
  FolderPlus,
  UploadCloud,
  Layers,
  X,
  Sun,
  Moon,
  Monitor,
  MessageSquarePlus,
  ShieldCheck,
} from 'lucide-react';
import type { StorageProvider, TargetStorageOption } from '../../types';
import type { Theme } from '../../hooks/useTheme';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNewClick: () => void;
  onUploadClick: () => void;
  quotaElement?: ReactNode;
  targetProvider?: TargetStorageOption;
  onTargetProviderChange?: (provider: TargetStorageOption) => void;
  providers?: StorageProvider[];
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  onOpenFeedback?: () => void;
  onOpenLegal?: () => void;
  isSuperAdmin?: boolean;
}

const NAV_ITEMS = [
  { id: 'drive', label: 'Simpenan Saya', icon: HardDrive },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export function Sidebar({
  isOpen,
  onClose,
  activeSection,
  onSectionChange,
  onNewClick,
  onUploadClick,
  quotaElement,
  targetProvider = 'auto',
  onTargetProviderChange,
  providers,
  onMoveFiles,
  theme,
  onThemeChange,
  onOpenFeedback,
  onOpenLegal,
  isSuperAdmin = false,
}: SidebarProps) {
  const [dragOverDrive, setDragOverDrive] = useState(false);

  return (
    <aside className={`cv-sidebar cv-bento-card ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="cv-sidebar-logo">
        <div className="cv-sidebar-logo-icon">
          <Cloud size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="cv-logo-title">
            <span>Simpenan</span>
            <span className="cv-logo-badge">Cloud</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--cv-text-tertiary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cv-success)', display: 'inline-block' }} />
            <span>Multi-Cloud Sync</span>
          </div>
        </div>
        {onClose && (
          <button
            className="cv-mobile-only"
            onClick={onClose}
            aria-label="Tutup menu"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cv-text-secondary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="cv-sidebar-actions">
        <button className="cv-btn cv-btn-new" onClick={onNewClick}>
          <FolderPlus size={16} />
          <span>New Folder</span>
        </button>
        <button
          className="cv-btn cv-btn-secondary"
          style={{ justifyContent: 'center', width: '100%', height: 40 }}
          onClick={onUploadClick}
        >
          <UploadCloud size={16} style={{ color: 'var(--cv-accent)' }} />
          <span>Upload Files</span>
        </button>

        {/* Target Storage Selector (Admin Only) */}
        {isSuperAdmin && onTargetProviderChange && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--cv-text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Layers size={12} style={{ color: 'var(--cv-accent)' }} />
              <span>Storage Server (Admin)</span>
            </div>
            <select
              value={targetProvider}
              onChange={(e) => onTargetProviderChange(e.target.value as TargetStorageOption)}
              className="cv-storage-select"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12.5,
                borderRadius: 'var(--cv-radius-md)',
                border: '1px solid var(--cv-border)',
                background: 'var(--cv-bg-tertiary)',
                color: 'var(--cv-text-primary)',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              title="Select cloud storage backend for uploads"
            >
              <option value="auto">Auto (Smart Balanced)</option>
              {providers && providers.length > 0 ? (
                providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name?.replace(/Google Drive/gi, 'Simpenan Cloud')}
                  </option>
                ))
              ) : (
                <>
                  <option value="gdrive">Simpenan Cloud #1 (5 TB)</option>
                  <option value="mega">Simpenan Vault (20 GB)</option>
                  <option value="backblaze">Simpenan B2 (10 GB)</option>
                  <option value="mediafire">Simpenan Fast (10 GB)</option>
                </>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Navigation with Drop Target on My Drive */}
      <nav className="cv-sidebar-nav">
        <div className="cv-sidebar-section-label">Navigation</div>
        {NAV_ITEMS.map(item => {
          const isDriveTarget = item.id === 'drive' && dragOverDrive;
          return (
            <button
              key={item.id}
              className={`cv-sidebar-item ${activeSection === item.id ? 'active' : ''} ${isDriveTarget ? 'drag-over' : ''}`}
              onClick={() => onSectionChange(item.id)}
              onDragOver={(e) => {
                if (item.id !== 'drive') return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setDragOverDrive(true);
              }}
              onDragLeave={(e) => {
                if (item.id !== 'drive') return;
                e.preventDefault();
                e.stopPropagation();
                setDragOverDrive(false);
              }}
              onDrop={async (e) => {
                if (item.id !== 'drive') return;
                e.preventDefault();
                e.stopPropagation();
                setDragOverDrive(false);
                const droppedId = e.dataTransfer.getData('application/x-simpenan-file') || e.dataTransfer.getData('text/plain');
                if (!droppedId || !onMoveFiles) return;
                try {
                  await onMoveFiles([droppedId], '/');
                } catch (err) {
                  console.error('Failed to move to My Drive via sidebar:', err);
                }
              }}
              title={isDriveTarget ? 'Lepas untuk pindahkan ke Simpenan Saya (Root)' : undefined}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quota Section */}
      <div style={{ padding: '8px 14px 0' }}>
        {quotaElement}
      </div>

      {/* Utility Action Buttons (Beta Feedback & Legal Terms) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px' }}>
        {onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              background: 'var(--cv-accent-muted)',
              border: '1px solid var(--cv-border)',
              color: 'var(--cv-accent)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Laporkan bug, saran, atau kendala kuota selama beta testing"
          >
            <MessageSquarePlus size={15} />
            <span>Kirim Feedback Beta</span>
          </button>
        )}

        {onOpenLegal && (
          <button
            type="button"
            onClick={onOpenLegal}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid var(--cv-border)',
              color: 'var(--cv-text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Ketentuan Layanan, Kebijakan Anti-Bajakan (DMCA), dan Kebijakan Privasi"
          >
            <ShieldCheck size={15} style={{ color: 'var(--cv-accent)' }} />
            <span>Ketentuan & Privasi</span>
          </button>
        )}
      </div>

      {/* Theme Switcher in Drawer & Sidebar */}
      {onThemeChange && theme && (
        <div className="cv-sidebar-theme-section">
          <div className="cv-sidebar-theme-header">
            <span className="cv-sidebar-theme-title">Tema Tampilan</span>
            <span className="cv-sidebar-theme-current">
              {theme === 'light' ? 'Terang' : theme === 'dark' ? 'Gelap' : 'Sistem'}
            </span>
          </div>

          <div className="cv-theme-segmented" role="radiogroup" aria-label="Pilihan tema">
            <button
              type="button"
              className={`cv-theme-segment-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
              role="radio"
              aria-checked={theme === 'light'}
              title="Mode Terang"
            >
              <Sun size={14} className="cv-theme-icon" />
              <span>Terang</span>
            </button>

            <button
              type="button"
              className={`cv-theme-segment-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
              role="radio"
              aria-checked={theme === 'dark'}
              title="Mode Gelap"
            >
              <Moon size={14} className="cv-theme-icon" />
              <span>Gelap</span>
            </button>

            <button
              type="button"
              className={`cv-theme-segment-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => onThemeChange('system')}
              role="radio"
              aria-checked={theme === 'system'}
              title="Ikuti Tema Sistem Perangkat"
            >
              <Monitor size={14} className="cv-theme-icon" />
              <span>Sistem</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
