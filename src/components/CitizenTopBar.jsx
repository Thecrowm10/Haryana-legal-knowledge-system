import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import AccessibilityMenu from './AccessibilityMenu';
import haryanaLogo from '../assets/haryana-logo.png';

const iconButtonStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
  transition: 'background .15s, border-color .15s, color .15s',
  background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', color: 'var(--text-color)',
};

// The same Haryana branding / language / accessibility / login-as-officer
// bar CitizenDashboard shows once its hero has scrolled past it — reused
// here "always solid" (no transparent-over-a-hero state to blend into) for
// every other citizen-facing page, so branding and those controls stay
// available no matter where in the citizen flow someone is.
export default function CitizenTopBar({ onLoginAsOfficer }) {
  const { t } = useTranslation('citizen');
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);

  return (
    <div className="ctb-bar" style={{
      flexShrink: 0, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '0 24px', background: 'var(--surface-card)',
      borderBottom: '1px solid var(--surface-border)', boxShadow: 'var(--card-shadow)',
    }}>
      <style>{`
        /* Keeps "Government of Haryana" on one line instead of wrapping once the
           icon buttons on the right leave it too little room on a narrow screen. */
        @media (max-width: 480px) {
          .ctb-bar { padding: 0 14px !important; gap: 8px !important; }
          .ctb-brand { gap: 6px !important; }
          .ctb-brand-subtitle { font-size: 11px !important; }
          .ctb-brand-title { display: none !important; }
          .ctb-actions { gap: 6px !important; }
        }
      `}</style>
      <div className="ctb-brand" style={{ flexShrink: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={haryanaLogo} alt="Haryana Government" loading="lazy" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div className="ctb-brand-subtitle" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('brandSubtitle')}</div>
          <div className="ctb-brand-title" style={{ fontSize: 10, color: 'var(--text-color-secondary)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('brandTitle')}</div>
        </div>
      </div>

      <div className="ctb-actions" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <LanguageToggle iconOnly buttonStyle={iconButtonStyle} />
        <AccessibilityMenu iconButtonStyle={iconButtonStyle} />

        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setLoginMenuOpen(o => !o)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-border)'}
            onMouseLeave={e => e.currentTarget.style.background = iconButtonStyle.background}
            aria-label={t('profileLogin')} aria-expanded={loginMenuOpen} title={t('profileLogin')}
            style={iconButtonStyle}>
            <User size={16} />
          </button>

          {loginMenuOpen && (
            <>
              <div onClick={() => setLoginMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60, width: 200,
                background: 'var(--surface-card)', color: 'var(--text-color)',
                border: '1px solid var(--surface-border)', borderRadius: 12,
                boxShadow: '0 16px 40px rgba(0,0,0,.3)', overflow: 'hidden',
                animation: 'fadeSlideIn .15s ease',
              }}>
                <button type="button" onClick={() => { setLoginMenuOpen(false); onLoginAsOfficer?.(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, color: 'var(--text-color)', fontFamily: 'var(--font)', transition: 'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <User size={14} color="var(--primary)" /> {t('loginAsOfficer')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
