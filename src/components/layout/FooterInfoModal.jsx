import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ShieldCheck, FileText, Link2, Copyright, HelpCircle, MessageSquare,
  Phone, Map, Globe2, Accessibility, AlertTriangle, Landmark, Send, CheckCircle2, PlayCircle,
} from 'lucide-react';

// Every footer link (except Screen Reader Access, which reuses the existing
// ScreenReaderAccessModal) renders through this one modal, keyed by pageKey.
// `type` picks the body renderer: 'text' (heading+paragraphs sections, the
// default), 'faq', 'list' (name+desc rows), 'sitemap' (grouped rows) or 'feedback' (a form).
const FOOTER_PAGES = {
  'privacy-policy': {
    icon: ShieldCheck, title: 'Privacy Policy', subtitle: 'How this portal handles your data',
    sections: [
      { heading: 'What we collect', body: [
        'Public visitors: only the search terms you type and the filters you apply, used to return results — nothing is tied to a name or account, since public search requires no login.',
        'Departmental users (uploaders, approvers, CS Office, admin, auditors): your username, department and every action you take (upload, approve, reject, edit) is logged with a timestamp, as required for audit purposes under this portal’s Terms of Reference.',
      ]},
      { heading: 'Local storage on your device', body: [
        'Bookmarked searches are saved in your browser’s local storage so they persist between visits — this data never leaves your device and is not visible to us.',
      ]},
      { heading: 'How data is used', body: [
        'Query and action logs are used solely for audit, security and compliance reporting. They are not sold, shared with advertisers, or used to build user profiles.',
      ]},
      { heading: 'Your rights', body: [
        'Under the Digital Personal Data Protection (DPDP) Act, 2023, departmental users may request a copy of, or correction to, the personal data held about their account by contacting their department’s administrator.',
      ]},
    ],
  },
  'terms-of-use': {
    icon: FileText, title: 'Terms of Use', subtitle: 'Conditions for using this portal',
    sections: [
      { heading: 'Permitted use', body: [
        'This portal may be used to search, view and download public legal instruments — Acts, Rules, Notifications and Circulars — issued by the Government of Haryana, for personal, informational, research or professional reference.',
      ]},
      { heading: 'Prohibited use', body: [
        'You may not use automated tools to bulk-scrape the portal, attempt to bypass access controls on department workflows, misrepresent a document’s content, or use the portal in any way that disrupts its availability to other users.',
      ]},
      { heading: 'Accuracy & authoritative version', body: [
        'While every effort is made to keep documents current, the officially notified Gazette publication remains the authoritative legal text. In case of any conflict, the Gazette version prevails.',
      ]},
      { heading: 'Changes to these terms', body: [
        'These terms may be revised from time to time to reflect changes in law or portal functionality; the “Last Updated” date in the footer reflects the most recent revision.',
      ]},
    ],
  },
  'hyperlink-policy': {
    icon: Link2, title: 'Hyperlink Policy', subtitle: 'Linking to and from this portal',
    sections: [
      { heading: 'Linking to this site', body: [
        'Other websites are welcome to link to any public page of this portal without prior permission, provided the link does not imply endorsement by the Government of Haryana and the page is not framed within another site in a way that misrepresents its source.',
      ]},
      { heading: 'Links to external sites', body: [
        'Where this portal links to an external website, that link is provided for reference only. The Government of Haryana does not control and is not responsible for the content, accuracy or privacy practices of external sites, and inclusion of a link is not an endorsement.',
      ]},
    ],
  },
  'copyright-policy': {
    icon: Copyright, title: 'Copyright Policy', subtitle: 'Ownership and reuse of portal content',
    sections: [
      { heading: 'Ownership', body: [
        'Legal instruments published on this portal remain the property of the Government of Haryana and the respective issuing department. The portal’s own design, interface and software are the property of the Government of Haryana.',
      ]},
      { heading: 'Permitted reuse', body: [
        'Text of Acts, Rules, Notifications and Circulars may be reproduced for non-commercial, informational or research purposes provided the source is acknowledged as “Government of Haryana, via the Haryana Digital Repository.”',
      ]},
      { heading: 'Reporting a concern', body: [
        'If you believe content on this portal infringes a copyright you hold, contact the portal administrator via the Contact Us page with details of the material and your claim.',
      ]},
    ],
  },
  accessibility: {
    icon: Accessibility, title: 'Accessibility Statement', subtitle: 'Our commitment to an accessible portal',
    sections: [
      { heading: 'Conformance target', body: [
        'This portal is designed to conform to WCAG 2.1 Level AA and the Guidelines for Indian Government Websites and Apps (GIGW) 3.0.',
      ]},
      { heading: 'Built-in accessibility tools', body: [
        'A Skip to Main Content link, a text-size adjuster (A+ / A-), a high-contrast mode, and keyboard-navigable menus are available site-wide from the accessibility icon in the header.',
      ]},
      { heading: 'Known limitations', body: [
        'We are continuously improving accessibility. If any page, control or document is not accessible to you, please tell us using the Contact Us page so we can address it.',
      ]},
    ],
  },
  disclaimer: {
    icon: AlertTriangle, title: 'Disclaimer', subtitle: 'Please read before relying on this portal',
    sections: [
      { heading: 'Authoritative text', body: [
        'This portal is a digital repository provided for convenience. The officially notified Gazette publication of an Act, Rule, Notification or Circular is the sole authoritative legal text; this portal’s copy is provided “as is” without warranty of completeness or currency.',
      ]},
      { heading: 'Translations', body: [
        'Where a Hindi version of a document or of this interface is provided, the English version prevails in case of any discrepancy.',
      ]},
      { heading: 'External links & availability', body: [
        'The Government of Haryana is not responsible for content on external sites linked from this portal, and does not guarantee uninterrupted or error-free availability of the portal itself.',
      ]},
    ],
  },
  rti: {
    icon: Landmark, title: 'Right to Information (RTI)', subtitle: 'Requesting information under the RTI Act, 2005',
    sections: [
      { heading: 'About the Act', body: [
        'The Right to Information Act, 2005 gives every citizen the right to request information held by a public authority, subject to the exemptions specified in the Act.',
      ]},
      { heading: 'How to file a request', body: [
        'RTI requests concerning a specific document or process on this portal should be addressed to the Public Information Officer (PIO) of the department that issued the document, along with the prescribed fee. If you are unsure which department to approach, use the Contact Us page and we will direct your request.',
      ]},
      { heading: 'First appeal', body: [
        'If you do not receive a response within the statutory period, or are dissatisfied with the response, you may file a first appeal with the department’s designated First Appellate Authority (FAA).',
      ]},
    ],
  },
  faqs: {
    icon: HelpCircle, title: 'Frequently Asked Questions', subtitle: 'Common questions about this portal', type: 'faq',
    items: [
      { q: 'Is this an official source of law?', a: 'This portal is an official digital repository of the Government of Haryana. For any conflict between this portal and the official Gazette notification, the Gazette version prevails.' },
      { q: 'Do I need to log in to search documents?', a: 'No. Public search is open to everyone without any login. A login is only required for departmental staff who upload, review or manage documents.' },
      { q: 'Why don’t search results show an AI-generated summary?', a: 'By design, this portal never generates or paraphrases legal text. Every result points you to the exact page, section and paragraph of the original document so you always read the verbatim source.' },
      { q: 'How do I know if an Act is still in force?', a: 'Each document carries a legal-status badge (Active / Repealed / Amended) that is set by the issuing department and confirmed during the approval workflow.' },
      { q: 'Who reviews a document before it appears on the public portal?', a: 'A department uploader submits the document with metadata; a departmental approver reviews and approves it before it becomes visible to the public.' },
      { q: 'Can I download documents for offline use?', a: 'Yes — every document view includes a download option for the original PDF.' },
    ],
  },
  sitemap: {
    icon: Map, title: 'Sitemap', subtitle: 'How this portal is organised', type: 'sitemap',
    groups: [
      { heading: 'Public Access (no login)', items: ['Search Acts, Rules, Notifications & Circulars', 'Filter by department, year, type and legal status', 'Bookmark searches for later', 'View document pointer (exact page / section / paragraph) and download PDF'] },
      { heading: 'Departmental Portal (login required)', items: ['Uploader — upload documents and tag metadata & relationships', 'Approver — review and approve or reject uploaded documents', 'Admin — user management, taxonomy and system monitoring', 'Nodal Officer — user management, upload oversight and act parts review'] },
    ],
  },
  'related-links': {
    icon: Globe2, title: 'Related Links', subtitle: 'Other government resources', type: 'list',
    note: 'These are independent government portals — visit them directly through your browser; this page intentionally does not embed external links.',
    items: [
      { name: 'Government of Haryana', desc: 'Official state government portal.' },
      { name: 'India Code', desc: 'Central repository of Indian legislation, maintained by the Ministry of Law and Justice.' },
      { name: 'Digital India', desc: 'Government of India’s digital governance and services initiative.' },
      { name: 'National Portal of India', desc: 'Single-window access to information from Indian government entities.' },
    ],
  },
  'contact-us': {
    icon: Phone, title: 'Contact Us', subtitle: 'Reach the portal team', type: 'text',
    sections: [
      { heading: 'How to reach us', body: ['Use the Feedback form on this portal for search issues, document errors or general queries — pick the closest category so it reaches the right team.'] },
      { heading: 'Department-specific queries', body: ['For a question about a specific Act, Rule, Notification or Circular, mention the document and issuing department in your Feedback message so it can be routed correctly.'] },
      { heading: 'If your query goes unresolved', body: ['Note this in a follow-up Feedback message and ask for it to be escalated — it will be passed to the Grievance Redressal process.'] },
    ],
  },
  feedback: {
    icon: MessageSquare, title: 'Feedback', subtitle: 'Tell us what’s working and what isn’t', type: 'feedback',
  },
  'user-manual': {
    icon: FileText, title: 'User Manual', subtitle: 'Choose a format to open', type: 'manual-choice',
  },
};

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

