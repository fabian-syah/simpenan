import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export type VideoResolution = '720p' | '480p' | '360p';

export async function initFFmpeg(onProgress?: (progress: number) => void) {
  if (ffmpeg && ffmpeg.loaded) {
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.min(99, Math.max(1, Math.round(progress * 100))));
      });
    }
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.min(99, Math.max(1, Math.round(progress * 100))));
    });
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  try {
    const coreURL = await toBlobURL(`${origin}/ffmpeg/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${origin}/ffmpeg/ffmpeg-core.wasm`, 'application/wasm');
    await ffmpeg.load({ coreURL, wasmURL });
  } catch (localErr) {
    console.warn('Local ffmpeg loading failed, trying direct or unpkg CDN fallback:', localErr);
    try {
      await ffmpeg.load({
        coreURL: `${origin}/ffmpeg/ffmpeg-core.js`,
        wasmURL: `${origin}/ffmpeg/ffmpeg-core.wasm`,
      });
    } catch (directErr) {
      console.warn('Direct ffmpeg load failed, trying unpkg CDN:', directErr);
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
    }
  }

  return ffmpeg;
}

export function terminateFFmpeg() {
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
    } catch {}
    ffmpeg = null;
  }
}

export async function transcodeVideo(
  source: File | string,
  fileName: string,
  resolution: VideoResolution,
  onProgress?: (p: number) => void
): Promise<File> {
  const ff = await initFFmpeg(onProgress);
  const ext = getExtension(fileName) || '.mp4';
  const inputName = `input_${Date.now()}${ext}`;
  const outputName = `output_${resolution}_${Date.now()}.mp4`;

  // Fetch file data (handles File object or remote video URL)
  const fileData = await fetchFile(source);
  await ff.writeFile(inputName, fileData);

  const scale =
    resolution === '720p' ? '-2:720' : resolution === '480p' ? '-2:480' : '-2:360';

  // Fast ultrafast preset with H.264 & AAC for universal browser playback
  // Includes -pix_fmt yuv420p for 10-bit anime conversion and -sn to skip unsupported subtitles
  await ff.exec([
    '-i', inputName,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', `scale=${scale}`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-sn',
    outputName,
  ]);

  const data = await ff.readFile(outputName);

  try {
    await ff.deleteFile(inputName);
    await ff.deleteFile(outputName);
  } catch {}

  const base = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  return new File([data as any], `${base}_${resolution}.mp4`, {
    type: 'video/mp4',
  });
}

function getExtension(filename: string) {
  const i = filename.lastIndexOf('.');
  return i < 0 ? '' : filename.substring(i);
}
