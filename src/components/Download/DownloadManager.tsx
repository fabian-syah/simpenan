import { X, Check, AlertCircle, Archive } from 'lucide-react';
import type { DownloadTask } from '../../hooks/useDownload';

interface DownloadManagerProps {
  downloads: DownloadTask[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DownloadManager({ downloads, onCancel, onRemove }: DownloadManagerProps) {
  if (downloads.length === 0) return null;

  const activeCount = downloads.filter(d =>
    d.status === 'downloading' || d.status === 'zipping'
  ).length;

  return (
    <div className="cv-upload-panel" style={{ bottom: 80 }}>
      <div className="cv-upload-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeCount > 0 ? (
            <>
              <div className="cv-spinner" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
                Downloading {activeCount} ZIP{activeCount > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
              Downloads complete
            </span>
          )}
        </div>
      </div>
      <div className="cv-upload-panel-list">
        {downloads.map(dl => (
          <DownloadItem key={dl.id} download={dl} onCancel={onCancel} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function DownloadItem({ download, onCancel, onRemove }: { download: DownloadTask; onCancel: (id: string) => void; onRemove: (id: string) => void }) {
  const statusText = (() => {
    switch (download.status) {
      case 'downloading': return `${download.completedFiles}/${download.totalFiles} files · ${download.progress}%`;
      case 'zipping': return 'Creating ZIP...';
      case 'complete': return 'Download complete';
      case 'cancelled': return 'Cancelled';
      case 'failed': return download.error || 'Failed';
    }
  })();

  const progressClass = download.status === 'complete' ? 'complete'
    : download.status === 'failed' || download.status === 'cancelled' ? 'failed'
    : 'uploading';

  return (
    <div className="cv-upload-item">
      <div className="cv-upload-item-header">
        <span className="cv-upload-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Archive size={13} style={{ color: 'var(--cv-accent)', flexShrink: 0 }} />
          {download.zipName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {download.status === 'complete' && <Check size={14} style={{ color: 'var(--cv-success)' }} />}
          {download.status === 'failed' && (
            <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={() => onRemove(download.id)} style={{ padding: 2 }}>
              <AlertCircle size={14} style={{ color: 'var(--cv-error)' }} />
            </button>
          )}
          {(download.status === 'downloading' || download.status === 'zipping') && (
            <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={() => onCancel(download.id)} style={{ padding: 2 }} title="Cancel">
              <X size={14} style={{ color: 'var(--cv-text-secondary)' }} />
            </button>
          )}
        </div>
      </div>
      <div className="cv-progress-bar">
        <div className={`cv-progress-fill ${progressClass}`} style={{ width: `${download.progress}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--cv-text-tertiary)' }}>{statusText}</span>
        <span style={{ fontSize: 11, color: 'var(--cv-text-tertiary)' }}>{download.currentFile}</span>
      </div>
    </div>
  );
}
