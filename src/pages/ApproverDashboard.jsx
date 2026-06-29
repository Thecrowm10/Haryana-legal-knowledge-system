import { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle, XCircle, FileText, ChevronDown, Search, Clock,
  Check, X, Eye, AlignLeft, Cpu, Link, AlertTriangle, ChevronRight,
  ZoomIn, ZoomOut, RotateCw, ExternalLink,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { getApproverDocuments, getPdfFile, reviewDocument } from '../services/pdf';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  'Act':                 { accent: '#1a56db', bg: 'rgba(26,86,219,.08)',  text: '#1e40af' },
  'Amendment':           { accent: '#f59e0b', bg: 'rgba(245,158,11,.08)', text: '#d97706' },
  'Notification':        { accent: '#8b5cf6', bg: 'rgba(139,92,246,.08)', text: '#7c3aed' },
  'Circular':            { accent: '#14b8a6', bg: 'rgba(20,184,166,.08)', text: '#0f766e' },
  'Policy':              { accent: '#22c55e', bg: 'rgba(34,197,94,.08)',  text: '#16a34a' },
  'Rules & Regulations': { accent: '#ef4444', bg: 'rgba(239,68,68,.08)',  text: '#dc2626' },
  'Order / Gazette':     { accent: '#eab308', bg: 'rgba(234,179,8,.08)',  text: '#a16207' },
};

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};

