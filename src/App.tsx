import { useState, useCallback, useRef } from 'react';
import { Layout } from './components/Layout/Layout';
import { FileList } from './components/FileExplorer/FileList';
import { DropZone } from './components/Upload/DropZone';
import { UploadManager } from './components/Upload/UploadManager';
import { QuotaBar } from './components/Storage/QuotaBar';
import { Modal } from './components/UI/Modal';
import { PreviewModal } from './components/FileExplorer/PreviewModal';
import { ShareModal } from './components/Share/ShareModal';
import { AudioPlayerBar } from './components/AudioPlayer/AudioPlayerBar';
import type { FileRecord, TargetStorageOption } from './types';
import { getDownloadUrl } from './lib/api';
import { useFiles } from './hooks/useFiles';
import { useUpload } from './hooks/useUpload';
import { useStorage } from './hooks/useStorage';
import { useTheme } from './hooks/useTheme';

export default function App() {
  // State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('drive');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Storage provider selection with localStorage persistence
  const [targetProvider, setTargetProvider] = useState<TargetStorageOption>(() => {
    return (localStorage.getItem('cv_target_provider') as TargetStorageOption) || 'auto';
  });

  const handleTargetProviderChange = useCallback((provider: TargetStorageOption) => {
    setTargetProvider(provider);
    localStorage.setItem('cv_target_provider', provider);
  }, []);

  const [renameTarget, setRenameTarget] = useState<{ id: string, name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [shareModalFile, setShareModalFile] = useState<FileRecord | null>(null);
  const [currentAudio, setCurrentAudio] = useState<{ file: FileRecord; url: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { theme, setTheme } = useTheme();
  
  const {
    files,
    loading,
    currentPath,
    breadcrumbs,
    navigateTo,
    prefetchFolder,
    createFolder,
    deleteFile,
    toggleStar,
    renameFile,
    moveFiles,
    invalidateCache,
  } = useFiles('/', activeSection);

  const { quota, loading: quotaLoading, fetchQuota } = useStorage();

  const {
    uploads,
    uploadFiles,
    removeUpload,
    clearCompleted,
  } = useUpload(currentPath, targetProvider, () => {
    // Refresh file list and quota after upload completes
    invalidateCache();
    fetchQuota();
  });

  // Handlers
  const handleRefresh = useCallback(async () => {
    await invalidateCache();
    await fetchQuota();
  }, [invalidateCache, fetchQuota]);

  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section);
    if (section === 'drive') navigateTo('/');
  }, [navigateTo]);

  const handleNewFolder = useCallback(() => {
    setNewFolderName('');
    setShowNewFolderModal(true);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setShowNewFolderModal(false);
    setNewFolderName('');
  }, [newFolderName, createFolder]);

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    await renameFile(renameTarget.id, renameTarget.name.trim());
    setRenameTarget(null);
  }, [renameTarget, renameFile]);

  const handleShare = useCallback((fileId: string) => {
    const target = files.find(f => f.id === fileId);
    if (target) {
      setShareModalFile(target);
    }
  }, [files]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [uploadFiles]);

  const handleFilesDropped = useCallback((fileList: FileList) => {
    uploadFiles(fileList);
  }, [uploadFiles]);

  return (
    <DropZone onFilesDropped={handleFilesDropped}>
      <Layout
        currentPath={currentPath}
        breadcrumbs={breadcrumbs}
        onNavigate={navigateTo}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        theme={theme}
        onThemeChange={setTheme}
        onNewFolder={handleNewFolder}
        onUploadClick={handleUploadClick}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        quotaElement={<QuotaBar quota={quota} loading={quotaLoading} />}
        targetProvider={targetProvider}
        onTargetProviderChange={handleTargetProviderChange}
        onMoveFiles={moveFiles}
        onRefresh={handleRefresh}
      >
        <FileList
          files={files}
          loading={loading}
          viewMode={viewMode}
          searchQuery={searchQuery}
          onFolderOpen={navigateTo}
          onDelete={async (id) => {
            await deleteFile(id);
            fetchQuota();
          }}
          onBatchDelete={async (ids) => {
            for (const id of ids) {
              await deleteFile(id);
            }
            fetchQuota();
          }}
          onMoveFiles={async (fileIds, targetPath) => {
            await moveFiles(fileIds, targetPath);
          }}
          onPlayAudio={(file) => {
            setCurrentAudio({ file, url: getDownloadUrl(file.id) });
          }}
          onToggleStar={toggleStar}
          onRename={(id, name) => setRenameTarget({ id, name })}
          onShare={handleShare}
          onPreview={setPreviewFile}
          onFolderHover={prefetchFolder}
        />
      </Layout>

      {/* Upload progress panel */}
      <UploadManager
        uploads={uploads}
        onClearCompleted={clearCompleted}
        onRemove={removeUpload}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Modals */}
      <Modal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        title="New folder"
      >
        <div style={{ padding: '0 24px 24px' }}>
          <input
            type="text"
            autoFocus
            className="cv-modal-input"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Untitled folder"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <div className="cv-modal-actions" style={{ marginTop: 24 }}>
            <button className="cv-btn cv-btn-ghost" onClick={() => setShowNewFolderModal(false)}>Cancel</button>
            <button className="cv-btn cv-btn-primary" onClick={handleCreateFolder}>Create</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename"
      >
        <div style={{ padding: '0 24px 24px' }}>
          <input
            type="text"
            autoFocus
            className="cv-modal-input"
            value={renameTarget?.name || ''}
            onChange={(e) => setRenameTarget(prev => prev ? { ...prev, name: e.target.value } : null)}
            placeholder="File name"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <div className="cv-modal-actions" style={{ marginTop: 24 }}>
            <button className="cv-btn cv-btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="cv-btn cv-btn-primary" onClick={handleRename}>OK</button>
          </div>
        </div>
      </Modal>

      {previewFile && (
        <PreviewModal 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
        />
      )}

      {/* Persistent Floating Audio / Music Player Bar */}
      {currentAudio && (
        <AudioPlayerBar
          file={currentAudio.file}
          url={currentAudio.url}
          onClose={() => setCurrentAudio(null)}
        />
      )}

      {/* Share Modal Dialog */}
      {shareModalFile && (
        <ShareModal
          file={shareModalFile}
          onClose={() => setShareModalFile(null)}
        />
      )}
    </DropZone>
  );
}
