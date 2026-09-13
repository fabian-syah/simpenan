import React, { useState, useEffect } from 'react';
import { X, Check, Zap, Shield, Sparkles, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
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
  const [selectedTier, setSelectedTier] = useState<'founder' | 'pro' | 'creator'>('founder');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'lifetime'>('lifetime');
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTier === 'founder') {
      setBillingPeriod('lifetime');
    } else if (billingPeriod === 'lifetime') {
      setBillingPeriod('monthly');
    }
  }, [selectedTier]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await createPaymentOrder(selectedTier, billingPeriod, 'ALL');
      if (res && res.orderId) {
        setActiveOrder(res);
        setOrderStatus('PENDING');

        // If direct payment link from Paywuz is available, open in new tab
        if (res.paymentUrl && res.paymentUrl !== 'https://paywuz.id') {
          window.open(res.paymentUrl, '_blank', 'noopener,noreferrer');
        }
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                Upgrade Kapasitas Simpenan Cloud
              </h3>
              {userQuota && (
                <span
                  style={{
                    fontSize: 11,
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
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
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

        <div style={{ padding: 24 }}>
          {initialReason && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 16px',
                backgroundColor: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 8,
                color: '#facc15',
                fontSize: 13,
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
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Active Payment View */}
          {activeOrder && orderStatus !== 'PAID' ? (
            <div
              style={{
                backgroundColor: '#070b14',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'inline-flex', padding: 12, borderRadius: 50, backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', marginBottom: 12 }}>
                <QrCode size={32} />
              </div>
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                Menunggu Pembayaran
              </h4>
              <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#94a3b8' }}>
                Order ID: <code style={{ color: '#38bdf8' }}>{activeOrder.orderId}</code> | Total:{' '}
                <strong style={{ color: '#f8fafc' }}>Rp {activeOrder.amount?.toLocaleString('id-ID')}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto 20px' }}>
                {activeOrder.paymentUrl && (
                  <a
                    href={activeOrder.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '12px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <span>Buka Halaman Pembayaran Paywuz</span>
                    <ExternalLink size={16} />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCheckPayment}
                  disabled={checkingStatus}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '11px',
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: checkingStatus ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={checkingStatus ? 'animate-spin' : ''} />
                  <span>{checkingStatus ? 'Memeriksa...' : 'Cek Status Pembayaran'}</span>
                </button>
              </div>

              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                Pembayaran diverifikasi secara otomatis melalui gateway Paywuz.id (QRIS & Virtual Account).
              </p>
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
              {/* Highlight Promo Card: Founder's Edition */}
              <div
                onClick={() => setSelectedTier('founder')}
                style={{
                  marginBottom: 20,
                  padding: 18,
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
                    right: 16,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 12,
                    letterSpacing: '0.05em',
                  }}
                >
                  PROMO TERBATAS • SISA 12 SLOT
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Founder's Edition (Lifetime)</span>
                      <Zap size={14} color="#f59e0b" fill="#f59e0b" />
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                      Bayar sekali untuk seumur hidup tanpa biaya langganan bulanan.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8' }}>Rp 99.000</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Bayar 1x (Seumur Hidup)</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#cbd5e1' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
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
                      {selectedTier === 'founder'
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
