import { X, Check, AlertCircle, Loader, RotateCw, History, Settings } from 'lucide-react';
import { useState } from 'react';
import type { UploadTask } from '../../types';
import { formatBytes, formatETA } from '../../types';
import { getSpeedLimit, setSpeedLimit, getSpeedLimitPresets } from '../../lib/throttle';

interface UploadManagerProps {
  uploads: UploadTask[];
  onClearCompleted: () => void;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onShowHistory?: () => void;
}

export function UploadManager({ uploads, onClearCompleted, onRemove, onRetry, onShowHistory }: UploadManagerProps) {
  const [showThrottle, setShowThrottle] = useState(false);
  const [throttle, setThrottle] = useState(getSpeedLimit);

  if (uploads.length === 0 && !showThrottle) return null;

  const activeCount = uploads.filter(u =>
    u.status === 'queued' || u.status === 'requesting' || u.status === 'uploading' || u.status === 'completing'
  ).length;
  const completedCount = uploads.filter(u => u.status === 'complete').length;

  // Aggregate progress for header
  const totalBytes = uploads.reduce((sum, u) => sum + u.fileSize, 0);
  const uploadedBytes = uploads.reduce((sum, u) => sum + (u.fileSize * u.progress / 100), 0);
  const totalProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="cv-upload-panel">
      <div className="cv-upload-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          {activeCount > 0 ? (
            <>
              <div className="cv-spinner" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
                Uploading {activeCount} file{activeCount > 1 ? 's' : ''} · {totalProgress}%
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cv-text-primary)' }}>
              {completedCount} upload{completedCount > 1 ? 's' : ''} complete
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onShowHistory && (
            <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={onShowHistory} title="Upload History" style={{ padding: 4 }}>
              <History size={14} />
            </button>
          )}
          <button
            className="cv-btn cv-btn-ghost cv-btn-icon"
            onClick={() => setShowThrottle(!showThrottle)}
            title="Bandwidth Limit"
            style={{ padding: 4 }}
          >
            <Settings size={14} style={{ color: throttle > 0 ? 'var(--cv-accent)' : undefined }} />
          </button>
          {completedCount > 0 && activeCount === 0 && (
            <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={onClearCompleted} title="Clear" style={{ padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bandwidth Throttle Setting */}
      {showThrottle && (
        <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--cv-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Batas Kecepatan Upload
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {getSpeedLimitPresets().map(preset => (
              <button
                key={preset.value}
                onClick={() => {
                  setSpeedLimit(preset.value);
                  setThrottle(preset.value);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--cv-border)',
                  background: throttle === preset.value ? 'var(--cv-accent)' : 'var(--cv-bg-tertiary)',
                  color: throttle === preset.value ? '#fff' : 'var(--cv-text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cv-upload-panel-list">
        {uploads.map(upload => (
          <UploadItem key={upload.id} upload={upload} onRemove={onRemove} onRetry={onRetry} />
        ))}
      </div>
    </div>
  );
}

function UploadItem({ upload, onRemove, onRetry }: { upload: UploadTask; onRemove: (id: string) => void; onRetry?: (id: string) => void }) {
  const etaStr = upload.eta ? formatETA(upload.eta) : '';

  const statusText = (() => {
    switch (upload.status) {
      case 'queued': return 'Queued';
      case 'requesting': return 'Getting upload ticket...';
      case 'uploading': {
        const parts = [`${upload.progress}%`];
        if (upload.speed > 0) parts.push(`${formatBytes(upload.speed)}/s`);
        if (etaStr) parts.push(etaStr);
        if (upload.isRetrying) parts.push(`retry ${upload.retryCount}/${upload.maxRetries}`);
        return parts.join(' · ');
      }
      case 'completing': return 'Finalizing...';
      case 'complete': return 'Complete';
      case 'failed': return upload.error || 'Failed';
      default: return String(upload.status || '');
    }
  })();

  const progressClass = upload.status === 'complete' ? 'complete'
    : upload.status === 'failed' ? 'failed'
    : 'uploading';

  return (
    <div className="cv-upload-item">
      <div className="cv-upload-item-header">
        <span className="cv-upload-item-name">
          {upload.relativePath || upload.fileName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {upload.status === 'complete' && <Check size={14} style={{ color: 'var(--cv-success)' }} />}
          {upload.status === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {onRetry && (
                <button
                  className="cv-btn cv-btn-ghost cv-btn-icon"
                  onClick={() => onRetry(upload.id)}
                  style={{ padding: 2 }}
                  title="Retry upload"
                >
                  <RotateCw size={13} style={{ color: 'var(--cv-accent)' }} />
                </button>
              )}
              <button className="cv-btn cv-btn-ghost cv-btn-icon" onClick={() => onRemove(upload.id)} style={{ padding: 2 }}>
                <AlertCircle size={14} style={{ color: 'var(--cv-error)' }} />
              </button>
            </div>
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
