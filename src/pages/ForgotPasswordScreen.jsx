import { useState } from 'react';
import { Mail, Phone, ArrowLeft, ShieldCheck, Eye, EyeOff, RotateCcw, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset, resetPasswordWithOtp } from '../services/pdf';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';

export default function ForgotPasswordScreen({ onBack }) {
  const [step, setStep]         = useState(1); // 1 = request OTP, 2 = enter OTP + new password, 3 = success
  const [identifier, setId]     = useState('');
  const [otp, setOtp]           = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [channel, setChannel]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const isEmail   = identifier.includes('@');
  const InputIcon = isEmail ? Mail : Phone;

  // ── Step 1: request OTP ───────────────────────────────────
  async function handleRequestOtp(e) {
    e?.preventDefault();
    if (!identifier.trim()) { setError('Please enter your email or mobile number.'); return; }
    setLoading(true); setError(''); setResendMsg('');
    try {
      const res = await requestPasswordReset(identifier.trim());
      setChannel(res.data.channel);
      setStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP + reset ────────────────────────────
  async function handleReset(e) {
    e?.preventDefault();
    if (otp.length !== 6)       { setError('OTP must be 6 digits.'); return; }
    if (newPass.length < 8)     { setError('Password must be at least 8 characters.'); return; }
    if (newPass !== confirm)    { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await resetPasswordWithOtp(identifier.trim(), otp, newPass);
      setStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(''); setOtp(''); setResendMsg('');
    setLoading(true);
    try {
      const res = await requestPasswordReset(identifier.trim());
      setChannel(res.data.channel);
      setResendMsg('A new OTP has been sent.');
    } catch {
      setError('Could not resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = (() => {
    const p = newPass;
    if (!p) return null;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { label: 'Weak',   color: '#ef4444', w: '25%' };
    if (s <= 2) return { label: 'Fair',   color: '#f59e0b', w: '50%' };
    if (s <= 3) return { label: 'Good',   color: '#3b82f6', w: '75%' };
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
        input::placeholder { color:rgba(255,255,255,.3); font-size:13px; }
        .fp-otp-inp { letter-spacing:12px; font-size:24px; font-weight:700; text-align:center; }
        .fp-otp-inp::placeholder { letter-spacing:normal; font-size:14px; font-weight:400; }
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

          {/* ── Success ── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle2 size={52} color="#22c55e" style={{ marginBottom: 14 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Password Reset!</h2>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 24 }}>
                Your password has been reset successfully.<br/>You can now log in with your new password.
              </p>
              <button className="fp-btn" onClick={onBack} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                Go to Login
              </button>
            </div>
          )}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <button type="button" onClick={onBack}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                <ArrowLeft size={12} /> Back to Login
              </button>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>Forgot Password?</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                Enter your registered email or mobile number. We'll send you a 6-digit OTP.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: 7, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                <InputIcon size={10} color="rgba(255,255,255,.4)" />
                {isEmail ? 'Email Address' : 'Mobile Number'}
              </label>
              <input
                className="fp-inp"
                type="text"
                value={identifier}
                onChange={e => { setId(e.target.value); setError(''); }}
                placeholder="email@example.com or 9876543210"
                autoComplete="username"
                style={{
                  width: '100%', padding: '11px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 4,
                }}
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>
                Use email for email OTP, or 10-digit mobile for SMS OTP.
              </p>

              {error && <ErrorBox msg={error} />}

              <button className="fp-btn" type="submit" disabled={loading} style={{
                width: '100%', padding: '12px', marginTop: 4,
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 18px rgba(34,197,94,.35)',
                opacity: loading ? .7 : 1,
              }}>
                {loading ? <><Spin /> Sending OTP…</> : <>Send OTP &nbsp;→</>}
              </button>
            </form>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <form onSubmit={handleReset}>
              <button type="button" onClick={() => { setStep(1); setError(''); setOtp(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                <ArrowLeft size={12} /> Back
              </button>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>Enter OTP</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                A 6-digit OTP was sent to your {channel === 'email' ? 'email' : 'mobile'}. Valid for 10 minutes.
              </p>

              {/* OTP */}
              <label style={labelStyle}>OTP (6 digits)</label>
              <input
                className="fp-inp fp-otp-inp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="------"
                style={{
                  width: '100%', padding: '12px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, color: '#fff', marginBottom: 16,
                }}
              />

              {/* New password */}
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                <input
                  className="fp-inp"
                  type={showPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setError(''); }}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  style={{
                    width: '100%', padding: '11px 38px 11px 13px',
                    background: 'rgba(255,255,255,.10)',
                    border: '1px solid rgba(255,255,255,.18)',
                    borderRadius: 11, fontSize: 13.5, color: '#fff',
                  }}
                />
                <div onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </div>
              </div>

              {strength && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: strength.w, background: strength.color, transition: 'width .3s, background .3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: strength.color, fontWeight: 700 }}>{strength.label}</span>
                </div>
              )}

              {/* Confirm password */}
              <label style={labelStyle}>Confirm New Password</label>
              <input
                className="fp-inp"
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                style={{
                  width: '100%', padding: '11px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 16,
                }}
              />

              {error    && <ErrorBox msg={error} />}
              {resendMsg && <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10 }}>{resendMsg}</div>}

              <button className="fp-btn" type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 18px rgba(34,197,94,.35)',
                opacity: loading ? .7 : 1, marginBottom: 12,
              }}>
                {loading ? <><Spin /> Resetting…</> : <><ShieldCheck size={14} /> Reset Password</>}
              </button>

              <button type="button" onClick={handleResend} disabled={loading}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', margin: '0 auto' }}>
                <RotateCcw size={11} /> Resend OTP
              </button>
            </form>
          )}
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
