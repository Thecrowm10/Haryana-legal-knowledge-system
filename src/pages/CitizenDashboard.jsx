import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, FileText, X, BookOpen, Bookmark, BookmarkCheck,
  ChevronDown, AlertCircle, Layers, User, Sparkles,
  FileEdit, Bell, RefreshCw, Shield, Gavel, Building2, MoreHorizontal,
} from 'lucide-react';
import Card from '../components/ui/Card';
import DocViewModal from '../components/DocViewModal';
import ActContentsView from '../components/ActContentsView';
import AccessibilityMenu from '../components/AccessibilityMenu';
import LanguageToggle from '../components/LanguageToggle';
import Footer from '../components/layout/Footer';
import Pagination from '../components/ui/Pagination';
import haryanaLogo from '../assets/haryana-logo.png';
import bannerBg from '../assets/banner-1-768x217.png';
import { publicSearchDocuments, publicSemanticSearch, getCitizenDocuments } from '../services/pdf';
import { getDocumentTypes, getCitizenDepartments } from '../services/departments';
import { DOC_TYPE_META } from '../constants/docTypeMeta';
import { cleanFilename, mapPublicDocForViewer } from '../utils/mapPublicDoc';

// Displayed above the search results — capitalizes the first letter and adds a trailing "?"
// only when the user didn't already end their own query with one.
function formatAsQuestion(q) {
  if (!q) return q;
  const trimmed = q.trim();
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capitalized.endsWith('?') ? capitalized : `${capitalized}?`;
}

