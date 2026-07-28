import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle, XCircle, FileText, ChevronDown, Search, Clock,
  Check, X, Eye, Link, ChevronRight, ArrowRight,
  ZoomIn, ZoomOut, RotateCw, ExternalLink, Plus, Highlighter, MessageCircle,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.BASE_URL + 'pdf.worker.min.js';
import mammoth from 'mammoth';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';
import { getApproverDocuments, getPdfFile, reviewDocument, getDepartmentLinkRequests, reviewDepartmentLink } from '../services/pdf';
import { createNotification } from '../services/notifications';
import { getPendingActParts, getAllActParts, reviewActPart } from '../services/act_parts';

// Constants

const TYPE_COLORS = {
  'Act':                 { accent: '#214aab', bg: 'rgba(33, 74, 171,.08)',  text: '#1e40af' },
  'Amendment':           { accent: '#ffc107', bg: 'rgba(255, 193, 7,.08)', text: '#d97706' },
  'Notification':        { accent: '#8b5cf6', bg: 'rgba(139,92,246,.08)', text: '#7c3aed' },
  'Circular':            { accent: '#14b8a6', bg: 'rgba(20,184,166,.08)', text: '#0f766e' },
  'Policy':              { accent: '#198754', bg: 'rgba(25, 135, 84,.08)',  text: '#16a34a' },
  'Rules & Regulations': { accent: '#dc3545', bg: 'rgba(220, 53, 69,.08)',  text: '#dc2626' },
  'Order/Gazette':     { accent: '#eab308', bg: 'rgba(234,179,8,.08)',  text: '#a16207' },
  'Bye Laws':            { accent: '#0ea5e9', bg: 'rgba(14,165,233,.08)', text: '#0369a1' },
  'Miscellaneous':       { accent: '#64748b', bg: 'rgba(100,116,139,.08)',text: '#475569' },
};

// Maps a raw document-type string (as used for filtering/comparison, e.g. d.type === type)
// to its docTypes.* translation key — display label only, never the underlying value.
const TYPE_LABEL_KEY = {
  'Act':                 'act',
  'Amendment':           'amendment',
  'Notification':        'notification',
  'Circular':            'circular',
  'Policy':              'policy',
  'Rules & Regulations': 'rulesRegulations',
  'Order/Gazette':       'orderGazette',
  'Bye Laws':            'byeLaws',
  'Miscellaneous':       'miscellaneous',
};

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};

function parseDisplayRemarks(str) {
  if (!str) return [];
  const lines = str.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const m = line.match(/^Remark (\d+):\s*(.*)/);
    return m ? { num: parseInt(m[1]), text: m[2] } : { num: i + 1, text: line };
  });
}

// Page data for the PDF fallback view — only ever built from real data the
// uploader/OCR pipeline provided via the API. No confidence scores or body
// text are ever synthesised on the frontend.
function getDocPageData(doc) {
  if (doc.extractedPages && doc.extractedPages.length > 0) {
    return {
      pageCount: doc.extractedPages.length,
      pages: doc.extractedPages.map((text, i) => ({ pageNum: i + 1, text: text || '' })),
    };
  }
  if (doc.extractedText) {
    return { pageCount: 1, pages: [{ pageNum: 1, text: doc.extractedText }] };
  }
  return { pageCount: doc.pages || 1, pages: [{ pageNum: 1, text: '' }] };
}

