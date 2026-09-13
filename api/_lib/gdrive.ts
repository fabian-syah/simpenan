// ============================================================
// Google Drive Storage Adapter via Google Apps Script Web App
// Enables 5 TB Google Drive storage with direct links & trash support
// ============================================================

export const GDRIVE_SCRIPT_URL =
  process.env.GDRIVE_SCRIPT_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbyiy75CQu-DAXNZT3GGryO4mZARV_7Inw19N-RPC4W3bysbLV6yplOAeKNoxXIGKPXR/exec';

export const GDRIVE_SECRET =
  process.env.GDRIVE_SECRET?.trim() || 'simpenan_gdrive_secret_2026';

export interface CreateResumableUploadParams {
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  origin?: string;
}

/**
 * Initiates a Google Drive Resumable Upload session via Google Apps Script.
 * Returns the Google upload session URL (which natively supports CORS from the specified origin).
 */
export async function createGDriveResumableUpload(
  params: CreateResumableUploadParams
): Promise<string> {
  const query = new URLSearchParams({
    action: 'create_resumable_upload',
    secret: GDRIVE_SECRET,
    fileName: params.fileName,
    fileSize: String(params.fileSize || 0),
    mimeType: params.mimeType || 'application/octet-stream',
    origin: params.origin || 'https://simpenan-theta.vercel.app',
  });

  const url = `${GDRIVE_SCRIPT_URL}?${query.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data?.success || !data?.uploadUrl) {
    throw new Error(
      data?.error ||
        data?.details ||
        'Gagal membuat sesi upload Google Drive. Pastikan Google Apps Script sudah diperbarui.'
    );
  }

  return data.uploadUrl;
}

/**
 * Ensures a file in Google Drive has public view permissions (ANYONE_WITH_LINK)
 */
export async function makeGDrivePublic(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const url = `${GDRIVE_SCRIPT_URL}?action=make_public&secret=${encodeURIComponent(GDRIVE_SECRET)}&fileId=${encodeURIComponent(fileId)}`;
    const res = await fetch(url);
    const data = await res.json();
    return !!data?.success;
  } catch (err: any) {
    console.warn(`Make GDrive public warning for ${fileId}:`, err?.message);
    return false;
  }
}

/**
 * Delete / trash a file in Google Drive permanently by fileId
 */
export async function deleteGDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return true;
  try {
    const url = `${GDRIVE_SCRIPT_URL}?action=delete&secret=${encodeURIComponent(GDRIVE_SECRET)}&fileId=${encodeURIComponent(fileId)}`;
    const res = await fetch(url);
    const data = await res.json();
    return !!data?.success;
  } catch (err: any) {
    console.warn(`Google Drive delete warning for file ${fileId}:`, err?.message);
    return false;
  }
}

/**
 * Fetch Google Drive storage quota (limit and used bytes)
 */
export async function getGDriveQuota(): Promise<{ usedBytes: number; maxBytes: number }> {
  try {
    const url = `${GDRIVE_SCRIPT_URL}?action=quota&secret=${encodeURIComponent(GDRIVE_SECRET)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.success) {
      return {
        usedBytes: Number(data.used_bytes) || 0,
        maxBytes: Number(data.limit_bytes) || 5497558138880, // 5 TB
      };
    }
  } catch (err: any) {
    console.warn('Google Drive quota query warning:', err?.message);
  }
  return {
    usedBytes: 0,
    maxBytes: 5497558138880,
  };
}
