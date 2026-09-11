import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { Theme } from '../../hooks/useTheme';
import type { TargetStorageOption } from '../../types';

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
  onMoveFiles?: (fileIds: string[], targetPath: string) => Promise<void>;
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
  onMoveFiles,
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

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        onMoveFiles={onMoveFiles}
        theme={theme}
        onThemeChange={onThemeChange}
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
          targetProvider={targetProvider}
          onTargetProviderChange={onTargetProviderChange}
          onMoveFiles={onMoveFiles}
        />
        <main
          ref={contentRef}
          className={`cv-content cv-bento-card ${isScrolled ? 'is-scrolled' : ''}`}
          onScroll={handleScroll}
        >
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
