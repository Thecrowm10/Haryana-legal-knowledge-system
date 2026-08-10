import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, FileText, X, BookOpen, Bookmark, BookmarkCheck,
  ChevronRight, ChevronDown, AlertCircle, Building2, Layers, User, Sparkles,
} from 'lucide-react';
import Card from '../components/ui/Card';
import DocViewModal from '../components/DocViewModal';
import ActContentsView from '../components/ActContentsView';
import AccessibilityMenu from '../components/AccessibilityMenu';
import LanguageToggle from '../components/LanguageToggle';
import Footer from '../components/layout/Footer';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import { publicSearchDocuments, publicSemanticSearch } from '../services/pdf';
import { getDocumentTypes } from '../services/departments';
import { DOC_TYPE_META } from '../constants/docTypeMeta';
import { cleanFilename, mapPublicDocForViewer } from '../utils/mapPublicDoc';

const QUICK_SEARCHES = [
  'right to information', 'land revenue', 'municipal corporation',
  'panchayati raj', 'right to service', 'shops establishments',
  'property tax', 'building regulations', 'labour welfare',
];

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};

const TOP_BAR_HEIGHT = 60;
const TOP_BAR_EASE = '.4s cubic-bezier(.22,1,.36,1)';

const topBarIconBase = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
  transition: `background ${TOP_BAR_EASE}, border-color ${TOP_BAR_EASE}, color ${TOP_BAR_EASE}`,
};
// Dark-glass style — used while the top bar is still transparent over the hero image.
const topBarIconStyleDark  = { ...topBarIconBase, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.85)' };
// Light style — used once the bar solidifies white on scroll.
const topBarIconStyleLight = { ...topBarIconBase, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', color: 'var(--text-color)' };

// The semantic-search endpoint returns one row per matched *page/chunk*, so the
// same document can appear several times (e.g. 5 different pages of the same Act).
// Groups those rows into one card per document, keeping every matched page number
// (fed to DocViewModal as searchPages for its existing "Match X of Y · p.N" nav)
// and surfacing the highest-scoring page's snippet as the card's preview text.
function groupSemanticSources(sources) {
  const byId = new Map();
  for (const s of sources) {
    const existing = byId.get(s.pdf_id);
    if (!existing) {
      byId.set(s.pdf_id, {
        id:                  s.pdf_id,
        document_name:       s.document_name,
        document_type_name:  s.document_type,
        department_name:     s.department,
        description:         s.snippet,
        file_url:            s.file_url,
        _pages:              [s.page_number],
        _bestPage:           s.page_number,
        _bestScore:          s.relevance_score,
      });
    } else {
      existing._pages.push(s.page_number);
      if (s.relevance_score > existing._bestScore) {
        existing._bestScore  = s.relevance_score;
        existing._bestPage   = s.page_number;
        existing.description = s.snippet;
      }
    }
  }
  return [...byId.values()]
    .map(d => ({ ...d, _pages: [...new Set(d._pages)].sort((a, b) => a - b) }))
    .sort((a, b) => b._bestScore - a._bestScore);
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

// One card per document — the public search endpoint returns full document
// records (not per-page text hits), so there's no grouping or page-chip
// navigation needed here anymore; each result opens straight to the viewer.
function DocumentResultCard({ doc, query, onView }) {
  const { t } = useTranslation('citizen');
  const name = doc.document_name || cleanFilename(doc.original_filename);
  const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
  const year = doc.issue_date ? new Date(doc.issue_date).getFullYear() : (doc.created_at ? new Date(doc.created_at).getFullYear() : null);

  return (
    <div
      onClick={onView}
      style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'box-shadow .2s, border-color .2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = 'rgba(33, 74, 171,.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: meta?.bg || 'rgba(33, 74, 171,.08)', border: `1px solid ${meta?.border || 'rgba(33, 74, 171,.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={16} color={meta?.color || 'var(--primary)'} strokeWidth={1.5} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.35, marginBottom: 6 }}>
            <HighlightedSnippet text={name} query={query} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {doc.document_type_name && (
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 5, fontFamily: 'var(--mono)', letterSpacing: '.04em', textTransform: 'uppercase', background: meta?.bg || 'rgba(100,116,139,.08)', color: meta?.color || '#64748b', border: `1px solid ${meta?.border || 'rgba(100,116,139,.25)'}` }}>
                {doc.document_type_name}
              </span>
            )}
            {doc.department_name && (
              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>{doc.department_name}</span>
            )}
            {year && (
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{year}</span>
            )}
            {doc._pages?.length > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 20 }}>
                {t('matchedPagesSuffix', { count: doc._pages.length })} · p.{doc._bestPage}
              </span>
            )}
          </div>

          {doc.description && (
            <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-color)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              <HighlightedSnippet text={doc.description} query={query} />
            </div>
          )}
        </div>

        <button
          onClick={e => { e.stopPropagation(); onView(); }}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'opacity .15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <BookOpen size={13} /> {t('view')}
        </button>
      </div>
    </div>
  );
}

export default function CitizenDashboard({ onAuditLog, documents = [], onLoginAsOfficer }) {
  const { t } = useTranslation('citizen');
  const { t: tLogin, i18n } = useTranslation('login');
  const orgNameHi = i18n.getFixedT('hi', 'login')('orgNamePortal');
  const orgNameEn = i18n.getFixedT('en', 'login')('orgNamePortal');
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [answer, setAnswer]         = useState(null); // AI answer text from the Search button's semantic search
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState(null);
  const [viewDoc, setViewDoc]       = useState(null);
  const [viewActLanding, setViewActLanding] = useState(null);
  const [bookmarks, setBookmarks]   = useState(loadBookmarks);
  const [showSugg, setShowSugg]     = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState([]); // documents from /pdf/public/search, live as you type
  const [suggestLoading, setSuggestLoading]   = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [searchBarHeight, setSearchBarHeight] = useState(0);
  const [docTypes, setDocTypes]     = useState([]); // [{ id, name }] — live list; falls back to DOC_TYPE_META names if the endpoint needs auth
  const [docTypeId, setDocTypeId]   = useState(''); // selected filter — '' means search across all types
  const [statsPublished, setStatsPublished] = useState(0);
  const [statsDepts, setStatsDepts]         = useState(0);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const searchBoxRef = useRef(null);

  // Document types for the search filter dropdown
  useEffect(() => {
    getDocumentTypes().then(res => setDocTypes(res.data || [])).catch(() => {});
  }, []);

  const typeOptions = docTypes.length > 0 ? docTypes : Object.keys(DOC_TYPE_META).map(name => ({ id: '', name }));

  // Fetch recently published docs + derive stats in one call
  useEffect(() => {
    setRecentLoading(true);
    publicSearchDocuments({ skip: 0, limit: 200 })
      .then(res => {
        const docs = res.data.documents || [];
        setRecentDocs(docs.slice(0, 8));
        if (res.data.total != null) setStatsPublished(res.data.total);
        setStatsDepts(new Set(docs.map(d => d.department_name).filter(Boolean)).size);
      })
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, []);

  // The compact top bar takes over the exact moment the hero's own search box
  // scrolls behind it, and hands back the moment it scrolls back into view —
  // checked directly against the anchor's live position on every scroll tick
  // (rAF-throttled) so it's symmetric in both directions. Layout.jsx scrolls
  // its <main> wrapper, not the window, so that's what we listen on.
  useEffect(() => {
    const target = document.getElementById('citizen-search');
    if (!target) return;
    const scrollEl = rootRef.current?.closest('main') || window;
    let ticking = false;
    const check = () => {
      setScrolled(target.getBoundingClientRect().top < TOP_BAR_HEIGHT);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    };
    check();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  // Live suggestions — same public search endpoint as the Search button, just
  // debounced and capped small so it reads as autocomplete while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setLiveSuggestions([]); setSuggestLoading(false); return; }
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      publicSearchDocuments({ name: q, document_type_id: docTypeId || undefined, skip: 0, limit: 8 })
        .then(res => setLiveSuggestions(res.data.documents || []))
        .catch(() => setLiveSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, docTypeId]);

  // Measured once, at natural (undocked) size, so the anchor above can reserve
  // exactly that much space once the real search box goes fixed and docks.
  useEffect(() => {
    if (searchBoxRef.current) setSearchBarHeight(searchBoxRef.current.getBoundingClientRect().height);
  }, []);

  async function doSearch(q = query) {
    const trimmed = (q || '').trim();
    if (trimmed.length < 5) return; // matches the semantic-search endpoint's minLength on `q`
    setQuery(trimmed);
    setShowSugg(false);
    setLoading(true);
    setSearched(false);
    setError(null);
    setAnswer(null);
    try {
      const res = await publicSemanticSearch(trimmed);
      const grouped = groupSemanticSources(res.data.sources || []);
      setResults(grouped);
      setTotal(grouped.length);
      setAnswer(res.data.answer || null);
      onAuditLog?.(`Searched: "${trimmed}"`);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function clearSearch() {
    setQuery(''); setResults([]); setTotal(0); setAnswer(null);
    setSearched(false); setError(null); setViewDoc(null);
  }

  function toggleBookmark(bq) {
    const updated = bookmarks.includes(bq)
      ? bookmarks.filter(b => b !== bq)
      : [bq, ...bookmarks].slice(0, 10);
    setBookmarks(updated);
    saveBookmarks(updated);
  }

  function openDoc(doc) {
    const mapped = mapPublicDocForViewer(doc);
    // Semantic search results carry which page(s) matched — jump straight to the
    // best one and let DocViewModal's existing "Match X of Y · p.N" nav step
    // through the rest, same mechanism it already supports for any doc.
    if (doc._pages) {
      mapped._initialPage = doc._bestPage || doc._pages[0];
      mapped._searchQuery = query;
      mapped._searchPages = doc._pages;
      setViewDoc(mapped);
    } else if (mapped.type === 'Act') {
      // A direct browse click (not "show me where my search term matched")
      // on an Act lands on the reading view first, not the raw PDF — the PDF
      // stays one click away via that view's "View Original PDF" action.
      setViewActLanding(mapped);
    } else {
      setViewDoc(mapped);
    }
    onAuditLog?.(`Viewed: ${doc.document_name || doc.original_filename}`);
  }

  const isBookmarked = bookmarks.includes(query.trim());

  const publishedCount = statsPublished;
  const deptCount      = statsDepts;
  const typeCount      = docTypes.length;

  return (
    <div ref={rootRef} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeSlideIn .3s ease', overflowX: 'hidden' }}>
      <style>{`
        @media (max-width: 640px) {
          .cd-topbar { padding: 0 16px !important; gap: 8px !important; }
          .cd-actions { gap: 6px !important; }
          .cd-skip, .cd-skip-divider { display: none !important; }
          .cd-brand-text { display: none !important; }
          .cd-docked-search {
            left: 54px !important; right: 118px !important;
            transform: none !important; width: auto !important; max-width: none !important;
          }
          .cd-hero { padding: ${TOP_BAR_HEIGHT}px 16px 32px !important; }
          .cd-search-btn { padding: 0 14px !important; font-size: 12px !important; }
          .cd-stats-outer { padding: 0 16px !important; }
          .cd-stats-grid { grid-template-columns: 1fr !important; }
          .cd-stat-item { padding: 16px 18px !important; border-right: none !important; }
          .cd-stat-item:not(:last-child) { border-bottom: 1px solid var(--surface-border); }
          .cd-content { padding: 20px 16px 32px !important; }
          .cd-masthead { top: 10px !important; left: 14px !important; gap: 8px !important; }
          .cd-masthead-logo { width: 44px !important; height: 44px !important; }
          .cd-masthead-text { transform: none !important; }
          .cd-masthead-hi { display: none !important; }
          .cd-masthead-en { font-size: 13px !important; white-space: normal !important; max-width: 150px; line-height: 1.2 !important; }
        }
        @media (max-width: 380px) {
          .cd-masthead-logo { width: 36px !important; height: 36px !important; }
          .cd-masthead-en { font-size: 11.5px !important; max-width: 120px; }
        }
        @media (min-width: 641px) {
          .cd-stat-item:not(:last-child) { border-right: 1px solid var(--surface-border); }
        }
      `}</style>

      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} initialPage={viewDoc._initialPage || 1} searchQuery={viewDoc._searchQuery || null} searchPages={viewDoc._searchPages || null} />}
      {viewActLanding && (
        <ActContentsView doc={viewActLanding} onClose={() => setViewActLanding(null)}
          onViewPdf={() => { setViewDoc(viewActLanding); setViewActLanding(null); }} />
      )}

      {/* Top bar — transparent/blended into the hero image at rest, solidifies on scroll.
          The search box itself (below, in the hero) docks fixed underneath this bar once
          scrolled — it is the SAME element, not a duplicate, so it visually detaches and
          re-attaches rather than one fading while another pops in elsewhere. */}
      <div className="cd-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: TOP_BAR_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '0 32px',
        background: scrolled ? 'linear-gradient(180deg, #ffffff 0%, #f5f7f9 100%)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--surface-border)' : '1px solid transparent',
        boxShadow: scrolled ? '0 6px 24px rgba(15,23,42,.10)' : 'none',
        transition: `background ${TOP_BAR_EASE}, box-shadow ${TOP_BAR_EASE}, border-color ${TOP_BAR_EASE}`,
      }}>
        {/* Condensed brand — only surfaces once the hero (with the full logo/title) has scrolled out of view */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
          opacity: scrolled ? 1 : 0, transform: scrolled ? 'translateY(0)' : 'translateY(-8px)',
          transition: `opacity ${TOP_BAR_EASE}, transform ${TOP_BAR_EASE}`,
        }}>
          <img src={haryanaLogo} alt="Haryana Government" loading="lazy" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <div className="cd-brand-text" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.15 }}>{t('brandSubtitle')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-color-secondary)', lineHeight: 1.15 }}>{t('brandTitle')}</div>
          </div>
        </div>

        <div className="cd-actions" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="#citizen-search" className="cd-skip"
            style={{
              color: scrolled ? 'var(--text-color)' : 'rgba(255,255,255,.8)', fontSize: 12, fontFamily: 'var(--font)',
              textDecoration: 'none', padding: '5px 8px', margin: '-5px -8px', borderRadius: 6, background: 'transparent',
              transition: `color ${TOP_BAR_EASE}, background .15s`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(120,128,140,.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {t('skipToMainContent')}
          </a>
          <span aria-hidden="true" className="cd-skip-divider" style={{ width: 1, height: 16, background: scrolled ? 'var(--surface-border)' : 'rgba(255,255,255,.2)', transition: `background ${TOP_BAR_EASE}` }} />
          <LanguageToggle iconOnly buttonStyle={scrolled ? topBarIconStyleLight : topBarIconStyleDark} />
          <AccessibilityMenu iconButtonStyle={scrolled ? topBarIconStyleLight : topBarIconStyleDark} />

          {/* Switch to official login — replaces the plain "Exit Guest Mode" button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setLoginMenuOpen(o => !o)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(120,128,140,.3)'}
              onMouseLeave={e => e.currentTarget.style.background = (scrolled ? topBarIconStyleLight : topBarIconStyleDark).background}
              aria-label={t('profileLogin')}
              aria-expanded={loginMenuOpen}
              title={t('profileLogin')}
              style={{ transition: 'background .15s', ...(scrolled ? topBarIconStyleLight : topBarIconStyleDark) }}
            >
              <User size={16} />
            </button>

            {loginMenuOpen && (
              <>
                <div onClick={() => setLoginMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60, width: 200,
                  background: 'var(--surface-card)', color: 'var(--text-color)',
                  border: '1px solid var(--surface-border)', borderRadius: 12,
                  boxShadow: '0 16px 40px rgba(0,0,0,.3)', overflow: 'hidden',
                  animation: 'fadeSlideIn .15s ease',
                }}>
                  <button
                    type="button"
                    onClick={() => { setLoginMenuOpen(false); onLoginAsOfficer?.(); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, color: 'var(--text-color)', fontFamily: 'var(--font)', transition: 'background .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <User size={14} color="var(--primary)" /> {t('loginAsOfficer')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero — full-bleed banner photo, same asset as the login screen */}
      <div className="cd-hero" style={{ position: 'relative', overflow: 'hidden', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `${TOP_BAR_HEIGHT}px 32px 40px`, textAlign: 'center' }}>
        <img src={bannerBg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'blur(2px)', transform: 'scale(1.02)' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(110deg, rgba(2,10,5,.82) 0%, rgba(2,10,5,.62) 45%, rgba(2,10,5,.42) 100%)' }} />

        {/* Masthead — absolute top-left, matches the Login portal screen style; fades out on scroll
            since the condensed topbar brand takes over at that point */}
        <div className="cd-masthead" style={{
          position: 'absolute', top: 14, left: 32, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 14, maxWidth: 'calc(100vw - 64px)',
          opacity: scrolled ? 0 : 1, pointerEvents: scrolled ? 'none' : 'auto',
          transition: `opacity ${TOP_BAR_EASE}`,
        }}>
          <img src={haryanaLogo} alt="Haryana" loading="lazy" className="cd-masthead-logo"
            style={{ width: 100, height: 100, objectFit: 'contain', flexShrink: 0 }} />
          <div className="cd-masthead-text" style={{ display: 'flex', flexDirection: 'column', gap: 1, whiteSpace: 'nowrap', transform: 'translateY(12px)', minWidth: 0, textAlign: 'left' }}>
            <span className="cd-masthead-hi" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.62)', letterSpacing: '.01em' }}>{orgNameHi}</span>
            <span className="cd-masthead-en" style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.01em' }}>{orgNameEn}</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: 'clamp(24px, 3.2vw, 42px)', fontWeight: 800, color: '#fff', lineHeight: 1.18, letterSpacing: '-.02em', marginBottom: 12 }}>
            {tLogin('orgNameBrand')}<br />
            <span style={{ color: '#4ade80' }}>{tLogin('tagline')}</span>
          </h1>
          <div style={{ fontSize: 'clamp(13px, 3vw, 16px)', color: 'rgba(255,255,255,.72)', marginBottom: 26, maxWidth: 520, margin: '0 auto 26px' }}>
            {t('heroSubtitle')}
          </div>

          {/* Search bar — the same element docks fixed inside the top bar itself once scrolled
              past it (no gap below the bar), and returns to its normal size/position here
              once scrolled back up. */}
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Stable anchor: never moves, so it's a safe scroll-position reference for the
                IntersectionObserver above; also reserves the docked bar's vacated space so
                nothing below jumps. Skip-to-content also lands here. */}
            <div id="citizen-search" style={{ height: scrolled ? searchBarHeight : 0, scrollMarginTop: TOP_BAR_HEIGHT + 16 }} />

            {(() => {
              const inner = (
                <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', width: '100%', background: '#fff', border: '1.5px solid transparent',
                    borderRadius: scrolled ? 10 : 12, overflow: 'hidden',
                    boxShadow: scrolled ? '0 8px 28px rgba(0,0,0,.16)' : '0 12px 40px rgba(0,0,0,.35)',
                    transition: `border-radius ${TOP_BAR_EASE}, box-shadow ${TOP_BAR_EASE}`,
                  }}
                    onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onBlurCapture={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <span style={{
                      padding: scrolled ? '0 10px' : '0 14px', display: 'flex', alignItems: 'center',
                      color: 'var(--text-color-secondary)', flexShrink: 0,
                    }}>
                      <Search size={scrolled ? 14 : 18} />
                    </span>
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={e => { setQuery(e.target.value); setShowSugg(true); }}
                      onKeyDown={e => { if (e.key === 'Enter') doSearch(); if (e.key === 'Escape') setShowSugg(false); }}
                      onFocus={() => setShowSugg(true)}
                      onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                      placeholder={t('searchPlaceholder')}
                      style={{
                        flex: 1, minWidth: 0, padding: scrolled ? '9px 0' : '18px 0', background: 'transparent', border: 'none', outline: 'none',
                        fontFamily: 'var(--font)', fontSize: scrolled ? 13 : 16, color: 'var(--text-color)',
                      }}
                    />
                    {query && (
                      <button onClick={() => { setQuery(''); setShowSugg(false); inputRef.current?.focus(); }}
                        style={{ alignSelf: 'stretch', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 8px', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    )}
                    <div className="cd-type-pill" style={{
                      position: 'relative', alignSelf: 'stretch', display: 'flex', alignItems: 'center',
                      margin: scrolled ? '5px 5px 5px 0' : '9px 9px 9px 0',
                      background: 'rgba(148,163,184,.12)',
                      backdropFilter: 'blur(10px) saturate(180%)', WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                      border: '1px solid rgba(255,255,255,.7)',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,.8), 0 1px 2px rgba(15,23,42,.05)',
                      borderRadius: scrolled ? 8 : 10,
                      flexShrink: 0,
                    }}>
                      <Layers size={scrolled ? 12 : 14} color="var(--text-color-secondary)"
                        style={{ marginLeft: scrolled ? 8 : 11, flexShrink: 0, pointerEvents: 'none' }} />
                      <select
                        value={docTypeId}
                        onChange={e => setDocTypeId(e.target.value)}
                        title={t('allTypes')}
                        style={{
                          alignSelf: 'stretch', border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer',
                          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                          fontFamily: 'var(--font)', color: docTypeId ? 'var(--text-heading)' : 'var(--text-color-secondary)',
                          fontSize: scrolled ? 11.5 : 13, fontWeight: 600,
                          padding: scrolled ? '0 22px 0 6px' : '0 28px 0 8px', maxWidth: scrolled ? 100 : 160,
                        }}>
                      <option value="">{t('allTypes')}</option>
                      {typeOptions.map(dt => (
                        <option key={dt.id || dt.name} value={dt.id}>{dt.name}</option>
                      ))}
                      </select>
                      <ChevronDown size={scrolled ? 11 : 13} color="var(--text-color-secondary)"
                        style={{ position: 'absolute', right: scrolled ? 7 : 9, pointerEvents: 'none' }} />
                    </div>
                    <button
                      className="cd-search-btn"
                      onClick={() => doSearch()}
                      style={{
                        alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--primary)', color: 'white', border: 'none',
                        padding: scrolled ? '0 16px' : '0 32px', fontFamily: 'var(--font)', fontSize: scrolled ? 11.5 : 14,
                        fontWeight: 700, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0,
                      }}
                    >
                      {t('searchButton')}
                    </button>
                  </div>

                  {/* Live autocomplete — same /pdf/public/search endpoint as the Search button, just
                      debounced; each row is a real document and opens straight into the viewer. */}
                  {showSugg && query.trim().length >= 2 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: 'var(--card-shadow)', zIndex: 100, overflow: 'hidden', textAlign: 'left', maxHeight: 360, overflowY: 'auto' }}>
                      {suggestLoading ? (
                        <div style={{ padding: '16px', fontSize: 12.5, color: 'var(--text-color-secondary)', textAlign: 'center' }}>{t('loading')}</div>
                      ) : liveSuggestions.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: 12.5, color: 'var(--text-color-secondary)', textAlign: 'center' }}>{t('noResultsFound')}</div>
                      ) : (
                        liveSuggestions.map((doc, i, arr) => {
                          const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
                          return (
                            <div key={doc.id} onMouseDown={() => { setShowSugg(false); openDoc(doc); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--surface-border)' : 'none', transition: 'background .12s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <FileText size={14} color={meta?.color || 'var(--primary)'} style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <HighlightedSnippet text={doc.document_name || cleanFilename(doc.original_filename)} query={query} />
                                </div>
                                {(doc.document_type_name || doc.department_name) && (
                                  <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {[doc.document_type_name, doc.department_name].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );

              // Docked: portalled straight to <body> so it truly escapes the hero's
              // overflow:hidden (a position:fixed descendant still gets clipped by any
              // overflow:hidden ancestor's paint bounds, regardless of its containing block).
              if (scrolled) {
                return createPortal(
                  <div ref={searchBoxRef} className="cd-docked-search" style={{
                    position: 'fixed', top: 0, height: TOP_BAR_HEIGHT, display: 'flex', alignItems: 'center',
                    left: '50%', transform: 'translateX(-50%)',
                    width: 'calc(100% - 64px)', maxWidth: 640, zIndex: 55,
                    transition: `max-width ${TOP_BAR_EASE}, width ${TOP_BAR_EASE}`,
                  }}>
                    {inner}
                  </div>,
                  document.body
                );
              }
              return (
                <div ref={searchBoxRef} style={{ position: 'relative', width: '100%', maxWidth: 700 }}>
                  {inner}
                </div>
              );
            })()}

            {/* Save / Clear — only relevant once a search has actually run */}
            {searched && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                {query && (
                  <button onClick={() => toggleBookmark(query.trim())}
                    title={isBookmarked ? t('removeBookmark') : t('saveThisSearch')}
                    style={{ background: isBookmarked ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.08)', border: `1px solid ${isBookmarked ? 'rgba(74,222,128,.35)' : 'rgba(255,255,255,.18)'}`, color: isBookmarked ? '#4ade80' : 'rgba(255,255,255,.7)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, fontFamily: 'var(--font)', transition: 'all .2s' }}>
                    {isBookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    {isBookmarked ? t('saved') : t('save')}
                  </button>
                )}
                <button onClick={clearSearch}
                  style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.7)', padding: '7px 14px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <X size={12} /> {t('clear')}
                </button>
              </div>
            )}

            {/* Quick search chips — only shown before searching, to keep results uncluttered */}
            {!searched && (
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {QUICK_SEARCHES.slice(0, 6).map(s => (
                  <button key={s} onClick={() => doSearch(s)}
                    style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.75)', padding: '7px 17px', borderRadius: 20, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#4ade80'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)'; e.currentTarget.style.color = 'rgba(255,255,255,.75)'; }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats strip — floats up over the hero's bottom edge, like a landing panel */}
      <div className="cd-stats-outer" style={{ padding: '0 32px', marginTop: -32, position: 'relative', zIndex: 3 }}>
        <div className="cd-stats-grid" style={{
          maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: 'var(--surface-card)', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.12)',
          border: '1px solid var(--surface-border)', overflow: 'hidden',
        }}>
          {[
            { label: t('statPublishedDocuments'), value: publishedCount, icon: FileText },
            { label: t('statDepartments'),        value: deptCount,      icon: Building2 },
            { label: t('statDocumentTypes'),      value: typeCount,      icon: Layers },
          ].map(s => (
            <div key={s.label} className="cd-stat-item" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(33, 74, 171,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={20} color="var(--primary)" strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ ...LABEL, fontSize: 11.5, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="cd-content" style={{ flex: 1, padding: '28px 32px 40px', maxWidth: 860, margin: '0 auto', width: '100%' }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ display: 'inline-flex', gap: 6, marginBottom: 12 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: `bounce .8s ease-in-out ${i * .12}s infinite` }} />
              ))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('searchingDocuments')}</div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <Card style={{ textAlign: 'center', padding: '48px 0' }}>
            <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 5 }}>{t('searchError')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('searchFailed')}</div>
          </Card>
        )}

        {/* Results */}
        {!loading && searched && !error && (
          <>
            {answer && (
              <Card style={{ marginBottom: 16, borderLeft: '3px solid var(--primary)' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles size={16} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: 'var(--mono)' }}>
                      {t('aiAnswerLabel')}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-color)', whiteSpace: 'pre-line' }}>
                      {answer}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 10 }}>
                      {t('aiAnswerDisclaimer')}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 14, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                <strong style={{ color: 'var(--primary)' }}>{results.length}</strong> {t('documentsSuffix', { count: results.length })}
                {total > results.length && <> · <strong style={{ color: 'var(--primary)' }}>{total}</strong> {t('totalMatchesSuffix', { count: total })}</>}
                {query && <> {t('forQuery')} <em style={{ color: 'var(--text-heading)', fontStyle: 'normal' }}>"{query}"</em></>}
              </span>
            </div>

            {results.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '72px 0' }}>
                <Search size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>{t('noResultsFound')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('tryDifferentKeywords')}</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map(doc => (
                  <DocumentResultCard
                    key={doc.id}
                    doc={doc}
                    query={query}
                    onView={() => openDoc(doc)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Idle state — Recently Published */}
        {!loading && !searched && (
          <Card>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>{t('recentlyPublished')}</div>
            {recentLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('loading')}</div>
            ) : recentDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('noDocumentsFound')}</div>
            ) : (
              <div>
                {recentDocs.map((doc, i) => {
                  const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
                  return (
                    <div key={doc.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 6px', borderBottom: i < recentDocs.length - 1 ? '1px solid var(--surface-border)' : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background .12s' }}
                      onClick={() => openDoc(doc)}
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
        )}

        {/* Saved searches quick-access — only when idle and there's something saved */}
        {!loading && !searched && bookmarks.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LABEL }}>{t('savedLabel')}</span>
            {bookmarks.map(bm => (
              <button key={bm} onClick={() => doSearch(bm)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color)', padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                <BookmarkCheck size={11} color="var(--primary)" /> {bm} <ChevronRight size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
