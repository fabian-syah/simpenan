import { X, Check, AlertCircle, Loader } from 'lucide-react';
import type { UploadTask } from '../../types';
import { formatBytes } from '../../types';

interface UploadManagerProps {
  uploads: UploadTask[];
  onClearCompleted: () => void;
  onRemove: (id: string) => void;
}

export function UploadManager({ uploads, onClearCompleted, onRemove }: UploadManagerProps) {
  if (uploads.length === 0) return null;

  const activeCount = uploads.filter(u =>
    u.status === 'queued' || u.status === 'requesting' || u.status === 'uploading' || u.status === 'completing'
  ).length;
  const completedCount = uploads.filter(u => u.status === 'complete').length;

  return (
    <div className="cv-upload-panel">
      <div className="cv-upload-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeCount > 0 ? (
            <>
              <div className="cv-spinner" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
                Uploading {activeCount} file{activeCount > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
              {completedCount} upload{completedCount > 1 ? 's' : ''} complete
            </span>
          )}
        </div>
        {completedCount > 0 && activeCount === 0 && (
          <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={onClearCompleted} title="Clear">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="cv-upload-panel-list">
        {uploads.map(upload => (
          <UploadItem key={upload.id} upload={upload} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function UploadItem({ upload, onRemove }: { upload: UploadTask; onRemove: (id: string) => void }) {
  const statusText = (() => {
    switch (upload.status) {
      case 'queued': return 'Queued';
      case 'requesting': return 'Getting upload ticket...';
      case 'uploading': return `${upload.progress}% · ${formatBytes(upload.speed)}/s`;
      case 'completing': return 'Finalizing...';
      case 'complete': return 'Complete';
      case 'failed': return upload.error || 'Failed';
    }
  })();

  const progressClass = upload.status === 'complete' ? 'complete'
    : upload.status === 'failed' ? 'failed'
    : 'uploading';

  return (
    <div className="cv-upload-item">
      <div className="cv-upload-item-header">
        <span className="cv-upload-item-name">{upload.fileName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {upload.provider && (
            <span className={`cv-provider-badge ${upload.provider}`}>
              {upload.provider === 'gdrive' ? 'Google Drive' : upload.provider === 'mega' ? 'MEGA.nz' : upload.provider === 'mediafire' ? 'MediaFire' : upload.provider === 'backblaze' ? 'Backblaze' : upload.provider === 'filebase' ? 'Filebase' : 'Supabase'}
            </span>
          )}
          {upload.status === 'complete' && <Check size={14} style={{ color: 'var(--cv-success)' }} />}
          {upload.status === 'failed' && (
            <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={() => onRemove(upload.id)} style={{ padding: 2 }}>
              <AlertCircle size={14} style={{ color: 'var(--cv-error)' }} />
            </button>
          )}
          {(upload.status === 'requesting' || upload.status === 'completing') && (
            <Loader size={14} style={{ color: 'var(--cv-accent)', animation: 'cv-spin 1s linear infinite' }} />
          )}
        </div>
      </div>
      <div className="cv-progress-bar">
        <div
          className={`cv-progress-fill ${progressClass}`}
          style={{ width: `${upload.progress}%` }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--cv-text-tertiary)' }}>{statusText}</span>
        <span style={{ fontSize: 11, color: 'var(--cv-text-tertiary)' }}>{formatBytes(upload.fileSize)}</span>
      </div>
    </div>
  );
}
