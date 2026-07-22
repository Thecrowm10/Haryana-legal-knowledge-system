import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// These roles get a single-page dashboard (no left nav) — see their Topbar branding block instead.
const NO_SIDEBAR_ROLES = ['citizen', 'uploader', 'approver'];

export default function Layout({ user, activePage, onNavigate, onLogout, onChangePassword, children }) {
  const [collapsed, setCollapsed] = useState(true);

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
            onToggle={() => setCollapsed(c => !c)}
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
              onToggleSidebar={() => setCollapsed(c => !c)}
            />
          )}
          <main id="main-content" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', padding: user.role === 'citizen' ? 0 : '24px 28px 48px' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
