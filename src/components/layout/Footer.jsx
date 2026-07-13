const FOOTER_LINKS = [
  {
    heading: 'Website Policies',
    links: [
      { label: 'Privacy Policy',   href: '#privacy-policy'   },
      { label: 'Terms of Use',     href: '#terms-of-use'     },
      { label: 'Hyperlink Policy', href: '#hyperlink-policy' },
      { label: 'Copyright Policy', href: '#copyright-policy' },
    ],
  },
  {
    heading: 'Help & Support',
    links: [
      { label: 'FAQs',                  href: '#faqs'                  },
      { label: 'Screen Reader Access',  href: '#screen-reader'         },
      { label: 'Feedback',              href: '#feedback'              },
      { label: 'Contact Us',            href: '#contact'               },
    ],
  },
  {
    heading: 'Navigation',
    links: [
      { label: 'Sitemap',        href: '#sitemap'        },
      { label: 'Related Links',  href: '#related-links'  },
      { label: 'Accessibility',  href: '#accessibility'  },
      { label: 'Disclaimer',     href: '#disclaimer'     },
    ],
  },
];

const LAST_UPDATED = '24 June 2026';

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      style={{
        background: 'var(--primary-dark)',
        color: 'rgba(255,255,255,0.85)',
        marginTop: 'auto',
      }}
    >
      {/* ── Main footer body ─────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '32px 28px 24px',
        display: 'grid',
        gridTemplateColumns: '1.8fr 1fr 1fr 1fr',
        gap: 32,
      }}>
        {/* Brand column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {/* Ashoka chakra placeholder */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }} aria-hidden="true">⚖️</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                Haryana Legal Repository
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Government of Haryana
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', maxWidth: 280 }}>
            Centralized repository of legal instruments — Acts, Rules, Notifications and Circulars —
            issued by the Government of Haryana.
          </p>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>
            Developed &amp; maintained by{' '}
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>HARTRON</span>
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map(section => (
          <div key={section.heading}>
            <h3 style={{
              fontSize: 12, fontWeight: 700, color: '#fff',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '1px solid rgba(255,255,255,0.15)',
            }}>
              {section.heading}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {section.links.map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    style={{
                      fontSize: 12.5, color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none', transition: 'color .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                    onFocus={e => e.currentTarget.style.color = '#fff'}
                    onBlur={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ───────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.12)',
        padding: '14px 28px',
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          This website belongs to the{' '}
          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Government of Haryana</strong>.
          {' '}TOR: HARTRON/PM(ICT)/ToR-CSO/2026-27/03
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
            Last Updated:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{LAST_UPDATED}</strong>
          </span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
            WCAG 2.1 AA Compliant
          </span>
        </div>
      </div>
    </footer>
  );
}
