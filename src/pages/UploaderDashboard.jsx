import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, X, TrendingUp, Archive, Download,
  RotateCcw, AlertCircle, Eye, GitBranch, Plus, Cpu, Link, Clock,
  Layers, ChevronRight, AlertTriangle, Users, CheckSquare, Square,
  Edit3, Tag, Search,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { getDepartments, getDocumentTypes } from '../services/departments';
import { uploadPdfFile, uploadPdfMetadata } from '../services/pdf';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_DEPTS = [
  'Urban Local Bodies','Revenue & Disaster Mgmt.','Home Department',
  'Industries & Commerce','Labour Department','Finance Department',
  'Health & Family Welfare','Agriculture & Farmers Welfare',
  'Panchayati Raj','General Administration',
];
const DEFAULT_TYPES = ['Act','Amendment','Notification','Circular','Policy','Rules & Regulations','Order / Gazette'];
const LANGS  = ['English','Hindi','Bilingual'];
const REL_TYPES = ['Amends','Amended by','References','Referenced by','Is under','Supplemented by','Notified under','Replaces','Replaced by','Related to'];
const AMEND_CHANGE_TYPES = ['Amended', 'Substituted', 'Inserted', 'Deleted', 'Expanded'];
const AMEND_CHANGE_COLORS = { Amended: '#f59e0b', Substituted: '#3b82f6', Inserted: '#22c55e', Deleted: '#ef4444', Expanded: '#8b5cf6' };
const EMPTY_PROVISION = () => ({ section: '', chapter: '', subsection: '', page: '', changeType: 'Substituted', before: '', after: '' });

// Workflow statuses: DRAFT → PENDING_REVIEW → PUBLISHED
const WORKFLOW_STATUS = { DRAFT: 'draft', PENDING: 'pending', PUBLISHED: 'published' };

// Department notification map — if a doc references these keywords, notify the dept
const DEPT_KEYWORD_MAP = [
  { keywords: ['municipal','urban local','corporation'],    dept: 'Urban Local Bodies' },
  { keywords: ['labour','welfare fund','factories','shop'], dept: 'Labour Department' },
  { keywords: ['revenue','land revenue','land acquisition'],dept: 'Revenue & Disaster Mgmt.' },
  { keywords: ['panchayat','panchayati raj'],               dept: 'Panchayati Raj' },
  { keywords: ['rti','right to information'],              dept: 'General Administration' },
];

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

const MOCK_VERSIONS = {
  1: [{ v: '2.0', date: '2024-01-15', note: 'Current' },{ v: '1.0', date: '2023-05-10', note: 'Initial upload' }],
  2: [{ v: '1.2', date: '2024-02-10', note: 'Current' },{ v: '1.1', date: '2023-09-01', note: 'Minor edits' },{ v: '1.0', date: '2022-03-15', note: 'Initial upload' }],
};

// ─── Word-level confidence scoring ────────────────────────────────────────────
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
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
// Guesses title, year, doc type, and department from raw extracted text.
function autoExtractMetadata(text, filename) {
  const cleaned = text.slice(0, 3000); // Only scan the first ~3000 chars (header/title area)

  // Title: find first non-trivial capitalised line (likely heading)
  const titleMatch = cleaned.match(/^([A-Z][A-Z\s,&()]{10,80})$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.(pdf|zip)$/i, '');

  // Year: first 4-digit year between 1900 and current year
  const yearMatch = cleaned.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  // Document type: keyword scan
  const lower = cleaned.toLowerCase();
  let type = '';
  if (/\bamendment\b/.test(lower))             type = 'Amendment';
  else if (/\bnotification\b/.test(lower))     type = 'Notification';
  else if (/\bcircular\b/.test(lower))         type = 'Circular';
  else if (/\bpolicy\b/.test(lower))           type = 'Policy';
  else if (/\brules?\b/.test(lower))           type = 'Rules & Regulations';
  else if (/\border\b|\bgazette\b/.test(lower))type = 'Order / Gazette';
  else if (/\bact\b/.test(lower))              type = 'Act';

  // Department: keyword scan
  let dept = '';
  for (const { keywords, dept: d } of DEPT_KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k))) { dept = d; break; }
  }

  return { title, year, type, dept };
}
// Uses regex patterns to find actual Act/Rules citations inside PDF text.
// Then tries to match each detected citation against existing documents.
const CITATION_REGEX = [
  /(?:under|as per|in terms of)\s+([A-Z][A-Za-z\s,&()]{4,60}(?:Act|Rules|Order|Code|Regulation),?\s*\d{4})/g,
  /(?:amends?|amending)\s+([A-Z][A-Za-z\s,&()]{4,60}(?:Act|Rules),?\s*\d{4})/g,
  /(?:repealed?\s+by)\s+([A-Z][A-Za-z\s,&()]{4,60}(?:Act|Rules),?\s*\d{4})/g,
  /(?:in exercise of powers?(?:\s+conferred)?\s+under)\s+([A-Z][A-Za-z\s,&()]{4,80})/g,
  /Section\s+\d+\s+of\s+([A-Z][A-Za-z\s,&()]{4,60}(?:Act|Rules|Code),?\s*\d{4})/g,
  /(?:pursuant to|notified under)\s+([A-Z][A-Za-z\s,&()]{4,60}(?:Act|Rules|Order),?\s*\d{4})/g,
];

// Detect relationship type from surrounding context words
function detectRelationshipType(context) {
  const c = context.toLowerCase();
  if (/amends?|amending/.test(c))          return 'Amends';
  if (/repealed?\s+by/.test(c))            return 'Amended by';
  if (/in exercise of powers/.test(c))     return 'Is under';
  if (/notified under|pursuant to/.test(c))return 'Notified under';
  return 'References';
}

function detectCitationsFromText(rawText, allDocs) {
  const results = [];
  const seen    = new Set();

  for (const pattern of CITATION_REGEX) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      const citation = match[1].trim().replace(/\s+/g, ' ');
      if (seen.has(citation) || citation.length < 8) continue;
      seen.add(citation);

      // Try to match against existing documents
      const citWords = citation.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
      const matched  = allDocs.find(d => {
        const dtitle = d.title.toLowerCase();
        return citWords.filter(w => dtitle.includes(w)).length >= 2;
      });

      // Extract 80-char context window around the match for relationship type detection
      const ctxStart  = Math.max(0, match.index - 40);
      const ctxEnd    = Math.min(rawText.length, match.index + 80);
      const relLabel  = detectRelationshipType(rawText.slice(ctxStart, ctxEnd));

      results.push({
        citation,
        matchedDoc:  matched || null,
        status:      matched ? 'linked' : 'unresolved',
        relLabel,
      });
    }
  }

  // Fallback: if regex found nothing, use old keyword approach
  if (results.length === 0) {
    const fallbackCitations = detectCitationsLegacy(rawText, allDocs);
    return fallbackCitations;
  }

  return results;
}

