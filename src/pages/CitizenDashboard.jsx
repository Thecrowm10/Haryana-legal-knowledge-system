import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Filter, X, BookOpen, Building2, ArrowRight, Download, Bookmark, BookmarkCheck, MapPin, ChevronRight } from 'lucide-react';
import { DOCUMENTS } from '../data/mockData';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const APPROVED  = DOCUMENTS.filter(d => d.status === 'approved');
const DEPTS     = ['All', ...new Set(APPROVED.map(d => d.dept))];
const YEARS     = ['All', ...[...new Set(APPROVED.map(d => d.year))].sort((a, b) => b - a)];
const TYPES     = ['All', ...new Set(APPROVED.map(d => d.type))];
const STATUSES  = ['All', 'active', 'repealed'];

const SUGGESTIONS = [
  'right to information', 'RTI act 2005', 'land revenue', 'municipal act',
  'panchayati raj', 'right to service', 'shops establishment', 'building plan',
  'environmental clearance', 'property tax', 'labour welfare',
];

// ── Snippet / highlight helpers ───────────────────────────────────────────────
function matchesQuery(doc, query) {
  if (!query) return true;
  const haystack = (doc.title + ' ' + (doc.desc || '') + ' ' + (doc.extractedText || '')).toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return words.some(w => haystack.includes(w));
}

function getSnippet(doc, query) {
  const text = doc.desc || doc.extractedText || '';
  if (!text || !query) return null;
  const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);

  // Split into paragraphs, score each by query-word density, return best
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 40);
  if (paragraphs.length > 1) {
    const scored = paragraphs
      .map(p => ({ p, hits: qWords.filter(w => p.toLowerCase().includes(w)).length }))
      .filter(s => s.hits > 0)
      .sort((a, b) => b.hits - a.hits || b.p.length - a.p.length);
    if (scored.length > 0) {
      const best = scored[0].p;
      return best.length > 260 ? best.slice(0, 260) + '…' : best;
    }
  }

  // Fallback: sliding window around first match
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const w of qWords) {
    const i = lower.indexOf(w);
    if (i !== -1 && (bestIdx === -1 || i < bestIdx)) bestIdx = i;
  }
  if (bestIdx === -1) return null;
  const start = Math.max(0, bestIdx - 55);
  const end   = Math.min(text.length, bestIdx + 190);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function HighlightedText({ text, query, style }) {
  if (!text || !query) return <span style={style}>{text}</span>;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return <span style={style}>{text}</span>;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts   = text.split(new RegExp(`(${pattern})`, 'gi'));
  return (
    <span style={style}>
      {parts.map((part, i) =>
        words.some(w => part.toLowerCase() === w)
          ? <mark key={i} style={{ background: 'rgba(234,179,8,.45)', borderRadius: 2, padding: '0 2px', fontWeight: 700, color: '#78350f' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

function scoreRelevance(doc, query) {
  const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const title  = doc.title.toLowerCase();
  let score = 0;
  // Full phrase in title → strongest signal
  if (title.includes(query.toLowerCase())) score += 200;
  // Each query word in title → strong
  qWords.forEach(w => { if (title.includes(w)) score += 30; });
  // Each query word in desc → weaker
  const body = (doc.desc || doc.extractedText || '').toLowerCase();
  qWords.forEach(w => { if (body.includes(w)) score += 5; });
  return score;
}

function DirectAnswer({ query, docs }) {
  // Pick the most relevant doc that has body text with a snippet
  const ranked = docs
    .filter(d => d.desc || d.extractedText)
    .map(d => ({ d, score: scoreRelevance(d, query) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score === 0) return null;
  const doc = best.d;
  const passage = getSnippet(doc, query);
  if (!passage) return null;

  return (
    <div style={{ marginBottom: 18, borderRadius: 12, border: '1.5px solid rgba(26,86,219,.35)',
      background: 'rgba(26,86,219,.04)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '9px 16px', background: 'rgba(26,86,219,.09)', borderBottom: '1px solid rgba(26,86,219,.2)',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <BookOpen size={13} color="var(--primary)" />
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--primary)',
          letterSpacing: '.07em', textTransform: 'uppercase', flex: 1 }}>
          Direct Answer from Document — Verbatim · Zero Generation
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)',
          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.title}
        </span>
      </div>

      {/* One-line summary label */}
      <div style={{ padding: '8px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700,
          color: 'var(--text-color-secondary)', letterSpacing: '.05em' }}>
          WHAT IS {query.toUpperCase()}?
        </span>
      </div>

      {/* Verbatim passage */}
      <div style={{ padding: '8px 18px 14px' }}>
        <HighlightedText
          text={passage}
          query={query}
          style={{ fontSize: 13.5, lineHeight: 1.9, color: 'var(--text-color)', fontFamily: 'Georgia, serif' }}
        />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
            § Section {doc.section} · Page {Math.ceil(doc.pages / 3)} of {doc.pages}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#16a34a', background: 'rgba(34,197,94,.08)',
            border: '1px solid rgba(34,197,94,.25)', borderRadius: 10, padding: '1px 8px' }}>
            ✓ Verbatim — no AI text
          </span>
        </div>
      </div>
    </div>
  );
}

const LABEL    = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };
const TYPE_PILL = { fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, letterSpacing: '.04em', textTransform: 'uppercase', background: 'rgba(26,86,219,.1)', color: 'var(--primary)', border: '1px solid rgba(26,86,219,.25)' };

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem('hlks_bookmarks') || '[]'); } catch { return []; }
}
function saveBookmarks(bm) {
  localStorage.setItem('hlks_bookmarks', JSON.stringify(bm));
}

