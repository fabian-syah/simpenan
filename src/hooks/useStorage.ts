// ============================================================
// useStorage Hook — Quota tracking
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import type { QuotaInfo } from '../types';
import { getQuota } from '../lib/api';

export function useStorage() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async () => {
    try {
      const data = await getQuota();
      setQuota(data);
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return { quota, loading, refetch: fetchQuota, fetchQuota };
}
