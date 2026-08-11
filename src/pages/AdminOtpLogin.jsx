import { useState, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Phone, ArrowLeft, ShieldCheck, RotateCcw, ShieldAlert, Lock, Building2 } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import { requestAdminOtp, verifyAdminOtp, completeAdminLogin } from '../services/pdf';
import Captcha from '../components/Captcha';
import LanguageToggle from '../components/LanguageToggle';
import AccessibilityMenu from '../components/AccessibilityMenu';

const otpIconStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.85)',
  cursor: 'pointer',
};

export default function AdminOtpLogin({ onBack, onLogin }) {
  const { t, i18n } = useTranslation('login');
  const orgNameHi = i18n.getFixedT('hi', 'login')('orgNamePortal');
  const orgNameEn = i18n.getFixedT('en', 'login')('orgNamePortal');

  // step 1 = mobile input, step 2 = OTP + captcha, step 3 = department selection
  const [step, setStep]               = useState(1);
  const [mobile, setMobile]           = useState('');
  const [otp, setOtp]                 = useState('');
  const [departments, setDepartments] = useState([]); // [{id, name}] — returned after OTP verified
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resendMsg, setResendMsg]     = useState('');
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef                    = useRef(null);

  const canSubmitStep1 = !loading && mobile.replace(/\D/g, '').length === 10;
  const canSubmitStep2 = !loading && captchaStatus.valid && otp.length === 6;
  const canSubmitStep3 = !loading && selectedDeptId !== '';

  // ── Step 1: request OTP ───────────────────────────────────────
  async function handleSendOtp(e) {
    e?.preventDefault();
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length < 10) { setError(t('adminOtpScreen.errorMobileInvalid')); return; }
    setLoading(true); setError(''); setResendMsg('');
    try {
      await requestAdminOtp(cleaned);
      setMobile(cleaned);
      setStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('adminOtpScreen.errorSendFailed'));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP, get departments ───────────────────────
  async function handleVerifyOtp(e) {
    e?.preventDefault();
    if (otp.length !== 6) { setError(t('adminOtpScreen.errorOtp6Digits')); return; }
    if (!captchaStatus.touched)          { setError(t('errorFillCaptcha')); return; }
    if (!captchaRef.current?.validate()) { setError(t('errorCorrectCaptcha')); return; }
    setLoading(true); setError('');
    try {
      const res = await verifyAdminOtp(mobile, otp);
      const token = res.data?.token;
      const depts = res.data?.departments || [];

      // Super Admin — JWT issued directly, no department selection needed.
      if (token) {
        onLogin({ token });
        return;
      }

      if (depts.length === 0) {
        setError(t('adminOtpScreen.errorNoDepts'));
        return;
      }
      if (depts.length === 1) {
        // Single department admin — complete login immediately without showing step 3
        const loginRes = await completeAdminLogin(mobile, otp, depts[0].id);
        onLogin({ token: loginRes.data.access_token });
        return;
      }
      setDepartments(depts);
      setStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('adminOtpScreen.errorInvalidOtp'));
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: select department, complete login ─────────────────
  async function handleCompleteLogin(e) {
    e?.preventDefault();
    if (!selectedDeptId) { setError(t('adminOtpScreen.errorDeptRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await completeAdminLogin(mobile, otp, Number(selectedDeptId));
      onLogin({ token: res.data.access_token });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('adminOtpScreen.errorLoginFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp(''); setError(''); setResendMsg(''); setLoading(true);
    try {
      await requestAdminOtp(mobile);
      setResendMsg(t('adminOtpScreen.resendMsg'));
    } catch {
      setError(t('adminOtpScreen.errorResendFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .aol * { box-sizing:border-box; margin:0; padding:0; }
        .aol { font-family:var(--font); }
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
        .aol-dept-opt { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; cursor:pointer;
          border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); transition:all .15s; margin-bottom:7px; }
        .aol-dept-opt:hover { border-color:rgba(74,222,128,.45); background:rgba(74,222,128,.08); }
        .aol-dept-opt.sel { border-color:rgba(74,222,128,.7); background:rgba(74,222,128,.12); }

        @media (max-width:640px) {
          .aol-masthead { top:10px !important; left:14px !important; gap:8px !important; }
          .aol-masthead-logo { width:44px !important; height:44px !important; }
          .aol-masthead-text { transform:none !important; }
          .aol-masthead-hi { display:none !important; }
          .aol-masthead-en { font-size:13px !important; white-space:normal !important; max-width:150px; line-height:1.2 !important; }
          .aol-topright { top:10px !important; right:14px !important; gap:8px !important; }
        }
        @media (max-width:380px) {
          .aol-masthead-logo { width:36px !important; height:36px !important; }
          .aol-masthead-en { font-size:11.5px !important; max-width:120px; }
        }
      `}</style>

      <div className="aol full-vh-min" style={{
        width: '100vw', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowX: 'hidden', padding: '48px 16px',
      }}>
        <img src={bannerBg} alt="" className="fixed-bg-img"
          style={{ objectFit: 'cover', zIndex: 0, filter: 'blur(2px)', transform: 'scale(1.02)' }} />
        <div className="fixed-bg-img" style={{ zIndex: 1, background: 'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }} />

        {/* Masthead */}
        <div className="aol-masthead" style={{ position: 'absolute', top: 14, left: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 'calc(100vw - 64px)' }}>
          <img src={haryanaLogo} alt="Haryana" loading="lazy" className="aol-masthead-logo" style={{ width: 100, height: 100, objectFit: 'contain', flexShrink: 0 }} />
          <div className="aol-masthead-text" style={{ display: 'flex', flexDirection: 'column', gap: 1, whiteSpace: 'nowrap', transform: 'translateY(12px)', minWidth: 0, textAlign: 'left' }}>
            <span className="aol-masthead-hi" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.62)', letterSpacing: '.01em' }}>{orgNameHi}</span>
            <span className="aol-masthead-en" style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.01em' }}>{orgNameEn}</span>
          </div>
        </div>
        <div className="aol-topright" style={{ position: 'absolute', top: 42, right: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageToggle variant="dark" iconOnly buttonStyle={otpIconStyle} />
          <AccessibilityMenu iconButtonStyle={otpIconStyle} />
        </div>

        <div className="aol-card" style={{
          position: 'relative', zIndex: 2,
          width: 'clamp(300px,28vw,400px)',
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

          {/* ── Step 1: enter mobile ── */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <button type="button" onClick={onBack}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                  <ArrowLeft size={12} /> {t('adminOtpScreen.backToPortal')}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>{t('adminOtpScreen.title')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.3)' }}>
                  <ShieldAlert size={11} color="#4ade80" />
                  <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>{t('adminOtpScreen.badge')}</span>
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                {t('adminOtpScreen.subtitle')}
              </p>
              <label htmlFor="aol-mobile" style={labelStyle}>
                <Phone size={10} color="rgba(255,255,255,.4)" /> {t('adminOtpScreen.mobileNumber')}
              </label>
              <input
                id="aol-mobile" className="aol-inp" type="text" inputMode="numeric" maxLength={10}
                value={mobile}
                onChange={e => { setMobile(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder={t('adminOtpScreen.mobilePlaceholder')}
                autoComplete="tel"
                style={{ width: '100%', padding: '11px 13px', background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 16 }}
              />
              {error && <ErrorBox msg={error} />}
              <SubmitBtn active={canSubmitStep1} loading={loading} loadLabel={t('adminOtpScreen.sendingOtp')}>
                {t('adminOtpScreen.sendOtp')} &nbsp;→
              </SubmitBtn>
            </form>
          )}

          {/* ── Step 2: enter OTP + captcha ── */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <button type="button" onClick={() => { setStep(1); setError(''); setOtp(''); setResendMsg(''); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                  <ArrowLeft size={12} /> {t('adminOtpScreen.back')}
                </button>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>{t('adminOtpScreen.enterOtpTitle')}</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                <Trans t={t} i18nKey="adminOtpScreen.otpSentTo" values={{ masked: `${mobile.slice(0,3)}****${mobile.slice(-3)}` }} components={[<strong key="s" style={{ color: 'rgba(255,255,255,.7)' }} />]} />
              </p>
              <label htmlFor="aol-otp" style={labelStyle}>{t('adminOtpScreen.otpLabel')}</label>
              <input
                id="aol-otp" className="aol-inp aol-otp-inp" type="text" inputMode="numeric" maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="------"
                autoFocus
                style={{ width: '100%', padding: '12px 13px', background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 11, color: '#fff', marginBottom: 16 }}
              />
              <Captcha ref={captchaRef} onStatusChange={setCaptchaStatus} style={{ marginBottom: 16 }} />
              {error     && <ErrorBox msg={error} />}
              {resendMsg && <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10 }}>{resendMsg}</div>}
              <SubmitBtn active={canSubmitStep2} loading={loading} loadLabel={t('adminOtpScreen.verifying')} style={{ marginBottom: 12 }}>
                <ShieldCheck size={14} /> {t('adminOtpScreen.verifyOtp')}
              </SubmitBtn>
              <button type="button" onClick={handleResend} disabled={loading}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', margin: '0 auto' }}>
                <RotateCcw size={11} /> {t('adminOtpScreen.resendOtp')}
              </button>
            </form>
          )}

          {/* ── Step 3: select department ── */}
          {step === 3 && (
            <form onSubmit={handleCompleteLogin}>
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <button type="button" onClick={() => { setStep(2); setError(''); setSelectedDeptId(''); setCaptchaStatus({ touched: false, valid: false }); captchaRef.current?.reset(); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                  <ArrowLeft size={12} /> {t('adminOtpScreen.back')}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Building2 size={20} color="#4ade80" strokeWidth={1.8} />
                <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>{t('adminOtpScreen.selectDepartment')}</h2>
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 18 }}>
                {t('adminOtpScreen.selectDeptSubtitle')}
              </p>

              {departments.map(dept => {
                const isSel = String(dept.id) === String(selectedDeptId);
                return (
                  <div key={dept.id} className={`aol-dept-opt${isSel ? ' sel' : ''}`}
                    onClick={() => { setSelectedDeptId(String(dept.id)); setError(''); }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSel ? '#4ade80' : 'rgba(255,255,255,.3)'}`,
                      background: isSel ? '#4ade80' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {isSel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 13.5, color: isSel ? '#fff' : 'rgba(255,255,255,.8)', fontWeight: isSel ? 600 : 400 }}>
                      {dept.name}
                    </span>
                  </div>
                );
              })}

              {error && <ErrorBox msg={error} />}
              <div style={{ marginTop: 18 }}>
                <SubmitBtn active={canSubmitStep3} loading={loading} loadLabel={t('adminOtpScreen.verifying')}>
                  <ShieldCheck size={14} /> {t('adminOtpScreen.loginBtn')}
                </SubmitBtn>
              </div>
            </form>
          )}
        </div>

        <p style={{ position: 'absolute', bottom: 14, zIndex: 2, color: 'rgba(255,255,255,.16)', fontSize: 11 }}>
          {t('footerCopyright')}
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

function SubmitBtn({ active, loading, loadLabel, children, style }) {
  return (
    <button className="aol-btn" type="submit" disabled={!active} style={{
      width: '100%', padding: '12px',
      background: active ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
      borderRadius: 11, color: active ? '#fff' : 'rgba(255,255,255,.32)', fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      border: active ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
      boxShadow: active ? '0 4px 18px rgba(25,135,84,.38)' : 'none',
      cursor: active ? 'pointer' : 'not-allowed',
      ...style,
    }}>
      {loading ? <><Spin /> {loadLabel}</> : children}
    </button>
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
      width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  );
}
