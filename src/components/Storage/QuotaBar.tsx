import type { QuotaInfo } from '../../types';
import { formatBytes } from '../../types';
import { Cloud } from 'lucide-react';

interface QuotaBarProps {
  quota: QuotaInfo | null;
  loading: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  gdrive: '#0F9D58',
  mega: '#ea1b25',
  mediafire: '#0070f3',
  backblaze: 'var(--cv-provider-backblaze)',
  filebase: 'var(--cv-provider-filebase)',
  supabase: 'var(--cv-provider-supabase)',
};

export function QuotaBar({ quota, loading }: QuotaBarProps) {
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
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-accent)', background: 'var(--cv-accent-muted)', padding: '2px 7px', borderRadius: 'var(--cv-radius-full)' }}>
          {usedPercent.toFixed(1)}%
        </span>
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
                background: PROVIDER_COLORS[provider.id] || 'var(--cv-accent)',
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
                style={{ background: PROVIDER_COLORS[provider.id] || 'var(--cv-accent)' }}
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
