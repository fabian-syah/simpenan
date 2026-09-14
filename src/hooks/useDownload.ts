// ============================================================
// useDownload — Batch download as ZIP
// ============================================================
import { useState, useCallback, useRef } from 'react';
import type { FileRecord } from '../types';
import { getDownloadUrl, listFiles } from '../lib/api';

export interface DownloadTask {
  id: string;
  zipName: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  progress: number;
  status: 'downloading' | 'zipping' | 'complete' | 'failed' | 'cancelled';
  error?: string;
}

export function useDownload() {
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const idCounter = useRef(0);

  const updateDownload = useCallback((id: string, updates: Partial<DownloadTask>) => {
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const removeDownload = useCallback((id: string) => {
    abortControllers.current.get(id)?.abort();
    abortControllers.current.delete(id);
    setDownloads(prev => prev.filter(d => d.id !== id));
  }, []);

  const collectFolderFiles = async (path: string): Promise<FileRecord[]> => {
    const items = await listFiles(path);
    const results: FileRecord[] = [];
    for (const item of items) {
      if (item.is_folder) {
        const subFiles = await collectFolderFiles(item.path);
        results.push(...subFiles);
      } else if (item.upload_status === 'complete') {
        results.push(item);
      }
    }
    return results;
  };

  const downloadAsZip = useCallback(async (files: FileRecord[], zipName: string) => {
    const taskId = `download-${++idCounter.current}-${Date.now()}`;
    const controller = new AbortController();
    abortControllers.current.set(taskId, controller);

    // Collect all files (expand folders)
    let allFiles: FileRecord[] = [];
    for (const f of files) {
      if (f.is_folder) {
        const folderFiles = await collectFolderFiles(f.path);
        allFiles.push(...folderFiles);
      } else {
        allFiles.push(f);
      }
    }

    if (allFiles.length === 0) return;

    const task: DownloadTask = {
      id: taskId,
      zipName,
      totalFiles: allFiles.length,
      completedFiles: 0,
      currentFile: allFiles[0]?.name || '',
      progress: 0,
      status: 'downloading',
    };

    setDownloads(prev => [...prev, task]);

    try {
      // Dynamic import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < allFiles.length; i++) {
        if (controller.signal.aborted) {
          updateDownload(taskId, { status: 'cancelled' });
          return;
        }

        const file = allFiles[i];
        updateDownload(taskId, {
          currentFile: file.name,
          completedFiles: i,
          progress: Math.round((i / allFiles.length) * 90),
        });

        const response = await fetch(getDownloadUrl(file.id, true), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to download ${file.name}: HTTP ${response.status}`);
        }

        const blob = await response.blob();
        // Use relative path from the common base for folder structure
        const basePath = files.length === 1 && files[0].is_folder ? files[0].path : '';
        const relativePath = basePath && file.path.startsWith(basePath)
          ? file.path.slice(basePath.length + 1)
          : file.name;
        zip.file(relativePath || file.name, blob);
      }

      updateDownload(taskId, {
        status: 'zipping',
        completedFiles: allFiles.length,
        progress: 92,
        currentFile: 'Membuat ZIP...',
      });

      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => {
          updateDownload(taskId, { progress: 92 + Math.round(metadata.percent * 0.08) });
        }
      );

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateDownload(taskId, { status: 'complete', progress: 100 });

      // Auto-remove after 5-seconds
      setTimeout(() => removeDownload(taskId), 5000);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        updateDownload(taskId, { status: 'cancelled' });
      } else {
        updateDownload(taskId, { status: 'failed', error: err.message });
      }
    } finally {
      abortControllers.current.delete(taskId);
    }
  }, [updateDownload, removeDownload]);

  const cancelDownload = useCallback((id: string) => {
    abortControllers.current.get(id)?.abort();
  }, []);

  const hasActiveDownloads = downloads.some(
    d => d.status === 'downloading' || d.status === 'zipping'
  );

  return {
    downloads,
    downloadAsZip,
    cancelDownload,
    removeDownload,
    hasActiveDownloads,
  };
}
