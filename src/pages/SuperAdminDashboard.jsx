import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Users, Trash2, Edit2, Plus, CheckCircle, XCircle, Building2, X, Eye, EyeOff, Check, Download, FileSpreadsheet, Layers, FileText, Clock, Search, Link2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import DocViewModal from '../components/DocViewModal';
import { getUsers, getRoles, updateUser, registerUser, getApproversByDepartment } from '../services/users';
import { getDepartments, createDepartment, toggleDepartment, getDocumentTypes, createDocumentType, toggleDocumentType } from '../services/departments';
import { getRoleCaps, upsertRoleCap, deleteRoleCap, getActiveUserCount } from '../services/roleCaps';
import { getAllDocumentsAdmin, getAllDepartmentLinks } from '../services/pdf';
import { getAuditLogs, getAuditLogActions } from '../services/audit';
import { getPendingCapRequests, reviewCapRequest } from '../services/capRequests';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { downloadUploadsExcelReport } from '../utils/uploadsExcelReport';
import { downloadDailyReportExcel } from '../utils/dailyReportExcel';
import { getDailyDepartmentReport } from '../services/pdf';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

// Admin creates/manages every account except other admins — there is only ever one admin, seeded up front.
// Citizens are public users, not staff accounts — no one creates a "citizen" login from a dashboard.
const ADMIN_ROLE_NAMES = new Set(['super_admin', 'citizen']);
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
const CAPS_PAGE_SIZE = 10;
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

