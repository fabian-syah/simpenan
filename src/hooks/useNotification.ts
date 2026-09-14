// ============================================================
// useNotification — Browser Notification API + sonner fallback
// ============================================================
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useNotification() {
  const permissionRef = useRef<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (permissionRef.current === 'default') {
      const result = await Notification.requestPermission();
      permissionRef.current = result;
    }
  }, []);

  const notify = useCallback((title: string, body?: string, options?: { icon?: string }) => {
    // Only show browser notification when tab is hidden
    if (document.hidden && permissionRef.current === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: options?.icon || '/simpenan-logo.png',
          badge: '/simpenan-logo.png',
        });
        return;
      } catch {}
    }
    // Fallback to in-app toast
    toast.success(title, { description: body, duration: 4000 });
  }, []);

  const notifyError = useCallback((title: string, body?: string) => {
    if (document.hidden && permissionRef.current === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/simpenan-logo.png',
        });
        return;
      } catch {}
    }
    toast.error(title, { description: body, duration: 5000 });
  }, []);

  const notifyUploadComplete = useCallback((fileName: string) => {
    notify('Upload selesai ✓', fileName);
  }, [notify]);

  const notifyUploadFailed = useCallback((fileName: string, error?: string) => {
    notifyError('Upload gagal ✗', `${fileName}${error ? ': ' + error : ''}`);
  }, [notifyError]);

  const notifyBatchComplete = useCallback((count: number) => {
    notify('Upload selesai ✓', `${count} berkas berhasil diunggah`);
  }, [notify]);

  const notifyDownloadComplete = useCallback((fileName: string) => {
    notify('Download selesai ✓', fileName);
  }, [notify]);

  return {
    requestPermission,
    notify,
    notifyError,
    notifyUploadComplete,
    notifyUploadFailed,
    notifyBatchComplete,
    notifyDownloadComplete,
  };
}