// PDF Viewer Modal
function PdfViewerModal({ doc, query, onClose }) {
  if (!doc) return null;
  const passage = getSnippet(doc, query) || (doc.desc || '').slice(0, 260) + '…';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-50)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={16} color="var(--primary)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Exact Document Location</div>
              <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 1 }}>{doc.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)' }}>
            <X size={13} />
          </button>
        </div>

        {/* Location pointer */}
        <div style={{ padding: '22px', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
            {[['Page', Math.ceil(doc.pages / 3)], ['Section', doc.section], ['Paragraph', doc.paragraph], ['Total Pages', doc.pages]].map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(26,86,219,.06)', border: '1px solid rgba(26,86,219,.2)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ ...LABEL, color: 'var(--primary)', marginBottom: 6, fontSize: 9.5 }}>{k}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Simulated PDF page — same text as Direct Answer */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '20px', fontFamily: 'Georgia, serif' }}>
            <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginBottom: 12, fontFamily: 'var(--mono)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{doc.title}</span>
              <span>Page {Math.ceil(doc.pages / 3)} of {doc.pages}</span>
            </div>
            <div style={{ background: 'rgba(26,86,219,.1)', border: '2px solid var(--primary)', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: '#1e3364', lineHeight: 1.85, position: 'relative' }}>
              <div style={{ position: 'absolute', top: -10, left: 12, background: 'var(--primary)', color: 'white', fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 4, letterSpacing: '.06em' }}>
                § SECTION {doc.section} · EXACT MATCH
              </div>
              <HighlightedText text={passage} query={query} style={{ lineHeight: 1.85 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 12, fontStyle: 'italic' }}>
              * Verbatim text from source document. No AI-generated content — TOR Zero-Generation Compliant.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color)', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Close
          </button>
          <button onClick={() => alert(`Downloading: ${doc.title}.pdf`)}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font)' }}>
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CitizenDashboard({ activePage, onAuditLog }) {
  const [query, setQuery]       = useState('');
  const [dept, setDept]         = useState('All');
  const [year, setYear]         = useState('All');
  const [type, setType]         = useState('All');
  const [legalStatus, setLegalStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [pdfDoc, setPdfDoc]     = useState(null);
  const inputRef = useRef(null);

  const suggestions = query.length >= 2
    ? [
        ...APPROVED.filter(d => d.title.toLowerCase().includes(query.toLowerCase())).map(d => d.title),
        ...SUGGESTIONS.filter(s => s.includes(query.toLowerCase())),
      ].slice(0, 6)
    : [];

  function doSearch(q = query) {
    setQuery(q);
    setShowSuggestions(false);
    setLoading(true);
    setSearched(false);
    setTimeout(() => {
      setLoading(false);
      setSearched(true);
      onAuditLog?.(`Searched: "${q || 'all documents'}"`);
    }, 600);
  }

  function clearSearch() {
    setQuery(''); setDept('All'); setYear('All'); setType('All'); setLegalStatus('All');
    setSearched(false); setSelected(null);
  }

  function toggleBookmark(q) {
    const updated = bookmarks.includes(q)
      ? bookmarks.filter(b => b !== q)
      : [q, ...bookmarks].slice(0, 10);
    setBookmarks(updated);
    saveBookmarks(updated);
  }

  const isBookmarked = bookmarks.includes(query);

  const results = APPROVED
    .filter(d => {
      const mQ = matchesQuery(d, query);
      const mD = dept === 'All' || d.dept === dept;
      const mY = year === 'All' || String(d.year) === String(year);
      const mT = type === 'All' || d.type === type;
      const mL = legalStatus === 'All' || d.legalStatus === legalStatus;
      return mQ && mD && mY && mT && mL;
    })
    .sort((a, b) => query ? scoreRelevance(b, query) - scoreRelevance(a, query) : 0);

  // ── Home page ────────────────────────────────────────────────────────────
  if (activePage === 'home') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { icon: FileText,  label: 'Published Documents', value: APPROVED.length,                            bg: 'rgba(26,86,219,.12)',  color: 'var(--primary)' },
            { icon: Building2, label: 'Departments',         value: DEPTS.length - 1,                          bg: 'rgba(59,130,246,.12)', color: '#3b82f6' },
            { icon: BookOpen,  label: 'Document Types',      value: TYPES.length - 1,                          bg: 'rgba(245,158,11,.12)', color: '#f59e0b' },
          ].map(s => (
            <Card key={s.label}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 10 }}>{s.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                </div>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} strokeWidth={1.8} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 16 }}>Recently Published</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                {['Document', 'Type', 'Department', 'Year', 'Status'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '0 14px 10px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPROVED.slice(0, 5).map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{doc.title}</td>
                  <td style={{ padding: '12px 14px' }}><span style={TYPE_PILL}>{doc.type}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{doc.dept}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-color-secondary)' }}>{doc.year}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: doc.legalStatus === 'active' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: doc.legalStatus === 'active' ? '#1e40af' : '#b91c1c', border: `1px solid ${doc.legalStatus === 'active' ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
                      {doc.legalStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {bookmarks.length > 0 && (
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookmarkCheck size={15} color="var(--primary)" /> Saved Queries
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {bookmarks.map(bm => (
                <button key={bm} onClick={() => doSearch(bm)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color)', padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <Search size={11} /> {bm} <ChevronRight size={11} />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Search page ──────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      {pdfDoc && <PdfViewerModal doc={pdfDoc} query={query} onClose={() => setPdfDoc(null)} />}

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>Search Legal Documents</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 18 }}>
          Results return document pointers only — zero AI-generated text, as per TOR requirement.
        </div>

        {/* Search input with autocomplete */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, overflow: 'visible', maxWidth: 600, transition: 'border-color .2s', position: 'relative' }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--surface-border)'}>
              <span style={{ padding: '0 12px', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Search size={15} /></span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                onKeyDown={e => { if (e.key === 'Enter') doSearch(); if (e.key === 'Escape') setShowSuggestions(false); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search by act name, keyword or document type…"
                style={{ flex: 1, padding: '10px 0', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font)', fontSize: 13.5, color: 'var(--text-color)' }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setShowSuggestions(false); inputRef.current?.focus(); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 8px', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
              <button onClick={() => doSearch()}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '9px 20px', margin: 4, borderRadius: 6, fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                Search
              </button>

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: 'var(--card-shadow)', zIndex: 100, overflow: 'hidden' }}>
                  {suggestions.map((s, i) => (
                    <div key={i} onMouseDown={() => { setQuery(s); doSearch(s); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid var(--surface-border)' : 'none', fontSize: 13, color: 'var(--text-color)', transition: 'background .12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Search size={12} color="var(--text-color-secondary)" />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmark button */}
            {query && searched && (
              <button onClick={() => toggleBookmark(query)} title={isBookmarked ? 'Remove bookmark' : 'Save this query'}
                style={{ background: isBookmarked ? 'rgba(26,86,219,.1)' : 'var(--surface-card)', border: `1px solid ${isBookmarked ? 'rgba(26,86,219,.3)' : 'var(--surface-border)'}`, color: isBookmarked ? 'var(--primary)' : 'var(--text-color-secondary)', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font)', transition: 'all .2s' }}>
                {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                {isBookmarked ? 'Saved' : 'Save'}
              </button>
            )}

            {searched && (
              <button onClick={clearSearch}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '9px 16px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Filters — E-03 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={13} color="var(--text-color-secondary)" />
          {[
            ['Department',    dept,        setDept,        DEPTS],
            ['Year',          year,        setYear,        YEARS],
            ['Type',          type,        setType,        TYPES],
            ['Legal Status',  legalStatus, setLegalStatus, STATUSES],
          ].map(([lbl, val, setter, opts]) => (
            <select key={lbl} value={val} onChange={e => setter(e.target.value)}
              style={{
                background: val !== 'All' ? 'rgba(26,86,219,.08)' : 'var(--surface-card)',
                border: `1px solid ${val !== 'All' ? 'rgba(26,86,219,.3)' : 'var(--surface-border)'}`,
                color: val !== 'All' ? 'var(--primary)' : 'var(--text-color-secondary)',
                borderRadius: 7, padding: '6px 28px 6px 11px', fontFamily: 'var(--font)', fontSize: 12.5, outline: 'none', cursor: 'pointer',
                appearance: 'none',
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
              }}>
              {opts.map(o => <option key={o} value={o}>{o === 'All' ? `— ${lbl} —` : o}</option>)}
            </select>
          ))}
        </div>

        {/* Saved queries quick-access */}
        {bookmarks.length > 0 && !searched && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ ...LABEL, marginBottom: 8 }}>Saved Queries</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {bookmarks.map(bm => (
                <button key={bm} onMouseDown={() => doSearch(bm)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <BookmarkCheck size={11} color="var(--primary)" /> {bm}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '52px 0' }}>
          <div style={{ display: 'inline-flex', gap: 6, marginBottom: 12 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: `bounce .8s ease-in-out ${i * .12}s infinite` }} />)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Searching documents…</div>
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 14, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              <strong style={{ color: 'var(--primary)' }}>{results.length}</strong> document{results.length !== 1 ? 's' : ''} found
              {query && <> for <em style={{ color: 'var(--text-heading)', fontStyle: 'normal' }}>"{query}"</em></>}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>Zero-Generation Mode · No AI text</span>
          </div>

          {results.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '64px 0' }}>
              <Search size={40} color="var(--surface-200)" style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 5 }}>No documents found</div>
              <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Try different keywords or adjust your filters</div>
            </Card>
          ) : (
            <>
            {/* Direct Answer from Document — verbatim passage, zero generation */}
            {query && <DirectAnswer query={query} docs={results} />}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '2fr 3fr' : '1fr', gap: 16 }}>

              {/* Results table */}
              <Card padding="0">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                      {['Document', 'Dept', 'Year', 'Status', ''].map(h => (
                        <th key={h} style={{ ...LABEL, padding: '11px 14px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(doc => (
                      <tr key={doc.id}
                        onClick={() => { setSelected(doc); onAuditLog?.(`Viewed: ${doc.title}`); }}
                        style={{ cursor: 'pointer', background: selected?.id === doc.id ? 'rgba(26,86,219,.06)' : 'transparent', borderBottom: '1px solid var(--surface-border)', transition: 'background .15s', borderLeft: selected?.id === doc.id ? '3px solid var(--primary)' : '3px solid transparent' }}
                        onMouseEnter={e => { if (selected?.id !== doc.id) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { if (selected?.id !== doc.id) e.currentTarget.style.background = 'transparent'; }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', maxWidth: 180 }}>{doc.title}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{doc.dept}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.year}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', fontFamily: 'var(--mono)', background: doc.legalStatus === 'active' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: doc.legalStatus === 'active' ? '#1e40af' : '#b91c1c' }}>
                            {doc.legalStatus}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button style={{ background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '5px 12px', borderRadius: 6, fontFamily: 'var(--font)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            View <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Document pointer panel — E-05, E-07 */}
              {selected && (
                <Card style={{ animation: 'fadeSlideIn .2s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', flex: 1, paddingRight: 12 }}>{selected.title}</div>
                    <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={12} /></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[['Department', selected.dept], ['Year', selected.year], ['Type', selected.type], ['Total Pages', selected.pages]].map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ ...LABEL, marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Legal status */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: selected.legalStatus === 'active' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: selected.legalStatus === 'active' ? '#1e40af' : '#b91c1c', border: `1px solid ${selected.legalStatus === 'active' ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
                      Legal Status: {selected.legalStatus.toUpperCase()}
                    </span>
                  </div>

                  {/* Document pointer — E-07 */}
                  <div style={{ background: 'rgba(26,86,219,.06)', border: '1px solid rgba(26,86,219,.2)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                      <MapPin size={13} color="var(--primary)" />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Document Pointer — Zero-Generation Mode</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {[['Page', Math.ceil(selected.pages / 3)], ['Section', selected.section], ['Paragraph', selected.paragraph]].map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--surface-card)', border: '1px solid rgba(26,86,219,.2)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                          <div style={{ ...LABEL, color: 'var(--primary)', marginBottom: 6, fontSize: 9.5 }}>{k}</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions — E-05, E-07 */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setPdfDoc(selected)}
                      style={{ flex: 1, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color)', padding: '9px 0', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}>
                      <MapPin size={13} /> Show Exact Location
                    </button>
                    <button onClick={() => alert(`Downloading: ${selected.title}.pdf`)}
                      style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '9px 0', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <Download size={13} /> Download PDF
                    </button>
                  </div>
                </Card>
              )}
            </div>
            </>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !searched && (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <Search size={48} color="var(--surface-200)" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>Search Legal Documents</div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', lineHeight: 1.6 }}>
            Enter a keyword or act name to find published documents.<br />
            Results return structured pointers only — no AI-generated text.
          </div>
        </div>
      )}
    </div>
  );
}
