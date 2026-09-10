// ============================================================
// MediaFire Cloud Storage Adapter
// REST API v1.4 / v1.5 with direct download links & quota sync
// ============================================================
import crypto from 'node:crypto';

let _sessionToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Get or refresh an authenticated MediaFire session token.
 * Reuses valid token across serverless requests.
 */
export async function getMediaFireSessionToken(): Promise<string> {
  const now = Date.now();
  if (_sessionToken && now < _tokenExpiresAt) {
    return _sessionToken;
  }

  const email = process.env.MEDIAFIRE_EMAIL?.trim();
  const password = process.env.MEDIAFIRE_PASSWORD?.trim();
  const appId = process.env.MEDIAFIRE_APP_ID?.trim() || '42511';

  if (!email || !password) {
    throw new Error('MEDIAFIRE_EMAIL and MEDIAFIRE_PASSWORD environment variables are required');
  }

  const signature = crypto.createHash('sha1').update(email + password + appId).digest('hex');

  const params = new URLSearchParams({
    email,
    password,
    application_id: appId,
    signature,
    response_format: 'json',
  });

  const res = await fetch(`https://www.mediafire.com/api/1.4/user/get_session_token.php?${params.toString()}`);
  const data = await res.json();

  if (data?.response?.result !== 'Success' || !data?.response?.session_token) {
    throw new Error(`MediaFire authentication failed: ${data?.response?.message || 'Unknown error'}`);
  }

  _sessionToken = data.response.session_token;
  // Cache token for 9 minutes (MediaFire tokens typically last 10-15 minutes or longer)
  _tokenExpiresAt = now + 9 * 60 * 1000;

  return _sessionToken!;
}

/**
 * Get accurate quota statistics directly from the MediaFire account
 */
export async function getMediaFireAccountQuota(): Promise<{ usedBytes: number; maxBytes: number }> {
  try {
    const token = await getMediaFireSessionToken();
    const res = await fetch(`https://www.mediafire.com/api/1.5/user/get_info.php?session_token=${token}&response_format=json`);
    const data = await res.json();

    const userInfo = data?.response?.user_info;
    const storageLimit = Number(userInfo?.storage_limit) || 10737418240; // 10 GB default
    const usedStorage = Number(userInfo?.used_storage_size) || 0;

    return {
      usedBytes: usedStorage,
      maxBytes: storageLimit,
    };
  } catch (err) {
    console.error('Failed to query MediaFire account info:', err);
    return {
      usedBytes: 0,
      maxBytes: 10737418240, // 10 GB
    };
  }
}

/**
 * Retrieve high-speed direct download / streaming link from MediaFire
 */
export async function getMediaFireDownloadUrl(quickKey: string): Promise<string> {
  if (!quickKey) {
    throw new Error('QuickKey is required for MediaFire download');
  }

  const token = await getMediaFireSessionToken();
  const res = await fetch(
    `https://www.mediafire.com/api/1.5/file/get_links.php?quick_key=${quickKey}&link_type=direct_download&session_token=${token}&response_format=json`
  );
  const data = await res.json();

  const directLink = data?.response?.links?.[0]?.direct_download;
  if (!directLink) {
    // If direct link is not immediately available or free bandwidth consumed, try normal link
    const normalLink = data?.response?.links?.[0]?.normal_download;
    if (normalLink) return normalLink;
    throw new Error(`MediaFire direct download link unavailable: ${data?.response?.message || 'No link returned'}`);
  }

  return directLink;
}

/**
 * Delete a file permanently from MediaFire by quickkey
 */
export async function deleteMediaFireFile(quickKey: string): Promise<boolean> {
  if (!quickKey) return false;

  try {
    const token = await getMediaFireSessionToken();
    const res = await fetch(
      `https://www.mediafire.com/api/1.5/file/delete.php?quick_key=${quickKey}&session_token=${token}&response_format=json`
    );
    const data = await res.json();
    return data?.response?.result === 'Success';
  } catch (err) {
    console.error('Failed to delete file from MediaFire:', err);
    return false;
  }
}
