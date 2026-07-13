import { useTranslation } from 'react-i18next';

export default function LanguageToggle({ variant = 'light', style }) {
  const { t, i18n } = useTranslation('common');
  const isHindi = i18n.language === 'hi';
  const dark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(isHindi ? 'en' : 'hi')}
      aria-label={t('languageToggle.switchLabel')}
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
