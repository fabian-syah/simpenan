// ============================================================
// onlineCover.ts — Automatic Online Album Artwork & Metadata Resolver
// Fetches high-definition cover art (600x600) and metadata from iTunes Search API
// Completely free, requires no API key, and provides open CORS access
// ============================================================

export interface OnlineCoverResult {
  coverUrl: string;
  title?: string;
  artist?: string;
  album?: string;
}

export async function fetchOnlineCover(
  query: string,
  artist?: string,
  title?: string,
  cacheKey?: string
): Promise<OnlineCoverResult | null> {
  const key = cacheKey || query.toLowerCase().trim();

  // 1. Check browser localStorage cache
  try {
    const cached = localStorage.getItem(`cv_cover_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.coverUrl) {
        return parsed as OnlineCoverResult;
      }
    }
  } catch {
    // Ignore cache parse error
  }

  // Helper search function
  const searchItunes = async (searchTerm: string): Promise<OnlineCoverResult | null> => {
    try {
      const encoded = encodeURIComponent(searchTerm.trim());
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=1`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;

      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const rawArtwork = item.artworkUrl100 || item.artworkUrl60;
        if (!rawArtwork) return null;

        // Convert 100x100 thumbnail to 600x600 HD artwork
        const highResCover = rawArtwork.replace(/\/\d+x\d+bb(\.[a-z0-9]+)$/i, '/600x600bb$1');

        return {
          coverUrl: highResCover,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName,
        };
      }
    } catch {
      // Network or timeout error
    }
    return null;
  };

  // 2. Try primary clean query
  let result = await searchItunes(query);

  // 3. Fallback: try artist + title if different
  if (!result && artist && title) {
    result = await searchItunes(`${artist} ${title}`);
  }

  // 4. Fallback: try title alone if artist had extra noise
  if (!result && title && title.length > 3) {
    result = await searchItunes(title);
  }

  // 5. Cache result if found
  if (result && key) {
    try {
      localStorage.setItem(`cv_cover_${key}`, JSON.stringify(result));
    } catch {
      // Ignore quota error
    }
  }

  return result;
}
