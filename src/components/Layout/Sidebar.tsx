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
} from 'lucide-react';
import type { TargetStorageOption } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNewClick: () => void;
  onUploadClick: () => void;
  quotaElement?: ReactNode;
  targetProvider?: TargetStorageOption;
  onTargetProviderChange?: (provider: TargetStorageOption) => void;
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
}

const NAV_ITEMS = [
  { id: 'drive', label: 'My Drive', icon: HardDrive },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export function Sidebar({
  isOpen,
  activeSection,
  onSectionChange,
  onNewClick,
  onUploadClick,
  quotaElement,
  targetProvider = 'auto',
  onTargetProviderChange,
  onMoveFiles,
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

        {/* Target Storage Selector (Clean, No Emojis) */}
        {onTargetProviderChange && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--cv-text-tertiary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Layers size={12} style={{ color: 'var(--cv-accent)' }} />
              <span>Target Storage</span>
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
              <option value="mega">MEGA.nz (20 GB)</option>
              <option value="backblaze">Backblaze B2 (10 GB)</option>
              <option value="mediafire">MediaFire (10 GB)</option>
              <option value="filebase">Filebase IPFS (5 GB - Max 25MB Video)</option>
              <option value="supabase">Supabase Storage (1 GB - Max 50MB)</option>
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
              title={isDriveTarget ? 'Lepas untuk pindahkan ke My Drive (Root)' : undefined}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quota */}
      {quotaElement}
    </aside>
  );
}
