import { useState, useEffect, useRef } from 'react';
import { Search, Eye, EyeOff, Shield, Lock, User, ArrowRight, ShieldAlert } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import AdminOtpLogin from './AdminOtpLogin';
import Captcha from '../components/Captcha';

export default function Login({ onLogin, loading, authError }) {
  const [screen, setScreen]       = useState('portal'); // 'portal' | 'login' | 'forgot' | 'admin-otp'
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [formError, setFormError] = useState('');
  const [shake, setShake]         = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef                = useRef(null);

  useEffect(() => {
    if (authError) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      captchaRef.current?.reset();
    }
  }, [authError]);

  const error = formError || authError;
  const canSubmit = !loading && captchaStatus.valid;

  const handleLogin = () => {
    setFormError('');
    if (!username.trim()) { setFormError('Username is required.'); return; }
    if (!password)        { setFormError('Password is required.'); return; }
    if (!captchaStatus.touched)          { setFormError('Please fill the captcha.'); return; }
    if (!captchaRef.current?.validate()) { setFormError('Please enter the correct captcha.'); return; }
    onLogin({ username: username.trim(), password });
  };

  if (screen === 'forgot')    return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
  if (screen === 'admin-otp') return <AdminOtpLogin onBack={() => setScreen('portal')} onLogin={onLogin} />;

  //  Portal Seection Screen 
  if (screen === 'portal') return (
    <>
      <style>{`
        .lk * { box-sizing:border-box; margin:0; padding:0; }
        .lk { font-family:'Plus Jakarta Sans Variable','Plus Jakarta Sans',sans-serif; }
        @keyframes fadeLeft  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)}  to{opacity:1;transform:none} }
        @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        .lk-left { animation: fadeLeft .65s cubic-bezier(.22,1,.36,1) both; }
        .lk-portal-card { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; transition: all .25s ease; }
        .lk-portal-card:hover { transform:translateY(-5px) scale(1.01) !important; box-shadow:0 24px 56px rgba(0,0,0,.25), 0 0 0 1px rgba(255,255,255,.22) !important; }
      `}</style>
      <div className="lk" style={{ width:'100vw', height:'100vh', position:'relative', overflow:'hidden', display:'flex', alignItems:'center' }}>
        <img src={bannerBg} alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, filter:'blur(2px)', transform:'scale(1.02)' }} />
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(110deg,rgba(2,10,5,.82) 0%,rgba(2,10,5,.62) 45%,rgba(2,10,5,.42) 100%)' }}/>

        <div style={{ position:'relative', zIndex:2, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 6%', gap:48 }}>

          {/* Header */}
          <div className="lk-left" style={{ textAlign:'center' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <img src={haryanaLogo} alt="Haryana" style={{ width:52, height:52, objectFit:'contain' }} />
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>Government of Haryana</div>
                <div style={{ fontSize:11.5, color:'rgba(255,255,255,.7)' }}>Legal Knowledge System</div>
              </div>
            </div>
            <h1 style={{ fontSize:'clamp(26px,3.5vw,46px)', fontWeight:800, color:'#fff', lineHeight:1.15, letterSpacing:'-.02em', marginBottom:12 }}>
              How would you like to<br/><span style={{ color:'#4ade80' }}>access the portal?</span>
            </h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.72)', maxWidth:440, margin:'0 auto' }}>
              Choose your access type to continue. Guests can search legal documents without logging in.
            </p>
          </div>

          {/* Two cards */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>

            {/* Public Access */}
            <div className="lk-portal-card" onClick={() => onLogin({ role: 'citizen' })} style={{
              width: 280, padding:'32px 28px', borderRadius:20, cursor:'pointer',
              background:'rgba(255,255,255,.05)', backdropFilter:'blur(32px) saturate(160%)', WebkitBackdropFilter:'blur(32px) saturate(160%)',
              border:'1px solid rgba(255,255,255,.14)', borderTop:'1px solid rgba(255,255,255,.28)',
              boxShadow:'0 8px 32px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.12)',
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:16,
              animationDelay:'.1s',
            }}>
              <div style={{ width:64, height:64, borderRadius:18, background:'rgba(74,222,128,.15)', border:'1px solid rgba(74,222,128,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Search size={28} color='#4ade80' strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>Public Access</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  Search and browse legal documents, acts, notifications without logging in.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(74,222,128,.15)', border:'1px solid rgba(74,222,128,.28)', color:'#4ade80', fontSize:13, fontWeight:700 }}>
                Continue as Guest <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>No login required</div>
            </div>

            {/* Official Access */}
            <div className="lk-portal-card" onClick={() => setScreen('login')} style={{
              width: 280, padding:'32px 28px', borderRadius:20, cursor:'pointer',
              background:'rgba(255,255,255,.05)', backdropFilter:'blur(32px) saturate(160%)', WebkitBackdropFilter:'blur(32px) saturate(160%)',
              border:'1px solid rgba(255,255,255,.14)', borderTop:'1px solid rgba(255,255,255,.28)',
              boxShadow:'0 8px 32px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.12)',
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:16,
              animationDelay:'.2s',
            }}>
              <div style={{ width:64, height:64, borderRadius:18, background:'rgba(99,102,241,.15)', border:'1px solid rgba(99,102,241,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Shield size={28} color='#818cf8' strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>Official Access</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  For department uploaders, approvers, CS Office and auditors.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(99,102,241,.15)', border:'1px solid rgba(99,102,241,.3)', color:'#818cf8', fontSize:13, fontWeight:700 }}>
                Login with Credentials <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>Password / SSO required</div>
            </div>

            {/* Admin Access */}
            <div className="lk-portal-card" onClick={() => setScreen('admin-otp')} style={{
              width: 280, padding:'32px 28px', borderRadius:20, cursor:'pointer',
              background:'rgba(255,255,255,.05)', backdropFilter:'blur(32px) saturate(160%)', WebkitBackdropFilter:'blur(32px) saturate(160%)',
              border:'1px solid rgba(255,255,255,.14)', borderTop:'1px solid rgba(255,255,255,.28)',
              boxShadow:'0 8px 32px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.12)',
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:16,
              animationDelay:'.3s',
            }}>
              <div style={{ width:64, height:64, borderRadius:18, background:'rgba(129,140,248,.15)', border:'1px solid rgba(129,140,248,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ShieldAlert size={28} color='#a5b4fc' strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>Admin Access</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  For system administrators. Sign in with your registered mobile number.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(129,140,248,.15)', border:'1px solid rgba(129,140,248,.3)', color:'#a5b4fc', fontSize:13, fontWeight:700 }}>
                Login with OTP <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>Mobile OTP required</div>
            </div>

          </div>
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, padding:'10px 6%', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.16)' }}>© 2026 Government of Haryana · HARTRON</div>
          <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,.13)' }}>TOR: HARTRON/PM(ICT)/ToR-CSO/2026-27/03</div>
        </div>
      </div>
    </>
  );

  //  Login Screen 
  return (
    <>
      <style>{`
        .lk * { box-sizing:border-box; margin:0; padding:0; }
        .lk { font-family:'Plus Jakarta Sans Variable','Plus Jakarta Sans',sans-serif; }

        @keyframes fadeLeft  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes fadeRight { from{opacity:0;transform:translateX(24px)}  to{opacity:1;transform:none} }
        @keyframes shake     { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }

        .lk-left { animation: fadeLeft  .65s cubic-bezier(.22,1,.36,1) both; }
        .lk-card { animation: fadeRight .65s .1s cubic-bezier(.22,1,.36,1) both; }

        .lk-btn { transition:all .18s ease; cursor:pointer; border:none; font-family:'Plus Jakarta Sans',sans-serif; }
        .lk-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 10px 30px rgba(34,197,94,.45) !important; }
        .lk-btn:active:not(:disabled) { transform:translateY(0); filter:brightness(.97); }

        .lk-inp { outline:none; font-family:'Plus Jakarta Sans',sans-serif; transition:border-color .15s,box-shadow .15s,background .15s; }
        .lk-inp:focus { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; background:rgba(255,255,255,.15) !important; }

        .lk-trigger { transition:border-color .15s,box-shadow .15s; }
        .lk-trigger.open { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; }

        .lk-opt { transition:background .12s; }
        .lk-opt:hover { background:rgba(255,255,255,.1) !important; }

        .lk-roles { animation: slideDown .2s cubic-bezier(.22,1,.36,1) both; }

        input::placeholder { color:rgba(255,255,255,.28); font-size:13px; }

        /* Custom scrollbar for dropdown */
        .lk-roles::-webkit-scrollbar { width:4px; }
        .lk-roles::-webkit-scrollbar-track { background:transparent; }
        .lk-roles::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:4px; }
      `}</style>

      <div className="lk" style={{ width:'100vw', height:'100vh', position:'relative', overflow:'hidden', display:'flex', alignItems:'center' }}>

        {/* BG */}
        <img
          src={bannerBg}
          alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, filter:'blur(2px)', transform:'scale(1.02)' }}
        />
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }}/>

        {/* Main content */}
        <div style={{ position:'relative', zIndex:2, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6%', gap:40 }}>

          {/* LEFT */}
          <div className="lk-left" style={{ flex:'1 1 0', minWidth:0, maxWidth:500 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.08)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.14)', borderRadius:100, padding:'5px 16px', marginBottom:26 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.7)', letterSpacing:'.1em', textTransform:'uppercase' }}>Legal Document Portal</span>
            </div>
            <h1 style={{ fontSize:'clamp(30px,3.8vw,52px)', fontWeight:800, lineHeight:1.1, letterSpacing:'-.025em', color:'#fff', marginBottom:16 }}>
              Haryana<br/><span style={{ color:'#4ade80' }}>Legal</span><br/>Knowledge<br/>System.
            </h1>
            <p style={{ fontSize:14.5, color:'rgba(255,255,255,.42)', lineHeight:1.8, maxWidth:360, marginBottom:40 }}>
              Unified platform for managing government legal documents, circulars, and official orders — secure, auditable, and compliant.
            </p>
            <div style={{ display:'flex', gap:'clamp(20px,3vw,44px)' }}>
              {[['5','Official Roles'],['100%','Audit Trail'],['2026','Active Since']].map(([v,l])=>(
                <div key={l}>
                  <div style={{ fontSize:'clamp(20px,2.5vw,30px)', fontWeight:800, color:'#fff' }}>{v}</div>
                  <div style={{ fontSize:10.5, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em', marginTop:4, fontWeight:600 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — GLASS CARD  */}
          <div
            className="lk-card"
            style={{
              width:'clamp(300px,27vw,385px)', flexShrink:0,
              background:'rgba(255,255,255,.09)',
              backdropFilter:'blur(30px) saturate(160%)',
              WebkitBackdropFilter:'blur(30px) saturate(160%)',
              border:'1px solid rgba(255,255,255,.16)',
              borderTop:'1px solid rgba(255,255,255,.26)',
              borderLeft:'1px solid rgba(255,255,255,.20)',
              borderRadius:22,
              boxShadow:'0 24px 64px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.14)',
              padding:'26px 24px 22px',
              animation: shake ? 'shake .4s ease' : undefined,
            }}
          >
            {/* Brand row */}
            <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:20, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,.1)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img
                  src={haryanaLogo}
                  alt="Haryana Government"
                  style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 13 }}
                />
              </div>
              <div>
                <div style={{ fontSize:14.5, fontWeight:700, color:'#fff' }}>Haryana Government</div>
                <div style={{ fontSize:11.5, color:'rgba(255,255,255,.42)', marginTop:2 }}>Legal Knowledge System</div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }}/>
                <span style={{ fontSize:10, color:'rgba(255,255,255,.35)', fontWeight:600 }}>LIVE</span>
              </div>
            </div>

            <button onClick={() => { setScreen('portal'); setUsername(''); setPassword(''); setFormError(''); }}
              style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.4)', fontSize:11.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom:14, padding:0, fontFamily:'Plus Jakarta Sans,sans-serif', letterSpacing:'.04em' }}>
              ← Back to Portal Selection
            </button>
            <h2 style={{ fontSize:21, fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:3 }}>Official Login</h2>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,.42)', marginBottom:20 }}>Department & Administration Portal</p>

            {/* Username */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,.5)', marginBottom:7, letterSpacing:'.08em', textTransform:'uppercase' }}>
                <User size={10} color='rgba(255,255,255,.4)'/> Username
              </label>
              <input
                className="lk-inp"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setFormError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your username"
                autoComplete="username"
                style={{
                  width:'100%', padding:'11px 13px',
                  background:'rgba(255,255,255,.10)',
                  border:`1px solid ${error && error.toLowerCase().includes('username') ? 'rgba(248,113,113,.55)' : 'rgba(255,255,255,.18)'}`,
                  borderRadius:11, fontSize:13.5, color:'#fff',
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,.5)', marginBottom:7, letterSpacing:'.08em', textTransform:'uppercase' }}>
                <Lock size={10} color='rgba(255,255,255,.4)'/> Password
              </label>
              <div style={{ position:'relative' }}>
                <input
                  className="lk-inp"
                  type={showPass?'text':'password'}
                  value={password}
                  onChange={e=>{ setPassword(e.target.value); setFormError(''); }}
                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                  placeholder="Enter your password"
                  style={{
                    width:'100%', padding:'11px 38px 11px 13px',
                    background:'rgba(255,255,255,.10)',
                    border:`1px solid ${error&&error.toLowerCase().includes('password')?'rgba(248,113,113,.55)':'rgba(255,255,255,.18)'}`,
                    borderRadius:11, fontSize:13.5, color:'#fff',
                  }}
                />
                <div onClick={()=>setShowPass(s=>!s)} style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', cursor:'pointer', color:'rgba(255,255,255,.28)', display:'flex' }}>
                  {showPass?<EyeOff size={14}/>:<Eye size={14}/>}
                </div>
              </div>
            </div>

            {/* Captcha */}
            <Captcha ref={captchaRef} onStatusChange={setCaptchaStatus} style={{ marginBottom: 16 }} />

            {/* Error */}
            {error&&(
              <div style={{ marginBottom:12, padding:'9px 12px', background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.28)', borderRadius:9, fontSize:12, color:'#fca5a5', display:'flex', gap:7, alignItems:'center' }}>
                <span>⚠</span>{error}
              </div>
            )}

            {/* Button */}
            <button className="lk-btn" onClick={handleLogin} disabled={loading}
              style={{
                width:'100%', padding:'12px', marginBottom:12,
                background: canSubmit ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,.04)',
                borderRadius:11, color: canSubmit ? '#fff' : 'rgba(255,255,255,.32)', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                letterSpacing:'.01em',
                border: canSubmit ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 18px rgba(34,197,94,.38)' : 'none',
              }}
            >
              {loading
                ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/> Signing in…</>
                : canSubmit
                  ? <>Login &nbsp;→</>
                  : <><Lock size={13}/> Login</>
              }
            </button>

            {/* Forgot password */}
            <div style={{ textAlign:'right', marginBottom:10, marginTop:-4 }}>
              <button
                type="button"
                onClick={() => setScreen('forgot')}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.38)', fontSize:12, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif', textDecoration:'underline', padding:0 }}
              >
                Forgot Password?
              </button>
            </div>

    

          </div>
        </div>

        {/* Footer */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, padding:'10px 6%', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.16)' }}>© 2026 Government of Haryana · HARTRON</div>
          <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,.13)' }}>TOR: HARTRON/PM(ICT)/ToR-CSO/2026-27/03</div>
        </div>
      </div>
    </>
  );
}