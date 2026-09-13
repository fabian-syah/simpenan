import type { QuotaInfo } from '../../types';
import { formatBytes } from '../../types';
import { Cloud, Plus } from 'lucide-react';

interface QuotaBarProps {
  quota: QuotaInfo | null;
  loading: boolean;
  onOpenManageStorage?: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  gdrive: '#0F9D58',
  mega: '#ea1b25',
  mediafire: '#0070f3',
  backblaze: 'var(--cv-provider-backblaze)',
  filebase: 'var(--cv-provider-filebase)',
  supabase: 'var(--cv-provider-supabase)',
};

const GDRIVE_PALETTE = ['#0F9D58', '#4285F4', '#F4B400', '#EA4335', '#10b981', '#06b6d4'];

export function getProviderColor(id: string): string {
  if (id === 'gdrive' || id.startsWith('gdrive')) {
    if (id === 'gdrive' || id === 'gdrive_1') return '#0F9D58';
    const num = parseInt(id.replace(/\D/g, ''), 10) || 2;
    return GDRIVE_PALETTE[(num - 1) % GDRIVE_PALETTE.length] || '#4285F4';
  }
  return PROVIDER_COLORS[id] || 'var(--cv-accent)';
}

export function QuotaBar({ quota, loading, onOpenManageStorage }: QuotaBarProps) {
  if (loading || !quota) {
    return (
      <div className="cv-quota-bar">
        <div className="cv-skeleton" style={{ height: 8, marginBottom: 12, borderRadius: 99 }} />
        <div className="cv-skeleton" style={{ height: 14, width: '70%', borderRadius: 6 }} />
      </div>
    );
  }

  const usedPercent = quota.total_max_bytes > 0
    ? (quota.total_used_bytes / quota.total_max_bytes) * 100
    : 0;

  return (
    <div className="cv-quota-bar">
      {/* Total usage text */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Cloud size={14} style={{ color: 'var(--cv-accent)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
            Cloud Storage
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onOpenManageStorage && (
            <button
              onClick={onOpenManageStorage}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: 'var(--cv-accent)',
                fontSize: 10.5,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--cv-radius-full)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              title="Kelola & Tambah Akun Google Drive"
            >
              <Plus size={11} strokeWidth={2.5} />
              <span>Akun</span>
            </button>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-accent)', background: 'var(--cv-accent-muted)', padding: '2px 7px', borderRadius: 'var(--cv-radius-full)' }}>
            {usedPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="cv-quota-segments">
        {quota.providers.map(provider => {
          const segmentWidth = quota.total_max_bytes > 0
            ? (provider.used_bytes / quota.total_max_bytes) * 100
            : 0;
          if (segmentWidth <= 0) return null;
          return (
            <div
              key={provider.id}
              className="cv-quota-segment"
              style={{
                width: `${Math.max(segmentWidth, 1)}%`,
                background: getProviderColor(provider.id),
              }}
              title={`${provider.display_name}: ${formatBytes(provider.used_bytes)} / ${formatBytes(provider.max_bytes)}`}
            />
          );
        })}
      </div>

      {/* Capacity Subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cv-text-tertiary)', marginTop: 6, fontWeight: 500 }}>
        <span>{formatBytes(quota.total_used_bytes)} used</span>
        <span>{formatBytes(quota.total_max_bytes)} total</span>
      </div>

      {/* Multi-cloud breakdown */}
      <div className="cv-quota-legend">
        {quota.providers.map(provider => (
          <div key={provider.id} className="cv-quota-legend-item">
            <div className="cv-quota-legend-left">
              <div
                className="cv-quota-dot"
                style={{ background: getProviderColor(provider.id) }}
              />
              <span>{provider.display_name}</span>
            </div>
            <span style={{ fontWeight: 500, color: 'var(--cv-text-primary)' }}>
              {formatBytes(provider.used_bytes)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
