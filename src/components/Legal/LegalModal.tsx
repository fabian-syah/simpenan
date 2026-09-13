import { useState } from 'react';
import { ShieldCheck, FileText, Ban, Mail, CheckCircle2 } from 'lucide-react';
import { Modal } from '../UI/Modal';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'piracy' | 'privacy' | 'support';
}

export function LegalModal({ isOpen, onClose, initialTab = 'terms' }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'piracy' | 'privacy' | 'support'>(initialTab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ketentuan Layanan & Kebijakan Simpenan Cloud"
      maxWidth={720}
    >
      <div style={{ padding: '0 24px 24px' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--cv-border)',
            paddingBottom: 12,
            marginBottom: 20,
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`cv-cat-tab ${activeTab === 'terms' ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            <FileText size={14} />
            <span>Syarat & Ketentuan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('piracy')}
            className={`cv-cat-tab ${activeTab === 'piracy' ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            <Ban size={14} />
            <span>Kebijakan Anti-Bajakan (DMCA)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`cv-cat-tab ${activeTab === 'privacy' ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            <ShieldCheck size={14} />
            <span>Kebijakan Privasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`cv-cat-tab ${activeTab === 'support' ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            <Mail size={14} />
            <span>Bantuan & Pengaduan</span>
          </button>
        </div>

        {/* Tab Content: Syarat & Ketentuan */}
        {activeTab === 'terms' && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--cv-text-secondary)' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              1. Deskripsi Layanan
            </h4>
            <p style={{ marginBottom: 16 }}>
              Simpenan Cloud adalah platform Software-as-a-Service (SaaS) penyedia media penyimpanan cloud pribadi (personal cloud storage & productivity backup). Layanan ini dirancang khusus untuk memfasilitasi pencadangan dokumen kerja, arsip pribadi, foto keluarga, dan berkas digital milik pengguna secara terenkripsi dan terisolasi.
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              2. Akun & Isolasi Data Pengguna
            </h4>
            <p style={{ marginBottom: 16 }}>
              Setiap pengguna yang mendaftar memiliki ruang penyimpanan independen yang terisolasi menggunakan teknologi Row-Level Security (RLS). Pengguna lain maupun pengunjung umum tidak memiliki akses untuk melihat, mengunduh, atau mengintip berkas pengguna lain tanpa izin eksplisit melalui tautan berbagi berwaktu.
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              3. Paket Layanan & Pembayaran
            </h4>
            <p style={{ marginBottom: 16 }}>
              Simpenan Cloud menyediakan paket Starter gratis (kuota 2 GB) serta paket berbayar Founder's Edition (50 GB Lifetime) seharga Rp 99.000 sekali bayar yang diproses secara resmi dan otomatis melalui Payment Gateway berizin di Indonesia (Paywuz.id).
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              4. Kebijakan Pengembalian Dana (Refund)
            </h4>
            <p style={{ marginBottom: 16 }}>
              Kami menyediakan jaminan pengembalian dana penuh dalam waktu 7 (tujuh) hari kalender setelah transaksi apabila terjadi kendala teknis pada sistem yang mengakibatkan kuota penyimpanan tidak aktif atau layanan tidak dapat digunakan sama sekali.
            </p>
          </div>
        )}

        {/* Tab Content: Kebijakan Anti-Bajakan (DMCA) */}
        {activeTab === 'piracy' && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--cv-text-secondary)' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              Pernyataan Tegas Anti-Pembajakan & Hak Cipta
            </div>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              1. Larangan Distribusi Konten Bajakan
            </h4>
            <p style={{ marginBottom: 16 }}>
              Simpenan Cloud secara tegas dan tanpa toleransi melarang penggunaan layanan untuk mengunggah, menyimpan, menyebarkan, membagikan, atau memperjualbelikan materi yang melanggar Hak Kekayaan Intelektual (HAKI), termasuk namun tidak terbatas pada:
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 16, listStyleType: 'disc' }}>
              <li>Konten serial, film komersial, atau video berhak cipta tanpa lisensi resmi dari pemilik hak cipta.</li>
              <li>Musik komersial, rekaman studio, atau audio berhak cipta.</li>
              <li>Perangkat lunak bajakan, program retakan (cracks, patches, serial key generators).</li>
              <li>Materi pornografi, perjudian, ujaran kebencian, serta segala muatan terlarang berdasarkan hukum Republik Indonesia.</li>
            </ul>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              2. Tindakan Penegakan & Pemblokiran Akun
            </h4>
            <p style={{ marginBottom: 16 }}>
              Tim administrator Simpenan Cloud berhak meninjau laporan pelanggaran, menghapus berkas yang terbukti melanggar hak cipta secara sepihak, dan memblokir akun pengguna terkait secara permanen tanpa kompensasi apa pun.
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              3. Prosedur Pelaporan DMCA / Takedown
            </h4>
            <p style={{ marginBottom: 16 }}>
              Pemegang hak cipta yang sah dapat mengajukan laporan dugaan pelanggaran hak cipta kepada tim penegakan kami melalui email resmi: <strong>abuse@simpenan.cloud</strong> atau <strong>fabiansyahalghiffarireal@gmail.com</strong> dengan menyertakan bukti kepemilikan hak cipta yang valid. Laporan akan ditindaklanjuti dalam waktu maksimal 1x24 jam.
            </p>
          </div>
        )}

        {/* Tab Content: Kebijakan Privasi */}
        {activeTab === 'privacy' && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--cv-text-secondary)' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              1. Pengumpulan Informasi
            </h4>
            <p style={{ marginBottom: 16 }}>
              Kami hanya mengumpulkan informasi yang diperlukan untuk penyediaan layanan, yaitu alamat email untuk keperluan autentikasi akun, kata sandi terenkripsi (bcrypt), serta data transaksi pembayaran yang diproses secara aman oleh payment gateway berizin.
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              2. Keamanan & Enkripsi Berkas
            </h4>
            <p style={{ marginBottom: 16 }}>
              Seluruh transmisi data antara peramban Anda dan server menggunakan enkripsi TLS/HTTPS tingkat tinggi. Metadata berkas disimpan pada basis data PostgreSQL yang dilindungi aturan keamanan setingkat baris (Row-Level Security).
            </p>

            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              3. Perlindungan Kerahasiaan Data
            </h4>
            <p style={{ marginBottom: 16 }}>
              Simpenan Cloud berkomitmen penuh untuk tidak menjual, menyewakan, atau membagikan data pribadi maupun berkas simpanan Anda kepada pihak ketiga mana pun untuk tujuan periklanan atau pemasaran.
            </p>
          </div>
        )}

        {/* Tab Content: Bantuan & Pengaduan */}
        {activeTab === 'support' && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--cv-text-secondary)' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cv-text-primary)', marginBottom: 8 }}>
              Pusat Layanan Pelanggan & Pengaduan
            </h4>
            <p style={{ marginBottom: 16 }}>
              Untuk pertanyaan seputar layanan, konfirmasi pembayaran, pengajuan pengembalian dana (refund), atau pelaporan konten tidak pantas/pelanggaran hak cipta, silakan hubungi tim kami melalui:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: 'var(--cv-bg-tertiary)',
                  border: '1px solid var(--cv-border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cv-text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Email Bantuan Pelanggan
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                  support@simpenan.cloud
                </div>
                <div style={{ fontSize: 12, color: 'var(--cv-text-secondary)', marginTop: 2 }}>
                  fabiansyahalghiffarireal@gmail.com
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: 'var(--cv-bg-tertiary)',
                  border: '1px solid var(--cv-border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cv-text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Pelaporan DMCA & Konten
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                  abuse@simpenan.cloud
                </div>
                <div style={{ fontSize: 12, color: 'var(--cv-text-secondary)', marginTop: 2 }}>
                  Tanggapan dalam 1x24 jam
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--cv-success)' }}>
              <CheckCircle2 size={16} />
              <span>Sistem Pembayaran Terverifikasi & Aman didukung oleh Paywuz.id</span>
            </div>
          </div>
        )}

        <div className="cv-modal-actions" style={{ marginTop: 24 }}>
          <button className="cv-btn cv-btn-primary" onClick={onClose} style={{ minWidth: 100 }}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