// Legacy keyword-based fallback (used when PDF text extraction yields nothing)
const CITATION_PATTERNS = [
  { keywords: ['rti','right to information'],         citations: ['Constitution of India, Article 19','Haryana RTI Rules, 2006','Central Information Commission Regulations','Right to Service Act, 2011'] },
  { keywords: ['haryana rti rules','rti rules'],      citations: ['Right to Information Act, 2005','State Information Commission Guidelines'] },
  { keywords: ['land revenue','land revenue act'],    citations: ['Punjab Land Revenue Act, 1887','Haryana Panchayati Raj Act, 1994','Land Acquisition Act, 2013'] },
  { keywords: ['municipal','urban local'],            citations: ['Haryana Municipal Act, 1973','Urban Development Notification, 2021','RERA Haryana, 2017'] },
  { keywords: ['labour','welfare fund','factories'],  citations: ['Factories Act, 1948','Haryana Labour Welfare Fund Act','Labour Welfare Order, 2022'] },
  { keywords: ['panchayat','panchayati raj'],         citations: ['Haryana Panchayati Raj Act, 1994','Punjab Land Revenue Act, 1887','Constitution of India, Article 243'] },
  { keywords: ['shops','establishment'],              citations: ['Haryana Shops & Establishments Act','Labour Welfare Order, 2022'] },
  { keywords: ['environment','clearance'],            citations: ['Environment Protection Act, 1986','National Green Tribunal Act, 2010'] },
  { keywords: ['property tax','assessment'],          citations: ['Haryana Municipal Act, 1973','Haryana Land Revenue Act 1887'] },
  { keywords: ['building plan','building'],           citations: ['Municipal Corporation Bye-laws 2020','RERA Haryana, 2017','Urban Development Notification, 2021'] },
];

function detectCitationsLegacy(textOrTitle, allDocs) {
  const t = textOrTitle.toLowerCase();
  let detected = [];
  for (const pattern of CITATION_PATTERNS) {
    if (pattern.keywords.some(k => t.includes(k))) { detected = pattern.citations; break; }
  }
  if (detected.length === 0) detected = ['Constitution of India','General Administration Guidelines, 2020'];
  return detected.map(citation => {
    const citWords = citation.toLowerCase().split(' ').filter(w => w.length > 4);
    const matched  = allDocs.find(d => citWords.filter(w => d.title.toLowerCase().includes(w)).length >= 2);
    return { citation, matchedDoc: matched || null, status: matched ? 'linked' : 'unresolved', relLabel: 'References' };
  });
}
// Given a doc's detected citations and its own dept, returns list of other depts to notify.
function detectCrossDeptNotifications(citations, uploaderDept) {
  const notifyDepts = new Set();
  for (const { citation } of citations) {
    const lower = citation.toLowerCase();
    for (const { keywords, dept } of DEPT_KEYWORD_MAP) {
      if (dept !== uploaderDept && keywords.some(k => lower.includes(k))) {
        notifyDepts.add(dept);
      }
    }
  }
  return [...notifyDepts];
}

// ─── Helper utilities ──────────────────────────────────────────────────────────

function fileIcon(f) {
  if (f.name.endsWith('.zip')) return <Archive size={15} color="#f59e0b" />;
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
    f.name.endsWith('.zip')      || f.type === 'application/zip' ||
    f.type === 'application/x-zip-compressed'
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
function HierarchyTag({ hierarchy, onChange }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(hierarchy || { act: '', chapter: '', section: '', subsection: '' });

  function save() {
    onChange?.(local);
    setOpen(false);
  }

  const hasValues = local.act || local.chapter || local.section;

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: hasValues ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <Layers size={13} />
        {hasValues
          ? `${local.act || '—'} › ${local.chapter || '—'} › ${local.section || '—'}`
          : 'Set Hierarchical Tags'}
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Act Name', key: 'act', ph: 'e.g. Haryana Municipal Act 1973' },
            { label: 'Chapter', key: 'chapter', ph: 'e.g. Chapter III — Taxation' },
            { label: 'Section', key: 'section', ph: 'e.g. Section 45 — Property Tax' },
            { label: 'Sub-section', key: 'subsection', ph: 'e.g. (2)(a)' },
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <div style={{ ...LABEL, marginBottom: 5 }}>{label}</div>
              <input value={local[key]} onChange={e => setLocal(v => ({ ...v, [key]: e.target.value }))}
                placeholder={ph} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={() => setOpen(false)}
              style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Cancel
            </button>
            <button type="button" onClick={save}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Save Tags
            </button>
          </div>
        </div>
      )}
    </div>
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
function CrossDeptBanner({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <Users size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>Cross-Department Notifications Sent</div>
        {notifications.map((n, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
            → <strong>{n.dept}</strong>: new document references their legislation
          </div>
        ))}
      </div>
      <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6' }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Analysis result card ──────────────────────────────────────────────────────
// Only shows LINKED citations — unresolved ones are hidden, count shown in header only.
function AnalysisCard({ docTitle, citations, analyzing }) {
  const linked     = citations.filter(c => c.status === 'linked');
  const unresolved = citations.filter(c => c.status === 'unresolved');

  return (
    <div style={{ border: '1px solid var(--surface-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <FileText size={14} color="var(--primary)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>{docTitle}</span>
        {analyzing ? (
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 700 }}>ANALYSING…</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#16a34a', fontWeight: 700 }}>
              ✓ {linked.length} LINKED
            </span>
            {unresolved.length > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 500 }}>
                · {unresolved.length} not in system
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body — only linked citations shown */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {analyzing ? (
          [1,2,3].map(i => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: 'var(--surface-ground)', animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.6 + i * 0.1 }} />
          ))
        ) : linked.length === 0 ? (
          <div style={{ padding: '14px 12px', borderRadius: 8, background: 'var(--surface-ground)', fontSize: 12.5, color: 'var(--text-color-secondary)', textAlign: 'center' }}>
            No matching documents found in the system for this upload.
          </div>
        ) : (
          linked.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)' }}>
              <Link size={13} color="#16a34a" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', marginBottom: 2 }}>
                  Detected citation · <span style={{ color: 'var(--primary)' }}>{c.relLabel || 'References'}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.citation}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', fontFamily: 'var(--mono)', marginBottom: 2 }}>✓ LINKED</div>
                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', maxWidth: 160, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.matchedDoc?.title}</div>
              </div>
            </div>
          ))
        )}
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

