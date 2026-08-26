import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Users, Edit2, Plus, CheckCircle, XCircle, X, Eye, EyeOff, Download, FileSpreadsheet, Layers, FileText, Clock, Search, Link2, ShieldCheck } from 'lucide-react';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import DocViewModal from '../components/DocViewModal';
import { getUsers, getRoles, updateUser, registerUser, getApproversByDepartment } from '../services/users';
import { getDepartments } from '../services/departments';
import { getAllDocumentsAdmin, getAllDepartmentLinks } from '../services/pdf';
import { getAuditLogs, getAuditLogActions } from '../services/audit';
import { getRoleCaps, getActiveUserCount } from '../services/roleCaps';
import { submitCapRequest, getMyCapRequests } from '../services/capRequests';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { downloadUploadsExcelReport } from '../utils/uploadsExcelReport';
import { useAuth } from '../hooks/useAuth';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

// Admin creates/manages every account except other admins — there is only ever one admin, seeded up front.
// Citizens are public users, not staff accounts — no one creates a "citizen" login from a dashboard.
const ADMIN_ROLE_NAMES = new Set(['admin', 'super_admin', 'citizen']);
function normalizeRoleName(name) {
  return name?.trim().toLowerCase().replace(/\s+/g, '_');
}
function assignableRoles(roles) {
  return roles.filter(r => !ADMIN_ROLE_NAMES.has(normalizeRoleName(r.name)));
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
    deptId:    u.department?.id ?? u.departments?.[0]?.id ?? null,
    deptIds:   u.departments?.length > 0 ? u.departments.map(d => d.id) : (u.department ? [u.department.id] : []),
    deptRaw:   u.departments?.length > 0 ? u.departments.map(d => String(d.id)).join(',') : null,
    status:       u.is_active ? 'active' : 'inactive',
    isActive:     u.is_active,
    approverId:   u.approver_id ?? null,
    mobileNumber: u.mobile_number ?? '',
    lastLogin:    u.last_login ? u.last_login.split('T')[0] : '—',
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

const AUDIT_PAGE_SIZE = 10;
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fmtAction(action) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtAuditActor(actor) {
  if (!actor) return 'System';
  const full = [actor.first_name, actor.last_name].filter(Boolean).join(' ');
  return full || actor.username || `User #${actor.id}`;
}

// Shared once per return — mirrors the <style> convention used in the other dashboards.
const ADM_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .adm-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
  }
  @media (max-width: 640px) {
    .adm-stats-grid { grid-template-columns: 1fr !important; }
    .adm-form-grid { grid-template-columns: 1fr !important; }
    .adm-drawer { width: 100% !important; }
    .adm-audit-spacer { display: none !important; }
    .adm-export-btn { width: 100% !important; }
    .adm-users-actions { width: 100% !important; }
    .adm-users-actions > * { flex: 1 1 auto !important; min-width: 0 !important; }
  }
  .adm-mdm-scroll { scrollbar-width: thin; }
  .adm-mdm-scroll::-webkit-scrollbar { width: 6px; }
  .adm-mdm-scroll::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 4px; }
  @media (max-width: 640px) {
    .adm-filter-bar { flex-direction: column !important; align-items: stretch !important; }
    .adm-filter-bar > * { width: 100% !important; flex: 1 1 auto !important; margin-left: 0 !important; }
    .adm-filter-bar button { width: 100% !important; justify-content: center !important; }
  }
