import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Lock, Smartphone, Mail, CheckCircle2 } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import {
  sendFirstLoginMobileOtp,
  verifyFirstLoginMobileOtp,
  firstLoginResetPassword,
} from '../services/authService';

// step: 'initial' | 'otp_sent' | 'verified'
export default function FirstLoginScreen({ user, onTokenReceived, onLogout }) {
  const [step, setStep]               = useState(user?.mobileVerified ? 'verified' : 'initial');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [otp, setOtp]                 = useState('');
  const [otpError, setOtpError]       = useState('');
  const [sendingOtp, setSendingOtp]   = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [newPassword, setNewPassword]   = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [pwError, setPwError]           = useState('');
  const [resetting, setResetting]       = useState(false);

  async function handleSendOtp() {
    setSendingOtp(true);
    setOtpError('');
    try {
      const res = await sendFirstLoginMobileOtp();
      setMaskedMobile(res.data.masked_mobile);
      setStep('otp_sent');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setOtpError(typeof detail === 'string' ? detail : 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.trim().length !== 6) { setOtpError('Please enter the 6-digit OTP.'); return; }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const res = await verifyFirstLoginMobileOtp(otp.trim());
      onTokenReceived(res.data.access_token);
      setStep('verified');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setOtpError(typeof detail === 'string' ? detail : 'Invalid or expired OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setResetting(true);
    setPwError('');
    try {
      const res = await firstLoginResetPassword(newPassword);
      onTokenReceived(res.data.access_token);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPwError(typeof detail === 'string' ? detail : 'Failed to reset password. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  const strength = (() => {
    const p = newPassword;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#dc3545', w: '25%' };
    if (score <= 2) return { label: 'Fair',   color: '#b45309', w: '50%' };
    if (score <= 3) return { label: 'Good',   color: '#0d6efd', w: '75%' };
    return              { label: 'Strong', color: '#198754', w: '100%' };
  })();

  const canReset = !resetting && newPassword.length >= 8 && newPassword === confirmPw;

  return (
    <>
      <style>{`
        .fl * { box-sizing:border-box; margin:0; padding:0; }
        .fl { font-family:var(--font); }
        @keyframes flFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .fl-card { animation: flFade .4s cubic-bezier(.22,1,.36,1) both; }
        .fl-inp { outline:none; transition:border-color .15s,box-shadow .15s; }
        .fl-inp:focus { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; }
        .fl-btn { transition:all .18s ease; cursor:pointer; border:none; font-family:inherit; }
        .fl-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); }
        .fl-btn:active:not(:disabled) { transform:translateY(0); }
        .fl-otp { letter-spacing:.25em; font-size:22px; text-align:center; }
      `}</style>

      <div className="fl full-vh-min" style={{
        width: '100vw', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowX: 'hidden', padding: '48px 16px',
      }}>
        <img src={bannerBg} alt="" className="fixed-bg-img"
          style={{ objectFit: 'cover', zIndex: 0, filter: 'blur(2px)', transform: 'scale(1.02)' }} />
        <div className="fixed-bg-img" style={{ zIndex: 1, background: 'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }} />

        <div className="fl-card" style={{
          position: 'relative', zIndex: 2,
          width: 'clamp(300px,90vw,440px)',
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
            <img src={haryanaLogo} alt="Haryana Government" loading="lazy" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Haryana Government</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Digital Repository</div>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
            First Login Setup
          </h2>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
            Welcome, <strong style={{ color: 'rgba(255,255,255,.7)' }}>{user?.name || user?.username}</strong>.
            Verify your mobile number to set a new password.
          </p>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {['Verify Mobile', 'Set Password'].map((label, i) => {
              const done = (i === 0 && step === 'verified') || (i === 1 && false);
              const active = (i === 0 && step !== 'verified') || (i === 1 && step === 'verified');
              return (
                <div key={label} style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  background: done ? 'rgba(25,135,84,.25)' : active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${done ? 'rgba(25,135,84,.5)' : active ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)'}`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {done
                    ? <CheckCircle2 size={13} color="#4ade80" />
                    : <div style={{ width: 13, height: 13, borderRadius: '50%', background: active ? '#4ade80' : 'rgba(255,255,255,.2)', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 11, fontWeight: 600, color: done ? '#4ade80' : active ? '#fff' : 'rgba(255,255,255,.35)' }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── STEP: initial + otp_sent ── */}
          {step !== 'verified' && (
            <div>
              {/* Verification buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: otpError ? 12 : 20 }}>
                {/* Mobile verify button */}
                <button
                  className="fl-btn"
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || step === 'otp_sent'}
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: step === 'otp_sent'
                      ? 'rgba(25,135,84,.18)'
                      : 'linear-gradient(135deg,#0d6efd,#0a58ca)',
                    borderRadius: 11,
                    color: step === 'otp_sent' ? '#4ade80' : '#fff',
                    fontSize: 13.5, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: step === 'otp_sent' ? '1px solid rgba(74,222,128,.35)' : 'none',
                    cursor: (sendingOtp || step === 'otp_sent') ? 'default' : 'pointer',
                    boxShadow: step === 'otp_sent' ? 'none' : '0 4px 16px rgba(13,110,253,.35)',
                  }}
                >
                  {sendingOtp
                    ? <><Spin /> Sending OTP…</>
                    : step === 'otp_sent'
                      ? <><CheckCircle2 size={14} /> OTP Sent to Mobile</>
                      : <><Smartphone size={14} /> Send OTP to Mobile <span style={{ fontSize: 11, opacity: .7 }}>(Required)</span></>
                  }
                </button>

                {/* Email verify — disabled, optional */}
                <button
                  className="fl-btn"
                  type="button"
                  disabled
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: 'rgba(255,255,255,.04)',
                    borderRadius: 11, color: 'rgba(255,255,255,.25)', fontSize: 13.5, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: '1.5px dashed rgba(255,255,255,.12)',
                    cursor: 'not-allowed',
                  }}
                >
                  <Mail size={14} /> Verify Email <span style={{ fontSize: 11 }}>(Optional)</span>
                </button>
              </div>

              {/* OTP input — shown after send */}
              {step === 'otp_sent' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    padding: '10px 14px', marginBottom: 14,
                    background: 'rgba(13,110,253,.12)',
                    border: '1px solid rgba(13,110,253,.3)',
                    borderRadius: 10, fontSize: 12.5, color: 'rgba(255,255,255,.75)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Smartphone size={13} style={{ flexShrink: 0, color: '#60a5fa' }} />
                    OTP sent to <strong style={{ color: '#93c5fd' }}>{maskedMobile}</strong>. Enter the 6-digit code below.
                  </div>

                  <label style={labelStyle}>Enter OTP</label>
                  <input
                    className="fl-inp fl-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                    placeholder="• • • • • •"
                    style={{
                      width: '100%', padding: '13px',
                      background: 'rgba(255,255,255,.10)',
                      border: '1px solid rgba(255,255,255,.18)',
                      borderRadius: 11, color: '#fff', marginBottom: 12,
                    }}
                  />

                  <button
                    className="fl-btn"
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.length !== 6}
                    style={{
                      width: '100%', padding: '11px',
                      background: otp.length === 6 && !verifyingOtp
                        ? 'linear-gradient(135deg,#198754,#16a34a)'
                        : 'rgba(255,255,255,.04)',
                      borderRadius: 11,
                      color: otp.length === 6 && !verifyingOtp ? '#fff' : 'rgba(255,255,255,.32)',
                      fontSize: 13.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      border: otp.length === 6 && !verifyingOtp ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                      cursor: otp.length === 6 && !verifyingOtp ? 'pointer' : 'not-allowed',
                      boxShadow: otp.length === 6 && !verifyingOtp ? '0 4px 16px rgba(25,135,84,.3)' : 'none',
                      marginBottom: 8,
                    }}
                  >
                    {verifyingOtp ? <><Spin /> Verifying…</> : <><ShieldCheck size={14} /> Verify OTP</>}
                  </button>

                  <button
                    type="button"
                    className="fl-btn"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,.35)', fontSize: 12,
                      cursor: 'pointer', textDecoration: 'underline',
                      fontFamily: 'inherit', display: 'block', margin: '0 auto',
                    }}
                  >
                    {sendingOtp ? 'Resending…' : 'Resend OTP'}
                  </button>
                </div>
              )}

              {otpError && <ErrorBox msg={otpError} />}
            </div>
          )}

          {/* ── STEP: verified — set new password ── */}
          {step === 'verified' && (
            <form onSubmit={handleResetPassword}>
              <div style={{
                padding: '10px 14px', marginBottom: 18,
                background: 'rgba(25,135,84,.15)',
                border: '1px solid rgba(74,222,128,.3)',
                borderRadius: 10, fontSize: 12.5, color: '#4ade80',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                Mobile number verified. Now set your new password.
              </div>

              <label htmlFor="fl-new-pw" style={labelStyle}>New Password</label>
              <PwField
                id="fl-new-pw"
                value={newPassword}
                show={showPw}
                onToggle={() => setShowPw(s => !s)}
                onChange={v => { setNewPassword(v); setPwError(''); }}
                style={{ marginBottom: strength ? 4 : 16 }}
              />

              {strength && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: strength.w, background: strength.color, transition: 'width .3s, background .3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: strength.color, fontWeight: 700 }}>{strength.label}</span>
                </div>
              )}

              <label htmlFor="fl-confirm-pw" style={labelStyle}>Confirm New Password</label>
              <PwField
                id="fl-confirm-pw"
                value={confirmPw}
                show={showConfirm}
                onToggle={() => setShowConfirm(s => !s)}
                onChange={v => { setConfirmPw(v); setPwError(''); }}
                style={{ marginBottom: 16 }}
              />

              {pwError && <ErrorBox msg={pwError} />}

              <button
                className="fl-btn"
                type="submit"
                disabled={!canReset}
                style={{
                  width: '100%', padding: '12px',
                  background: canReset ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
                  borderRadius: 11,
                  color: canReset ? '#fff' : 'rgba(255,255,255,.32)',
                  fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: canReset ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                  cursor: canReset ? 'pointer' : 'not-allowed',
                  boxShadow: canReset ? '0 4px 18px rgba(25,135,84,.35)' : 'none',
                  marginBottom: 14,
                }}
              >
                {resetting ? <><Spin /> Setting Password…</> : canReset ? <><ShieldCheck size={14} /> Set New Password</> : <><Lock size={13} /> Set New Password</>}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,.3)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
              fontFamily: 'inherit', display: 'block', margin: '8px auto 0',
            }}
          >
            Sign out and log in as a different user
          </button>
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

function PwField({ id, value, show, onToggle, onChange, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        id={id}
        className="fl-inp"
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
      <div
        role="button" tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex' }}
      >
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
