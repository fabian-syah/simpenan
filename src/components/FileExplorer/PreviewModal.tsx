import type { FileRecord } from '../../types';
import { getDownloadUrl, fetchVariants } from '../../lib/api';
import { X, ExternalLink, ZoomIn, ZoomOut, RotateCw, Maximize, Download, Copy, Check, FileText } from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { getFileCategory } from '../../types';
import { VideoPlayer } from './VideoPlayer';

interface PreviewModalProps {
  file: FileRecord;
  onClose: () => void;
}

export function PreviewModal({ file, onClose }: PreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const category = getFileCategory(file.mime_type, file.is_folder);
  const isVideo = category === 'video';
  const isImage = category === 'image' || (file.mime_type ? file.mime_type.startsWith('image/') : false) ||
    /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(file.name);
  const fileUrl = getDownloadUrl(file.id);
  const imagePreviewUrl = useMemo(() => {
    if ((file.provider_id === 'gdrive' || file.provider_id?.startsWith('gdrive')) && file.storage_key && isImage) {
      return `https://lh3.googleusercontent.com/d/${encodeURIComponent(file.storage_key)}`;
    }
    return fileUrl;
  }, [file.id, file.provider_id, file.storage_key, isImage, fileUrl]);

  const isPdf = category === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isTextOrCode = category === 'code' || category === 'document' ||
    /\.(txt|md|json|js|ts|jsx|tsx|html|css|py|java|c|cpp|go|rs|sql|csv|sh|yml|yaml|env|xml|log)$/i.test(file.name);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (isTextOrCode) {
      setTextLoading(true);
      fetch(fileUrl)
        .then(r => r.text())
        .then(t => {
          setTextContent(t);
          setTextLoading(false);
        })
        .catch(() => setTextLoading(false));
    }
  }, [fileUrl, isTextOrCode]);

  // Video resolution state
  const [variants, setVariants] = useState<Array<{ id: string; name: string; size_bytes?: number }>>([]);
  const [activeResolution, setActiveResolution] = useState<string>('Original');
  const [activeUrl, setActiveUrl] = useState<string>(getDownloadUrl(file.id));
  const isMkv = useMemo(() => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv' || (file.mime_type ? file.mime_type.includes('matroska') : false);
  }, [file.name, file.mime_type]);

  // Load existing variants with auto-refresh while modal is open
  const loadVariants = useCallback(async () => {
    if (!isVideo) return;
    try {
      const list = await fetchVariants(file.id);
      setVariants(list || []);
      if (list && list.length > 0 && isMkv) {
        setActiveResolution((prev) => {
          if (prev === 'Original') {
            const best =
              list.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('720p')) ||
              list.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('480p')) ||
              list.find((v) => v.name.toLowerCase().endsWith('.mp4') && v.name.toLowerCase().includes('360p')) ||
              list.find((v) => v.name.toLowerCase().endsWith('.mp4'));
            if (best) {
              const match = best.name.match(/(720p|480p|360p)/i);
              setActiveUrl(getDownloadUrl(best.id));
              return match ? match[1] : '720p';
            }
          }
          return prev;
        });
      }
      return list;
    } catch (err) {
      console.error('Failed to load variants:', err);
    }
  }, [file.id, isVideo, isMkv]);

  useEffect(() => {
    loadVariants();
    // Auto-poll every 3 seconds while open until all 3 variants (720p, 480p, 360p) are ready
    const interval = setInterval(async () => {
      const list = await loadVariants();
      if (list && list.length >= 3) {
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadVariants]);

  // Sync activeUrl and activeResolution when file prop changes
  useEffect(() => {
    setActiveUrl(getDownloadUrl(file.id));
    setActiveResolution('Original');
  }, [file.id]);

  const handleSelectResolution = useCallback((res: string, targetUrl?: string) => {
    setActiveResolution(res);
    if (targetUrl) setActiveUrl(targetUrl);
  }, []);

  // Photo viewer state
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Video Miniplayer & PiP state
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMinimized) {
          setIsMinimized(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isMinimized]);

  return (
    <div
      className={isMinimized ? "cv-modal-overlay cv-minimized" : "cv-modal-overlay"}
      onClick={isMinimized ? undefined : onClose}
      style={{
        zIndex: 99999,
        background: isMinimized ? 'transparent' : '#000000',
        pointerEvents: isMinimized ? 'none' : 'auto',
        backdropFilter: isVideoFullscreen ? 'none' : undefined,
        WebkitBackdropFilter: isVideoFullscreen ? 'none' : undefined,
        animation: isVideoFullscreen ? 'none' : undefined,
      }}
    >
      <div
        className="cv-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'transparent',
          boxShadow: 'none',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          position: isVideoFullscreen ? 'static' : 'relative',
          pointerEvents: isMinimized ? 'none' : 'auto',
        }}
      >
        {/* Top Header - Hidden when minimized or when video is in fullscreen */}
        {!isMinimized && !isVideoFullscreen && (
          <div
            className="cv-preview-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 30,
              padding: '12px 16px',
            }}
          >
            <div style={{ color: 'white', fontWeight: 600, fontSize: 15, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
              {file.name}
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
              <a
                href={isVideo ? activeUrl : getDownloadUrl(file.id, true)}
                download={file.name}
                style={{ color: '#cbd5e1', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                title="Download file"
              >
                <Download size={20} />
              </a>
              <a
                href={isVideo ? activeUrl : (isImage ? imagePreviewUrl : getDownloadUrl(file.id))}
                target="_blank"
                rel="noreferrer"
                className="cv-desktop-only"
                style={{ color: '#cbd5e1', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                title="Open in new tab / VLC"
              >
                <ExternalLink size={20} />
              </a>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                title="Close (Esc)"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div
          className={isMinimized ? "cv-video-minimized-card" : isVideo ? "cv-preview-content-area" : undefined}
          style={
            isMinimized
              ? undefined
              : {
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: isVideoFullscreen ? 'visible' : 'hidden',
                  position: isVideoFullscreen ? 'static' : 'relative',
                }
          }
        >
          {loading && !isVideo && (
            <div
              className="cv-spinner"
              style={{ borderColor: 'white', borderTopColor: 'transparent', position: 'absolute' }}
            />
          )}

          {isVideo ? (
            <VideoPlayer
              url={activeUrl}
              fileName={file.name}
              fileSize={file.size_bytes}
              mimeType={file.mime_type}
              fileId={file.id}
              variants={variants}
              currentResolution={activeResolution}
              onSelectResolution={handleSelectResolution}
              onClose={onClose}
              isMinimized={isMinimized}
              onToggleMinimize={setIsMinimized}
              onFullscreenChange={setIsVideoFullscreen}
            />
          ) : isPdf ? (
            <div style={{ width: '92%', maxWidth: '1100px', height: '85vh', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <iframe
                src={fileUrl}
                title={file.name}
                style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }}
              />
            </div>
          ) : isTextOrCode ? (
            <div
              style={{
                width: '92%',
                maxWidth: '960px',
                height: '80vh',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div
                style={{
                  padding: '12px 18px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
                  <FileText size={16} />
                  <span>{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (textContent) {
                      navigator.clipboard.writeText(textContent);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: copiedText ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: copiedText ? '#10b981' : '#e2e8f0',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {copiedText ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedText ? 'Tersalin!' : 'Salin Semua'}</span>
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {textLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <div className="cv-spinner" style={{ width: 36, height: 36 }} />
                  </div>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {textContent || 'Berkas kosong.'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={imagePreviewUrl}
                alt={file.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                  display: loading ? 'none' : 'block',
                  cursor: 'grab',
                }}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />

              {/* Bottom Image Toolbar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 30,
                  display: 'flex',
                  gap: 15,
                  background: 'rgba(30, 30, 30, 0.8)',
                  padding: '12px 24px',
                  borderRadius: '100px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  zIndex: 20,
                }}
              >
                <button onClick={() => setScale((s) => Math.min(s + 0.25, 4))} style={toolbarBtnStyle} title="Zoom In">
                  <ZoomIn size={20} />
                </button>
                <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} style={toolbarBtnStyle} title="Zoom Out">
                  <ZoomOut size={20} />
                </button>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
                <button onClick={() => setRotation((r) => r + 90)} style={toolbarBtnStyle} title="Rotate">
                  <RotateCw size={20} />
                </button>
                <button
                  onClick={() => {
                    setScale(1);
                    setRotation(0);
                  }}
                  style={toolbarBtnStyle}
                  title="Reset"
                >
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const toolbarBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px',
  borderRadius: '50%',
  transition: 'background 0.2s',
};
