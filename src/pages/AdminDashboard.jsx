import { useState, useEffect, useRef } from 'react';
import { Users, ShieldCheck, Settings, Activity, ClipboardList, Trash2, Edit2, Plus, CheckCircle, XCircle, Building2, X, Eye, EyeOff, ChevronDown, Check, Download, Layers, FileText, Clock, Search, Filter } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import { getUsers, getRoles, updateUser, registerUser } from '../services/users';
import { getDepartments, createDepartment, getDocumentTypes, createDocumentType } from '../services/departments';
import { getAllDocumentsAdmin } from '../services/pdf';

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
    deptId:    u.department?.id ?? u.departments?.[0]?.id ?? null,
    deptIds:   u.departments?.length > 0 ? u.departments.map(d => d.id) : (u.department ? [u.department.id] : []),
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

  // Departments state — full list for add/edit selectors
  const [depts, setDepts]               = useState([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [deptsError, setDeptsError]     = useState('');
  const [newDept, setNewDept]           = useState({ name: '', description: '' });
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [addDeptOpen, setAddDeptOpen]   = useState(false);
  useEffect(() => {
    if (!['departments', 'taxonomy', 'users'].includes(activePage)) return;
    setDeptsLoading(true);
    setDeptsError('');
    getDepartments()
      .then(res => setDepts(res.data))
      .catch(() => setDeptsError('Failed to load departments. Please try again.'))
      .finally(() => setDeptsLoading(false));
  }, [activePage]);

  // Document Types state
  const [docTypes, setDocTypes]               = useState([]);
  const [docTypesLoading, setDocTypesLoading] = useState(false);
  const [docTypesError, setDocTypesError]     = useState('');
  const [docTypeCreating, setDocTypeCreating]         = useState(false);
  const [docTypeCreateError, setDocTypeCreateError]   = useState('');

  useEffect(() => {
    if (activePage !== 'taxonomy') return;
    setDocTypesLoading(true);
    setDocTypesError('');
    getDocumentTypes()
      .then(res => setDocTypes(res.data))
      .catch(() => setDocTypesError('Failed to load document types. Please try again.'))
      .finally(() => setDocTypesLoading(false));
  }, [activePage]);

  // All Uploads state
  const [allDocs, setAllDocs]           = useState([]);
  const [allDocsLoading, setAllDocsLoading] = useState(false);
  const [allDocsError, setAllDocsError] = useState('');
  const [uploadsSearch, setUploadsSearch] = useState('');
  const [uploadsFilterStatus, setUploadsFilterStatus] = useState('');
  const [uploadsFilterDept, setUploadsFilterDept]     = useState('');
  const [uploadsFilterUploader, setUploadsFilterUploader] = useState('');
  const [uploadsFilterApprover, setUploadsFilterApprover] = useState('');

  useEffect(() => {
    if (activePage !== 'alluploads') return;
    setAllDocsLoading(true);
    setAllDocsError('');
    Promise.all([
      getAllDocumentsAdmin(),
      getDepartments(),
    ])
      .then(([docsRes, deptsRes]) => {
        setAllDocs(docsRes.data.documents || []);
        setDepts(deptsRes.data);
      })
      .catch(() => setAllDocsError('Failed to load documents. Please try again.'))
      .finally(() => setAllDocsLoading(false));
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
        setAddDeptOpen(false);
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
    setDocTypeCreateError('');
  }
  function saveAdd() {
    if (!addState?.value.trim()) return;
    if (addState.category === 'Document Types') {
      const name = addState.value.trim();
      if (docTypes.some(dt => dt.name === name)) return;
      setDocTypeCreating(true);
      setDocTypeCreateError('');
      createDocumentType({ name, description: '' })
        .then(res => { setDocTypes(prev => [...prev, res.data]); setAddState(null); })
        .catch(err => setDocTypeCreateError(err.response?.data?.detail || 'Failed to create document type.'))
        .finally(() => setDocTypeCreating(false));
      return;
    }
    const t = taxonomy.find(t => t.category === addState.category);
    if (t.items.includes(addState.value.trim())) return;
    updateCategory(addState.category, [...t.items, addState.value.trim()]);
    setAddState(null);
  }

  // Add User modal state
  const EMPTY_ADD_FORM = { username: '', email: '', mobile_number: '', password: '', first_name: '', last_name: '', role_id: '', department_id: '', dept_ids: [] };
  const [addingUser, setAddingUser]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState('');
  const [showAddPass, setShowAddPass] = useState(false);

  async function handleAddUser() {
    if (!addForm.username.trim()) { setAddError('Username is required.'); return; }
    if (!addForm.email.trim())    { setAddError('Email is required.'); return; }
    if (!addForm.password)        { setAddError('Password is required.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const isNodal = roles.find(r => String(r.id) === String(addForm.role_id))?.name === 'nodal Officer';
      const res = await registerUser({
        username:      addForm.username.trim(),
        email:         addForm.email.trim(),
        mobile_number: addForm.mobile_number.trim() || undefined,
        password:      addForm.password,
        first_name:    addForm.first_name.trim(),
        last_name:     addForm.last_name.trim(),
        role_id:       addForm.role_id ? Number(addForm.role_id) : undefined,
        department_id: isNodal
          ? (addForm.dept_ids.length > 0 ? addForm.dept_ids.join(',') : undefined)
          : (addForm.department_id || undefined),
      });
      setUsers(prev => [normalizeUser(res.data), ...prev]);
      setAddingUser(false);
      setAddForm(EMPTY_ADD_FORM);
      setShowAddPass(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setAddError(typeof detail === 'string' ? detail : 'Failed to create user.');
    } finally {
      setAddSaving(false);
    }
  }

  // Edit modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');
  const [togglingId, setTogglingId]   = useState(null);

  function openEdit(u) {
    const isNodal = u.role === 'nodal Officer';
    setEditingUser(u);
    setEditForm({
      first_name:    u.firstName,
      last_name:     u.lastName,
      email:         u.email,
      is_active:     u.isActive,
      role_id:       u.roleId,
      department_id: isNodal ? '' : String(u.deptId ?? ''),
      dept_ids:      isNodal ? u.deptIds : [],
    });
    setEditError('');
  }

  function handleEditSave() {
    const isNodal = roles.find(r => String(r.id) === String(editForm.role_id))?.name === 'nodal Officer';
    setEditSaving(true);
    setEditError('');
    updateUser({
      user_id:       editingUser.id,
      first_name:    editForm.first_name,
      last_name:     editForm.last_name,
      email:         editForm.email,
      is_active:     editForm.is_active,
      role_id:       editForm.role_id,
      department_id: isNodal
        ? (editForm.dept_ids.length > 0 ? editForm.dept_ids.join(',') : undefined)
        : (editForm.department_id || undefined),
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
      role_id:       u.roleId,
      department_id: u.deptRaw || undefined,
    })
      .then(res => setUsers(prev => prev.map(x => x.id === u.id ? normalizeUser(res.data) : x)))
      .catch(() => {})
      .finally(() => setTogglingId(null));
  }

  // User Management
  const [deptFilter, setDeptFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState(null); // null | 'active' | 'inactive'

  if (activePage === 'users') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

    const filteredUsers = deptFilter
      ? users.filter(u => u.deptIds.map(String).includes(String(deptFilter)))
      : users;

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
            { label: 'Total Users',    value: users.length, color: 'var(--primary)',  bg: 'rgba(26,86,219,.12)',  icon: Users,       key: null },
            { label: 'Active',         value: active,       color: '#22c55e',         bg: 'rgba(34,197,94,.12)',  icon: CheckCircle, key: 'active' },
            { label: 'Inactive',       value: inactive,     color: '#f59e0b',         bg: 'rgba(245,158,11,.12)', icon: XCircle,     key: 'inactive' },
          ].map(s => {
            const isActive = statusFilter === s.key;
            return (
            <Card key={s.label} onClick={() => setStatusFilter(f => (s.key === null ? null : f === s.key ? null : s.key))}
              style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: isActive ? s.color + '22' : s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                  <s.icon size={20} color={s.color} strokeWidth={1.8} />
                </div>
              </div>
            </Card>
          );})}
        </div>

        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>System Users</div>
              {statusFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 20, background: statusFilter === 'active' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)', border: `1px solid ${statusFilter === 'active' ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}`, fontSize: 11.5, fontWeight: 600, color: statusFilter === 'active' ? '#16a34a' : '#b45309', whiteSpace: 'nowrap' }}>
                  {statusFilter === 'active' ? 'Active' : 'Inactive'}
                  <button onClick={() => setStatusFilter(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}><X size={11} /></button>
                </div>
              )}
            </div>
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
              No users yet
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

                {/* Mobile Number */}
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Mobile Number</label>
                  <input style={INP_STYLE}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile number (optional)"
                    value={addForm.mobile_number}
                    onChange={e => setAddForm(f => ({ ...f, mobile_number: e.target.value.replace(/\D/g, '') }))} />
                </div>

                {/* Role + Department */}
                {(() => {
                  const isNodal = roles.find(r => String(r.id) === String(addForm.role_id))?.name === 'nodal Officer';
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isNodal ? '1fr' : '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Role</label>
                          <SelectField
                            value={addForm.role_id}
                            onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value, department_id: '', dept_ids: [] }))}
                            placeholder="Select Role"
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                            ))}
                          </SelectField>
                        </div>
                        {!isNodal && (
                          <div>
                            <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                            <SelectField value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value }))} placeholder="Select Department">
                              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </SelectField>
                          </div>
                        )}
                      </div>

                      {/* Managed Departments — nodal officer only */}
                      {isNodal && (
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                          <MultiSelectField
                            value={addForm.dept_ids}
                            onChange={ids => setAddForm(f => ({ ...f, dept_ids: ids }))}
                            options={depts}
                            placeholder="Select departments…"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

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

                {(() => {
                  const isNodal = roles.find(r => String(r.id) === String(editForm.role_id))?.name === 'nodal Officer';
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isNodal ? '1fr' : '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Role</label>
                          <SelectField
                            value={editForm.role_id ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, role_id: e.target.value ? Number(e.target.value) : null, department_id: '', dept_ids: [] }))}
                            placeholder="Select Role"
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                            ))}
                          </SelectField>
                        </div>
                        {!isNodal && (
                          <div>
                            <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                            <SelectField value={editForm.department_id ?? ''} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value || null }))} placeholder="No Department">
                              {depts.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </SelectField>
                          </div>
                        )}
                      </div>
                      {isNodal && (
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Department</label>
                          <MultiSelectField
                            value={editForm.dept_ids}
                            onChange={ids => setEditForm(f => ({ ...f, dept_ids: ids }))}
                            options={depts}
                            placeholder="Select departments…"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

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

  // Departments
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

    function closeAddDept() {
      setAddDeptOpen(false);
      setNewDept({ name: '', description: '' });
      setCreateError('');
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(26,86,219,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={20} color='var(--primary)' strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>Departments</div>
                <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                  {deptsLoading ? 'Loading…' : `${depts.length} department${depts.length !== 1 ? 's' : ''} registered`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setAddDeptOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Plus size={14} /> Add Department
            </button>
          </div>
        </Card>

        {createSuccess && (
          <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, fontSize: 12.5, color: '#16a34a', display: 'flex', gap: 7, alignItems: 'center' }}>
            <CheckCircle size={13} /> {createSuccess}
          </div>
        )}

        {/* Departments list */}
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
              No departments yet. Click "Add Department" to create one.
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

        {/* Add Department drawer */}
        {addDeptOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }} />
            <div style={{
              position: 'fixed', right: 0, top: 0, height: '100vh', width: 420,
              background: 'var(--surface-card)', boxShadow: '-4px 0 40px rgba(0,0,0,.18)',
              zIndex: 301, display: 'flex', flexDirection: 'column',
              animation: 'drawerSlideIn .28s cubic-bezier(.22,1,.36,1)',
            }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--primary-light)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={16} color="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>Add Department</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>Create a new department record.</div>
                </div>
                <button onClick={closeAddDept}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 7 }}>Department Name *</label>
                  <input
                    autoFocus
                    style={INP(createError && !newDept.name.trim() ? { borderColor: 'rgba(239,68,68,.6)' } : {})}
                    placeholder="e.g. Revenue Department"
                    value={newDept.name}
                    onChange={e => { setNewDept(p => ({ ...p, name: e.target.value })); setCreateError(''); }}
                  />
                </div>

                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 7 }}>Description</label>
                  <textarea
                    rows={5}
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
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeAddDept}
                  style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={e => {
                    handleCreateDept(e);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: creating ? 'var(--surface-border)' : 'var(--primary)',
                    color: creating ? 'var(--text-color-secondary)' : 'white',
                    border: 'none', borderRadius: 8, padding: '9px 20px',
                    fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  {creating
                    ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/> Creating…</>
                    : <><Plus size={14} /> Add Department</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Master Data Manager
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
          const isApiDriven  = t.category === 'Departments' || t.category === 'Document Types';
        
          const canCreateApi = t.category === 'Document Types';
          const apiItems     = t.category === 'Departments' ? depts : t.category === 'Document Types' ? docTypes : [];
          const apiLoading   = t.category === 'Departments' ? deptsLoading : docTypesLoading;
          const displayItems = isApiDriven ? apiItems.map(d => d.name) : t.items;

          return (
          <Card key={t.category}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{t.category}</div>
                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                  {isApiDriven
                    ? (apiLoading ? 'Loading…' : `${apiItems.length} items`)
                    : `${t.items.length} items`
                  }
                </div>
              </div>
              {(!isApiDriven || canCreateApi) && (
                <button onClick={() => startAdd(t.category)} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={11} /> Add
                </button>
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

              
              {(!isApiDriven || canCreateApi) && addState?.category === t.category && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, background: 'rgba(26,86,219,.04)', border: '1px solid var(--primary-border)' }}>
                    <input
                      autoFocus
                      placeholder={`New ${t.category.replace(/s$/, '').toLowerCase()}…`}
                      value={addState.value}
                      disabled={canCreateApi && docTypeCreating}
                      onChange={e => setAddState(s => ({ ...s, value: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setAddState(null); }}
                      style={INPUT_STYLE}
                    />
                    {BTN('var(--primary)', canCreateApi && docTypeCreating ? 'Adding…' : 'Add', saveAdd)}
                    {BTN('var(--text-color-secondary)', 'Cancel', () => setAddState(null))}
                  </div>
                  {canCreateApi && docTypeCreateError && (
                    <div style={{ fontSize: 11, color: '#ef4444', padding: '0 4px' }}>{docTypeCreateError}</div>
                  )}
                </div>
              )}
            </div>
          </Card>
          );
        })}
      </div>
    );
  }

  // System Monitor
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

  // Full MIS Report
  if (activePage === 'auditfull') {
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

  // All Uploads
  if (activePage === 'alluploads') {
    const totalDocs    = allDocs.length;
    const approvedDocs = allDocs.filter(d => d.status === 'approved').length;
    const pendingDocs  = allDocs.filter(d => d.status === 'pending').length;
    const rejectedDocs = allDocs.filter(d => d.status === 'rejected').length;

    // unique uploaders
    const uploaderOptions = [];
    const seenUp = new Set();
    for (const d of allDocs) {
      if (d.uploader_username && !seenUp.has(d.uploader_username)) {
        seenUp.add(d.uploader_username);
        const label = [d.uploader_first_name, d.uploader_last_name].filter(Boolean).join(' ') || d.uploader_username;
        uploaderOptions.push({ value: d.uploader_username, label });
      }
    }
    // unique approvers
    const approverOptions = [];
    const seenAp = new Set();
    for (const d of allDocs) {
      const key = d.latest_approval?.approver_username;
      if (key && !seenAp.has(key)) {
        seenAp.add(key);
        const label = [d.latest_approval.approver_first_name, d.latest_approval.approver_last_name].filter(Boolean).join(' ') || key;
        approverOptions.push({ value: key, label });
      }
    }

    const filteredDocs = allDocs.filter(d => {
      if (uploadsFilterStatus && d.status !== uploadsFilterStatus) return false;
      if (uploadsFilterDept && d.department_name !== uploadsFilterDept) return false;
      if (uploadsFilterUploader && d.uploader_username !== uploadsFilterUploader) return false;
      if (uploadsFilterApprover && d.latest_approval?.approver_username !== uploadsFilterApprover) return false;
      if (uploadsSearch) {
        const q = uploadsSearch.toLowerCase();
        const name = (d.document_name || d.original_filename || '').toLowerCase();
        const dept = (d.department_name || '').toLowerCase();
        const up   = (d.uploader_username || '').toLowerCase();
        if (!name.includes(q) && !dept.includes(q) && !up.includes(q)) return false;
      }
      return true;
    });

    const SC = {
      approved: { color: '#16a34a', bg: 'rgba(34,197,94,.1)',   label: 'Approved' },
      pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,.1)',  label: 'Pending'  },
      rejected: { color: '#ef4444', bg: 'rgba(239,68,68,.1)',   label: 'Rejected' },
    };
    const cols = '4px 1fr 180px 160px 120px';
    const anyFilter = uploadsSearch || uploadsFilterStatus || uploadsFilterDept || uploadsFilterUploader || uploadsFilterApprover;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Uploads', value: totalDocs,    color: 'var(--primary)', bg: 'rgba(26,86,219,.12)',  icon: Layers,      key: '' },
            { label: 'Approved',      value: approvedDocs, color: '#16a34a',        bg: 'rgba(34,197,94,.12)',  icon: CheckCircle, key: 'approved' },
            { label: 'Pending',       value: pendingDocs,  color: '#f59e0b',        bg: 'rgba(245,158,11,.12)', icon: Clock,       key: 'pending'  },
            { label: 'Rejected',      value: rejectedDocs, color: '#ef4444',        bg: 'rgba(239,68,68,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = uploadsFilterStatus === s.key && s.key !== '';
            return (
              <Card key={s.label}
                onClick={() => setUploadsFilterStatus(f => f === s.key ? '' : s.key)}
                style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                      {allDocsLoading ? '–' : s.value}
                    </div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: isActive ? s.color + '22' : s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                    <s.icon size={20} color={s.color} strokeWidth={1.8} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filter bar + table */}
        <Card padding="0">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={uploadsSearch}
                onChange={e => setUploadsSearch(e.target.value)}
                placeholder="Search documents…"
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <SelectField value={uploadsFilterUploader} onChange={e => setUploadsFilterUploader(e.target.value)} style={{ flex: '0 0 155px' }}>
              <option value="">All Uploaders</option>
              {uploaderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterApprover} onChange={e => setUploadsFilterApprover(e.target.value)} style={{ flex: '0 0 155px' }}>
              <option value="">All Approvers</option>
              {approverOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterDept} onChange={e => setUploadsFilterDept(e.target.value)} style={{ flex: '0 0 155px' }}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterStatus} onChange={e => setUploadsFilterStatus(e.target.value)} style={{ flex: '0 0 130px' }}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </SelectField>
            {anyFilter && (
              <button onClick={() => { setUploadsSearch(''); setUploadsFilterStatus(''); setUploadsFilterDept(''); setUploadsFilterUploader(''); setUploadsFilterApprover(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                <X size={11} /> Clear
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {filteredDocs.length} of {totalDocs}
            </div>
          </div>

          {allDocsLoading && (
            <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>Loading documents…</div>
          )}
          {allDocsError && (
            <div style={{ padding: '20px 18px', fontSize: 13, color: '#ef4444' }}>{allDocsError}</div>
          )}

          {!allDocsLoading && !allDocsError && (
            <>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div />
                <div style={{ ...LABEL, padding: '10px 16px 10px 68px' }}>Document</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Uploader</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Status</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Uploaded On</div>
              </div>

              {filteredDocs.length === 0 ? (
                <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
                  No documents match the current filters
                </div>
              ) : filteredDocs.map(doc => {
                const sc = SC[doc.status] || SC.pending;
                const uploaderName = [doc.uploader_first_name, doc.uploader_last_name].filter(Boolean).join(' ') || doc.uploader_username || '—';
                const approverName = doc.latest_approval
                  ? ([doc.latest_approval.approver_first_name, doc.latest_approval.approver_last_name].filter(Boolean).join(' ') || doc.latest_approval.approver_username)
                  : null;
                const uploadedDate = doc.created_at ? doc.created_at.split('T')[0] : '—';
                return (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 60, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Status strip */}
                    <div style={{ background: sc.color, opacity: .7 }} />
                    {/* Document */}
                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color={sc.color} strokeWidth={1.8} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>
                          {doc.document_name || doc.original_filename}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          {doc.document_type_name && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, background: sc.bg, borderRadius: 4, padding: '1px 5px' }}>{doc.document_type_name}</span>
                          )}
                          {doc.department_name && (
                            <span style={{ fontSize: 10, color: 'var(--text-color-secondary)' }}>{doc.department_name}</span>
                          )}
                          {doc.version_no && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', borderRadius: 4, padding: '1px 5px', border: '1px solid var(--surface-border)' }}>v{doc.version_no}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Uploader */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{uploaderName}</div>
                      {doc.uploader_username && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>@{doc.uploader_username}</div>
                      )}
                    </div>
                    {/* Status */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 12, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.05em', width: 'fit-content' }}>
                        {sc.label}
                      </span>
                      {approverName && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', marginTop: 4 }}>
                          {doc.status === 'approved' ? '✓' : '✗'} {approverName}
                        </div>
                      )}
                    </div>
                    {/* Date */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                      {uploadedDate}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Card>
      </div>
    );
  }

  return null;
}

function MultiSelectField({ value = [], onChange, options = [], placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggle(id) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  }

  const selectedOptions = options.filter(o => value.includes(o.id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px 10px 14px', fontFamily: 'var(--font)', fontSize: 13,
        borderRadius: 8, background: 'var(--surface-ground)',
        border: `1px solid ${open ? 'var(--primary)' : 'var(--surface-border)'}`,
        boxShadow: open ? '0 0 0 3px rgba(26,86,219,.1)' : 'none',
        cursor: 'pointer', outline: 'none', textAlign: 'left',
        color: selectedOptions.length ? 'var(--text-color)' : 'var(--text-color-secondary)',
        transition: 'border-color .2s, box-shadow .2s',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOptions.length === 0
            ? placeholder
            : selectedOptions.length === 1
            ? selectedOptions[0].name
            : `${selectedOptions.length} departments selected`}
        </span>
        <ChevronDown size={15} strokeWidth={2} style={{
          flexShrink: 0, color: 'var(--text-color-secondary)',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
        }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 600,
          background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255,255,255,.8)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.95)',
          maxHeight: 200, overflowY: 'auto', animation: 'dropdownIn .15s cubic-bezier(.2,.8,.3,1)',
        }}>
          {options.map(opt => {
            const isChecked = value.includes(opt.id);
            return (
              <div key={opt.id} onMouseDown={() => toggle(opt.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font)',
                color: isChecked ? 'var(--primary)' : 'var(--text-color)',
                fontWeight: isChecked ? 600 : 400, cursor: 'pointer',
                transition: 'background .12s', background: 'transparent',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--surface-border)'}`,
                  background: isChecked ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s, border-color .15s',
                }}>
                  {isChecked && <Check size={9} color="white" strokeWidth={3} />}
                </div>
                {opt.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected tags */}
      {selectedOptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {selectedOptions.map(o => (
            <span key={o.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 6px 3px 10px', borderRadius: 20,
              background: 'rgba(26,86,219,.1)', border: '1px solid rgba(26,86,219,.2)',
              fontSize: 11.5, color: 'var(--primary)', fontWeight: 600,
            }}>
              {o.name}
              <button type="button" onMouseDown={e => { e.stopPropagation(); toggle(o.id); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary)', display: 'flex', padding: '1px',
              }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