// One icon per document type for the browse-table's type strip below — mirrors DOC_TYPE_META's
// colour keys so a type reads the same way (icon + colour) everywhere in the citizen-facing UI.
const TYPE_ICON_MAP = {
  'Act': BookOpen, 'Amendment': FileEdit, 'Notification': Bell, 'Circular': RefreshCw,
  'Policy': Shield, 'Rules & Regulations': Gavel, 'Order/Gazette': FileText,
  'Bye Laws': Building2, 'Miscellaneous': MoreHorizontal,
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

export default function CitizenDashboard({ onAuditLog, documents = [], onLoginAsOfficer }) {
  const { t } = useTranslation('citizen');
  const { t: tLogin, i18n } = useTranslation('login');
  const orgNameHi = i18n.getFixedT('hi', 'login')('orgNamePortal');
  const orgNameEn = i18n.getFixedT('en', 'login')('orgNamePortal');
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [query, setQuery]           = useState('');
  const [confirmedQuery, setConfirmedQuery] = useState(''); // the term actually searched — shown below the search bar, which clears itself once a search runs
  const [results, setResults]       = useState([]);
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
  const [searchRect, setSearchRect] = useState(null); // live bounding rect of the undocked search bar, for portaling its suggestions dropdown
  const [docTypes, setDocTypes]     = useState([]); // [{ id, name }] — live list; falls back to DOC_TYPE_META names if the endpoint needs auth
  const [docTypeId, setDocTypeId]   = useState(''); // selected filter — '' means search across all types
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const searchBoxRef = useRef(null);
  const typePillRef = useRef(null);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [typePillRect, setTypePillRect] = useState(null); // live rect of the type-select trigger, for its portaled glass dropdown
  const [browseTypeDropdownOpen, setBrowseTypeDropdownOpen] = useState(false); // mobile/tablet-only stand-in for the type strip below

  // ── Browse-all-documents table (idle-state, replaces the old stat tiles) ──
  const [departments, setDepartments] = useState([]); // [{ id, name }] for the browse table's department dropdown
  const [browseTypeId, setBrowseTypeId] = useState(''); // selected type-count chip — '' means all types
  const [browseDeptId, setBrowseDeptId] = useState(''); // selected department in the browse table's dropdown — '' means all departments
  const [browsePage, setBrowsePage]   = useState(1);
  const [browseDocs, setBrowseDocs]   = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const BROWSE_PAGE_SIZE = 10;

  // Document types for the search filter dropdown
  useEffect(() => {
    getDocumentTypes().then(res => setDocTypes(res.data || [])).catch(() => {});
  }, []);

  const typeOptions = docTypes.length > 0 ? docTypes : Object.keys(DOC_TYPE_META).map(name => ({ id: '', name }));

  // Departments for the browse table's dropdown — via the dedicated public
  // /citizen/departments endpoint (no token required), not getDepartments()
  // (that one 401s for anonymous citizens). Lists every active department,
  // not just ones with documents already uploaded, which is the correct
  // "browse by department" list for a filter.
  useEffect(() => {
    getCitizenDepartments()
      .then(res => {
        setDepartments((res.data || []).filter(d => d.is_active).map(d => ({ id: d.id, name: d.name })));
      })
      .catch(err => console.error('Failed to load department list for browse filter:', err));
  }, []);

  // Fetch recently published docs — feeds the "Recently Published" panel only.
  // /pdf/public/search has no sort param and its default order isn't by recency
  // (it comes back roughly alphabetical by document_name), so "recent" is done
  // here: pull a larger page, sort by created_at (the upload timestamp) desc,
  // then keep only the newest 5.
  useEffect(() => {
    setRecentLoading(true);
    publicSearchDocuments({ skip: 0, limit: 100 })
      .then(res => {
        const docs = [...(res.data.documents || [])]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        setRecentDocs(docs);
      })
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, []);

  // The browse table itself — refetches on every filter/page change, server-side (skip/limit),
  // rather than paging through a client-side cache — mirrors the Uploader dashboard's Acts table.
  useEffect(() => {
    let cancelled = false;
    // Same documented fetch-on-mount pattern (see the effect above).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowseLoading(true);
    getCitizenDocuments(browseDeptId || undefined, browseTypeId || undefined, (browsePage - 1) * BROWSE_PAGE_SIZE, BROWSE_PAGE_SIZE)
      .then(res => {
        if (cancelled) return;
        setBrowseDocs(res.data?.documents || []);
        setBrowseTotal(res.data?.total ?? 0);
      })
      .catch(() => { if (!cancelled) { setBrowseDocs([]); setBrowseTotal(0); } })
      .finally(() => { if (!cancelled) setBrowseLoading(false); });
    return () => { cancelled = true; };
  }, [browseDeptId, browseTypeId, browsePage]);

  // Back to page 1 whenever a filter changes, so Next/Previous always starts from a fresh page 1.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setBrowsePage(1); }, [browseDeptId, browseTypeId]);

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
      // Kept fresh here (not just on open) so the portaled suggestions panel below
      // tracks the search bar's real position while the page is still scrolling
      // and hasn't crossed the docking threshold yet.
      if (searchBoxRef.current) setSearchRect(searchBoxRef.current.getBoundingClientRect());
      if (typePillRef.current) setTypePillRect(typePillRef.current.getBoundingClientRect());
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    };
    check();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { scrollEl.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
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
    setConfirmedQuery(trimmed);
    setQuery(''); // the question already shows below the bar once results are in — no need to leave it sitting in the input too
    setShowSugg(false);
    setLoading(true);
    setSearched(false);
    setError(null);
    setAnswer(null);
    try {
      const res = await publicSemanticSearch(trimmed);
      const grouped = groupSemanticSources(res.data.sources || []);
      setResults(grouped);
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
    setQuery(''); setConfirmedQuery(''); setResults([]); setAnswer(null);
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
    // Semantic search results carry which page(s) matched — this used to jump
    // straight to the raw PDF (best-matching page pre-highlighted, using
    // DocViewModal's "Match X of Y · p.N" nav) instead of the details/contents
    // view. Left here commented out rather than deleted, in case that
    // highlighted-jump behaviour is wanted back later.
    // if (doc._pages) {
    //   mapped._initialPage = doc._bestPage || doc._pages[0];
    //   mapped._searchQuery = query;
    //   mapped._searchPages = doc._pages;
    //   setViewDoc(mapped);
    // } else {
    // Every citizen click — a search result's "View" or a direct browse —
    // lands on the details/contents view first, never straight into the raw
    // PDF, so search results show "saari info" (summary, document details,
    // related docs, sections) the same way direct browsing already does. The
    // PDF itself stays one click away via that view's "View Original PDF"/
    // "Download PDF" action (or its own CTA when there's nothing else to show).
    setViewActLanding(mapped);
    // }
    onAuditLog?.(`Viewed: ${doc.document_name || doc.original_filename}`);
  }

  const isBookmarked = bookmarks.includes(confirmedQuery);

  return (
    <div ref={rootRef} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeSlideIn .3s ease', overflowX: 'hidden' }}>
      <style>{`
        /* One unified highlight around the whole search bar when any part of it
           (input, type dropdown, or a button inside it) has focus — not each
           sub-control drawing its own separate default outline, which read as
           several mismatched borders instead of one. */
        .cd-search-bar { transition: border-color .15s, box-shadow .15s; }
        .cd-search-bar:focus-within {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px rgba(33, 74, 171,.16) !important;
        }
        .cd-search-bar :focus-visible { outline: none !important; }
        /* Thin, subtle scrollbar for the glass type-dropdown — the default OS scrollbar is a
           thick flat-grey bar that clashes with the frosted/rounded look. */
        .cd-type-dropdown-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.4) transparent; }
        .cd-type-dropdown-scroll::-webkit-scrollbar { width: 6px; }
        .cd-type-dropdown-scroll::-webkit-scrollbar-track { background: transparent; }
        .cd-type-dropdown-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,.4); border-radius: 10px; }
        .cd-type-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,.6); }
        @media (max-width: 1024px) {
          /* The type strip's cells shrink to always fit one row, but that means
             tiny icons/labels on tablet and phone widths — a dropdown reads better
             there than a squeezed 10-cell strip. */
          .cd-type-strip { display: none !important; }
          .cd-type-dropdown-mobile { display: block !important; }
        }
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
          .cd-content { padding: 20px 16px 32px !important; }
          .cd-browse-grid { grid-template-columns: 1fr !important; }
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
      `}</style>

      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} initialPage={viewDoc._initialPage || 1} searchQuery={viewDoc._searchQuery || null} searchPages={viewDoc._searchPages || null} citizenView />}
      {viewActLanding && (
        <ActContentsView doc={viewActLanding} onClose={() => setViewActLanding(null)} citizenView
          onLoginAsOfficer={onLoginAsOfficer} />
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
      <div className="cd-hero" style={{ position: 'relative', overflow: 'hidden', minHeight: '75vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `${TOP_BAR_HEIGHT}px 32px 36px`, textAlign: 'center' }}>
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
              const suggestionsOpen = showSugg && query.trim().length >= 2;

              // Suggestion rows only — the positioning wrapper differs by case (see below),
              // so it's applied by each caller rather than baked in here.
              const suggestionsRows = suggestLoading ? (
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
              );

              // Glass dropdown for the type-select button above — always portaled (see the
              // comment by the trigger button for why), positioned off typePillRect.
              const typeDropdownList = (
                <div className="cd-type-dropdown-scroll" style={{
                  background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,.7)', borderRadius: 12,
                  boxShadow: '0 16px 40px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.7)',
                  padding: 6, maxHeight: 320, overflowY: 'auto',
                }}>
                  <div onMouseDown={() => { setDocTypeId(''); setTypeDropdownOpen(false); }}
                    style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', background: !docTypeId ? 'rgba(33, 74, 171,.12)' : 'transparent', color: !docTypeId ? 'var(--primary)' : 'var(--text-color)' }}
                    onMouseEnter={e => { if (docTypeId) e.currentTarget.style.background = 'rgba(255,255,255,.5)'; }}
                    onMouseLeave={e => { if (docTypeId) e.currentTarget.style.background = 'transparent'; }}>
                    {t('allTypes')}
                  </div>
                  {typeOptions.map(dt => {
                    const isActive = String(docTypeId) === String(dt.id);
                    return (
                      <div key={dt.id || dt.name} onMouseDown={() => { setDocTypeId(dt.id); setTypeDropdownOpen(false); }}
                        style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', background: isActive ? 'rgba(33, 74, 171,.12)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-color)' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.5)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                        {dt.name}
                      </div>
                    );
                  })}
                </div>
              );
              const typeDropdownPortal = typeDropdownOpen && typePillRect && createPortal(
                <div style={{ position: 'fixed', top: typePillRect.bottom + 6, right: window.innerWidth - typePillRect.right, minWidth: 180, zIndex: 210 }}>
                  {typeDropdownList}
                </div>,
                document.body
              );

              const inner = (
                <div style={{ position: 'relative', width: '100%' }}>
                  {/* One seamless bar: icon, input, clear, type-select and the Search button all
                      live inside this single bordered/shadowed container — nothing has its own
                      separate border or background, so there's exactly one outline no matter
                      which part is focused or clicked (see .cd-search-bar:focus-within below). */}
                  <div className="cd-search-bar" style={{
                    display: 'flex', alignItems: 'center', width: '100%', background: '#fff', border: '1.5px solid transparent',
                    borderRadius: scrolled ? 10 : 12, overflow: 'hidden',
                    boxShadow: scrolled ? '0 8px 28px rgba(0,0,0,.16)' : '0 12px 40px rgba(0,0,0,.35)',
                    transition: `border-radius ${TOP_BAR_EASE}, box-shadow ${TOP_BAR_EASE}`,
                  }}>
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
                      borderLeft: '1px solid var(--surface-border)', flexShrink: 0,
                    }}>
                      <Layers size={scrolled ? 12 : 14} color="var(--text-color-secondary)"
                        style={{ marginLeft: scrolled ? 10 : 14, flexShrink: 0, pointerEvents: 'none' }} />
                      {/* A real <select>'s own popup list can't be styled (browsers render it
                          natively) — this is a custom button + glass dropdown instead. It also
                          MUST be portaled (not just for the undocked case, unlike the
                          suggestions dropdown above): cd-search-bar itself has overflow:hidden,
                          which would clip an absolutely-positioned list inside this pill no
                          matter what the scrolled state is. */}
                      <button type="button" ref={typePillRef}
                        onClick={() => setTypeDropdownOpen(o => !o)}
                        onBlur={() => setTimeout(() => setTypeDropdownOpen(false), 150)}
                        title={t('allTypes')}
                        style={{
                          alignSelf: 'stretch', border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer',
                          fontFamily: 'var(--font)', color: docTypeId ? 'var(--text-heading)' : 'var(--text-color-secondary)',
                          fontSize: scrolled ? 11.5 : 13, fontWeight: 600, textAlign: 'left',
                          padding: scrolled ? '0 22px 0 6px' : '0 28px 0 8px', maxWidth: scrolled ? 100 : 160,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                        {docTypeId ? (typeOptions.find(dt => String(dt.id) === String(docTypeId))?.name || t('allTypes')) : t('allTypes')}
                      </button>
                      <ChevronDown size={scrolled ? 11 : 13} color="var(--text-color-secondary)"
                        style={{ position: 'absolute', right: scrolled ? 7 : 9, pointerEvents: 'none', transform: typeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
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

                  {/* Docked case only: the whole box (including this) already lives in a
                      document.body portal (see below), so position:absolute here is safe —
                      it can't get trapped behind anything the way the undocked case can. */}
                  {scrolled && suggestionsOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: 'var(--card-shadow)', zIndex: 100, overflow: 'hidden', textAlign: 'left', maxHeight: 360, overflowY: 'auto' }}>
                      {suggestionsRows}
                    </div>
                  )}
                </div>
              );

              // Docked: portalled straight to <body> so it truly escapes the hero's
              // overflow:hidden (a position:fixed descendant still gets clipped by any
              // overflow:hidden ancestor's paint bounds, regardless of its containing block).
              if (scrolled) {
                return (
                  <>
                    {createPortal(
                      <div ref={searchBoxRef} className="cd-docked-search" style={{
                        position: 'fixed', top: 0, height: TOP_BAR_HEIGHT, display: 'flex', alignItems: 'center',
                        left: '50%', transform: 'translateX(-50%)',
                        width: 'calc(100% - 64px)', maxWidth: 640, zIndex: 55,
                        transition: `max-width ${TOP_BAR_EASE}, width ${TOP_BAR_EASE}`,
                      }}>
                        {inner}
                      </div>,
                      document.body
                    )}
                    {typeDropdownPortal}
                  </>
                );
              }
              return (
                <>
                  <div ref={searchBoxRef} style={{ position: 'relative', width: '100%', maxWidth: 700 }}>
                    {inner}
                  </div>
                  {typeDropdownPortal}
                  {/* Undocked case: the search bar itself still renders inline inside the hero
                      (position stays exactly where it's always been), but its suggestions
                      dropdown is portaled to <body> and given position:fixed here — the hero's
                      overflow:hidden + the type-strip's z-index below it otherwise trap an
                      absolutely-positioned dropdown behind the strip, no matter how high its
                      own z-index is set (a positioned ancestor's stacking context always wins
                      over a descendant's z-index once something else outranks the ancestor). */}
                  {suggestionsOpen && searchRect && createPortal(
                    <div style={{
                      position: 'fixed', top: searchRect.bottom + 6, left: searchRect.left, width: searchRect.width,
                      background: '#fff', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: 'var(--card-shadow)',
                      zIndex: 200, overflow: 'hidden', textAlign: 'left', maxHeight: 360, overflowY: 'auto',
                    }}>
                      {suggestionsRows}
                    </div>,
                    document.body
                  )}
                </>
              );
            })()}

            {/* Save / Clear — only relevant once a search has actually run */}
            {searched && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                {confirmedQuery && (
                  <button onClick={() => toggleBookmark(confirmedQuery)}
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

            {/* Saved searches — sit in the hero where the quick-search chips used to, only
                before a search has run; each chip has its own remove (X) so bookmarks can be
                cleared right from here without opening anything else. */}
            {!searched && bookmarks.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--mono)' }}>{t('savedLabel')}</span>
                {bookmarks.map(bm => (
                  <span key={bm} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 20, padding: '4px 4px 4px 14px' }}>
                    <button onClick={() => doSearch(bm)}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.85)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}>
                      {bm}
                    </button>
                    <button onClick={() => toggleBookmark(bm)} title={t('removeBookmark')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', transition: 'background .15s, color .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.6)'; }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Document-type strip — floats up over the hero's bottom edge, like the old stat tiles
          did (same overlap position: half on the image, half on the white background below).
          Once a search has run, this same floating slot shows the question instead of the
          type chips — the two-column layout below it stays the same shape either way. */}
      {!loading && (
        <div className="cd-stats-outer" style={{ padding: '0 32px', marginTop: -32, position: 'relative', zIndex: 3 }}>
          {searched ? (
            <div style={{
              maxWidth: 1400, margin: '0 auto', background: 'var(--surface-card)', borderRadius: 14,
              boxShadow: '0 12px 32px rgba(0,0,0,.12)', border: '1px solid var(--surface-border)',
              padding: '20px 28px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-heading)' }}>{formatAsQuestion(confirmedQuery)}</div>
            </div>
          ) : (
          <>
          <div className="cd-type-strip" style={{
            display: 'flex', overflow: 'hidden', maxWidth: 1400, margin: '0 auto',
            background: 'var(--surface-card)', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.12)',
            border: '1px solid var(--surface-border)',
          }}>
            {/* Icon-on-top, name-below (not side-by-side) so every cell is narrower — that's
                what keeps the whole strip fitting on one row without a horizontal scroller.
                Counts live on the browse table's own header below, not here. */}
            {[{ id: '', name: t('allTypes') }, ...typeOptions.filter(dt => dt.id)].map((dt, idx, arr) => {
              const isAll = dt.id === '';
              const meta = isAll ? { color: 'var(--primary)', bg: 'var(--primary-light)' } : (DOC_TYPE_META[dt.name] || { color: '#64748b', bg: 'rgba(100,116,139,.1)' });
              const isActive = browseTypeId === dt.id;
              const Icon = isAll ? Layers : (TYPE_ICON_MAP[dt.name] || FileText);
              return (
                <button key={dt.id || 'all'} onClick={() => setBrowseTypeId(isActive ? '' : dt.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0, overflow: 'hidden',
                    flex: isActive ? '1.2 1 0' : '1 1 0', padding: isActive ? '14px 8px' : '12px 6px',
                    border: 'none', borderRight: idx < arr.length - 1 ? '1px solid var(--surface-border)' : 'none',
                    background: isActive ? meta.bg : 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{
                    width: isActive ? 36 : 30, height: isActive ? 36 : 30, borderRadius: isActive ? 10 : 8, background: meta.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s',
                  }}>
                    <Icon size={isActive ? 17 : 14} color={meta.color} strokeWidth={1.8} />
                  </div>
                  <span style={{
                    fontSize: isActive ? 12 : 10.5, fontWeight: 700, fontFamily: 'var(--font)', textAlign: 'center',
                    color: isActive ? meta.color : 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                  }}>{dt.name}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile/tablet stand-in for the strip above — display:none by default,
              swapped in by the @media (max-width: 1024px) rule further up. */}
          {(() => {
            const allOpt = { id: '', name: t('allTypes') };
            const mobileOptions = [allOpt, ...typeOptions.filter(dt => dt.id)];
            const active = mobileOptions.find(dt => dt.id === browseTypeId) || allOpt;
            const activeIsAll = active.id === '';
            const activeMeta = activeIsAll ? { color: 'var(--primary)', bg: 'var(--primary-light)' } : (DOC_TYPE_META[active.name] || { color: '#64748b', bg: 'rgba(100,116,139,.1)' });
            const ActiveIcon = activeIsAll ? Layers : (TYPE_ICON_MAP[active.name] || FileText);
            return (
              <div className="cd-type-dropdown-mobile" style={{ display: 'none', position: 'relative', maxWidth: 1400, margin: '0 auto' }}>
                <button type="button" onClick={() => setBrowseTypeDropdownOpen(o => !o)}
                  onBlur={() => setTimeout(() => setBrowseTypeDropdownOpen(false), 150)}
                  style={{
                    width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '14px 18px', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 14,
                    boxShadow: '0 12px 32px rgba(0,0,0,.12)', cursor: 'pointer', fontFamily: 'var(--font)',
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: activeMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ActiveIcon size={14} color={activeMeta.color} strokeWidth={1.8} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)' }}>{active.name}</span>
                  </span>
                  <ChevronDown size={15} color="var(--text-color-secondary)" style={{ transform: browseTypeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                </button>
                {browseTypeDropdownOpen && (
                  <div className="cd-type-dropdown-scroll" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 20,
                    background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,.7)', borderRadius: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.7)',
                    padding: 6, maxHeight: 320, overflowY: 'auto',
                  }}>
                    {mobileOptions.map(dt => {
                      const isAll = dt.id === '';
                      const meta = isAll ? { color: 'var(--primary)', bg: 'var(--primary-light)' } : (DOC_TYPE_META[dt.name] || { color: '#64748b', bg: 'rgba(100,116,139,.1)' });
                      const isActive = browseTypeId === dt.id;
                      const Icon = isAll ? Layers : (TYPE_ICON_MAP[dt.name] || FileText);
                      return (
                        <div key={dt.id || 'all'} onMouseDown={() => { setBrowseTypeId(dt.id); setBrowseTypeDropdownOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', background: isActive ? meta.bg : 'transparent' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.5)'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <Icon size={14} color={meta.color} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', color: isActive ? meta.color : 'var(--text-color)' }}>{dt.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          </>
          )}
        </div>
      )}

      {/* Content area — same 70/30 width regardless of state now, since search results
          reuse the browse table's two-column shape instead of a narrower single column. */}
      <div className="cd-content" style={{ flex: 1, padding: '28px 32px 40px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

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

        {/* Results — same 70/30 shape as the idle browse table: the AI answer takes the
            "All Documents" slot on the left, and the matched documents (already relevance-
            ordered by groupSemanticSources) take the "Recently Published" slot on the right. */}
        {!loading && searched && !error && (
          <div className="cd-browse-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 70fr) minmax(0, 30fr)', gap: 20, alignItems: 'start' }}>
            <Card padding="0">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={16} color="var(--primary)" />
                <span style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('aiAnswerLabel')}</span>
              </div>
              <div style={{ padding: '20px 22px' }}>
                {answer ? (
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-color)', whiteSpace: 'pre-line' }}>
                    {answer}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Search size={40} color="var(--surface-200)" style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>{t('noResultsFound')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('tryDifferentKeywords')}</div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('matchedDocuments')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
                  {results.length}
                </span>
              </div>
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('noDocumentsFound')}</div>
              ) : (
                <div>
                  {results.map((doc, i) => {
                    const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
                    // relevance_score is a 0–1 similarity straight from the semantic-search
                    // API — shown as a plain percentage, just colour-coded by tier so a
                    // citizen can tell "strong match" apart from "barely came up" at a glance.
                    const pct = doc._bestScore != null ? Math.round(doc._bestScore * 100) : null;
                    const tier = pct == null ? null : pct >= 70
                      ? { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)' }
                      : pct >= 40
                        ? { color: '#b45309', bg: 'rgba(255, 193, 7,.12)' }
                        : { color: '#64748b', bg: 'rgba(100,116,139,.1)' };
                    return (
                      <div key={doc.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 6px', borderBottom: i < results.length - 1 ? '1px solid var(--surface-border)' : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background .12s' }}
                        onClick={() => openDoc(doc)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <FileText size={14} color="var(--text-color-secondary)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.document_name || cleanFilename(doc.original_filename)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.department_name}
                            </div>
                            {tier && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, fontFamily: 'var(--mono)', flexShrink: 0, background: tier.bg, color: tier.color }}>
                                {pct}% {t('relevanceMatch')}
                              </span>
                            )}
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
          </div>
        )}

        {/* Idle state — 70/30 split: the browse table (all documents, filterable by the type
            strip that floats above, between the hero and here) on the left, Recently
            Published unchanged on the right. */}
        {!loading && !searched && (
          <>
            <div className="cd-browse-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 70fr) minmax(0, 30fr)', gap: 20, alignItems: 'start' }}>
              {/* Left — browse-all-documents table, filterable by the chips above + this dropdown */}
              <Card padding="0">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('allDocuments')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
                      {t('documentCount', { count: browseTotal })}
                    </span>
                  </div>
                  <select value={browseDeptId} onChange={e => setBrowseDeptId(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', fontSize: 12.5, fontFamily: 'var(--font)', color: 'var(--text-color)', cursor: 'pointer' }}>
                    <option value="">{t('allDepartments')}</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {browseLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('loading')}</div>
                ) : browseDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-color-secondary)', fontSize: 13 }}>{t('noDocumentsFound')}</div>
                ) : (
                  <div>
                    {browseDocs.map((doc, i) => {
                      const meta = doc.document_type_name ? DOC_TYPE_META[doc.document_type_name] : null;
                      return (
                        <div key={doc.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < browseDocs.length - 1 ? '1px solid var(--surface-border)' : 'none', cursor: 'pointer', transition: 'background .12s' }}
                          onClick={() => openDoc(doc)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <FileText size={14} color="var(--text-color-secondary)" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.3, minHeight: '2.6em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.document_name || doc.original_filename}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[doc.department_name, doc.issue_date].filter(Boolean).join(' · ')}
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
                {browseTotal > BROWSE_PAGE_SIZE && (
                  <div style={{ padding: '10px 20px', borderTop: '1px solid var(--surface-border)' }}>
                    <Pagination page={browsePage} totalPages={Math.ceil(browseTotal / BROWSE_PAGE_SIZE)} onChange={setBrowsePage} />
                  </div>
                )}
              </Card>

              {/* Right — Recently Published, unchanged */}
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.3, minHeight: '2.6em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.document_name || doc.original_filename}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            </div>
          </>
        )}

      </div>

      <Footer />
    </div>
  );
}