// Shared page navigation
// Both PDF and OCR panels share the same currentPage state (lifted to ThreePanelReview)
// so they scroll together.
function PageNav({ currentPage, totalPages, onPageChange }) {
  const { t } = useTranslation('approver');
  return (
    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--surface-50)', flexShrink: 0 }}>
      <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={currentPage === 1}
        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: currentPage === 1 ? '#94a3b8' : 'var(--text-color-secondary)', fontSize: 11, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
        {t('common.prev')}
      </button>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
        {currentPage} / {totalPages}
      </span>
      <button onClick={() => onPageChange(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: currentPage === totalPages ? '#94a3b8' : 'var(--text-color-secondary)', fontSize: 11, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
        {t('common.next')}
      </button>
    </div>
  );
}

// PDF Viewer Panel
// Renders real PDFs as stacked canvases (pdfjs-dist) so scroll can be detected
// and synced with OcrTextPanel. Mock docs use the styled layout fallback.
function PdfViewerPanel({ doc, ocrData, currentPage, onPageChange, totalPages, rotation, onRotate, blobUrl, onTotalPagesChange, annotations = [], onAnnotationsChange, highlightMode = false, onHighlightModeChange, onScrollRef, docxHtml = null }) {
  const { t } = useTranslation('approver');
  const [zoom, setZoom]     = useState(100);
  const containerRef        = useRef(null);
  const canvasRefs          = useRef([]);
  const [pdfDoc, setPdfDoc] = useState(null);
  const suppressRef         = useRef(false);
  const scrollDetectedRef   = useRef(false);

  const [selectedColor,  setSelectedColor]  = useState('rgba(253,224,71,.55)');
  const [drawState,      setDrawState]      = useState('idle');
  const [dragStart,      setDragStart]      = useState(null);
  const [dragRect,       setDragRect]       = useState(null);
  const [pendingRect,    setPendingRect]    = useState(null);
  const [popupComment,   setPopupComment]   = useState('');
  const [activeAnnotId,  setActiveAnnotId]  = useState(null);
  const svgRefs = useRef([]);
  const docxContainerRef                      = useRef(null);
  const [pendingDocxText, setPendingDocxText] = useState(null);

  const pageData = ocrData.pages.find(p => p.pageNum === currentPage) || ocrData.pages[0];
  const numPages = pdfDoc ? pdfDoc.numPages : totalPages;

  // Load PDF document
  useEffect(() => {
    if (!doc.fileUrl) return;
    let cancelled = false;
    setPdfDoc(null);
    pdfjsLib.getDocument({ url: encodeURI(doc.fileUrl) }).promise
      .then(pdf => {
        if (!cancelled) {
          setPdfDoc(pdf);
          onTotalPagesChange?.(pdf.numPages);
        }
      })
      .catch(e => console.error('PDF load:', e));
    return () => { cancelled = true; };
  }, [doc.fileUrl]);

  // Render all pages whenever pdfDoc / zoom / rotation changes
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const scale = (zoom / 100) * 1.5;
    for (let i = 0; i < pdfDoc.numPages; i++) {
      const canvas = canvasRefs.current[i];
      if (!canvas) continue;
      pdfDoc.getPage(i + 1).then(page => {
        if (cancelled) return;
        const vp = page.getViewport({ scale, rotation });
        canvas.width  = vp.width;
        canvas.height = vp.height;
        page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      });
    }
    return () => { cancelled = true; };
  }, [pdfDoc, zoom, rotation]);

  useEffect(() => {
    if (!docxContainerRef.current || !docxHtml) return;
    docxContainerRef.current.innerHTML = docxHtml;
  }, [docxHtml]);

  useEffect(() => {
    if (!docxContainerRef.current || !docxHtml) return;
    docxContainerRef.current.querySelectorAll('[data-docx-annot]').forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    annotations.filter(a => a.isDocx).forEach(ann => applyDocxHighlight(docxContainerRef.current, ann));
  }, [annotations, docxHtml]);

  // Scroll to currentPage only when the change comes from nav buttons / external source,
  // NOT when it comes from handleScroll (which would create a conflicting scroll-back).
  useEffect(() => {
    if (scrollDetectedRef.current) { scrollDetectedRef.current = false; return; }
    const canvas = canvasRefs.current[currentPage - 1];
    if (!canvas || !containerRef.current) return;
    suppressRef.current = true;
    const top = canvas.parentElement?.offsetTop ?? canvas.offsetTop;
    containerRef.current.scrollTo({ top: top - 8, behavior: 'smooth' });
    setTimeout(() => { suppressRef.current = false; }, 700);
  }, [currentPage]);

  // Detect most-visible page while user scrolls and push to parent
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
    if (best + 1 !== currentPage) {
      scrollDetectedRef.current = true;
      onPageChange(best + 1);
    }
  }

  function getSvgFractional(e, pageIdx) {
    const svg = svgRefs.current[pageIdx];
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      pageIdx,
    };
  }

  function handleSvgMouseDown(e, pageIdx) {
    if (drawState !== 'idle') return;
    e.preventDefault();
    const pt = getSvgFractional(e, pageIdx);
    if (!pt) return;
    setDragStart(pt);
    setDragRect({ w: 0, h: 0 });
    setDrawState('drawing');
  }

  function handleSvgMouseMove(e, pageIdx) {
    if (drawState !== 'drawing' || !dragStart || dragStart.pageIdx !== pageIdx) return;
    const pt = getSvgFractional(e, pageIdx);
    if (!pt) return;
    setDragRect({ w: pt.x - dragStart.x, h: pt.y - dragStart.y });
  }

  function handleSvgMouseUp(e, pageIdx) {
    if (drawState !== 'drawing' || !dragStart || dragStart.pageIdx !== pageIdx) return;
    const pt = getSvgFractional(e, pageIdx);
    if (!pt) return;
    const w = pt.x - dragStart.x;
    const h = pt.y - dragStart.y;
    if (Math.abs(w) < 0.01 || Math.abs(h) < 0.01) {
      setDrawState('idle');
      setDragStart(null);
      setDragRect(null);
      return;
    }
    setPendingRect({
      page: pageIdx + 1,
      x: Math.min(dragStart.x, dragStart.x + w),
      y: Math.min(dragStart.y, dragStart.y + h),
      w: Math.abs(w),
      h: Math.abs(h),
    });
    setPopupComment('');
    setDrawState('popup');
    setDragRect(null);
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

  function applyDocxHighlight(container, ann) {
    if (!container || !ann.text) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf(ann.text);
      if (idx < 0) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + ann.text.length);
      const span = document.createElement('span');
      span.style.cssText = `background-color:${ann.color};border-radius:2px;cursor:pointer;padding:0 1px;`;
      span.dataset.docxAnnot = ann.id;
      if (ann.comment) span.title = ann.comment;
      span.addEventListener('click', e => { e.stopPropagation(); setActiveAnnotId(ann.id); });
      try { range.surroundContents(span); } catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
      return;
    }
  }

  function handleDocxMouseUp() {
    if (!highlightMode || !onAnnotationsChange) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || !docxContainerRef.current?.contains(sel.anchorNode)) return;
    setPendingDocxText(text);
    setPopupComment('');
    setDrawState('popup');
    sel.removeAllRanges();
  }

  function confirmDocxAnnotation() {
    if (!pendingDocxText) return;
    onAnnotationsChange?.([...annotations, {
      id: crypto.randomUUID(),
      text: pendingDocxText,
      comment: popupComment.trim(),
      color: selectedColor,
      isDocx: true,
    }]);
    setPendingDocxText(null);
    setPopupComment('');
    setDrawState('idle');
  }

  // Keep the ref current on every render so ThreePanelReview can call it
  if (onScrollRef) onScrollRef.current = (ann) => {
    if (ann.isDocx) {
      const span = docxContainerRef.current?.querySelector(`[data-docx-annot="${ann.id}"]`);
      if (span) span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      scrollToAnnotation(ann);
    }
  };

  function confirmAnnotation() {
    if (!pendingRect) return;
    const newAnnot = {
      id: crypto.randomUUID(),
      ...pendingRect,
      color: selectedColor,
      comment: popupComment.trim(),
    };
    onAnnotationsChange?.([...annotations, newAnnot]);
    setPendingRect(null);
    setPopupComment('');
    setDrawState('idle');
    setDragStart(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <Eye size={13} color="var(--primary)" />
        <span style={{ fontSize: 'var(--font-size-small)', fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>{docxHtml ? t('pdfViewer.documentPreview') : t('pdfViewer.originalPdf')}</span>
        {blobUrl && !docxHtml && (
          <a href={blobUrl} target="_blank" rel="noreferrer" title={t('pdfViewer.openInNewTab')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>
            <ExternalLink size={11} /> {t('common.open')}
          </a>
        )}
        {!docxHtml && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={onRotate} title={t('pdfViewer.rotate')}
              style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)' }}>
              <RotateCw size={11} />
            </button>
            <button onClick={() => setZoom(z => Math.max(70, z - 10))}
              style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)' }}>
              <ZoomOut size={11} />
            </button>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', minWidth: 34, textAlign: 'center' }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))}
              style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 5, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)' }}>
              <ZoomIn size={11} />
            </button>
          </div>
        )}
        {/* Highlight mode toggle + color palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <button
            onClick={() => onHighlightModeChange?.(!highlightMode)}
            title={highlightMode ? t('pdfViewer.exitHighlightMode') : docxHtml ? t('pdfViewer.selectTextToHighlight') : t('pdfViewer.drawHighlightOnPdf')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 5, border: highlightMode ? '1.5px solid #ffc107' : '1px solid var(--surface-border)', background: highlightMode ? 'rgba(255, 193, 7,.12)' : 'var(--surface-ground)', color: highlightMode ? '#b45309' : 'var(--text-color-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}>
            <Highlighter size={11} />
            {highlightMode ? t('pdfViewer.exitHighlight') : t('pdfViewer.highlight')}
          </button>
          {highlightMode && ['rgba(253,224,71,.55)', 'rgba(134,239,172,.55)', 'rgba(147,197,253,.55)', 'rgba(249,168,212,.55)'].map(c => (
            <button key={c} onClick={() => setSelectedColor(c)} title={t('pdfViewer.pickColor')}
              style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: selectedColor === c ? '2.5px solid #374151' : '1px solid rgba(0,0,0,.2)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
          ))}
        </div>
      </div>

      {/* Content area */}
      {docxHtml ? (
        <div
          ref={docxContainerRef}
          onMouseUp={handleDocxMouseUp}
          style={{ flex: 1, overflow: 'auto', background: 'white', padding: '32px 40px', color: '#1a1a1a', lineHeight: 1.8, fontSize: 13, cursor: highlightMode ? 'text' : 'auto' }}
        />
      ) : doc.fileUrl ? (
        <div ref={containerRef} onScroll={handleScroll}
          style={{ flex: 1, overflow: 'auto', background: '#525659', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {!pdfDoc && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.7)' }}>{t('pdfViewer.loadingPdf')}</span>
            </div>
          )}
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
              <canvas ref={el => { canvasRefs.current[i] = el; }}
                style={{ display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,.5)', maxWidth: '100%' }} />
              <svg ref={el => { svgRefs.current[i] = el; }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  cursor: highlightMode ? 'crosshair' : 'default',
                  pointerEvents: highlightMode || annotations.some(a => a.page === i + 1) ? 'auto' : 'none' }}
                onMouseDown={e => highlightMode && handleSvgMouseDown(e, i)}
                onMouseMove={e => highlightMode && handleSvgMouseMove(e, i)}
                onMouseUp={e => highlightMode && handleSvgMouseUp(e, i)}>

                {/* Existing annotations */}
                {annotations.filter(a => a.page === i + 1).map(ann => (
                  <g key={ann.id} onClick={e => { e.stopPropagation(); setActiveAnnotId(ann.id); }} style={{ cursor: 'pointer' }}>
                    <rect x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} width={`${ann.w * 100}%`} height={`${ann.h * 100}%`}
                      fill={ann.color} stroke="rgba(0,0,0,.25)" strokeWidth="1" />
                    <foreignObject x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} width="20" height="20" style={{ overflow: 'visible' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={9} color="white" />
                      </div>
                    </foreignObject>
                  </g>
                ))}

                {/* Live drag rect while drawing */}
                {drawState === 'drawing' && dragRect && dragStart?.pageIdx === i && (
                  <rect
                    x={`${Math.min(dragStart.x, dragStart.x + dragRect.w) * 100}%`}
                    y={`${Math.min(dragStart.y, dragStart.y + dragRect.h) * 100}%`}
                    width={`${Math.abs(dragRect.w) * 100}%`}
                    height={`${Math.abs(dragRect.h) * 100}%`}
                    fill={selectedColor} stroke="#ffc107" strokeWidth="1.5" strokeDasharray="4 3" />
                )}
              </svg>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', background: '#d1d5db', padding: 16 }}>
          <div style={{
            background: 'white', borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            padding: '40px 44px', minHeight: 480,
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'top center',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>{t('pdfViewer.governmentOfHaryana')}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: 6 }}>{doc.title}</div>
              <div style={{ fontSize: 11, color: '#444', fontFamily: 'Arial, sans-serif' }}>{doc.dept}&nbsp;·&nbsp;{t('pdfViewer.yearLabel')}: {doc.year}&nbsp;·&nbsp;{doc.type}</div>
            </div>
            <div style={{ borderTop: '1px solid #bbb', marginBottom: 20 }} />
            <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.95, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {pageData?.text || t('pdfViewer.documentContentNotAvailable')}
            </div>
            <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#777', fontFamily: 'Arial, sans-serif' }}>
              <span>v{doc.version || '1.0'}&nbsp;·&nbsp;{doc.legalStatus || t('documentDetails.activeStatus')}</span>
              <span>{t('pdfViewer.pageOf', { current: currentPage, total: totalPages })}</span>
              <span>{doc.uploader || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Draw-comment popup */}
      {drawState === 'popup' && (pendingRect || pendingDocxText) && (
        <>
          <div onClick={() => { setDrawState('idle'); setPendingRect(null); setPendingDocxText(null); setDragStart(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1101, width: 300, background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
            borderRadius: 12, padding: '14px 16px', boxShadow: '0 12px 40px rgba(0,0,0,.25)',
            display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', letterSpacing: '.07em' }}>
              {pendingDocxText
                ? t('pdfViewer.highlightPreview', { text: `${pendingDocxText.slice(0, 35)}${pendingDocxText.length > 35 ? '…' : ''}` })
                : t('pdfViewer.addCommentPage', { page: pendingRect?.page })}
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 4, background: selectedColor, border: '1px solid rgba(0,0,0,.15)' }} />
            <textarea
              autoFocus
              value={popupComment}
              onChange={e => setPopupComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) pendingDocxText ? confirmDocxAnnotation() : confirmAnnotation();
                if (e.key === 'Escape') { setDrawState('idle'); setPendingRect(null); setPendingDocxText(null); setDragStart(null); }
              }}
              placeholder={t('pdfViewer.describeIssuePlaceholder')}
              rows={3}
              style={{ resize: 'none', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 13, padding: '8px 10px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{t('pdfViewer.ctrlEnterToSave')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setDrawState('idle'); setPendingRect(null); setPendingDocxText(null); setDragStart(null); }}
                style={{ flex: 1, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '7px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: 'var(--text-color-secondary)', fontFamily: 'var(--font)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={pendingDocxText ? confirmDocxAnnotation : confirmAnnotation}
                style={{ flex: 1, background: '#ffc107', color: 'white', border: 'none', borderRadius: 7, padding: '7px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Annotation detail popup */}
      {activeAnnotId && (() => {
        const ann = annotations.find(a => a.id === activeAnnotId);
        if (!ann) return null;
        return (
          <>
            <div onClick={() => setActiveAnnotId(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 1101, width: 280, background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
              borderRadius: 12, padding: '14px 16px', boxShadow: '0 12px 40px rgba(0,0,0,.25)',
              display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', letterSpacing: '.07em' }}>
                  {ann.isDocx ? t('pdfViewer.textHighlight') : t('pdfViewer.highlightPage', { page: ann.page })}
                </div>
                <button onClick={() => setActiveAnnotId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}><X size={14} /></button>
              </div>
              {ann.isDocx && ann.text && (
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 11.5, color: 'var(--text-color-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{ann.text.slice(0, 80)}{ann.text.length > 80 ? '…' : ''}"
                </div>
              )}
              <div style={{ padding: '8px 10px', borderRadius: 7, background: ann.color, border: '1px solid rgba(0,0,0,.12)', fontSize: 13, color: 'rgba(0,0,0,.75)', lineHeight: 1.5, minHeight: 40 }}>
                {ann.comment || <span style={{ opacity: 0.5 }}>{t('common.noComment')}</span>}
              </div>
              <button onClick={() => { onAnnotationsChange?.(annotations.filter(a => a.id !== activeAnnotId)); setActiveAnnotId(null); }}
                style={{ background: 'rgba(220, 53, 69,.07)', border: '1px solid rgba(220, 53, 69,.25)', color: '#dc2626', borderRadius: 7, padding: '7px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('pdfViewer.deleteHighlight')}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}


// Document Details Panel
// Shows every field the uploader filled in: metadata, description, hierarchy,
// type-specific fields, legal authorities, relationships, amendment provisions.
function DocumentDetailsPanel({ doc, reviewAnnotations = [], onScrollToAnnotation }) {
  const { t } = useTranslation('approver');
  const meta = [
    [t('documentDetails.fields.title'),           doc.title],
    [t('documentDetails.fields.type'),            doc.type],
    [t('documentDetails.fields.department'),      doc.dept],
    [t('documentDetails.fields.year'),            doc.year ? String(doc.year) : null],
    [t('documentDetails.fields.version'),         doc.version || '1.0'],
    [t('documentDetails.fields.referenceNo'),     doc.referenceNumber || null],
    [t('documentDetails.fields.issueDate'),       doc.enactmentDate || null],
    [t('documentDetails.fields.effectiveFrom'),   doc.effectiveFrom || null],
    [t('documentDetails.fields.gazetteRef'),      doc.gazette || null],
    [t('documentDetails.fields.legalAuthority'),  doc.authority || null],
    [t('documentDetails.fields.uploader'),        doc.uploader || null],
    [t('documentDetails.fields.uploadDate'),      doc.uploadedAt || null],
    [t('documentDetails.fields.pages'),           doc.pages ? t('documentDetails.pagesValue', { count: doc.pages }) : null],
    [t('documentDetails.fields.legalStatus'),     doc.legalStatus || t('documentDetails.activeStatus')],
    [t('documentDetails.fields.fileName'),        doc.fileName || null],
  ].filter(([, v]) => v);

  // Fields already shown in meta — exclude from typeExtra to avoid duplication
  const TYPEEXTRA_SKIP = new Set([
    'effectiveFrom', 'commencementDate',
    'gazetteRef',
    'actNumber', 'amendmentNumber', 'circularNumber',
    'notificationNumber', 'orderNumber', 'policyNumber', 'ruleNumber',
  ]);
  const typeExtra = doc.typeFields
    ? Object.entries(doc.typeFields).filter(([k, v]) => v && !TYPEEXTRA_SKIP.has(k))
    : [];

  // Map camelCase keys to readable labels
  const fieldLabel = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <FileText size={13} color="var(--primary)" />
        <span style={{ fontSize: 'var(--font-size-small)', fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>{t('documentDetails.heading')}</span>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--primary)', fontWeight: 700, background: 'rgba(33, 74, 171,.1)', padding: '2px 8px', borderRadius: 20 }}>
          {t('documentDetails.uploaderInfoBadge')}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Core Metadata ── */}
        <div>
          <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.metadata')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {meta.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', minWidth: 105, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Type-Specific Fields ── */}
        {typeExtra.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.typeSpecificFields')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {typeExtra.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', minWidth: 105, flexShrink: 0 }}>{fieldLabel(k)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Parent Act (Amendment only) ── */}
        {doc.type === 'Amendment' && (() => {
          const parent = doc.relationships?.find(r => r.type === 'parent_act' || r.type === 'amends');
          if (!parent) return null;
          return (
            <div>
              <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.parentHierarchy')}</div>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '.07em', color: '#214aab', background: 'rgba(33, 74, 171,.12)', padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
                    {parent.type === 'parent_act' ? t('documentDetails.parentActBadge') : t('documentDetails.amendsBadge')}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {parent.document_name || t('documentDetails.documentFallback', { id: parent.pdf_id })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
                  <ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--mono)' }}>
                    {doc.title}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '1px 6px', borderRadius: 8 }}>
                    {t('documentDetails.amendmentBadge')}
                  </span>
                </div>

                {/* Changes made per section */}
                {doc.amendmentProvisions?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', letterSpacing: '.07em' }}>{t('documentDetails.changesMade')}</div>
                    {doc.amendmentProvisions.map((p, i) => {
                      const CHANGE_COLORS = { Amended: '#ffc107', Substituted: '#0d6efd', Inserted: '#198754', Deleted: '#dc3545', Expanded: '#8b5cf6' };
                      const color = CHANGE_COLORS[p.changeType] || '#94a3b8';
                      return (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: `1px solid ${color}33` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: p.description ? 5 : 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', color, background: `${color}18`, padding: '1px 7px', borderRadius: 8 }}>
                              {p.changeType || t('documentDetails.amendedDefault')}
                            </span>
                            {[p.chapter, p.section, p.subsection].filter(Boolean).map((v, j, arr) => (
                              <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {j > 0 && <ChevronRight size={10} color="#94a3b8" />}
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-heading)', fontFamily: 'var(--mono)' }}>{v}</span>
                              </span>
                            ))}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{p.description}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Description ── */}
        {doc.desc && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.description')}</div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {doc.desc}
            </div>
          </div>
        )}

        {/* ── Hierarchy Tags ── */}
        {(doc.hierarchy?.act || doc.hierarchy?.chapter || doc.hierarchy?.section) && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.hierarchyTags')}</div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)', fontSize: 11.5, color: 'var(--text-color-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, lineHeight: 1.8 }}>
              {doc.hierarchy.act && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{doc.hierarchy.act}</span>}
              {doc.hierarchy.chapter && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.chapter}</span></>)}
              {doc.hierarchy.section && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.section}</span></>)}
              {doc.hierarchy.subsection && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.subsection}</span></>)}
            </div>
          </div>
        )}

        {/* ── Legal Authorities ── */}
        {doc.legalAuthorities?.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.legalAuthorities')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.legalAuthorities.map((a, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: a.sections?.some(s => s) ? 4 : 0 }}>{a.act}</div>
                  {a.sections?.filter(s => s).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {a.sections.filter(s => s).map((s, j) => (
                        <span key={j} style={{ fontSize: 10.5, fontFamily: 'var(--mono)', background: 'rgba(33, 74, 171,.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Document Relationships ── */}
        {doc.docRelations?.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.relationships', { count: doc.docRelations.length })}</div>
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
                      {r.label}{r.targetType ? ` · ${r.targetType}` : ''}{r.isPending ? ` · ${t('documentDetails.pendingSuffix')}` : ''}
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

        {/* ── Amendment Provisions ── */}
        {doc.amendmentProvisions?.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.amendmentProvisions')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.amendmentProvisions.map((p, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255, 193, 7,.06)', border: '1px solid rgba(255, 193, 7,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: p.before || p.after || p.description ? 6 : 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', color: '#d97706', fontWeight: 700, fontSize: 10.5, background: 'rgba(255, 193, 7,.15)', padding: '2px 7px', borderRadius: 10 }}>{p.changeType || t('documentDetails.amendedDefault')}</span>
                    {p.section && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)' }}>{t('documentDetails.sectionLabel', { section: p.section })}{p.chapter ? ` · ${t('documentDetails.chapterSuffix', { chapter: p.chapter })}` : ''}{p.subsection ? ` (${p.subsection})` : ''}</span>}
                  </div>
                  {p.description && <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{p.description}</div>}
                  {p.before && <div style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(220, 53, 69,.05)', padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(220, 53, 69,.4)' }}>{t('documentDetails.before', { value: p.before })}</div>}
                  {p.after  && <div style={{ fontSize: 11, color: '#16a34a', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(25, 135, 84,.05)',  padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(25, 135, 84,.4)' }}>{t('documentDetails.after', { value: p.after })}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Parent Act ── */}
        {doc.parentAct && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.parentAct')}</div>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)', fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              {doc.parentAct}
            </div>
          </div>
        )}

        {/* ── Highlights ── */}
        {reviewAnnotations.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>{t('documentDetails.highlights', { count: reviewAnnotations.length })}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reviewAnnotations.map(ann => (
                <div key={ann.id} onClick={() => onScrollToAnnotation?.(ann)}
                  style={{ display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 8, background: ann.color, border: '1px solid rgba(0,0,0,.1)', alignItems: 'flex-start', cursor: 'pointer', transition: 'filter .15s' }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.92)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                  {ann.isDocx ? (
                    <>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>T</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {ann.text && <div style={{ fontSize: 10.5, color: 'rgba(0,0,0,.55)', fontStyle: 'italic', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{ann.text.slice(0, 45)}{ann.text.length > 45 ? '…' : ''}"</div>}
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.75)', lineHeight: 1.4 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('common.noComment')}</span>}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>P{ann.page}</span>
                      <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,.75)', lineHeight: 1.5, flex: 1 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('common.noComment')}</span>}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// 2-Panel Review View
// PDF on the left, uploader-filled document details on the right.
function ThreePanelReview({ doc, remarks, onRemarksChange, onDecide, deciding }) {
  const { t } = useTranslation('approver');
  const [currentPage, setCurrentPage]   = useState(1);
  const [rotation, setRotation]         = useState(0);
  const [blobUrl, setBlobUrl]           = useState(null);
  const [pdfTotalPages, setPdfTotalPages] = useState(null);
  const [annotations, setAnnotations]   = useState(() => {
    try { return doc.annotationsJson ? JSON.parse(doc.annotationsJson) : []; }
    catch { return []; }
  });
  const [highlightMode, setHighlightMode] = useState(false);
  const [docxHtml, setDocxHtml]           = useState(null);
  const pdfScrollRef = useRef(null);

  const [remarkLines, setRemarkLines] = useState(() => {
    if (!remarks) return [''];
    const lines = remarks.split('\n').filter(l => l.trim());
    const texts = lines.map(l => l.replace(/^Remark \d+:\s*/, ''));
    return texts.length > 0 ? texts : [''];
  });

  function updateRemark(idx, val) {
    const updated = remarkLines.map((r, i) => i === idx ? val : r);
    setRemarkLines(updated);
    onRemarksChange(
      updated.some(l => l.trim())
        ? updated.map((l, i) => `Remark ${i + 1}: ${l}`).join('\n')
        : ''
    );
  }

  function addRemark() {
    setRemarkLines(prev => [...prev, '']);
  }

  function removeRemark(idx) {
    const updated = remarkLines.length > 1 ? remarkLines.filter((_, i) => i !== idx) : [''];
    setRemarkLines(updated);
    onRemarksChange(
      updated.some(l => l.trim())
        ? updated.map((l, i) => `Remark ${i + 1}: ${l}`).join('\n')
        : ''
    );
  }

  const docPageData = useMemo(() => getDocPageData(doc), [doc.id]);
  const totalPages   = pdfTotalPages || docPageData.pageCount;

  useEffect(() => {
    if (!doc.id || !localStorage.getItem('token')) return;
    let url = null;
    setBlobUrl(null); setDocxHtml(null);
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

  const docWithUrl = blobUrl ? { ...doc, fileUrl: blobUrl } : doc;

  return (
    <div style={{ borderTop: '1px solid var(--surface-border)' }}>

      {/* 2-panel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', height: 520, borderBottom: '1px solid var(--surface-border)' }}>

        {/* Panel 1 — Original PDF */}
        <div style={{ borderRight: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <PdfViewerPanel
            doc={docWithUrl} ocrData={docPageData}
            currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages}
            rotation={rotation} onRotate={() => setRotation(r => (r + 90) % 360)}
            blobUrl={blobUrl} onTotalPagesChange={setPdfTotalPages}
            annotations={annotations} onAnnotationsChange={setAnnotations}
            highlightMode={highlightMode} onHighlightModeChange={setHighlightMode}
            onScrollRef={pdfScrollRef}
            docxHtml={docxHtml}
          />
        </div>

        {/* Panel 2 — Document Details */}
        <div style={{ overflow: 'hidden' }}>
          <DocumentDetailsPanel
            doc={doc}
            reviewAnnotations={annotations}
            onScrollToAnnotation={(ann) => pdfScrollRef.current?.(ann)}
          />
        </div>
      </div>

      {/* Page navigation */}
      <div style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)' }}>
        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {/* Approve / Reject — only for pending docs */}
      {doc.status === 'pending' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Numbered remark fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {remarkLines.map((remark, idx) => (
              <div key={idx}>
                <div style={{ ...LABEL, marginBottom: 5 }}>{t('common.remarkNumber', { num: idx + 1 })}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={remark}
                    onChange={e => updateRemark(idx, e.target.value)}
                    placeholder={t('common.enterRemarkPlaceholder', { num: idx + 1 })}
                    style={{
                      flex: 1, background: 'var(--surface-ground)',
                      border: '1px solid var(--surface-border)', borderRadius: 8,
                      color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 13,
                      padding: '9px 12px', outline: 'none', transition: 'border-color .2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--surface-border)'}
                  />
                  {remarkLines.length > 1 && (
                    <button onClick={() => removeRemark(idx)}
                      style={{
                        background: 'rgba(220, 53, 69,.06)', border: '1px solid rgba(220, 53, 69,.2)',
                        color: '#dc2626', borderRadius: 7, width: 32, height: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Remark + action buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={addRemark}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1.5px dashed var(--surface-border)',
                color: 'var(--primary)', borderRadius: 7, padding: '6px 14px',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(33, 74, 171,.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.background = 'transparent'; }}>
              <Plus size={13} /> {t('common.addRemark')}
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onDecide('rejected', annotations)} disabled={!!deciding}
                style={{ background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.3)', color: '#b91c1c', padding: '9px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: deciding ? 'not-allowed' : 'pointer', opacity: deciding && deciding !== 'rejected' ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding) e.currentTarget.style.background = 'rgba(220, 53, 69,.15)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(220, 53, 69,.08)'; }}>
                <X size={14} /> {deciding === 'rejected' ? t('common.rejecting') : t('common.reject')}
              </button>
              <button onClick={() => onDecide('approved', annotations)} disabled={!!deciding}
                style={{ background: 'rgba(25, 135, 84,.1)', border: '1px solid rgba(25, 135, 84,.3)', color: '#1e40af', padding: '9px 20px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: deciding ? 'not-allowed' : 'pointer', opacity: deciding && deciding !== 'approved' ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding) e.currentTarget.style.background = 'rgba(25, 135, 84,.18)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(25, 135, 84,.1)'; }}>
                <Check size={14} /> {deciding === 'approved' ? t('common.approving') : t('common.approve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks display for already-reviewed documents */}
      {doc.status !== 'pending' && doc.remarks && (
        <div style={{
          padding: '12px 20px',
          background: doc.status === 'approved' ? 'rgba(25, 135, 84,.04)' : 'rgba(220, 53, 69,.04)',
          borderTop: '1px solid var(--surface-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {doc.status === 'approved'
              ? <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
              : <XCircle    size={14} color="#dc3545" style={{ flexShrink: 0, marginTop: 2 }} />
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: doc.status === 'approved' ? '#16a34a' : '#dc3545', marginBottom: 6 }}>
                {doc.status === 'approved' ? t('review.approvedHeader') : t('review.rejectedHeader')}
              </div>
              {parseDisplayRemarks(doc.remarks).map(({ num, text }) => (
                <div key={num} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, color: doc.status === 'approved' ? '#16a34a' : '#dc3545', flexShrink: 0, minWidth: 62 }}>
                    {t('common.remarkNumber', { num })}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{text || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Main ApproverDashboard
function mapApiDoc(d) {
  return {
    id:              d.id,
    uid:             `approver-${d.id}`,
    title:           d.document_name || d.original_filename || `Document #${d.id}`,
    type:            d.document_type_name || 'Act',
    dept:            d.department_name || '—',
    year:            d.issue_date
                       ? new Date(d.issue_date).getFullYear()
                       : new Date(d.created_at).getFullYear(),
    status:          d.status || 'pending',
    version:         d.version_no || '1.0',
    fileName:        d.original_filename,
    fileSize:        d.file_size,
    desc:            d.description || '',
    uploadedAt:      d.created_at?.split('T')[0] || '',
    enactmentDate:   d.issue_date || '',
    effectiveFrom:   d.effective_from || '',
    referenceNumber: d.reference_number || '',
    shortTitle:      d.short_title || '',
    gazette:         d.gazette_reference || '',
    authority:       d.legal_authority || '',
    remarks:         d.latest_approval?.comments || '',
    annotationsJson: d.latest_approval?.annotations_json || null,
    fileUrl:         null,
    relationships:   d.relationships || [],
    docRelations:    (d.relationships || [])
      .filter(r => r.type !== 'parent_act')
      .map(r => ({
        label:       (r.type || 'references').replace(/_/g, ' '),
        targetId:    r.pdf_id ? `api-${r.pdf_id}` : null,
        targetTitle: r.document_name || `Document #${r.pdf_id}`,
        targetType:  r.document_type_name || '',
        note:        '',
        section:     '',
        isPending:   false,
      })),
    typeFields: {
      ...(d.valid_until            ? { validity:            d.valid_until }            : {}),
      ...(d.sector_domain          ? { sector:              d.sector_domain }          : {}),
      ...(d.implementing_agency    ? { implementingAgency:  d.implementing_agency }    : {}),
      ...(d.next_review_date       ? { reviewDate:          d.next_review_date }       : {}),
      ...(d.rule_making_authority  ? { ruleAuthority:       d.rule_making_authority }  : {}),
      // Act-specific extended fields
      ...(d.act_year               ? { actYear:            d.act_year }               : {}),
      ...(d.long_title             ? { longTitle:          d.long_title }             : {}),
      ...(d.regional_title         ? { regionalTitle:      d.regional_title }         : {}),
      ...(d.notification_no        ? { notificationNo:     d.notification_no }        : {}),
      ...(d.act_code               ? { actCode:            d.act_code }               : {}),
      ...(d.so_reason              ? { soReason:           d.so_reason }              : {}),
      ...(d.no_of_rules            ? { noOfRules:          d.no_of_rules }            : {}),
      ...(d.no_of_notifications    ? { noOfNotifications:  d.no_of_notifications }    : {}),
      ...(d.no_of_regulations      ? { noOfRegulations:     d.no_of_regulations }      : {}),
      ...(d.no_of_circulars        ? { noOfCirculars:      d.no_of_circulars }        : {}),
      ...(d.no_of_statutes         ? { noOfStatutes:       d.no_of_statutes }         : {}),
      ...(d.no_of_ordinances       ? { noOfOrdinances:      d.no_of_ordinances }       : {}),
      ...(d.no_of_orders           ? { noOfOrders:          d.no_of_orders }           : {}),
      ...(d.keywords               ? { keywords:            d.keywords }               : {}),
      ...(d.is_repealed            ? { repealed:            'Yes' }                    : {}),
    },
    ...(() => {
      const raw = d.description || '';
      const match = raw.match(/\n?__PROVISIONS__:(.+)$/s);
      let amendmentProvisions = [];
      if (match) { try { amendmentProvisions = JSON.parse(match[1]); } catch {} }
      return {
        desc: raw.replace(/\n?__PROVISIONS__:.+$/s, '').trim(),
        amendmentProvisions,
      };
    })(),
  };
}

// Link Request Review Panel
// Shows the PDF + document details for a pending link request with Approve/Reject actions.
function LinkReviewPanel({ lr, onBack, onReview, deciding }) {
  const { t } = useTranslation('approver');
  const isReadOnly = lr.link_status !== 'pending';

  const [blobUrl, setBlobUrl]             = useState(null);
  const [currentPage, setCurrentPage]     = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(null);
  const [rotation, setRotation]           = useState(0);
  const [remarkLines, setRemarkLines]     = useState(['']);
  const [annotations, setAnnotations]     = useState([]);
  const [highlightMode, setHighlightMode] = useState(false);
  const [docxHtml, setDocxHtml]           = useState(null);
  const pdfScrollRef                      = useRef(null);

  // For read-only mode: parse stored annotations from the review
  const storedAnnotations = useMemo(() => {
    if (!isReadOnly || !lr.annotations_json) return [];
    try { return JSON.parse(lr.annotations_json); } catch { return []; }
  }, [isReadOnly, lr.annotations_json]);

  const displayAnnotations = isReadOnly ? storedAnnotations : annotations;

  function updateRemark(idx, val) {
    setRemarkLines(prev => prev.map((r, i) => i === idx ? val : r));
  }
  function addRemark() {
    setRemarkLines(prev => [...prev, '']);
  }
  function removeRemark(idx) {
    setRemarkLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : ['']);
  }
  function buildComments() {
    const filled = remarkLines.filter(l => l.trim());
    if (!filled.length) return null;
    return filled.map((l, i) => `Remark ${i + 1}: ${l}`).join('\n');
  }
  function buildAnnotationsJson() {
    return annotations.length ? JSON.stringify(annotations) : null;
  }
  const hasRemarks = remarkLines.some(l => l.trim());

  const docPageData = useMemo(
    () => getDocPageData({ title: lr.document_name || '', type: lr.document_type_name || 'Act' }),
    [lr.pdf_id],
  );
  const totalPages = pdfTotalPages || docPageData.pageCount;

  useEffect(() => {
    if (!lr.pdf_id || !localStorage.getItem('token')) return;
    let url = null;
    setBlobUrl(null); setDocxHtml(null);
    getPdfFile(lr.pdf_id)
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
  }, [lr.pdf_id]);

  const docForViewer = useMemo(() => ({
    id: lr.pdf_id,
    title: lr.document_name || 'Document',
    type: lr.document_type_name || 'Act',
    fileUrl: blobUrl || null,
  }), [lr.pdf_id, lr.document_name, lr.document_type_name, blobUrl]);

  const typeColor    = TYPE_COLORS[lr.document_type_name] || TYPE_COLORS['Miscellaneous'];
  const requesterName = lr.requested_by_first_name
    ? `${lr.requested_by_first_name} ${lr.requested_by_last_name || ''}`.trim()
    : lr.requested_by_username || t('common.unknown');

  function InfoRow({ label, value, mono }) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', width: 130, flexShrink: 0, paddingTop: 2 }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', fontFamily: mono ? 'var(--mono)' : 'var(--font)', flex: 1, lineHeight: 1.5 }}>{value || '—'}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
          {t('linkReview.backToRequests')}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lr.document_name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>
            {t('linkReview.requestedByPrefix')} <strong style={{ color: 'var(--text-color)' }}>{requesterName}</strong> · {lr.requested_at?.split('T')[0]}
          </div>
        </div>
        <span style={{ background: typeColor.bg, color: typeColor.text, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {lr.document_type_name}
        </span>
        {lr.version_no && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
            v{lr.version_no}
          </span>
        )}
      </div>

      {/* 2-panel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '58% 42%', height: 560, borderBottom: '1px solid var(--surface-border)' }}>

        {/* Left — PDF Viewer */}
        <div style={{ borderRight: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <PdfViewerPanel
            doc={docForViewer}
            ocrData={docPageData}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
            rotation={rotation}
            onRotate={() => setRotation(r => (r + 90) % 360)}
            blobUrl={blobUrl}
            onTotalPagesChange={setPdfTotalPages}
            annotations={displayAnnotations}
            onAnnotationsChange={isReadOnly ? undefined : setAnnotations}
            highlightMode={isReadOnly ? false : highlightMode}
            onHighlightModeChange={isReadOnly ? undefined : setHighlightMode}
            onScrollRef={pdfScrollRef}
            docxHtml={docxHtml}
          />
        </div>

        {/* Right — Details */}
        <div style={{ overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Document Info card */}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
            <div style={{ ...LABEL, marginBottom: 12 }}>{t('linkReview.documentInformation')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label={t('linkReview.documentName')} value={lr.document_name} />
              <InfoRow label={t('linkReview.type')} value={
                <span style={{ background: typeColor.bg, color: typeColor.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {lr.document_type_name}
                </span>
              } />
              {lr.version_no && <InfoRow label={t('linkReview.version')} value={`v${lr.version_no}`} mono />}
              <InfoRow label={t('linkReview.documentStatus')} value={
                <span style={{
                  background: lr.document_status === 'approved' ? 'rgba(25, 135, 84,.12)' : lr.document_status === 'rejected' ? 'rgba(220, 53, 69,.1)' : 'rgba(255, 193, 7,.1)',
                  color: lr.document_status === 'approved' ? '#16a34a' : lr.document_status === 'rejected' ? '#dc2626' : '#d97706',
                  padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                }}>
                  {lr.document_status}
                </span>
              } />
              <InfoRow label={t('linkReview.originalDepartment')} value={lr.original_department_name || '—'} />
            </div>
          </div>

          {/* Link Request card */}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255, 193, 7,.04)', border: '1px solid rgba(255, 193, 7,.2)' }}>
            <div style={{ ...LABEL, marginBottom: 12, color: '#d97706' }}>{t('linkReview.linkRequest')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label={t('linkReview.requestedBy')} value={requesterName} />
              {lr.requested_by_username && <InfoRow label={t('linkReview.username')} value={lr.requested_by_username} mono />}
              <InfoRow label={t('linkReview.requestedAt')} value={lr.requested_at?.split('T')[0]} mono />
              <InfoRow label={t('linkReview.status')} value={
                <span style={{
                  background: lr.link_status === 'approved' ? 'rgba(25, 135, 84,.12)' : lr.link_status === 'rejected' ? 'rgba(220, 53, 69,.1)' : 'rgba(255, 193, 7,.12)',
                  color: lr.link_status === 'approved' ? '#16a34a' : lr.link_status === 'rejected' ? '#dc2626' : '#d97706',
                  padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                }}>
                  {lr.link_status}
                </span>
              } />
            </div>
          </div>

          {/* Annotations */}
          {displayAnnotations.length > 0 && (
            <div>
              <div style={{ ...LABEL, marginBottom: 8 }}>{t('linkReview.highlights', { count: displayAnnotations.length })}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {displayAnnotations.map((ann, i) => (
                  <div key={ann.id || i}
                    onClick={() => pdfScrollRef.current?.(ann)}
                    style={{ display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 8, background: ann.color, border: '1px solid rgba(0,0,0,.1)', alignItems: 'flex-start', cursor: 'pointer', transition: 'filter .15s' }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.92)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                    {ann.isDocx ? (
                      <>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>T</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {ann.text && <div style={{ fontSize: 10.5, color: 'rgba(0,0,0,.55)', fontStyle: 'italic', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{ann.text.slice(0, 45)}{ann.text.length > 45 ? '…' : ''}"</div>}
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.75)', lineHeight: 1.4 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('common.noComment')}</span>}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>P{ann.page}</span>
                        <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,.75)', lineHeight: 1.5, flex: 1 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('common.noComment')}</span>}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page nav */}
      <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Remarks + Approve / Reject — or read-only summary */}
      {isReadOnly ? (
        /* ── Read-only: show stored reviewer remarks ── */
        (() => {
          const isApproved = lr.link_status === 'approved';
          const accent = isApproved ? '#16a34a' : '#dc2626';
          const accentBg = isApproved ? 'rgba(25, 135, 84,.06)' : 'rgba(220, 53, 69,.06)';
          const accentBorder = isApproved ? 'rgba(25, 135, 84,.25)' : 'rgba(220, 53, 69,.25)';
          const ReviewerIcon = isApproved ? CheckCircle : XCircle;
          const reviewerName = lr.reviewed_by_first_name
            ? `${lr.reviewed_by_first_name} ${lr.reviewed_by_last_name || ''}`.trim()
            : lr.reviewed_by_username || t('linkReview.reviewerFallback');
          const parsedRemarks = parseDisplayRemarks(lr.review_comments);
          return (
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...LABEL }}>{t('linkReview.reviewDetails')}</div>
              {/* Status banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: accentBg, border: `1px solid ${accentBorder}` }}>
                <ReviewerIcon size={22} color={accent} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                    {isApproved ? t('linkReview.linkApproved') : t('linkReview.linkRejected')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>
                    {t('linkReview.byPrefix')} <strong style={{ color: 'var(--text-color)' }}>{reviewerName}</strong>
                    {lr.reviewed_at && <> · {lr.reviewed_at.split('T')[0]}</>}
                  </div>
                </div>
              </div>
              {/* Remarks */}
              {parsedRemarks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {parsedRemarks.map(({ num, text }) => (
                    <div key={num} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--surface-ground)', border: `1px solid ${accentBorder}`, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: accentBg, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: accent }}>{num}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-color)', lineHeight: 1.6, flex: 1 }}>{text || '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic', padding: '8px 0' }}>
                  {t('linkReview.noRemarksProvided')}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* ── Editable: remark inputs + Approve/Reject ── */
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--surface-border)' }}>

          {/* Numbered remark fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {remarkLines.map((remark, idx) => (
              <div key={idx}>
                <div style={{ ...LABEL, marginBottom: 5 }}>{t('common.remarkNumber', { num: idx + 1 })}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={remark}
                    onChange={e => updateRemark(idx, e.target.value)}
                    placeholder={t('common.enterRemarkPlaceholder', { num: idx + 1 })}
                    style={{
                      flex: 1, background: 'var(--surface-ground)',
                      border: '1px solid var(--surface-border)', borderRadius: 8,
                      color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 13,
                      padding: '9px 12px', outline: 'none', transition: 'border-color .2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--surface-border)'}
                  />
                  {remarkLines.length > 1 && (
                    <button onClick={() => removeRemark(idx)}
                      style={{
                        background: 'rgba(220, 53, 69,.06)', border: '1px solid rgba(220, 53, 69,.2)',
                        color: '#dc2626', borderRadius: 7, width: 32, height: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Remark + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={addRemark}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1.5px dashed var(--surface-border)',
                color: 'var(--primary)', borderRadius: 7, padding: '6px 14px',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(33, 74, 171,.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.background = 'transparent'; }}>
              <Plus size={13} /> {t('common.addRemark')}
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onReview(lr.link_id, 'rejected', buildComments(), buildAnnotationsJson())}
                disabled={deciding === lr.link_id || !hasRemarks}
                title={!hasRemarks ? t('linkReview.enterRemarkBeforeRejecting') : undefined}
                style={{ background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.3)', color: '#b91c1c', padding: '9px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: (deciding === lr.link_id || !hasRemarks) ? 'not-allowed' : 'pointer', opacity: (deciding === lr.link_id || !hasRemarks) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding && hasRemarks) e.currentTarget.style.background = 'rgba(220, 53, 69,.15)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(220, 53, 69,.08)'; }}>
                <X size={14} /> {deciding === lr.link_id ? t('common.rejecting') : t('common.reject')}
              </button>
              <button onClick={() => onReview(lr.link_id, 'approved', buildComments(), buildAnnotationsJson())}
                disabled={deciding === lr.link_id}
                style={{ background: 'rgba(25, 135, 84,.1)', border: '1px solid rgba(25, 135, 84,.3)', color: '#1e40af', padding: '9px 20px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: deciding === lr.link_id ? 'not-allowed' : 'pointer', opacity: deciding === lr.link_id ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding) e.currentTarget.style.background = 'rgba(25, 135, 84,.18)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(25, 135, 84,.1)'; }}>
                <Check size={14} /> {deciding === lr.link_id ? t('common.approving') : t('common.approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApproverDashboard({ activePage, onNavigate, onAuditLog, documents, onApprove }) {
  const { user } = useAuth();
  const { t } = useTranslation('approver');
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState('');
  const [remarks, setRemarks]     = useState({});
  const [deciding, setDeciding]   = useState(null); // { id, action } while API call is in-flight
  const [expanded, setExpanded]   = useState(null);
  const [linkRequests, setLinkRequests]   = useState([]);
  const [linkLoading, setLinkLoading]     = useState(false);
  const [linkDeciding, setLinkDeciding]   = useState(null); // link_id being actioned
  const [viewingLink, setViewingLink]     = useState(null); // lr being viewed in detail
  const [linkFilter, setLinkFilter]       = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [filter, setFilter]       = useState('');
  const [searchQ, setSearchQ]     = useState('');
  const [cardFilter, setCardFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all' — always one of these on the merged dashboard
  const tableRef  = useRef(null);
  const expandedRef = useRef(null);

  // ── Act Parts Review state ────────────────────────────────────────────────
  const [apItems, setApItems]           = useState([]);
  const [apLoading, setApLoading]       = useState(false);
  const [apError, setApError]           = useState('');
  const [apViewing, setApViewing]       = useState(null); // { item, partsData }
  const [apDetailLoading, setApDetailLoading] = useState(false);
  const [apToast, setApToast]           = useState(null); // { type, msg }

  useEffect(() => {
    if (activePage !== 'actparts') return;
    setApLoading(true);
    setApError('');
    getPendingActParts()
      .then(res => setApItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setApError('Failed to load pending act part submissions.'))
      .finally(() => setApLoading(false));
  }, [activePage]);

  useEffect(() => {
    if (!apToast) return;
    const timer = setTimeout(() => setApToast(null), 4500);
    return () => clearTimeout(timer);
  }, [apToast]);

  async function openApDetail(item) {
    setApDetailLoading(true);
    try {
      const res = await getAllActParts(item.pdf_document_id);
      setApViewing({ item, partsData: res.data });
    } catch {
      setApViewing({ item, partsData: null });
    } finally {
      setApDetailLoading(false);
    }
  }

  async function handleApReview(action, { comment }) {
    if (!apViewing) return;
    const { item } = apViewing;
    try {
      await reviewActPart({ pdf_document_id: item.pdf_document_id, part_type: item.part_type, action, comments: comment });
      setApItems(prev => prev.filter(i => !(i.pdf_document_id === item.pdf_document_id && i.part_type === item.part_type)));
      setApToast({ type: 'success', msg: `${item.part_type} ${action === 'approved' ? 'approved' : 'rejected'} successfully.` });
    } catch (err) {
      setApToast({ type: 'error', msg: err?.response?.data?.detail || 'Could not submit review.' });
      throw err;
    }
  }

  function fetchDocs(propDocs) {
    if (!localStorage.getItem('token')) {
      // Demo mode — use documents prop directly
      if (propDocs?.length > 0) setDocs(propDocs);
      return;
    }
    setLoading(true);
    setApiError('');
    getApproverDocuments()
      .then(res => setDocs((res.data.documents || []).map(mapApiDoc)))
      .catch(err => setApiError(err.response?.data?.detail || t('dashboard.failedToLoadDocuments')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchDocs(documents); }, [activePage, documents]);

  useEffect(() => {
    if (activePage !== 'links') { setViewingLink(null); return; } // reset when leaving link requests
    if (!localStorage.getItem('token')) return;
    setLinkLoading(true);
    getDepartmentLinkRequests(linkFilter)
      .then(res => setLinkRequests(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLinkLoading(false));
  }, [activePage, linkFilter]);

  async function handleReviewLink(link_id, action, comments, annotations_json) {
    setLinkDeciding(link_id);
    try {
      await reviewDepartmentLink(link_id, action, comments, annotations_json);
      setViewingLink(null);
      // Refetch for current filter so the list stays accurate
      const res = await getDepartmentLinkRequests(linkFilter);
      setLinkRequests(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    setLinkDeciding(null);
  }

  // Scroll expanded card into view
  useEffect(() => {
    if (expanded !== null && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);

  const pending  = docs.filter(d => d.status === 'pending');
  const reviewed = docs.filter(d => d.status !== 'pending');

  function decide(id, decision, annotations = []) {
    const doc      = docs.find(d => d.id === id);
    const remark   = remarks[id] || '';
    const hasToken = !!localStorage.getItem('token');
    const annotationsJson = annotations.length ? JSON.stringify(annotations) : undefined;
    setDeciding({ id, action: decision });

    function apply() {
      setDocs(ds => ds.map(d => d.id === id
        ? { ...d, status: decision, ...(remark ? { remarks: remark } : {}) }
        : d
      ));
      if (decision === 'approved') onApprove?.(id);
      onAuditLog?.(`${decision === 'approved' ? 'Approved' : 'Rejected'} document: ${doc?.title}${remark ? ` — "${remark}"` : ''}`);
      createNotification({
        toRole:   'uploader',
        type:     decision === 'approved' ? 'document_approved' : 'document_rejected',
        title:    decision === 'approved' ? 'Document Approved' : 'Document Rejected',
        message:  decision === 'approved'
          ? `"${doc?.title}" has been approved by the approver`
          : `"${doc?.title}" has been rejected by the approver`,
        remark:   remark || null,
        docId:    id,
        docTitle: doc?.title,
      });
      if (expanded === id) setExpanded(null);
    }

    if (!hasToken) {
      apply();
      setDeciding(null);
      return;
    }

    reviewDocument(id, decision, remark || undefined, annotationsJson)
      .then(() => apply())
      .catch(err => {
        const detail = err.response?.data?.detail || 'Action failed. Please try again.';
        setApiError(detail);
      })
      .finally(() => setDeciding(null));
  }

  const validTypes = new Set(Object.keys(TYPE_COLORS));

  const base = cardFilter === 'all' ? docs : docs.filter(d => d.status === cardFilter);

  const allFiltered = base.filter(d => {
    const mType = validTypes.has(d.type);          // hide unknown types
    const mF    = !filter || d.type === filter;
    const mS    = !searchQ || d.title.toLowerCase().includes(searchQ.toLowerCase());
    return mType && mF && mS;
  });

  const isFiltered = filter || searchQ || cardFilter;
  const list = allFiltered;

  const allTypes = Object.keys(TYPE_COLORS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

      {/* ── Link Requests tab ──────────────────────────────────────────────── */}
      {activePage === 'links' && (
        viewingLink ? (
          <LinkReviewPanel
            lr={viewingLink}
            onBack={() => setViewingLink(null)}
            onReview={handleReviewLink}
            deciding={linkDeciding}
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('linkRequests.heading')}</span>
            <div style={{ display: 'flex', background: 'var(--surface-ground)', borderRadius: 8, padding: 3, gap: 2, border: '1px solid var(--surface-border)', marginLeft: 'auto' }}>
              {[
                { key: 'pending',  label: t('linkRequests.tabs.pending'),  color: '#d97706', bg: 'rgba(255, 193, 7,.12)' },
                { key: 'approved', label: t('linkRequests.tabs.approved'), color: '#16a34a', bg: 'rgba(25, 135, 84,.12)' },
                { key: 'rejected', label: t('linkRequests.tabs.rejected'), color: '#dc2626', bg: 'rgba(220, 53, 69,.1)' },
              ].map(tab => {
                const active = linkFilter === tab.key;
                return (
                  <button key={tab.key} onClick={() => setLinkFilter(tab.key)}
                    style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                      background: active ? tab.bg : 'transparent',
                      color: active ? tab.color : 'var(--text-color-secondary)',
                      outline: active ? `1px solid ${tab.color}44` : 'none',
                    }}>
                    {tab.label}
                    {linkRequests.length > 0 && active && (
                      <span style={{ marginLeft: 5, background: active ? tab.color : 'var(--surface-border)', color: active ? 'white' : 'var(--text-color-secondary)', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>
                        {linkRequests.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {linkLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2].map(i => <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', animation: 'pulse 1.4s ease-in-out infinite' }} />)}
            </div>
          )}
          {!linkLoading && linkRequests.length === 0 && (
            <Card style={{ textAlign: 'center', padding: '64px 0' }}>
              <CheckCircle size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>
                {t('linkRequests.noRequestsOfType', { status: t(`linkRequests.statusLower.${linkFilter}`) })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>
                {linkFilter === 'pending' ? t('linkRequests.pendingHint') : t('linkRequests.genericHint', { status: t(`linkRequests.statusLower.${linkFilter}`) })}
              </div>
            </Card>
          )}
          {linkRequests.map(lr => {
            const lsColor = lr.link_status === 'approved' ? '#16a34a' : lr.link_status === 'rejected' ? '#dc2626' : '#d97706';
            const lsBg    = lr.link_status === 'approved' ? 'rgba(25, 135, 84,.1)' : lr.link_status === 'rejected' ? 'rgba(220, 53, 69,.1)' : 'rgba(255, 193, 7,.1)';
            const reviewerName = lr.reviewed_by_first_name
              ? `${lr.reviewed_by_first_name} ${lr.reviewed_by_last_name || ''}`.trim()
              : lr.reviewed_by_username || null;
            return (
            <Card key={lr.link_id} padding="0">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lr.document_name}
                    </span>
                    {lr.version_no && (
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>
                        v{lr.version_no}
                      </span>
                    )}
                    <span style={{ fontSize: 10.5, fontWeight: 700, background: lsBg, color: lsColor, padding: '2px 9px', borderRadius: 20, textTransform: 'capitalize', flexShrink: 0 }}>
                      {lr.link_status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                    <span style={{ background: 'rgba(255, 193, 7,.1)', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600, fontSize: 10.5 }}>{lr.document_type_name}</span>
                    <span>{t('linkRequests.originallyFromPrefix')} <strong style={{ color: 'var(--text-color)' }}>{lr.original_department_name || t('common.unknown')}</strong></span>
                    <span>·</span>
                    <span>{t('linkRequests.requestedByPrefix')} <strong style={{ color: 'var(--text-color)' }}>
                      {lr.requested_by_first_name
                        ? `${lr.requested_by_first_name} ${lr.requested_by_last_name || ''}`.trim()
                        : lr.requested_by_username || t('common.unknown')}
                    </strong></span>
                    <span>·</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{lr.requested_at?.split('T')[0]}</span>
                    {reviewerName && (
                      <>
                        <span>·</span>
                        <span>{lr.link_status === 'approved' ? t('linkRequests.approvedByPrefix') : t('linkRequests.rejectedByPrefix')} <strong style={{ color: lsColor }}>{reviewerName}</strong></span>
                        {lr.reviewed_at && <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{lr.reviewed_at.split('T')[0]}</span>}
                      </>
                    )}
                  </div>
                  {lr.review_comments && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 7, background: lsBg, border: `1px solid ${lsColor}33`, fontSize: 12, color: lsColor, fontStyle: 'italic' }}>
                      {lr.review_comments}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => setViewingLink(lr)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-ground)'; e.currentTarget.style.color = 'var(--text-color-secondary)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}>
                    <Eye size={13} /> {t('linkRequests.viewDocument')}
                  </button>
                  {lr.link_status === 'pending' && (<>
                    <button onClick={() => handleReviewLink(lr.link_id, 'rejected')}
                      disabled={linkDeciding === lr.link_id}
                      style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(220, 53, 69,.3)', background: 'rgba(220, 53, 69,.06)', color: '#dc2626', fontSize: 12.5, fontWeight: 700, cursor: linkDeciding === lr.link_id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: linkDeciding === lr.link_id ? 0.6 : 1 }}>
                      {t('common.reject')}
                    </button>
                    <button onClick={() => handleReviewLink(lr.link_id, 'approved')}
                      disabled={linkDeciding === lr.link_id}
                      style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: linkDeciding === lr.link_id ? 'rgba(25, 135, 84,.5)' : '#16a34a', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: linkDeciding === lr.link_id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
                      {linkDeciding === lr.link_id ? t('linkRequests.processing') : t('common.approve')}
                    </button>
                  </>)}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
        )
      )}

      {/* Welcome header */}
      {!['links', 'actparts'].includes(activePage) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-h3)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-.01em' }}>
              {t('dashboard.greeting', { name: user?.name || '' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-p2)', color: 'var(--text-color-secondary)', marginTop: 4 }}>
              {t('dashboard.subtitle')}
            </div>
          </div>
          {user?.dept && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '5px 12px', borderRadius: 20 }}>
              {user.dept}
            </span>
          )}
        </div>
      )}

      {/* Quick actions */}
      {activePage !== 'links' && activePage !== 'actparts' && (
        <div>
          <div style={{ ...LABEL, marginBottom: 10 }}>{t('dashboard.quickActionsLabel')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <Card onClick={() => onNavigate?.('links')}
              style={{ display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer', borderLeft: '3px solid #8b5cf6', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Link size={21} color="#8b5cf6" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>{t('dashboard.quickActions.linkRequestsTitle')}</div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>{t('dashboard.quickActions.linkRequestsDesc')}</div>
              </div>
              <ArrowRight size={16} color="#8b5cf6" style={{ flexShrink: 0, opacity: .8 }} />
            </Card>
            <Card onClick={() => onNavigate?.('actparts')}
              style={{ display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer', borderLeft: '3px solid #0ea5e9', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(14,165,233,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={21} color="#0ea5e9" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>Act Parts Review</div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>Review sections, schedules, annexures, appendices and forms submitted by uploaders</div>
              </div>
              <ArrowRight size={16} color="#0ea5e9" style={{ flexShrink: 0, opacity: .8 }} />
            </Card>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!['links', 'actparts'].includes(activePage) && loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', opacity: 1 - i * 0.2, animation: 'pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* API error */}
      {!['links', 'actparts'].includes(activePage) && apiError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626' }}>
          <XCircle size={15} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, flex: 1 }}>{apiError}</span>
          <button onClick={fetchDocs}
            style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(220, 53, 69,.3)', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Overview / summary strip — doubles as the status filter for the list below */}
      {!['links', 'actparts'].includes(activePage) && (
        <div>
          <div style={{ ...LABEL, marginBottom: 10 }}>{t('dashboard.overviewLabel')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: Clock,       label: t('dashboard.summary.pending'),  value: pending.length,                                       bg: 'rgba(255, 193, 7,.12)', color: '#b45309', key: 'pending'  },
            { icon: CheckCircle, label: t('dashboard.summary.approved'), value: reviewed.filter(d => d.status === 'approved').length, bg: 'rgba(25, 135, 84,.12)',  color: '#198754', key: 'approved' },
            { icon: XCircle,     label: t('dashboard.summary.rejected'), value: reviewed.filter(d => d.status === 'rejected').length, bg: 'rgba(220, 53, 69,.12)',  color: '#dc3545', key: 'rejected' },
            { icon: FileText,    label: t('dashboard.summary.total'),    value: docs.length,                                          bg: 'rgba(33, 74, 171,.12)',  color: 'var(--primary)', key: 'all' },
          ].map(s => {
            const isActive = cardFilter === s.key;
            return (
            <Card key={s.key} onClick={() => { setCardFilter(s.key); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
              style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8, color: isActive ? s.color : undefined }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? s.color : 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: isActive ? s.color + '22' : s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                  <s.icon size={20} color={s.color} strokeWidth={1.8} />
                </div>
              </div>
            </Card>
          );})}
          </div>
        </div>
      )}

      {/* Filter + search */}
      {!['links', 'actparts'].includes(activePage) && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', flex: 1, maxWidth: 300 }}>
            <Search size={13} color="var(--text-color-secondary)" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t('dashboard.searchPlaceholder')}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
            {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
            {t('dashboard.documentCount', { count: list.length })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {allTypes.map(type => {
            const count  = base.filter(d => d.type === type).length;
            const active = filter === type;
            const c = TYPE_COLORS[type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
            return (
              <button key={type} onClick={() => setFilter(active ? '' : type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  background: active ? c.accent : 'var(--surface-card)',
                  border: `1.5px solid ${active ? c.accent : c.accent + '55'}`,
                  color: active ? 'white' : c.text || c.accent,
                  opacity: count === 0 ? 0.4 : 1,
                }}>
                {TYPE_LABEL_KEY[type] ? t(`docTypes.${TYPE_LABEL_KEY[type]}`) : type}
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-ground)', color: active ? 'white' : 'var(--text-color-secondary)', padding: '0px 5px', borderRadius: 10 }}>{count}</span>
              </button>
            );
          })}
          {filter && (
            <button onClick={() => setFilter('')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--surface-border)', color: 'var(--text-color-secondary)' }}>
              <X size={10} /> {t('common.clear')}
            </button>
          )}
        </div>
      </div>}

      {/* Empty state */}
      {!['links', 'actparts'].includes(activePage) && list.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '64px 0' }}>
          <CheckCircle size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>
            {cardFilter === 'pending' ? t('dashboard.emptyState.allCaughtUp') : t('dashboard.emptyState.noReviewedDocuments')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>
            {cardFilter === 'pending' ? t('dashboard.emptyState.noPendingSubmissions') : t('dashboard.emptyState.reviewedWillAppear')}
          </div>
        </Card>
      )}

      {/* Document cards */}
      {!['links', 'actparts'].includes(activePage) && <div ref={tableRef} style={{ scrollMarginTop: 16 }} />}
      {!['links', 'actparts'].includes(activePage) && list.map(doc => {
        const isOpen = expanded === doc.id;
        return (
          <div key={doc.id} ref={isOpen ? expandedRef : null}>
            <Card style={{ padding: 0, borderColor: isOpen ? 'rgba(33, 74, 171,.3)' : 'var(--surface-border)', transition: 'border-color .2s', overflow: 'hidden' }}>

              {/* Header row — click to expand */}
              <div onClick={() => setExpanded(isOpen ? null : doc.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 44, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
                  <FileText size={14} color="var(--primary)" />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--primary)', fontWeight: 700 }}>{t('dashboard.pdfBadge')}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, letterSpacing: '-.01em' }}>{doc.title}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      doc.type,
                      doc.dept,
                      String(doc.year),
                      doc.pages ? t('dashboard.pagesValue', { count: doc.pages }) : null,
                      doc.uploader ? t('dashboard.byUploader', { name: doc.uploader }) : null,
                      doc.uploadedAt || null,
                    ].filter(Boolean).map((v, i) => (
                      <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{v}</span>
                    ))}
                  </div>
                  {/* Remarks preview for reviewed docs (collapsed state) */}
                  {doc.status !== 'pending' && doc.remarks && !isOpen && (() => {
                    const parsed = parseDisplayRemarks(doc.remarks);
                    return (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-color-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                        {parsed.length <= 1
                          ? t('dashboard.remarkSummarySingle', { text: parsed[0]?.text ?? doc.remarks })
                          : t('dashboard.remarkSummaryMulti', { count: parsed.length, text: parsed[0].text })
                        }
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {/* Panel labels hint (pending only) */}
                  {!isOpen && doc.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { icon: Eye, color: '#214aab', label: t('dashboard.pdfBadge') },
                      ].map(({ icon: Icon, color, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 20, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                          <Icon size={10} color={color} />
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Badge label={doc.status} variant={doc.status} />
                  <span style={{ color: isOpen ? 'var(--primary)' : 'var(--text-color-secondary)', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'flex', alignItems: 'center' }}>
                    <ChevronDown size={17} />
                  </span>
                </div>
              </div>

              {/* 3-panel expanded view */}
              {isOpen && (
                <ThreePanelReview
                  doc={doc}
                  remarks={remarks[doc.id] || ''}
                  onRemarksChange={val => setRemarks(r => ({ ...r, [doc.id]: val }))}
                  onDecide={(decision, annots) => decide(doc.id, decision, annots)}
                  deciding={deciding?.id === doc.id ? deciding.action : null}
                />
              )}
            </Card>
          </div>
        );
      })}

      {/* ── Act Parts Review tab ──────────────────────────────────────────── */}
      {activePage === 'actparts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toast */}
          {apToast && (
            <div style={{ position: 'fixed', top: 24, right: 28, zIndex: 3000, background: apToast.type === 'success' ? '#d1fae5' : '#fee2e2', color: apToast.type === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${apToast.type === 'success' ? '#10b981' : '#dc3545'}`, borderRadius: 12, padding: '13px 22px', fontSize: 13.5, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontFamily: 'var(--font)' }}>
              {apToast.msg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-p1)', fontWeight: 800, color: 'var(--text-heading)' }}>Act Parts Review</span>
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)' }}>Pending submissions awaiting your decision</span>
          </div>

          {apLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 12, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', animation: 'pulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.2 }} />)}
            </div>
          )}

          {apError && (
            <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626', fontSize: 13 }}>{apError}</div>
          )}

          {!apLoading && !apError && apItems.length === 0 && (
            <Card style={{ textAlign: 'center', padding: '64px 0' }}>
              <CheckCircle size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>No pending act part submissions</div>
              <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>All caught up — nothing requires your review right now.</div>
            </Card>
          )}

          {!apLoading && !apError && apItems.length > 0 && (
            <Card style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 200px', background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ ...LABEL, padding: '10px 18px' }}>Act / Tab</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>Submitted By</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>Submitted At</div>
                <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)'}}>Actions</div>
              </div>

              {apItems.map(item => {
                const TAB_LABELS = { sections: 'Sections', schedule: 'Schedule', annexure: 'Annexure', appendix: 'Appendix', forms: 'Forms' };
                return (
                  <div key={`${item.pdf_document_id}-${item.part_type}`}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 200px', borderBottom: '1px solid var(--surface-border)', alignItems: 'center', minHeight: 60, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ padding: '10px 18px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 2 }}>{item.act_name || `Act #${item.pdf_document_id}`}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(14,165,233,.1)', color: '#0369a1', borderRadius: 4, padding: '1px 7px' }}>
                          {TAB_LABELS[item.part_type] || item.part_type}
                        </span>
                        {item.act_type && <span style={{ fontSize: 10.5, color: 'var(--text-color-secondary)' }}>{item.act_type}</span>}
                      </div>
                    </div>
                    <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>
                      {[item.submitter_first_name, item.submitter_last_name].filter(Boolean).join(' ') || item.submitter_username || '—'}
                    </div>
                    <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color-secondary)' }}>
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                    </div>
                    <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', gap: 8 }}>
                      <button onClick={() => openApDetail(item)} disabled={apDetailLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Eye size={13} /> View & Decide
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Detail + decision modal */}
          {apViewing && (
            <ApproverActPartsModal
              item={apViewing.item}
              partsData={apViewing.partsData}
              onClose={() => setApViewing(null)}
              onApprove={({ comment }) => handleApReview('approved', { comment })}
              onReject={({ comment }) => handleApReview('rejected', { comment })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Approver Act Parts detail + decision modal ────────────────────────────────
const AP_TAB_LABELS = { sections: 'Sections', schedule: 'Schedule', annexure: 'Annexure', appendix: 'Appendix', forms: 'Forms' };

function ApproverActPartsModal({ item, partsData, onClose, onApprove, onReject }) {
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(null); // 'approved' | 'rejected'
  const [submitting, setSubmitting] = useState(false);
  const partType = item?.part_type;

  function renderContent() {
    if (!partsData) return <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: '#dc3545' }}>Could not load content.</div>;

    const statusChip = (status) => {
      if (!status) return null;
      const s = { draft: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' }, pending: { bg: '#fef3c7', color: '#92400e', border: '#ffc107' }, approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981' }, rejected: { bg: '#fee2e2', color: '#991b1b', border: '#dc3545' }, pending_delete: { bg: '#fff1f2', color: '#9f1239', border: '#fda4af' } }[status];
      if (!s) return null;
      const label = { draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', pending_delete: 'Del. Pending' }[status] || status;
      return <span style={{ fontSize: 9.5, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: '1px 7px', flexShrink: 0, marginLeft: 6 }}>{label}</span>;
    };

    if (partType === 'sections') {
      const hasCh = partsData.has_chapters && partsData.chapters?.length > 0;
      if (hasCh) {
        return (partsData.chapters || []).map(ch => (
          <div key={ch.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(33, 74, 171,.1)', color: '#214aab', borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {ch.chapter_number || '—'}
              </span>
              {ch.chapter_title || '(No title)'}
              {statusChip(ch.status)}
            </div>
            {(ch.sections || []).map(sec => (
              <div key={sec.id} style={{ marginLeft: 20, marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span>{sec.section_number || '—'}{sec.section_title ? ` — ${sec.section_title}` : ''}</span>
                  {statusChip(sec.status)}
                </div>
                {sec.section_content && (
                  <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{sec.section_content}</div>
                )}
                {sec.original_filename && <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {sec.original_filename}</div>}
              </div>
            ))}
            {(!ch.sections || ch.sections.length === 0) && (
              <div style={{ marginLeft: 20, fontSize: 12, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>No sections</div>
            )}
          </div>
        ));
      }
      const flat = partsData.flat_sections || [];
      if (flat.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>No sections added.</div>;
      return flat.map(sec => (
        <div key={sec.id} style={{ marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span>{sec.section_number || '—'}{sec.section_title ? ` — ${sec.section_title}` : ''}</span>
            {statusChip(sec.status)}
          </div>
          {sec.section_content && (
            <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{sec.section_content}</div>
          )}
          {sec.original_filename && <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {sec.original_filename}</div>}
        </div>
      ));
    }

    const keyMap = { schedule: 'schedules', annexure: 'annexures', appendix: 'appendices', forms: 'forms' };
    const entries = partsData[keyMap[partType]] || [];
    if (entries.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>No entries added.</div>;
    return entries.map(e => (
      <div key={e.id} style={{ marginBottom: 10, padding: '10px 14px', background: 'var(--surface-ground)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span>{e.entry_number || '—'}{e.title ? ` — ${e.title}` : ''}</span>
          {statusChip(e.status)}
        </div>
        {e.description && (
          <div style={{ fontSize: 12, color: 'var(--text-color)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{e.description}</div>
        )}
        {e.original_filename && <div style={{ fontSize: 11.5, color: '#214aab', marginTop: 6 }}>📎 {e.original_filename}</div>}
      </div>
    ));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 800, color: 'var(--text-heading)' }}>
              {item?.act_name || `Act #${item?.pdf_document_id}`}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(14,165,233,.1)', color: '#0369a1', borderRadius: 4, padding: '2px 8px' }}>
                {AP_TAB_LABELS[partType] || partType}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                Submitted by {[item?.submitter_first_name, item?.submitter_last_name].filter(Boolean).join(' ') || item?.submitter_username}
                {item?.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleDateString()}` : ''}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>
          {renderContent()}
        </div>

        {/* Footer */}
        {!confirming ? (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setConfirming('rejected')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: '1.5px solid #dc3545', background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <XCircle size={14} /> Reject
            </button>
            <button onClick={() => setConfirming('approved')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <CheckCircle size={14} /> Approve
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Comments {confirming === 'rejected' && <span style={{ color: '#dc3545' }}>*</span>}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              placeholder={confirming === 'rejected' ? 'Reason for rejection (required)' : 'Optional comments…'}
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--surface-border)', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font)', resize: 'none', boxSizing: 'border-box', background: 'var(--surface-ground)', color: 'var(--text-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button onClick={() => setConfirming(null)} disabled={submitting}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Back
              </button>
              <button
                disabled={submitting || (confirming === 'rejected' && !comment.trim())}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    if (confirming === 'approved') await onApprove({ comment: comment.trim() || null });
                    else await onReject({ comment: comment.trim() });
                    onClose();
                  } catch { /* toast shown by parent */ } finally { setSubmitting(false); }
                }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: confirming === 'approved' ? '#10b981' : '#dc3545', color: 'white', fontSize: 13, fontWeight: 700, cursor: (submitting || (confirming === 'rejected' && !comment.trim())) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: (submitting || (confirming === 'rejected' && !comment.trim())) ? .5 : 1 }}>
                {submitting ? 'Submitting…' : confirming === 'approved' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
