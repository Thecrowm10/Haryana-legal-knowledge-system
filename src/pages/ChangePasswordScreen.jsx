import { useState, useRef } from 'react';
import { Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import Captcha from '../components/Captcha';

export default function ChangePasswordScreen({ user, onPasswordChanged, onLogout, reason = 'first_login' }) {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef            = useRef(null);
  const canSubmit             = !loading && captchaStatus.valid;

  function toggle(field) { setShow(s => ({ ...s, [field]: !s[field] })); }
  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.current) { setError('Please enter your current password.'); return; }
    if (form.next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.next === form.current) { setError('New password must differ from the current password.'); return; }
    if (!captchaStatus.touched)          { setError('Please fill the captcha.'); return; }
    if (!captchaRef.current?.validate()) { setError('Please enter the correct captcha.'); return; }

    setLoading(true);
    setError('');
    try {
      await onPasswordChanged(form.current, form.next);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to change password. Please try again.');
      captchaRef.current?.reset();
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
    if (score <= 1) return { label: 'Weak',   color: '#ef4444', w: '25%' };
    if (score <= 2) return { label: 'Fair',   color: '#f59e0b', w: '50%' };
    if (score <= 3) return { label: 'Good',   color: '#3b82f6', w: '75%' };
    return              { label: 'Strong', color: '#22c55e', w: '100%' };
  })();

  return (
    <>
      <style>{`
        .fp * { box-sizing:border-box; margin:0; padding:0; }
        .fp { font-family:'Plus Jakarta Sans Variable','Plus Jakarta Sans',sans-serif; }
        @keyframes fpFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .fp-card { animation: fpFade .4s cubic-bezier(.22,1,.36,1) both; }
        .fp-inp { outline:none; transition:border-color .15s,box-shadow .15s; }
        .fp-inp:focus { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; }
        .fp-btn { transition:all .18s ease; cursor:pointer; border:none; font-family:inherit; }
        .fp-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); }
        .fp-btn:active:not(:disabled) { transform:translateY(0); }
      `}</style>

      <div className="fp" style={{
        width: '100vw', height: '100vh', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <img
          src={bannerBg}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'blur(2px)', transform: 'scale(1.02)' }}
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }}/>

        <div className="fp-card" style={{
          position: 'relative', zIndex: 2,
          width: 'clamp(300px,90vw,420px)',
          background: 'rgba(255,255,255,.07)',
          backdropFilter: 'blur(30px) saturate(160%)',
          WebkitBackdropFilter: 'blur(30px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.14)',
          borderTop: '1px solid rgba(255,255,255,.26)',
          borderRadius: 22,
          boxShadow: '0 24px 64px rgba(0,0,0,.4)',
          padding: '28px 26px 24px',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <img src={haryanaLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Haryana Government</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Legal Knowledge System</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
              {reason === 'expired' ? 'Password Expired' : 'Password Change Required'}
            </h2>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
              {reason === 'expired'
                ? <>Your password has expired (6-month policy). Please set a new password to continue, <strong>{user?.name || user?.username}</strong>.</>
                : <>Welcome, <strong>{user?.name || user?.username}</strong>. You must set a new password before you can continue.</>
              }
            </p>

            {/* Current password */}
            <label style={labelStyle}>Current Password</label>
            <PwField value={form.current} show={show.current} onToggle={() => toggle('current')} onChange={v => set('current', v)} style={{ marginBottom: 16 }} />

            {/* New password */}
            <label style={labelStyle}>New Password</label>
            <PwField value={form.next} show={show.next} onToggle={() => toggle('next')} onChange={v => set('next', v)} style={{ marginBottom: strength ? 4 : 16 }} />

            {strength && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: strength.w, background: strength.color, transition: 'width .3s, background .3s' }} />
                </div>
                <span style={{ fontSize: 10, color: strength.color, fontWeight: 700 }}>{strength.label}</span>
              </div>
            )}

            {/* Confirm password */}
            <label style={labelStyle}>Confirm New Password</label>
            <PwField value={form.confirm} show={show.confirm} onToggle={() => toggle('confirm')} onChange={v => set('confirm', v)} style={{ marginBottom: 16 }} />

            <Captcha ref={captchaRef} onStatusChange={setCaptchaStatus} style={{ marginBottom: 16 }} />

            {error && <ErrorBox msg={error} />}

            <button className="fp-btn" type="submit" disabled={loading} style={{
              width: '100%', padding: '12px',
              background: canSubmit ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,.04)',
              borderRadius: 11, color: canSubmit ? '#fff' : 'rgba(255,255,255,.32)', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: canSubmit ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
              boxShadow: canSubmit ? '0 4px 18px rgba(34,197,94,.35)' : 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              marginBottom: 14,
            }}>
              {loading ? <><Spin /> Changing Password…</> : canSubmit ? <><ShieldCheck size={14} /> Set New Password</> : <><Lock size={13} /> Set New Password</>}
            </button>

            <button type="button" onClick={onLogout}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', display: 'block', margin: '0 auto' }}>
              Sign out and log in as a different user
            </button>
          </form>
        </div>

        <p style={{ position: 'absolute', bottom: 14, zIndex: 2, color: 'rgba(255,255,255,.16)', fontSize: 11 }}>
          © 2026 Government of Haryana · HARTRON
        </p>
      </div>
    </>
  );
}

const labelStyle = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.5)',
  marginBottom: 7, letterSpacing: '.08em', textTransform: 'uppercase',
};

function PwField({ value, show, onToggle, onChange, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        className="fp-inp"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        style={{
          width: '100%', padding: '11px 38px 11px 13px',
          background: 'rgba(255,255,255,.10)',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 11, fontSize: 13.5, color: '#fff',
        }}
      />
      <div onClick={onToggle} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex' }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      marginBottom: 12, padding: '9px 12px',
      background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.28)',
      borderRadius: 9, fontSize: 12, color: '#fca5a5', display: 'flex', gap: 7, alignItems: 'center',
    }}>
      <span>⚠</span>{msg}
    </div>
  );
}

function Spin() {
  return (
    <div style={{
      width: 14, height: 14,
      border: '2px solid rgba(255,255,255,.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  );
}
