// ============================================================
// CloudVault — Shared TypeScript Types
// ============================================================

export type UploadStatus = 'pending' | 'uploading' | 'complete' | 'failed';

export type ProviderId = 'backblaze' | 'filebase' | 'supabase' | 'mega' | 'mediafire' | 'gdrive' | (string & {});

export type TargetStorageOption = 'auto' | ProviderId;

export interface StorageProvider {
  id: ProviderId;
  display_name: string;
  max_bytes: number;
  used_bytes: number;
  endpoint_url: string | null;
  bucket_name: string;
  region: string | null;
  is_active: boolean;
}

export interface FileRecord {
  id: string;
  name: string;
  path: string;
  parent_path: string;
  is_folder: boolean;
  size_bytes: number;
  mime_type: string | null;
  provider_id: ProviderId | null;
  storage_key: string | null;
  checksum: string | null;
  chunk_count: number;
  upload_id: string | null;
  upload_status: UploadStatus;
  is_starred: boolean;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UploadTicket {
  fileId: string;
  provider: ProviderId;
  presignedUrls: string[];
  megaSession?: any;
  mediafireToken?: string;
  gdriveScriptUrl?: string;
  gdriveSecret?: string;
  uploadId: string | null;    // Multipart upload ID (null for single-part)
  storageKey: string;
  chunkSize: number;
}

export interface UploadCompleteRequest {
  fileId: string;
  uploadId?: string;
  parts?: { partNumber: number; etag: string }[];
}

export interface QuotaInfo {
  providers: StorageProvider[];
  total_max_bytes: number;
  total_used_bytes: number;
}

// Upload state for the frontend upload manager
export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  progress: number;        // 0-100
  speed: number;           // bytes per second
  status?: 'queued' | 'requesting' | 'uploading' | 'transcoding' | 'completing' | 'complete' | 'failed' | 'transcoding 720p' | 'uploading 720p' | 'transcoding 480p' | 'uploading 480p';
  provider?: ProviderId;
  error?: string;
}

// File listing request/response
export interface ListFilesParams {
  path: string;
  showTrashed?: boolean;
  starredOnly?: boolean;
}

export interface CreateFolderRequest {
  name: string;
  parentPath: string;
}

// Icon mapping for file types
export type FileCategory = 
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'archive'
  | 'code'
  | 'other';

export function getFileCategory(mimeType: string | null, isFolder: boolean): FileCategory {
  if (isFolder) return 'folder';
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text/plain') || mimeType.includes('rtf')) return 'document';
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || mimeType.includes('xml') || mimeType.includes('python') || mimeType.includes('java')) return 'code';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
