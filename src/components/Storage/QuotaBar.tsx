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
      <div className="cv-quota-bar" style={{ padding: 12, backgroundColor: '#070b14', borderRadius: 10, border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Simpenan Cloud Starter
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>
            2 GB Gratis
          </span>
        </div>

        {/* 0% progress bar */}
        <div style={{ height: 6, width: '100%', backgroundColor: '#1e293b', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: '2%', backgroundColor: '#0284c7', borderRadius: 99 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10 }}>
          <span>0 B digunakan</span>
          <span>dari 2 GB</span>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
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
    <div className="cv-quota-bar" style={{ padding: 12, backgroundColor: '#070b14', borderRadius: 10, border: '1px solid #1e293b' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: userQuota.tier === 'founder' ? '#38bdf8' : userQuota.tier === 'pro' ? '#c084fc' : '#94a3b8' }}>
              Paket {userQuota.tier === 'founder' ? "Founder's Lifetime" : userQuota.tier}
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>
            {userQuota.usedPercentage}%
          </span>
        </div>

        {/* User storage progress bar */}
        <div style={{ height: 6, width: '100%', backgroundColor: '#1e293b', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(userQuota.usedPercentage, 2))}%`,
              backgroundColor: userQuota.usedPercentage > 90 ? '#ef4444' : '#0284c7',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 10 }}>
          <span>{formatBytes(userQuota.usedBytes)} digunakan</span>
          <span>dari {formatBytes(userQuota.storageLimitBytes)}</span>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          Batas upload: <strong>{formatBytes(userQuota.maxFileSizeBytes)} / file</strong>
        </div>

        {userQuota.tier === 'starter' && onOpenUpgrade && (
          <button
            type="button"
            onClick={onOpenUpgrade}
            style={{
              width: '100%',
              padding: '7px 10px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 8,
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: isSuperAdmin ? 10 : 0,
            }}
          >
            <Zap size={12} fill="#38bdf8" />
            <span>Upgrade ke 50 GB Lifetime (Rp 99.000)</span>
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
              color: '#64748b',
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
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
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
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
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

          <div className="cv-quota-segments" style={{ height: 5, borderRadius: 99, overflow: 'hidden', display: 'flex', backgroundColor: '#1e293b' }}>
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
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
            Total Kapasitas: {formatBytes(quota.total_used_bytes)} / {formatBytes(quota.total_max_bytes)} ({usedPercent.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
}
