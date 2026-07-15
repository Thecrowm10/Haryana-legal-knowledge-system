import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Search, Upload, FileText, CheckSquare, Eye, BarChart2, GitBranch, ClipboardList, ChevronDown, Users, Settings, Activity, FileSearch, BarChart, Layers, Link2 } from 'lucide-react';
import haryanaLogo from '../../assets/haryana-logo.png';
const MENU_CONFIG = {
  citizen: [
    { label: 'sidebar.groups.main', items: [
      { icon: Home,     label: 'sidebar.items.home',            id: 'home' },
      { icon: Search,   label: 'sidebar.items.searchDocuments', id: 'search' },
    ]},
  ],
  uploader: [
    { label: 'sidebar.groups.documents', items: [
      { icon: Upload,   label: 'sidebar.items.uploadDocument', id: 'upload' },
      { icon: FileText, label: 'sidebar.items.myUploads',      id: 'myuploads' },
    ]},
  ],
  approver: [
    { label: 'sidebar.groups.reviewQueue', items: [
      { icon: CheckSquare, label: 'sidebar.items.pendingApprovals', id: 'pending' },
      { icon: Eye,         label: 'sidebar.items.reviewed',         id: 'reviewed' },
      { icon: Link2,       label: 'sidebar.items.linkRequests',     id: 'links' },
    ]},
  ],
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
      { icon: Activity,      label: 'sidebar.items.systemMonitor',     id: 'monitor' },
      { icon: ClipboardList, label: 'sidebar.items.fullMisReport',     id: 'auditfull' },
    ]},
  ],
  nodal_officer: [
    { label: 'sidebar.groups.administration', items: [
      { icon: Users,         label: 'sidebar.items.userManagement',  id: 'nodalusers' },
      { icon: Layers,        label: 'sidebar.items.allUploads',      id: 'nodaluploads' },
      { icon: Link2,         label: 'sidebar.items.linkedDocuments', id: 'nodallinkedocs' },
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

export default function Sidebar({ user, activePage, onNavigate, collapsed, onToggle }) {
  const { t } = useTranslation('common');
  const groups = MENU_CONFIG[user.role] || [];
  const [hovering, setHovering] = useState(false);
  // Pinned collapsed: reveal on hover, pushing the main content over (not an overlay).
  const expanded = !collapsed || hovering;
  const w = expanded ? 250 : 64;

  return (
    <div
      onMouseEnter={() => collapsed && setHovering(true)}
      onMouseLeave={() => collapsed && setHovering(false)}
      style={{ width: w, flexShrink: 0, height: '100vh', transition: 'width .2s cubic-bezier(.4,0,.2,1)' }}
    >
      <aside style={{
        width: w, height: '100vh',
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      }}>
      {/* Logo */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        padding: expanded ? '0 20px' : '0 14px',
        borderBottom: '1px solid var(--surface-border)',
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
        {groups.map(group => (
          <div key={group.label}>
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
                <div key={id} onClick={() => onNavigate(id)} title={expanded ? undefined : t(label)} style={{
                  display: 'flex', alignItems: 'center',
                  gap: expanded ? 12 : 0,
                  padding: expanded ? '9px 16px' : '10px 0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  margin: '1px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? 'var(--primary-light)' : 'transparent',
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
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      {expanded ? (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--surface-border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
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
      ) : (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
        </div>
      )}
      </aside>
    </div>
  );
}
