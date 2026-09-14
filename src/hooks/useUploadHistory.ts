// ============================================================
// useUploadHistory — Upload history log with localStorage
// ============================================================
import { useState, useCallback } from 'react';
import type { ProviderId } from '../types';

const STORAGE_KEY = 'simpenan_upload_history';
const MAX_ENTRIES = 100;

export interface UploadHistoryEntry {
  id: string;
  fileName: string;
  fileSize: number;
  provider: ProviderId | string;
  status: 'complete' | 'failed';
  error?: string;
  startedAt: string;
  completedAt: string;
  averageSpeed: number;
  path: string;
}

function loadHistory(): UploadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: UploadHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {}
}

export function useUploadHistory() {
  const [history, setHistory] = useState<UploadHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: UploadHistoryEntry) => {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  return { history, addEntry, clearHistory, refreshHistory };
}
