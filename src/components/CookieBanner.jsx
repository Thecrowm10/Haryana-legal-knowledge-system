import { useState, useEffect } from 'react';
import { Cookie, X, ChevronDown, ChevronUp } from 'lucide-react';

const STORAGE_KEY = 'hlks-cookie-consent';

export default function CookieBanner() {
  const [visible, setVisible]     = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const [prefs, setPrefs]         = useState({ essential: true, analytics: false, functional: false });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function save(choice) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, prefs, timestamp: Date.now() }));
    setVisible(false);
  }

  function acceptAll() {
    setPrefs({ essential: true, analytics: true, functional: true });
    save('accepted-all');
  }

  function rejectAll() {
    setPrefs({ essential: true, analytics: false, functional: false });
    save('rejected-non-essential');
  }

  function savePrefs() {
    save('customised');
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#1a1a2e', color: '#f0f0f0',
        boxShadow: '0 -4px 24px rgba(0,0,0,.35)',
        fontFamily: 'var(--font)',
        animation: 'fadeSlideInUp .3s ease',
      }}
    >
      {/* ── Main bar ────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '16px 24px',
        display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
      }}>
        <Cookie size={20} color="#4ade80" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />

        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            This website uses cookies to enhance your experience and comply with the{' '}
            <strong style={{ color: '#fff' }}>Digital Personal Data Protection (DPDP) Act, 2023</strong>.
            {' '}Essential cookies are always active. You may accept, reject, or customise other categories.
          </p>

          {/* ── Expandable preferences ─────────────────── */}
          {expanded && (
            <div style={{
              marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10,
              borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14,
            }}>
              {[
                {
                  key: 'essential',
                  label: 'Essential Cookies',
                  desc: 'Required for the website to function. Cannot be disabled.',
                  locked: true,
                },
                {
                  key: 'analytics',
                  label: 'Analytics Cookies',
                  desc: 'Help us understand how visitors use the website (anonymised data).',
                  locked: false,
                },
                {
                  key: 'functional',
                  label: 'Functional Cookies',
                  desc: 'Remember your preferences such as language and accessibility settings.',
                  locked: false,
                },
              ].map(({ key, label, desc, locked }) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, cursor: locked ? 'default' : 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    disabled={locked}
                    onChange={e => !locked && setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                    style={{ marginTop: 3, accentColor: '#4ade80', width: 15, height: 15 }}
                    aria-label={label}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
                      {label}
                      {locked && (
                        <span style={{
                          fontSize: 10, background: 'rgba(74,222,128,0.2)', color: '#4ade80',
                          borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                        }}>Always Active</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4ade80', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              marginTop: 8, padding: 0,
            }}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide preferences' : 'Manage cookie preferences'}
          </button>
        </div>

        {/* ── Action buttons ──────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button onClick={rejectAll} style={{
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            background: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)',
            transition: 'border-color .15s, color .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          >
            Reject All
          </button>
          {expanded && (
            <button onClick={savePrefs} style={{
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              background: 'rgba(74,222,128,0.15)', border: '1.5px solid #4ade80', color: '#4ade80',
              transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.15)'}
            >
              Save Preferences
            </button>
          )}
          <button onClick={acceptAll} style={{
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            background: '#4ade80', border: '1.5px solid #4ade80', color: '#14532d',
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#198754'}
            onMouseLeave={e => e.currentTarget.style.background = '#4ade80'}
          >
            Accept All
          </button>
        </div>

        <button
          onClick={rejectAll}
          aria-label="Close cookie banner"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
