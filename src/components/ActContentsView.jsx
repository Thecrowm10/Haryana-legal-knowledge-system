import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown, FileText, ExternalLink, FolderX, BookOpen, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { PART_META } from '../constants/mockActOutline';
import { DOC_TYPE_META } from '../constants/docTypeMeta';
import { getPdfFull } from '../services/pdf';
import { mapActPartsToOutline, mapRelationships, humanizeRelationType } from '../utils/actFull';
import { mapPublicDocForViewer } from '../utils/mapPublicDoc';
import DocViewModal from './DocViewModal';

const EMPTY_OUTLINE = { sections: { chapters: [], isFlat: false }, schedules: [], annexures: [], appendix: [], forms: [] };

function EmptyPart({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '70px 0', color: 'var(--text-color-secondary)' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FolderX size={24} strokeWidth={1.5} />
      </div>
      <span style={{ fontSize: 13.5 }}>No {label.toLowerCase()} available for this Act.</span>
    </div>
  );
}

function LoadingPart() {
  return (
    <div style={{ textAlign: 'center', padding: '70px 0' }}>
      <div style={{ display: 'inline-flex', gap: 6, marginBottom: 12 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', animation: `bounce .8s ease-in-out ${i * .12}s infinite` }} />
        ))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Loading act contents…</div>
    </div>
  );
}

