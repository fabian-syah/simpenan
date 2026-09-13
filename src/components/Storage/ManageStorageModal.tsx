// ============================================================
// ManageStorageModal — Multi-Account Storage & Google Drive Connector
// Connects unlimited Google Drive accounts and manages multi-cloud providers
// ============================================================
import React, { useState } from 'react';
import type { StorageProvider, QuotaInfo } from '../../types';
import { formatBytes } from '../../types';
import { getProviderColor } from './QuotaBar';
import {
  X,
  HardDrive,
  Plus,
  Check,
  Copy,
  Trash2,
  AlertCircle,
  Loader2,
  Info,
  ShieldCheck,
} from 'lucide-react';

interface ManageStorageModalProps {
  quota: QuotaInfo | null;
  onClose: () => void;
  onRefreshQuota: () => void;
}

const GDRIVE_SCRIPT_CODE = `const SECRET = "simpenan_gdrive_secret_2026";
const FOLDER_NAME = "Simpenan Storage";

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

function doGet(e) {
  const params = e.parameter || {};
  const secret = params.secret;
  const action = params.action;

  if (secret !== SECRET) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "get_token") {
    try {
      const token = ScriptApp.getOAuthToken();
      const folder = getOrCreateFolder();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        token: token,
        folderId: folder.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "create_resumable_upload") {
    try {
      const fileName = params.fileName || "unnamed";
      const fileSize = Number(params.fileSize) || 0;
      const mimeType = params.mimeType || "application/octet-stream";
      const origin = params.origin || "https://simpenan-theta.vercel.app";
      const folder = getOrCreateFolder();

      const metadata = {
        name: fileName,
        parents: [folder.getId()],
        mimeType: mimeType
      };

      const response = UrlFetchApp.fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + ScriptApp.getOAuthToken(),
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": String(fileSize),
            "Origin": origin
          },
          payload: JSON.stringify(metadata),
          muteHttpExceptions: true
        }
      );

      const headers = response.getHeaders();
      const location = headers["Location"] || headers["location"];

      if (!location) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Gagal membuat sesi resumable upload Google",
          details: response.getContentText()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        uploadUrl: location
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "quota") {
    try {
      const usedBytes = DriveApp.getStorageUsed();
      const limitBytes = DriveApp.getStorageLimit();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        used_bytes: usedBytes,
        limit_bytes: limitBytes > 0 ? limitBytes : 5497558138880
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        used_bytes: 0,
        limit_bytes: 5497558138880
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "make_public") {
    try {
      const fileId = params.fileId;
      const file = DriveApp.getFileById(fileId);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "delete") {
    try {
      const fileId = params.fileId;
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Action not recognized" }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const CAPACITY_PRESETS = [
  { label: '5 TB', bytes: 5497558138880 },
  { label: '2 TB', bytes: 2199023255552 },
  { label: '1 TB', bytes: 1099511627776 },
  { label: '100 GB', bytes: 107374182400 },
  { label: '15 GB', bytes: 16106127360 },
];

export function ManageStorageModal({ quota, onClose, onRefreshQuota }: ManageStorageModalProps) {
  const [activeTab, setActiveTab] = useState<'accounts' | 'add'>('accounts');

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [selectedBytes, setSelectedBytes] = useState(5497558138880); // 5 TB default
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GDRIVE_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !scriptUrl.trim()) {
      setErrorMsg('Nama akun dan URL Web App Google wajib diisi.');
      return;
    }

    if (!scriptUrl.trim().startsWith('https://script.google.com/')) {
      setErrorMsg('URL Web App harus berformat https://script.google.com/macros/s/.../exec');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/storage/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          endpointUrl: scriptUrl.trim(),
          maxBytes: selectedBytes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghubungkan akun Google Drive');
      }

      setSuccessMsg(data.message || 'Akun Google Drive berhasil dihubungkan!');
      setDisplayName('');
      setScriptUrl('');
      onRefreshQuota();
      setTimeout(() => {
        setActiveTab('accounts');
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat validasi akun Google');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProvider = async (provider: StorageProvider) => {
    if (!confirm(`Hapus atau nonaktifkan provider ${provider.display_name}?`)) return;
    try {
      const res = await fetch('/api/storage/providers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus provider');
      onRefreshQuota();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="cv-modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="cv-modal-content cv-scroll-reveal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'var(--cv-bg-secondary)',
          border: '1px solid var(--cv-border-glow)',
          borderRadius: 'var(--cv-radius-xl)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--cv-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(15, 157, 88, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--cv-radius-md)',
                background: 'rgba(15, 157, 88, 0.18)',
                border: '1px solid rgba(15, 157, 88, 0.35)',
                color: '#0F9D58',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HardDrive size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cv-text-primary)' }}>
                Kelola Akun Cloud Storage
              </div>
              <div style={{ fontSize: 12, color: 'var(--cv-text-secondary)', marginTop: 2 }}>
                Gabungkan banyak akun Google Drive & Multi-Cloud menjadi satu storage raksasa
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cv-text-tertiary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 'var(--cv-radius-md)',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 24px',
            borderBottom: '1px solid var(--cv-border)',
            background: 'var(--cv-bg-tertiary)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            style={{
              background: activeTab === 'accounts' ? 'var(--cv-accent-muted)' : 'transparent',
              border: activeTab === 'accounts' ? '1px solid var(--cv-accent)' : '1px solid transparent',
              color: activeTab === 'accounts' ? 'var(--cv-accent)' : 'var(--cv-text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--cv-radius-full)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Daftar Akun Terhubung ({quota?.providers?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            style={{
              background: activeTab === 'add' ? 'rgba(15, 157, 88, 0.2)' : 'transparent',
              border: activeTab === 'add' ? '1px solid #0F9D58' : '1px solid transparent',
              color: activeTab === 'add' ? '#0F9D58' : 'var(--cv-text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--cv-radius-full)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Tambah Google Drive Baru
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'accounts' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.18)',
                  borderRadius: 'var(--cv-radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} style={{ color: 'var(--cv-accent)' }} />
                  <span style={{ fontSize: 13, color: 'var(--cv-text-secondary)' }}>
                    Total Penyimpanan Terpadu:
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cv-text-primary)' }}>
                    {formatBytes(quota?.total_max_bytes || 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  style={{
                    background: '#0F9D58',
                    color: 'white',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: 'var(--cv-radius-md)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} /> Tambah Akun
                </button>
              </div>

              {quota?.providers?.map((provider) => {
                const isGDrive = provider.id === 'gdrive' || provider.id.startsWith('gdrive');
                const percent = provider.max_bytes > 0 ? (provider.used_bytes / provider.max_bytes) * 100 : 0;
                const dotColor = getProviderColor(provider.id);

                return (
                  <div
                    key={provider.id}
                    style={{
                      background: 'var(--cv-bg-tertiary)',
                      border: '1px solid var(--cv-border)',
                      borderRadius: 'var(--cv-radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: dotColor,
                          boxShadow: `0 0 8px ${dotColor}88`,
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cv-text-primary)' }}>
                            {provider.display_name}
                          </span>
                          {isGDrive && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(15, 157, 88, 0.15)',
                                color: '#0F9D58',
                              }}
                            >
                              Google Drive
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cv-text-tertiary)', marginTop: 2 }}>
                          {formatBytes(provider.used_bytes)} terpakai dari {formatBytes(provider.max_bytes)} ({percent.toFixed(1)}%)
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 99,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(percent, 100)}%`,
                            height: '100%',
                            background: dotColor,
                          }}
                        />
                      </div>
                      {isGDrive && provider.id !== 'gdrive' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProvider(provider)}
                          title="Hapus Akun Ini"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 6,
                            borderRadius: 'var(--cv-radius-md)',
                            display: 'flex',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Info Guide Box */}
              <div
                style={{
                  background: 'rgba(15, 157, 88, 0.08)',
                  border: '1px solid rgba(15, 157, 88, 0.25)',
                  borderRadius: 'var(--cv-radius-md)',
                  padding: '14px 16px',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: 'var(--cv-text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0F9D58', marginBottom: 6 }}>
                  <Info size={16} />
                  <span>Cara Menghubungkan Akun Google Drive Kedua (1 Menit):</span>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Buka <strong>script.google.com</strong> pada tab/browser yang login dengan akun Google kedua Anda.</li>
                  <li>Klik <strong>New project</strong>, lalu salin kode script di bawah ini ke dalamnya.</li>
                  <li>Klik tombol biru <strong>Deploy</strong> (kanan atas) &gt; <strong>New deployment</strong> &gt; pilih jenis <strong>Web app</strong> (Execute as: <em>Me</em>, Who has access: <em>Anyone</em>).</li>
                  <li>Selesaikan otorisasi Google, salin <strong>Web app URL</strong> yang muncul, lalu tempelkan pada kolom di bawah.</li>
                </ol>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    style={{
                      background: copiedScript ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: copiedScript ? '#10b981' : 'var(--cv-text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 'var(--cv-radius-md)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {copiedScript ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedScript ? 'Kode Script Tersalin!' : 'Salin Kode Google Apps Script'}</span>
                  </button>
                </div>
              </div>

              {/* Form Input: Account Display Name */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
                  Nama Akun / Label
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Google Drive Akun 2 (5 TB)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 13,
                    borderRadius: 'var(--cv-radius-md)',
                    border: '1px solid var(--cv-border)',
                    background: 'var(--cv-bg-tertiary)',
                    color: 'var(--cv-text-primary)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Form Input: Web App URL */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
                  Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 13,
                    borderRadius: 'var(--cv-radius-md)',
                    border: '1px solid var(--cv-border)',
                    background: 'var(--cv-bg-tertiary)',
                    color: 'var(--cv-text-primary)',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Form Input: Capacity Presets */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--cv-text-primary)', marginBottom: 6 }}>
                  Kapasitas Akun Ini
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CAPACITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSelectedBytes(preset.bytes)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--cv-radius-md)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: selectedBytes === preset.bytes ? 'rgba(15, 157, 88, 0.25)' : 'var(--cv-bg-tertiary)',
                        border: selectedBytes === preset.bytes ? '1px solid #0F9D58' : '1px solid var(--cv-border)',
                        color: selectedBytes === preset.bytes ? '#0F9D58' : 'var(--cv-text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: 'var(--cv-radius-md)',
                    padding: '10px 14px',
                    fontSize: 12.5,
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
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    borderRadius: 'var(--cv-radius-md)',
                    padding: '10px 14px',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Check size={16} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--cv-border)',
                    color: 'var(--cv-text-secondary)',
                    padding: '8px 16px',
                    borderRadius: 'var(--cv-radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#0F9D58',
                    border: 'none',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: 'var(--cv-radius-md)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting && <Loader2 size={16} className="cv-spinner" />}
                  <span>{submitting ? 'Menguji & Menghubungkan...' : 'Hubungkan Akun Google Drive'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
