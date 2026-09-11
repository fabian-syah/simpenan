// ============================================================
// ShareModal Component — Public Link Sharing Dialog
// ============================================================
import { useState, useCallback } from 'react';
import {
  Link as LinkIcon, Check, Copy, ExternalLink, X, Globe, ShieldCheck
} from 'lucide-react';
import type { FileRecord } from '../../types';
import { formatBytes } from '../../types';

interface ShareModalProps {
  file: FileRecord | null;
  onClose: () => void;
}

export function ShareModal({ file, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = file ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${file.id}` : '';

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [shareUrl]);

  if (!file) return null;

  return (
    <div
      className="cv-modal-overlay"
      onClick={onClose}
      style={{ zIndex: 10010, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="cv-modal-content cv-bento-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '480px',
          padding: '24px',
          background: 'var(--cv-bg-primary)',
          border: '1px solid var(--cv-border)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                Bagikan Berkas
              </h3>
              <p style={{ fontSize: 12, color: 'var(--cv-text-tertiary)' }}>
                Siapa saja dengan tautan ini dapat melihat & mengunduh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cv-text-tertiary)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* File Preview Card */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--cv-bg-secondary)',
            border: '1px solid var(--cv-border)',
            borderRadius: 12,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
            <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--cv-text-primary)' }}>
              {file.name}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--cv-text-tertiary)' }}>
            {formatBytes(file.size_bytes)}
          </span>
        </div>

        {/* Share Link Input Box */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--cv-text-secondary)', display: 'block', marginBottom: 8 }}>
            Tautan Publik:
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--cv-bg-tertiary)',
              border: '1px solid var(--cv-border)',
              borderRadius: 10,
              padding: '6px 8px 6px 12px',
            }}
          >
            <LinkIcon size={16} color="var(--cv-accent)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              readOnly
              value={shareUrl}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--cv-text-primary)',
                fontSize: 12.5,
                width: '100%',
                minWidth: 0,
                outline: 'none',
                fontFamily: 'monospace',
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="cv-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
                background: copied ? 'rgba(16, 185, 129, 0.9)' : undefined,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Tersalin!' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Security / Info Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--cv-text-secondary)',
            marginBottom: 24,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.08)',
          }}
        >
          <ShieldCheck size={16} color="#38bdf8" />
          <span>Akses streaming langsung multi-cloud tanpa memerlukan login.</span>
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="cv-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={15} />
            Buka Halaman Share
          </a>

          <button
            type="button"
            onClick={onClose}
            className="cv-btn-primary"
            style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13 }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
