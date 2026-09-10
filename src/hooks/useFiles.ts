// ============================================================
// useFiles Hook — Real-time File CRUD operations & state management
// Instant 0ms optimistic updates, cross-view cache sync, BroadcastChannel,
// and high-frequency active revalidation
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileRecord } from '../types';
import { listFiles, createFolder, deleteFile, toggleStar, renameFile, moveFiles } from '../lib/api';

// In-memory SWR cache: key -> { files, timestamp }
const fileCache = new Map<string, { files: FileRecord[]; timestamp: number }>();

// Global sets for tracking deleted files & folders during session
// Completely eliminates temporary reappearance ("sempet nongol")
const sessionDeletedIds = new Set<string>();
const sessionDeletedPaths = new Set<string>();

export function isItemDeleted(file: FileRecord): boolean {
  if (sessionDeletedIds.has(file.id)) return true;
  for (const p of sessionDeletedPaths) {
    if (file.path === p || file.path.startsWith(p + '/')) return true;
  }
  return false;
}

function getCacheKey(section: string, path: string): string {
  if (section === 'starred') return 'section:starred';
  if (section === 'trash') return 'section:trash';
  if (section === 'recent') return 'section:recent';
  return `path:${path}`;
}

// Cross-tab Real-time synchronization via BroadcastChannel
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('simpenan_realtime_sync')
    : null;

export function broadcastSync(msg: {
  type: 'STAR_TOGGLE' | 'FILE_DELETE' | 'FILE_RENAME' | 'FOLDER_CREATE' | 'FILES_CHANGED';
  payload?: any;
}) {
  try {
    syncChannel?.postMessage(msg);
  } catch {}
}

/** Update star status across all cached paths and the starred section */
export function syncStarInCache(fileId: string, isStarred: boolean, fileItem?: FileRecord) {
  let foundItem = fileItem;

  // 1. Update in all cached path and section entries
  fileCache.forEach((entry) => {
    entry.files = entry.files.map((f) => {
      if (f.id === fileId) {
        if (!foundItem) foundItem = { ...f, is_starred: isStarred };
        return { ...f, is_starred: isStarred };
      }
      return f;
    });
  });

  // 2. Update section:starred cache specifically
  const starredCache = fileCache.get('section:starred');
  if (starredCache) {
    if (!isStarred) {
      starredCache.files = starredCache.files.filter((f) => f.id !== fileId);
    } else if (foundItem) {
      const exists = starredCache.files.some((f) => f.id === fileId);
      if (!exists) {
        starredCache.files = [{ ...foundItem, is_starred: true }, ...starredCache.files];
      }
    }
    starredCache.timestamp = Date.now();
  }

  return foundItem;
}

/** Update file name across all cached entries */
export function syncRenameInCache(fileId: string, newName: string) {
  fileCache.forEach((entry) => {
    entry.files = entry.files.map((f) => {
      if (f.id === fileId) {
        const parentPath = f.parent_path === '/' ? '/' : f.parent_path + '/';
        return { ...f, name: newName, path: parentPath + newName };
      }
      return f;
    });
  });
}

/** Remove file or folder permanently from all cached entries */
export function syncDeleteInCache(fileId: string) {
  sessionDeletedIds.add(fileId);
  fileCache.forEach((entry) => {
    entry.files = entry.files.filter((f) => !isItemDeleted(f));
  });
}

/** Prefetch a folder or section into in-memory cache */
export function prefetchFolder(path: string, section = 'drive') {
  const key = getCacheKey(section, path);
  const cached = fileCache.get(key);
  if (cached && Date.now() - cached.timestamp < 15000) return;

  const options: { trashed?: boolean; starred?: boolean; recent?: boolean } = {};
  if (section === 'starred') options.starred = true;
  else if (section === 'trash') options.trashed = true;
  else if (section === 'recent') options.recent = true;

  listFiles(path, options)
    .then((fresh) => {
      const clean = fresh.filter((f) => !isItemDeleted(f));
      fileCache.set(key, { files: clean, timestamp: Date.now() });
    })
    .catch(() => {});
}

