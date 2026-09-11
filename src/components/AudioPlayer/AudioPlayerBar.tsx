// ============================================================
// AudioPlayerBar Component — Persistent Bottom Music Player
// Allows continuous listening while exploring folders & files
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, Volume1, VolumeX, RotateCcw, RotateCw,
  Repeat, X, Music, Disc
} from 'lucide-react';
import type { FileRecord } from '../../types';
import { formatBytes } from '../../types';

interface AudioPlayerBarProps {
  file: FileRecord | null;
  url: string | null;
  onClose: () => void;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayerBar({ file, url, onClose }: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  useEffect(() => {
    if (url && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [url]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const skip = (secs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + secs));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const toggleLoop = () => {
    if (audioRef.current) {
      audioRef.current.loop = !isLooping;
      setIsLooping(!isLooping);
    }
  };

  if (!file || !url) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="cv-audio-bar">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          if (!isLooping) setIsPlaying(false);
        }}
      />

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
        {/* Track Details */}
        <div className="cv-audio-track">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(56, 189, 248, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              flexShrink: 0,
            }}
          >
            {isPlaying ? (
              <Disc
                size={20}
                style={{
                  animation: 'spin 3s linear infinite',
                }}
              />
            ) : (
              <Music size={18} />
            )}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={file.name}
            >
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {formatBytes(file.size_bytes)}
            </div>
          </div>
        </div>

        {/* Center Playback Controls */}
        <div className="cv-audio-controls">
          <button
            onClick={() => skip(-10)}
            className="cv-audio-skip-btn"
            style={btnStyle}
            title="Rewind 10s"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={togglePlay}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
              transition: 'transform 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" style={{ marginLeft: 2 }} />}
          </button>

          <button
            onClick={() => skip(10)}
            className="cv-audio-skip-btn"
            style={btnStyle}
            title="Forward 10s"
          >
            <RotateCw size={16} />
          </button>

          <button
            onClick={toggleLoop}
            style={{
              ...btnStyle,
              color: isLooping ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)',
              background: isLooping ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              padding: 6,
              borderRadius: 8,
            }}
            title={isLooping ? 'Loop: ON' : 'Loop: OFF'}
          >
            <Repeat size={15} />
          </button>

          {/* Time Counter */}
          <div className="cv-audio-time" style={{ fontSize: 12, fontFamily: 'monospace', color: '#cbd5e1', marginLeft: 4 }}>
            <span>{formatAudioTime(currentTime)}</span>
            <span style={{ opacity: 0.4, margin: '0 3px' }}>/</span>
            <span style={{ opacity: 0.7 }}>{formatAudioTime(duration)}</span>
          </div>
        </div>

        {/* Right Volume & Dismiss */}
        <div className="cv-audio-extra">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={toggleMute} style={btnStyle} title="Mute">
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

          <div className="cv-audio-divider" style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.15)' }} />

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
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.75)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  transition: 'color 0.15s ease',
};
