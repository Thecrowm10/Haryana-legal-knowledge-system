import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, Contrast, Type, Minus, Plus, RotateCcw, X, ImageOff, MousePointer2, Headphones } from 'lucide-react';
import { useA11yPrefs, FONT_SCALE_STEPS, DEFAULT_PREFS } from '../../hooks/useA11yPrefs';
import ScreenReaderAccessModal from './ScreenReaderAccessModal';

/**
 * Floating GIGW 3.0 / WCAG 2.1 AA accessibility widget for the authenticated
 * app shell (Layout.jsx). Provides on-page text-resize (WCAG 1.4.4 / GIGW
 * 5.2.15), a high-contrast presentation switch (WCAG 1.4.3, 1.4.11 / GIGW
 * 5.2.14, 5.2.18), hide-images, big-cursor, and a pointer to compatible
 * screen readers. Preferences persist across sessions via localStorage.
 */
export default function AccessibilityToolbar() {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [srModalOpen, setSrModalOpen] = useState(false);
  const [prefs, setPrefs] = useA11yPrefs();

  const changeFontSize = (dir) => {
    setPrefs(p => {
      const idx = FONT_SCALE_STEPS.indexOf(p.fontScale);
      const next = FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, idx + dir))];
      return { ...p, fontScale: next };
    });
  };

  const toggleContrast   = () => setPrefs(p => ({ ...p, highContrast: !p.highContrast }));
  const toggleHideImages = () => setPrefs(p => ({ ...p, hideImages: !p.hideImages }));
  const toggleBigCursor  = () => setPrefs(p => ({ ...p, bigCursor: !p.bigCursor }));
  const reset = () => setPrefs(DEFAULT_PREFS);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? t('a11y.closeLabel') : t('a11y.openLabel')}
        aria-expanded={open}
        aria-controls="a11y-panel"
        title={t('a11y.panelTitle')}
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,.28)', cursor: 'pointer',
        }}
      >
        <Accessibility size={22} />
      </button>

      {open && (
        <div
          id="a11y-panel"
          role="region"
          aria-label={t('a11y.panelTitle')}
          style={{
            position: 'fixed', right: 20, bottom: 78, zIndex: 1000,
            width: 264, background: 'var(--surface-card)', color: 'var(--text-color)',
            border: '1px solid var(--surface-border)', borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: 16,
            animation: 'fadeSlideIn .15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{t('a11y.panelTitle')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('a11y.closeLabel')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 2 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Text size */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Type size={13} /> {t('a11y.textSize')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                disabled={prefs.fontScale === FONT_SCALE_STEPS[0]}
                aria-label={t('a11y.decreaseTextSize')}
                style={iconBtnStyle(prefs.fontScale === FONT_SCALE_STEPS[0])}
              >
                <Minus size={14} />
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 12.5, color: 'var(--text-color)' }} aria-live="polite">
                {prefs.fontScale}%
              </span>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                disabled={prefs.fontScale === FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1]}
                aria-label={t('a11y.increaseTextSize')}
                style={iconBtnStyle(prefs.fontScale === FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1])}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* High contrast */}
          <ToggleRow icon={Contrast} label={t('a11y.highContrast')} active={prefs.highContrast} onClick={toggleContrast} />
          {/* Hide images */}
          <ToggleRow icon={ImageOff} label={t('a11y.hideImages')} active={prefs.hideImages} onClick={toggleHideImages} />
          {/* Big cursor */}
          <ToggleRow icon={MousePointer2} label={t('a11y.bigCursor')} active={prefs.bigCursor} onClick={toggleBigCursor} />

          <button
            type="button"
            onClick={reset}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: 8, borderRadius: 9, border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            <RotateCcw size={12} /> {t('a11y.resetToDefault')}
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); setSrModalOpen(true); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: 8, borderRadius: 9, border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            <Headphones size={12} /> {t('a11y.screenReaderAccess')}
          </button>
        </div>
      )}

      {srModalOpen && <ScreenReaderAccessModal onClose={() => setSrModalOpen(false)} />}
    </>
  );
}

function ToggleRow({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 10,
        border: '1px solid var(--surface-border)',
        background: active ? 'var(--primary-light)' : 'transparent',
        color: 'var(--text-color)', fontSize: 12.5,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} /> {label}
      </span>
      <span aria-hidden="true" style={{
        width: 34, height: 18, borderRadius: 99, position: 'relative', flexShrink: 0,
        background: active ? 'var(--primary)' : 'var(--surface-border)',
        transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: active ? 18 : 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left .15s',
        }} />
      </span>
    </button>
  );
}

function iconBtnStyle(disabled) {
  return {
    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--surface-border)',
    background: 'transparent', color: disabled ? 'var(--surface-border)' : 'var(--text-color)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
