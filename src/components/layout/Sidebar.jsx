import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, GitBranch, ClipboardList, Users, Settings, FileSearch, BarChart, Layers, Link2, BookOpen, ShieldCheck } from 'lucide-react';
import haryanaLogo from '../../assets/haryana-logo.png';
import { useMediaQuery } from '../../hooks/useMediaQuery';
const MENU_CONFIG = {
  // uploader and approver have no sidebar — see Layout.jsx (single-page dashboard instead)
  csoffice: [
    { label: 'sidebar.groups.analytics', items: [
      { icon: BarChart2, label: 'sidebar.items.dashboard',       id: 'analytics' },
    ]},
    { label: 'sidebar.groups.knowledge', items: [
      { icon: GitBranch,     label: 'sidebar.items.knowledgeGraph', id: 'graph' },
      { icon: ClipboardList, label: 'sidebar.items.misReport',      id: 'audit' },
    ]},
  ],
  officer: [
    { label: 'sidebar.groups.analytics', items: [
      { icon: BarChart2, label: 'sidebar.items.dashboard',       id: 'analytics' },
    ]},
    { label: 'sidebar.groups.knowledge', items: [
      { icon: GitBranch,     label: 'sidebar.items.knowledgeGraph', id: 'graph' },
      { icon: ClipboardList, label: 'sidebar.items.misReport',      id: 'audit' },
    ]},
  ],
  admin: [
    { label: 'sidebar.groups.administration', items: [
      { icon: Users,       label: 'sidebar.items.userManagement',    id: 'users' },
      { icon: Layers,      label: 'sidebar.items.allUploads',        id: 'alluploads' },
      { icon: Link2,       label: 'sidebar.items.linkedDocuments',   id: 'linkedocs' },
    ]},
    { label: 'sidebar.groups.system', items: [
      { icon: Settings,      label: 'sidebar.items.masterDataManager', id: 'taxonomy' },
      { icon: ShieldCheck,   label: 'sidebar.items.roleCaps',          id: 'rolecaps' },
      // System Monitor — not wired to a real API yet (all stats are hardcoded placeholders).
      // Hidden from the menu until that API exists; page code below is kept, not deleted.
      // { icon: Activity,      label: 'sidebar.items.systemMonitor',     id: 'monitor' },
      { icon: ClipboardList, label: 'sidebar.items.fullMisReport',     id: 'auditfull' },
    ]},
  ],
  nodal_officer: [
    { label: 'sidebar.groups.administration', items: [
      { icon: Users,         label: 'sidebar.items.userManagement',  id: 'nodalusers' },
      { icon: Layers,        label: 'sidebar.items.allUploads',      id: 'nodaluploads' },
      { icon: Link2,         label: 'sidebar.items.linkedDocuments', id: 'nodallinkedocs' },
      { icon: BookOpen,      label: 'sidebar.items.actPartsReview',  id: 'nodalactparts' },
      { icon: ClipboardList, label: 'sidebar.items.misReport',       id: 'nodalauditfull' },
    ]},
  ],
  nodal: [
    { label: 'sidebar.groups.administration', items: [
      { icon: Users,       label: 'sidebar.items.userManagement', id: 'users' },
      { icon: ClipboardList, label: 'sidebar.items.auditLog',     id: 'auditfull' },
    ]},
  ],
  auditor: [
    { label: 'sidebar.groups.audit', items: [
      { icon: ClipboardList, label: 'sidebar.items.misReport',       id: 'auditlog' },
      { icon: FileSearch,    label: 'sidebar.items.queryHistory',    id: 'queryhistory' },
    ]},
    { label: 'sidebar.groups.reports', items: [
      { icon: BarChart,      label: 'sidebar.items.complianceReport', id: 'compliance' },
    ]},
  ],
};

