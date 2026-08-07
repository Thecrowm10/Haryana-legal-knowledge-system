import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Users, CheckCircle, XCircle, Plus, Edit2, X, Eye, EyeOff, Download, FileSpreadsheet, Layers, FileText, Clock, Search, Link2, Activity } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import MultiSelectField from '../components/ui/MultiSelectField';
import DocViewModal from '../components/DocViewModal';
import { getUsers, getRoles, updateUser, registerUser } from '../services/users';
import { getMyDepartments } from '../services/departments';
import { getAllDocumentsAdmin, getAllDepartmentLinks } from '../services/pdf';
import { getAuditLogs } from '../services/audit';
import { getAllActPartSubmissions, getAllActParts } from '../services/act_parts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { downloadUploadsExcelReport } from '../utils/uploadsExcelReport';


const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

// A nodal officer can only create staff below them (uploader/approver/etc) — never another admin or nodal officer.
// Citizens are public users, not staff accounts — no one creates a "citizen" login from a dashboard.
const NON_ASSIGNABLE_BY_NODAL = new Set(['admin', 'super_admin', 'nodal_officer', 'citizen']);
function normalizeRoleName(name) {
  return name?.trim().toLowerCase().replace(/\s+/g, '_');
}
function assignableRoles(roles) {
  return roles.filter(r => !NON_ASSIGNABLE_BY_NODAL.has(normalizeRoleName(r.name)));
}

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

const NODAL_AUDIT_PAGE_SIZE = 10;

function auditEntityOptions(t) {
  return [
    { value: '',       label: t('audit.entities.all') },
    { value: 'user',   label: t('audit.entities.user') },
    { value: 'pdf',    label: t('audit.entities.pdf') },
    { value: 'system', label: t('audit.entities.system') },
  ];
}

function fmtAuditActor(actor) {
  if (!actor) return 'System';
  const full = [actor.first_name, actor.last_name].filter(Boolean).join(' ');
  return full || actor.username || 'Unknown';
}

function fmtAction(action) {
  if (!action) return '—';
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


// Shared once per return — mirrors the <style> convention used in the other dashboards.
const NOD_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .nod-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
  }
  @media (max-width: 640px) {
    .nod-stats-grid { grid-template-columns: 1fr !important; }
    .nod-form-grid { grid-template-columns: 1fr !important; }
    .nod-drawer { width: 100% !important; }
    .nod-audit-spacer { display: none !important; }
    .nod-export-btn { width: 100% !important; }
    .nod-users-actions { width: 100% !important; }
    .nod-users-actions > * { flex: 1 1 auto !important; min-width: 0 !important; }
    .nod-filter-bar { flex-direction: column !important; align-items: stretch !important; }
    .nod-filter-bar > * { width: 100% !important; flex: 1 1 auto !important; margin-left: 0 !important; }
    .nod-filter-bar button { width: 100% !important; justify-content: center !important; }
  }
