import { useState } from 'react';
import { X, User, Mail, Building2, ShieldCheck, Eye, EyeOff, CheckCircle2, Phone } from 'lucide-react';
import { sendFirstLoginMobileOtp, verifyFirstLoginMobileOtp } from '../../services/authService';

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};
const INPUT_BASE = {
  background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
  borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)',
  fontSize: 13, padding: '10px 14px', outline: 'none', width: '100%',
};

export default function ProfileModal({ user, roleLabel, onClose, onChangePassword, canChangePassword, onMobileVerified }) {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mobile verification state
  const [verifyState, setVerifyState]   = useState('idle'); // 'idle' | 'sending' | 'otp_sent' | 'verifying'
  const [otpValue, setOtpValue]         = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [verifyError, setVerifyError]   = useState('');

  function toggle(field) { setShow(s => ({ ...s, [field]: !s[field] })); }
  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setError(''); setSuccess(false); }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!form.current)             { setError('Please enter your current password.'); return; }
    if (form.next.length < 8)      { setError('New password must be at least 8 characters.'); return; }
    if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.next === form.current) { setError('New password must differ from the current password.'); return; }

    setLoading(true);
    setError('');
    try {
      await onChangePassword(form.current, form.next);
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setVerifyState('sending');
    setVerifyError('');
    try {
      const res = await sendFirstLoginMobileOtp();
      setMaskedMobile(res.data.masked_mobile || user.mobile);
      setVerifyState('otp_sent');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setVerifyError(typeof detail === 'string' ? detail : 'Could not send OTP. Please try again.');
      setVerifyState('idle');
    }
  }

  async function handleVerifyOtp() {
    if (!otpValue) return;
    setVerifyState('verifying');
    setVerifyError('');
    try {
      const res = await verifyFirstLoginMobileOtp(otpValue);
      const token = res.data.access_token;
      localStorage.setItem('token', token);
      if (onMobileVerified) onMobileVerified(token);
      setVerifyState('idle');
      setOtpValue('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setVerifyError(typeof detail === 'string' ? detail : 'Invalid or expired OTP.');
      setVerifyState('otp_sent');
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 14, width: 640, maxWidth: '100%',
        maxHeight: '88vh', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeSlideIn .15s ease',
      }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(user.name || user.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name || user.username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{roleLabel}</div>
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {/* Account details — 2×2 grid */}
          <div className="modal-body-pad modal-grid-2" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {user.fullName && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Detail icon={User} label="Full Name" value={user.fullName} />
              </div>
            )}
            <Detail icon={User}      label="Username"   value={user.username} />
            <Detail icon={Building2} label="Department" value={user.dept  || '—'} />
            <Detail icon={Mail}      label="Email"      value={user.email || '—'} />

            {/* Mobile — with verified tick or Verify button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Phone size={13} color="var(--text-color-secondary)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...LABEL, marginBottom: 2 }}>Mobile</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>
                    {user.mobile || '—'}
                  </span>
                  {user.mobile && user.mobileVerified && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                      <CheckCircle2 size={13} color="#16a34a" /> Verified
                    </span>
                  )}
                  {user.mobile && !user.mobileVerified && verifyState === 'idle' && (
                    <button type="button" onClick={handleSendOtp}
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 5, padding: '2px 9px', cursor: 'pointer', fontFamily: 'var(--font)', lineHeight: 1.6 }}>
                      Verify
                    </button>
                  )}
                  {user.mobile && !user.mobileVerified && verifyState === 'sending' && (
                    <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>Sending OTP…</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inline OTP section — shown after Send OTP */}
          {(verifyState === 'otp_sent' || verifyState === 'verifying') && (
            <>
              <div style={{ height: 1, background: 'var(--surface-border)' }} />
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-color-secondary)' }}>
                  OTP sent to <strong style={{ color: 'var(--text-heading)' }}>{maskedMobile}</strong>. Enter it below to verify your number.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpValue}
                    onChange={e => { setOtpValue(e.target.value.replace(/\D/g, '')); setVerifyError(''); }}
                    placeholder="Enter 6-digit OTP"
                    style={{ ...INPUT_BASE, flex: 1 }}
                    autoFocus
                  />
                  <button type="button" onClick={handleVerifyOtp}
                    disabled={verifyState === 'verifying' || !otpValue}
                    style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, opacity: (verifyState === 'verifying' || !otpValue) ? .6 : 1 }}>
                    {verifyState === 'verifying' ? 'Verifying…' : 'Confirm'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={handleSendOtp} disabled={verifyState === 'verifying'}
                    style={{ fontSize: 11.5, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0, textDecoration: 'underline' }}>
                    Resend OTP
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>·</span>
                  <button type="button" onClick={() => { setVerifyState('idle'); setOtpValue(''); setVerifyError(''); }}
                    style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0, textDecoration: 'underline' }}>
                    Cancel
                  </button>
                </div>
                {verifyError && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', fontSize: 12, color: '#dc2626' }}>
                    ⚠ {verifyError}
                  </div>
                )}
              </div>
            </>
          )}

          {verifyError && verifyState === 'idle' && (
            <div style={{ padding: '0 24px 12px' }}>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', fontSize: 12, color: '#dc2626' }}>
                ⚠ {verifyError}
              </div>
            </div>
          )}

          {/* Change password — temporarily disabled */}
          {/* {canChangePassword ? (
            <>
              <div style={{ height: 1, background: 'var(--surface-border)' }} />
              <form onSubmit={handleChangePassword} className="modal-body-pad" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <ShieldCheck size={14} color="var(--primary)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Change Password</span>
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>Current Password</div>
                  <PwField value={form.current} show={show.current} onToggle={() => toggle('current')} onChange={v => set('current', v)} />
                </div>
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>New Password</div>
                    <PwField value={form.next} show={show.next} onToggle={() => toggle('next')} onChange={v => set('next', v)} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>Confirm New Password</div>
                    <PwField value={form.confirm} show={show.confirm} onToggle={() => toggle('confirm')} onChange={v => set('confirm', v)} />
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', fontSize: 12, color: '#dc2626', display: 'flex', gap: 7, alignItems: 'center' }}>
                    ⚠ {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(25, 135, 84,.08)', border: '1px solid rgba(25, 135, 84,.25)', fontSize: 12, color: '#16a34a', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <CheckCircle2 size={13} /> Password updated successfully.
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', opacity: loading ? .7 : 1, alignSelf: 'flex-start', minWidth: 180 }}>
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '0 24px 20px', fontSize: 12, color: 'var(--text-color-secondary)' }}>
              Password changes aren't available for this access type.
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} color="var(--text-color-secondary)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...LABEL, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}

function PwField({ value, show, onToggle, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        style={{ ...INPUT_BASE, paddingRight: 38 }}
      />
      <div role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </div>
    </div>
  );
}
