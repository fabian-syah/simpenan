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
  // Dual-Video Seamless Hot-Swap Architecture (YouTube-style instant switching)
  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [url0, setUrl0] = useState<string>(url);
  const [url1, setUrl1] = useState<string>('');

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

  // Seamless Hot-Swap State
  const [isSwitchingRes, setIsSwitchingRes] = useState(false);
  const [targetResLabel, setTargetResLabel] = useState<string | null>(null);
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);
  const [triggerSuccessMsg, setTriggerSuccessMsg] = useState<string | null>(null);

  // Position restore when mounting initial file
  const savedTimeRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);
  const prevPropUrlRef = useRef<string>(url);

  // Helper to get active and standby video elements
  const getActiveVideo = useCallback(() => {
    return activeSlot === 0 ? videoRef0.current : videoRef1.current;
  }, [activeSlot]);


  // Sync with prop URL when a different file is selected
  useEffect(() => {
    if (url && url !== prevPropUrlRef.current) {
      prevPropUrlRef.current = url;
      // If neither slot matches the new URL, reset to slot 0
      if (url0 !== url && url1 !== url) {
        setUrl0(url);
        setUrl1('');
        setActiveSlot(0);
        setIsBuffering(true);
        setHasError(false);
        setIsSwitchingRes(false);
        setTargetResLabel(null);
      }
    }
  }, [url, url0, url1]);

  const hideControlsTimer = useRef<number | null>(null);

  const isMkv = useMemo(() => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv' || (mimeType ? mimeType.includes('matroska') : false);
  }, [fileName, mimeType]);

  // Handle Play/Pause on Active Video
  const togglePlay = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch((err) => {
        console.warn('Playback request failed:', err);
      });
    } else {
      video.pause();
    }
  }, [getActiveVideo]);

  // Handle Seek on Active Video
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const video = getActiveVideo();
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  }, [getActiveVideo]);

  // Forward / Rewind 10s
  const skip = useCallback((seconds: number) => {
    const video = getActiveVideo();
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    }
  }, [getActiveVideo, duration]);

  // Handle Volume Change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const video = getActiveVideo();
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  }, [getActiveVideo]);

  const toggleMute = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      video.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [getActiveVideo, isMuted, volume]);

  // Handle Playback Rate
  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    const video = getActiveVideo();
    if (video) {
      video.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  }, [getActiveVideo]);

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
        const video = getActiveVideo();
        if (video) video.volume = next;
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(0, volume - 0.1);
        setVolume(next);
        const video = getActiveVideo();
        if (video) video.volume = next;
      } else if (e.key === 'm') {
        toggleMute();
      } else if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, volume, toggleMute, toggleFullscreen, getActiveVideo]);

  // Track video events for both slots
  const handleVideoPlay = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsPlaying(true);
    }
  };

  const handleVideoPause = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsPlaying(false);
    }
  };

  const handleVideoTimeUpdate = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      const vid = slot === 0 ? videoRef0.current : videoRef1.current;
      if (!vid) return;
      setCurrentTime(vid.currentTime);
      const buf = vid.buffered;
      if (buf.length > 0) {
        setBufferedEnd(buf.end(buf.length - 1));
      }
    }
  };

  const handleVideoWaiting = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsBuffering(true);
    }
  };

  const handleVideoPlaying = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsBuffering(false);
    }
  };

  const handleVideoLoadedMetadata = (slot: 0 | 1) => {
    const vid = slot === 0 ? videoRef0.current : videoRef1.current;
    if (!vid) return;

    if (slot === activeSlot) {
      setDuration(vid.duration);
      setIsBuffering(false);
      setHasError(false);

      if (savedTimeRef.current > 0) {
        const target = Math.min(savedTimeRef.current, vid.duration || savedTimeRef.current);
        vid.currentTime = target;
        setCurrentTime(target);
        savedTimeRef.current = 0;
      }
      if (wasPlayingRef.current) {
        vid.play().catch(() => {});
        wasPlayingRef.current = false;
      }
    } else {
      // Standby video loaded metadata: align currentTime with active video
      const activeVid = getActiveVideo();
      if (activeVid) {
        vid.currentTime = activeVid.currentTime;
        vid.playbackRate = activeVid.playbackRate;
        vid.muted = true; // Stay muted until swap
      }
    }
  };

  // Perform seamless hot-swap when standby video has buffered frames
  const performHotSwap = useCallback((standbySlot: 0 | 1) => {
    if (!isSwitchingRes) return;

    const standbyVid = standbySlot === 0 ? videoRef0.current : videoRef1.current;
    const activeVid = activeSlot === 0 ? videoRef0.current : videoRef1.current;
    if (!standbyVid || !activeVid) return;

    // Sync precise timestamp right before handoff
    standbyVid.currentTime = activeVid.currentTime;
    standbyVid.playbackRate = activeVid.playbackRate;

    const wasActivePlaying = !activeVid.paused && !activeVid.ended;

    if (wasActivePlaying) {
      standbyVid.muted = activeVid.muted;
      standbyVid.volume = activeVid.volume;
      standbyVid.play().then(() => {
        // Standby playing successfully: pause active and swap
        activeVid.pause();
        activeVid.muted = true;
        setActiveSlot(standbySlot);
        setIsSwitchingRes(false);
        if (targetResLabel) {
          onSelectResolution?.(targetResLabel, standbyVid.src);
          setTargetResLabel(null);
        }
      }).catch((playErr) => {
        console.warn('Standby play error, executing fallback swap:', playErr);
        activeVid.pause();
        setActiveSlot(standbySlot);
        setIsSwitchingRes(false);
        if (targetResLabel) {
          onSelectResolution?.(targetResLabel, standbyVid.src);
          setTargetResLabel(null);
        }
      });
    } else {
      // Was paused: simply transfer state and swap
      standbyVid.muted = activeVid.muted;
      standbyVid.volume = activeVid.volume;
      standbyVid.pause();
      activeVid.muted = true;
      setActiveSlot(standbySlot);
      setIsSwitchingRes(false);
      if (targetResLabel) {
        onSelectResolution?.(targetResLabel, standbyVid.src);
        setTargetResLabel(null);
      }
    }
  }, [isSwitchingRes, activeSlot, targetResLabel, onSelectResolution]);

  const handleVideoCanPlay = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsBuffering(false);
    } else if (isSwitchingRes) {
      performHotSwap(slot);
    }
  };

  const handleVideoSeeked = (slot: 0 | 1) => {
    if (slot !== activeSlot && isSwitchingRes) {
      performHotSwap(slot);
    }
  };

  const handleVideoError = (slot: 0 | 1) => {
    if (slot === activeSlot) {
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
    } else if (isSwitchingRes) {
      console.warn('Standby video failed to load, cancelling hot-swap');
      setIsSwitchingRes(false);
      setTargetResLabel(null);
    }
  };

  const retryPlayback = () => {
    setHasError(false);
    setIsBuffering(true);
    const video = getActiveVideo();
    if (video) {
      video.load();
      video.play().catch(() => {});
    }
  };

  const getVariantForRes = useCallback(
    (res: '720p' | '480p' | '360p') => {
      return variants?.find((v) => v.name.toLowerCase().includes(res));
    },
    [variants]
  );

  const autoRecommendedRes = useMemo(() => {
    if (!variants || variants.length === 0) return '1080p';
    const has720 = variants.some((v) => v.name.toLowerCase().includes('720p'));
    if (has720) return '720p';
    const has480 = variants.some((v) => v.name.toLowerCase().includes('480p'));
    if (has480) return '480p';
    const has360 = variants.some((v) => v.name.toLowerCase().includes('360p'));
    if (has360) return '360p';
    return '1080p';
  }, [variants]);

  const handleResolutionClick = useCallback(
    (resLabel: string, targetUrl: string, isAutoChoice = false) => {
      setShowQualityMenu(false);
      setIsAutoQuality(isAutoChoice);

      const activeVid = getActiveVideo();
      const currentSlotUrl = activeSlot === 0 ? url0 : url1;

      // If already playing this URL, just report resolution
      if (targetUrl === currentSlotUrl) {
        onSelectResolution?.(resLabel, targetUrl);
        return;
      }

      // If active video has error or not yet loaded, perform direct swap
      if (hasError || !activeVid || activeVid.readyState < 2) {
        savedTimeRef.current = activeVid ? activeVid.currentTime : 0;
        wasPlayingRef.current = activeVid ? !activeVid.paused : false;
        if (activeSlot === 0) {
          setUrl0(targetUrl);
        } else {
          setUrl1(targetUrl);
        }
        setIsBuffering(true);
        setHasError(false);
        onSelectResolution?.(resLabel, targetUrl);
        return;
      }

      // INSTANT HOT-SWAP (Active video KEPT PLAYING uninterrupted):
      setIsSwitchingRes(true);
      setTargetResLabel(resLabel);

      const standbySlot = activeSlot === 0 ? 1 : 0;
      if (standbySlot === 0) {
        setUrl0(targetUrl);
      } else {
        setUrl1(targetUrl);
      }
    },
    [activeSlot, url0, url1, hasError, getActiveVideo, onSelectResolution]
  );

  const triggerCloudTranscode = useCallback(async () => {
    if (!fileId || isTriggeringWorker) return;
    setIsTriggeringWorker(true);
    setTriggerSuccessMsg(null);
    try {
      const res = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_transcode', fileId }),
      });
      const data = await res.json();
      if (data.triggered) {
        setTriggerSuccessMsg('⚡ Cloud Worker GitHub Actions berhasil dijalankan!');
      } else {
        setTriggerSuccessMsg('⏰ Worker otomatis berjalan via cron 5 menit cloud.');
      }
      setTimeout(() => setTriggerSuccessMsg(null), 6000);
    } catch {
      setTriggerSuccessMsg('Worker dijadwalkan via cron cloud.');
      setTimeout(() => setTriggerSuccessMsg(null), 4000);
    } finally {
      setIsTriggeringWorker(false);
    }
  }, [fileId, isTriggeringWorker]);

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
      {/* Dual Video Elements: Slot 0 and Slot 1 for instant, seamless hot-swap */}
      {!hasError && (
        <>
          {/* Video Slot 0 */}
          <video
            ref={videoRef0}
            src={url0 || undefined}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => handleVideoPlay(0)}
            onPause={() => handleVideoPause(0)}
            onTimeUpdate={() => handleVideoTimeUpdate(0)}
            onLoadedMetadata={() => handleVideoLoadedMetadata(0)}
            onCanPlay={() => handleVideoCanPlay(0)}
            onSeeked={() => handleVideoSeeked(0)}
            onWaiting={() => handleVideoWaiting(0)}
            onPlaying={() => handleVideoPlaying(0)}
            onError={() => handleVideoError(0)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              cursor: 'pointer',
              opacity: activeSlot === 0 ? 1 : 0,
              pointerEvents: activeSlot === 0 ? 'auto' : 'none',
              zIndex: activeSlot === 0 ? 2 : 1,
              transition: 'opacity 0.15s ease-in-out',
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

          {/* Video Slot 1 */}
          <video
            ref={videoRef1}
            src={url1 || undefined}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => handleVideoPlay(1)}
            onPause={() => handleVideoPause(1)}
            onTimeUpdate={() => handleVideoTimeUpdate(1)}
            onLoadedMetadata={() => handleVideoLoadedMetadata(1)}
            onCanPlay={() => handleVideoCanPlay(1)}
            onSeeked={() => handleVideoSeeked(1)}
            onWaiting={() => handleVideoWaiting(1)}
            onPlaying={() => handleVideoPlaying(1)}
            onError={() => handleVideoError(1)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              cursor: 'pointer',
              opacity: activeSlot === 1 ? 1 : 0,
              pointerEvents: activeSlot === 1 ? 'auto' : 'none',
              zIndex: activeSlot === 1 ? 2 : 1,
              transition: 'opacity 0.15s ease-in-out',
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
        </>
      )}

      {/* Buffering Spinner: Only displayed if the active video is actually stalling, NOT during seamless background hot-swap */}
      {isBuffering && !isSwitchingRes && !hasError && (
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

              {/* Quality / Resolution Selector (YouTube-style with Auto and instant hot-swap) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                  }}
                  style={{
                    ...controlBtnStyle,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: showQualityMenu || isSwitchingRes ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
                    color: showQualityMenu || isSwitchingRes ? '#38bdf8' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Pilih Resolusi Video (YouTube-Style)"
                >
                  <SlidersHorizontal size={13} />
                  <span>
                    {isSwitchingRes && targetResLabel ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="cv-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                        <span>{targetResLabel}</span>
                      </span>
                    ) : isAutoQuality ? (
                      `Auto (${currentResolution || autoRecommendedRes})`
                    ) : (
                      currentResolution || '1080p'
                    )}
                  </span>
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
                      minWidth: 240,
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Kualitas Video
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
                        Ganti resolusi instan tanpa henti
                      </div>
                    </div>

                    {/* YouTube-style Auto (Optimal) Option */}
                    <button
                      type="button"
                      onClick={() => {
                        let bestUrl = fileId ? getDownloadUrl(fileId) : url;
                        let bestLabel = '1080p';
                        const v720 = getVariantForRes('720p');
                        if (v720) {
                          bestUrl = getDownloadUrl(v720.id);
                          bestLabel = '720p';
                        } else {
                          const v480 = getVariantForRes('480p');
                          if (v480) {
                            bestUrl = getDownloadUrl(v480.id);
                            bestLabel = '480p';
                          }
                        }
                        handleResolutionClick(bestLabel, bestUrl, true);
                      }}
                      style={{
                        background: isAutoQuality ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: isAutoQuality ? '#38bdf8' : '#e2e8f0',
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
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Otomatis / Auto</span>
                          <span style={{ fontSize: 9.5, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            REKOMENDASI
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          Kualitas optimal otomatis ({autoRecommendedRes})
                        </div>
                      </div>
                      {isAutoQuality && <Check size={14} />}
                    </button>

                    {/* 1080p / Original Option */}
                    <button
                      type="button"
                      onClick={() => fileId && handleResolutionClick('1080p', getDownloadUrl(fileId), false)}
                      style={{
                        background:
                          !isAutoQuality && (currentResolution === '1080p' || currentResolution === 'Original')
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'transparent',
                        color:
                          !isAutoQuality && (currentResolution === '1080p' || currentResolution === 'Original')
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
                      {!isAutoQuality && (currentResolution === '1080p' || currentResolution === 'Original') && (
                        <Check size={14} />
                      )}
                    </button>

                    {/* Standard Resolutions: 720p, 480p, 360p */}
                    {(['720p', '480p', '360p'] as const).map((res) => {
                      const variant = getVariantForRes(res);
                      const isActive = !isAutoQuality && currentResolution === res;
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
                            onClick={() => handleResolutionClick(res, getDownloadUrl(variant.id), false)}
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
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Menyiapkan di Cloud Worker...</div>
                          </div>
                          <span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                            Auto-Worker
                          </span>
                        </div>
                      );
                    })}

                    {/* Any other custom variants */}
                    {variants
                      ?.filter(
                        (v) =>
                          !v.name.toLowerCase().includes('720p') &&
                          !v.name.toLowerCase().includes('480p') &&
                          !v.name.toLowerCase().includes('360p')
                      )
                      .map((v) => {
                        const isActive = !isAutoQuality && currentResolution === v.name;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleResolutionClick(v.name, getDownloadUrl(v.id), false)}
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

                    {/* Missing variants accelerator button */}
                    {variants.length < 3 && (
                      <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <button
                          type="button"
                          onClick={triggerCloudTranscode}
                          disabled={isTriggeringWorker}
                          style={{
                            width: '100%',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            padding: '6px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: isTriggeringWorker ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          {isTriggeringWorker ? (
                            <>
                              <div className="cv-spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} />
                              <span>Memicu Worker Cloud...</span>
                            </>
                          ) : (
                            <>
                              <span>⚡</span>
                              <span>Percepat Transcode Cloud</span>
                            </>
                          )}
                        </button>
                        {triggerSuccessMsg && (
                          <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 4, textAlign: 'center', lineHeight: 1.3 }}>
                            {triggerSuccessMsg}
                          </div>
                        )}
                      </div>
                    )}
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
