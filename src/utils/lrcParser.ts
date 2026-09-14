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
