import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// These roles get a single-page dashboard (no left nav) — see their Topbar branding block instead.
const NO_SIDEBAR_ROLES = ['citizen', 'uploader', 'approver'];

export default function Layout({ user, activePage, onNavigate, onLogout, onChangePassword, children }) {
  const [collapsed, setCollapsed] = useState(true);
  // Below 1024px the Sidebar renders as an off-canvas drawer instead of an in-flow
  // column (see Sidebar.jsx) — mobileOpen tracks that drawer's visibility, separate
  // from `collapsed` which only governs the desktop pinned/hover-expand behavior.
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDrawerMode = useMediaQuery('(max-width: 1024px)');

  // Adjust state during render rather than in an effect (React's "you might not
  // need an effect" pattern) — resizing past the breakpoint (rotating a tablet,
  // resizing a window mid-demo) shouldn't leave the drawer stuck open once it's
  // no longer in drawer mode.
  const [prevDrawerMode, setPrevDrawerMode] = useState(isDrawerMode);
  if (isDrawerMode !== prevDrawerMode) {
    setPrevDrawerMode(isDrawerMode);
    if (!isDrawerMode) setMobileOpen(false);
  }

  const toggleSidebar = () => isDrawerMode ? setMobileOpen(o => !o) : setCollapsed(c => !c);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-ground)' }}>
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <div className="a11y-zoom-scope" style={{ display: 'flex', width: '100%', height: '100%' }}>
        {!NO_SIDEBAR_ROLES.includes(user.role) && (
          <Sidebar
            user={user}
            activePage={activePage}
            onNavigate={onNavigate}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {user.role !== 'citizen' && (
            <Topbar
              user={user}
              activePage={activePage}
              onNavigate={onNavigate}
              onLogout={onLogout}
              onChangePassword={onChangePassword}
              onToggleSidebar={toggleSidebar}
            />
          )}
          {/* Sticky-footer pattern: main is a flex column so Footer can sit flush at the very
              bottom with no trailing gap. The dashboard's own padding moved off `main` (which
              must stay padding:0, or that padding renders as dead space below the Footer too)
              and onto this inner content wrapper instead. The wrapper's `flex: 1 0 auto` grows
              to push Footer down to the bottom edge when content is short, and never shrinks
              below its own content when content is tall — so Footer scrolls with the page
              rather than floating over it either way. */}
          <main id="main-content" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: '1 0 auto', padding: user.role === 'citizen' ? 0 : '24px 28px 32px' }}>
              {children}
            </div>
            {user.role !== 'citizen' && <Footer />}
          </main>
        </div>
      </div>
    </div>
  );
}
