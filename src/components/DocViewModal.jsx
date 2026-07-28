import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, CheckCircle, XCircle, Clock, Eye, ZoomIn, ZoomOut, RotateCw, ExternalLink, X, MessageCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.BASE_URL + 'pdf.worker.min.js';
import mammoth from 'mammoth';
import { getPdfFile } from '../services/pdf';

const TYPE_CARD_COLORS = {
  'Act':                 { bg: 'rgba(33, 74, 171,.08)',  accent: '#214aab', text: '#1e40af' },
  'Amendment':           { bg: 'rgba(255, 193, 7,.08)', accent: '#ffc107', text: '#d97706' },
  'Notification':        { bg: 'rgba(139,92,246,.08)', accent: '#8b5cf6', text: '#7c3aed' },
  'Circular':            { bg: 'rgba(20,184,166,.08)', accent: '#14b8a6', text: '#0f766e' },
  'Policy':              { bg: 'rgba(25, 135, 84,.08)',  accent: '#198754', text: '#16a34a' },
  'Rules & Regulations': { bg: 'rgba(220, 53, 69,.08)',  accent: '#dc3545', text: '#dc2626' },
  'Order/Gazette':     { bg: 'rgba(234,179,8,.08)',  accent: '#eab308', text: '#a16207' },
  'Bye Laws':            { bg: 'rgba(14,165,233,.08)', accent: '#0ea5e9', text: '#0369a1' },
  'Miscellaneous':       { bg: 'rgba(100,116,139,.08)',accent: '#64748b', text: '#475569' },
};

// camelCase field key → Title Case label, e.g. 'noOfRules' → 'No Of Rules'
function fieldLabel(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function parseDisplayRemarks(str) {
  if (!str) return [];
  const lines = str.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const m = line.match(/^Remark (\d+):\s*(.*)/);
    return m ? { num: parseInt(m[1]), text: m[2] } : { num: i + 1, text: line };
  });
}

