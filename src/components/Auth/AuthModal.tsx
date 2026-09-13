import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, saveAnonKeyToStorage } from '../../lib/supabase';
import { X, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!configured) {
      setErrorMsg('Supabase Anon Key belum terpasang. Tempel kunci anon di kolom atas dan klik Simpan Key.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message || 'Gagal mendaftarkan akun.');
        } else if (data?.user) {
          setSuccessMsg('Akun berhasil dibuat! Silakan cek email untuk konfirmasi atau langsung masuk.');
          if (data.session) {
            onAuthSuccess?.();
            onClose();
          } else {
            setMode('login');
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message || 'Email atau kata sandi salah.');
        } else if (data?.session) {
          onAuthSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(6px)',
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
          maxWidth: 420,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
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
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
              {mode === 'login' ? 'Masuk ke Simpenan' : 'Daftar Akun Baru'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              {mode === 'login'
                ? 'Akses penyimpanan cloud pribadi Anda'
                : 'Dapatkan kuota cloud 2 GB gratis selamanya'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {!configured && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#facc15', marginBottom: 4 }}>
                Supabase Anon Key Diperlukan
              </div>
              <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 10px', lineHeight: 1.4 }}>
                Buka Supabase Dashboard, klik tombol <strong>API Keys</strong> di pojok kanan bawah, lalu salin kunci <strong>anon public</strong> dan tempel di bawah:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: 11,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualKey.trim()) {
                      saveAnonKeyToStorage(manualKey.trim());
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Simpan Key
                </button>
              </div>
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
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 8,
                color: '#4ade80',
                fontSize: 13,
              }}
            >
              {successMsg}
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Alamat Email
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, color: '#64748b' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                style={{
                  width: '100%',
                  backgroundColor: '#070b14',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Kata Sandi
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, color: '#64748b' }} />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                style={{
                  width: '100%',
                  backgroundColor: '#070b14',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <span>Memproses...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={16} />
                <span>Masuk Sekarang</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Daftar Akun Gratis</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#070b14',
            borderTop: '1px solid #1e293b',
            textAlign: 'center',
            fontSize: 13,
            color: '#94a3b8',
          }}
        >
          {mode === 'login' ? (
            <>
              Belum punya akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Daftar sekarang
              </button>
            </>
          ) : (
            <>
              Sudah memiliki akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Masuk di sini
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
