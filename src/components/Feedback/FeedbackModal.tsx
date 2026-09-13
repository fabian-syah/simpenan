import { useState, useMemo, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Loader2, Sparkles, FileText } from 'lucide-react';
import type { FileRecord } from '../../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  activeFile?: FileRecord | null;
  initialError?: string | null;
  initialCategory?: 'quota' | 'media' | 'upload' | 'suggestion' | 'general';
}

const CATEGORIES = [
  { id: 'quota', label: 'Kuota / Limit Exceeded', short: 'Kuota' },
  { id: 'media', label: 'Masalah Video / Audio', short: 'Media' },
  { id: 'upload', label: 'Gagal Upload / Unduh', short: 'Upload' },
  { id: 'suggestion', label: 'Saran & Ide Fitur', short: 'Saran' },
  { id: 'general', label: 'Pertanyaan / Umum', short: 'Umum' },
] as const;

export function FeedbackModal({
  isOpen,
  onClose,
  currentPath = '/',
  activeFile,
  initialError,
  initialCategory = 'general',
}: FeedbackModalProps) {
  const [category, setCategory] = useState<string>(initialCategory);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(() => localStorage.getItem('cv_feedback_contact') || '');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMetaDetails, setShowMetaDetails] = useState(false);

  // Auto-fill error or media category if initialError exists
  useEffect(() => {
    if (initialError) {
      setCategory(initialError.toLowerCase().includes('kuota') ? 'quota' : 'media');
      setMessage((prev) => prev || `Terjadi kendala: ${initialError}`);
    } else if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialError, initialCategory, isOpen]);

  // Gather system / technical context metadata
  const metadata = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return {
      screen: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      currentPath,
      activeFile: activeFile
        ? {
            id: activeFile.id,
            name: activeFile.name,
            size_bytes: activeFile.size_bytes,
            provider_id: activeFile.provider_id,
            mime_type: activeFile.mime_type,
          }
        : null,
      lastError: initialError || null,
      timestamp: new Date().toISOString(),
    };
  }, [currentPath, activeFile, initialError, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (contact.trim()) {
        try {
          localStorage.setItem('cv_feedback_contact', contact.trim());
        } catch {}
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          contact: contact.trim() || undefined,
          fileId: activeFile?.id,
          fileName: activeFile?.name,
          pagePath: currentPath,
          userAgent: navigator.userAgent,
          metadata: includeMetadata ? metadata : { stripped: true },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengirim feedback');
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setMessage('');
        setSubmitSuccess(false);
        onClose();
      }, 2200);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat mengirim feedback. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="cv-modal-overlay"
      style={{ zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="cv-feedback-modal"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="cv-feedback-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--cv-accent-muted)',
                color: 'var(--cv-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--cv-border-hover)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cv-text-primary)' }}>
                Kirim Feedback & Laporan
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--cv-text-secondary)', marginTop: 1 }}>
                Bantu pengujian beta Simpenan Cloud
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cv-text-tertiary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        {submitSuccess ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--cv-success, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--cv-text-primary)', margin: '0 0 8px' }}>
              Laporan Berhasil Dikirim!
            </h4>
            <p style={{ fontSize: 13, color: 'var(--cv-text-secondary)', maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
              Terima kasih atas kontribusi Anda dalam pengujian beta. Laporan ini telah tersimpan di sistem kami.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="cv-feedback-body">
            {/* Category Select Pills */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--cv-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Kategori Kendala / Masukan
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`cv-feedback-category-btn ${isSelected ? 'active' : ''}`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active file reference badge if applicable */}
            {activeFile && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--cv-accent-muted)',
                  border: '1px solid var(--cv-border-hover)',
                  color: 'var(--cv-accent)',
                  fontSize: 11.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <FileText size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Terkait berkas: <strong>{activeFile.name}</strong>
                </span>
              </div>
            )}

            {/* Message Textarea */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--cv-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Deskripsi Masalah / Saran <span style={{ color: 'var(--cv-error, #ef4444)' }}>*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ceritakan kendala yang Anda alami (misal: tombol 360p macet, gagal upload file >1GB, saran tampilan, dll)..."
                rows={4}
                required
                autoFocus
                className="cv-feedback-textarea"
              />
            </div>

            {/* Contact Input (Optional) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--cv-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Kontak / Email / Sosmed <span style={{ fontSize: 10.5, textTransform: 'none', color: 'var(--cv-text-tertiary)' }}>(Opsional jika ingin dihubungi tim)</span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="nama@email.com atau @username"
                className="cv-feedback-input"
              />
            </div>

            {/* Technical Metadata Box */}
            <div className="cv-feedback-meta-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--cv-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    style={{ accentColor: 'var(--cv-accent)', cursor: 'pointer' }}
                  />
                  <span>Sertakan info teknis otomatis (Browser, OS, resolusi layar)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowMetaDetails((v) => !v)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--cv-accent)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 4px',
                  }}
                >
                  {showMetaDetails ? 'Sembunyikan' : 'Lihat'}
                </button>
              </div>

              {showMetaDetails && includeMetadata && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid var(--cv-border)',
                    fontFamily: 'monospace',
                    fontSize: 10.5,
                    color: 'var(--cv-text-tertiary)',
                    lineHeight: 1.5,
                  }}
                >
                  <div>Path: {currentPath}</div>
                  <div>Screen: {metadata.screen}</div>
                  <div>Platform: {metadata.platform}</div>
                  {activeFile && <div>File: {activeFile.name} ({activeFile.id})</div>}
                  {initialError && <div style={{ color: 'var(--cv-error, #ef4444)' }}>Error: {initialError}</div>}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--cv-error, #ef4444)',
                  fontSize: 12,
                  marginBottom: 14,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="cv-btn cv-btn-secondary"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="cv-btn cv-btn-primary"
                style={{
                  opacity: isSubmitting || !message.trim() ? 0.5 : 1,
                  cursor: isSubmitting || !message.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Kirim Laporan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
