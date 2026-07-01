import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function ChangePasswordScreen({ user, onPasswordChanged, onLogout }) {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function toggle(field) { setShow(s => ({ ...s, [field]: !s[field] })); }
  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.current) { setError('Please enter your current password.'); return; }
    if (form.next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.next === form.current) { setError('New password must differ from the current password.'); return; }

    setLoading(true);
    setError('');
    try {
      await onPasswordChanged(form.current, form.next);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = (() => {
    const p = form.next;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#ef4444', width: '25%' };
    if (score <= 2) return { label: 'Fair',   color: '#f59e0b', width: '50%' };
    if (score <= 3) return { label: 'Good',   color: '#3b82f6', width: '75%' };
    return              { label: 'Strong', color: '#22c55e', width: '100%' };
  })();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a56db 0%, #1341a0 100%)',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(26,86,219,0.1)', marginBottom: 16,
          }}>
            <Lock size={28} color="#1a56db" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#343a40', margin: '0 0 8px' }}>
            Password Change Required
          </h1>
          <p style={{ fontSize: 14, color: '#6c757d', margin: 0, lineHeight: 1.5 }}>
            Welcome, <strong>{user?.name || user?.username}</strong>. You must set a new
            password before you can continue.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Current password */}
          <PasswordField
            label="Current Password"
            value={form.current}
            show={show.current}
            onToggle={() => toggle('current')}
            onChange={v => set('current', v)}
          />

          {/* New password */}
          <PasswordField
            label="New Password"
            value={form.next}
            show={show.next}
            onToggle={() => toggle('next')}
            onChange={v => set('next', v)}
            style={{ marginTop: 16 }}
          />

          {/* Strength bar */}
          {strength && (
            <div style={{ marginTop: 6, marginBottom: 4 }}>
              <div style={{ height: 4, borderRadius: 99, background: '#e9ecef', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: strength.width,
                  background: strength.color,
                  transition: 'width .3s, background .3s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
            </div>
          )}

          {/* Confirm password */}
          <PasswordField
            label="Confirm New Password"
            value={form.confirm}
            show={show.confirm}
            onToggle={() => toggle('confirm')}
            onChange={v => set('confirm', v)}
            style={{ marginTop: 16 }}
          />

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#dc2626', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 22, width: '100%', padding: '12px',
              background: loading ? '#93c5fd' : '#1a56db',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .2s',
            }}
          >
            {loading ? (
              <>
                <Spinner />
                Changing Password…
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Set New Password
              </>
            )}
          </button>
        </form>

        {/* Logout link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none', color: '#6c757d',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Sign out and log in as a different user
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 20 }}>
        Haryana State Legal Knowledge System
      </p>
    </div>
  );
}

function PasswordField({ label, value, show, onToggle, onChange, style }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
          style={{
            width: '100%', padding: '10px 40px 10px 12px',
            border: '1.5px solid #dee2e6', borderRadius: 8,
            fontSize: 14, color: '#343a40', outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = '#1a56db'; }}
          onBlur={e => { e.target.style.borderColor = '#dee2e6'; }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', padding: 2,
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
