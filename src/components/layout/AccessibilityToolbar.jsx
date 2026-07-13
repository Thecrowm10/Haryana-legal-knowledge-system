import { useEffect, useState } from 'react';
import { Accessibility, Contrast, Type, Minus, Plus, RotateCcw, X } from 'lucide-react';

const FONT_SCALE_STEPS = [90, 100, 125, 150, 175, 200];
const STORAGE_KEY = 'hlks-a11y-prefs';
const DEFAULT_PREFS = { fontScale: 100, highContrast: false };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // Corrupt/blocked storage — fall back to defaults.
  }
  return DEFAULT_PREFS;
}

function applyPrefs(prefs) {
  const root = document.documentElement;
  if (prefs.fontScale === 100) root.style.removeProperty('--a11y-zoom');
  else root.style.setProperty('--a11y-zoom', prefs.fontScale / 100);

  // Shrinking below 100% needs the zoomed shell to be pre-inflated (via CSS)
  // so its visual footprint still fills the fixed-height app shell instead of
  // leaving a gap. Enlarging is left alone — it should overflow into scroll.
  if (prefs.fontScale < 100) root.setAttribute('data-a11y-shrink', 'true');
  else root.removeAttribute('data-a11y-shrink');

  if (prefs.highContrast) root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');
}

/**
 * Floating GIGW 3.0 / WCAG 2.1 AA accessibility widget for the authenticated
 * app shell (Layout.jsx). Provides on-page text-resize (WCAG 1.4.4 / GIGW
 * 5.2.15) and a high-contrast presentation switch (WCAG 1.4.3, 1.4.11 /
 * GIGW 5.2.14, 5.2.18). Preferences persist across sessions via localStorage.
 */
export default function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    applyPrefs(prefs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);

  const changeFontSize = (dir) => {
    setPrefs(p => {
      const idx = FONT_SCALE_STEPS.indexOf(p.fontScale);
      const next = FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, idx + dir))];
      return { ...p, fontScale: next };
    });
  };

  const toggleContrast = () => setPrefs(p => ({ ...p, highContrast: !p.highContrast }));
  const reset = () => setPrefs(DEFAULT_PREFS);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close accessibility options' : 'Open accessibility options'}
        aria-expanded={open}
        aria-controls="a11y-panel"
        title="Accessibility options"
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
          aria-label="Accessibility options"
          style={{
            position: 'fixed', right: 20, bottom: 78, zIndex: 1000,
            width: 264, background: 'var(--surface-card)', color: 'var(--text-color)',
            border: '1px solid var(--surface-border)', borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: 16,
            animation: 'fadeSlideIn .15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Accessibility</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close accessibility options"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 2 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Text size */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Type size={13} /> Text Size
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                disabled={prefs.fontScale === FONT_SCALE_STEPS[0]}
                aria-label="Decrease text size"
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
                aria-label="Increase text size"
                style={iconBtnStyle(prefs.fontScale === FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1])}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* High contrast */}
          <button
            type="button"
            onClick={toggleContrast}
            aria-pressed={prefs.highContrast}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 14,
              border: '1px solid var(--surface-border)',
              background: prefs.highContrast ? 'var(--primary-light)' : 'transparent',
              color: 'var(--text-color)', fontSize: 12.5,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Contrast size={14} /> High Contrast
            </span>
            <span aria-hidden="true" style={{
              width: 34, height: 18, borderRadius: 99, position: 'relative', flexShrink: 0,
              background: prefs.highContrast ? 'var(--primary)' : 'var(--surface-border)',
              transition: 'background .15s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: prefs.highContrast ? 18 : 2,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left .15s',
              }} />
            </span>
          </button>

          <button
            type="button"
            onClick={reset}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: 8, borderRadius: 9, border: '1px solid var(--surface-border)',
              background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} /> Reset to Default
          </button>
        </div>
      )}
    </>
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
