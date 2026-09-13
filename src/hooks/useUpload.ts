// ============================================================
// useUpload Hook — Upload orchestration with chunking
// Handles presigned URL flow, progress tracking, and provider targeting
// ============================================================
import { useState, useCallback, useRef } from 'react';
import type { UploadTask, TargetStorageOption } from '../types';
import { requestUploadUrl, completeUpload } from '../lib/api';
import { chunkFile, needsMultipart, uploadChunkToUrl, CHUNK_SIZE } from '../lib/chunker';

const MAX_CONCURRENT_CHUNKS = 3;
const MAX_RETRIES = 3;

export function useUpload(
  currentPath: string,
  targetProvider: TargetStorageOption = 'auto',
  onUploadComplete?: () => void
) {
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadIdCounter = useRef(0);
  const targetProviderRef = useRef(targetProvider);
  targetProviderRef.current = targetProvider;

  const updateUpload = useCallback((id: string, updates: Partial<UploadTask>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const taskId = `upload-${++uploadIdCounter.current}-${Date.now()}`;
      const task: UploadTask = {
        id: taskId,
        file,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        speed: 0,
        status: 'queued',
      };

      setUploads((prev) => [...prev, task]);

      try {
        // Step 1: Request presigned URL from backend (with chosen or auto-balanced provider)
        updateUpload(taskId, { status: 'requesting' });

        const ticket = await requestUploadUrl(
          file.name,
          file.size,
          file.type || 'application/octet-stream',
          currentPath,
          targetProviderRef.current
        );

        updateUpload(taskId, { status: 'uploading', provider: ticket.provider });

        const startTime = Date.now();
        let totalBytesUploaded = 0;

        if (ticket.provider === 'mega') {
          // Dynamic import of megajs to preserve lightweight initial bundle
          const { Storage } = await import('megajs');
          const storage = Storage.fromJSON(ticket.megaSession);
          storage.status = 'ready';
          await storage.reload();

          const stream: any = storage.upload({
            name: file.name,
            size: file.size,
          });

          // Stream chunks directly from File to avoid large memory allocations
          const reader = file.stream().getReader();
          let totalSent = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              stream.end();
              break;
            }
            stream.write(value);
            totalSent += value.length;
            const progress = Math.min(99, Math.round((totalSent / file.size) * 100));
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? totalSent / elapsed : 0;
            updateUpload(taskId, { progress, speed });
          }

          const uploadedMegaFile: any = await stream.complete;
          const megaLink = await uploadedMegaFile.link();

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, undefined, undefined, megaLink);
        } else if (ticket.provider === 'mediafire') {
          const url = ticket.presignedUrls[0];
          const token = ticket.mediafireToken;

          updateUpload(taskId, { status: 'uploading', provider: 'mediafire' });

          // Direct browser-to-MediaFire upload with live progress tracking
          const uploadResponseText = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
            xhr.setRequestHeader('x-filesize', String(file.size));
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.min(95, Math.round((event.loaded / event.total) * 95));
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? event.loaded / elapsed : 0;
                updateUpload(taskId, { progress, speed });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
              } else {
                reject(new Error(`MediaFire upload failed: HTTP ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during MediaFire upload'));
            xhr.send(file);
          });

          const uploadResult = JSON.parse(uploadResponseText);
          let quickkey = uploadResult?.response?.doupload?.quickkey;

          if (!quickkey && uploadResult?.response?.doupload?.key) {
            const dkey = uploadResult.response.doupload.key;
            updateUpload(taskId, { status: 'completing', progress: 96 });

            // Poll MediaFire poll_upload.php for quickkey (up to 15 attempts, 2s interval)
            for (let i = 0; i < 15; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const pollRes = await fetch(
                `https://www.mediafire.com/api/1.5/upload/poll_upload.php?key=${dkey}&session_token=${token}&response_format=json`
              );
              const pollData = await pollRes.json();
              if (pollData?.response?.doupload?.quickkey) {
                quickkey = pollData.response.doupload.quickkey;
                break;
              }
            }
          }

          if (!quickkey) {
            throw new Error('MediaFire upload succeeded but file quickkey was not returned');
          }

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, undefined, undefined, quickkey);
        } else if (ticket.provider === 'gdrive' || ticket.provider.startsWith('gdrive')) {
          const uploadUrl = ticket.presignedUrls[0];
          updateUpload(taskId, { status: 'uploading', provider: ticket.provider });

          // Direct raw binary PUT upload to Google Drive Resumable Upload URL
          // Supports unlimited file size (up to 5 TB), full native CORS, and real-time progress
          const uploadResponseText = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl, true);
            if (file.type) {
              xhr.setRequestHeader('Content-Type', file.type);
            }
            if (file.size > 0) {
              xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`);
            }

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? event.loaded / elapsed : 0;
                updateUpload(taskId, { progress, speed });
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200 || xhr.status === 201) {
                resolve(xhr.responseText);
              } else {
                reject(new Error(`Upload Google Drive gagal (HTTP ${xhr.status}): ${xhr.responseText || xhr.statusText}`));
              }
            };

            xhr.onerror = () => reject(new Error('Koneksi jaringan terputus saat upload ke Google Drive'));
            xhr.send(file);
          });

          let uploadResult: any;
          try {
            uploadResult = JSON.parse(uploadResponseText);
          } catch (parseErr) {
            throw new Error(`Respons Google Drive tidak valid: ${uploadResponseText.slice(0, 100)}`);
          }

          const gdriveFileId = uploadResult.id || uploadResult.fileId;
          if (!gdriveFileId) {
            throw new Error('Google Drive upload selesai tetapi ID berkas tidak ditemukan');
          }

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, undefined, undefined, gdriveFileId);
        } else if (needsMultipart(file.size) && ticket.presignedUrls.length > 1) {
          // Step 2a: Multipart upload — chunk and upload in parallel
          const chunks = chunkFile(file, CHUNK_SIZE);
          const parts: { partNumber: number; etag: string }[] = [];

          // Upload chunks with concurrency control
          const chunkQueue = [...chunks];
          const activeUploads: Promise<void>[] = [];

          const uploadNextChunk = async (): Promise<void> => {
            const chunk = chunkQueue.shift();
            if (!chunk) return;

            const url = ticket.presignedUrls[chunk.partNumber - 1];
            let retries = 0;

            while (retries < MAX_RETRIES) {
              try {
                const { etag } = await uploadChunkToUrl(url, chunk.blob, (loaded) => {
                  const chunkBaseBytes = chunks
                    .filter((c) => c.partNumber < chunk.partNumber)
                    .reduce((sum, c) => sum + c.size, 0);
                  totalBytesUploaded = chunkBaseBytes + loaded;
                  const progress = Math.min(99, Math.round((totalBytesUploaded / file.size) * 100));
                  const elapsed = (Date.now() - startTime) / 1000;
                  const speed = elapsed > 0 ? totalBytesUploaded / elapsed : 0;
                  updateUpload(taskId, { progress, speed });
                });
                parts.push({ partNumber: chunk.partNumber, etag });
                break;
              } catch {
                retries++;
                if (retries >= MAX_RETRIES) {
                  throw new Error(`Chunk ${chunk.partNumber} failed after ${MAX_RETRIES} retries`);
                }
                await new Promise((r) => setTimeout(r, 1000 * retries));
              }
            }

            // Continue with next chunk
            await uploadNextChunk();
          };

          // Start concurrent uploads
          for (let i = 0; i < Math.min(MAX_CONCURRENT_CHUNKS, chunkQueue.length); i++) {
            activeUploads.push(uploadNextChunk());
          }

          await Promise.all(activeUploads);

          // Sort parts by part number
          parts.sort((a, b) => a.partNumber - b.partNumber);

          // Step 3: Complete multipart upload
          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, ticket.uploadId || undefined, parts);
        } else {
          // Step 2b: Single-part upload (Works for Backblaze, Filebase, & Supabase Storage)
          const url = ticket.presignedUrls[0];

          // In demo mode, simulate quick upload progress
          if (url.includes('demo-upload-url')) {
            const duration = Math.min(800, Math.max(200, file.size / 50000));
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
              await new Promise((r) => setTimeout(r, duration / steps));
              const progress = Math.round((i / steps) * 95);
              updateUpload(taskId, { progress });
            }
          } else {
            await uploadChunkToUrl(url, file, (loaded, total) => {
              const progress = Math.min(99, Math.round((loaded / total) * 100));
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = elapsed > 0 ? loaded / elapsed : 0;
              updateUpload(taskId, { progress, speed });
            });
          }

          // Step 3: Complete upload
          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId);
        }

        // Done with Original!

        // Done entirely!
        updateUpload(taskId, { status: 'complete', progress: 100 });

        // Auto-remove from list after a short delay
        setTimeout(() => removeUpload(taskId), 3000);

        // Refresh file list immediately
        onUploadComplete?.();
      } catch (err: any) {
        updateUpload(taskId, { status: 'failed', error: err.message });
      }
    },
    [currentPath, updateUpload, removeUpload, onUploadComplete]
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      for (const file of files) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'complete' && u.status !== 'failed'));
  }, []);

  const hasActiveUploads = uploads.some(
    (u) =>
      u.status === 'queued' ||
      u.status === 'requesting' ||
      u.status === 'uploading' ||
      u.status === 'completing'
  );

  return {
    uploads,
    uploadFile,
    uploadFiles,
    removeUpload,
    clearCompleted,
    hasActiveUploads,
  };
}