export default function DocViewModal({ doc, onClose, initialPage = 1, searchQuery = null, searchPages = null }) {
  const [blobUrl, setBlobUrl]         = useState(null);
  const [pdfDoc, setPdfDoc]           = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [zoom, setZoom]               = useState(100);
  const [rotation, setRotation]       = useState(0);
  const [docxHtml, setDocxHtml]       = useState(null);
  const [searchHighlights, setSearchHighlights] = useState({});
  // Which match page is currently being highlighted/shown (changes when user navigates matches)
  const [activeHitPage, setActiveHitPage]   = useState(initialPage);
  const [activeHitIdx, setActiveHitIdx]     = useState(() => searchPages ? Math.max(0, searchPages.indexOf(initialPage)) : 0);
  const canvasRefs    = useRef([]);
  const containerRef  = useRef(null);
  const suppressRef   = useRef(false);
  const svgRefs       = useRef([]);
  const docxViewRef   = useRef(null);
  // Keep a current reference to scrollToPage to avoid stale closures in timeouts
  const scrollToPageRef = useRef(null);
  const annotations  = useMemo(() => {
    try { return doc.approval?.annotations_json ? JSON.parse(doc.approval.annotations_json) : []; }
    catch { return []; }
  }, [doc.approval?.annotations_json]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let url = null;
    setBlobUrl(null); setPdfDoc(null); setCurrentPage(1); setDocxHtml(null);
    getPdfFile(doc.id)
      .then(res => {
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.includes('wordprocessingml') || ct.includes('officedocument')) {
          return mammoth.convertToHtml({ arrayBuffer: res.data }).then(r => setDocxHtml(r.value));
        }
        const blob = new Blob([res.data], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [doc.id]);

  useEffect(() => {
    if (!blobUrl) return;
    let cancelled = false;
    pdfjsLib.getDocument({ url: blobUrl }).promise
      .then(pdf => { if (!cancelled) { setPdfDoc(pdf); setTotalPages(pdf.numPages); } })
      .catch(e => console.error('PDF load:', e));
    return () => { cancelled = true; };
  }, [blobUrl]);

  useEffect(() => {
    if (!docxViewRef.current || !docxHtml) return;
    docxViewRef.current.innerHTML = docxHtml;
  }, [docxHtml]);

  useEffect(() => {
    if (!docxViewRef.current || !docxHtml) return;
    docxViewRef.current.querySelectorAll('[data-docx-annot]').forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    annotations.filter(a => a.isDocx).forEach(ann => {
      if (!ann.text || !docxViewRef.current) return;
      const walker = document.createTreeWalker(docxViewRef.current, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.textContent.indexOf(ann.text);
        if (idx < 0) continue;
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + ann.text.length);
        const span = document.createElement('span');
        span.style.cssText = `background-color:${ann.color};border-radius:2px;padding:0 1px;`;
        span.dataset.docxAnnot = ann.id;
        if (ann.comment) span.title = ann.comment;
        try { range.surroundContents(span); } catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
        return;
      }
    });
  }, [annotations, docxHtml]);

  // Scroll to the page that contained the search hit
  useEffect(() => {
    if (!pdfDoc || initialPage <= 1) return;
    const timer = setTimeout(() => scrollToPageRef.current?.(initialPage), 450);
    return () => clearTimeout(timer);
  }, [pdfDoc, initialPage]); // eslint-disable-line

  // Extract text positions for search term highlighting using PDF.js text content
  useEffect(() => {
    if (!pdfDoc || !searchQuery || activeHitPage < 1) return;
    const STOP = new Set(['a','an','the','and','or','in','of','to','for','by','at','on','is','are','was','were','be','as','it','its','he','she','they','we','you','not','but','if','any','all','may','shall','has','had','have','do','did','does','his','her','their','who','which','such','been','with','from','this','that']);
    const words = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
    if (!words.length) return;
    const scale = (zoom / 100) * 1.5;
    let cancelled = false;

    pdfDoc.getPage(activeHitPage).then(async page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale, rotation });
      const { items } = await page.getTextContent();
      if (cancelled) return;

      const [va, vb, vc, vd, ve, vf] = vp.transform;
      const rects = [];
      for (const item of items) {
        if (!item.str?.trim() || item.width <= 0) continue;
        if (!words.some(w => item.str.toLowerCase().includes(w))) continue;
        const [, , , fontScaleY, tx, ty] = item.transform;
        const cx = va * tx + vc * ty + ve;
        const cy = vb * tx + vd * ty + vf;
        const fontH = Math.abs(fontScaleY) * vp.scale;
        const itemW = item.width * vp.scale;
        if (fontH <= 0 || itemW <= 0) continue;
        rects.push({
          x: cx / vp.width,
          y: (cy - fontH) / vp.height,
          w: itemW / vp.width,
          h: (fontH * 1.3) / vp.height,
        });
      }
      // Replace highlights: clear old page, set new page
      setSearchHighlights({ [activeHitPage - 1]: rects });
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [pdfDoc, searchQuery, activeHitPage, zoom, rotation]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const scale = (zoom / 100) * 1.5;
    canvasRefs.current = canvasRefs.current.slice(0, pdfDoc.numPages);
    for (let i = 0; i < pdfDoc.numPages; i++) {
      const canvas = canvasRefs.current[i];
      if (!canvas) continue;
      pdfDoc.getPage(i + 1).then(page => {
        if (cancelled) return;
        const vp = page.getViewport({ scale, rotation });
        canvas.width = vp.width; canvas.height = vp.height;
        page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      });
    }
    return () => { cancelled = true; };
  }, [pdfDoc, zoom, rotation]);

  // scrollToPage is called only by Prev/Next buttons — never by handleScroll or scrollToAnnotation
  scrollToPageRef.current = scrollToPage;
  function scrollToPage(page) {
    const clamped = Math.max(1, Math.min(totalPages, page));
    const canvas = canvasRefs.current[clamped - 1];
    if (!canvas || !containerRef.current) { setCurrentPage(clamped); return; }
    suppressRef.current = true;
    const top = canvas.parentElement?.offsetTop ?? canvas.offsetTop;
    containerRef.current.scrollTo({ top: top - 8, behavior: 'smooth' });
    setCurrentPage(clamped);
    setTimeout(() => { suppressRef.current = false; }, 700);
  }

  function handleScroll() {
    if (suppressRef.current || !containerRef.current) return;
    const st = containerRef.current.scrollTop;
    const ch = containerRef.current.clientHeight;
    let best = 0, bestVis = -1;
    canvasRefs.current.forEach((canvas, i) => {
      if (!canvas) return;
      const top = canvas.parentElement?.offsetTop ?? canvas.offsetTop;
      const vis = Math.max(0, Math.min(top + canvas.offsetHeight, st + ch) - Math.max(top, st));
      if (vis > bestVis) { bestVis = vis; best = i; }
    });
    if (best + 1 !== currentPage) setCurrentPage(best + 1);
  }

  function scrollToAnnotation(ann) {
    const canvas = canvasRefs.current[ann.page - 1];
    if (!canvas || !containerRef.current) return;
    suppressRef.current = true;
    const containerRect = containerRef.current.getBoundingClientRect();
    const wrapper = canvas.parentElement || canvas;
    const wrapperRect = wrapper.getBoundingClientRect();
    const annotCenterY = ann.y * wrapperRect.height + (ann.h * wrapperRect.height) / 2;
    const wrapperTopInScroll = wrapperRect.top - containerRect.top + containerRef.current.scrollTop;
    const target = wrapperTopInScroll + annotCenterY - containerRef.current.clientHeight / 2;
    containerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    setTimeout(() => { suppressRef.current = false; }, 900);
  }

  function goToMatch(idx) {
    if (!searchPages || idx < 0 || idx >= searchPages.length) return;
    const page = searchPages[idx];
    setActiveHitIdx(idx);
    setActiveHitPage(page);
    setTimeout(() => scrollToPageRef.current?.(page), 80);
  }

  const LS = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

  const meta = [
    ['Short Title',     doc.shortTitle      || null],
    ['Reference No.',   doc.referenceNumber || null],
    ['Issue Date',      doc.enactmentDate   || null],
    ['Effective From',  doc.effectiveFrom   || null],
    ['Gazette Ref.',    doc.gazette         || null],
    ['Legal Authority', doc.authority       || null],
    ['Uploader',        doc.uploader        || null],
    ['Upload Date',     doc.uploadedAt      || null],
    ['File',            doc.fileName        || null],
  ].filter(([, v]) => v);

  // Type-specific fields (e.g. Act Year, No. of Rules for an Act; Sector for a Policy) —
  // everything the uploader entered that isn't already covered by the fixed fields above.
  const typeExtra = doc.typeFields
    ? Object.entries(doc.typeFields).filter(([, v]) => v)
    : [];

  const statusAccent = doc.status === 'approved' ? '#16a34a' : doc.status === 'rejected' ? '#dc3545' : '#ffc107';
  const statusBg     = doc.status === 'approved' ? 'rgba(25, 135, 84,.1)'  : doc.status === 'rejected' ? 'rgba(220, 53, 69,.1)'  : 'rgba(255, 193, 7,.1)';
  const StatusIconV  = doc.status === 'approved' ? CheckCircle : doc.status === 'rejected' ? XCircle : Clock;
  const typeColor    = TYPE_CARD_COLORS[doc.type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.12)', text: '#64748b' };

  const iconBtn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
    borderRadius: 7, width: 32, height: 32, cursor: 'pointer',
    color: 'rgba(255,255,255,.85)', transition: 'background .15s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: 'var(--surface-card)' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0, minHeight: 64 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={18} color={typeColor.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{doc.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>{doc.type}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>{doc.dept}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', opacity: .7 }}>· {doc.year}</span>
            {doc.version && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', opacity: .7 }}>· v{doc.version}</span>}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px 6px 10px', borderRadius: 20, background: statusBg, border: `1px solid ${statusAccent}44`, flexShrink: 0 }}>
          <StatusIconV size={13} color={statusAccent} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: statusAccent, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>
            {doc.status === 'approved' ? 'APPROVED' : doc.status === 'rejected' ? 'REJECTED' : 'PENDING'}
          </span>
        </div>
        <button onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}>
          <X size={14} /> Close
        </button>
      </div>

      {/* 2-panel body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '57% 43%', overflow: 'hidden' }}>

        {/* Left: PDF viewer */}
        <div style={{ borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#3a3d40' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#2d2f31', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <Eye size={14} color="rgba(255,255,255,.7)" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>{docxHtml ? 'Document Preview' : 'Original PDF'}</span>
            {searchQuery && !docxHtml && searchPages && searchPages.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(234,179,8,.15)', border: '1px solid rgba(234,179,8,.35)', borderRadius: 20, padding: '3px 4px 3px 10px' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#fde68a', whiteSpace: 'nowrap' }}>
                  ★ Match {activeHitIdx + 1} of {searchPages.length} · p.{activeHitPage}
                </span>
                <button
                  onClick={() => goToMatch(activeHitIdx - 1)}
                  disabled={activeHitIdx === 0}
                  style={{ background: activeHitIdx === 0 ? 'transparent' : 'rgba(255,255,255,.12)', border: 'none', borderRadius: 12, width: 22, height: 22, cursor: activeHitIdx === 0 ? 'not-allowed' : 'pointer', color: activeHitIdx === 0 ? 'rgba(253,230,138,.3)' : '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  ‹
                </button>
                <button
                  onClick={() => goToMatch(activeHitIdx + 1)}
                  disabled={activeHitIdx === searchPages.length - 1}
                  style={{ background: activeHitIdx === searchPages.length - 1 ? 'transparent' : 'rgba(255,255,255,.12)', border: 'none', borderRadius: 12, width: 22, height: 22, cursor: activeHitIdx === searchPages.length - 1 ? 'not-allowed' : 'pointer', color: activeHitIdx === searchPages.length - 1 ? 'rgba(253,230,138,.3)' : '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  ›
                </button>
              </div>
            )}
            <span style={{ flex: 1 }} />
            {!docxHtml && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '3px 6px', border: '1px solid rgba(255,255,255,.1)' }}>
                <button onClick={() => setZoom(z => Math.max(70, z - 10))}
                  style={{ ...iconBtn, width: 28, height: 28, background: 'transparent', border: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ZoomOut size={13} />
                </button>
                <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.75)', minWidth: 38, textAlign: 'center', userSelect: 'none' }}>{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(150, z + 10))}
                  style={{ ...iconBtn, width: 28, height: 28, background: 'transparent', border: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ZoomIn size={13} />
                </button>
              </div>
            )}
            {!docxHtml && (
              <button onClick={() => setRotation(r => (r + 90) % 360)}
                style={iconBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'}>
                <RotateCw size={14} />
              </button>
            )}
            {blobUrl && !docxHtml && (
              <a href={blobUrl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(33, 74, 171,.25)', border: '1px solid rgba(33, 74, 171,.4)', color: '#93c5fd', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.4)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.25)'}>
                <ExternalLink size={12} /> Open
              </a>
            )}
          </div>

          {docxHtml ? (
            <div ref={docxViewRef}
              style={{ flex: 1, overflow: 'auto', background: 'white', padding: '40px 48px', color: '#1a1a1a', lineHeight: 1.8, fontSize: 13 }} />
          ) : (
            <div ref={containerRef} onScroll={handleScroll}
              style={{ flex: 1, overflow: 'auto', background: '#525659', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              {!blobUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14 }}>
                  <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: 'rgba(255,255,255,.8)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.6)', letterSpacing: '.04em' }}>Loading document…</span>
                </div>
              )}
              {blobUrl && Array.from({ length: totalPages }, (_, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas ref={el => { canvasRefs.current[i] = el; }}
                    style={{ display: 'block', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,.6)', maxWidth: '100%' }} />
                  {(annotations.some(a => a.page === i + 1) || searchHighlights[i]?.length > 0) && (
                    <svg ref={el => { svgRefs.current[i] = el; }}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                      {/* Search term highlights */}
                      {(searchHighlights[i] || []).map((hl, idx) => (
                        <rect key={`sh-${idx}`}
                          x={`${hl.x * 100}%`} y={`${hl.y * 100}%`}
                          width={`${hl.w * 100}%`} height={`${hl.h * 100}%`}
                          fill="rgba(234,179,8,0.45)" rx="2" />
                      ))}
                      {/* Reviewer annotation highlights */}
                      {annotations.filter(a => a.page === i + 1).map(ann => (
                        <g key={ann.id}>
                          <rect x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} width={`${ann.w * 100}%`} height={`${ann.h * 100}%`}
                            fill={ann.color} stroke="rgba(0,0,0,.2)" strokeWidth="1" />
                          <title>{ann.comment}</title>
                          <foreignObject x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} width="20" height="20" style={{ overflow: 'visible', pointerEvents: 'auto' }}>
                            <div title={ann.comment} style={{ width: 16, height: 16, borderRadius: '50%', background: '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                              <MessageCircle size={9} color="white" />
                            </div>
                          </foreignObject>
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}

          {!docxHtml && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#2d2f31', flexShrink: 0 }}>
              <button onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage === 1}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === 1 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
                ← Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>{currentPage}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>of</span>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.55)' }}>{totalPages}</span>
              </div>
              <button onClick={() => scrollToPage(currentPage + 1)} disabled={currentPage === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === totalPages ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === totalPages ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right: Document details */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-50)', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(33, 74, 171,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} color="var(--primary)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Document Details</span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[
                { label: 'Type',       value: doc.type,                   color: typeColor.accent, bg: typeColor.bg },
                { label: 'Department', value: doc.dept,                   color: 'var(--primary)', bg: 'rgba(33, 74, 171,.07)' },
                { label: 'Year',       value: String(doc.year),           color: '#64748b',        bg: 'rgba(100,116,139,.08)' },
                { label: 'Version',    value: `v${doc.version || '1.0'}`, color: '#64748b',        bg: 'rgba(100,116,139,.08)' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ padding: '12px 14px', borderRadius: 10, background: bg, border: '1px solid transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 4, opacity: .8 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>

            {meta.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Additional Info</div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  {meta.map(([k, v], idx) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'flex-start', borderBottom: idx < meta.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ padding: '10px 14px', minWidth: 128, flexShrink: 0, background: 'var(--surface-50)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>{k}</div>
                      <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-heading)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {typeExtra.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Type-Specific Fields</div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  {typeExtra.map(([k, v], idx) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'flex-start', borderBottom: idx < typeExtra.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ padding: '10px 14px', minWidth: 128, flexShrink: 0, background: 'var(--surface-50)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>{fieldLabel(k)}</div>
                      <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-heading)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doc.desc && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Description</div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 13, color: 'var(--text-color)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {doc.desc}
                </div>
              </div>
            )}

            {doc.docRelations?.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Relationships · {doc.docRelations.length}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doc.docRelations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8,
                      background: r.isPending ? 'rgba(255, 193, 7,.05)' : 'rgba(25, 135, 84,.05)',
                      border: `1px solid ${r.isPending ? 'rgba(255, 193, 7,.2)' : 'rgba(25, 135, 84,.2)'}` }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: r.isPending ? 'rgba(255, 193, 7,.15)' : 'rgba(25, 135, 84,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 9, color: r.isPending ? '#d97706' : '#16a34a', fontWeight: 900 }}>↔</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: r.isPending ? '#d97706' : '#16a34a', fontWeight: 700, marginBottom: 2 }}>
                          {r.label}{r.targetType ? ` · ${r.targetType}` : ''}{r.isPending ? ' · PENDING' : ''}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.targetTitle}</div>
                        {r.section && <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--primary)', marginTop: 2 }}>{r.section}</div>}
                        {r.note && <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2, fontStyle: 'italic' }}>{r.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doc.approval && (
              <div>
                <div style={{ ...LS, marginBottom: 10 }}>Reviewer Remarks</div>
                <div style={{ borderRadius: 12, border: `1px solid ${statusAccent}44`, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: doc.status === 'approved' ? 'rgba(25, 135, 84,.06)' : doc.status === 'rejected' ? 'rgba(220, 53, 69,.06)' : 'rgba(255, 193, 7,.06)', borderBottom: doc.approval.comments ? `1px solid ${statusAccent}22` : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StatusIconV size={16} color={statusAccent} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: statusAccent }}>
                        {doc.status === 'approved' ? 'Document Approved' : doc.status === 'rejected' ? 'Document Rejected' : 'Pending Review'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                        By {doc.approval.approver_first_name
                          ? `${doc.approval.approver_first_name} ${doc.approval.approver_last_name || ''}`.trim()
                          : doc.approval.approver_username || '—'}
                        {doc.approval.acted_at && <> · {doc.approval.acted_at.split('T')[0]}</>}
                      </div>
                    </div>
                  </div>
                  {doc.approval.comments && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-card)' }}>
                      {parseDisplayRemarks(doc.approval.comments).map(({ num, text }) => (
                        <div key={num} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 9, background: 'var(--surface-ground)', border: `1px solid ${statusAccent}22`, alignItems: 'flex-start' }}>
                          <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, background: statusBg, border: `1px solid ${statusAccent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: statusAccent }}>{num}</span>
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-color)', lineHeight: 1.6, flex: 1 }}>{text || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Highlights from reviewer */}
            {annotations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...LS, marginBottom: 8 }}>Highlights ({annotations.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {annotations.map(ann => (
                    <div key={ann.id}
                      onClick={() => {
                        if (ann.isDocx) {
                          const span = docxViewRef.current?.querySelector(`[data-docx-annot="${ann.id}"]`);
                          if (span) span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                          scrollToAnnotation(ann);
                        }
                      }}
                      style={{ display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 8, background: ann.color, border: '1px solid rgba(0,0,0,.1)', alignItems: 'flex-start', cursor: 'pointer', transition: 'filter .15s' }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.92)'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                      {ann.isDocx ? (
                        <>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>T</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {ann.text && <div style={{ fontSize: 10.5, color: 'rgba(0,0,0,.55)', fontStyle: 'italic', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{ann.text.slice(0, 45)}{ann.text.length > 45 ? '…' : ''}"</div>}
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.75)', lineHeight: 1.4 }}>{ann.comment || <span style={{ opacity: 0.5 }}>No comment</span>}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>P{ann.page}</span>
                          <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,.75)', lineHeight: 1.5, flex: 1 }}>{ann.comment || <span style={{ opacity: 0.5 }}>No comment</span>}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
