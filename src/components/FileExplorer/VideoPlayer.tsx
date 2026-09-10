// ============================================================
// VideoPlayer Component — High-performance HTML5 Video Player
// Eliminates re-mount flickering, handles MKV/unsupported codecs gracefully,
// and provides sleek modern cloud controls
// ============================================================
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Download, ExternalLink, AlertTriangle,
  RefreshCw, Check, SlidersHorizontal, Captions, Plus
} from 'lucide-react';
import { formatBytes } from '../../types';
import { getDownloadUrl } from '../../lib/api';
import { createSubtitleTrackUrl } from '../../lib/subtitle';

export interface VideoVariantItem {
  id: string;
  name: string;
  size_bytes?: number;
}

interface VideoPlayerProps {
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string | null;
  fileId?: string;
  variants?: VideoVariantItem[];
  currentResolution?: string;
  onSelectResolution?: (resolution: string, url: string) => void;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const VideoPlayer = React.memo(function VideoPlayer({
  url,
  fileName,
  fileSize = 0,
  mimeType,
  fileId,
  variants = [],
  currentResolution = '1080p',
  onSelectResolution,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [subtitles, setSubtitles] = useState<{ label: string; url: string }[]>([]);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const subInputRef = useRef<HTMLInputElement>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Position restore when switching resolution seamlessly
  const savedTimeRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);
  const prevUrlRef = useRef<string>(url);

  useEffect(() => {
    if (prevUrlRef.current !== url) {
      if (videoRef.current) {
        savedTimeRef.current = videoRef.current.currentTime;
        wasPlayingRef.current = !videoRef.current.paused;
      }
      prevUrlRef.current = url;
      setIsBuffering(true);
      setHasError(false);
    }
  }, [url]);

  const hideControlsTimer = useRef<number | null>(null);

  const isMkv = useMemo(() => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv' || (mimeType ? mimeType.includes('matroska') : false);
  }, [fileName, mimeType]);

  // Handle Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch((err) => {
        console.warn('Playback request failed:', err);
      });
    } else {
      video.pause();
    }
  }, []);

  // Handle Seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Forward / Rewind 10s
  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  }, [duration]);

  // Handle Volume Change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // Handle Playback Rate
  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  }, []);

  // Handle Fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Controls Auto-Hide
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);

    if (isPlaying) {
      hideControlsTimer.current = window.setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }, 2500);
    }
  }, [isPlaying]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        skip(-10);
      } else if (e.code === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        skip(10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(1, volume + 0.1);
        setVolume(next);
        if (videoRef.current) videoRef.current.volume = next;
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(0, volume - 0.1);
        setVolume(next);
        if (videoRef.current) videoRef.current.volume = next;
      } else if (e.key === 'm') {
        toggleMute();
      } else if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, volume, toggleMute, toggleFullscreen]);

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Track buffer
    const buf = videoRef.current.buffered;
    if (buf.length > 0) {
      setBufferedEnd(buf.end(buf.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsBuffering(false);
    setHasError(false);

    // Seamlessly restore playback position
    if (savedTimeRef.current > 0) {
      const targetTime = Math.min(savedTimeRef.current, videoRef.current.duration || savedTimeRef.current);
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      savedTimeRef.current = 0;
    }
    if (wasPlayingRef.current) {
      videoRef.current.play().catch(() => {});
      wasPlayingRef.current = false;
    }
  };

  const getVariantForRes = useCallback(
    (res: '720p' | '480p' | '360p') => {
      return variants?.find((v) => v.name.toLowerCase().includes(res));
    },
    [variants]
  );

  const handleResolutionClick = useCallback(
    (resLabel: string, targetUrl: string) => {
      if (videoRef.current) {
        savedTimeRef.current = videoRef.current.currentTime;
        wasPlayingRef.current = !videoRef.current.paused;
      }
      setShowQualityMenu(false);
      onSelectResolution?.(resLabel, targetUrl);
    },
    [onSelectResolution]
  );

  const handleSubtitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const trackUrl = await createSubtitleTrackUrl(file);
        const subName = file.name.replace(/\.[^/.]+$/, '');
        setSubtitles((prev) => {
          const next = [...prev, { label: subName, url: trackUrl }];
          setSelectedSubIndex(next.length - 1);
          return next;
        });
        setShowSubMenu(false);
      } catch (err) {
        console.error('Subtitle parse error:', err);
      }
      e.target.value = '';
    }
  };

  const handleVideoError = () => {
    setIsBuffering(false);
    setHasError(true);
    if (isMkv) {
      setErrorMessage(
        'Browser tidak mendukung format container .mkv atau codec anime 10-bit secara native. Silakan unduh file untuk diputar di VLC Player.'
      );
    } else {
      setErrorMessage(
        'Format video ini tidak dapat diputar langsung oleh browser. Silakan unduh file untuk menonton.'
      );
    }
  };

  const retryPlayback = () => {
    setHasError(false);
    setIsBuffering(true);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="cv-video-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '85vh',
        aspectRatio: '16/9',
        backgroundColor: '#000000',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* HTML5 Native Video Tag */}
      {!hasError && (
        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onError={handleVideoError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            cursor: 'pointer',
          }}
        >
          {selectedSubIndex >= 0 && subtitles[selectedSubIndex] && (
            <track
              key={subtitles[selectedSubIndex].url}
              kind="subtitles"
              src={subtitles[selectedSubIndex].url}
              srcLang="id"
              label={subtitles[selectedSubIndex].label}
              default
            />
          )}
        </video>
      )}

      {/* Buffering Spinner */}
      {isBuffering && !hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div
            className="cv-spinner"
            style={{
              width: 44,
              height: 44,
              borderWidth: 3,
              borderColor: 'rgba(56, 189, 248, 0.3)',
              borderTopColor: '#38bdf8',
            }}
          />
        </div>
      )}

      {/* Big Center Play/Pause Button on Hover / Pause */}
      {!isPlaying && !isBuffering && !hasError && (
        <button
          onClick={togglePlay}
          aria-label="Play video"
          style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.3)',
            transition: 'transform 0.2s, background 0.2s',
            zIndex: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = 'rgba(2, 132, 199, 0.85)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
          }}
        >
          <Play size={32} fill="white" style={{ marginLeft: 4 }} />
        </button>
      )}

      {/* MKV / Codec Error Fallback Screen */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#070b14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
            color: '#f8fafc',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertTriangle size={34} />
          </div>

          <h3 style={{ fontSize: 19, fontWeight: 600, marginBottom: 8, color: '#f8fafc' }}>
            {isMkv ? 'Format Video (.mkv) Memerlukan Pemutar Eksternal' : 'Format Video Tidak Didukung'}
          </h3>

          <p
            style={{
              fontSize: 13.5,
              color: '#94a3b8',
              maxWidth: 520,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {errorMessage}
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* If variants exist (e.g. 720p MP4), show button to switch to variant directly */}
            {variants && variants.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = variants[0];
                  const match = first.name.match(/(720p|480p|360p)/i);
                  const res = match ? match[1] : '720p';
                  handleResolutionClick(res, getDownloadUrl(first.id));
                  setHasError(false);
                  setIsBuffering(true);
                }}
                className="cv-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  boxShadow: '0 4px 20px rgba(2, 132, 199, 0.4)',
                }}
              >
                <Play size={16} fill="white" />
                Putar Resolusi {variants[0].name.match(/(720p|480p|360p)/i)?.[1] || 'Alternatif'} (MP4)
              </button>
            )}

            {/* If no variant exists yet, show worker processing message */}
            {(!variants || variants.length === 0) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontSize: 13.5,
                }}
              >
                <div className="cv-spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                <span>Format MP4 sedang diproses oleh Background Worker...</span>
              </div>
            )}

            <a
              href={url}
              download={fileName}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e8f0',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
            >
              <Download size={17} />
              Unduh File {fileSize > 0 ? `(${formatBytes(fileSize)})` : ''}
            </a>

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e8f0',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
            >
              <ExternalLink size={16} />
              Buka Streaming di Tab Baru
            </a>

            <button
              onClick={retryPlayback}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 13.5,
              }}
            >
              <RefreshCw size={15} />
              Coba Putar Lagi
            </button>
          </div>
        </div>
      )}

      {/* Sleek Custom Cloud Controls */}
      {!hasError && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            padding: '24px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: showControls || !isPlaying ? 1 : 0,
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
            transition: 'opacity 0.25s ease',
            zIndex: 8,
          }}
        >
          {/* Scrubber Range Slider with Buffer Bar */}
          <div style={{ position: 'relative', width: '100%', height: 6, display: 'flex', alignItems: 'center' }}>
            {/* Background track */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 4,
                borderRadius: 99,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }}
            />
            {/* Buffer bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${bufferPercent}%`,
                height: 4,
                borderRadius: 99,
                backgroundColor: 'rgba(255, 255, 255, 0.35)',
              }}
            />
            {/* Played progress bar */}
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
            {/* Invisible Range Input for scrubbing */}
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
                height: 16,
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2,
              }}
            />
          </div>

          {/* Controls Bottom Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={togglePlay}
                style={controlBtnStyle}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <button onClick={() => skip(-10)} style={controlBtnStyle} title="Rewind 10s">
                <RotateCcw size={17} />
              </button>
              <button onClick={() => skip(10)} style={controlBtnStyle} title="Forward 10s">
                <RotateCw size={17} />
              </button>

              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={toggleMute} style={controlBtnStyle} title="Mute (m)">
                  {isMuted || volume === 0 ? (
                    <VolumeX size={19} />
                  ) : volume < 0.5 ? (
                    <Volume1 size={19} />
                  ) : (
                    <Volume2 size={19} />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: 70,
                    height: 4,
                    accentColor: '#38bdf8',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Time Display */}
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, fontFamily: 'monospace' }}>
                <span>{formatTime(currentTime)}</span>
                <span style={{ opacity: 0.5, margin: '0 4px' }}>/</span>
                <span style={{ opacity: 0.75 }}>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              {/* Subtitle / CC Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubMenu(!showSubMenu);
                    setShowQualityMenu(false);
                    setShowSpeedMenu(false);
                  }}
                  style={{
                    ...controlBtnStyle,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: selectedSubIndex >= 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
                    color: selectedSubIndex >= 0 ? '#38bdf8' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Subtitle / Teks Terjemahan (CC)"
                >
                  <Captions size={14} />
                  <span>{selectedSubIndex >= 0 ? 'CC ON' : 'CC'}</span>
                </button>

                {showSubMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 36,
                      right: 0,
                      background: 'rgba(15, 23, 42, 0.96)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 12,
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 25,
                      backdropFilter: 'blur(16px)',
                      minWidth: 200,
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Subtitle (CC)
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubIndex(-1);
                        setShowSubMenu(false);
                      }}
                      style={{
                        background: selectedSubIndex === -1 ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: selectedSubIndex === -1 ? '#38bdf8' : '#e2e8f0',
                        border: 'none',
                        padding: '6px 8px',
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Matikan Subtitle (Off)</span>
                      {selectedSubIndex === -1 && <Check size={14} />}
                    </button>

                    {subtitles.map((sub, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedSubIndex(idx);
                          setShowSubMenu(false);
                        }}
                        style={{
                          background: selectedSubIndex === idx ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                          color: selectedSubIndex === idx ? '#38bdf8' : '#e2e8f0',
                          border: 'none',
                          padding: '6px 8px',
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.label}
                        </span>
                        {selectedSubIndex === idx && <Check size={14} />}
                      </button>
                    ))}

                    <div style={{ marginTop: 2, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <button
                        type="button"
                        onClick={() => subInputRef.current?.click()}
                        style={{
                          width: '100%',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          padding: '6px 8px',
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <Plus size={13} />
                        Muat File Subtitle (.srt/.vtt)
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={subInputRef}
                  type="file"
                  accept=".srt,.vtt"
                  style={{ display: 'none' }}
                  onChange={handleSubtitleUpload}
                />
              </div>

              {/* Quality / Resolution Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                  }}
                  style={{
                    ...controlBtnStyle,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: showQualityMenu ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
                    color: showQualityMenu ? '#38bdf8' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Pilih Resolusi Video"
                >
                  <SlidersHorizontal size={13} />
                  <span>{currentResolution || '1080p'}</span>
                </button>

                {showQualityMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 36,
                      right: 0,
                      background: 'rgba(15, 23, 42, 0.96)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 12,
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 25,
                      backdropFilter: 'blur(16px)',
                      minWidth: 230,
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Kualitas Video
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        Pilih resolusi streaming
                      </div>
                    </div>

                    {/* 1080p / Original Option */}
                    <button
                      type="button"
                      onClick={() => fileId && handleResolutionClick('1080p', getDownloadUrl(fileId))}
                      style={{
                        background:
                          !currentResolution || currentResolution === '1080p' || currentResolution === 'Original'
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'transparent',
                        color:
                          !currentResolution || currentResolution === '1080p' || currentResolution === 'Original'
                            ? '#38bdf8'
                            : '#e2e8f0',
                        border: 'none',
                        padding: '6px 8px',
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>1080p (Asli / Full HD)</div>
                        {fileSize > 0 && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{formatBytes(fileSize)}</div>}
                      </div>
                      {(!currentResolution || currentResolution === '1080p' || currentResolution === 'Original') && (
                        <Check size={14} />
                      )}
                    </button>

                    {/* Standard Resolutions: 720p, 480p, 360p */}
                    {(['720p', '480p', '360p'] as const).map((res) => {
                      const variant = getVariantForRes(res);
                      const isActive = currentResolution === res;
                      const resLabels = {
                        '720p': '720p (HD Ringan)',
                        '480p': '480p (SD Standar)',
                        '360p': '360p (Hemat Kuota)',
                      };

                      if (variant) {
                        return (
                          <button
                            key={res}
                            type="button"
                            onClick={() => handleResolutionClick(res, getDownloadUrl(variant.id))}
                            style={{
                              background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                              color: isActive ? '#38bdf8' : '#e2e8f0',
                              border: 'none',
                              padding: '6px 8px',
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              textAlign: 'left',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>{resLabels[res]}</div>
                              {variant.size_bytes && variant.size_bytes > 0 && (
                                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{formatBytes(variant.size_bytes)}</div>
                              )}
                            </div>
                            {isActive && <Check size={14} />}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={res}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            opacity: 0.75,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>{resLabels[res]}</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Menyiapkan...</div>
                          </div>
                          <span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                            Auto-Worker
                          </span>
                        </div>
                      );
                    })}

                    {/* Any other variants that don't match 720/480/360 */}
                    {variants
                      ?.filter(
                        (v) =>
                          !v.name.toLowerCase().includes('720p') &&
                          !v.name.toLowerCase().includes('480p') &&
                          !v.name.toLowerCase().includes('360p')
                      )
                      .map((v) => {
                        const isActive = currentResolution === v.name;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleResolutionClick(v.name, getDownloadUrl(v.id))}
                            style={{
                              background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                              color: isActive ? '#38bdf8' : '#e2e8f0',
                              border: 'none',
                              padding: '6px 8px',
                              borderRadius: 8,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{v.name}</span>
                            {isActive && <Check size={14} />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Playback Speed */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                  }}
                  style={{
                    ...controlBtnStyle,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: showSpeedMenu ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
                    color: showSpeedMenu ? '#38bdf8' : '#e2e8f0',
                  }}
                  title="Playback Speed"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 36,
                      right: 0,
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: 10,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 20,
                      backdropFilter: 'blur(10px)',
                      minWidth: 90,
                    }}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        style={{
                          background: playbackRate === rate ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          color: playbackRate === rate ? '#38bdf8' : '#e2e8f0',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                style={controlBtnStyle}
                title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}
              >
                {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const controlBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#e2e8f0',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.2s, background 0.2s',
};
