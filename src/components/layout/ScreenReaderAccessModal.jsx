import { useState } from 'react';
import { X, Headphones, FileCheck, MessageSquareText, ExternalLink, AlertTriangle } from 'lucide-react';

const SCREEN_READERS = [
  { name: 'Screen Access For All (SAFA)', platform: 'Windows', tier: 'Free', note: 'Open-source project on SourceForge', linkLabel: 'Visit', url: 'https://sourceforge.net/projects/safa/' },
  { name: 'Non Visual Desktop Access (NVDA)', platform: 'Windows', tier: 'Free', note: 'Free & open-source', linkLabel: 'Download', url: 'https://www.nvaccess.org/download/' },
  { name: 'System Access To Go', platform: 'Windows', tier: 'Free', note: 'Browser-based, no install needed', linkLabel: 'Visit', url: 'https://www.satogo.com/en/' },
  { name: 'Thunder', platform: 'Windows', tier: 'Free', note: 'Includes the WebbIE browser', linkLabel: 'Download', url: 'https://www.webbie.org.uk/thunder/' },
  { name: 'WebAnywhere', platform: 'Any (browser-based)', tier: 'Free', note: 'Runs entirely in the browser', linkLabel: 'Visit', url: 'https://webinsight.cs.washington.edu/wa/' },
  { name: 'Hal (Dolphin ScreenReader)', platform: 'Windows', tier: 'Commercial', note: 'Renamed to Dolphin ScreenReader', linkLabel: 'Visit', url: 'https://yourdolphin.com/ScreenReader' },
  { name: 'JAWS', platform: 'Windows', tier: 'Commercial', note: 'Widely used in govt offices', linkLabel: 'Download', url: 'https://support.freedomscientific.com/Downloads/JAWS' },
  { name: 'Supernova', platform: 'Windows', tier: 'Commercial', note: 'Screen reader + magnifier', linkLabel: 'Visit', url: 'https://yourdolphin.com/SuperNova' },
];

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};
const TH = { ...LABEL, padding: '9px 12px', textAlign: 'left' };
const TD = { padding: '10px 12px', fontSize: 12.5, color: 'var(--text-color)', verticalAlign: 'middle' };

export default function ScreenReaderAccessModal({ onClose }) {
  const [pendingUrl, setPendingUrl] = useState(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-access-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-card)', borderRadius: 14, width: 760, maxWidth: '100%',
          maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
          animation: 'fadeSlideIn .15s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Headphones size={20} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="sr-access-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>
              Screen Reader Access
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>Assistive technology compatibility</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        {/* Compliance statement */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <FileCheck size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-color)', margin: 0 }}>
            This website is designed to conform to <strong>WCAG 2.1 Level AA</strong> and{' '}
            <strong>GIGW 3.0</strong> (Guidelines for Indian Government Websites and Apps). It is built to
            be readable and operable with the assistive technologies listed below — no special plugin or
            browser extension is required.
          </p>
        </div>

        {/* Compatible screen readers */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ ...LABEL, marginBottom: 10 }}>Compatible Screen Readers</div>
          <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th scope="col" style={TH}>Screen Reader</th>
                  <th scope="col" style={TH}>Platform</th>
                  <th scope="col" style={TH}>Free / Commercial</th>
                  <th scope="col" style={TH}>Access</th>
                </tr>
              </thead>
              <tbody>
                {SCREEN_READERS.map((sr, i) => (
                  <tr key={sr.name} style={{ borderBottom: i < SCREEN_READERS.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{sr.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{sr.note}</div>
                    </td>
                    <td style={TD}>{sr.platform}</td>
                    <td style={TD}>{sr.tier}</td>
                    <td style={TD}>
                      <button
                        type="button"
                        onClick={() => setPendingUrl(sr.url)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                          fontSize: 11.5, fontWeight: 600, color: 'var(--primary)',
                          padding: '5px 10px', borderRadius: 7, border: '1px solid var(--primary-border)',
                          background: 'var(--primary-light)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {sr.linkLabel} <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--surface-border)' }} />

        {/* Built-in tools pointer */}
        <div style={{ padding: '18px 24px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <MessageSquareText size={16} color="var(--text-color-secondary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-color-secondary)', margin: 0 }}>
            In addition to screen readers, this site provides its own on-page <strong>Text Size</strong> and{' '}
            <strong>High Contrast</strong> controls — open them any time from the accessibility icon in the
            corner of the screen.
          </p>
        </div>
      </div>

      {pendingUrl && (
        <ExternalLinkWarning
          url={pendingUrl}
          onCancel={() => setPendingUrl(null)}
          onConfirm={() => { window.open(pendingUrl, '_blank', 'noopener,noreferrer'); setPendingUrl(null); }}
        />
      )}
    </div>
  );
}

function ExternalLinkWarning({ url, onCancel, onConfirm }) {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* fall back to raw url */ }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ext-link-title"
      style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{
        background: 'var(--surface-card)', borderRadius: 14, width: 420, maxWidth: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,.35)', padding: 22, animation: 'fadeSlideIn .15s ease',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
          <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div id="ext-link-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>
            Leaving this site
          </div>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-color-secondary)', margin: '0 0 18px' }}>
          You are being redirected to <strong style={{ color: 'var(--text-color)' }}>{host}</strong>, an
          external website. This portal is not responsible for the content or privacy practices of
          external sites.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Okay, continue
          </button>
        </div>
      </div>
    </div>
  );
}
