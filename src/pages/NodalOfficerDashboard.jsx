import { useState, useEffect, useMemo } from 'react';
import { Users, CheckCircle, XCircle, Plus, Edit2, X, Eye, EyeOff, Download, Layers, FileText, Clock, Search, Link2, Activity } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import DocViewModal from '../components/DocViewModal';
import { getUsers, getRoles, updateUser, registerUser } from '../services/users';
import { getMyDepartments } from '../services/departments';
import { getAllDocumentsAdmin, getAllDepartmentLinks } from '../services/pdf';
import { getAuditLogs } from '../services/audit';


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

const NODAL_AUDIT_PAGE_SIZE = 20;

const AUDIT_ENTITY_OPTIONS = [
  { value: '',        label: 'All Entities' },
  { value: 'user',   label: 'User' },
  { value: 'pdf',    label: 'PDF' },
  { value: 'system', label: 'System' },
];

function fmtAuditActor(actor) {
  if (!actor) return 'System';
  const full = [actor.first_name, actor.last_name].filter(Boolean).join(' ');
  return full || actor.username || 'Unknown';
}

function fmtAction(action) {
  if (!action) return '—';
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

  // Nodal officer's authorised departments — drives both the user management selectors and the uploads dept filter.
  const [depts, setDepts] = useState([]);

  useEffect(() => {
    if (!['nodalusers', 'nodaluploads', 'nodallinkedocs', 'nodalauditfull'].includes(activePage)) return;
    getMyDepartments()
      .then(res => setDepts(res.data))
      .catch(() => {});
  }, [activePage]);

  // All Uploads state
  const [allDocs, setAllDocs]                             = useState([]);
  const [allDocsLoading, setAllDocsLoading]               = useState(false);
  const [allDocsError, setAllDocsError]                   = useState('');
  const [uploadsSearch, setUploadsSearch]                 = useState('');
  const [uploadsFilterStatus, setUploadsFilterStatus]     = useState('');
  const [uploadsFilterDept, setUploadsFilterDept]         = useState('');
  const [uploadsFilterUploader, setUploadsFilterUploader] = useState('');
  const [uploadsFilterApprover, setUploadsFilterApprover] = useState('');
  const [viewDoc, setViewDoc]                             = useState(null);

  useEffect(() => {
    if (activePage !== 'nodaluploads') return;
    setAllDocsLoading(true);
    setAllDocsError('');
    Promise.all([getAllDocumentsAdmin(), getMyDepartments()])
      .then(([docsRes, deptsRes]) => {
        setAllDocs(docsRes.data.documents || []);
        setDepts(deptsRes.data);
      })
      .catch(() => setAllDocsError('Failed to load documents. Please try again.'))
      .finally(() => setAllDocsLoading(false));
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

  // Linked Documents state (nodal view)
  const [nodalLinks, setNodalLinks]             = useState([]);
  const [nodalLinksLoading, setNodalLinksLoading] = useState(false);
  const [nodalLinksError, setNodalLinksError]   = useState('');
  const [nodalLinksSearch, setNodalLinksSearch] = useState('');
  const [nodalLinksFilterStatus, setNodalLinksFilterStatus] = useState('');
  const [viewingLink, setViewingLink]           = useState(null);

  // Audit Log state 
  const [auditLogs, setAuditLogs]                 = useState([]);
  const [auditTotal, setAuditTotal]               = useState(0);
  const [auditLoading, setAuditLoading]           = useState(false);
  const [auditError, setAuditError]               = useState('');
  const [auditPage, setAuditPage]                 = useState(0);
  const [auditFilterEntity, setAuditFilterEntity] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState('');
  const [auditFromDate, setAuditFromDate]         = useState('');
  const [auditToDate, setAuditToDate]             = useState('');
  const [auditSearch, setAuditSearch]             = useState('');
  // Action-type dropdown options are built only from actions actually seen in
  // fetched pages (never a guessed/hardcoded list) and accumulate across
  // fetches so the list doesn't shrink once you filter down to one action.
  const [seenActionsRaw, setSeenActionsRaw]       = useState([]);
  const auditActionOptions = useMemo(() => Array.from(new Set(seenActionsRaw)).sort(), [seenActionsRaw]);

  useEffect(() => {
    if (activePage !== 'nodalauditfull') return;
    setAuditLoading(true);
    setAuditError('');
    const params = { skip: auditPage * NODAL_AUDIT_PAGE_SIZE, limit: NODAL_AUDIT_PAGE_SIZE };
    if (auditFilterEntity) params.entity_type = auditFilterEntity;
    if (auditFilterAction) params.action       = auditFilterAction;
    if (auditFromDate)     params.from_date    = auditFromDate;
    if (auditToDate)       params.to_date      = auditToDate + 'T23:59:59';
    getAuditLogs(params)
      .then(res => {
        const logs = res.data.logs || [];
        setAuditLogs(logs);
        setAuditTotal(res.data.total || 0);
        setSeenActionsRaw(prev => [...prev, ...logs.map(l => l.action).filter(Boolean)]);
      })
      .catch(() => setAuditError('Failed to load audit logs. Please try again.'))
      .finally(() => setAuditLoading(false));
  }, [activePage, auditPage, auditFilterEntity, auditFilterAction, auditFilterStatus, auditFromDate, auditToDate]);

  useEffect(() => {
    if (activePage !== 'nodallinkedocs') return;
    setNodalLinksLoading(true);
    setNodalLinksError('');
    getAllDepartmentLinks()
      .then(res => setNodalLinks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setNodalLinksError('Failed to load linked documents.'))
      .finally(() => setNodalLinksLoading(false));
  }, [activePage]);

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

  // ── All Uploads (department-scoped) ─────────────────────────────────────
  if (activePage === 'nodaluploads') {
    // Authorised department names set — only docs belonging to these are shown.
    const authorisedDeptNames = new Set(depts.map(d => d.name));

    // Base list: filter to authorised departments only
    const deptScopedDocs = allDocs.filter(d =>
      !authorisedDeptNames.size || authorisedDeptNames.has(d.department_name)
    );

    const totalDocs    = deptScopedDocs.length;
    const approvedDocs = deptScopedDocs.filter(d => d.status === 'approved').length;
    const pendingDocs  = deptScopedDocs.filter(d => d.status === 'pending').length;
    const rejectedDocs = deptScopedDocs.filter(d => d.status === 'rejected').length;

    // Unique uploaders within authorised scope
    const uploaderOptions = [];
    const seenUp = new Set();
    for (const d of deptScopedDocs) {
      if (d.uploader_username && !seenUp.has(d.uploader_username)) {
        seenUp.add(d.uploader_username);
        const label = [d.uploader_first_name, d.uploader_last_name].filter(Boolean).join(' ') || d.uploader_username;
        uploaderOptions.push({ value: d.uploader_username, label });
      }
    }

    // Unique approvers within authorised scope
    const approverOptions = [];
    const seenAp = new Set();
    for (const d of deptScopedDocs) {
      const key = d.latest_approval?.approver_username;
      if (key && !seenAp.has(key)) {
        seenAp.add(key);
        const label = [d.latest_approval.approver_first_name, d.latest_approval.approver_last_name].filter(Boolean).join(' ') || key;
        approverOptions.push({ value: key, label });
      }
    }

    const filteredDocs = deptScopedDocs.filter(d => {
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

    function mapDocForViewer(d) {
      return {
        id:              d.id,
        title:           d.document_name || d.original_filename || 'Untitled',
        type:            d.document_type_name || 'Unclassified',
        dept:            d.department_name || 'Unassigned',
        year:            d.issue_date ? new Date(d.issue_date).getFullYear() : (d.created_at ? new Date(d.created_at).getFullYear() : '—'),
        version:         d.version_no || '1.0',
        status:          d.status || 'pending',
        desc:            d.description || '',
        fileName:        d.original_filename,
        uploadedAt:      d.created_at?.split('T')[0] || '',
        referenceNumber: d.reference_number || null,
        enactmentDate:   d.issue_date?.split('T')[0] || null,
        effectiveFrom:   d.effective_from?.split('T')[0] || null,
        gazette:         d.gazette_reference || null,
        authority:       d.legal_authority || null,
        approval:        d.latest_approval || null,
      };
    }

    const SC = {
      approved: { color: '#16a34a', bg: 'rgba(34,197,94,.1)',  label: 'Approved' },
      pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', label: 'Pending'  },
      rejected: { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  label: 'Rejected' },
    };
    const cols = '4px 1fr 175px 155px 155px 90px';
    const anyFilter = uploadsSearch || uploadsFilterStatus || uploadsFilterDept || uploadsFilterUploader || uploadsFilterApprover;

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        {/* Department scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Layers size={14} color="#0ea5e9" />
            <span>Showing uploads from your authorised departments: <strong>{depts.map(d => d.name).join(' · ')}</strong></span>
          </div>
        )}

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
            {/* Department filter is limited to the nodal officer's authorised departments */}
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
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Dates</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Actions</div>
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
                const uploadedDate   = doc.created_at ? doc.created_at.split('T')[0] : '—';
                const lastActionDate = doc.latest_approval?.acted_at ? doc.latest_approval.acted_at.split('T')[0] : null;
                return (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 62, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ background: sc.color, opacity: .7 }} />
                    {/* Document */}
                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color={sc.color} strokeWidth={1.8} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
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
                    {/* Dates */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-color-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--mono)', marginBottom: 2 }}>Uploaded</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color)' }}>{uploadedDate}</div>
                      </div>
                      {lastActionDate && (
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                            {doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Reviewed'}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: sc.color }}>{lastActionDate}</div>
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => setViewDoc(mapDocForViewer(doc))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(26,86,219,.3)', background: 'rgba(26,86,219,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,86,219,.07)'}>
                        <Eye size={12} /> View
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Card>
      </div>

      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      </>
    );
  }

  // ── Full MIS Report ──────────────────────────────────────────────────────
  if (activePage === 'nodalauditfull') {
    return (
      <div style={{ animation: 'fadeSlideIn .3s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Activity size={14} color="#0ea5e9" />
            <span>Showing audit logs for users in your authorised departments: <strong>{depts.map(d => d.name).join(' · ')}</strong></span>
          </div>
        )}

        {/* Filter bar */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)' }} />
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search user or action…"
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <select value={auditFilterEntity} onChange={e => { setAuditFilterEntity(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)', cursor: 'pointer' }}>
              {AUDIT_ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={auditFilterAction} onChange={e => { setAuditFilterAction(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)', cursor: 'pointer' }}>
              <option value="">All Actions</option>
              {auditActionOptions.map(a => <option key={a} value={a}>{fmtAction(a)}</option>)}
            </select>
            <select value={auditFilterStatus} onChange={e => { setAuditFilterStatus(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)', cursor: 'pointer' }}>
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
            <input type="date" value={auditFromDate} onChange={e => { setAuditFromDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>to</span>
            <input type="date" value={auditToDate} onChange={e => { setAuditToDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            {(auditFilterEntity || auditFilterAction || auditFilterStatus || auditFromDate || auditToDate || auditSearch) && (
              <button onClick={() => { setAuditFilterEntity(''); setAuditFilterAction(''); setAuditFilterStatus(''); setAuditFromDate(''); setAuditToDate(''); setAuditSearch(''); setAuditPage(0); }}
                style={{ height: 34, padding: '0 12px', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={11} /> Clear
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                const visible = auditLogs.filter(l => {
                  if (auditFilterStatus && l.status !== auditFilterStatus) return false;
                  if (auditSearch.trim()) {
                    const q = auditSearch.toLowerCase();
                    if (!fmtAuditActor(l.actor).toLowerCase().includes(q) && !(l.actor?.username || '').toLowerCase().includes(q) && !(l.action || '').toLowerCase().includes(q)) return false;
                  }
                  return true;
                });
                if (!visible.length) return;
                exportCSV(visible.map(l => ({
                  timestamp: l.created_at, user: fmtAuditActor(l.actor), username: l.actor?.username || '',
                  action: l.action, entity_type: l.entity_type, entity_id: l.entity_id ?? '', status: l.status, ip_address: l.ip_address || '',
                })), 'nodal-mis-report.csv');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '0 14px', height: 34, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </Card>

        {/* Table */}
        <Card padding="0">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Department Audit History</div>
            <span style={{ ...LABEL }}>{auditTotal} total entries</span>
          </div>

          {auditLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>Loading audit logs…</div>
          ) : auditError ? (
            <div style={{ padding: 24, color: '#ef4444', fontSize: 13 }}>{auditError}</div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>No audit records found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                  {['Timestamp', 'User', 'Action', 'Entity', 'Status', 'IP Address'].map(h => (
                    <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs
                  .filter(l => {
                    if (auditFilterStatus && l.status !== auditFilterStatus) return false;
                    if (auditSearch.trim()) {
                      const q = auditSearch.toLowerCase();
                      if (!fmtAuditActor(l.actor).toLowerCase().includes(q) && !(l.actor?.username || '').toLowerCase().includes(q) && !(l.action || '').toLowerCase().includes(q)) return false;
                    }
                    return true;
                  })
                  .map(log => {
                    const isSuccess = log.status === 'success';
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{fmtAuditActor(log.actor)}</div>
                          {log.actor?.username && <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>@{log.actor.username}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color)' }}>{fmtAction(log.action)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, padding: '2px 7px', color: 'var(--text-color-secondary)' }}>
                            {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: isSuccess ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: isSuccess ? '#16a34a' : '#ef4444' }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!auditLoading && auditTotal > NODAL_AUDIT_PAGE_SIZE && (() => {
            const totalPages = Math.max(1, Math.ceil(auditTotal / NODAL_AUDIT_PAGE_SIZE));
            return (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ ...LABEL }}>Page {auditPage + 1} of {totalPages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0}
                    style={{ padding: '6px 14px', border: '1px solid var(--surface-border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface-ground)', color: auditPage === 0 ? 'var(--text-color-secondary)' : 'var(--text-color)', cursor: auditPage === 0 ? 'default' : 'pointer', opacity: auditPage === 0 ? 0.5 : 1 }}>
                    Previous
                  </button>
                  <button onClick={() => setAuditPage(p => Math.min(totalPages - 1, p + 1))} disabled={auditPage >= totalPages - 1}
                    style={{ padding: '6px 14px', border: '1px solid var(--surface-border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface-ground)', color: auditPage >= totalPages - 1 ? 'var(--text-color-secondary)' : 'var(--text-color)', cursor: auditPage >= totalPages - 1 ? 'default' : 'pointer', opacity: auditPage >= totalPages - 1 ? 0.5 : 1 }}>
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
    );
  }

  // ── Linked Documents (department-scoped) ────────────────────────────────
  if (activePage === 'nodallinkedocs') {
    const authorisedDeptNames = new Set(depts.map(d => d.name));

    // Scope links to departments the nodal officer manages
    const scopedLinks = authorisedDeptNames.size
      ? nodalLinks.filter(l =>
          authorisedDeptNames.has(l.linked_department_name) ||
          authorisedDeptNames.has(l.original_department_name)
        )
      : nodalLinks;

    const filteredLinks = scopedLinks.filter(l => {
      if (nodalLinksFilterStatus && l.link_status !== nodalLinksFilterStatus) return false;
      if (nodalLinksSearch) {
        const q = nodalLinksSearch.toLowerCase();
        if (
          !(l.document_name || '').toLowerCase().includes(q) &&
          !(l.original_department_name || '').toLowerCase().includes(q) &&
          !(l.linked_department_name || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    const LS = {
      approved: { color: '#16a34a', bg: 'rgba(34,197,94,.1)',  label: 'Approved' },
      pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', label: 'Pending'  },
      rejected: { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  label: 'Rejected' },
    };
    const totals = { all: scopedLinks.length, pending: 0, approved: 0, rejected: 0 };
    scopedLinks.forEach(l => { if (totals[l.link_status] !== undefined) totals[l.link_status]++; });

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {/* Scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Link2 size={14} color="#0ea5e9" />
            <span>Showing links involving your authorised departments: <strong>{depts.map(d => d.name).join(' · ')}</strong></span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Links', value: totals.all,      color: 'var(--primary)', bg: 'rgba(26,86,219,.12)',  icon: Link2,       key: '' },
            { label: 'Approved',    value: totals.approved,  color: '#16a34a',       bg: 'rgba(34,197,94,.12)',  icon: CheckCircle, key: 'approved' },
            { label: 'Pending',     value: totals.pending,   color: '#f59e0b',       bg: 'rgba(245,158,11,.12)', icon: Clock,       key: 'pending'  },
            { label: 'Rejected',    value: totals.rejected,  color: '#ef4444',       bg: 'rgba(239,68,68,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = nodalLinksFilterStatus === s.key && s.key !== '';
            return (
              <Card key={s.label}
                onClick={() => setNodalLinksFilterStatus(f => f === s.key ? '' : s.key)}
                style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                      {nodalLinksLoading ? '–' : s.value}
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

        {/* Filter + table */}
        <Card padding="0">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={nodalLinksSearch}
                onChange={e => setNodalLinksSearch(e.target.value)}
                placeholder="Search by document or department…"
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <select value={nodalLinksFilterStatus} onChange={e => setNodalLinksFilterStatus(e.target.value)}
              style={{ height: 36, padding: '0 10px', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color)', cursor: 'pointer' }}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {(nodalLinksSearch || nodalLinksFilterStatus) && (
              <button onClick={() => { setNodalLinksSearch(''); setNodalLinksFilterStatus(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                <X size={11} /> Clear
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto' }}>
              {filteredLinks.length} of {scopedLinks.length}
            </div>
          </div>

          {nodalLinksLoading && <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>Loading linked documents…</div>}
          {nodalLinksError && <div style={{ padding: '20px 18px', fontSize: 13, color: '#ef4444' }}>{nodalLinksError}</div>}

          {!nodalLinksLoading && !nodalLinksError && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 110px 150px 80px', background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ ...LABEL, padding: '10px 16px' }}>Document</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Original Dept</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Linked-to Dept</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Status</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Requester / Reviewer</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>View</div>
              </div>

              {filteredLinks.length === 0 ? (
                <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>No linked documents match the current filters.</div>
              ) : filteredLinks.map(link => {
                const ls = LS[link.link_status] || LS.pending;
                const requesterName = link.requested_by_first_name
                  ? `${link.requested_by_first_name} ${link.requested_by_last_name || ''}`.trim()
                  : link.requested_by_username || '—';
                const reviewerName = link.reviewed_by_first_name
                  ? `${link.reviewed_by_first_name} ${link.reviewed_by_last_name || ''}`.trim()
                  : link.reviewed_by_username || null;
                return (
                  <div key={link.link_id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 110px 150px 80px', borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 58, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Link2 size={14} color="#d97706" strokeWidth={2} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{link.document_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          {link.document_type_name && <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: 'rgba(245,158,11,.1)', borderRadius: 4, padding: '1px 5px' }}>{link.document_type_name}</span>}
                          {link.version_no && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>v{link.version_no}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{link.original_department_name || '—'}</span>
                    </div>
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{link.linked_department_name || '—'}</span>
                    </div>
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, background: ls.bg, color: ls.color, padding: '3px 10px', borderRadius: 20 }}>{ls.label}</span>
                    </div>
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 1 }}>Requested</span>
                        {requesterName} · <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{link.requested_at?.split('T')[0]}</span>
                      </div>
                      {reviewerName && (
                        <div style={{ fontSize: 12, color: ls.color }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 1 }}>Reviewed</span>
                          {reviewerName} · <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{link.reviewed_at?.split('T')[0]}</span>
                        </div>
                      )}
                    </div>
                    {/* View */}
                    <div style={{ padding: '10px 12px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => setViewingLink({
                          id:         link.pdf_id,
                          title:      link.document_name || 'Document',
                          type:       link.document_type_name || 'Miscellaneous',
                          dept:       link.linked_department_name || link.original_department_name || '',
                          year:       link.requested_at ? new Date(link.requested_at).getFullYear() : '—',
                          version:    link.version_no || '1.0',
                          status:     link.link_status,
                          desc:       '',
                          fileName:   '',
                          uploadedAt: link.requested_at?.split('T')[0] || '',
                          approval:   (link.reviewed_by_username || link.reviewed_by_first_name || link.review_comments) ? {
                            approver_first_name: link.reviewed_by_first_name || null,
                            approver_last_name:  link.reviewed_by_last_name  || null,
                            approver_username:   link.reviewed_by_username   || null,
                            acted_at:            link.reviewed_at            || null,
                            comments:            link.review_comments        || null,
                            annotations_json:    link.annotations_json       || null,
                          } : null,
                        })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(26,86,219,.3)', background: 'rgba(26,86,219,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,86,219,.07)'}>
                        <Eye size={12} /> View
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Card>
      </div>
      {viewingLink && <DocViewModal doc={viewingLink} onClose={() => setViewingLink(null)} />}
      </>
    );
  }

  return null;
}
