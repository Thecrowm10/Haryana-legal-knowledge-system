import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, Moon, Sun, Minus, Plus, RotateCcw, ImageOff, MousePointer2, Headphones, X } from 'lucide-react';
import { useA11yPrefs, FONT_SCALE_STEPS, DEFAULT_PREFS } from '../hooks/useA11yPrefs';
import ScreenReaderAccessModal from './layout/ScreenReaderAccessModal';

/**
 * India.gov.in-style accessibility icon + panel, shared by the citizen top
 * bar and the staff Topbar, per GIGW 3.0 / WCAG 2.1 AA. State is shared via
 * useA11yPrefs so toggling in one shell is reflected everywhere.
 *
 * panelAnchor: 'fixed' (default) keeps the citizen page's fixed top:68/right:32
 * placement; 'dropdown' anchors under the icon via position:absolute, for
 * callers that wrap this in their own position:relative container (e.g. Topbar).
 */
export default function AccessibilityMenu({ iconButtonStyle, panelAnchor = 'fixed', idPrefix = 'citizen' }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [srModalOpen, setSrModalOpen] = useState(false);
  const [prefs, setPrefs] = useA11yPrefs();

  const changeFontSize = (dir) => {
    setPrefs(p => {
      const idx = FONT_SCALE_STEPS.indexOf(p.fontScale);
      const next = FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, idx + dir))];
      return { ...p, fontScale: next };
    });
  };

  const toggleHideImages = () => setPrefs(p => ({ ...p, hideImages: !p.hideImages }));
  const toggleBigCursor  = () => setPrefs(p => ({ ...p, bigCursor: !p.bigCursor }));
  const setContrast = (highContrast) => setPrefs(p => ({ ...p, highContrast }));

  const reset = () => setPrefs(DEFAULT_PREFS);

  const panelId = `${idPrefix}-a11y-panel`;
  const panelStyle = panelAnchor === 'dropdown'
    ? { position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60, width: 320 }
    : { position: 'fixed', top: 68, right: 32, zIndex: 60, width: 320 };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={open ? t('a11y.closeLabel') : t('a11y.openLabel')}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('a11y.toolsPanelTitle')}
        style={{ transition: 'background .15s', ...iconButtonStyle, ...(hover && { background: 'rgba(120,128,140,.3)' }) }}
      >
        <Accessibility size={16} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div
            id={panelId}
            role="region"
            aria-label={t('a11y.toolsPanelTitle')}
            style={{
              ...panelStyle,
              background: 'var(--surface-card)', color: 'var(--text-color)',
              border: '1px solid var(--surface-border)', borderRadius: 14,
              boxShadow: '0 16px 40px rgba(0,0,0,.3)', padding: 18,
              animation: 'fadeSlideIn .15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-heading)' }}>{t('a11y.toolsPanelTitle')}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('a11y.closeLabel')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 2 }}>
                <X size={17} />
              </button>
            </div>

            <SectionLabel>{t('a11y.contrastAdjustment')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              <GridCard icon={Moon} label={t('a11y.highContrast')} active={prefs.highContrast} onClick={() => setContrast(true)} />
              <GridCard icon={Sun} label={t('a11y.normal')} active={!prefs.highContrast} onClick={() => setContrast(false)} />
            </div>

            <SectionLabel>{t('a11y.textSizeSection')} · {prefs.fontScale}%</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              <GridCard icon={Plus} label={t('a11y.increaseText')} onClick={() => changeFontSize(1)} disabled={prefs.fontScale === FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1]} />
              <GridCard icon={Minus} label={t('a11y.decreaseText')} onClick={() => changeFontSize(-1)} disabled={prefs.fontScale === FONT_SCALE_STEPS[0]} />
              <GridCard icon={RotateCcw} label={t('a11y.resetText')} onClick={() => setPrefs(p => ({ ...p, fontScale: 100 }))} />
            </div>

            <SectionLabel>{t('a11y.others')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <GridCard icon={ImageOff} label={t('a11y.hideImages')} active={prefs.hideImages} onClick={toggleHideImages} />
              <GridCard icon={MousePointer2} label={t('a11y.bigCursor')} active={prefs.bigCursor} onClick={toggleBigCursor} />
            </div>

            <button type="button" onClick={reset}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, borderRadius: 9, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
              <RotateCcw size={12} /> {t('a11y.resetToDefault')}
            </button>

            <button type="button" onClick={() => { setOpen(false); setSrModalOpen(true); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, borderRadius: 9, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer' }}>
              <Headphones size={12} /> {t('a11y.screenReaderAccess')}
            </button>
          </div>
        </>
      )}

      {srModalOpen && <ScreenReaderAccessModal onClose={() => setSrModalOpen(false)} />}
    </>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function GridCard({ icon: Icon, label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 6px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${active ? 'var(--primary-border)' : 'var(--surface-border)'}`,
        background: active ? 'var(--primary-light)' : 'transparent',
        color: disabled ? 'var(--surface-border)' : active ? 'var(--primary)' : 'var(--text-color)',
        opacity: disabled ? .5 : 1,
        fontSize: 10.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
        fontFamily: 'var(--font)', transition: 'background .12s, border-color .12s',
      }}
    >
      <Icon size={17} strokeWidth={1.8} />
      {label}
    </button>
  );
}
