// ============================================================
// Helper to trigger GitHub Actions video transcode worker
// ============================================================

export async function triggerTranscodeWorker(fileId?: string): Promise<{ success: boolean; triggered: boolean; message: string }> {
  const token = (process.env.GITHUB_TOKEN || process.env.GH_PAT)?.trim();
  const repo = (process.env.GITHUB_REPO || 'fabian-syah/simpenan').trim();

  if (!token) {
    console.log('[TranscodeTrigger] GITHUB_TOKEN not configured in environment. Transcoder will run on 5-min cron.');
    return {
      success: true,
      triggered: false,
      message: 'Worker scheduled via 5-minute cloud cron (set GITHUB_TOKEN for instant 5-second trigger)',
    };
  }

  try {
    // 1. Try repository_dispatch
    const dispatchUrl = `https://api.github.com/repos/${repo}/dispatches`;
    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Simpenan-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'transcode_video',
        client_payload: { fileId },
      }),
    });

    if (res.status === 204 || res.ok) {
      console.log(`[TranscodeTrigger] Successfully triggered repository_dispatch on ${repo}`);
      return { success: true, triggered: true, message: 'Cloud Transcoder triggered immediately' };
    }

    // 2. Fallback to workflow_dispatch
    const wfUrl = `https://api.github.com/repos/${repo}/actions/workflows/transcode-worker.yml/dispatches`;
    const wfRes = await fetch(wfUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Simpenan-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    });

    if (wfRes.status === 204 || wfRes.ok) {
      console.log(`[TranscodeTrigger] Successfully triggered workflow_dispatch on ${repo}`);
      return { success: true, triggered: true, message: 'Cloud Transcoder workflow triggered immediately' };
    }

    const errText = await wfRes.text();
    console.warn(`[TranscodeTrigger] GitHub API response: ${wfRes.status} ${errText}`);
    return { success: false, triggered: false, message: `GitHub API ${wfRes.status}: ${errText}` };
  } catch (err: any) {
    console.error('[TranscodeTrigger] Failed to trigger GitHub Actions:', err);
    return { success: false, triggered: false, message: err.message };
  }
}
