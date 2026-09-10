// ============================================================
// File Chunker — Splits files for multipart upload
// ============================================================

export const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
export const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB

export interface FileChunk {
  partNumber: number;
  blob: Blob;
  start: number;
  end: number;
  size: number;
}

/**
 * Split a File into chunks of CHUNK_SIZE bytes.
 * Returns an array of FileChunk objects with the blob slice and metadata.
 */
export function chunkFile(file: File, chunkSize = CHUNK_SIZE): FileChunk[] {
  const chunks: FileChunk[] = [];
  let start = 0;
  let partNumber = 1;

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push({
      partNumber,
      blob: file.slice(start, end),
      start,
      end,
      size: end - start,
    });
    start = end;
    partNumber++;
  }

  return chunks;
}

/**
 * Determines if a file needs multipart upload.
 */
export function needsMultipart(fileSize: number): boolean {
  return fileSize > MULTIPART_THRESHOLD;
}

/**
 * Upload a single chunk/file to a presigned URL using XMLHttpRequest.
 * Returns the ETag from the response headers (needed for multipart completion).
 * Uses XHR instead of fetch for upload progress tracking.
 */
export function uploadChunkToUrl(
  url: string,
  data: Blob,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || '';
        resolve({ etag: etag.replace(/"/g, '') });
      } else {
        let msg = `Upload failed with status ${xhr.status}`;
        try {
          const match = xhr.responseText?.match(/<Message>(.*?)<\/Message>/i);
          if (match && match[1]) {
            msg = match[1];
          } else if (xhr.responseText) {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.message) {
              msg = parsed.message;
              if (msg.includes('exceeded the maximum allowed size')) {
                msg = 'Berkas melebihi batas upload Supabase Storage Free Tier (Maksimal 50 MB/file). Silakan gunakan Backblaze B2.';
              }
            } else if (parsed.error) {
              msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
            }
          }
        } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(data);
  });
}