function ErrorPart({ onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '70px 0', color: 'var(--text-color-secondary)' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(220, 53, 69,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={24} strokeWidth={1.5} color="#dc3545" />
      </div>
      <span style={{ fontSize: 13.5 }}>Couldn't load this Act's contents.</span>
      <button type="button" onClick={onRetry}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );
}

// The primary landing page for an Act, opened on a direct browse click —
// independent of the raw PDF. Clicking an entry expands its text inline;
// nothing here scrolls or touches the PDF viewer. The PDF stays reachable
// via the "View Original PDF" action (onViewPdf), and DocViewModal itself
// is still used separately for "show me where my search term matched".
export default function ActContentsView({ doc, onClose, onViewPdf }) {
  const [fullDetail, setFullDetail] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [retryTick, setRetryTick]   = useState(0);

  const outline     = useMemo(() => fullDetail ? mapActPartsToOutline(fullDetail.act_parts) : EMPTY_OUTLINE, [fullDetail]);
  const relatedDocs = useMemo(() => fullDetail ? mapRelationships(fullDetail.related_documents) : {}, [fullDetail]);
  // Every document type except "Act" itself, always shown — types with nothing
  // under this Act render disabled/greyed rather than being hidden, so a
  // citizen can see the full picture of what could exist here; only types
  // that actually have data (from the real `related_documents` response) are clickable.
  const allRelatedTypes = Object.keys(DOC_TYPE_META).filter(t => t !== 'Act');

  const [activePart, setActivePart] = useState('sections');
  const [openEntry, setOpenEntry]   = useState(null); // `${chapterIdx}-${sectionIdx}` or flat idx
  const [relatedDialogType, setRelatedDialogType]   = useState(null);
  const [expandedRelated, setExpandedRelated]       = useState(null); // which related-doc row is expanded in the dialog
  const [viewRelatedDoc, setViewRelatedDoc] = useState(null); // related doc currently open in its own PDF viewer
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef({});
  const scrollAreaRef = useRef(null);

  // Fetches the Act's full content (chapters/sections/schedules/… + related
  // documents) in one call — everything here previously came from mock data.
  useEffect(() => {
    let cancelled = false;
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

  const flatItems = activePart !== 'sections' ? outline[activePart] : null;

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', animation: 'fadeSlideIn .2s ease' }}>
      <style>{`
        @media (max-width: 860px) {
          .acv-grid { grid-template-columns: 1fr !important; }
          .acv-rail { display: none !important; }
          .acv-reader { padding: 20px !important; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(33, 74, 171,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={17} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>{doc.dept}</span>
            {doc.year && <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>· {doc.year}</span>}
            {/* Version tag hidden until proper API mapping for versions is wired up — keep for future use.
            {doc.version && <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>· v{doc.version}</span>}
            */}
          </div>
        </div>
        {onViewPdf && (
          <button onClick={onViewPdf}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
            <ExternalLink size={13} /> View Original PDF
          </button>
        )}
        <button onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
          <X size={14} /> Close
        </button>
      </div>

      {/* Related documents under this Act (its Rules, Amendments, Notifications, …) —
          every type is shown; ones with nothing under this Act render disabled/grey
          rather than being hidden, so a citizen can see the full picture. */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 9 }}>Related to this Act</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allRelatedTypes.map(type => {
            const items = relatedDocs[type] || [];
            const hasData = items.length > 0;
            const meta = DOC_TYPE_META[type] || { color: '#64748b', bg: 'rgba(100,116,139,.1)', border: 'rgba(100,116,139,.25)' };
            return (
              <button key={type} type="button" disabled={!hasData}
                onClick={() => hasData && (setRelatedDialogType(type), setExpandedRelated(null))}
                onMouseEnter={e => { if (hasData) e.currentTarget.style.boxShadow = `0 2px 8px ${meta.border}`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 20,
                  border: `1px solid ${hasData ? meta.border : 'var(--surface-border)'}`,
                  background: hasData ? meta.bg : 'var(--surface-card)',
                  color: hasData ? meta.color : 'var(--text-color-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: hasData ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font)', opacity: hasData ? 1 : .55,
                  transition: 'box-shadow .15s',
                }}>
                {type}{hasData ? ` · ${items.length}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Related-type dialog */}
      {relatedDialogType && (
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
                  ['Reference No.',  it.referenceNumber],
                  ['Issue Date',     it.enactmentDate],
                  ['Effective From', it.effectiveFrom],
                  ['Gazette Ref.',   it.gazette],
                  ['Legal Authority', it.authority],
                  ['Short Title',    it.shortTitle],
                ].filter(([, v]) => v);
                return (
                  <div key={rowKey} style={{ borderBottom: idx < relatedDialogItems.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                    <button type="button" onClick={() => setExpandedRelated(isOpen ? null : rowKey)}
                      style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 20px', background: isOpen ? 'var(--surface-ground)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}>
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
                          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
                            {it.summary || it.desc}
                          </div>
                        )}
                        {it.id != null && (
                          <button type="button" onClick={() => { setViewRelatedDoc(it); setRelatedDialogType(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
                            <Eye size={12} /> View Full PDF
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Opens a related document's own PDF, layered above this Act's reading view */}
      {viewRelatedDoc && (
        <DocViewModal doc={viewRelatedDoc} onClose={() => setViewRelatedDoc(null)} zIndex={2300} />
      )}

      {/* Part tabs — all 5 always shown; picking an empty one shows a "no data" message below rather than being disabled, so it stays explorable */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0, overflowX: 'auto' }}>
        {Object.keys(PART_META).map(key => {
          const m = PART_META[key];
          const isActive = activePart === key;
          return (
            <button key={key} type="button" onClick={() => { setActivePart(key); setOpenEntry(null); }}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${isActive ? m.accent : 'var(--surface-border)'}`,
                background: isActive ? m.bg : 'var(--surface-card)', color: isActive ? m.accent : 'var(--text-color-secondary)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: isActive ? `0 2px 8px ${m.accent}33` : 'none',
                transition: 'all .15s',
              }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="acv-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: activePart === 'sections' && outline.sections.chapters.length > 0 && !outline.sections.isFlat ? '272px 1fr' : '1fr', overflow: 'hidden', background: 'var(--surface-ground)' }}>

        {activePart === 'sections' && outline.sections.chapters.length > 0 && !outline.sections.isFlat && (
          <div className="acv-rail" style={{ borderRight: '1px solid var(--surface-border)', overflowY: 'auto', padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 12, padding: '0 6px' }}>
              <BookOpen size={12} /> Chapters
            </div>
            {outline.sections.chapters.map((ch, ci) => {
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
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--text-heading)', lineHeight: 1.4, marginTop: 2 }}>{ch.title}</span>
                </button>
              );
            })}
          </div>
        )}

        <div ref={scrollAreaRef} className="acv-reader" style={{ overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{
            maxWidth: 720, margin: '0 auto', background: 'var(--surface-card)', borderRadius: 14,
            border: '1px solid var(--surface-border)', boxShadow: 'var(--card-shadow)', padding: '36px 44px',
            minHeight: activePart === 'sections' && outline.sections.chapters.length > 0 && !outline.sections.isFlat ? 'calc(100% - 2px)' : 'auto',
          }}>

            {loading ? (
              <LoadingPart />
            ) : loadError ? (
              <ErrorPart onRetry={() => setRetryTick(t => t + 1)} />
            ) : activePart === 'sections' && outline.sections.chapters.length === 0 ? (
              <EmptyPart label={PART_META.sections.label} />
            ) : activePart !== 'sections' && flatItems.length === 0 ? (
              <EmptyPart label={PART_META[activePart].label} />
            ) : activePart === 'sections' ? (
              outline.sections.chapters.map((ch, ci) => (
                <div key={ci} ref={el => { chapterRefs.current[ci] = el; }} data-chapter-idx={ci}
                  style={{ marginBottom: ci < outline.sections.chapters.length - 1 ? 40 : 0, scrollMarginTop: 20 }}>
                  {ch.title && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff', background: 'var(--primary)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.04em' }}>{`CHAPTER ${ci + 1}`}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--surface-border)' }} />
                      </div>
                      <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 18px', letterSpacing: '-.01em' }}>{ch.title}</h2>
                    </>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ch.sections.map((sec, si) => {
                      const entryKey = `${ci}-${si}`;
                      const isOpen = openEntry === entryKey;
                      return (
                        <div key={si} style={{
                          borderRadius: 10, border: `1px solid ${isOpen ? 'var(--primary)' : 'var(--surface-border)'}`,
                          background: isOpen ? 'rgba(33, 74, 171,.04)' : 'transparent', overflow: 'hidden', transition: 'border-color .15s',
                        }}>
                          <button type="button" onClick={() => setOpenEntry(isOpen ? null : entryKey)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}
                            onMouseEnter={e => { if (!isOpen) e.currentTarget.parentElement.style.background = 'var(--surface-ground)'; }}
                            onMouseLeave={e => { if (!isOpen) e.currentTarget.parentElement.style.background = 'transparent'; }}>
                            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, background: isOpen ? 'var(--primary)' : 'var(--surface-ground)', color: isOpen ? '#fff' : 'var(--text-color-secondary)' }}>{si + 1}</span>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', flex: 1 }}>{sec.title}</span>
                            <ChevronDown size={14} color="var(--text-color-secondary)" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0 }} />
                          </button>
                          {isOpen && (
                            <div style={{ padding: '0 14px 16px 46px', fontSize: 13.5, color: 'var(--text-color)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
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
                  <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-heading)', margin: 0, letterSpacing: '-.01em' }}>{PART_META[activePart].label}</h2>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: PART_META[activePart].accent, background: PART_META[activePart].bg, padding: '3px 10px', borderRadius: 20 }}>{flatItems.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flatItems.map((it, idx) => {
                    const isOpen = openEntry === idx;
                    return (
                      <div key={idx} style={{
                        borderRadius: 10, border: `1px solid ${isOpen ? PART_META[activePart].accent : 'var(--surface-border)'}`,
                        background: isOpen ? PART_META[activePart].bg : 'transparent', overflow: 'hidden', transition: 'border-color .15s',
                      }}>
                        <button type="button" onClick={() => setOpenEntry(isOpen ? null : idx)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', flex: 1 }}>{it.title}</span>
                          <ChevronDown size={14} color="var(--text-color-secondary)" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0 }} />
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 14px 16px 14px', fontSize: 13.5, color: 'var(--text-color)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                            {it.content}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
