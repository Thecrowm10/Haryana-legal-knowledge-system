import { useState, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Eye, EyeOff, ShieldCheck, Lock, ArrowLeft } from 'lucide-react';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import Captcha from '../components/Captcha';
import LanguageToggle from '../components/LanguageToggle';
import AccessibilityMenu from '../components/AccessibilityMenu';

const cpIconStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.85)',
  cursor: 'pointer',
};

export default function ChangePasswordScreen({ user, onPasswordChanged, onLogout, reason = 'first_login' }) {
  const { t, i18n } = useTranslation('login');
  const orgNameHi = i18n.getFixedT('hi', 'login')('orgNamePortal');
  const orgNameEn = i18n.getFixedT('en', 'login')('orgNamePortal');
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState({ touched: false, valid: false });
  const captchaRef            = useRef(null);
  const canSubmit             = !loading && captchaStatus.valid
    && form.current !== '' && form.next.length >= 8 && form.next === form.confirm && form.next !== form.current;

  function toggle(field) { setShow(s => ({ ...s, [field]: !s[field] })); }
  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.current) { setError(t('changePasswordScreen.errorCurrentRequired')); return; }
    if (form.next.length < 8) { setError(t('changePasswordScreen.errorNewMin8')); return; }
    if (form.next !== form.confirm) { setError(t('changePasswordScreen.errorPasswordsNoMatch')); return; }
    if (form.next === form.current) { setError(t('changePasswordScreen.errorSameAsCurrent')); return; }
    if (!captchaStatus.touched)          { setError(t('errorFillCaptcha')); return; }
    if (!captchaRef.current?.validate()) { setError(t('errorCorrectCaptcha')); return; }

    setLoading(true);
    setError('');
    try {
      await onPasswordChanged(form.current, form.next);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('changePasswordScreen.errorChangeFailed'));
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
    if (score <= 1) return { label: t('forgotPasswordScreen.strengthWeak'),   color: '#dc3545', w: '25%' };
    if (score <= 2) return { label: t('forgotPasswordScreen.strengthFair'),   color: '#b45309', w: '50%' };
    if (score <= 3) return { label: t('forgotPasswordScreen.strengthGood'),   color: '#0d6efd', w: '75%' };
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
          <LanguageToggle variant="dark" iconOnly buttonStyle={cpIconStyle} />
          <AccessibilityMenu iconButtonStyle={cpIconStyle} />
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
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <button type="button" onClick={onLogout}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit', letterSpacing: '.04em' }}>
                <ArrowLeft size={12} /> {t('changePasswordScreen.signOut')}
              </button>
            </div>

            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
              {reason === 'expired' ? t('changePasswordScreen.titleExpired') : t('changePasswordScreen.titleRequired')}
            </h2>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.42)', marginBottom: 20 }}>
              {reason === 'expired'
                ? <Trans t={t} i18nKey="changePasswordScreen.welcomeExpired" values={{ name: user?.name || user?.username }} components={[<strong key="n" />]} />
                : <Trans t={t} i18nKey="changePasswordScreen.welcomeRequired" values={{ name: user?.name || user?.username }} components={[<strong key="n" />]} />
              }
            </p>

            {/* Current password */}
            <label htmlFor="cps-current" style={labelStyle}>{t('changePasswordScreen.currentPasswordLabel')}</label>
            <PwField id="cps-current" value={form.current} show={show.current} onToggle={() => toggle('current')} onChange={v => set('current', v)} showLabel={show.current ? t('hidePassword') : t('showPassword')} style={{ marginBottom: 16 }} />

            {/* New password */}
            <label htmlFor="cps-next" style={labelStyle}>{t('changePasswordScreen.newPasswordLabel')}</label>
            <PwField id="cps-next" value={form.next} show={show.next} onToggle={() => toggle('next')} onChange={v => set('next', v)} showLabel={show.next ? t('hidePassword') : t('showPassword')} style={{ marginBottom: strength ? 4 : 16 }} />

            {strength && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: strength.w, background: strength.color, transition: 'width .3s, background .3s' }} />
                </div>
                <span style={{ fontSize: 10, color: strength.color, fontWeight: 700 }}>{strength.label}</span>
              </div>
            )}

            {/* Confirm password */}
            <label htmlFor="cps-confirm" style={labelStyle}>{t('changePasswordScreen.confirmPasswordLabel')}</label>
            <PwField id="cps-confirm" value={form.confirm} show={show.confirm} onToggle={() => toggle('confirm')} onChange={v => set('confirm', v)} showLabel={show.confirm ? t('hidePassword') : t('showPassword')} style={{ marginBottom: 16 }} />

            <Captcha ref={captchaRef} onStatusChange={setCaptchaStatus} style={{ marginBottom: 16 }} />

            {error && <ErrorBox msg={error} />}

            <button className="fp-btn" type="submit" disabled={!canSubmit} style={{
              width: '100%', padding: '12px',
              background: canSubmit ? 'linear-gradient(135deg,#198754,#16a34a)' : 'rgba(255,255,255,.04)',
              borderRadius: 11, color: canSubmit ? '#fff' : 'rgba(255,255,255,.32)', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: canSubmit ? 'none' : '1.5px dashed rgba(255,255,255,.2)',
              boxShadow: canSubmit ? '0 4px 18px rgba(25, 135, 84,.35)' : 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}>
              {loading ? <><Spin /> {t('changePasswordScreen.changingPassword')}</> : canSubmit ? <><ShieldCheck size={14} /> {t('changePasswordScreen.setNewPassword')}</> : <><Lock size={13} /> {t('changePasswordScreen.setNewPassword')}</>}
            </button>
          </form>
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

function PwField({ id, value, show, onToggle, onChange, showLabel, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        id={id}
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
      <div role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-label={showLabel}
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex' }}>
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
