import { useState, useEffect } from 'react';
import { Cookie, X, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'hlks-cookie-consent';

const CATEGORIES = [
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
];

// Toggle-switch pill — same shape/size as the Account Status toggle used in the
// Admin/Nodal edit-user modals, so this feels native to the app rather than a
// bolted-on widget.
function ToggleSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 38, height: 21, borderRadius: 12, border: 'none', flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? '#4ade80' : 'rgba(255,255,255,.22)',
        opacity: disabled ? 0.6 : 1,
        position: 'relative', transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 15, height: 15, borderRadius: '50%',
        background: '#fff', transition: 'left .2s', left: checked ? 20 : 3,
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}

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
        // Glassmorphism, matching the auth-screen glass cards (Login/AdminOtpLogin/
        // ChangePasswordScreen) elsewhere in the app: a translucent tint over blur
        // rather than a flat fill. Tint is the DBIM Blue group's primary shade
        // (#214AAB — the app's actual --primary token, same blue used for every
        // button/heading accent) rather than Footer's darkest shade, so it reads
        // lighter/friendlier while staying on-palette. Hardcoded (not var(--primary))
        // so it doesn't get repointed to green by the high-contrast accessibility mode.
        background: 'rgba(33,74,171,.90)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderTop: '1px solid rgba(255,255,255,.22)',
        boxShadow: '0 -12px 32px rgba(0,0,0,.28)',
        fontFamily: 'var(--font)',
        animation: 'fadeSlideInUp .35s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .cb-body { flex-direction: column !important; }
          .cb-actions { width: 100% !important; }
          .cb-actions > button { flex: 1 1 auto !important; }
        }
      `}</style>

      {/* ── Main bar — compact single row by default; only the expandable
           preferences panel below adds height, on demand ── */}
      <div className="cb-body" style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '11px 22px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.24)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Cookie size={15} color="#fff" strokeWidth={1.8} aria-hidden="true" />
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,.82)', margin: 0 }}>
            <strong style={{ color: '#fff', fontWeight: 700 }}>We value your privacy.</strong>
            {' '}Cookies help us comply with the{' '}
            <strong style={{ color: '#D2DFFF', fontWeight: 700 }}>DPDP Act, 2023</strong>.
            {' '}Essential cookies stay on; you choose the rest.{' '}
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#D2DFFF', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline',
                padding: 0, fontFamily: 'inherit',
              }}
              aria-expanded={expanded}
            >
              {expanded ? 'Hide options' : 'Manage preferences'}
            </button>
          </p>

          {/* ── Expandable preferences panel ─────────────── */}
          {expanded && (
            <div style={{
              marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4,
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10, padding: '4px 14px',
            }}>
              {CATEGORIES.map(({ key, label, desc, locked }, i) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {label}
                      {locked && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em',
                          background: 'rgba(74,222,128,.16)', color: '#4ade80',
                          borderRadius: 20, padding: '2px 8px',
                        }}>ALWAYS ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.68)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                  <ToggleSwitch
                    checked={prefs[key]}
                    disabled={locked}
                    onChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                    label={label}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action buttons ──────────────────────────── */}
        <div className="cb-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button onClick={rejectAll} style={{
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            background: 'transparent', border: '1.5px solid rgba(255,255,255,.28)', color: 'rgba(255,255,255,.85)',
            fontFamily: 'var(--font)', transition: 'border-color .15s, color .15s', whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.28)'; e.currentTarget.style.color = 'rgba(255,255,255,.85)'; }}
          >
            Reject All
          </button>
          {expanded && (
            <button onClick={savePrefs} style={{
              padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              background: 'rgba(163,187,243,.12)', border: '1.5px solid #A3BBF3', color: '#D2DFFF',
              fontFamily: 'var(--font)', transition: 'background .15s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(163,187,243,.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(163,187,243,.12)'}
            >
              Save Preferences
            </button>
          )}
          <button onClick={acceptAll} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: '#fff', border: '1.5px solid #fff', color: '#214AAB',
            fontFamily: 'var(--font)', transition: 'background .15s', whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#D2DFFF'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <ShieldCheck size={13} /> Accept All
          </button>
        </div>

        <button
          onClick={rejectAll}
          aria-label="Close cookie banner"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,.45)', flexShrink: 0, display: 'flex', padding: 4,
            transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.85)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.45)'}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
