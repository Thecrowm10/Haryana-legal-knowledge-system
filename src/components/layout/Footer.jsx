import { useState } from 'react';
import FooterInfoModal from './FooterInfoModal';
import ScreenReaderAccessModal from './ScreenReaderAccessModal';
import ashokEmblem from '../../assets/ashok-emblem.svg';
import digitalIndiaLogo from '../../assets/digital-india-logo.svg';

const FOOTER_LINKS = [
  {
    heading: 'Website Policies',
    links: [
      { label: 'Privacy Policy',   pageKey: 'privacy-policy'   },
      { label: 'Terms of Use',     pageKey: 'terms-of-use'     },
      { label: 'Hyperlink Policy', pageKey: 'hyperlink-policy' },
      { label: 'Copyright Policy', pageKey: 'copyright-policy' },
    ],
  },
  {
    heading: 'Help & Support',
    links: [
      { label: 'FAQs',                  pageKey: 'faqs'            },
      { label: 'Screen Reader Access',  pageKey: 'screen-reader'   },
      { label: 'Right to Information',  pageKey: 'rti'             },
      { label: 'Feedback',              pageKey: 'feedback'        },
      { label: 'Contact Us',            pageKey: 'contact-us'      },
    ],
  },
  {
    heading: 'Navigation',
    links: [
      { label: 'Sitemap',        pageKey: 'sitemap'        },
      { label: 'Related Links',  pageKey: 'related-links'  },
      { label: 'Accessibility',  pageKey: 'accessibility'  },
      { label: 'Disclaimer',     pageKey: 'disclaimer'     },
    ],
  },
];

// Bumped whenever footer/policy content actually changes — this is a manually
// maintained marker (no CMS backs this portal), not a live "today" timestamp.
const LAST_UPDATED = '27 July 2026';

export default function Footer() {
  const [openPage, setOpenPage] = useState(null); // pageKey | null
  const [showScreenReader, setShowScreenReader] = useState(false);

  function openLink(pageKey) {
    if (pageKey === 'screen-reader') setShowScreenReader(true);
    else setOpenPage(pageKey);
  }

  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      style={{
        // Hardcoded to the DBIM Blue group's key/darkest shade (#162F6A) per DBIM 5.6 —
        // deliberately not `var(--primary-dark)`, which is repointed to green by the
        // high-contrast accessibility mode; a footer band should stay a stable colour
        // under both the default theme and high-contrast mode.
        background: '#162F6A',
        color: 'rgba(255,255,255,0.85)',
        marginTop: 'auto',
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .ft-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .ft-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .ft-brand-desc { display: none !important; }
          .ft-bottom { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>
      {/* ── Main footer body ─────────────────────────────── */}
      <div className="ft-grid" style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '14px 24px 8px',
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        gap: 16,
      }}>
        {/* Brand column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {/* State Emblem on a dark background must render white per DBIM 5.3 —
                the source SVG is solid black, so it's flipped via filter rather
                than maintaining a second white-fill copy of the asset. */}
            <img src={ashokEmblem} alt="Emblem of India" style={{ height: 34, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
            <div>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                Government of Haryana
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                Haryana Digital Repository
              </div>
            </div>
          </div>
          <p className="ft-brand-desc" style={{ fontSize: 'var(--font-size-small)', lineHeight: 1.45, color: 'rgba(255,255,255,0.6)', maxWidth: 280, margin: 0 }}>
            Centralized repository of Acts, Rules, Notifications and Circulars issued by the Government of Haryana.
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map(section => (
          <div key={section.heading}>
            <h3 style={{
              fontSize: 'var(--font-size-small)', fontWeight: 700, color: '#fff',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: 5, paddingBottom: 4,
              borderBottom: '1px solid rgba(255,255,255,0.15)',
            }}>
              {section.heading}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {section.links.map(link => (
                <li key={link.label}>
                  <button
                    type="button"
                    onClick={() => openLink(link.pageKey)}
                    style={{
                      fontSize: 11.5, color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none', transition: 'color .15s',
                      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.35,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                    onFocus={e => e.currentTarget.style.color = '#fff'}
                    onBlur={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Co-branding (DBIM 5.4 — flagship program logos, max 2) ── */}
      <div style={{
        padding: '8px 24px',
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <a
          href="https://www.digitalindia.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.9, transition: 'opacity .15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.9}
        >
          <img src={digitalIndiaLogo} alt="Digital India" style={{ height: 28, width: 'auto' }} />
        </a>
      </div>

      {/* ── Bottom bar ───────────────────────────────────── */}
      <div className="ft-bottom" style={{
        borderTop: '1px solid rgba(255,255,255,0.12)',
        padding: '7px 24px',
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 6,
      }}>
        <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          This website belongs to Government of Haryana. Designed, Developed and Maintained by HARTRON.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>
            Last Updated: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{LAST_UPDATED}</strong>
          </span>
          {/* Not a compliance certification — points to the actual statement, which is
              honest about what's done vs. still in progress, instead of asserting it outright. */}
          <button type="button" onClick={() => setOpenPage('accessibility')}
            style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Accessibility Statement
          </button>
        </div>
      </div>

      {openPage && <FooterInfoModal pageKey={openPage} onClose={() => setOpenPage(null)} />}
      {showScreenReader && <ScreenReaderAccessModal onClose={() => setShowScreenReader(false)} />}
    </footer>
  );
}
