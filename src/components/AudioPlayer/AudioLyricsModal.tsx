// ============================================================
// AudioLyricsModal Component — Spotify-Style Sing-Along Lyrics
// Fullscreen / Expanded Karaoke View, Synchronized Auto-Scroll,
// Large Legible Typography, Embedded Playback Bar & LRCLIB Integration
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Upload, FileText, Check, RotateCcw, RotateCw,
  Music, Sparkles, Search, RefreshCw, Play, Pause,
  SkipBack, SkipForward, Maximize2, Minimize2,
  AlignLeft, AlignCenter, ChevronDown
} from 'lucide-react';
import type { FileRecord } from '../../types';
import type { AudioMetadata } from '../../utils/id3Reader';
import {
  findActiveLyricIndex
} from '../../utils/lrcParser';
import { useAudioLyrics } from '../../utils/useAudioLyrics';

interface AudioLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileRecord | null;
  metadata: AudioMetadata | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  siblingFiles?: FileRecord[];
  onBackToPlayer?: () => void;
  sharedLyrics?: ReturnType<typeof useAudioLyrics>;
}

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AudioLyricsModal({
  isOpen,
  onClose,
  file,
  metadata,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  onNext,
  onPrevious,
  siblingFiles = [],
  onBackToPlayer,
  sharedLyrics,
}: AudioLyricsModalProps) {
  const internalLyrics = useAudioLyrics({
    file,
    metadata,
    duration,
    currentTime,
    siblingFiles,
  });

  const activeLyrics = sharedLyrics || internalLyrics;
  const {
    lyricsData,
    loading,
    lyricsSource,
    searchQuery,
    setSearchQuery,
    isSearchingOnline,
    searchOnline,
    saveManual,
    displayTitle,
    displayArtist,
  } = activeLyrics;

  const [showEditor, setShowEditor] = useState(false);
  const [manualText, setManualText] = useState('');
  const [userScrolled, setUserScrolled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center'>(() => {
    return (localStorage.getItem('cv_lyrics_align') as 'left' | 'center') || 'left';
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);

  const handleToggleAlign = () => {
    const next = textAlign === 'left' ? 'center' : 'left';
    setTextAlign(next);
    try {
      localStorage.setItem('cv_lyrics_align', next);
    } catch {}
  };

  const activeIndex = findActiveLyricIndex(lyricsData.lines, currentTime);

  // Auto-scroll to active line
  useEffect(() => {
    if (!isOpen || userScrolled || activeIndex < 0) return;

    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isOpen, userScrolled]);

  const handleContainerScroll = useCallback(() => {
    setUserScrolled(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserScrolled(false);
    }, 6000);
  }, []);

  const handleResync = () => {
    setUserScrolled(false);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const handleSaveManualLyrics = () => {
    if (!manualText.trim()) return;
    saveManual(manualText);
    setShowEditor(false);
    setUserScrolled(false);
  };

  const handleOnlineSearch = async (overrideQuery?: string) => {
    await searchOnline(overrideQuery);
    setShowEditor(false);
    setUserScrolled(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        saveManual(content);
        setShowEditor(false);
        setUserScrolled(false);
      }
    };
    reader.readAsText(uploaded);
  };

  if (!isOpen) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`cv-lyrics-overlay ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onClick={onClose}
    >
      {/* Ambient Artwork Backdrop */}
      {metadata?.coverUrl ? (
        <div
          className="cv-lyrics-backdrop"
          style={{ backgroundImage: `url(${metadata.coverUrl})` }}
        />
      ) : (
        <div className="cv-lyrics-backdrop-gradient" />
      )}

      {/* Dark Vignette Tint */}
      <div className="cv-lyrics-vignette" />

      <div
        className={`cv-lyrics-modal spotify-style ${isFullscreen ? 'fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="cv-lyrics-header spotify-header">
          {onBackToPlayer && (
            <button
              onClick={onBackToPlayer}
              className="cv-lyrics-icon-btn cv-lyrics-back-btn"
              title="Kembali ke Layar Pemutar"
            >
              <ChevronDown size={22} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
              }}
            >
              {metadata?.coverUrl ? (
                <img
                  src={metadata.coverUrl}
                  alt="Cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Music size={24} />
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.02em',
                }}
                title={displayTitle}
              >
                {displayTitle}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayArtist}
                </span>

                {lyricsSource === 'online_synced' && (
                  <span className="cv-lyrics-badge synced">Tersinkronisasi Otomatis</span>
                )}
                {lyricsSource === 'online_plain' && (
                  <span className="cv-lyrics-badge plain">Lirik Teks</span>
                )}
                {lyricsSource === 'id3' && (
                  <span className="cv-lyrics-badge id3">Dari Tag Berkas</span>
                )}
                {lyricsSource === 'local_file' && (
                  <span className="cv-lyrics-badge local">Berkas .lrc</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Text Alignment Toggle (Left / Center) */}
            <button
              onClick={handleToggleAlign}
              className="cv-lyrics-icon-btn"
              title={textAlign === 'left' ? 'Teks: Rata Kiri' : 'Teks: Rata Tengah'}
            >
              {textAlign === 'left' ? <AlignLeft size={16} /> : <AlignCenter size={16} />}
            </button>

            {/* Manage / Search Lyrics Toggle */}
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="cv-lyrics-icon-btn"
              title="Cari atau Tempel Lirik (.lrc)"
            >
              <FileText size={16} />
              <span className="cv-desktop-only" style={{ fontSize: 12 }}>
                {showEditor ? 'Tutup' : 'Cari / Edit'}
              </span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="cv-lyrics-icon-btn cv-desktop-only"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Tampilan Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="cv-lyrics-icon-btn close"
              title="Tutup Tampilan Lirik"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Floating Resync Button (Bottom Right) */}
        {userScrolled && lyricsData.lines.length > 0 && !showEditor && (
          <button
            onClick={handleResync}
            className="cv-lyrics-resync-pill spotify"
            title="Kembali ke baris lirik yang sedang diputar"
          >
            <RotateCcw size={13} />
            <span>Sinkronkan Ulang</span>
          </button>
        )}

        {/* Content Body */}
        {showEditor ? (
          <div className="cv-lyrics-editor-panel">
            {/* Online Search Box */}
            <div style={{ marginBottom: 16, background: 'rgba(255, 255, 255, 0.05)', padding: 14, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                Cari Lirik Online Otomatis
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOnlineSearch()}
                  placeholder="Ketik judul lagu atau artis..."
                  className="cv-lyrics-search-input"
                />
                <button
                  onClick={() => handleOnlineSearch()}
                  disabled={isSearchingOnline || !searchQuery.trim()}
                  className="cv-lyrics-save-btn"
                >
                  {isSearchingOnline ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  <span>Cari</span>
                </button>
              </div>
            </div>

            {/* Manual Paste */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
              Tempel atau Unggah Berkas Lirik (.lrc)
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>
              Format standar: [00:15.30] Baris lirik. Lirik akan otomatis tersimpan di peramban untuk lagu ini.
            </p>

            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="[00:00.00] Intro...&#10;[00:12.50] Baris lirik lagu..."
              rows={6}
              className="cv-lyrics-textarea"
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
              <label className="cv-lyrics-upload-label">
                <Upload size={14} />
                <span>Pilih Berkas .lrc</span>
                <input
                  type="file"
                  accept=".lrc,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                onClick={handleSaveManualLyrics}
                className="cv-lyrics-save-btn"
                disabled={!manualText.trim()}
              >
                <Check size={14} />
                <span>Simpan Lirik Manual</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            onScroll={handleContainerScroll}
            className={`cv-lyrics-scroll-container spotify ${textAlign === 'center' ? 'text-center' : 'text-left'}`}
          >
            {loading ? (
              <div className="cv-lyrics-empty">
                <Sparkles size={32} className="animate-spin" style={{ color: '#38bdf8', marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>
                  Mencari dan menyinkronkan lirik lagu...
                </p>
              </div>
            ) : lyricsData.lines.length === 0 ? (
              <div className="cv-lyrics-empty">
                <Music size={40} style={{ color: 'rgba(56, 189, 248, 0.4)', marginBottom: 14 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Lirik belum ditemukan secara otomatis
                </div>
                <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#94a3b8', maxWidth: 380, lineHeight: 1.5 }}>
                  Cari lirik lagu ini di database online atau tambahkan lirik manual.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380, width: '100%', marginBottom: 14 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOnlineSearch()}
                    placeholder="Contoh: Tulus - Teh Hijau"
                    className="cv-lyrics-search-input"
                  />
                  <button
                    onClick={() => handleOnlineSearch()}
                    disabled={isSearchingOnline}
                    className="cv-lyrics-save-btn"
                  >
                    {isSearchingOnline ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    <span>Cari</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowEditor(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  Tempel Lirik Manual (.lrc)
                </button>
              </div>
            ) : (
              <div className={`cv-lyrics-lines-wrapper spotify ${textAlign === 'center' ? 'align-center' : 'align-left'}`}>
                {lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  const isPast = idx < activeIndex;

                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLineRef : undefined}
                      onClick={() => onSeek(line.time)}
                      className={`cv-lyric-line-spotify ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                    >
                      {line.text || '...'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Spotify Embedded Bottom Playback Controls Bar */}
        <div className="cv-lyrics-bottom-bar">
          {/* Scrubber Progress Bar */}
          <div className="cv-lyrics-scrubber-row">
            <span className="cv-lyrics-time-label">{formatTime(currentTime)}</span>
            <div className="cv-lyrics-scrubber-track">
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 99,
                  background: 'rgba(255, 255, 255, 0.2)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  width: `${progressPercent}%`,
                  height: 4,
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.8)',
                }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  width: '100%',
                  height: 16,
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              />
            </div>
            <span className="cv-lyrics-time-label">{formatTime(duration)}</span>
          </div>

          {/* Playback Buttons */}
          <div className="cv-lyrics-controls-row">
            {onPrevious && (
              <button
                onClick={onPrevious}
                className="cv-lyrics-btn"
                title="Lagu Sebelumnya"
              >
                <SkipBack size={18} />
              </button>
            )}

            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="cv-lyrics-btn cv-desktop-only"
              title="Mundur 10 Detik"
            >
              <RotateCcw size={16} />
            </button>

            {onTogglePlay && (
              <button
                onClick={onTogglePlay}
                className="cv-lyrics-play-btn"
                title={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? (
                  <Pause size={20} fill="#0f172a" color="#0f172a" />
                ) : (
                  <Play size={20} fill="#0f172a" color="#0f172a" style={{ marginLeft: 2 }} />
                )}
              </button>
            )}

            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="cv-lyrics-btn cv-desktop-only"
              title="Maju 10 Detik"
            >
              <RotateCw size={16} />
            </button>

            {onNext && (
              <button
                onClick={onNext}
                className="cv-lyrics-btn"
                title="Lagu Berikutnya"
              >
                <SkipForward size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
