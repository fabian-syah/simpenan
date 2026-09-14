import { useState, useCallback, useRef } from 'react';
import { CloudUpload, FolderUp } from 'lucide-react';

export interface FolderEntry {
  file: File;
  relativePath: string;
}

interface DropZoneProps {
  onFilesDropped: (files: FileList) => void;
  onFolderDropped?: (entries: FolderEntry[]) => void;
  children: React.ReactNode;
}

// Recursively traverse FileSystemDirectoryEntry to collect all files
async function traverseDirectory(
  entry: FileSystemDirectoryEntry,
  basePath: string
): Promise<FolderEntry[]> {
  const results: FolderEntry[] = [];
  const reader = entry.createReader();

  const readAll = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...batch);
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });

  const entries = await readAll();

  for (const child of entries) {
    const childPath = basePath ? `${basePath}/${child.name}` : child.name;
    if (child.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (child as FileSystemFileEntry).file(resolve, reject)
      );
      results.push({ file, relativePath: childPath });
    } else if (child.isDirectory) {
      const subFiles = await traverseDirectory(child as FileSystemDirectoryEntry, childPath);
      results.push(...subFiles);
    }
  }

  return results;
}

export function DropZone({ onFilesDropped, onFolderDropped, children }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isFolder, setIsFolder] = useState(false);
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
      setIsFolder(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';

    // Detect if dragging folders via items
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        setIsFolder(entry?.isDirectory || false);
      }
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setIsFolder(false);
    dragCounter.current = 0;

    // Check if any dropped items are folders using webkitGetAsEntry
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && onFolderDropped) {
      let hasFolder = false;
      const folderEntries: FileSystemDirectoryEntry[] = [];
      const plainFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          hasFolder = true;
          folderEntries.push(entry as FileSystemDirectoryEntry);
        } else if (entry?.isFile) {
          const file = e.dataTransfer.files[i];
          if (file) plainFiles.push(file);
        }
      }

      if (hasFolder) {
        // Traverse all folder entries
        const allEntries: FolderEntry[] = [];
        for (const dir of folderEntries) {
          const entries = await traverseDirectory(dir, dir.name);
          allEntries.push(...entries);
        }
        // Also include any loose files
        for (const f of plainFiles) {
          allEntries.push({ file: f, relativePath: f.name });
        }
        if (allEntries.length > 0) {
          onFolderDropped(allEntries);
        }
        return;
      }
    }

    // Fallback: regular file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  }, [onFilesDropped, onFolderDropped]);

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
            {isFolder ? <FolderUp size={32} /> : <CloudUpload size={32} />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--cv-text-primary)', letterSpacing: '-0.01em' }}>
            {isFolder ? 'Upload Folder' : 'Release to Cloud'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--cv-text-secondary)', lineHeight: 1.5 }}>
            {isFolder
              ? 'Folder dan semua isinya akan diunggah dengan struktur yang sama'
              : 'Your files will be automatically synced and balanced across your Multi-Cloud storage'}
          </div>
        </div>
      </div>
    </div>
  );
}
