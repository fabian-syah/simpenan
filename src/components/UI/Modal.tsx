import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number | string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="cv-modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="cv-modal" role="dialog" aria-modal="true" style={maxWidth ? { maxWidth } : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="cv-modal-title" style={{ marginBottom: 0 }}>{title}</div>
          <button
            onClick={onClose}
            className="cv-btn cv-btn-ghost cv-btn-icon"
            style={{ width: 32, height: 32 }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
