import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ user, activePage, onNavigate, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-ground)' }}>
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar
          user={user}
          activePage={activePage}
          onLogout={onLogout}
          onToggleSidebar={() => setCollapsed(c => !c)}
        />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
