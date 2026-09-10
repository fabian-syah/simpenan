// ============================================================
// MEGA.nz Storage Engine Adapter
// Unofficial MEGA SDK wrapper with stream and Range header support
// ============================================================
import { Storage, File as MegaFile } from 'megajs';
import type { Readable } from 'node:stream';

let _megaStorage: Storage | null = null;
let _connectingPromise: Promise<Storage> | null = null;

/**
 * Get or initialize an authenticated MEGA Storage instance.
 * Reuses active connection across requests.
 */
export async function getMegaStorage(): Promise<Storage> {
  if (_megaStorage && _megaStorage.status === 'ready') {
    return _megaStorage;
  }

  if (_connectingPromise) {
    return _connectingPromise;
  }

  const email = process.env.MEGA_EMAIL?.trim();
  const password = process.env.MEGA_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error('MEGA_EMAIL and MEGA_PASSWORD environment variables are required');
  }

  _connectingPromise = (async () => {
    try {
      const storage = new Storage({
        email,
        password,
        keepalive: false,
        autoload: true,
        autologin: true,
      });

      await storage.ready;
      _megaStorage = storage;
      return storage;
    } finally {
      _connectingPromise = null;
    }
  })();

  return _connectingPromise;
}

/**
 * Get accurate quota statistics directly from the MEGA account
 */
export async function getMegaAccountQuota(): Promise<{ usedBytes: number; maxBytes: number }> {
  try {
    const storage = await getMegaStorage();
    const info = await storage.getAccountInfo();
    return {
      usedBytes: info.spaceUsed || 0,
      maxBytes: info.spaceTotal || 21474836480, // Default 20 GB
    };
  } catch (err) {
    console.error('Failed to query MEGA account info:', err);
    return {
      usedBytes: 0,
      maxBytes: 21474836480,
    };
  }
}

/**
 * Get a decrypted readable stream from MEGA for a given storageKey.
 * Supports start and end byte offsets for video seeking (HTTP 206 Range).
 */
export async function getMegaDownloadStream(
  storageKey: string,
  options?: { start?: number; end?: number }
): Promise<{
  stream: Readable;
  size: number;
  name: string;
}> {
  if (!storageKey) {
    throw new Error('Storage key is required for MEGA download');
  }

  let fileInstance: any = null;

  if (storageKey.startsWith('https://mega.nz/file/')) {
    fileInstance = MegaFile.fromURL(storageKey);
    await fileInstance.loadAttributes();
  } else {
    const storage = await getMegaStorage();
    fileInstance = storage.files[storageKey];
    if (!fileInstance) {
      // Try searching by name or node ID
      fileInstance = storage.find((f: any) => f.nodeId === storageKey || f.name === storageKey);
    }
  }

  if (!fileInstance) {
    throw new Error(`MEGA file not found for key: ${storageKey}`);
  }

  const fileSize = fileInstance.size || 0;
  const fileName = fileInstance.name || 'file';

  const downloadOpts: any = {};
  if (options?.start !== undefined) {
    downloadOpts.start = options.start;
  }
  if (options?.end !== undefined) {
    downloadOpts.end = options.end;
  }

  const stream = fileInstance.download(downloadOpts) as unknown as Readable;

  return {
    stream,
    size: fileSize,
    name: fileName,
  };
}

/**
 * Delete a file permanently from MEGA
 */
export async function deleteMegaFile(storageKey: string): Promise<boolean> {
  try {
    const storage = await getMegaStorage();

    // 1. Direct match by nodeId
    const directFile = storage.files[storageKey];
    if (directFile) {
      await directFile.delete(true);
      return true;
    }

    // 2. If storageKey is a public link, match against file links
    if (storageKey.startsWith('https://mega.nz/file/')) {
      for (const id of Object.keys(storage.files)) {
        const candidate = storage.files[id];
        if (candidate && !candidate.directory) {
          try {
            const link = await (candidate as any).link();
            if (link === storageKey) {
              await candidate.delete(true);
              return true;
            }
          } catch {}
        }
      }
    }

    return false;
  } catch (err) {
    console.error('Failed to delete file from MEGA:', err);
    return false;
  }
}

/**
 * Upload a stream or buffer to MEGA
 */
export async function uploadToMega(
  fileName: string,
  fileSize: number,
  content: Readable
): Promise<{ nodeId: string; link: string; size: number }> {
  const storage = await getMegaStorage();
  const uploadStream = storage.upload({
    name: fileName,
    size: fileSize,
  });

  const filePromise = uploadStream.complete;
  content.pipe(uploadStream as any);

  const file: any = await filePromise;
  const link = await file.link();

  return {
    nodeId: file.nodeId || '',
    link,
    size: file.size || fileSize,
  };
}
