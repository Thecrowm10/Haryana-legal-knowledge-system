import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, XCircle, X, TrendingUp, FileType, Download,
  RotateCcw, AlertCircle, Eye, GitBranch, Plus, Clock,
  Layers, ChevronRight, AlertTriangle, CheckSquare, Square,
  Edit3, Tag, Search, MessageSquare, ZoomIn, ZoomOut, RotateCw, ExternalLink,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import { useAuth } from '../hooks/useAuth';
import { getDepartments, getDocumentTypes } from '../services/departments';
import { uploadPdfFile, uploadPdfMetadata, getMyDocuments, searchDocuments, getPdfFile } from '../services/pdf';
import { createNotification } from '../services/notifications';

// Constants

const DEFAULT_DEPTS = [
  'Urban Local Bodies','Revenue & Disaster Mgmt.','Home Department',
  'Industries & Commerce','Labour Department','Finance Department',
  'Health & Family Welfare','Agriculture & Farmers Welfare',
  'Panchayati Raj','General Administration',
];
const DEFAULT_TYPES = ['Act','Amendment','Notification','Circular','Policy','Rules & Regulations','Order / Gazette','Bye Laws','Miscellaneous'];
const LANGS  = ['English','Hindi','Bilingual'];
const REL_TYPES = [
  'Replaces', 'Replaced by', 'Amends', 'Amended by',
  'In Continuation of', 'Continued by', 'Issued Under',
  'Implements', 'Implemented by', 'References', 'Referenced by',
  'Notified under', 'Supplemented by', 'Related to',
];

const REL_TYPES_BY_DOCTYPE = {
  'Act':                 ['Amended by', 'Replaces', 'Replaced by', 'Related to'],
  'Amendment':           ['Amends', 'In Continuation of', 'Continued by', 'Related to'],
  'Circular':            ['Issued Under', 'In Continuation of', 'Continued by', 'Replaces', 'Replaced by', 'References', 'Referenced by', 'Supplemented by'],
  'Notification':        ['Issued Under', 'Notified under', 'In Continuation of', 'Continued by', 'Replaces', 'Replaced by', 'References', 'Referenced by'],
  'Policy':              ['Replaces', 'Replaced by', 'Implements', 'Implemented by', 'References', 'Referenced by', 'Related to'],
  'Order / Gazette':     ['Issued Under', 'Amends', 'Amended by', 'Replaces', 'Replaced by', 'In Continuation of', 'Continued by', 'Implements', 'Implemented by', 'References'],
  'Rules & Regulations': ['Amends', 'Amended by', 'Replaces', 'Replaced by', 'Issued Under', 'References', 'Referenced by'],
  'Bye Laws':            ['Amends', 'Amended by', 'Replaces', 'Replaced by', 'Issued Under', 'References', 'Referenced by'],
  'Miscellaneous':       ['Issued Under', 'In Continuation of', 'Continued by', 'Replaces', 'Replaced by', 'References', 'Referenced by', 'Supplemented by'],
};

const REL_TARGET_TYPES = {
  'Act':                 ['Act', 'Amendment', 'Rules & Regulations', 'Notification', 'Bye Laws'],
  'Amendment':           ['Act', 'Rules & Regulations', 'Amendment', 'Bye Laws'],
  'Circular':            ['Circular', 'Act', 'Order / Gazette', 'Policy', 'Notification', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
  'Notification':        ['Act', 'Rules & Regulations', 'Order / Gazette', 'Notification', 'Circular', 'Policy', 'Bye Laws', 'Miscellaneous'],
  'Policy':              ['Act', 'Policy', 'Notification', 'Order / Gazette', 'Circular', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
  'Order / Gazette':     ['Act', 'Order / Gazette', 'Notification', 'Rules & Regulations', 'Policy', 'Bye Laws', 'Miscellaneous'],
  'Rules & Regulations': ['Act', 'Rules & Regulations', 'Amendment', 'Notification', 'Policy', 'Bye Laws'],
  'Bye Laws':            ['Act', 'Bye Laws', 'Rules & Regulations', 'Amendment', 'Notification', 'Policy'],
  'Miscellaneous':       ['Circular', 'Act', 'Order / Gazette', 'Policy', 'Notification', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
};

const AMEND_CHANGE_TYPES = ['Amended', 'Substituted', 'Inserted', 'Deleted', 'Expanded'];
const AMEND_CHANGE_COLORS = { Amended: '#f59e0b', Substituted: '#3b82f6', Inserted: '#22c55e', Deleted: '#ef4444', Expanded: '#8b5cf6' };
const EMPTY_PROVISION = () => ({ section: '', chapter: '', subsection: '', page: '', changeType: 'Substituted', before: '', after: '' });

// Type card colours and descriptions
const TYPE_CARD_COLORS = {
  'Act':                 { bg: 'rgba(26,86,219,.08)',  accent: '#1a56db', text: '#1e40af' },
  'Amendment':           { bg: 'rgba(245,158,11,.08)', accent: '#f59e0b', text: '#d97706' },
  'Notification':        { bg: 'rgba(139,92,246,.08)', accent: '#8b5cf6', text: '#7c3aed' },
  'Circular':            { bg: 'rgba(20,184,166,.08)', accent: '#14b8a6', text: '#0f766e' },
  'Policy':              { bg: 'rgba(34,197,94,.08)',  accent: '#22c55e', text: '#16a34a' },
  'Rules & Regulations': { bg: 'rgba(239,68,68,.08)',  accent: '#ef4444', text: '#dc2626' },
  'Order / Gazette':     { bg: 'rgba(234,179,8,.08)',  accent: '#eab308', text: '#a16207' },
  'Bye Laws':            { bg: 'rgba(14,165,233,.08)', accent: '#0ea5e9', text: '#0369a1' },
  'Miscellaneous':       { bg: 'rgba(100,116,139,.08)',accent: '#64748b', text: '#475569' },
};
const TYPE_CARD_DESC = {
  'Act':                 'Primary legislation enacted by legislature',
  'Amendment':           'Modification to an existing Act or Rule',
  'Notification':        'Official government notice or announcement',
  'Circular':            'Internal directive or instruction',
  'Policy':              'Government policy document or framework',
  'Rules & Regulations': 'Subsidiary legislation under an Act',
  'Order / Gazette':     'Executive order or gazette notification',
  'Bye Laws':            'Local body regulations under municipal or panchayat law',
  'Miscellaneous':       'Other official documents not covered above',
};

// Per-type metadata fields
const TYPE_FIELDS = {
  'Act': [], // handled inline in form
  'Amendment': [], // handled inline
  'Notification': [], // handled inline
  'Circular': [], // handled inline
  'Policy': [], // handled inline
  'Rules & Regulations': [], // handled inline
  'Order / Gazette': [], // handled inline
  'Bye Laws': [], // handled inline
  'Miscellaneous': [], // handled inline
};

// Workflow statuses: DRAFT → PENDING_REVIEW → PUBLISHED
const WORKFLOW_STATUS = { DRAFT: 'draft', PENDING: 'pending', PUBLISHED: 'published' };

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};
const INPUT_BASE = {
  background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
  borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)',
  fontSize: 13, padding: '10px 14px', outline: 'none', width: '100%',
  transition: 'border-color .2s, box-shadow .2s',
};

function parseDisplayRemarks(str) {
  if (!str) return [];
  const lines = str.split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const m = line.match(/^Remark (\d+):\s*(.*)/);
    return m ? { num: parseInt(m[1]), text: m[2] } : { num: i + 1, text: line };
  });
}

const MOCK_VERSIONS = {
  1: [{ v: '2.0', date: '2024-01-15', note: 'Current' },{ v: '1.0', date: '2023-05-10', note: 'Initial upload' }],
  2: [{ v: '1.2', date: '2024-02-10', note: 'Current' },{ v: '1.1', date: '2023-09-01', note: 'Minor edits' },{ v: '1.0', date: '2022-03-15', note: 'Initial upload' }],
};

// Word-level confidence scoring
// Deterministic (hash-based) so scores don't change on re-render.
function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}
function wordConfidence(word) {
  const w = word.trim();
  if (!w) return 100;
  const seed = _hashStr(w);
  if (/^\.{3,}$/.test(w))    return 5  + seed % 12;   // dotted lines = artefact
  if (/^[A-Z]{2,10}$/.test(w)) return 82 + seed % 15; // ALL-CAPS headers
  if (/^[A-Za-z]+$/.test(w)) return 85 + seed % 14;   // clean alpha words
  if (/^\d+$/.test(w))       return 88 + seed % 10;   // numbers
  const specialRatio = (w.match(/[^A-Za-z0-9\s.,;:()\-']/g) || []).length / w.length;
  if (specialRatio > 0.5)    return 10 + seed % 25;
  if (specialRatio > 0.3)    return 30 + seed % 25;
  if (specialRatio > 0.1)    return 52 + seed % 25;
  return 70 + seed % 20;
}
// Extracts text + per-word confidence scores for every page.
async function extractPdfText(file) {
  if (!file || !file.name.endsWith('.pdf')) return { text: '', numPages: 1, pageTexts: [], pageWords: [] };
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const page    = await pdf.getPage(i + 1);
        const content = await page.getTextContent();
        const words   = [];
        for (const item of content.items) {
          // Split each text item into tokens preserving spaces
          item.str.split(/(\s+)/).forEach(token => {
            if (!token) return;
            words.push({ word: token, confidence: /^\s+$/.test(token) ? 100 : wordConfidence(token) });
          });
          if (item.hasEOL) words.push({ word: '\n', confidence: 100 });
        }
        return { text: content.items.map(i => i.str).join(' '), words };
      })
    );

    return {
      text:      pages.map(p => p.text).join('\n'),
      numPages:  pdf.numPages,
      pageTexts: pages.map(p => p.text),
      pageWords: pages.map(p => p.words),
    };
  } catch {
    return { text: '', numPages: 1, pageTexts: [], pageWords: [] };
  }
}
// Helper utilities

