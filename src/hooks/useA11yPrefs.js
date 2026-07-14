import { useEffect, useState } from 'react';

export const FONT_SCALE_STEPS = [90, 100, 125, 150, 175, 200];
const STORAGE_KEY = 'hlks-a11y-prefs';
export const DEFAULT_PREFS = { fontScale: 100, highContrast: false, hideImages: false, bigCursor: false };

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

  if (prefs.hideImages) root.setAttribute('data-a11y-hide-images', 'true');
  else root.removeAttribute('data-a11y-hide-images');

  if (prefs.bigCursor) root.setAttribute('data-a11y-big-cursor', 'true');
  else root.removeAttribute('data-a11y-big-cursor');
}

/**
 * Shared accessibility-preferences store (GIGW 3.0 / WCAG 2.1 AA). Backs both
 * the floating widget (authenticated app shell) and the citizen top-bar menu
 * so text scale, contrast, hide-images and big-cursor stay in sync and persist
 * via localStorage regardless of which UI toggled them.
 */
export function useA11yPrefs() {
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    applyPrefs(prefs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);

  return [prefs, setPrefs];
}