export default function FooterInfoModal({ pageKey, onClose, pdfUrl, videoUrl }) {
  const page = FOOTER_PAGES[pageKey];
  if (!page) return null;
  const Icon = page.icon;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="footer-modal-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface-card)', borderRadius: 14, width: 720, maxWidth: '100%',
        maxHeight: '88vh', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        display: 'flex', flexDirection: 'column', animation: 'fadeSlideIn .15s ease',
      }}>
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="footer-modal-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{page.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{page.subtitle}</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body-pad" style={{ overflowY: 'auto', padding: '20px 24px' }}>
          {page.type === 'faq' && <FaqBody items={page.items} />}
          {page.type === 'sitemap' && <SitemapBody groups={page.groups} />}
          {page.type === 'list' && <ListBody note={page.note} items={page.items} />}
          {page.type === 'feedback' && <FeedbackBody />}
          {page.type === 'manual-choice' && <ManualChoiceBody pdfUrl={pdfUrl} videoUrl={videoUrl} onClose={onClose} />}
          {(!page.type || page.type === 'text') && <TextBody sections={page.sections} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

function TextBody({ sections }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sections.map(s => (
        <div key={s.heading}>
          <div style={{ ...LABEL, marginBottom: 8 }}>{s.heading}</div>
          {s.body.map((p, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-color)', margin: i > 0 ? '8px 0 0' : 0 }}>{p}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function FaqBody({ items }) {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={item.q} style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpenIdx(open ? -1 : i)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--surface-ground)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font)' }}>
              {item.q}
            </button>
            {open && (
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-color-secondary)', margin: 0, padding: '0 14px 14px' }}>{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SitemapBody({ groups }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map(g => (
        <div key={g.heading}>
          <div style={{ ...LABEL, marginBottom: 8 }}>{g.heading}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.55, color: 'var(--text-color)' }}>
                <CheckCircle2 size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ListBody({ note, items }) {
  return (
    <div>
      {note && <p style={{ fontSize: 12, color: 'var(--text-color-secondary)', lineHeight: 1.6, margin: '0 0 14px' }}>{note}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div key={item.name} style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{item.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginTop: 2 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FIELD = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' };

function FeedbackBody() {
  const [form, setForm] = useState({ name: '', email: '', category: 'General', message: '' });
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '20px 0' }}>
        <CheckCircle2 size={32} color="#16a34a" />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Thank you for your feedback</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', maxWidth: 380 }}>
          Your message has been recorded. If you asked a question that needs a direct reply, our team will reach out at the email you provided.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); setSent(true); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label htmlFor="fb-name" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Name</label>
        <input id="fb-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={FIELD} />
      </div>
      <div>
        <label htmlFor="fb-email" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Email</label>
        <input id="fb-email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={FIELD} />
      </div>
      <div>
        <label htmlFor="fb-category" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Category</label>
        <select id="fb-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...FIELD, cursor: 'pointer' }}>
          {['General', 'Search issue', 'Document error', 'Accessibility', 'Technical problem'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="fb-message" style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Message</label>
        <textarea id="fb-message" required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ ...FIELD, resize: 'vertical', minHeight: 90 }} />
      </div>
      <button type="submit" style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <Send size={13} /> Submit
      </button>
    </form>
  );
}

function ManualChoiceBody({ pdfUrl, videoUrl, onClose }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <button type="button"
        disabled={!pdfUrl}
        onClick={() => { window.open(pdfUrl, '_blank', 'noopener,noreferrer'); onClose(); }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: pdfUrl ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', opacity: pdfUrl ? 1 : 0.5 }}>
        <FileText size={22} color="var(--primary)" />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)' }}>PDF Manual</span>
      </button>
      <button type="button"
        onClick={() => { window.open(videoUrl, '_blank', 'noopener,noreferrer'); onClose(); }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <PlayCircle size={22} color="var(--primary)" />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)' }}>Video Manual</span>
      </button>
    </div>
  );
}
