import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ChevronDown, ChevronRight, FileText, BookOpen, AlertCircle, RefreshCw, Eye, Sparkles, Building2,
  Search, CalendarDays, Paperclip, FileStack, ClipboardList, UnfoldVertical, FoldVertical, ArrowUp,
} from 'lucide-react';
import { PART_META } from '../constants/mockActOutline';
import { DOC_TYPE_META } from '../constants/docTypeMeta';
import { TYPE_SPECIFIC_FIELD_KEYS } from '../constants/docTypeFields';
import { getPdfFull } from '../services/pdf';
import { mapActPartsToOutline, mapRelationships, humanizeRelationType } from '../utils/actFull';
import { mapPublicDocForViewer, openPdfInNewTab, openActPartFileInNewTab } from '../utils/mapPublicDoc';
import DocViewModal from './DocViewModal';
import CitizenTopBar from './CitizenTopBar';
import Card from './ui/Card';

const EMPTY_OUTLINE = { sections: { chapters: [], isFlat: false }, schedules: [], annexures: [], appendix: [], forms: [] };

// camelCase typeFields key → Title Case label, e.g. 'noOfRules' → 'No Of Rules'
function fieldLabel(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// Icon per part tab — kept local to this file (rather than in the shared
// PART_META constant, which DocViewModal also reads) so that constant stays
// a plain data map with no lucide-react dependency.
const PART_ICONS = { sections: BookOpen, schedules: CalendarDays, annexures: Paperclip, appendix: FileStack, forms: ClipboardList };

// PART_META's own `.label` (Sections/Schedules/…) is plain English, shared as-is with
// DocViewModal — translating it there too is out of scope here, so this file translates
// its OWN display of each part's name via this key map instead of touching that constant.
const PART_LABEL_KEYS = { sections: 'partSections', schedules: 'partSchedules', annexures: 'partAnnexures', appendix: 'partAppendix', forms: 'partForms' };

// Legal body text reads better in a serif face — falls back to the OS's own
// Georgia/Times before generic serif, no extra font file to self-host.
const SERIF_STACK = "'Noto Serif', Georgia, 'Times New Roman', serif";

// Summaries come out of the backend as lightweight markdown — **bold**
// headings, numbered sub-items, "* label: value" bullets — but often as one
// long run without real line breaks. Rendering it as a plain string loses
// all of that structure (literal "**", everything mashed into one blob), so
// this splits it back into paragraphs/bullets and turns **bold** into real
// bold text, restoring roughly the shape it had when it was written.
function renderFormattedSummary(text) {
  if (!text) return null;
  const normalized = text
    .replace(/(\d+\.\s+\*\*)/g, '\n$1')            // "... 1. **Heading**" → its own line
    .replace(/\s+\*\s+(?=[A-Za-z][\w ]{0,40}:)/g, '\n* '); // "... * Field: value" → its own bullet line
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const bulletMatch = line.match(/^\*\s+(.*)/);
    const content = bulletMatch ? bulletMatch[1] : line;
    const parts = content.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((p, j) => (j % 2 === 1 ? <strong key={j}>{p}</strong> : p));
    return bulletMatch ? (
      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
        <span style={{ color: 'var(--text-color-secondary)', flexShrink: 0 }}>•</span>
        <span>{rendered}</span>
      </div>
    ) : (
      <p key={i} style={{ margin: '0 0 10px' }}>{rendered}</p>
    );
  });
}

const shimmer = {
  background: 'linear-gradient(90deg, var(--surface-hover) 25%, var(--surface-border) 37%, var(--surface-hover) 63%)',
  backgroundSize: '400% 100%',
  animation: 'acvShimmer 1.4s ease infinite',
  borderRadius: 6,
};

