import { useState } from 'react';
import { Menu, ChevronDown, LogOut, User } from 'lucide-react';
import NotificationBell from '../NotificationBell';
import ProfileModal from './ProfileModal';

const ROLE_META = {
  citizen:  { label: 'Guest',           color: '#1a56db', bg: 'rgba(26,86,219,.1)' },
  uploader: { label: 'Dept. Uploader',  color: '#3b82f6', bg: 'rgba(59,130,246,.1)' },
  approver: { label: 'Dept. Approver',  color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  csoffice: { label: 'CS Office',       color: '#22c55e', bg: 'rgba(34,197,94,.1)' },
  admin:    { label: 'IT Admin',        color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
  nodal_officer: { label: 'Nodal Officer', color: '#0ea5e9', bg: 'rgba(14,165,233,.1)' },
  auditor:  { label: 'Auditor',         color: '#64748b', bg: 'rgba(100,116,139,.1)' },
};

const BREADCRUMBS = {
  home: ['Home'], search: ['Documents', 'Search'],
  upload: ['Documents', 'Upload'], myuploads: ['Documents', 'My Uploads'],
  pending: ['Review', 'Pending Approvals'], reviewed: ['Review', 'Reviewed'],
  analytics: ['Analytics', 'Dashboard'], graph: ['Analytics', 'Knowledge Graph'], audit: ['Analytics', 'MIS Report'],
  users: ['Admin', 'User Management'], roles: ['Admin', 'Role Matrix'], logs: ['Admin', 'System Logs'],
  auditfull: ['Admin', 'Full MIS Report'],
  auditlog: ['Auditor', 'MIS Report'],
  nodalusers: ['Nodal Officer', 'User Management'],
  nodalauditfull: ['Nodal Officer', 'MIS Report'],
};

export default function Topbar({ user, activePage, onLogout, onToggleSidebar, onChangePassword }) {
  const [profileOpen, setProfileOpen]   = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const rm = ROLE_META[user.role] || ROLE_META.citizen;
  const crumbs = BREADCRUMBS[activePage] || ['Dashboard'];
  // Only roles with a real backend-issued session (a token) can change their password —
  // the mock citizen/admin-OTP profiles have no real account to change it on.
  const canChangePassword = !!localStorage.getItem('token');

  return (
    <>
    <header style={{
      height: 60, background: 'var(--surface-card)',
      borderBottom: '1px solid var(--surface-border)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      gap: 12, flexShrink: 0, position: 'relative', zIndex: 9,
      boxShadow: '0 2px 4px rgba(0,0,0,.04)',
    }}>
      {/* Hamburger */}
      <button onClick={onToggleSidebar} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-color-secondary)', transition: 'background .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {crumbs.map((c, i) => (
          <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'var(--surface-border)', fontSize: 14 }}>/</span>}
            <span style={{
              fontSize: 13,
              color: i === crumbs.length - 1 ? 'var(--text-heading)' : 'var(--text-color-secondary)',
              fontWeight: i === crumbs.length - 1 ? 600 : 400,
            }}>{c}</span>
          </span>
        ))}
      </div>

      {/* Bell */}
      {(user.role === 'approver' || user.role === 'uploader') && (
        <NotificationBell role={user.role} />
      )}

      {/* Profile dropdown */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setProfileOpen(o => !o)} style={{
          background: 'transparent', border: '1px solid var(--surface-border)',
          borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', transition: 'background .15s',
          background: profileOpen ? 'var(--surface-hover)' : 'transparent',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
          }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{user.role === 'citizen' ? 'User' : user.name}</div>
            <div style={{ fontSize: 10.5, color: rm.color, background: rm.bg, borderRadius: 4, padding: '0 4px', display: 'inline-block' }}>{rm.label}</div>
          </div>
          <ChevronDown size={13} color="var(--text-color-secondary)" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {profileOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
            borderRadius: 10, boxShadow: 'var(--card-shadow)', width: 180,
            overflow: 'hidden', zIndex: 100,
            animation: 'fadeSlideIn .15s ease',
          }}>
            <div onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-color)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={14} color="var(--text-color-secondary)" />Profile
            </div>
            <div style={{ height: 1, background: 'var(--surface-border)', margin: '4px 0' }} />
            <div onClick={() => { setProfileOpen(false); onLogout(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--red)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={14} /> Logout
            </div>
          </div>
        )}
      </div>
    </header>

    {profileModalOpen && (
      <ProfileModal
        user={user}
        roleLabel={rm.label}
        canChangePassword={canChangePassword}
        onChangePassword={onChangePassword}
        onClose={() => setProfileModalOpen(false)}
      />
    )}
    </>
  );
}
