import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Plus, Edit2, X, Eye, EyeOff, Download } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import { getUsers, getRoles, updateUser, registerUser } from '../services/users';
import { getMyDepartments } from '../services/departments';


const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

function normalizeUser(u) {
  return {
    id:        u.id,
    name:      `${u.first_name} ${u.last_name}`.trim() || u.username,
    firstName: u.first_name ?? '',
    lastName:  u.last_name ?? '',
    username:  u.username,
    email:     u.email ?? '',
    role:      u.role?.name ?? '—',
    roleId:    u.role?.id ?? null,
    dept:      u.departments?.length > 0 ? u.departments.map(d => d.name).join(', ') : (u.department?.name ?? '—'),
    deptId:    u.department?.id ?? null,
    deptIds:   u.departments?.map(d => d.id) ?? [],
    deptRaw:   u.departments?.length > 0 ? u.departments.map(d => String(d.id)).join(',') : null,
    status:    u.is_active ? 'active' : 'inactive',
    isActive:  u.is_active,
    lastLogin: u.last_login ? u.last_login.split('T')[0] : '—',
  };
}

function exportCSV(data, filename) {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const MOCK_AUDIT = [
  { time: '2026-05-25 10:42', user: 'Priya Sharma',  role: 'uploader', action: 'Uploaded document: Haryana Municipal Act 2024' },
  { time: '2026-05-25 10:18', user: 'Sunil Verma',   role: 'approver', action: 'Approved: Punjab Land Revenue Act Amendment' },
  { time: '2026-05-25 09:55', user: 'Guest',          role: 'citizen',  action: 'Searched: "factory license renewal rules"' },
  { time: '2026-05-25 09:30', user: 'Anita Singh',   role: 'csoffice', action: 'Viewed analytics dashboard' },
  { time: '2026-05-24 17:12', user: 'Sunil Verma',   role: 'approver', action: 'Rejected: Draft Notification — missing metadata' },
  { time: '2026-05-24 16:45', user: 'Guest',          role: 'citizen',  action: 'Searched: "land acquisition compensation"' },
  { time: '2026-05-24 15:30', user: 'Deepa Nair',    role: 'auditor',  action: 'Exported audit log (CSV)' },
  { time: '2026-05-24 14:10', user: 'Harish Gupta',  role: 'approver', action: 'Approved: Excise Policy Circular 2026' },
];

export default function NodalOfficerDashboard({ activePage }) {
  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError]     = useState('');
  const [roles, setRoles]               = useState([]);

  useEffect(() => {
    if (activePage !== 'nodalusers') return;
    setUsersLoading(true);
    setUsersError('');
    Promise.all([getUsers(), getRoles()])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes.data.map(normalizeUser));
        setRoles(rolesRes.data);
      })
      .catch(() => setUsersError('Failed to load users. Please try again.'))
      .finally(() => setUsersLoading(false));
  }, [activePage]);

  // Only the nodal officer's own departments — used for filter dropdown and add/edit selectors.
  const [depts, setDepts] = useState([]);

  useEffect(() => {
    if (activePage !== 'nodalusers') return;
    getMyDepartments()
      .then(res => setDepts(res.data))
      .catch(() => {});
  }, [activePage]);

  // Add User drawer state
  const EMPTY_ADD_FORM = { username: '', email: '', password: '', first_name: '', last_name: '', role_id: '', department_id: '' };
  const [addingUser, setAddingUser]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState('');
  const [showAddPass, setShowAddPass] = useState(false);

  function handleAddUser() {
    if (!addForm.username.trim())    { setAddError('Username is required.'); return; }
    if (!addForm.email.trim())       { setAddError('Email is required.'); return; }
    if (!addForm.password)           { setAddError('Password is required.'); return; }
    if (!addForm.department_id)      { setAddError('Department is required.'); return; }
    setAddSaving(true);
    setAddError('');
    registerUser({
      username:      addForm.username.trim(),
      email:         addForm.email.trim(),
      password:      addForm.password,
      first_name:    addForm.first_name.trim(),
      last_name:     addForm.last_name.trim(),
      role_id:       addForm.role_id ? Number(addForm.role_id) : undefined,
      department_id: String(addForm.department_id),
    })
      .then(res => {
        setUsers(prev => [normalizeUser(res.data), ...prev]);
        setAddingUser(false);
        setAddForm(EMPTY_ADD_FORM);
        setShowAddPass(false);
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        setAddError(typeof detail === 'string' ? detail : 'Failed to create user.');
      })
      .finally(() => setAddSaving(false));
  }

  // Edit User modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');
  const [togglingId, setTogglingId]   = useState(null);

  function openEdit(u) {
    setEditingUser(u);
    setEditForm({
      first_name:    u.firstName,
      last_name:     u.lastName,
      email:         u.email,
      is_active:     u.isActive,
      department_id: String(u.deptId ?? ''),
    });
    setEditError('');
  }

  function handleEditSave() {
    setEditSaving(true);
    setEditError('');
    updateUser({
      user_id:       editingUser.id,
      first_name:    editForm.first_name,
      last_name:     editForm.last_name,
      email:         editForm.email,
      is_active:     editForm.is_active,
      department_id: editForm.department_id || undefined,
    })
      .then(res => {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? normalizeUser(res.data) : u));
        setEditingUser(null);
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        setEditError(typeof detail === 'string' ? detail : 'Failed to save changes.');
      })
      .finally(() => setEditSaving(false));
  }

  function handleToggle(u) {
    setTogglingId(u.id);
    updateUser({
      user_id:       u.id,
      first_name:    u.firstName,
      last_name:     u.lastName,
      email:         u.email,
      is_active:     !u.isActive,
      department_id: u.deptRaw || undefined,
    })
      .then(res => setUsers(prev => prev.map(x => x.id === u.id ? normalizeUser(res.data) : x)))
      .catch(() => {})
      .finally(() => setTogglingId(null));
  }

  const [deptFilter, setDeptFilter] = useState('');

  // ── User Management ─────────────────────────────────────────────────────
  if (activePage === 'nodalusers') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

    const filteredUsers = deptFilter
      ? users.filter(u => u.deptIds.map(String).includes(String(deptFilter)) && u.isActive)
      : users.filter(u => u.isActive);

    const INP_STYLE = {
      width: '100%', padding: '9px 12px',
      background: 'var(--surface-ground)',
      border: '1px solid var(--surface-border)',
      borderRadius: 8, fontSize: 13,
      color: 'var(--text-color)', outline: 'none',
      fontFamily: 'var(--font)',
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Total Users',    value: users.length, color: 'var(--primary)',  bg: 'rgba(26,86,219,.12)',  icon: Users },
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
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>System Users</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SelectField value={deptFilter} onChange={e => setDeptFilter(e.target.value)} placeholder="All Departments" style={{ width: 200 }}>
                <option value="">All Departments</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectField>
              <button
                onClick={() => { setAddingUser(true); setAddError(''); setAddForm({ ...EMPTY_ADD_FORM, department_id: deptFilter }); setShowAddPass(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Add User
              </button>
            </div>
          </div>
          {usersLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
              Loading users…
            </div>
          )}
          {usersError && (
            <div style={{ padding: '20px 18px', fontSize: 13, color: '#ef4444' }}>
              {usersError}
            </div>
          )}
          {!usersLoading && !usersError && filteredUsers.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
              No active users found
            </div>
          )}
          {!usersLoading && !usersError && filteredUsers.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Name', 'Username', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.username}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={u.role} variant={u.role} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{u.dept}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: u.status === 'active' ? '#1e40af' : '#b45309' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.lastLogin}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button title="Edit" onClick={() => openEdit(u)}
                        style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--primary)', display: 'flex' }}>
                        <Edit2 size={12} />
                      </button>
                      <button
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        disabled={togglingId === u.id}
                        onClick={() => handleToggle(u)}
                        style={{ background: u.isActive ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)', border: `1px solid ${u.isActive ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`, borderRadius: 6, padding: '5px 8px', cursor: togglingId === u.id ? 'not-allowed' : 'pointer', color: u.isActive ? '#ef4444' : '#22c55e', display: 'flex', opacity: togglingId === u.id ? 0.5 : 1 }}>
                        {u.isActive ? <XCircle size={12} /> : <CheckCircle size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </Card>

        {/* Add User Drawer */}
        {addingUser && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }} />
            <div style={{
              position: 'fixed', right: 0, top: 0, height: '100vh', width: 460,
              background: 'var(--surface-card)', boxShadow: '-4px 0 40px rgba(0,0,0,.18)',
              zIndex: 301, display: 'flex', flexDirection: 'column',
              animation: 'drawerSlideIn .28s cubic-bezier(.22,1,.36,1)',
            }}>

              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>Add New User</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>Create a new system account</div>
                </div>
                <button onClick={() => setAddingUser(false)}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Username + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Username *</label>
                    <input style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('username') ? 'rgba(239,68,68,.6)' : undefined }}
                      placeholder="e.g. firstname.lastname"
                      autoComplete="off"
                      value={addForm.username}
                      onChange={e => { setAddForm(f => ({ ...f, username: e.target.value })); setAddError(''); }} />
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Email *</label>
                    <input style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('email') ? 'rgba(239,68,68,.6)' : undefined }}
                      type="email" placeholder="user@example.com"
                      autoComplete="off"
                      value={addForm.email}
                      onChange={e => { setAddForm(f => ({ ...f, email: e.target.value })); setAddError(''); }} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{ ...INP_STYLE, paddingRight: 38, borderColor: addError.toLowerCase().includes('password') ? 'rgba(239,68,68,.6)' : undefined }}
                      type={showAddPass ? 'text' : 'password'}
                      placeholder="Set a password"
                      autoComplete="new-password"
                      value={addForm.password}
                      onChange={e => { setAddForm(f => ({ ...f, password: e.target.value })); setAddError(''); }} />
                    <button type="button" onClick={() => setShowAddPass(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                      {showAddPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* First + Last name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>First Name</label>
                    <input style={INP_STYLE} placeholder="First name"
                      value={addForm.first_name}
                      onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Last Name</label>
                    <input style={INP_STYLE} placeholder="Last name"
                      value={addForm.last_name}
                      onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                {/* Role + Department */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Role</label>
                    <SelectField value={addForm.role_id} onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value }))} placeholder="Select Role">
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department *</label>
                    <SelectField value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value }))} placeholder="Select Department">
                      {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </SelectField>
                  </div>
                </div>

                {addError && (
                  <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, fontSize: 12.5, color: '#ef4444', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span>⚠</span> {addError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setAddingUser(false)}
                  style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                  Cancel
                </button>
                <button onClick={handleAddUser} disabled={addSaving}
                  style={{ padding: '9px 20px', background: addSaving ? 'var(--surface-border)' : 'var(--primary)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: addSaving ? 'not-allowed' : 'pointer', color: addSaving ? 'var(--text-color-secondary)' : 'white', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {addSaving
                    ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Creating…</>
                    : <><Plus size={13} /> Create User</>
                  }
                </button>
              </div>
            </div>
          </>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }} />
            <div style={{
              position: 'relative', zIndex: 1,
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 16,
              width: 'clamp(320px, 90vw, 520px)',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}>
              {/* Modal header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>Edit User</div>
                  <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>{editingUser.username}</div>
                </div>
                <button onClick={() => setEditingUser(null)}
                  style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '6px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>First Name</label>
                    <input style={INP_STYLE} value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Last Name</label>
                    <input style={INP_STYLE} value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Email</label>
                  <input style={INP_STYLE} type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Role</label>
                    <div style={{ ...INP_STYLE, background: 'var(--surface-hover)', color: 'var(--text-color-secondary)', cursor: 'not-allowed' }}>
                      {editingUser.role.replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                    <SelectField value={editForm.department_id ?? ''} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value || null }))} placeholder="Select Department">
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                {/* Active status toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-ground)', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>Account Status</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                      {editForm.is_active ? 'User can log in and access the system' : 'User is blocked from logging in'}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: editForm.is_active ? '#22c55e' : 'var(--surface-border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', left: editForm.is_active ? 23 : 3, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
                  </button>
                </div>

                {editError && (
                  <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, fontSize: 12.5, color: '#ef4444', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span>⚠</span> {editError}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setEditingUser(null)}
                  style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                  Cancel
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  style={{ padding: '9px 20px', background: editSaving ? 'var(--surface-border)' : 'var(--primary)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', color: editSaving ? 'var(--text-color-secondary)' : 'white', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {editSaving
                    ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Saving…</>
                    : 'Save Changes'
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── Full MIS Report ──────────────────────────────────────────────────────
  if (activePage === 'nodalauditfull') {
    return (
      <div style={{ animation: 'fadeSlideIn .3s ease' }}>
        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Full System MIS Report</div>
            <button onClick={() => exportCSV(MOCK_AUDIT, 'mis-report.csv')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> Export CSV
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
