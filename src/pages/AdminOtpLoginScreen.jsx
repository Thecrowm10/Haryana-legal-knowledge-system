import { useState } from 'react';
import { ShieldCheck, Smartphone, ArrowLeft, RotateCcw } from 'lucide-react';
import { requestAdminOtp, verifyAdminOtp } from '../services/pdf';
import haryanaLogo from '../assets/haryana-logo.png';

export default function AdminOtpLoginScreen({ onBack, onSuccess }) {
  const [step, setStep]       = useState(1); // 1 = enter mobile, 2 = enter OTP
  const [mobile, setMobile]   = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const canSubmitStep1 = !loading && mobile.replace(/\D/g, '').length === 10;
  const canSubmitStep2 = !loading && otp.length === 6;

  // ── Step 1: request OTP ───────────────────────────────────
  async function handleRequestOtp(e) {
    e?.preventDefault();
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length < 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true); setError(''); setResendMsg('');
    try {
      await requestAdminOtp(cleaned);
      setMobile(cleaned);
      setStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ────────────────────────────────────
  async function handleVerify(e) {
    e?.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true); setError('');
    try {
      const res = await verifyAdminOtp(mobile, otp);
      onSuccess(res.data.access_token);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp(''); setError(''); setResendMsg(''); setLoading(true);
    try {
      await requestAdminOtp(mobile);
      setResendMsg('A new OTP has been sent.');
    } catch {
      setError('Could not resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .ao * { box-sizing:border-box; margin:0; padding:0; }
        .ao { font-family:var(--font); }
        @keyframes aoFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .ao-card { animation:aoFade .4s cubic-bezier(.22,1,.36,1) both; }
        .ao-inp  { outline:none; transition:border-color .15s,box-shadow .15s; }
        .ao-inp:focus { border-color:rgba(99,102,241,.7) !important; box-shadow:0 0 0 3px rgba(99,102,241,.15) !important; }
        .ao-btn  { transition:all .18s ease; cursor:pointer; border:none; font-family:inherit; }
        .ao-btn:hover:not(:disabled)  { filter:brightness(1.12); transform:translateY(-1px); }
        .ao-btn:active:not(:disabled) { transform:translateY(0); }
        input::placeholder { color:rgba(255,255,255,.28); font-size:13px; }
        .ao-otp { letter-spacing:14px; font-size:26px; font-weight:700; text-align:center; }
        .ao-otp::placeholder { letter-spacing:normal; font-size:13px; font-weight:400; }
      `}</style>

      <div className="ao" style={{
        width:'100vw', height:'100vh', position:'relative',
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(110deg, rgba(2,10,5,.97) 0%, rgba(15,10,40,.95) 100%)',
        overflow:'hidden',
      }}>
        {/* Grid bg */}
        <div style={{ position:'absolute', inset:0, zIndex:0, opacity:.035,
          backgroundImage:'linear-gradient(rgba(99,102,241,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.6) 1px,transparent 1px)',
          backgroundSize:'40px 40px' }}/>

        <div className="ao-card" style={{
          position:'relative', zIndex:1,
          width:'clamp(300px,90vw,400px)',
          background:'rgba(255,255,255,.07)',
          backdropFilter:'blur(30px) saturate(160%)',
          WebkitBackdropFilter:'blur(30px) saturate(160%)',
          border:'1px solid rgba(255,255,255,.13)',
          borderTop:'1px solid rgba(255,255,255,.24)',
          borderRadius:22,
          boxShadow:'0 24px 64px rgba(0,0,0,.45)',
          padding:'28px 26px 24px',
        }}>
          {/* Brand */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
            <img src={haryanaLogo} alt="Haryana Government" loading="lazy" style={{ width:38, height:38, objectFit:'contain' }} />
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Admin / Super Admin</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Secure OTP Login</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
              <ShieldCheck size={14} color="#818cf8" />
              <span style={{ fontSize:10, color:'#818cf8', fontWeight:700 }}>2FA</span>
            </div>
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <button type="button" onClick={onBack}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:11.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom:16, padding:0, fontFamily:'inherit', letterSpacing:'.04em' }}>
                <ArrowLeft size={12}/> Back
              </button>

              <h2 style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:4 }}>Admin Login</h2>
              <p style={{ fontSize:12.5, color:'rgba(255,255,255,.4)', marginBottom:22, lineHeight:1.55 }}>
                Enter your registered mobile number. A 6-digit OTP will be sent via SMS.
              </p>

              <label htmlFor="aols-mobile" style={lbl}><Smartphone size={10} color="rgba(255,255,255,.38)"/> Mobile Number</label>
              <input
                id="aols-mobile"
                className="ao-inp"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={e => { setMobile(e.target.value.replace(/\D/g,'')); setError(''); }}
                placeholder="10-digit mobile number"
                style={inp}
              />

              {error && <ErrBox msg={error} />}

              <button className="ao-btn" type="submit" disabled={!canSubmitStep1} style={{
                ...btnStyle, marginTop:20,
                background:'linear-gradient(135deg,#6366f1,#4f46e5)',
                boxShadow:'0 4px 18px rgba(99,102,241,.4)',
                cursor: canSubmitStep1 ? 'pointer' : 'not-allowed',
                opacity: canSubmitStep1 ? 1 : .7,
              }}>
                {loading ? <><Spin/> Sending OTP…</> : <>Send OTP &nbsp;→</>}
              </button>
            </form>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <form onSubmit={handleVerify}>
              <button type="button" onClick={() => { setStep(1); setOtp(''); setError(''); }}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:11.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom:16, padding:0, fontFamily:'inherit', letterSpacing:'.04em' }}>
                <ArrowLeft size={12}/> Back
              </button>

              <h2 style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:4 }}>Enter OTP</h2>
              <p style={{ fontSize:12.5, color:'rgba(255,255,255,.4)', marginBottom:22, lineHeight:1.55 }}>
                OTP sent to <strong style={{ color:'rgba(255,255,255,.7)' }}>+91 {mobile.slice(0,3)}****{mobile.slice(-3)}</strong>. Valid for 10 minutes.
              </p>

              <label htmlFor="aols-otp" style={lbl}>6-Digit OTP</label>
              <input
                id="aols-otp"
                className="ao-inp ao-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g,'')); setError(''); }}
                placeholder="------"
                autoFocus
                style={{ ...inp, padding:'14px 13px' }}
              />

              {error    && <ErrBox msg={error} />}
              {resendMsg && <p style={{ fontSize:12, color:'#818cf8', marginBottom:10 }}>{resendMsg}</p>}

              <button className="ao-btn" type="submit" disabled={!canSubmitStep2} style={{
                ...btnStyle, marginTop:16,
                background:'linear-gradient(135deg,#6366f1,#4f46e5)',
                boxShadow:'0 4px 18px rgba(99,102,241,.4)',
                cursor: canSubmitStep2 ? 'pointer' : 'not-allowed',
                opacity: canSubmitStep2 ? 1 : .7,
              }}>
                {loading ? <><Spin/> Verifying…</> : <><ShieldCheck size={14}/> Verify & Login</>}
              </button>

              <button type="button" onClick={handleResend} disabled={loading}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', margin:'14px auto 0' }}>
                <RotateCcw size={11}/> Resend OTP
              </button>
            </form>
          )}
        </div>

        <p style={{ position:'absolute', bottom:14, color:'rgba(255,255,255,.12)', fontSize:11, zIndex:1 }}>
          © 2026 Government of Haryana · HARTRON
        </p>
      </div>
    </>
  );
}

const lbl = {
  display:'flex', alignItems:'center', gap:5,
  fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,.45)',
  marginBottom:7, letterSpacing:'.08em', textTransform:'uppercase',
};
const inp = {
  width:'100%', padding:'11px 13px',
  background:'rgba(255,255,255,.09)',
  border:'1px solid rgba(255,255,255,.16)',
  borderRadius:11, fontSize:14, color:'#fff', marginBottom:4,
};
const btnStyle = {
  width:'100%', padding:'12px',
  borderRadius:11, color:'#fff', fontSize:14, fontWeight:700,
  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
};

function ErrBox({ msg }) {
  return (
    <div style={{ margin:'0 0 10px', padding:'9px 12px', background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.25)', borderRadius:9, fontSize:12, color:'#fca5a5', display:'flex', gap:7, alignItems:'center' }}>
      <span>⚠</span>{msg}
    </div>
  );
}
function Spin() {
  return <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>;
}
