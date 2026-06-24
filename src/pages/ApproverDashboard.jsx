import { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle, XCircle, FileText, ChevronDown, Search, Clock,
  Check, X, Eye, AlignLeft, Cpu, Link, AlertTriangle, ChevronRight,
  ZoomIn, ZoomOut, RotateCw,
} from 'lucide-react';
import { DOCUMENTS } from '../data/mockData';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Act', 'Notification', 'Circular', 'Policy'];

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
// currentPage / onPageChange / totalPages are synced with OcrTextPanel via parent.
// rotation is managed here; RotateCw cycles 0 → 90 → 180 → 270.
function PdfViewerPanel({ doc, ocrData, currentPage, onPageChange, totalPages, rotation, onRotate }) {
  const [zoom, setZoom] = useState(100);
  const pageData = ocrData.pages.find(p => p.pageNum === currentPage) || ocrData.pages[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <Eye size={13} color="var(--primary)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>Original PDF</span>
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
        // Real uploaded PDF — render via iframe; page param navigates inside the PDF
        <div style={{ flex: 1, overflow: 'hidden', background: '#e5e7eb' }}>
          <iframe
            key={currentPage}
            src={`${doc.fileUrl}#page=${currentPage}`}
            style={{
              width: '100%', height: '100%', border: 'none', display: 'block',
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            title={doc.title}
          />
        </div>
      ) : (
        // Demo document — styled official page layout so it looks different from the OCR text panel
        <div style={{ flex: 1, overflow: 'auto', background: '#d1d5db', padding: 16 }}>
          <div style={{
            background: 'white', borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            padding: '40px 44px', minHeight: 480,
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'top center',
            fontFamily: 'Georgia, "Times New Roman", serif',
            position: 'relative',
          }}>
            {/* Official document header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                Government of Haryana
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: 6 }}>
                {doc.title}
              </div>
              <div style={{ fontSize: 11, color: '#444', fontFamily: 'Arial, sans-serif' }}>
                {doc.dept}&nbsp;·&nbsp;Year: {doc.year}&nbsp;·&nbsp;{doc.type}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #bbb', marginBottom: 20 }} />
            {/* Body text — same source as OCR panel but in document typography */}
            <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.95, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
              {pageData?.text || 'Document content not available.'}
            </div>
            {/* Footer */}
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
// Each word is clickable: opens WordEditPopover so approver can correct OCR errors
// or mark a suspicious word as intentionally correct.
function OcrTextPanel({ ocrData, currentPage, wordEdits, onWordEdit }) {
  const [editingWord, setEditingWord] = useState(null);
  const pageIdx  = currentPage - 1;
  const pageData = ocrData.pages[pageIdx] || ocrData.pages[0];
  const confColor = pageData.confidence >= 95 ? '#16a34a' : pageData.confidence >= 85 ? '#d97706' : '#dc2626';
  const confBgBar = pageData.confidence >= 95 ? 'rgba(34,197,94,.08)' : pageData.confidence >= 85 ? 'rgba(245,158,11,.08)' : 'rgba(239,68,68,.08)';

  const LEGEND = [
    { bg: 'rgba(34,197,94,.22)',  border: 'rgba(34,197,94,.5)',   label: '≥ 80%', desc: 'Correct' },
    { bg: 'rgba(234,179,8,.28)', border: 'rgba(234,179,8,.6)',   label: '50–80%', desc: 'Review' },
    { bg: 'rgba(249,115,22,.32)',border: 'rgba(249,115,22,.6)',  label: '20–50%', desc: 'Likely wrong' },
    { bg: 'rgba(239,68,68,.36)', border: 'rgba(239,68,68,.55)',  label: '< 20%',  desc: 'Error' },
  ];

  function handleWordClick(e, key, item) {
    const rect = e.currentTarget.getBoundingClientRect();
    const edit = wordEdits[key];
    setEditingWord({ key, text: edit?.text ?? item.word, x: rect.left, y: rect.bottom + 6 });
  }
  function saveEdit(key, text) { onWordEdit(key, { text, markedCorrect: false }); setEditingWord(null); }
  function markCorrect(key, text) { onWordEdit(key, { text, markedCorrect: true }); setEditingWord(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <AlignLeft size={13} color="#3b82f6" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>Extracted OCR Text</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20,
          background: ocrData.confidence >= 95 ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)',
          color:      ocrData.confidence >= 95 ? '#16a34a' : '#d97706',
        }}>
          AVG {ocrData.confidence}% CONFIDENCE
        </span>
      </div>

      {/* Per-page confidence bar */}
      <div style={{ padding: '8px 14px', background: confBgBar, borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: confColor, fontWeight: 700 }}>
          PAGE {currentPage} — {pageData.confidence}%
        </span>
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--surface-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: confColor, width: `${pageData.confidence}%`, transition: 'width .3s' }} />
        </div>
        {pageData.confidence < 90 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d97706' }}>
            <AlertTriangle size={11} />
            <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)' }}>MANUAL CHECK</span>
          </div>
        )}
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

      {/* Word-highlighted text body — each word is clickable */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
        {pageData.words && pageData.words.length > 0 ? (
          <div style={{ fontSize: 12, lineHeight: 2.1, color: 'var(--text-color)', fontFamily: 'var(--mono)', wordBreak: 'break-word' }}>
            {pageData.words.map((item, idx) => {
              const key = `${pageIdx}-${idx}`;
              if (item.word === '\n') return <br key={key} />;
              if (/^\s+$/.test(item.word)) return <span key={key}>{item.word}</span>;
              const edit         = wordEdits[key];
              const displayText  = edit?.text ?? item.word;
              const markedOk     = edit?.markedCorrect ?? false;
              const conf         = markedOk ? 100 : effectiveConf(displayText, item.confidence);
              const susp         = !markedOk && isSuspiciousWord(displayText) && item.confidence > 80;
              const isEditing    = editingWord?.key === key;
              return (
                <span
                  key={key}
                  onClick={e => handleWordClick(e, key, item)}
                  title={susp
                    ? `${item.confidence}% (suspicious — click to edit or mark correct)`
                    : `${item.confidence}% confidence — click to edit`}
                  style={{
                    background:   confBg(conf),
                    borderRadius: 3,
                    padding:      '1px 3px',
                    margin:       '0 1px',
                    cursor:       'pointer',
                    display:      'inline-block',
                    lineHeight:   1.5,
                    outline:      isEditing ? '2px solid #3b82f6' : 'none',
                    transition:   'outline .1s',
                  }}
                >
                  {displayText}
                  {markedOk && <sup style={{ fontSize: 7, color: '#16a34a', marginLeft: 1 }}>✓</sup>}
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text-color)', whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>
            {pageData?.text || 'No text extracted for this page.'}
          </div>
        )}
      </div>

      {/* Word-edit popover */}
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

// ─── AI Analysis Panel ────────────────────────────────────────────────────────
function AiAnalysisPanel({ analysis }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-50)', flexShrink: 0 }}>
        <Cpu size={13} color="#8b5cf6" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>AI Analysis</span>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: '#8b5cf6', fontWeight: 700, background: 'rgba(139,92,246,.1)', padding: '2px 8px', borderRadius: 20 }}>
          ZERO GENERATION
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Auto-extracted metadata */}
        <div>
          <div style={{ ...LABEL, marginBottom: 8 }}>Auto-Extracted Metadata</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['Title',      analysis.autoMetadata.title],
              ['Year',       analysis.autoMetadata.year],
              ['Type',       analysis.autoMetadata.type],
              ['Department', analysis.autoMetadata.dept],
              ['Version',    analysis.autoMetadata.version],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderRadius: 7, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', minWidth: 72, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hierarchy breadcrumb — uses ChevronRight icon */}
        <div>
          <div style={{ ...LABEL, marginBottom: 8 }}>Hierarchy Tags</div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(26,86,219,.04)', border: '1px solid rgba(26,86,219,.15)', fontSize: 11.5, color: 'var(--text-color-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, lineHeight: 1.8 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{analysis.hierarchy.act}</span>
            {analysis.hierarchy.chapter && (
              <><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{analysis.hierarchy.chapter}</span></>
            )}
            {analysis.hierarchy.section && (
              <><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{analysis.hierarchy.section}</span></>
            )}
            {analysis.hierarchy.subsection && (
              <><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{analysis.hierarchy.subsection}</span></>
            )}
          </div>
        </div>

        {/* Linked citations */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ ...LABEL }}>Linked Citations</div>
            {analysis.unresolvedCount > 0 && (
              <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>
                · {analysis.unresolvedCount} not in system
              </span>
            )}
          </div>
          {analysis.citations.length === 0 ? (
            <div style={{ padding: '12px', borderRadius: 8, background: 'var(--surface-ground)', fontSize: 12, color: 'var(--text-color-secondary)', textAlign: 'center' }}>
              No linked citations found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {analysis.citations.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)' }}>
                  <Link size={12} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.citation}</div>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: '#16a34a' }}>
                      {c.relLabel} · ✓ {c.matchedTitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zero generation compliance note */}
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)', marginTop: 'auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed', fontFamily: 'var(--mono)', marginBottom: 4 }}>
            ✓ ZERO GENERATION COMPLIANT
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>
            All text shown is verbatim from source document. No AI-generated content present.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3-Panel Review View ──────────────────────────────────────────────────────
