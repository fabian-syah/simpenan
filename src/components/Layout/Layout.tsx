import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp, RotateCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { Theme } from '../../hooks/useTheme';
import type { StorageProvider, TargetStorageOption } from '../../types';

interface LayoutProps {
  children: ReactNode;
  currentPath: string;
  breadcrumbs: { name: string; path: string }[];
  onNavigate: (path: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onNewFolder: () => void;
  onUploadClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  quotaElement?: ReactNode;
  targetProvider?: TargetStorageOption;
  onTargetProviderChange?: (provider: TargetStorageOption) => void;
  providers?: StorageProvider[];
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  onOpenFeedback?: () => void;
  onOpenLegal?: () => void;
  user?: any | null;
  userQuota?: any | null;
  onOpenAuth?: () => void;
  onOpenUpgrade?: () => void;
  onLogout?: () => void;
  isSuperAdmin?: boolean;
}

export function Layout({
  children,
  breadcrumbs,
  onNavigate,
  viewMode,
  onViewModeChange,
  theme,
  onThemeChange,
  onNewFolder,
  onUploadClick,
  searchQuery,
  onSearchChange,
  activeSection,
  onSectionChange,
  quotaElement,
  targetProvider = 'auto',
  onTargetProviderChange,
  providers,
  onMoveFiles,
  onRefresh,
  onOpenFeedback,
  onOpenLegal,
  user,
  userQuota,
  onOpenAuth,
  onOpenUpgrade,
  onLogout,
  isSuperAdmin = false,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Close sidebar on navigation (mobile)
  const handleNavigate = useCallback((path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  }, [onNavigate]);

  const handleSectionChange = useCallback((section: string) => {
    onSectionChange(section);
    setSidebarOpen(false);
  }, [onSectionChange]);

  // Track scroll depth for scroll-driven progress line and back-to-top trigger
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const max = target.scrollHeight - target.clientHeight;
    const progress = max > 0 ? target.scrollTop / max : 0;
    setScrollProgress(Math.min(Math.max(progress, 0), 1));
    setIsScrolled(target.scrollTop > 16);
  }, []);

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Close sidebar on resize to desktop (> 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pull-to-refresh on mobile / touch devices
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !onRefresh) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0 && !isRefreshing) {
        touchStartY.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      if (el.scrollTop > 0) {
        isPullingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;

      if (deltaY > 0) {
        // Damped logarithmic pull resistance, max 75px
        const distance = Math.min(Math.pow(deltaY, 0.82) * 1.6, 75);
        pullDistanceRef.current = distance;
        setPullDistance(distance);

        if (deltaY > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      const triggered = pullDistanceRef.current >= 55;
      if (triggered && onRefresh) {
        setIsRefreshing(true);
        setPullDistance(48); // Hold indicator while refreshing
        try {
          await onRefresh();
        } catch (err) {
          console.error('Pull-to-refresh failed:', err);
        } finally {
          setIsRefreshing(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing]);

  return (
    <div className="cv-app-shell">
      {/* Mobile sidebar overlay */}
      <div
        className={`cv-sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNewClick={onNewFolder}
        onUploadClick={onUploadClick}
        quotaElement={quotaElement}
        targetProvider={targetProvider}
        onTargetProviderChange={onTargetProviderChange}
        providers={providers}
        onMoveFiles={onMoveFiles}
        theme={theme}
        onThemeChange={onThemeChange}
        onOpenFeedback={onOpenFeedback}
        onOpenLegal={onOpenLegal}
        isSuperAdmin={isSuperAdmin}
      />

      <div className="cv-main-area">
        <Header
          breadcrumbs={breadcrumbs}
          onNavigate={handleNavigate}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          theme={theme}
          onThemeChange={onThemeChange}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onMenuClick={() => setSidebarOpen(true)}
          onMoveFiles={onMoveFiles}
          onOpenFeedback={onOpenFeedback}
          user={user}
          userQuota={userQuota}
          onOpenAuth={onOpenAuth}
          onOpenUpgrade={onOpenUpgrade}
          onLogout={onLogout}
        />
        <main
          ref={contentRef}
          className={`cv-content cv-bento-card ${isScrolled ? 'is-scrolled' : ''}`}
          onScroll={handleScroll}
        >
          {/* Mobile Pull-to-Refresh Indicator */}
          {(pullDistance > 0 || isRefreshing) && (
            <div
              className="cv-pull-to-refresh"
              style={{
                height: `${pullDistance}px`,
                opacity: Math.min(pullDistance / 35, 1),
                transition: isPullingRef.current ? 'none' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="cv-pull-indicator">
                <RotateCw
                  size={15}
                  className={`cv-pull-icon ${isRefreshing ? 'cv-pull-spin' : ''}`}
                  style={{
                    transform: isRefreshing ? undefined : `rotate(${pullDistance * 5}deg)`,
                  }}
                />
                <span className="cv-pull-text">
                  {isRefreshing
                    ? 'Memperbarui berkas...'
                    : pullDistance >= 55
                    ? 'Lepaskan untuk memuat ulang'
                    : 'Tarik ke bawah untuk memuat ulang'}
                </span>
              </div>
            </div>
          )}

          {/* Glowing subtle top scroll progress line */}
          <div
            className="cv-scroll-progress-bar"
            style={{ transform: `scaleX(${scrollProgress})` }}
            aria-hidden="true"
          />
          {children}

          {/* Floating Back to Top Pill */}
          <button
            className={`cv-scroll-top-btn ${isScrolled ? 'visible' : ''}`}
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            title="Scroll to top"
          >
            <ChevronUp size={16} />
          </button>
        </main>
      </div>
    </div>
  );
}
