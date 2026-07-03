import { useState } from 'react';
import { Phone, ArrowLeft, ShieldCheck, RotateCcw, ShieldAlert } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';

// swap this with a real OTP generator in production 
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AdminOtpLogin({ onBack, onLogin }) {
  const [step, setStep]       = useState(1); // 1 = enter mobile, 2 = enter OTP
  const [mobile, setMobile]   = useState('');
  const [otp, setOtp]         = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resendMsg, setResendMsg] = useState('');

  function sendOtp() {
    const code = generateOtp();
    setSentOtp(code);
    return code;
  }

  // ── Step 1: send OTP to mobile ────────────────────────────
  function handleSendOtp(e) {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setError('Enter a valid 10-digit registered admin mobile number.');
      return;
    }
    setLoading(true); setError('');
    setTimeout(() => {
      sendOtp();
      setLoading(false);
      setStep(2);
    }, 500);
  }

  // ── Step 2: verify OTP ────────────────────────────────────
  function handleVerify(e) {
    e?.preventDefault();
    if (otp.length !== 6) { setError('OTP must be 6 digits.'); return; }
    if (otp !== sentOtp)  { setError('Invalid or expired OTP.'); return; }
    onLogin({ role: 'admin', mobile: mobile.trim() });
  }

  function handleResend() {
    setError(''); setOtp(''); setResendMsg('');
    setLoading(true);
    setTimeout(() => {
      sendOtp();
      setLoading(false);
      setResendMsg('A new OTP has been generated.');
    }, 400);
  }

  return (
    <>
      <style>{`
        .aol * { box-sizing:border-box; margin:0; padding:0; }
        .aol { font-family:'Plus Jakarta Sans Variable','Plus Jakarta Sans',sans-serif; }
        @keyframes aolFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .aol-card { animation: aolFade .4s cubic-bezier(.22,1,.36,1) both; }
        .aol-inp { outline:none; transition:border-color .15s,box-shadow .15s; }
        .aol-inp:focus { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; }
        .aol-btn { transition:all .18s ease; cursor:pointer; border:none; font-family:inherit; }
        .aol-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); }
        .aol-btn:active:not(:disabled) { transform:translateY(0); }
        input::placeholder { color:rgba(255,255,255,.3); font-size:13px; }
        .aol-otp-inp { letter-spacing:12px; font-size:24px; font-weight:700; text-align:center; }
        .aol-otp-inp::placeholder { letter-spacing:normal; font-size:14px; font-weight:400; }
      `}</style>

      <div className="aol" style={{
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

        <div className="aol-card" style={{
          position: 'relative', zIndex: 2,
          width: 'clamp(300px,27vw,385px)',
          background: 'rgba(255,255,255,.09)',
          backdropFilter: 'blur(30px) saturate(160%)',
          WebkitBackdropFilter: 'blur(30px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.16)',
          borderTop: '1px solid rgba(255,255,255,.26)',
          borderLeft: '1px solid rgba(255,255,255,.20)',
          borderRadius: 22,
          boxShadow: '0 24px 64px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.14)',
          padding: '26px 24px 22px',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <img src={haryanaLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Haryana Government</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.42)', marginTop: 2 }}>Legal Knowledge System</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)' }}>
              <ShieldAlert size={11} color="#4ade80" />
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>ADMIN</span>
            </div>
          </div>

          {/* ── Step 1: enter mobile ── */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <button type="button" onClick={onBack}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                <ArrowLeft size={12} /> Back to Portal Selection
              </button>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>Admin Access</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                System Administrator sign-in — enter your registered mobile number to receive a 6-digit OTP.
              </p>

              <label style={labelStyle}>
                <Phone size={10} color="rgba(255,255,255,.4)" /> Mobile Number
              </label>
              <input
                className="aol-inp"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={e => { setMobile(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="9876543210"
                autoComplete="tel"
                style={{
                  width: '100%', padding: '11px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 16,
                }}
              />

              {error && <ErrorBox msg={error} />}

              <button className="aol-btn" type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 18px rgba(34,197,94,.38)',
                opacity: loading ? .7 : 1,
              }}>
                {loading ? <><Spin /> Sending OTP…</> : <>Send OTP &nbsp;→</>}
              </button>
            </form>
          )}

          {/* ── Step 2: verify OTP ── */}
          {step === 2 && (
            <form onSubmit={handleVerify}>
              <button type="button" onClick={() => { setStep(1); setError(''); setOtp(''); setResendMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                <ArrowLeft size={12} /> Back
              </button>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>Enter OTP</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 16 }}>
                A 6-digit OTP was sent to +91 {mobile}. Valid for 10 minutes.
              </p>

              {/* Demo-mode banner — no real SMS gateway wired up */}
              <div style={{ marginBottom: 16, padding: '9px 12px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.28)', borderRadius: 9, fontSize: 12, color: '#bbf7d0' }}>
                Demo mode — OTP: <strong style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>{sentOtp}</strong>
              </div>

              <label style={labelStyle}>OTP (6 digits)</label>
              <input
                className="aol-inp aol-otp-inp"
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

              {error     && <ErrorBox msg={error} />}
              {resendMsg && <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10 }}>{resendMsg}</div>}

              <button className="aol-btn" type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 18px rgba(34,197,94,.38)',
                opacity: loading ? .7 : 1, marginBottom: 12,
              }}>
                {loading ? <><Spin /> Verifying…</> : <><ShieldCheck size={14} /> Verify & Login</>}
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
