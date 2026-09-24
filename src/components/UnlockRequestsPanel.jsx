import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Unlock, Trash2, CheckCircle, XCircle } from 'lucide-react';
import Card from './ui/Card';
import { getPendingUnlockRequests, reviewUnlockRequest } from '../services/unlockRequests';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

// Confirmation dialog for approving/rejecting an unlock request — same
// role="dialog" overlay pattern as ApproverDashboard's ConfirmDialog for
// approving/rejecting a document upload, so both flows feel consistent.
function ConfirmUnlockDialog({ request, decision, note, onNoteChange, onConfirm, onCancel, submitting, error }) {
  const { t } = useTranslation('nodal');
  const isApprove = decision === 'approved';
  const isEdit = request.request_type === 'edit';
  const accent = isApprove ? 'var(--green)' : 'var(--red)';
  const accentBg = isApprove ? 'rgba(25, 135, 84,.12)' : 'rgba(220, 53, 69,.12)';
  const Icon = isApprove ? CheckCircle : XCircle;

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !submitting) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const bodyKey = isApprove
    ? (isEdit ? 'unlockRequests.confirmApproveEditBody' : 'unlockRequests.confirmApproveDeleteBody')
    : 'unlockRequests.confirmRejectBody';

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={submitting ? undefined : onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface-card)', borderRadius: 16, width: 440, maxWidth: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,.35)', borderTop: `3px solid ${accent}`,
        padding: '26px 26px 22px', animation: 'fadeSlideIn .18s ease',
      }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={22} color={accent} />
          </div>
          <div style={{ flex: 1, paddingTop: 6, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, color: 'var(--text-color)', lineHeight: 1.5, fontFamily: 'var(--font)', wordBreak: 'break-word', marginBottom: 8, fontWeight: 600 }}>
              {t(isApprove ? 'unlockRequests.confirmApproveQuestion' : 'unlockRequests.confirmRejectQuestion', { title: request.document_name || request.original_filename })}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', lineHeight: 1.55, fontFamily: 'var(--font)', wordBreak: 'break-word' }}>
              {t(bodyKey)}
            </div>
          </div>
        </div>
        {!isApprove && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>{t('unlockRequests.rejectNoteLabel')}</label>
            <input
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder={t('unlockRequests.rejectNotePlaceholder')}
              disabled={submitting}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', fontSize: 13, color: 'var(--text-color)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
            />
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: '#dc3545', marginBottom: 8 }}>⚠ {error}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button onClick={onCancel} disabled={submitting} autoFocus
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background .15s' }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}>
            {t('unlockRequests.cancel')}
          </button>
          <button onClick={onConfirm} disabled={submitting}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 14px ${isApprove ? 'rgba(25,135,84,.35)' : 'rgba(220,53,69,.35)'}`, opacity: submitting ? 0.75 : 1, transition: 'filter .15s' }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.filter = 'brightness(0.92)'; }}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
            <Icon size={14} /> {submitting ? t('unlockRequests.submitting') : t(isApprove ? 'unlockRequests.approve' : 'unlockRequests.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Nodal Officer's review queue for unlock requests raised by Approvers on
// already-approved documents in their department(s).
export default function UnlockRequestsPanel() {
  const { t } = useTranslation('nodal');

  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [reviewing, setReviewing] = useState(null); // { request, decision } | null — drives the confirm dialog
  const [rejectNote, setRejectNote]     = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError]   = useState('');

  function load() {
    setLoading(true);
    setError('');
    getPendingUnlockRequests()
      .then(res => setRequests(res.data || []))
      .catch(() => setError(t('unlockRequests.failedToLoad')))
      .finally(() => setLoading(false));
  }

  // Standard fetch-on-mount pattern (flip loading on, fetch, flip off in finally) —
  // the react-hooks/set-state-in-effect rule flags any sync setState in an effect,
  // but this is the documented React pattern for kicking off a data fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function openConfirm(request, decision) {
    setReviewing({ request, decision });
    setRejectNote('');
    setReviewError('');
  }

  function closeConfirm() {
    if (reviewSubmitting) return;
    setReviewing(null);
    setRejectNote('');
    setReviewError('');
  }

  async function confirmReview() {
    if (!reviewing) return;
    const { request, decision } = reviewing;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await reviewUnlockRequest(request.id, {
        status: decision,
        ...(decision === 'rejected' && rejectNote.trim() ? { review_note: rejectNote.trim() } : {}),
      });
      setRequests(prev => prev.filter(r => r.id !== request.id));
      setReviewing(null);
      setRejectNote('');
    } catch (err) {
      setReviewError(err.response?.data?.detail || t('unlockRequests.actionFailed'));
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
      <Card padding="0">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-p1)', color: 'var(--text-heading)' }}>{t('unlockRequests.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>{t('unlockRequests.subtitle')}</div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('unlockRequests.loading')}</div>
        ) : error ? (
          <div style={{ padding: '16px 20px', fontSize: 13, color: '#dc3545' }}>{error}</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('unlockRequests.noneReq')}</div>
        ) : (
          <div>
            {requests.map((req, i) => {
              const isEdit = req.request_type === 'edit';
              return (
                <div key={req.id} style={{ padding: '16px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Document + type badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', wordBreak: 'break-word' }}>{req.document_name || req.original_filename}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>{req.department_name}</div>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', flexShrink: 0,
                      color: isEdit ? 'var(--primary)' : '#dc3545',
                      background: isEdit ? 'rgba(33,74,171,.1)' : 'rgba(220,53,69,.1)',
                      border: `1px solid ${isEdit ? 'rgba(33,74,171,.25)' : 'rgba(220,53,69,.25)'}`,
                    }}>
                      {isEdit ? <Unlock size={11} /> : <Trash2 size={11} />}
                      {isEdit ? t('unlockRequests.typeEdit') : t('unlockRequests.typeDelete')}
                    </span>
                  </div>

                  {/* Requested by + date */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-color-secondary)' }}>
                    <span>{t('unlockRequests.headers.requestedBy')}: <strong style={{ color: 'var(--text-color)', fontWeight: 600 }}>{req.requested_by_name?.trim() || req.requested_by_username}</strong></span>
                    <span>{req.created_at?.split('T')[0]}</span>
                  </div>

                  {/* Reason */}
                  {req.reason && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-color)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>
                      {req.reason}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => openConfirm(req, 'approved')}
                      style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: 'white', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle size={13} /> {t('unlockRequests.approve')}
                    </button>
                    <button onClick={() => openConfirm(req, 'rejected')}
                      style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(220,53,69,.4)', background: 'rgba(220,53,69,.07)', color: '#dc3545', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <XCircle size={13} /> {t('unlockRequests.reject')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {reviewing && (
        <ConfirmUnlockDialog
          request={reviewing.request}
          decision={reviewing.decision}
          note={rejectNote}
          onNoteChange={setRejectNote}
          onConfirm={confirmReview}
          onCancel={closeConfirm}
          submitting={reviewSubmitting}
          error={reviewError}
        />
      )}
    </div>
  );
}