function fileIcon(f) {
  if (/\.docx?$/i.test(f.name)) return <FileType size={15} color="#2b579a" />;
  return <FileText size={15} color="var(--primary)" />;
}
function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function isAccepted(f) {
  return (
    f.type === 'application/pdf' || f.name.endsWith('.pdf') ||
    /\.docx?$/i.test(f.name) ||
    f.type === 'application/msword' ||
    f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}
function focusStyle(e) {
  e.target.style.borderColor = 'var(--primary)';
  e.target.style.boxShadow   = '0 0 0 3px rgba(26,86,219,.1)';
}
function blurStyle(e) {
  e.target.style.borderColor = 'var(--surface-border)';
  e.target.style.boxShadow   = 'none';
}

function HierarchyTag({ hierarchy, onOpen, isRef, legalAuthorities }) {
  const hasValues = hierarchy?.act || hierarchy?.chapter || hierarchy?.section;
  const authCount = legalAuthorities ? legalAuthorities.filter(a => a.act).length : 0;

  if (isRef && legalAuthorities !== undefined) {
    return (
      <button type="button" onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: authCount > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', width: '100%', textAlign: 'left' }}>
        <Layers size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {authCount > 0
            ? `${authCount} Legal Authorit${authCount !== 1 ? 'ies' : 'y'} Added`
            : 'Set Legal Authority'}
        </span>
        <ChevronRight size={12} style={{ flexShrink: 0 }} />
      </button>
    );
  }

  return (
    <button type="button" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: hasValues ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', width: '100%', textAlign: 'left' }}>
      <Layers size={13} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {hasValues
          ? (isRef
              ? hierarchy.section ? `${hierarchy.act || '—'} › ${hierarchy.section}` : (hierarchy.act || '—')
              : hierarchy.chapter || hierarchy.section
                ? `${hierarchy.act || '—'} › ${hierarchy.chapter || '—'} › ${hierarchy.section || '—'}`
                : (hierarchy.act || '—'))
          : (isRef ? 'Set Act Reference' : 'Set Hierarchical Tags')}
      </span>
      <ChevronRight size={12} style={{ flexShrink: 0 }} />
    </button>
  );
}
function VersionConflictModal({ existingDoc, newVersion, onUploadAsNew, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Version Conflict Detected</div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-heading)', fontWeight: 600, marginBottom: 4 }}>
            ⚠️ "{existingDoc.title}" already exists
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>
            Current version: v{existingDoc.version || '1.0'} · Uploaded: {existingDoc.uploadedAt}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 18 }}>
          Is this a new version of the existing document?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Cancel
          </button>
          <button onClick={() => onUploadAsNew(newVersion)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Upload as v{newVersion}
          </button>
        </div>
      </div>
    </div>
  );
}
function WorkflowBadge({ status }) {
  const config = {
    [WORKFLOW_STATUS.DRAFT]:     { label: 'DRAFT',          bg: 'rgba(148,163,184,.12)', color: '#64748b' },
    [WORKFLOW_STATUS.PENDING]:   { label: 'PENDING REVIEW', bg: 'rgba(245,158,11,.12)', color: '#d97706' },
    [WORKFLOW_STATUS.PUBLISHED]: { label: 'PUBLISHED',       bg: 'rgba(34,197,94,.12)',  color: '#16a34a' },
  };
  const c = config[status] || config[WORKFLOW_STATUS.DRAFT];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function DocViewModal({ doc, onClose }) {
  const [blobUrl, setBlobUrl]         = useState(null);
  const [pdfDoc, setPdfDoc]           = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [zoom, setZoom]               = useState(100);
  const [rotation, setRotation]       = useState(0);
  const canvasRefs   = useRef([]);
  const containerRef = useRef(null);
  const suppressRef  = useRef(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let url = null;
    setBlobUrl(null); setPdfDoc(null); setCurrentPage(1);
    getPdfFile(doc.id)
      .then(res => {
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

  useEffect(() => {
    const canvas = canvasRefs.current[currentPage - 1];
    if (!canvas || !containerRef.current) return;
    suppressRef.current = true;
    containerRef.current.scrollTo({ top: canvas.offsetTop - 8, behavior: 'smooth' });
    setTimeout(() => { suppressRef.current = false; }, 700);
  }, [currentPage]);

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
    if (best + 1 !== currentPage) setCurrentPage(best + 1);
  }

  const LS = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

  const meta = [
    ['Reference No.',  doc.referenceNumber || null],
    ['Issue Date',     doc.enactmentDate   || null],
    ['Effective From', doc.effectiveFrom   || null],
    ['Gazette Ref.',   doc.gazette         || null],
    ['Legal Authority',doc.authority       || null],
    ['Upload Date',    doc.uploadedAt      || null],
    ['File',           doc.fileName        || null],
  ].filter(([, v]) => v);

  const statusAccent = doc.status === 'approved' ? '#16a34a' : doc.status === 'rejected' ? '#ef4444' : '#f59e0b';
  const statusBg     = doc.status === 'approved' ? 'rgba(34,197,94,.1)'  : doc.status === 'rejected' ? 'rgba(239,68,68,.1)'  : 'rgba(245,158,11,.1)';
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

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0, minHeight: 64 }}>
        {/* Doc icon */}
        <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={18} color={typeColor.accent} />
        </div>
        {/* Title + breadcrumb */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{doc.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>{doc.type}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)' }}>{doc.dept}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', opacity: .7 }}>· {doc.year}</span>
            {doc.version && <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', opacity: .7 }}>· v{doc.version}</span>}
          </div>
        </div>
        {/* Status chip */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px 6px 10px', borderRadius: 20, background: statusBg, border: `1px solid ${statusAccent}44`, flexShrink: 0 }}>
          <StatusIconV size={13} color={statusAccent} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: statusAccent, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>
            {doc.status === 'approved' ? 'APPROVED' : doc.status === 'rejected' ? 'REJECTED' : 'PENDING'}
          </span>
        </div>
        {/* Close */}
        <button onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}>
          <X size={14} /> Close
        </button>
      </div>

      {/* ── 2-panel body ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '57% 43%', overflow: 'hidden' }}>

        {/* ── Left: PDF viewer ── */}
        <div style={{ borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#3a3d40' }}>

          {/* PDF toolbar */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#2d2f31', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <Eye size={14} color="rgba(255,255,255,.7)" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.85)', flex: 1 }}>Original PDF</span>

            {/* Zoom controls */}
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

            {/* Rotate */}
            <button onClick={() => setRotation(r => (r + 90) % 360)}
              style={iconBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'}>
              <RotateCw size={14} />
            </button>

            {/* Open externally */}
            {blobUrl && (
              <a href={blobUrl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(26,86,219,.25)', border: '1px solid rgba(26,86,219,.4)', color: '#93c5fd', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.4)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,86,219,.25)'}>
                <ExternalLink size={12} /> Open
              </a>
            )}
          </div>

          {/* PDF scroll area */}
          <div ref={containerRef} onScroll={handleScroll}
            style={{ flex: 1, overflow: 'auto', background: '#525659', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {!blobUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14 }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: 'rgba(255,255,255,.8)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.6)', letterSpacing: '.04em' }}>Loading PDF…</span>
              </div>
            )}
            {blobUrl && Array.from({ length: totalPages }, (_, i) => (
              <canvas key={i} ref={el => { canvasRefs.current[i] = el; }}
                style={{ display: 'block', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,.6)', maxWidth: '100%' }} />
            ))}
          </div>

          {/* Page navigation */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#2d2f31', flexShrink: 0 }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === 1 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
              ← Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
              <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>{currentPage}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>of</span>
              <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.55)' }}>{totalPages}</span>
            </div>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === totalPages ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === totalPages ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
              Next →
            </button>
          </div>
        </div>

        {/* ── Right: Document details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)' }}>

          {/* Right panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-50)', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(26,86,219,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} color="var(--primary)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Document Details</span>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 28px' }}>

            {/* Core info strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[
                { label: 'Type',       value: doc.type,           color: typeColor.accent, bg: typeColor.bg },
                { label: 'Department', value: doc.dept,           color: 'var(--primary)', bg: 'rgba(26,86,219,.07)' },
                { label: 'Year',       value: String(doc.year),   color: '#64748b',        bg: 'rgba(100,116,139,.08)' },
                { label: 'Version',    value: `v${doc.version || '1.0'}`, color: '#64748b', bg: 'rgba(100,116,139,.08)' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ padding: '12px 14px', borderRadius: 10, background: bg, border: '1px solid transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 4, opacity: .8 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Additional metadata */}
            {meta.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Additional Info</div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  {meta.map(([k, v], idx) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, borderBottom: idx < meta.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ padding: '10px 14px', minWidth: 128, flexShrink: 0, background: 'var(--surface-50)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>
                        {k}
                      </div>
                      <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-heading)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>
                        {String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {doc.desc && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>Description</div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 13, color: 'var(--text-color)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {doc.desc}
                </div>
              </div>
            )}

            {/* Reviewer Remarks */}
            {doc.approval && (
              <div>
                <div style={{ ...LS, marginBottom: 10 }}>Reviewer Remarks</div>
                <div style={{ borderRadius: 12, border: `1px solid ${statusAccent}44`, overflow: 'hidden' }}>
                  {/* Approver header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: doc.status === 'approved' ? 'rgba(34,197,94,.06)' : doc.status === 'rejected' ? 'rgba(239,68,68,.06)' : 'rgba(245,158,11,.06)', borderBottom: doc.approval.comments ? `1px solid ${statusAccent}22` : 'none' }}>
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
                  {/* Remarks list */}
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
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function UploaderDashboard({ activePage, onAuditLog, documents = [], onAddDocument, taxonomy = [] }) {
  const { user } = useAuth();
  const [deptsData, setDeptsData] = useState([]);
  const [typesData, setTypesData] = useState([]);
  const DEPTS = deptsData.length > 0 ? deptsData.map(d => d.name) : DEFAULT_DEPTS;
  const TYPES = typesData.length > 0 ? typesData.map(d => d.name) : DEFAULT_TYPES;

  const [showTypeChanger, setShowTypeChanger] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    getDepartments().then(res => setDeptsData(res.data)).catch(() => {});
    getDocumentTypes().then(res => setTypesData(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showTypeChanger) return;
    const close = () => setShowTypeChanger(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showTypeChanger]);

  const [uploads, setUploads] = useState([]);
  const [myDocsLoading, setMyDocsLoading] = useState(false);
  const [myDocsError,   setMyDocsError]   = useState('');
  const [remarksModal,  setRemarksModal]  = useState(null);
  const [viewDoc,       setViewDoc]       = useState(null);

  function mapApiDoc(d) {
    return {
      id:              d.id,
      uid:             `api-${d.id}`,
      // Metadata (title/type/dept) can be null for drafts uploaded before the tagging step is completed —
      // fall back to the raw filename so search/sort (which call .toLowerCase() on these) never crash on null.
      title:           d.document_name || d.original_filename || 'Untitled Document',
      type:            d.document_type_name || 'Unclassified',
      dept:            d.department_name || 'Unassigned',
      year:            d.issue_date ? new Date(d.issue_date).getFullYear() : new Date(d.created_at).getFullYear(),
      status:          d.status || 'pending',
      workflowStatus:  d.status === 'approved' ? WORKFLOW_STATUS.PUBLISHED : d.status === 'rejected' ? WORKFLOW_STATUS.DRAFT : WORKFLOW_STATUS.PENDING,
      version:         d.version_no || '1.0',
      fileName:        d.original_filename,
      fileSize:        d.file_size,
      desc:            d.description || '',
      uploadedAt:      d.created_at?.split('T')[0] || '',
      ocrStatus:       'completed',
      gazette:         d.gazette_reference || '',
      authority:       d.legal_authority || '',
      enactmentDate:   d.issue_date || '',
      effectiveFrom:   d.effective_from || '',
      referenceNumber: d.reference_number || '',
      shortTitle:      d.short_title || '',
      tags:            d.tags || [],
      relationships:   d.relationships || [],
      approval:        d.latest_approval || null,
    };
  }

  useEffect(() => {
    if (activePage !== 'myuploads') return;
    if (!localStorage.getItem('token')) return;
    setMyDocsLoading(true);
    setMyDocsError('');
    getMyDocuments()
      .then(res => setUploads((res.data.documents || []).map(mapApiDoc)))
      .catch(err => {
        const detail = err.response?.data?.detail;
        setMyDocsError(typeof detail === 'string' ? detail : 'Failed to load your documents');
      })
      .finally(() => setMyDocsLoading(false));
  }, [activePage]);

  const [files, setFiles]           = useState([]);
  const [dragOver, setDragOver]     = useState(false);
  const [form, setForm]             = useState({ act: '', dept: user?.dept || '', type: '', version: '1.0', desc: '', enactmentDate: '', parentAct: '', changeTypes: [] });
  const [amendmentProvisions, setAmendmentProvisions] = useState([]);
  const [typeFields, setTypeFields]  = useState({});
  const [hierarchy, setHierarchy]   = useState({ act: '', actId: null, chapter: '', section: '', subsection: '' });
  const [rejected, setRejected]     = useState([]);
  const [versionModal, setVersionModal] = useState(null);
  const [conflictModal, setConflictModal] = useState(null); // { existingDoc, pendingDocs, pendingRelations }

  // Correction request state
  const [correctionModal, setCorrectionModal] = useState(null); // { doc }
  const [correctionReason, setCorrectionReason] = useState('');

  // Relationship state
  const [relations, setRelations]     = useState([]);
  const [relType, setRelType]         = useState(REL_TYPES[0]);
  const [relDocType, setRelDocType]   = useState('');
  const [relTarget, setRelTarget]     = useState('');
  const [relSearch, setRelSearch]     = useState('');
  const [relNote, setRelNote]         = useState('');
  const [amendChanges, setAmendChanges] = useState([{ chapter: '', section: '', subsection: '', changeType: 'Amended', description: '' }]);
  const [legalAuthorities, setLegalAuthorities] = useState([{ act: '', sections: [''] }]);
  const [editingAuthIdx, setEditingAuthIdx] = useState(0);    // index of legal authority currently expanded for editing; null = all collapsed
  const [showAuthDrop, setShowAuthDrop] = useState(null);     // legal authority act dropdown
  const [showSectionDrop, setShowSectionDrop] = useState(null); // legal authority section dropdown
  const [showHierActDrop, setShowHierActDrop] = useState(false); // hierarchy drawer act dropdown
  const [actSuggestions, setActSuggestions]   = useState([]);
  const [actSearching,   setActSearching]     = useState(false);
  const actSearchTimer = useRef(null);
  const [showHierSecDrop, setShowHierSecDrop] = useState(false); // hierarchy drawer section dropdown
  const [showRelDrop, setShowRelDrop] = useState(false);
  const [relSection, setRelSection] = useState('');            // section of the linked document
  const [showRelSecDrop, setShowRelSecDrop] = useState(false); // relationship section dropdown
  const [relDocSuggestions, setRelDocSuggestions] = useState([]); // real API results for "Link to Document", keyed by whichever Target Document Type is selected
  const [relDocSearching,   setRelDocSearching]   = useState(false);
  const relDocSearchTimer = useRef(null);
  const [parentActSearch, setParentActSearch] = useState('');
  const [showParentActDrop, setShowParentActDrop] = useState(false);
  const [drawerType,      setDrawerType]      = useState(null); // null | 'hierarchy' | 'relationship'
  const [drawerHierarchy, setDrawerHierarchy] = useState({ act: '', actId: null, chapter: '', section: '', subsection: '' });

  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFields, setBulkFields]     = useState({ dept: '', type: '', year: '' });
  const [fileRefs,    setFileRefs]    = useState([]); // [{ fileName, fileRef, originalFilename, fileSize }]
  const [uploadStep, setUploadStep]   = useState(null); // null | 'uploading' | 'ready' | 'saving' | 'done' | 'error'
  const [uploadError, setUploadError] = useState('');

  // Table filter + sort
  const [tableSearch, setTableSearch] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCol,     setSortCol]     = useState('uploadedAt');
  const [sortDir,     setSortDir]     = useState('desc');

  const inputRef     = useRef();
  const uploadsTableRef = useRef();
  const fmt      = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const approvedDocs = documents.filter(d => d.status === 'approved');

  // Extract all "Section X" mentions from a document's description + section field
  function getSectionsFromDoc(actTitle) {
    const doc = documents.find(d => d.title === actTitle) || approvedDocs.find(d => d.title === actTitle);
    if (!doc) return [];

    // if the document has a pre-defined sections array, use it directly
    if (doc.sections?.length) return doc.sections;

    const found = new Set();

    // from hierarchy
    if (doc.hierarchy?.section) found.add(`Section ${doc.hierarchy.section}`);
    if (doc.hierarchy?.chapter) found.add(`Chapter ${doc.hierarchy.chapter}`);

    // from legalAuthorities sections entered during upload
    (doc.legalAuthorities || []).forEach(auth => {
      (auth.sections || []).filter(Boolean).forEach(s => found.add(s));
    });

    // from amendmentProvisions
    (doc.amendmentProvisions || []).forEach(p => {
      if (p.section) found.add(`Section ${p.section}`);
      if (p.chapter) found.add(`Chapter ${p.chapter}`);
      if (p.subsection) found.add(`Section ${p.section}(${p.subsection})`);
    });

    // from description text
    if (doc.desc) {
      for (const m of doc.desc.matchAll(/Section\s+(\d+[A-Za-z]?(?:\([a-z0-9]+\))*)/gi))
        found.add(`Section ${m[1]}`);
      for (const m of doc.desc.matchAll(/Chapter\s+([IVXivx]+|\d+[A-Za-z]?)/gi))
        found.add(`Chapter ${m[1].toUpperCase()}`);
    }

    if (doc.authority) {
      for (const m of doc.authority.matchAll(/Section\s+(\d+[A-Za-z]?(?:\([a-z0-9]+\))*)/gi))
        found.add(`Section ${m[1]}`);
    }

    return [...found].sort();
  }
  const parentActFiltered = approvedDocs
    .filter(d => d.title.toLowerCase().includes(parentActSearch.toLowerCase()))
    .slice(0, 8);

  async function addFiles(fileList) {
    const arr = Array.from(fileList);
    setRejected(arr.filter(f => !isAccepted(f)).map(f => f.name));
    const accepted = arr.filter(f => isAccepted(f));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setFiles(f => f.filter(x => x.name !== name));
    setFileRefs(r => r.filter(x => x.fileName !== name));
  }
  function handleDrop(e) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }

  function fetchDocSuggestions(documentType, text) {
    clearTimeout(actSearchTimer.current);
    if (!text || text.length < 1) { setActSuggestions([]); return; }
    actSearchTimer.current = setTimeout(() => {
      setActSearching(true);
      searchDocuments(documentType, text, 10)
        .then(res => setActSuggestions(res.data.results || []))
        .catch(() => setActSuggestions([]))
        .finally(() => setActSearching(false));
    }, 280);
  }

  // Same real API search as fetchDocSuggestions, used for the "Link to Document" picker.
  // Whichever Target Document Type is selected gets sent as document_type in the API payload.
  function fetchRelDocSuggestions(documentType, text) {
    clearTimeout(relDocSearchTimer.current);
    if (!text || text.length < 1) { setRelDocSuggestions([]); return; }
    relDocSearchTimer.current = setTimeout(() => {
      setRelDocSearching(true);
      searchDocuments(documentType, text, 10)
        .then(res => setRelDocSuggestions(res.data.results || []))
        .catch(() => setRelDocSuggestions([]))
        .finally(() => setRelDocSearching(false));
    }, 280);
  }

  function addRelation() {
    if (!relTarget) return;
    if (relTarget.startsWith('__pending__:')) {
      const pendingName = relTarget.replace('__pending__:', '');
      setRelations(r => [...r, { targetId: null, targetTitle: pendingName, targetType: relDocType, label: relType, note: relNote.trim(), section: relSection.trim(), isPending: true }]);
    } else if (relTarget.startsWith('__api__:')) {
      const [, apiId, ...nameParts] = relTarget.split(':');
      const apiTitle = nameParts.join(':');
      if (relations.find(r => r.targetId === apiId && r.label === relType)) return;
      setRelations(r => [...r, { targetId: apiId, targetTitle: apiTitle, targetType: relDocType, label: relType, note: relNote.trim(), section: relSection.trim(), isPending: false }]);
    } else {
      const doc = documents.find(d => d.uid === relTarget);
      if (!doc || relations.find(r => r.targetId === relTarget && r.label === relType)) return;
      setRelations(r => [...r, { targetId: relTarget, targetTitle: doc.title, targetType: doc.type || relDocType, label: relType, note: relNote.trim(), section: relSection.trim(), isPending: false }]);
    }
    setRelTarget(''); setRelSearch(''); setRelNote(''); setRelDocType(''); setRelSection(''); setRelDocSuggestions([]);
  }

  // Clears all transient "Add Relationship" drawer fields so stale search/selection
  // doesn't leak into the next time the drawer is opened (for this doc or a different one).
  function closeDrawer() {
    setDrawerType(null);
    setRelTarget(''); setRelSearch(''); setRelType(REL_TYPES[0]); setRelDocType('');
    setRelSection(''); setRelNote(''); setRelDocSuggestions([]); setShowRelDrop(false);
    setEditingAuthIdx(null);
    // Only "Confirmed" legal authorities persist — anything typed but never ticked is discarded on close.
    setLegalAuthorities(p => {
      const confirmed = p.filter(a => a.confirmed);
      return confirmed.length > 0 ? confirmed : [{ act: '', sections: [''], confirmed: false }];
    });
  }
  function removeRelation(idx) { setRelations(r => r.filter((_, i) => i !== idx)); }

  // Finalize upload after conflict check
  async function finalizeUpload(newDocs, finalRelations) {
    const docsWithWorkflow = newDocs.map(d => ({ ...d, workflowStatus: WORKFLOW_STATUS.DRAFT }));

    // Add to system (status = pending, workflowStatus = DRAFT)
    docsWithWorkflow.forEach(doc => {
      const uid = `upload-${doc.id}`;
      onAddDocument?.({ ...doc, uid }, finalRelations);
      setUploads(u => [{ ...doc, uid }, ...u]);
    });

    setFiles([]); setFileRefs([]); setRelations([]);
    setForm({ act:'',dept:user?.dept||'',type:'',version:'1.0',desc:'',enactmentDate:'',parentAct:'',changeTypes:[] });
    setHierarchy({ act:'', actId: null, chapter:'',section:'',subsection:'' });
    setAmendmentProvisions([]); setParentActSearch(''); setTypeFields({});

    // Move newly uploaded docs from DRAFT to PENDING (queued for approver review)
    setTimeout(() => {
      setUploads(u => u.map(ud =>
        docsWithWorkflow.some(d => d.id === ud.id) ? { ...ud, workflowStatus: WORKFLOW_STATUS.PENDING } : ud
      ));
    }, 1800);

    onAuditLog?.(`Uploaded ${docsWithWorkflow.length} document(s): ${docsWithWorkflow.map(d => d.title).join(', ')}`);
  }

  // Runs the OCR eligibility check (POST /pdf/upload-file) for any files not yet checked.
  // A file that passes gets a file_ref (reused later so handleSubmit doesn't re-upload it)
  // and the API's summary auto-fills the description field — the user can still edit it.
  async function checkFiles() {
    if (files.length === 0) return;
    const hasToken = !!localStorage.getItem('token');
    setUploadError('');
    setUploadStep('uploading');

    for (const f of files) {
      if (fileRefs.some(r => r.fileName === f.name)) continue;

      if (!hasToken) {
        setFileRefs(prev => [...prev, { fileName: f.name, fileRef: null, originalFilename: f.name, fileSize: f.size, summary: '' }]);
        continue;
      }

      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await uploadPdfFile(fd);
        const { file_ref, original_filename, file_size, summary } = res.data;
        setFileRefs(prev => [...prev, { fileName: f.name, fileRef: file_ref, originalFilename: original_filename, fileSize: file_size, summary }]);
        if (summary) setForm(prevForm => (prevForm.desc ? prevForm : { ...prevForm, desc: summary }));
      } catch (err) {
        const detail = err.response?.data?.detail;
        setUploadError(typeof detail === 'string' ? detail : `Document check failed for "${f.name}". Please verify the file and try again.`);
        setUploadStep('error');
        return;
      }
    }

    setUploadStep('ready');
  }

  // Upload file and save metadata
  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) return;

    setUploadError('');
    const hasToken  = !!localStorage.getItem('token');
    const typeObj   = typesData.find(d => d.name === form.type);
    const newDocs   = [];

    // Derive the type-specific reference number from typeFields
    const REFERENCE_NUMBER_KEY = {
      'Act':               'actNumber',
      'Amendment':         'amendmentNumber',
      'Circular':          'circularNumber',
      'Notification':      'notificationNumber',
      'Order / Gazette':   'orderNumber',
      'Policy':            'policyNumber',
      'Rules & Regulations': 'ruleNumber',
      'Bye Laws':          'byeLawNumber',
      'Miscellaneous':     'miscNumber',
    };
    const refNumKey = REFERENCE_NUMBER_KEY[form.type];
    const referenceNumber = refNumKey ? (typeFields[refNumKey] || '') : '';

    // effective_from: different typeFields key per type
    const effectiveFrom = typeFields.commencementDate || typeFields.effectiveFrom || null;

    // legal_authority: join legalAuthorities entries that have an act set
    const legalAuthStr = legalAuthorities
      .filter(a => a.act)
      .map(a => {
        const sections = (a.sections || []).filter(Boolean);
        return sections.length > 0 ? `${a.act} (${sections.join(', ')})` : a.act;
      })
      .join('; ')
      || ((form.type === 'Rules & Regulations' || form.type === 'Bye Laws') && hierarchy.act
            ? (hierarchy.section ? `${hierarchy.act} (${hierarchy.section})` : hierarchy.act)
            : '');

    // relationships: map local relation objects to API shape
    const explicitRels = relations
      .filter(r => !r.isPending && r.targetId)
      .map(r => {
        const doc = documents.find(d => d.uid === r.targetId);
        return {
          pdf_id: typeof doc?.id === 'number' ? doc.id : null,
          type:   r.label?.toLowerCase().replace(/\s+/g, '_') || 'related',
        };
      })
      .filter(r => r.pdf_id !== null);

    // For Amendment: auto-include hierarchy Act as parent_act if selected from API search
    const hierarchyRel = (form.type === 'Amendment' && hierarchy.actId &&
      !explicitRels.some(r => r.pdf_id === hierarchy.actId))
      ? [{ pdf_id: hierarchy.actId, type: 'parent_act' }]
      : [];

    const relationshipsPayload = [...explicitRels, ...hierarchyRel];

    for (const f of files) {
      let apiDoc = null;

      if (hasToken) {
        // Step 1: get the file_ref — reuse the one obtained during the "Upload & Check" step,
        // falling back to a fresh upload if it's somehow missing (e.g. the pre-check was skipped).
        let fileRef = fileRefs.find(r => r.fileName === f.name)?.fileRef ?? null;
        if (!fileRef) {
          setUploadStep('uploading');
          try {
            const fd = new FormData();
            fd.append('file', f);
            const res = await uploadPdfFile(fd);
            fileRef = res.data.file_ref;
          } catch (err) {
            const detail = err.response?.data?.detail;
            setUploadError(typeof detail === 'string' ? detail : `Upload failed for "${f.name}"`);
            setUploadStep('error');
            return;
          }
        }

        // Step 2: save metadata
        setUploadStep('saving');
        try {
          const payload = {
            file_ref:              fileRef,
            document_type_id:      typeObj?.id ?? null,
            document_name:         form.act || f.name.replace(/\.(pdf|docx?)$/i, ''),
            issue_date:            form.enactmentDate || null,
            reference_number:      referenceNumber,
            effective_from:        effectiveFrom,
            gazette_reference:     typeFields.gazetteRef || '',
            legal_authority:       legalAuthStr,
            version_no:            form.version || '1.0',
            short_title:           typeFields.shortTitle || '',
            valid_until:           typeFields.validity || null,
            sector_domain:         typeFields.sector || '',
            implementing_agency:   typeFields.implementingAgency || '',
            next_review_date:      typeFields.reviewDate || null,
            rule_making_authority: typeFields.ruleAuthority || '',
            tag_ids:               [],
            relationships:         relationshipsPayload,
            description:           (() => {
              const provisions = form.type === 'Amendment'
                ? amendChanges.filter(c => c.section || c.chapter)
                : [];
              const suffix = provisions.length > 0
                ? '\n__PROVISIONS__:' + JSON.stringify(provisions)
                : '';
              return (form.desc || '') + suffix;
            })(),
          };
          const res2 = await uploadPdfMetadata(payload);
          apiDoc = res2.data;
          createNotification({
            toRole:       'approver',
            type:         'new_upload',
            title:        'New Document Submitted',
            message:      `"${form.act || f.name}" uploaded by ${user?.name || user?.username || 'Uploader'} — awaiting your review`,
            docId:        apiDoc?.id,
            docTitle:     form.act || f.name,
            uploaderName: user?.name || user?.username,
          });
        } catch (err) {
          const detail = err.response?.data?.detail;
          setUploadError(typeof detail === 'string' ? detail : `Failed to save metadata for "${f.name}"`);
          setUploadStep('error');
          return;
        }
      }

      // Extract text from PDF regardless of API availability
      const { text: extractedText, numPages, pageTexts, pageWords } = f.name.endsWith('.pdf')
        ? await extractPdfText(f)
        : { text: '', numPages: null, pageTexts: [], pageWords: [] };

      newDocs.push({
        id:            apiDoc?.id ?? (Date.now() + Math.random()),
        title:         apiDoc?.document_name || form.act || f.name.replace(/\.(pdf|docx?)$/i, ''),
        type:          typeObj?.name || form.type || 'Act',
        dept:          user?.dept || form.dept || 'General Administration',
        year:          form.enactmentDate ? new Date(form.enactmentDate).getFullYear() : new Date().getFullYear(),
        status:        'pending',
        legalStatus:   'active',
        pages:         /\.docx?$/i.test(f.name) ? null : (numPages || 1),
        uploader:      user?.name || 'Uploader',
        uploadedAt:    new Date().toISOString().split('T')[0],
        section:       '1', paragraph: '1',
        version:       apiDoc?.version_no || form.version || '1.0',
        desc:          form.desc || '',
        ocrStatus:     /\.docx?$/i.test(f.name) ? 'queued' : 'processing',
        fileName:      f.name,
        isWord:        /\.docx?$/i.test(f.name),
        fileUrl:       f.name.endsWith('.pdf') ? URL.createObjectURL(f) : null,
        hierarchy,
        gazette:           apiDoc?.gazette_reference || typeFields.gazetteRef || '',
        authority:         apiDoc?.legal_authority   || legalAuthStr || '',
        enactmentDate:     apiDoc?.issue_date        || form.enactmentDate || '',
        effectiveFrom:     apiDoc?.effective_from    || effectiveFrom || '',
        referenceNumber:   apiDoc?.reference_number  || referenceNumber || '',
        shortTitle:        apiDoc?.short_title       || typeFields.shortTitle || '',
        amendmentProvisions: form.type === 'Amendment' ? amendChanges.filter(p => p.section || p.chapter) : [],
        typeFields:        { ...typeFields },
        legalAuthorities:  legalAuthorities.filter(a => a.act),
        docRelations:      relations.map(r => ({ ...r })),
        parentAct:         form.parentAct || '',
        extractedText:  extractedText || '',
        extractedPages: pageTexts.length > 0 ? pageTexts : null,
        extractedWords: pageWords.length  > 0 ? pageWords : null,
        ocrConfidence:  extractedText ? 95 : null,
      });

      createNotification({
        toRole:       'approver',
        type:         'new_upload',
        title:        'New Document Submitted',
        message:      `"${form.act || f.name}" uploaded by ${user?.name || user?.username || 'Uploader'} — awaiting your review`,
        docId:        apiDoc?.id ?? null,
        docTitle:     form.act || f.name,
        uploaderName: user?.name || user?.username,
      });
    }

    const conflict = newDocs.find(d =>
      documents.some(ex => ex.title.toLowerCase() === d.title.toLowerCase() && ex.status !== 'rejected')
    );
    if (conflict) {
      const existing   = documents.find(ex => ex.title.toLowerCase() === conflict.title.toLowerCase());
      const currentVer = parseFloat(existing.version || '1.0');
      setUploadStep(null);
      setConflictModal({
        existingDoc:      existing,
        newVersion:       (currentVer + 0.1).toFixed(1),
        pendingDocs:      newDocs,
        pendingRelations: relations,
      });
    } else {
      setUploadStep('done');
      setTimeout(() => { setUploadStep(null); }, 2000);
      finalizeUpload(newDocs, relations);
    }
  }
  // Called when user clicks "Upload as vX.X" in the conflict modal
  function handleConflictResolve(newVersion) {
    const { pendingDocs, pendingRelations } = conflictModal;
    const updatedDocs = pendingDocs.map(d => ({ ...d, version: newVersion }));
    setConflictModal(null);
    finalizeUpload(updatedDocs, pendingRelations);
  }

  const draftUploads = uploads.filter(d => !d.workflowStatus || d.workflowStatus === WORKFLOW_STATUS.DRAFT);

  function toggleSelectDoc(id) {
    const doc = uploads.find(d => d.id === id);
    if (doc && doc.workflowStatus && doc.workflowStatus !== WORKFLOW_STATUS.DRAFT) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === draftUploads.length && draftUploads.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(draftUploads.map(d => d.id)));
  }
  function applyBulkEdit() {
    setUploads(u => u.map(doc => {
      if (!selectedIds.has(doc.id)) return doc;
      return {
        ...doc,
        ...(bulkFields.dept && { dept: bulkFields.dept }),
        ...(bulkFields.type && { type: bulkFields.type }),
        ...(bulkFields.year && { year: Number(bulkFields.year) }),
      };
    }));
    setSelectedIds(new Set());
    setBulkEditOpen(false);
    setBulkFields({ dept: '', type: '', year: '' });
    onAuditLog?.(`Bulk edited ${selectedIds.size} documents`);
  }

  function downloadAuditTrail() {
    const rows = [['Document Title','Type','Department','Year','Status','Workflow Status','Uploaded On','Version','OCR Status']];
    uploads.forEach(d => rows.push([d.title,d.type,d.dept,d.year,d.status,d.workflowStatus||'draft',d.uploadedAt,d.version||'1.0',d.ocrStatus||'completed']));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = document.createElement('a'); a.href = url; a.download = 'upload_audit_trail.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // My Uploads page
  if (activePage === 'myuploads') {
    const approved  = uploads.filter(d => d.status === 'approved').length;
    const pending   = uploads.filter(d => d.status === 'pending').length;
    const rejected  = uploads.filter(d => d.status === 'rejected').length;
    const published = uploads.filter(d => d.workflowStatus === WORKFLOW_STATUS.PUBLISHED).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        {/* Version history modal */}
        {versionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVersionModal(null)}>
            <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, minWidth: 360, maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
                Version History — {versionModal.title}
              </div>
              {(MOCK_VERSIONS[versionModal.id] || [{ v: versionModal.version || '1.0', date: versionModal.uploadedAt, note: 'Current' }]).map((ver, i, arr) => (
                <div key={ver.v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      v{ver.v}
                      {i === 0 && <span style={{ fontSize: 10, background: 'rgba(26,86,219,.12)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>CURRENT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2, fontFamily: 'var(--mono)' }}>{ver.date} — {ver.note}</div>
                  </div>
                  {i > 0 && (
                    <button onClick={() => { alert(`Rolling back to v${ver.v}.`); setVersionModal(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <RotateCcw size={12} /> Rollback
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setVersionModal(null)} style={{ marginTop: 18, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontFamily: 'var(--font)', fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        )}

        {/* Remarks modal */}
        {remarksModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setRemarksModal(null)}>
            <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, minWidth: 400, maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,.3)', width: '90vw' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>Reviewer Remarks</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{remarksModal.title}</div>
                </div>
                <button onClick={() => setRemarksModal(null)}
                  style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Status + approver */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                padding: '10px 14px', borderRadius: 8,
                background: remarksModal.status === 'approved' ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                border: `1px solid ${remarksModal.status === 'approved' ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
              }}>
                {remarksModal.status === 'approved'
                  ? <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                  : <XCircle    size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                }
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: remarksModal.status === 'approved' ? '#16a34a' : '#ef4444' }}>
                    {remarksModal.status === 'approved' ? 'Approved' : 'Rejected'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    By {remarksModal.approval.approver_first_name
                      ? `${remarksModal.approval.approver_first_name} ${remarksModal.approval.approver_last_name || ''}`.trim()
                      : remarksModal.approval.approver_username}
                    {' · '}
                    {remarksModal.approval.acted_at?.split('T')[0] || '—'}
                  </div>
                </div>
              </div>

              {/* Remarks list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parseDisplayRemarks(remarksModal.approval.comments).map(({ num, text }) => (
                  <div key={num} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--primary)', flexShrink: 0, minWidth: 62 }}>
                      Remark {num}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-color)', lineHeight: 1.6 }}>{text || '—'}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setRemarksModal(null)} style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontFamily: 'var(--font)', fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Full-screen document viewer */}
        {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}

        {/* API loading / error */}
        {myDocsLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', animation: 'pulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}
        {myDocsError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{myDocsError}</span>
            <button onClick={() => { setMyDocsError(''); setMyDocsLoading(true); getMyDocuments().then(r => setUploads((r.data.documents||[]).map(mapApiDoc))).catch(e => setMyDocsError(e.response?.data?.detail || 'Failed to load')).finally(() => setMyDocsLoading(false)); }}
              style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Retry
            </button>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Uploads',  value: uploads.length, bg: 'rgba(26,86,219,.12)',  color: 'var(--primary)', icon: FileText,    filter: 'all' },
            { label: 'Approved',       value: approved,        bg: 'rgba(34,197,94,.12)',  color: '#22c55e',        icon: CheckCircle, filter: 'approved' },
            { label: 'Pending Review', value: pending,         bg: 'rgba(245,158,11,.12)', color: '#f59e0b',        icon: TrendingUp,  filter: 'pending' },
            { label: 'Rejected',       value: rejected,        bg: 'rgba(239,68,68,.12)',  color: '#ef4444',        icon: XCircle,     filter: 'rejected' },
          ].map(s => {
            const isActive = filterStatus === s.filter;
            return (
            <Card key={s.label} style={{ cursor: 'pointer', outline: isActive ? `2px solid ${s.color}` : '2px solid transparent', transition: 'all .2s' }}
              onClick={() => { setFilterStatus(f => f === s.filter ? '' : s.filter); setTimeout(() => uploadsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
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

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: 'rgba(26,86,219,.06)', border: '1px solid rgba(26,86,219,.2)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} selected</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>· Draft only</span>
            <button onClick={() => setBulkEditOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(26,86,219,.3)', background: 'rgba(26,86,219,.08)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Edit3 size={12} /> Bulk Edit
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Clear Selection
            </button>
          </div>
        )}

        {/* Bulk edit panel */}
        {bulkEditOpen && selectedIds.size > 0 && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag size={14} color="var(--primary)" />
              Bulk Edit — {selectedIds.size} Draft Document{selectedIds.size !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11.5, color: '#d97706', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 7, padding: '6px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} color="#d97706" />
              Only Draft documents can be edited. Pending and Published documents require a Correction Request.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[
                { label: 'Department', key: 'dept', opts: DEPTS },
                { label: 'Type',       key: 'type', opts: TYPES },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{label}</div>
                  <select value={bulkFields[key]} onChange={e => setBulkFields(f => ({ ...f, [key]: e.target.value }))}
                    style={{ ...INPUT_BASE, cursor: 'pointer', appearance: 'none' }}
                    onFocus={focusStyle} onBlur={blurStyle}>
                    <option value="">— Keep existing —</option>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Year</div>
                <input type="number" value={bulkFields.year} onChange={e => setBulkFields(f => ({ ...f, year: e.target.value }))}
                  placeholder="Leave blank to keep" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkEditOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Cancel
              </button>
              <button onClick={applyBulkEdit}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Apply to {selectedIds.size} Documents
              </button>
            </div>
          </Card>
        )}

        {/* Uploads table */}
        {(() => {
          // Compute filtered and sorted list
          const SORT_KEY = { 'title': d => d.title, 'type': d => d.type, 'dept': d => d.dept,
            'year': d => d.year, 'uploadedAt': d => d.uploadedAt, 'status': d => d.status };
          const baseList = filterStatus === 'approved' ? uploads.filter(d => d.status === 'approved')
                         : filterStatus === 'pending'  ? uploads.filter(d => d.status === 'pending')
                         : filterStatus === 'rejected' ? uploads.filter(d => d.status === 'rejected')
                         : uploads;
          const allFiltered = baseList
            .filter(d => !tableSearch || d.title.toLowerCase().includes(tableSearch.toLowerCase()))
            .filter(d => !filterType  || d.type === filterType)
            .sort((a, b) => {
              const ka = SORT_KEY[sortCol]?.(a) ?? '';
              const kb = SORT_KEY[sortCol]?.(b) ?? '';
              return sortDir === 'asc' ? (ka > kb ? 1 : -1) : (ka < kb ? 1 : -1);
            });
          const filtered = allFiltered;

          function toggleSort(col) {
            if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setSortCol(col); setSortDir('asc'); }
          }

          const SortBtn = ({ col, label }) => {
            const active = sortCol === col;
            return (
              <button onClick={() => toggleSort(col)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0, fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: active ? 'var(--primary)' : 'var(--text-color-secondary)' }}>
                {label}
                <span style={{ fontSize: 9, lineHeight: 1, opacity: active ? 1 : 0.4 }}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
              </button>
            );
          };

          return (
        <div ref={uploadsTableRef} style={{ scrollMarginTop: 16 }}>
        <Card padding="0">

          {/* ── Header ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>My Uploads</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
              {filtered.length} document{filtered.length !== 1 ? 's' : ''}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {bulkSelectMode ? (
                <button onClick={() => { setBulkSelectMode(false); setSelectedIds(new Set()); setBulkEditOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <X size={12} /> Cancel Selection
                </button>
              ) : (
                <button onClick={() => setBulkSelectMode(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <CheckSquare size={13} /> Select
                </button>
              )}
              <button onClick={downloadAuditTrail}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                <Download size={13} /> Audit Trail
              </button>
            </div>
          </div>

          {/* ── Search + Sort + Filter ── */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 320 }}>
                <Search size={13} color="var(--text-color-secondary)" />
                <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search documents…"
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
                {tableSearch && <button onClick={() => setTableSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
              </div>
              {/* Active status filter chip */}
              {filterStatus && filterStatus !== 'all' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 20, background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)', fontSize: 12, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                  {{ approved: 'Approved', pending: 'Pending Review', rejected: 'Rejected' }[filterStatus]}
                  <button onClick={() => setFilterStatus('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
                </div>
              )}
              {/* Sort controls */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginRight: 2 }}>Sort:</span>
                {[
                  { col: 'uploadedAt', label: 'Date' },
                  { col: 'title',      label: 'Title' },
                  { col: 'status',     label: 'Status' },
                  { col: 'type',       label: 'Type' },
                ].map(({ col, label }) => {
                  const active = sortCol === col;
                  return (
                    <button key={col} onClick={() => toggleSort(col)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 11px', borderRadius: 20, border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`, background: active ? 'rgba(26,86,219,.08)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}>
                      {label}{active && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Type filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(type => {
                const count  = uploads.filter(d => d.type === type).length;
                const active = filterType === type;
                const c = TYPE_CARD_COLORS[type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                return (
                  <button key={type} type="button" onClick={() => setFilterType(active ? '' : type)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, transition: 'all .15s', background: active ? c.accent : 'var(--surface-card)', border: `1.5px solid ${active ? c.accent : c.accent + '55'}`, color: active ? 'white' : c.text || c.accent, opacity: count === 0 ? 0.4 : 1 }}>
                    {type}
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-ground)', color: active ? 'white' : 'var(--text-color-secondary)', padding: '0 5px', borderRadius: 10 }}>{count}</span>
                  </button>
                );
              })}
              {filterType && (
                <button type="button" onClick={() => setFilterType('')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--surface-border)', color: 'var(--text-color-secondary)' }}>
                  <X size={10} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Column headers ── */}
          {(() => {
            const cols = bulkSelectMode ? '4px 48px 1fr 190px 115px 280px' : '4px 1fr 190px 115px 280px';
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-50)', borderBottom: '2px solid var(--surface-border)' }}>
                  <div />
                  {bulkSelectMode && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 16px' }}>
                      <button onClick={toggleSelectAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                        {selectedIds.size === draftUploads.length && draftUploads.length > 0 ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} />}
                      </button>
                    </div>
                  )}
                  <div style={{ ...LABEL, padding: '10px 16px 10px 68px' }}>Document</div>
                  <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Status</div>
                  <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Uploaded On</div>
                  <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>Actions</div>
                </div>

                {/* ── Document rows ── */}
                <div>
                  {filtered.length === 0 && (
                    <div style={{ padding: '52px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>
                      No documents found.
                    </div>
                  )}
                  {filtered.map(doc => {
                    const isDraft      = !doc.workflowStatus || doc.workflowStatus === WORKFLOW_STATUS.DRAFT;
                    const isPublished  = doc.workflowStatus === WORKFLOW_STATUS.PUBLISHED;
                    const isSelected   = selectedIds.has(doc.id);
                    const statusAccent = doc.status === 'approved' ? '#16a34a' : doc.status === 'rejected' ? '#ef4444' : '#f59e0b';
                    const statusBg     = doc.status === 'approved' ? 'rgba(34,197,94,.07)' : doc.status === 'rejected' ? 'rgba(239,68,68,.07)' : 'rgba(245,158,11,.07)';
                    const statusBorder = doc.status === 'approved' ? 'rgba(34,197,94,.25)' : doc.status === 'rejected' ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.25)';
                    const typeColor    = TYPE_CARD_COLORS[doc.type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                    const approverName = doc.approval?.approver_first_name
                      ? `${doc.approval.approver_first_name} ${doc.approval.approver_last_name || ''}`.trim()
                      : doc.approval?.approver_username;
                    const StatusIcon = doc.status === 'approved' ? CheckCircle : doc.status === 'rejected' ? XCircle : Clock;

                    return (
                      <div key={doc.id}
                        style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--surface-border)', background: isSelected ? 'rgba(26,86,219,.04)' : 'transparent', transition: 'background .15s' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(26,86,219,.04)' : 'transparent'; }}>

                        {/* Status accent strip */}
                        <div style={{ background: statusAccent }} />

                        {/* Bulk select */}
                        {bulkSelectMode && (
                          <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 16px' }}>
                            {isDraft ? (
                              <button onClick={() => toggleSelectDoc(doc.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                                {isSelected ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} />}
                              </button>
                            ) : (
                              <Square size={14} color="var(--surface-200)" title={isPublished ? 'Published — use Request Correction' : 'Under review'} />
                            )}
                          </div>
                        )}

                        {/* Document: icon + title + meta */}
                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {doc.isWord ? <FileType size={17} color={typeColor.accent} /> : <FileText size={17} color={typeColor.accent} />}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>
                                {doc.type}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.dept}</span>
                              <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '1px 7px', borderRadius: 20 }}>{doc.year}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 8px', borderRadius: 20, background: statusBg, border: `1px solid ${statusBorder}`, alignSelf: 'flex-start' }}>
                            <StatusIcon size={11} color={statusAccent} />
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: statusAccent, fontFamily: 'var(--mono)', letterSpacing: '.05em' }}>
                              {doc.status === 'approved' ? 'APPROVED' : doc.status === 'rejected' ? 'REJECTED' : 'PENDING'}
                            </span>
                          </div>
                          {approverName && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                              {approverName}
                              {doc.approval?.acted_at && <div style={{ opacity: .75 }}>{doc.approval.acted_at.split('T')[0]}</div>}
                            </div>
                          )}
                        </div>

                        {/* Uploaded On */}
                        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                          {doc.uploadedAt}
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <button onClick={() => setViewDoc(doc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(26,86,219,.3)', background: 'rgba(26,86,219,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,86,219,.14)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,86,219,.07)'}>
                            <Eye size={13} /> View
                          </button>
                          {doc.approval?.comments && (
                            <button onClick={() => setRemarksModal(doc)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: `1px solid ${statusBorder}`, background: statusBg, color: statusAccent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: 'opacity .15s' }}>
                              <MessageSquare size={13} /> Remarks
                            </button>
                          )}
                          <button onClick={() => setVersionModal(doc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                            <GitBranch size={12} /> v{doc.version || '1.0'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </Card>
        </div>
          );
        })()}
      </div>
    );
  }

  // Upload page
  const allFilesChecked = files.length > 0 && files.every(f => fileRefs.some(r => r.fileName === f.name));
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      {conflictModal && (
        <VersionConflictModal
          existingDoc={conflictModal.existingDoc}
          newVersion={conflictModal.newVersion}
          onUploadAsNew={handleConflictResolve}
          onCancel={() => setConflictModal(null)}
        />
      )}
      {/* ── Unified single-page upload layout ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Type selector + File drop zone ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Hidden file input */}
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

          {/* Rejected files alert */}
          {rejected.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1 }}>Unsupported file type rejected:</div>
                <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)' }}>{rejected.join(', ')}</div>
              </div>
              <button onClick={() => setRejected([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><X size={13} /></button>
            </div>
          )}

          {/* Document Type card */}
          <Card>
            <div style={{ ...LABEL, marginBottom: 10 }}>Document Type <span style={{ color: '#ef4444' }}>*</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPES.map(type => {
                const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                const active = form.type === type;
                return (
                  <button key={type} type="button"
                    onClick={() => { fmt('type', type); setTypeFields({}); setLegalAuthorities([{ act: '', sections: [''] }]); setAmendChanges([{ chapter: '', section: '', subsection: '', changeType: 'Amended', description: '' }]); setHierarchy({ act: '', chapter: '', section: '', subsection: '' }); setRelations([]); setRelType((REL_TYPES_BY_DOCTYPE[type] || REL_TYPES)[0]); setRelDocType(''); setRelTarget(''); setRelSearch(''); }}
                    style={{
                      padding: '10px 10px 9px', borderRadius: 10, textAlign: 'left',
                      border: active ? `2px solid ${c.accent}` : `1.5px solid ${c.accent}30`,
                      background: active ? c.bg : 'var(--surface-card)',
                      cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                      boxShadow: active ? `0 0 0 3px ${c.accent}15` : 'none',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.accent + '55'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.borderColor = c.accent + '30'; }}}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: c.bg, border: `1px solid ${c.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={11} color={c.accent} />
                      </div>
                      {active && <CheckCircle size={12} color={c.accent} />}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? c.text : 'var(--text-heading)', lineHeight: 1.3 }}>{type}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* File upload card */}
          <Card>
            {files.length === 0 ? (
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                style={{
                  border: `2px dashed ${dragOver ? (TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)') : 'var(--surface-border)'}`,
                  borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? (TYPE_CARD_COLORS[form.type]?.bg || 'rgba(26,86,219,.05)') : 'var(--surface-ground)',
                  transition: 'all .25s',
                  boxShadow: dragOver ? `0 0 0 4px ${TYPE_CARD_COLORS[form.type]?.accent || '#1a56db'}15` : 'none',
                }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: dragOver ? (TYPE_CARD_COLORS[form.type]?.bg || 'rgba(26,86,219,.12)') : 'var(--surface-card)', border: `1px solid ${dragOver ? (TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)') + '40' : 'var(--surface-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', transition: 'all .25s' }}>
                  <Upload size={22} color={dragOver ? (TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)') : 'var(--text-color-secondary)'} strokeWidth={1.6} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 5 }}>Drop files here</div>
                <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginBottom: 14 }}>or click to browse · PDF or Word · up to 50 MB</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--primary)', background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)', padding: '3px 10px', borderRadius: 20 }}>.PDF</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: '#2b579a', background: 'rgba(43,87,154,.08)', border: '1px solid rgba(43,87,154,.3)', padding: '3px 10px', borderRadius: 20 }}>.DOC</span>
                </div>
              </div>
            ) : (
              <>
                {/* File list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {files.slice(0, 4).map(f => {
                    const uploaded = fileRefs.some(r => r.fileName === f.name);
                    const isUploading = uploadStep === 'uploading' && !uploaded;
                    return (
                      <div key={f.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8,
                        background: uploaded ? 'rgba(22,163,74,.05)' : isUploading ? 'rgba(59,130,246,.05)' : 'var(--surface-ground)',
                        border: `1.5px solid ${uploaded ? 'rgba(22,163,74,.25)' : isUploading ? 'rgba(59,130,246,.2)' : 'var(--surface-border)'}`,
                        transition: 'all .3s',
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: uploaded ? 'rgba(22,163,74,.1)' : 'rgba(26,86,219,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {fileIcon(f)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{formatSize(f.size)}</div>
                        </div>
                        {uploaded && <CheckCircle size={13} color="#16a34a" style={{ flexShrink: 0 }} />}
                        {isUploading && <Clock size={12} color="#3b82f6" style={{ flexShrink: 0 }} />}
                        <button type="button"
                          onClick={() => { removeFile(f.name); if (files.length <= 1) { setFileRefs([]); setUploadStep(null); setUploadError(''); } }}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--surface-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                  {files.length > 4 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', fontWeight: 600, paddingLeft: 4 }}>+{files.length - 4} more files</div>
                  )}
                </div>

                {/* Upload & OCR-eligibility check */}
                {!allFilesChecked && uploadStep === 'error' ? (
                  <>
                    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: '#dc2626', flex: 1, lineHeight: 1.5 }}>{uploadError}</span>
                    </div>
                    <button type="button" onClick={checkFiles}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <RotateCcw size={13} /> Try Again
                    </button>
                  </>
                ) : !allFilesChecked ? (
                  <button type="button" onClick={checkFiles} disabled={uploadStep === 'uploading'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                      padding: '9px 0', borderRadius: 8, border: 'none',
                      background: uploadStep === 'uploading' ? 'var(--surface-200)' : 'var(--primary)',
                      color: uploadStep === 'uploading' ? '#94a3b8' : 'white',
                      fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
                      cursor: uploadStep === 'uploading' ? 'not-allowed' : 'pointer',
                    }}>
                    {uploadStep === 'uploading' ? <><Clock size={13} /> Checking document…</> : <><Upload size={13} /> Upload &amp; Check Document</>}
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 2px 4px', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
                    <CheckCircle size={13} /> Eligibility check passed — details ready
                  </div>
                )}

                {/* Add more files — disabled (single-file upload only) */}
                {/* <button type="button" onClick={() => inputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '7px 0', borderRadius: 8, border: '1px dashed var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', marginBottom: 14 }}>
                  <Plus size={12} /> Add more files
                </button> */}

                {/* Replace / clear files — disabled (single-file upload only) */}
                {/* <button type="button"
                  onClick={() => { setFiles([]); setFileRefs([]); setUploadStep(null); setUploadError(''); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '7px 0', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <RotateCcw size={12} /> Replace Files
                </button> */}
              </>
            )}
          </Card>

        </div>

        {/* ── RIGHT: Document Details form ───────────────────────────────────── */}
        <Card>
          {files.length > 0 && !allFilesChecked && uploadStep === 'uploading' ? (
            /* Skeleton — mimics the Document Details form while the OCR eligibility check runs.
               Shown regardless of whether a document type / file-drop placeholder would otherwise
               render, so the user always sees that the check is actually in progress. */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
                <div style={{ width: 150, height: 15, borderRadius: 4, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <div style={{ width: 130, height: 9, borderRadius: 3, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
                <div style={{ height: 38, borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ width: '55%', height: 9, borderRadius: 3, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
                    <div style={{ height: 38, borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                <div style={{ width: 170, height: 9, borderRadius: 3, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
                <div style={{ height: 150, borderRadius: 8, background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', animation: 'pulse2 1.4s ease-in-out infinite' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-color-secondary)' }}>
                <Clock size={13} /> Verifying OCR eligibility — this only takes a moment…
              </div>
            </div>
          ) : !form.type ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 460, textAlign: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="var(--text-color-secondary)" strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>Select a Document Type</div>
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Choose the document type on the left to see the relevant form fields</div>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 460, textAlign: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: TYPE_CARD_COLORS[form.type]?.bg || 'var(--surface-ground)', border: `1px solid ${TYPE_CARD_COLORS[form.type]?.accent || 'var(--surface-border)'}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={22} color={TYPE_CARD_COLORS[form.type]?.accent || 'var(--text-color-secondary)'} strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>Drop a {form.type} file</div>
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Select a PDF or Word file on the left to fill in document details</div>
              </div>
            </div>
          ) : !allFilesChecked ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 460, textAlign: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: uploadStep === 'error' ? 'rgba(239,68,68,.08)' : TYPE_CARD_COLORS[form.type]?.bg || 'var(--surface-ground)', border: `1px solid ${uploadStep === 'error' ? 'rgba(239,68,68,.3)' : (TYPE_CARD_COLORS[form.type]?.accent || 'var(--surface-border)') + '30'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {uploadStep === 'error'
                  ? <XCircle size={22} color="#ef4444" strokeWidth={1.5} />
                  : <Upload size={22} color={TYPE_CARD_COLORS[form.type]?.accent || 'var(--text-color-secondary)'} strokeWidth={1.5} />}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>
                  {uploadStep === 'error' ? 'Document check failed' : 'Ready to check'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', maxWidth: 320 }}>
                  {uploadStep === 'error'
                    ? (uploadError || 'The document failed the eligibility check.')
                    : 'Click "Upload & Check Document" on the left to verify OCR eligibility before entering document details.'}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Form header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: TYPE_CARD_COLORS[form.type]?.bg || 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={13} color={TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)'} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Document Details</span>
                {files.length > 1 && <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,.1)', color: '#3b82f6', padding: '2px 9px', borderRadius: 20 }}>Applied to all {files.length} files</span>}
              </div>
              {uploadError && uploadStep === 'error' && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#dc2626', flex: 1 }}>{uploadError}</span>
                  <button type="button" onClick={() => { setUploadError(''); setUploadStep(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><X size={12} /></button>
                </div>
              )}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

            {/* Always: Document name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 6 }}>
                {{
                  'Act': 'Act / Instrument Name',
                  'Amendment': 'Amendment Name',
                  'Notification': 'Notification Title',
                  'Circular': 'Circular Title',
                  'Policy': 'Policy Name',
                  'Rules & Regulations': 'Rules / Regulation Name',
                  'Order / Gazette': 'Order / Gazette Title',
                  'Bye Laws': 'Bye Law Name',
                  'Miscellaneous': 'Document Title',
                }[form.type] || 'Document Name'}
                {files.length <= 1 && <span style={{ color: '#ef4444' }}> *</span>}
              </div>
              <input value={form.act} onChange={e => fmt('act', e.target.value)} required={files.length <= 1}
                placeholder={files.length > 1 ? 'Leave blank to use each filename' : ({
                  'Act': 'e.g. Haryana Municipal Act, 1973',
                  'Amendment': 'e.g. The XYZ (Amendment) Act, 2022',
                  'Notification': 'e.g. Gazette Notification No. 123',
                  'Circular': 'e.g. Circular No. 45/2023',
                  'Policy': 'e.g. Haryana Industrial Policy 2020',
                  'Rules & Regulations': 'e.g. Haryana Municipal Rules, 1975',
                  'Order / Gazette': 'e.g. Government Order No. 12/2021',
                  'Bye Laws': 'e.g. Municipal Corporation Bye-laws, 2020',
                  'Miscellaneous': 'e.g. Departmental Guidelines / Reference Manual',
                }[form.type] || 'Enter document name')}
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            {/* ── ACT: all fields inline ── */}
            {form.type === 'Act' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Act Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.actNumber || ''} onChange={e => setTypeFields(f => ({ ...f, actNumber: e.target.value }))}
                  placeholder="e.g. Act No. 12 of 1973" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Short Title</div>
                <input value={typeFields.shortTitle || ''} onChange={e => setTypeFields(f => ({ ...f, shortTitle: e.target.value }))}
                  placeholder="e.g. Haryana Municipal Act" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette, 15 Jan 1973" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
            </>)}

            {/* ── Amendment: unified inline fields ── */}
            {form.type === 'Amendment' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Amendment Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.amendmentNumber || ''} onChange={e => setTypeFields(f => ({ ...f, amendmentNumber: e.target.value }))}
                  placeholder="e.g. Amendment No. 3 of 2022" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette No. 45/2022" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Parent Act</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => { setDrawerHierarchy({ ...hierarchy }); setDrawerType('hierarchy'); }} isRef={true} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Circular: unified inline fields ── */}
            {form.type === 'Circular' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Circular Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.circularNumber || ''} onChange={e => setTypeFields(f => ({ ...f, circularNumber: e.target.value }))}
                  placeholder="e.g. Circular No. 7/2023" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Valid Until</div>
                <input type="date" value={typeFields.validity || ''} onChange={e => setTypeFields(f => ({ ...f, validity: e.target.value }))}
                  placeholder="e.g. 31 March 2025 / Until further orders" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Legal Authority</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => setDrawerType('hierarchy')} isRef={true} legalAuthorities={legalAuthorities} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Miscellaneous: mirrors Circular's field set ── */}
            {form.type === 'Miscellaneous' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Reference Number</div>
                <input value={typeFields.miscNumber || ''} onChange={e => setTypeFields(f => ({ ...f, miscNumber: e.target.value }))}
                  placeholder="e.g. Ref No. 22/2024 (optional)" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Valid Until</div>
                <input type="date" value={typeFields.validity || ''} onChange={e => setTypeFields(f => ({ ...f, validity: e.target.value }))}
                  placeholder="e.g. 31 March 2025 / Until further orders" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Legal Authority</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => setDrawerType('hierarchy')} isRef={true} legalAuthorities={legalAuthorities} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Notification: unified inline fields ── */}
            {form.type === 'Notification' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Notification Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.notificationNumber || ''} onChange={e => setTypeFields(f => ({ ...f, notificationNumber: e.target.value }))}
                  placeholder="e.g. No. 4/12/2022-Rev" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette Extra., 12 Jan 2023" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Legal Authority</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => setDrawerType('hierarchy')} isRef={true} legalAuthorities={legalAuthorities} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Order / Gazette: unified inline fields ── */}
            {form.type === 'Order / Gazette' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Order / Gazette Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.orderNumber || ''} onChange={e => setTypeFields(f => ({ ...f, orderNumber: e.target.value }))}
                  placeholder="e.g. Govt. Order No. 45/2022" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette Extra., Part I, No. 28, 15 Mar 2022" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Legal Authority</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => setDrawerType('hierarchy')} isRef={true} legalAuthorities={legalAuthorities} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Policy ── */}
            {form.type === 'Policy' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Policy Number / ID <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.policyNumber || ''} onChange={e => setTypeFields(f => ({ ...f, policyNumber: e.target.value }))}
                  placeholder="e.g. HRY-POL-2023-04" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Sector / Domain</div>
                <input value={typeFields.sector || ''} onChange={e => setTypeFields(f => ({ ...f, sector: e.target.value }))}
                  placeholder="e.g. Agriculture, Urban Development" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Implementing Agency</div>
                <input value={typeFields.implementingAgency || ''} onChange={e => setTypeFields(f => ({ ...f, implementingAgency: e.target.value }))}
                  placeholder="e.g. HSIIDC, HUDA, All Departments" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Next Review Date</div>
                <input type="date" value={typeFields.reviewDate || ''} onChange={e => setTypeFields(f => ({ ...f, reviewDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Legal Authority</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => setDrawerType('hierarchy')} isRef={true} legalAuthorities={legalAuthorities} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Rules & Regulations ── */}
            {form.type === 'Rules & Regulations' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Rule Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.ruleNumber || ''} onChange={e => setTypeFields(f => ({ ...f, ruleNumber: e.target.value }))}
                  placeholder="e.g. Rule No. 5 of 2021" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette Extra., Part I, No. 12, 21 Jan 2021" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Rule Making Authority</div>
                <input value={typeFields.ruleAuthority || ''} onChange={e => setTypeFields(f => ({ ...f, ruleAuthority: e.target.value }))}
                  placeholder="e.g. Governor of Haryana" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Act Reference</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => { setDrawerHierarchy({ ...hierarchy }); setDrawerType('hierarchy'); }} isRef={true} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Bye Laws: mirrors Rules & Regulations' field set ── */}
            {form.type === 'Bye Laws' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Bye Law Number <span style={{ color: '#ef4444' }}>*</span></div>
                <input value={typeFields.byeLawNumber || ''} onChange={e => setTypeFields(f => ({ ...f, byeLawNumber: e.target.value }))}
                  placeholder="e.g. Bye-law No. 3 of 2020" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Effective From</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Gazette Reference</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder="e.g. Haryana Gazette Extra., Part I, No. 8, 4 Mar 2020" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issuing Authority</div>
                <input value={typeFields.ruleAuthority || ''} onChange={e => setTypeFields(f => ({ ...f, ruleAuthority: e.target.value }))}
                  placeholder="e.g. Municipal Corporation, Panchkula" style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Act Reference</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => { setDrawerHierarchy({ ...hierarchy }); setDrawerType('hierarchy'); }} isRef={true} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── All other non-Act, non-Amendment, non-Circular, non-Notification types ── */}
            {!['Act', 'Amendment', 'Circular', 'Notification', 'Order / Gazette', 'Policy', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'].includes(form.type) && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Department</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{['Circular', 'Notification', 'Policy', 'Order / Gazette'].includes(form.type) ? 'Act Reference' : 'Hierarchical Tags'}</div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => { setDrawerHierarchy({ ...hierarchy }); setDrawerType('hierarchy'); }} isRef={['Circular', 'Notification', 'Policy', 'Order / Gazette'].includes(form.type)} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>Relationships</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? `${relations.length} Relationship${relations.length !== 1 ? 's' : ''} Added` : 'Add Relationship'}
                  <ChevronRight size={12} />
                </button>
              </div>
              {TYPE_FIELDS[form.type]?.map(field => (
                <div key={field.key} style={{ gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}</div>
                  <input type={field.inputType || 'text'} value={typeFields[field.key] || ''}
                    onChange={e => setTypeFields(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder || ''} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
              ))}
            </>)}

            {/* Always: Description */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                Description / Remarks
                {fileRefs.some(r => r.fileName === files[0]?.name && r.summary) && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', textTransform: 'none', letterSpacing: 0 }}>· auto-filled from document summary, you can edit it</span>
                )}
              </div>
              <textarea value={form.desc} onChange={e => fmt('desc', e.target.value)} rows={7}
                placeholder="Brief description or upload remarks…"
                style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6, minHeight: 150 }}
                onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--surface-border)' }}>
            <button type="button"
              onClick={() => { setForm({ act:'',dept:user?.dept||'',type:'',version:'1.0',desc:'',enactmentDate:'',parentAct:'',changeTypes:[] }); setFiles([]); setFileRefs([]); setRelations([]); setHierarchy({ act:'',chapter:'',section:'',subsection:'' }); setAmendmentProvisions([]); setParentActSearch(''); setRelNote(''); setTypeFields({}); setUploadStep(null); setUploadError(''); }}
              style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '9px 22px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
              Clear All
            </button>
            <button type="submit"
              disabled={files.length === 0 || uploadStep === 'uploading' || uploadStep === 'saving' || uploadStep === 'done'}
              style={{
                background: uploadStep === 'done' ? '#16a34a' : files.length > 0 && !uploadStep ? 'var(--primary)' : uploadStep === 'error' ? 'var(--primary)' : 'var(--surface-200)',
                color: uploadStep === 'done' || (files.length > 0 && (!uploadStep || uploadStep === 'error')) ? 'white' : '#94a3b8',
                border: 'none', padding: '10px 28px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700,
                cursor: files.length > 0 && (!uploadStep || uploadStep === 'error') ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: files.length > 0 && (!uploadStep || uploadStep === 'error') ? '0 2px 8px rgba(26,86,219,.2)' : 'none',
                transition: 'all .2s',
              }}>
              {uploadStep === 'uploading' && <><Clock size={14} /> Uploading file…</>}
              {uploadStep === 'saving'    && <><Clock size={14} /> Saving details…</>}
              {uploadStep === 'done'      && <><CheckCircle size={14} /> Submitted!</>}
              {(!uploadStep || uploadStep === 'error') && <><CheckCircle size={14} /> Submit for Approval</>}
            </button>
          </div>
        </form>
            </>
          )}
        </Card>

      </div>

      {/* ── Drawer: Hierarchical Tags / Relationship ── */}
      {drawerType && (
        <>
          {/* Blurred backdrop — click does not close the drawer; use Cancel / Done / ✕ */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 300, animation: 'drawerFadeIn .2s ease' }}
          />

          {/* Slide-in panel */}
          <div style={{
            position: 'fixed', right: 0, top: 0, height: '100vh', width: 420,
            background: 'var(--surface-card)',
            boxShadow: '-4px 0 40px rgba(0,0,0,.18)',
            zIndex: 301,
            display: 'flex', flexDirection: 'column',
            animation: 'drawerSlideIn .28s cubic-bezier(.22,1,.36,1)',
          }}>

            {/* Drawer header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--primary-light)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {drawerType === 'hierarchy' ? <Layers size={16} color="var(--primary)" /> : <GitBranch size={16} color="var(--primary)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>
                  {drawerType === 'hierarchy'
  ? (form.type === 'Amendment' ? 'Parent Act & Changes Made'
      : ['Circular', 'Notification', 'Order / Gazette', 'Miscellaneous'].includes(form.type) ? 'Legal Authority'
      : ['Policy', 'Rules & Regulations', 'Bye Laws'].includes(form.type) ? 'Act Reference'
      : 'Hierarchical Tags')
  : 'Add Relationship'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>
                  {drawerType === 'hierarchy'
                    ? (form.type === 'Amendment' ? 'Select the parent Act being amended and log section-level changes'
                        : 'Tag this document within the act/chapter/section hierarchy')
                    : (form.type === 'Amendment' ? 'Link to related Acts, continuing Amendments, or other documents' : 'Link this document to an existing document')}
                </div>
              </div>
              <button onClick={closeDrawer}
                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* ── Hierarchy form ── */}
              {drawerType === 'hierarchy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Act Name / Parent Act Name — only for Amendment; other types get their own Act/Rule Name field below (multi-legal-authority list or Act/Chapter/Section block) */}
                  {!['Circular', 'Notification', 'Order / Gazette', 'Policy', 'Miscellaneous', 'Rules & Regulations', 'Bye Laws'].includes(form.type) && (
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>
                        {form.type === 'Amendment' ? 'Parent Act Name' : 'Act Name'}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.act}
                          onChange={e => { setDrawerHierarchy(v => ({ ...v, act: e.target.value, actId: null })); fetchDocSuggestions('Act', e.target.value); }}
                          onFocus={e => { focusStyle(e); if (drawerHierarchy.act) fetchDocSuggestions('Act', drawerHierarchy.act); setShowHierActDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierActDrop(false), 180); }}
                          placeholder="Type to search Acts…" style={{ ...INPUT_BASE, width: '100%' }}
                        />
                        {actSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                        {showHierActDrop && actSuggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 220, overflow: 'auto', marginTop: 3 }}>
                            {actSuggestions.map(a => (
                              <div key={a.id}
                                onMouseDown={() => { setDrawerHierarchy(v => ({ ...v, act: a.document_name, actId: a.id })); setActSuggestions([]); setShowHierActDrop(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.document_name}</div>
                                {a.reference_number && <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', marginTop: 2 }}>{a.reference_number}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Circular / Notification / Order / Policy: dynamic multiple legal authorities */}
                  {['Circular', 'Notification', 'Order / Gazette', 'Policy', 'Miscellaneous'].includes(form.type) && (<>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...LABEL }}>Legal Authorities</span>
                      <button type="button"
                        onClick={() => { setLegalAuthorities(p => [...p, { act: '', sections: [''], confirmed: false }]); setEditingAuthIdx(legalAuthorities.length); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Plus size={12} /> Add Another
                      </button>
                    </div>
                    {legalAuthorities.map((auth, i) => {
                      const isSaved = auth.confirmed && editingAuthIdx !== i;

                      if (isSaved) {
                        return (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth.act}</div>
                              {(auth.sections || []).filter(Boolean).length > 0 && (
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                                  {(auth.sections || []).filter(Boolean).map((s, si) => (
                                    <span key={si} style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 20, padding: '2px 8px' }}>{s}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => setEditingAuthIdx(i)}
                              style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-color-secondary)', padding: 6, display: 'flex', flexShrink: 0 }}>
                              <Edit3 size={13} />
                            </button>
                            {legalAuthorities.length > 1 && (
                              <button type="button" onClick={() => { setLegalAuthorities(p => p.filter((_, idx) => idx !== i)); setEditingAuthIdx(null); }}
                                style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-color-secondary)', padding: 6, display: 'flex', flexShrink: 0 }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>AUTHORITY {i + 1}</span>
                          {legalAuthorities.length > 1 && (
                            <button type="button" onClick={() => { setLegalAuthorities(p => p.filter((_, idx) => idx !== i)); setEditingAuthIdx(null); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div>
                          <div style={{ ...LABEL, marginBottom: 5 }}>Act / Rule Name</div>
                          <div style={{ position: 'relative' }}>
                            <input value={auth.act}
                              onChange={e => { setEditingAuthIdx(i); setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, act: e.target.value } : r)); fetchDocSuggestions('Act', e.target.value); }}
                              onFocus={e => { focusStyle(e); setEditingAuthIdx(i); setShowAuthDrop(i); if (auth.act) fetchDocSuggestions('Act', auth.act); }}
                              onBlur={e => { blurStyle(e); setTimeout(() => setShowAuthDrop(null), 180); }}
                              placeholder="Type to search Acts…" style={{ ...INPUT_BASE, fontSize: 12 }} />
                            {showAuthDrop === i && actSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                            {showAuthDrop === i && actSuggestions.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 220, overflow: 'auto', marginTop: 3 }}>
                                {actSuggestions.map(a => (
                                  <div key={a.id}
                                    onMouseDown={() => { setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, act: a.document_name } : r)); setActSuggestions([]); setShowAuthDrop(null); }}
                                    style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.document_name}</div>
                                    {a.reference_number && <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', marginTop: 2 }}>{a.reference_number}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ ...LABEL }}>Sections / Provisions</div>
                            <button type="button"
                              onClick={() => setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, sections: [...(r.sections || ['']), ''] } : r))}
                              style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={10} /> Add Section
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(auth.sections || ['']).map((sec, si) => {
                              const secOptions = getSectionsFromDoc(auth.act).filter(s => !sec || s.toLowerCase().includes(sec.toLowerCase()));
                              const dropKey = `${i}-${si}`;
                              const dropOpen = showSectionDrop === dropKey;
                              return (
                              <div key={si} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                <input value={sec}
                                  onChange={e => setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, sections: (r.sections || ['']).map((s, sIdx) => sIdx === si ? e.target.value : s) } : r))}
                                  onFocus={e => { focusStyle(e); setShowSectionDrop(dropKey); }}
                                  onBlur={e => { blurStyle(e); setTimeout(() => setShowSectionDrop(null), 180); }}
                                  placeholder={auth.act ? `Type or pick a section…` : `e.g. Section ${si === 0 ? '4' : '17'}`}
                                  style={{ ...INPUT_BASE, fontSize: 12, width: '100%' }} />
                                {dropOpen && secOptions.length > 0 && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 180, overflow: 'auto', marginTop: 3 }}>
                                    {secOptions.map(s => (
                                      <div key={s}
                                        onMouseDown={() => { setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, sections: (r.sections || ['']).map((sv, sIdx) => sIdx === si ? s : sv) } : r)); setShowSectionDrop(null); }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--surface-border)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {s}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                </div>
                                {(auth.sections || ['']).length > 1 && (
                                  <button type="button"
                                    onClick={() => setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, sections: (r.sections || ['']).filter((_, sIdx) => sIdx !== si) } : r))}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            ); })}
                          </div>
                        </div>
                        <button type="button"
                          disabled={!auth.act}
                          onClick={() => { setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, confirmed: true } : r)); setEditingAuthIdx(null); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: 'none', background: auth.act ? '#16a34a' : 'var(--surface-200)', color: auth.act ? '#fff' : '#94a3b8', fontSize: 12.5, fontWeight: 700, cursor: auth.act ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)' }}>
                          <CheckCircle size={14} /> Confirm Authority
                        </button>
                      </div>
                      );
                    })}
                  </>)}


                  {/* Act / Rules & Regulations: Act name + Chapter/Section/Sub-section with dropdowns */}
                  {!['Circular', 'Notification', 'Policy', 'Order / Gazette', 'Amendment', 'Miscellaneous'].includes(form.type) && (<>
                    {/* Act Name — search-acts API */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Act / Rule Name</div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.act}
                          onChange={e => { setDrawerHierarchy(v => ({ ...v, act: e.target.value, actId: null, section: '', chapter: '' })); fetchDocSuggestions('Act', e.target.value); }}
                          onFocus={e => { focusStyle(e); if (drawerHierarchy.act) fetchDocSuggestions('Act', drawerHierarchy.act); setShowHierActDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierActDrop(false), 180); }}
                          placeholder="Type to search Acts…" style={{ ...INPUT_BASE, width: '100%' }} />
                        {actSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                        {showHierActDrop && actSuggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 220, overflow: 'auto', marginTop: 3 }}>
                            {actSuggestions.map(a => (
                              <div key={a.id}
                                onMouseDown={() => { setDrawerHierarchy(v => ({ ...v, act: a.document_name, actId: a.id, section: '', chapter: '', subsection: '' })); setActSuggestions([]); setShowHierActDrop(false); }}
                                style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.document_name}</div>
                                {a.reference_number && <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', marginTop: 2 }}>{a.reference_number}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chapter — plain input */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Chapter</div>
                      <input value={drawerHierarchy.chapter}
                        onChange={e => setDrawerHierarchy(v => ({ ...v, chapter: e.target.value }))}
                        placeholder="e.g. Chapter III — Taxation" style={{ ...INPUT_BASE, width: '100%' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </div>

                    {/* Section — dropdown from selected act */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Section</div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.section}
                          onChange={e => setDrawerHierarchy(v => ({ ...v, section: e.target.value }))}
                          onFocus={e => { focusStyle(e); setShowHierSecDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierSecDrop(false), 180); }}
                          placeholder={drawerHierarchy.act ? 'Type or pick a section…' : 'e.g. Section 45 — Property Tax'}
                          style={{ ...INPUT_BASE, width: '100%' }} />
                        {showHierSecDrop && getSectionsFromDoc(drawerHierarchy.act).filter(s => !drawerHierarchy.section || s.toLowerCase().includes(drawerHierarchy.section.toLowerCase())).length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 200, overflow: 'auto', marginTop: 3 }}>
                            {getSectionsFromDoc(drawerHierarchy.act).filter(s => !drawerHierarchy.section || s.toLowerCase().includes(drawerHierarchy.section.toLowerCase())).map(s => (
                              <div key={s}
                                onMouseDown={() => { setDrawerHierarchy(v => ({ ...v, section: s })); setShowHierSecDrop(false); }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--surface-border)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sub-section — plain input */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Sub-section</div>
                      <input value={drawerHierarchy.subsection}
                        onChange={e => setDrawerHierarchy(v => ({ ...v, subsection: e.target.value }))}
                        placeholder="e.g. (2)(a)" style={{ ...INPUT_BASE, width: '100%' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </div>
                  </>)}

                  {/* Amendment: dynamic change entries */}
                  {form.type === 'Amendment' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Edit3 size={12} color="var(--primary)" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)' }}>Changes Made</span>
                        </div>
                        <button type="button"
                          onClick={() => setAmendChanges(p => [...p, { chapter: '', section: '', subsection: '', changeType: 'Amended', description: '' }])}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                          <Plus size={12} /> Add Change
                        </button>
                      </div>

                      {amendChanges.map((ch, i) => (
                        <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>CHANGE {i + 1}</span>
                            {amendChanges.length > 1 && (
                              <button type="button" onClick={() => setAmendChanges(p => p.filter((_, idx) => idx !== i))}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            {[
                              { key: 'chapter', ph: 'Chapter III' },
                              { key: 'section', ph: 'Section 45' },
                              { key: 'subsection', ph: '(2)(a)' },
                            ].map(({ key, ph }) => (
                              <input key={key} value={ch[key]}
                                onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, [key]: e.target.value } : r))}
                                placeholder={ph} style={{ ...INPUT_BASE, fontSize: 12 }}
                                onFocus={focusStyle} onBlur={blurStyle} />
                            ))}
                          </div>
                          <SelectField value={ch.changeType}
                            onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, changeType: e.target.value } : r))}>
                            {AMEND_CHANGE_TYPES.map(o => <option key={o}>{o}</option>)}
                          </SelectField>
                          <textarea value={ch.description}
                            onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                            rows={2} placeholder="Describe what specifically changed here…"
                            style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6, fontSize: 12 }}
                            onFocus={focusStyle} onBlur={blurStyle} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── Relationship form ── */}
              {drawerType === 'relationship' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Relationship add form */}
                  {(<>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Relationship Type</div>
                      <SelectField value={relType} onChange={e => setRelType(e.target.value)}>
                        {(REL_TYPES_BY_DOCTYPE[form.type] || REL_TYPES).map(r => <option key={r}>{r}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Target Document Type</div>
                      <SelectField value={relDocType} onChange={e => { setRelDocType(e.target.value); setRelTarget(''); setRelSearch(''); }} placeholder="Select Type">
                        {(REL_TARGET_TYPES[form.type] || Object.keys(TYPE_CARD_COLORS)).map(t => <option key={t}>{t}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Link to Document</div>
                      <div style={{ position: 'relative' }}>
                        <input
                          disabled={!relDocType}
                          value={relSearch || (relTarget.startsWith('__api__:') ? relTarget.split(':').slice(2).join(':') : (documents.find(d => d.uid === relTarget)?.title || ''))}
                          onChange={e => {
                            setRelSearch(e.target.value); setRelTarget(''); setShowRelDrop(true);
                            if (relDocType) fetchRelDocSuggestions(relDocType, e.target.value);
                          }}
                          onFocus={() => { setShowRelDrop(true); if (relDocType && relSearch) fetchRelDocSuggestions(relDocType, relSearch); }}
                          onBlur={() => setTimeout(() => setShowRelDrop(false), 150)}
                          placeholder={!relDocType ? 'Select a Target Document Type first…' : `Search ${relDocType}…`}
                          style={{ ...INPUT_BASE, width: '100%', ...(!relDocType ? { background: 'var(--surface-100)', cursor: 'not-allowed', color: 'var(--text-color-secondary)' } : {}) }}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                        {relDocSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                        {relDocType && showRelDrop && relSearch.trim() && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.15)', zIndex: 50, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                            {relDocSuggestions.length > 0 ? relDocSuggestions.map(a => (
                              <div key={a.id} onMouseDown={() => { setRelTarget(`__api__:${a.id}:${a.document_name}`); setRelSearch(''); setShowRelDrop(false); }}
                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', fontSize: 12.5, transition: 'background .15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{a.document_name}</div>
                                {a.reference_number && <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>{a.reference_number}</div>}
                              </div>
                            )) : !relDocSearching && (
                              <div
                                onMouseDown={() => { setRelTarget('__pending__:' + relSearch.trim()); setShowRelDrop(false); }}
                                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 12.5 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--mono)' }}>PENDING</span>
                                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>"{relSearch.trim()}"</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 3 }}>Document not in system yet — save as pending, will auto-link when uploaded</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Section of linked document — shows only when a document is selected */}
                    {relTarget && !relTarget.startsWith('__pending__:') && (
                      <div>
                        <div style={{ ...LABEL, marginBottom: 6 }}>Section / Provision <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                        <div style={{ position: 'relative' }}>
                          <input value={relSection}
                            onChange={e => setRelSection(e.target.value)}
                            onFocus={e => { focusStyle(e); setShowRelSecDrop(true); }}
                            onBlur={e => { blurStyle(e); setTimeout(() => setShowRelSecDrop(false), 180); }}
                            placeholder="Pick or type a section from the linked document…"
                            style={{ ...INPUT_BASE, width: '100%' }} />
                          {showRelSecDrop && getSectionsFromDoc(documents.find(d => d.uid === relTarget)?.title).filter(s => !relSection || s.toLowerCase().includes(relSection.toLowerCase())).length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 180, overflow: 'auto', marginTop: 3 }}>
                              {getSectionsFromDoc(documents.find(d => d.uid === relTarget)?.title).filter(s => !relSection || s.toLowerCase().includes(relSection.toLowerCase())).map(s => (
                                <div key={s}
                                  onMouseDown={() => { setRelSection(s); setShowRelSecDrop(false); }}
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--surface-border)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>How are these related? <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                      <textarea
                        value={relNote}
                        onChange={e => setRelNote(e.target.value)}
                        rows={3}
                        placeholder="e.g. Section 45 of this Act is referenced in Chapter III of the linked document for determining tax liability…"
                        style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6, fontSize: 12.5 }}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                    </div>
                    <button type="button" onClick={addRelation} disabled={!relTarget}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 8, border: 'none', background: relTarget ? (relTarget.startsWith('__pending__:') ? '#f59e0b' : 'var(--primary)') : 'var(--surface-200)', color: relTarget ? 'white' : '#94a3b8', cursor: relTarget ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, width: '100%' }}>
                      <Plus size={14} /> Add Relationship
                    </button>
                  </>)}

                  {relations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ ...LABEL }}>Added Relationships</div>
                      {relations.map((r, i) => (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(26,86,219,.05)', border: '1px solid rgba(26,86,219,.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GitBranch size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: r.isPending ? '#f59e0b' : 'var(--primary)', fontFamily: 'var(--mono)' }}>{r.label}</span>
                            {r.targetType && <span style={{ fontSize: 10.5, fontWeight: 600, color: TYPE_CARD_COLORS[r.targetType]?.text || 'var(--text-color-secondary)', background: TYPE_CARD_COLORS[r.targetType]?.bg || 'rgba(148,163,184,.1)', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>{r.targetType}</span>}
                            {r.isPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--mono)', flexShrink: 0 }}>PENDING</span>}
                            <span style={{ fontSize: 12.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {r.targetTitle}{r.section ? ` · ${r.section}` : ''}</span>
                            <button type="button" onClick={() => removeRelation(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', flexShrink: 0 }}><X size={12} /></button>
                          </div>
                          {r.note && (
                            <div style={{ marginTop: 7, fontSize: 12, color: 'var(--text-color-secondary)', lineHeight: 1.5, paddingLeft: 20, borderLeft: '2px solid rgba(26,86,219,.2)', fontStyle: 'italic' }}>
                              {r.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeDrawer}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  if (drawerType === 'hierarchy') setHierarchy({ ...drawerHierarchy });
                  closeDrawer();
                }}
                style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {drawerType === 'hierarchy' ? 'Save Tags' : 'Done'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}