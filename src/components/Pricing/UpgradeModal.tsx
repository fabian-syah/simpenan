import React, { useState, useEffect } from 'react';
import { X, Check, Zap, Shield, Sparkles, ExternalLink, RefreshCw, ArrowLeft } from 'lucide-react';
import { createPaymentOrder, checkPaymentStatus } from '../../lib/api';
import type { UserQuota } from '../../types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userQuota?: UserQuota | null;
  initialReason?: string | null;
  onUpgradeSuccess?: () => void;
  onOpenLegal?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  userQuota,
  initialReason,
  onUpgradeSuccess,
  onOpenLegal,
}) => {
  const [selectedTier, setSelectedTier] = useState<'testing' | 'founder' | 'pro' | 'creator'>('testing');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'lifetime'>('lifetime');
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTier === 'founder' || selectedTier === 'testing') {
      setBillingPeriod('lifetime');
    } else if (billingPeriod === 'lifetime') {
      setBillingPeriod('monthly');
    }
  }, [selectedTier]);

  // Real-time automatic payment polling (every 3 seconds)
  useEffect(() => {
    if (!activeOrder?.orderId || orderStatus === 'PAID') return;
    const interval = setInterval(async () => {
      try {
        const statusRes = await checkPaymentStatus(activeOrder.orderId);
        if (statusRes.status === 'PAID') {
          setOrderStatus('PAID');
          onUpgradeSuccess?.();
          clearInterval(interval);
        }
      } catch {
        // silent polling error
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeOrder?.orderId, orderStatus, onUpgradeSuccess]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await createPaymentOrder(selectedTier, billingPeriod, 'QRIS');
      if (res && res.orderId) {
        setActiveOrder(res);
        setOrderStatus('PENDING');
        // Do NOT open external tab! Stay embedded inside modal
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memulai transaksi pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!activeOrder?.orderId) return;
    setCheckingStatus(true);
    setErrorMsg(null);

    try {
      const statusRes = await checkPaymentStatus(activeOrder.orderId);
      if (statusRes.status === 'PAID') {
        setOrderStatus('PAID');
        onUpgradeSuccess?.();
      } else {
        setOrderStatus(statusRes.status);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memeriksa status pembayaran.');
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div
      className="cv-upgrade-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cv-upgrade-modal">
        {/* Header */}
        <div className="cv-upgrade-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Sparkles size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Upgrade Kapasitas Simpenan Cloud
              </h3>
              {userQuota && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99,
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    textTransform: 'uppercase',
                  }}
                >
                  Paket: {userQuota.tier}
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
              Pilih paket sesuai kebutuhan penyimpanan dan batas ukuran file Anda
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="cv-upgrade-body">
          {initialReason && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                backgroundColor: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 8,
                color: '#facc15',
                fontSize: 12.5,
                lineHeight: 1.4,
              }}
            >
              {initialReason}
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#f87171',
                fontSize: 12.5,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Active Payment View (QRIS Only) */}
          {activeOrder && orderStatus !== 'PAID' ? (
            <div className="cv-qris-card">
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Total Pembayaran</div>
                <div className="cv-qris-amount">
                  Rp {activeOrder.amount?.toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, wordBreak: 'break-all' }}>
                  Order ID: <code>{activeOrder.orderId}</code>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="cv-qris-img-box">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(activeOrder.qrString || activeOrder.paymentUrl)}`}
                  alt="QRIS Pembayaran"
                  className="cv-qris-img"
                />
                <div className="cv-qris-img-label">
                  QRIS RESMI (GOPAY / OVO / DANA / BCA / LIVIN)
                </div>
              </div>

              {/* Live Auto-Polling Status Indicator */}
              <div className="cv-qris-poll">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span>
                  Menunggu pembayaran via QRIS... Terdeteksi otomatis setiap 3 detik
                </span>
              </div>

              <div className="cv-qris-actions">
                <button
                  type="button"
                  onClick={handleCheckPayment}
                  disabled={checkingStatus}
                  className="cv-btn cv-btn-secondary"
                >
                  <RefreshCw size={13} className={checkingStatus ? 'animate-spin' : ''} />
                  <span>{checkingStatus ? 'Memeriksa...' : 'Cek Status Sekarang'}</span>
                </button>
                {activeOrder.paymentUrl && (
                  <a
                    href={activeOrder.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cv-btn cv-btn-ghost"
                    style={{ color: '#94a3b8' }}
                  >
                    <ExternalLink size={13} />
                    <span>Buka di Tab Baru</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="cv-btn cv-btn-ghost"
                  style={{ color: '#ef4444' }}
                >
                  <ArrowLeft size={13} />
                  <span>Ganti Paket</span>
                </button>
              </div>
            </div>
          ) : orderStatus === 'PAID' ? (
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'inline-flex', padding: 12, borderRadius: 50, backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', marginBottom: 12 }}>
                <Check size={32} />
              </div>
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#4ade80' }}>
                Pembayaran Berhasil!
              </h4>
              <p style={{ margin: '8px 0 20px', fontSize: 13, color: '#94a3b8' }}>
                Akun Anda telah berhasil di-upgrade. Kuota penyimpanan dan batas upload telah diperbarui.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Mulai Mengunggah
              </button>
            </div>
          ) : (
            <>
              {/* Paket Testing Sandbox (Rp 1.000) */}
              <div
                onClick={() => setSelectedTier('testing')}
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: selectedTier === 'testing' ? 'rgba(16, 185, 129, 0.12)' : '#070b14',
                  border: `2px solid ${selectedTier === 'testing' ? '#10b981' : '#1e293b'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#f8fafc' }}>
                      Paket Testing Sandbox (Uji Coba QRIS)
                    </h4>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#10b981', color: '#0f172a' }}>
                      TESTING
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                    Kuota 5 GB Lifetime • Uji coba transaksi real-time Paywuz hanya Rp 1.000
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981' }}>Rp 1.000</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Bayar 1x</div>
                </div>
              </div>

              {/* Highlight Promo Card: Founder's Edition */}
              <div
                onClick={() => setSelectedTier('founder')}
                style={{
                  marginBottom: 16,
                  padding: '16px 14px',
                  borderRadius: 12,
                  backgroundColor: selectedTier === 'founder' ? 'rgba(14, 165, 233, 0.12)' : '#070b14',
                  border: `2px solid ${selectedTier === 'founder' ? '#0ea5e9' : '#334155'}`,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -11,
                    right: 14,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    letterSpacing: '0.04em',
                  }}
                >
                  PROMO TERBATAS • SISA 12 SLOT
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Founder's Edition (Lifetime)</span>
                      <Zap size={14} color="#f59e0b" fill="#f59e0b" />
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                      Bayar sekali untuk seumur hidup tanpa biaya langganan bulanan.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 800, color: '#38bdf8' }}>Rp 99.000</div>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>Bayar 1x (Seumur Hidup)</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11.5, color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={14} color="#38bdf8" />
                    <span>Kuota <strong>50 GB</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={14} color="#38bdf8" />
                    <span>Maksimal <strong>5 GB / file</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={14} color="#38bdf8" />
                    <span>Multi-Resolusi Video & Subtitle</span>
                  </div>
                </div>
              </div>

              {/* Other Tier Plans */}
              <div className="cv-upgrade-grid">
                {/* Pro Tier */}
                <div
                  onClick={() => setSelectedTier('pro')}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: selectedTier === 'pro' ? 'rgba(168, 85, 247, 0.12)' : '#070b14',
                    border: `1.5px solid ${selectedTier === 'pro' ? '#a855f7' : '#1e293b'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Paket Pro</h5>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#c084fc' }}>Rp 15.000<span style={{ fontSize: 10, color: '#64748b' }}>/bln</span></span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                    <li>Kuota 50 GB</li>
                    <li>Batas upload 5 GB / file</li>
                    <li>Langganan bulanan / tahunan</li>
                  </ul>
                </div>

                {/* Creator Tier */}
                <div
                  onClick={() => setSelectedTier('creator')}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: selectedTier === 'creator' ? 'rgba(234, 179, 8, 0.12)' : '#070b14',
                    border: `1.5px solid ${selectedTier === 'creator' ? '#eab308' : '#1e293b'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Paket Creator</h5>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#facc15' }}>Rp 45.000<span style={{ fontSize: 10, color: '#64748b' }}>/bln</span></span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                    <li>Kuota 200 GB</li>
                    <li>Batas upload 20 GB / file</li>
                    <li>Untuk editor & freelancer</li>
                  </ul>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckout}
                style={{
                  width: '100%',
                  padding: '13px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <span>Menyiapkan Transaksi...</span>
                ) : (
                  <>
                    <Shield size={16} />
                    <span>
                      Lanjut ke Pembayaran Paywuz (
                      {selectedTier === 'testing'
                        ? 'Rp 1.000'
                        : selectedTier === 'founder'
                        ? 'Rp 99.000'
                        : selectedTier === 'pro'
                        ? 'Rp 15.000'
                        : 'Rp 45.000'}
                      )
                    </span>
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#64748b' }}>
                Mendukung pembayaran instan QRIS dan Virtual Account via Paywuz.id
              </div>

              {onOpenLegal && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  Dengan bertransaksi, Anda menyetujui{' '}
                  <button
                    type="button"
                    onClick={onOpenLegal}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      fontSize: 11,
                    }}
                  >
                    Ketentuan Layanan, Kebijakan Anti-Bajakan & Privasi
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
