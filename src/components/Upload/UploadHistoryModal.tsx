import { Trash2, CheckCircle, XCircle, History, Search } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../UI/Modal';
import type { UploadHistoryEntry } from '../../hooks/useUploadHistory';
import { formatBytes, formatDate, formatProviderName } from '../../types';

interface UploadHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: UploadHistoryEntry[];
  onClear: () => void;
}

export function UploadHistoryModal({ isOpen, onClose, history, onClear }: UploadHistoryModalProps) {
  const [filter, setFilter] = useState<'all' | 'complete' | 'failed'>('all');
  const [search, setSearch] = useState('');

  const filtered = history.filter(entry => {
    if (filter === 'complete' && entry.status !== 'complete') return false;
    if (filter === 'failed' && entry.status !== 'failed') return false;
    if (search && !entry.fileName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload History">
      <div style={{ padding: '0 20px 20px', minHeight: 200, maxHeight: '65vh', display: 'flex', flexDirection: 'column' }}>
        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1,
            minWidth: 160,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            borderRadius: 10,
            border: '1px solid var(--cv-border)',
            background: 'var(--cv-bg-tertiary)',
          }}>
            <Search size={14} style={{ color: 'var(--cv-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari berkas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12.5,
                color: 'var(--cv-text-primary)',
                width: '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'complete', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--cv-border)',
                  background: filter === f ? 'var(--cv-accent)' : 'var(--cv-bg-tertiary)',
                  color: filter === f ? '#fff' : 'var(--cv-text-secondary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f === 'all' ? 'Semua' : f === 'complete' ? 'Sukses' : 'Gagal'}
              </button>
            ))}
          </div>
        </div>

        {/* History List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--cv-text-tertiary)',
              fontSize: 13,
            }}>
              <History size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <div>Belum ada riwayat upload</div>
            </div>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--cv-border)',
                  background: 'var(--cv-bg-secondary)',
                }}
              >
                {entry.status === 'complete' ? (
                  <CheckCircle size={16} style={{ color: 'var(--cv-success)', flexShrink: 0 }} />
                ) : (
                  <XCircle size={16} style={{ color: 'var(--cv-error)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'var(--cv-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {entry.fileName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--cv-text-tertiary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{formatBytes(entry.fileSize)}</span>
                    <span>·</span>
                    <span>{formatProviderName(entry.provider)}</span>
                    {entry.averageSpeed > 0 && (
                      <>
                        <span>·</span>
                        <span>{formatBytes(entry.averageSpeed)}/s</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--cv-text-tertiary)', flexShrink: 0, textAlign: 'right' }}>
                  {formatDate(entry.completedAt)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clear Button */}
        {history.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onClear}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid var(--cv-border)',
                background: 'var(--cv-bg-tertiary)',
                color: 'var(--cv-error)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              Hapus Riwayat
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
