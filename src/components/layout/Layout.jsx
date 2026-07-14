import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AccessibilityToolbar from './AccessibilityToolbar';

export default function Layout({ user, activePage, onNavigate, onLogout, onChangePassword, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-ground)' }}>
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <div className="a11y-zoom-scope" style={{ display: 'flex', width: '100%', height: '100%' }}>
        {user.role !== 'citizen' && (
          <Sidebar
            user={user}
            activePage={activePage}
            onNavigate={onNavigate}
            collapsed={collapsed}
            onToggle={() => setCollapsed(c => !c)}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {user.role !== 'citizen' && (
            <Topbar
              user={user}
              activePage={activePage}
              onLogout={onLogout}
              onChangePassword={onChangePassword}
              onToggleSidebar={() => setCollapsed(c => !c)}
            />
          )}
          <main id="main-content" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', padding: user.role === 'citizen' ? 0 : '24px 28px 48px' }}>
            {children}
          </main>
        </div>
      </div>
      {/* Outside .a11y-zoom-scope: a fixed-position overlay must not inherit
          the content zoom, or its viewport-anchored offsets drift.
          Citizen guests get an equivalent menu built into their top bar instead. */}
      {user.role !== 'citizen' && <AccessibilityToolbar />}
    </div>
  );
}
