import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export default function LanguageToggle({ variant = 'light', style, iconOnly = false, buttonStyle }) {
  const { t, i18n } = useTranslation('common');
  const [hover, setHover] = useState(false);
  const isHindi = i18n.language === 'hi';
  const dark = variant === 'dark';

  const toggle = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');
  const label = t('languageToggle.switchLabel');

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={label}
        title={label}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)',
          color: 'rgba(255,255,255,.85)', cursor: 'pointer', transition: 'background .15s',
          ...buttonStyle,
          ...(hover && { background: 'rgba(120,128,140,.3)' }),
        }}
      >
        <Languages size={15} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 8,
        border: dark ? '1px solid rgba(255,255,255,.18)' : '1px solid var(--surface-border)',
        background: dark ? 'rgba(255,255,255,.08)' : 'var(--surface-card)',
        color: dark ? 'rgba(255,255,255,.75)' : 'var(--text-color)',
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        ...style,
      }}
    >
      <span style={{ opacity: isHindi ? .45 : 1 }}>{t('languageToggle.english')}</span>
      <span style={{ opacity: .3 }}>|</span>
      <span style={{ opacity: isHindi ? 1 : .45 }}>{t('languageToggle.hindi')}</span>
    </button>
  );
}
