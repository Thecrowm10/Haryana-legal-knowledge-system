import { useState, useEffect, useRef } from 'react';
import { warmupCrypto } from '../services/crypto';
import { useTranslation } from 'react-i18next';
import { Search, Eye, EyeOff, Shield, Lock, User, ArrowRight, ShieldAlert, UploadCloud, CheckCircle2, BarChart3, Settings, FileSearch } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import AdminOtpLogin from './AdminOtpLogin';
import Captcha from '../components/Captcha';
import LanguageToggle from '../components/LanguageToggle';
import AccessibilityMenu from '../components/AccessibilityMenu';

const loginIconStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.85)',
  cursor: 'pointer',
};

export default function Login({ onLogin, loading, authError, initialScreen = 'portal' }) {
  const { t } = useTranslation('login');
  const [screen, setScreen]       = useState(initialScreen); // 'portal' | 'login' | 'forgot' | 'admin-otp'
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [formError, setFormError] = useState('');
  const [shake, setShake]         = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef                = useRef(null);

  useEffect(() => {
    // Pre-initialise the JSEncrypt instance so first login is instant
    warmupCrypto();
  }, []);

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
    if (!username.trim()) { setFormError(t('errorUsernameRequired')); return; }
    if (!password)        { setFormError(t('errorPasswordRequired')); return; }
    if (!captchaStatus.touched)          { setFormError(t('errorFillCaptcha')); return; }
    if (!captchaRef.current?.validate()) { setFormError(t('errorCorrectCaptcha')); return; }
    onLogin({ username: username.trim(), password });
  };

  if (screen === 'forgot')    return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
  if (screen === 'admin-otp') return <AdminOtpLogin onBack={() => setScreen('portal')} onLogin={onLogin} />;

  //  Portal Seection Screen 
  if (screen === 'portal') return (
    <>
      <style>{`
        .lk * { box-sizing:border-box; margin:0; padding:0; }
        .lk { font-family:var(--font); }
        @keyframes fadeLeft  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)}  to{opacity:1;transform:none} }
        @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        .lk-left { animation: fadeLeft .65s cubic-bezier(.22,1,.36,1) both; }
        .lk-portal-card { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; transition: all .25s ease; }
        .lk-portal-card:hover { transform:translateY(-5px) scale(1.01) !important; box-shadow:0 24px 56px rgba(0,0,0,.25), 0 0 0 1px rgba(255,255,255,.22) !important; }

        @media (max-width:640px) {
          .lk-portal-content { padding:64px 5% 28px !important; gap:32px !important; }
          .lk-portal-card { width:100% !important; max-width:340px !important; padding:26px 22px !important; }
        }
      `}</style>
      <div className="lk" style={{ width:'100vw', minHeight:'100vh', position:'relative', overflowX:'hidden', display:'flex', alignItems:'center' }}>
        <img src={bannerBg} alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, filter:'blur(2px)', transform:'scale(1.02)' }} />
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(110deg,rgba(2,10,5,.82) 0%,rgba(2,10,5,.62) 45%,rgba(2,10,5,.42) 100%)' }}/>

        <div style={{ position: 'fixed', top: 24, right: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LanguageToggle variant="dark" iconOnly buttonStyle={loginIconStyle} />
          <AccessibilityMenu iconButtonStyle={loginIconStyle} />
        </div>

        <div className="lk-portal-content" style={{ position:'relative', zIndex:2, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 6%', gap:48 }}>

          {/* Header */}
          <div className="lk-left" style={{ textAlign:'center', position: 'relative' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <img src={haryanaLogo} alt="Haryana" style={{ width:52, height:52, objectFit:'contain' }} />
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>{t('orgNamePortal')}</div>
                <div style={{ fontSize:11.5, color:'rgba(255,255,255,.7)' }}>{t('tagline')}</div>
              </div>
            </div>
            <h1 style={{ fontSize:'clamp(26px,3.5vw,46px)', fontWeight:800, color:'#fff', lineHeight:1.15, letterSpacing:'-.02em', marginBottom:12 }}>
              {t('heroLine1')}<br/><span style={{ color:'#4ade80' }}>{t('heroLine2')}</span>
            </h1>
            <p style={{ fontSize: 'var(--font-size-p2)', color:'rgba(255,255,255,.72)', maxWidth:440, margin:'0 auto' }}>
              {t('heroSubtitle')}
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
                <div style={{ fontSize: 'var(--font-size-h3)', fontWeight:800, color:'#fff', marginBottom:8 }}>{t('publicAccessTitle')}</div>
                <div style={{ fontSize: 'var(--font-size-p2)', color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  {t('publicAccessDesc')}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(74,222,128,.15)', border:'1px solid rgba(74,222,128,.28)', color:'#4ade80', fontSize:13, fontWeight:700 }}>
                {t('continueAsGuest')} <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>{t('noLoginRequired')}</div>
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
                <div style={{ fontSize: 'var(--font-size-h3)', fontWeight:800, color:'#fff', marginBottom:8 }}>{t('officialAccessTitle')}</div>
                <div style={{ fontSize: 'var(--font-size-p2)', color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  {t('officialAccessDesc')}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(99,102,241,.15)', border:'1px solid rgba(99,102,241,.3)', color:'#818cf8', fontSize:13, fontWeight:700 }}>
                {t('loginWithCredentials')} <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>{t('passwordSsoRequired')}</div>
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
                <div style={{ fontSize: 'var(--font-size-h3)', fontWeight:800, color:'#fff', marginBottom:8 }}>{t('adminAccessTitle')}</div>
                <div style={{ fontSize: 'var(--font-size-p2)', color:'rgba(255,255,255,.75)', lineHeight:1.65 }}>
                  {t('adminAccessDesc')}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, padding:'9px 20px', borderRadius:50, background:'rgba(129,140,248,.15)', border:'1px solid rgba(129,140,248,.3)', color:'#a5b4fc', fontSize:13, fontWeight:700 }}>
                {t('loginWithOtp')} <ArrowRight size={14}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:-6 }}>{t('mobileOtpRequired')}</div>
            </div>

          </div>
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, padding:'10px 6%', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.16)' }}>{t('footerCopyright')}</div>
        </div>
      </div>
    </>
  );

  //  Login Screen 
  return (
    <>
      <style>{`
        .lk * { box-sizing:border-box; margin:0; padding:0; }
        .lk { font-family:var(--font); }

        @keyframes fadeLeft  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes fadeRight { from{opacity:0;transform:translateX(24px)}  to{opacity:1;transform:none} }
        @keyframes shake     { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }

        .lk-left { animation: fadeLeft  .65s cubic-bezier(.22,1,.36,1) both; }
        .lk-card { animation: fadeRight .65s .1s cubic-bezier(.22,1,.36,1) both; }

        .lk-btn { transition:all .18s ease; cursor:pointer; border:none; font-family:var(--font); }
        .lk-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 10px 30px rgba(25, 135, 84,.45) !important; }
        .lk-btn:active:not(:disabled) { transform:translateY(0); filter:brightness(.97); }

        .lk-inp { outline:none; font-family:var(--font); transition:border-color .15s,box-shadow .15s,background .15s; }
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

        @media (max-width:1024px) {
          .lk-row { flex-direction:column !important; align-items:stretch !important; justify-content:flex-start !important; padding:64px 6% 32px !important; gap:28px !important; }
          .lk-left { max-width:100% !important; text-align:center; }
          .lk-hero-desc, .lk-role-strip { margin-left:auto !important; margin-right:auto !important; }
          .lk-card { width:100% !important; max-width:420px !important; margin:0 auto; }
        }
        @media (max-width:640px) {
          .lk-role-strip { display:none !important; }
        }
      `}</style>

      <div className="lk" style={{ width:'100vw', minHeight:'100vh', position:'relative', overflowX:'hidden', display:'flex', alignItems:'center' }}>

        {/* BG */}
        <img
          src={bannerBg}
          alt=""
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, filter:'blur(2px)', transform:'scale(1.02)' }}
        />
        <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }}/>

        {/* Main content */}
        <div className="lk-row" style={{ position:'relative', zIndex:2, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 6%', gap:40 }}>

          {/* LEFT */}
          <div className="lk-left" style={{ flex:'1 1 0', minWidth:0, maxWidth:500 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.08)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.14)', borderRadius:100, padding:'5px 16px', marginBottom:26 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.7)', letterSpacing:'.1em', textTransform:'uppercase' }}>{t('badge')}</span>
            </div>
            <h1 style={{ fontSize:'clamp(30px,3.8vw,52px)', fontWeight:800, lineHeight:1.1, letterSpacing:'-.025em', color:'#fff', marginBottom:16 }}>
              {t('brandHaryana')}<br/><span style={{ color:'#4ade80' }}>{t('brandLegal')}</span><br/>{t('brandSystem')}
            </h1>
            <p className="lk-hero-desc" style={{ fontSize: 'var(--font-size-p2)', color:'rgba(255,255,255,.42)', lineHeight:1.8, maxWidth:360, marginBottom:0 }}>
              {t('heroDescription')}
            </p>

            {/* Role strip — the 5 official roles this portal serves, purely iconographic.
                Pinned to the same 360px column as the paragraph above (justify-between, no
                gap/wrap) so the two blocks share one consistent left edge AND right edge.
                Hidden below 640px (see .lk-role-strip media rule) — no room to shrink further. */}
            <div className="lk-role-strip" style={{ marginTop:30, maxWidth:360, display:'flex', justifyContent:'space-between' }}>
              {[
                [UploadCloud,  t('roleUploader')],
                [CheckCircle2, t('roleApprover')],
                [BarChart3,    t('roleCsOffice')],
                [Settings,     t('roleAdmin')],
                [FileSearch,   t('roleAuditor')],
              ].map(([Icon, label]) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:9, width:56 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .15s, border-color .15s' }}>
                    <Icon size={17} color="rgba(74,222,128,.85)" strokeWidth={1.8}/>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.38)', textAlign:'center', lineHeight:1.3, letterSpacing:'.01em' }}>{label}</div>
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
                <div style={{ fontSize:14.5, fontWeight:700, color:'#fff' }}>{t('orgNameBrand')}</div>
                <div style={{ fontSize:11.5, color:'rgba(255,255,255,.42)', marginTop:2 }}>{t('tagline')}</div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }}/>
                <span style={{ fontSize:10, color:'rgba(255,255,255,.35)', fontWeight:600 }}>{t('liveLabel')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button onClick={() => { setScreen('portal'); setUsername(''); setPassword(''); setFormError(''); }}
                style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.4)', fontSize:11.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, padding:0, fontFamily:'var(--font)', letterSpacing:'.04em' }}>
                {t('backToPortal')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LanguageToggle variant="dark" iconOnly buttonStyle={{ ...loginIconStyle, width: 26, height: 26 }} />
                <AccessibilityMenu iconButtonStyle={{ ...loginIconStyle, width: 26, height: 26 }} />
              </div>
            </div>
            <h2 style={{ fontSize: 'var(--font-size-h3)', fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:3 }}>{t('officialLogin')}</h2>
            <p style={{ fontSize: 'var(--font-size-small)', color:'rgba(255,255,255,.42)', marginBottom:20 }}>{t('departmentPortalSubtitle')}</p>

            {/* Username */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,.5)', marginBottom:7, letterSpacing:'.08em', textTransform:'uppercase' }}>
                <User size={10} color='rgba(255,255,255,.4)'/> {t('username')}
              </label>
              <input
                className="lk-inp"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setFormError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder={t('usernamePlaceholder')}
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
                <Lock size={10} color='rgba(255,255,255,.4)'/> {t('password')}
              </label>
              <div style={{ position:'relative' }}>
                <input
                  className="lk-inp"
                  type={showPass?'text':'password'}
                  value={password}
                  onChange={e=>{ setPassword(e.target.value); setFormError(''); }}
                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                  placeholder={t('passwordPlaceholder')}
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
                background: canSubmit ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
                borderRadius:11, color: canSubmit ? '#fff' : 'rgba(255,255,255,.32)', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                letterSpacing:'.01em',
                border: canSubmit ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 18px rgba(25, 135, 84,.38)' : 'none',
              }}
            >
              {loading
                ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/> {t('signingIn')}</>
                : canSubmit
                  ? <>{t('loginButton')} &nbsp;→</>
                  : <><Lock size={13}/> {t('loginButton')}</>
              }
            </button>

            {/* Forgot password */}
            <div style={{ textAlign:'right', marginBottom:10, marginTop:-4 }}>
              <button
                type="button"
                onClick={() => setScreen('forgot')}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.38)', fontSize:12, cursor:'pointer', fontFamily:'var(--font)', textDecoration:'underline', padding:0 }}
              >
                {t('forgotPassword')}
              </button>
            </div>

    

          </div>
        </div>

        {/* Footer */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, padding:'10px 6%', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.16)' }}>{t('footerCopyright')}</div>
        </div>
      </div>
    </>
  );
}