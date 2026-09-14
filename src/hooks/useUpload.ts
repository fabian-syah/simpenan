// ============================================================
// useUpload Hook — Upload orchestration with chunking
// Handles presigned URL flow, progress tracking, and provider targeting
// Batch 4: ETA, retry, folder upload, notification, history
// ============================================================
import { useState, useCallback, useRef } from 'react';
import type { UploadTask, TargetStorageOption } from '../types';
import { requestUploadUrl, completeUpload, createFolder } from '../lib/api';
import { chunkFile, needsMultipart, uploadChunkToUrl, CHUNK_SIZE } from '../lib/chunker';
import { withRetry } from '../lib/retry';
import type { FolderEntry } from '../components/Upload/DropZone';
import type { UploadHistoryEntry } from './useUploadHistory';

const MAX_CONCURRENT_CHUNKS = 3;
const MAX_RETRIES = 3;
const SPEED_SAMPLES = 5;

interface UseUploadOptions {
  onUploadComplete?: () => void;
  onUploadError?: (err: any) => void;
  onAddHistory?: (entry: UploadHistoryEntry) => void;
  onNotifyComplete?: (fileName: string) => void;
  onNotifyFailed?: (fileName: string, error?: string) => void;
  onNotifyBatch?: (count: number) => void;
  onRequestPermission?: () => void;
}

