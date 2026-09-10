import { useState, useCallback, useRef } from 'react';
import { CloudUpload } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (files: FileList) => void;
  children: React.ReactNode;
}

export function DropZone({ onFilesDropped, children }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  const isExternalFileDrag = (e: React.DragEvent): boolean => {
    if (!e.dataTransfer) return false;
    const types = Array.from(e.dataTransfer.types || []);
    // Only activate for OS file drag (must contain 'Files' and NOT internal app item)
    return types.includes('Files') && !types.includes('application/x-simpenan-file');
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  }, [onFilesDropped]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ height: '100%' }}
    >
      {children}

      {/* Full-screen drag overlay */}
      <div className={`cv-dropzone ${isDragActive ? 'active' : ''}`}>
        <div className="cv-dropzone-inner">
          <div className="cv-dropzone-icon">
            <CloudUpload size={32} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--cv-text-primary)', letterSpacing: '-0.01em' }}>
            Release to Cloud
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
            Your files will be automatically synced and balanced across your Multi-Cloud storage
          </div>
        </div>
      </div>
    </div>
  );
}
