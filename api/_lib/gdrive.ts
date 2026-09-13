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
  scriptUrl?: string;
}

/**
 * Initiates a Google Drive Resumable Upload session via Google Apps Script.
 * Returns the Google upload session URL (which natively supports CORS from the specified origin).
 */
export async function createGDriveResumableUpload(
  params: CreateResumableUploadParams
): Promise<string> {
  const baseUrl = params.scriptUrl?.trim() || GDRIVE_SCRIPT_URL;
  const origin = params.origin || 'https://simpenan-theta.vercel.app';

  // Strategy A: Direct Google Drive API initiation via Apps Script OAuth Token
  // Guarantees 100% compliant CORS headers (Access-Control-Allow-Origin: origin) on PUT responses
  try {
    const tokenUrl = `${baseUrl}?action=get_token&secret=${encodeURIComponent(GDRIVE_SECRET)}`;
    const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(6000) });
    const tokenData = await tokenRes.json();

    if (tokenData?.success && tokenData?.token) {
      const metadata: Record<string, any> = {
        name: params.fileName,
        mimeType: params.mimeType || 'application/octet-stream',
      };
      if (tokenData.folderId) {
        metadata.parents = [tokenData.folderId];
      }

      const googleRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': params.mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': String(params.fileSize || 0),
          'Origin': origin,
        },
        body: JSON.stringify(metadata),
      });

      const location = googleRes.headers.get('location') || googleRes.headers.get('Location');
      if (location) {
        return location;
      }
    }
  } catch (tokenErr: any) {
    console.warn('Direct OAuth resumable upload initiation notice, falling back to Apps Script proxy:', tokenErr?.message);
  }

  // Strategy B: Apps Script Proxy create_resumable_upload
  const query = new URLSearchParams({
    action: 'create_resumable_upload',
    secret: GDRIVE_SECRET,
    fileName: params.fileName,
    fileSize: String(params.fileSize || 0),
    mimeType: params.mimeType || 'application/octet-stream',
    origin,
  });

  const url = `${baseUrl}?${query.toString()}`;
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
export async function makeGDrivePublic(fileId: string, scriptUrl?: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const baseUrl = scriptUrl?.trim() || GDRIVE_SCRIPT_URL;
    const url = `${baseUrl}?action=make_public&secret=${encodeURIComponent(GDRIVE_SECRET)}&fileId=${encodeURIComponent(fileId)}`;
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
export async function deleteGDriveFile(fileId: string, scriptUrl?: string): Promise<boolean> {
  if (!fileId) return true;
  try {
    const baseUrl = scriptUrl?.trim() || GDRIVE_SCRIPT_URL;
    const url = `${baseUrl}?action=delete&secret=${encodeURIComponent(GDRIVE_SECRET)}&fileId=${encodeURIComponent(fileId)}`;
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
export async function getGDriveQuota(scriptUrl?: string): Promise<{ usedBytes: number; maxBytes: number }> {
  try {
    const baseUrl = scriptUrl?.trim() || GDRIVE_SCRIPT_URL;
    const url = `${baseUrl}?action=quota&secret=${encodeURIComponent(GDRIVE_SECRET)}`;
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

/**
 * Validates a Google Apps Script Web App connection
 */
export async function testGDriveConnection(
  scriptUrl: string,
  secret: string = GDRIVE_SECRET
): Promise<{ success: boolean; usedBytes?: number; maxBytes?: number; error?: string }> {
  try {
    const cleanUrl = scriptUrl.trim();
    if (!cleanUrl.startsWith('https://script.google.com/')) {
      return { success: false, error: 'URL harus diawali dengan https://script.google.com/' };
    }
    const url = `${cleanUrl}?action=quota&secret=${encodeURIComponent(secret)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data?.success) {
      return {
        success: true,
        usedBytes: Number(data.used_bytes) || 0,
        maxBytes: Number(data.limit_bytes) || 5497558138880,
      };
    }
    return {
      success: false,
      error: data?.error || 'Akses ditolak atau respons Google Apps Script tidak valid.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal menghubungi Google Apps Script: ${err.message || 'Timeout / Network Error'}`,
    };
  }
}
