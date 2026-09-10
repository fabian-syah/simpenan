// ============================================================
// Subtitle Utility — SRT to WebVTT Converter for HTML5 Video
// ============================================================

/**
 * Converts SRT subtitle text into standard WebVTT format
 */
export function srtToVtt(srtText: string): string {
  // Normalize newlines
  let vtt = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // If already WebVTT, return as is
  if (vtt.startsWith('WEBVTT')) {
    return vtt;
  }

  // Replace SRT comma milliseconds with WebVTT period (00:00:00,000 -> 00:00:00.000)
  vtt = vtt.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );

  return `WEBVTT\n\n${vtt}`;
}

/**
 * Reads an SRT or VTT file and returns an Object URL ready for <track src="..." />
 */
export async function createSubtitleTrackUrl(file: File): Promise<string> {
  const text = await file.text();
  const vttContent = srtToVtt(text);
  const blob = new Blob([vttContent], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}
