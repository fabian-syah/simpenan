import { useState, useCallback } from 'react';
import { X, Sparkles, Check, AlertCircle, Play } from 'lucide-react';
import { formatBytes, type FileRecord } from '../../types';
import { transcodeVideo, terminateFFmpeg, type VideoResolution } from '../../lib/transcode';
import { requestUploadUrl, completeUpload } from '../../lib/api';
import { uploadChunkToUrl } from '../../lib/chunker';

interface TranscodeModalProps {
  file: FileRecord;
  videoUrl: string;
  initialResolution?: VideoResolution;
  onClose: () => void;
  onSuccess: (variant: { id: string; name: string }) => void;
}

export function TranscodeModal({ file, videoUrl, initialResolution, onClose, onSuccess }: TranscodeModalProps) {
  const [targetRes, setTargetRes] = useState<VideoResolution>(initialResolution || '720p');
  const [status, setStatus] = useState<'idle' | 'transcoding' | 'uploading' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState<{ id: string; name: string } | null>(null);

  const handleCancel = useCallback(() => {
    terminateFFmpeg();
    setStatus('idle');
    setProgress(0);
    onClose();
  }, [onClose]);

  const startTranscoding = useCallback(async () => {
    setStatus('transcoding');
    setProgress(0);
    setErrorMessage(null);

    try {
      // 1. Transcode using WebAssembly FFmpeg
      const transcodedFile = await transcodeVideo(
        videoUrl,
        file.name,
        targetRes,
        (p) => setProgress(p)
      );

      // 2. Upload transcoded variant to cloud
      setStatus('uploading');
      setProgress(100);

      const variantFileName = transcodedFile.name;
      const variantPath = `.variants/${file.id}`;

      const ticket = await requestUploadUrl(
        variantFileName,
        transcodedFile.size,
        'video/mp4',
        variantPath,
        file.provider_id || 'auto'
      );

      if (!ticket.presignedUrls || ticket.presignedUrls.length === 0) {
        throw new Error('Gagal mendapatkan URL upload penyimpanan');
      }

      await uploadChunkToUrl(ticket.presignedUrls[0], transcodedFile);
      await completeUpload(ticket.fileId);

      const createdVariant = { id: ticket.fileId, name: variantFileName };
      setNewVariant(createdVariant);
      setStatus('complete');
      onSuccess(createdVariant);
    } catch (err: any) {
      console.error('Transcode error:', err);
      setStatus('error');
      setErrorMessage(
        err.message || 'Terjadi kesalahan saat memproses resolusi. Pastikan memori browser mencukupi.'
      );
    }
  }, [file, videoUrl, targetRes, onSuccess]);

  return (
    <div
      className="cv-modal-overlay"
      onClick={status === 'transcoding' || status === 'uploading' ? undefined : onClose}
      style={{ zIndex: 10005, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="cv-modal-content cv-bento-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '520px',
          padding: '24px',
          background: 'var(--cv-bg-primary)',
          border: '1px solid var(--cv-border)',
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                Proses Resolusi Video
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--cv-text-tertiary)' }}>
                Buat versi ringan agar streaming lancar tanpa lag
              </p>
            </div>
          </div>

          {status !== 'uploading' && (
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--cv-text-tertiary)',
                cursor: 'pointer',
              }}
              title="Tutup & Batalkan"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* File Info Card */}
        <div
          style={{
            background: 'var(--cv-bg-tertiary)',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--cv-border)',
            marginBottom: 20,
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
            <span style={{ fontWeight: 600, color: 'var(--cv-text-primary)' }}>{file.name}</span>
          </div>
          <span style={{ color: 'var(--cv-text-secondary)', fontSize: 12 }}>
            {formatBytes(file.size_bytes)}
          </span>
        </div>

        {/* Content State: Idle */}
        {status === 'idle' && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--cv-text-secondary)', display: 'block', marginBottom: 10 }}>
              Pilih Resolusi Target:
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                {
                  id: '720p' as VideoResolution,
                  title: '720p (HD Ringan)',
                  desc: 'Kualitas tajam, ukuran file berkurang ~50%, sangat cocok untuk laptop/tablet',
                },
                {
                  id: '480p' as VideoResolution,
                  title: '480p (SD Standar)',
                  desc: 'Lancar untuk koneksi standar atau saat kuota terbatas',
                },
                {
                  id: '360p' as VideoResolution,
                  title: '360p (Hemat Kuota)',
                  desc: 'Sangat ringan & anti-buffering untuk jaringan lemah / smartphone',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setTargetRes(opt.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: `1.5px solid ${targetRes === opt.id ? 'var(--cv-accent)' : 'var(--cv-border)'}`,
                    background: targetRes === opt.id ? 'var(--cv-accent-muted)' : 'var(--cv-bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--cv-text-primary)' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--cv-text-tertiary)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </div>
                  {targetRes === opt.id && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--cv-accent)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                className="cv-btn-secondary"
                style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13.5 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={startTranscoding}
                className="cv-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 22px',
                  borderRadius: 10,
                  fontSize: 13.5,
                }}
              >
                <Sparkles size={16} />
                Mulai Proses {targetRes}
              </button>
            </div>
          </div>
        )}

        {/* Content State: Transcoding / Uploading */}
        {(status === 'transcoding' || status === 'uploading') && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              className="cv-spinner"
              style={{
                width: 48,
                height: 48,
                borderWidth: 4,
                borderColor: 'rgba(56, 189, 248, 0.2)',
                borderTopColor: 'var(--cv-accent)',
                margin: '0 auto 16px',
              }}
            />

            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
              {status === 'transcoding' ? `Mengonversi video ke ${targetRes}...` : 'Mengunggah versi baru ke Cloud...'}
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--cv-text-tertiary)', maxWidth: 360, margin: '0 auto 18px', lineHeight: 1.5 }}>
              {status === 'transcoding'
                ? 'Sedang diproses oleh engine hardware-accelerated. Jangan tutup tab browser Anda.'
                : 'Menyimpan resolusi baru ke penyimpanan multi-cloud...'}
            </p>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 8,
                borderRadius: 99,
                background: 'var(--cv-bg-tertiary)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--cv-cloud-gradient)',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--cv-text-secondary)', fontWeight: 500 }}>
              {progress}%
            </div>

            {status === 'transcoding' && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                >
                  <X size={14} />
                  Batalkan & Bebaskan Memori RAM
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content State: Complete */}
        {status === 'complete' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Check size={28} />
            </div>

            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
              Resolusi {targetRes} Berhasil Dibuat!
            </div>
            {newVariant && (
              <div style={{ fontSize: 12, color: 'var(--cv-accent)', marginBottom: 10, fontFamily: 'monospace' }}>
                {newVariant.name}
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--cv-text-secondary)', marginBottom: 20 }}>
              Versi ringan sekarang siap ditonton langsung tanpa lag.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="cv-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              <Play size={16} fill="white" />
              Tonton Sekarang
            </button>
          </div>
        )}

        {/* Content State: Error */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertCircle size={26} />
            </div>

            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
              Gagal Memproses Resolusi
            </div>
            <p style={{ fontSize: 12.5, color: '#ef4444', maxWidth: 360, margin: '0 auto 18px', lineHeight: 1.5 }}>
              {errorMessage}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                className="cv-btn-secondary"
                style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13 }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={startTranscoding}
                className="cv-btn-primary"
                style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13 }}
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
