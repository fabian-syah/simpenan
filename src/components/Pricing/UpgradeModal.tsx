import React, { useState, useEffect, useRef } from 'react';
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
  const currentTier = (userQuota?.tier || 'starter').toLowerCase();

  const [selectedTier, setSelectedTier] = useState<'testing' | 'founder' | 'pro' | 'creator'>(() => {
    if (currentTier === 'testing') return 'founder';
    if (currentTier === 'founder') return 'creator';
    return 'founder';
  });
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'lifetime'>('lifetime');

  useEffect(() => {
    if (currentTier === 'testing' && selectedTier === 'testing') {
      setSelectedTier('founder');
    } else if (currentTier === 'founder' && selectedTier === 'founder') {
      setSelectedTier('creator');
    }
  }, [currentTier, selectedTier]);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('cv_pending_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - (parsed.timestamp || 0) < 60 * 60 * 1000) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [orderStatus, setOrderStatus] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('cv_pending_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - (parsed.timestamp || 0) < 60 * 60 * 1000) {
          return parsed.status || 'PENDING';
        }
      }
    } catch {}
    return null;
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onUpgradeSuccessRef = useRef(onUpgradeSuccess);
  useEffect(() => {
    onUpgradeSuccessRef.current = onUpgradeSuccess;
  }, [onUpgradeSuccess]);

  useEffect(() => {
    if (selectedTier === 'founder' || selectedTier === 'testing') {
      setBillingPeriod('lifetime');
    } else if (billingPeriod === 'lifetime') {
      setBillingPeriod('monthly');
    }
  }, [selectedTier]);

  // Real-time automatic payment polling (every 2 seconds)
  useEffect(() => {
    if (!activeOrder?.orderId || orderStatus === 'PAID') return;

    let isSubscribed = true;
    const pollStatus = async () => {
      try {
        const statusRes = await checkPaymentStatus(activeOrder.orderId);
        if (!isSubscribed) return;
        if (statusRes.status === 'PAID') {
          setOrderStatus('PAID');
          try {
            localStorage.removeItem('cv_pending_order');
          } catch {}
          onUpgradeSuccessRef.current?.();
        } else if (statusRes.status) {
          setOrderStatus(statusRes.status);
        }
      } catch {
        // silent polling
      }
    };

    const firstTimer = setTimeout(pollStatus, 800);
    const interval = setInterval(pollStatus, 2000);

    return () => {
      isSubscribed = false;
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [activeOrder?.orderId, orderStatus]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await createPaymentOrder(selectedTier, billingPeriod, 'QRIS');
      if (res && res.orderId) {
        const orderData = { ...res, timestamp: Date.now(), status: 'PENDING' };
        setActiveOrder(orderData);
        setOrderStatus('PENDING');
        try {
          localStorage.setItem('cv_pending_order', JSON.stringify(orderData));
        } catch {}
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
        try {
          localStorage.removeItem('cv_pending_order');
        } catch {}
        onUpgradeSuccessRef.current?.();
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
                  Menunggu pembayaran via QRIS... Terdeteksi otomatis secara real-time (setiap 2 detik)
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
                  onClick={() => {
                    try { localStorage.removeItem('cv_pending_order'); } catch {}
                    setActiveOrder(null);
                    setOrderStatus(null);
                  }}
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
                onClick={() => {
                  try { localStorage.removeItem('cv_pending_order'); } catch {}
                  setActiveOrder(null);
                  setOrderStatus(null);
                  onClose();
                }}
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
              {(() => {
                const isTestingCurrent = currentTier === 'testing';
                const isFounderCurrent = currentTier === 'founder';
                const isProCurrent = currentTier === 'pro';
                const isCreatorCurrent = currentTier === 'creator';
                const isSelectedCurrent = selectedTier === currentTier;

                return (
                  <>
                    {/* Paket Testing Sandbox (Rp 1.000) */}
                    <div
                      onClick={() => {
                        if (!isTestingCurrent) setSelectedTier('testing');
                      }}
                      style={{
                        marginBottom: 16,
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isTestingCurrent
                          ? 'rgba(15, 23, 42, 0.6)'
                          : selectedTier === 'testing'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : '#070b14',
                        border: `2px solid ${
                          isTestingCurrent
                            ? 'rgba(16, 185, 129, 0.3)'
                            : selectedTier === 'testing'
                            ? '#10b981'
                            : '#1e293b'
                        }`,
                        cursor: isTestingCurrent ? 'not-allowed' : 'pointer',
                        opacity: isTestingCurrent ? 0.75 : 1,
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
                          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: isTestingCurrent ? '#94a3b8' : '#f8fafc' }}>
                            Paket Testing Sandbox (Uji Coba QRIS)
                          </h4>
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#10b981', color: '#0f172a' }}>
                            TESTING
                          </span>
                          {isTestingCurrent && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 99,
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              PAKET ANDA SAAT INI
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: isTestingCurrent ? '#64748b' : '#94a3b8' }}>
                          {isTestingCurrent
                            ? 'Paket uji coba ini sedang aktif di akun Anda (5 GB Lifetime). Pilih paket Founder atau Pro di bawah untuk upgrade kuota lebih besar.'
                            : 'Kuota 5 GB Lifetime • Uji coba transaksi real-time Paywuz hanya Rp 1.000'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: isTestingCurrent ? '#64748b' : '#10b981' }}>
                          Rp 1.000
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {isTestingCurrent ? 'Sudah Aktif' : 'Bayar 1x'}
                        </div>
                      </div>
                    </div>

                    {/* Highlight Promo Card: Founder's Edition */}
                    <div
                      onClick={() => {
                        if (!isFounderCurrent) setSelectedTier('founder');
                      }}
                      style={{
                        marginBottom: 16,
                        padding: '16px 14px',
                        borderRadius: 12,
                        backgroundColor: isFounderCurrent
                          ? 'rgba(15, 23, 42, 0.6)'
                          : selectedTier === 'founder'
                          ? 'rgba(14, 165, 233, 0.12)'
                          : '#070b14',
                        border: `2px solid ${
                          isFounderCurrent
                            ? 'rgba(14, 165, 233, 0.3)'
                            : selectedTier === 'founder'
                            ? '#0ea5e9'
                            : '#334155'
                        }`,
                        cursor: isFounderCurrent ? 'not-allowed' : 'pointer',
                        opacity: isFounderCurrent ? 0.75 : 1,
                        position: 'relative',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -11,
                          right: 14,
                          backgroundColor: isFounderCurrent ? '#059669' : '#0284c7',
                          color: '#ffffff',
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {isFounderCurrent ? 'PAKET ANDA SAAT INI' : 'PROMO TERBATAS • SISA 12 SLOT'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isFounderCurrent ? '#94a3b8' : '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Founder's Edition (Lifetime)</span>
                            <Zap size={14} color="#f59e0b" fill="#f59e0b" />
                          </h4>
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: isFounderCurrent ? '#64748b' : '#94a3b8' }}>
                            {isFounderCurrent
                              ? 'Akun Anda telah memiliki akses Founder 50 GB seumur hidup tanpa biaya langganan.'
                              : 'Bayar sekali untuk seumur hidup tanpa biaya langganan bulanan.'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 19, fontWeight: 800, color: isFounderCurrent ? '#64748b' : '#38bdf8' }}>Rp 99.000</div>
                          <div style={{ fontSize: 10.5, color: '#64748b' }}>{isFounderCurrent ? 'Sudah Aktif' : 'Bayar 1x (Seumur Hidup)'}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11.5, color: isFounderCurrent ? '#64748b' : '#cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={14} color={isFounderCurrent ? '#64748b' : '#38bdf8'} />
                          <span>Kuota <strong>50 GB</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={14} color={isFounderCurrent ? '#64748b' : '#38bdf8'} />
                          <span>Maksimal <strong>5 GB / file</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={14} color={isFounderCurrent ? '#64748b' : '#38bdf8'} />
                          <span>Multi-Resolusi Video & Subtitle</span>
                        </div>
                      </div>
                    </div>

                    {/* Other Tier Plans */}
                    <div className="cv-upgrade-grid">
                      {/* Pro Tier */}
                      <div
                        onClick={() => {
                          if (!isProCurrent) setSelectedTier('pro');
                        }}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          backgroundColor: isProCurrent
                            ? 'rgba(15, 23, 42, 0.6)'
                            : selectedTier === 'pro'
                            ? 'rgba(168, 85, 247, 0.12)'
                            : '#070b14',
                          border: `1.5px solid ${
                            isProCurrent
                              ? 'rgba(168, 85, 247, 0.3)'
                              : selectedTier === 'pro'
                              ? '#a855f7'
                              : '#1e293b'
                          }`,
                          cursor: isProCurrent ? 'not-allowed' : 'pointer',
                          opacity: isProCurrent ? 0.75 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                          <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isProCurrent ? '#94a3b8' : '#f8fafc' }}>Paket Pro</h5>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isProCurrent ? '#64748b' : '#c084fc' }}>
                            {isProCurrent ? 'Aktif' : 'Rp 15.000'}<span style={{ fontSize: 10, color: '#64748b' }}>{isProCurrent ? '' : '/bln'}</span>
                          </span>
                        </div>
                        {isProCurrent && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                              PAKET ANDA SAAT INI
                            </span>
                          </div>
                        )}
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: isProCurrent ? '#64748b' : '#94a3b8', lineHeight: 1.6 }}>
                          <li>Kuota 50 GB</li>
                          <li>Batas upload 5 GB / file</li>
                          <li>Langganan bulanan / tahunan</li>
                        </ul>
                      </div>

                      {/* Creator Tier */}
                      <div
                        onClick={() => {
                          if (!isCreatorCurrent) setSelectedTier('creator');
                        }}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          backgroundColor: isCreatorCurrent
                            ? 'rgba(15, 23, 42, 0.6)'
                            : selectedTier === 'creator'
                            ? 'rgba(234, 179, 8, 0.12)'
                            : '#070b14',
                          border: `1.5px solid ${
                            isCreatorCurrent
                              ? 'rgba(234, 179, 8, 0.3)'
                              : selectedTier === 'creator'
                              ? '#eab308'
                              : '#1e293b'
                          }`,
                          cursor: isCreatorCurrent ? 'not-allowed' : 'pointer',
                          opacity: isCreatorCurrent ? 0.75 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                          <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isCreatorCurrent ? '#94a3b8' : '#f8fafc' }}>Paket Creator</h5>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isCreatorCurrent ? '#64748b' : '#facc15' }}>
                            {isCreatorCurrent ? 'Aktif' : 'Rp 45.000'}<span style={{ fontSize: 10, color: '#64748b' }}>{isCreatorCurrent ? '' : '/bln'}</span>
                          </span>
                        </div>
                        {isCreatorCurrent && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                              PAKET ANDA SAAT INI
                            </span>
                          </div>
                        )}
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: isCreatorCurrent ? '#64748b' : '#94a3b8', lineHeight: 1.6 }}>
                          <li>Kuota 200 GB</li>
                          <li>Batas upload 20 GB / file</li>
                          <li>Untuk editor & freelancer</li>
                        </ul>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <button
                      type="button"
                      disabled={loading || isSelectedCurrent}
                      onClick={handleCheckout}
                      style={{
                        width: '100%',
                        padding: '13px',
                        backgroundColor: isSelectedCurrent ? '#1e293b' : '#0284c7',
                        color: isSelectedCurrent ? '#94a3b8' : '#ffffff',
                        border: isSelectedCurrent ? '1px solid #334155' : 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: loading || isSelectedCurrent ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {loading ? (
                        <span>Menyiapkan Transaksi...</span>
                      ) : isSelectedCurrent ? (
                        <>
                          <Check size={16} color="#10b981" />
                          <span>Paket Ini Sedang Aktif di Akun Anda</span>
                        </>
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
                  </>
                );
              })()}

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
