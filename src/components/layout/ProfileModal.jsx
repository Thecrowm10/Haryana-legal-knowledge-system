import { useState } from 'react';
import { X, User, Mail, Building2, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};
const INPUT_BASE = {
  background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
  borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)',
  fontSize: 13, padding: '10px 14px', outline: 'none', width: '100%',
};

export default function ProfileModal({ user, roleLabel, onClose, onChangePassword, canChangePassword }) {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 14, width: 640, maxWidth: '100%',
        maxHeight: '88vh', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeSlideIn .15s ease',
      }}>
        {/* Header — stays put; only the body below scrolls */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
          {/* Account details */}
          <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Detail icon={User} label="Username" value={user.username} />
            {user.dept  && <Detail icon={Building2} label="Department" value={user.dept} />}
            {user.email && <Detail icon={Mail} label="Email" value={user.email} />}
          </div>

          {/* Change password */}
          {canChangePassword ? (
            <>
              <div style={{ height: 1, background: 'var(--surface-border)' }} />
              <form onSubmit={handleChangePassword} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <ShieldCheck size={14} color="var(--primary)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Change Password</span>
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>Current Password</div>
                  <PwField value={form.current} show={show.current} onToggle={() => toggle('current')} onChange={v => set('current', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', fontSize: 12, color: '#dc2626', display: 'flex', gap: 7, alignItems: 'center' }}>
                    ⚠ {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', fontSize: 12, color: '#16a34a', display: 'flex', gap: 7, alignItems: 'center' }}>
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
          )}
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
      <div onClick={onToggle} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </div>
    </div>
  );
}
