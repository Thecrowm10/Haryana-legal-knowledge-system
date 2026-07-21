import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, ChevronDown, LogOut, User } from 'lucide-react';
import NotificationBell from '../NotificationBell';
import ProfileModal from './ProfileModal';
import LanguageToggle from '../LanguageToggle';
import AccessibilityMenu from '../AccessibilityMenu';

const topBarIconStyle = {
  width: 36, height: 36, borderRadius: 9, background: 'transparent',
  color: 'var(--text-color-secondary)', border: '1px solid var(--surface-border)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function TopbarDivider() {
  return <span aria-hidden="true" style={{ width: 1, height: 24, background: 'var(--surface-border)', flexShrink: 0 }} />;
}

const ROLE_META = {
  citizen:  { label: 'topbar.roles.citizen',       color: '#1a56db', bg: 'rgba(26,86,219,.1)' },
  uploader: { label: 'topbar.roles.uploader',       color: '#3b82f6', bg: 'rgba(59,130,246,.1)' },
  approver: { label: 'topbar.roles.approver',       color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  csoffice: { label: 'topbar.roles.csoffice',       color: '#22c55e', bg: 'rgba(34,197,94,.1)' },
  admin:    { label: 'topbar.roles.admin',          color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
  nodal_officer: { label: 'topbar.roles.nodalOfficer', color: '#0ea5e9', bg: 'rgba(14,165,233,.1)' },
  auditor:  { label: 'topbar.roles.auditor',        color: '#64748b', bg: 'rgba(100,116,139,.1)' },
};

const BREADCRUMBS = {
  upload: ['topbar.crumbs.documents', 'topbar.crumbs.upload'], myuploads: ['topbar.crumbs.documents', 'topbar.crumbs.myUploads'],
  editdocument: ['topbar.crumbs.documents', 'topbar.crumbs.editDocument'],
  pending: ['topbar.crumbs.review', 'topbar.crumbs.pendingApprovals'], reviewed: ['topbar.crumbs.review', 'topbar.crumbs.reviewed'],
  analytics: ['topbar.crumbs.analytics', 'topbar.crumbs.dashboard'], graph: ['topbar.crumbs.analytics', 'topbar.crumbs.knowledgeGraph'], audit: ['topbar.crumbs.analytics', 'topbar.crumbs.misReport'],
  users: ['topbar.crumbs.admin', 'topbar.crumbs.userManagement'], logs: ['topbar.crumbs.admin', 'topbar.crumbs.systemLogs'],
  taxonomy: ['topbar.crumbs.admin', 'topbar.crumbs.masterDataManager'],
  auditfull: ['topbar.crumbs.admin', 'topbar.crumbs.fullMisReport'],
  alluploads: ['topbar.crumbs.admin', 'topbar.crumbs.allUploads'],
  auditlog: ['topbar.crumbs.auditorLabel', 'topbar.crumbs.misReport'],
  nodalusers: ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.userManagement'],
  nodaluploads:   ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.allUploads'],
  nodalauditfull: ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.misReport'],
};
const DEFAULT_CRUMB = ['topbar.crumbs.dashboard'];

export default function Topbar({ user, activePage, onLogout, onToggleSidebar, onChangePassword }) {
  const { t } = useTranslation('common');
  const [profileOpen, setProfileOpen]   = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const rm = ROLE_META[user.role] || ROLE_META.citizen;
  const crumbs = BREADCRUMBS[activePage] || DEFAULT_CRUMB;
  // Only roles with a real backend-issued session (a token) can change their password —
  // the mock citizen/admin-OTP profiles have no real account to change it on.
  const canChangePassword = !!localStorage.getItem('token');

  return (
    <>
    <header style={{
      height: 60, background: 'var(--surface-card)',
      borderBottom: '1px solid var(--surface-border)',
      display: 'flex', alignItems: 'center', padding: '0 20px 0 16px',
      gap: 10, flexShrink: 0, position: 'relative', zIndex: 9,
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Hamburger */}
      <button onClick={onToggleSidebar} aria-label={t('topbar.toggleSidebar')} style={{ ...topBarIconStyle, transition: 'background .15s' }}
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
            }}>{t(c)}</span>
          </span>
        ))}
      </div>

      <LanguageToggle iconOnly buttonStyle={topBarIconStyle} />

      <div style={{ position: 'relative' }}>
        <AccessibilityMenu iconButtonStyle={topBarIconStyle} panelAnchor="dropdown" idPrefix="staff" />
      </div>

      {/* Bell */}
      {(user.role === 'approver' || user.role === 'uploader') && (
        <>
          <TopbarDivider />
          <NotificationBell role={user.role} />
        </>
      )}

      <TopbarDivider />

      {/* Profile dropdown */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setProfileOpen(o => !o)} style={{
          background: profileOpen ? 'var(--surface-hover)' : 'transparent',
          border: '1px solid var(--surface-border)',
          borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
          padding: '4px 12px 4px 4px', transition: 'background .15s, box-shadow .15s',
          boxShadow: profileOpen ? 'var(--card-shadow)' : 'none',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
          onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: 12, fontWeight: 700, color: 'white',
            boxShadow: `0 0 0 2px var(--surface-card), 0 0 0 3.5px ${rm.color}`,
          }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{user.role === 'citizen' ? t('topbar.userFallback') : user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: rm.color }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: rm.color, flexShrink: 0 }} />
              {t(rm.label)}
            </div>
          </div>
          <ChevronDown size={13} color="var(--text-color-secondary)" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        </button>

        {profileOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
            borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.16)', width: 200,
            overflow: 'hidden', zIndex: 100,
            animation: 'fadeSlideIn .15s ease',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-hover)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.role === 'citizen' ? t('topbar.userFallback') : user.name}</div>
              <div style={{ fontSize: 11, color: rm.color, fontWeight: 600, marginTop: 2 }}>{t(rm.label)}</div>
            </div>
            <div onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-color)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={14} color="var(--text-color-secondary)" />{t('topbar.profile')}
            </div>
            <div style={{ height: 1, background: 'var(--surface-border)', margin: '4px 0' }} />
            <div onClick={() => { setProfileOpen(false); onLogout(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--red)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={14} /> {t('topbar.logout')}
            </div>
          </div>
        )}
      </div>
    </header>

    {profileModalOpen && (
      <ProfileModal
        user={user}
        roleLabel={t(rm.label)}
        canChangePassword={canChangePassword}
        onChangePassword={onChangePassword}
        onClose={() => setProfileModalOpen(false)}
      />
    )}
    </>
  );
}
