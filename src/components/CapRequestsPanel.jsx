import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Clock, CheckCircle, XCircle, X, Paperclip } from 'lucide-react';
import Card from './ui/Card';
import SelectField from './ui/SelectField';
import { useAuth } from '../hooks/useAuth';
import { getRoles } from '../services/users';
import { getRoleCaps, getActiveUserCount } from '../services/roleCaps';
import { submitCapRequest, getMyCapRequests, getCapRequestAttachment } from '../services/capRequests';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };
const INP = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', fontSize: 13, color: 'var(--text-color)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' };
const CAPRQ_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .caprq-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
  }
  @media (max-width: 640px) {
    .caprq-stats-grid { grid-template-columns: 1fr !important; }
    .caprq-form-grid { grid-template-columns: 1fr !important; }
  }
`;

// Shared by Admin and Nodal Officer dashboards — both let their user submit a
// cap change request for a role they manage, with a mandatory supporting
// attachment. `assignableRoles` is passed in because which roles are
// requestable differs by caller (Admin excludes admin/super_admin/citizen;
// Nodal Officer additionally excludes nodal_officer itself).
export default function CapRequestsPanel({ assignableRoles }) {
  const { t } = useTranslation('admin');
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);

  const [capReqHistory, setCapReqHistory]           = useState([]);
  const [capReqHistoryLoading, setCapReqHistoryLoading] = useState(false);
  const [capReqCaps, setCapReqCaps]                 = useState({ limits: [], default_max: 5 });
  const [capReqForm, setCapReqForm]                 = useState({ role_id: '', requested_cap: '', reason: '', file: null });
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
    getRoles().then(res => setRoles(res.data)).catch(() => {});
    setCapReqHistoryLoading(true);
    Promise.all([getMyCapRequests(), getRoleCaps()])
      .then(([reqRes, capsRes]) => {
        setCapReqHistory(reqRes.data || []);
        setCapReqCaps(capsRes.data || { limits: [], default_max: 5 });
      })
      .catch(() => {})
      .finally(() => setCapReqHistoryLoading(false));
  }, []);

  const adminDeptId = user?.deptId;
  const selectedRoleId = capReqForm.role_id ? Number(capReqForm.role_id) : null;
  const existingCap = selectedRoleId && adminDeptId
    ? capReqCaps.limits?.find(l => l.role_id === selectedRoleId && l.department_id === adminDeptId)
    : null;
  const currentCap = existingCap != null ? existingCap.max_users : capReqCaps.default_max;

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
    if (!capReqForm.file) { setCapReqError(t('capRequests.errors.attachmentRequired')); return; }
    setCapReqSaving(true); setCapReqError(''); setCapReqSuccess('');
    try {
      const fd = new FormData();
      fd.append('role_id', String(Number(capReqForm.role_id)));
      fd.append('requested_cap', String(reqCap));
      if (capReqForm.reason.trim()) fd.append('reason', capReqForm.reason.trim());
      fd.append('file', capReqForm.file);
      await submitCapRequest(fd);
      setCapReqForm({ role_id: '', requested_cap: '', reason: '', file: null });
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

  async function handleViewCapReqAttachment(reqId) {
    try {
      const res = await getCapRequestAttachment(reqId);
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert(t('capRequests.errors.attachmentLoadFailed'));
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
      <style>{CAPRQ_RESPONSIVE_CSS}</style>

      {/* Stats */}
      <div className="caprq-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
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
        <div className="caprq-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
        <div style={{ marginTop: 12 }}>
          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('capRequests.attachment')} <span style={{ color: '#dc3545' }}>*</span></label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={e => { setCapReqForm(f => ({ ...f, file: e.target.files?.[0] || null })); setCapReqError(''); setCapReqSuccess(''); }}
            style={INP}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 5 }}>
            {capReqForm.file ? capReqForm.file.name : t('capRequests.attachmentHint')}
          </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px 100px 110px 1fr', minWidth: 900, padding: '9px 16px', background: 'var(--surface-ground)', borderBottom: '1px solid var(--surface-border)' }}>
              {[t('capRequests.headers.roleReason'), t('capRequests.headers.currentCap'), t('capRequests.headers.requested'), t('capRequests.headers.status'), t('capRequests.headers.date'), t('capRequests.headers.attachment'), t('capRequests.headers.superAdminNote')].map(h => (
                <div key={h} style={{ ...LABEL }}>{h}</div>
              ))}
            </div>
            {filteredCapReqHistory.map(req => {
              const sb = statusBadge(req.status);
              return (
                <div key={req.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 110px 100px 110px 1fr', minWidth: 900, padding: '10px 16px', borderBottom: '1px solid var(--surface-border)', alignItems: 'center', transition: 'background .15s' }}
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
                  <div>
                    <button onClick={() => handleViewCapReqAttachment(req.id)}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Paperclip size={12} /> {t('capRequests.view')}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{req.super_admin_note || '—'}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
