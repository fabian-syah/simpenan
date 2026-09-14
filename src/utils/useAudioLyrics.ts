// ============================================================
// useAudioLyrics Hook — Shared Lyrics State & Synchronizer
// Loads, parses, and synchronizes lyrics from ID3, local .lrc files,
// and online LRCLIB database with persistent local storage caching
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileRecord } from '../types';
import type { AudioMetadata } from './id3Reader';
import {
  parseLrc,
  findActiveLyricIndex,
  getCustomLyrics,
  saveCustomLyrics,
  parseAudioFilename,
  fetchOnlineLyrics,
  parsePlainLyricsToLines,
  type ParsedLyrics,
} from './lrcParser';
import { getDownloadUrl } from '../lib/api';

export type LyricsSourceType =
  | 'id3'
  | 'online_synced'
  | 'online_plain'
  | 'local_file'
  | 'custom'
  | null;

interface UseAudioLyricsProps {
  file: FileRecord | null;
  metadata: AudioMetadata | null;
  duration: number;
  currentTime: number;
  siblingFiles?: FileRecord[];
}

export function useAudioLyrics({
  file,
  metadata,
  duration,
  currentTime,
  siblingFiles = [],
}: UseAudioLyricsProps) {
  const [lyricsData, setLyricsData] = useState<ParsedLyrics>({ lines: [] });
  const [loading, setLoading] = useState(false);
  const [lyricsSource, setLyricsSource] = useState<LyricsSourceType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const activeFileIdRef = useRef<string | null>(null);

  const parsedFile = parseAudioFilename(file?.name || '');
  const displayTitle = metadata?.title || parsedFile.title || file?.name.replace(/\.[^/.]+$/, '') || 'Audio';
  const displayArtist = metadata?.artist || parsedFile.artist || 'Simpenan Audio';

  // Load lyrics whenever file changes
  const loadLyrics = useCallback(async () => {
    if (!file) {
      setLyricsData({ lines: [] });
      setLyricsSource(null);
      setLoading(false);
      return;
    }

    activeFileIdRef.current = file.id;
    setLoading(true);
    setSearchQuery(parsedFile.cleanQuery);

    // 1. Check custom user-saved lyrics in localStorage
    const custom = getCustomLyrics(file.id);
    if (custom) {
      if (activeFileIdRef.current === file.id) {
        setLyricsData(parseLrc(custom));
        setLyricsSource('custom');
        setLoading(false);
      }
      return;
    }

    // 2. Check embedded ID3 lyrics
    if (metadata?.lyrics) {
      if (activeFileIdRef.current === file.id) {
        setLyricsData(parseLrc(metadata.lyrics));
        setLyricsSource('id3');
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
          if (activeFileIdRef.current === file.id) {
            setLyricsData(parseLrc(text));
            setLyricsSource('local_file');
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to online lookup
      }
    }

    // 4. Automatic Online Fetch via LRCLIB
    const query = metadata?.title && metadata?.artist
      ? `${metadata.artist} ${metadata.title}`
      : parsedFile.cleanQuery;
    const targetArtist = metadata?.artist || parsedFile.artist;
    const targetTitle = metadata?.title || parsedFile.title;

    try {
      const online = await fetchOnlineLyrics(query, targetArtist, targetTitle, duration);
      if (online && activeFileIdRef.current === file.id) {
        if (online.isSynced) {
          const parsed = parseLrc(online.lyrics);
          if (parsed.lines.length > 0) {
            setLyricsData(parsed);
            setLyricsSource('online_synced');
            saveCustomLyrics(file.id, online.lyrics);
            setLoading(false);
            return;
          }
        } else {
          const plainLines = parsePlainLyricsToLines(online.lyrics, duration);
          if (plainLines.length > 0) {
            setLyricsData({ lines: plainLines });
            setLyricsSource('online_plain');
            saveCustomLyrics(file.id, online.lyrics);
            setLoading(false);
            return;
          }
        }
      }
    } catch {
      // Fallback
    }

    if (activeFileIdRef.current === file.id) {
      setLyricsData({ lines: [] });
      setLyricsSource(null);
      setLoading(false);
    }
  }, [file?.id, metadata?.lyrics, metadata?.title, metadata?.artist, parsedFile.cleanQuery, parsedFile.artist, parsedFile.title, duration, siblingFiles]);

  useEffect(() => {
    loadLyrics();
  }, [loadLyrics]);

  // Online search trigger
  const searchOnline = useCallback(async (overrideQuery?: string) => {
    if (!file) return;
    const q = (overrideQuery || searchQuery).trim();
    if (!q) return;

    setIsSearchingOnline(true);
    try {
      const online = await fetchOnlineLyrics(q, undefined, q, duration);
      if (online) {
        if (online.isSynced) {
          const parsed = parseLrc(online.lyrics);
          setLyricsData(parsed);
          setLyricsSource('online_synced');
          saveCustomLyrics(file.id, online.lyrics);
        } else {
          const plainLines = parsePlainLyricsToLines(online.lyrics, duration);
          setLyricsData({ lines: plainLines });
          setLyricsSource('online_plain');
          saveCustomLyrics(file.id, online.lyrics);
        }
      }
    } catch {
      // Search error
    }
    setIsSearchingOnline(false);
  }, [file, searchQuery, duration]);

  // Save manual lyrics
  const saveManual = useCallback((rawText: string) => {
    if (!file || !rawText.trim()) return;
    saveCustomLyrics(file.id, rawText);
    setLyricsData(parseLrc(rawText));
    setLyricsSource('custom');
  }, [file]);

  const activeIndex = findActiveLyricIndex(lyricsData.lines, currentTime);

  return {
    lyricsData,
    setLyricsData,
    loading,
    lyricsSource,
    setLyricsSource,
    activeIndex,
    searchQuery,
    setSearchQuery,
    isSearchingOnline,
    searchOnline,
    saveManual,
    reloadLyrics: loadLyrics,
    displayTitle,
    displayArtist,
  };
}
