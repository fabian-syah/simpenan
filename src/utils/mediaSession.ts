// ============================================================
// MediaSession API Integration
// Enables background lockscreen and OS notification playback controls
// ============================================================

export interface MediaSessionConfig {
  title: string;
  artist?: string;
  album?: string;
  artwork?: string | null;
}

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onSeekTo?: (time: number) => void;
}

export function isMediaSessionSupported(): boolean {
  return typeof window !== 'undefined' && 'mediaSession' in navigator;
}

export function updateMediaSessionMetadata(config: MediaSessionConfig): void {
  if (!isMediaSessionSupported()) return;

  try {
    const artworkList: MediaImage[] = [];

    if (config.artwork) {
      artworkList.push({
        src: config.artwork,
        sizes: '512x512',
        type: 'image/jpeg',
      });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: config.title || 'Simpenan Audio',
      artist: config.artist || 'Simpenan Cloud',
      album: config.album || 'Koleksi Musik',
      artwork: artworkList,
    });
  } catch {
    // Ignore unsupported metadata assignment errors
  }
}

export function updateMediaSessionPlaybackState(state: 'none' | 'paused' | 'playing'): void {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.playbackState = state;
  } catch {}
}

export function updateMediaSessionPositionState(duration: number, currentTime: number): void {
  if (!isMediaSessionSupported() || !navigator.mediaSession.setPositionState) return;

  try {
    if (!isNaN(duration) && duration > 0 && !isNaN(currentTime) && currentTime >= 0) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1.0,
        position: Math.min(currentTime, duration),
      });
    }
  } catch {}
}

export function setupMediaSessionActionHandlers(handlers: MediaSessionHandlers): () => void {
  if (!isMediaSessionSupported()) return () => {};

  const actions: MediaSessionAction[] = [
    'play',
    'pause',
    'previoustrack',
    'nexttrack',
    'seekbackward',
    'seekforward',
    'seekto',
  ];

  try {
    if (handlers.onPlay) {
      navigator.mediaSession.setActionHandler('play', () => handlers.onPlay?.());
    } else {
      navigator.mediaSession.setActionHandler('play', null);
    }

    if (handlers.onPause) {
      navigator.mediaSession.setActionHandler('pause', () => handlers.onPause?.());
    } else {
      navigator.mediaSession.setActionHandler('pause', null);
    }

    if (handlers.onPrevious) {
      navigator.mediaSession.setActionHandler('previoustrack', () => handlers.onPrevious?.());
    } else {
      navigator.mediaSession.setActionHandler('previoustrack', null);
    }

    if (handlers.onNext) {
      navigator.mediaSession.setActionHandler('nexttrack', () => handlers.onNext?.());
    } else {
      navigator.mediaSession.setActionHandler('nexttrack', null);
    }

    if (handlers.onSeekBackward) {
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        handlers.onSeekBackward?.();
      });
    } else {
      navigator.mediaSession.setActionHandler('seekbackward', null);
    }

    if (handlers.onSeekForward) {
      navigator.mediaSession.setActionHandler('seekforward', () => {
        handlers.onSeekForward?.();
      });
    } else {
      navigator.mediaSession.setActionHandler('seekforward', null);
    }

    if (handlers.onSeekTo) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          handlers.onSeekTo?.(details.seekTime);
        }
      });
    } else {
      navigator.mediaSession.setActionHandler('seekto', null);
    }
  } catch {}

  return () => {
    try {
      for (const act of actions) {
        navigator.mediaSession.setActionHandler(act, null);
      }
    } catch {}
  };
}
