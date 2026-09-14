// ============================================================
// Synchronized Lyrics (.lrc) Parser & Utilities
// Parses standard & enhanced LRC timestamps with line synchronization
// ============================================================

export interface LyricLine {
  time: number; // In seconds
  text: string;
}

export interface ParsedLyrics {
  title?: string;
  artist?: string;
  album?: string;
  offset?: number; // In milliseconds
  lines: LyricLine[];
}

export function parseLrc(lrcText: string): ParsedLyrics {
  const result: ParsedLyrics = {
    lines: [],
  };

  if (!lrcText || typeof lrcText !== 'string') {
    return result;
  }

  const lines = lrcText.split(/\r?\n/);
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const tagRegex = /^\[([a-zA-Z]+):(.*)\]$/;

  let offsetSeconds = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for metadata tags like [ti:Title]
    const tagMatch = trimmed.match(tagRegex);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const val = tagMatch[2].trim();
      if (tag === 'ti') result.title = val;
      else if (tag === 'ar') result.artist = val;
      else if (tag === 'al') result.album = val;
      else if (tag === 'offset') {
        const offsetMs = parseInt(val, 10);
        if (!isNaN(offsetMs)) {
          offsetSeconds = offsetMs / 1000;
          result.offset = offsetMs;
        }
      }
      continue;
    }

    // Extract all timestamps from the line
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      timestamps.push(min * 60 + sec + frac);
      lastIndex = timeRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const text = trimmed.slice(lastIndex).trim();
      for (const t of timestamps) {
        result.lines.push({
          time: Math.max(0, t + offsetSeconds),
          text,
        });
      }
    }
  }

  // Sort chronologically
  result.lines.sort((a, b) => a.time - b.time);

  return result;
}

export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
  if (lines.length === 0) return -1;
  if (currentTime < lines[0].time) return -1;

  let low = 0;
  let high = lines.length - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

const STORAGE_PREFIX = 'cv_lyrics_';

export function saveCustomLyrics(fileId: string, text: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${fileId}`, text);
  } catch {}
}

export function getCustomLyrics(fileId: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${fileId}`);
  } catch {
    return null;
  }
}

export function parseAudioFilename(filename: string): { artist: string; title: string; cleanQuery: string } {
  if (!filename) return { artist: '', title: '', cleanQuery: '' };

  // Remove extension (.mp3, .m4a, .flac, .wav, .ogg, .aac, etc.)
  let clean = filename.replace(/\.[^/.]+$/, '');

  // Remove noise keywords in parentheses or brackets
  clean = clean.replace(
    /[\(\[\{](official\s*(music\s*)?video|official\s*audio|official\s*lyric\s*video|lyric\s*video|audio|lyrics?|hd|4k|hq|remastered|visualizer|lirik\s*(resmi)?)[\)\]\}]/gi,
    ''
  );

  // Remove leading numbers like "01. " or "01 - "
  clean = clean.replace(/^\d+[\s.\-_]+/, '');

  clean = clean.trim();

  // Split by " - " if artist and title are hyphen-separated
  const dashParts = clean.split(/\s+-\s+/);
  if (dashParts.length >= 2) {
    const artist = dashParts[0].trim();
    const title = dashParts.slice(1).join(' - ').trim();
    return {
      artist,
      title,
      cleanQuery: `${artist} ${title}`,
    };
  }

  return {
    artist: '',
    title: clean,
    cleanQuery: clean,
  };
}

export function parsePlainLyricsToLines(plainText: string, duration: number): LyricLine[] {
  const rawLines = plainText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];
  const step = duration > 0 ? duration / (rawLines.length + 1) : 4;

  return rawLines.map((text, idx) => ({
    time: Math.round((idx + 0.5) * step * 100) / 100,
    text,
  }));
}

export async function fetchOnlineLyrics(
  query: string,
  artist?: string,
  title?: string,
  duration?: number
): Promise<{ lyrics: string; isSynced: boolean } | null> {
  // Strategy 1: If both artist and track title are known, try direct LRCLIB get
  if (artist && title) {
    try {
      const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${
        duration && duration > 0 ? `&duration=${Math.round(duration)}` : ''
      }`;
      const res = await fetch(getUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
          return { lyrics: data.syncedLyrics, isSynced: true };
        }
        if (data.plainLyrics && data.plainLyrics.trim().length > 0) {
          return { lyrics: data.plainLyrics, isSynced: false };
        }
      }
    } catch {
      // Ignore and fallback to search
    }
  }

  // Strategy 2: Search LRCLIB with clean query
  const cleanQ = query.trim() || `${artist || ''} ${title || ''}`.trim();
  if (!cleanQ) return null;

  try {
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const results: any[] = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match with synced lyrics
        const withSynced = results.find((r) => r.syncedLyrics && r.syncedLyrics.trim().length > 0);
        if (withSynced) {
          return { lyrics: withSynced.syncedLyrics, isSynced: true };
        }
        // Fallback to plain lyrics
        const withPlain = results.find((r) => r.plainLyrics && r.plainLyrics.trim().length > 0);
        if (withPlain) {
          return { lyrics: withPlain.plainLyrics, isSynced: false };
        }
      }
    }
  } catch {
    // Search failed
  }

  return null;
}
