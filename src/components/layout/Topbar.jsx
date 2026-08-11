import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, ChevronDown, ChevronRight, LogOut, User, Building2, CheckCircle2 } from 'lucide-react';
import { switchAdminDepartment } from '../../services/pdf';
import NotificationBell from '../NotificationBell';
import ProfileModal from './ProfileModal';
import LanguageToggle from '../LanguageToggle';
import AccessibilityMenu from '../AccessibilityMenu';
import haryanaLogo from '../../assets/haryana-logo.png';

const topBarIconStyle = {
  width: 36, height: 36, borderRadius: 9, background: 'transparent',
  color: 'var(--text-color-secondary)', border: '1px solid var(--surface-border)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function TopbarDivider() {
  return <span aria-hidden="true" style={{ width: 1, height: 24, background: 'var(--surface-border)', flexShrink: 0 }} />;
}

const ROLE_META = {
  citizen:  { label: 'topbar.roles.citizen',       color: '#214aab', bg: 'rgba(33, 74, 171,.1)' },
  uploader: { label: 'topbar.roles.uploader',       color: '#0d6efd', bg: 'rgba(13, 110, 253,.1)' },
  approver: { label: 'topbar.roles.approver',       color: '#b45309', bg: 'rgba(255, 193, 7,.1)' },
  csoffice: { label: 'topbar.roles.csoffice',       color: '#198754', bg: 'rgba(25, 135, 84,.1)' },
  admin:       { label: 'topbar.roles.admin',       color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
  super_admin: { label: 'topbar.roles.superAdmin',  color: '#dc2626', bg: 'rgba(220,38,38,.1)'  },
  nodal_officer: { label: 'topbar.roles.nodalOfficer', color: '#0ea5e9', bg: 'rgba(14,165,233,.1)' },
  auditor:  { label: 'topbar.roles.auditor',        color: '#64748b', bg: 'rgba(100,116,139,.1)' },
};

// Roles whose Topbar shows org branding (logo + name) instead of the sidebar-toggle hamburger,
// because they get a single-page dashboard with no sidebar — see Layout.jsx's NO_SIDEBAR_ROLES.
const BRANDED_ROLES = ['uploader', 'approver'];

const BREADCRUMBS = {
  dashboard: ['topbar.crumbs.home'],
  upload: ['topbar.crumbs.home', 'topbar.crumbs.upload'],
  editdocument: ['topbar.crumbs.home', 'topbar.crumbs.editDocument'],
  adddocuments: ['topbar.crumbs.home', 'topbar.crumbs.addDocuments'],
  links: ['topbar.crumbs.home', 'topbar.crumbs.linkRequests'],
  actparts: ['topbar.crumbs.home', 'topbar.crumbs.actPartsReview'],
  analytics: ['topbar.crumbs.analytics', 'topbar.crumbs.dashboard'], graph: ['topbar.crumbs.analytics', 'topbar.crumbs.knowledgeGraph'], audit: ['topbar.crumbs.analytics', 'topbar.crumbs.misReport'],
  users: ['topbar.crumbs.admin', 'topbar.crumbs.userManagement'], logs: ['topbar.crumbs.admin', 'topbar.crumbs.systemLogs'],
  taxonomy: ['topbar.crumbs.admin', 'topbar.crumbs.masterDataManager'],
  rolecaps: ['topbar.crumbs.admin', 'topbar.crumbs.roleCaps'],
  auditfull: ['topbar.crumbs.admin', 'topbar.crumbs.fullMisReport'],
  alluploads: ['topbar.crumbs.admin', 'topbar.crumbs.allUploads'],
  auditlog: ['topbar.crumbs.auditorLabel', 'topbar.crumbs.misReport'],
  nodalusers: ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.userManagement'],
  nodaluploads:   ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.allUploads'],
  nodalactparts:  ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.actPartsReview'],
  nodalauditfull: ['topbar.crumbs.nodalOfficerLabel', 'topbar.crumbs.misReport'],
};
const DEFAULT_CRUMB = ['topbar.crumbs.dashboard'];

// For pages reached by drilling in from the dashboard, the earlier crumb doubles as a "back"
// link — position lines up with the same position in BREADCRUMBS.
const CRUMB_TARGETS = {
  upload:       ['dashboard'],
  editdocument: ['dashboard'],
  adddocuments: ['dashboard'],
  links:        ['dashboard'],
  actparts:     ['dashboard'],
};

export default function Topbar({ user, activePage, onNavigate, onLogout, onToggleSidebar, onChangePassword, onMobileVerified }) {
  const { t } = useTranslation('common');
  const [profileOpen, setProfileOpen]         = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen]   = useState(false);
  const [switchingDeptId, setSwitchingDeptId] = useState(null);
  const [switchDeptError, setSwitchDeptError] = useState('');

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const canSwitchDept = isAdmin && Array.isArray(user.departments) && user.departments.length > 1;

  async function handleSwitchDept(deptId) {
    if (deptId === user.deptId || switchingDeptId) return;
    setSwitchingDeptId(deptId);
    setSwitchDeptError('');
    try {
      const res = await switchAdminDepartment(deptId);
      const token = res.data.access_token;
      localStorage.setItem('token', token);
      setProfileOpen(false);
      setDeptPickerOpen(false);
      setSwitchingDeptId(null);
      if (onMobileVerified) onMobileVerified(token);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setSwitchDeptError(typeof detail === 'string' ? detail : 'Could not switch department. Please try again.');
      setSwitchingDeptId(null);
    }
  }
  const rm = ROLE_META[user.role] || ROLE_META.citizen;
  const crumbs = BREADCRUMBS[activePage] || DEFAULT_CRUMB;
  const crumbTargets = CRUMB_TARGETS[activePage] || [];
  const isBranded = BRANDED_ROLES.includes(user.role);
  // Only roles with a real backend-issued session (a token) can change their password —
  // the mock citizen/admin-OTP profiles have no real account to change it on.
  const canChangePassword = !!localStorage.getItem('token');

  const headerPrimaryText = user.role === 'citizen' ? t('topbar.userFallback') : user.name;

  const crumbEls = crumbs.map((c, i) => {
    const target = crumbTargets[i];
    return (
      <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {i > 0 && <ChevronRight size={13} color="var(--text-color-secondary)" style={{ flexShrink: 0, opacity: .55 }} />}
        {target ? (
          // Ancestor crumb — muted by default (this isn't the page you're on), colors in on hover to read as a link
          <button type="button" onClick={() => onNavigate?.(target)} style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text-color-secondary)',
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'var(--font)', transition: 'color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-color-secondary)'}>
            {t(c)}
          </button>
        ) : (
          // Current page — the one thing here that should stand out
          <span style={{
            fontSize: 13,
            color: i === crumbs.length - 1 ? 'var(--text-heading)' : 'var(--text-color-secondary)',
            fontWeight: i === crumbs.length - 1 ? 700 : 400,
          }}>{t(c)}</span>
        )}
      </span>
    );
  });

  return (
    <>
    <style>{`
      @media (max-width: 640px) {
        .tb-header { padding: 0 10px !important; gap: 6px !important; }
        .tb-brand { min-width: 0 !important; gap: 8px !important; }
        .tb-brand-logo { width: 32px !important; height: 32px !important; }
        .tb-brand-text { display: none !important; }
        .tb-crumb-row { font-size: 11.5px !important; }
        .tb-crumb-row span, .tb-crumb-row button { font-size: 11.5px !important; }
        .tb-profile-text { display: none !important; }
        .tb-profile-btn { padding: 4px !important; gap: 0 !important; }
        .tb-crumb-bar { margin: 0 10px !important; }
        .tb-crumb-bowl { padding: 8px 14px !important; }
        .tb-crumb-bowl span, .tb-crumb-bowl button { font-size: 11.5px !important; }
      }
    `}</style>
    <header className="tb-header" style={{
      height: 60, background: 'var(--surface-card)',
      borderBottom: '1px solid var(--surface-border)',
      display: 'flex', alignItems: 'center', padding: '0 20px 0 16px',
      gap: 10, flexShrink: 0, position: 'relative', zIndex: 9,
      boxShadow: 'var(--card-shadow)',
    }}>
      {!BRANDED_ROLES.includes(user.role) ? (
        /* Hamburger — toggles the left sidebar */
        <button onClick={onToggleSidebar} aria-label={t('topbar.toggleSidebar')} style={{ ...topBarIconStyle, transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Menu size={18} />
        </button>
      ) : (
        /* No sidebar for this role, so the org branding lives here instead */
        <>
          <div className="tb-brand" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minWidth: 240 }}>
            <img className="tb-brand-logo" src={haryanaLogo} alt="Haryana Government" loading="lazy" style={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0 }} />
            <div className="tb-brand-text" style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{t('sidebar.orgName')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{t('sidebar.orgTagline')}</div>
            </div>
          </div>
          <TopbarDivider />
        </>
      )}

      {/* Breadcrumb — branded roles show it on the curvy bar below instead */}
      <div className="tb-crumb-row" style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
        {!isBranded && crumbEls}
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
        <button className="tb-profile-btn" onClick={() => { setProfileOpen(o => !o); if (profileOpen) { setDeptPickerOpen(false); setSwitchDeptError(''); } }} style={{
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
          <div className="tb-profile-text" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{headerPrimaryText}</div>
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
            borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.16)',
            width: deptPickerOpen ? 240 : 200,
            overflow: 'hidden', zIndex: 100,
            animation: 'fadeSlideIn .15s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-hover)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerPrimaryText}</div>
              <div style={{ fontSize: 11, color: rm.color, fontWeight: 600, marginTop: 2 }}>{t(rm.label)}</div>
              {isAdmin && user.dept && (
                <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.dept}</div>
              )}
            </div>

            {!deptPickerOpen ? (
              <>
                {/* Profile */}
                <div role="button" tabIndex={0} onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProfileOpen(false); setProfileModalOpen(true); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-color)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <User size={14} color="var(--text-color-secondary)" />{t('topbar.profile')}
                </div>

                {/* Change Department — only for admin/super_admin with multiple depts */}
                {canSwitchDept && (
                  <div role="button" tabIndex={0}
                    onClick={() => { setSwitchDeptError(''); setDeptPickerOpen(true); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSwitchDeptError(''); setDeptPickerOpen(true); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-color)', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Building2 size={14} color="var(--text-color-secondary)" />{t('topbar.changeDepartment')}
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--surface-border)', margin: '4px 0' }} />

                {/* Logout */}
                <div role="button" tabIndex={0} onClick={() => { setProfileOpen(false); onLogout(); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProfileOpen(false); onLogout(); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--red)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(220, 53, 69,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <LogOut size={14} /> {t('topbar.logout')}
                </div>
              </>
            ) : (
              /* Department picker view */
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('topbar.selectDepartment')}
                </div>
                {user.departments.map(dept => {
                  const isCurrent = dept.id === user.deptId;
                  const isSwitching = switchingDeptId === dept.id;
                  return (
                    <div key={dept.id} role="button" tabIndex={0}
                      onClick={() => handleSwitchDept(dept.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSwitchDept(dept.id); } }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, padding: '8px 10px', borderRadius: 7, cursor: isCurrent ? 'default' : 'pointer',
                        fontSize: 12.5, fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? 'var(--primary)' : 'var(--text-color)',
                        background: isCurrent ? 'rgba(var(--primary-rgb, 33,74,171),.07)' : 'transparent',
                        border: `1px solid ${isCurrent ? 'rgba(var(--primary-rgb, 33,74,171),.2)' : 'transparent'}`,
                        transition: 'background .15s',
                        opacity: switchingDeptId && !isSwitching ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.name}</span>
                      {isCurrent && <CheckCircle2 size={13} color="var(--primary)" style={{ flexShrink: 0 }} />}
                      {isSwitching && <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', flexShrink: 0 }}>{t('topbar.switchingDepartment')}</span>}
                    </div>
                  );
                })}
                {switchDeptError && (
                  <div style={{ padding: '7px 10px', borderRadius: 7, background: 'rgba(220,53,69,.08)', border: '1px solid rgba(220,53,69,.2)', fontSize: 11.5, color: '#dc2626', marginTop: 2 }}>
                    ⚠ {switchDeptError}
                  </div>
                )}
                <div style={{ height: 1, background: 'var(--surface-border)', margin: '4px -14px' }} />
                <button type="button" onClick={() => { setDeptPickerOpen(false); setSwitchDeptError(''); }}
                  style={{ fontSize: 12, color: 'var(--text-color-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0', fontFamily: 'var(--font)' }}>
                  ← {t('topbar.cancel')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    {/* Secondary bar — breadcrumb, flowing seamlessly out of the branding bar above via concave
        corner "flares" (a small quarter-circle radial-gradient in the matching surface color),
        then rounding into a bowl at the bottom. More actions will land here later. */}
    {isBranded && (
      <div className="tb-crumb-bar" style={{ position: 'relative', margin: '0 4rem', flexShrink: 0 }}>
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: -22, width: 22, height: 22,
          background: 'radial-gradient(circle at 0 100%, transparent 22px, var(--surface-card) 22px)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, right: -22, width: 22, height: 22,
          background: 'radial-gradient(circle at 100% 100%, transparent 22px, var(--surface-card) 22px)',
        }} />
        <div className="tb-crumb-bowl" style={{
          padding: '10px 22px',
          borderRadius: '0 0 28px 28px',
          background: 'var(--surface-card)',
          border: '1px solid var(--surface-border)', borderTop: 'none',
          boxShadow: 'var(--card-shadow)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{crumbEls}</div>
        </div>
      </div>
    )}

    {profileModalOpen && (
      <ProfileModal
        user={user}
        roleLabel={t(rm.label)}
        canChangePassword={canChangePassword}
        onChangePassword={onChangePassword}
        onMobileVerified={onMobileVerified}
        onClose={() => setProfileModalOpen(false)}
      />
    )}
    </>
  );
}