export default function Sidebar({ user, activePage, onNavigate, collapsed, mobileOpen, onCloseMobile }) {
  const { t } = useTranslation('common');
  const groups = MENU_CONFIG[user.role] || [];
  const [hovering, setHovering] = useState(false);
  // Below 1024px the sidebar can't push content over (no room) — it becomes a
  // fixed off-canvas drawer instead, toggled by Topbar's hamburger via mobileOpen.
  const isDrawerMode = useMediaQuery('(max-width: 1024px)');
  // Pinned collapsed: reveal on hover, pushing the main content over (not an overlay).
  // Hover-to-expand only makes sense with a mouse, so it's disabled in drawer mode.
  const expanded = isDrawerMode ? true : (!collapsed || hovering);
  const w = expanded ? 250 : 64;

  function handleNavigate(id) {
    onNavigate(id);
    if (isDrawerMode) onCloseMobile?.();
  }

  return (
    <>
    {isDrawerMode && mobileOpen && (
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 199 }}
      />
    )}
    <div
      onMouseEnter={() => !isDrawerMode && collapsed && setHovering(true)}
      onMouseLeave={() => !isDrawerMode && collapsed && setHovering(false)}
      style={isDrawerMode
        ? { width: 0, flexShrink: 0 }
        : { width: w, flexShrink: 0, height: '100%', transition: 'width .2s cubic-bezier(.4,0,.2,1)' }}
    >
      <aside style={{
        width: w, height: '100%',
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex', flexDirection: 'column',
        transition: isDrawerMode ? 'transform .25s cubic-bezier(.4,0,.2,1)' : 'width .2s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
        ...(isDrawerMode ? {
          position: 'fixed', top: 0, left: 0, zIndex: 200,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: mobileOpen ? '0 0 40px rgba(0,0,0,.35)' : 'none',
        } : null),
      }}>
      {/* Logo */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        padding: expanded ? '0 20px' : '0 14px',
        borderBottom: '2px solid var(--primary)',
        background: 'linear-gradient(180deg, var(--primary-light) 0%, transparent 100%)',
        gap: 10, overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <img
            src={haryanaLogo}
            alt="Haryana Government"
            loading="lazy"
            style={{ width: 42, height: 42, objectFit: 'contain' }}
          />
        </div>
        {expanded && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{t('sidebar.orgName')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{t('sidebar.orgTagline')}</div>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {groups.map((group, gi) => (
          <div key={group.label} style={gi > 0 ? { borderTop: '1px solid var(--surface-border)', marginTop: 8, paddingTop: 8 } : undefined}>
            {expanded && (
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
                letterSpacing: '.08em', textTransform: 'uppercase',
                padding: '10px 20px 6px', fontFamily: 'var(--mono)',
              }}>{t(group.label)}</div>
            )}
            {group.items.map(({ icon: Icon, label, id }) => {
              const active = activePage === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  title={expanded ? undefined : t(label)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    width: 'calc(100% - 16px)', textAlign: 'left',
                    display: 'flex', alignItems: 'center',
                    gap: expanded ? 12 : 0,
                    padding: expanded ? '9px 16px' : '10px 0',
                    justifyContent: expanded ? 'flex-start' : 'center',
                    margin: '1px 8px',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'var(--primary-light)' : 'transparent',
                    boxShadow: active ? 'var(--card-shadow)' : 'none',
                    borderLeft: active ? `3px solid var(--primary)` : '3px solid transparent',
                    color: active ? 'var(--primary)' : 'var(--text-color-secondary)',
                    fontWeight: active ? 600 : 400,
                    fontSize: 13.5,
                    transition: 'all .18s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-color)'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-color-secondary)'; }}}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                  {expanded && <span style={{ whiteSpace: 'nowrap' }}>{t(label)}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      {expanded ? (
        <div style={{ padding: 8, borderTop: '1px solid var(--surface-border)', flexShrink: 0 }}>
          <div style={{
            padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.role === 'citizen' ? t('sidebar.userFallback') : user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{user.role === 'citizen' ? '' : user.dept}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
        </div>
      )}
      </aside>
    </div>
    </>
  );
}
