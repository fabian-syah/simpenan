import type { QuotaInfo } from '../../types';
import { formatBytes } from '../../types';
import { Cloud, Plus, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface QuotaBarProps {
  quota: QuotaInfo | null;
  loading: boolean;
  onOpenManageStorage?: () => void;
  onOpenUpgrade?: () => void;
  user?: any | null;
  isSuperAdmin?: boolean;
  onOpenAuth?: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  gdrive: '#0284c7',
  mega: '#38bdf8',
  mediafire: '#0070f3',
  backblaze: 'var(--cv-provider-backblaze)',
  filebase: 'var(--cv-provider-filebase)',
  supabase: 'var(--cv-provider-supabase)',
};

const GDRIVE_PALETTE = ['#0284c7', '#38bdf8', '#0ea5e9', '#0369a1', '#10b981', '#06b6d4'];

export function getProviderColor(id: string): string {
  if (id === 'gdrive' || id.startsWith('gdrive')) {
    if (id === 'gdrive' || id === 'gdrive_1') return '#0284c7';
    const num = parseInt(id.replace(/\D/g, ''), 10) || 2;
    return GDRIVE_PALETTE[(num - 1) % GDRIVE_PALETTE.length] || '#38bdf8';
  }
  return PROVIDER_COLORS[id] || 'var(--cv-accent)';
}

export function QuotaBar({
  quota,
  loading,
  onOpenManageStorage,
  onOpenUpgrade,
  user,
  isSuperAdmin = false,
  onOpenAuth,
}: QuotaBarProps) {
  const [showBackendPool, setShowBackendPool] = useState(false);

  if (loading || !quota) {
    return (
      <div className="cv-quota-bar">
        <div className="cv-skeleton" style={{ height: 8, marginBottom: 12, borderRadius: 99 }} />
        <div className="cv-skeleton" style={{ height: 14, width: '70%', borderRadius: 6 }} />
      </div>
    );
  }

  const userQuota = quota.user_quota;

  // 1. Guest / Unauthenticated State: Show Starter Free Tier (2 GB), NEVER backend pool!
  if (!user || !userQuota) {
    return (
      <div className="cv-quota-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cv-text-secondary)' }}>
            Simpenan Cloud Starter
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-accent)' }}>
            2 GB Gratis
          </span>
        </div>

        {/* 0% progress bar */}
        <div style={{ height: 6, width: '100%', backgroundColor: 'var(--cv-border)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: '2%', backgroundColor: 'var(--cv-accent)', borderRadius: 99 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cv-text-tertiary)', marginBottom: 10 }}>
          <span>0 B digunakan</span>
          <span>dari 2 GB</span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--cv-text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
          Daftar akun gratis sekarang untuk mengaktifkan penyimpanan cloud 2 GB Anda.
        </div>

        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="cv-btn cv-btn-primary"
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 8,
              justifyContent: 'center',
            }}
          >
            Daftar Gratis (2 GB)
          </button>
        )}
      </div>
    );
  }

  // 2. Authenticated User Quota Section
  const usedPercent = quota.total_max_bytes > 0
    ? (quota.total_used_bytes / quota.total_max_bytes) * 100
    : 0;

  return (
    <div className="cv-quota-bar">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: userQuota.tier === 'founder'
                ? 'var(--cv-accent)'
                : userQuota.tier === 'pro'
                ? '#c084fc'
                : 'var(--cv-text-secondary)',
            }}>
              Paket {userQuota.tier === 'founder' ? "Founder's Lifetime" : userQuota.tier}
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-accent)' }}>
            {userQuota.usedPercentage}%
          </span>
        </div>

        {/* User storage progress bar */}
        <div style={{ height: 6, width: '100%', backgroundColor: 'var(--cv-border)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(userQuota.usedPercentage, 2))}%`,
              backgroundColor: userQuota.usedPercentage > 90 ? 'var(--cv-error)' : 'var(--cv-accent)',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cv-text-tertiary)', marginBottom: 10 }}>
          <span>{formatBytes(userQuota.usedBytes)} digunakan</span>
          <span>dari {formatBytes(userQuota.storageLimitBytes)}</span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--cv-text-secondary)', marginBottom: 10 }}>
          Batas upload: <strong style={{ color: 'var(--cv-text-primary)' }}>{formatBytes(userQuota.maxFileSizeBytes)} / file</strong>
        </div>

        {onOpenUpgrade && userQuota.tier !== 'creator' && (
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="cv-quota-upgrade-btn"
            style={{
              marginBottom: isSuperAdmin ? 10 : 0,
            }}
          >
            <Zap size={13} fill="currentColor" />
            <span>
              {userQuota.tier === 'starter'
                ? 'Upgrade ke 50 GB Lifetime (Rp 99.000)'
                : userQuota.tier === 'testing'
                ? 'Upgrade ke Founder (50 GB Lifetime)'
                : userQuota.tier === 'founder'
                ? 'Upgrade ke Creator (200 GB)'
                : 'Upgrade Kapasitas Simpenan'}
            </span>
          </button>
        )}

        {/* Super Admin ONLY: Toggle backend multi-cloud pool details */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowBackendPool(!showBackendPool)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cv-text-tertiary)',
              fontSize: 10.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '4px 0',
            }}
          >
            <span>Status Server Backend (Admin)</span>
            {showBackendPool ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Backend multi-drive storage pool view (Admin ONLY) */}
      {isSuperAdmin && showBackendPool && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--cv-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cloud size={12} style={{ color: 'var(--cv-accent)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                Server Pool Simpenan Cloud
              </span>
            </div>
            {onOpenManageStorage && (
              <button
                onClick={onOpenManageStorage}
                style={{
                  background: 'var(--cv-accent-muted)',
                  border: '1px solid var(--cv-border)',
                  color: 'var(--cv-accent)',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title="Kelola Server Cloud Storage"
              >
                <Plus size={10} strokeWidth={2.5} />
                <span>Akun</span>
              </button>
            )}
          </div>

          <div className="cv-quota-segments" style={{ height: 5, borderRadius: 99, overflow: 'hidden', display: 'flex', backgroundColor: 'var(--cv-border)' }}>
            {quota.providers.map((provider) => {
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
                  title={`${provider.display_name?.replace(/Google Drive/gi, 'Simpenan Cloud')}: ${formatBytes(provider.used_bytes)} / ${formatBytes(provider.max_bytes)}`}
                />
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--cv-text-tertiary)', marginTop: 4 }}>
            Total Kapasitas: {formatBytes(quota.total_used_bytes)} / {formatBytes(quota.total_max_bytes)} ({usedPercent.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
}