// ─── Main component ────────────────────────────────────────────────────────────
export default function UploaderDashboard({ activePage, onAuditLog, documents = [], onAddDocument, taxonomy = [] }) {
  const [deptsData, setDeptsData] = useState([]);
  const [typesData, setTypesData] = useState([]);
  const DEPTS = deptsData.length > 0 ? deptsData.map(d => d.name) : DEFAULT_DEPTS;
  const TYPES = typesData.length > 0 ? typesData.map(d => d.name) : DEFAULT_TYPES;

  useEffect(() => {
    getDepartments().then(res => setDeptsData(res.data)).catch(() => {});
    getDocumentTypes().then(res => setTypesData(res.data)).catch(() => {});
  }, []);
  const [uploads, setUploads] = useState(
    documents.filter(d => d.uploader === 'Priya Sharma')
      .map(d => ({ ...d, version: d.version || '1.0', ocrStatus: d.ocrStatus || 'completed', workflowStatus: d.workflowStatus || WORKFLOW_STATUS.PUBLISHED }))
  );
  const [files, setFiles]           = useState([]);
  const [dragOver, setDragOver]     = useState(false);
  const [form, setForm]             = useState({ act: '', dept: '', type: '', version: '1.0', desc: '', gazette: '', authority: '', enactmentDate: '', parentAct: '', changeTypes: [] });
  const [amendmentProvisions, setAmendmentProvisions] = useState([]);
  const [hierarchy, setHierarchy]   = useState({ act: '', chapter: '', section: '', subsection: '' });
  const [rejected, setRejected]     = useState([]);
  const [versionModal, setVersionModal] = useState(null);
  const [conflictModal, setConflictModal] = useState(null); // { existingDoc, pendingDocs, pendingRelations }

  // Correction request state
  const [correctionModal, setCorrectionModal] = useState(null); // { doc }
  const [correctionReason, setCorrectionReason] = useState('');
  const [crossDeptNotifs, setCrossDeptNotifs] = useState([]);

  // Relationship state
  const [relations, setRelations]     = useState([]);
  const [relType, setRelType]         = useState(REL_TYPES[0]);
  const [relTarget, setRelTarget]     = useState('');
  const [relSearch, setRelSearch]     = useState('');
  const [showRelDrop, setShowRelDrop] = useState(false);

  // AI analysis state
  const [analysisResults, setAnalysisResults] = useState([]);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFields, setBulkFields]     = useState({ dept: '', type: '', year: '' });
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [fileRefs,    setFileRefs]    = useState([]); // [{ fileName, fileRef, originalFilename, fileSize }]
  const [uploadStep, setUploadStep]   = useState(null); // null | 'uploading' | 'ready' | 'saving' | 'done' | 'error'
  const [uploadError, setUploadError] = useState('');

  // Table filter + sort
  const [tableSearch, setTableSearch] = useState('');
  const [filterType,  setFilterType]  = useState('');
  const [sortCol,     setSortCol]     = useState('uploadedAt');
  const [sortDir,     setSortDir]     = useState('desc');

  const inputRef     = useRef();
  const uploadsTableRef = useRef();
  const fmt      = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const approvedDocs = documents.filter(d => d.status === 'approved');
  const relFiltered  = approvedDocs
    .filter(d => d.title.toLowerCase().includes(relSearch.toLowerCase()) && d.uid !== relTarget)
    .slice(0, 8);

  async function addFiles(fileList) {
    const arr = Array.from(fileList);
    setRejected(arr.filter(f => !isAccepted(f)).map(f => f.name));
    const accepted = arr.filter(f => isAccepted(f));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });

    // Auto-extract metadata from the first PDF
    const firstPdf = accepted.find(f => f.name.endsWith('.pdf'));
    if (firstPdf && !form.act) {
      setAutoFillLoading(true);
      const { text } = await extractPdfText(firstPdf);
      const meta = autoExtractMetadata(text || firstPdf.name, firstPdf.name);
      setForm(f => ({
        ...f,
        act:  f.act  || meta.title,
        type: f.type || meta.type,
        dept: f.dept || meta.dept,
      }));
      setAutoFillLoading(false);
    }
  }

  function removeFile(name) {
    setFiles(f => f.filter(x => x.name !== name));
    setFileRefs(r => r.filter(x => x.fileName !== name));
  }
  function handleDrop(e) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }

  function addRelation() {
    if (!relTarget) return;
    const doc = documents.find(d => d.uid === relTarget);
    if (!doc || relations.find(r => r.targetId === relTarget && r.label === relType)) return;
    setRelations(r => [...r, { targetId: relTarget, targetTitle: doc.title, label: relType }]);
    setRelTarget(''); setRelSearch('');
  }
  function removeRelation(idx) { setRelations(r => r.filter((_, i) => i !== idx)); }

  // ── Finalize upload (called after conflict check passes) ───────────────────
  async function finalizeUpload(newDocs, finalRelations) {
    const docsWithWorkflow = newDocs.map(d => ({ ...d, workflowStatus: WORKFLOW_STATUS.DRAFT }));

    // Show skeleton analysis
    const initResults = docsWithWorkflow.map(d => ({ docTitle: d.title, citations: [], analyzing: true }));
    setAnalysisResults(initResults);

    // Add to system (status = pending, workflowStatus = DRAFT)
    docsWithWorkflow.forEach(doc => {
      const uid = `upload-${doc.id}`;
      onAddDocument?.({ ...doc, uid }, finalRelations);
      setUploads(u => [{ ...doc, uid }, ...u]);
    });

    setFiles([]); setFileRefs([]); setRelations([]);
    setForm({ act:'',dept:'',type:'',version:'1.0',desc:'',gazette:'',authority:'',enactmentDate:'',parentAct:'',changeTypes:[] });
    setHierarchy({ act:'',chapter:'',section:'',subsection:'' });
    setAmendmentProvisions([]);
    setTimeout(async () => {
      const allDocsNow = [...documents, ...docsWithWorkflow.map(d => ({ ...d, uid: `upload-${d.id}` }))];
      const allNotifs  = [];

      const results = await Promise.all(docsWithWorkflow.map(async doc => {
        // Try to get the actual file object for real text extraction
        const fileObj = files.find(f => f.name === doc.fileName);
        let rawText = '';
        if (fileObj && fileObj.name.endsWith('.pdf')) {
          ({ text: rawText } = await extractPdfText(fileObj));
        }

        const otherDocs = allDocsNow.filter(d => d.title !== doc.title);
        const citations = rawText.length > 100
          ? detectCitationsFromText(rawText, otherDocs)
          : detectCitationsLegacy(doc.title, otherDocs);

        // Auto-add linked relationships to graph (pass existing uid so addDocument deduplicates)
        citations.filter(c => c.status === 'linked').forEach(c => {
          onAddDocument?.({ ...doc, uid: `upload-${doc.id}` }, [{ targetId: c.matchedDoc.uid, targetTitle: c.matchedDoc.title, label: c.relLabel || 'References' }]);
        });
        const notifs = detectCrossDeptNotifications(citations, doc.dept);
        notifs.forEach(dept => allNotifs.push({ dept, docTitle: doc.title }));
        setUploads(u => u.map(ud =>
          ud.id === doc.id ? { ...ud, workflowStatus: WORKFLOW_STATUS.PENDING } : ud
        ));

        return { docTitle: doc.title, citations, analyzing: false };
      }));

      setAnalysisResults(results);
      if (allNotifs.length > 0) setCrossDeptNotifs(allNotifs);
    }, 1800);

    onAuditLog?.(`Uploaded ${docsWithWorkflow.length} document(s): ${docsWithWorkflow.map(d => d.title).join(', ')}`);
  }

  // ── Step 1: upload files to get file_refs ──────────────────────────────────
  async function handleUploadFile() {
    if (files.length === 0) return;
    setUploadStep('uploading');
    setUploadError('');
    const refs = [];
    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await uploadPdfFile(fd);
        refs.push({
          fileName:         f.name,
          fileRef:          res.data.file_ref,
          originalFilename: res.data.original_filename ?? f.name,
          fileSize:         res.data.file_size ?? f.size,
        });
      } catch (err) {
        const detail = err.response?.data?.detail;
        setUploadError(typeof detail === 'string' ? detail : `Upload failed for "${f.name}"`);
        setUploadStep('error');
        return;
      }
    }
    setFileRefs(refs);
    setUploadStep('ready');
  }

  // ── Step 2: save metadata (called on form submit) ───────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0 || fileRefs.length === 0) return;

    setUploadStep('saving');
    setUploadError('');

    const deptObj = deptsData.find(d => d.name === form.dept);
    const typeObj = typesData.find(d => d.name === form.type);
    const newDocs = [];

    for (const f of files) {
      const refEntry = fileRefs.find(r => r.fileName === f.name);
      if (!refEntry) continue;

      let apiDoc;
      try {
        const payload = {
          file_ref:          refEntry.fileRef,
          act_name:          form.act || f.name.replace(/\.(pdf|zip)$/i, ''),
          gazette_reference: form.gazette || '',
          issuing_authority: form.authority || '',
          enactment_date:    form.enactmentDate || null,
          version_no:        form.version || '1.0',
          department_id:     deptObj?.id ?? null,
          document_type_id:  typeObj?.id ?? null,
          tag_ids:           [],
          description:       form.desc || '',
        };
        const res2 = await uploadPdfMetadata(payload);
        apiDoc = res2.data;
      } catch (err) {
        const detail = err.response?.data?.detail;
        setUploadError(typeof detail === 'string' ? detail : `Metadata save failed for "${f.name}"`);
        setUploadStep('error');
        return;
      }

      const { text: extractedText, numPages, pageTexts, pageWords } = f.name.endsWith('.pdf')
        ? await extractPdfText(f)
        : { text: '', numPages: null, pageTexts: [], pageWords: [] };

      newDocs.push({
        id:            apiDoc.id ?? (Date.now() + Math.random()),
        title:         apiDoc.act_name || form.act || f.name.replace(/\.(pdf|zip)$/i, ''),
        type:          typeObj?.name || form.type || 'Act',
        dept:          deptObj?.name || form.dept || 'General',
        year:          form.enactmentDate ? new Date(form.enactmentDate).getFullYear() : new Date().getFullYear(),
        status:        'pending',
        legalStatus:   'active',
        pages:         f.name.endsWith('.zip') ? null : (numPages || 1),
        uploader:      'Priya Sharma',
        uploadedAt:    new Date().toISOString().split('T')[0],
        section:       '1', paragraph: '1',
        version:       apiDoc.version_no || form.version || '1.0',
        ocrStatus:     f.name.endsWith('.zip') ? 'queued' : 'processing',
        fileName:      refEntry.originalFilename,
        isZip:         f.name.endsWith('.zip'),
        fileUrl:       f.name.endsWith('.pdf') ? URL.createObjectURL(f) : null,
        hierarchy,
        gazette:           apiDoc.gazette_reference || form.gazette || '',
        authority:         apiDoc.issuing_authority || form.authority || '',
        enactmentDate:     apiDoc.enactment_date || form.enactmentDate || '',
        amendmentProvisions: form.type === 'Amendment' ? amendmentProvisions.filter(p => p.section) : [],
        extractedText:  extractedText || '',
        extractedPages: pageTexts.length > 0 ? pageTexts : null,
        extractedWords: pageWords.length  > 0 ? pageWords : null,
        ocrConfidence:  extractedText ? 95 : null,
      });
    }

    setUploadStep('done');
    setTimeout(() => { setUploadStep(null); setFileRefs([]); }, 2000);

    const conflict = newDocs.find(d =>
      documents.some(ex => ex.title.toLowerCase() === d.title.toLowerCase() && ex.status !== 'rejected')
    );
    if (conflict) {
      const existing   = documents.find(ex => ex.title.toLowerCase() === conflict.title.toLowerCase());
      const currentVer = parseFloat(existing.version || '1.0');
      setConflictModal({
        existingDoc:      existing,
        newVersion:       (currentVer + 0.1).toFixed(1),
        pendingDocs:      newDocs,
        pendingRelations: relations,
      });
    } else {
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

  // ── My Uploads page ────────────────────────────────────────────────────────
  if (activePage === 'myuploads') {
    const approved  = uploads.filter(d => d.status === 'approved').length;
    const pending   = uploads.filter(d => d.status === 'pending').length;
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

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Uploads',   value: uploads.length, bg: 'rgba(26,86,219,.12)',  color: 'var(--primary)', icon: FileText },
            { label: 'Approved',        value: approved,        bg: 'rgba(34,197,94,.12)',  color: '#22c55e',        icon: CheckCircle },
            { label: 'Pending Review',  value: pending,         bg: 'rgba(245,158,11,.12)', color: '#f59e0b',        icon: TrendingUp },
            { label: 'Published',       value: published,       bg: 'rgba(59,130,246,.12)', color: '#3b82f6',        icon: Eye },
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

        {/* Document type breakdown */}
        {(() => {
          const typeCounts = TYPES.map(t => ({ type: t, count: uploads.filter(d => d.type === t).length }));
          const maxCount   = Math.max(...typeCounts.map(x => x.count), 1);
          const TYPE_COLORS = {
            'Act':                  { bg: 'rgba(26,86,219,.12)',   bar: 'var(--primary)',  text: 'var(--primary)'  },
            'Amendment':            { bg: 'rgba(59,130,246,.12)',  bar: '#3b82f6',         text: '#1d4ed8'         },
            'Notification':         { bg: 'rgba(245,158,11,.12)',  bar: '#f59e0b',         text: '#d97706'         },
            'Circular':             { bg: 'rgba(168,85,247,.12)',  bar: '#a855f7',         text: '#7c3aed'         },
            'Policy':               { bg: 'rgba(20,184,166,.12)',  bar: '#14b8a6',         text: '#0f766e'         },
            'Rules & Regulations':  { bg: 'rgba(239,68,68,.10)',   bar: '#ef4444',         text: '#dc2626'         },
            'Order / Gazette':      { bg: 'rgba(234,179,8,.12)',   bar: '#eab308',         text: '#a16207'         },
          };
          return (
            <>
              <Card>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={15} color="var(--primary)" />
                  Document Type Breakdown
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 10px', borderRadius: 20 }}>
                    {typeCounts.length} type{typeCounts.length !== 1 ? 's' : ''} uploaded
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {typeCounts.map(({ type, count }) => {
                    const c      = TYPE_COLORS[type] || { bg: 'rgba(148,163,184,.12)', bar: '#94a3b8', text: '#64748b' };
                    const active = filterType === type;
                    return (
                      <div key={type}
                        onClick={() => {
                          const next = active ? '' : type;
                          setFilterType(next);
                          if (next && count > 0) setTimeout(() => uploadsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                        }}
                        style={{
                          padding: '12px 14px', borderRadius: 10, cursor: count > 0 ? 'pointer' : 'default',
                          background: active ? c.bar : c.bg,
                          border: `1.5px solid ${active ? c.bar : 'rgba(0,0,0,.06)'}`,
                          display: 'flex', flexDirection: 'column', gap: 8,
                          transition: 'all .2s',
                          boxShadow: active ? `0 4px 14px ${c.bar}33` : 'none',
                          opacity: count === 0 ? 0.45 : 1,
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'white' : c.text }}>{type}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800, color: active ? 'white' : c.text, lineHeight: 1 }}>{count}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: active ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: active ? 'white' : c.bar, width: `${(count / maxCount) * 100}%`, transition: 'width .5s ease' }} />
                        </div>
                        <span style={{ fontSize: 10.5, color: active ? 'rgba(255,255,255,.8)' : c.text, fontFamily: 'var(--mono)', opacity: active ? 1 : .75 }}>
                          {uploads.length > 0 ? `${Math.round((count / uploads.length) * 100)}% of uploads` : '0%'}
                          {count > 0 && <span style={{ marginLeft: 6 }}>· {active ? 'click to clear' : 'click to filter'}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

            </>
          );
        })()}
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
          // ── compute filtered + sorted list ──────────────────────────────
          const SORT_KEY = { 'title': d => d.title, 'type': d => d.type, 'dept': d => d.dept,
            'year': d => d.year, 'uploadedAt': d => d.uploadedAt, 'status': d => d.status };
          const filtered = uploads
            .filter(d => !tableSearch || d.title.toLowerCase().includes(tableSearch.toLowerCase()))
            .filter(d => !filterType  || d.type === filterType)
            .sort((a, b) => {
              const ka = SORT_KEY[sortCol]?.(a) ?? '';
              const kb = SORT_KEY[sortCol]?.(b) ?? '';
              return sortDir === 'asc' ? (ka > kb ? 1 : -1) : (ka < kb ? 1 : -1);
            });

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
          {/* Card header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>My Uploads</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
              {filtered.length}{filtered.length !== uploads.length ? ` / ${uploads.length}` : ''} docs
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

          {/* Search + active filter chip */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', flex: 1, maxWidth: 300 }}>
              <Search size={13} color="var(--text-color-secondary)" />
              <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search by title…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
              {tableSearch && <button onClick={() => setTableSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
            </div>
            {filterType && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 20, background: 'var(--primary-light)', border: '1px solid var(--primary-border)', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                {filterType}
                <button onClick={() => setFilterType('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                {bulkSelectMode && <col style={{ width: '3%' }} />}
                <col style={{ width: bulkSelectMode ? '22%' : '25%' }} /><col style={{ width: '9%' }} /><col style={{ width: '13%' }} />
                <col style={{ width: '6%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%'  }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                  {bulkSelectMode && (
                    <th style={{ padding: '10px 10px' }}>
                      <button onClick={toggleSelectAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                        {selectedIds.size === draftUploads.length && draftUploads.length > 0
                          ? <CheckSquare size={14} color="var(--primary)" />
                          : <Square size={14} />}
                      </button>
                    </th>
                  )}
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="title" label="Document Title" /></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="type" label="Type" /></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="dept" label="Department" /></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="year" label="Year" /></th>
                  <th style={{ ...LABEL, padding: '10px 14px', textAlign: 'left' }}>Workflow</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="status" label="Status" /></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="uploadedAt" label="Uploaded On" /></th>
                  <th style={{ ...LABEL, padding: '10px 14px', textAlign: 'left' }}>OCR</th>
                  <th style={{ ...LABEL, padding: '10px 14px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '52px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>No uploads yet.</td></tr>
                )}
                {filtered.map(doc => {
                  const isDraft = !doc.workflowStatus || doc.workflowStatus === WORKFLOW_STATUS.DRAFT;
                  const isPublished = doc.workflowStatus === WORKFLOW_STATUS.PUBLISHED;
                  const isPending = doc.workflowStatus === WORKFLOW_STATUS.PENDING;
                  return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s', background: selectedIds.has(doc.id) ? 'rgba(26,86,219,.04)' : 'transparent' }}
                    onMouseEnter={e => { if (!selectedIds.has(doc.id)) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (!selectedIds.has(doc.id)) e.currentTarget.style.background = 'transparent'; }}>
                    {bulkSelectMode && (
                      <td style={{ padding: '12px 10px' }}>
                        {isDraft ? (
                          <button onClick={() => toggleSelectDoc(doc.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                            {selectedIds.has(doc.id) ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} />}
                          </button>
                        ) : (
                          <div style={{ width: 14, height: 14 }} title={isPublished ? 'Published — use Request Correction' : 'Under review'}>
                            <Square size={14} color="var(--surface-200)" />
                          </div>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {doc.isZip ? <Archive size={13} color="#f59e0b" /> : <FileText size={13} color="var(--primary)" />}
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                      </div>
                      {doc.hierarchy?.act && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.hierarchy.act}{doc.hierarchy.chapter ? ` › ${doc.hierarchy.chapter}` : ''}{doc.hierarchy.section ? ` › ${doc.hierarchy.section}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-color-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.dept}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.year}</td>
                    <td style={{ padding: '12px 14px' }}><WorkflowBadge status={doc.workflowStatus || WORKFLOW_STATUS.DRAFT} /></td>
                    <td style={{ padding: '12px 14px' }}><Badge label={doc.status} variant={doc.status} /></td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.uploadedAt}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20,
                        background: doc.ocrStatus === 'completed' ? 'rgba(34,197,94,.1)' : doc.ocrStatus === 'processing' ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)',
                        color:      doc.ocrStatus === 'completed' ? '#16a34a' : doc.ocrStatus === 'processing' ? '#3b82f6' : '#d97706',
                      }}>{(doc.ocrStatus || 'completed').toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => setVersionModal(doc)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Eye size={11} /> v{doc.version || '1.0'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </div>
          );
        })()}
      </div>
    );
  }

  // ── Upload page ────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, animation: 'fadeSlideIn .3s ease' }}>
      {conflictModal && (
        <VersionConflictModal
          existingDoc={conflictModal.existingDoc}
          newVersion={conflictModal.newVersion}
          onUploadAsNew={handleConflictResolve}
          onCancel={() => setConflictModal(null)}
        />
      )}
      <CrossDeptBanner notifications={crossDeptNotifs} onDismiss={() => setCrossDeptNotifs([])} />

      {/* AI Analysis Results */}
      {analysisResults.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Cpu size={17} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>AI Citation Analysis</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>
                Scanning OCR text for cross-references · Auto-linking to existing documents · Zero Generation compliant
              </div>
            </div>
            <button onClick={() => setAnalysisResults([])}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          {analysisResults.map((r, i) => (
            <AnalysisCard key={i} docTitle={r.docTitle} citations={r.citations} analyzing={r.analyzing} />
          ))}
          {analysisResults.every(r => !r.analyzing) && (
            <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(26,86,219,.06)', border: '1px solid rgba(26,86,219,.2)', fontSize: 12.5, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={14} />
              Analysis complete — linked documents are now visible in the Knowledge Graph.
            </div>
          )}
        </Card>
      )}

      {rejected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 18px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626', marginBottom: 14 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>Unsupported file type rejected:</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{rejected.join(', ')}</div>
          </div>
          <button onClick={() => setRejected([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
        </div>
      )}

      {/* ── Step indicator ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
        {[
          { n: 1, label: 'Select & Upload File', done: fileRefs.length > 0, active: fileRefs.length === 0 },
          { n: 2, label: 'Fill Document Details', done: uploadStep === 'done', active: fileRefs.length > 0 && uploadStep !== 'done' },
        ].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? 'none' : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: s.done ? '#16a34a' : s.active ? 'var(--primary)' : 'var(--surface-ground)',
                border: s.done || s.active ? 'none' : '2px solid var(--surface-border)',
                color: s.done || s.active ? 'white' : 'var(--text-color-secondary)',
                fontSize: 12, fontWeight: 700, transition: 'all .3s',
              }}>
                {s.done ? <CheckCircle size={14} /> : s.n}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: s.active ? 700 : 500, color: s.done ? '#16a34a' : s.active ? 'var(--primary)' : 'var(--text-color-secondary)', whiteSpace: 'nowrap', transition: 'all .3s' }}>
                {s.label}
              </span>
            </div>
            {i === 0 && (
              <div style={{ flex: 1, height: 2, margin: '0 12px', background: fileRefs.length > 0 ? '#16a34a' : 'var(--surface-border)', borderRadius: 2, minWidth: 32, transition: 'background .4s' }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Drop zone (Step 1) ──────────────────────────────────────────────── */}
      <div
        onClick={() => fileRefs.length === 0 && files.length === 0 && inputRef.current?.click()}
        onDrop={e => { if (fileRefs.length === 0) handleDrop(e); else e.preventDefault(); }}
        onDragOver={e => { e.preventDefault(); if (fileRefs.length === 0) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          border: `2px dashed ${fileRefs.length > 0 ? '#16a34a' : dragOver ? 'var(--primary)' : files.length > 0 ? 'rgba(26,86,219,.4)' : 'var(--surface-border)'}`,
          borderRadius: 'var(--radius)', padding: files.length > 0 ? '20px 24px' : '44px 32px',
          textAlign: 'center', cursor: fileRefs.length > 0 ? 'default' : files.length > 0 ? 'default' : 'pointer',
          transition: 'all .25s',
          background: fileRefs.length > 0 ? 'rgba(22,163,74,.03)' : dragOver ? 'rgba(26,86,219,.04)' : files.length > 0 ? 'rgba(26,86,219,.02)' : 'var(--surface-card)',
          marginBottom: 16, boxShadow: dragOver ? '0 0 0 4px rgba(26,86,219,.08)' : 'var(--card-shadow)',
        }}>
        <input ref={inputRef} type="file" accept=".pdf,.zip" multiple style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        {files.length > 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {fileRefs.length > 0
                  ? <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={15} /> {files.length} file{files.length !== 1 ? 's' : ''} uploaded successfully</span>
                  : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                }
                {autoFillLoading && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 700 }}>⚡ Auto-extracting metadata…</span>
                )}
              </div>
              {fileRefs.length === 0 && (
                <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  + Add More
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map(f => {
                const uploaded = fileRefs.some(r => r.fileName === f.name);
                return (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: uploaded ? 'rgba(22,163,74,.06)' : 'var(--surface-ground)', border: `1px solid ${uploaded ? 'rgba(22,163,74,.25)' : 'var(--surface-border)'}`, textAlign: 'left', transition: 'all .3s' }}>
                    {fileIcon(f)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', marginTop: 1 }}>
                        {formatSize(f.size)}{f.name.endsWith('.zip') && <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 700 }}>ZIP BATCH</span>}
                        {uploaded && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 700 }}>✓ UPLOADED</span>}
                      </div>
                    </div>
                    {fileRefs.length === 0 && (
                      <button onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                        style={{ background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 5, width: 24, height: 24, cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 13, background: dragOver ? 'rgba(26,86,219,.12)' : 'var(--surface-ground)', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: dragOver ? 'var(--primary)' : 'var(--text-color-secondary)', transition: 'all .25s' }}>
              <Upload size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 5 }}>Drop files here or click to browse</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', marginBottom: 8 }}>Select multiple PDFs or a ZIP archive — up to 50 MB per file</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--primary)', background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)', padding: '3px 10px', borderRadius: 20 }}>.PDF</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', padding: '3px 10px', borderRadius: 20 }}>.ZIP</span>
            </div>
          </>
        )}
      </div>

      {/* ── Upload File button (Step 1 action) ──────────────────────────────── */}
      {files.length > 0 && fileRefs.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          {uploadError && uploadStep === 'error' && (
            <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#dc2626', flex: 1 }}>{uploadError}</span>
              <button type="button" onClick={() => { setUploadError(''); setUploadStep(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={12} /></button>
            </div>
          )}
          <button
            type="button"
            onClick={handleUploadFile}
            disabled={uploadStep === 'uploading'}
            style={{
              width: '100%', padding: '13px 24px', borderRadius: 10, border: 'none',
              background: uploadStep === 'uploading' ? 'var(--surface-200)' : 'var(--primary)',
              color: uploadStep === 'uploading' ? '#94a3b8' : 'white',
              fontSize: 14, fontWeight: 700, cursor: uploadStep === 'uploading' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              fontFamily: 'var(--font)', boxShadow: uploadStep === 'uploading' ? 'none' : '0 2px 8px rgba(26,86,219,.25)',
              transition: 'all .2s',
            }}>
            {uploadStep === 'uploading'
              ? <><Clock size={16} /> Uploading {files.length > 1 ? `${files.length} files` : 'file'}…</>
              : <><Upload size={16} /> Upload {files.length > 1 ? `${files.length} Files` : 'File'}</>
            }
          </button>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-color-secondary)', textAlign: 'center' }}>
            File will be securely stored — you can fill in the details on the next step.
          </div>
        </div>
      )}

      {/* Metadata form — only shown after Step 1 is complete */}
      {fileRefs.length > 0 && <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} color="var(--primary)" />
          Document Details
          {files.length > 1 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,.1)', color: '#3b82f6', padding: '2px 9px', borderRadius: 20 }}>Applied to all {files.length} files</span>}
          {autoFillLoading && <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 700 }}>⚡ AUTO-FILLING…</span>}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 7 }}>Act / Instrument Name {files.length <= 1 && <span style={{ color: '#ef4444' }}>*</span>}</div>
              <input value={form.act} onChange={e => fmt('act', e.target.value)} required={files.length <= 1}
                placeholder={files.length > 1 ? 'Leave blank to use each filename' : 'e.g. Haryana Municipal Act, 1973'}
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            {/* Gazette Reference — full width, always */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 7 }}>Gazette Reference <span style={{ color: '#ef4444' }}>*</span></div>
              <input value={form.gazette} onChange={e => fmt('gazette', e.target.value)} required
                placeholder="e.g. Gazette of India Extraordinary, Part II, Sec. 1, No. 312, dated 18 Dec 1976"
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            {/* Issuing Authority + Enactment Date */}
            <div>
              <div style={{ ...LABEL, marginBottom: 7 }}>Issuing Authority <span style={{ color: '#ef4444' }}>*</span></div>
              <input value={form.authority} onChange={e => fmt('authority', e.target.value)} required
                placeholder="e.g. Parliament of India / Governor of Haryana"
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
            <div>
              <div style={{ ...LABEL, marginBottom: 7 }}>Enactment / Issue Date <span style={{ color: '#ef4444' }}>*</span></div>
              <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            <div>
              <div style={{ ...LABEL, marginBottom: 7 }}>Version / Amendment No.</div>
              <input value={form.version} onChange={e => fmt('version', e.target.value)} placeholder="e.g. 1.0"
                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
            {/* Year auto-derived from enactmentDate — no separate field needed */}
            {[['Department *','dept',DEPTS,true],['Document Type *','type',TYPES,true]].map(([lbl,key,opts,req]) => (
              <div key={key}>
                <div style={{ ...LABEL, marginBottom: 7 }}>{lbl}</div>
                <select value={form[key]} onChange={e => fmt(key, e.target.value)} required={req}
                  style={{ ...INPUT_BASE, cursor: 'pointer', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">— Select {lbl.replace(' *','')} —</option>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 7 }}>Hierarchical Tags</div>
              <HierarchyTag hierarchy={hierarchy} onChange={setHierarchy} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...LABEL, marginBottom: 7 }}>Description / Remarks</div>
              <textarea value={form.desc} onChange={e => fmt('desc', e.target.value)} rows={3}
                placeholder="Brief description or upload remarks…"
                style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          {/* ── Amendment info — simplified, conditional on type = Amendment ── */}
          {form.type === 'Amendment' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={13} color="var(--primary)" />
                Amendment Details
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginBottom: 16 }}>
                AI will compare both documents and extract exact changes — you only need to specify the parent act and what kind of changes are present.
              </div>

              {/* Parent Act selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...LABEL, marginBottom: 7 }}>Parent Act being amended <span style={{ color: '#ef4444' }}>*</span></div>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.parentAct ? (documents.find(d => d.uid === form.parentAct)?.title || form.parentAct) : relSearch}
                    onChange={e => { setRelSearch(e.target.value); fmt('parentAct', ''); setShowRelDrop(true); }}
                    onFocus={() => setShowRelDrop(true)}
                    onBlur={() => setTimeout(() => setShowRelDrop(false), 150)}
                    placeholder="Search the act this amendment modifies…"
                    style={{ ...INPUT_BASE, paddingRight: form.parentAct ? 36 : 14 }}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                  {form.parentAct && (
                    <button type="button" onClick={() => { fmt('parentAct', ''); setRelSearch(''); }}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                      <X size={13} />
                    </button>
                  )}
                  {showRelDrop && !form.parentAct && relFiltered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                      {relFiltered.map(d => (
                        <div key={d.uid} onMouseDown={() => { fmt('parentAct', d.uid); setRelSearch(''); setShowRelDrop(false); }}
                          style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', fontSize: 12.5, transition: 'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{d.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>{d.year} · {d.dept}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {form.parentAct && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: 'rgba(26,86,219,.05)', border: '1px solid rgba(26,86,219,.15)' }}>
                    <GitBranch size={12} color="var(--primary)" />
                    <span style={{ fontSize: 12, color: 'var(--text-color-secondary)' }}>Amends →</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-heading)' }}>{documents.find(d => d.uid === form.parentAct)?.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'var(--mono)', background: 'var(--primary-light)', padding: '1px 8px', borderRadius: 20, marginLeft: 'auto' }}>AI will compare</span>
                  </div>
                )}
              </div>

              {/* Change types — multi-select chips */}
              <div>
                <div style={{ ...LABEL, marginBottom: 8 }}>Types of changes present in this amendment <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(tick all that apply)</span></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {AMEND_CHANGE_TYPES.map(ct => {
                    const active = form.changeTypes.includes(ct);
                    const c = AMEND_CHANGE_COLORS[ct] || '#94a3b8';
                    return (
                      <button key={ct} type="button"
                        onClick={() => fmt('changeTypes', active ? form.changeTypes.filter(x => x !== ct) : [...form.changeTypes, ct])}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${active ? c : 'var(--surface-border)'}`, background: active ? c + '15' : 'transparent', color: active ? c : 'var(--text-color-secondary)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all .15s' }}>
                        {active && <span style={{ fontSize: 11 }}>✓</span>}
                        {ct}
                      </button>
                    );
                  })}
                </div>
                {form.changeTypes.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                    AI will identify exact sections and extract before/after text for: <strong style={{ color: 'var(--text-color)' }}>{form.changeTypes.join(', ')}</strong> changes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual relationship override */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={13} color="var(--primary)" />
              Manual Relationship Override
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-color-secondary)' }}>— optional, AI will auto-detect on upload</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 38px', gap: 10, alignItems: 'start' }}>
              <select value={relType} onChange={e => setRelType(e.target.value)}
                style={{ ...INPUT_BASE, cursor: 'pointer', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', padding: '10px 28px 10px 12px' }}>
                {REL_TYPES.map(r => <option key={r}>{r}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                <input
                  value={relSearch || (documents.find(d => d.uid === relTarget)?.title || '')}
                  onChange={e => { setRelSearch(e.target.value); setRelTarget(''); setShowRelDrop(true); }}
                  onFocus={() => setShowRelDrop(true)}
                  onBlur={() => setTimeout(() => setShowRelDrop(false), 150)}
                  placeholder="Search existing document to link…"
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle}
                />
                {showRelDrop && relFiltered.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {relFiltered.map(d => (
                      <div key={d.uid} onMouseDown={() => { setRelTarget(d.uid); setRelSearch(''); setShowRelDrop(false); }}
                        style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', fontSize: 12.5, transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{d.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>{d.year} · {d.dept}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={addRelation} disabled={!relTarget}
                style={{ height: 42, width: 38, borderRadius: 8, border: 'none', background: relTarget ? 'var(--primary)' : 'var(--surface-200)', color: relTarget ? 'white' : '#94a3b8', cursor: relTarget ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </div>
            {relations.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {relations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: 'rgba(26,86,219,.05)', border: '1px solid rgba(26,86,219,.15)' }}>
                    <GitBranch size={12} color="var(--primary)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--mono)' }}>{r.label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-heading)', flex: 1 }}>→ {r.targetTitle}</span>
                    <button type="button" onClick={() => removeRelation(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {uploadError && uploadStep === 'error' && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#dc2626', flex: 1 }}>{uploadError}</span>
              <button type="button" onClick={() => { setUploadError(''); setUploadStep('ready'); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={12} /></button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--surface-border)' }}>
            <button type="button" onClick={() => { setForm({ act:'',dept:'',type:'',version:'1.0',desc:'',gazette:'',authority:'',enactmentDate:'',parentAct:'',changeTypes:[] }); setFiles([]); setFileRefs([]); setRelations([]); setAnalysisResults([]); setHierarchy({ act:'',chapter:'',section:'',subsection:'' }); setCrossDeptNotifs([]); setAmendmentProvisions([]); setUploadStep(null); setUploadError(''); }}
              style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '9px 22px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
              Clear All
            </button>
            <button type="submit"
              disabled={fileRefs.length === 0 || uploadStep === 'saving' || uploadStep === 'done'}
              style={{
                background: uploadStep === 'done' ? '#16a34a' : fileRefs.length > 0 && uploadStep !== 'saving' ? 'var(--primary)' : 'var(--surface-200)',
                color: fileRefs.length > 0 || uploadStep === 'done' ? 'white' : '#94a3b8',
                border: 'none', padding: '10px 28px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700,
                cursor: fileRefs.length > 0 && uploadStep === 'ready' ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: fileRefs.length > 0 && uploadStep === 'ready' ? '0 2px 8px rgba(26,86,219,.2)' : 'none',
                transition: 'all .2s',
              }}
              onMouseEnter={e => { if (fileRefs.length > 0 && uploadStep === 'ready') e.currentTarget.style.background = 'var(--primary-dark)'; }}
              onMouseLeave={e => { if (fileRefs.length > 0 && uploadStep === 'ready') e.currentTarget.style.background = 'var(--primary)'; }}>
              {uploadStep === 'saving' && <><Clock size={14} /> Saving details…</>}
              {uploadStep === 'done'   && <><CheckCircle size={14} /> Submitted!</>}
              {(uploadStep === 'ready' || !uploadStep) && <><CheckCircle size={14} /> Submit for Approval</>}
            </button>
          </div>
        </form>
      </Card>}
    </div>
  );
}