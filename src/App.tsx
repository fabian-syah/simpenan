import { useState, useCallback, useRef, useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { FileList } from './components/FileExplorer/FileList';
import { DropZone } from './components/Upload/DropZone';
import { UploadManager } from './components/Upload/UploadManager';
import { QuotaBar } from './components/Storage/QuotaBar';
import { Modal } from './components/UI/Modal';
import { PreviewModal } from './components/FileExplorer/PreviewModal';
import { ShareModal } from './components/Share/ShareModal';
import { ManageStorageModal } from './components/Storage/ManageStorageModal';
import { AudioPlayerBar } from './components/AudioPlayer/AudioPlayerBar';
import { FeedbackModal } from './components/Feedback/FeedbackModal';
import { AuthModal } from './components/Auth/AuthModal';
import { UpgradeModal } from './components/Pricing/UpgradeModal';
import { LegalModal } from './components/Legal/LegalModal';
import type { FileRecord, TargetStorageOption } from './types';
import { getDownloadUrl, checkPaymentStatus } from './lib/api';
import { supabase } from './lib/supabase';
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
  const [showManageStorage, setShowManageStorage] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [feedbackContext, setFeedbackContext] = useState<{
    file?: FileRecord | null;
    error?: string | null;
    category?: 'quota' | 'media' | 'upload' | 'suggestion' | 'general';
  }>({});

  const handleOpenFeedback = useCallback((ctx?: {
    file?: FileRecord | null;
    error?: string | null;
    category?: 'quota' | 'media' | 'upload' | 'suggestion' | 'general';
  }) => {
    setFeedbackContext(ctx || { file: previewFile });
    setShowFeedbackModal(true);
  }, [previewFile]);

  const handleOpenAuth = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }, []);

  const handleOpenUpgrade = useCallback((reason?: string) => {
    setUpgradeReason(reason || null);
    setShowUpgradeModal(true);
  }, []);

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState<'terms' | 'piracy' | 'privacy' | 'support'>('terms');

  const handleOpenLegal = useCallback((tab: 'terms' | 'piracy' | 'privacy' | 'support' = 'terms') => {
    setLegalInitialTab(tab);
    setShowLegalModal(true);
  }, []);
  
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

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      invalidateCache();
      fetchQuota();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [invalidateCache, fetchQuota]);

  // Check any pending payment order from previous session or page refresh
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem('cv_pending_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.orderId && Date.now() - (parsed.timestamp || 0) < 60 * 60 * 1000) {
          checkPaymentStatus(parsed.orderId)
            .then((res) => {
              if (res.status === 'PAID') {
                try {
                  localStorage.removeItem('cv_pending_order');
                } catch {}
                fetchQuota();
                setShowUpgradeModal(true);
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, [user, fetchQuota]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    invalidateCache();
    fetchQuota();
  }, [invalidateCache, fetchQuota]);

  const handleUploadError = useCallback((err: any) => {
    if (err?.code === 'FILE_SIZE_LIMIT_EXCEEDED') {
      handleOpenUpgrade('Ukuran berkas melebihi batas paket Starter (maks 250 MB). Upgrade ke Founder\'s Edition untuk unggah hingga 5 GB per berkas.');
    } else if (err?.code === 'STORAGE_LIMIT_EXCEEDED') {
      handleOpenUpgrade('Kapasitas penyimpanan akun Anda telah penuh. Upgrade ke Founder\'s Edition (50 GB Lifetime) untuk terus menyimpan berkas.');
    }
  }, [handleOpenUpgrade]);

  const {
    uploads,
    uploadFiles,
    removeUpload,
    clearCompleted,
  } = useUpload(
    currentPath,
    targetProvider,
    () => {
      // Refresh file list and quota after upload completes
      invalidateCache();
      fetchQuota();
    },
    handleUploadError
  );

  // Handlers
  const handleRefresh = useCallback(async () => {
    await invalidateCache();
    await fetchQuota();
  }, [invalidateCache, fetchQuota]);

  const isSuperAdmin = Boolean(
    user?.email && (
      user.email.toLowerCase().includes('fabian') ||
      user.email.toLowerCase().includes('bian') ||
      ['fabiansyahalghiffarireal@gmail.com', 'khusussharebian@gmail.com'].includes(user.email.toLowerCase())
    )
  );

  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section);
    if (section === 'drive') navigateTo('/');
  }, [navigateTo]);

  const handleNewFolder = useCallback(() => {
    if (!user) {
      handleOpenAuth('login');
      return;
    }
    setNewFolderName('');
    setShowNewFolderModal(true);
  }, [user, handleOpenAuth]);

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
    if (!user) {
      handleOpenAuth('login');
      return;
    }
    fileInputRef.current?.click();
  }, [user, handleOpenAuth]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      handleOpenAuth('login');
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [user, handleOpenAuth, uploadFiles]);

  const handleFilesDropped = useCallback((fileList: FileList) => {
    if (!user) {
      handleOpenAuth('login');
      return;
    }
    uploadFiles(fileList);
  }, [user, handleOpenAuth, uploadFiles]);

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
        quotaElement={
          <QuotaBar
            quota={quota}
            loading={quotaLoading}
            user={user}
            isSuperAdmin={isSuperAdmin}
            onOpenAuth={() => handleOpenAuth('login')}
            onOpenManageStorage={isSuperAdmin ? () => setShowManageStorage(true) : undefined}
            onOpenUpgrade={() => handleOpenUpgrade()}
          />
        }
        targetProvider={targetProvider}
        onTargetProviderChange={isSuperAdmin ? handleTargetProviderChange : undefined}
        providers={quota?.providers}
        onMoveFiles={moveFiles}
        onRefresh={handleRefresh}
        onOpenFeedback={() => handleOpenFeedback()}
        onOpenLegal={() => handleOpenLegal('terms')}
        user={user}
        userQuota={quota?.user_quota}
        onOpenAuth={() => handleOpenAuth('login')}
        onOpenUpgrade={() => handleOpenUpgrade()}
        onLogout={handleLogout}
        isSuperAdmin={isSuperAdmin}
      >
        <FileList
          files={files}
          loading={loading}
          viewMode={viewMode}
          searchQuery={searchQuery}
          user={user}
          onOpenAuth={() => handleOpenAuth('login')}
          onOpenLegal={() => handleOpenLegal('terms')}
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
          onOpenFeedback={handleOpenFeedback}
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

      {/* Multi-Cloud & Google Drive Storage Manager Modal */}
      {showManageStorage && (
        <ManageStorageModal
          quota={quota}
          onClose={() => setShowManageStorage(false)}
          onRefreshQuota={fetchQuota}
        />
      )}

      {/* Beta Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        currentPath={currentPath}
        activeFile={feedbackContext.file}
        initialError={feedbackContext.error}
        initialCategory={feedbackContext.category}
      />

      {/* Supabase Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          invalidateCache();
          fetchQuota();
        }}
      />

      {/* Paywuz.id Upgrade Modal (Tiers & Limits) */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        userQuota={quota?.user_quota}
        initialReason={upgradeReason}
        onUpgradeSuccess={() => {
          fetchQuota();
        }}
        onOpenLegal={() => {
          setShowUpgradeModal(false);
          handleOpenLegal('terms');
        }}
      />

      {/* Compliance & Legal Modal (Terms, Anti-Piracy DMCA, Privacy Policy, Support) */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalInitialTab}
      />
    </DropZone>
  );
}
