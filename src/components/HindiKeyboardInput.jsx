import { useEffect, useRef, useState } from 'react';
import { Clipboard } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

const VOWELS = ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः'];
const CONSONANTS = [
  'क', 'ख', 'ग', 'घ', 'ङ',
  'च', 'छ', 'ज', 'झ', 'ञ',
  'ट', 'ठ', 'ड', 'ढ', 'ण',
  'त', 'थ', 'द', 'ध', 'न',
  'प', 'फ', 'ब', 'भ', 'म',
  'य', 'र', 'ल', 'व',
  'श', 'ष', 'स', 'ह',
  'ळ', 'क्ष', 'त्र', 'ज्ञ',
];
const MATRAS = ['ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', '्'];
const DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

const KEY_BTN = {
  minWidth: 30, height: 30, padding: '0 6px', borderRadius: 6,
  border: '1px solid var(--surface-border)', background: 'var(--surface-ground)',
  color: 'var(--text-color)', fontFamily: 'var(--font)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// On-screen Devanagari keyboard for fields that need a regional-language
// title but the user's physical keyboard has no Hindi layout installed.
// `label` drives the live-preview strip shown above the keys on mobile —
// the bottom sheet covers the real input, so without it there's no way to
// see what's been typed while the sheet is open.
export default function HindiKeyboardInput({ value, onChange, placeholder, style, id, label }) {
  const [open, setOpen] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Keep the tail of the typed text (where the cursor is) in view, since the
  // preview strip is a fixed-width single line.
  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollLeft = previewRef.current.scrollWidth;
  }, [value, open]);

  function setCursor(pos) {
    const el = inputRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function insert(ch) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange({ target: { value: value.slice(0, start) + ch + value.slice(end) } });
    setCursor(start + ch.length);
  }

  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      insert(text);
    } catch {
      setPasteError(true);
      setTimeout(() => setPasteError(false), 2200);
    }
  }

  function backspace() {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start !== end) {
      onChange({ target: { value: value.slice(0, start) + value.slice(end) } });
      setCursor(start);
    } else if (start > 0) {
      onChange({ target: { value: value.slice(0, start - 1) + value.slice(start) } });
      setCursor(start - 1);
    }
  }

  const keyStyle = isMobile
    ? { ...KEY_BTN, minWidth: 30, height: 32, fontSize: 14, borderRadius: 6 }
    : { ...KEY_BTN, fontSize: 14 };

  function Key({ ch }) {
    return (
      <button type="button" style={keyStyle}
        onMouseDown={e => e.preventDefault()}
        onClick={() => insert(ch)}>
        {ch}
      </button>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <style>{`@keyframes hkCaretBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={onChange}
        // inputMode="none" tells mobile/tablet browsers not to pop the native
        // on-screen keyboard for this field; readOnly (touch devices only)
        // backs that up so no OS keyboard can appear at all. Neither affects
        // a physical/Bluetooth keyboard, so desktop typing still works.
        inputMode="none"
        readOnly={isMobile}
        onFocus={e => {
          setOpen(true);
          e.target.style.borderColor = 'var(--primary)';
          e.target.style.boxShadow = '0 0 0 3px rgba(33, 74, 171,.1)';
        }}
        onBlur={e => {
          if (!isMobile) setOpen(false);
          e.target.style.borderColor = 'var(--surface-border)';
          e.target.style.boxShadow = 'none';
        }}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 34 }}
      />
      <button type="button" aria-label="Toggle Hindi keyboard" title="हिंदी में टाइप करें"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          width: 22, height: 22, borderRadius: 5, border: '1px solid var(--surface-border)',
          background: open ? 'var(--primary-light)' : 'var(--surface-card)',
          color: open ? 'var(--primary)' : 'var(--text-color-secondary)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        अ
      </button>

      {open && isMobile && (
        <div onMouseDown={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 3999,
        }} />
      )}

      {open && (
        <div style={isMobile ? {
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 4000,
          background: 'var(--surface-card)', borderRadius: '14px 14px 0 0',
          boxShadow: '0 -12px 32px rgba(0,0,0,.22)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
          maxHeight: '46vh', overflowY: 'auto',
        } : {
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40,
          background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
          borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.18)', padding: 8,
          width: 360, maxWidth: '90vw',
        }}>
          {isMobile ? (
            /* Sticky live-preview strip — the sheet below covers the real
               input, this is the only place the typed text stays visible. */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '6px 8px', borderRadius: 8,
              background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
            }}>
              {label && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-color-secondary)',
                  textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0,
                }}>
                  {label}
                </span>
              )}
              <span ref={previewRef} style={{
                flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-color)',
                whiteSpace: 'nowrap', overflow: 'auto', scrollbarWidth: 'none',
              }}>
                {value || <span style={{ fontWeight: 400, opacity: .45 }}>{placeholder}</span>}
                <span style={{ display: 'inline-block', width: 1.5, marginLeft: 1, color: 'var(--primary)', animation: 'hkCaretBlink 1s step-end infinite' }}>|</span>
              </span>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(false)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-color-secondary)', cursor: 'pointer', fontSize: 12, flexShrink: 0, padding: 2 }}>
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                हिंदी कीबोर्ड
              </span>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(false)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-color-secondary)', cursor: 'pointer', fontSize: 12 }}>
                ✕
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
            {VOWELS.map(ch => <Key key={ch} ch={ch} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
            {CONSONANTS.map(ch => <Key key={ch} ch={ch} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
            {MATRAS.map(ch => <Key key={ch} ch={ch} />)}
            {DIGITS.map(ch => <Key key={ch} ch={ch} />)}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <button type="button" title="Paste from clipboard" onMouseDown={e => e.preventDefault()} onClick={pasteClipboard}
              style={{ ...keyStyle, minWidth: 44, gap: 4 }}>
              <Clipboard size={13} /> Paste
            </button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => insert(' ')}
              style={{ ...keyStyle, flex: 1 }}>space</button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={backspace}
              style={{ ...keyStyle, minWidth: 54 }}>⌫</button>
          </div>
          {pasteError && (
            <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--red, #dc3545)', textAlign: 'center' }}>
              Clipboard access denied — copy the text again, then tap Paste.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
