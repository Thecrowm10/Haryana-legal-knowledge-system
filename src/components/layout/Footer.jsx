import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FooterInfoModal from './FooterInfoModal';
import ScreenReaderAccessModal from './ScreenReaderAccessModal';
import ashokEmblem from '../../assets/ashok-emblem.svg';
import digitalIndiaLogo from '../../assets/digital-india-logo.svg';

// Each role's manual is a separate PDF (no combined/admin manual exists yet) —
// link only shows for roles that actually have one in public/docs/manuals.
const ROLE_MANUAL_FILE = {
  uploader:      'Uploader-User-Manual.pdf',
  approver:      'Approver-User-Manual.pdf',
  nodal_officer: 'Nodal-Officer-User-Manual.pdf',
};

function footerLinks(t, role) {
  const helpLinks = [
    { label: t('footer.links.faqs'),               pageKey: 'faqs'            },
    { label: t('footer.links.screenReaderAccess'), pageKey: 'screen-reader'   },
    { label: t('footer.links.rti'),                pageKey: 'rti'             },
    { label: t('footer.links.feedback'),           pageKey: 'feedback'        },
    { label: t('footer.links.contactUs'),          pageKey: 'contact-us'      },
  ];
  const manualFile = ROLE_MANUAL_FILE[role];
  if (manualFile) {
    helpLinks.push({ label: t('footer.links.userManual'), href: `/docs/manuals/${manualFile}` });
  }

  return [
    {
      heading: t('footer.sections.websitePolicies'),
      links: [
        { label: t('footer.links.privacyPolicy'),   pageKey: 'privacy-policy'   },
        { label: t('footer.links.termsOfUse'),      pageKey: 'terms-of-use'     },
        { label: t('footer.links.hyperlinkPolicy'), pageKey: 'hyperlink-policy' },
        { label: t('footer.links.copyrightPolicy'), pageKey: 'copyright-policy' },
      ],
    },
    {
      heading: t('footer.sections.helpSupport'),
      links: helpLinks,
    },
    {
      heading: t('footer.sections.navigation'),
      links: [
        { label: t('footer.links.sitemap'),       pageKey: 'sitemap'        },
        { label: t('footer.links.relatedLinks'),  pageKey: 'related-links'  },
        { label: t('footer.links.accessibility'), pageKey: 'accessibility'  },
        { label: t('footer.links.disclaimer'),    pageKey: 'disclaimer'     },
      ],
    },
  ];
}

// __BUILD_DATE__ is injected by vite.config.js at build time (no CMS backs
// this portal) — so this always reflects the actual last deploy with no
// manual editing required.
const LAST_UPDATED = new Date(__BUILD_DATE__).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
});

export default function Footer({ role }) {
  const { t } = useTranslation('common');
  const FOOTER_LINKS = footerLinks(t, role);
  const [openPage, setOpenPage] = useState(null); // pageKey | null
  const [showScreenReader, setShowScreenReader] = useState(false);

  function openLink(pageKey) {
    if (pageKey === 'screen-reader') setShowScreenReader(true);
    else setOpenPage(pageKey);
  }

  return (
    <footer
      role="contentinfo"
      aria-label={t('footer.siteFooterLabel')}
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
            <img src={ashokEmblem} alt={t('footer.emblemAlt')} loading="lazy" style={{ height: 34, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
            <div>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                {t('footer.orgName')}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                {t('footer.orgTagline')}
              </div>
            </div>
          </div>
          <p className="ft-brand-desc" style={{ fontSize: 'var(--font-size-small)', lineHeight: 1.45, color: 'rgba(255,255,255,0.6)', maxWidth: 280, margin: 0 }}>
            {t('footer.brandDesc')}
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
              {section.links.map(link => {
                const linkStyle = {
                  fontSize: 11.5, color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none', transition: 'color .15s',
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.35,
                };
                const hoverHandlers = {
                  onMouseEnter: e => e.currentTarget.style.color = '#fff',
                  onMouseLeave: e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)',
                  onFocus: e => e.currentTarget.style.color = '#fff',
                  onBlur: e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)',
                };
                return (
                  <li key={link.label}>
                    {link.href ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer"
                        style={{ ...linkStyle, display: 'inline-block' }} {...hoverHandlers}>
                        {link.label}
                      </a>
                    ) : (
                      <button type="button" onClick={() => openLink(link.pageKey)} style={linkStyle} {...hoverHandlers}>
                        {link.label}
                      </button>
                    )}
                  </li>
                );
              })}
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
          <img src={digitalIndiaLogo} alt={t('footer.digitalIndiaAlt')} loading="lazy" style={{ height: 28, width: 'auto' }} />
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
          {t('footer.maintainedBy')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>
            {t('footer.lastUpdated')} <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{LAST_UPDATED}</strong>
          </span>
          {/* Not a compliance certification — points to the actual statement, which is
              honest about what's done vs. still in progress, instead of asserting it outright. */}
          <button type="button" onClick={() => setOpenPage('accessibility')}
            style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            {t('footer.accessibilityStatement')}
          </button>
        </div>
      </div>

      {openPage && <FooterInfoModal pageKey={openPage} onClose={() => setOpenPage(null)} />}
      {showScreenReader && <ScreenReaderAccessModal onClose={() => setShowScreenReader(false)} />}
    </footer>
  );
}