// Owns currentPage, rotation, and wordEdits so all panels stay in sync.
function ThreePanelReview({ doc, remarks, onRemarksChange, onDecide, activePage }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rotation, setRotation]       = useState(0);
  const [wordEdits, setWordEdits]     = useState({});
  const [warnApprove, setWarnApprove] = useState(false);

  const ocrData  = useMemo(() => getMockOcrData(doc),    [doc.id]);
  const analysis = useMemo(() => getMockAiAnalysis(doc), [doc.id]);
  const totalPages = ocrData.pageCount;

  function handleWordEdit(key, value) {
    setWordEdits(prev => ({ ...prev, [key]: value }));
  }

  // Count words still flagged (low effectiveConf and not explicitly marked correct)
  const suspiciousCount = useMemo(() => {
    let n = 0;
    ocrData.pages.forEach((page, pi) => {
      (page.words || []).forEach((item, wi) => {
        if (/^\s+$/.test(item.word) || item.word === '\n') return;
        const edit = wordEdits[`${pi}-${wi}`];
        if (edit?.markedCorrect) return;
        const display = edit?.text ?? item.word;
        if (effectiveConf(display, item.confidence) < 80) n++;
      });
    });
    return n;
  }, [ocrData, wordEdits]);

  function handleApprove() {
    if (suspiciousCount > 0 && !warnApprove) { setWarnApprove(true); return; }
    setWarnApprove(false);
    onDecide('approved');
  }

  return (
    <div style={{ borderTop: '1px solid var(--surface-border)' }}>
      {/* 3-panel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: 480, borderBottom: '1px solid var(--surface-border)' }}>

        {/* Panel 1 — Original PDF */}
        <div style={{ borderRight: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <PdfViewerPanel
            doc={doc} ocrData={ocrData}
            currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages}
            rotation={rotation} onRotate={() => setRotation(r => (r + 90) % 360)}
          />
        </div>

        {/* Panel 2 — OCR Text (editable, synced page with Panel 1) */}
        <div style={{ borderRight: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <OcrTextPanel
            ocrData={ocrData}
            currentPage={currentPage} totalPages={totalPages}
            wordEdits={wordEdits} onWordEdit={handleWordEdit}
          />
        </div>

        {/* Panel 3 — AI Analysis */}
        <div style={{ overflow: 'hidden' }}>
          <AiAnalysisPanel analysis={analysis} />
        </div>
      </div>

      {/* Single shared page navigation */}
      <div style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)' }}>
        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      {/* Low-confidence OCR warning */}
      {ocrData.pages.some(p => p.confidence < 90) && (
        <div style={{ padding: '10px 20px', background: 'rgba(245,158,11,.06)', borderBottom: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} color="#d97706" />
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            One or more pages have low OCR confidence — manual verification recommended before approving.
          </span>
        </div>
      )}

      {/* Approve / Reject — only for pending docs */}
      {activePage === 'pending' && doc.status === 'pending' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Suspicious-word warning banner — shown only after first approve click */}
          {warnApprove && suspiciousCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)',
              border: '1px solid rgba(245,158,11,.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#92400e', flex: 1 }}>
                <strong>{suspiciousCount} word{suspiciousCount !== 1 ? 's' : ''}</strong> still flagged with potential OCR errors.
                Correct them in the OCR panel, or approve anyway.
              </span>
              <button onClick={() => { setWarnApprove(false); onDecide('approved'); }}
                style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Approve Anyway
              </button>
              <button onClick={() => setWarnApprove(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-color-secondary)',
                  fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          )}

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
              <button onClick={() => onDecide('rejected')}
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', color: '#b91c1c', padding: '9px 18px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}>
                <X size={14} /> Reject
              </button>
              <button onClick={handleApprove}
                style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#1e40af', padding: '9px 20px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,.1)'}>
                <Check size={14} /> Approve
                {suspiciousCount > 0 && (
                  <span style={{ background: '#d97706', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 2 }}>
                    {suspiciousCount}
                  </span>
                )}
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
export default function ApproverDashboard({ activePage, onAuditLog, documents, onApprove }) {
  const [docs, setDocs]       = useState(documents || DOCUMENTS);
  const [remarks, setRemarks] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]   = useState('All');
  const [searchQ, setSearchQ] = useState('');

  // Scroll expanded card into view
  const expandedRef = useRef(null);
  useEffect(() => {
    if (expanded !== null && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expanded]);

  useEffect(() => {
    if (documents) setDocs(documents);
  }, [documents]);

  const pending  = docs.filter(d => d.status === 'pending');
  const reviewed = docs.filter(d => d.status !== 'pending');

  function decide(id, decision) {
    const doc    = docs.find(d => d.id === id);
    const remark = remarks[id] || '';
    // Persist remarks on the doc so they're visible when the card is re-expanded
    setDocs(ds => ds.map(d => d.id === id
      ? { ...d, status: decision, ...(remark ? { remarks: remark } : {}) }
      : d
    ));
    if (decision === 'approved') onApprove?.(id);
    onAuditLog?.(`${decision === 'approved' ? 'Approved' : 'Rejected'} document: ${doc?.title}${remark ? ` — "${remark}"` : ''}`);
    if (expanded === id) setExpanded(null);
  }

  const base = activePage === 'pending' ? pending : reviewed;
  const list = base.filter(d => {
    const mF = filter === 'All' || d.type === filter;
    const mS = !searchQ || d.title.toLowerCase().includes(searchQ.toLowerCase());
    return mF && mS;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { icon: Clock,       label: 'Pending',  value: pending.length,                                        bg: 'rgba(245,158,11,.12)', color: '#f59e0b' },
          { icon: CheckCircle, label: 'Approved', value: reviewed.filter(d => d.status === 'approved').length,  bg: 'rgba(34,197,94,.12)',  color: '#22c55e' },
          { icon: XCircle,     label: 'Rejected', value: reviewed.filter(d => d.status === 'rejected').length,  bg: 'rgba(239,68,68,.12)',  color: '#ef4444' },
          { icon: FileText,    label: 'Total',    value: docs.length,                                           bg: 'rgba(26,86,219,.12)',  color: 'var(--primary)' },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...LABEL, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={20} color={s.color} strokeWidth={1.8} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.05em',
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${filter === f ? 'rgba(26,86,219,.3)' : 'var(--surface-border)'}`,
            background: filter === f ? 'rgba(26,86,219,.1)' : 'var(--surface-card)',
            color: filter === f ? 'var(--primary)' : 'var(--text-color-secondary)',
            transition: 'all .18s', textTransform: 'uppercase',
          }}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-color-secondary)' }} />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search documents…"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)', fontSize: 12.5, padding: '7px 14px 7px 32px', outline: 'none', width: 220, transition: 'border-color .2s', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--surface-border)'} />
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
                />
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