// Tab-aware empty state — points a citizen at whichever other tabs on this
// same Act do have content, instead of a dead end.
function EmptyPart({ activePart, counts, onJump }) {
  const { t } = useTranslation('actContents');
  const meta = PART_META[activePart];
  const Icon = PART_ICONS[activePart];
  const partLabel = t(PART_LABEL_KEYS[activePart]);
  const alternatives = Object.keys(PART_META).filter(k => k !== activePart && counts[k] > 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '72px 24px', textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={26} strokeWidth={1.5} color={meta.accent} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)' }}>{t('noPartAvailable', { part: partLabel.toLowerCase() })}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', maxWidth: 340, lineHeight: 1.6 }}>
        {t('noPartPublished', { part: partLabel.toLowerCase() })}
      </div>
      {alternatives.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 }}>
          {alternatives.map(k => (
            <button key={k} type="button" onClick={() => onJump(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 20, border: `1px solid ${PART_META[k].accent}33`, background: PART_META[k].bg, color: PART_META[k].accent, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {t(PART_LABEL_KEYS[k])} · {counts[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Skeleton placeholder — mimics the chapter-pill + heading + section-row
// shapes it's about to replace, so the layout doesn't jump once data lands.
function LoadingPart() {
  return (
    <div aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 110, height: 22, ...shimmer }} />
        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
      </div>
      <div style={{ width: '55%', height: 22, marginBottom: 22, ...shimmer }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', marginBottom: 8, border: '1px solid var(--surface-border)', borderRadius: 10 }}>
          <div style={{ width: 22, height: 22, flexShrink: 0, ...shimmer }} />
          <div style={{ height: 14, width: `${68 - i * 9}%`, ...shimmer }} />
        </div>
      ))}
    </div>
  );
}

function ErrorPart({ onRetry }) {
  const { t } = useTranslation('actContents');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '70px 0', color: 'var(--text-color-secondary)' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(220, 53, 69,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={24} strokeWidth={1.5} color="#dc3545" />
      </div>
      <span style={{ fontSize: 13.5 }}>{t('loadError')}</span>
      <button type="button" onClick={onRetry}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <RefreshCw size={13} /> {t('retry')}
      </button>
    </div>
  );
}

// Department + year, pulled out of the compact top bar into their own
// clearly-labelled fields (icon, label, value — each field legible on its
// own) instead of being crammed into one small grey line under the title.
// Each one is its own separate pill — no shared/continued background across
// them. Document type itself sits in the heading card above (parallel to
// the document's name) — not repeated here too. "View Document" sits in the
// opposite corner of this same row (parallel to department/year), so
// opening the file doesn't need its own separate button elsewhere. When
// there's a tabs/rail framework taking up the page (onOpenSummary passed),
// the summary itself becomes a pill right alongside the date instead of an
// always-visible band — that space is busier there, so it's opened on demand.
function DocMetaBox({ dept, year, docId, onOpenSummary }) {
  const { t } = useTranslation('actContents');
  if (!dept && !year && !docId) return null;
  const fields = [
    dept && { label: t('administeringDepartment'), value: dept, icon: Building2, color: 'var(--primary)', bg: 'var(--primary-light)' },
    year && { label: t('year'), value: year, icon: CalendarDays, color: '#64748b', bg: 'rgba(100,116,139,.1)' },
  ].filter(Boolean);
  // No background of its own — this sits directly on whatever page backdrop is
  // already behind it (so it doesn't create its own separate colour band
  // between the heading card above and the content below); each field is its
  // own white chip so it still stands out against that backdrop.
  return (
    <div style={{ padding: '14px 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', boxShadow: 'var(--card-shadow)', flexShrink: 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <f.icon size={12} color={f.color} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>{f.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{f.value}</span>
            </div>
          ))}
          {onOpenSummary && (
            <button type="button" onClick={onOpenSummary}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', boxShadow: 'var(--card-shadow)', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={12} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{t('summary')}</span>
            </button>
          )}
        </div>
        {docId != null && (
          <button type="button" onClick={() => openPdfInNewTab(docId)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 8px 20px rgba(33, 74, 171,.2)', flexShrink: 0, transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <Eye size={14} /> {t('viewDocument')}
          </button>
        )}
      </div>
    </div>
  );
}

// Fallback for a document with no chapters/schedules/etc. AND no related
// documents at all — a plain Notification/Circular with nothing structured
// under it. Two columns rather than the tabs/rail framework, which would
// have nothing to show: the plain-language summary reads as the main
// content on the left (title/filename already showed up in the header
// above, so this doesn't repeat them), while a compact sidebar on the
// right carries whatever metadata fields exist plus the one action that
// matters here — opening the actual PDF (view, download, print, whatever
// the citizen needs, all inside that viewer).
function SimpleDocLayout({ doc }) {
  const { t } = useTranslation('actContents');
  // Every field the uploader could have filled in for this document — the
  // common ones plus whichever extra fields belong to this specific document
  // type (Act Year, Sector, …) — blank ones are simply left out, never shown
  // empty. Deliberately excludes uploader identity/upload-date/internal
  // workflow fields, same as the rest of this citizen-facing view.
  const fields = [
    [t('referenceNo'),   doc.referenceNumber],
    [t('issueDate'),     doc.enactmentDate],
    [t('effectiveFrom'), doc.effectiveFrom],
    [t('gazetteRef'),    doc.gazette],
    [t('legalAuthority'), doc.authority],
    [t('shortTitle'),    doc.shortTitle],
    ...(TYPE_SPECIFIC_FIELD_KEYS[doc.type] || []).map(({ key }) => [fieldLabel(key), doc.typeFields?.[key]]),
  ].filter(([, v]) => v);
  return (
    <div className="acv-simple-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start', maxWidth: 1520, margin: '0 auto', padding: '36px 40px' }}>
      {/* Two equally-weighted cards, side by side — summary is its own panel,
          not just loose text next to the details card. Uses the shared Card
          component (same shadow/radius/border every other card in the app
          gets — Uploader's quick-action cards included) rather than a
          hand-rolled div, so this reads as the same kind of surface. */}
      <Card padding="24px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={15} color="var(--primary)" />
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>{t('summary')}</span>
        </div>
        {doc.desc ? (
          <div style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text-color)', fontFamily: SERIF_STACK }}>{renderFormattedSummary(doc.desc)}</div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('noSummaryAvailable')}</div>
        )}
      </Card>

      <Card className="acv-simple-sidebar" padding="24px" style={{ position: 'sticky', top: 20 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 14 }}>{t('documentDetails')}</div>
        {fields.length > 0 ? (
          <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden', marginBottom: 20 }}>
            {fields.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'stretch', borderBottom: i < fields.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                <div style={{ padding: '9px 10px', width: 100, boxSizing: 'border-box', flexShrink: 0, background: 'var(--surface-50)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>{k}</div>
                <div style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-heading)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{String(v)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>{t('noAdditionalDetails')}</div>
        )}
        {/* Opening the PDF now happens from "View Document" in the meta row above
            (parallel to department/year) — not repeated here too. */}
      </Card>
    </div>
  );
}

// The single citizen-facing landing page for ANY document type (Act,
// Notification, Circular, …), opened on a direct browse click — independent
// of the raw PDF. Clicking an entry expands its text inline; nothing here
// scrolls or touches the PDF viewer. The PDF stays reachable via "View
// Document" in the meta row (parallel to department/year), and DocViewModal itself
// is still used separately for "show me where my search term matched". When a
// document has no chapters/schedules/etc. and nothing relates to it, this
// collapses to a plain details card (see SimpleDocLayout) instead of five
// empty, disabled tabs.
export default function ActContentsView({ doc: rawDoc, onClose, citizenView = false, onLoginAsOfficer }) {
  const { t } = useTranslation('actContents');
  const [fullDetail, setFullDetail] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [retryTick, setRetryTick]   = useState(0);

  // getPdfFull() returns the document's own authoritative fields alongside
  // act_parts/related_documents (same field names publicSearchDocuments uses,
  // so mapPublicDocForViewer works on it too) — once it loads, those replace
  // whatever the click-through carried. That's needed because a semantic
  // search hit's entry is built from a matched page's snippet standing in for
  // the description (see groupSemanticSources in CitizenDashboard), and is
  // missing most other fields entirely; re-deriving from the real record here
  // fixes that regardless of which route a citizen opened this from.
  //
  // Only overrides a field when its own *raw* source field is present on
  // fullDetail — never on mapPublicDocForViewer's fallback strings (e.g.
  // "Miscellaneous"/"Document" when a field is genuinely absent), which would
  // otherwise silently clobber a perfectly good value the click-through
  // already had with a worse generic placeholder.
  const doc = useMemo(() => {
    if (!fullDetail) return rawDoc;
    const authoritative = mapPublicDocForViewer(fullDetail);
    const rawFieldFor = {
      title: fullDetail.document_name, type: fullDetail.document_type_name, dept: fullDetail.department_name,
      year: fullDetail.issue_date || fullDetail.created_at, desc: fullDetail.description, fileName: fullDetail.original_filename,
      referenceNumber: fullDetail.reference_number, enactmentDate: fullDetail.issue_date, effectiveFrom: fullDetail.effective_from,
      gazette: fullDetail.gazette_reference, authority: fullDetail.legal_authority, shortTitle: fullDetail.short_title,
    };
    const merged = { ...rawDoc };
    for (const [key, rawValue] of Object.entries(rawFieldFor)) {
      if (rawValue) merged[key] = authoritative[key];
    }
    if (Object.keys(authoritative.typeFields || {}).length > 0) merged.typeFields = authoritative.typeFields;
    return merged;
  }, [rawDoc, fullDetail]);

  // approvedOnly only for citizens — pending/rejected parts stay invisible to the public
  // even though the API returns them regardless of review status.
  const outline     = useMemo(() => fullDetail ? mapActPartsToOutline(fullDetail.act_parts, citizenView) : EMPTY_OUTLINE, [fullDetail, citizenView]);
  const relatedDocs = useMemo(() => fullDetail ? mapRelationships(fullDetail.related_documents) : {}, [fullDetail]);
  // Every document type except this document's own, always shown — types with
  // nothing related render disabled/greyed rather than being hidden, so a
  // citizen can see the full picture of what could exist here; only types
  // that actually have data (from the real `related_documents` response) are clickable.
  const allRelatedTypes = Object.keys(DOC_TYPE_META).filter(t => t !== doc.type);
  const hasAnyRelated   = allRelatedTypes.some(t => (relatedDocs[t] || []).length > 0);

  // How many entries live under each part tab — drives the count badges,
  // which tabs are clickable, and the "try these instead" suggestions in
  // the empty state. A chapter counts as content on its own even with zero
  // sections inside it yet (some Acts are structured as chapters only, with
  // sections added later) — so each chapter contributes at least 1, not 0.
  const partCounts = useMemo(() => ({
    sections:  outline.sections.chapters.reduce((n, ch) => n + Math.max(ch.sections.length, 1), 0),
    schedules: outline.schedules.length,
    annexures: outline.annexures.length,
    appendix:  outline.appendix.length,
    forms:     outline.forms.length,
  }), [outline]);
  // Whether there's anything to browse in a tabs/rail framework at all — a
  // document can still have related documents with zero parts of its own
  // (e.g. a plain Notification with an Amendment pointing at it), in which
  // case the tabs/rail below have nothing useful to show even though the
  // "Related Documents" band above them does; see hasAnyPartContent usage below.
  const hasAnyPartContent = Object.values(partCounts).some(c => c > 0);

  const [rawActivePart, setActivePart] = useState('sections');
  // Derived rather than synced via an effect: lands on whichever tab actually has
  // content instead of defaulting to (possibly empty) Sections — empty tabs are
  // hidden below, so this keeps the initial view from opening on a dead tab, without
  // needing a setState-in-effect correction once `fullDetail`/`partCounts` are known.
  const activePart = partCounts[rawActivePart] > 0
    ? rawActivePart
    : (Object.keys(PART_META).find(k => partCounts[k] > 0) || rawActivePart);
  const [openEntries, setOpenEntries] = useState(() => new Set()); // set of `${chapterIdx}-${sectionIdx}` or flat idx strings — several can be open at once
  const [chapterFilter, setChapterFilter] = useState(''); // narrows the chapter rail only; the reader itself still renders every chapter
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [relatedDialogType, setRelatedDialogType]   = useState(null);
  const [summaryDialogOpen, setSummaryDialogOpen]   = useState(false); // structured docs (sections/schedules/related) show Summary as an on-demand dialog instead of an always-visible band, since that space is busier there
  const [expandedRelated, setExpandedRelated]       = useState(null); // which related-doc row is expanded in the dialog
  const [viewRelatedDoc, setViewRelatedDoc] = useState(null); // related doc currently open in its own PDF viewer
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef({});
  const scrollAreaRef = useRef(null);

  // Fetches the Act's full content (chapters/sections/schedules/… + related
  // documents) in one call — everything here previously came from mock data.
  // Same documented fetch-on-mount pattern used throughout this codebase
  // (flip loading on, fetch, flip off in finally) — react-hooks/set-state-in-effect
  // flags any sync setState in an effect, but there's no non-effect way to kick off
  // a fetch when `doc.id`/`retryTick` change.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError(false);
    getPdfFull(doc.id)
      .then(res => { if (!cancelled) setFullDetail(res.data); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc.id, retryTick]);

  // `related_documents` already carries every field for each related record
  // (status, dates, gazette ref, legal authority, description, …) — no
  // second fetch needed to show full detail in the dialog.
  const relatedDialogItems = useMemo(() => {
    if (!relatedDialogType) return [];
    return (relatedDocs[relatedDialogType] || []).map(it => ({
      ...mapPublicDocForViewer(it),
      relationshipType: it.relationship_type,
      summary: it.summary || '',
    }));
  }, [relatedDialogType, relatedDocs]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Scroll-spy — highlights whichever chapter is currently in view in the rail
  useEffect(() => {
    if (activePart !== 'sections' || !scrollAreaRef.current) return;
    const els = Object.values(chapterRefs.current).filter(Boolean);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const idx = Number(topMost.target.dataset.chapterIdx);
        if (!Number.isNaN(idx)) setActiveChapter(idx);
      },
      { root: scrollAreaRef.current, threshold: 0.15, rootMargin: '-10% 0px -60% 0px' }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [activePart, outline]);

  function scrollToChapter(ci) {
    chapterRefs.current[ci]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveChapter(ci);
  }

  function switchPart(key) {
    setActivePart(key);
    setOpenEntries(new Set());
  }

  function toggleEntry(key) {
    setOpenEntries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function expandAll() {
    if (activePart === 'sections') {
      const keys = new Set();
      outline.sections.chapters.forEach((ch, ci) => ch.sections.forEach((_, si) => keys.add(`${ci}-${si}`)));
      setOpenEntries(keys);
    } else {
      setOpenEntries(new Set((outline[activePart] || []).map((_, idx) => String(idx))));
    }
  }

  function collapseAll() {
    setOpenEntries(new Set());
  }

  const flatItems = activePart !== 'sections' ? outline[activePart] : null;

  const filteredChapters = useMemo(() => {
    const withIdx = outline.sections.chapters.map((ch, i) => ({ ...ch, _idx: i }));
    const q = chapterFilter.trim().toLowerCase();
    if (!q) return withIdx;
    return withIdx.filter(ch =>
      ch.title?.toLowerCase().includes(q) || ch.sections.some(s => s.title?.toLowerCase().includes(q))
    );
  }, [outline, chapterFilter]);

  const hasChapterRail = activePart === 'sections' && outline.sections.chapters.length > 0 && !outline.sections.isFlat;
  const currentTabHasContent = !loading && !loadError && (
    activePart === 'sections' ? outline.sections.chapters.length > 0 : (flatItems?.length || 0) > 0
  );

  // Title + accent strip + department/year/type — when there's no tabs/rail
  // framework at all (the SimpleDocLayout case), this scrolls away together
  // with the rest of the content below it instead of staying pinned like a
  // toolbar; when there IS a tabs/rail framework, it stays fixed above that
  // framework the way a page header normally would.
  const headerTypeMeta = DOC_TYPE_META[doc.type] || { color: 'var(--primary)', bg: 'var(--primary-light)' };

  // `showSummaryButton` is true only for the tabbed/structured case — the
  // simple-layout case already shows the summary as its own always-visible
  // card, so it doesn't also need this on-demand pill.
  function renderHeaderBlock(showSummaryButton) {
  return (
    <>
      {/* Wrapped as an actual card (border, shadow, left accent stripe) instead of
          a bare row directly on the page background — matches the "quick action"
          card pattern elsewhere in the app (icon box + heading), so the document's
          own name reads as a defined, substantial heading rather than floating in
          empty space. */}
      <div style={{ padding: '18px 24px 6px', flexShrink: 0 }}>
        <Card style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16, borderLeft: '3px solid var(--primary)', padding: '18px 22px' }}>
          {/* Document type — pinned to the card's top-right corner, level with the
              title (parallel to it) rather than crowding the title text itself. */}
          {doc.type && (
            <span style={{ position: 'absolute', top: 16, right: 20, fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 20, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.03em', background: headerTypeMeta.bg, color: headerTypeMeta.color }}>
            {doc.type}
          </span>
          )}
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(33, 74, 171,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={21} color="var(--primary)" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2, paddingRight: doc.type ? 100 : 0 }}>
            {/* This IS the document's own name — the actual page heading, sized and
                weighted to read as one, and wrapping onto a second line rather than
                truncating so a long title still shows in full. Department/year live
                in their own clearly-labelled box below (DocMetaBox). The raw upload
                filename isn't shown at all — this title is what identifies the
                document, not its internal PDF filename. */}
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-.01em', lineHeight: 1.3, margin: 0, overflowWrap: 'break-word' }}>{doc.title}</h1>
          </div>
          {/* No PDF button here — "View Document" in the meta row below (parallel to
              department/year) is the one place that action lives now, for both the
              tabbed/structured case and the plain-details case. */}
          {/* Hidden for citizens — the "Home" breadcrumb above already gives them a way
              back; kept for internal roles (opened via DocViewModal's "Browse Sections &
              Schedules"), which have no breadcrumb and no other way to close this. */}
          {!citizenView && (
            <button onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
              <X size={14} /> {t('close')}
            </button>
          )}
        </Card>
      </div>

      <DocMetaBox dept={doc.dept} year={doc.year} docId={doc.id}
        onOpenSummary={showSummaryButton && doc.desc ? () => setSummaryDialogOpen(true) : undefined} />
    </>
  );
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', animation: 'fadeSlideIn .2s ease' }}>
      <style>{`
        @keyframes acvShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
        @media (max-width: 860px) {
          .acv-grid { grid-template-columns: 1fr !important; }
          .acv-rail { display: none !important; }
          .acv-reader { padding: 20px !important; }
          .acv-paper { padding: 24px !important; }
          .acv-simple-grid { grid-template-columns: 1fr !important; padding: 24px 20px !important; }
          .acv-simple-sidebar { position: static !important; }
        }
      `}</style>

      {/* Citizen branding/language/accessibility/login bar — same one CitizenDashboard
          shows, so it stays available no matter where in the citizen flow someone is */}
      {citizenView && <CitizenTopBar onLoginAsOfficer={onLoginAsOfficer} />}

      {/* Breadcrumb "bowl" — same seamless concave-corner style Topbar.jsx uses for
          Uploader/Approver's own breadcrumb, so this reads as the same pattern
          rather than a one-off design. "Home" gives citizens an explicit way back
          to the dashboard (this whole view is a full-screen overlay, not a
          browser-navigable route), and names this page so it's clear what's open. */}
      {citizenView && (
        <div style={{ position: 'relative', margin: '0 4rem', flexShrink: 0 }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: -22, width: 22, height: 22, background: 'radial-gradient(circle at 0 100%, transparent 22px, var(--surface-card) 22px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, right: -22, width: 22, height: 22, background: 'radial-gradient(circle at 100% 100%, transparent 22px, var(--surface-card) 22px)' }} />
          <div style={{
            padding: '10px 22px', borderRadius: '0 0 28px 28px', background: 'var(--surface-card)',
            border: '1px solid var(--surface-border)', borderTop: 'none', boxShadow: 'var(--card-shadow)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-color-secondary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-color-secondary)'}>
              {t('home')}
            </button>
            <ChevronRight size={13} color="var(--text-color-secondary)" style={{ opacity: .55 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{t('documentView')}</span>
          </div>
        </div>
      )}

      {/* Related documents (its Rules, Amendments, Notifications, …) — shown
          above whichever layout follows, in both branches, since "something
          relates to this document" is a separate question from "does this
          document have its own sections/schedules to browse". Only types
          that actually have something related render at all; types with
          nothing are left out entirely rather than shown disabled. */}
      {(() => {
        const relatedDocsBand = hasAnyRelated && (
          <div style={{ padding: '14px 24px', flexShrink: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 9 }}>{t('relatedDocuments')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allRelatedTypes.filter(type => (relatedDocs[type] || []).length > 0).map(type => {
                const items = relatedDocs[type] || [];
                const meta = DOC_TYPE_META[type] || { color: '#64748b', bg: 'rgba(100,116,139,.1)', border: 'rgba(100,116,139,.25)' };
                return (
                  <button key={type} type="button"
                    onClick={() => (setRelatedDialogType(type), setExpandedRelated(null))}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 2px 8px ${meta.border}`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 20,
                      border: `1px solid ${meta.border}`, background: meta.bg, color: meta.color,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--font)', transition: 'box-shadow .15s',
                    }}>
                    <FileText size={11} style={{ flexShrink: 0 }} />
                    {type} · {items.length}
                  </button>
                );
              })}
            </div>
          </div>
        );

        // Related-type dialog and related-document viewer — pulled out to a
        // variable (rather than left inline in the tabbed branch below) so the
        // no-parts SimpleDocLayout branch can render them too: relatedDocsBand's
        // pills are shown in BOTH branches, but until this fix these dialogs
        // only existed in the tabbed branch, so clicking a pill on a document
        // with no sections/schedules/etc. (e.g. one with only a related
        // Amendment) set relatedDialogType but had nothing in the DOM to show it.
        const relatedTypeDialog = relatedDialogType && (
          <div onClick={() => setRelatedDialogType(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface-card)', borderRadius: 14, width: 660, maxWidth: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{relatedDialogType} · {relatedDialogItems.length}</span>
                <button onClick={() => setRelatedDialogType(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ overflowY: 'auto' }}>
                {relatedDialogItems.map((it, idx) => {
                  const rowKey = it.id ?? idx;
                  const isOpen = expandedRelated === rowKey;
                  const fields = [
                    [t('referenceNo'),  it.referenceNumber],
                    [t('issueDate'),     it.enactmentDate],
                    [t('effectiveFrom'), it.effectiveFrom],
                    [t('gazetteRef'),   it.gazette],
                    [t('legalAuthority'), it.authority],
                    [t('shortTitle'),    it.shortTitle],
                  ].filter(([, v]) => v);
                  return (
                    <div key={rowKey} style={{ borderBottom: idx < relatedDialogItems.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 20px', background: isOpen ? 'var(--surface-ground)' : 'transparent' }}
                        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}>
                        <button type="button" onClick={() => setExpandedRelated(isOpen ? null : rowKey)}
                          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', padding: 0 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)' }}>{it.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                              {it.relationshipType && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.03em', background: 'rgba(33, 74, 171,.08)', color: 'var(--primary)' }}>
                                  {humanizeRelationType(it.relationshipType)}
                                </span>
                              )}
                              {it.status && (
                                <span style={{
                                  fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.03em',
                                  background: it.status === 'approved' ? 'rgba(25,135,84,.1)' : it.status === 'rejected' ? 'rgba(220,53,69,.1)' : 'rgba(255,193,7,.1)',
                                  color: it.status === 'approved' ? '#16a34a' : it.status === 'rejected' ? '#dc3545' : '#b45309',
                                }}>{it.status}</span>
                              )}
                              {it.dept && <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{it.dept}</span>}
                              {it.year && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>· {it.year}</span>}
                            </div>
                          </div>
                          <ChevronDown size={14} color="var(--text-color-secondary)" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0, marginTop: 3 }} />
                        </button>
                        {/* Parallel to the title/badges once expanded — not pushed down onto its own line below. */}
                        {isOpen && it.id != null && (
                          <button type="button" onClick={() => citizenView ? openPdfInNewTab(it.id) : (setViewRelatedDoc(it), setRelatedDialogType(null))}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s', flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
                            <Eye size={12} /> {t('viewDocument')}
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 20px 16px' }}>
                          {fields.length > 0 && (
                            <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden', marginBottom: (it.desc || it.summary) ? 10 : 0 }}>
                              {fields.map(([k, v], i) => (
                                <div key={k} style={{ display: 'flex', alignItems: 'center', borderBottom: i < fields.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                                  <div style={{ padding: '8px 12px', width: 118, boxSizing: 'border-box', flexShrink: 0, background: 'var(--surface-50)', fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>{k}</div>
                                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-heading)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{String(v)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {(it.desc || it.summary) && (
                            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                              {it.summary || it.desc}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

        // Opens a related document's own PDF, layered above this document's reading view
        const viewRelatedDocModal = viewRelatedDoc && (
          <DocViewModal doc={viewRelatedDoc} onClose={() => setViewRelatedDoc(null)} zIndex={2300} citizenView={citizenView} />
        );

        // No sections/schedules/annexures/appendix/forms at all — skip the
        // tabs/rail framework in favour of the simple two-column
        // summary-and-details layout, whether or not there are related
        // documents (that band above already covers "something relates to
        // this document" on its own). The header scrolls away together with
        // that layout instead of staying pinned like a toolbar (SimpleDocLayout
        // renders its own always-visible summary card; the tabbed case below
        // opens its summary on demand from the "Summary" pill instead, since
        // that page is already busier with tabs/rail/related-doc pills).
        if (!loading && !loadError && !hasAnyPartContent) {
          return (
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-ground)' }}>
              {renderHeaderBlock(false)}
              {relatedDocsBand}
              {relatedTypeDialog}
              {viewRelatedDocModal}
              <SimpleDocLayout doc={doc} />
            </div>
          );
        }
        return (
      <div ref={scrollAreaRef} onScroll={e => setShowBackToTop(e.currentTarget.scrollTop > 480)}
        style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-ground)' }}>
      {renderHeaderBlock(true)}
      {relatedDocsBand}

      {/* Summary dialog — opened from the "Summary" pill next to the date, for the
          tabbed/structured case where an always-visible band would compete with
          tabs/rail/related-doc pills for space. */}
      {summaryDialogOpen && (
        <div onClick={() => setSummaryDialogOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface-card)', borderRadius: 14, width: 640, maxWidth: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={15} color="var(--primary)" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{t('summary')}</span>
              </div>
              <button onClick={() => setSummaryDialogOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-color)' }}>
              {renderFormattedSummary(doc.desc)}
            </div>
          </div>
        </div>
      )}

      {relatedTypeDialog}
      {viewRelatedDocModal}

      {/* Tabs + rail/reader body — skipped entirely once loaded if this document
          has no parts at all (only related docs, e.g.), same "don't show what
          isn't there" rule as the related-document pills above. */}
      {(loading || loadError || hasAnyPartContent) && (
      <>
      {/* Part tabs — only ones with actual content render at all once loaded
          (while still loading/on error, counts aren't known yet, so all 5 show
          rather than guessing which to drop). */}
      <div style={{ display: 'flex', gap: 26, padding: '0 24px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0, overflowX: 'auto' }}>
        {Object.keys(PART_META).filter(key => loading || loadError || partCounts[key] > 0).map(key => {
          const m = PART_META[key];
          const Icon = PART_ICONS[key];
          const isActive = activePart === key;
          return (
            <button key={key} type="button" onClick={() => switchPart(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '13px 2px 11px', background: 'transparent', border: 'none',
                borderBottom: `2.5px solid ${isActive ? m.accent : 'transparent'}`,
                color: isActive ? m.accent : 'var(--text-color-secondary)',
                fontFamily: 'var(--font)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'color .15s, border-color .15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-heading)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-color-secondary)'; }}>
              <Icon size={14} strokeWidth={2} />
              {t(PART_LABEL_KEYS[key])}
              {!loading && !loadError && (
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 10,
                  background: isActive ? m.bg : 'var(--surface-hover)', color: isActive ? m.accent : 'var(--text-color-secondary)',
                }}>
                  {partCounts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="acv-grid" style={{ display: 'grid', gridTemplateColumns: hasChapterRail ? '272px 1fr' : '1fr' }}>

        {hasChapterRail && (
          <div className="acv-rail" style={{ borderRight: '1px solid var(--surface-border)', position: 'sticky', top: 0, alignSelf: 'start', maxHeight: '100vh', overflowY: 'auto', padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>
                <BookOpen size={12} /> {t('chapters')}
              </div>
              <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
                {activeChapter + 1} / {outline.sections.chapters.length}
              </span>
            </div>

            {outline.sections.chapters.length > 6 && (
              <div style={{ position: 'relative', marginBottom: 12, padding: '0 6px' }}>
                <Search size={13} color="var(--text-color-secondary)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={chapterFilter} onChange={e => setChapterFilter(e.target.value)} placeholder={t('filterChaptersPlaceholder')}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-color)', outline: 'none', transition: 'border-color .15s' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--surface-border)'} />
              </div>
            )}

            {filteredChapters.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', padding: '10px 6px' }}>{t('noChaptersMatch', { query: chapterFilter })}</div>
            ) : filteredChapters.map(ch => {
              const ci = ch._idx;
              const isActive = activeChapter === ci;
              return (
                <button key={ci} type="button" onClick={() => scrollToChapter(ci)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '11px 12px', borderRadius: 10, marginBottom: 4,
                    border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                    background: isActive ? 'rgba(33, 74, 171,.08)' : 'var(--surface-card)',
                    cursor: 'pointer', fontFamily: 'var(--font)',
                    boxShadow: isActive ? '0 2px 10px rgba(33, 74, 171,.12)' : 'var(--card-shadow)',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-card)'; }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700,
                    background: isActive ? 'var(--primary)' : 'var(--surface-ground)',
                    color: isActive ? '#fff' : 'var(--text-color-secondary)',
                  }}>{ci + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--text-heading)', lineHeight: 1.4 }}>{ch.title}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                      {t('sectionsCount', { count: ch.sections.length })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="acv-reader" style={{ padding: '28px 32px' }}>
          <div className="acv-paper" style={{
            maxWidth: 720, margin: '0 auto', background: 'var(--surface-card)', borderRadius: 14,
            border: '1px solid var(--surface-border)', borderTop: '3px solid var(--primary)',
            boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 14px 32px rgba(0,0,0,.06)', padding: '36px 44px',
          }}>

            {loading ? (
              <LoadingPart />
            ) : loadError ? (
              <ErrorPart onRetry={() => setRetryTick(t => t + 1)} />
            ) : activePart === 'sections' && outline.sections.chapters.length === 0 ? (
              <EmptyPart activePart="sections" counts={partCounts} onJump={switchPart} />
            ) : activePart !== 'sections' && flatItems.length === 0 ? (
              <EmptyPart activePart={activePart} counts={partCounts} onJump={switchPart} />
            ) : (
              <>
                {currentTabHasContent && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 18 }}>
                    <button type="button" onClick={expandAll}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s, color .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-heading)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.color = 'var(--text-color-secondary)'; }}>
                      <UnfoldVertical size={12} /> {t('expandAll')}
                    </button>
                    <button type="button" onClick={collapseAll}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s, color .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-heading)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.color = 'var(--text-color-secondary)'; }}>
                      <FoldVertical size={12} /> {t('collapseAll')}
                    </button>
                  </div>
                )}

                {activePart === 'sections' ? (
                  outline.sections.chapters.map((ch, ci) => (
                    <div key={ci} ref={el => { chapterRefs.current[ci] = el; }} data-chapter-idx={ci}
                      style={{ marginBottom: ci < outline.sections.chapters.length - 1 ? 40 : 0, scrollMarginTop: 20 }}>
                      {ch.title && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff', background: 'var(--primary)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.04em' }}>{t('chapterLabel', { number: ci + 1 })}</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
                          </div>
                          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 18px', letterSpacing: '-.01em' }}>{ch.title}</h2>
                        </>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ch.sections.map((sec, si) => {
                          const entryKey = `${ci}-${si}`;
                          const isOpen = openEntries.has(entryKey);
                          return (
                            <div key={si} style={{
                              borderRadius: 10, border: `1px solid ${isOpen ? 'var(--primary)' : 'var(--surface-border)'}`,
                              background: isOpen ? 'rgba(33, 74, 171,.04)' : 'transparent', overflow: 'hidden', transition: 'border-color .15s',
                            }}>
                              <button type="button" onClick={() => toggleEntry(entryKey)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}
                                onMouseEnter={e => { if (!isOpen) e.currentTarget.parentElement.style.background = 'var(--surface-ground)'; }}
                                onMouseLeave={e => { if (!isOpen) e.currentTarget.parentElement.style.background = 'transparent'; }}>
                                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, background: isOpen ? 'var(--primary)' : 'var(--surface-ground)', color: isOpen ? '#fff' : 'var(--text-color-secondary)' }}>{si + 1}</span>
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', flex: 1 }}>{sec.title}</span>
                                <ChevronDown size={14} color="var(--text-color-secondary)" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0 }} />
                              </button>
                              {isOpen && (
                                <div style={{ padding: '0 14px 18px 46px', fontSize: 14, color: 'var(--text-color)', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: SERIF_STACK }}>
                                  {sec.content}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-heading)', margin: 0, letterSpacing: '-.01em' }}>{t(PART_LABEL_KEYS[activePart])}</h2>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: PART_META[activePart].accent, background: PART_META[activePart].bg, padding: '3px 10px', borderRadius: 20 }}>{flatItems.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {flatItems.map((it, idx) => {
                        const entryKey = String(idx);
                        const isOpen = openEntries.has(entryKey);
                        return (
                          <div key={idx} style={{
                            borderRadius: 10, border: `1px solid ${isOpen ? PART_META[activePart].accent : 'var(--surface-border)'}`,
                            background: isOpen ? PART_META[activePart].bg : 'transparent', overflow: 'hidden', transition: 'border-color .15s',
                          }}>
                            <div role="button" tabIndex={0} onClick={() => toggleEntry(entryKey)}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(entryKey); } }}
                              style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', flex: 1 }}>{it.title}</span>
                              {/* Schedules/annexures/appendices/forms can each carry their own
                                  attached file, separate from the parent Act's own PDF — opens it
                                  in a new tab (browser's own PDF viewer: print/download/zoom all
                                  built in) rather than forcing an automatic download. */}
                              {it.fileRef && (
                                <button type="button" onClick={e => { e.stopPropagation(); openActPartFileInNewTab(it.fileRef); }}
                                  title={t('viewAttachment')}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
                                  <Eye size={12} /> {t('view')}
                                </button>
                              )}
                              <ChevronDown size={14} color="var(--text-color-secondary)" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0 }} />
                            </div>
                            {isOpen && (
                              <div style={{ padding: '0 14px 18px 14px', fontSize: 14, color: 'var(--text-color)', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: SERIF_STACK }}>
                                {it.content}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
      </>
      )}
      </div>
        );
      })()}

      {showBackToTop && (
        <button type="button" onClick={() => scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('backToTop')}
          style={{
            position: 'fixed', bottom: 28, right: 32, zIndex: 2150, width: 44, height: 44, borderRadius: '50%',
            background: 'var(--primary)', color: '#fff', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}
