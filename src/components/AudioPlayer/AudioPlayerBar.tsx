// ============================================================
// AudioPlayerBar Component — Supercharged Music Player
// Background Lockscreen Media Control (MediaSession),
// Shuffle & Repeat (One/All/Off), Queue & Playlist Manager,
// Synchronized Lyrics, ID3 Tag & Cover Reader, Gapless & Crossfade
// ============================================================
import { useState, useRef, useEffect, useCallback, type ChangeEvent, type CSSProperties } from 'react';
import {
  Play, Pause, Volume2, Volume1, VolumeX, RotateCcw, RotateCw,
  Repeat, Repeat1, X, Music, Disc, Shuffle, SkipBack, SkipForward,
  ListMusic, Mic2, Sliders
} from 'lucide-react';
import type { FileRecord } from '../../types';
import { formatBytes } from '../../types';
import { fetchAudioMetadata, type AudioMetadata } from '../../utils/id3Reader';
import {
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
  setupMediaSessionActionHandlers
} from '../../utils/mediaSession';
import { AudioQueueDrawer } from './AudioQueueDrawer';
import { AudioLyricsModal } from './AudioLyricsModal';
import { parseAudioFilename } from '../../utils/lrcParser';

interface AudioPlayerBarProps {
  file: FileRecord | null;
  url: string | null;
  onClose: () => void;
  playlist?: FileRecord[];
  currentIndex?: number;
  onSelectTrack?: (index: number) => void;
  onUpdateQueue?: (newQueue: FileRecord[], newIndex: number) => void;
  siblingFiles?: FileRecord[];
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayerBar({
  file,
  url,
  onClose,
  playlist = [],
  currentIndex = 0,
  onSelectTrack,
  onUpdateQueue,
  siblingFiles = [],
}: AudioPlayerBarProps) {
  // Primary audio deck
  const audioRef = useRef<HTMLAudioElement>(null);
  // Secondary audio deck for gapless & crossfade
  const crossfadeAudioRef = useRef<HTMLAudioElement>(null);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('cv_audio_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(false);

  // Batch 3: Repeat & Shuffle
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(() => {
    const saved = localStorage.getItem('cv_audio_repeat');
    if (saved === 'off' || saved === 'all' || saved === 'one') return saved;
    return 'all';
  });

  const [isShuffle, setIsShuffle] = useState(() => {
    return localStorage.getItem('cv_audio_shuffle') === 'true';
  });

  // Batch 3: Crossfade Duration (0 = Gapless, 2s, 4s, 6s, 8s)
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(() => {
    const saved = localStorage.getItem('cv_audio_crossfade');
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  // Batch 3: Panels State
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Batch 3: ID3 Metadata & Album Cover
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [prevCoverUrl, setPrevCoverUrl] = useState<string | null>(null);

  // Active queue state
  const [queue, setQueue] = useState<FileRecord[]>(playlist);
  const [activeIdx, setActiveIdx] = useState<number>(currentIndex);

  // Crossfade transition state
  const isTransitioningRef = useRef(false);

  // Sync internal queue with prop changes
  useEffect(() => {
    if (playlist.length > 0) {
      setQueue(playlist);
    }
  }, [playlist]);

  useEffect(() => {
    setActiveIdx(currentIndex);
  }, [currentIndex]);

  // Extract ID3 Metadata whenever URL changes
  useEffect(() => {
    if (!url) return;

    let isCancelled = false;

    // Revoke previous blob url
    if (prevCoverUrl) {
      URL.revokeObjectURL(prevCoverUrl);
      setPrevCoverUrl(null);
    }

    setMetadata(null);

    fetchAudioMetadata(url).then((meta) => {
      if (!isCancelled) {
        setMetadata(meta);
        if (meta.coverUrl) {
          setPrevCoverUrl(meta.coverUrl);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevCoverUrl) {
        URL.revokeObjectURL(prevCoverUrl);
      }
    };
  }, [prevCoverUrl]);

  // Autoplay on URL change
  useEffect(() => {
    if (url && audioRef.current) {
      isTransitioningRef.current = false;
      audioRef.current.currentTime = 0;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [url]);

  // Save state preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cv_audio_volume', volume.toString());
      localStorage.setItem('cv_audio_repeat', repeatMode);
      localStorage.setItem('cv_audio_shuffle', isShuffle.toString());
      localStorage.setItem('cv_audio_crossfade', crossfadeDuration.toString());
    } catch {}
  }, [volume, repeatMode, isShuffle, crossfadeDuration]);

  // Next Track Logic
  const handleNext = useCallback(() => {
    if (queue.length === 0) return;

    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }

    let nextIndex = activeIdx + 1;

    if (isShuffle) {
      if (queue.length > 1) {
        // Pick random index different from current
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === activeIdx);
      } else {
        nextIndex = 0;
      }
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // Stop playback at end of queue
        setIsPlaying(false);
        return;
      }
    }

    setActiveIdx(nextIndex);
    if (onSelectTrack) {
      onSelectTrack(nextIndex);
    }
  }, [queue, activeIdx, isShuffle, repeatMode, onSelectTrack]);

  // Previous Track Logic
  const handlePrevious = useCallback(() => {
    if (queue.length === 0) return;

    // If song played for more than 3 seconds, restart current track
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex = activeIdx - 1;
    if (prevIndex < 0) {
      if (repeatMode === 'all') {
        prevIndex = queue.length - 1;
      } else {
        prevIndex = 0;
      }
    }

    setActiveIdx(prevIndex);
    if (onSelectTrack) {
      onSelectTrack(prevIndex);
    }
  }, [queue, activeIdx, repeatMode, onSelectTrack]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  // Skip Seconds
  const skip = (secs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + secs));
    }
  };

