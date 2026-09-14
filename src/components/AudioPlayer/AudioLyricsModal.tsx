// ============================================================
// AudioLyricsModal Component
// Synchronized lyrics viewer with auto-scroll and ambient glassmorphism
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic2, X, Upload, FileText, Check, RotateCcw,
  Music, Sparkles
} from 'lucide-react';
import type { FileRecord } from '../../types';
import type { AudioMetadata } from '../../utils/id3Reader';
import {
  parseLrc, findActiveLyricIndex, getCustomLyrics,
  saveCustomLyrics, type ParsedLyrics
} from '../../utils/lrcParser';
import { getDownloadUrl } from '../../lib/api';

interface AudioLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileRecord;
  metadata: AudioMetadata | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  siblingFiles?: FileRecord[];
}

export function AudioLyricsModal({
  isOpen,
  onClose,
  file,
  metadata,
  currentTime,
  onSeek,
  siblingFiles = [],
}: AudioLyricsModalProps) {
  const [lyricsData, setLyricsData] = useState<ParsedLyrics>({ lines: [] });
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [manualText, setManualText] = useState('');
  const [userScrolled, setUserScrolled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);

  // Load lyrics on mount or track change
  useEffect(() => {
    if (!isOpen || !file) return;

    let isMounted = true;
    setLoading(true);
    setUserScrolled(false);

    async function loadLyrics() {
      // 1. Check custom user-saved lyrics in localStorage
      const custom = getCustomLyrics(file.id);
      if (custom) {
        if (isMounted) {
          setLyricsData(parseLrc(custom));
          setLoading(false);
        }
        return;
      }

      // 2. Check embedded ID3 lyrics
      if (metadata?.lyrics) {
        if (isMounted) {
          setLyricsData(parseLrc(metadata.lyrics));
          setLoading(false);
        }
        return;
      }

      // 3. Auto-detect matching .lrc file in sibling files
      const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
      const matchingLrc = siblingFiles.find((f) => {
        const sBase = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
        return (
          sBase === baseName &&
          (f.name.toLowerCase().endsWith('.lrc') || f.name.toLowerCase().endsWith('.txt'))
        );
      });

      if (matchingLrc) {
        try {
          const res = await fetch(getDownloadUrl(matchingLrc.id));
          if (res.ok) {
            const text = await res.text();
            if (isMounted) {
              setLyricsData(parseLrc(text));
              setLoading(false);
              return;
            }
          }
        } catch {
          // Ignore fetch error, continue to empty
        }
      }

      if (isMounted) {
        setLyricsData({ lines: [] });
        setLoading(false);
      }
    }

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [isOpen, file, metadata, siblingFiles]);

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
    // After 6 seconds of inactivity, resume auto-scrolling
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
    saveCustomLyrics(file.id, manualText);
    setLyricsData(parseLrc(manualText));
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
        saveCustomLyrics(file.id, content);
        setLyricsData(parseLrc(content));
        setShowEditor(false);
        setUserScrolled(false);
      }
    };
    reader.readAsText(uploaded);
  };

  if (!isOpen) return null;

  const displayTitle = metadata?.title || file.name.replace(/\.[^/.]+$/, '');
  const displayArtist = metadata?.artist || 'Simpenan Audio';

  return (
    <div className="cv-lyrics-overlay" onClick={onClose}>
      {/* Dynamic Blurred Ambient Backdrop */}
      {metadata?.coverUrl ? (
        <div
          className="cv-lyrics-backdrop"
          style={{ backgroundImage: `url(${metadata.coverUrl})` }}
        />
      ) : (
        <div className="cv-lyrics-backdrop-gradient" />
      )}

      <div
        className="cv-lyrics-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cv-lyrics-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              {metadata?.coverUrl ? (
                <img
                  src={metadata.coverUrl}
                  alt="Cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Music size={22} />
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={displayTitle}
              >
                {displayTitle}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: '#94a3b8',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayArtist}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="cv-lyrics-icon-btn"
              title="Edit / Tempel Lirik (.lrc)"
            >
              <FileText size={16} />
              <span className="cv-desktop-only" style={{ fontSize: 12 }}>
                {showEditor ? 'Tutup Editor' : 'Kelola Lirik'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="cv-lyrics-icon-btn"
              title="Tutup Tampilan Lirik"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resync Button Pill (shown when user scrolled manually) */}
        {userScrolled && lyricsData.lines.length > 0 && (
          <button
            onClick={handleResync}
            className="cv-lyrics-resync-pill"
          >
            <RotateCcw size={13} />
            <span>Sinkronkan Ulang</span>
          </button>
        )}

        {/* Content Body */}
        {showEditor ? (
          <div className="cv-lyrics-editor-panel">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>
              Tempel atau Unggah Berkas Lirik (.lrc)
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>
              Format standar LRC: [00:15.30] Baris teks lirik disini. Lirik akan otomatis tersimpan di peramban untuk lagu ini.
            </p>

            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="[00:00.00] Intro...&#10;[00:12.50] Baris pertama lagu..."
              rows={8}
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
                <span>Simpan Lirik</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            onScroll={handleContainerScroll}
            className="cv-lyrics-scroll-container"
          >
            {loading ? (
              <div className="cv-lyrics-empty">
                <Sparkles size={28} className="animate-spin" style={{ color: '#38bdf8', marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  Memuat lirik tersinkronisasi...
                </p>
              </div>
            ) : lyricsData.lines.length === 0 ? (
              <div className="cv-lyrics-empty">
                <Mic2 size={36} style={{ color: 'rgba(56, 189, 248, 0.4)', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  Lirik belum tersedia
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8', maxWidth: 320, lineHeight: 1.5 }}>
                  Tambahkan berkas .lrc dengan nama yang sama di folder ini, atau klik tombol di bawah untuk menempel lirik manual.
                </p>
                <button
                  onClick={() => setShowEditor(true)}
                  className="cv-lyrics-save-btn"
                >
                  <FileText size={14} />
                  <span>Tambah Lirik Manual</span>
                </button>
              </div>
            ) : (
              <div className="cv-lyrics-lines-wrapper">
                {lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  const isPast = idx < activeIndex;

                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLineRef : undefined}
                      onClick={() => onSeek(line.time)}
                      className={`cv-lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                    >
                      {line.text || '...'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