export function useFiles(initialPath = '/', activeSection = 'drive') {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileRecord[]>(() => {
    const key = getCacheKey(activeSection, initialPath);
    const cached = fileCache.get(key)?.files || [];
    return cached.filter((f) => !isItemDeleted(f));
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const key = getCacheKey(activeSection, initialPath);
    return !fileCache.has(key);
  });
  const [error, setError] = useState<string | null>(null);

  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const cacheKey = getCacheKey(activeSection, currentPath);

  const fetchFiles = useCallback(
    async (path?: string, section?: string, showLoading = false) => {
      const targetPath = path ?? currentPathRef.current;
      const targetSection = section ?? activeSectionRef.current;
      const key = getCacheKey(targetSection, targetPath);

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const options: { trashed?: boolean; starred?: boolean; recent?: boolean } = {};
      if (targetSection === 'starred') options.starred = true;
      else if (targetSection === 'trash') options.trashed = true;
      else if (targetSection === 'recent') options.recent = true;

      try {
        const result = await listFiles(targetPath, options);
        // Filter out any items that have been deleted in this session
        const cleanResult = result.filter((f) => !isItemDeleted(f));
        fileCache.set(key, { files: cleanResult, timestamp: Date.now() });

        // Only update state if this is still the active view
        if (
          targetSection === activeSectionRef.current &&
          (targetSection !== 'drive' || targetPath === currentPathRef.current)
        ) {
          setFiles(cleanResult);
        }

        // Prefetch child folders automatically in idle time
        if (targetSection === 'drive') {
          cleanResult
            .filter((f) => f.is_folder)
            .forEach((f, idx) => {
              setTimeout(() => prefetchFolder(f.path, 'drive'), idx * 100);
            });
        }
      } catch (err: any) {
        if (
          targetSection === activeSectionRef.current &&
          (targetSection !== 'drive' || targetPath === currentPathRef.current)
        ) {
          setError(err.message);
          if (!fileCache.has(key)) {
            setFiles([]);
          }
        }
      } finally {
        if (
          targetSection === activeSectionRef.current &&
          (targetSection !== 'drive' || targetPath === currentPathRef.current)
        ) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Sync state whenever path or activeSection changes
  useEffect(() => {
    const key = getCacheKey(activeSection, currentPath);
    const cached = fileCache.get(key);

    if (cached) {
      // 0ms instant render from memory cache
      let clean = cached.files.filter((f) => !isItemDeleted(f));
      if (activeSection === 'starred') {
        clean = clean.filter((f) => f.is_starred);
      }
      setFiles(clean);
      setLoading(false);
      // Quiet background revalidation
      fetchFiles(currentPath, activeSection, false);
    } else {
      // Show loading indicator only on first cold load
      setLoading(true);
      fetchFiles(currentPath, activeSection, true);
    }
  }, [currentPath, activeSection, fetchFiles]);

  // Active Real-time synchronization: revalidate on focus, visibility change & every 2.5 seconds
  useEffect(() => {
    const handleRevalidate = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchFiles(currentPath, activeSection, false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const intervalTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchFiles(currentPath, activeSection, false);
      }
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(intervalTimer);
    };
  }, [currentPath, activeSection, fetchFiles]);

  // Cross-tab Real-time sync listener
  useEffect(() => {
    if (!syncChannel) return;

    const handleSyncMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === 'STAR_TOGGLE') {
        const { fileId, isStarred } = payload;
        syncStarInCache(fileId, isStarred);

        if (activeSectionRef.current === 'starred') {
          if (!isStarred) {
            setFiles((prev) => prev.filter((f) => f.id !== fileId));
          } else {
            fetchFiles(currentPathRef.current, 'starred', false);
          }
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, is_starred: isStarred } : f))
          );
        }
      } else if (type === 'FILE_DELETE') {
        syncDeleteInCache(payload.fileId);
        setFiles((prev) => prev.filter((f) => !isItemDeleted(f)));
      } else if (type === 'FILE_RENAME') {
        syncRenameInCache(payload.fileId, payload.newName);
        setFiles((prev) =>
          prev.map((f) => (f.id === payload.fileId ? { ...f, name: payload.newName } : f))
        );
      } else if (type === 'FILES_CHANGED' || type === 'FOLDER_CREATE') {
        fetchFiles(currentPathRef.current, activeSectionRef.current, false);
      }
    };

    syncChannel.addEventListener('message', handleSyncMessage);
    return () => syncChannel.removeEventListener('message', handleSyncMessage);
  }, [fetchFiles]);

  const navigateTo = useCallback((path: string) => {
    const key = getCacheKey('drive', path);
    const cached = fileCache.get(key);
    if (cached) {
      setFiles(cached.files.filter((f) => !isItemDeleted(f)));
      setLoading(false);
    }
    setCurrentPath(path);
  }, []);

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    const key = getCacheKey('drive', newPath);
    const cached = fileCache.get(key);
    if (cached) {
      setFiles(cached.files.filter((f) => !isItemDeleted(f)));
      setLoading(false);
    }
    setCurrentPath(newPath);
  }, [currentPath]);

  // Optimistic create folder
  const handleCreateFolder = useCallback(
    async (name: string) => {
      const tempId = `temp-${Date.now()}`;
      const folderPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      sessionDeletedPaths.delete(folderPath);

      const optimisticFolder: FileRecord = {
        id: tempId,
        name,
        path: folderPath,
        parent_path: currentPath,
        is_folder: true,
        size_bytes: 0,
        mime_type: null,
        provider_id: null,
        storage_key: null,
        checksum: null,
        chunk_count: 1,
        upload_id: null,
        upload_status: 'complete',
        is_starred: false,
        is_trashed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 0ms Optimistic UI update
      setFiles((prev) => {
        const updated = [optimisticFolder, ...prev];
        fileCache.set(cacheKey, { files: updated, timestamp: Date.now() });
        return updated;
      });

      broadcastSync({ type: 'FOLDER_CREATE' });

      try {
        const realFolder = await createFolder(name, currentPath);
        // Swap temp ID with real ID
        setFiles((prev) => {
          const updated = prev.map((f) => (f.id === tempId ? realFolder : f));
          fileCache.set(cacheKey, { files: updated, timestamp: Date.now() });
          return updated;
        });
        broadcastSync({ type: 'FILES_CHANGED' });
      } catch (err: any) {
        // Rollback
        setFiles((prev) => {
          const rolledBack = prev.filter((f) => f.id !== tempId);
          fileCache.set(cacheKey, { files: rolledBack, timestamp: Date.now() });
          return rolledBack;
        });
        setError(err.message);
      }
    },
    [currentPath, cacheKey]
  );

  // Permanent delete with multi-cloud & cross-tab sync
  const handleDelete = useCallback(
    async (fileId: string) => {
      if (sessionDeletedIds.has(fileId)) return;
      sessionDeletedIds.add(fileId);

      const target = files.find((f) => f.id === fileId);
      if (target?.is_folder) {
        sessionDeletedPaths.add(target.path);
      }

      // 0ms instant UI removal
      setFiles((prev) => {
        const updated = prev.filter((f) => !isItemDeleted(f));
        fileCache.set(cacheKey, { files: updated, timestamp: Date.now() });
        return updated;
      });

      // Purge this file/folder from ALL cached views
      syncDeleteInCache(fileId);

      // Broadcast to other tabs immediately
      broadcastSync({ type: 'FILE_DELETE', payload: { fileId } });

      try {
        await deleteFile(fileId, true);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (!msg.includes('not found') && !msg.includes('404')) {
          console.error('Delete error:', err);
        }
      } finally {
        syncDeleteInCache(fileId);
      }
    },
    [files, cacheKey]
  );

  // Optimistic rename
  const handleRename = useCallback(
    async (fileId: string, newName: string) => {
      let oldName = '';
      const newPathFn = (parent: string) =>
        parent === '/' ? `/${newName}` : `${parent}/${newName}`;

      // 0ms Optimistic UI update
      setFiles((prev) => {
        const updated = prev.map((f) => {
          if (f.id === fileId) {
            oldName = f.name;
            return { ...f, name: newName, path: newPathFn(f.parent_path) };
          }
          return f;
        });
        fileCache.set(cacheKey, { files: updated, timestamp: Date.now() });
        return updated;
      });

      syncRenameInCache(fileId, newName);
      broadcastSync({ type: 'FILE_RENAME', payload: { fileId, newName } });

      try {
        await renameFile(fileId, newName);
        broadcastSync({ type: 'FILES_CHANGED' });
      } catch (err: any) {
        // Rollback
        setFiles((prev) => {
          const rolledBack = prev.map((f) => {
            if (f.id === fileId) {
              return { ...f, name: oldName, path: newPathFn(f.parent_path) };
            }
            return f;
          });
          fileCache.set(cacheKey, { files: rolledBack, timestamp: Date.now() });
          return rolledBack;
        });
        syncRenameInCache(fileId, oldName);
        broadcastSync({ type: 'FILE_RENAME', payload: { fileId, newName: oldName } });
        setError(err.message);
      }
    },
    [cacheKey]
  );

  // 0ms Real-Time Toggle Star with Cross-Section Filtering & Broadcast
  const handleToggleStar = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      const newStarred = target ? !target.is_starred : false;

      // 1. Instant 0ms Optimistic UI update for current view
      if (activeSectionRef.current === 'starred') {
        // If in Starred view and unstarring: IMMEDIATELY remove from the list (Google Drive behavior)
        if (!newStarred) {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, is_starred: true } : f))
          );
        }
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, is_starred: newStarred } : f))
        );
      }

      // 2. Synchronize across ALL caches (both Starred section and folder caches)
      syncStarInCache(fileId, newStarred, target);

      // 3. Broadcast to all open tabs and windows
      broadcastSync({
        type: 'STAR_TOGGLE',
        payload: { fileId, isStarred: newStarred },
      });

      // 4. Send mutation to backend
      try {
        await toggleStar(fileId);
        // Quiet background revalidation to guarantee server parity
        fetchFiles(currentPathRef.current, activeSectionRef.current, false);
      } catch (err: any) {
        // Rollback on failure
        syncStarInCache(fileId, !newStarred, target);
        broadcastSync({
          type: 'STAR_TOGGLE',
          payload: { fileId, isStarred: !newStarred },
        });
        if (activeSectionRef.current === 'starred') {
          if (!newStarred && target) {
            setFiles((prev) => [target, ...prev]);
          }
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, is_starred: !newStarred } : f))
          );
        }
        setError(err.message);
      }
    },
    [files, fetchFiles]
  );

  const invalidateCache = useCallback(() => {
    fileCache.clear();
    broadcastSync({ type: 'FILES_CHANGED' });
    fetchFiles(currentPath, activeSection, false);
  }, [currentPath, activeSection, fetchFiles]);

  // Move files to target folder
  const handleMoveFiles = useCallback(
    async (fileIds: string[], targetPath: string) => {
      // Instant optimistic UI removal if moved to a different folder
      if (targetPath !== currentPath) {
        setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
      }
      try {
        await moveFiles(fileIds, targetPath);
        broadcastSync({ type: 'FILES_CHANGED' });
        invalidateCache();
      } catch (err: any) {
        invalidateCache();
        throw err;
      }
    },
    [currentPath, invalidateCache]
  );

  // Build breadcrumb segments from path
  const breadcrumbs = (() => {
    if (activeSection === 'starred') return [{ name: 'Starred', path: '/' }];
    if (activeSection === 'recent') return [{ name: 'Recent', path: '/' }];
    if (activeSection === 'trash') return [{ name: 'Trash', path: '/' }];

    const segments: { name: string; path: string }[] = [{ name: 'My Drive', path: '/' }];
    if (currentPath !== '/') {
      const parts = currentPath.split('/').filter(Boolean);
      let accumulated = '';
      for (const part of parts) {
        accumulated += `/${part}`;
        segments.push({ name: part, path: accumulated });
      }
    }
    return segments;
  })();

  return {
    files,
    loading,
    error,
    currentPath,
    breadcrumbs,
    navigateTo,
    navigateUp,
    fetchFiles,
    prefetchFolder,
    createFolder: handleCreateFolder,
    deleteFile: handleDelete,
    toggleStar: handleToggleStar,
    renameFile: handleRename,
    moveFiles: handleMoveFiles,
    invalidateCache,
  };
}
