// ============================================================
// ShareView Component — High-performance Public Sharing Page
// Supports direct streaming video (all resolutions), images,
// music playback, and secure cloud downloads
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { Cloud, Download, File as FileIcon } from 'lucide-react';
import { formatBytes, getFileCategory } from '../../types';
import { VideoPlayer } from '../FileExplorer/VideoPlayer';

export function ShareView({ fileId }: { fileId: string }) {
  const [file, setFile] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [activeResolution, setActiveResolution] = useState<string>('Original');
  const [activeUrl, setActiveUrl] = useState<string>(`/api/files/download?id=${fileId}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/files/get?id=${fileId}`)
      .then((res) => {
        if (!res.ok) throw new Error('File tidak ditemukan atau tautan tidak valid');
        return res.json();
      })
      .then((data) => {
        setFile(data.file);
        const vList = data.variants || [];
        setVariants(vList);

        // If MKV, auto-switch to 720p or highest MP4 variant
        const isMkv = data.file.name.toLowerCase().endsWith('.mkv') || data.file.mime_type?.includes('matroska');
        if (isMkv && vList.length > 0) {
          const best = vList.find((v: any) => v.name.includes('720p')) || vList[0];
          const match = best.name.match(/(720p|480p|360p)/i);
          setActiveResolution(match ? match[1] : '720p');
          setActiveUrl(`/api/files/download?id=${best.id}`);
        } else {
          setActiveUrl(`/api/files/download?id=${data.file.id}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileId]);

  const handleSelectResolution = useCallback((res: string, targetUrl: string) => {
    setActiveResolution(res);
    setActiveUrl(targetUrl);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1329' }}>
        <div className="cv-spinner" style={{ width: 48, height: 48, borderColor: 'rgba(56, 189, 248, 0.3)', borderTopColor: '#38bdf8' }} />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#f8fafc', padding: 24, textAlign: 'center' }}>
        <Cloud size={52} color="#64748b" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Berkas Tidak Ditemukan</h2>
        <p style={{ color: '#94a3b8', maxWidth: 400 }}>Tautan ini mungkin sudah tidak berlaku atau berkas telah dihapus oleh pemiliknya.</p>
      </div>
    );
  }

  const category = getFileCategory(file.mime_type, file.is_folder);
  const downloadUrl = `/api/files/download?id=${file.id}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#070c1b',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          padding: '16px 28px',
          background: 'rgba(15, 23, 42, 0.85)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)',
            }}
          >
            <Cloud size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Simpenan <span style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Public</span>
          </span>
        </div>

        <a
          href={downloadUrl}
          download={file.name}
          className="cv-btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(2, 132, 199, 0.4)',
          }}
        >
          <Download size={16} />
          <span>Unduh Berkas ({formatBytes(file.size_bytes)})</span>
        </a>
      </header>

      {/* Main Content Viewer */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {category === 'video' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <VideoPlayer
              url={activeUrl}
              fileName={file.name}
              fileSize={file.size_bytes}
              mimeType={file.mime_type}
              fileId={file.id}
              variants={variants}
              currentResolution={activeResolution}
              onSelectResolution={handleSelectResolution}
            />
            <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>{file.name}</h1>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  {formatBytes(file.size_bytes)} • Streaming Multi-Cloud
                </div>
              </div>
            </div>
          </div>
        ) : category === 'image' ? (
          <div style={{ textAlign: 'center', maxWidth: '100%' }}>
            <img
              src={downloadUrl}
              alt={file.name}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                borderRadius: 16,
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                objectFit: 'contain',
              }}
            />
            <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 18, color: '#f8fafc' }}>{file.name}</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{formatBytes(file.size_bytes)}</p>
          </div>
        ) : category === 'audio' ? (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '36px 40px',
              borderRadius: 20,
              textAlign: 'center',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <FileIcon size={34} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{file.name}</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>{formatBytes(file.size_bytes)}</p>
            <audio src={downloadUrl} controls style={{ width: '100%' }} />
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '40px',
              borderRadius: 20,
              textAlign: 'center',
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <FileIcon size={34} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, wordBreak: 'break-word' }}>{file.name}</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28 }}>
              {formatBytes(file.size_bytes)} • Berkas Aman di Cloud
            </p>
            <a
              href={downloadUrl}
              download={file.name}
              className="cv-btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 46,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: 12,
              }}
            >
              <Download size={18} />
              <span>Unduh Berkas</span>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
