// ============================================================
// Frontend API Client
// Wraps all backend calls with auth token and error handling
// ============================================================
import type { FileRecord, UploadTicket, QuotaInfo, TargetStorageOption } from '../types';
import { supabase } from './supabase';

const API_BASE = '/api';

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}

// ============================================================
// API Functions
// ============================================================

export async function listFiles(path: string, options?: { trashed?: boolean; starred?: boolean; recent?: boolean }): Promise<FileRecord[]> {
  const params = new URLSearchParams({ path });
  if (options?.trashed) params.set('trashed', 'true');
  if (options?.starred) params.set('starred', 'true');
  if (options?.recent) params.set('recent', 'true');

  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/files/list?${params}`, {
    headers: { ...authHeader },
  });
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
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/upload/request-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileName, fileSize, mimeType, parentPath, provider }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.message || data.details || data.error || 'Failed to request upload URL');
    err.code = data.error;
    err.tier = data.tier;
    err.maxFileSizeBytes = data.maxFileSizeBytes;
    throw err;
  }
  return data;
}

export async function completeUpload(
  fileId: string,
  uploadId?: string,
  parts?: { partNumber: number; etag: string }[],
  storageKey?: string,
  scriptUrl?: string
): Promise<void> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/upload/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileId, uploadId, parts, storageKey, scriptUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to complete upload');
  }
}

export async function createFolder(name: string, parentPath: string): Promise<FileRecord> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/folders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ name, parentPath }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create folder');
  return data.folder;
}

export async function deleteFile(fileId: string, permanent = false): Promise<void> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileId, permanent }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete file');
  }
}

export async function renameFile(fileId: string, newName: string): Promise<FileRecord> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/files/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileId, newName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to rename file');
  return data.file;
}

export async function moveFiles(fileIds: string[], targetPath: string): Promise<{ success: boolean }> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/files/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileIds, targetPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to move file(s)');
  }
  return res.json();
}

export async function getQuota(): Promise<QuotaInfo> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/storage/quota`, {
    headers: { ...authHeader },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch quota');
  return data;
}

export function getDownloadUrl(fileId: string, download?: boolean): string {
  return `${API_BASE}/files/download?id=${fileId}${download ? '&download=true' : ''}`;
}

export async function fetchVariants(fileId: string): Promise<{ id: string; name: string; size_bytes?: number }[]> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_BASE}/files/variants?id=${fileId}`, {
      headers: { ...authHeader },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function toggleStar(fileId: string): Promise<{ success: boolean; file: any }> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/files/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to toggle star');
  }
  return res.json();
}

// ============================================================
// Paywuz Payment API
// ============================================================

export async function createPaymentOrder(
  tier: 'founder' | 'pro' | 'creator',
  period: 'lifetime' | 'monthly' | 'yearly',
  paymentMethod = 'ALL'
): Promise<{
  success: boolean;
  orderId: string;
  amount: number;
  planName: string;
  paymentUrl: string;
  qrString?: string;
  vaNumber?: string;
  vaBank?: string;
  expiryMinutes: number;
}> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/payment?action=create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ tier, period, paymentMethod }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal membuat transaksi pembayaran');
  return data;
}

export async function checkPaymentStatus(orderId: string): Promise<{
  success: boolean;
  orderId: string;
  status: string;
  amount: number;
  tier: string;
  paidAt?: string;
}> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}/payment?action=status&orderId=${encodeURIComponent(orderId)}`, {
    headers: { ...authHeader },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal mengecek status pembayaran');
  return data;
}