`;

export default function NodalOfficerDashboard({ activePage }) {
  const { t } = useTranslation('nodal');
  const isMobile = useMediaQuery('(max-width: 640px)');
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
      .catch(() => setUsersError(t('users.failedToLoadUsers')))
      .finally(() => setUsersLoading(false));
  }, [activePage, t]);

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
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportDeptIds, setReportDeptIds]     = useState([]);
  const [reportGenerating, setReportGenerating] = useState(false);
  const reportPanelRef = useRef(null);

  useEffect(() => {
    if (!showReportPanel) return;
    const close = e => { if (!reportPanelRef.current?.contains(e.target)) setShowReportPanel(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showReportPanel]);

  useEffect(() => {
    if (activePage !== 'nodaluploads') return;
    setAllDocsLoading(true);
    setAllDocsError('');
    Promise.all([getAllDocumentsAdmin(), getMyDepartments()])
      .then(([docsRes, deptsRes]) => {
        setAllDocs(docsRes.data.documents || []);
        setDepts(deptsRes.data);
      })
      .catch(() => setAllDocsError(t('uploads.failedToLoad')))
      .finally(() => setAllDocsLoading(false));
  }, [activePage, t]);

  // Add User drawer state
  const EMPTY_ADD_FORM = { username: '', email: '', mobile_number: '', password: '', first_name: '', last_name: '', role_id: '', department_id: '' };
  const [addingUser, setAddingUser]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState('');
  const [showAddPass, setShowAddPass] = useState(false);

  function handleAddUser() {
    if (!addForm.username.trim())    { setAddError(t('users.errors.usernameRequired')); return; }
    if (!addForm.email.trim())       { setAddError(t('users.errors.emailRequired')); return; }
    if (!addForm.password)           { setAddError(t('users.errors.passwordRequired')); return; }
    if (!addForm.department_id)      { setAddError(t('users.errors.departmentRequired')); return; }
    if (addForm.mobile_number.trim().length !== 10) { setAddError(t('users.errors.mobileRequired')); return; }
    setAddSaving(true);
    setAddError('');
    registerUser({
      username:      addForm.username.trim(),
      email:         addForm.email.trim(),
      mobile_number: addForm.mobile_number.trim(),
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
        setAddError(typeof detail === 'string' ? detail : t('users.errors.createFailed'));
      })
      .finally(() => setAddSaving(false));
  }

  // Edit User modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');
  const [togglingId, setTogglingId]   = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);

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
        setEditError(typeof detail === 'string' ? detail : t('users.errors.saveFailed'));
      })
      .finally(() => setEditSaving(false));
  }

  function handleToggle(u) {
    setConfirmToggleUser(null);
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
  const [viewLinkLoadingId, setViewLinkLoadingId] = useState(null);

  // Maps a full document row (from getAllDocumentsAdmin) into the shape
  // DocViewModal expects — used everywhere a document is opened for viewing
  // so every viewer shows the complete metadata, not just a handful of fields.
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
      shortTitle:      d.short_title || null,
      uploader:        (d.uploader_first_name || d.uploader_last_name)
                          ? `${d.uploader_first_name || ''} ${d.uploader_last_name || ''}`.trim()
                          : (d.uploader_username || null),
      // Extra fields the uploader entered for this specific document type (Act, Policy, etc.)
      typeFields: {
        ...(d.valid_until           ? { validity:           d.valid_until }           : {}),
        ...(d.sector_domain         ? { sector:             d.sector_domain }         : {}),
        ...(d.implementing_agency   ? { implementingAgency: d.implementing_agency }   : {}),
        ...(d.next_review_date      ? { reviewDate:         d.next_review_date }      : {}),
        ...(d.rule_making_authority ? { ruleAuthority:      d.rule_making_authority } : {}),
        ...(d.act_year              ? { actYear:            d.act_year }              : {}),
        ...(d.long_title            ? { longTitle:          d.long_title }            : {}),
        ...(d.regional_title        ? { regionalTitle:      d.regional_title }        : {}),
        ...(d.notification_no       ? { notificationNo:     d.notification_no }       : {}),
        ...(d.act_code              ? { actCode:            d.act_code }              : {}),
        ...(d.so_reason             ? { soReason:           d.so_reason }             : {}),
        ...(d.no_of_rules           ? { noOfRules:          d.no_of_rules }           : {}),
        ...(d.no_of_notifications   ? { noOfNotifications:  d.no_of_notifications }   : {}),
        ...(d.no_of_regulations     ? { noOfRegulations:    d.no_of_regulations }     : {}),
        ...(d.no_of_circulars       ? { noOfCirculars:      d.no_of_circulars }       : {}),
        ...(d.no_of_statutes        ? { noOfStatutes:       d.no_of_statutes }        : {}),
        ...(d.no_of_ordinances      ? { noOfOrdinances:     d.no_of_ordinances }      : {}),
        ...(d.no_of_orders          ? { noOfOrders:         d.no_of_orders }          : {}),
        ...(d.keywords              ? { keywords:           d.keywords }              : {}),
      },
      // Amend / replace / issued-under links to other documents
      docRelations: (d.relationships || [])
        .filter(r => r.type !== 'parent_act')
        .map(r => ({
          label:       (r.type || 'references').replace(/_/g, ' '),
          targetTitle: r.document_name || `Document #${r.pdf_id}`,
          targetType:  r.document_type_name || '',
          note:        '',
          section:     '',
          isPending:   false,
        })),
    };
  }

  // Linked-document rows from /pdf/all-department-links don't carry the full
  // metadata (reference no., gazette, type-specific fields, etc.) — only
  // enough to render the list. Fetch the full document row on demand so the
  // viewer shows everything, same as the main Uploads tab.
  async function openLinkedDocViewer(link) {
    setViewLinkLoadingId(link.link_id);
    const fallback = {
      id: link.pdf_id, title: link.document_name || 'Document', type: link.document_type_name || 'Miscellaneous',
      dept: link.linked_department_name || link.original_department_name || '',
      year: link.requested_at ? new Date(link.requested_at).getFullYear() : '—', version: link.version_no || '1.0',
      status: link.link_status, desc: '', fileName: '', uploadedAt: link.requested_at?.split('T')[0] || '',
      approval: (link.reviewed_by_username || link.reviewed_by_first_name || link.review_comments) ? {
        approver_first_name: link.reviewed_by_first_name || null, approver_last_name: link.reviewed_by_last_name || null,
        approver_username: link.reviewed_by_username || null, acted_at: link.reviewed_at || null,
        comments: link.review_comments || null, annotations_json: link.annotations_json || null,
      } : null,
    };
    try {
      const res = await getAllDocumentsAdmin();
      const full = (res.data.documents || []).find(d => d.id === link.pdf_id);
      setViewingLink(full ? mapDocForViewer(full) : fallback);
    } catch {
      setViewingLink(fallback);
    } finally {
      setViewLinkLoadingId(null);
    }
  }

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
      .catch(() => setAuditError(t('audit.failedToLoad')))
      .finally(() => setAuditLoading(false));
  }, [activePage, auditPage, auditFilterEntity, auditFilterAction, auditFilterStatus, auditFromDate, auditToDate, t]);

  useEffect(() => {
    if (activePage !== 'nodallinkedocs') return;
    setNodalLinksLoading(true);
    setNodalLinksError('');
    getAllDepartmentLinks()
      .then(res => setNodalLinks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setNodalLinksError(t('linkedDocs.failedToLoad')))
      .finally(() => setNodalLinksLoading(false));
  }, [activePage, t]);

  const [deptFilter, setDeptFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');

  // ── Act Parts (view-only) state ─────────────────────────────────────────
  const [actPartsItems, setActPartsItems]     = useState([]);
  const [actPartsLoading, setActPartsLoading] = useState(false);
  const [actPartsError, setActPartsError]     = useState('');
  const [actPartsViewing, setActPartsViewing] = useState(null); // { item, partsData }
  const [actPartsDetailLoading, setActPartsDetailLoading] = useState(false);
  const [actPartsStatusFilter, setActPartsStatusFilter]   = useState('');

  useEffect(() => {
    if (activePage !== 'nodalactparts') return;
    setActPartsLoading(true);
    setActPartsError('');
    getAllActPartSubmissions()
      .then(res => setActPartsItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setActPartsError(t('actParts.failedToLoad')))
      .finally(() => setActPartsLoading(false));
  }, [activePage, t]);

  async function openActPartsDetail(item) {
    setActPartsDetailLoading(true);
    try {
      const res = await getAllActParts(item.pdf_document_id);
      setActPartsViewing({ item, partsData: res.data });
    } catch {
      setActPartsViewing({ item, partsData: null });
    } finally {
      setActPartsDetailLoading(false);
    }
  }

  // ── User Management ─────────────────────────────────────────────────────
  if (activePage === 'nodalusers') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

    const filteredUsers = users
      .filter(u => !deptFilter || u.deptIds.map(String).includes(String(deptFilter)))
      .filter(u => !usersStatusFilter || u.status === usersStatusFilter);

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
        <style>{NOD_RESPONSIVE_CSS}</style>
        <div className="nod-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: t('users.stats.totalUsers'), value: users.length, color: 'var(--primary)',  bg: 'rgba(33, 74, 171,.12)',  icon: Users,      key: '' },
            { label: t('users.stats.active'),      value: active,       color: '#198754',         bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'active' },
            { label: t('users.stats.inactive'),    value: inactive,     color: '#b45309',         bg: 'rgba(255, 193, 7,.12)', icon: XCircle,     key: 'inactive' },
          ].map(s => {
            const isActive = usersStatusFilter === s.key;
            return (
              <Card key={s.label}
                onClick={() => setUsersStatusFilter(f => f === s.key ? '' : s.key)}
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
            );
          })}
        </div>

        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('users.systemUsers')}</div>
            <div className="nod-users-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SelectField value={deptFilter} onChange={e => setDeptFilter(e.target.value)} placeholder={t('users.allDepartments')} style={{ width: 200, maxWidth: '100%' }}>
                <option value="">{t('users.allDepartments')}</option>
                {depts.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectField>
              <button
                onClick={() => { setAddingUser(true); setAddError(''); setAddForm({ ...EMPTY_ADD_FORM, department_id: deptFilter }); setShowAddPass(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Plus size={13} /> {t('users.addUser')}
              </button>
            </div>
          </div>
          {usersLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
              {t('users.loadingUsers')}
            </div>
          )}
          {usersError && (
            <div style={{ padding: '20px 18px', fontSize: 13, color: '#dc3545' }}>
              {usersError}
            </div>
          )}
          {!usersLoading && !usersError && filteredUsers.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
              {t('users.noActiveUsers')}
            </div>
          )}
          {!usersLoading && !usersError && filteredUsers.length > 0 && (
            isMobile ? (
              <div>
                {filteredUsers.map(u => (
                  <div key={u.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2 }}>{u.email}</div>
                      </div>
                      <Badge label={u.role} variant={u.role} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                      <span style={{ fontFamily: 'var(--mono)' }}>@{u.username}</span>
                      <span>{u.dept}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: u.status === 'active' ? '#1e40af' : '#b45309' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? '#198754' : '#ffc107', display: 'inline-block' }} />
                        {u.status}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)' }}>{u.lastLogin}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button title={t('users.edit')} onClick={() => openEdit(u)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>
                        <Edit2 size={12} /> {t('users.edit')}
                      </button>
                      <button
                        title={u.isActive ? t('users.deactivate') : t('users.activate')}
                        disabled={togglingId === u.id}
                        onClick={() => setConfirmToggleUser(u)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: u.isActive ? 'rgba(220, 53, 69,.08)' : 'rgba(25, 135, 84,.08)', border: `1px solid ${u.isActive ? 'rgba(220, 53, 69,.2)' : 'rgba(25, 135, 84,.2)'}`, borderRadius: 7, padding: '7px 10px', cursor: togglingId === u.id ? 'not-allowed' : 'pointer', color: u.isActive ? '#dc3545' : '#198754', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)', opacity: togglingId === u.id ? 0.5 : 1 }}>
                        {u.isActive ? <XCircle size={12} /> : <CheckCircle size={12} />} {u.isActive ? t('users.deactivate') : t('users.activate')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
          <div className="table-scroll-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {[t('users.headers.name'), t('users.headers.username'), t('users.headers.role'), t('users.headers.department'), t('users.headers.status'), t('users.headers.lastLogin'), t('users.headers.actions')].map((h, i) => (
                  <th key={h} scope="col" style={{ ...LABEL, padding: '11px 16px', textAlign: 'left', ...(i > 0 && { borderLeft: '1px solid var(--surface-border)' }) }}>{h}</th>
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
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.username}</td>
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}><Badge label={u.role} variant={u.role} /></td>
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{u.dept}</td>
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: u.status === 'active' ? '#1e40af' : '#b45309' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.status === 'active' ? '#198754' : '#ffc107', display: 'inline-block' }} />
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{u.lastLogin}</td>
                  <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button title={t('users.edit')} onClick={() => openEdit(u)}
                        style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--primary)', display: 'flex' }}>
                        <Edit2 size={12} />
                      </button>
                      <button
                        title={u.isActive ? t('users.deactivate') : t('users.activate')}
                        disabled={togglingId === u.id}
                        onClick={() => setConfirmToggleUser(u)}
                        style={{ background: u.isActive ? 'rgba(220, 53, 69,.08)' : 'rgba(25, 135, 84,.08)', border: `1px solid ${u.isActive ? 'rgba(220, 53, 69,.2)' : 'rgba(25, 135, 84,.2)'}`, borderRadius: 6, padding: '5px 8px', cursor: togglingId === u.id ? 'not-allowed' : 'pointer', color: u.isActive ? '#dc3545' : '#198754', display: 'flex', opacity: togglingId === u.id ? 0.5 : 1 }}>
                        {u.isActive ? <XCircle size={12} /> : <CheckCircle size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
            )
          )}
        </Card>

        {/* Add User Drawer */}
        {addingUser && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }} />
            <div className="nod-drawer" style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
              background: 'var(--surface-card)', boxShadow: '-4px 0 40px rgba(0,0,0,.18)',
              zIndex: 301, display: 'flex', flexDirection: 'column',
              animation: 'drawerSlideIn .28s cubic-bezier(.22,1,.36,1)',
            }}>

              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('users.addDrawer.title')}</div>
                  <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: 1 }}>{t('users.addDrawer.subtitle')}</div>
                </div>
                <button onClick={() => setAddingUser(false)}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Role + Department */}
                <div className="nod-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="nod-add-role" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.role')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <SelectField
                      id="nod-add-role"
                      required
                      value={addForm.role_id}
                      onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value, department_id: '' }))}
                      placeholder={t('users.addDrawer.roleSelectPlaceholder')}
                    >
                      {assignableRoles(roles).map(r => (
                        <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label htmlFor="nod-add-department" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.department')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <SelectField id="nod-add-department" required value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value }))} placeholder={t('users.addDrawer.departmentSelectPlaceholder')}>
                      {depts.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </SelectField>
                  </div>
                </div>

                {/* Username + Email */}
                <div className="nod-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="nod-add-username" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.username')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="nod-add-username" style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('username') ? 'rgba(220, 53, 69,.6)' : undefined }}
                      placeholder={t('users.addDrawer.usernamePlaceholder')}
                      autoComplete="off"
                      value={addForm.username}
                      onChange={e => { setAddForm(f => ({ ...f, username: e.target.value })); setAddError(''); }} />
                  </div>
                  <div>
                    <label htmlFor="nod-add-email" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.email')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="nod-add-email" style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('email') ? 'rgba(220, 53, 69,.6)' : undefined }}
                      type="email" placeholder={t('users.addDrawer.emailPlaceholder')}
                      autoComplete="off"
                      value={addForm.email}
                      onChange={e => { setAddForm(f => ({ ...f, email: e.target.value })); setAddError(''); }} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="nod-add-password" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.password')} <span style={{ color: '#dc3545' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="nod-add-password"
                      style={{ ...INP_STYLE, paddingRight: 38, borderColor: addError.toLowerCase().includes('password') ? 'rgba(220, 53, 69,.6)' : undefined }}
                      type={showAddPass ? 'text' : 'password'}
                      placeholder={t('users.addDrawer.passwordPlaceholder')}
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
                <div className="nod-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="nod-add-firstname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.firstName')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="nod-add-firstname" style={INP_STYLE} placeholder={t('users.addDrawer.firstNamePlaceholder')}
                      value={addForm.first_name}
                      onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="nod-add-lastname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.lastName')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="nod-add-lastname" style={INP_STYLE} placeholder={t('users.addDrawer.lastNamePlaceholder')}
                      value={addForm.last_name}
                      onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label htmlFor="nod-add-mobile" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.mobileNumber')} <span style={{ color: '#dc3545' }}>*</span></label>
                  <input id="nod-add-mobile" style={INP_STYLE}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t('users.addDrawer.mobilePlaceholder')}
                    value={addForm.mobile_number}
                    onChange={e => setAddForm(f => ({ ...f, mobile_number: e.target.value.replace(/\D/g, '') }))} />
                </div>

                {addError && (
                  <div style={{ padding: '9px 12px', background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', borderRadius: 8, fontSize: 12.5, color: '#dc3545', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span>⚠</span> {addError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setAddingUser(false)}
                  style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                  {t('users.addDrawer.cancel')}
                </button>
                {(() => {
                  const addFormInvalid = !addForm.role_id || !addForm.department_id
                    || !addForm.username.trim() || !addForm.email.trim() || !addForm.password
                    || !addForm.first_name.trim() || !addForm.last_name.trim()
                    || addForm.mobile_number.trim().length !== 10;
                  const addBtnDisabled = addSaving || addFormInvalid;
                  return (
                    <button
                      onClick={() => { if (addFormInvalid) { setAddError(t('users.errors.fillMandatory')); return; } handleAddUser(); }}
                      disabled={addSaving}
                      style={{ padding: '9px 20px', background: addBtnDisabled ? 'var(--surface-border)' : 'var(--primary)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: addSaving ? 'not-allowed' : 'pointer', color: addBtnDisabled ? 'var(--text-color-secondary)' : 'white', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7 }}>
                      {addSaving
                        ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> {t('users.addDrawer.creating')}</>
                        : <><Plus size={13} /> {t('users.addDrawer.createUser')}</>
                      }
                    </button>
                  );
                })()}
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
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('users.editModal.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>{editingUser.username}</div>
                </div>
                <button onClick={() => setEditingUser(null)}
                  style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '6px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div className="nod-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="nod-edit-firstname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.firstName')}</label>
                    <input id="nod-edit-firstname" style={INP_STYLE} value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="nod-edit-lastname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.lastName')}</label>
                    <input id="nod-edit-lastname" style={INP_STYLE} value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label htmlFor="nod-edit-email" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.email')}</label>
                  <input id="nod-edit-email" style={INP_STYLE} type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="nod-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.role')}</label>
                    <div style={{ ...INP_STYLE, background: 'var(--surface-hover)', color: 'var(--text-color-secondary)', cursor: 'not-allowed' }}>
                      {editingUser.role.replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="nod-edit-department" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.department')}</label>
                    <SelectField id="nod-edit-department" value={editForm.department_id ?? ''} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value || null }))} placeholder={t('users.editModal.selectDepartment')}>
                      {depts.filter(d => d.is_active !== false).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                {/* Active status toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-ground)', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 600, color: 'var(--text-heading)' }}>{t('users.editModal.accountStatus')}</div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: 2 }}>
                      {editForm.is_active ? t('users.editModal.canLogin') : t('users.editModal.blocked')}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: editForm.is_active ? '#198754' : 'var(--surface-border)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', left: editForm.is_active ? 23 : 3, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
                  </button>
                </div>

                {editError && (
                  <div style={{ padding: '9px 12px', background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', borderRadius: 8, fontSize: 12.5, color: '#dc3545', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span>⚠</span> {editError}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setEditingUser(null)}
                  style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                  {t('users.editModal.cancel')}
                </button>
                {(() => {
                  const editBtnDisabled = editSaving || !(editForm.email || '').trim();
                  return (
                    <button onClick={handleEditSave} disabled={editBtnDisabled}
                      style={{ padding: '9px 20px', background: editBtnDisabled ? 'var(--surface-border)' : 'var(--primary)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: editBtnDisabled ? 'not-allowed' : 'pointer', color: editBtnDisabled ? 'var(--text-color-secondary)' : 'white', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7 }}>
                      {editSaving
                        ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> {t('users.editModal.saving')}</>
                        : t('users.editModal.saveChanges')
                      }
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Activate/Deactivate Confirm Modal */}
        {confirmToggleUser && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setConfirmToggleUser(null); }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }} />
            <div style={{
              position: 'relative', zIndex: 1,
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 16,
              width: 'clamp(300px, 90vw, 420px)',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
              padding: '22px',
            }}>
              <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>
                {confirmToggleUser.isActive ? t('users.confirmToggle.deactivateTitle') : t('users.confirmToggle.activateTitle')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                {confirmToggleUser.isActive
                  ? <Trans t={t} i18nKey="users.confirmToggle.confirmDeactivate" values={{ name: confirmToggleUser.name }} components={[<strong key="s" style={{ color: 'var(--text-heading)' }} />]} />
                  : <Trans t={t} i18nKey="users.confirmToggle.confirmActivate" values={{ name: confirmToggleUser.name }} components={[<strong key="s" style={{ color: 'var(--text-heading)' }} />]} />}
                {confirmToggleUser.isActive && ' ' + t('users.confirmToggle.loginBlockedNote')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmToggleUser(null)}
                  style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                  {t('users.confirmToggle.cancel')}
                </button>
                <button onClick={() => handleToggle(confirmToggleUser)}
                  style={{ padding: '9px 20px', background: confirmToggleUser.isActive ? '#dc3545' : '#198754', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'white', fontFamily: 'var(--font)' }}>
                  {confirmToggleUser.isActive ? t('users.confirmToggle.deactivate') : t('users.confirmToggle.activate')}
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

    // Uploader/Approver options are further scoped to the selected department (within
    // the officer's authorised departments) — pick a department first and only that
    // department's people show up; "All Departments" shows everyone in scope.
    const deptScopedForOptions = uploadsFilterDept ? deptScopedDocs.filter(d => d.department_name === uploadsFilterDept) : deptScopedDocs;

    // Unique uploaders within authorised scope
    const uploaderOptions = [];
    const seenUp = new Set();
    for (const d of deptScopedForOptions) {
      if (d.uploader_username && !seenUp.has(d.uploader_username)) {
        seenUp.add(d.uploader_username);
        const label = [d.uploader_first_name, d.uploader_last_name].filter(Boolean).join(' ') || d.uploader_username;
        uploaderOptions.push({ value: d.uploader_username, label });
      }
    }

    // Unique approvers within authorised scope
    const approverOptions = [];
    const seenAp = new Set();
    for (const d of deptScopedForOptions) {
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

    const SC = {
      approved: { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)',  label: t('uploads.stats.approved') },
      pending:  { color: '#b45309', bg: 'rgba(255, 193, 7,.1)', label: t('uploads.stats.pending')  },
      rejected: { color: '#dc3545', bg: 'rgba(220, 53, 69,.1)',  label: t('uploads.stats.rejected') },
    };
    const cols = '4px 1fr 175px 155px 155px 90px';
    const anyFilter = uploadsSearch || uploadsFilterStatus || uploadsFilterDept || uploadsFilterUploader || uploadsFilterApprover;

    async function handleDownloadReport() {
      setReportGenerating(true);
      try {
        const selectedNames = depts.filter(d => reportDeptIds.includes(d.id)).map(d => d.name);
        await downloadUploadsExcelReport({ docs: deptScopedDocs, departments: selectedNames, fileLabel: 'Nodal' });
        setShowReportPanel(false);
        setReportDeptIds([]);
      } finally {
        setReportGenerating(false);
      }
    }

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{NOD_RESPONSIVE_CSS}</style>

        {/* Department scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Layers size={14} color="#0ea5e9" />
            <span><Trans t={t} i18nKey="uploads.scopeNotice" values={{ depts: depts.map(d => d.name).join(' · ') }} components={[<strong key="s" />]} /></span>
          </div>
        )}

        {/* Stats */}
        <div className="nod-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('uploads.stats.totalUploads'), value: totalDocs,    color: 'var(--primary)', bg: 'rgba(33, 74, 171,.12)',  icon: Layers,      key: '' },
            { label: t('uploads.stats.approved'),      value: approvedDocs, color: '#16a34a',        bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'approved' },
            { label: t('uploads.stats.pending'),       value: pendingDocs,  color: '#b45309',        bg: 'rgba(255, 193, 7,.12)', icon: Clock,       key: 'pending'  },
            { label: t('uploads.stats.rejected'),      value: rejectedDocs, color: '#dc3545',        bg: 'rgba(220, 53, 69,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = uploadsFilterStatus === s.key;
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
          <div className="nod-filter-bar" style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={uploadsSearch}
                onChange={e => setUploadsSearch(e.target.value)}
                placeholder={t('uploads.searchPlaceholder')}
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {/* Department filter is limited to the nodal officer's authorised departments */}
            <SelectField value={uploadsFilterDept} onChange={e => { setUploadsFilterDept(e.target.value); setUploadsFilterUploader(''); setUploadsFilterApprover(''); }} style={{ flex: '0 0 155px' }}>
              <option value="">{t('uploads.allDepartments')}</option>
              {depts.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterUploader} onChange={e => setUploadsFilterUploader(e.target.value)} style={{ flex: '0 0 155px' }}>
              <option value="">{t('uploads.allUploaders')}</option>
              {uploaderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterApprover} onChange={e => setUploadsFilterApprover(e.target.value)} style={{ flex: '0 0 155px' }}>
              <option value="">{t('uploads.allApprovers')}</option>
              {approverOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <SelectField value={uploadsFilterStatus} onChange={e => setUploadsFilterStatus(e.target.value)} style={{ flex: '0 0 130px' }}>
              <option value="">{t('uploads.allStatuses')}</option>
              <option value="pending">{t('uploads.statusPending')}</option>
              <option value="approved">{t('uploads.statusApproved')}</option>
              <option value="rejected">{t('uploads.statusRejected')}</option>
            </SelectField>
            {anyFilter && (
              <button onClick={() => { setUploadsSearch(''); setUploadsFilterStatus(''); setUploadsFilterDept(''); setUploadsFilterUploader(''); setUploadsFilterApprover(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                <X size={11} /> {t('uploads.clear')}
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {t('uploads.countOf', { shown: filteredDocs.length, total: totalDocs })}
            </div>

            <div ref={reportPanelRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowReportPanel(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <FileSpreadsheet size={13} /> {t('uploads.report.button')}
              </button>

              {showReportPanel && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 620, width: 300,
                  background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 12,
                  boxShadow: '0 12px 32px rgba(0,0,0,.14)', padding: 16, animation: 'dropdownIn .15s cubic-bezier(.2,.8,.3,1)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>{t('uploads.report.panelTitle')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{t('uploads.report.panelDesc')}</div>
                  <MultiSelectField
                    id="nod-report-dept-multi"
                    value={reportDeptIds}
                    onChange={setReportDeptIds}
                    options={depts}
                    placeholder={t('uploads.report.allDepartmentsPlaceholder')}
                    selectedLabel={count => t('multiSelect.departmentsSelected', { count })}
                  />
                  <button onClick={handleDownloadReport} disabled={reportGenerating}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14,
                      background: reportGenerating ? 'var(--surface-ground)' : 'var(--primary)', color: reportGenerating ? 'var(--text-color-secondary)' : '#fff',
                      border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, fontWeight: 700,
                      cursor: reportGenerating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                    }}>
                    <Download size={13} /> {reportGenerating ? t('uploads.report.generating') : t('uploads.report.downloadButton')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {allDocsLoading && (
            <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('uploads.loadingDocuments')}</div>
          )}
          {allDocsError && (
            <div style={{ padding: '20px 18px', fontSize: 13, color: '#dc3545' }}>{allDocsError}</div>
          )}

          {!allDocsLoading && !allDocsError && (
            filteredDocs.length === 0 ? (
              <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>
                {t('uploads.noMatch')}
              </div>
            ) : isMobile ? (
              <div>
                {filteredDocs.map(doc => {
                  const sc = SC[doc.status] || SC.pending;
                  const uploaderName = [doc.uploader_first_name, doc.uploader_last_name].filter(Boolean).join(' ') || doc.uploader_username || '—';
                  const uploadedDate = doc.created_at ? doc.created_at.split('T')[0] : '—';
                  return (
                    <div key={doc.id} style={{ padding: '12px 14px', borderLeft: `3px solid ${sc.color}`, borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={15} color={sc.color} strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.document_name || doc.original_filename}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                            {doc.document_type_name && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, background: sc.bg, borderRadius: 4, padding: '1px 5px' }}>{doc.document_type_name}</span>
                            )}
                            {doc.department_name && (
                              <span style={{ fontSize: 10, color: 'var(--text-color-secondary)' }}>{doc.department_name}</span>
                            )}
                          </div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 9.5, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 12, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0 }}>
                          {sc.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text-color-secondary)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploaderName}</span>
                        <span style={{ fontFamily: 'var(--mono)', flexShrink: 0 }}>{uploadedDate}</span>
                      </div>
                      <button onClick={() => setViewDoc(mapDocForViewer(doc))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Eye size={13} /> {t('uploads.view')}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="table-scroll-wrap">
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: cols, minWidth: 830, background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div />
                <div style={{ ...LABEL, padding: '10px 16px 10px 68px' }}>{t('uploads.headers.document')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('uploads.headers.uploader')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('uploads.headers.status')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('uploads.headers.dates')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('uploads.headers.actions')}</div>
              </div>

              {filteredDocs.map(doc => {
                const sc = SC[doc.status] || SC.pending;
                const uploaderName = [doc.uploader_first_name, doc.uploader_last_name].filter(Boolean).join(' ') || doc.uploader_username || '—';
                const approverName = doc.latest_approval
                  ? ([doc.latest_approval.approver_first_name, doc.latest_approval.approver_last_name].filter(Boolean).join(' ') || doc.latest_approval.approver_username)
                  : null;
                const uploadedDate   = doc.created_at ? doc.created_at.split('T')[0] : '—';
                const lastActionDate = doc.latest_approval?.acted_at ? doc.latest_approval.acted_at.split('T')[0] : null;
                return (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: cols, minWidth: 830, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 62, transition: 'background .15s' }}
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
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-color-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--mono)', marginBottom: 2 }}>{t('uploads.uploaded')}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color)' }}>{uploadedDate}</div>
                      </div>
                      {lastActionDate && (
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                            {doc.status === 'approved' ? t('uploads.approvedLabel') : doc.status === 'rejected' ? t('uploads.rejectedLabel') : t('uploads.reviewedLabel')}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: sc.color }}>{lastActionDate}</div>
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => setViewDoc(mapDocForViewer(doc))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.07)'}>
                        <Eye size={12} /> {t('uploads.view')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )
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
        <style>{NOD_RESPONSIVE_CSS}</style>

        {/* Scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Activity size={14} color="#0ea5e9" />
            <span><Trans t={t} i18nKey="audit.scopeNotice" values={{ depts: depts.map(d => d.name).join(' · ') }} components={[<strong key="s" />]} /></span>
          </div>
        )}

        {/* Filter bar */}
        <Card>
          <div className="nod-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)' }} />
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder={t('audit.searchPlaceholder')}
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <SelectField value={auditFilterEntity} onChange={e => { setAuditFilterEntity(e.target.value); setAuditPage(0); }} style={{ flex: '0 0 155px' }}>
              {auditEntityOptions(t).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <SelectField value={auditFilterAction} onChange={e => { setAuditFilterAction(e.target.value); setAuditPage(0); }} style={{ flex: '0 0 155px' }}>
              <option value="">{t('audit.allActions')}</option>
              {auditActionOptions.map(a => <option key={a} value={a}>{fmtAction(a)}</option>)}
            </SelectField>
            <SelectField value={auditFilterStatus} onChange={e => { setAuditFilterStatus(e.target.value); setAuditPage(0); }} style={{ flex: '0 0 130px' }}>
              <option value="">{t('audit.allStatuses')}</option>
              <option value="success">{t('audit.success')}</option>
              <option value="failure">{t('audit.failure')}</option>
            </SelectField>
            <input type="date" value={auditFromDate} onChange={e => { setAuditFromDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{t('audit.to')}</span>
            <input type="date" value={auditToDate} onChange={e => { setAuditToDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            {(auditFilterEntity || auditFilterAction || auditFilterStatus || auditFromDate || auditToDate || auditSearch) && (
              <button onClick={() => { setAuditFilterEntity(''); setAuditFilterAction(''); setAuditFilterStatus(''); setAuditFromDate(''); setAuditToDate(''); setAuditSearch(''); setAuditPage(0); }}
                style={{ height: 34, padding: '0 12px', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={11} /> {t('audit.clear')}
              </button>
            )}
            <div className="nod-audit-spacer" style={{ flex: 1 }} />
            <button className="nod-export-btn"
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '0 14px', height: 34, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> {t('audit.exportCsv')}
            </button>
          </div>
        </Card>

        {/* Table */}
        <Card padding="0">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('audit.heading')}</div>
            <span style={{ ...LABEL }}>{t('audit.totalEntries', { count: auditTotal })}</span>
          </div>

          {auditLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('audit.loading')}</div>
          ) : auditError ? (
            <div style={{ padding: 24, color: '#dc3545', fontSize: 13 }}>{auditError}</div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('audit.noRecords')}</div>
          ) : (() => {
            const filteredLogs = auditLogs.filter(l => {
              if (auditFilterStatus && l.status !== auditFilterStatus) return false;
              if (auditSearch.trim()) {
                const q = auditSearch.toLowerCase();
                if (!fmtAuditActor(l.actor).toLowerCase().includes(q) && !(l.actor?.username || '').toLowerCase().includes(q) && !(l.action || '').toLowerCase().includes(q)) return false;
              }
              return true;
            });
            return isMobile ? (
              <div>
                {filteredLogs.map(log => {
                  const isSuccess = log.status === 'success';
                  return (
                    <div key={log.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{fmtAuditActor(log.actor)}</div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: isSuccess ? 'rgba(25, 135, 84,.1)' : 'rgba(220, 53, 69,.1)', color: isSuccess ? '#16a34a' : '#dc3545', flexShrink: 0 }}>
                          {isSuccess ? t('audit.success') : t('audit.failure')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-color)' }}>{fmtAction(log.action)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--text-color-secondary)' }}>
                        <span style={{ fontFamily: 'var(--mono)' }}>{new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        <span style={{ fontFamily: 'var(--mono)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, padding: '1px 6px' }}>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
                        {log.ip_address && <span style={{ fontFamily: 'var(--mono)' }}>{log.ip_address}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="table-scroll-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                  {[t('audit.headers.timestamp'), t('audit.headers.user'), t('audit.headers.action'), t('audit.headers.entity'), t('audit.headers.status'), t('audit.headers.ipAddress')].map((h, i) => (
                    <th key={h} scope="col" style={{ ...LABEL, padding: '11px 16px', textAlign: 'left', ...(i > 0 && { borderLeft: '1px solid var(--surface-border)' }) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                    const isSuccess = log.status === 'success';
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{fmtAuditActor(log.actor)}</div>
                          {log.actor?.username && <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>@{log.actor.username}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 12.5, color: 'var(--text-color)' }}>{fmtAction(log.action)}</td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, padding: '2px 7px', color: 'var(--text-color-secondary)' }}>
                            {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px', background: isSuccess ? 'rgba(25, 135, 84,.1)' : 'rgba(220, 53, 69,.1)', color: isSuccess ? '#16a34a' : '#dc3545' }}>
                            {isSuccess ? t('audit.success') : t('audit.failure')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            </div>
            );
          })()}

          {/* Pagination */}
          {!auditLoading && auditTotal > NODAL_AUDIT_PAGE_SIZE && (() => {
            const totalPages = Math.max(1, Math.ceil(auditTotal / NODAL_AUDIT_PAGE_SIZE));
            return (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ ...LABEL }}>{t('audit.pageOf', { page: auditPage + 1, total: totalPages })}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0}
                    style={{ padding: '6px 14px', border: '1px solid var(--surface-border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface-ground)', color: auditPage === 0 ? 'var(--text-color-secondary)' : 'var(--text-color)', cursor: auditPage === 0 ? 'default' : 'pointer', opacity: auditPage === 0 ? 0.5 : 1 }}>
                    {t('audit.previous')}
                  </button>
                  <button onClick={() => setAuditPage(p => Math.min(totalPages - 1, p + 1))} disabled={auditPage >= totalPages - 1}
                    style={{ padding: '6px 14px', border: '1px solid var(--surface-border)', borderRadius: 7, fontSize: 12.5, background: 'var(--surface-ground)', color: auditPage >= totalPages - 1 ? 'var(--text-color-secondary)' : 'var(--text-color)', cursor: auditPage >= totalPages - 1 ? 'default' : 'pointer', opacity: auditPage >= totalPages - 1 ? 0.5 : 1 }}>
                    {t('audit.next')}
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
      approved: { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)',  label: t('linkedDocs.statusApproved') },
      pending:  { color: '#b45309', bg: 'rgba(255, 193, 7,.1)', label: t('linkedDocs.statusPending')  },
      rejected: { color: '#dc3545', bg: 'rgba(220, 53, 69,.1)',  label: t('linkedDocs.statusRejected') },
    };
    const totals = { all: scopedLinks.length, pending: 0, approved: 0, rejected: 0 };
    scopedLinks.forEach(l => { if (totals[l.link_status] !== undefined) totals[l.link_status]++; });

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{NOD_RESPONSIVE_CSS}</style>
        {/* Scope notice */}
        {depts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', fontSize: 12.5, color: '#0369a1' }}>
            <Link2 size={14} color="#0ea5e9" />
            <span><Trans t={t} i18nKey="linkedDocs.scopeNotice" values={{ depts: depts.map(d => d.name).join(' · ') }} components={[<strong key="s" />]} /></span>
          </div>
        )}

        {/* Stats */}
        <div className="nod-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('linkedDocs.stats.totalLinks'), value: totals.all,      color: 'var(--primary)', bg: 'rgba(33, 74, 171,.12)',  icon: Link2,       key: '' },
            { label: t('linkedDocs.stats.approved'),    value: totals.approved,  color: '#16a34a',       bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'approved' },
            { label: t('linkedDocs.stats.pending'),     value: totals.pending,   color: '#b45309',       bg: 'rgba(255, 193, 7,.12)', icon: Clock,       key: 'pending'  },
            { label: t('linkedDocs.stats.rejected'),    value: totals.rejected,  color: '#dc3545',       bg: 'rgba(220, 53, 69,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = nodalLinksFilterStatus === s.key;
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
          <div className="nod-filter-bar" style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={nodalLinksSearch}
                onChange={e => setNodalLinksSearch(e.target.value)}
                placeholder={t('linkedDocs.searchPlaceholder')}
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <SelectField value={nodalLinksFilterStatus} onChange={e => setNodalLinksFilterStatus(e.target.value)} style={{ flex: '0 0 150px' }}>
              <option value="">{t('linkedDocs.allStatuses')}</option>
              <option value="pending">{t('linkedDocs.statusPending')}</option>
              <option value="approved">{t('linkedDocs.statusApproved')}</option>
              <option value="rejected">{t('linkedDocs.statusRejected')}</option>
            </SelectField>
            {(nodalLinksSearch || nodalLinksFilterStatus) && (
              <button onClick={() => { setNodalLinksSearch(''); setNodalLinksFilterStatus(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                <X size={11} /> {t('linkedDocs.clear')}
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto' }}>
              {t('linkedDocs.countOf', { shown: filteredLinks.length, total: scopedLinks.length })}
            </div>
          </div>

          {nodalLinksLoading && <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('linkedDocs.loadingDocuments')}</div>}
          {nodalLinksError && <div style={{ padding: '20px 18px', fontSize: 13, color: '#dc3545' }}>{nodalLinksError}</div>}

          {!nodalLinksLoading && !nodalLinksError && (
            filteredLinks.length === 0 ? (
              <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('linkedDocs.noMatch')}</div>
            ) : isMobile ? (
              <div>
                {filteredLinks.map(link => {
                  const ls = LS[link.link_status] || LS.pending;
                  const requesterName = link.requested_by_first_name
                    ? `${link.requested_by_first_name} ${link.requested_by_last_name || ''}`.trim()
                    : link.requested_by_username || '—';
                  return (
                    <div key={link.link_id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255, 193, 7,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Link2 size={14} color="#d97706" strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.document_name}</div>
                          {link.document_type_name && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: 'rgba(255, 193, 7,.1)', borderRadius: 4, padding: '1px 5px', marginTop: 3, display: 'inline-block' }}>{link.document_type_name}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: ls.bg, color: ls.color, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>{ls.label}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                        {link.original_department_name || '—'} <span style={{ opacity: .5 }}>→</span> <strong style={{ color: 'var(--text-heading)' }}>{link.linked_department_name || '—'}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>
                        {t('linkedDocs.requestedBy', { name: requesterName })} · <span style={{ fontFamily: 'var(--mono)' }}>{link.requested_at?.split('T')[0]}</span>
                      </div>
                      <button
                        onClick={() => openLinkedDocViewer(link)}
                        disabled={viewLinkLoadingId === link.link_id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: viewLinkLoadingId === link.link_id ? 'wait' : 'pointer', fontFamily: 'var(--font)', opacity: viewLinkLoadingId === link.link_id ? .6 : 1 }}>
                        <Eye size={13} /> {viewLinkLoadingId === link.link_id ? t('linkedDocs.loadingView') : t('linkedDocs.view')}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="table-scroll-wrap">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 110px 150px 80px', minWidth: 900, background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ ...LABEL, padding: '10px 16px' }}>{t('linkedDocs.headers.document')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('linkedDocs.headers.originalDept')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('linkedDocs.headers.linkedDept')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('linkedDocs.headers.status')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('linkedDocs.headers.requesterReviewer')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('linkedDocs.headers.view')}</div>
              </div>

              {filteredLinks.map(link => {
                const ls = LS[link.link_status] || LS.pending;
                const requesterName = link.requested_by_first_name
                  ? `${link.requested_by_first_name} ${link.requested_by_last_name || ''}`.trim()
                  : link.requested_by_username || '—';
                const reviewerName = link.reviewed_by_first_name
                  ? `${link.reviewed_by_first_name} ${link.reviewed_by_last_name || ''}`.trim()
                  : link.reviewed_by_username || null;
                return (
                  <div key={link.link_id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 110px 150px 80px', minWidth: 900, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 58, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255, 193, 7,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Link2 size={14} color="#d97706" strokeWidth={2} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{link.document_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          {link.document_type_name && <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: 'rgba(255, 193, 7,.1)', borderRadius: 4, padding: '1px 5px' }}>{link.document_type_name}</span>}
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
                        <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 1 }}>{t('linkedDocs.requested')}</span>
                        {requesterName} · <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{link.requested_at?.split('T')[0]}</span>
                      </div>
                      {reviewerName && (
                        <div style={{ fontSize: 12, color: ls.color }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 1 }}>{t('linkedDocs.reviewed')}</span>
                          {reviewerName} · <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{link.reviewed_at?.split('T')[0]}</span>
                        </div>
                      )}
                    </div>
                    {/* View */}
                    <div style={{ padding: '10px 12px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => openLinkedDocViewer(link)}
                        disabled={viewLinkLoadingId === link.link_id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: viewLinkLoadingId === link.link_id ? 'wait' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s', opacity: viewLinkLoadingId === link.link_id ? .6 : 1 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.07)'}>
                        <Eye size={12} /> {viewLinkLoadingId === link.link_id ? t('linkedDocs.loadingView') : t('linkedDocs.view')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          )}
        </Card>
      </div>
      {viewingLink && <DocViewModal doc={viewingLink} onClose={() => setViewingLink(null)} />}
      </>
    );
  }

  // ── Act Parts (view-only for nodal officer) ──────────────────────────────
  if (activePage === 'nodalactparts') {
    const TAB_LABELS = { sections: t('actParts.tabLabels.sections'), schedule: t('actParts.tabLabels.schedule'), annexure: t('actParts.tabLabels.annexure'), appendix: t('actParts.tabLabels.appendix'), forms: t('actParts.tabLabels.forms') };
    const STATUS_SC  = {
      pending:  { bg: '#fef3c7', color: '#92400e', border: '#ffc107', label: t('actParts.stats.pending')  },
      approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981', label: t('actParts.stats.approved') },
      rejected: { bg: '#fee2e2', color: '#991b1b', border: '#dc3545', label: t('actParts.stats.rejected') },
    };
    const filtered = actPartsStatusFilter
      ? actPartsItems.filter(i => i.status === actPartsStatusFilter)
      : actPartsItems;
    const actPartsCounts = {
      pending:  actPartsItems.filter(i => i.status === 'pending').length,
      approved: actPartsItems.filter(i => i.status === 'approved').length,
      rejected: actPartsItems.filter(i => i.status === 'rejected').length,
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{NOD_RESPONSIVE_CSS}</style>

        {/* Stats */}
        <div className="nod-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('actParts.stats.totalSubmissions'), value: actPartsItems.length,   color: 'var(--primary)', bg: 'rgba(33, 74, 171,.12)',  icon: FileText,    key: '' },
            { label: t('actParts.stats.pending'),           value: actPartsCounts.pending,  color: '#b45309',        bg: 'rgba(255, 193, 7,.12)', icon: Clock,       key: 'pending'  },
            { label: t('actParts.stats.approved'),          value: actPartsCounts.approved, color: '#16a34a',        bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'approved' },
            { label: t('actParts.stats.rejected'),          value: actPartsCounts.rejected, color: '#dc3545',        bg: 'rgba(220, 53, 69,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = actPartsStatusFilter === s.key;
            return (
              <Card key={s.label}
                onClick={() => setActPartsStatusFilter(f => f === s.key ? '' : s.key)}
                style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                      {actPartsLoading ? '–' : s.value}
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

        {actPartsLoading && (
          <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('actParts.loading')}</div>
        )}
        {actPartsError && (
          <div style={{ padding: '20px 0', fontSize: 13, color: '#dc3545' }}>{actPartsError}</div>
        )}

        {!actPartsLoading && !actPartsError && filtered.length === 0 && (
          <Card style={{ padding: '60px 0', textAlign: 'center' }}>
            <FileText size={36} color="var(--surface-200)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-color-secondary)' }}>{t('actParts.noSubmissions')}</div>
          </Card>
        )}

        {!actPartsLoading && !actPartsError && filtered.length > 0 && (
          <Card style={{ overflow: 'hidden' }}>
          {isMobile ? (
            <div>
              {filtered.map(item => {
                const sc = STATUS_SC[item.status] || STATUS_SC.pending;
                return (
                  <div key={`${item.pdf_document_id}-${item.part_type}`} style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.act_name || t('actParts.detail.actFallback', { id: item.pdf_document_id })}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(33, 74, 171,.1)', color: '#214aab', borderRadius: 4, padding: '1px 7px' }}>
                            {TAB_LABELS[item.part_type] || item.part_type}
                          </span>
                          {item.act_type && <span style={{ fontSize: 10.5, color: 'var(--text-color-secondary)' }}>{item.act_type}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                      <span>{[item.submitter_first_name, item.submitter_last_name].filter(Boolean).join(' ') || item.submitter_username || '—'}</span>
                      <span style={{ fontFamily: 'var(--mono)', flexShrink: 0 }}>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</span>
                    </div>
                    {item.status === 'rejected' && item.comments && (
                      <div style={{ fontSize: 11, color: '#991b1b', fontStyle: 'italic' }}>{item.comments}</div>
                    )}
                    <button onClick={() => openActPartsDetail(item)} disabled={actPartsDetailLoading}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <Eye size={13} /> {t('actParts.view')}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="table-scroll-wrap">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 140px 140px 100px', minWidth: 800, background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ ...LABEL, padding: '10px 18px' }}>{t('actParts.headers.actTab')}</div>
              <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('actParts.headers.submittedBy')}</div>
              <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('actParts.headers.submittedAt')}</div>
              <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('actParts.headers.status')}</div>
              <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('actParts.headers.view')}</div>
            </div>

            {filtered.map(item => {
              const sc = STATUS_SC[item.status] || STATUS_SC.pending;
              return (
                <div key={`${item.pdf_document_id}-${item.part_type}`}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 150px 140px 140px 100px', minWidth: 800, borderBottom: '1px solid var(--surface-border)', alignItems: 'center', minHeight: 58, transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ padding: '10px 18px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 2 }}>{item.act_name || t('actParts.detail.actFallback', { id: item.pdf_document_id })}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(33, 74, 171,.1)', color: '#214aab', borderRadius: 4, padding: '1px 7px' }}>
                        {TAB_LABELS[item.part_type] || item.part_type}
                      </span>
                      {item.act_type && <span style={{ fontSize: 10.5, color: 'var(--text-color-secondary)' }}>{item.act_type}</span>}
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>
                    {[item.submitter_first_name, item.submitter_last_name].filter(Boolean).join(' ') || item.submitter_username || '—'}
                  </div>
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color-secondary)' }}>
                    {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                  </div>
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px' }}>{sc.label}</span>
                    {item.status === 'rejected' && item.comments && (
                      <div style={{ fontSize: 11, color: '#991b1b', marginTop: 3, fontStyle: 'italic', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.comments}>
                        {item.comments}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                    <button onClick={() => openActPartsDetail(item)} disabled={actPartsDetailLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <Eye size={13} /> {t('actParts.view')}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
          </Card>
        )}

        {/* Detail modal (view-only) */}
        {actPartsViewing && (
          <ActPartsDetailModal
            item={actPartsViewing.item}
            partsData={actPartsViewing.partsData}
            onClose={() => setActPartsViewing(null)}
            readOnly
          />
        )}
      </div>
    );
  }

  return null;
}

// ── Shared detail modal for viewing act part content ─────────────────────────
function ActPartsDetailModal({ item, partsData, onClose, readOnly = false, onApprove, onReject }) {
  const { t } = useTranslation('nodal');
  const ACT_PART_TAB_LABELS = { sections: t('actParts.tabLabels.sections'), schedule: t('actParts.tabLabels.schedule'), annexure: t('actParts.tabLabels.annexure'), appendix: t('actParts.tabLabels.appendix'), forms: t('actParts.tabLabels.forms') };
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(null); // 'approved' | 'rejected'
  const [submitting, setSubmitting] = useState(false);

  const partType = item?.part_type;

  function renderContent() {
    if (!partsData) return <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: '#dc3545' }}>{t('actParts.detail.couldNotLoad')}</div>;

    const statusChip = (status) => {
      if (!status) return null;
      const s = { draft: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' }, pending: { bg: '#fef3c7', color: '#92400e', border: '#ffc107' }, approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981' }, rejected: { bg: '#fee2e2', color: '#991b1b', border: '#dc3545' }, pending_delete: { bg: '#fff1f2', color: '#9f1239', border: '#fda4af' } }[status];
      if (!s) return null;
      const label = { draft: t('actParts.detail.statusLabels.draft'), pending: t('actParts.detail.statusLabels.pending'), approved: t('actParts.detail.statusLabels.approved'), rejected: t('actParts.detail.statusLabels.rejected'), pending_delete: t('actParts.detail.statusLabels.pendingDelete') }[status] || status;
      return <span style={{ fontSize: 9.5, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '1px 7px', flexShrink: 0, marginLeft: 6 }}>{label}</span>;
    };

    if (partType === 'sections') {
      const hasCh = partsData.has_chapters && partsData.chapters?.length > 0;
      if (hasCh) {
        return partsData.chapters.map(ch => (
          <div key={ch.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(33, 74, 171,.1)', color: '#214aab', borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {ch.chapter_number || '—'}
              </span>
              {ch.chapter_title || '(No title)'}
              {statusChip(ch.status)}
            </div>
            {(ch.sections || []).map(sec => (
              <div key={sec.id} style={{ marginLeft: 20, marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span>{sec.section_number || '—'} {sec.section_title && `— ${sec.section_title}`}</span>
                  {statusChip(sec.status)}
                </div>
                {sec.section_content && (
                  <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{sec.section_content}</div>
                )}
                {sec.original_filename && (
                  <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {sec.original_filename}</div>
                )}
              </div>
            ))}
            {(!ch.sections || ch.sections.length === 0) && (
              <div style={{ marginLeft: 20, fontSize: 12, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>{t('actParts.detail.noSectionsInChapter')}</div>
            )}
          </div>
        ));
      }
      const flat = partsData.flat_sections || [];
      if (flat.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>{t('actParts.detail.noSections')}</div>;
      return flat.map(sec => (
        <div key={sec.id} style={{ marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span>{sec.section_number || '—'} {sec.section_title && `— ${sec.section_title}`}</span>
            {statusChip(sec.status)}
          </div>
          {sec.section_content && (
            <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{sec.section_content}</div>
          )}
          {sec.original_filename && (
            <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {sec.original_filename}</div>
          )}
        </div>
      ));
    }

    // Flat entries (schedule / annexure / appendix / forms)
    const keyMap = { schedule: 'schedules', annexure: 'annexures', appendix: 'appendices', forms: 'forms' };
    const entries = partsData[keyMap[partType]] || [];
    if (entries.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>{t('actParts.detail.noEntries')}</div>;
    return entries.map(e => (
      <div key={e.id} style={{ marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span>{e.entry_number || '—'} {e.title && `— ${e.title}`}</span>
          {statusChip(e.status)}
        </div>
        {e.description && (
          <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{e.description}</div>
        )}
        {e.original_filename && (
          <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {e.original_filename}</div>
        )}
      </div>
    ));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 800, color: 'var(--text-heading)' }}>
              {item?.act_name || t('actParts.detail.actFallback', { id: item?.pdf_document_id })}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(33, 74, 171,.1)', color: '#214aab', borderRadius: 4, padding: '2px 8px' }}>
                {ACT_PART_TAB_LABELS[partType] || partType}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                {t('actParts.detail.submittedByLine', { name: [item?.submitter_first_name, item?.submitter_last_name].filter(Boolean).join(' ') || item?.submitter_username })}
                {item?.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleDateString()}` : ''}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>
          {renderContent()}
        </div>

        {/* Footer — approve/reject only for non-readOnly */}
        {!readOnly && !confirming && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setConfirming('rejected')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: '1.5px solid #dc3545', background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <XCircle size={14} /> {t('actParts.detail.reject')}
            </button>
            <button onClick={() => setConfirming('approved')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <CheckCircle size={14} /> {t('actParts.detail.approve')}
            </button>
          </div>
        )}

        {!readOnly && confirming && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-color-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t('actParts.detail.comments')} {confirming === 'rejected' && <span style={{ color: '#dc3545' }}>*</span>}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              placeholder={confirming === 'rejected' ? t('actParts.detail.reasonForRejection') : t('actParts.detail.optionalComments')}
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--surface-border)', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font)', resize: 'none', boxSizing: 'border-box', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button onClick={() => setConfirming(null)} disabled={submitting}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('actParts.detail.back')}
              </button>
              <button
                disabled={submitting || (confirming === 'rejected' && !comment.trim())}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    if (confirming === 'approved') await onApprove?.({ comment: comment.trim() || null });
                    else await onReject?.({ comment: comment.trim() });
                    onClose();
                  } finally { setSubmitting(false); }
                }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: confirming === 'approved' ? '#10b981' : '#dc3545', color: 'white', fontSize: 13, fontWeight: 700, cursor: (submitting || (confirming === 'rejected' && !comment.trim())) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: (submitting || (confirming === 'rejected' && !comment.trim())) ? .5 : 1 }}>
                {submitting ? t('actParts.detail.submitting') : confirming === 'approved' ? t('actParts.detail.confirmApprove') : t('actParts.detail.confirmReject')}
              </button>
            </div>
          </div>
        )}

        {readOnly && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface-border)', textAlign: 'right', flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>{t('actParts.detail.close')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
