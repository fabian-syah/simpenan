// ============================================================
// Google Drive Storage Adapter via Google Apps Script Web App
// Enables 5 TB Google Drive storage with direct links & trash support
// ============================================================

export const GDRIVE_SCRIPT_URL =
  process.env.GDRIVE_SCRIPT_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbzcTS30sGvhwymFDS76xcpUfGTDpkVHCcDZUU6zBTPogEqD7u1OeW0jVENJHuq4TthF/exec';

export const GDRIVE_SECRET =
  process.env.GDRIVE_SECRET?.trim() || 'simpenan_gdrive_secret_2026';

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
