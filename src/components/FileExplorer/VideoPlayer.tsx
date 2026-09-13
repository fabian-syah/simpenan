// ============================================================
// VideoPlayer Component — High-performance HTML5 Video Player
// Eliminates re-mount flickering, handles MKV/unsupported codecs gracefully,
// and provides sleek modern cloud controls
// ============================================================
import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle } from 'react';
import {
  Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Download, ExternalLink, AlertTriangle,
  RefreshCw, Check, SlidersHorizontal, Captions, Plus,
  PictureInPicture2, Moon, Timer, Type, Palette,
  Minimize2, Maximize2, X, Settings, ChevronRight, ArrowLeft, MessageSquarePlus
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
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onSwitchToGDrivePlayer?: () => void;
  onReportIssue?: (errorMsg: string) => void;
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

const mobileMenuItemStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  color: '#e2e8f0',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 13.5,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  textAlign: 'left',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

export interface SleepTimerHandle {
  setChoice: (choice: number | 'end' | null) => void;
  getStatus: () => string;
}

interface SleepTimerControlProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onTimerExpired: () => void;
  onSelectEndMode: (enabled: boolean) => void;
}

// Self-contained SleepTimerControl so 1s interval does NOT re-render the VideoPlayer or video element
const SleepTimerControl = React.forwardRef<SleepTimerHandle, SleepTimerControlProps>(
  function SleepTimerControl(
    { isOpen, onToggle, onClose, onTimerExpired, onSelectEndMode },
    ref
  ) {
    const [option, setOption] = useState<number | 'end' | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    const isTimerRunning = secondsLeft !== null;

    useEffect(() => {
      if (!isTimerRunning) return;

      const interval = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            onTimerExpired();
            setOption(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [isTimerRunning, onTimerExpired]);

    const selectOption = useCallback((choice: number | 'end' | null) => {
      setOption(choice);
      onClose();
      if (choice === 'end') {
        onSelectEndMode(true);
        setSecondsLeft(null);
      } else if (typeof choice === 'number') {
        onSelectEndMode(false);
        setSecondsLeft(choice * 60);
      } else {
        onSelectEndMode(false);
        setSecondsLeft(null);
      }
    }, [onClose, onSelectEndMode]);

    const formattedTime =
      secondsLeft !== null
        ? `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`
        : option === 'end'
        ? 'End'
        : 'Timer';

    useImperativeHandle(ref, () => ({
      setChoice: selectOption,
      getStatus: () => (secondsLeft !== null ? formattedTime : option === 'end' ? 'End' : 'Mati'),
    }), [selectOption, formattedTime, secondsLeft, option]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...controlBtnStyle,
          fontSize: 12,
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 6,
          background: option !== null ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
          color: option !== null ? '#38bdf8' : '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
        title="Sleep Timer Video"
      >
        <Moon size={14} />
        <span>{formattedTime}</span>
      </button>

      {isOpen && (
        <div
          className="cv-video-popup-menu"
          style={{
            minWidth: 175,
          }}
        >
          <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#38bdf8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Timer size={13} />
              <span>Sleep Timer</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
              Jeda video otomatis saat tidur
            </div>
          </div>

          {[
            { label: 'Nonaktif (Off)', value: null },
            { label: '15 Menit', value: 15 },
            { label: '30 Menit', value: 30 },
            { label: '45 Menit', value: 45 },
            { label: '60 Menit (1 Jam)', value: 60 },
            { label: 'Saat Video Selesai', value: 'end' as const },
          ].map((opt) => {
            const isActive = option === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => selectOption(opt.value)}
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
                }}
              >
                <span>{opt.label}</span>
                {isActive && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export const VideoPlayer = React.memo(function VideoPlayer({
  url,
  fileName,
  fileSize = 0,
  mimeType,
  fileId,
  variants = [],
  currentResolution = '1080p',
  onSelectResolution,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  onFullscreenChange,
  onSwitchToGDrivePlayer,
  onReportIssue,
}: VideoPlayerProps) {
  // Dual-Video Seamless Hot-Swap Architecture (YouTube-style instant switching)
  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMiniHovered, setIsMiniHovered] = useState(false);

  const isMkv = useMemo(() => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv' || (mimeType ? mimeType.includes('matroska') : false);
  }, [fileName, mimeType]);

  // Initial URL: for MKV files, start with the 720p/480p MP4 variant if available to prevent unplayable MKV errors
  const initialPlayableUrl = useMemo(() => {
    if (isMkv && variants && variants.length > 0) {
      const best =
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('720p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('480p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('360p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4'));
      if (best) return getDownloadUrl(best.id);
    }
    return url;
  }, [isMkv, variants, url]);

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [url0, setUrl0] = useState<string>(initialPlayableUrl);
  const [url1, setUrl1] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const isPlayerFullscreen = isFullscreen || isMobileFullscreen;

  // Track viewport dimensions for seamless auto-rotation
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isMobile = useMemo(() => {
    return windowSize.width <= 768 || windowSize.height <= 500;
  }, [windowSize.width, windowSize.height]);

  const isPortrait = useMemo(() => {
    return windowSize.height > windowSize.width;
  }, [windowSize.width, windowSize.height]);

  // Mobile auto-rotate to landscape (defaults to true for immersive fullscreen)
  const [isForcedLandscape, setIsForcedLandscape] = useState(true);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover' | 'fill'>('cover');

  const shouldRotateLandscape = useMemo(() => {
    return isPlayerFullscreen && isMobile && isPortrait && isForcedLandscape;
  }, [isPlayerFullscreen, isMobile, isPortrait, isForcedLandscape]);

  useEffect(() => {
    onFullscreenChange?.(isPlayerFullscreen);
  }, [isPlayerFullscreen, onFullscreenChange]);

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

  // Position restore when mounting initial file
  const savedTimeRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);
  const activeFileKey = fileId || fileName;
  const prevFileKeyRef = useRef<string>(activeFileKey);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const autoPlayedForFileRef = useRef<string | null>(null);

  // Auto-Remember Playback Position State
  const playbackStorageKey = useMemo(() => `cv_playback_pos_${fileId || fileName}`, [fileId, fileName]);
  const [resumeToast, setResumeToast] = useState<{ time: number; formatted: string } | null>(null);
  const resumeDismissTimerRef = useRef<number | null>(null);
  const hasCheckedResumeRef = useRef(false);
  const lastSavedTimeRef = useRef(0);

  // Picture-in-Picture (PiP) State
  const isPipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  const [isPipActive, setIsPipActive] = useState(false);

  // Sleep Timer State (Isolated in SleepTimerControl to prevent root re-renders)
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [isSleepOverlayActive, setIsSleepOverlayActive] = useState(false);
  const isSleepEndModeRef = useRef(false);
  const sleepTimerRef = useRef<SleepTimerHandle>(null);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [mobileSettingsView, setMobileSettingsView] = useState<'root' | 'quality' | 'speed' | 'sleep' | 'subtitle'>('root');

  // Subtitle Customization State (Sync & Styling)
  const [subTab, setSubTab] = useState<'tracks' | 'sync' | 'style'>('tracks');
  const [subDelay, setSubDelay] = useState<number>(0);
  const [subFontSize, setSubFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const s = localStorage.getItem('cv_sub_size');
      return (s as 'small' | 'medium' | 'large') || 'medium';
    } catch {
      return 'medium';
    }
  });
  const [subColor, setSubColor] = useState<string>(() => {
    try {
      return localStorage.getItem('cv_sub_color') || '#ffffff';
    } catch {
      return '#ffffff';
    }
  });
  const [subBg, setSubBg] = useState<'translucent' | 'solid' | 'none'>(() => {
    try {
      const s = localStorage.getItem('cv_sub_bg');
      return (s as 'translucent' | 'solid' | 'none') || 'translucent';
    } catch {
      return 'translucent';
    }
  });

  // Helper to get active and standby video elements
  const getActiveVideo = useCallback(() => {
    return activeSlot === 0 ? videoRef0.current : videoRef1.current;
  }, [activeSlot]);

  // Sync with prop when a DIFFERENT file is selected
  useEffect(() => {
    if (activeFileKey && activeFileKey !== prevFileKeyRef.current) {
      prevFileKeyRef.current = activeFileKey;
      hasCheckedResumeRef.current = false;
      setResumeToast(null);
      setSubDelay(0);
      setFailedUrls([]);
      autoPlayedForFileRef.current = null;
      setUrl0(initialPlayableUrl);
      setUrl1('');
      setActiveSlot(0);
      setIsBuffering(true);
      setHasError(false);
      setIsSwitchingRes(false);
      setTargetResLabel(null);
    }
  }, [activeFileKey, initialPlayableUrl]);

  const hideControlsTimer = useRef<number | null>(null);

  // Auto-play MP4 variant for MKV/unsupported codecs once variants become available (runs once per file)
  useEffect(() => {
    if (!variants || variants.length === 0) return;
    const fileKey = `${fileId || fileName}`;
    if (autoPlayedForFileRef.current === fileKey) return;

    if (isMkv) {
      const best =
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('720p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('480p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('360p')) ||
        variants.find((v) => v.name.toLowerCase().endsWith('.mp4'));

      if (best) {
        const bestUrl = getDownloadUrl(best.id);
        const match = best.name.match(/(720p|480p|360p)/i);
        const resLabel = match ? match[1] : '720p';

        autoPlayedForFileRef.current = fileKey;
        console.log('[VideoPlayer] Auto-selected playable MP4 variant:', best.name);
        setUrl0(bestUrl);
        setUrl1('');
        setActiveSlot(0);
        setHasError(false);
        setIsBuffering(true);
        onSelectResolution?.(resLabel, bestUrl);
      }
    }
  }, [isMkv, variants, fileId, fileName, onSelectResolution]);

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

  // Handle Fullscreen (Responsive: Auto-Rotate Landscape In-App Fullscreen on Mobile, Native Fullscreen on Desktop)
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = getActiveVideo();
    const isIos =
      typeof navigator !== 'undefined' &&
      (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const isMob = window.innerWidth <= 768 || window.innerHeight <= 500;
    const isLandscape = window.innerWidth > window.innerHeight;

    // 1. On iOS Safari:
    // If user is already in landscape or requests native fullscreen, webkitEnterFullscreen removes Safari address bar 100%!
    if (isIos && isLandscape && video && typeof (video as any).webkitEnterFullscreen === 'function') {
      try {
        if ((video as any).webkitDisplayingFullscreen) {
          if (typeof (video as any).webkitExitFullscreen === 'function') {
            (video as any).webkitExitFullscreen();
          }
          setIsFullscreen(false);
          setIsMobileFullscreen(false);
        } else {
          (video as any).webkitEnterFullscreen();
          setIsFullscreen(true);
        }
        return;
      } catch (err) {
        console.warn('[VideoPlayer] iOS webkitEnterFullscreen error:', err);
      }
    }

    if (isMob) {
      setIsMobileFullscreen((prev) => {
        const next = !prev;
        if (next) {
          setIsForcedLandscape(true);
          setVideoFit('cover');
          if (container?.requestFullscreen) {
            container.requestFullscreen().catch(() => {});
          }
          if (screen.orientation && 'lock' in screen.orientation) {
            try {
              (screen.orientation as any).lock('landscape').catch(() => {});
            } catch {}
          }
        } else {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          if (screen.orientation && 'unlock' in screen.orientation) {
            try {
              (screen.orientation as any).unlock();
            } catch {}
          }
        }
        return next;
      });
    } else {
      if (!document.fullscreenElement) {
        container?.requestFullscreen().catch(() => {
          setIsMobileFullscreen(true);
          setIsForcedLandscape(true);
        });
      } else {
        document.exitFullscreen().catch(() => {});
        setIsMobileFullscreen(false);
      }
    }
  }, []);

  // Listen for iOS native webkit fullscreen events
  useEffect(() => {
    const v0 = videoRef0.current;
    const v1 = videoRef1.current;

    const handleEnter = () => {
      setIsFullscreen(true);
      onFullscreenChange?.(true);
    };
    const handleExit = () => {
      setIsFullscreen(false);
      setIsMobileFullscreen(false);
      onFullscreenChange?.(false);
    };

    v0?.addEventListener('webkitbeginfullscreen', handleEnter);
    v0?.addEventListener('webkitendfullscreen', handleExit);
    v1?.addEventListener('webkitbeginfullscreen', handleEnter);
    v1?.addEventListener('webkitendfullscreen', handleExit);

    return () => {
      v0?.removeEventListener('webkitbeginfullscreen', handleEnter);
      v0?.removeEventListener('webkitendfullscreen', handleExit);
      v1?.removeEventListener('webkitbeginfullscreen', handleEnter);
      v1?.removeEventListener('webkitendfullscreen', handleExit);
    };
  }, [onFullscreenChange]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        if (window.innerWidth > 768) {
          setIsMobileFullscreen(false);
        }
        if (screen.orientation && 'unlock' in screen.orientation) {
          try { (screen.orientation as any).unlock(); } catch {}
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileFullscreen) {
        setIsMobileFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isMobileFullscreen]);

  // Controls Auto-Hide
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);

    if (showSpeedMenu || showQualityMenu || showSubMenu || showSleepMenu) {
      return;
    }

    if (isPlaying) {
      hideControlsTimer.current = window.setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
        setShowSubMenu(false);
        setShowSleepMenu(false);
      }, 2500);
    }
  }, [isPlaying, showSpeedMenu, showQualityMenu, showSubMenu, showSleepMenu]);

  // Toggle Picture-in-Picture
  const togglePip = useCallback(async () => {
    const video = getActiveVideo();
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }, [getActiveVideo]);

  // PiP event listeners
  useEffect(() => {
    const v0 = videoRef0.current;
    const v1 = videoRef1.current;
    const onEnter = () => {
      setIsPipActive(true);
      onToggleMinimize?.(true);
    };
    const onLeave = () => {
      setIsPipActive(false);
    };

    v0?.addEventListener('enterpictureinpicture', onEnter);
    v0?.addEventListener('leavepictureinpicture', onLeave);
    v1?.addEventListener('enterpictureinpicture', onEnter);
    v1?.addEventListener('leavepictureinpicture', onLeave);

    return () => {
      v0?.removeEventListener('enterpictureinpicture', onEnter);
      v0?.removeEventListener('leavepictureinpicture', onLeave);
      v1?.removeEventListener('enterpictureinpicture', onEnter);
      v1?.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [onToggleMinimize]);

  // Miniplayer Expand and Close Handlers
  const handleExpand = useCallback(async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {}
    }
    onToggleMinimize?.(false);
  }, [onToggleMinimize]);

  const handleCloseVideo = useCallback(async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {}
    }
    const video = getActiveVideo();
    if (video) video.pause();
    setIsPlaying(false);
    onClose?.();
  }, [getActiveVideo, onClose]);

  // Sleep Timer Expiration Handler
  const handleSleepTimerExpired = useCallback(() => {
    const vid = getActiveVideo();
    if (vid) vid.pause();
    setIsPlaying(false);
    setIsSleepOverlayActive(true);
  }, [getActiveVideo]);

  // Subtitle Delay and Style Handlers
  const adjustSubDelay = useCallback((delta: number) => {
    setSubDelay((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      [videoRef0.current, videoRef1.current].forEach((vid) => {
        if (!vid) return;
        for (let t = 0; t < vid.textTracks.length; t++) {
          const track = vid.textTracks[t];
          if (track && track.cues) {
            for (let c = 0; c < track.cues.length; c++) {
              const cue = track.cues[c] as VTTCue;
              if (cue) {
                cue.startTime = Math.max(0, cue.startTime + delta);
                cue.endTime = Math.max(0, cue.endTime + delta);
              }
            }
          }
        }
      });
      return next;
    });
  }, []);

  const resetSubDelay = useCallback(() => {
    adjustSubDelay(-subDelay);
    setSubDelay(0);
  }, [adjustSubDelay, subDelay]);

  const changeSubFontSize = useCallback((size: 'small' | 'medium' | 'large') => {
    setSubFontSize(size);
    try { localStorage.setItem('cv_sub_size', size); } catch {}
  }, []);

  const changeSubColor = useCallback((color: string) => {
    setSubColor(color);
    try { localStorage.setItem('cv_sub_color', color); } catch {}
  }, []);

  const changeSubBg = useCallback((bg: 'translucent' | 'solid' | 'none') => {
    setSubBg(bg);
    try { localStorage.setItem('cv_sub_bg', bg); } catch {}
  }, []);

  // Restart playback from beginning
  const handleRestartFromBeginning = useCallback(() => {
    try {
      localStorage.removeItem(playbackStorageKey);
    } catch {}
    const vid = getActiveVideo();
    if (vid) {
      vid.currentTime = 0;
      setCurrentTime(0);
    }
    setResumeToast(null);
  }, [getActiveVideo, playbackStorageKey]);

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
      } else if (e.key === 'p' && isPipSupported) {
        e.preventDefault();
        togglePip();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        onToggleMinimize?.(!isMinimized);
      } else if (e.key === '[') {
        e.preventDefault();
        adjustSubDelay(-0.5);
      } else if (e.key === ']') {
        e.preventDefault();
        adjustSubDelay(0.5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, volume, toggleMute, toggleFullscreen, getActiveVideo, togglePip, adjustSubDelay, isPipSupported, isMinimized, onToggleMinimize]);

  // Track video events for both slots
  const handleVideoPlay = (slot: 0 | 1) => {
    if (slot === activeSlot || isSwitchingRes || isSwappingRef.current) {
      setIsPlaying(true);
    }
  };

  const handleVideoPause = (slot: 0 | 1) => {
    // If we are currently hot-swapping resolutions, pausing the old video MUST NOT pause UI playback!
    if (isSwitchingRes || isSwappingRef.current) return;

    if (slot === activeSlot) {
      setIsPlaying(false);
      const vid = slot === 0 ? videoRef0.current : videoRef1.current;
      if (vid && vid.duration > 30 && vid.currentTime > 5 && vid.currentTime < vid.duration - 15) {
        try {
          localStorage.setItem(playbackStorageKey, vid.currentTime.toString());
        } catch {}
      }
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

      // Auto-save playback position (throttled ~3s)
      if (vid.duration > 30) {
        if (vid.currentTime > vid.duration - 15) {
          // Near end -> clear saved position
          try {
            localStorage.removeItem(playbackStorageKey);
          } catch {}
        } else if (vid.currentTime > 5 && Math.abs(vid.currentTime - lastSavedTimeRef.current) > 3) {
          lastSavedTimeRef.current = vid.currentTime;
          try {
            localStorage.setItem(playbackStorageKey, vid.currentTime.toString());
          } catch {}
        }
      }
    }
  };

  const handleVideoEnded = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsPlaying(false);
      try {
        localStorage.removeItem(playbackStorageKey);
      } catch {}
      if (isSleepEndModeRef.current) {
        isSleepEndModeRef.current = false;
        setIsSleepOverlayActive(true);
      }
    }
  };

  const handleVideoWaiting = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsBuffering(true);
    }
  };

  const handleVideoPlaying = (slot: 0 | 1) => {
    if (slot === activeSlot || isSwitchingRes) {
      setIsBuffering(false);
      setIsPlaying(true);
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
      } else if (!hasCheckedResumeRef.current) {
        hasCheckedResumeRef.current = true;
        try {
          const raw = localStorage.getItem(playbackStorageKey);
          if (raw) {
            const savedSec = parseFloat(raw);
            if (savedSec > 5 && vid.duration && savedSec < vid.duration - 15) {
              vid.currentTime = savedSec;
              setCurrentTime(savedSec);
              setResumeToast({ time: savedSec, formatted: formatTime(savedSec) });
              if (resumeDismissTimerRef.current) clearTimeout(resumeDismissTimerRef.current);
              resumeDismissTimerRef.current = window.setTimeout(() => {
                setResumeToast(null);
              }, 7000);
            }
          }
        } catch (err) {
          console.warn('Failed to load playback position:', err);
        }
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

  const isSwappingRef = useRef(false);

  // Perform seamless hot-swap when standby video has buffered frames and completed seeking
  const executeHotSwapHandoff = useCallback(
    (standbySlot: 0 | 1) => {
      if (!isSwitchingRes || isSwappingRef.current) return;

      const standbyVid = standbySlot === 0 ? videoRef0.current : videoRef1.current;
      const activeVid = activeSlot === 0 ? videoRef0.current : videoRef1.current;
      if (!standbyVid || !activeVid) return;

      // Standby must NOT be currently seeking and must have readyState >= 2 (HAVE_CURRENT_DATA)
      if (standbyVid.seeking || standbyVid.readyState < 2) {
        return;
      }

      // If active video moved ahead significantly (> 1.5s), seek standby and wait for onSeeked
      const drift = Math.abs(standbyVid.currentTime - activeVid.currentTime);
      if (drift > 1.5) {
        standbyVid.currentTime = activeVid.currentTime;
        return;
      }

      isSwappingRef.current = true;
      const wasActivePlaying = !activeVid.paused && !activeVid.ended;

      const finalize = () => {
        activeVid.pause();
        activeVid.muted = true;
        setActiveSlot(standbySlot);
        setIsPlaying(wasActivePlaying);
        setIsSwitchingRes(false);
        isSwappingRef.current = false;
        if (targetResLabel) {
          onSelectResolution?.(targetResLabel, standbyVid.src);
          setTargetResLabel(null);
        }
      };

      if (wasActivePlaying) {
        standbyVid.muted = activeVid.muted;
        standbyVid.volume = activeVid.volume;
        standbyVid.playbackRate = activeVid.playbackRate;
        standbyVid
          .play()
          .then(() => {
            finalize();
          })
          .catch((playErr) => {
            console.warn('Standby play error, executing fallback swap:', playErr);
            finalize();
          });
      } else {
        standbyVid.muted = activeVid.muted;
        standbyVid.volume = activeVid.volume;
        standbyVid.playbackRate = activeVid.playbackRate;
        standbyVid.pause();
        finalize();
      }
    },
    [isSwitchingRes, activeSlot, targetResLabel, onSelectResolution]
  );

  const handleVideoCanPlay = (slot: 0 | 1) => {
    if (slot === activeSlot) {
      setIsBuffering(false);
    } else if (isSwitchingRes && !isSwappingRef.current) {
      executeHotSwapHandoff(slot);
    }
  };

  const handleVideoSeeked = (slot: 0 | 1) => {
    if (slot !== activeSlot && isSwitchingRes && !isSwappingRef.current) {
      executeHotSwapHandoff(slot);
    }
  };

  const handleVideoError = (slot: 0 | 1) => {
    const failedUrl = slot === 0 ? url0 : url1;
    if (failedUrl) {
      console.warn(`[VideoPlayer] Video playback failed in slot ${slot} (${failedUrl})`);
    }

    if (slot === activeSlot) {
      const updatedFailed = failedUrl && !failedUrls.includes(failedUrl)
        ? [...failedUrls, failedUrl]
        : failedUrls;
      if (failedUrl) {
        setFailedUrls(updatedFailed);
      }

      // Automatic fallback: try the next available MP4 variant that has NOT failed
      if (variants && variants.length > 0) {
        const remainingVariants = variants.filter(
          (v) =>
            v.name.toLowerCase().endsWith('.mp4') &&
            !updatedFailed.includes(getDownloadUrl(v.id))
        );
        const nextVariant =
          remainingVariants.find((v) => v.name.toLowerCase().includes('720p')) ||
          remainingVariants.find((v) => v.name.toLowerCase().includes('480p')) ||
          remainingVariants.find((v) => v.name.toLowerCase().includes('360p')) ||
          remainingVariants[0];

        if (nextVariant) {
          const nextUrl = getDownloadUrl(nextVariant.id);
          const match = nextVariant.name.match(/(720p|480p|360p)/i);
          const resLabel = match ? match[1] : 'Auto';

          console.log(`[VideoPlayer] Falling back to resolution: ${nextVariant.name}`);
          setUrl0(nextUrl);
          setUrl1('');
          setActiveSlot(0);
          setHasError(false);
          setIsBuffering(true);
          onSelectResolution?.(resLabel, nextUrl);
          return;
        }
      }

      // All options exhausted: show meaningful error UI and stop buffering spinner
      setIsBuffering(false);
      setHasError(true);
      if (failedUrl && failedUrl.includes('/api/files/download')) {
        setErrorMessage(
          'Server penyimpanan video saat ini sedang mencapai batas kuota bandwidth harian atau tidak dapat diakses. Silakan unduh file untuk diputar di perangkat Anda.'
        );
      } else if (isMkv) {
        setErrorMessage(
          'Browser tidak mendukung format container .mkv atau codec video 10-bit tertentu secara native. Silakan gunakan Pemutar Streaming Alternatif atau unduh file untuk diputar secara lokal.'
        );
      } else {
        setErrorMessage(
          'Format video ini tidak dapat diputar langsung oleh browser. Silakan unduh file untuk menonton.'
        );
      }
    } else if (isSwitchingRes) {
      console.warn('Standby video failed to load, cancelling hot-swap');
      setIsSwitchingRes(false);
      isSwappingRef.current = false;
      setTargetResLabel(null);
    }
  };

  const retryPlayback = () => {
    setFailedUrls([]);
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
      return variants?.find(
        (v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes(res)
      );
    },
    [variants]
  );

  const autoRecommendedRes = useMemo(() => {
    if (!variants || variants.length === 0) return isMkv ? '720p' : '1080p';
    const nonFailedVariants = variants.filter(
      (v) => v.name.toLowerCase().endsWith('.mp4') && !failedUrls.includes(getDownloadUrl(v.id))
    );
    const targetPool =
      nonFailedVariants.length > 0
        ? nonFailedVariants
        : variants.filter((v) => v.name.toLowerCase().endsWith('.mp4'));
    const has720 = targetPool.some((v) => v.name.toLowerCase().includes('720p'));
    if (has720) return '720p';
    const has480 = targetPool.some((v) => v.name.toLowerCase().includes('480p'));
    if (has480) return '480p';
    const has360 = targetPool.some((v) => v.name.toLowerCase().includes('360p'));
    if (has360) return '360p';
    const has1080 = targetPool.some((v) => v.name.toLowerCase().includes('1080p'));
    if (has1080) return '1080p';
    return isMkv ? '720p' : '1080p';
  }, [variants, failedUrls, isMkv]);

  const handleResolutionClick = useCallback(
    (resLabel: string, targetUrl: string, isAutoChoice = false) => {
      setShowQualityMenu(false);
      setIsAutoQuality(isAutoChoice);
      setFailedUrls((prev) => prev.filter((u) => u !== targetUrl));

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

  const containerStyle = useMemo<React.CSSProperties>(() => {
    if (isMinimized) {
      return {
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        backgroundColor: '#000000',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        ['--sub-font-size' as any]: '11px',
        ['--sub-color' as any]: subColor,
        ['--sub-bg' as any]: subBg === 'none' ? 'transparent' : subBg === 'solid' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
      };
    }
    if (isPlayerFullscreen) {
      if (shouldRotateLandscape) {
        return {
          position: 'fixed',
          top: 0,
          left: 0,
          width: typeof window !== 'undefined' && CSS.supports?.('height', '100dvh') ? '100dvh' : `${Math.max(windowSize.height, windowSize.width)}px`,
          height: typeof window !== 'undefined' && CSS.supports?.('width', '100dvw') ? '100dvw' : `${Math.min(windowSize.height, windowSize.width)}px`,
          transformOrigin: 'top left',
          transform: 'rotate(90deg) translateY(-100%)',
          zIndex: 99998,
          backgroundColor: '#000000',
          borderRadius: 0,
          overflow: 'hidden',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ['--sub-font-size' as any]: subFontSize === 'small' ? '14px' : subFontSize === 'large' ? '23px' : '18px',
          ['--sub-color' as any]: subColor,
          ['--sub-bg' as any]: subBg === 'none' ? 'transparent' : subBg === 'solid' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
        };
      }
      return {
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        width: '100vw',
        height: typeof window !== 'undefined' && CSS.supports?.('height', '100dvh') ? '100dvh' : '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        aspectRatio: 'auto',
        backgroundColor: '#000000',
        borderRadius: 0,
        overflow: 'hidden',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ['--sub-font-size' as any]: subFontSize === 'small' ? '14px' : subFontSize === 'large' ? '23px' : '18px',
        ['--sub-color' as any]: subColor,
        ['--sub-bg' as any]: subBg === 'none' ? 'transparent' : subBg === 'solid' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
      };
    }
    return {
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
      ['--sub-font-size' as any]: subFontSize === 'small' ? '14px' : subFontSize === 'large' ? '23px' : '18px',
      ['--sub-color' as any]: subColor,
      ['--sub-bg' as any]: subBg === 'none' ? 'transparent' : subBg === 'solid' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
    };
  }, [isMinimized, isPlayerFullscreen, shouldRotateLandscape, windowSize.width, windowSize.height, subFontSize, subColor, subBg]);

  const slot0Style = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: videoFit,
    cursor: 'pointer',
    opacity: activeSlot === 0 ? 1 : 0,
    pointerEvents: activeSlot === 0 ? 'auto' : 'none',
    zIndex: activeSlot === 0 ? 2 : 1,
    transition: 'opacity 0.15s ease-in-out',
  }), [activeSlot, videoFit]);

  const slot1Style = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: videoFit,
    cursor: 'pointer',
    opacity: activeSlot === 1 ? 1 : 0,
    pointerEvents: activeSlot === 1 ? 'auto' : 'none',
    zIndex: activeSlot === 1 ? 2 : 1,
    transition: 'opacity 0.15s ease-in-out',
  }), [activeSlot, videoFit]);

  return (
    <div
      ref={containerRef}
      className="cv-video-container"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => {
        if (isMinimized) setIsMiniHovered(true);
      }}
      onMouseLeave={() => {
        if (isMinimized) {
          setIsMiniHovered(false);
        } else if (isPlaying) {
          setShowControls(false);
        }
      }}
      onDoubleClick={() => {
        if (isMinimized) handleExpand();
        else toggleFullscreen();
      }}
      style={containerStyle}
    >
      {/* Mobile Fullscreen Top Bar (With Back, Auto-Rotate Toggle, and Fit Controls) */}
      {isPlayerFullscreen && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: 'max(14px, env(safe-area-inset-top, 14px)) 16px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
            zIndex: 30,
            opacity: showControls || !isPlaying ? 1 : 0,
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
            transition: 'opacity 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                padding: '6px 12px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              title="Keluar Layar Penuh (Esc)"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>

            {/* Auto-Rotate Toggle Button for Mobile Portrait */}
            {isMobile && isPortrait && (
              <button
                type="button"
                onClick={() => setIsForcedLandscape((prev) => !prev)}
                style={{
                  background: isForcedLandscape ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                  border: isForcedLandscape ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  color: isForcedLandscape ? '#38bdf8' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                title={isForcedLandscape ? 'Ganti ke Mode Vertikal' : 'Ganti ke Mode Lanskap (Penuh)'}
              >
                <RotateCw size={15} />
                <span>{isForcedLandscape ? 'Lanskap' : 'Vertikal'}</span>
              </button>
            )}

            {/* Video Fit / Zoom to Fill Toggle */}
            <button
              type="button"
              onClick={() =>
                setVideoFit((prev) => (prev === 'cover' ? 'contain' : prev === 'contain' ? 'fill' : 'cover'))
              }
              style={{
                background: videoFit !== 'contain' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                border: videoFit !== 'contain' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                padding: '6px 10px',
                color: videoFit !== 'contain' ? '#38bdf8' : '#e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              title={
                videoFit === 'cover'
                  ? 'Mode Layar Penuh (Zoom). Klik untuk Rasio Asli (Fit)'
                  : videoFit === 'contain'
                  ? 'Mode Rasio Asli (Fit). Klik untuk Regangkan Layar'
                  : 'Mode Regangkan Layar. Klik untuk Layar Penuh (Zoom)'
              }
            >
              <Maximize2 size={13} />
              <span>{videoFit === 'cover' ? 'Penuh' : videoFit === 'contain' ? 'Fit' : 'Regang'}</span>
            </button>

            {/* iOS Button to Eliminate Safari Address Bar */}
            {typeof HTMLVideoElement !== 'undefined' && typeof (getActiveVideo() as any)?.webkitEnterFullscreen === 'function' && (
              <button
                type="button"
                onClick={() => {
                  try {
                    (getActiveVideo() as any)?.webkitEnterFullscreen();
                  } catch (err) {
                    console.warn('iOS webkitEnterFullscreen error:', err);
                  }
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.25)',
                  border: '1px solid #38bdf8',
                  borderRadius: 10,
                  padding: '6px 12px',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                title="Hilangkan Bar Safari (Layar Penuh Sistem)"
              >
                <Maximize size={13} />
                <span>Hilangkan Bar Safari</span>
              </button>
            )}
          </div>

          <div
            style={{
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
              maxWidth: '65%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
            title={fileName}
          >
            {fileName}
          </div>
        </div>
      )}
      {/* Auto-Resume Playback Toast Notification (Only in full player) */}
      {!isMinimized && resumeToast && (
        <div
          className="cv-resume-toast"
          style={{
            position: 'absolute',
            top: isMobile ? 8 : 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 9999,
            padding: isMobile ? '3px 8px 3px 12px' : '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 6 : 10,
            zIndex: 35,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2)',
            color: '#f8fafc',
            fontSize: isMobile ? 11 : 12.5,
            fontWeight: 500,
            maxWidth: 'calc(100% - 24px)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMobile ? 'Lanjut ' : 'Melanjutkan dari '}
            <strong style={{ color: '#38bdf8' }}>{resumeToast.formatted}</strong>
          </span>
          <button
            type="button"
            onClick={handleRestartFromBeginning}
            style={{
              background: 'rgba(56, 189, 248, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              color: '#38bdf8',
              borderRadius: 9999,
              padding: isMobile ? '2px 8px' : '3px 10px',
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <RotateCcw size={isMobile ? 10 : 12} />
            <span>{isMobile ? 'Ulangi' : 'Ulangi dari Awal'}</span>
          </button>
          <button
            type="button"
            className="cv-resume-toast-close"
            onClick={() => setResumeToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            title="Tutup Notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sleep Timer Overlay (When countdown expires or video ends with sleep timer) */}
      {isSleepOverlayActive && (
        <div
          className="cv-sleep-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(7, 11, 20, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
            color: '#f8fafc',
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1.5px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 0 35px rgba(56, 189, 248, 0.3)',
            }}
          >
            <Moon size={36} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
            Zzz... Sleep Timer Aktif
          </h3>
          <p style={{ fontSize: 13.5, color: '#94a3b8', maxWidth: 440, lineHeight: 1.5, marginBottom: 24 }}>
            Pemutaran video otomatis dijeda agar Anda bisa beristirahat dengan nyaman.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSleepOverlayActive(false);
              const vid = getActiveVideo();
              if (vid) {
                vid.play().catch(() => {});
                setIsPlaying(true);
              }
            }}
            className="cv-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 4px 20px rgba(2, 132, 199, 0.4)',
              cursor: 'pointer',
            }}
          >
            <Play size={16} fill="currentColor" /> Lanjutkan Menonton
          </button>
        </div>
      )}

      {/* Dual Video Elements: Slot 0 and Slot 1 for instant, seamless hot-swap */}
      {!hasError && (
        <>
          {/* Video Slot 0 */}
          <video
            ref={videoRef0}
            src={url0 || undefined}
            playsInline
            preload="auto"
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
            onEnded={() => handleVideoEnded(0)}
            style={slot0Style}
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
            preload="auto"
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
            onEnded={() => handleVideoEnded(1)}
            style={slot1Style}
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

      {/* 1. YouTube-Style Picture-in-Picture Mini Card (When in Native PiP & Minimized) */}
      {isMinimized && isPipActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 14px',
            color: '#f8fafc',
            borderRadius: 16,
            boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0.3)',
          }}
        >
          {/* Top Row: File Name & Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#e2e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={fileName}
              >
                {fileName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCloseVideo}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
              title="Tutup Video (Stop)"
            >
              <X size={13} />
            </button>
          </div>

          {/* Center Row: PiP Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)',
              }}
            >
              <PictureInPicture2 size={19} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                Picture-in-Picture Aktif
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* Bottom Row: Quick Controls & Expand Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  background: '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(56, 189, 248, 0.4)',
                }}
                title={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <button
                type="button"
                onClick={() => skip(-10)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Mundur 10s"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => skip(10)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Maju 10s"
              >
                <RotateCw size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExpand}
              style={{
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'background 0.2s',
              }}
              title="Kembali ke Ukuran Penuh (i)"
            >
              <Maximize2 size={12} />
              <span>Perbesar</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. YouTube-Style In-App Miniplayer Overlay (When Minimized & NOT in Native PiP) */}
      {isMinimized && !isPipActive && (
        <>
          {/* Always-visible Slim Bottom Progress Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255, 255, 255, 0.2)',
              zIndex: 22,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                boxShadow: '0 0 6px #38bdf8',
              }}
            />
          </div>

          {/* Hover Controls Overlay */}
          {isMiniHovered && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 25,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.88) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px 12px',
                color: '#ffffff',
                animation: 'cvFadeInUp 0.15s ease',
              }}
            >
              {/* Top Row: File Name & Close Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#f8fafc',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '85%',
                  }}
                  title={fileName}
                >
                  {fileName}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseVideo();
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    color: '#cbd5e1',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Tutup (Esc)"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Center Controls: Rewind, Play/Pause, Forward */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    skip(-10);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Mundur 10s"
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  style={{
                    background: 'rgba(56, 189, 248, 0.95)',
                    border: 'none',
                    color: '#0f172a',
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.5)',
                  }}
                  title={isPlaying ? 'Jeda (Space)' : 'Putar (Space)'}
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    skip(10);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Maju 10s"
                >
                  <RotateCw size={17} />
                </button>
              </div>

              {/* Bottom Row: Timestamps & Expand/PiP Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isPipSupported && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePip();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Picture-in-Picture (p)"
                    >
                      <PictureInPicture2 size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpand();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Perbesar Layar Penuh (i)"
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
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

      {/* Error Fallback Screen (displayed when current stream and automatic fallbacks fail) */}
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
            {/* If untried variants exist, show button to switch to that variant */}
            {variants && variants.length > 0 && (() => {
              const untried = variants.find((v) => !failedUrls.includes(getDownloadUrl(v.id)));
              if (!untried) return null;
              const match = untried.name.match(/(720p|480p|360p)/i);
              const res = match ? match[1] : 'Alternatif';
              return (
                <button
                  type="button"
                  onClick={() => {
                    handleResolutionClick(res, getDownloadUrl(untried.id));
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
                  Putar Resolusi {res} (MP4)
                </button>
              );
            })()}

            {/* If Google Drive Player is available, offer prominent button */}
            {onSwitchToGDrivePlayer && (
              <button
                type="button"
                onClick={onSwitchToGDrivePlayer}
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
                  cursor: 'pointer',
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                }}
              >
                <Play size={16} fill="white" />
                Putar via Pemutar Streaming Alternatif
              </button>
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

            {onReportIssue && (
              <button
                type="button"
                onClick={() => onReportIssue(errorMessage || 'Video playback failure')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: 500,
                }}
              >
                <MessageSquarePlus size={15} />
                Laporkan Kendala
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sleek Custom Cloud Controls */}
      {!hasError && !isMinimized && (
        <div
          className="cv-video-bottom-bar"
          style={{
            opacity: showControls || !isPlaying ? 1 : 0,
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
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
          <div className="cv-video-controls-row">
            {/* Left Controls */}
            <div className="cv-video-left-controls">
              <button
                onClick={togglePlay}
                style={controlBtnStyle}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <button onClick={() => skip(-10)} className="cv-desktop-only" style={controlBtnStyle} title="Rewind 10s">
                <RotateCcw size={17} />
              </button>
              <button onClick={() => skip(10)} className="cv-desktop-only" style={controlBtnStyle} title="Forward 10s">
                <RotateCw size={17} />
              </button>

              {/* Volume (Desktop Only) */}
              <div className="cv-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  className="cv-video-volume-slider"
                  style={{
                    width: 70,
                    height: 4,
                    accentColor: '#38bdf8',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Time Display */}
              <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <span>{formatTime(currentTime)}</span>
                <span style={{ opacity: 0.5, margin: '0 4px' }}>/</span>
                <span style={{ opacity: 0.75 }}>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="cv-video-right-controls" style={{ position: 'relative' }}>
              {/* Subtitle / CC Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    const isMobile = window.innerWidth <= 768;
                    if (isMobile) {
                      setMobileSettingsView('subtitle');
                      setShowMobileSettings(true);
                      setShowSubMenu(false);
                      setShowQualityMenu(false);
                      setShowSpeedMenu(false);
                      setShowSleepMenu(false);
                    } else {
                      setShowSubMenu(!showSubMenu);
                      setShowQualityMenu(false);
                      setShowSpeedMenu(false);
                      setShowSleepMenu(false);
                    }
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
                  <span className="cv-desktop-only">{selectedSubIndex >= 0 ? 'CC ON' : 'CC'}</span>
                </button>

                {showSubMenu && (
                  <div
                    className="cv-video-popup-menu"
                    style={{
                      minWidth: 260,
                      gap: 8,
                      padding: '10px',
                    }}
                  >
                    {/* Subtitle Tabs Header */}
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: 3, borderRadius: 8 }}>
                      {(['tracks', 'sync', 'style'] as const).map((tab) => {
                        const labels = { tracks: 'Teks', sync: 'Delay', style: 'Gaya' };
                        const isActive = subTab === tab;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setSubTab(tab)}
                            style={{
                              flex: 1,
                              padding: '4px 6px',
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: 'none',
                              background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                              color: isActive ? '#38bdf8' : '#94a3b8',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {labels[tab]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tab 1: Tracks */}
                    {subTab === 'tracks' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sub.label}
                            </span>
                            {selectedSubIndex === idx && <Check size={14} />}
                          </button>
                        ))}

                        <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
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

                    {/* Tab 2: Sync / Delay */}
                    {subTab === 'sync' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Offset Waktu Subtitle:</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: subDelay === 0 ? '#e2e8f0' : '#38bdf8', fontFamily: 'monospace' }}>
                            {subDelay > 0 ? `+${subDelay.toFixed(1)}s` : `${subDelay.toFixed(1)}s`}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => adjustSubDelay(-0.5)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#e2e8f0',
                              padding: '6px 4px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={resetSubDelay}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              padding: '6px 4px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustSubDelay(0.5)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#e2e8f0',
                              padding: '6px 4px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            +0.5s
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => adjustSubDelay(-0.1)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#94a3b8',
                              padding: '4px',
                              borderRadius: 6,
                              fontSize: 10.5,
                              cursor: 'pointer',
                            }}
                          >
                            -0.1s Halus
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustSubDelay(0.1)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#94a3b8',
                              padding: '4px',
                              borderRadius: 6,
                              fontSize: 10.5,
                              cursor: 'pointer',
                            }}
                          >
                            +0.1s Halus
                          </button>
                        </div>

                        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
                          Shortcut keyboard: Tekan <strong style={{ color: '#38bdf8' }}>[</strong> atau <strong style={{ color: '#38bdf8' }}>]</strong>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Style Customizer */}
                    {subTab === 'style' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
                        {/* Font Size */}
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Type size={11} /> Ukuran Teks:
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {(['small', 'medium', 'large'] as const).map((s) => {
                              const labels = { small: 'Kecil', medium: 'Sedang', large: 'Besar' };
                              const isActive = subFontSize === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => changeSubFontSize(s)}
                                  style={{
                                    flex: 1,
                                    background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                    color: isActive ? '#38bdf8' : '#e2e8f0',
                                    borderRadius: 6,
                                    padding: '4px 2px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 400,
                                  }}
                                >
                                  {labels[s]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Font Color */}
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Palette size={11} /> Warna Teks:
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {[
                              { label: 'Putih', color: '#ffffff' },
                              { label: 'Kuning', color: '#facc15' },
                              { label: 'Cyan', color: '#38bdf8' },
                            ].map((c) => {
                              const isActive = subColor.toLowerCase() === c.color.toLowerCase();
                              return (
                                <button
                                  key={c.color}
                                  type="button"
                                  onClick={() => changeSubColor(c.color)}
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 6,
                                    padding: '4px 2px',
                                    fontSize: 11,
                                    color: '#e2e8f0',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                                  <span>{c.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Background */}
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                            Latar Belakang:
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[
                              { label: 'Tipis', value: 'translucent' as const },
                              { label: 'Pekat', value: 'solid' as const },
                              { label: 'Polos', value: 'none' as const },
                            ].map((b) => {
                              const isActive = subBg === b.value;
                              return (
                                <button
                                  key={b.value}
                                  type="button"
                                  onClick={() => changeSubBg(b.value)}
                                  style={{
                                    flex: 1,
                                    background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                    color: isActive ? '#38bdf8' : '#e2e8f0',
                                    borderRadius: 6,
                                    padding: '4px 2px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontWeight: isActive ? 600 : 400,
                                  }}
                                >
                                  {b.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
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

              {/* DESKTOP ONLY: Direct Buttons (Quality, Speed, Sleep, PiP, Miniplayer) */}
              <div className="cv-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Quality / Resolution Selector (YouTube-style with Auto and instant hot-swap) */}
                <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                    setShowSubMenu(false);
                    setShowSleepMenu(false);
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
                    className="cv-video-popup-menu"
                    style={{
                      minWidth: 240,
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
                        let bestUrl = '';
                        let bestLabel = '720p';
                        const v1080 = variants?.find(
                          (v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('1080p')
                        );
                        const v720 = getVariantForRes('720p');
                        const v480 = getVariantForRes('480p');
                        const v360 = getVariantForRes('360p');

                        if (v720) {
                          bestUrl = getDownloadUrl(v720.id);
                          bestLabel = '720p';
                        } else if (v480) {
                          bestUrl = getDownloadUrl(v480.id);
                          bestLabel = '480p';
                        } else if (v360) {
                          bestUrl = getDownloadUrl(v360.id);
                          bestLabel = '360p';
                        } else if (v1080) {
                          bestUrl = getDownloadUrl(v1080.id);
                          bestLabel = '1080p';
                        } else if (!isMkv && fileId) {
                          bestUrl = getDownloadUrl(fileId);
                          bestLabel = '1080p';
                        } else {
                          bestUrl = url;
                          bestLabel = 'Auto';
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
                    {(() => {
                      const v1080 = variants?.find(
                        (v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('1080p')
                      );
                      const is1080Active =
                        !isAutoQuality && (currentResolution === '1080p' || currentResolution === 'Original');

                      // 1. If 1080p MP4 variant exists, stream that MP4 variant
                      if (v1080) {
                        return (
                          <button
                            key="1080p"
                            type="button"
                            onClick={() => handleResolutionClick('1080p', getDownloadUrl(v1080.id), false)}
                            style={{
                              background: is1080Active ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                              color: is1080Active ? '#38bdf8' : '#e2e8f0',
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
                              <div style={{ fontWeight: 600 }}>1080p (Full HD MP4)</div>
                              {v1080.size_bytes && v1080.size_bytes > 0 && (
                                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{formatBytes(v1080.size_bytes)}</div>
                              )}
                            </div>
                            {is1080Active && <Check size={14} />}
                          </button>
                        );
                      }

                      // 2. If the original file is directly streamable in browser (!isMkv)
                      if (!isMkv && fileId) {
                        return (
                          <button
                            key="1080p"
                            type="button"
                            onClick={() => handleResolutionClick('1080p', getDownloadUrl(fileId), false)}
                            style={{
                              background: is1080Active ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                              color: is1080Active ? '#38bdf8' : '#e2e8f0',
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
                            {is1080Active && <Check size={14} />}
                          </button>
                        );
                      }

                      // 3. Original file is MKV without a 1080p MP4 variant:
                      // Browsers cannot decode MKV; offer download instead of crashing player with 403 or decode error
                      return (
                        <div
                          key="1080p"
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>1080p (File Asli MKV)</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                              Format MKV butuh VLC di PC/HP
                            </div>
                          </div>
                          <a
                            href={fileId ? getDownloadUrl(fileId) : '#'}
                            download={fileName}
                            onClick={() => setShowQualityMenu(false)}
                            title="Unduh file asli MKV untuk ditonton di VLC Player"
                            style={{
                              fontSize: 11,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.12)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Download size={12} /> Unduh
                          </a>
                        </div>
                      );
                    })()}

                    {/* Standard Resolutions: 720p, 480p, 360p — only show if transcoded variant exists */}
                    {(['720p', '480p', '360p'] as const).map((res) => {
                      const variant = getVariantForRes(res);
                      if (!variant) return null; // Don't show options for non-existent transcoded variants
                      const isActive = !isAutoQuality && currentResolution === res;
                      const resLabels = {
                        '720p': '720p (HD Ringan)',
                        '480p': '480p (SD Standar)',
                        '360p': '360p (Hemat Kuota)',
                      };

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
                    })}

                    {/* Any other custom variants */}
                    {variants
                      ?.filter(
                        (v) =>
                          v.name.toLowerCase().endsWith('.mp4') &&
                          !v.name.toLowerCase().includes('1080p') &&
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

                    {/* Info: transcoding is disabled, video plays in original format */}
                    {variants.length === 0 && (
                      <div style={{
                        marginTop: 4,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 10.5,
                        color: '#94a3b8',
                        textAlign: 'center',
                        lineHeight: 1.4,
                      }}>
                        Video diputar dalam kualitas original
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
                    setShowSubMenu(false);
                    setShowSleepMenu(false);
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
                    className="cv-video-popup-menu"
                    style={{
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

                {/* Sleep Timer */}
                <SleepTimerControl
                  ref={sleepTimerRef}
                  isOpen={showSleepMenu}
                  onToggle={() => {
                    setShowSleepMenu((prev) => !prev);
                    setShowSpeedMenu(false);
                    setShowQualityMenu(false);
                    setShowSubMenu(false);
                  }}
                  onClose={() => setShowSleepMenu(false)}
                  onTimerExpired={handleSleepTimerExpired}
                  onSelectEndMode={(enabled) => {
                    isSleepEndModeRef.current = enabled;
                  }}
                />

                {/* Picture-in-Picture (PiP) */}
                {isPipSupported && (
                  <button
                    type="button"
                    onClick={togglePip}
                    style={{
                      ...controlBtnStyle,
                      color: isPipActive ? '#38bdf8' : '#e2e8f0',
                      background: isPipActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                    }}
                    title={isPipActive ? 'Keluar dari Picture-in-Picture (p)' : 'Picture-in-Picture (p)'}
                  >
                    <PictureInPicture2 size={17} />
                  </button>
                )}

                {/* Miniplayer (i) */}
                <button
                  type="button"
                  onClick={() => onToggleMinimize?.(true)}
                  style={controlBtnStyle}
                  title="Miniplayer (i)"
                >
                  <Minimize2 size={17} />
                </button>
              </div>

              {/* MOBILE ONLY: Quick Settings Gear Menu (YouTube Style) */}
              <div className="cv-mobile-only">
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileSettings(!showMobileSettings);
                    setMobileSettingsView('root');
                    setShowSubMenu(false);
                    setShowQualityMenu(false);
                    setShowSpeedMenu(false);
                    setShowSleepMenu(false);
                  }}
                  style={{
                    ...controlBtnStyle,
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: showMobileSettings ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    color: showMobileSettings ? '#38bdf8' : '#e2e8f0',
                  }}
                  title="Pengaturan Video"
                  aria-label="Pengaturan Video"
                >
                  <Settings size={16} />
                </button>
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                style={{
                  ...controlBtnStyle,
                  color: isPlayerFullscreen ? '#38bdf8' : '#e2e8f0',
                  background: isPlayerFullscreen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                }}
                title={isPlayerFullscreen ? 'Keluar Layar Penuh (f / Esc)' : 'Layar Penuh (f)'}
              >
                {isPlayerFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE ONLY: Modern YouTube-Style Slide-Up Bottom Sheet */}
      {showMobileSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setShowMobileSettings(false)}
        >
          <div
            style={{
              background: '#0f172a',
              borderTop: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '20px 20px 0 0',
              padding: '12px 18px max(24px, env(safe-area-inset-bottom, 24px))',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(255, 255, 255, 0.3)', margin: '0 auto 8px' }} />

            {/* View: Root */}
            {mobileSettingsView === 'root' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pengaturan Video
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettings(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Kualitas Video */}
                <button
                  type="button"
                  onClick={() => setMobileSettingsView('quality')}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SlidersHorizontal size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Kualitas</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                    <span>{isAutoQuality ? `Auto (${currentResolution || autoRecommendedRes})` : currentResolution || '1080p'}</span>
                    <ChevronRight size={15} />
                  </div>
                </button>

                {/* Kecepatan Putar */}
                <button
                  type="button"
                  onClick={() => setMobileSettingsView('speed')}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Timer size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Kecepatan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                    <span>{playbackRate === 1 ? '1x (Normal)' : `${playbackRate}x`}</span>
                    <ChevronRight size={15} />
                  </div>
                </button>

                {/* Sleep Timer */}
                <button
                  type="button"
                  onClick={() => setMobileSettingsView('sleep')}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Moon size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Sleep Timer</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                    <span>{sleepTimerRef.current?.getStatus() || 'Mati'}</span>
                    <ChevronRight size={15} />
                  </div>
                </button>

                {/* Subtitle / CC */}
                <button
                  type="button"
                  onClick={() => setMobileSettingsView('subtitle')}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Captions size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Subtitle (CC)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                    <span>{selectedSubIndex >= 0 ? (subtitles[selectedSubIndex]?.label || 'Aktif') : 'Mati'}</span>
                    <ChevronRight size={15} />
                  </div>
                </button>

                {/* Picture-in-Picture */}
                {isPipSupported && (
                  <button
                    type="button"
                    onClick={() => {
                      togglePip();
                      setShowMobileSettings(false);
                    }}
                    style={mobileMenuItemStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PictureInPicture2 size={17} color="#38bdf8" />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>Picture-in-Picture</span>
                    </div>
                    <span style={{ fontSize: 12, color: isPipActive ? '#38bdf8' : '#64748b' }}>
                      {isPipActive ? 'Aktif' : 'Mulai'}
                    </span>
                  </button>
                )}

                {/* Miniplayer */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleMinimize?.(true);
                    setShowMobileSettings(false);
                  }}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Minimize2 size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Layar Mengambang (Mini)</span>
                  </div>
                </button>

                {/* Orientasi Layar (Lanskap Penuh vs Vertikal) */}
                {isMobile && isPortrait && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForcedLandscape((prev) => !prev);
                      setShowMobileSettings(false);
                    }}
                    style={mobileMenuItemStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <RotateCw size={17} color="#38bdf8" />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>Orientasi Layar</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>
                      <span>{isForcedLandscape ? 'Lanskap (Auto)' : 'Vertikal'}</span>
                      <ChevronRight size={15} color="#94a3b8" />
                    </div>
                  </button>
                )}

                {/* Skala Tampilan Video (Fit vs Penuh vs Regang) */}
                <button
                  type="button"
                  onClick={() => {
                    setVideoFit((prev) => (prev === 'cover' ? 'contain' : prev === 'contain' ? 'fill' : 'cover'));
                    setShowMobileSettings(false);
                  }}
                  style={mobileMenuItemStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Maximize2 size={17} color="#38bdf8" />
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>Skala Tampilan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>
                    <span>
                      {videoFit === 'cover'
                        ? 'Layar Penuh (Zoom)'
                        : videoFit === 'contain'
                        ? 'Rasio Asli (Fit)'
                        : 'Regangkan Layar (Stretch)'}
                    </span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>

                {/* Pemutar Sistem Apple iOS */}
                {typeof HTMLVideoElement !== 'undefined' && (getActiveVideo() as any)?.webkitEnterFullscreen && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileSettings(false);
                      try {
                        (getActiveVideo() as any)?.webkitEnterFullscreen();
                      } catch (err) {
                        console.warn('iOS webkitEnterFullscreen error:', err);
                      }
                    }}
                    style={mobileMenuItemStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ExternalLink size={17} color="#38bdf8" />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>Pemutar Sistem Apple iOS</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Native AVPlayer</span>
                  </button>
                )}
              </div>
            )}

            {/* View: Quality */}
            {mobileSettingsView === 'quality' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setMobileSettingsView('root')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}
                  >
                    <ArrowLeft size={16} /> Kembali
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Pilih Kualitas Video</span>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettings(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    let bestUrl = '';
                    let bestLabel = '720p';
                    const v720 = getVariantForRes('720p');
                    const v480 = getVariantForRes('480p');
                    const v360 = getVariantForRes('360p');
                    const v1080 = variants?.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('1080p'));
                    if (v720) { bestUrl = getDownloadUrl(v720.id); bestLabel = '720p'; }
                    else if (v480) { bestUrl = getDownloadUrl(v480.id); bestLabel = '480p'; }
                    else if (v360) { bestUrl = getDownloadUrl(v360.id); bestLabel = '360p'; }
                    else if (v1080) { bestUrl = getDownloadUrl(v1080.id); bestLabel = '1080p'; }
                    else { bestUrl = url; bestLabel = 'Auto'; }
                    handleResolutionClick(bestLabel, bestUrl, true);
                    setShowMobileSettings(false);
                  }}
                  style={{
                    ...mobileMenuItemStyle,
                    background: isAutoQuality ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                    borderColor: isAutoQuality ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                    color: isAutoQuality ? '#38bdf8' : '#e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>Auto (Optimal Rekomendasi)</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Menyesuaikan otomatis ({autoRecommendedRes})</div>
                  </div>
                  {isAutoQuality && <Check size={16} />}
                </button>

                {(['720p', '480p', '360p'] as const).map((res) => {
                  const variant = getVariantForRes(res);
                  const isActive = !isAutoQuality && currentResolution === res;
                  const resLabels = {
                    '720p': '720p (HD Ringan)',
                    '480p': '480p (SD Standar)',
                    '360p': '360p (Hemat Kuota)',
                  };
                  if (!variant) return null;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => {
                        handleResolutionClick(res, getDownloadUrl(variant.id), false);
                        setShowMobileSettings(false);
                      }}
                      style={{
                        ...mobileMenuItemStyle,
                        background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                        borderColor: isActive ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                        color: isActive ? '#38bdf8' : '#e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{resLabels[res]}</div>
                        {variant.size_bytes && variant.size_bytes > 0 && (
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatBytes(variant.size_bytes)}</div>
                        )}
                      </div>
                      {isActive && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* View: Speed */}
            {mobileSettingsView === 'speed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setMobileSettingsView('root')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}
                  >
                    <ArrowLeft size={16} /> Kembali
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Kecepatan Putar</span>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettings(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      changePlaybackRate(rate);
                      setShowMobileSettings(false);
                    }}
                    style={{
                      ...mobileMenuItemStyle,
                      background: playbackRate === rate ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: playbackRate === rate ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                      color: playbackRate === rate ? '#38bdf8' : '#e2e8f0',
                    }}
                  >
                    <span>{rate === 1 ? '1x (Normal)' : `${rate}x`}</span>
                    {playbackRate === rate && <Check size={16} />}
                  </button>
                ))}
              </div>
            )}

            {/* View: Sleep Timer */}
            {mobileSettingsView === 'sleep' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setMobileSettingsView('root')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}
                  >
                    <ArrowLeft size={16} /> Kembali
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Sleep Timer</span>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettings(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {[
                  { label: 'Matikan Timer', choice: null },
                  { label: '15 Menit', choice: 15 },
                  { label: '30 Menit', choice: 30 },
                  { label: '45 Menit', choice: 45 },
                  { label: '60 Menit (1 Jam)', choice: 60 },
                  { label: 'Saat Video Selesai', choice: 'end' as const },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      sleepTimerRef.current?.setChoice(item.choice);
                      setShowMobileSettings(false);
                    }}
                    style={mobileMenuItemStyle}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* View: Subtitle */}
            {mobileSettingsView === 'subtitle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setMobileSettingsView('root')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}
                  >
                    <ArrowLeft size={16} /> Kembali
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Subtitle (CC)</span>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettings(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubIndex(-1);
                    setShowMobileSettings(false);
                  }}
                  style={{
                    ...mobileMenuItemStyle,
                    background: selectedSubIndex === -1 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                    borderColor: selectedSubIndex === -1 ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                    color: selectedSubIndex === -1 ? '#38bdf8' : '#e2e8f0',
                  }}
                >
                  <span>Matikan Subtitle (Off)</span>
                  {selectedSubIndex === -1 && <Check size={16} />}
                </button>

                {subtitles.map((sub, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedSubIndex(idx);
                      setShowMobileSettings(false);
                    }}
                    style={{
                      ...mobileMenuItemStyle,
                      background: selectedSubIndex === idx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: selectedSubIndex === idx ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                      color: selectedSubIndex === idx ? '#38bdf8' : '#e2e8f0',
                    }}
                  >
                    <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.label}
                    </span>
                    {selectedSubIndex === idx && <Check size={16} />}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileSettings(false);
                    subInputRef.current?.click();
                  }}
                  style={{
                    ...mobileMenuItemStyle,
                    background: 'rgba(56, 189, 248, 0.12)',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontWeight: 600,
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <Plus size={15} />
                  Muat File Subtitle (.srt / .vtt)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