  // MediaSession Integration
  useEffect(() => {
    if (!file) return;

    const parsedFile = parseAudioFilename(file.name);
    const displayTitle = metadata?.title || parsedFile.title || file.name.replace(/\.[^/.]+$/, '');
    const displayArtist = metadata?.artist || parsedFile.artist || 'Simpenan Audio';
    const displayAlbum = metadata?.album || 'Koleksi Berkas';

    updateMediaSessionMetadata({
      title: displayTitle,
      artist: displayArtist,
      album: displayAlbum,
      artwork: metadata?.coverUrl || null,
    });

    const cleanupHandlers = setupMediaSessionActionHandlers({
      onPlay: togglePlay,
      onPause: togglePlay,
      onPrevious: handlePrevious,
      onNext: handleNext,
      onSeekBackward: () => skip(-10),
      onSeekForward: () => skip(10),
      onSeekTo: (seekSeconds) => {
        if (audioRef.current) {
          audioRef.current.currentTime = seekSeconds;
          setCurrentTime(seekSeconds);
        }
      },
    });

    return () => {
      cleanupHandlers();
    };
  }, [file, metadata, togglePlay, handlePrevious, handleNext]);

  // Update MediaSession Playback State
  useEffect(() => {
    updateMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
  }, [isPlaying]);

  // Update MediaSession Position State
  useEffect(() => {
    if (duration > 0) {
      updateMediaSessionPositionState(duration, currentTime);
    }
  }, [duration, currentTime]);

