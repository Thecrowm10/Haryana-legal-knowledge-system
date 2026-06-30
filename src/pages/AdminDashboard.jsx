import { useState, useEffect } from 'react';
import { Users, ShieldCheck, Settings, Activity, ClipboardList, Trash2, Edit2, Plus, CheckCircle, XCircle, Building2, X, Eye, EyeOff } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import { getUsers, getRoles, updateUser, registerUser } from '../services/users';
import { getDepartments, createDepartment } from '../services/departments';

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
    dept:      u.department?.name ?? '—',
    deptId:    u.department?.id ?? null,
    status:    u.is_active ? 'active' : 'inactive',
    isActive:  u.is_active,
    lastLogin: u.last_login ? u.last_login.split('T')[0] : '—',
  };
}

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

export default function AdminDashboard({ activePage, taxonomy = [], onUpdateTaxonomy }) {
  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError]     = useState('');
  const [roles, setRoles]               = useState([]);
  const [editState, setEditState]       = useState(null); // { category, index, value }
  const [addState, setAddState]         = useState(null); // { category, value }

  useEffect(() => {
    if (activePage !== 'users') return;
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

  // ── Departments state ────────────────────────────────────────────────────
  const [depts, setDepts]               = useState([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [deptsError, setDeptsError]     = useState('');
  const [newDept, setNewDept]           = useState({ name: '', description: '' });
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => {
    if (!['departments', 'taxonomy', 'users'].includes(activePage)) return;
    setDeptsLoading(true);
    setDeptsError('');
    getDepartments()
      .then(res => setDepts(res.data))
      .catch(() => setDeptsError('Failed to load departments. Please try again.'))
      .finally(() => setDeptsLoading(false));
  }, [activePage]);

  function handleCreateDept(e) {
    e.preventDefault();
    if (!newDept.name.trim()) { setCreateError('Department name is required.'); return; }
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    createDepartment({ name: newDept.name.trim(), description: newDept.description.trim() })
      .then(res => {
        setDepts(prev => [...prev, res.data]);
        setNewDept({ name: '', description: '' });
        setCreateSuccess(`Department "${res.data.name}" created successfully.`);
        setTimeout(() => setCreateSuccess(''), 3000);
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        setCreateError(typeof detail === 'string' ? detail : 'Failed to create department.');
      })
      .finally(() => setCreating(false));
  }

  function updateCategory(category, newItems) {
    onUpdateTaxonomy(taxonomy.map(t => t.category === category ? { ...t, items: newItems } : t));
  }
  function startEdit(category, index, value) {
    setEditState({ category, index, value });
    setAddState(null);
  }
  function saveEdit() {
    if (!editState?.value.trim()) return;
    const t = taxonomy.find(t => t.category === editState.category);
    updateCategory(editState.category, t.items.map((it, i) => i === editState.index ? editState.value.trim() : it));
    setEditState(null);
  }
  function deleteItem(category, index) {
    const t = taxonomy.find(t => t.category === category);
    updateCategory(category, t.items.filter((_, i) => i !== index));
  }
  function startAdd(category) {
    setAddState({ category, value: '' });
    setEditState(null);
  }
  function saveAdd() {
    if (!addState?.value.trim()) return;
    const t = taxonomy.find(t => t.category === addState.category);
    if (t.items.includes(addState.value.trim())) return;
    updateCategory(addState.category, [...t.items, addState.value.trim()]);
    setAddState(null);
  }

  // ── Add User modal state ─────────────────────────────────────────────────
  const EMPTY_ADD_FORM = { username: '', email: '', password: '', first_name: '', last_name: '', role_id: '', department_id: '' };
  const [addingUser, setAddingUser]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState('');
  const [showAddPass, setShowAddPass] = useState(false);

  function handleAddUser() {
    if (!addForm.username.trim()) { setAddError('Username is required.'); return; }
    if (!addForm.email.trim())    { setAddError('Email is required.'); return; }
    if (!addForm.password)        { setAddError('Password is required.'); return; }
    setAddSaving(true);
    setAddError('');
    registerUser({
      username:      addForm.username.trim(),
      email:         addForm.email.trim(),
      password:      addForm.password,
      first_name:    addForm.first_name.trim(),
      last_name:     addForm.last_name.trim(),
      role_id:       addForm.role_id       ? Number(addForm.role_id)       : undefined,
      department_id: addForm.department_id ? Number(addForm.department_id) : undefined,
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

  // ── Edit modal state ─────────────────────────────────────────────────────
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
      role_id:       u.roleId,
      department_id: u.deptId,
    });
    setEditError('');
  }

  function handleEditSave() {
    setEditSaving(true);
    setEditError('');
    updateUser({ user_id: editingUser.id, ...editForm })
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
      role_id:       u.roleId,
      department_id: u.deptId,
    })
      .then(res => setUsers(prev => prev.map(x => x.id === u.id ? normalizeUser(res.data) : x)))
      .catch(() => {})
      .finally(() => setTogglingId(null));
  }

  // ── User Management ──────────────────────────────────────────────────────
  if (activePage === 'users') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

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
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>System Users</div>
            <button onClick={() => { setAddingUser(true); setAddError(''); setAddForm(EMPTY_ADD_FORM); setShowAddPass(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> Add User
            </button>
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
          {!usersLoading && !usersError && (
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

        {/* ── Add User Modal ── */}
        {addingUser && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setAddingUser(false); }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', zIndex: 1, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 16, width: 'clamp(320px, 90vw, 540px)', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>

              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>Add New User</div>
                  <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>Create a new system account</div>
                </div>
                <button onClick={() => setAddingUser(false)}
                  style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '6px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

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
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                    <SelectField value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value }))} placeholder="Select Department">
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
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
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
          </div>
        )}

        {/* ── Edit User Modal ── */}
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
                    <SelectField value={editForm.role_id ?? ''} onChange={e => setEditForm(f => ({ ...f, role_id: e.target.value ? Number(e.target.value) : null }))} placeholder="Select Role">
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                    <SelectField value={editForm.department_id ?? ''} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value ? Number(e.target.value) : null }))} placeholder="No Department">
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

  // ── Departments ──────────────────────────────────────────────────────────
  if (activePage === 'departments') {
    const INP = (extra = {}) => ({
      width: '100%',
      padding: '10px 13px',
      background: 'var(--surface-ground)',
      border: '1px solid var(--surface-border)',
      borderRadius: 9,
      fontSize: 13,
      color: 'var(--text-color)',
      outline: 'none',
      fontFamily: 'var(--font)',
      ...extra,
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        {/* ── Stat card ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...LABEL, marginBottom: 8 }}>Total Departments</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                  {deptsLoading ? '—' : depts.length}
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(26,86,219,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} color='var(--primary)' strokeWidth={1.8} />
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Create form ── */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>Add Department</div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginBottom: 18 }}>Create a new department record.</div>

            <form onSubmit={handleCreateDept} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...LABEL, display: 'block', marginBottom: 7 }}>Department Name *</label>
                <input
                  style={INP(createError && !newDept.name.trim() ? { borderColor: 'rgba(239,68,68,.6)' } : {})}
                  placeholder="e.g. Revenue Department"
                  value={newDept.name}
                  onChange={e => { setNewDept(p => ({ ...p, name: e.target.value })); setCreateError(''); }}
                />
              </div>

              <div>
                <label style={{ ...LABEL, display: 'block', marginBottom: 7 }}>Description</label>
                <textarea
                  rows={4}
                  style={{ ...INP(), resize: 'vertical', lineHeight: 1.55 }}
                  placeholder="Brief description of the department's function…"
                  value={newDept.description}
                  onChange={e => setNewDept(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              {createError && (
                <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, fontSize: 12.5, color: '#ef4444', display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span>⚠</span> {createError}
                </div>
              )}
              {createSuccess && (
                <div style={{ padding: '9px 12px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, fontSize: 12.5, color: '#16a34a', display: 'flex', gap: 7, alignItems: 'center' }}>
                  <CheckCircle size={13} /> {createSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: creating ? 'var(--surface-border)' : 'var(--primary)',
                  color: creating ? 'var(--text-color-secondary)' : 'white',
                  border: 'none', borderRadius: 9, padding: '10px 0',
                  fontSize: 13.5, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)', transition: 'background .15s',
                }}
              >
                {creating
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/> Creating…</>
                  : <><Plus size={14} /> Add Department</>
                }
              </button>
            </form>
          </Card>

          {/* ── Departments list ── */}
          <Card padding="0">
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>All Departments</div>
            </div>

            {deptsLoading && (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
                Loading departments…
              </div>
            )}
            {deptsError && (
              <div style={{ padding: '20px 18px', fontSize: 13, color: '#ef4444' }}>{deptsError}</div>
            )}
            {!deptsLoading && !deptsError && depts.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
                No departments yet. Add one using the form.
              </div>
            )}
            {!deptsLoading && !deptsError && depts.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                    {['#', 'Name', 'Description'].map(h => (
                      <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {depts.map((d, i) => (
                    <tr key={d.id}
                      style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', width: 40 }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{d.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{d.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
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
    const INPUT_STYLE = {
      flex: 1, border: '1px solid var(--primary)', borderRadius: 6, padding: '4px 8px',
      fontSize: 12.5, outline: 'none', fontFamily: 'var(--font)', color: 'var(--text-color)',
      background: 'var(--surface-card)',
    };
    const BTN = (color, label, onClick) => (
      <button onClick={onClick} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color, padding: '2px 4px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
      }}>{label}</button>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {taxonomy.map(t => {
          const isApiDriven = t.category === 'Departments';
          const displayItems = isApiDriven ? depts.map(d => d.name) : t.items;

          return (
          <Card key={t.category}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{t.category}</div>
                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                  {isApiDriven
                    ? (deptsLoading ? 'Loading…' : `${depts.length} items · synced from API`)
                    : `${t.items.length} items`
                  }
                </div>
              </div>
              {!isApiDriven && (
                <button onClick={() => startAdd(t.category)} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={11} /> Add
                </button>
              )}
              {isApiDriven && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 20, background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)' }}>
                  <Building2 size={10} color='var(--primary)' />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>API</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayItems.map((item, idx) => {
                const isEditing = !isApiDriven && editState?.category === t.category && editState?.index === idx;
                return (
                  <div key={item + idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, background: isEditing ? 'rgba(26,86,219,.04)' : 'var(--surface-ground)', border: `1px solid ${isEditing ? 'var(--primary-border)' : 'var(--surface-border)'}` }}>
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editState.value}
                          onChange={e => setEditState(s => ({ ...s, value: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditState(null); }}
                          style={INPUT_STYLE}
                        />
                        {BTN('var(--primary)', 'Save', saveEdit)}
                        {BTN('var(--text-color-secondary)', 'Cancel', () => setEditState(null))}
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 12.5, color: 'var(--text-color)', flex: 1 }}>{item}</span>
                        {!isApiDriven && (
                          <>
                            <button onClick={() => startEdit(t.category, idx, item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', padding: 2, display: 'flex' }} title="Edit">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deleteItem(t.category, idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex' }} title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── Add new item input (non-API categories only) ── */}
              {!isApiDriven && addState?.category === t.category && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, background: 'rgba(26,86,219,.04)', border: '1px solid var(--primary-border)' }}>
                  <input
                    autoFocus
                    placeholder={`New ${t.category.replace(/s$/, '').toLowerCase()}…`}
                    value={addState.value}
                    onChange={e => setAddState(s => ({ ...s, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setAddState(null); }}
                    style={INPUT_STYLE}
                  />
                  {BTN('var(--primary)', 'Add', saveAdd)}
                  {BTN('var(--text-color-secondary)', 'Cancel', () => setAddState(null))}
                </div>
              )}
            </div>
          </Card>
          );
        })}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#1e40af' }}>
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