export function useUpload(
  currentPath: string,
  targetProvider: TargetStorageOption = 'auto',
  onUploadComplete?: () => void,
  onUploadError?: (err: any) => void,
  options?: UseUploadOptions
) {
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadIdCounter = useRef(0);
  const targetProviderRef = useRef(targetProvider);
  targetProviderRef.current = targetProvider;
  const completionBuffer = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({ count: 0, timer: null });

  const updateUpload = useCallback((id: string, updates: Partial<UploadTask>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  // Rolling average speed calculator
  const calcSpeedAndETA = (
    totalSent: number,
    totalSize: number,
    startTime: number,
    speedSamples: number[]
  ): { speed: number; eta: number; averageSpeed: number } => {
    const elapsed = (Date.now() - startTime) / 1000;
    const currentSpeed = elapsed > 0 ? totalSent / elapsed : 0;
    speedSamples.push(currentSpeed);
    if (speedSamples.length > SPEED_SAMPLES) speedSamples.shift();
    const averageSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
    const remaining = totalSize - totalSent;
    const eta = averageSpeed > 0 ? remaining / averageSpeed : 0;
    return { speed: currentSpeed, eta, averageSpeed };
  };

  // Batch notification with 2s buffer
  const queueBatchNotification = useCallback(() => {
    completionBuffer.current.count++;
    if (completionBuffer.current.timer) clearTimeout(completionBuffer.current.timer);
    completionBuffer.current.timer = setTimeout(() => {
      const count = completionBuffer.current.count;
      completionBuffer.current.count = 0;
      completionBuffer.current.timer = null;
      if (count > 1 && options?.onNotifyBatch) {
        options.onNotifyBatch(count);
      }
    }, 2000);
  }, [options]);

  const uploadFile = useCallback(
    async (file: File, relativePath?: string) => {
      const taskId = `upload-${++uploadIdCounter.current}-${Date.now()}`;
      const startedAt = Date.now();
      const task: UploadTask = {
        id: taskId,
        file,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        speed: 0,
        status: 'queued',
        startedAt,
        retryCount: 0,
        maxRetries: MAX_RETRIES,
        relativePath,
      };

      setUploads((prev) => [...prev, task]);
      options?.onRequestPermission?.();

      try {
        // Step 1: Request presigned URL from backend
        updateUpload(taskId, { status: 'requesting' });

        const parentPath = relativePath
          ? `${currentPath === '/' ? '' : currentPath}/${relativePath.split('/').slice(0, -1).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
          : currentPath;

        const ticket = await withRetry(
          () => requestUploadUrl(
            file.name,
            file.size,
            file.type || 'application/octet-stream',
            parentPath,
            targetProviderRef.current
          ),
          { maxRetries: 2, baseDelay: 1000 }
        );

        updateUpload(taskId, { status: 'uploading', provider: ticket.provider });

        const startTime = Date.now();
        let totalBytesUploaded = 0;
        const speedSamples: number[] = [];

        if (ticket.provider === 'mega') {
          const { Storage } = await import('megajs');
          const storage = Storage.fromJSON(ticket.megaSession);
          storage.status = 'ready';
          await storage.reload();

          const stream: any = storage.upload({
            name: file.name,
            size: file.size,
          });

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
            const { speed, eta, averageSpeed } = calcSpeedAndETA(totalSent, file.size, startTime, speedSamples);
            updateUpload(taskId, { progress, speed, eta, averageSpeed });
          }

          const uploadedMegaFile: any = await stream.complete;
          const megaLink = await uploadedMegaFile.link();

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, undefined, undefined, megaLink);
        } else if (ticket.provider === 'mediafire') {
          const url = ticket.presignedUrls[0];
          const token = ticket.mediafireToken;

          updateUpload(taskId, { status: 'uploading', provider: 'mediafire' });

          const uploadResponseText = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
            xhr.setRequestHeader('x-filesize', String(file.size));
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.min(95, Math.round((event.loaded / event.total) * 95));
                const { speed, eta, averageSpeed } = calcSpeedAndETA(event.loaded, file.size, startTime, speedSamples);
                updateUpload(taskId, { progress, speed, eta, averageSpeed });
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
                const { speed, eta, averageSpeed } = calcSpeedAndETA(event.loaded, file.size, startTime, speedSamples);
                updateUpload(taskId, { progress, speed, eta, averageSpeed });
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
          await completeUpload(ticket.fileId, undefined, undefined, gdriveFileId, ticket.gdriveScriptUrl);
        } else if (needsMultipart(file.size) && ticket.presignedUrls.length > 1) {
          const chunks = chunkFile(file, CHUNK_SIZE);
          const parts: { partNumber: number; etag: string }[] = [];

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
                  const { speed, eta, averageSpeed } = calcSpeedAndETA(totalBytesUploaded, file.size, startTime, speedSamples);
                  updateUpload(taskId, { progress, speed, eta, averageSpeed });
                });
                parts.push({ partNumber: chunk.partNumber, etag });
                break;
              } catch {
                retries++;
                if (retries >= MAX_RETRIES) {
                  throw new Error(`Chunk ${chunk.partNumber} failed after ${MAX_RETRIES} retries`);
                }
                updateUpload(taskId, { isRetrying: true, retryCount: retries });
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
              }
            }
            updateUpload(taskId, { isRetrying: false });
            await uploadNextChunk();
          };

          for (let i = 0; i < Math.min(MAX_CONCURRENT_CHUNKS, chunkQueue.length); i++) {
            activeUploads.push(uploadNextChunk());
          }

          await Promise.all(activeUploads);

          parts.sort((a, b) => a.partNumber - b.partNumber);

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId, ticket.uploadId || undefined, parts);
        } else {
          const url = ticket.presignedUrls[0];

          if (url.includes('demo-upload-url')) {
            const duration = Math.min(800, Math.max(200, file.size / 50000));
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
              await new Promise((r) => setTimeout(r, duration / steps));
              const progress = Math.round((i / steps) * 95);
              updateUpload(taskId, { progress });
            }
          } else {
            // Single-part upload with retry
            await withRetry(
              () => uploadChunkToUrl(url, file, (loaded, total) => {
                const progress = Math.min(99, Math.round((loaded / total) * 100));
                const { speed, eta, averageSpeed } = calcSpeedAndETA(loaded, file.size, startTime, speedSamples);
                updateUpload(taskId, { progress, speed, eta, averageSpeed });
              }),
              {
                maxRetries: MAX_RETRIES,
                onRetry: (attempt) => {
                  updateUpload(taskId, { isRetrying: true, retryCount: attempt });
                },
              }
            );
            updateUpload(taskId, { isRetrying: false });
          }

          updateUpload(taskId, { status: 'completing', progress: 99 });
          await completeUpload(ticket.fileId);
        }

        // Done!
        const endTime = Date.now();
        const finalSpeed = ((endTime - startedAt) / 1000) > 0 ? file.size / ((endTime - startedAt) / 1000) : 0;
        updateUpload(taskId, { status: 'complete', progress: 100, eta: 0 });

        // Add to history
        options?.onAddHistory?.({
          id: taskId,
          fileName: relativePath || file.name,
          fileSize: file.size,
          provider: task.provider || 'auto',
          status: 'complete',
          startedAt: new Date(startedAt).toISOString(),
          completedAt: new Date().toISOString(),
          averageSpeed: finalSpeed,
          path: currentPath,
        });

        // Notification
        if (completionBuffer.current.count === 0) {
          options?.onNotifyComplete?.(file.name);
        }
        queueBatchNotification();

        // Auto-remove from list after a short delay
        setTimeout(() => removeUpload(taskId), 3000);

        // Refresh file list immediately
        onUploadComplete?.();
      } catch (err: any) {
        updateUpload(taskId, { status: 'failed', error: err.message, isRetrying: false });

        // Add failed entry to history
        options?.onAddHistory?.({
          id: taskId,
          fileName: relativePath || file.name,
          fileSize: file.size,
          provider: '',
          status: 'failed',
          error: err.message,
          startedAt: new Date(startedAt).toISOString(),
          completedAt: new Date().toISOString(),
          averageSpeed: 0,
          path: currentPath,
        });

        options?.onNotifyFailed?.(file.name, err.message);
        onUploadError?.(err);
      }
    },
    [currentPath, updateUpload, removeUpload, onUploadComplete, onUploadError, options, queueBatchNotification]
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

  // Folder upload: create folders first, then upload files
  const uploadFolder = useCallback(
    async (entries: FolderEntry[]) => {
      // Collect unique folder paths (sorted by depth so parents come first)
      const folderPaths = new Set<string>();
      for (const entry of entries) {
        const parts = entry.relativePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          folderPaths.add(parts.slice(0, i).join('/'));
        }
      }

      const sortedPaths = Array.from(folderPaths).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        return depthA - depthB;
      });

      // Create folders sequentially
      for (const folderPath of sortedPaths) {
        const parts = folderPath.split('/');
        const folderName = parts[parts.length - 1];
        const parentParts = parts.slice(0, -1);
        const parentPath = parentParts.length > 0
          ? `${currentPath === '/' ? '' : currentPath}/${parentParts.join('/')}`.replace(/\/+/g, '/')
          : currentPath;

        try {
          await createFolder(folderName, parentPath);
        } catch {
          // Folder may already exist — ignore
        }
      }

      // Upload all files with their relative paths
      for (const entry of entries) {
        uploadFile(entry.file, entry.relativePath);
      }
    },
    [currentPath, uploadFile]
  );

  // Manual retry for failed uploads
  const retryUpload = useCallback(
    (taskId: string) => {
      const task = uploads.find(u => u.id === taskId);
      if (!task || task.status !== 'failed') return;
      removeUpload(taskId);
      uploadFile(task.file, task.relativePath);
    },
    [uploads, removeUpload, uploadFile]
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
    uploadFolder,
    removeUpload,
    retryUpload,
    clearCompleted,
    hasActiveUploads,
  };
}
