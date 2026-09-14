// ============================================================
// AudioQueueDrawer Component
// Modern playlist & queue manager with reordering and dynamic indicators
// ============================================================
import {
  ListMusic, X, Trash2, ArrowUp, ArrowDown,
  Music, Volume2, Shuffle
} from 'lucide-react';
import type { FileRecord } from '../../types';
import { formatBytes } from '../../types';

interface AudioQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: FileRecord[];
  currentIndex: number;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onMoveTrack: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
}

export function AudioQueueDrawer({
  isOpen,
  onClose,
  queue,
  currentIndex,
  isPlaying,
  onSelectTrack,
  onRemoveTrack,
  onMoveTrack,
  onClearQueue,
  onShuffleQueue,
}: AudioQueueDrawerProps) {
  if (!isOpen) return null;

  const currentTrack = queue[currentIndex] || null;

  return (
    <div className="cv-audio-queue-panel">
      {/* Header */}
      <div className="cv-audio-queue-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <ListMusic size={17} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc' }}>
              Antrean & Daftar Putar
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {queue.length} Lagu Tersedia
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {queue.length > 1 && (
            <button
              onClick={onShuffleQueue}
              className="cv-queue-action-btn"
              title="Acak Susunan Antrean"
            >
              <Shuffle size={14} />
              <span>Acak</span>
            </button>
          )}

          {queue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="cv-queue-action-btn danger"
              title="Kosongkan Antrean"
            >
              <Trash2 size={14} />
              <span>Kosongkan</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="cv-queue-close-btn"
            title="Tutup Panel Antrean"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Currently Playing Card */}
      {currentTrack && (
        <div className="cv-audio-queue-current">
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Sedang Diputar
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(56, 189, 248, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              {isPlaying ? (
                <div className="cv-equalizer-bars">
                  <span className="cv-eq-bar bar-1" />
                  <span className="cv-eq-bar bar-2" />
                  <span className="cv-eq-bar bar-3" />
                </div>
              ) : (
                <Volume2 size={16} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={currentTrack.name}
              >
                {currentTrack.name}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {formatBytes(currentTrack.size_bytes)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="cv-audio-queue-list">
        {queue.length === 0 ? (
          <div className="cv-audio-queue-empty">
            <Music size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8' }}>
              Antrean lagu kosong.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
              Klik lagu di folder untuk mulai memutar.
            </p>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={`${track.id}-${idx}`}
                className={`cv-audio-queue-item ${isCurrent ? 'active' : ''}`}
                onClick={() => onSelectTrack(idx)}
              >
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: isCurrent ? '#38bdf8' : '#64748b', width: 22, textAlign: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </div>

                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: isCurrent ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCurrent ? '#38bdf8' : '#94a3b8',
                    flexShrink: 0,
                  }}
                >
                  <Music size={14} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: isCurrent ? 600 : 500,
                      color: isCurrent ? '#38bdf8' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={track.name}
                  >
                    {track.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                    {formatBytes(track.size_bytes)}
                  </div>
                </div>

                {/* Item Actions */}
                <div
                  className="cv-queue-item-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    disabled={idx === 0}
                    onClick={() => onMoveTrack(idx, idx - 1)}
                    className="cv-queue-mini-btn"
                    title="Pindahkan ke atas"
                  >
                    <ArrowUp size={12} />
                  </button>

                  <button
                    disabled={idx === queue.length - 1}
                    onClick={() => onMoveTrack(idx, idx + 1)}
                    className="cv-queue-mini-btn"
                    title="Pindahkan ke bawah"
                  >
                    <ArrowDown size={12} />
                  </button>

                  <button
                    onClick={() => onRemoveTrack(idx)}
                    className="cv-queue-mini-btn danger"
                    title="Hapus dari antrean"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
