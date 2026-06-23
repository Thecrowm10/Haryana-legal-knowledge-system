import { useState } from 'react';
import { Users, ShieldCheck, Settings, Activity, ClipboardList, Trash2, Edit2, Plus, CheckCircle, XCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

const MOCK_USERS = [
  { id: 1, name: 'Priya Sharma',  username: 'dept.uploader', role: 'uploader', dept: 'Revenue Dept.',  status: 'active',   lastLogin: '2026-05-24' },
  { id: 2, name: 'Sunil Verma',   username: 'dept.approver', role: 'approver', dept: 'Legal Dept.',    status: 'active',   lastLogin: '2026-05-25' },
  { id: 3, name: 'Anita Singh',   username: 'cs.office',     role: 'csoffice', dept: 'CS Office',      status: 'active',   lastLogin: '2026-05-25' },
  { id: 4, name: 'Ramesh Kumar',  username: 'dept.uploader2',role: 'uploader', dept: 'Home Dept.',     status: 'inactive', lastLogin: '2026-05-10' },
  { id: 5, name: 'Deepa Nair',    username: 'auditor.1',     role: 'auditor',  dept: 'Finance Dept.',  status: 'active',   lastLogin: '2026-05-22' },
  { id: 6, name: 'Harish Gupta',  username: 'dept.approver2',role: 'approver', dept: 'Revenue Dept.',  status: 'active',   lastLogin: '2026-05-23' },
];

const MOCK_AUDIT = [
  { time: '2026-05-25 10:42', user: 'Priya Sharma',  role: 'uploader', action: 'Uploaded document: Haryana Municipal Act 2024' },
  { time: '2026-05-25 10:18', user: 'Sunil Verma',   role: 'approver', action: 'Approved: Punjab Land Revenue Act Amendment' },
  { time: '2026-05-25 09:55', user: 'citizen',        role: 'citizen',  action: 'Searched: "factory license renewal rules"' },
  { time: '2026-05-25 09:30', user: 'Anita Singh',   role: 'csoffice', action: 'Viewed analytics dashboard' },
  { time: '2026-05-24 17:12', user: 'Sunil Verma',   role: 'approver', action: 'Rejected: Draft Notification — missing metadata' },
  { time: '2026-05-24 16:45', user: 'citizen',        role: 'citizen',  action: 'Searched: "land acquisition compensation"' },
  { time: '2026-05-24 15:30', user: 'Deepa Nair',    role: 'auditor',  action: 'Exported audit log (CSV)' },
  { time: '2026-05-24 14:10', user: 'Harish Gupta',  role: 'approver', action: 'Approved: Excise Policy Circular 2026' },
];

const TAXONOMY = [
  { category: 'Document Types', items: ['Act', 'Amendment', 'Notification', 'Circular', 'Policy', 'Rules & Regulations', 'Order / Gazette'] },
  { category: 'Departments',    items: ['Revenue', 'Legal', 'Home', 'Finance', 'Health', 'Agriculture', 'Urban Local Bodies'] },
  { category: 'Legal Status',   items: ['Active', 'Repealed', 'Amended', 'Under Review', 'Suspended'] },
];

export default function AdminDashboard({ activePage }) {
  const [users, setUsers] = useState(MOCK_USERS);

  function toggleStatus(id) {
    setUsers(u => u.map(usr => usr.id === id ? { ...usr, status: usr.status === 'active' ? 'inactive' : 'active' } : usr));
  }

  // ── User Management ──────────────────────────────────────────────────────
  if (activePage === 'users') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Total Users',    value: users.length, color: 'var(--primary)',  bg: 'rgba(26,107,60,.12)',  icon: Users },
            { label: 'Active',         value: active,       color: '#22c55e',         bg: 'rgba(34,197,94,.12)',  icon: CheckCircle },
            { label: 'Inactive',       value: inactive,     color: '#f59e0b',         bg: 'rgba(245,158,11,.12)', icon: XCircle },
          ].map(s => (
            <Card key={s.label}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} strokeWidth={1.8} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>System Users</div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> Add User
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Name', 'Username', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.username}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={u.role} variant={u.role} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{u.dept}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: u.status === 'active' ? '#15803d' : '#b45309' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.lastLogin}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button title="Edit" style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                        <Edit2 size={12} />
                      </button>
                      <button title={u.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(u.id)}
                        style={{ background: u.status === 'active' ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)', border: `1px solid ${u.status === 'active' ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: u.status === 'active' ? '#ef4444' : '#22c55e', display: 'flex' }}>
                        {u.status === 'active' ? <XCircle size={12} /> : <CheckCircle size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ── Roles & Permissions ──────────────────────────────────────────────────
  if (activePage === 'roles') {
    const ROLE_MATRIX = [
      { role: 'Citizen',    search: true,  view: true,  upload: false, approve: false, analytics: false, admin: false },
      { role: 'Uploader',  search: true,  view: true,  upload: true,  approve: false, analytics: false, admin: false },
      { role: 'Approver',  search: true,  view: true,  upload: false, approve: true,  analytics: false, admin: false },
      { role: 'CS Office', search: true,  view: true,  upload: false, approve: false, analytics: true,  admin: false },
      { role: 'Auditor',   search: false, view: true,  upload: false, approve: false, analytics: false, admin: false },
      { role: 'Admin',     search: true,  view: true,  upload: true,  approve: true,  analytics: true,  admin: true  },
    ];
    const perms = ['search', 'view', 'upload', 'approve', 'analytics', 'admin'];
    return (
      <div style={{ animation: 'fadeSlideIn .3s ease' }}>
        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Role Permission Matrix</div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 3 }}>Read-only view. Contact HARTRON to modify role permissions.</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '180px' }} />
              {perms.map(p => <col key={p} style={{ width: `${(100 - 20) / perms.length}%` }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ ...LABEL, padding: '12px 20px', textAlign: 'left' }}>Role</th>
                {perms.map(p => <th key={p} style={{ ...LABEL, padding: '12px 8px', textAlign: 'center' }}>{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map(row => (
                <tr key={row.role} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{row.role}</td>
                  {perms.map(p => (
                    <td key={p} style={{ padding: '14px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {row[p]
                          ? <CheckCircle size={18} color="#22c55e" strokeWidth={2} />
                          : <XCircle    size={18} color="#cbd5e1" strokeWidth={1.5} />}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ── Taxonomy Editor ──────────────────────────────────────────────────────
  if (activePage === 'taxonomy') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {TAXONOMY.map(t => (
          <Card key={t.category}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{t.category}</div>
              <button style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={11} /> Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {t.items.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-color)' }}>{item}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', padding: 2 }}><Edit2 size={11} /></button>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ── System Monitor ───────────────────────────────────────────────────────
  if (activePage === 'monitor') {
    const stats = [
      { label: 'Total Documents', value: '1,284', sub: '+12 today' },
      { label: 'Active Sessions', value: '7',     sub: 'right now' },
      { label: 'Searches Today',  value: '143',   sub: 'anonymised' },
      { label: 'Storage Used',    value: '4.2 GB',sub: 'of 50 GB' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {stats.map(s => (
            <Card key={s.label}>
              <div style={{ ...LABEL, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 5 }}>{s.sub}</div>
            </Card>
          ))}
        </div>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>System Health</div>
          {[['API Server','Operational'],['Database','Operational'],['OCR Service','Operational'],['Search Index','Operational'],['Audit Logger','Operational']].map(([svc, status]) => (
            <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--surface-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-color)' }}>{svc}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#15803d' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> {status}
              </span>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ── Full Audit Log ───────────────────────────────────────────────────────
  if (activePage === 'auditfull') {
    return (
      <div style={{ animation: 'fadeSlideIn .3s ease' }}>
        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Full System Audit Log</div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Export CSV
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Timestamp', 'User', 'Role', 'Action'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{log.time}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{log.user}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={log.role} variant={log.role} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color)' }}>{log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  return null;
}
