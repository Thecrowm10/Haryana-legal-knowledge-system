import { useState, useEffect, useRef } from 'react';
import {
  Search, FileText, X, BookOpen, Bookmark, BookmarkCheck,
  ChevronRight, MapPin, AlertCircle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import DocViewModal from '../components/DocViewModal';
import { fullTextSearch, getAllDocumentsAdmin } from '../services/pdf';

// Document types matching backend VALID_DOCUMENT_TYPES
const DOC_TYPE_META = {
  'Act':                 { color: '#1a56db', bg: 'rgba(26,86,219,.1)',   border: 'rgba(26,86,219,.25)' },
  'Amendment':           { color: '#d97706', bg: 'rgba(217,119,6,.1)',   border: 'rgba(217,119,6,.25)' },
  'Notification':        { color: '#7c3aed', bg: 'rgba(124,58,237,.1)',  border: 'rgba(124,58,237,.25)' },
  'Circular':            { color: '#0f766e', bg: 'rgba(20,184,166,.1)',  border: 'rgba(20,184,166,.25)' },
  'Policy':              { color: '#16a34a', bg: 'rgba(34,197,94,.1)',   border: 'rgba(34,197,94,.25)' },
  'Rules & Regulations': { color: '#dc2626', bg: 'rgba(220,38,38,.1)',  border: 'rgba(220,38,38,.25)' },
  'Order/Gazette':       { color: '#a16207', bg: 'rgba(234,179,8,.1)',   border: 'rgba(234,179,8,.25)' },
};

const QUICK_SEARCHES = [
  'right to information', 'land revenue', 'municipal corporation',
  'panchayati raj', 'right to service', 'shops establishments',
  'property tax', 'building regulations', 'labour welfare',
];

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};

function cleanFilename(filename) {
  if (!filename) return 'Document';
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem('hlks_bookmarks') || '[]'); } catch { return []; }
}
function saveBookmarks(bm) {
  localStorage.setItem('hlks_bookmarks', JSON.stringify(bm));
}

const STOP_WORDS = new Set(['a','an','the','and','or','in','of','to','for','by','at','on','is','are','was','were','be','as','it','its','he','she','they','we','you','not','but','if','any','all','may','shall','has','had','have','do','did','does','his','her','their','who','which','such','been','with','from','this','that']);

function HighlightedSnippet({ text, query }) {
  if (!text) return null;
  if (!query) return <span>{text}</span>;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  if (!words.length) return <span>{text}</span>;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        words.some(w => part.toLowerCase() === w)
          ? <mark key={i} style={{ background: 'rgba(234,179,8,.4)', borderRadius: 2, padding: '0 2px', fontWeight: 700, color: '#78350f' }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// Group flat search results by pdf_id so each document appears once
function groupResults(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.pdf_id)) {
      map.set(r.pdf_id, { pdf_id: r.pdf_id, original_filename: r.original_filename, hits: [] });
    }
    map.get(r.pdf_id).hits.push({ page: r.page_number, score: r.relevance_score, snippet: r.snippet });
  }
  return [...map.values()]
    .map(g => ({ ...g, hits: g.hits.sort((a, b) => a.page - b.page) }))
    .sort((a, b) => Math.max(...b.hits.map(h => h.score)) - Math.max(...a.hits.map(h => h.score)));
}

function GroupedResultCard({ group, query, onView }) {
  const name    = cleanFilename(group.original_filename);
  const maxScore = Math.max(...group.hits.map(h => h.score));
  const tier     = maxScore > 70 ? 'high' : maxScore > 30 ? 'medium' : 'low';
  const tierColor = tier === 'high' ? '#16a34a' : tier === 'medium' ? '#d97706' : '#64748b';
  const tierBg    = tier === 'high' ? 'rgba(34,197,94,.08)' : tier === 'medium' ? 'rgba(217,119,6,.08)' : 'rgba(100,116,139,.08)';
  const tierLabel = tier === 'high' ? '★ High Match' : tier === 'medium' ? '◆ Medium Match' : '· Low Match';

  // Best hit = highest relevance score (shown as default snippet)
  const bestHit = group.hits.reduce((b, h) => h.score > b.score ? h : b, group.hits[0]);

  return (
    <div
      style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '16px 18px', transition: 'box-shadow .2s, border-color .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = 'rgba(26,86,219,.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={16} color="var(--primary)" strokeWidth={1.5} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.35, marginBottom: 6 }}>
            <HighlightedSnippet text={name} query={query} />
          </div>

          {/* Page chips — each opens viewer at that specific page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <MapPin size={11} color="var(--text-color-secondary)" style={{ flexShrink: 0 }} />
            {group.hits.map(h => (
              <button key={h.page} onClick={() => onView(h.page)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 5, background: 'rgba(26,86,219,.08)', color: 'var(--primary)', border: '1px solid rgba(26,86,219,.2)', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,86,219,.08)'}>
                p.{h.page}
              </button>
            ))}
            {group.hits.length > 1 && (
              <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
                · {group.hits.length} matches
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.03em', padding: '2px 8px', borderRadius: 5, background: tierBg, color: tierColor, border: `1px solid ${tierColor}33`, marginLeft: 4 }}>
              {tierLabel}
            </span>
          </div>
        </div>

        {/* View at best page */}
        <button
          onClick={() => onView(bestHit.page)}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'opacity .15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <BookOpen size={13} /> View
        </button>
      </div>

      {/* Best-match snippet */}
      {bestHit.snippet && (
        <div
          className="search-snippet"
          style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-color)', fontFamily: 'Georgia, serif' }}
          dangerouslySetInnerHTML={{ __html: bestHit.snippet }}
        />
      )}
    </div>
  );
}