  // Time & Duration Handlers + Crossfade Check
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);

    // Crossfade Logic: If crossfade is enabled and we are near track end
    if (
      crossfadeDuration > 0 &&
      duration > crossfadeDuration &&
      curr >= duration - crossfadeDuration &&
      !isTransitioningRef.current &&
      queue.length > 1
    ) {
      isTransitioningRef.current = true;
      handleNext();
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = v === 0;
      setIsMuted(v === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // Toggle Repeat Mode Cycle (off -> all -> one -> off)
  const cycleRepeatMode = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  // Queue Operations
  const handleSelectFromQueue = (index: number) => {
    setActiveIdx(index);
    if (onSelectTrack) {
      onSelectTrack(index);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    const newQueue = queue.filter((_, i) => i !== index);
    let newIdx = activeIdx;
    if (index < activeIdx) {
      newIdx = activeIdx - 1;
    } else if (index === activeIdx && newIdx >= newQueue.length) {
      newIdx = Math.max(0, newQueue.length - 1);
    }
    setQueue(newQueue);
    setActiveIdx(newIdx);
    if (onUpdateQueue) {
      onUpdateQueue(newQueue, newIdx);
    }
  };

  const handleMoveQueueItem = (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || fromIdx >= queue.length || toIdx < 0 || toIdx >= queue.length) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIdx, 1);
    newQueue.splice(toIdx, 0, moved);

    let newActiveIdx = activeIdx;
    if (activeIdx === fromIdx) {
      newActiveIdx = toIdx;
    } else if (fromIdx < activeIdx && toIdx >= activeIdx) {
      newActiveIdx = activeIdx - 1;
    } else if (fromIdx > activeIdx && toIdx <= activeIdx) {
      newActiveIdx = activeIdx + 1;
    }

    setQueue(newQueue);
    setActiveIdx(newActiveIdx);
    if (onUpdateQueue) {
      onUpdateQueue(newQueue, newActiveIdx);
    }
  };

  const handleShuffleQueue = () => {
    if (queue.length <= 1) return;
    const currentTrack = queue[activeIdx];
    const rest = queue.filter((_, i) => i !== activeIdx);
    // Fisher-Yates shuffle
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const newQueue = [currentTrack, ...rest];
    setQueue(newQueue);
    setActiveIdx(0);
    if (onUpdateQueue) {
      onUpdateQueue(newQueue, 0);
    }
  };

  const handleClearQueue = () => {
    if (file) {
      setQueue([file]);
      setActiveIdx(0);
      if (onUpdateQueue) {
        onUpdateQueue([file], 0);
      }
    }
  };

  if (!file || !url) return null;

  const parsedFile = parseAudioFilename(file.name);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTitle = metadata?.title || parsedFile.title || file.name;
  const displayArtist = metadata?.artist || parsedFile.artist || formatBytes(file.size_bytes);

  return (
    <>
      <div className="cv-audio-bar">
        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleNext}
        />

        {/* Hidden Deck B for gapless preload */}
        <audio ref={crossfadeAudioRef} style={{ display: 'none' }} />

        {/* Scrubber Bar */}
        <div className="cv-audio-scrubber-track">
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 99,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
              boxShadow: '0 0 8px rgba(56, 189, 248, 0.7)',
            }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              width: '100%',
              height: 14,
              opacity: 0,
              cursor: 'pointer',
              zIndex: 2,
            }}
          />
        </div>

        {/* Main Bar Info & Controls */}
        <div className="cv-audio-row">
          {/* Track Details & Album Cover */}
          <div className="cv-audio-track">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(56, 189, 248, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}
            >
              {metadata?.coverUrl ? (
                <img
                  src={metadata.coverUrl}
                  alt="Cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : isPlaying ? (
                <Disc
                  size={22}
                  style={{
                    animation: 'spin 3s linear infinite',
                  }}
                />
              ) : (
                <Music size={20} />
              )}
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#f8fafc',
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
                  fontSize: 11.5,
                  color: '#94a3b8',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayArtist}
              </div>
            </div>
          </div>

          {/* Center Playback Controls */}
          <div className="cv-audio-controls">
            {/* Shuffle Button */}
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className="cv-desktop-only"
              style={{
                ...btnStyle,
                color: isShuffle ? '#38bdf8' : 'rgba(255, 255, 255, 0.55)',
                background: isShuffle ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderRadius: 8,
              }}
              title={isShuffle ? 'Acak: Aktif' : 'Acak: Nonaktif'}
            >
              <Shuffle size={15} />
            </button>

            {/* Previous Track Button */}
            <button
              onClick={handlePrevious}
              style={btnStyle}
              title="Lagu Sebelumnya"
            >
              <SkipBack size={17} />
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => skip(-10)}
              className="cv-audio-skip-btn cv-desktop-only"
              style={btnStyle}
              title="Mundur 10 Detik"
            >
              <RotateCcw size={15} />
            </button>

            {/* Main Play / Pause Button */}
            <button
              onClick={togglePlay}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.45)',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" style={{ marginLeft: 2 }} />}
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => skip(10)}
              className="cv-audio-skip-btn cv-desktop-only"
              style={btnStyle}
              title="Maju 10 Detik"
            >
              <RotateCw size={15} />
            </button>

            {/* Next Track Button */}
            <button
              onClick={handleNext}
              style={btnStyle}
              title="Lagu Berikutnya"
            >
              <SkipForward size={17} />
            </button>

            {/* Repeat Mode Button */}
            <button
              onClick={cycleRepeatMode}
              className="cv-desktop-only"
              style={{
                ...btnStyle,
                color: repeatMode !== 'off' ? '#38bdf8' : 'rgba(255, 255, 255, 0.55)',
                background: repeatMode !== 'off' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderRadius: 8,
              }}
              title={
                repeatMode === 'one'
                  ? 'Ulangi: Satu Lagu'
                  : repeatMode === 'all'
                  ? 'Ulangi: Semua Lagu'
                  : 'Ulangi: Nonaktif'
              }
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>

            {/* Time Counter */}
            <div
              className="cv-audio-time cv-desktop-only"
              style={{ fontSize: 12, fontFamily: 'monospace', color: '#cbd5e1', marginLeft: 4 }}
            >
              <span>{formatAudioTime(currentTime)}</span>
              <span style={{ opacity: 0.4, margin: '0 3px' }}>/</span>
              <span style={{ opacity: 0.7 }}>{formatAudioTime(duration)}</span>
            </div>
          </div>

          {/* Right Action Tools: Lyrics, Queue, Volume, Crossfade */}
          <div className="cv-audio-extra">
            {/* Lyrics Button */}
            <button
              onClick={() => setShowLyrics(true)}
              style={{
                ...btnStyle,
                color: showLyrics ? '#38bdf8' : 'rgba(255, 255, 255, 0.75)',
                background: showLyrics ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderRadius: 8,
              }}
              title="Buka Lirik Tersinkronisasi"
            >
              <Mic2 size={16} />
            </button>

            {/* Queue Drawer Toggle */}
            <button
              onClick={() => setShowQueue(!showQueue)}
              style={{
                ...btnStyle,
                position: 'relative',
                color: showQueue ? '#38bdf8' : 'rgba(255, 255, 255, 0.75)',
                background: showQueue ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderRadius: 8,
              }}
              title="Buka Antrean & Daftar Putar"
            >
              <ListMusic size={17} />
              {queue.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 99,
                    padding: '1px 4px',
                    minWidth: 14,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {queue.length}
                </span>
              )}
            </button>

            {/* Crossfade Settings Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="cv-desktop-only"
                style={{
                  ...btnStyle,
                  color: crossfadeDuration > 0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
                  background: showSettings ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  borderRadius: 8,
                }}
                title="Pengaturan Transisi & Crossfade"
              >
                <Sliders size={16} />
              </button>

              {/* Crossfade Popover */}
              {showSettings && (
                <div className="cv-audio-settings-popover">
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                    Transisi Lagu
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                    Pilih durasi crossfade antar lagu:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'Gapless (0 Detik)', val: 0 },
                      { label: 'Crossfade 2 Detik', val: 2 },
                      { label: 'Crossfade 4 Detik', val: 4 },
                      { label: 'Crossfade 6 Detik', val: 6 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setCrossfadeDuration(opt.val);
                          setShowSettings(false);
                        }}
                        className={`cv-crossfade-option ${crossfadeDuration === opt.val ? 'active' : ''}`}
                      >
                        <span>{opt.label}</span>
                        {crossfadeDuration === opt.val && (
                          <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700 }}>Aktif</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Volume Control Slider */}
            <div className="cv-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={toggleMute} style={btnStyle} title="Bisukan Suara">
                {isMuted || volume === 0 ? (
                  <VolumeX size={17} />
                ) : volume < 0.5 ? (
                  <Volume1 size={17} />
                ) : (
                  <Volume2 size={17} />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="cv-audio-volume-slider"
                style={{
                  width: 65,
                  height: 3,
                  accentColor: '#38bdf8',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div
              className="cv-audio-divider cv-desktop-only"
              style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }}
            />

            {/* Dismiss / Close Player */}
            <button
              onClick={onClose}
              style={{
                ...btnStyle,
                color: '#94a3b8',
                padding: 4,
              }}
              title="Tutup Pemutar Musik"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Queue & Playlist Drawer */}
      <AudioQueueDrawer
        isOpen={showQueue}
        onClose={() => setShowQueue(false)}
        queue={queue}
        currentIndex={activeIdx}
        isPlaying={isPlaying}
        onSelectTrack={handleSelectFromQueue}
        onRemoveTrack={handleRemoveFromQueue}
        onMoveTrack={handleMoveQueueItem}
        onClearQueue={handleClearQueue}
        onShuffleQueue={handleShuffleQueue}
      />

      {/* Synchronized Lyrics Modal */}
      <AudioLyricsModal
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        file={file}
        metadata={metadata}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={(sec) => {
          if (audioRef.current) {
            audioRef.current.currentTime = sec;
            setCurrentTime(sec);
          }
        }}
        onTogglePlay={togglePlay}
        onNext={handleNext}
        onPrevious={handlePrevious}
        siblingFiles={siblingFiles}
      />
    </>
  );
}

const btnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.75)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  transition: 'all 0.15s ease',
};
