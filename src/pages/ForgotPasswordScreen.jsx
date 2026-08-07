import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, ArrowLeft, ShieldCheck, Eye, EyeOff, RotateCcw, CheckCircle2, Lock } from 'lucide-react';
import { requestPasswordReset, resetPasswordWithOtp } from '../services/pdf';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import Captcha from '../components/Captcha';
import LanguageToggle from '../components/LanguageToggle';
import AccessibilityMenu from '../components/AccessibilityMenu';

const fpIconStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.85)',
  cursor: 'pointer',
};

export default function ForgotPasswordScreen({ onBack }) {
  const { t, i18n } = useTranslation('login');
  const orgNameHi = i18n.getFixedT('hi', 'login')('orgNamePortal');
  const orgNameEn = i18n.getFixedT('en', 'login')('orgNamePortal');
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
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef              = useRef(null);

  const isEmail   = identifier.includes('@');
  const InputIcon = isEmail ? Mail : Phone;
  const canSubmitStep1 = !loading && identifier.trim() !== '';
  const canSubmitStep2 = !loading && captchaStatus.valid
    && otp.length === 6 && newPass.length >= 8 && newPass === confirm;

  // ── Step 1: request OTP ───────────────────────────────────
  async function handleRequestOtp(e) {
    e?.preventDefault();
    if (!identifier.trim()) { setError(t('forgotPasswordScreen.errorIdentifierRequired')); return; }
    setLoading(true); setError(''); setResendMsg('');
    try {
      const res = await requestPasswordReset(identifier.trim());
      setChannel(res.data.channel);
      setStep(2);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('forgotPasswordScreen.errorSendFailed'));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP + reset ────────────────────────────
  async function handleReset(e) {
    e?.preventDefault();
    if (otp.length !== 6)       { setError(t('forgotPasswordScreen.errorOtp6Digits')); return; }
    if (newPass.length < 8)     { setError(t('forgotPasswordScreen.errorPasswordMin8')); return; }
    if (newPass !== confirm)    { setError(t('forgotPasswordScreen.errorPasswordsNoMatch')); return; }
    if (!captchaStatus.touched)          { setError(t('errorFillCaptcha')); return; }
    if (!captchaRef.current?.validate()) { setError(t('errorCorrectCaptcha')); return; }
    setLoading(true); setError('');
    try {
      await resetPasswordWithOtp(identifier.trim(), otp, newPass);
      setStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('forgotPasswordScreen.errorResetFailed'));
      captchaRef.current?.reset();
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
      setResendMsg(t('forgotPasswordScreen.resendMsg'));
    } catch {
      setError(t('forgotPasswordScreen.errorResendFailed'));
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
    if (s <= 1) return { label: t('forgotPasswordScreen.strengthWeak'),   color: '#dc3545', w: '25%' };
    if (s <= 2) return { label: t('forgotPasswordScreen.strengthFair'),   color: '#b45309', w: '50%' };
    if (s <= 3) return { label: t('forgotPasswordScreen.strengthGood'),   color: '#0d6efd', w: '75%' };
    return              { label: t('forgotPasswordScreen.strengthStrong'), color: '#198754', w: '100%' };
  })();

  return (
    <>
      <style>{`
        .fp * { box-sizing:border-box; margin:0; padding:0; }
        .fp { font-family:var(--font); }
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

        @media (max-width:640px) {
          .fp-masthead { top:10px !important; left:14px !important; gap:8px !important; }
          .fp-masthead-logo { width:44px !important; height:44px !important; }
          .fp-masthead-text { transform:none !important; }
          .fp-masthead-hi { display:none !important; }
          .fp-masthead-en { font-size:13px !important; white-space:normal !important; max-width:150px; line-height:1.2 !important; }
          .fp-topright { top:10px !important; right:14px !important; gap:8px !important; }
        }
        @media (max-width:380px) {
          .fp-masthead-logo { width:36px !important; height:36px !important; }
          .fp-masthead-en { font-size:11.5px !important; max-width:120px; }
        }
      `}</style>

      <div className="fp full-vh-min" style={{
        width: '100vw', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowX: 'hidden', padding: '48px 16px',
      }}>
        <img
          src={bannerBg}
          alt=""
          className="fixed-bg-img"
          style={{ objectFit: 'cover', zIndex: 0, filter: 'blur(2px)', transform: 'scale(1.02)' }}
        />
        <div className="fixed-bg-img" style={{ zIndex: 1, background: 'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }}/>

        {/* Masthead — same position/size as the other login screens */}
        <div className="fp-masthead" style={{ position: 'absolute', top: 14, left: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 'calc(100vw - 64px)' }}>
          <img src={haryanaLogo} alt="Haryana" loading="lazy" className="fp-masthead-logo" style={{ width: 100, height: 100, objectFit: 'contain', flexShrink: 0 }} />
          <div className="fp-masthead-text" style={{ display: 'flex', flexDirection: 'column', gap: 1, whiteSpace: 'nowrap', transform: 'translateY(12px)', minWidth: 0 }}>
            <span className="fp-masthead-hi" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.62)', letterSpacing: '.01em' }}>{orgNameHi}</span>
            <span className="fp-masthead-en" style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.01em' }}>{orgNameEn}</span>
          </div>
        </div>
        <div className="fp-topright" style={{ position: 'absolute', top: 42, right: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageToggle variant="dark" iconOnly buttonStyle={fpIconStyle} />
          <AccessibilityMenu iconButtonStyle={fpIconStyle} />
        </div>

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
          {/* ── Success ── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle2 size={52} color="#198754" style={{ marginBottom: 14 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{t('forgotPasswordScreen.successTitle')}</h2>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 24 }}>
                {t('forgotPasswordScreen.successMsgLine1')}<br/>{t('forgotPasswordScreen.successMsgLine2')}
              </p>
              <button className="fp-btn" onClick={onBack} style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg,#198754,#16a34a)',
                borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                {t('forgotPasswordScreen.goToLogin')}
              </button>
            </div>
          )}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <button type="button" onClick={onBack}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                  <ArrowLeft size={12} /> {t('forgotPasswordScreen.backToLogin')}
                </button>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>{t('forgotPasswordScreen.title')}</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                {t('forgotPasswordScreen.subtitle')}
              </p>

              <label htmlFor="fp-identifier" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: 7, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                <InputIcon size={10} color="rgba(255,255,255,.4)" />
                {isEmail ? t('forgotPasswordScreen.emailAddress') : t('forgotPasswordScreen.mobileNumber')}
              </label>
              <input
                id="fp-identifier"
                className="fp-inp"
                type="text"
                value={identifier}
                onChange={e => { setId(e.target.value); setError(''); }}
                placeholder={t('forgotPasswordScreen.identifierPlaceholder')}
                autoComplete="username"
                style={{
                  width: '100%', padding: '11px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 4,
                }}
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>
                {t('forgotPasswordScreen.identifierHint')}
              </p>

              {error && <ErrorBox msg={error} />}

              <button className="fp-btn" type="submit" disabled={!canSubmitStep1} style={{
                width: '100%', padding: '12px', marginTop: 4,
                background: canSubmitStep1 ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
                borderRadius: 11, color: canSubmitStep1 ? '#fff' : 'rgba(255,255,255,.32)', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: canSubmitStep1 ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                boxShadow: canSubmitStep1 ? '0 4px 18px rgba(25, 135, 84,.35)' : 'none',
                cursor: canSubmitStep1 ? 'pointer' : 'not-allowed',
              }}>
                {loading ? <><Spin /> {t('forgotPasswordScreen.sendingOtp')}</> : <>{t('forgotPasswordScreen.sendOtp')} &nbsp;→</>}
              </button>
            </form>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <button type="button" onClick={() => { setStep(1); setError(''); setOtp(''); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                  <ArrowLeft size={12} /> {t('forgotPasswordScreen.back')}
                </button>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>{t('forgotPasswordScreen.enterOtpTitle')}</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
                {channel === 'email' ? t('forgotPasswordScreen.otpSentToEmail') : t('forgotPasswordScreen.otpSentToMobile')}
              </p>

              {/* OTP */}
              <label htmlFor="fp-otp" style={labelStyle}>{t('forgotPasswordScreen.otpLabel')}</label>
              <input
                id="fp-otp"
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
              <label htmlFor="fp-newpass" style={labelStyle}>{t('forgotPasswordScreen.newPasswordLabel')}</label>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                <input
                  id="fp-newpass"
                  className="fp-inp"
                  type={showPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setError(''); }}
                  placeholder={t('forgotPasswordScreen.newPasswordPlaceholder')}
                  autoComplete="new-password"
                  style={{
                    width: '100%', padding: '11px 38px 11px 13px',
                    background: 'rgba(255,255,255,.10)',
                    border: '1px solid rgba(255,255,255,.18)',
                    borderRadius: 11, fontSize: 13.5, color: '#fff',
                  }}
                />
                <div role="button" tabIndex={0} onClick={() => setShowPass(s => !s)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPass(s => !s); } }}
                  aria-label={showPass ? t('hidePassword') : t('showPassword')}
                  style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex' }}>
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
              <label htmlFor="fp-confirm" style={labelStyle}>{t('forgotPasswordScreen.confirmPasswordLabel')}</label>
              <input
                id="fp-confirm"
                className="fp-inp"
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                placeholder={t('forgotPasswordScreen.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                style={{
                  width: '100%', padding: '11px 13px',
                  background: 'rgba(255,255,255,.10)',
                  border: '1px solid rgba(255,255,255,.18)',
                  borderRadius: 11, fontSize: 13.5, color: '#fff', marginBottom: 16,
                }}
              />

              <Captcha ref={captchaRef} onStatusChange={setCaptchaStatus} style={{ marginBottom: 16 }} />

              {error    && <ErrorBox msg={error} />}
              {resendMsg && <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 10 }}>{resendMsg}</div>}

              <button className="fp-btn" type="submit" disabled={!canSubmitStep2} style={{
                width: '100%', padding: '12px',
                background: canSubmitStep2 ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
                borderRadius: 11, color: canSubmitStep2 ? '#fff' : 'rgba(255,255,255,.32)', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: canSubmitStep2 ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
                boxShadow: canSubmitStep2 ? '0 4px 18px rgba(25, 135, 84,.35)' : 'none',
                cursor: canSubmitStep2 ? 'pointer' : 'not-allowed',
                marginBottom: 12,
              }}>
                {loading ? <><Spin /> {t('forgotPasswordScreen.resetting')}</> : canSubmitStep2 ? <><ShieldCheck size={14} /> {t('forgotPasswordScreen.resetPassword')}</> : <><Lock size={13} /> {t('forgotPasswordScreen.resetPassword')}</>}
              </button>

              <button type="button" onClick={handleResend} disabled={loading}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', margin: '0 auto' }}>
                <RotateCcw size={11} /> {t('forgotPasswordScreen.resendOtp')}
              </button>
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