`;

export default function AdminDashboard({ activePage }) {
  const { t } = useTranslation('admin');
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [users, setUsers]               = useState([]);
  const [userCounts, setUserCounts]     = useState({ total: 0, count_active: 0, count_inactive: 0 });
  const [usersTotal, setUsersTotal]     = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError]     = useState('');
  const [roles, setRoles]               = useState([]);

  // Declared here so the fetch useEffect below can reference them without TDZ errors
  const [statusFilter, setStatusFilter] = useState(null); // null | 'active' | 'inactive'
  const [usersPage, setUsersPage]       = useState(1);
  const USERS_PAGE_SIZE = 10;

  useEffect(() => {
    if (activePage !== 'users') return;
    setUsersLoading(true);
    setUsersError('');
    const skip = (usersPage - 1) * 10;
    Promise.all([getUsers(skip, 10, statusFilter), getRoles()])
      .then(([usersRes, rolesRes]) => {
        const normalized = (usersRes.data.users || []).map(normalizeUser);
        setUsers(normalized);
        setUserCounts({
          total:          usersRes.data.total          ?? 0,
          count_active:   usersRes.data.count_active   ?? 0,
          count_inactive: usersRes.data.count_inactive ?? 0,
        });
        setUsersTotal(usersRes.data.pagination_total ?? usersRes.data.total ?? 0);
        setRoles(rolesRes.data);
      })
      .catch(() => setUsersError(t('users.failedToLoadUsers')))
      .finally(() => setUsersLoading(false));
  }, [activePage, t, usersPage, statusFilter]);

  // Departments state — full list for add/edit selectors
  const [depts, setDepts]               = useState([]);
  useEffect(() => {
    if (activePage !== 'users') return;
    getDepartments()
      .then(res => setDepts(res.data))
      .catch(() => {});
  }, [activePage]);

  // All Uploads state
  const [allDocs, setAllDocs]           = useState([]);
  const [allDocCounts, setAllDocCounts] = useState({ count_total: 0, count_pending: 0, count_approved: 0, count_rejected: 0 });
  const [allDocsLoading, setAllDocsLoading] = useState(false);
  const [allDocsError, setAllDocsError] = useState('');
  const [uploadsSearch, setUploadsSearch] = useState('');
  const [uploadsFilterStatus, setUploadsFilterStatus] = useState('');
  const [uploadsFilterUploader, setUploadsFilterUploader] = useState('');
  const [uploadsFilterApprover, setUploadsFilterApprover] = useState('');
  const [viewDoc, setViewDoc]                             = useState(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [uploadsPage, setUploadsPage] = useState(1); // client-side pagination over filteredDocs — only 10 shown at a time
  const UPLOADS_PAGE_SIZE = 10;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUploadsPage(1); }, [uploadsSearch, uploadsFilterStatus, uploadsFilterUploader, uploadsFilterApprover]);

  useEffect(() => {
    if (activePage !== 'alluploads') return;
    setAllDocsLoading(true);
    setAllDocsError('');
    Promise.all([
      getAllDocumentsAdmin(),
      getDepartments(),
    ])
      .then(([docsRes, deptsRes]) => {
        const docs = docsRes.data.documents || [];
        setAllDocs(user?.dept ? docs.filter(d => d.department_name === user.dept) : docs);
        setAllDocCounts({
          count_total:    docsRes.data.count_total    ?? 0,
          count_pending:  docsRes.data.count_pending  ?? 0,
          count_approved: docsRes.data.count_approved ?? 0,
          count_rejected: docsRes.data.count_rejected ?? 0,
        });
        setDepts(deptsRes.data);
      })
      .catch(() => setAllDocsError(t('uploads.failedToLoad')))
      .finally(() => setAllDocsLoading(false));
  }, [activePage, t, user?.dept]);

  // Audit Log state
  const [auditLogs, setAuditLogs]               = useState([]);
  const [auditTotal, setAuditTotal]             = useState(0);
  const [auditLoading, setAuditLoading]         = useState(false);
  const [auditError, setAuditError]             = useState('');
  const [auditPage, setAuditPage]               = useState(0);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFromDate, setAuditFromDate]       = useState('');
  const [auditToDate, setAuditToDate]           = useState('');
  const [auditSearch, setAuditSearch]           = useState('');
  const [auditActionOptions, setAuditActionOptions] = useState([]);
  const [auditExporting, setAuditExporting]     = useState(false);

  // Fetch all distinct action values once when the MIS page is first opened.
  const [auditActionsLoaded, setAuditActionsLoaded] = useState(false);
  useEffect(() => {
    if (activePage !== 'auditfull' || auditActionsLoaded) return;
    getAuditLogActions()
      .then(res => {
        setAuditActionOptions(res.data.actions || []);
        setAuditActionsLoaded(true);
      })
      .catch(() => {});
  }, [activePage, auditActionsLoaded]);

  useEffect(() => {
    if (activePage !== 'auditfull') return;
    setAuditLoading(true);
    setAuditError('');
    const params = { skip: auditPage * AUDIT_PAGE_SIZE, limit: AUDIT_PAGE_SIZE };
    if (auditFilterAction) params.action       = auditFilterAction;
    if (auditFromDate)     params.from_date    = auditFromDate;
    if (auditToDate)       params.to_date      = auditToDate + 'T23:59:59';
    getAuditLogs(params)
      .then(res => {
        const logs = res.data.logs || [];
        setAuditLogs(logs);
        setAuditTotal(res.data.total || 0);
      })
      .catch(() => setAuditError(t('audit.failedToLoad')))
      .finally(() => setAuditLoading(false));
  }, [activePage, auditPage, auditFilterAction, auditFromDate, auditToDate, t]);

  // Cap Change Requests state
  const [capReqHistory, setCapReqHistory]           = useState([]);
  const [capReqHistoryLoading, setCapReqHistoryLoading] = useState(false);
  const [capReqCaps, setCapReqCaps]                 = useState({ limits: [], default_max: 5 });
  const [capReqForm, setCapReqForm]                 = useState({ role_id: '', requested_cap: '', reason: '' });
  const [capReqSaving, setCapReqSaving]             = useState(false);
  const [capReqError, setCapReqError]               = useState('');
  const [capReqSuccess, setCapReqSuccess]           = useState('');
  const [capReqActiveCount, setCapReqActiveCount]   = useState(null);
  const [capReqActiveLoading, setCapReqActiveLoading] = useState(false);
  const [capReqFilterStatus, setCapReqFilterStatus] = useState(null);

  useEffect(() => {
    const deptId = user?.deptId;
    if (!capReqForm.role_id || !deptId) { setCapReqActiveCount(null); return; }
    setCapReqActiveLoading(true);
    setCapReqActiveCount(null);
    getActiveUserCount(deptId, capReqForm.role_id)
      .then(res => setCapReqActiveCount(res.data.active_count ?? null))
      .catch(() => setCapReqActiveCount(null))
      .finally(() => setCapReqActiveLoading(false));
  }, [capReqForm.role_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activePage !== 'caprequests') return;
    if (roles.length === 0) {
      getRoles().then(res => setRoles(res.data)).catch(() => {});
    }
    setCapReqHistoryLoading(true);
    Promise.all([getMyCapRequests(), getRoleCaps()])
      .then(([reqRes, capsRes]) => {
        setCapReqHistory(reqRes.data || []);
        setCapReqCaps(capsRes.data || { limits: [], default_max: 5 });
      })
      .catch(() => {})
      .finally(() => setCapReqHistoryLoading(false));
  }, [activePage]);

  // Linked Documents state (admin view)
  const [allLinks, setAllLinks]           = useState([]);
  const [allLinksLoading, setAllLinksLoading] = useState(false);
  const [allLinksError, setAllLinksError] = useState('');
  const [linksSearch, setLinksSearch]     = useState('');
  const [linksFilterStatus, setLinksFilterStatus] = useState('');
  const [linksFilterDept, setLinksFilterDept]     = useState('');
  const [viewingLink, setViewingLink]     = useState(null);
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

  useEffect(() => {
    if (activePage !== 'linkedocs') return;
    setAllLinksLoading(true);
    setAllLinksError('');
    Promise.all([getAllDepartmentLinks(), getDepartments()])
      .then(([linksRes, deptsRes]) => {
        setAllLinks(Array.isArray(linksRes.data) ? linksRes.data : []);
        setDepts(deptsRes.data);
      })
      .catch(() => setAllLinksError(t('linkedDocs.failedToLoad')))
      .finally(() => setAllLinksLoading(false));
  }, [activePage, t]);

  // When the logged-in user is an admin, lock new users to the admin's department.
  const adminDeptId = user?.role === 'admin' ? user.deptId : null;
  // Departments available for selection — admin sees only their own, super_admin sees all.
  const managedDepts = adminDeptId ? depts.filter(d => d.id === adminDeptId) : depts;

  function slugify(str) {
    return str.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
  }

  function buildUsernamePlaceholder(roleId, deptId) {
    const role = roles.find(r => String(r.id) === String(roleId));
    if (!role) return t('users.addDrawer.usernamePlaceholder');
    if (role.name === 'nodal Officer') {
      const dept = depts.find(d => String(d.id) === String(deptId));
      return dept ? `nodal.${slugify(dept.name)}` : 'nodal';
    }
    const rolePart = slugify(role.name);
    const dept = depts.find(d => String(d.id) === String(deptId));
    return dept ? `${rolePart}.${slugify(dept.name)}` : rolePart;
  }

  // Add User modal state
  const EMPTY_ADD_FORM = {
    username: '', email: '', mobile_number: '', password: '',
    first_name: '', last_name: '', role_id: '',
    department_id: adminDeptId ? String(adminDeptId) : '',
    approver_id:   '',
  };
  const [addingUser, setAddingUser]   = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_ADD_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState('');
  const [showAddPass, setShowAddPass] = useState(false);
  const [approvers, setApprovers]     = useState([]);
  const [approversLoading, setApproversLoading] = useState(false);

  const _addFormRoleName = roles.find(r => String(r.id) === String(addForm.role_id))?.name;
  useEffect(() => {
    if (_addFormRoleName !== 'uploader' || !addForm.department_id) {
      setApprovers([]);
      return;
    }
    setApproversLoading(true);
    getApproversByDepartment(addForm.department_id)
      .then(res => setApprovers(res.data || []))
      .catch(() => setApprovers([]))
      .finally(() => setApproversLoading(false));
  }, [_addFormRoleName, addForm.department_id]);

  async function handleAddUser() {
    const selectedRole = roles.find(r => String(r.id) === String(addForm.role_id));
    const isUploader = selectedRole?.name === 'uploader';
    if (!addForm.role_id)           { setAddError(t('users.errors.roleRequired')); return; }
    if (!addForm.department_id)     { setAddError(t('users.errors.departmentRequired')); return; }
    if (isUploader && !addForm.approver_id) { setAddError('Please select an approver for this uploader.'); return; }
    if (!addForm.username.trim())   { setAddError(t('users.errors.usernameRequired')); return; }
    if (!addForm.email.trim())      { setAddError(t('users.errors.emailRequired')); return; }
    if (!EMAIL_FORMAT_RE.test(addForm.email.trim())) { setAddError(t('users.errors.emailInvalid')); return; }
    if (!addForm.password)          { setAddError(t('users.errors.passwordRequired')); return; }
    if (!addForm.first_name.trim()) { setAddError(t('users.errors.firstNameRequired')); return; }
    if (!addForm.last_name.trim())  { setAddError(t('users.errors.lastNameRequired')); return; }
    if (addForm.mobile_number.trim().length !== 10) { setAddError(t('users.errors.mobileRequired')); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const res = await registerUser({
        username:      addForm.username.trim(),
        email:         addForm.email.trim(),
        mobile_number: addForm.mobile_number.trim(),
        password:      addForm.password,
        first_name:    addForm.first_name.trim(),
        last_name:     addForm.last_name.trim(),
        role_id:       addForm.role_id ? Number(addForm.role_id) : undefined,
        department_id: addForm.department_id || undefined,
        approver_id:   isUploader && addForm.approver_id ? Number(addForm.approver_id) : undefined,
      });
      setUsers(prev => [normalizeUser(res.data), ...prev]);
      setAddingUser(false);
      setAddForm(EMPTY_ADD_FORM);
      setShowAddPass(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setAddError(typeof detail === 'string' ? detail : t('users.errors.createFailed'));
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
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);
  const [editApprovers, setEditApprovers]         = useState([]);
  const [editApproversLoading, setEditApproversLoading] = useState(false);

  const _editFormRoleName = roles.find(r => String(r.id) === String(editForm.role_id))?.name;
  useEffect(() => {
    if (_editFormRoleName !== 'uploader' || !editForm.department_id) {
      setEditApprovers([]);
      return;
    }
    setEditApproversLoading(true);
    getApproversByDepartment(editForm.department_id)
      .then(res => setEditApprovers(res.data || []))
      .catch(() => setEditApprovers([]))
      .finally(() => setEditApproversLoading(false));
  }, [_editFormRoleName, editForm.department_id]);

  function openEdit(u) {
    setEditingUser(u);
    setEditForm({
      first_name:    u.firstName,
      last_name:     u.lastName,
      email:         u.email,
      is_active:     u.isActive,
      role_id:       u.roleId,
      department_id: String(u.deptId ?? u.deptIds?.[0] ?? ''),
      approver_id:   u.approverId ? String(u.approverId) : '',
      mobile_number: u.mobileNumber,
    });
    setEditError('');
  }

  function handleEditSave() {
    const _editIsUploader = _editFormRoleName === 'uploader';
    setEditSaving(true);
    setEditError('');
    updateUser({
      user_id:       editingUser.id,
      first_name:    editForm.first_name,
      last_name:     editForm.last_name,
      email:         editForm.email,
      is_active:     editForm.is_active,
      mobile_number: editForm.mobile_number || undefined,
      ...(_editIsUploader && editForm.approver_id ? { approver_id: Number(editForm.approver_id) } : {}),
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
      role_id:       u.roleId,
      department_id: u.deptRaw || undefined,
    })
      .then(res => setUsers(prev => prev.map(x => x.id === u.id ? normalizeUser(res.data) : x)))
      .catch(() => {})
      .finally(() => setTogglingId(null));
  }

  // User Management
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUsersPage(1); }, [statusFilter]);

  if (activePage === 'users') {
    const filteredUsers = users; // status filter applied server-side

    const usersTotalPages = Math.max(1, Math.ceil(usersTotal / USERS_PAGE_SIZE));
    const clampedUsersPage = Math.min(usersPage, usersTotalPages);
    const pageUsers = filteredUsers; // server returns one page already

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
        <style>{ADM_RESPONSIVE_CSS}</style>
        <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: t('users.stats.totalUsers'), value: userCounts.total,         color: 'var(--primary)',  bg: 'rgba(33, 74, 171,.12)',  icon: Users,       key: null },
            { label: t('users.stats.active'),      value: userCounts.count_active,   color: '#198754',         bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'active' },
            { label: t('users.stats.inactive'),    value: userCounts.count_inactive, color: '#b45309',         bg: 'rgba(255, 193, 7,.12)', icon: XCircle,     key: 'inactive' },
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
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('users.systemUsers')}</div>
              {statusFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 20, background: statusFilter === 'active' ? 'rgba(25, 135, 84,.1)' : 'rgba(255, 193, 7,.1)', border: `1px solid ${statusFilter === 'active' ? 'rgba(25, 135, 84,.3)' : 'rgba(255, 193, 7,.3)'}`, fontSize: 11.5, fontWeight: 600, color: statusFilter === 'active' ? '#16a34a' : '#b45309', whiteSpace: 'nowrap' }}>
                  {statusFilter === 'active' ? t('users.stats.active') : t('users.stats.inactive')}
                  <button onClick={() => setStatusFilter(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}><X size={11} /></button>
                </div>
              )}
            </div>
            <div className="adm-users-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => { setAddingUser(true); setAddError(''); setAddForm(EMPTY_ADD_FORM); setShowAddPass(false); }}
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
              {t('users.noUsersYet')}
            </div>
          )}
          {!usersLoading && !usersError && filteredUsers.length > 0 && (
            isMobile ? (
              <div>
                {pageUsers.map(u => (
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
              {pageUsers.map(u => (
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
          {!usersLoading && !usersError && usersTotalPages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)' }}>
              <Pagination page={clampedUsersPage} totalPages={usersTotalPages} onChange={setUsersPage} />
            </div>
          )}
        </Card>

        {/* Add User Drawer */}
        {addingUser && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }} />
            <div className="adm-drawer" style={{
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
                {(() => {
                  const isNodal = roles.find(r => String(r.id) === String(addForm.role_id))?.name === 'nodal Officer';
                  return (
                    <>
                      <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label htmlFor="adm-add-role" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.role')} <span style={{ color: '#dc3545' }}>*</span></label>
                          <SelectField
                            id="adm-add-role"
                            required
                            value={addForm.role_id}
                            onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value, department_id: adminDeptId ? String(adminDeptId) : '', approver_id: '' }))}
                            placeholder={t('users.addDrawer.roleSelectPlaceholder')}
                          >
                            {assignableRoles(roles).map(r => (
                              <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <label htmlFor="adm-add-department" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.department')} <span style={{ color: '#dc3545' }}>*</span></label>
                          <SelectField id="adm-add-department" required value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value, approver_id: '' }))} placeholder={t('users.addDrawer.departmentSelectPlaceholder')} disabled={!!adminDeptId}>
                            {managedDepts.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </SelectField>
                        </div>
                      </div>

                      {/* Approver assignment — uploader role only */}
                      {!isNodal && roles.find(r => String(r.id) === String(addForm.role_id))?.name === 'uploader' && addForm.department_id && (
                        <div>
                          <label htmlFor="adm-add-approver" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>
                            Assign Approver <span style={{ color: '#dc3545' }}>*</span>
                          </label>
                          <SelectField
                            id="adm-add-approver"
                            required
                            value={addForm.approver_id}
                            onChange={e => setAddForm(f => ({ ...f, approver_id: e.target.value }))}
                            placeholder={approversLoading ? 'Loading approvers…' : approvers.length === 0 ? 'No approvers in this department' : 'Select approver'}
                          >
                            {approvers.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.first_name} {a.last_name} ({a.username})
                              </option>
                            ))}
                          </SelectField>
                          {approvers.length === 0 && !approversLoading && (
                            <div style={{ fontSize: 11.5, color: '#e67e22', marginTop: 5 }}>
                              ⚠ No active approvers found for this department. Create an approver first.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Username + Email */}
                <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="adm-add-username" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.username')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="adm-add-username" style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('username') ? 'rgba(220, 53, 69,.6)' : undefined }}
                      placeholder={(() => { const s = buildUsernamePlaceholder(addForm.role_id, addForm.department_id); return s === t('users.addDrawer.usernamePlaceholder') ? s : `e.g. ${s}`; })()}
                      autoComplete="off"
                      value={addForm.username}
                      onChange={e => { setAddForm(f => ({ ...f, username: e.target.value })); setAddError(''); }} />
                  </div>
                  <div>
                    <label htmlFor="adm-add-email" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.email')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="adm-add-email" style={{ ...INP_STYLE, borderColor: addError.toLowerCase().includes('email') ? 'rgba(220, 53, 69,.6)' : undefined }}
                      type="email" placeholder={t('users.addDrawer.emailPlaceholder')}
                      autoComplete="off"
                      value={addForm.email}
                      onChange={e => { setAddForm(f => ({ ...f, email: e.target.value })); setAddError(''); }} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="adm-add-password" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.password')} <span style={{ color: '#dc3545' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="adm-add-password"
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
                <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="adm-add-firstname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.firstName')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="adm-add-firstname" style={INP_STYLE} placeholder={t('users.addDrawer.firstNamePlaceholder')}
                      value={addForm.first_name}
                      onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="adm-add-lastname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.lastName')} <span style={{ color: '#dc3545' }}>*</span></label>
                    <input id="adm-add-lastname" style={INP_STYLE} placeholder={t('users.addDrawer.lastNamePlaceholder')}
                      value={addForm.last_name}
                      onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label htmlFor="adm-add-mobile" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.mobileNumber')} <span style={{ color: '#dc3545' }}>*</span></label>
                  <input id="adm-add-mobile" style={INP_STYLE}
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
                  const _footerRole = roles.find(r => String(r.id) === String(addForm.role_id));
                  const isUploader = _footerRole?.name === 'uploader';
                  const addFormInvalid = !addForm.role_id
                    || !addForm.department_id
                    || (isUploader && !addForm.approver_id)
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

                <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="adm-edit-firstname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.firstName')}</label>
                    <input id="adm-edit-firstname" style={INP_STYLE} value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="adm-edit-lastname" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.lastName')}</label>
                    <input id="adm-edit-lastname" style={INP_STYLE} value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="adm-edit-email" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.email')}</label>
                    <input id="adm-edit-email" style={INP_STYLE} type="email" value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="adm-edit-mobile" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Mobile Number</label>
                    <input id="adm-edit-mobile" style={INP_STYLE} type="tel" maxLength={10}
                      value={editForm.mobile_number ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, mobile_number: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                </div>

                {(() => {
                  const isUploaderEdit = _editFormRoleName === 'uploader';
                  return (
                    <>
                      <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.role')}</label>
                          <div style={{ ...INP_STYLE, background: 'var(--surface-hover)', color: 'var(--text-color-secondary)', cursor: 'not-allowed' }}>
                            {editingUser.role.replace(/\b\w/g, c => c.toUpperCase())}
                          </div>
                        </div>
                        <div>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.editModal.department')}</label>
                          <div style={{ ...INP_STYLE, background: 'var(--surface-hover)', color: 'var(--text-color-secondary)', cursor: 'not-allowed' }}>
                            {managedDepts.find(d => String(d.id) === String(editForm.department_id))?.name ?? editingUser.dept ?? '—'}
                          </div>
                        </div>
                      </div>
                      {isUploaderEdit && (
                        <div>
                          <label htmlFor="adm-edit-approver" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Approver</label>
                          <SelectField
                            id="adm-edit-approver"
                            value={editForm.approver_id ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, approver_id: e.target.value }))}
                            placeholder={editApproversLoading ? 'Loading approvers…' : editApprovers.length === 0 ? 'No approvers in this department' : 'Select approver'}
                            disabled={editApproversLoading}
                          >
                            {editApprovers.map(a => (
                              <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.username})</option>
                            ))}
                          </SelectField>
                          {!editApproversLoading && editApprovers.length === 0 && editForm.department_id && (
                            <div style={{ fontSize: 11.5, color: '#dc3545', marginTop: 4 }}>⚠ No active approvers found for this department.</div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

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
                  const editBtnDisabled = editSaving;
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

  // System Monitor
  // System Monitor — disabled for now, not wired to a real API yet (all stats/health
  // below are hardcoded placeholders, not live data). Kept commented out rather than
  // deleted so it's ready to wire up once that API exists.
  /*
  if (activePage === 'monitor') {
    const stats = [
      { label: t('monitor.stats.totalDocuments'), value: '1,284', sub: t('monitor.subs.todayCount') },
      { label: t('monitor.stats.activeSessions'), value: '7',     sub: t('monitor.subs.rightNow') },
      { label: t('monitor.stats.searchesToday'),  value: '143',   sub: t('monitor.subs.anonymised') },
      { label: t('monitor.stats.storageUsed'),    value: '4.2 GB',sub: t('monitor.subs.of50Gb') },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>
        <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {stats.map(s => (
            <Card key={s.label}>
              <div style={{ ...LABEL, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 5 }}>{s.sub}</div>
            </Card>
          ))}
        </div>
        <Card>
          <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>{t('monitor.systemHealth')}</div>
          {[
            [t('monitor.services.apiServer'), t('monitor.operational')],
            [t('monitor.services.database'), t('monitor.operational')],
            [t('monitor.services.ocrService'), t('monitor.operational')],
            [t('monitor.services.searchIndex'), t('monitor.operational')],
            [t('monitor.services.auditLogger'), t('monitor.operational')],
          ].map(([svc, status]) => (
            <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--surface-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-color)' }}>{svc}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#1e40af' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#198754', display: 'inline-block' }} /> {status}
              </span>
            </div>
          ))}
        </Card>
      </div>
    );
  }
  */

  // Full MIS Report — real audit log data, excludes current user
  if (activePage === 'auditfull') {
    const totalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));

    const visibleLogs = auditLogs.filter(l => {
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const name = fmtAuditActor(l.actor).toLowerCase();
        const usr  = (l.actor?.username || '').toLowerCase();
        const act  = (l.action || '').toLowerCase();
        if (!name.includes(q) && !usr.includes(q) && !act.includes(q)) return false;
      }
      return true;
    });

    async function exportAuditCSV() {
      if (auditExporting) return;
      setAuditExporting(true);
      try {
        const FETCH_LIMIT = 100;
        const baseParams = {};
        if (auditFilterAction) baseParams.action    = auditFilterAction;
        if (auditFromDate)     baseParams.from_date = auditFromDate;
        if (auditToDate)       baseParams.to_date   = auditToDate + 'T23:59:59';
        let all = [];
        let skip = 0;
        let total = Infinity;
        while (skip < total) {
          const res = await getAuditLogs({ ...baseParams, skip, limit: FETCH_LIMIT });
          const page = res.data.logs || [];
          total = res.data.total ?? page.length;
          all = all.concat(page);
          if (page.length < FETCH_LIMIT) break;
          skip += FETCH_LIMIT;
        }
        if (auditSearch.trim()) {
          const q = auditSearch.toLowerCase();
          all = all.filter(l =>
            fmtAuditActor(l.actor).toLowerCase().includes(q) ||
            (l.actor?.username || '').toLowerCase().includes(q) ||
            (l.action || '').toLowerCase().includes(q)
          );
        }
        if (!all.length) return;
        const rows = all.map(l => ({
          timestamp:   l.created_at,
          user:        fmtAuditActor(l.actor),
          username:    l.actor?.username || '',
          action:      l.action,
          entity_type: l.entity_type,
          entity_id:   l.entity_id ?? '',
          status:      l.status,
          ip_address:  l.ip_address || '',
        }));
        exportCSV(rows, 'mis-audit-report.csv');
      } finally {
        setAuditExporting(false);
      }
    }

    return (
      <div style={{ animation: 'fadeSlideIn .3s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{ADM_RESPONSIVE_CSS}</style>

        {/* Filter bar */}
        <Card>
          <div className="adm-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)' }} />
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder={t('audit.searchPlaceholder')}
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {/* Action */}
            <SelectField
              value={auditFilterAction}
              onChange={e => { setAuditFilterAction(e.target.value); setAuditPage(0); }}
              style={{ flex: '0 0 155px' }}>
              <option value="">{t('audit.allActions')}</option>
              {auditActionOptions.map(a => <option key={a} value={a}>{fmtAction(a)}</option>)}
            </SelectField>

            {/* Date from */}
            <input type="date" value={auditFromDate} onChange={e => { setAuditFromDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{t('audit.to')}</span>
            <input type="date" value={auditToDate} onChange={e => { setAuditToDate(e.target.value); setAuditPage(0); }}
              style={{ height: 34, border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, padding: '0 10px', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />

            {/* Clear */}
            {(auditFilterAction || auditFromDate || auditToDate || auditSearch) && (
              <button onClick={() => { setAuditFilterAction(''); setAuditFromDate(''); setAuditToDate(''); setAuditSearch(''); setAuditPage(0); }}
                style={{ height: 34, padding: '0 12px', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={11} /> {t('audit.clear')}
              </button>
            )}

            <div className="adm-audit-spacer" style={{ flex: 1 }} />

            <button className="adm-export-btn" onClick={exportAuditCSV} disabled={auditExporting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface-ground)', color: auditExporting ? 'var(--text-color-secondary)' : 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '0 14px', height: 34, fontSize: 12.5, fontWeight: 600, cursor: auditExporting ? 'not-allowed' : 'pointer', opacity: auditExporting ? 0.7 : 1 }}>
              <Download size={13} /> {auditExporting ? t('audit.exporting') : t('audit.exportCsv')}
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
          ) : visibleLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('audit.noRecords')}</div>
          ) : isMobile ? (
            <div>
              {visibleLogs.map(log => (
                <div key={log.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{fmtAuditActor(log.actor)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-color)' }}>{fmtAction(log.action)}</div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-color-secondary)' }}>{new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-scroll-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                  {[t('audit.headers.timestamp'), t('audit.headers.user'), t('audit.headers.action')].map((h, i) => (
                    <th key={h} scope="col" style={{ ...LABEL, padding: '11px 16px', textAlign: 'left', ...(i > 0 && { borderLeft: '1px solid var(--surface-border)' }) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map(log => (
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
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {/* Pagination */}
          {!auditLoading && auditTotal > AUDIT_PAGE_SIZE && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)' }}>
              <Pagination page={auditPage + 1} totalPages={totalPages} onChange={p => setAuditPage(p - 1)} />
            </div>
          )}
        </Card>
      </div>
    );
  }

  // All Uploads
  if (activePage === 'alluploads') {
    // When filtering by department use client-side counts (dept scope); otherwise use API totals
    const totalDocs    = user?.dept ? allDocs.length                                       : allDocCounts.count_total;
    const approvedDocs = user?.dept ? allDocs.filter(d => d.status === 'approved').length  : allDocCounts.count_approved;
    const pendingDocs  = user?.dept ? allDocs.filter(d => d.status === 'pending').length   : allDocCounts.count_pending;
    const rejectedDocs = user?.dept ? allDocs.filter(d => d.status === 'rejected').length  : allDocCounts.count_rejected;

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

    const uploadsTotalPages = Math.max(1, Math.ceil(filteredDocs.length / UPLOADS_PAGE_SIZE));
    const clampedUploadsPage = Math.min(uploadsPage, uploadsTotalPages);
    const pageDocs = filteredDocs.slice((clampedUploadsPage - 1) * UPLOADS_PAGE_SIZE, clampedUploadsPage * UPLOADS_PAGE_SIZE);

    const SC = {
      approved: { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)',   label: t('uploads.stats.approved') },
      pending:  { color: '#b45309', bg: 'rgba(255, 193, 7,.1)',  label: t('uploads.stats.pending')  },
      rejected: { color: '#dc3545', bg: 'rgba(220, 53, 69,.1)',   label: t('uploads.stats.rejected') },
    };
    const cols = '4px 1fr 175px 155px 155px 90px';
    const anyFilter = uploadsSearch || uploadsFilterStatus || uploadsFilterUploader || uploadsFilterApprover;

    async function handleDownloadReport() {
      setReportGenerating(true);
      try {
        // allDocs is already scoped server-side to this admin's own department(s) —
        // no department picker needed, the report just covers everything in scope.
        await downloadUploadsExcelReport({ docs: allDocs, departments: [], fileLabel: 'Admin' });
      } finally {
        setReportGenerating(false);
      }
    }

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>
        {/* Stats */}
        <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
          <div className="adm-filter-bar" style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={uploadsSearch}
                onChange={e => setUploadsSearch(e.target.value)}
                placeholder={t('uploads.searchPlaceholder')}
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
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
              <button onClick={() => { setUploadsSearch(''); setUploadsFilterStatus(''); setUploadsFilterUploader(''); setUploadsFilterApprover(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                <X size={11} /> {t('uploads.clear')}
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {t('uploads.countOf', { shown: filteredDocs.length, total: totalDocs })}
            </div>

            <button onClick={handleDownloadReport} disabled={reportGenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: reportGenerating ? 'var(--surface-ground)' : 'var(--primary)', color: reportGenerating ? 'var(--text-color-secondary)' : '#fff',
                border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600,
                cursor: reportGenerating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font)',
              }}>
              {reportGenerating ? <Download size={13} /> : <FileSpreadsheet size={13} />} {reportGenerating ? t('uploads.report.generating') : t('uploads.report.button')}
            </button>
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
                {pageDocs.map(doc => {
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
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('uploads.headers.uploader')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('uploads.headers.status')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('uploads.headers.dates')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('uploads.headers.actions')}</div>
              </div>

              {pageDocs.map(doc => {
                const sc = SC[doc.status] || SC.pending;
                const uploaderName = [doc.uploader_first_name, doc.uploader_last_name].filter(Boolean).join(' ') || doc.uploader_username || '—';
                const approverName = doc.latest_approval
                  ? ([doc.latest_approval.approver_first_name, doc.latest_approval.approver_last_name].filter(Boolean).join(' ') || doc.latest_approval.approver_username)
                  : null;
                const uploadedDate  = doc.created_at ? doc.created_at.split('T')[0] : '—';
                const lastActionDate = doc.latest_approval?.acted_at ? doc.latest_approval.acted_at.split('T')[0] : null;
                return (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: cols, minWidth: 830, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 62, transition: 'background .15s' }}
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
                          {/* Version badge hidden until proper API mapping for versions is wired up — keep for future use.
                          {doc.version_no && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', borderRadius: 4, padding: '1px 5px', border: '1px solid var(--surface-border)' }}>v{doc.version_no}</span>
                          )}
                          */}
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
          {!allDocsLoading && !allDocsError && uploadsTotalPages > 1 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)' }}>
              <Pagination page={clampedUploadsPage} totalPages={uploadsTotalPages} onChange={setUploadsPage} />
            </div>
          )}
        </Card>
      </div>

      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}
      </>
    );
  }

  // Linked Documents view
  if (activePage === 'linkedocs') {
    const LS = {
      approved: { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)',  label: t('linkedDocs.stats.approved') },
      pending:  { color: '#b45309', bg: 'rgba(255, 193, 7,.1)', label: t('linkedDocs.stats.pending')  },
      rejected: { color: '#dc3545', bg: 'rgba(220, 53, 69,.1)',  label: t('linkedDocs.stats.rejected') },
    };

    const uniqueLinkedDepts = [...new Set(allLinks.map(l => l.linked_department_name).filter(Boolean))];

    const filteredLinks = allLinks.filter(l => {
      if (linksFilterStatus && l.link_status !== linksFilterStatus) return false;
      if (linksFilterDept && l.linked_department_name !== linksFilterDept) return false;
      if (linksSearch) {
        const q = linksSearch.toLowerCase();
        if (
          !(l.document_name || '').toLowerCase().includes(q) &&
          !(l.original_department_name || '').toLowerCase().includes(q) &&
          !(l.linked_department_name || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    const totals = { all: allLinks.length, pending: 0, approved: 0, rejected: 0 };
    allLinks.forEach(l => { if (totals[l.link_status] !== undefined) totals[l.link_status]++; });

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>

        {/* Stats */}
        <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('linkedDocs.stats.totalLinks'), value: totals.all,      color: 'var(--primary)', bg: 'rgba(33, 74, 171,.12)',  icon: Link2,       key: '' },
            { label: t('linkedDocs.stats.approved'),    value: totals.approved,  color: '#16a34a',       bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'approved' },
            { label: t('linkedDocs.stats.pending'),     value: totals.pending,   color: '#b45309',       bg: 'rgba(255, 193, 7,.12)', icon: Clock,       key: 'pending'  },
            { label: t('linkedDocs.stats.rejected'),    value: totals.rejected,  color: '#dc3545',       bg: 'rgba(220, 53, 69,.12)',  icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = linksFilterStatus === s.key;
            return (
              <Card key={s.label}
                onClick={() => setLinksFilterStatus(f => f === s.key ? '' : s.key)}
                style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                      {allLinksLoading ? '–' : s.value}
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
          <div className="adm-filter-bar" style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)', pointerEvents: 'none' }} />
              <input
                value={linksSearch}
                onChange={e => setLinksSearch(e.target.value)}
                placeholder={t('linkedDocs.searchPlaceholder')}
                style={{ width: '100%', padding: '7px 12px 7px 30px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <SelectField value={linksFilterDept} onChange={e => setLinksFilterDept(e.target.value)} style={{ flex: '0 0 180px' }}>
              <option value="">{t('linkedDocs.allDepartments')}</option>
              {uniqueLinkedDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </SelectField>
            <SelectField value={linksFilterStatus} onChange={e => setLinksFilterStatus(e.target.value)} style={{ flex: '0 0 130px' }}>
              <option value="">{t('linkedDocs.allStatuses')}</option>
              <option value="pending">{t('linkedDocs.statusPending')}</option>
              <option value="approved">{t('linkedDocs.statusApproved')}</option>
              <option value="rejected">{t('linkedDocs.statusRejected')}</option>
            </SelectField>
            {(linksSearch || linksFilterStatus || linksFilterDept) && (
              <button onClick={() => { setLinksSearch(''); setLinksFilterStatus(''); setLinksFilterDept(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
                <X size={11} /> {t('linkedDocs.clear')}
              </button>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {t('linkedDocs.countOf', { shown: filteredLinks.length, total: allLinks.length })}
            </div>
          </div>

          {allLinksLoading && <div style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('linkedDocs.loadingDocuments')}</div>}
          {allLinksError && <div style={{ padding: '20px 18px', fontSize: 13, color: '#dc3545' }}>{allLinksError}</div>}

          {!allLinksLoading && !allLinksError && (
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
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 110px 150px 80px', minWidth: 950, background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ ...LABEL, padding: '10px 16px' }}>{t('linkedDocs.headers.document')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('linkedDocs.headers.originalDept')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('linkedDocs.headers.linkedDept')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('linkedDocs.headers.status')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('linkedDocs.headers.requesterReviewer')}</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>{t('linkedDocs.headers.view')}</div>
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
                  <div key={link.link_id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 110px 150px 80px', minWidth: 950, borderBottom: '1px solid var(--surface-border)', alignItems: 'stretch', minHeight: 58, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* Document */}
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255, 193, 7,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Link2 size={14} color="#d97706" strokeWidth={2} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                          {link.document_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          {link.document_type_name && <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: 'rgba(255, 193, 7,.1)', borderRadius: 4, padding: '1px 5px' }}>{link.document_type_name}</span>}
                          {/* Version badge hidden until proper API mapping for versions is wired up — keep for future use.
                          {link.version_no && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>v{link.version_no}</span>}
                          */}
                        </div>
                      </div>
                    </div>

                    {/* Original dept */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{link.original_department_name || '—'}</span>
                    </div>

                    {/* Linked-to dept */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{link.linked_department_name || '—'}</span>
                    </div>

                    {/* Status */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, background: ls.bg, color: ls.color, padding: '3px 10px', borderRadius: 20 }}>
                        {ls.label}
                      </span>
                    </div>

                    {/* Requester / Reviewer */}
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-color-secondary)', display: 'block', marginBottom: 1 }}>{t('linkedDocs.requested')}</span>
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

  if (activePage === 'caprequests') {
    const adminDeptId = user?.deptId;
    const selectedRoleId = capReqForm.role_id ? Number(capReqForm.role_id) : null;
    const existingCap = selectedRoleId && adminDeptId
      ? capReqCaps.limits?.find(l => l.role_id === selectedRoleId && l.department_id === adminDeptId)
      : null;
    const currentCap = existingCap != null ? existingCap.max_users : capReqCaps.default_max;

    const INP = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', fontSize: 13, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' };

    function statusBadge(s) {
      if (s === 'approved') return { color: '#16a34a', bg: 'rgba(25,135,84,.1)', label: t('capRequests.statusApproved') };
      if (s === 'rejected') return { color: '#dc3545', bg: 'rgba(220,53,69,.1)', label: t('capRequests.statusRejected') };
      return { color: '#b45309', bg: 'rgba(255,193,7,.1)', label: t('capRequests.statusPending') };
    }

    async function handleCapReqSubmit() {
      if (!capReqForm.role_id)        { setCapReqError(t('capRequests.errors.roleRequired')); return; }
      if (capReqForm.requested_cap === '') { setCapReqError(t('capRequests.errors.capRequired')); return; }
      const reqCap = Number(capReqForm.requested_cap);
      if (isNaN(reqCap) || reqCap < 0) { setCapReqError(t('capRequests.errors.capInvalid')); return; }
      if (capReqActiveCount !== null && reqCap < capReqActiveCount) {
        setCapReqError(t('capRequests.errors.capBelowActive', { count: capReqActiveCount }));
        return;
      }
      setCapReqSaving(true); setCapReqError(''); setCapReqSuccess('');
      try {
        await submitCapRequest({ role_id: Number(capReqForm.role_id), requested_cap: reqCap, reason: capReqForm.reason.trim() || undefined });
        setCapReqForm({ role_id: '', requested_cap: '', reason: '' });
        setCapReqSuccess(t('capRequests.submitSuccess'));
        const res = await getMyCapRequests();
        setCapReqHistory(res.data || []);
      } catch (err) {
        const detail = err.response?.data?.detail;
        setCapReqError(typeof detail === 'string' ? detail : t('capRequests.errors.submitFailed'));
      } finally {
        setCapReqSaving(false);
      }
    }

    const stats = {
      total:    capReqHistory.length,
      pending:  capReqHistory.filter(r => r.status === 'pending').length,
      approved: capReqHistory.filter(r => r.status === 'approved').length,
      rejected: capReqHistory.filter(r => r.status === 'rejected').length,
    };

    const filteredCapReqHistory = capReqFilterStatus
      ? capReqHistory.filter(r => r.status === capReqFilterStatus)
      : capReqHistory;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>

        {/* Stats */}
        <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('capRequests.stats.total'),    value: stats.total,    color: 'var(--primary)', bg: 'rgba(33, 74, 171,.12)', icon: ShieldCheck, key: null },
            { label: t('capRequests.stats.pending'),  value: stats.pending,  color: '#b45309',        bg: 'rgba(255, 193, 7,.12)', icon: Clock,       key: 'pending' },
            { label: t('capRequests.stats.approved'), value: stats.approved, color: '#16a34a',        bg: 'rgba(25, 135, 84,.12)', icon: CheckCircle, key: 'approved' },
            { label: t('capRequests.stats.rejected'), value: stats.rejected, color: '#dc3545',        bg: 'rgba(220, 53, 69,.12)', icon: XCircle,     key: 'rejected' },
          ].map(s => {
            const isActive = capReqFilterStatus === s.key;
            return (
              <Card key={s.label}
                onClick={() => setCapReqFilterStatus(f => (s.key === null ? null : f === s.key ? null : s.key))}
                style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                      {capReqHistoryLoading ? '–' : s.value}
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

        {/* New Request Form */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-p1)', color: 'var(--text-heading)', marginBottom: 4 }}>{t('capRequests.newRequestTitle')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 16 }}>
            {t('capRequests.newRequestSubtitle')}
          </div>
          <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('capRequests.role')} <span style={{ color: '#dc3545' }}>*</span></label>
              <SelectField
                value={capReqForm.role_id}
                onChange={e => { setCapReqForm(f => ({ ...f, role_id: e.target.value, requested_cap: '' })); setCapReqError(''); setCapReqSuccess(''); }}
                placeholder={t('capRequests.selectRole')}
              >
                {assignableRoles(roles).map(r => (
                  <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('capRequests.requestedMaxUsers')} <span style={{ color: '#dc3545' }}>*</span></label>
              <input
                type="number" min="0"
                value={capReqForm.requested_cap}
                onChange={e => { setCapReqForm(f => ({ ...f, requested_cap: e.target.value })); setCapReqError(''); setCapReqSuccess(''); }}
                placeholder={t('capRequests.enterNewCap')}
                style={INP}
              />
              {selectedRoleId && (
                <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{t('capRequests.currentCap')}: <strong style={{ color: 'var(--text-heading)', fontFamily: 'var(--mono)' }}>{currentCap}</strong>{!existingCap && <span> ({t('capRequests.systemDefault')})</span>}</span>
                  <span>
                    {t('capRequests.activeUsersInRole')}:{' '}
                    {capReqActiveLoading
                      ? <span style={{ fontStyle: 'italic' }}>{t('capRequests.loadingShort')}</span>
                      : capReqActiveCount !== null
                        ? <strong style={{ color: capReqActiveCount > 0 ? '#b45309' : 'var(--text-heading)', fontFamily: 'var(--mono)' }}>{capReqActiveCount}</strong>
                        : '—'
                    }
                    {capReqActiveCount !== null && <span style={{ color: 'var(--text-color-secondary)' }}> ({t('capRequests.minimumRequestableCap')})</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('capRequests.reasonOptional')}</label>
            <textarea
              value={capReqForm.reason}
              onChange={e => setCapReqForm(f => ({ ...f, reason: e.target.value }))}
              placeholder={t('capRequests.reasonPlaceholder')}
              rows={3}
              style={{ ...INP, resize: 'vertical' }}
            />
          </div>
          {capReqError && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,53,69,.08)', border: '1px solid rgba(220,53,69,.25)', borderRadius: 8, fontSize: 12.5, color: '#dc3545' }}>
              ⚠ {capReqError}
            </div>
          )}
          {capReqSuccess && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(25,135,84,.08)', border: '1px solid rgba(25,135,84,.25)', borderRadius: 8, fontSize: 12.5, color: '#16a34a' }}>
              ✓ {capReqSuccess}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleCapReqSubmit} disabled={capReqSaving}
              style={{ padding: '9px 22px', background: capReqSaving ? 'var(--surface-border)' : 'var(--primary)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: capReqSaving ? 'not-allowed' : 'pointer', color: capReqSaving ? 'var(--text-color-secondary)' : 'white', fontFamily: 'var(--font)' }}>
              {capReqSaving ? t('capRequests.submitting') : t('capRequests.submitRequest')}
            </button>
          </div>
        </Card>

        {/* Request History */}
        <Card padding="0">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-p2)', color: 'var(--text-heading)' }}>{t('capRequests.requestHistory')}</div>
            {capReqFilterStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 20, background: statusBadge(capReqFilterStatus).bg, border: `1px solid ${statusBadge(capReqFilterStatus).color}4d`, fontSize: 11.5, fontWeight: 600, color: statusBadge(capReqFilterStatus).color, whiteSpace: 'nowrap' }}>
                {statusBadge(capReqFilterStatus).label}
                <button onClick={() => setCapReqFilterStatus(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}><X size={11} /></button>
              </div>
            )}
          </div>
          {capReqHistoryLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('capRequests.loading')}</div>
          ) : filteredCapReqHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>
              {capReqHistory.length === 0 ? t('capRequests.noRequestsYet') : t('capRequests.noMatch')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px 100px 1fr', minWidth: 780, padding: '9px 16px', background: 'var(--surface-ground)', borderBottom: '1px solid var(--surface-border)' }}>
                {[t('capRequests.headers.roleReason'), t('capRequests.headers.currentCap'), t('capRequests.headers.requested'), t('capRequests.headers.status'), t('capRequests.headers.date'), t('capRequests.headers.superAdminNote')].map(h => (
                  <div key={h} style={{ ...LABEL }}>{h}</div>
                ))}
              </div>
              {filteredCapReqHistory.map(req => {
                const sb = statusBadge(req.status);
                return (
                  <div key={req.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px 100px 1fr', minWidth: 780, padding: '10px 16px', borderBottom: '1px solid var(--surface-border)', alignItems: 'center', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{req.role_name}</div>
                      {req.reason && <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>{req.reason}</div>}
                    </div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
                      {req.current_cap != null ? req.current_cap : <span style={{ fontSize: 11 }}>{t('capRequests.defaultCap', { n: capReqCaps.default_max })}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-heading)' }}>{req.requested_cap}</div>
                    <div>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: sb.color, background: sb.bg }}>{sb.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{req.created_at?.split('T')[0] || '—'}</div>
                    {/* <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{req.super_admin_note || '—'}</div> */}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return null;
}

