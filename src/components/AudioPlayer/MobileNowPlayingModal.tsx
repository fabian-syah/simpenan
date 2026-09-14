// ============================================================
// MobileNowPlayingModal Component — Simpenan Mobile Music Player
// Inspired by Spotify Mobile (Images 2-4) with Simpenan Brand Identity:
// Ambient Cyber-Cyan Glow, Frosted Glass, Synced Lyrics Preview Card,
// Sleep Timer, File & Cloud Credits, and Fullscreen Karaoke Lyrics
// ============================================================
import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  RotateCcw, RotateCw, Shuffle, Repeat, Repeat1,
  ListMusic, Mic2, Clock, Share2, Music, Disc,
  Check, ExternalLink, HardDrive, FileAudio
} from 'lucide-react';
import type { FileRecord } from '../../types';
import { formatBytes } from '../../types';
import type { AudioMetadata } from '../../utils/id3Reader';
import type { ParsedLyrics } from '../../utils/lrcParser';
import type { LyricsSourceType } from '../../utils/useAudioLyrics';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileRecord | null;
  metadata: AudioMetadata | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'all' | 'one';
  onCycleRepeat: () => void;
  onOpenFullLyrics: () => void;
  onOpenQueue: () => void;
  queue: FileRecord[];
  currentIndex: number;
  lyricsData: ParsedLyrics;
  lyricsLoading: boolean;
  lyricsSource: LyricsSourceType;
  activeIndex: number;
  sleepTimerMinutes: number | null;
  onSetSleepTimer: (minutes: number | null) => void;
  sleepTimerRemainingSecs: number | null;
  onShareTrack?: () => void;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MobileNowPlayingModal({
  isOpen,
  onClose,
  file,
  metadata,
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onCycleRepeat,
  onOpenFullLyrics,
  onOpenQueue,
  queue,
  currentIndex,
  lyricsData,
  lyricsLoading,
  lyricsSource,
  activeIndex,
  sleepTimerMinutes,
  onSetSleepTimer,
  sleepTimerRemainingSecs,
  onShareTrack,
}: MobileNowPlayingModalProps) {
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !file) return null;

  const displayTitle = metadata?.title || file.name.replace(/\.[^/.]+$/, '');
  const displayArtist = metadata?.artist || 'Simpenan Audio';
  const displayAlbum = metadata?.album || 'Koleksi Cloud';

  // Format extension
  const extension = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(0, duration - currentTime);

  // Next song in queue
  const nextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : 0;
  const nextTrack = queue.length > 1 ? queue[nextIndex] : null;

  // Derive visible preview lyrics lines (around activeIndex)
  const lines = lyricsData.lines;
  let previewLines: { text: string; time: number; isActive: boolean; idx: number }[] = [];
  if (lines.length > 0) {
    const start = Math.max(0, activeIndex >= 0 ? activeIndex : 0);
    const end = Math.min(lines.length, start + 4);
    previewLines = lines.slice(start, end).map((l, i) => ({
      text: l.text,
      time: l.time,
      isActive: start + i === activeIndex,
      idx: start + i,
    }));
  }

  const handleCopyShare = () => {
    if (onShareTrack) {
      onShareTrack();
    } else {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <div className="cv-mobile-player-overlay">
      {/* Ambient Glow Backdrop */}
      {metadata?.coverUrl ? (
        <div
          className="cv-mobile-player-backdrop"
          style={{ backgroundImage: `url(${metadata.coverUrl})` }}
        />
      ) : (
        <div className="cv-mobile-player-backdrop-ambient" />
      )}

      {/* Dark Vignette Tint */}
      <div className="cv-mobile-player-vignette" />

      {/* Sheet Modal Container */}
      <div ref={containerRef} className="cv-mobile-player-sheet">
        {/* Top Header Bar */}
        <div className="cv-mobile-player-header">
          <button
            onClick={onClose}
            className="cv-mobile-player-nav-btn"
            title="Tutup ke Bar Pemutar Bawah"
          >
            <ChevronDown size={26} />
          </button>

          <div className="cv-mobile-player-header-title">
            <span className="cv-mobile-player-header-sub">SEDANG DIPUTAR</span>
            <span className="cv-mobile-player-header-main" title={file.parent_path || 'Simpenan Drive'}>
              {file.parent_path ? file.parent_path.replace(/^\//, '') : 'Simpenan Musik'}
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`cv-mobile-player-nav-btn ${sleepTimerMinutes !== null ? 'active' : ''}`}
              title="Pengatur Waktu Tidur"
            >
              <Clock size={20} />
            </button>

            {/* Sleep Timer Popover */}
            {showSleepMenu && (
              <div className="cv-mobile-sleep-popover">
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Waktu Tidur (Sleep Timer)
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  Otomatis jeda saat waktu habis:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { label: 'Nonaktif', val: null },
                    { label: '15 Menit', val: 15 },
                    { label: '30 Menit', val: 30 },
                    { label: '45 Menit', val: 45 },
                    { label: '60 Menit', val: 60 },
                    { label: 'Akhir Lagu Ini', val: -1 },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      onClick={() => {
                        onSetSleepTimer(opt.val);
                        setShowSleepMenu(false);
                      }}
                      className={`cv-sleep-option-btn ${sleepTimerMinutes === opt.val ? 'active' : ''}`}
                    >
                      <span>{opt.label}</span>
                      {sleepTimerMinutes === opt.val && <Check size={14} color="#38bdf8" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Player Content */}
        <div className="cv-mobile-player-scroll">
          {/* Centered Large Artwork Section */}
          <div className="cv-mobile-artwork-wrapper">
            <div className="cv-mobile-artwork-card">
              {metadata?.coverUrl ? (
                <img
                  src={metadata.coverUrl}
                  alt="Cover Album"
                  className="cv-mobile-artwork-img"
                />
              ) : (
                <div className="cv-mobile-artwork-placeholder">
                  {isPlaying ? (
                    <Disc
                      size={90}
                      className="animate-spin"
                      style={{ color: '#38bdf8', animationDuration: '4s' }}
                    />
                  ) : (
                    <Music size={80} style={{ color: 'rgba(56, 189, 248, 0.7)' }} />
                  )}
                  <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                    Simpenan Audio Hi-Fi
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Track Info Row & Cloud Badges */}
          <div className="cv-mobile-info-section">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="cv-mobile-track-title" title={displayTitle}>
                {displayTitle}
              </h1>
              <p className="cv-mobile-track-artist" title={displayArtist}>
                {displayArtist}
              </p>

              {/* Cloud & Format Pills */}
              <div className="cv-mobile-badge-row">
                <span className="cv-mobile-format-badge">
                  <FileAudio size={11} />
                  <span>{extension}</span>
                </span>
                <span className="cv-mobile-format-badge">
                  <span>{formatBytes(file.size_bytes)}</span>
                </span>
                {file.provider_id && (
                  <span className="cv-mobile-provider-badge">
                    <HardDrive size={11} />
                    <span>{file.provider_id.toUpperCase()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Share / Action Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={handleCopyShare}
                className="cv-mobile-action-icon-btn"
                title={copiedShare ? 'Tautan Disalin' : 'Bagikan Berkas'}
              >
                {copiedShare ? <Check size={18} color="#38bdf8" /> : <Share2 size={18} />}
              </button>
            </div>
          </div>

          {/* Interactive Scrubber & Timestamps */}
          <div className="cv-mobile-scrubber-section">
            <div className="cv-mobile-scrubber-track">
              {/* Background rail */}
              <div className="cv-mobile-scrubber-rail" />
              {/* Active filled track */}
              <div
                className="cv-mobile-scrubber-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="cv-mobile-scrubber-input"
              />
            </div>

            <div className="cv-mobile-timestamps-row">
              <span>{formatAudioTime(currentTime)}</span>
              <span>-{formatAudioTime(remainingTime)}</span>
            </div>
          </div>

          {/* Primary Playback Controls Row */}
          <div className="cv-mobile-controls-row">
            {/* Shuffle Button */}
            <button
              onClick={onToggleShuffle}
              className={`cv-mobile-ctrl-btn ${isShuffle ? 'active' : ''}`}
              title={isShuffle ? 'Acak: Aktif' : 'Acak: Nonaktif'}
            >
              <Shuffle size={20} />
            </button>

            {/* Skip Previous Track */}
            <button
              onClick={onPrevious}
              className="cv-mobile-ctrl-btn"
              title="Lagu Sebelumnya"
            >
              <SkipBack size={24} />
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="cv-mobile-ctrl-btn secondary"
              title="Mundur 10 Detik"
            >
              <RotateCcw size={18} />
            </button>

            {/* Center Big Play / Pause Button */}
            <button
              onClick={onTogglePlay}
              className="cv-mobile-play-button"
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? (
                <Pause size={28} fill="white" color="white" />
              ) : (
                <Play size={28} fill="white" color="white" style={{ marginLeft: 3 }} />
              )}
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="cv-mobile-ctrl-btn secondary"
              title="Maju 10 Detik"
            >
              <RotateCw size={18} />
            </button>

            {/* Skip Next Track */}
            <button
              onClick={onNext}
              className="cv-mobile-ctrl-btn"
              title="Lagu Berikutnya"
            >
              <SkipForward size={24} />
            </button>

            {/* Repeat Mode Toggle */}
            <button
              onClick={onCycleRepeat}
              className={`cv-mobile-ctrl-btn ${repeatMode !== 'off' ? 'active' : ''}`}
              title={
                repeatMode === 'one'
                  ? 'Ulangi Satu'
                  : repeatMode === 'all'
                  ? 'Ulangi Semua'
                  : 'Ulangi Nonaktif'
              }
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          {/* Quick Tools Row (Sleep Timer info, Queue Drawer) */}
          <div className="cv-mobile-quick-tools-row">
            {sleepTimerRemainingSecs !== null && (
              <div className="cv-mobile-timer-badge">
                <Clock size={12} />
                <span>Tidur dalam: {formatAudioTime(sleepTimerRemainingSecs)}</span>
              </div>
            )}

            <button onClick={onOpenQueue} className="cv-mobile-queue-tool-btn">
              <ListMusic size={16} />
              <span>Antrean ({queue.length})</span>
            </button>

            <button onClick={onOpenFullLyrics} className="cv-mobile-lyrics-tool-btn">
              <Mic2 size={16} />
              <span>Lirik Penuh</span>
            </button>
          </div>

          {/* Dynamic Lyrics Preview Card (Spotify Mobile style, Image 2 & 3 inspired) */}
          <div className="cv-mobile-lyrics-card">
            <div className="cv-mobile-lyrics-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mic2 size={16} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                  Pratinjau Lirik
                </span>
              </div>

              {lyricsSource === 'online_synced' && (
                <span className="cv-mobile-lyrics-tag synced">Tersinkronisasi</span>
              )}
              {lyricsSource === 'online_plain' && (
                <span className="cv-mobile-lyrics-tag plain">Teks Lirik</span>
              )}
              {lyricsSource === 'id3' && (
                <span className="cv-mobile-lyrics-tag id3">Tag Berkas</span>
              )}
            </div>

            {/* Card Content Lines */}
            <div
              className="cv-mobile-lyrics-preview-body"
              onClick={onOpenFullLyrics}
            >
              {lyricsLoading ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Menyinkronkan lirik lagu...
                </div>
              ) : previewLines.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Lirik belum tersedia untuk lagu ini.
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Ketuk tombol di bawah untuk mencari lirik secara online.
                  </div>
                </div>
              ) : (
                <div className="cv-mobile-lyrics-lines">
                  {previewLines.map((line) => (
                    <div
                      key={line.idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(line.time);
                      }}
                      className={`cv-mobile-preview-line ${line.isActive ? 'active' : ''}`}
                    >
                      {line.text || '...'}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expand Full Lyrics Button */}
            <button
              onClick={onOpenFullLyrics}
              className="cv-mobile-lyrics-expand-btn"
            >
              <span>{lines.length > 0 ? 'Tampilkan Lirik Penuh' : 'Cari / Pasang Lirik'}</span>
              <ExternalLink size={14} />
            </button>
          </div>

          {/* Track Metadata & Cloud Credits Card (Image 4 & 5 inspired) */}
          <div className="cv-mobile-credits-card">
            <div className="cv-mobile-credits-header">
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                Tentang Berkas & Kredit Cloud
              </span>
            </div>

            <div className="cv-mobile-credits-grid">
              <div className="cv-mobile-credit-item">
                <span className="label">Judul Asli</span>
                <span className="val">{file.name}</span>
              </div>
              <div className="cv-mobile-credit-item">
                <span className="label">Artis / Musisi</span>
                <span className="val">{displayArtist}</span>
              </div>
              <div className="cv-mobile-credit-item">
                <span className="label">Album</span>
                <span className="val">{displayAlbum}</span>
              </div>
              {metadata?.year && (
                <div className="cv-mobile-credit-item">
                  <span className="label">Tahun Rilis</span>
                  <span className="val">{metadata.year}</span>
                </div>
              )}
              <div className="cv-mobile-credit-item">
                <span className="label">Penyimpanan Cloud</span>
                <span className="val" style={{ textTransform: 'capitalize' }}>
                  {file.provider_id || 'Lokal Drive'}
                </span>
              </div>
              <div className="cv-mobile-credit-item">
                <span className="label">Ukuran Berkas</span>
                <span className="val">{formatBytes(file.size_bytes)}</span>
              </div>
              <div className="cv-mobile-credit-item">
                <span className="label">Format Berkas</span>
                <span className="val">{file.mime_type || extension}</span>
              </div>
            </div>
          </div>

          {/* Next Track in Queue Preview Card */}
          {nextTrack && (
            <div className="cv-mobile-next-track-card" onClick={onNext}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                BERIKUTNYA DALAM ANTREAN
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {nextTrack.name.replace(/\.[^/.]+$/, '')}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                    {formatBytes(nextTrack.size_bytes)}
                  </div>
                </div>
                <button
                  className="cv-mobile-next-play-icon"
                  title="Putar Sekarang"
                >
                  <Play size={16} fill="white" style={{ marginLeft: 2 }} />
                </button>
              </div>
            </div>
          )}

          {/* Bottom spacer to account for mobile navigation bar */}
          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}
