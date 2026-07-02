import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, XCircle, X, TrendingUp, Archive, Download,
  RotateCcw, AlertCircle, Eye, GitBranch, Plus, Cpu, Link, Clock,
  Layers, ChevronRight, AlertTriangle, Users, CheckSquare, Square,
  Edit3, Tag, Search,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SelectField from '../components/ui/SelectField';
import { useAuth } from '../hooks/useAuth';
import { getDepartments, getDocumentTypes } from '../services/departments';
import { uploadPdfFile, uploadPdfMetadata, getMyDocuments, searchDocuments } from '../services/pdf';
import { createNotification } from '../services/notifications';

// Constants

const DEFAULT_DEPTS = [
  'Urban Local Bodies','Revenue & Disaster Mgmt.','Home Department',
  'Industries & Commerce','Labour Department','Finance Department',
  'Health & Family Welfare','Agriculture & Farmers Welfare',
  'Panchayati Raj','General Administration',
];
const DEFAULT_TYPES = ['Act','Amendment','Notification','Circular','Policy','Rules & Regulations','Order / Gazette'];
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
};

const REL_TARGET_TYPES = {
  'Act':                 ['Act', 'Amendment', 'Rules & Regulations', 'Notification'],
  'Amendment':           ['Act', 'Rules & Regulations', 'Amendment'],
  'Circular':            ['Circular', 'Act', 'Order / Gazette', 'Policy', 'Notification', 'Rules & Regulations'],
  'Notification':        ['Act', 'Rules & Regulations', 'Order / Gazette', 'Notification', 'Circular', 'Policy'],
  'Policy':              ['Act', 'Policy', 'Notification', 'Order / Gazette', 'Circular', 'Rules & Regulations'],
  'Order / Gazette':     ['Act', 'Order / Gazette', 'Notification', 'Rules & Regulations', 'Policy'],
  'Rules & Regulations': ['Act', 'Rules & Regulations', 'Amendment', 'Notification', 'Policy'],
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
};
const TYPE_CARD_DESC = {
  'Act':                 'Primary legislation enacted by legislature',
  'Amendment':           'Modification to an existing Act or Rule',
  'Notification':        'Official government notice or announcement',
  'Circular':            'Internal directive or instruction',
  'Policy':              'Government policy document or framework',
  'Rules & Regulations': 'Subsidiary legislation under an Act',
  'Order / Gazette':     'Executive order or gazette notification',
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
};

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

      
      const citWords = citation.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
      const matched  = allDocs.find(d => {
        const dtitle = d.title.toLowerCase();
        return citWords.filter(w => dtitle.includes(w)).length >= 2;
      });
      const isAct = matched?.type === 'Act';

      // Extract 80-char context window around the match for relationship type detection
      const ctxStart  = Math.max(0, match.index - 40);
      const ctxEnd    = Math.min(rawText.length, match.index + 80);
      const relLabel  = detectRelationshipType(rawText.slice(ctxStart, ctxEnd));

      results.push({
        citation,
        matchedDoc:  isAct ? matched : null,
        status:      isAct ? 'linked' : 'unresolved',
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
    const isAct = matched?.type === 'Act';
    return { citation, matchedDoc: isAct ? matched : null, status: isAct ? 'linked' : 'unresolved', relLabel: 'References' };
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

// Helper utilities

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

function HierarchyTag({ hierarchy, onOpen, isRef, legalAuthorities }) {
  const hasValues = hierarchy?.act || hierarchy?.chapter || hierarchy?.section;
  const hasAuth = legalAuthorities?.some(a => a.act);
  const firstAuth = legalAuthorities?.find(a => a.act);
  const extraCount = legalAuthorities ? legalAuthorities.filter(a => a.act).length - 1 : 0;

  if (isRef && legalAuthorities !== undefined) {
    const firstSec = firstAuth?.sections?.find(s => s);
    return (
      <button type="button" onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: hasAuth ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
        <Layers size={13} />
        {hasAuth
          ? `${firstAuth.act}${firstSec ? ' › ' + firstSec : ''}${extraCount > 0 ? ` · +${extraCount} more` : ''}`
          : 'Set Legal Authority'}
        <ChevronRight size={12} />
      </button>
    );
  }

  return (
    <button type="button" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: hasValues ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
      <Layers size={13} />
      {hasValues
        ? (isRef
            ? hierarchy.section ? `${hierarchy.act || '—'} › ${hierarchy.section}` : (hierarchy.act || '—')
            : hierarchy.chapter || hierarchy.section
              ? `${hierarchy.act || '—'} › ${hierarchy.chapter || '—'} › ${hierarchy.section || '—'}`
              : (hierarchy.act || '—'))
        : (isRef ? 'Set Act Reference' : 'Set Hierarchical Tags')}
      <ChevronRight size={12} />
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

// Analysis result card
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

  function mapApiDoc(d) {
    return {
      id:              d.id,
      uid:             `api-${d.id}`,
      title:           d.document_name,
      type:            d.document_type_name,
      dept:            d.department_name,
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
  const [crossDeptNotifs, setCrossDeptNotifs] = useState([]);

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
  const [relActSuggestions, setRelActSuggestions] = useState([]); // real API results when linking to an Act
  const [relActSearching,   setRelActSearching]   = useState(false);
  const relActSearchTimer = useRef(null);
  const [parentActSearch, setParentActSearch] = useState('');
  const [showParentActDrop, setShowParentActDrop] = useState(false);
  const [drawerType,      setDrawerType]      = useState(null); // null | 'hierarchy' | 'relationship'
  const [drawerHierarchy, setDrawerHierarchy] = useState({ act: '', actId: null, chapter: '', section: '', subsection: '' });

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
  const relFiltered  = approvedDocs
    .filter(d =>
      d.title.toLowerCase().includes(relSearch.toLowerCase()) &&
      d.uid !== relTarget &&
      (!relDocType || d.type === relDocType)
    )
    .slice(0, 8);
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

    // Auto-extract metadata from the first PDF — always re-run so replacing a file updates the name
    const firstPdf = accepted.find(f => f.name.endsWith('.pdf'));
    if (firstPdf) {
      setAutoFillLoading(true);
      const { text } = await extractPdfText(firstPdf);
      const meta = autoExtractMetadata(text || firstPdf.name, firstPdf.name);
      setForm(f => ({
        ...f,
        act:  meta.title,           // always sync to the new file
        type: f.type || meta.type,  // preserve manual pick
        dept: f.dept || meta.dept,  // preserve manual pick
      }));
      setAutoFillLoading(false);
    }
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

  // Same real API search as fetchDocSuggestions, used for the "Link to Document" picker
  // whenever the target document type is 'Act' — non-Act targets keep using the local document list.
  function fetchRelActSuggestions(text) {
    clearTimeout(relActSearchTimer.current);
    if (!text || text.length < 1) { setRelActSuggestions([]); return; }
    relActSearchTimer.current = setTimeout(() => {
      setRelActSearching(true);
      searchDocuments('Act', text, 10)
        .then(res => setRelActSuggestions(res.data.results || []))
        .catch(() => setRelActSuggestions([]))
        .finally(() => setRelActSearching(false));
    }, 280);
  }

  function addRelation() {
    if (!relTarget) return;
    if (relTarget.startsWith('__pending__:')) {
      const pendingName = relTarget.replace('__pending__:', '');
      setRelations(r => [...r, { targetId: null, targetTitle: pendingName, targetType: relDocType, label: relType, note: relNote.trim(), section: relSection.trim(), isPending: true }]);
    } else if (relTarget.startsWith('__act__:')) {
      const [, actId, ...nameParts] = relTarget.split(':');
      const actTitle = nameParts.join(':');
      if (relations.find(r => r.targetId === actId && r.label === relType)) return;
      setRelations(r => [...r, { targetId: actId, targetTitle: actTitle, targetType: 'Act', label: relType, note: relNote.trim(), section: relSection.trim(), isPending: false }]);
    } else {
      const doc = documents.find(d => d.uid === relTarget);
      if (!doc || relations.find(r => r.targetId === relTarget && r.label === relType)) return;
      setRelations(r => [...r, { targetId: relTarget, targetTitle: doc.title, targetType: doc.type || relDocType, label: relType, note: relNote.trim(), section: relSection.trim(), isPending: false }]);
    }
    setRelTarget(''); setRelSearch(''); setRelNote(''); setRelDocType(''); setRelSection(''); setRelActSuggestions([]);
  }

  // Clears all transient "Add Relationship" drawer fields so stale search/selection
  // doesn't leak into the next time the drawer is opened (for this doc or a different one).
  function closeDrawer() {
    setDrawerType(null);
    setRelTarget(''); setRelSearch(''); setRelType(REL_TYPES[0]); setRelDocType('');
    setRelSection(''); setRelNote(''); setRelActSuggestions([]); setShowRelDrop(false);
    setEditingAuthIdx(null); // collapse any legal authority left open into its saved summary card
  }
  function removeRelation(idx) { setRelations(r => r.filter((_, i) => i !== idx)); }

  // Finalize upload after conflict check
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
    setForm({ act:'',dept:user?.dept||'',type:'',version:'1.0',desc:'',enactmentDate:'',parentAct:'',changeTypes:[] });
    setHierarchy({ act:'', actId: null, chapter:'',section:'',subsection:'' });
    setAmendmentProvisions([]); setParentActSearch(''); setTypeFields({});
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
      || (form.type === 'Rules & Regulations' && hierarchy.act
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
        // Step 1: upload the file to get a file_ref
        let fileRef = null;
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

        // Step 2: save metadata
        setUploadStep('saving');
        try {
          const payload = {
            file_ref:              fileRef,
            document_type_id:      typeObj?.id ?? null,
            document_name:         form.act || f.name.replace(/\.(pdf|zip)$/i, ''),
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
        title:         apiDoc?.document_name || form.act || f.name.replace(/\.(pdf|zip)$/i, ''),
        type:          typeObj?.name || form.type || 'Act',
        dept:          user?.dept || form.dept || 'General Administration',
        year:          form.enactmentDate ? new Date(form.enactmentDate).getFullYear() : new Date().getFullYear(),
        status:        'pending',
        legalStatus:   'active',
        pages:         f.name.endsWith('.zip') ? null : (numPages || 1),
        uploader:      user?.name || 'Uploader',
        uploadedAt:    new Date().toISOString().split('T')[0],
        section:       '1', paragraph: '1',
        version:       apiDoc?.version_no || form.version || '1.0',
        desc:          form.desc || '',
        ocrStatus:     f.name.endsWith('.zip') ? 'queued' : 'processing',
        fileName:      f.name,
        isZip:         f.name.endsWith('.zip'),
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
          {/* Card header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>My Uploads</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
              {`${filtered.length} document${filtered.length !== 1 ? 's' : ''}`}
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

          {/* Search + type filter buttons */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', flex: 1, maxWidth: 300 }}>
                <Search size={13} color="var(--text-color-secondary)" />
                <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search by title…"
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
                {tableSearch && <button onClick={() => setTableSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
              </div>
              {filterStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 20, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', fontSize: 12.5, fontWeight: 600, color: '#16a34a', whiteSpace: 'nowrap' }}>
                  {{ all: 'All Uploads', approved: 'Approved', pending: 'Pending Review', rejected: 'Rejected' }[filterStatus]}
                  <button onClick={() => setFilterStatus('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#16a34a', display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
                </div>
              )}
            </div>
            {/* Type filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(type => {
                const count  = uploads.filter(d => d.type === type).length;
                const active = filterType === type;
                const c = TYPE_CARD_COLORS[type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                return (
                  <button key={type} type="button"
                    onClick={() => setFilterType(active ? '' : type)}
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
              {filterType && (
                <button type="button" onClick={() => setFilterType('')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--surface-border)', color: 'var(--text-color-secondary)' }}>
                  <X size={10} /> Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                {bulkSelectMode && <col style={{ width: '3%' }} />}
                <col style={{ width: bulkSelectMode ? '32%' : '36%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: bulkSelectMode ? '9%' : '8%' }} />
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
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="status" label="Status" /></th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}><SortBtn col="uploadedAt" label="Uploaded On" /></th>
                  <th style={{ ...LABEL, padding: '10px 14px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '52px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>No documents found.</td></tr>
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
                    <td style={{ padding: '12px 14px' }}><Badge label={doc.status} variant={doc.status} /></td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.uploadedAt}</td>
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

  // Upload page
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

      {/* ── Unified single-page upload layout ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Type selector + File drop zone ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Hidden file input */}
          <input ref={inputRef} type="file" accept=".pdf,.zip" multiple style={{ display: 'none' }}
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
                <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', marginBottom: 14 }}>or click to browse · PDF or ZIP · up to 50 MB</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--primary)', background: 'rgba(26,86,219,.08)', border: '1px solid rgba(26,86,219,.2)', padding: '3px 10px', borderRadius: 20 }}>.PDF</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', padding: '3px 10px', borderRadius: 20 }}>.ZIP</span>
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
          {!form.type ? (
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
                <div style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>Select a PDF or ZIP file on the left to fill in document details</div>
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
                {autoFillLoading && <span style={{ marginLeft: 4, fontSize: 11, fontFamily: 'var(--mono)', color: '#3b82f6', fontWeight: 700 }}>⚡ AUTO-FILLING…</span>}
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

            {/* ── All other non-Act, non-Amendment, non-Circular, non-Notification types ── */}
            {!['Act', 'Amendment', 'Circular', 'Notification', 'Order / Gazette', 'Policy', 'Rules & Regulations'].includes(form.type) && (<>
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
              <div style={{ ...LABEL, marginBottom: 6 }}>Description / Remarks</div>
              <textarea value={form.desc} onChange={e => fmt('desc', e.target.value)} rows={2}
                placeholder="Brief description or upload remarks…"
                style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--surface-border)' }}>
            <button type="button"
              onClick={() => { setForm({ act:'',dept:user?.dept||'',type:'',version:'1.0',desc:'',enactmentDate:'',parentAct:'',changeTypes:[] }); setFiles([]); setFileRefs([]); setRelations([]); setAnalysisResults([]); setHierarchy({ act:'',chapter:'',section:'',subsection:'' }); setCrossDeptNotifs([]); setAmendmentProvisions([]); setParentActSearch(''); setRelNote(''); setTypeFields({}); setUploadStep(null); setUploadError(''); }}
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
      : ['Circular', 'Notification', 'Order / Gazette'].includes(form.type) ? 'Legal Authority'
      : ['Policy', 'Rules & Regulations'].includes(form.type) ? 'Act Reference'
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
                  {/* Act Name / Parent Act Name — hidden for Circular/Notification/Order/Policy (captured inside dynamic list) */}
                  {!['Circular', 'Notification', 'Order / Gazette', 'Policy'].includes(form.type) && (
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
                  {['Circular', 'Notification', 'Order / Gazette', 'Policy'].includes(form.type) && (<>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...LABEL }}>Legal Authorities</span>
                      <button type="button"
                        onClick={() => setLegalAuthorities(p => [...p, { act: '', sections: [''] }])}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Plus size={12} /> Add Another
                      </button>
                    </div>
                    {legalAuthorities.map((auth, i) => {
                      const isSaved = auth.act && editingAuthIdx !== i;

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
                              onChange={e => { setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, act: e.target.value } : r)); fetchDocSuggestions('Act', e.target.value); }}
                              onFocus={e => { focusStyle(e); setShowAuthDrop(i); if (auth.act) fetchDocSuggestions('Act', auth.act); }}
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
                      </div>
                      );
                    })}
                  </>)}


                  {/* Act / Rules & Regulations: Act name + Chapter/Section/Sub-section with dropdowns */}
                  {!['Circular', 'Notification', 'Policy', 'Order / Gazette', 'Amendment'].includes(form.type) && (<>
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
                          value={relSearch || (relTarget.startsWith('__act__:') ? relTarget.split(':').slice(2).join(':') : (documents.find(d => d.uid === relTarget)?.title || ''))}
                          onChange={e => {
                            setRelSearch(e.target.value); setRelTarget(''); setShowRelDrop(true);
                            if (relDocType === 'Act') fetchRelActSuggestions(e.target.value);
                          }}
                          onFocus={() => { setShowRelDrop(true); if (relDocType === 'Act' && relSearch) fetchRelActSuggestions(relSearch); }}
                          onBlur={() => setTimeout(() => setShowRelDrop(false), 150)}
                          placeholder={!relDocType ? 'Select a Target Document Type first…' : relDocType === 'Act' ? 'Search Acts…' : 'Search existing document to link…'}
                          style={{ ...INPUT_BASE, width: '100%', ...(!relDocType ? { background: 'var(--surface-100)', cursor: 'not-allowed', color: 'var(--text-color-secondary)' } : {}) }}
                          onFocus={focusStyle} onBlur={blurStyle}
                        />
                        {relDocType === 'Act' && relActSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                        {relDocType && showRelDrop && relSearch.trim() && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.15)', zIndex: 50, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                            {relDocType === 'Act' ? (
                              relActSuggestions.length > 0 ? relActSuggestions.map(a => (
                                <div key={a.id} onMouseDown={() => { setRelTarget(`__act__:${a.id}:${a.document_name}`); setRelSearch(''); setShowRelDrop(false); }}
                                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', fontSize: 12.5, transition: 'background .15s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{a.document_name}</div>
                                  {a.reference_number && <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>{a.reference_number}</div>}
                                </div>
                              )) : (
                                <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-color-secondary)' }}>
                                  {relActSearching ? 'Searching…' : 'No matching Acts found'}
                                </div>
                              )
                            ) : (
                              relFiltered.length > 0 ? relFiltered.map(d => (
                              <div key={d.uid} onMouseDown={() => { setRelTarget(d.uid); setRelSearch(''); setShowRelDrop(false); }}
                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--surface-border)', fontSize: 12.5, transition: 'background .15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{d.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>{d.year} · {d.dept}</div>
                              </div>
                            )) : (
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
                            )
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