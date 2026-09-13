// ============================================================
// Frontend API Client
// Wraps all backend calls with demo mode fallback
// ============================================================
import type { FileRecord, UploadTicket, QuotaInfo, ProviderId, TargetStorageOption } from '../types';

const API_BASE = '/api';

// Demo mode disabled: using real API endpoints
const IS_DEMO = false;

// ============================================================
// Mock data for demo mode
// ============================================================
const MOCK_PROVIDERS = [
  { id: 'backblaze' as ProviderId, display_name: 'Backblaze B2', max_bytes: 10737418240, used_bytes: 3221225472, endpoint_url: '', bucket_name: 'demo', region: 'us-west-004', is_active: true },
  { id: 'filebase' as ProviderId, display_name: 'Filebase', max_bytes: 5368709120, used_bytes: 1073741824, endpoint_url: '', bucket_name: 'demo', region: 'us-east-1', is_active: true },
  { id: 'supabase' as ProviderId, display_name: 'Supabase Storage', max_bytes: 1073741824, used_bytes: 214748364, endpoint_url: '', bucket_name: 'demo', region: null, is_active: true },
];

let mockFiles: FileRecord[] = [
  { id: '1', name: 'Documents', path: '/Documents', parent_path: '/', is_folder: true, size_bytes: 0, mime_type: null, provider_id: null, storage_key: null, checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-01T10:00:00Z', updated_at: '2025-09-01T10:00:00Z' },
  { id: '2', name: 'Photos', path: '/Photos', parent_path: '/', is_folder: true, size_bytes: 0, mime_type: null, provider_id: null, storage_key: null, checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: true, is_trashed: false, created_at: '2025-09-02T10:00:00Z', updated_at: '2025-09-02T10:00:00Z' },
  { id: '3', name: 'Projects', path: '/Projects', parent_path: '/', is_folder: true, size_bytes: 0, mime_type: null, provider_id: null, storage_key: null, checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-03T10:00:00Z', updated_at: '2025-09-03T10:00:00Z' },
  { id: '4', name: 'presentation-q3.pdf', path: '/presentation-q3.pdf', parent_path: '/', is_folder: false, size_bytes: 4521984, mime_type: 'application/pdf', provider_id: 'backblaze', storage_key: 'demo/presentation-q3.pdf', checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: true, is_trashed: false, created_at: '2025-09-04T14:30:00Z', updated_at: '2025-09-04T14:30:00Z' },
  { id: '5', name: 'budget-2025.xlsx', path: '/budget-2025.xlsx', parent_path: '/', is_folder: false, size_bytes: 1245184, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', provider_id: 'filebase', storage_key: 'demo/budget-2025.xlsx', checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-05T09:15:00Z', updated_at: '2025-09-05T09:15:00Z' },
  { id: '6', name: 'meeting-notes.docx', path: '/meeting-notes.docx', parent_path: '/', is_folder: false, size_bytes: 524288, mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', provider_id: 'supabase', storage_key: 'demo/meeting-notes.docx', checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-06T16:45:00Z', updated_at: '2025-09-06T16:45:00Z' },
  { id: '7', name: 'architecture-diagram.png', path: '/architecture-diagram.png', parent_path: '/', is_folder: false, size_bytes: 2097152, mime_type: 'image/png', provider_id: 'backblaze', storage_key: 'demo/architecture-diagram.png', checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-07T11:20:00Z', updated_at: '2025-09-07T11:20:00Z' },
  { id: '8', name: 'app-demo.mp4', path: '/app-demo.mp4', parent_path: '/', is_folder: false, size_bytes: 157286400, mime_type: 'video/mp4', provider_id: 'backblaze', storage_key: 'demo/app-demo.mp4', checksum: null, chunk_count: 16, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-07T15:00:00Z', updated_at: '2025-09-07T15:00:00Z' },
  { id: '9', name: 'source-code.zip', path: '/source-code.zip', parent_path: '/', is_folder: false, size_bytes: 8388608, mime_type: 'application/zip', provider_id: 'filebase', storage_key: 'demo/source-code.zip', checksum: null, chunk_count: 1, upload_id: null, upload_status: 'complete', is_starred: false, is_trashed: false, created_at: '2025-09-08T08:10:00Z', updated_at: '2025-09-08T08:10:00Z' },
];

let mockIdCounter = 100;

// ============================================================
// API Functions
// ============================================================

export async function listFiles(path: string, options?: { trashed?: boolean; starred?: boolean; recent?: boolean }): Promise<FileRecord[]> {
  if (IS_DEMO) {
    await delay(300);
    let files = mockFiles.filter(f => f.parent_path === path && f.upload_status === 'complete');
    if (options?.trashed) files = files.filter(f => f.is_trashed);
    else files = files.filter(f => !f.is_trashed);
    if (options?.starred) files = files.filter(f => f.is_starred);
    // Sort: folders first, then alphabetical
    files.sort((a, b) => {
      if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return files;
  }

  const params = new URLSearchParams({ path });
  if (options?.trashed) params.set('trashed', 'true');
  if (options?.starred) params.set('starred', 'true');
  if (options?.recent) params.set('recent', 'true');

  const res = await fetch(`${API_BASE}/files/list?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list files');
  return data.files;
}


export async function requestUploadUrl(
  fileName: string,
  fileSize: number,
  mimeType: string,
  parentPath: string,
  provider?: TargetStorageOption
): Promise<UploadTicket> {
  if (IS_DEMO) {
    await delay(500);
    const providers: ProviderId[] = ['backblaze', 'filebase', 'supabase'];
    const chosenProvider = (provider && provider !== 'auto') ? provider : providers[Math.floor(Math.random() * providers.length)];
    const fileId = String(++mockIdCounter);
    const storageKey = `demo/${Date.now()}-${fileName}`;

    // Add to mock files
    mockFiles.push({
      id: fileId,
      name: fileName,
      path: parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`,
      parent_path: parentPath,
      is_folder: false,
      size_bytes: fileSize,
      mime_type: mimeType,
      provider_id: chosenProvider,
      storage_key: storageKey,
      checksum: null,
      chunk_count: 1,
      upload_id: null,
      upload_status: 'uploading',
      is_starred: false,
      is_trashed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      fileId,
      provider: chosenProvider,
      presignedUrls: ['https://demo-upload-url.example.com'],
      uploadId: null,
      storageKey,
      chunkSize: fileSize,
    };
  }

  const res = await fetch(`${API_BASE}/upload/request-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileSize, mimeType, parentPath, provider }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.details || data.error || 'Failed to request upload URL');
  return data;
}

export async function completeUpload(
  fileId: string,
  uploadId?: string,
  parts?: { partNumber: number; etag: string }[],
  storageKey?: string,
  scriptUrl?: string
): Promise<void> {
  if (IS_DEMO) {
    await delay(300);
    const file = mockFiles.find(f => f.id === fileId);
    if (file) {
      file.upload_status = 'complete';
      if (storageKey) file.storage_key = storageKey;
      // Update mock provider usage
      const provider = MOCK_PROVIDERS.find(p => p.id === file.provider_id);
      if (provider) provider.used_bytes += file.size_bytes;
    }
    return;
  }

  const res = await fetch(`${API_BASE}/upload/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, uploadId, parts, storageKey, scriptUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to complete upload');
  }
}

export async function createFolder(name: string, parentPath: string): Promise<FileRecord> {
  if (IS_DEMO) {
    await delay(300);
    const folderPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
    const existing = mockFiles.find(f => f.path === folderPath && f.is_folder);
    if (existing) throw new Error('Folder already exists');

    const folder: FileRecord = {
      id: String(++mockIdCounter),
      name,
      path: folderPath,
      parent_path: parentPath,
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
    mockFiles.push(folder);
    return folder;
  }

  const res = await fetch(`${API_BASE}/folders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentPath }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create folder');
  return data.folder;
}

export async function deleteFile(fileId: string, permanent = false): Promise<void> {
  if (IS_DEMO) {
    await delay(300);
    if (permanent) {
      mockFiles = mockFiles.filter(f => f.id !== fileId);
    } else {
      const file = mockFiles.find(f => f.id === fileId);
      if (file) file.is_trashed = true;
    }
    return;
  }

  const res = await fetch(`${API_BASE}/files/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, permanent }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete file');
  }
}

/** Rename a file or folder */
export async function renameFile(fileId: string, newName: string): Promise<any> {
  if (IS_DEMO) {
    const file = mockFiles.find(f => f.id === fileId);
    if (!file) throw new Error('File not found');
    file.name = newName;
    const parentPath = file.parent_path === '/' ? '/' : file.parent_path + '/';
    file.path = parentPath + newName;
    return file;
  }

  const res = await fetch(`${API_BASE}/files/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, newName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rename file');
  }
  return res.json();
}

/** Move files to a new destination folder */
export async function moveFiles(fileIds: string[], targetPath: string): Promise<any> {
  if (IS_DEMO) {
    fileIds.forEach(id => {
      const file = mockFiles.find(f => f.id === id);
      if (file) {
        file.parent_path = targetPath;
        file.path = targetPath === '/' ? `/${file.name}` : `${targetPath}/${file.name}`;
      }
    });
    return { success: true };
  }

  const res = await fetch(`${API_BASE}/files/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, targetPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to move file(s)');
  }
  return res.json();
}

export async function getQuota(): Promise<QuotaInfo> {
  if (IS_DEMO) {
    await delay(200);
    const totalMax = MOCK_PROVIDERS.reduce((s, p) => s + p.max_bytes, 0);
    const totalUsed = MOCK_PROVIDERS.reduce((s, p) => s + p.used_bytes, 0);
    return { providers: MOCK_PROVIDERS, total_max_bytes: totalMax, total_used_bytes: totalUsed };
  }

  const res = await fetch(`${API_BASE}/storage/quota`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch quota');
  return data;
}

export function getDownloadUrl(fileId: string, download?: boolean): string {
  if (IS_DEMO) return '#';
  return `${API_BASE}/files/download?id=${fileId}${download ? '&download=true' : ''}`;
}

export async function fetchVariants(fileId: string): Promise<{ id: string; name: string; size_bytes?: number }[]> {
  try {
    const res = await fetch(`${API_BASE}/files/variants?id=${fileId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function toggleStar(fileId: string): Promise<{ success: boolean; file: any }> {
  if (IS_DEMO) {
    const file = mockFiles.find(f => f.id === fileId);
    if (file) file.is_starred = !file.is_starred;
    return { success: true, file };
  }

  const res = await fetch(`${API_BASE}/files/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to toggle star');
  }
  return res.json();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