// ─── Word confidence helpers ──────────────────────────────────────────────────
function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}
function wordConfidence(word) {
  const w = word.trim();
  if (!w) return 100;
  const seed = _hashStr(w);
  if (/^\.{3,}$/.test(w))      return 5  + seed % 12;
  if (/^[A-Z]{2,10}$/.test(w)) return 82 + seed % 15;
  if (/^[A-Za-z]+$/.test(w))   return 85 + seed % 14;
  if (/^\d+$/.test(w))         return 88 + seed % 10;
  const specialRatio = (w.match(/[^A-Za-z0-9\s.,;:()\-']/g) || []).length / w.length;
  if (specialRatio > 0.5) return 10 + seed % 25;
  if (specialRatio > 0.3) return 30 + seed % 25;
  if (specialRatio > 0.1) return 52 + seed % 25;
  return 70 + seed % 20;
}
// Build word-confidence token array from plain text (used for mock/demo docs)
function textToWords(text) {
  const tokens = [];
  text.split('\n').forEach((line, li, lines) => {
    line.split(/(\s+)/).forEach(token => {
      if (!token) return;
      tokens.push({ word: token, confidence: /^\s+$/.test(token) ? 100 : wordConfidence(token) });
    });
    if (li < lines.length - 1) tokens.push({ word: '\n', confidence: 100 });
  });
  return tokens;
}
// Impossible English bigrams — letter pairs that never appear in real English words.
// Keeping this small (~25) avoids false positives on legal/Hindi proper nouns.
const IMPOSSIBLE_BIGRAMS = new Set([
  'bk','bq','bx','cf','cj','cp','cv','cx',
  'fq','fx','gq','gx','hx','jf','jg','jq','jv','jx','jz',
  'kq','kx','pq','px','qb','qc','qd','qf','qg','qh','qj',
  'qk','ql','qm','qn','qp','qr','qs','qt','qv','qx','qy','qz',
  'sx','vb','vf','vj','vq','vx','wx','xj','xk','xt','xv',
  'yq','zj','zq','zx',
]);

// Phonotactic rules — English sound-combination constraints that OCR garbage violates.
// Skip check for: proper nouns (capital start), acronyms (ALL CAPS), short words (≤2).
function isSuspiciousWord(word) {
  const raw = word.replace(/[^a-zA-Z0-9]/g, '');
  if (raw.length < 3) return false;
  // Skip proper nouns and acronyms — too many false positives (Panchayat, IPC, etc.)
  if (/^[A-Z]/.test(word) && !/[a-z]/.test(word)) return false; // ALL-CAPS acronym
  if (/^[A-Z][a-z]/.test(word)) return false;                   // Title-case proper noun

  const w = raw.toLowerCase();

  // Rule 0 — digit immediately adjacent to a letter (OCR merge: "1l", "0O", "Acr3")
  if (/[0-9][a-z]|[a-z][0-9]/.test(w)) return true;

  // Rule 1 — classic OCR confusion pairs: lI, Il, 0O, 1I
  if (/[li][li]|[o0][o0]/.test(w)) return true;

  // Rule 2 — impossible English bigrams (2+ hits → flag, 1 hit alone may be edge case)
  let badBigrams = 0;
  for (let i = 0; i < w.length - 1; i++) {
    if (IMPOSSIBLE_BIGRAMS.has(w[i] + w[i + 1])) badBigrams++;
  }
  if (badBigrams >= 2) return true;
  if (badBigrams === 1 && w.length < 5) return true; // short garbled word like "fcr"

  // Rule 3 — max consecutive consonant cluster > 3 (English limit: "strength" = 4 is rare)
  const clusters = w.replace(/[aeiou]/g, ' ').split(' ').filter(Boolean);
  if (clusters.some(c => c.length > 4)) return true;

  // Rule 4 — vowel density < 20% for words longer than 5 chars
  if (w.length > 5) {
    const vowels = (w.match(/[aeiou]/g) || []).length;
    if (vowels / w.length < 0.20) return true;
  }

  return false;
}
// Returns the confidence to use for highlighting — caps high-confidence suspicious
// tokens at 45 so they render orange instead of green.
function effectiveConf(word, conf) {
  if (conf > 80 && isSuspiciousWord(word)) return 45;
  return conf;
}
// Map confidence score → highlight background colour
function confBg(conf) {
  if (conf >= 80) return 'rgba(34,197,94,.2)';
  if (conf >= 50) return 'rgba(234,179,8,.3)';
  if (conf >= 20) return 'rgba(249,115,22,.35)';
  return 'rgba(239,68,68,.4)';
}

// ─── OCR data ─────────────────────────────────────────────────────────────────
// Confidence is derived deterministically from doc.id so it doesn't flicker on re-render.
function getMockOcrData(doc) {
  const idNum     = typeof doc.id === 'number' ? doc.id : parseInt(String(doc.id), 10) || 0;
  const confidence = doc.ocrConfidence || (92 + (idNum % 8));

  // Real upload with per-page text and word-level confidence from PDF.js
  if (doc.extractedPages && doc.extractedPages.length > 0) {
    return {
      confidence,
      pageCount: doc.extractedPages.length,
      pages: doc.extractedPages.map((text, i) => ({
        pageNum:    i + 1,
        confidence: doc.ocrConfidence || 95,
        text:       text || '(no text on this page)',
        words:      doc.extractedWords?.[i] || textToWords(text || ''),
      })),
    };
  }

  // Real upload but only concatenated text (legacy)
  if (doc.extractedText) {
    return {
      confidence,
      pageCount: 1,
      pages: [{
        pageNum: 1, confidence: doc.ocrConfidence || 95,
        text:  doc.extractedText,
        words: textToWords(doc.extractedText),
      }],
    };
  }

  // Mock/demo document — synthesise metadata as OCR text
  const mockText = [
    doc.title, '',
    `Department : ${doc.dept}`,
    `Type       : ${doc.type}`,
    `Year       : ${doc.year}`,
    `Version    : ${doc.version || '1.0'}`,
    `Uploader   : ${doc.uploader || '—'}`,
    `Date       : ${doc.uploadedAt || '—'}`,
    doc.desc ? `\nDescription:\n${doc.desc}` : '',
  ].join('\n');

  return {
    confidence,
    pageCount: doc.pages || 1,
    pages: [{
      pageNum: 1, confidence: 94,
      text:  mockText,
      words: textToWords(mockText),
    }],
  };
}

// ─── AI analysis ──────────────────────────────────────────────────────────────
// Prefers real doc.hierarchy and doc.citations from the uploader when available,
// falls back to mock data for demo documents.
function getMockAiAnalysis(doc) {
  const citationSets = {
    'Act': [
      { citation: 'Constitution of India, Article 162', status: 'linked', matchedTitle: 'Constitution of India', relLabel: 'Is under' },
      { citation: 'General Clauses Act, 1897', status: 'linked', matchedTitle: 'General Clauses Act 1897', relLabel: 'References' },
      { citation: 'Punjab General Rules, 1941', status: 'unresolved', relLabel: 'References' },
    ],
    'Notification': [
      { citation: `${doc.title} (Parent Act)`, status: 'linked', matchedTitle: doc.title, relLabel: 'Notified under' },
      { citation: 'Official Gazette of Haryana', status: 'unresolved', relLabel: 'References' },
    ],
    'Circular': [
      { citation: 'General Administration Department Guidelines', status: 'linked', matchedTitle: 'GAD Guidelines 2020', relLabel: 'Is under' },
    ],
    'Policy': [
      { citation: 'National Policy Framework', status: 'unresolved', relLabel: 'References' },
      { citation: 'Haryana Fiscal Policy', status: 'linked', matchedTitle: 'Haryana Fiscal Policy 2022', relLabel: 'References' },
    ],
  };

  const rawCitations = (doc.citations && doc.citations.length > 0)
    ? doc.citations
    : (citationSets[doc.type] || citationSets['Act']);

  const hierarchy = doc.hierarchy?.act
    ? doc.hierarchy
    : { act: doc.title, chapter: 'Chapter I — Preliminary', section: 'Section 1 — Short Title', subsection: '(1)' };

  return {
    autoMetadata: { title: doc.title, year: doc.year, type: doc.type, dept: doc.dept, version: doc.version || '1.0' },
    hierarchy,
    citations:       rawCitations.filter(c => c.status === 'linked'),
    unresolvedCount: rawCitations.filter(c => c.status === 'unresolved').length,
  };
}

// ─── Shared page navigation ───────────────────────────────────────────────────
// Both PDF and OCR panels share the same currentPage state (lifted to ThreePanelReview)
// so they scroll together.
function PageNav({ currentPage, totalPages, onPageChange }) {
  return (
    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--surface-50)', flexShrink: 0 }}>
      <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={currentPage === 1}
        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: currentPage === 1 ? '#94a3b8' : 'var(--text-color-secondary)', fontSize: 11, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
        ← Prev
      </button>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
        {currentPage} / {totalPages}
      </span>
      <button onClick={() => onPageChange(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: currentPage === totalPages ? '#94a3b8' : 'var(--text-color-secondary)', fontSize: 11, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
        Next →
      </button>
    </div>
  );
}

// ─── PDF Viewer Panel ─────────────────────────────────────────────────────────
// Renders real PDFs as stacked canvases (pdfjs-dist) so scroll can be detected
// and synced with OcrTextPanel. Mock docs use the styled layout fallback.
function PdfViewerPanel({ doc, ocrData, currentPage, onPageChange, totalPages, rotation, onRotate, blobUrl, onTotalPagesChange }) {
  const [zoom, setZoom]     = useState(100);
  const containerRef        = useRef(null);
  const canvasRefs          = useRef([]);
  const [pdfDoc, setPdfDoc] = useState(null);
  const suppressRef         = useRef(false);

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

  // Scroll canvas to currentPage when driven externally (nav buttons or OCR scroll)
  useEffect(() => {
    const canvas = canvasRefs.current[currentPage - 1];
    if (!canvas || !containerRef.current) return;
    suppressRef.current = true;
    containerRef.current.scrollTo({ top: canvas.offsetTop - 8, behavior: 'smooth' });
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
      const top = canvas.offsetTop;
      const vis = Math.max(0, Math.min(top + canvas.offsetHeight, st + ch) - Math.max(top, st));
      if (vis > bestVis) { bestVis = vis; best = i; }
    });
    if (best + 1 !== currentPage) onPageChange(best + 1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <Eye size={13} color="var(--primary)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>Original PDF</span>
        {blobUrl && (
          <a href={blobUrl} target="_blank" rel="noreferrer" title="Open in new tab"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', textDecoration: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>
            <ExternalLink size={11} /> Open
          </a>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onRotate} title="Rotate 90°"
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
      </div>

      {/* Content area */}
      {doc.fileUrl ? (
        <div ref={containerRef} onScroll={handleScroll}
          style={{ flex: 1, overflow: 'auto', background: '#525659', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {!pdfDoc && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.7)' }}>Loading PDF…</span>
            </div>
          )}
          {Array.from({ length: numPages }, (_, i) => (
            <canvas key={i} ref={el => { canvasRefs.current[i] = el; }}
              style={{ display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,.5)', maxWidth: '100%' }} />
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
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>Government of Haryana</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: 6 }}>{doc.title}</div>
              <div style={{ fontSize: 11, color: '#444', fontFamily: 'Arial, sans-serif' }}>{doc.dept}&nbsp;·&nbsp;Year: {doc.year}&nbsp;·&nbsp;{doc.type}</div>
            </div>
            <div style={{ borderTop: '1px solid #bbb', marginBottom: 20 }} />
            <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.95, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {pageData?.text || 'Document content not available.'}
            </div>
            <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#777', fontFamily: 'Arial, sans-serif' }}>
              <span>v{doc.version || '1.0'}&nbsp;·&nbsp;{doc.legalStatus || 'active'}</span>
              <span>Page {currentPage} of {totalPages}</span>
              <span>{doc.uploader || '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Word-edit popover ────────────────────────────────────────────────────────
function WordEditPopover({ editingWord, isSuspicious, onSave, onMarkCorrect, onCancel }) {
  const [text, setText] = useState(editingWord.text);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const left = Math.min(editingWord.x, window.innerWidth - 260);
  const top  = Math.min(editingWord.y, window.innerHeight - 140);
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      <div style={{ position: 'fixed', left, top, zIndex: 1000, width: 250,
        background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
        borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
          color: 'var(--text-color-secondary)', letterSpacing: '.07em' }}>EDIT WORD</div>
        <input autoFocus value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editingWord.key, text); }}
          style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
            borderRadius: 6, color: 'var(--text-color)', fontFamily: 'var(--mono)',
            fontSize: 13, padding: '6px 9px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onSave(editingWord.key, text)}
            style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Save
          </button>
          {isSuspicious && (
            <button onClick={() => onMarkCorrect(editingWord.key, editingWord.text)}
              style={{ flex: 1, background: 'rgba(34,197,94,.12)', color: '#1e40af',
                border: '1px solid rgba(34,197,94,.3)', borderRadius: 6, padding: '6px 0',
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Mark correct
            </button>
          )}
          <button onClick={onCancel}
            style={{ background: 'var(--surface-ground)', color: 'var(--text-color-secondary)',
              border: '1px solid var(--surface-border)', borderRadius: 6,
              padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    </>
  );
}

// ─── OCR Text Panel ───────────────────────────────────────────────────────────
// Shows ALL pages stacked. Scrolls to currentPage when PDF panel drives the page.
// Each word is clickable for confidence-based editing.
function OcrTextPanel({ ocrData, currentPage, wordEdits, onWordEdit, isScanned = false }) {
  const [editingWord, setEditingWord] = useState(null);
  const containerRef = useRef(null);
  const pageRefs     = useRef([]);
  const suppressRef  = useRef(false);

  const LEGEND = [
    { bg: 'rgba(34,197,94,.22)',  border: 'rgba(34,197,94,.5)',  label: '≥ 80%', desc: 'Correct' },
    { bg: 'rgba(234,179,8,.28)', border: 'rgba(234,179,8,.6)',  label: '50–80%', desc: 'Review' },
    { bg: 'rgba(249,115,22,.32)',border: 'rgba(249,115,22,.6)', label: '20–50%', desc: 'Likely wrong' },
    { bg: 'rgba(239,68,68,.36)', border: 'rgba(239,68,68,.55)', label: '< 20%',  desc: 'Error' },
  ];

  // When PDF panel changes page, scroll OCR to matching page block
  useEffect(() => {
    const el = pageRefs.current[currentPage - 1];
    if (!el || !containerRef.current) return;
    suppressRef.current = true;
    containerRef.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
    setTimeout(() => { suppressRef.current = false; }, 700);
  }, [currentPage]);

  function handleWordClick(e, key, item) {
    const rect = e.currentTarget.getBoundingClientRect();
    const edit = wordEdits[key];
    setEditingWord({ key, text: edit?.text ?? item.word, x: rect.left, y: rect.bottom + 6 });
  }
  function saveEdit(key, text)   { onWordEdit(key, { text, markedCorrect: false }); setEditingWord(null); }
  function markCorrect(key, text){ onWordEdit(key, { text, markedCorrect: true  }); setEditingWord(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <AlignLeft size={13} color="#3b82f6" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>Extracted OCR Text</span>
        {isScanned && (
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,.12)', color: '#d97706', border: '1px solid rgba(245,158,11,.3)', marginRight: 4, whiteSpace: 'nowrap' }}>
            ⚠ SCANNED PDF
          </span>
        )}
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20,
          background: ocrData.confidence >= 95 ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)',
          color:      ocrData.confidence >= 95 ? '#16a34a' : '#d97706',
        }}>AVG {ocrData.confidence}% CONFIDENCE</span>
      </div>

      {/* Colour legend */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--surface-ground)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 700, letterSpacing: '.05em' }}>WORD CONFIDENCE:</span>
        {LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 28, height: 13, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}`, flexShrink: 0 }} />
            <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--text-heading)' }}>{l.label}</strong> {l.desc}
            </span>
          </div>
        ))}
      </div>

      {/* All pages stacked — synced to PDF panel via currentPage */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
        {ocrData.pages.map((pageData, pi) => {
          const isCurrent  = pi + 1 === currentPage;
          const confColor  = pageData.confidence >= 95 ? '#16a34a' : pageData.confidence >= 85 ? '#d97706' : '#dc2626';
          const confBgBar  = pageData.confidence >= 95 ? 'rgba(34,197,94,.08)' : pageData.confidence >= 85 ? 'rgba(245,158,11,.08)' : 'rgba(239,68,68,.08)';
          return (
            <div key={pi} ref={el => { pageRefs.current[pi] = el; }}>
              {/* Sticky page-header with confidence bar */}
              <div style={{
                padding: '5px 14px', background: isCurrent ? confBgBar : 'var(--surface-ground)',
                borderBottom: '1px solid var(--surface-border)', borderLeft: `3px solid ${isCurrent ? confColor : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 10,
                position: 'sticky', top: 0, zIndex: 1, transition: 'all .2s',
              }}>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: confColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  PAGE {pageData.pageNum} — {pageData.confidence}%
                </span>
                <div style={{ flex: 1, height: 3, borderRadius: 4, background: 'var(--surface-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: confColor, width: `${pageData.confidence}%` }} />
                </div>
                {pageData.confidence < 90 && <AlertTriangle size={10} color="#d97706" />}
              </div>
              {/* Word-highlighted text */}
              <div style={{ padding: '12px 16px', borderBottom: pi < ocrData.pages.length - 1 ? '2px dashed var(--surface-border)' : 'none' }}>
                {pageData.words && pageData.words.length > 0 ? (
                  <div style={{ fontSize: 12, lineHeight: 2.1, color: 'var(--text-color)', fontFamily: 'var(--mono)', wordBreak: 'break-word' }}>
                    {pageData.words.map((item, idx) => {
                      const key        = `${pi}-${idx}`;
                      if (item.word === '\n')        return <br key={key} />;
                      if (/^\s+$/.test(item.word))   return <span key={key}>{item.word}</span>;
                      const edit        = wordEdits[key];
                      const displayText = edit?.text ?? item.word;
                      const markedOk    = edit?.markedCorrect ?? false;
                      const conf        = markedOk ? 100 : effectiveConf(displayText, item.confidence);
                      const susp        = !markedOk && isSuspiciousWord(displayText) && item.confidence > 80;
                      const isEditing   = editingWord?.key === key;
                      return (
                        <span key={key} onClick={e => handleWordClick(e, key, item)}
                          title={susp ? `${item.confidence}% (suspicious)` : `${item.confidence}% confidence`}
                          style={{ background: confBg(conf), borderRadius: 3, padding: '1px 3px', margin: '0 1px', cursor: 'pointer', display: 'inline-block', lineHeight: 1.5, outline: isEditing ? '2px solid #3b82f6' : 'none', transition: 'outline .1s' }}>
                          {displayText}
                          {markedOk && <sup style={{ fontSize: 7, color: '#16a34a', marginLeft: 1 }}>✓</sup>}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text-color)', whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>
                    {pageData.text || 'No text on this page.'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingWord && (
        <WordEditPopover
          editingWord={editingWord}
          isSuspicious={isSuspiciousWord(editingWord.text)}
          onSave={saveEdit}
          onMarkCorrect={markCorrect}
          onCancel={() => setEditingWord(null)}
        />
      )}
    </div>
  );
}

// ─── Document Details Panel ──────────────────────────────────────────────────
// Shows every field the uploader filled in: metadata, description, hierarchy,
// type-specific fields, legal authorities, relationships, amendment provisions.
function DocumentDetailsPanel({ doc }) {
  const meta = [
    ['Title',          doc.title],
    ['Type',           doc.type],
    ['Department',     doc.dept],
    ['Year',           doc.year ? String(doc.year) : null],
    ['Version',        doc.version || '1.0'],
    ['Uploader',       doc.uploader || null],
    ['Upload Date',    doc.uploadedAt || null],
    ['Enactment Date', doc.enactmentDate || null],
    ['Pages',          doc.pages ? `${doc.pages} pages` : null],
    ['Legal Status',   doc.legalStatus || 'active'],
    ['File Name',      doc.fileName || null],
  ].filter(([, v]) => v);

  // Type-specific extra fields
  const typeExtra = doc.typeFields ? Object.entries(doc.typeFields).filter(([, v]) => v) : [];

  // Map camelCase keys to readable labels
  const fieldLabel = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <FileText size={13} color="var(--primary)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>Document Details</span>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--primary)', fontWeight: 700, background: 'rgba(26,86,219,.1)', padding: '2px 8px', borderRadius: 20 }}>
          UPLOADER INFO
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Core Metadata ── */}
        <div>
          <div style={{ ...LABEL, marginBottom: 8 }}>Metadata</div>
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
            <div style={{ ...LABEL, marginBottom: 8 }}>Type-Specific Fields</div>
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
              <div style={{ ...LABEL, marginBottom: 8 }}>Parent Hierarchy</div>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(26,86,219,.04)', border: '1px solid rgba(26,86,219,.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '.07em', color: '#1a56db', background: 'rgba(26,86,219,.12)', padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
                    {parent.type === 'parent_act' ? 'PARENT ACT' : 'AMENDS'}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {parent.document_name || `Document #${parent.pdf_id}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
                  <ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--mono)' }}>
                    {doc.title}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '1px 6px', borderRadius: 8 }}>
                    Amendment
                  </span>
                </div>

                {/* Changes made per section */}
                {doc.amendmentProvisions?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', letterSpacing: '.07em' }}>CHANGES MADE</div>
                    {doc.amendmentProvisions.map((p, i) => {
                      const CHANGE_COLORS = { Amended: '#f59e0b', Substituted: '#3b82f6', Inserted: '#22c55e', Deleted: '#ef4444', Expanded: '#8b5cf6' };
                      const color = CHANGE_COLORS[p.changeType] || '#94a3b8';
                      return (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: `1px solid ${color}33` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: p.description ? 5 : 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', color, background: `${color}18`, padding: '1px 7px', borderRadius: 8 }}>
                              {p.changeType || 'Amended'}
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
            <div style={{ ...LABEL, marginBottom: 8 }}>Description</div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 12, color: 'var(--text-color)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {doc.desc}
            </div>
          </div>
        )}

        {/* ── Hierarchy Tags ── */}
        {(doc.hierarchy?.act || doc.hierarchy?.chapter || doc.hierarchy?.section) && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>Hierarchy Tags</div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(26,86,219,.04)', border: '1px solid rgba(26,86,219,.15)', fontSize: 11.5, color: 'var(--text-color-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, lineHeight: 1.8 }}>
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
            <div style={{ ...LABEL, marginBottom: 8 }}>Legal Authorities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.legalAuthorities.map((a, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(26,86,219,.04)', border: '1px solid rgba(26,86,219,.15)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: a.sections?.some(s => s) ? 4 : 0 }}>{a.act}</div>
                  {a.sections?.filter(s => s).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {a.sections.filter(s => s).map((s, j) => (
                        <span key={j} style={{ fontSize: 10.5, fontFamily: 'var(--mono)', background: 'rgba(26,86,219,.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 12 }}>{s}</span>
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
            <div style={{ ...LABEL, marginBottom: 8 }}>Relationships · {doc.docRelations.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.docRelations.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8,
                  background: r.isPending ? 'rgba(245,158,11,.05)' : 'rgba(34,197,94,.05)',
                  border: `1px solid ${r.isPending ? 'rgba(245,158,11,.2)' : 'rgba(34,197,94,.2)'}` }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: r.isPending ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
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

        {/* ── Amendment Provisions ── */}
        {doc.amendmentProvisions?.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>Amendment Provisions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {doc.amendmentProvisions.map((p, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: p.before || p.after || p.description ? 6 : 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', color: '#d97706', fontWeight: 700, fontSize: 10.5, background: 'rgba(245,158,11,.15)', padding: '2px 7px', borderRadius: 10 }}>{p.changeType || 'Amended'}</span>
                    {p.section && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)' }}>Section {p.section}{p.chapter ? ` · Ch. ${p.chapter}` : ''}{p.subsection ? ` (${p.subsection})` : ''}</span>}
                  </div>
                  {p.description && <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{p.description}</div>}
                  {p.before && <div style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(239,68,68,.05)', padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(239,68,68,.4)' }}>Before: {p.before}</div>}
                  {p.after  && <div style={{ fontSize: 11, color: '#16a34a', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(34,197,94,.05)',  padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(34,197,94,.4)' }}>After: {p.after}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Parent Act ── */}
        {doc.parentAct && (
          <div>
            <div style={{ ...LABEL, marginBottom: 8 }}>Parent Act</div>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(26,86,219,.04)', border: '1px solid rgba(26,86,219,.15)', fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              {doc.parentAct}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── 2-Panel Review View ──────────────────────────────────────────────────────
// PDF on the left, uploader-filled document details on the right.
function ThreePanelReview({ doc, remarks, onRemarksChange, onDecide, activePage, deciding }) {
  const [currentPage, setCurrentPage]   = useState(1);
  const [rotation, setRotation]         = useState(0);
  const [blobUrl, setBlobUrl]           = useState(null);
  const [pdfTotalPages, setPdfTotalPages] = useState(null);

  const mockOcr    = useMemo(() => getMockOcrData(doc), [doc.id]);
  const totalPages = pdfTotalPages || mockOcr.pageCount;

  useEffect(() => {
    if (!doc.id || !localStorage.getItem('token')) return;
    let url = null;
    setBlobUrl(null);
    getPdfFile(doc.id)
      .then(res => {
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
            doc={docWithUrl} ocrData={mockOcr}
            currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages}
            rotation={rotation} onRotate={() => setRotation(r => (r + 90) % 360)}
            blobUrl={blobUrl} onTotalPagesChange={setPdfTotalPages}
          />
        </div>

        {/* Panel 2 — Document Details */}
        <div style={{ overflow: 'hidden' }}>
          <DocumentDetailsPanel doc={doc} />
        </div>
      </div>

      {/* Page navigation */}
      <div style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)' }}>
        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {/* Approve / Reject — only for pending docs */}
      {activePage === 'pending' && doc.status === 'pending' && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...LABEL, marginBottom: 7 }}>Remarks</div>
              <textarea rows={2} value={remarks || ''} onChange={e => onRemarksChange(e.target.value)}
                placeholder="Add remarks (optional)…"
                style={{ width: '100%', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 13, padding: '9px 12px', outline: 'none', resize: 'none', lineHeight: 1.5, transition: 'border-color .2s', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--surface-border)'} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0, paddingBottom: 1 }}>
              <button onClick={() => onDecide('rejected')} disabled={!!deciding}
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', color: '#b91c1c', padding: '9px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: deciding ? 'not-allowed' : 'pointer', opacity: deciding && deciding !== 'rejected' ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding) e.currentTarget.style.background = 'rgba(239,68,68,.15)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(239,68,68,.08)'; }}>
                <X size={14} /> {deciding === 'rejected' ? 'Rejecting…' : 'Reject'}
              </button>
              <button onClick={() => onDecide('approved')} disabled={!!deciding}
                style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#1e40af', padding: '9px 20px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: deciding ? 'not-allowed' : 'pointer', opacity: deciding && deciding !== 'approved' ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { if (!deciding) e.currentTarget.style.background = 'rgba(34,197,94,.18)'; }}
                onMouseLeave={e => { if (!deciding) e.currentTarget.style.background = 'rgba(34,197,94,.1)'; }}>
                <Check size={14} /> {deciding === 'approved' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks display for already-reviewed documents */}
      {doc.status !== 'pending' && doc.remarks && (
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'flex-start', gap: 10,
          background: doc.status === 'approved' ? 'rgba(34,197,94,.04)' : 'rgba(239,68,68,.04)',
          borderTop: '1px solid var(--surface-border)',
        }}>
          {doc.status === 'approved'
            ? <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
            : <XCircle    size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: doc.status === 'approved' ? '#16a34a' : '#ef4444', marginBottom: 3 }}>
              {doc.status === 'approved' ? 'APPROVED' : 'REJECTED'} — REVIEWER REMARKS
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{doc.remarks}</div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── Main ApproverDashboard ───────────────────────────────────────────────────
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
    fileUrl:         null,
    relationships:   d.relationships || [],
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

export default function ApproverDashboard({ activePage, onAuditLog, documents, onApprove }) {
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState('');
  const [remarks, setRemarks]     = useState({});
  const [deciding, setDeciding]   = useState(null); // { id, action } while API call is in-flight
  const [expanded, setExpanded]   = useState(null);
  const [filter, setFilter]       = useState('');
  const [searchQ, setSearchQ]     = useState('');
  const [cardFilter, setCardFilter] = useState(null);
  const tableRef  = useRef(null);
  const expandedRef = useRef(null);

  function fetchDocs() {
    if (!localStorage.getItem('token')) return;
    setLoading(true);
    setApiError('');
    getApproverDocuments()
      .then(res => setDocs((res.data.documents || []).map(mapApiDoc)))
      .catch(err => setApiError(err.response?.data?.detail || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchDocs(); }, [activePage]);

  // Scroll expanded card into view
  useEffect(() => {
    if (expanded !== null && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);

  const pending  = docs.filter(d => d.status === 'pending');
  const reviewed = docs.filter(d => d.status !== 'pending');

  function decide(id, decision) {
    const doc    = docs.find(d => d.id === id);
    const remark = remarks[id] || '';
    setDeciding({ id, action: decision });
    reviewDocument(id, decision, remark || undefined)
      .then(() => {
        setDocs(ds => ds.map(d => d.id === id
          ? { ...d, status: decision, ...(remark ? { remarks: remark } : {}) }
          : d
        ));
        if (decision === 'approved') onApprove?.(id);
        onAuditLog?.(`${decision === 'approved' ? 'Approved' : 'Rejected'} document: ${doc?.title}${remark ? ` — "${remark}"` : ''}`);
        if (expanded === id) setExpanded(null);
      })
      .catch(err => {
        const detail = err.response?.data?.detail || 'Action failed. Please try again.';
        setApiError(detail);
      })
      .finally(() => setDeciding(null));
  }

  const validTypes = new Set(Object.keys(TYPE_COLORS));

  const base = cardFilter
    ? (cardFilter === 'all' ? docs : docs.filter(d => d.status === cardFilter))
    : (activePage === 'pending' ? pending : reviewed);

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

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', opacity: 1 - i * 0.2, animation: 'pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626' }}>
          <XCircle size={15} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, flex: 1 }}>{apiError}</span>
          <button onClick={fetchDocs}
            style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Summary strip — only on Reviewed tab */}
      {activePage !== 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: Clock,       label: 'Pending',  value: pending.length,                                       bg: 'rgba(245,158,11,.12)', color: '#f59e0b', key: 'pending'  },
            { icon: CheckCircle, label: 'Approved', value: reviewed.filter(d => d.status === 'approved').length, bg: 'rgba(34,197,94,.12)',  color: '#22c55e', key: 'approved' },
            { icon: XCircle,     label: 'Rejected', value: reviewed.filter(d => d.status === 'rejected').length, bg: 'rgba(239,68,68,.12)',  color: '#ef4444', key: 'rejected' },
            { icon: FileText,    label: 'Total',    value: docs.length,                                          bg: 'rgba(26,86,219,.12)',  color: 'var(--primary)', key: 'all' },
          ].map(s => {
            const isActive = cardFilter === s.key;
            return (
            <Card key={s.label} onClick={() => { setCardFilter(f => f === s.key ? null : s.key); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
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
      )}

      {/* Filter + search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', flex: 1, maxWidth: 300 }}>
            <Search size={13} color="var(--text-color-secondary)" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by title…"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
            {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
          </div>
          {cardFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 20, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', fontSize: 12.5, fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
              {{ all: 'All', pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[cardFilter]}
              <button onClick={() => setCardFilter(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#16a34a', display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
            </div>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
            {`${list.length} document${list.length !== 1 ? 's' : ''}`}
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
                {type}
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-ground)', color: active ? 'white' : 'var(--text-color-secondary)', padding: '0px 5px', borderRadius: 10 }}>{count}</span>
              </button>
            );
          })}
          {filter && (
            <button onClick={() => setFilter('')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--surface-border)', color: 'var(--text-color-secondary)' }}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '64px 0' }}>
          <CheckCircle size={44} color="var(--surface-200)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-color-secondary)', marginBottom: 6 }}>
            {activePage === 'pending' ? 'All caught up!' : 'No reviewed documents'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>
            {activePage === 'pending' ? 'No pending submissions to review.' : 'Reviewed documents will appear here.'}
          </div>
        </Card>
      )}

      {/* Document cards */}
      <div ref={tableRef} style={{ scrollMarginTop: 16 }} />
      {list.map(doc => {
        const isOpen = expanded === doc.id;
        return (
          <div key={doc.id} ref={isOpen ? expandedRef : null}>
            <Card style={{ padding: 0, borderColor: isOpen ? 'rgba(26,86,219,.3)' : 'var(--surface-border)', transition: 'border-color .2s', overflow: 'hidden' }}>

              {/* Header row — click to expand */}
              <div onClick={() => setExpanded(isOpen ? null : doc.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 44, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
                  <FileText size={14} color="var(--primary)" />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--primary)', fontWeight: 700 }}>PDF</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, letterSpacing: '-.01em' }}>{doc.title}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      doc.type,
                      doc.dept,
                      String(doc.year),
                      doc.pages ? `${doc.pages} pages` : null,
                      doc.uploader ? `By: ${doc.uploader}` : null,
                      doc.uploadedAt || null,
                    ].filter(Boolean).map((v, i) => (
                      <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{v}</span>
                    ))}
                  </div>
                  {/* Remarks preview for reviewed docs (collapsed state) */}
                  {doc.status !== 'pending' && doc.remarks && !isOpen && (
                    <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-color-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                      Remarks: "{doc.remarks}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {/* Panel labels hint (pending only) */}
                  {!isOpen && doc.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { icon: Eye,       color: '#1a56db', label: 'PDF' },
                        { icon: AlignLeft, color: '#3b82f6', label: 'OCR' },
                        { icon: Cpu,       color: '#8b5cf6', label: 'AI'  },
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
                  onDecide={decision => decide(doc.id, decision)}
                  activePage={activePage}
                  deciding={deciding?.id === doc.id ? deciding.action : null}
                />
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
