import { useState } from 'react';
import { Home, Search, Upload, FileText, CheckSquare, Eye, BarChart2, GitBranch, ClipboardList, ChevronDown, Users, Settings, ShieldCheck, Activity, FileSearch, BarChart, Building2 } from 'lucide-react';
import haryanaLogo from '../../assets/haryana-logo.png';
const MENU_CONFIG = {
  citizen: [
    { label: 'MAIN', items: [
      { icon: Home,     label: 'Home',             id: 'home' },
      { icon: Search,   label: 'Search Documents',  id: 'search' },
    ]},
  ],
  uploader: [
    { label: 'DOCUMENTS', items: [
      { icon: Upload,   label: 'Upload Document',  id: 'upload' },
      { icon: FileText, label: 'My Uploads',       id: 'myuploads' },
    ]},
  ],
  approver: [
    { label: 'REVIEW QUEUE', items: [
      { icon: CheckSquare, label: 'Pending Approvals', id: 'pending' },
      { icon: Eye,         label: 'Reviewed',          id: 'reviewed' },
    ]},
  ],
  csoffice: [
    { label: 'ANALYTICS', items: [
      { icon: BarChart2, label: 'Dashboard',       id: 'analytics' },
    ]},
    { label: 'KNOWLEDGE', items: [
      { icon: GitBranch,     label: 'Knowledge Graph', id: 'graph' },
      { icon: ClipboardList, label: 'MIS Report',      id: 'audit' },
    ]},
  ],
  officer: [
    { label: 'ANALYTICS', items: [
      { icon: BarChart2, label: 'Dashboard',       id: 'analytics' },
    ]},
    { label: 'KNOWLEDGE', items: [
      { icon: GitBranch,     label: 'Knowledge Graph', id: 'graph' },
      { icon: ClipboardList, label: 'MIS Report',      id: 'audit' },
    ]},
  ],
  admin: [
    { label: 'ADMINISTRATION', items: [
      { icon: Users,       label: 'User Management',    id: 'users' },
      { icon: Building2,   label: 'Departments',         id: 'departments' },
      { icon: ShieldCheck, label: 'Roles & Permissions', id: 'roles' },
    ]},
    { label: 'SYSTEM', items: [
      { icon: Settings,      label: 'Taxonomy Editor', id: 'taxonomy' },
      { icon: Activity,      label: 'System Monitor',  id: 'monitor' },
      { icon: ClipboardList, label: 'Full MIS Report',  id: 'auditfull' },
    ]},
  ],
  nodal_officer: [
    { label: 'ADMINISTRATION', items: [
      { icon: Users,       label: 'User Management', id: 'users' },
      { icon: ClipboardList, label: 'MIS Report',      id: 'auditfull' },
    ]},
  ],
  auditor: [
    { label: 'AUDIT', items: [
      { icon: ClipboardList, label: 'MIS Report',        id: 'auditlog' },
      { icon: FileSearch,    label: 'Query History',    id: 'queryhistory' },
    ]},
    { label: 'REPORTS', items: [
      { icon: BarChart,      label: 'Compliance Report', id: 'compliance' },
    ]},
  ],
};

export default function Sidebar({ user, activePage, onNavigate, collapsed, onToggle }) {
  const groups = MENU_CONFIG[user.role] || [];
  const w = collapsed ? 64 : 250;

  return (
    <aside style={{
      width: w, flexShrink: 0, height: '100vh',
      background: 'var(--surface-card)',
      borderRight: '1px solid var(--surface-border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width .25s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden', position: 'relative', zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 14px' : '0 20px',
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
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>Govt Of Haryana</div>
            <div style={{ fontSize: 10, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>Legal Knowledge System</div>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {groups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
                letterSpacing: '.08em', textTransform: 'uppercase',
                padding: '10px 20px 6px', fontFamily: 'var(--mono)',
              }}>{group.label}</div>
            )}
            {group.items.map(({ icon: Icon, label, id }) => {
              const active = activePage === id;
              return (
                <div key={id} onClick={() => onNavigate(id)} title={collapsed ? label : undefined} style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 12,
                  padding: collapsed ? '10px 0' : '9px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
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
                  {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      {!collapsed && (
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
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.role === 'citizen' ? 'User' : user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{user.role === 'citizen' ? '' : user.dept}</div>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>{user.role === 'citizen' ? 'U' : user.name[0]}</div>
        </div>
      )}
    </aside>
  );
}