export default function CitizenDashboard({ activePage, onAuditLog }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState(null);
  const [viewDoc, setViewDoc]       = useState(null);
  const [bookmarks, setBookmarks]   = useState(loadBookmarks);
  const [showSugg, setShowSugg]     = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const inputRef = useRef(null);

  // Fetch recently published docs for home page
  useEffect(() => {
    if (activePage !== 'home') return;
    setRecentLoading(true);
    getAllDocumentsAdmin('approved', 0, 8)
      .then(res => setRecentDocs(res.data.documents || []))
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, [activePage]);

  async function doSearch(q = query) {
    const trimmed = (q || '').trim();
    if (trimmed.length < 2) return;
    setQuery(trimmed);
    setShowSugg(false);
    setLoading(true);
    setSearched(false);
    setError(null);
    try {
      const res = await fullTextSearch(trimmed, 0, 50);
      setResults(res.data.results || []);
      setTotal(res.data.total || 0);
      onAuditLog?.(`Searched: "${trimmed}"`);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function clearSearch() {
    setQuery(''); setResults([]); setTotal(0);
    setSearched(false); setError(null); setViewDoc(null);
  }

  function toggleBookmark(bq) {
    const updated = bookmarks.includes(bq)
      ? bookmarks.filter(b => b !== bq)
      : [bq, ...bookmarks].slice(0, 10);
    setBookmarks(updated);
    saveBookmarks(updated);
  }

  function openDoc(group, pageNum) {
    const allPages = group.hits.map(h => h.page); // already sorted ascending
    setViewDoc({
      id: group.pdf_id,
      document_name: cleanFilename(group.original_filename),
      original_filename: group.original_filename,
      _initialPage: pageNum,
      _searchQuery: query,
      _searchPages: allPages,
    });
    onAuditLog?.(`Viewed: ${group.original_filename}`);
  }

  function openRecentDoc(doc) {
    setViewDoc({ id: doc.id, document_name: doc.document_name || cleanFilename(doc.original_filename), original_filename: doc.original_filename });
    onAuditLog?.(`Viewed: ${doc.document_name || doc.original_filename}`);
  }

  const isBookmarked = bookmarks.includes(query.trim());
  const suggestions  = QUICK_SEARCHES.filter(s => s.includes(query.toLowerCase()) && query.length >= 2);

  // ── Home page ─────────────────────────────────────────────────────────────
  if (activePage === 'home') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} initialPage={viewDoc._initialPage || 1} searchQuery={viewDoc._searchQuery || null} searchPages={viewDoc._searchPages || null} />}

        {/* Hero */}
        <div style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(26,86,219,.08) 0%, rgba(124,58,237,.05) 100%)', border: '1px solid rgba(26,86,219,.14)', padding: '36px 32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 6, letterSpacing: '-.01em' }}>
            Haryana Legal Knowledge System
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-color-secondary)', marginBottom: 24, maxWidth: 460, margin: '0 auto 24px' }}>
            Search and access published acts, notifications, policies, and circulars.
          </div>

          {/* Inline search */}
          <div style={{ display: 'flex', maxWidth: 580, margin: '0 auto', background: 'var(--surface-card)', border: '1.5px solid var(--surface-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(26,86,219,.1)' }}>
            <span style={{ padding: '0 14px', display: 'flex', alignItems: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
              <Search size={16} />
            </span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
              placeholder="Search legal documents, acts, keywords…"
              style={{ flex: 1, padding: '14px 0', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font)', fontSize: 14, color: 'var(--text-color)' }}
            />
            <button
              onClick={() => doSearch()}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 26px', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}
            >
              Search
            </button>
          </div>

          {/* Quick search chips */}
          <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {QUICK_SEARCHES.slice(0, 6).map(s => (
              <button key={s} onClick={() => doSearch(s)}
                style={{ background: 'rgba(255,255,255,.7)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.color = 'var(--text-color-secondary)'; }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Document type tiles */}
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 10 }}>Browse by Document Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {Object.entries(DOC_TYPE_META).map(([type, meta]) => (
              <button key={type} onClick={() => doSearch(type)}
                style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${meta.bg}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>{type.toUpperCase()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recently published */}
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>Recently Published</div>
          {recentLoading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>Loading…</div>
          ) : recentDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>No documents found.</div>
          ) : (
            <div>
              {recentDocs.map((doc, i) => {
                const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
                return (
                  <div key={doc.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 6px', borderBottom: i < recentDocs.length - 1 ? '1px solid var(--surface-border)' : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background .12s' }}
                    onClick={() => openRecentDoc(doc)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <FileText size={14} color="var(--text-color-secondary)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.document_name || doc.original_filename}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>
                        {[doc.department_name, doc.document_type_name].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {meta && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 5, fontFamily: 'var(--mono)', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {doc.document_type_name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Saved searches */}
        {bookmarks.length > 0 && (
          <Card>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookmarkCheck size={14} color="var(--primary)" /> Saved Searches
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

  // ── Search page ───────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} initialPage={viewDoc._initialPage || 1} searchQuery={viewDoc._searchQuery || null} searchPages={viewDoc._searchPages || null} />}

      {/* Search bar card */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 3 }}>Search Legal Documents</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 16 }}>
          Full-text search across all published documents — results include verbatim excerpts.
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Input wrapper */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, maxWidth: 700, transition: 'border-color .2s', position: 'relative' }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--surface-border)'}>
              <span style={{ padding: '0 12px', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Search size={15} /></span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSugg(true); }}
                onKeyDown={e => { if (e.key === 'Enter') doSearch(); if (e.key === 'Escape') setShowSugg(false); }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="Search by act name, keyword, or phrase…"
                style={{ flex: 1, padding: '11px 0', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font)', fontSize: 13.5, color: 'var(--text-color)' }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setShowSugg(false); inputRef.current?.focus(); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 8px', color: 'var(--text-color-secondary)', display: 'flex' }}>
                  <X size={13} />
                </button>
              )}
              <button onClick={() => doSearch()}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 22px', margin: 4, borderRadius: 6, fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                Search
              </button>

              {/* Autocomplete dropdown */}
              {showSugg && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: 'var(--card-shadow)', zIndex: 100, overflow: 'hidden' }}>
                  {suggestions.slice(0, 5).map((s, i, arr) => (
                    <div key={i} onMouseDown={() => doSearch(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--surface-border)' : 'none', fontSize: 13, color: 'var(--text-color)', transition: 'background .12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Search size={12} color="var(--text-color-secondary)" /> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmark button */}
            {query && searched && (
              <button onClick={() => toggleBookmark(query.trim())}
                title={isBookmarked ? 'Remove bookmark' : 'Save this search'}
                style={{ background: isBookmarked ? 'rgba(26,86,219,.1)' : 'var(--surface-card)', border: `1px solid ${isBookmarked ? 'rgba(26,86,219,.3)' : 'var(--surface-border)'}`, color: isBookmarked ? 'var(--primary)' : 'var(--text-color-secondary)', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font)', transition: 'all .2s' }}>
                {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                {isBookmarked ? 'Saved' : 'Save'}
              </button>
            )}

            {searched && (
              <button onClick={clearSearch}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '10px 16px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Saved searches quick-access */}
        {bookmarks.length > 0 && !searched && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ ...LABEL, marginBottom: 8 }}>Saved Searches</div>
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
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ display: 'inline-flex', gap: 6, marginBottom: 12 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: `bounce .8s ease-in-out ${i * .12}s infinite` }} />
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Searching documents…</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card style={{ textAlign: 'center', padding: '48px 0' }}>
          <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 5 }}>Search Error</div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{error}</div>
        </Card>
      )}

      {/* Results */}
      {!loading && searched && !error && (
        <>
          {(() => {
            const groups = groupResults(results);
            return (
              <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 14, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  <strong style={{ color: 'var(--primary)' }}>{groups.length}</strong> document{groups.length !== 1 ? 's' : ''}
                  {total > groups.length && <> · <strong style={{ color: 'var(--primary)' }}>{total}</strong> total matches</>}
                  {query && <> for <em style={{ color: 'var(--text-heading)', fontStyle: 'normal' }}>"{query}"</em></>}
                </span>
                <span style={{ fontSize: 11 }}>Verbatim excerpts · No AI-generated text</span>
              </div>
            );
          })()}

          {results.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '72px 0' }}>
              <Search size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>No results found</div>
              <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Try different keywords or a shorter phrase</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupResults(results).map(group => (
                <GroupedResultCard
                  key={group.pdf_id}
                  group={group}
                  query={query}
                  onView={pageNum => openDoc(group, pageNum)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty / landing state */}
      {!loading && !searched && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: '52px 0 24px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Search size={28} color="var(--primary)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>Find Legal Documents</div>
            <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
              Enter keywords, act names, or phrases to search across all published legal documents.
            </div>
          </div>

          <Card>
            <div style={{ ...LABEL, marginBottom: 12 }}>Popular Searches</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_SEARCHES.map(s => (
                <button key={s} onClick={() => doSearch(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color)', padding: '7px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(26,86,219,.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.background = 'var(--surface-ground)'; }}>
                  <Search size={11} color="var(--text-color-secondary)" /> {s}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ ...LABEL, marginBottom: 12 }}>Browse by Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {Object.entries(DOC_TYPE_META).map(([type, meta]) => (
                <button key={type} onClick={() => doSearch(type)}
                  style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 8, padding: '12px 10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'transform .15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>{type}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