export default function SuperAdminDashboard({ activePage, taxonomy = [], onUpdateTaxonomy }) {
  const { t } = useTranslation('admin');
  const isMobile = useMediaQuery('(max-width: 640px)');
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
      .catch(() => setUsersError(t('users.failedToLoadUsers')))
      .finally(() => setUsersLoading(false));
  }, [activePage, t]);

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
    if (!['taxonomy', 'users'].includes(activePage)) return;
    setDeptsLoading(true);
    setDeptsError('');
    getDepartments()
      .then(res => setDepts(res.data))
      .catch(() => setDeptsError(t('taxonomy.errors.departmentsLoadFailed')))
      .finally(() => setDeptsLoading(false));
  }, [activePage, t]);

  // Document Types state
  const [docTypes, setDocTypes]               = useState([]);
  const [docTypesLoading, setDocTypesLoading] = useState(false);
  const [docTypesError, setDocTypesError]     = useState('');
  const [docTypeCreating, setDocTypeCreating]         = useState(false);
  const [docTypeCreateError, setDocTypeCreateError]   = useState('');
  const [deptMdmCreating, setDeptMdmCreating]         = useState(false);
  const [deptMdmCreateError, setDeptMdmCreateError]   = useState('');
  const [mdmToggling, setMdmToggling]                 = useState(null); // { category, id }
  const [confirmToggleMdm, setConfirmToggleMdm]       = useState(null); // { category, item }

  useEffect(() => {
    if (activePage !== 'taxonomy') return;
    setDocTypesLoading(true);
    setDocTypesError('');
    getDocumentTypes()
      .then(res => setDocTypes(res.data))
      .catch(() => setDocTypesError(t('taxonomy.errors.docTypesLoadFailed')))
      .finally(() => setDocTypesLoading(false));
  }, [activePage, t]);

  // All Uploads state
  const [allDocs, setAllDocs]           = useState([]);
  const [allDocCounts, setAllDocCounts] = useState({ count_total: 0, count_pending: 0, count_approved: 0, count_rejected: 0 });
  const [allDocsLoading, setAllDocsLoading] = useState(false);
  const [allDocsError, setAllDocsError] = useState('');
  const [uploadsSearch, setUploadsSearch] = useState('');
  const [uploadsFilterStatus, setUploadsFilterStatus] = useState('');
  const [uploadsFilterUploader, setUploadsFilterUploader] = useState('');
  const [uploadsFilterApprover, setUploadsFilterApprover] = useState('');
  const [uploadsFilterDept, setUploadsFilterDept]         = useState('');
  const [viewDoc, setViewDoc]                             = useState(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [dailyReportDate, setDailyReportDate]     = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyReportError, setDailyReportError]   = useState('');
  const [uploadsPage, setUploadsPage] = useState(1); // client-side pagination over filteredDocs — only 10 shown at a time
  const UPLOADS_PAGE_SIZE = 10;
  useEffect(() => { setUploadsPage(1); }, [uploadsSearch, uploadsFilterStatus, uploadsFilterUploader, uploadsFilterApprover, uploadsFilterDept]);

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
  }, [activePage, t]);

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

  // Role Caps state
  const [capsDefaultMax, setCapsDefaultMax] = useState(null);
  const [caps, setCaps]                 = useState([]);
  const [capsLoading, setCapsLoading]   = useState(false);
  const [capsError, setCapsError]       = useState('');
  const [capForm, setCapForm]           = useState({ department_id: '', role_id: '', max_users: '' });
  const [capFormError, setCapFormError] = useState('');
  const [capSaving, setCapSaving]       = useState(false);
  const [capEditId, setCapEditId]             = useState(null);
  const [capEditVal, setCapEditVal]           = useState('');
  const [capEditActiveCount, setCapEditActiveCount] = useState(null);
  const [capEditError, setCapEditError]       = useState('');
  const [capDeptSearch, setCapDeptSearch]   = useState('');
  const [capDeptOpen, setCapDeptOpen]       = useState(false);
  const [capActiveCount, setCapActiveCount] = useState(null);
  const [capsPage, setCapsPage]             = useState(0);

  // Pending cap-change requests from admins
  const [pendingCapReqs, setPendingCapReqs]         = useState([]);
  const [pendingCapReqsLoading, setPendingCapReqsLoading] = useState(false);
  const [capReqReviewing, setCapReqReviewing]         = useState(null); // id being reviewed
  const [capReqRejectNote, setCapReqRejectNote]       = useState('');
  const [capReqRejectOpen, setCapReqRejectOpen]       = useState(null); // id for reject note modal
  const [capReqFinalCaps, setCapReqFinalCaps]         = useState({}); // { [req.id]: string } super admin override values
  const [capReqActiveCounts, setCapReqActiveCounts]   = useState({}); // { [req.id]: number | null }
  const [capReqApproveErrors, setCapReqApproveErrors] = useState({}); // { [req.id]: string }

  useEffect(() => {
    if (!capForm.department_id || !capForm.role_id) {
      setCapActiveCount(null);
      return;
    }
    const existing = caps.find(
      c => String(c.department_id) === String(capForm.department_id) && String(c.role_id) === String(capForm.role_id)
    );
    setCapForm(f => ({ ...f, max_users: existing ? String(existing.max_users) : (capsDefaultMax != null ? String(capsDefaultMax) : '') }));
    setCapActiveCount(null);
    getActiveUserCount(capForm.department_id, capForm.role_id)
      .then(res => setCapActiveCount(res.data.active_count))
      .catch(() => setCapActiveCount(null));
  }, [capForm.department_id, capForm.role_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activePage !== 'rolecaps') return;
    setCapsLoading(true);
    setCapsError('');
    setPendingCapReqsLoading(true);
    Promise.all([getRoleCaps(), getDepartments(), getRoles(), getPendingCapRequests()])
      .then(([capsRes, deptsRes, rolesRes, pendingRes]) => {
        setCapsDefaultMax(capsRes.data.default_max);
        setCaps(capsRes.data.limits);
        setDepts(deptsRes.data);
        setRoles(rolesRes.data);
        const reqs = pendingRes.data || [];
        setPendingCapReqs(reqs);
        // Fetch active user counts for every pending request in parallel
        Promise.all(
          reqs.map(req =>
            getActiveUserCount(req.department_id, req.role_id)
              .then(res => ({ id: req.id, count: res.data.active_count ?? null }))
              .catch(() => ({ id: req.id, count: null }))
          )
        ).then(results => {
          const map = {};
          results.forEach(r => { map[r.id] = r.count; });
          setCapReqActiveCounts(map);
        });
      })
      .catch(() => setCapsError(t('roleCaps.errors.loadFailed')))
      .finally(() => { setCapsLoading(false); setPendingCapReqsLoading(false); });
  }, [activePage, t]);

  function handleCapSave(e) {
    e.preventDefault();
    if (!capForm.department_id) { setCapFormError(t('roleCaps.errors.deptRequired')); return; }
    if (!capForm.role_id)       { setCapFormError(t('roleCaps.errors.roleRequired')); return; }
    const max = parseInt(capForm.max_users, 10);
    if (isNaN(max) || max < 0) { setCapFormError(t('roleCaps.errors.maxRequired')); return; }
    if (capActiveCount !== null && max < capActiveCount) {
      setCapFormError(t('roleCaps.errors.belowActiveCount', { count: capActiveCount, defaultValue: `${capActiveCount} users are already active with this role in this department. Cap must be at least ${capActiveCount}.` }));
      return;
    }
    setCapSaving(true);
    setCapFormError('');
    upsertRoleCap({ department_id: Number(capForm.department_id), role_id: Number(capForm.role_id), max_users: max })
      .then(() => getRoleCaps().then(r => { setCapsDefaultMax(r.data.default_max); setCaps(r.data.limits); setCapForm({ department_id: '', role_id: '', max_users: '' }); setCapDeptSearch(''); setCapActiveCount(null); }))
      .catch(() => setCapFormError(t('roleCaps.errors.saveFailed')))
      .finally(() => setCapSaving(false));
  }

  function handleCapInlineEdit(cap) {
    setCapEditId(cap.id);
    setCapEditVal(String(cap.max_users));
    setCapEditError('');
    setCapEditActiveCount(null);
    getActiveUserCount(cap.department_id, cap.role_id)
      .then(res => setCapEditActiveCount(res.data.active_count))
      .catch(() => setCapEditActiveCount(null));
  }

  function handleCapInlineSave(cap) {
    const max = parseInt(capEditVal, 10);
    if (isNaN(max) || max < 0) { setCapEditError('Please enter a valid non-negative number.'); return; }
    if (capEditActiveCount !== null && max < capEditActiveCount) {
      setCapEditError(`${capEditActiveCount} user${capEditActiveCount !== 1 ? 's' : ''} are currently active in this role. Cap must be at least ${capEditActiveCount}.`);
      return;
    }
    setCapEditError('');
    upsertRoleCap({ department_id: cap.department_id, role_id: cap.role_id, max_users: max })
      .then(() => {
        setCaps(prev => prev.map(c => c.id === cap.id ? { ...c, max_users: max } : c));
        setCapEditId(null);
        setCapEditActiveCount(null);
      })
      .catch(() => setCapEditError('Failed to save. Please try again.'));
  }

  function handleCapDelete(cap) {
    if (!window.confirm(t('roleCaps.deleteConfirm', { role: cap.role_name, dept: cap.department_name, default: capsDefaultMax }))) return;
    deleteRoleCap(cap.department_id, cap.role_id)
      .then(() => setCaps(prev => prev.filter(c => c.id !== cap.id)))
      .catch(() => {});
  }

  function handleCreateDept(e) {
    e.preventDefault();
    if (!newDept.name.trim()) { setCreateError(t('taxonomy.errors.departmentNameRequired')); return; }
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    createDepartment({ name: newDept.name.trim(), description: newDept.description.trim() })
      .then(res => {
        setDepts(prev => [...prev, res.data]);
        setNewDept({ name: '', description: '' });
        setAddDeptOpen(false);
        setCreateSuccess(t('taxonomy.createSuccess', { name: res.data.name }));
        setTimeout(() => setCreateSuccess(''), 3000);
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        setCreateError(typeof detail === 'string' ? detail : t('taxonomy.errors.createDepartmentFailed'));
      })
      .finally(() => setCreating(false));
  }

  function closeAddDept() {
    setAddDeptOpen(false);
    setNewDept({ name: '', description: '' });
    setCreateError('');
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
    setDeptMdmCreateError('');
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
        .catch(err => setDocTypeCreateError(err.response?.data?.detail || t('taxonomy.errors.createDocTypeFailed')))
        .finally(() => setDocTypeCreating(false));
      return;
    }
    if (addState.category === 'Departments') {
      const name = addState.value.trim();
      if (depts.some(d => d.name === name)) return;
      setDeptMdmCreating(true);
      setDeptMdmCreateError('');
      createDepartment({ name, description: '' })
        .then(res => { setDepts(prev => [...prev, res.data]); setAddState(null); })
        .catch(err => setDeptMdmCreateError(err.response?.data?.detail || t('taxonomy.errors.createDeptFailed')))
        .finally(() => setDeptMdmCreating(false));
      return;
    }
    const t = taxonomy.find(t => t.category === addState.category);
    if (t.items.includes(addState.value.trim())) return;
    updateCategory(addState.category, [...t.items, addState.value.trim()]);
    setAddState(null);
  }

  function handleMdmToggle(category, item) {
    const id = item.id;
    setConfirmToggleMdm(null);
    setMdmToggling({ category, id });
    const toggleFn = category === 'Departments' ? toggleDepartment : toggleDocumentType;
    toggleFn(id)
      .then(res => {
        if (category === 'Departments') {
          setDepts(prev => prev.map(d => d.id === id ? res.data : d));
        } else {
          setDocTypes(prev => prev.map(dt => dt.id === id ? res.data : dt));
        }
      })
      .catch(() => {})
      .finally(() => setMdmToggling(null));
  }

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
  const EMPTY_ADD_FORM = { username: '', email: '', mobile_number: '', password: '', first_name: '', last_name: '', role_id: '', department_id: '', approver_id: '' };
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
      department_id: String(u.deptId ?? ''),
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
  const [statusFilter, setStatusFilter] = useState(null); // null | 'active' | 'inactive'
  const [deptFilter, setDeptFilter]     = useState('');   // '' | dept id string
  const [usersPage, setUsersPage]       = useState(1); // client-side pagination over filteredUsers — only 10 shown at a time
  const USERS_PAGE_SIZE = 10;
  useEffect(() => { setUsersPage(1); }, [statusFilter, deptFilter]);

  if (activePage === 'users') {
    const active   = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

    const filteredUsers = users
      .filter(u => !statusFilter || u.status === statusFilter)
      .filter(u => !deptFilter   || u.deptIds.includes(Number(deptFilter)) || u.deptId === Number(deptFilter));

    const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
    const clampedUsersPage = Math.min(usersPage, usersTotalPages);
    const pageUsers = filteredUsers.slice((clampedUsersPage - 1) * USERS_PAGE_SIZE, clampedUsersPage * USERS_PAGE_SIZE);

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
            { label: t('users.stats.totalUsers'), value: users.length, color: 'var(--primary)',  bg: 'rgba(33, 74, 171,.12)',  icon: Users,       key: null },
            { label: t('users.stats.active'),      value: active,       color: '#198754',         bg: 'rgba(25, 135, 84,.12)',  icon: CheckCircle, key: 'active' },
            { label: t('users.stats.inactive'),    value: inactive,     color: '#b45309',         bg: 'rgba(255, 193, 7,.12)', icon: XCircle,     key: 'inactive' },
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
              {depts.length > 0 && (
                <SelectField value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ flex: '0 0 180px' }}>
                  <option value="">All Departments</option>
                  {depts.filter(d => d.is_active !== false).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </SelectField>
              )}
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
                            onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value, department_id: '', approver_id: '' }))}
                            placeholder={t('users.addDrawer.roleSelectPlaceholder')}
                          >
                            {assignableRoles(roles).map(r => (
                              <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                            ))}
                          </SelectField>
                        </div>
                        <div>
                          <label htmlFor="adm-add-department" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('users.addDrawer.department')} <span style={{ color: '#dc3545' }}>*</span></label>
                          <SelectField id="adm-add-department" required value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value, approver_id: '' }))} placeholder={t('users.addDrawer.departmentSelectPlaceholder')}>
                            {depts.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                    <label htmlFor="sa-edit-mobile" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Mobile Number</label>
                    <input id="sa-edit-mobile" style={INP_STYLE} type="tel" maxLength={10}
                      value={editForm.mobile_number ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, mobile_number: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                </div>

                {(() => {
                  const isUploaderEdit = _editFormRoleName === 'uploader';
                  const editDeptName = depts.find(d => String(d.id) === String(editForm.department_id))?.name ?? editForm.department_id ?? '—';
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
                            {editDeptName}
                          </div>
                        </div>
                      </div>
                      {isUploaderEdit && (
                        <div>
                          <label htmlFor="sa-edit-approver" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Approver</label>
                          <SelectField
                            id="sa-edit-approver"
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

  // Master Data Manager
  if (activePage === 'taxonomy') {
    const INPUT_STYLE = {
      flex: 1, border: '1px solid var(--primary)', borderRadius: 6, padding: '4px 8px',
      fontSize: 12.5, outline: 'none', fontFamily: 'var(--font)', color: 'var(--text-color)',
      background: 'var(--surface-card)',
    };
    const BTN = (color, label, onClick, disabled = false) => (
      <button onClick={onClick} disabled={disabled} style={{
        background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-color-secondary)' : color, padding: '2px 4px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
      }}>{label}</button>
    );
    return (
      <>
      <style>{ADM_RESPONSIVE_CSS}</style>
      <div className="adm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {taxonomy.map(cat => {
          const isApiDriven  = cat.category === 'Departments' || cat.category === 'Document Types';
          const canCreateApi = cat.category === 'Document Types' || cat.category === 'Departments';
          const apiItems     = cat.category === 'Departments' ? depts : cat.category === 'Document Types' ? docTypes : [];
          const apiLoading   = cat.category === 'Departments' ? deptsLoading : docTypesLoading;
          const apiError     = cat.category === 'Departments' ? deptsError : cat.category === 'Document Types' ? docTypesError : '';
          const displayItems = isApiDriven ? apiItems : cat.items;
          const addCreating  = cat.category === 'Document Types' ? docTypeCreating : cat.category === 'Departments' ? deptMdmCreating : false;
          const addError     = cat.category === 'Document Types' ? docTypeCreateError : cat.category === 'Departments' ? deptMdmCreateError : '';
          const activeCount  = isApiDriven ? apiItems.filter(d => d.is_active !== false).length : cat.items.length;

          return (
          <Card key={cat.category}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{cat.category}</div>
                <div style={{ fontSize: 11, color: apiError ? '#dc3545' : 'var(--text-color-secondary)', marginTop: 2 }}>
                  {isApiDriven
                    ? (apiLoading ? t('taxonomy.loading') : apiError || t('taxonomy.activeOfTotal', { active: activeCount, total: apiItems.length }))
                    : t('taxonomy.itemsCount', { count: cat.items.length })
                  }
                </div>
              </div>
              {(!isApiDriven || canCreateApi) && (
                <button
                  onClick={() => {
                    if (cat.category === 'Departments') {
                      setNewDept({ name: '', description: '' });
                      setCreateError('');
                      setAddDeptOpen(true);
                    } else {
                      startAdd(cat.category);
                    }
                  }}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={11} /> {t('taxonomy.add')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="adm-mdm-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 4 }}>
              {displayItems.map((item, idx) => {
                const isApiItem  = isApiDriven;
                const itemName   = isApiItem ? item.name : item;
                const isActive   = isApiItem ? item.is_active !== false : true;
                const isToggling = isApiItem && mdmToggling?.category === cat.category && mdmToggling?.id === item.id;
                const isEditing  = !isApiDriven && editState?.category === cat.category && editState?.index === idx;

                return (
                  <div key={isApiItem ? item.id : item + idx} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7,
                    background: isEditing ? 'rgba(33, 74, 171,.04)' : 'var(--surface-ground)',
                    border: `1px solid ${isEditing ? 'var(--primary-border)' : 'var(--surface-border)'}`,
                  }}>
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editState.value}
                          onChange={e => setEditState(s => ({ ...s, value: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditState(null); }}
                          style={INPUT_STYLE}
                        />
                        {BTN('var(--primary)', t('taxonomy.save'), saveEdit)}
                        {BTN('var(--text-color-secondary)', t('taxonomy.cancel'), () => setEditState(null))}
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 12.5, color: 'var(--text-color)', flex: 1 }}>{itemName}</span>
                        {isApiItem && (
                          <button
                            onClick={() => setConfirmToggleMdm({ category: cat.category, item })}
                            disabled={isToggling}
                            title={isActive ? t('taxonomy.deactivate') : t('taxonomy.activate')}
                            style={{ background: 'transparent', border: 'none', cursor: isToggling ? 'not-allowed' : 'pointer', color: isActive ? '#dc3545' : '#198754', padding: 2, display: 'flex' }}>
                            {isToggling
                              ? <div style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                              : isActive ? <Trash2 size={11} /> : <Check size={11} />
                            }
                          </button>
                        )}
                        {!isApiDriven && (
                          <>
                            <button onClick={() => startEdit(cat.category, idx, item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', padding: 2, display: 'flex' }} title={t('taxonomy.edit')}>
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deleteItem(cat.category, idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc3545', padding: 2, display: 'flex' }} title={t('taxonomy.delete')}>
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              </div>

              {(!isApiDriven || canCreateApi) && addState?.category === cat.category && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, background: 'rgba(33, 74, 171,.04)', border: '1px solid var(--primary-border)' }}>
                    <input
                      autoFocus
                      placeholder={t('taxonomy.newItemPlaceholder', { category: cat.category.replace(/s$/, '').toLowerCase() })}
                      value={addState.value}
                      disabled={addCreating}
                      onChange={e => setAddState(s => ({ ...s, value: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setAddState(null); }}
                      style={INPUT_STYLE}
                    />
                    {BTN('var(--primary)', addCreating ? t('taxonomy.adding') : t('taxonomy.add'), saveAdd, addCreating)}
                    {BTN('var(--text-color-secondary)', t('taxonomy.cancel'), () => setAddState(null))}
                  </div>
                  {addError && (
                    <div style={{ fontSize: 11, color: '#dc3545', padding: '0 4px' }}>{addError}</div>
                  )}
                </div>
              )}
            </div>
          </Card>
          );
        })}
      </div>

      {createSuccess && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 400, padding: '10px 16px', background: 'var(--surface-card)', border: '1px solid rgba(25, 135, 84,.25)', borderRadius: 9, fontSize: 12.5, color: '#16a34a', boxShadow: '0 8px 24px rgba(0,0,0,.12)', display: 'flex', gap: 7, alignItems: 'center' }}>
          <CheckCircle size={13} /> {createSuccess}
        </div>
      )}

      {/* Add Department drawer */}
      {addDeptOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }} onClick={closeAddDept} />
          <div className="adm-drawer" style={{
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
                <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('taxonomy.addDepartment.title')}</div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: 1 }}>{t('taxonomy.addDepartment.subtitle')}</div>
              </div>
              <button onClick={closeAddDept}
                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="adm-add-dept-name" style={{ ...LABEL, display: 'block', marginBottom: 7 }}>{t('taxonomy.addDepartment.name')} <span style={{ color: '#dc3545' }}>*</span></label>
                <input
                  id="adm-add-dept-name"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 13px', background: 'var(--surface-ground)',
                    border: `1px solid ${createError && !newDept.name.trim() ? 'rgba(220, 53, 69,.6)' : 'var(--surface-border)'}`,
                    borderRadius: 9, fontSize: 13, color: 'var(--text-color)', outline: 'none', fontFamily: 'var(--font)',
                  }}
                  placeholder={t('taxonomy.addDepartment.namePlaceholder')}
                  value={newDept.name}
                  onChange={e => { setNewDept(p => ({ ...p, name: e.target.value })); setCreateError(''); }}
                />
              </div>

              <div>
                <label htmlFor="adm-add-dept-desc" style={{ ...LABEL, display: 'block', marginBottom: 7 }}>{t('taxonomy.addDepartment.description')}</label>
                <textarea
                  id="adm-add-dept-desc"
                  rows={5}
                  style={{
                    width: '100%', padding: '10px 13px', background: 'var(--surface-ground)',
                    border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13,
                    color: 'var(--text-color)', outline: 'none', fontFamily: 'var(--font)',
                    resize: 'vertical', lineHeight: 1.55,
                  }}
                  placeholder={t('taxonomy.addDepartment.descriptionPlaceholder')}
                  value={newDept.description}
                  onChange={e => setNewDept(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              {createError && (
                <div style={{ padding: '9px 12px', background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', borderRadius: 8, fontSize: 12.5, color: '#dc3545', display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span>⚠</span> {createError}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeAddDept}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('taxonomy.addDepartment.cancel')}
              </button>
              {(() => {
                const deptBtnDisabled = creating || !newDept.name.trim();
                return (
                  <button
                    type="button"
                    disabled={deptBtnDisabled}
                    onClick={handleCreateDept}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      background: deptBtnDisabled ? 'var(--surface-border)' : 'var(--primary)',
                      color: deptBtnDisabled ? 'var(--text-color-secondary)' : 'white',
                      border: 'none', borderRadius: 8, padding: '9px 20px',
                      fontSize: 13, fontWeight: 700, cursor: deptBtnDisabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {creating
                      ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/> {t('taxonomy.addDepartment.creating')}</>
                      : <><Plus size={14} /> {t('taxonomy.addDepartment.addDepartment')}</>
                    }
                  </button>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Activate/Deactivate Confirm Modal (Master Data) */}
      {confirmToggleMdm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmToggleMdm(null); }}>
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
            {(() => {
              const { category, item } = confirmToggleMdm;
              const isActive = item.is_active !== false;
              return (
                <>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {isActive ? t('taxonomy.confirmToggle.deactivateTitle', { category }) : t('taxonomy.confirmToggle.activateTitle', { category })}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                    {isActive
                      ? <Trans t={t} i18nKey="taxonomy.confirmToggle.confirmDeactivate" values={{ name: item.name }} components={[<strong key="s" style={{ color: 'var(--text-heading)' }} />]} />
                      : <Trans t={t} i18nKey="taxonomy.confirmToggle.confirmActivate" values={{ name: item.name }} components={[<strong key="s" style={{ color: 'var(--text-heading)' }} />]} />}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button onClick={() => setConfirmToggleMdm(null)}
                      style={{ padding: '9px 18px', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color)', fontFamily: 'var(--font)' }}>
                      {t('taxonomy.confirmToggle.cancel')}
                    </button>
                    <button onClick={() => handleMdmToggle(category, item)}
                      style={{ padding: '9px 20px', background: isActive ? '#dc3545' : '#198754', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'white', fontFamily: 'var(--font)' }}>
                      {isActive ? t('taxonomy.confirmToggle.deactivate') : t('taxonomy.confirmToggle.activate')}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
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
    const totalDocs    = allDocCounts.count_total;
    const approvedDocs = allDocCounts.count_approved;
    const pendingDocs  = allDocCounts.count_pending;
    const rejectedDocs = allDocCounts.count_rejected;

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
      if (uploadsFilterDept) {
        const dName = depts.find(dep => String(dep.id) === uploadsFilterDept)?.name;
        if (dName && d.department_name !== dName) return false;
      }
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
    const anyFilter = uploadsSearch || uploadsFilterStatus || uploadsFilterUploader || uploadsFilterApprover || uploadsFilterDept;

    async function handleDownloadReport() {
      setReportGenerating(true);
      try {
        const deptLabel = uploadsFilterDept
          ? (depts.find(d => String(d.id) === uploadsFilterDept)?.name || 'Department')
          : 'AllDepartments';
        const allDeptNames = !uploadsFilterDept ? depts.map(d => d.name) : [];
        await downloadUploadsExcelReport({ docs: filteredDocs, departments: [], allDeptNames, fileLabel: deptLabel });
      } finally {
        setReportGenerating(false);
      }
    }

    async function handleDailyReport() {
      if (!dailyReportDate) return;
      setDailyReportLoading(true);
      setDailyReportError('');
      try {
        const res = await getDailyDepartmentReport(dailyReportDate);
        const rows = res.data.rows || [];
        if (rows.length === 0) {
          setDailyReportError('No data found for the selected date.');
          return;
        }
        await downloadDailyReportExcel(dailyReportDate, rows);
      } catch {
        setDailyReportError('Failed to generate report. Please try again.');
      } finally {
        setDailyReportLoading(false);
      }
    }

    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>

        {/* Daily Report */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font)', marginBottom: 2 }}>
                Daily Department Report
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', fontFamily: 'var(--font)' }}>
                Department-wise uploads, approvals and user counts for a selected date
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={dailyReportDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => { setDailyReportDate(e.target.value); setDailyReportError(''); }}
                style={{
                  padding: '7px 12px', background: 'var(--surface-ground)',
                  border: '1px solid var(--surface-border)', borderRadius: 8,
                  fontSize: 13, color: 'var(--text-color)', outline: 'none',
                  fontFamily: 'var(--font)', cursor: 'pointer',
                }}
              />
              <button
                onClick={handleDailyReport}
                disabled={dailyReportLoading || !dailyReportDate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: (dailyReportLoading || !dailyReportDate) ? 'var(--surface-ground)' : 'var(--primary)',
                  color: (dailyReportLoading || !dailyReportDate) ? 'var(--text-color-secondary)' : '#fff',
                  border: 'none', borderRadius: 8, padding: '7px 16px',
                  fontSize: 13, fontWeight: 600, cursor: (dailyReportLoading || !dailyReportDate) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}
              >
                {dailyReportLoading ? <Download size={13} /> : <FileSpreadsheet size={13} />}
                {dailyReportLoading ? 'Generating…' : 'Download Daily Report'}
              </button>
            </div>
          </div>
          {dailyReportError && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#dc3545', fontFamily: 'var(--font)' }}>
              {dailyReportError}
            </div>
          )}
        </Card>

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
            <SelectField value={uploadsFilterDept} onChange={e => setUploadsFilterDept(e.target.value)} style={{ flex: '0 0 175px' }}>
              <option value="">All Departments</option>
              {depts.filter(d => d.is_active !== false).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </SelectField>
            {anyFilter && (
              <button onClick={() => { setUploadsSearch(''); setUploadsFilterStatus(''); setUploadsFilterUploader(''); setUploadsFilterApprover(''); setUploadsFilterDept(''); }}
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

  if (activePage === 'rolecaps') {
    const assignable = assignableRoles(roles);
    const capsTotalPages = Math.max(1, Math.ceil(caps.length / CAPS_PAGE_SIZE));
    const capsPageClamped = Math.min(capsPage, capsTotalPages - 1);
    const pagedCaps = caps.slice(capsPageClamped * CAPS_PAGE_SIZE, capsPageClamped * CAPS_PAGE_SIZE + CAPS_PAGE_SIZE);

    async function handleCapReqApprove(req) {
      const rawVal = capReqFinalCaps[req.id];
      const finalCap = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : req.requested_cap;
      if (isNaN(finalCap) || finalCap < 0) {
        setCapReqApproveErrors(prev => ({ ...prev, [req.id]: 'Cap must be 0 or more.' }));
        return;
      }
      const activeCount = capReqActiveCounts[req.id];
      if (activeCount !== null && activeCount !== undefined && finalCap < activeCount) {
        setCapReqApproveErrors(prev => ({ ...prev, [req.id]: `${activeCount} user${activeCount !== 1 ? 's' : ''} are currently active in this role. Cap must be at least ${activeCount}.` }));
        return;
      }
      setCapReqApproveErrors(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setCapReqReviewing(req.id);
      try {
        await reviewCapRequest(req.id, { status: 'approved', approved_cap: finalCap });
        setPendingCapReqs(prev => prev.filter(r => r.id !== req.id));
        setCapReqFinalCaps(prev => { const n = { ...prev }; delete n[req.id]; return n; });
        setCapReqActiveCounts(prev => { const n = { ...prev }; delete n[req.id]; return n; });
        getRoleCaps().then(r => { setCapsDefaultMax(r.data.default_max); setCaps(r.data.limits); }).catch(() => {});
      } catch (err) {
        setCapReqApproveErrors(prev => ({ ...prev, [req.id]: err.response?.data?.detail || 'Failed to approve request.' }));
      } finally {
        setCapReqReviewing(null);
      }
    }

    async function handleCapReqReject(req) {
      setCapReqReviewing(req.id);
      try {
        await reviewCapRequest(req.id, { status: 'rejected', super_admin_note: capReqRejectNote.trim() || undefined });
        setPendingCapReqs(prev => prev.filter(r => r.id !== req.id));
        setCapReqRejectOpen(null);
        setCapReqRejectNote('');
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to reject request.');
      } finally {
        setCapReqReviewing(null);
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{ADM_RESPONSIVE_CSS}</style>

        {/* Pending cap-change requests from admins */}
        {(pendingCapReqsLoading || pendingCapReqs.length > 0) && (
          <Card padding="0">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-p1)', color: 'var(--text-heading)' }}>Pending Cap Change Requests</div>
                <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>Admins are requesting changes to role user caps for their departments.</div>
              </div>
              {pendingCapReqs.length > 0 && (
                <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(255,193,7,.15)', border: '1px solid rgba(180,130,0,.25)', fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                  {pendingCapReqs.length} pending
                </span>
              )}
            </div>
            {pendingCapReqsLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>Loading…</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 110px 1fr 180px', minWidth: 860, padding: '9px 16px', background: 'var(--surface-ground)', borderBottom: '1px solid var(--surface-border)' }}>
                  {['Department', 'Role / Requested By', 'Current Cap', 'Requested Cap', 'Reason', 'Actions'].map(h => (
                    <div key={h} style={{ ...LABEL }}>{h}</div>
                  ))}
                </div>
                {pendingCapReqs.map(req => {
                  const isReviewing = capReqReviewing === req.id;
                  const isRejectOpen = capReqRejectOpen === req.id;
                  const activeCount = capReqActiveCounts[req.id];
                  const approveError = capReqApproveErrors[req.id];
                  return (
                    <div key={req.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 110px 1fr 180px', minWidth: 860, padding: '11px 16px', alignItems: 'center', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{req.department_name}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{req.role_name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                            by {req.requested_by_name?.trim() || req.requested_by_username} · {req.created_at?.split('T')[0]}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
                            {req.current_cap != null ? req.current_cap : <span style={{ fontSize: 11 }}>default</span>}
                          </div>
                          {activeCount !== undefined && (
                            <div style={{ fontSize: 11, color: activeCount > 0 ? '#b45309' : 'var(--text-color-secondary)', marginTop: 3 }}>
                              {activeCount === null ? '' : `${activeCount} active`}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const rawVal  = capReqFinalCaps[req.id];
                          const finalCap = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : req.requested_cap;
                          const baseCap  = req.current_cap ?? capsDefaultMax;
                          const dir = finalCap > baseCap ? 'up' : finalCap < baseCap ? 'down' : 'same';
                          const dirColor = dir === 'up' ? '#16a34a' : dir === 'down' ? '#dc3545' : 'var(--text-color-secondary)';
                          const dirSymbol = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '=';
                          const belowActive = activeCount !== null && activeCount !== undefined && finalCap < activeCount;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number" min={activeCount ?? 0}
                                  value={rawVal !== undefined ? rawVal : req.requested_cap}
                                  onChange={e => { setCapReqFinalCaps(prev => ({ ...prev, [req.id]: e.target.value })); setCapReqApproveErrors(prev => { const n = { ...prev }; delete n[req.id]; return n; }); }}
                                  style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: `1px solid ${belowActive ? '#dc3545' : 'var(--surface-border)'}`, background: 'var(--surface-ground)', fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-heading)', outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontSize: 11, fontWeight: 700, color: dirColor }}>{dirSymbol}</span>
                              </div>
                              {activeCount !== null && activeCount !== undefined && (
                                <span style={{ fontSize: 11, color: belowActive ? '#dc3545' : 'var(--text-color-secondary)' }}>
                                  Min: {activeCount}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{req.reason || '—'}</div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleCapReqApprove(req)}
                            disabled={isReviewing}
                            style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: isReviewing ? 'var(--surface-border)' : '#16a34a', color: 'white', fontSize: 12, fontWeight: 600, cursor: isReviewing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => { setCapReqRejectOpen(req.id); setCapReqRejectNote(''); }}
                            disabled={isReviewing}
                            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(220,53,69,.4)', background: 'rgba(220,53,69,.07)', color: '#dc3545', fontSize: 12, fontWeight: 600, cursor: isReviewing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </div>
                      {approveError && (
                        <div style={{ padding: '7px 16px 9px', background: 'rgba(220,53,69,.05)', borderTop: '1px dashed rgba(220,53,69,.2)', fontSize: 12, color: '#dc3545' }}>
                          ⚠ {approveError}
                        </div>
                      )}
                      {/* Inline reject note */}
                      {isRejectOpen && (
                        <div style={{ padding: '10px 16px 14px', background: 'rgba(220,53,69,.03)', borderTop: '1px dashed rgba(220,53,69,.2)' }}>
                          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Rejection Note (optional)</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              value={capReqRejectNote}
                              onChange={e => setCapReqRejectNote(e.target.value)}
                              placeholder="Reason for rejection…"
                              style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid rgba(220,53,69,.35)', background: 'var(--surface-ground)', fontSize: 13, color: 'var(--text-color)', outline: 'none', fontFamily: 'var(--font)' }}
                            />
                            <button onClick={() => handleCapReqReject(req)} disabled={isReviewing}
                              style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#dc3545', color: 'white', fontSize: 12, fontWeight: 600, cursor: isReviewing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                              Confirm Reject
                            </button>
                            <button onClick={() => { setCapReqRejectOpen(null); setCapReqRejectNote(''); }}
                              style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

          {/* Heading + Add / Update form, combined in one box */}
          <Card style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 'var(--font-size-h3)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-.01em' }}>
              {t('roleCaps.title')}
            </div>
            <div style={{ fontSize: 'var(--font-size-p2)', color: 'var(--text-color-secondary)', marginTop: 4 }}>
              {t('roleCaps.subtitle', { default: capsDefaultMax })}
            </div>
            <div style={{ borderTop: '1px solid var(--surface-border)', margin: '18px 0 14px' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>
              {t('roleCaps.addTitle')}
            </div>
            <form onSubmit={handleCapSave}>
              <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: 10, alignItems: 'end' }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 5 }}>{t('roleCaps.department')}</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={capDeptSearch !== '' || !capForm.department_id
                      ? capDeptSearch
                      : (depts.find(d => String(d.id) === String(capForm.department_id))?.name ?? '')}
                    placeholder={t('roleCaps.selectDepartment')}
                    onFocus={() => setCapDeptOpen(true)}
                    onBlur={() => setTimeout(() => setCapDeptOpen(false), 150)}
                    onChange={e => {
                      setCapDeptSearch(e.target.value);
                      setCapForm(f => ({ ...f, department_id: '' }));
                      setCapFormError('');
                      setCapDeptOpen(true);
                    }}
                    style={{ width: '100%', padding: '10px 12px 10px 14px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: capForm.department_id ? 'var(--text-color)' : 'var(--text-color-secondary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'var(--font)', outline: 'none' }}
                  />
                  {capDeptOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
                      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
                      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                      maxHeight: 200, overflowY: 'auto', marginTop: 2,
                    }}>
                      {depts.filter(d => d.is_active && (!capDeptSearch.trim() || d.name.toLowerCase().includes(capDeptSearch.toLowerCase()))).length === 0
                        ? <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{t('common.noResults', 'No departments found')}</div>
                        : depts.filter(d => d.is_active && (!capDeptSearch.trim() || d.name.toLowerCase().includes(capDeptSearch.toLowerCase()))).map(d => (
                          <div
                            key={d.id}
                            onMouseDown={() => {
                              setCapForm(f => ({ ...f, department_id: String(d.id) }));
                              setCapDeptSearch('');
                              setCapDeptOpen(false);
                              setCapFormError('');
                            }}
                            style={{
                              padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                              background: String(capForm.department_id) === String(d.id) ? 'var(--primary-light)' : 'transparent',
                              color: String(capForm.department_id) === String(d.id) ? 'var(--primary)' : 'var(--text-color)',
                            }}
                            onMouseEnter={e => { if (String(capForm.department_id) !== String(d.id)) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                            onMouseLeave={e => { if (String(capForm.department_id) !== String(d.id)) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {d.name}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 5 }}>{t('roleCaps.role')}</label>
                  <SelectField
                    value={capForm.role_id}
                    onChange={e => { setCapForm(f => ({ ...f, role_id: e.target.value })); setCapFormError(''); }}
                    placeholder={t('roleCaps.selectRole')}
                  >
                    {assignable.map(r => (
                      <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <label style={{ ...LABEL, display: 'block', marginBottom: 5 }}>{t('roleCaps.maxUsers')}</label>
                  <input
                    type="number" min="0"
                    value={capForm.max_users}
                    onChange={e => { setCapForm(f => ({ ...f, max_users: e.target.value })); setCapFormError(''); }}
                    style={{ width: '100%', padding: '10px 12px 10px 14px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <button
                  type="submit" disabled={capSaving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: capSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {capSaving ? t('roleCaps.saving') : t('roleCaps.save')}
                </button>
              </div>
              {capActiveCount !== null && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                  {capActiveCount === 0
                    ? t('roleCaps.activeCountZero', 'No active users currently.')
                    : t('roleCaps.activeCount', { count: capActiveCount, defaultValue: `${capActiveCount} active user${capActiveCount > 1 ? 's' : ''} currently.` })}
                </div>
              )}
              {capFormError && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#dc3545' }}>{capFormError}</div>
              )}
            </form>
          </Card>

          {/* Existing limits table */}
          <Card padding="0">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('roleCaps.listHeading')}</div>
              <span style={{ ...LABEL }}>{t('roleCaps.totalDepartments', { count: caps.length })}</span>
            </div>

            {capsLoading && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('common.loading')}</div>
            )}
            {capsError && (
              <div style={{ padding: 16, color: '#dc3545', fontSize: 13 }}>{capsError}</div>
            )}
            {!capsLoading && !capsError && caps.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>
                {t('roleCaps.noLimits', { default: capsDefaultMax })}
              </div>
            )}
            {!capsLoading && caps.length > 0 && (
              <div className="table-scroll-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                      {[t('roleCaps.headers.department'), t('roleCaps.headers.role'), t('roleCaps.headers.maxUsers'), t('roleCaps.headers.actions')].map((h, i) => (
                        <th key={h} scope="col" style={{ ...LABEL, padding: '11px 16px', textAlign: 'left', ...(i > 0 && { borderLeft: '1px solid var(--surface-border)' }) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCaps.map(cap => (
                      <tr key={cap.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heading)' }}>{cap.department_name}</td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color)' }}>{cap.role_name ? cap.role_name.charAt(0).toUpperCase() + cap.role_name.slice(1) : '—'}</td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                          {capEditId === cap.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="number" min={capEditActiveCount ?? 0}
                                  value={capEditVal}
                                  onChange={e => { setCapEditVal(e.target.value); setCapEditError(''); }}
                                  onKeyDown={e => { if (e.key === 'Enter') handleCapInlineSave(cap); if (e.key === 'Escape') { setCapEditId(null); setCapEditError(''); } }}
                                  autoFocus
                                  style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: `1px solid ${capEditError ? '#dc3545' : 'var(--surface-border)'}`, background: 'var(--surface-card)', color: 'var(--text-color)', fontSize: 13 }}
                                />
                                <button onClick={() => handleCapInlineSave(cap)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#198754', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✓</button>
                                <button onClick={() => { setCapEditId(null); setCapEditError(''); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                              </div>
                              {capEditActiveCount !== null && !capEditError && (
                                <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>
                                  Min: {capEditActiveCount} (active users)
                                </span>
                              )}
                              {capEditError && (
                                <span style={{ fontSize: 11, color: '#dc3545' }}>⚠ {capEditError}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{cap.max_users}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', borderLeft: '1px solid var(--surface-border)' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleCapInlineEdit(cap)}
                              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                              {t('roleCaps.edit')}
                            </button>
                            <button
                              onClick={() => handleCapDelete(cap)}
                              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(220,53,69,.3)', background: 'transparent', color: '#dc3545', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                              {t('roleCaps.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination — only once there's more than one page */}
            {!capsLoading && capsTotalPages > 1 && (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--surface-border)' }}>
                <Pagination page={capsPageClamped + 1} totalPages={capsTotalPages} onChange={p => setCapsPage(p - 1)} />
              </div>
            )}
          </Card>
      </div>
    );
  }

  return null;
}

