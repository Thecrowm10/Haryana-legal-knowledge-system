import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, FileText, CheckCircle, XCircle, X, TrendingUp, FileType, Download, Clock,
  RotateCcw, AlertCircle, Eye, GitBranch, Plus, FolderPlus,
  Layers, ChevronRight, ChevronDown, AlertTriangle, CheckSquare, Square,
  Edit3, Tag, Search, MessageSquare, MessageCircle, ZoomIn, ZoomOut, RotateCw, ExternalLink,
  Save, ArrowRight, Paperclip,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
import mammoth from 'mammoth';
import Card from '../components/ui/Card';
import SelectField from '../components/ui/SelectField';
import { useAuth } from '../hooks/useAuth';
import { getDepartments, getDocumentTypes } from '../services/departments';
import { uploadPdfFile, uploadPdfMetadata, updatePdfMetadata, getMyDocuments, searchDocuments, getPdfFile, checkDuplicateDocument, linkDocumentToDepartment, getLinkedDocuments, getActChildren, getMyDepartmentActs, getMyDepartmentDocsByType, replaceDocumentFile } from '../services/pdf';
import { uploadActPartFile, saveActPartSections, saveActPartEntries, getActPartSections, getActPartEntries, getActPartFile, getActPartApprovals, submitActPartForApproval } from '../services/act_parts';
import { createNotification } from '../services/notifications';
import HindiKeyboardInput from '../components/HindiKeyboardInput';
import { TYPE_SPECIFIC_FIELD_KEYS } from '../constants/docTypeFields';

// Constants

const DEFAULT_DEPTS = [
  'Urban Local Bodies','Revenue & Disaster Mgmt.','Home Department',
  'Industries & Commerce','Labour Department','Finance Department',
  'Health & Family Welfare','Agriculture & Farmers Welfare',
  'Panchayati Raj','General Administration',
];
const DEFAULT_TYPES = ['Act','Amendment','Notification','Circular','Policy','Rules & Regulations','Order/Gazette','Bye Laws','Miscellaneous'];
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
  'Order/Gazette':     ['Issued Under', 'Amends', 'Amended by', 'Replaces', 'Replaced by', 'In Continuation of', 'Continued by', 'Implements', 'Implemented by', 'References'],
  'Rules & Regulations': ['Amends', 'Amended by', 'Replaces', 'Replaced by', 'Issued Under', 'References', 'Referenced by'],
  'Bye Laws':            ['Amends', 'Amended by', 'Replaces', 'Replaced by', 'Issued Under', 'References', 'Referenced by'],
  'Miscellaneous':       ['Issued Under', 'In Continuation of', 'Continued by', 'Replaces', 'Replaced by', 'References', 'Referenced by', 'Supplemented by'],
};

const REL_TARGET_TYPES = {
  'Act':                 ['Act', 'Amendment', 'Rules & Regulations', 'Notification', 'Bye Laws'],
  'Amendment':           ['Act', 'Rules & Regulations', 'Amendment', 'Bye Laws'],
  'Circular':            ['Circular', 'Act', 'Order/Gazette', 'Policy', 'Notification', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
  'Notification':        ['Act', 'Rules & Regulations', 'Order/Gazette', 'Notification', 'Circular', 'Policy', 'Bye Laws', 'Miscellaneous'],
  'Policy':              ['Act', 'Policy', 'Notification', 'Order/Gazette', 'Circular', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
  'Order/Gazette':     ['Act', 'Order/Gazette', 'Notification', 'Rules & Regulations', 'Policy', 'Bye Laws', 'Miscellaneous'],
  'Rules & Regulations': ['Act', 'Rules & Regulations', 'Amendment', 'Notification', 'Policy', 'Bye Laws'],
  'Bye Laws':            ['Act', 'Bye Laws', 'Rules & Regulations', 'Amendment', 'Notification', 'Policy'],
  'Miscellaneous':       ['Circular', 'Act', 'Order/Gazette', 'Policy', 'Notification', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'],
};

const AMEND_CHANGE_TYPES = ['Amended', 'Substituted', 'Inserted', 'Deleted', 'Expanded'];

// Display-only lookup maps: map the internal English enum values (used in comparisons,
// object keys, and API payloads — never changed) to safe i18n key suffixes used purely
// to look up the translated label via t(). The underlying English strings above stay untouched.
const DOC_TYPE_KEY = {
  'Act': 'act', 'Amendment': 'amendment', 'Notification': 'notification', 'Circular': 'circular',
  'Policy': 'policy', 'Rules & Regulations': 'rulesRegulations', 'Order/Gazette': 'orderGazette',
  'Bye Laws': 'byeLaws', 'Miscellaneous': 'miscellaneous',
};
const REL_TYPE_KEY = {
  'Replaces': 'replaces', 'Replaced by': 'replacedBy', 'Amends': 'amends', 'Amended by': 'amendedBy',
  'In Continuation of': 'inContinuationOf', 'Continued by': 'continuedBy', 'Issued Under': 'issuedUnder',
  'Implements': 'implements', 'Implemented by': 'implementedBy', 'References': 'references',
  'Referenced by': 'referencedBy', 'Notified under': 'notifiedUnder', 'Supplemented by': 'supplementedBy',
  'Related to': 'relatedTo',
};
const AMEND_CHANGE_KEY = {
  'Amended': 'amended', 'Substituted': 'substituted', 'Inserted': 'inserted', 'Deleted': 'deleted', 'Expanded': 'expanded',
};

// Type card colours and descriptions
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
const TYPE_CARD_DESC = {
  'Act':                 'Primary legislation enacted by legislature',
  'Amendment':           'Modification to an existing Act or Rule',
  'Notification':        'Official government notice or announcement',
  'Circular':            'Internal directive or instruction',
  'Policy':              'Government policy document or framework',
  'Rules & Regulations': 'Subsidiary legislation under an Act',
  'Order/Gazette':     'Executive order or gazette notification',
  'Bye Laws':            'Local body regulations under municipal or panchayat law',
  'Miscellaneous':       'Other official documents not covered above',
};

// "Add Documents" tabs — the supporting parts of an Act that get attached separately from the
// Act itself (Sections/Schedule/Annexure/Appendix/Forms). Colors reuse the same accent language
// as TYPE_CARD_COLORS above so this page reads as part of the same design system.
const SUBDOC_TABS = [
  { key: 'sections', labelKey: 'addDocuments.tabs.sections', descKey: 'addDocuments.tabDesc.sections', accent: '#214aab', bg: 'rgba(33, 74, 171,.08)', text: '#1e40af' },
  { key: 'schedules', labelKey: 'addDocuments.tabs.schedule', descKey: 'addDocuments.tabDesc.schedule', accent: '#0ea5e9', bg: 'rgba(14,165,233,.08)', text: '#0369a1' },
  { key: 'annexures', labelKey: 'addDocuments.tabs.annexure', descKey: 'addDocuments.tabDesc.annexure', accent: '#198754', bg: 'rgba(25, 135, 84,.08)', text: '#16a34a' },
  { key: 'appendices', labelKey: 'addDocuments.tabs.appendix', descKey: 'addDocuments.tabDesc.appendix', accent: '#ffc107', bg: 'rgba(255, 193, 7,.08)', text: '#d97706' },
  { key: 'forms',    labelKey: 'addDocuments.tabs.forms',    descKey: 'addDocuments.tabDesc.forms',    accent: '#8b5cf6', bg: 'rgba(139,92,246,.08)', text: '#7c3aed' },
];

// The save-entries endpoints are dedicated routes using the plural SUBDOC_TABS keys above
// (/schedules, /annexures, /appendices), but the submit-for-approval route
// (/act-parts/{id}/{part_type}/submit) and the approvals list identify a part by the
// singular form instead — this bridges the two so the right string reaches each endpoint.
const PART_TYPE_FOR_API = { sections: 'sections', schedules: 'schedule', annexures: 'annexure', appendices: 'appendix', forms: 'forms' };
const TAB_FOR_PART_TYPE = Object.fromEntries(Object.entries(PART_TYPE_FOR_API).map(([tab, pt]) => [pt, tab]));

// Per-type metadata fields
const TYPE_FIELDS = {
  'Act': [], // handled inline in form
  'Amendment': [], // handled inline
  'Notification': [], // handled inline
  'Circular': [], // handled inline
  'Policy': [], // handled inline
  'Rules & Regulations': [], // handled inline
  'Order/Gazette': [], // handled inline
  'Bye Laws': [], // handled inline
  'Miscellaneous': [], // handled inline
};

// Mobile reflow — overrides the inline desktop styles via className + !important, same
// technique as CitizenDashboard's <style> block. Mounted once per top-level return (the
// component has three) since modals/sections are reused across all of them.
const UD_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .ud-docview-grid { grid-template-columns: 1fr !important; grid-auto-rows: min-content !important; overflow-y: auto !important; }
    .ud-docview-preview { max-height: 60vh !important; }
  }
  @media (max-width: 640px) {
    .ud-welcome-title { font-size: 18px !important; }
    .ud-grid-2, .ud-grid-3 { grid-template-columns: 1fr !important; }
    .ud-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
    .ud-search-row { flex-direction: column !important; align-items: stretch !important; }
    .ud-search-box { max-width: none !important; width: 100% !important; }
    .ud-sort-row { margin-left: 0 !important; }
    .ud-docview-topbar { padding: 10px 14px !important; gap: 8px !important; }
    .ud-editlist-refno, .ud-editlist-version { display: none !important; }
    .ud-editlist-table { font-size: 12px !important; }
    .ud-editlist-table th, .ud-editlist-table td { padding: 6px 8px !important; }
    .ud-dropzone { padding: 40px 16px !important; }
    .ud-drawer-body { padding: 16px !important; }
  }
`;

// Below this width the uploads/linked-docs list switches from a fixed-column grid row to a
// stacked card — a DOM-shape change, not just a style override, so it can't be done via CSS alone.
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    function update() { setIsMobile(window.innerWidth <= breakpoint); }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);
  return isMobile;
}

// camelCase field key → Title Case label, e.g. 'noOfRules' → 'No Of Rules'
function fieldLabel(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// Extra type-specific fields shown in the Edit Document form, per document type.
// Keys mirror the typeFields naming already used by mapApiDoc/DocViewModal —
// canonical definition lives in constants/docTypeFields.js so the viewers
// (DocViewModal, ApproverDashboard) always list the same fields as this form.
const EDIT_TYPE_FIELD_KEYS = TYPE_SPECIFIC_FIELD_KEYS;

// Workflow statuses: DRAFT → PENDING_REVIEW → PUBLISHED
const WORKFLOW_STATUS = { DRAFT: 'draft', PENDING: 'pending', PUBLISHED: 'published' };

const LABEL = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)',
  letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)',
};
const INPUT_BASE = {
  background: 'var(--surface-ground)', border: '1px solid var(--surface-border)',
  borderRadius: 8, color: 'var(--text-color)', fontFamily: 'var(--font)',
  fontSize: 13, padding: '8px 12px', outline: 'none', width: '100%',
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
// Chapter headings in Acts conventionally use Roman numerals (Chapter I, II, III…), unlike
// sections which stay plain numbers.
const ROMAN_VALUES = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
function toRoman(num) {
  let n = num, out = '';
  for (const [v, s] of ROMAN_VALUES) { while (n >= v) { out += s; n -= v; } }
  return out || String(num);
}
function fromRoman(str) {
  if (!str) return 0;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  const s = str.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]] || 0;
    const next = map[s[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result || 0;
}
// Produces a stable, comparable snapshot of the sections form — used to detect whether the
// user has actually changed anything since the last load/save so the Save button can be disabled
// when re-submitting would just resend an identical payload. `id`/`status` are left out on purpose:
// they're server-assigned and don't reflect user edits.
function sectionFileKey(sec) {
  return sec.file ? `new:${sec.file.name}:${sec.file.size}` : (sec.existingFileRef || null);
}
function sectionsSignature(hasChapters, chapters, flatSections) {
  if (hasChapters === true) {
    return JSON.stringify({
      hasChapters: true,
      chapters: (chapters || []).map(ch => ({
        name: ch.name || '', isDeleted: !!ch.isDeleted,
        sections: (ch.sections || []).map(s => ({ name: s.name || '', description: s.description || '', isDeleted: !!s.isDeleted, file: sectionFileKey(s) })),
      })),
    });
  }
  if (hasChapters === false) {
    return JSON.stringify({
      hasChapters: false,
      flat_sections: (flatSections || []).map(s => ({ name: s.name || '', description: s.description || '', isDeleted: !!s.isDeleted, file: sectionFileKey(s) })),
    });
  }
  return JSON.stringify({ hasChapters: null });
}
// Same idea as sectionsSignature, for the flat entry lists (schedule/annexure/appendix/forms).
function entriesSignature(entries) {
  return JSON.stringify((entries || []).map(e => ({ title: e.title || '', description: e.description || '', isDeleted: !!e.isDeleted, file: sectionFileKey(e) })));
}

function extractTypeChildren(data, type) {
  if (!data) return [];
  const matchesType = d => [d.document_type, d.type, d.document_type_name].includes(type);
  const byKey = (obj, key) => {
    if (Array.isArray(obj[key])) return obj[key];
    const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return found ? obj[found] : undefined;
  };

  if (data.children && typeof data.children === 'object') {
    return byKey(data.children, type) || [];
  }

  const items = Array.isArray(data) ? data
    : Array.isArray(data.results) ? data.results
    : Array.isArray(data.documents) ? data.documents
    : null;
  if (items) {
    if (items.some(d => d && Array.isArray(d.documents))) {
      const group = items.find(matchesType);
      return group?.documents || [];
    }
    return items.filter(matchesType);
  }
  if (typeof data === 'object') {
    const direct = byKey(data, type);
    if (direct) return direct;
    if (Array.isArray(data.groups)) {
      const group = data.groups.find(matchesType);
      return group?.documents || [];
    }
  }
  return [];
}
// DBIM 7.1.3.3 recommends PDF-only uploads, but the department explicitly requires
// Word support too — PDF + DOC/DOCX are accepted, everything else is rejected.
function isAccepted(f) {
  return (
    f.type === 'application/pdf' || f.name.endsWith('.pdf') ||
    /\.docx?$/i.test(f.name) ||
    f.type === 'application/msword' ||
    f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}
// DBIM 6.1.1 / Table 6 upload size ceiling — the guideline's own tiers are photo-oriented
// (banner/thumbnail/high-res), so the closest fit for a document upload is its "high-res" cap.
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
function isUnderSizeLimit(f) {
  return f.size <= MAX_UPLOAD_SIZE_BYTES;
}
function focusStyle(e) {
  e.target.style.borderColor = 'var(--primary)';
  e.target.style.boxShadow   = '0 0 0 3px rgba(33, 74, 171,.1)';
}
function blurStyle(e) {
  e.target.style.borderColor = 'var(--surface-border)';
  e.target.style.boxShadow   = 'none';
}

function HierarchyTag({ hierarchy, onOpen, isRef, legalAuthorities }) {
  const { t } = useTranslation('uploader');
  const hasValues = hierarchy?.act || hierarchy?.chapter || hierarchy?.section;
  const authCount = legalAuthorities ? legalAuthorities.filter(a => a.act).length : 0;

  if (isRef && legalAuthorities !== undefined) {
    return (
      <button type="button" onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: authCount > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', width: '100%', textAlign: 'left' }}>
        <Layers size={13} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {authCount > 0
            ? t('hierarchyTag.legalAuthoritiesAdded', { count: authCount })
            : t('hierarchyTag.setLegalAuthority')}
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
          : (isRef ? t('hierarchyTag.setActReference') : t('hierarchyTag.setHierarchicalTags'))}
      </span>
      <ChevronRight size={12} style={{ flexShrink: 0 }} />
    </button>
  );
}
function VersionConflictModal({ existingDoc, newVersion, onUploadAsNew, onCancel }) {
  const { t } = useTranslation('uploader');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255, 193, 7,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('versionConflict.title')}</div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(255, 193, 7,.06)', border: '1px solid rgba(255, 193, 7,.2)', marginBottom: 18 }}>
          <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-heading)', fontWeight: 600, marginBottom: 4 }}>
            {t('versionConflict.alreadyExists', { title: existingDoc.title })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>
            {t('versionConflict.currentVersion', { version: existingDoc.version || '1.0', uploadedAt: existingDoc.uploadedAt })}
          </div>
        </div>
        <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginBottom: 18 }}>
          {t('versionConflict.isNewVersion')}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            {t('common.cancel')}
          </button>
          <button onClick={() => onUploadAsNew(newVersion)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            {t('versionConflict.uploadAsVersion', { version: newVersion })}
          </button>
        </div>
      </div>
    </div>
  );
}
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const accent  = isError ? '#dc3545' : '#16a34a';
  const bg      = isError ? 'rgba(220, 53, 69,.08)'  : 'rgba(25, 135, 84,.08)';
  const Icon    = isError ? XCircle : CheckCircle;
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 16px', borderRadius: 10, background: 'var(--surface-card)', border: `1px solid ${accent}44`, boxShadow: '0 12px 32px rgba(0,0,0,.18)', maxWidth: 380, animation: 'fadeSlideIn .25s ease' }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={accent} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-color)', lineHeight: 1.5, flex: 1, paddingTop: 3 }}>{toast.message}</span>
      <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0, padding: 3 }}>
        <X size={13} />
      </button>
    </div>
  );
}

function DocViewModal({ doc, onClose }) {
  const { t } = useTranslation('uploader');
  const [blobUrl, setBlobUrl]         = useState(null);
  const [pdfDoc, setPdfDoc]           = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [zoom, setZoom]               = useState(100);
  const [rotation, setRotation]       = useState(0);
  const [docxHtml, setDocxHtml]       = useState(null);
  const canvasRefs    = useRef([]);
  const containerRef  = useRef(null);
  const suppressRef   = useRef(false);
  const svgRefs       = useRef([]);
  const docxViewRef   = useRef(null);
  const annotationsJson = doc.approval?.annotations_json;
  const annotations = useMemo(() => {
    try { return annotationsJson ? JSON.parse(annotationsJson) : []; }
    catch { return []; }
  }, [annotationsJson]);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    // doc.id never actually changes on an already-mounted instance — every call site
    // gates this component behind `cond && <DocViewModal .../>`, so a new document
    // always means a fresh mount and these useState initial values already apply.
    let url = null;
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

  const LS = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };

  // Always show every common field — blank (not hidden) when the uploader
  // left it empty, so the full shape of what could have been filled in is visible.
  const meta = [
    [t('common.referenceNo'),      doc.referenceNumber || ''],
    [t('common.issueDate'),        doc.enactmentDate   || ''],
    [t('common.effectiveFrom'),    doc.effectiveFrom   || ''],
    [t('docViewModal.gazetteRef'), doc.gazette         || ''],
    [t('docViewModal.legalAuthority'), doc.authority   || ''],
    [t('docViewModal.uploader'),   doc.uploader        || ''],
    [t('docViewModal.uploadDate'), doc.uploadedAt      || ''],
    [t('docViewModal.file'),       doc.fileName        || ''],
  ];

  // Fields already shown in meta — exclude from typeExtra to avoid duplication
  const TYPEEXTRA_SKIP = new Set([
    'effectiveFrom', 'commencementDate',
    'gazetteRef',
    'actNumber', 'amendmentNumber', 'circularNumber',
    'notificationNumber', 'orderNumber', 'policyNumber', 'ruleNumber',
  ]);
  // Always show every field that belongs to this document's own type (blank
  // if not filled in) — never fields that belong to a different type.
  const typeExtra = (TYPE_SPECIFIC_FIELD_KEYS[doc.type] || [])
    .filter(({ key }) => !TYPEEXTRA_SKIP.has(key))
    .map(({ key }) => [key, doc.typeFields?.[key] || '']);

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

      {/* ── Top bar ── */}
      <div className="ud-docview-topbar" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-50)', flexShrink: 0, minHeight: 64 }}>
        {/* Doc icon */}
        <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={18} color={typeColor.accent} />
        </div>
        {/* Title + breadcrumb */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{doc.title}</div>
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
            {doc.status === 'approved' ? t('common.statusApproved') : doc.status === 'rejected' ? t('common.statusRejected') : t('common.statusPending')}
          </span>
        </div>
        {/* Close */}
        <button onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}>
          <X size={14} /> {t('common.close')}
        </button>
      </div>

      {/* ── 2-panel body ── */}
      <div className="ud-docview-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '57% 43%', overflow: 'hidden' }}>

        {/* ── Left: PDF viewer ── */}
        <div className="ud-docview-preview" style={{ borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#3a3d40' }}>

          {/* PDF toolbar */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#2d2f31', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <Eye size={14} color="rgba(255,255,255,.7)" />
            <span style={{ fontSize: 'var(--font-size-small)', fontWeight: 600, color: 'rgba(255,255,255,.85)', flex: 1 }}>{docxHtml ? t('docViewModal.documentPreview') : t('docViewModal.originalPdf')}</span>

            {/* Zoom controls */}
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

            {/* Rotate */}
            {!docxHtml && (
              <button onClick={() => setRotation(r => (r + 90) % 360)}
                style={iconBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'}>
                <RotateCw size={14} />
              </button>
            )}

            {/* Open externally */}
            {blobUrl && !docxHtml && (
              <a href={blobUrl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(33, 74, 171,.25)', border: '1px solid rgba(33, 74, 171,.4)', color: '#93c5fd', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.4)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.25)'}>
                <ExternalLink size={12} /> {t('docViewModal.open')}
              </a>
            )}
          </div>

          {/* PDF scroll area / DOCX preview */}
          {docxHtml ? (
            <div ref={docxViewRef}
              style={{ flex: 1, overflow: 'auto', background: 'white', padding: '40px 48px', color: '#1a1a1a', lineHeight: 1.8, fontSize: 13 }} />
          ) : (
            <div ref={containerRef} onScroll={handleScroll}
              style={{ flex: 1, overflow: 'auto', background: '#525659', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              {!blobUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14 }}>
                  <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: 'rgba(255,255,255,.8)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.6)', letterSpacing: '.04em' }}>{t('docViewModal.loadingDocument')}</span>
                </div>
              )}
              {blobUrl && Array.from({ length: totalPages }, (_, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas ref={el => { canvasRefs.current[i] = el; }}
                    style={{ display: 'block', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,.6)', maxWidth: '100%' }} />
                  {annotations.some(a => a.page === i + 1) && (
                    <svg ref={el => { svgRefs.current[i] = el; }}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
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

          {/* Page navigation */}
          {!docxHtml && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#2d2f31', flexShrink: 0 }}>
              <button onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage === 1}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === 1 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
                {t('docViewModal.prev')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>{currentPage}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{t('docViewModal.of')}</span>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.55)' }}>{totalPages}</span>
              </div>
              <button onClick={() => scrollToPage(currentPage + 1)} disabled={currentPage === totalPages}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: currentPage === totalPages ? 'transparent' : 'rgba(255,255,255,.07)', color: currentPage === totalPages ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}>
                {t('docViewModal.next')}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Document details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)' }}>

          {/* Right panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-50)', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(33, 74, 171,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} color="var(--primary)" />
            </div>
            <span style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('common.documentDetails')}</span>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 28px' }}>

            {/* Core info strip */}
            <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[
                { label: t('common.type'),       value: doc.type,           color: typeColor.accent, bg: typeColor.bg },
                { label: t('common.department'), value: doc.dept,           color: 'var(--primary)', bg: 'rgba(33, 74, 171,.07)' },
                { label: t('common.year'),       value: String(doc.year),   color: '#64748b',        bg: 'rgba(100,116,139,.08)' },
                { label: t('common.version'),    value: `v${doc.version || '1.0'}`, color: '#64748b', bg: 'rgba(100,116,139,.08)' },
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
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.additionalInfo')}</div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  {meta.map(([k, v], idx) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: idx < meta.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ padding: '10px 14px', width: 128, boxSizing: 'border-box', flexShrink: 0, background: 'var(--surface-50)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>
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

            {/* Type-Specific Fields */}
            {typeExtra.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.typeSpecificFields')}</div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  {typeExtra.map(([k, v], idx) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: idx < typeExtra.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                      <div style={{ padding: '10px 14px', width: 128, boxSizing: 'border-box', flexShrink: 0, background: 'var(--surface-50)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', fontWeight: 600, borderRight: '1px solid var(--surface-border)' }}>
                        {fieldLabel(k)}
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
                <div style={{ ...LS, marginBottom: 10 }}>{t('common.description')}</div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', fontSize: 13, color: 'var(--text-color)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {doc.desc}
                </div>
              </div>
            )}

            {/* Summary */}
            {/* {doc.summary && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.summary')}</div>
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)', fontSize: 13, color: 'var(--text-color)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {doc.summary}
                </div>
              </div>
            )} */}

            {/* Hierarchy Tags */}
            {(doc.hierarchy?.act || doc.hierarchy?.chapter || doc.hierarchy?.section) && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.hierarchyTags')}</div>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)', fontSize: 12, color: 'var(--text-color-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, lineHeight: 1.8 }}>
                  {doc.hierarchy.act && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{doc.hierarchy.act}</span>}
                  {doc.hierarchy.chapter && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.chapter}</span></>)}
                  {doc.hierarchy.section && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.section}</span></>)}
                  {doc.hierarchy.subsection && (<><ChevronRight size={11} color="#94a3b8" style={{ flexShrink: 0 }} /><span>{doc.hierarchy.subsection}</span></>)}
                </div>
              </div>
            )}

            {/* Legal Authorities */}
            {doc.legalAuthorities?.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.legalAuthorities')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doc.legalAuthorities.map((a, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', marginBottom: a.sections?.some(s => s) ? 4 : 0 }}>{a.act}</div>
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

            {/* Document Relationships */}
            {doc.docRelations?.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.relationships', { count: doc.docRelations.length })}</div>
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
                          {r.label}{r.targetType ? ` · ${r.targetType}` : ''}{r.isPending ? ` · ${t('docViewModal.pendingSuffix')}` : ''}
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

            {/* Amendment Provisions */}
            {doc.amendmentProvisions?.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.amendmentProvisions')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doc.amendmentProvisions.map((p, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255, 193, 7,.06)', border: '1px solid rgba(255, 193, 7,.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: p.before || p.after || p.description ? 6 : 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', color: '#d97706', fontWeight: 700, fontSize: 10.5, background: 'rgba(255, 193, 7,.15)', padding: '2px 7px', borderRadius: 10 }}>{p.changeType || t('docViewModal.amendedDefault')}</span>
                        {p.section && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)' }}>{t('docViewModal.sectionLabel', { section: p.section })}{p.chapter ? ` · ${t('docViewModal.chapterSuffix', { chapter: p.chapter })}` : ''}{p.subsection ? ` (${p.subsection})` : ''}</span>}
                      </div>
                      {p.description && <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5 }}>{p.description}</div>}
                      {p.before && <div style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(220, 53, 69,.05)', padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(220, 53, 69,.4)' }}>{t('docViewModal.before', { value: p.before })}</div>}
                      {p.after  && <div style={{ fontSize: 11, color: '#16a34a', fontFamily: 'var(--mono)', marginTop: 4, background: 'rgba(25, 135, 84,.05)',  padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid rgba(25, 135, 84,.4)' }}>{t('docViewModal.after', { value: p.after })}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parent Act */}
            {doc.parentAct && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ ...LS, marginBottom: 10 }}>{t('docViewModal.parentAct')}</div>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.04)', border: '1px solid rgba(33, 74, 171,.15)', fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                  {doc.parentAct}
                </div>
              </div>
            )}

            {/* Reviewer Remarks */}
            {doc.approval && (
              <div>
                <div style={{ ...LS, marginBottom: 10 }}>{t('common.reviewerRemarks')}</div>
                <div style={{ borderRadius: 12, border: `1px solid ${statusAccent}44`, overflow: 'hidden' }}>
                  {/* Approver header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: doc.status === 'approved' ? 'rgba(25, 135, 84,.06)' : doc.status === 'rejected' ? 'rgba(220, 53, 69,.06)' : 'rgba(255, 193, 7,.06)', borderBottom: doc.approval.comments ? `1px solid ${statusAccent}22` : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StatusIconV size={16} color={statusAccent} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: statusAccent }}>
                        {doc.reviewTitle || (doc.status === 'approved' ? t('docViewModal.documentApproved') : doc.status === 'rejected' ? t('docViewModal.documentRejected') : t('docViewModal.pendingReview'))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                        {t('common.byName', { name: doc.approval.approver_first_name
                          ? `${doc.approval.approver_first_name} ${doc.approval.approver_last_name || ''}`.trim()
                          : doc.approval.approver_username || '—' })}
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

            {/* Highlights from reviewer */}
            {annotations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...LS, marginBottom: 8 }}>{t('docViewModal.highlights', { count: annotations.length })}</div>
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
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.75)', lineHeight: 1.4 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('docViewModal.noComment')}</span>}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'rgba(0,0,0,.5)', flexShrink: 0, marginTop: 2 }}>P{ann.page}</span>
                          <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,.75)', lineHeight: 1.5, flex: 1 }}>{ann.comment || <span style={{ opacity: 0.5 }}>{t('docViewModal.noComment')}</span>}</span>
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

// Main component
export default function UploaderDashboard({ activePage, onNavigate, onAuditLog, documents = [], onAddDocument }) {
  const { user } = useAuth();
  const { t } = useTranslation('uploader');
  const isMobile = useIsMobile();
  const [deptsData, setDeptsData] = useState([]);
  const [typesData, setTypesData] = useState([]);
  const DEPTS = deptsData.length > 0 ? deptsData.filter(d => d.is_active !== false).map(d => d.name) : DEFAULT_DEPTS;
  const TYPES = typesData.length > 0 ? typesData.filter(d => d.is_active !== false).map(d => d.name) : DEFAULT_TYPES;

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
  const [linkedDocs, setLinkedDocs] = useState([]);
  // Replace-file modal: { doc } | null
  const [replaceFileModal,    setReplaceFileModal]    = useState(null);
  const [replaceFileSaving,   setReplaceFileSaving]   = useState(false);
  const [replaceFileResubmit, setReplaceFileResubmit] = useState(false);
  const [replaceFileError,    setReplaceFileError]    = useState('');
  const [replaceFileSelected, setReplaceFileSelected] = useState(null); // File object
  const replaceFileInputRef = useRef(null);

  const mapApiDoc = useCallback((d) => {
    // Amendment provisions ride along inside description as a hidden __PROVISIONS__ JSON
    // suffix (see the upload flow below) — strip it back out before displaying the description.
    const rawDesc = d.description || '';
    const provisionsMatch = rawDesc.match(/\n?__PROVISIONS__:(.+)$/s);
    let amendmentProvisions = [];
    if (provisionsMatch) { try { amendmentProvisions = JSON.parse(provisionsMatch[1]); } catch { /* malformed JSON in remarks — keep default */ } }

    return {
      id:              d.id,
      uid:             `api-${d.id}`,
      // Metadata (title/type/dept) can be null for drafts uploaded before the tagging step is completed —
      // fall back to the raw filename so search/sort (which call .toLowerCase() on these) never crash on null.
      title:           d.document_name || d.original_filename || t('common.untitledDocument'),
      type:            d.document_type_name || t('common.unclassified'),
      docTypeId:       d.document_type_id ?? null,
      dept:            d.department_name || t('common.unassigned'),
      year:            d.issue_date ? new Date(d.issue_date).getFullYear() : new Date(d.created_at).getFullYear(),
      status:          d.status || 'pending',
      workflowStatus:  d.status === 'approved' ? WORKFLOW_STATUS.PUBLISHED : d.status === 'rejected' ? WORKFLOW_STATUS.DRAFT : WORKFLOW_STATUS.PENDING,
      version:         d.version_no || '1.0',
      fileName:        d.original_filename,
      fileSize:        d.file_size,
      desc:            rawDesc.replace(/\n?__PROVISIONS__:.+$/s, '').trim(),
      // summary:         d.summary || '',
      amendmentProvisions,
      uploadedAt:      d.created_at?.split('T')[0] || '',
      uploader:        (d.uploader_first_name || d.uploader_last_name)
                          ? `${d.uploader_first_name || ''} ${d.uploader_last_name || ''}`.trim()
                          : (d.uploader_username || ''),
      ocrStatus:       'completed',
      gazette:         d.gazette_reference || '',
      authority:       d.legal_authority || '',
      enactmentDate:   d.issue_date || '',
      effectiveFrom:   d.effective_from || '',
      referenceNumber: d.reference_number || '',
      shortTitle:      d.short_title || '',
      tags:            d.tags || [],
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
      },
      approval:        d.latest_approval || null,
    };
  }, [t]);

  useEffect(() => {
    if (activePage !== 'dashboard') return;
    if (!localStorage.getItem('token')) return;
    setMyDocsLoading(true);
    setMyDocsError('');
    Promise.all([getMyDocuments(), getLinkedDocuments().catch(() => ({ data: [] }))])
      .then(([myRes, linkedRes]) => {
        setUploads((myRes.data.documents || []).map(mapApiDoc));
        setLinkedDocs(Array.isArray(linkedRes.data) ? linkedRes.data : []);
      })
      .catch(err => {
        const detail = err.response?.data?.detail;
        setMyDocsError(typeof detail === 'string' ? detail : t('toasts.failedToLoadDocuments'));
      })
      .finally(() => setMyDocsLoading(false));
  }, [activePage, mapApiDoc, t]);

  // Edit Document page: pick a type → table of that type's docs → edit form for one doc
  const [editType, setEditType]             = useState(null);
  const [editList, setEditList]             = useState([]);
  const [editListLoading, setEditListLoading] = useState(false);
  const [editListError, setEditListError]   = useState('');
  const [viewingEditDoc, setViewingEditDoc] = useState(null); // doc open in DocViewModal (read-only "View")
  const [editingDoc, setEditingDoc]     = useState(null);
  const [editForm, setEditForm]         = useState(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState('');
  const [editFileSelected, setEditFileSelected]   = useState(null);
  const [editFileUploading, setEditFileUploading] = useState(false);
  const [editFileResubmit, setEditFileResubmit]   = useState(false);
  const editFileInputRef = useRef(null);

  // Loads (or reloads) the current type's document table from the API.
  // Shared by the effect below and by saveEditDoc so the table reflects an edit immediately.
  const refreshEditList = useCallback(() => {
    if (!editType) return;
    const typeId = typesData.find(d => d.name === editType)?.id;
    if (!typeId) { setEditList([]); return () => {}; }
    let cancelled = false;
    setEditListLoading(true);
    setEditListError('');
    getMyDepartmentDocsByType(typeId, null, 0, 200)
      .then(res => {
        if (cancelled) return;
        const list = res.data?.documents || res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setEditList(list.map(mapApiDoc));
      })
      .catch(err => {
        if (cancelled) return;
        const detail = err.response?.data?.detail;
        setEditListError(typeof detail === 'string' ? detail : t('toasts.failedToLoadDocuments'));
        setEditList([]);
      })
      .finally(() => { if (!cancelled) setEditListLoading(false); });
    return () => { cancelled = true; };
  }, [editType, typesData, mapApiDoc, t]);

  // Fetch the documents of the chosen type in the uploader's department once a type is picked
  useEffect(() => {
    if (activePage !== 'editdocument' || !editType) return;
    if (!localStorage.getItem('token')) return;
    return refreshEditList();
  }, [activePage, editType, refreshEditList]);

  function openEditDoc(doc) {
    setEditingDoc(doc);
    setEditForm({
      document_name:     doc.title || '',
      reference_number:  doc.referenceNumber || '',
      issue_date:        doc.enactmentDate || '',
      effective_from:    doc.effectiveFrom || '',
      gazette_reference: doc.gazette || '',
      legal_authority:   doc.authority || '',
      short_title:       doc.shortTitle || '',
      version_no:        doc.version || '1.0',
      description:       doc.desc || '',
      typeFields:        { ...(doc.typeFields || {}) },
    });
    setEditError('');
    setEditFileSelected(null);
    setEditFileResubmit(false);
  }

  function closeEditDoc() {
    setEditingDoc(null);
    setEditForm(null);
    setEditError('');
    setEditFileSelected(null);
    setEditFileResubmit(false);
  }

  async function saveEditDoc() {
    if (!editingDoc || !editForm) return;
    setEditSaving(true);
    setEditError('');
    const tf = editForm.typeFields || {};
    const typeId = editingDoc.docTypeId ?? typesData.find(d => d.name === editingDoc.type)?.id ?? null;
    let description = editForm.description;
    try {
      // 1. If a new file was chosen — upload it, replace the stored file, get fresh summary
      if (editFileSelected) {
        setEditFileUploading(true);
        const fd = new FormData();
        fd.append('file', editFileSelected);
        const uploadRes = await uploadPdfFile(fd);
        const { file_ref, summary } = uploadRes.data;
        setEditFileUploading(false);
        if (summary) {
          description = summary;
          setEditForm(f => ({ ...f, description: summary }));
        }
        // Rejected docs are always resubmitted when file is replaced
        const resubmit = editingDoc.status === 'rejected';
        const replaceRes = await replaceDocumentFile(editingDoc.id, file_ref, resubmit);
        const updatedDoc = mapApiDoc(replaceRes.data);
        setUploads(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      }

      // 2. Save metadata (always, even if only file changed — keeps description in sync)
      const payload = {
        document_type_id:      typeId,
        document_name:         editForm.document_name,
        reference_number:      editForm.reference_number,
        issue_date:             editForm.issue_date || null,
        effective_from:         editForm.effective_from || null,
        gazette_reference:      editForm.gazette_reference,
        legal_authority:        editForm.legal_authority,
        short_title:            editForm.short_title,
        version_no:             editForm.version_no || '1.0',
        description,
        valid_until:            tf.validity || null,
        sector_domain:          tf.sector || '',
        implementing_agency:    tf.implementingAgency || '',
        next_review_date:       tf.reviewDate || null,
        rule_making_authority:  tf.ruleAuthority || '',
        act_year:               tf.actYear ? parseInt(tf.actYear, 10) || null : null,
        long_title:             tf.longTitle || '',
        regional_title:         tf.regionalTitle || '',
        notification_no:        tf.notificationNo || '',
        act_code:               tf.actCode || '',
        so_reason:              tf.soReason || '',
        no_of_rules:            tf.noOfRules ? parseInt(tf.noOfRules, 10) || null : null,
        no_of_notifications:    tf.noOfNotifications ? parseInt(tf.noOfNotifications, 10) || null : null,
        no_of_regulations:      tf.noOfRegulations ? parseInt(tf.noOfRegulations, 10) || null : null,
        no_of_circulars:        tf.noOfCirculars ? parseInt(tf.noOfCirculars, 10) || null : null,
        no_of_statutes:         tf.noOfStatutes ? parseInt(tf.noOfStatutes, 10) || null : null,
        no_of_ordinances:       tf.noOfOrdinances ? parseInt(tf.noOfOrdinances, 10) || null : null,
        no_of_orders:           tf.noOfOrders ? parseInt(tf.noOfOrders, 10) || null : null,
        keywords:               tf.keywords || '',
        tag_ids:                [],
      };
      await updatePdfMetadata(editingDoc.id, payload);
      const successMsg = editFileSelected && editingDoc.status === 'rejected'
        ? t('toasts.fileReplacedAndResubmitted')
        : editFileSelected
          ? t('toasts.fileReplaced')
          : t('editDocument.updateSuccess', { name: editForm.document_name });
      showToast('success', successMsg);
      closeEditDoc();
      refreshEditList();
      setMyDocsLoading(true);
      getMyDocuments()
        .then(r => setUploads((r.data.documents || []).map(mapApiDoc)))
        .catch(() => {})
        .finally(() => setMyDocsLoading(false));
    } catch (err) {
      setEditFileUploading(false);
      const detail = err.response?.data?.detail;
      let message = t('editDocument.updateFailed');
      if (typeof detail === 'string') message = detail;
      else if (Array.isArray(detail)) message = detail.map(e => `${(e.loc || []).slice(1).join('.')}: ${e.msg}`).join('; ') || message;
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  }

  const [files, setFiles]           = useState([]);
  const [dragOver, setDragOver]     = useState(false);
  const [subDocTab, setSubDocTab]       = useState('');
  const subDocStructureRef = useRef(null); // scrolled into view once the Parent Act reveals the structure card below
  // Sections tab: parent Act gate (mirrors the Amendment "Parent Act" field), then the
  // has-chapters branch — chapter-wise sections (added one at a time, shown as a tree, like
  // India Code) or flat sections with no chapter.
  // Each SUBDOC_TABS tab (sections/schedules/annexures/appendices/forms) can be tagged to a
  // different Act, so the selected Act is keyed by tab rather than being one shared value —
  // picking an Act on the Schedule tab must not carry over when switching to Annexure.
  const [subDocActByTab, setSubDocActByTab] = useState({});
  const subDocAct = subDocActByTab[subDocTab] || '';
  const [subDocActsList, setSubDocActsList] = useState(null);
  const [subDocActsLoading, setSubDocActsLoading] = useState(false);
  // approvals[partType] = { status, submitted_at, reviewed_at, comments, ... } | undefined
  const [subDocApprovals, setSubDocApprovals] = useState({});
  const [secHasChapters, setSecHasChapters] = useState(null); // null = not answered yet
  const [secChapters, setSecChapters]       = useState([]); // [{ name, sections: [{name,description},...] }]
  const [activeChapterIdx, setActiveChapterIdx] = useState(-1); // -1 = all collapsed (overview); set to index to expand
  const [activeSectionIdx, setActiveSectionIdx] = useState(0); // within the active chapter, only one section is expanded for editing — the rest collapse to a summary
  const [secFlatSections, setSecFlatSections] = useState([]); // [{name,description},...] — used when there are no chapters
  const [activeFlatSectionIdx, setActiveFlatSectionIdx] = useState(0); // same one-open-at-a-time idea, for the flat (no-chapter) list
  const [previewTarget, setPreviewTarget] = useState(null); // null closed | { chapterIdx, sectionIdx } — chapterIdx is null for a flat section; the preview/edit modal is scoped to one section
  // Entry-based data for non-sections tabs: [{ number, title, description, file: File|null, fileRef: null }]
  const [subDocEntries, setSubDocEntries] = useState({});
  const [activeEntryIdx, setActiveEntryIdx] = useState(-1); // -1 = all collapsed (saved entries show as a summary); set to index to expand for editing
  const [entryPreviewIdx, setEntryPreviewIdx] = useState(null); // null closed | index — full-page preview/edit modal for one entry, shown regardless of whether it has a description yet
  const [subDocSaving, setSubDocSaving] = useState(false);
  const [subDocLoadedFor, setSubDocLoadedFor] = useState({ actId: null, tab: null });
  // Snapshot of the sections/entries form taken right after a load or a successful save — the
  // Save button stays disabled until the live form diverges from this, so re-saving an untouched
  // upload isn't possible.
  const [sectionsBaseline, setSectionsBaseline] = useState(() => sectionsSignature(null, [], []));
  const [entriesBaseline, setEntriesBaseline] = useState({}); // { [tab]: signature string }; a missing key falls back to entriesSignature([])
  const [form, setForm]             = useState({ act: '', dept: user?.dept || '', type: '', version: '1.0', desc: '', enactmentDate: '', parentAct: '', changeTypes: [] });
  const [typeFields, setTypeFields]  = useState({});
  const [hierarchy, setHierarchy]   = useState({ act: '', actId: null, chapter: '', section: '', subsection: '' });
  const [rejected, setRejected]     = useState([]);
  const [oversizedFiles, setOversizedFiles] = useState([]); // [{ name, size }] — files rejected for exceeding MAX_UPLOAD_SIZE_BYTES
  const [versionModal, setVersionModal] = useState(null);
  const [conflictModal, setConflictModal] = useState(null); // { existingDoc, pendingDocs, pendingRelations }
  const [duplicateModal, setDuplicateModal] = useState(null); // { matches: DuplicateCheckItem[] }
  const [linkingId, setLinkingId] = useState(null); // pdf_id being linked (loading state)
  const [viewingLinkedDoc, setViewingLinkedDoc] = useState(null); // linked doc open in DocViewModal
  const [viewingActChildDoc, setViewingActChildDoc] = useState(null); // existing-under-this-Act doc open in DocViewModal

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
  const [drawerType,      setDrawerType]      = useState(null); // null | 'hierarchy' | 'relationship'
  const [drawerHierarchy, setDrawerHierarchy] = useState({ act: '', actId: null, chapter: '', section: '', subsection: '' });

  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFields, setBulkFields]     = useState({ dept: '', type: '', year: '' });
  const [fileRefs,    setFileRefs]    = useState([]); // [{ fileName, fileRef, originalFilename, fileSize }]
  const [fileMeta,    setFileMeta]    = useState({}); // { [fileName]: { documentName, desc } }
  const [descPreviewFile, setDescPreviewFile] = useState(null); // fileName being previewed/edited full-screen, or null
  const [uploadStep, setUploadStep]   = useState(null); // null | 'uploading' | 'ready' | 'saving' | 'done' | 'error'
  const [uploadError, setUploadError] = useState('');
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
  const toastTimerRef = useRef(null);
  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const loadActPartSections = useCallback(async (actId) => {
    if (!actId) return;
    try {
      const res = await getActPartSections(actId);
      const data = res.data;

      // Parse "Chapter IV" → 4 (Roman numeral), "Section 3" → 3
      function parseChapterPos(s) {
        const m = (s || '').match(/^Chapter\s+([IVXLCDM]+)$/i);
        return m ? fromRoman(m[1]) : null;
      }
      function parseSectionPos(s) {
        const m = (s || '').match(/^Section\s+(\d+)$/i);
        return m ? parseInt(m[1], 10) : null;
      }

      if (data.chapters?.length > 0) {
        setSecHasChapters(true);
        setActiveChapterIdx(-1);

        const apiChapters = data.chapters;
        // Highest ordinal present (e.g. Chapter III → 3); fall back to count if unparseable
        const maxChapterPos = Math.max(...apiChapters.map(ch => parseChapterPos(ch.chapter_number) || 0), apiChapters.length);

        const chapterArray = [];
        for (let i = 1; i <= maxChapterPos; i++) {
          const chNum = `Chapter ${toRoman(i)}`;
          const found = apiChapters.find(ch => ch.chapter_number === chNum);
          if (found) {
            const apiSecs = found.sections || [];
            const maxSecPos = Math.max(...apiSecs.map(s => parseSectionPos(s.section_number) || 0), apiSecs.length);
            const sectionsArray = [];
            for (let j = 1; j <= maxSecPos; j++) {
              const sf = apiSecs.find(s => s.section_number === `Section ${j}`);
              if (sf) {
                sectionsArray.push({ id: sf.id ?? null, name: sf.section_title || sf.section_number || '', description: sf.section_content || '', file: null, fileRef: null, existingFilename: sf.original_filename || null, existingFileRef: sf.file_ref || null, isDeleted: false, status: sf.status || 'draft' });
              } else {
                sectionsArray.push({ id: null, name: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: true, status: 'draft' });
              }
            }
            chapterArray.push({ id: found.id ?? null, name: found.chapter_title || found.chapter_number || '', isDeleted: false, sections: sectionsArray, status: found.status || 'draft' });
          } else {
            // Gap — chapter was soft-deleted; leave placeholder slot
            chapterArray.push({ id: null, name: '', isDeleted: true, sections: [] });
          }
        }

        setSecChapters(chapterArray);
        setSecFlatSections([]);
        setSectionsBaseline(sectionsSignature(true, chapterArray, []));
      } else if (data.flat_sections?.length > 0) {
        setSecHasChapters(false);

        const apiFlat = data.flat_sections;
        const maxSecPos = Math.max(...apiFlat.map(s => parseSectionPos(s.section_number) || 0), apiFlat.length);
        const flatArray = [];
        for (let i = 1; i <= maxSecPos; i++) {
          const sf = apiFlat.find(s => s.section_number === `Section ${i}`);
          if (sf) {
            flatArray.push({ id: sf.id ?? null, name: sf.section_title || sf.section_number || '', description: sf.section_content || '', file: null, fileRef: null, existingFilename: sf.original_filename || null, existingFileRef: sf.file_ref || null, isDeleted: false, status: sf.status || 'draft' });
          } else {
            flatArray.push({ id: null, name: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: true, status: 'draft' });
          }
        }

        setSecFlatSections(flatArray);
        setSecChapters([]);
        setSectionsBaseline(sectionsSignature(false, [], flatArray));
      } else {
        // empty response → keep state null so user chooses structure
        setSectionsBaseline(sectionsSignature(null, [], []));
      }
    } catch { /* ignore — user will see an empty form */ }
  }, []);

  const loadActPartEntries = useCallback(async (actId, tab) => {
    if (!actId || !tab) return;
    try {
      const res = await getActPartEntries(actId, tab);
      const rows = res.data || [];
      const ENTRY_SINGULAR = { schedules: 'Schedule', annexures: 'Annexure', appendices: 'Appendix', forms: 'Form' };
      const label = ENTRY_SINGULAR[tab] || tab;
      function parseEntryPos(s) {
        if (!label) return null;
        const m = (s || '').match(new RegExp(`^${label}\\s+(\\d+)$`, 'i'));
        return m ? parseInt(m[1], 10) : null;
      }
      const maxPos = Math.max(...rows.map(r => parseEntryPos(r.entry_number) || 0), rows.length);
      const entryArray = [];
      for (let i = 1; i <= maxPos; i++) {
        const found = rows.find(r => r.entry_number === `${label} ${i}`);
        if (found) {
          entryArray.push({ id: found.id ?? null, number: found.entry_number || '', title: found.title || '', description: found.description || '', file: null, fileRef: null, existingFilename: found.original_filename || null, existingFileRef: found.file_ref || null, isDeleted: false, status: found.status || 'draft' });
        } else {
          entryArray.push({ id: null, number: '', title: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: true, status: 'draft' });
        }
      }
      setSubDocEntries(prev => ({ ...prev, [tab]: entryArray }));
      setEntriesBaseline(prev => ({ ...prev, [tab]: entriesSignature(entryArray) }));
    } catch { /* ignore */ }
  }, []);

  const loadActPartApprovals = useCallback(async (actId) => {
    if (!actId) return;
    try {
      const res = await getActPartApprovals(actId);
      const map = {};
      (res.data || []).forEach(a => { map[TAB_FOR_PART_TYPE[a.part_type] || a.part_type] = a; });
      setSubDocApprovals(map);
    } catch { /* ignore */ }
  }, []);

  // Table filter + sort
  const [tableSearch, setTableSearch] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [sortCol,     setSortCol]     = useState('uploadedAt');
  const [sortDir,     setSortDir]     = useState('desc');

  // Full reset of the upload wizard back to its starting (no type chosen) state.
  function resetUploadForm() {
    setForm({ act: '', dept: user?.dept || '', type: '', version: '1.0', desc: '', enactmentDate: '', parentAct: '', changeTypes: [] });
    setFiles([]); setFileRefs([]); setFileMeta({});
    setRelations([]);
    setHierarchy({ act: '', chapter: '', section: '', subsection: '' });
    setLegalAuthorities([{ act: '', sections: [''] }]);
    setRelNote('');
    setTypeFields({});
    setUploadStep(null);
    setUploadError('');
  }

  // The Upload, Dashboard and Edit tabs reset to their starting state on every fresh
  // visit — navigating there never resumes wherever it was left mid-session. Adjusted
  // during render (React's "you might not need an effect" pattern, also used in
  // Layout.jsx/App.jsx) rather than in an effect, since these are plain resets with
  // no I/O or subscriptions.
  const [prevActivePage, setPrevActivePage] = useState(activePage);
  if (activePage !== prevActivePage) {
    setPrevActivePage(activePage);
    if (activePage === 'upload') resetUploadForm();
    if (activePage === 'dashboard') {
      setTableSearch('');
      setFilterType('');
      setFilterStatus('');
      setSortCol('uploadedAt');
      setSortDir('desc');
      setSelectedIds(new Set());
      setBulkSelectMode(false);
      setBulkEditOpen(false);
      setBulkFields({ dept: '', type: '', year: '' });
    }
    if (activePage === 'editdocument') setEditType(null);
  }

  const inputRef     = useRef();
  const uploadsTableRef = useRef();
  const uploadSectionRef  = useRef(null);
  const detailsSectionRef = useRef(null);
  const allFilesChecked = files.length > 0 && files.every(f => fileRefs.some(r => r.fileName === f.name));
  const typeCompact = files.length > 0;
  // Non-Act types must be linked to a parent Act / legal authority before the rest of the details unlock.
  const usesLegalAuthorities = ['Circular', 'Miscellaneous', 'Notification', 'Order/Gazette', 'Policy'].includes(form.type);
  const actChosen = usesLegalAuthorities ? legalAuthorities.some(a => a.act) : !!hierarchy.act;
  const detailsLocked = !!form.type && form.type !== 'Act' && !actChosen;
  const primaryActId = usesLegalAuthorities ? (legalAuthorities.find(a => a.actId)?.actId ?? null) : (hierarchy.actId ?? null);
  const [actChildren, setActChildren] = useState(null);
  const [actChildrenLoading, setActChildrenLoading] = useState(false);
  const [departmentActs, setDepartmentActs] = useState(null);
  const [departmentActsLoading, setDepartmentActsLoading] = useState(false);

  // Auto-scroll to the next step of the upload wizard as it's revealed
  useEffect(() => {
    if (!form.type) return;
    const raf = requestAnimationFrame(() => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(raf);
  }, [form.type]);

  useEffect(() => {
    if (!allFilesChecked) return;
    const raf = requestAnimationFrame(() => detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(raf);
  }, [allFilesChecked]);

  // Fetch documents already linked to the chosen parent Act, so the uploader can see existing
  // documents of the same type (e.g. all Notifications under this Act) before submitting a new one.
  useEffect(() => {
    if (!primaryActId || form.type === 'Act') return;
    let cancelled = false;
    setActChildrenLoading(true);
    getActChildren(primaryActId)
      .then(res => { if (!cancelled) setActChildren(res.data); })
      .catch(() => { if (!cancelled) setActChildren(null); })
      .finally(() => { if (!cancelled) setActChildrenLoading(false); });
    return () => { cancelled = true; };
  }, [primaryActId, form.type]);

  // Fetch Acts already uploaded in the current user's department, so the uploader can see what
  // already exists before submitting a new Act (helps avoid duplicates).
  useEffect(() => {
    if (form.type !== 'Act') return;
    let cancelled = false;
    setDepartmentActsLoading(true);
    getMyDepartmentActs()
      .then(res => { if (!cancelled) setDepartmentActs(res.data?.documents || res.data?.results || (Array.isArray(res.data) ? res.data : [])); })
      .catch(() => { if (!cancelled) setDepartmentActs(null); })
      .finally(() => { if (!cancelled) setDepartmentActsLoading(false); });
    return () => { cancelled = true; };
  }, [form.type]);

  // Add Documents / Sections tab: same department-Acts list, fetched independently so it
  // doesn't depend on (or get cleared by) the main Upload wizard's form.type.
  useEffect(() => {
    if (activePage !== 'adddocuments') return;
    let cancelled = false;
    setSubDocActsLoading(true);
    getMyDepartmentActs()
      .then(res => { if (!cancelled) setSubDocActsList(res.data?.documents || res.data?.results || (Array.isArray(res.data) ? res.data : [])); })
      .catch(() => { if (!cancelled) setSubDocActsList(null); })
      .finally(() => { if (!cancelled) setSubDocActsLoading(false); });
    return () => { cancelled = true; };
  }, [activePage]);

  // Once the Parent Act is picked, the Chapter & Section Structure card appears below the fold —
  // scroll it into view automatically instead of leaving the user to notice/scroll manually.
  useEffect(() => {
    if (activePage === 'adddocuments' && subDocTab === 'sections' && subDocAct) {
      subDocStructureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activePage, subDocTab, subDocAct]);

  // Switching tabs (schedule → annexure, etc.) shouldn't leave an entry from the previous
  // tab's list expanded — start each tab's entries collapsed. Adjusted during render
  // rather than in an effect, since it's a plain reset with no I/O.
  const [prevSubDocTab, setPrevSubDocTab] = useState(subDocTab);
  if (subDocTab !== prevSubDocTab) {
    setPrevSubDocTab(subDocTab);
    setActiveEntryIdx(-1);
    setEntryPreviewIdx(null);
  }

  // Load existing entries from DB when act or tab changes.
  // Skips if this (actId, tab) pair was already loaded — preserves unsaved additions across tab switches.
  useEffect(() => {
    if (!subDocAct || !subDocTab) return;
    if (subDocLoadedFor.actId === subDocAct && subDocLoadedFor.tab === subDocTab) return;
    const loader = subDocTab === 'sections'
      ? loadActPartSections(subDocAct)
      : loadActPartEntries(subDocAct, subDocTab);
    loader.then(() => setSubDocLoadedFor({ actId: subDocAct, tab: subDocTab }));
  }, [subDocAct, subDocTab, subDocLoadedFor, loadActPartSections, loadActPartEntries]);

  // Add Chapter / Add Section — trying to scroll precisely to "just enough" kept leaving the
  // add buttons off-screen, so this just scrolls the page straight to the bottom instead, which
  // is where new content always lands anyway.
  function scrollAddDocumentsToEnd() {
    document.getElementById('main-content')?.scrollTo({ top: 1e9, behavior: 'smooth' });
  }

  // Switching (or adding) a chapter should default to its own last section being the open one,
  // not whatever section index was active in the previously-open chapter. Adjusted during
  // render rather than in an effect — intentionally keyed on activePage/activeChapterIdx only,
  // not secChapters, so editing chapter content doesn't reset which section is open.
  const chapterKey = `${activePage}:${activeChapterIdx}`;
  const [prevChapterKey, setPrevChapterKey] = useState(chapterKey);
  if (chapterKey !== prevChapterKey) {
    setPrevChapterKey(chapterKey);
    if (activePage === 'adddocuments') {
      setActiveSectionIdx(Math.max(0, (secChapters[activeChapterIdx]?.sections.length || 1) - 1));
    }
  }

  useEffect(() => {
    if (activePage === 'adddocuments' && secHasChapters === true) scrollAddDocumentsToEnd();
  }, [activePage, secHasChapters, secChapters.length]);

  const activeChapterSectionCount = secChapters[activeChapterIdx]?.sections.length;
  useEffect(() => {
    if (activePage === 'adddocuments' && secHasChapters === true) scrollAddDocumentsToEnd();
  }, [activePage, secHasChapters, activeChapterSectionCount]);

  useEffect(() => {
    if (activePage === 'adddocuments' && secHasChapters === false) scrollAddDocumentsToEnd();
  }, [activePage, secHasChapters, secFlatSections.length]);

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
  async function addFiles(fileList) {
    const arr = Array.from(fileList);
    setRejected(arr.filter(f => !isAccepted(f)).map(f => f.name));
    const typeOk = arr.filter(f => isAccepted(f));
    setOversizedFiles(typeOk.filter(f => !isUnderSizeLimit(f)).map(f => ({ name: f.name, size: f.size })));
    const accepted = typeOk.filter(f => isUnderSizeLimit(f));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setFiles(f => f.filter(x => x.name !== name));
    setFileRefs(r => r.filter(x => x.fileName !== name));
    setFileMeta(prev => { const next = { ...prev }; delete next[name]; return next; });
  }
  function handleDrop(e) { e.preventDefault(); setDragOver(false); if (!form.type) return; addFiles(e.dataTransfer.files); }

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

    setFiles([]); setFileRefs([]); setFileMeta({}); setRelations([]);
    setForm({ act:'',dept:user?.dept||'',type:'',version:'1.0',desc:'',enactmentDate:'',parentAct:'',changeTypes:[] });
    setHierarchy({ act:'', actId: null, chapter:'',section:'',subsection:'' });
    setLegalAuthorities([{ act: '', sections: [''] }]);
    setTypeFields({});

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
        setFileMeta(prev => ({
          ...prev,
          [f.name]: {
            documentName: prev[f.name]?.documentName ?? '',
            desc:         prev[f.name]?.desc ?? '',
          },
        }));
        continue;
      }

      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await uploadPdfFile(fd);
        const { file_ref, original_filename, file_size, summary } = res.data;
        setFileRefs(prev => [...prev, { fileName: f.name, fileRef: file_ref, originalFilename: original_filename, fileSize: file_size, summary }]);
        setFileMeta(prev => ({
          ...prev,
          [f.name]: {
            documentName: prev[f.name]?.documentName ?? '',
            desc:         prev[f.name]?.desc ?? (summary || ''),
          },
        }));
      } catch (err) {
        const detail = err.response?.data?.detail;
        setUploadError(typeof detail === 'string' ? detail : t('toasts.documentCheckFailed', { fileName: f.name }));
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
      'Order/Gazette':   'orderNumber',
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
        // API-searched docs store targetId as a numeric string (e.g. "5")
        const numId = parseInt(r.targetId, 10);
        if (!isNaN(numId) && String(numId) === r.targetId) {
          return { pdf_id: numId, type: r.label?.toLowerCase().replace(/\s+/g, '_') || 'related' };
        }
        // Local session docs store targetId as a UUID string matching documents[].uid
        const doc = documents.find(d => d.uid === r.targetId);
        return {
          pdf_id: typeof doc?.id === 'number' ? doc.id : null,
          type:   r.label?.toLowerCase().replace(/\s+/g, '_') || 'related',
        };
      })
      .filter(r => r.pdf_id !== null);

    // For Amendment: auto-include hierarchy Act as parent_act if selected from API search.
    // Dedup by (pdf_id, type) — not pdf_id alone — since the same target document can
    // legitimately carry both an explicit relation (e.g. "In Continuation of") and the
    // auto-derived parent_act relation at the same time.
    const hierarchyRel = (form.type === 'Amendment' && hierarchy.actId &&
      !explicitRels.some(r => r.pdf_id === hierarchy.actId && r.type === 'parent_act'))
      ? [{ pdf_id: hierarchy.actId, type: 'parent_act' }]
      : [];

    // For non-Act types: legal authorities selected from API search → 'issued_under' relationship
    const authorityRels = form.type !== 'Act'
      ? legalAuthorities
          .filter(a => a.actId)
          .filter(a => !explicitRels.some(r => r.pdf_id === a.actId && r.type === 'issued_under') && !hierarchyRel.some(r => r.pdf_id === a.actId))
          .map(a => ({ pdf_id: a.actId, type: 'issued_under' }))
      : [];

    const relationshipsPayload = [...explicitRels, ...hierarchyRel, ...authorityRels];

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
            const message = typeof detail === 'string' ? detail : t('toasts.uploadFailed', { fileName: f.name });
            setUploadError(message);
            setUploadStep('error');
            showToast('error', message);
            return;
          }
        }

        // Step 2: save metadata
        setUploadStep('saving');
        try {
          const payload = {
            file_ref:              fileRef,
            document_type_id:      typeObj?.id ?? null,
            document_name:         fileMeta[f.name]?.documentName || f.name.replace(/\.(pdf|docx?)$/i, ''),
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
            // Act-specific extended fields
            act_year:              typeFields.year ? parseInt(typeFields.year, 10) || null : null,
            long_title:            typeFields.longTitle || '',
            regional_title:        typeFields.regionalTitle || '',
            notification_no:       typeFields.notificationNo || '',
            act_code:              typeFields.actId || '',
            so_reason:             typeFields.soReason || '',
            no_of_rules:           typeFields.noOfRules ? parseInt(typeFields.noOfRules, 10) || null : null,
            no_of_notifications:   typeFields.noOfNotifications ? parseInt(typeFields.noOfNotifications, 10) || null : null,
            no_of_regulations:     typeFields.noOfRegulations ? parseInt(typeFields.noOfRegulations, 10) || null : null,
            no_of_circulars:       typeFields.noOfCirculars ? parseInt(typeFields.noOfCirculars, 10) || null : null,
            no_of_statutes:        typeFields.noOfStatutes ? parseInt(typeFields.noOfStatutes, 10) || null : null,
            no_of_ordinances:      typeFields.noOfOrdinances ? parseInt(typeFields.noOfOrdinances, 10) || null : null,
            no_of_orders:          typeFields.noOfOrder ? parseInt(typeFields.noOfOrder, 10) || null : null,
            keywords:              typeFields.keywords || '',
            tag_ids:               [],
            relationships:         relationshipsPayload,
            description:           (() => {
              const provisions = form.type === 'Amendment'
                ? amendChanges.filter(c => c.section || c.chapter)
                : [];
              const suffix = provisions.length > 0
                ? '\n__PROVISIONS__:' + JSON.stringify(provisions)
                : '';
              return (fileMeta[f.name]?.desc || form.desc || '') + suffix;
            })(),
          };
          const res2 = await uploadPdfMetadata(payload);
          apiDoc = res2.data;
          createNotification({
            toRole:       'approver',
            type:         'new_upload',
            title:        'New Document Submitted',
            message:      `"${fileMeta[f.name]?.documentName || f.name}" uploaded by ${user?.name || user?.username || 'Uploader'} — awaiting your review`,
            docId:        apiDoc?.id,
            docTitle:     fileMeta[f.name]?.documentName || f.name,
            uploaderName: user?.name || user?.username,
          });
        } catch (err) {
          const detail = err.response?.data?.detail;
          const message = typeof detail === 'string' ? detail : t('toasts.saveMetadataFailed', { fileName: f.name });
          setUploadError(message);
          setUploadStep('error');
          showToast('error', message);
          return;
        }
      }

      // Extract text from PDF regardless of API availability
      const { text: extractedText, numPages, pageTexts, pageWords } = f.name.endsWith('.pdf')
        ? await extractPdfText(f)
        : { text: '', numPages: null, pageTexts: [], pageWords: [] };

      newDocs.push({
        id:            apiDoc?.id ?? (Date.now() + Math.random()),
        title:         apiDoc?.document_name || fileMeta[f.name]?.documentName || f.name.replace(/\.(pdf|docx?)$/i, ''),
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
        desc:          fileMeta[f.name]?.desc || form.desc || '',
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
        message:      `"${fileMeta[f.name]?.documentName || f.name}" uploaded by ${user?.name || user?.username || 'Uploader'} — awaiting your review`,
        docId:        apiDoc?.id ?? null,
        docTitle:     fileMeta[f.name]?.documentName || f.name,
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
      showToast('success', newDocs.length > 1
        ? t('toasts.submitSuccessMulti', { count: newDocs.length })
        : t('toasts.submitSuccessSingle', { title: newDocs[0]?.title || t('toasts.documentFallback') }));
    }
  }
  // Called on document-name field blur: checks for cross-department duplicates
  // Accepts an optional nameOverride so per-file panels can reuse the same logic.
  async function checkDuplicate(nameOverride) {
    const docName = (nameOverride ?? form.act).trim();
    const typeObj  = typesData.find(d => d.name === form.type);
    if (!docName || !typeObj?.id) return;
    try {
      const res = await checkDuplicateDocument(docName, typeObj.id);
      const matches = Array.isArray(res.data) ? res.data : [];
      if (matches.length > 0) setDuplicateModal({ matches });
    } catch { /* silent — duplicate check is advisory */ }
  }

  // Called when user clicks "Link to My Department" in the duplicate modal
  async function handleLinkDocument(pdfId) {
    setLinkingId(pdfId);
    try {
      await linkDocumentToDepartment(pdfId);
      setDuplicateModal(null);
      // Refresh linked docs
      getLinkedDocuments().then(r => setLinkedDocs(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    } catch { /* link failed — surfaced via linkingId clearing without a success state */ }
    setLinkingId(null);
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

  async function handleReplaceFileSubmit() {
    if (!replaceFileModal || !replaceFileSelected) return;
    setReplaceFileSaving(true);
    setReplaceFileError('');
    try {
      const formData = new FormData();
      formData.append('file', replaceFileSelected);
      const uploadRes = await uploadPdfFile(formData);
      const { file_ref } = uploadRes.data;
      const updateRes = await replaceDocumentFile(replaceFileModal.id, file_ref, replaceFileResubmit);
      const updated = mapApiDoc(updateRes.data);
      setUploads(prev => prev.map(d => d.id === updated.id ? updated : d));
      setToast({ type: 'success', message: replaceFileResubmit ? t('toasts.fileReplacedAndResubmitted') : t('toasts.fileReplaced') });
      setReplaceFileModal(null);
      setReplaceFileSelected(null);
      setReplaceFileResubmit(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setReplaceFileError(typeof detail === 'string' ? detail : t('toasts.replaceFileFailed'));
    } finally {
      setReplaceFileSaving(false);
    }
  }

  function downloadAuditTrail() {
    const rows = [['Document Title','Type','Department','Year','Status','Workflow Status','Uploaded On','Version','OCR Status']];
    uploads.forEach(d => rows.push([d.title,d.type,d.dept,d.year,d.status,d.workflowStatus||'draft',d.uploadedAt,d.version||'1.0',d.ocrStatus||'completed']));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = document.createElement('a'); a.href = url; a.download = 'upload_audit_trail.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Dashboard — single landing page: quick actions + stats + My Uploads table
  if (activePage === 'dashboard') {
    const approved  = uploads.filter(d => d.status === 'approved').length;
    const pending   = uploads.filter(d => d.status === 'pending').length;
    const rejected  = uploads.filter(d => d.status === 'rejected').length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{UD_RESPONSIVE_CSS}</style>

        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Welcome header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="ud-welcome-title" style={{ fontSize: 'var(--font-size-h3)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-.01em' }}>
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

        {/* Quick actions */}
        <div>
          <div style={{ ...LABEL, marginBottom: 10 }}>{t('dashboard.quickActionsLabel')}</div>
          <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { key: 'upload', icon: Upload, title: t('dashboard.quickActions.uploadTitle'), desc: t('dashboard.quickActions.uploadDesc'), accent: '#214aab', bg: 'rgba(33, 74, 171,.08)' },
              { key: 'editdocument', icon: Edit3, title: t('dashboard.quickActions.editTitle'), desc: t('dashboard.quickActions.editDesc'), accent: '#ffc107', bg: 'rgba(255, 193, 7,.08)' },
              { key: 'adddocuments', icon: FolderPlus, title: t('dashboard.quickActions.addDocumentsTitle'), desc: t('dashboard.quickActions.addDocumentsDesc'), accent: '#16a34a', bg: 'rgba(22,163,74,.08)' },
            ].map(action => (
              <Card key={action.key} onClick={() => onNavigate?.(action.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer',
                  borderLeft: `3px solid ${action.accent}`, transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = action.bg; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <action.icon size={21} color={action.accent} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>{action.title}</div>
                  <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>{action.desc}</div>
                </div>
                <ArrowRight size={16} color={action.accent} style={{ flexShrink: 0, opacity: .8 }} />
              </Card>
            ))}
          </div>
        </div>

        {/* Version history modal */}
        {versionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVersionModal(null)}>
            <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, width: 'min(480px, calc(100vw - 32px))', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
                {t('versionModal.title', { title: versionModal.title })}
              </div>
              {[{ v: versionModal.version || '1.0', date: versionModal.uploadedAt, note: t('versionModal.current') }].map((ver, i, arr) => (
                <div key={ver.v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      v{ver.v}
                      {i === 0 && <span style={{ fontSize: 10, background: 'rgba(33, 74, 171,.12)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>{t('versionModal.currentBadge')}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 2, fontFamily: 'var(--mono)' }}>{ver.date} — {ver.note}</div>
                  </div>
                </div>
              ))}
              <button onClick={() => setVersionModal(null)} style={{ marginTop: 18, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontFamily: 'var(--font)', fontSize: 13, cursor: 'pointer' }}>{t('common.close')}</button>
            </div>
          </div>
        )}

        {/* Remarks modal */}
        {remarksModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setRemarksModal(null)}>
            <div style={{ background: 'var(--surface-card)', borderRadius: 14, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,.3)', width: 'min(520px, calc(100vw - 32px))' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--surface-border)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>{t('common.reviewerRemarks')}</div>
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
                background: remarksModal.status === 'approved' ? 'rgba(25, 135, 84,.06)' : 'rgba(220, 53, 69,.06)',
                border: `1px solid ${remarksModal.status === 'approved' ? 'rgba(25, 135, 84,.2)' : 'rgba(220, 53, 69,.2)'}`,
              }}>
                {remarksModal.status === 'approved'
                  ? <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                  : <XCircle    size={16} color="#dc3545" style={{ flexShrink: 0 }} />
                }
                <div>
                  <div style={{ fontSize: 'var(--font-size-small)', fontWeight: 700, color: remarksModal.status === 'approved' ? '#16a34a' : '#dc3545' }}>
                    {remarksModal.status === 'approved' ? t('remarksModal.approved') : t('remarksModal.rejected')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {t('common.byName', { name: remarksModal.approval.approver_first_name
                      ? `${remarksModal.approval.approver_first_name} ${remarksModal.approval.approver_last_name || ''}`.trim()
                      : remarksModal.approval.approver_username })}
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
                      {t('remarksModal.remarkNumber', { num })}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-color)', lineHeight: 1.6 }}>{text || '—'}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setRemarksModal(null)} style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontFamily: 'var(--font)', fontSize: 13, cursor: 'pointer' }}>
                {t('common.close')}
              </button>
            </div>
          </div>
        )}

        {/* Full-screen document viewer */}
        {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}

        {/* Edit drawer (also handles file replacement for pending/rejected docs) */}
        {editingDoc && editForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1500, display: 'flex', justifyContent: 'flex-end' }} onClick={closeEditDoc}>
            <div style={{ width: 520, maxWidth: '100%', height: '100%', background: 'var(--surface-card)', boxShadow: '-8px 0 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('editDocument.editHeading')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingDoc.title}</div>
                </div>
                <button type="button" onClick={closeEditDoc}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              <div className="ud-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Rejection reason banner */}
                {editingDoc.status === 'rejected' && editingDoc.approval?.comments && (
                  <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(220,53,69,.06)', border: '1px solid rgba(220,53,69,.2)' }}>
                    <XCircle size={14} color="#dc3545" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#dc3545', marginBottom: 3 }}>{t('replaceFileModal.rejectionReason')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-color)', lineHeight: 1.5 }}>{editingDoc.approval.comments}</div>
                    </div>
                  </div>
                )}

                {editError && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626', fontSize: 12.5 }}>
                    {editError}
                  </div>
                )}

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('editDocument.documentName')} <span style={{ color: '#dc3545' }}>*</span></div>
                  <input value={editForm.document_name} onChange={e => setEditForm(f => ({ ...f, document_name: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.referenceNo')}</div>
                  <input value={editForm.reference_number} onChange={e => setEditForm(f => ({ ...f, reference_number: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')}</div>
                    <input type="date" value={editForm.issue_date || ''} onChange={e => setEditForm(f => ({ ...f, issue_date: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                    <input type="date" value={editForm.effective_from || ''} onChange={e => setEditForm(f => ({ ...f, effective_from: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                  <input value={editForm.gazette_reference} onChange={e => setEditForm(f => ({ ...f, gazette_reference: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('docViewModal.legalAuthority')}</div>
                  <input value={editForm.legal_authority} onChange={e => setEditForm(f => ({ ...f, legal_authority: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('editDocument.shortTitle')}</div>
                    <input value={editForm.short_title} onChange={e => setEditForm(f => ({ ...f, short_title: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.version')}</div>
                    <input value={editForm.version_no} onChange={e => setEditForm(f => ({ ...f, version_no: e.target.value }))} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.description')}</div>
                  <textarea value={editForm.description} rows={4}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{ ...INPUT_BASE, resize: 'vertical', fontFamily: 'var(--font)' }} onFocus={focusStyle} onBlur={blurStyle} />
                  {editFileUploading && (
                    <div style={{ fontSize: 11.5, color: 'var(--primary)', marginTop: 4 }}>Extracting description from new file…</div>
                  )}
                </div>

                {(EDIT_TYPE_FIELD_KEYS[editingDoc.type] || []).length > 0 && (
                  <div>
                    <div style={{ ...LABEL, marginBottom: 10 }}>{t('editDocument.typeSpecificFields')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {EDIT_TYPE_FIELD_KEYS[editingDoc.type].map(({ key, inputType }) => (
                        <div key={key}>
                          {inputType === 'checkbox' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-color)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={!!editForm.typeFields[key]}
                                onChange={e => setEditForm(f => ({ ...f, typeFields: { ...f.typeFields, [key]: e.target.checked } }))} />
                              {fieldLabel(key)}
                            </label>
                          ) : (
                            <>
                              <div style={{ ...LABEL, marginBottom: 6 }}>{fieldLabel(key)}</div>
                              <input type={inputType} value={editForm.typeFields[key] || ''}
                                onChange={e => setEditForm(f => ({ ...f, typeFields: { ...f.typeFields, [key]: e.target.value } }))}
                                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Replace File section — shown for pending and rejected docs */}
                {(editingDoc.status === 'pending' || editingDoc.status === 'rejected') && (
                  <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 16 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>
                      {t('replaceFileModal.title')} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-color-secondary)', textTransform: 'none', letterSpacing: 0 }}>({t('common.optional', 'optional')})</span>
                    </div>
                    <input ref={editFileInputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setEditFileSelected(f); e.target.value = ''; }} />
                    {editFileSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(33,74,171,.3)', background: 'rgba(33,74,171,.05)' }}>
                        <FileText size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editFileSelected.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>({(editFileSelected.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => setEditFileSelected(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={13} /></button>
                      </div>
                    ) : (
                      <div
                        style={{ border: '2px dashed var(--surface-border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-ground)', transition: 'all .15s' }}
                        onClick={() => editFileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(33,74,171,.04)'; }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = 'var(--surface-ground)'; }}
                        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = 'var(--surface-ground)'; const f = e.dataTransfer.files[0]; if (f) setEditFileSelected(f); }}>
                        <Upload size={18} color="var(--text-color-secondary)" style={{ marginBottom: 4 }} />
                        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{t('replaceFileModal.dropzone')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 3, opacity: .7 }}>PDF or Word (.docx)</div>
                      </div>
                    )}
                    {editingDoc.status === 'rejected' && editFileSelected && (
                      <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, background: 'rgba(33,74,171,.06)', border: '1px solid rgba(33,74,171,.25)', fontSize: 12.5, color: 'var(--primary)' }}>
                        {t('replaceFileModal.resubmitDesc')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                <button type="button" onClick={closeEditDoc} disabled={editSaving}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: editSaving ? .5 : 1 }}>
                  {t('common.cancel')}
                </button>
                {(() => {
                  const disabled = editSaving || !(editForm?.document_name || '').trim();
                  return (
                    <button type="button" onClick={saveEditDoc} disabled={disabled}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: disabled ? 'rgba(33,74,171,.5)' : 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
                      {editFileUploading ? <RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                      {editSaving ? t('editDocument.saving') : t('editDocument.saveChanges')}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* API error */}
        {myDocsError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{myDocsError}</span>
            <button onClick={() => { setMyDocsError(''); setMyDocsLoading(true); getMyDocuments().then(r => setUploads((r.data.documents||[]).map(mapApiDoc))).catch(e => setMyDocsError(e.response?.data?.detail || t('toasts.failedToLoadDocuments'))).finally(() => setMyDocsLoading(false)); }}
              style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(220, 53, 69,.3)', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Stats + table . */}
        {myDocsLoading && uploads.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 10, background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', animation: 'pulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : (
        <>
        <div style={{ ...LABEL }}>{t('dashboard.overviewLabel')}</div>
        <div className="ud-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: t('stats.totalUploads'),  value: uploads.length, bg: 'rgba(33, 74, 171,.12)',  color: 'var(--primary)', icon: FileText,    filter: 'all' },
            { label: t('stats.approved'),       value: approved,        bg: 'rgba(25, 135, 84,.12)',  color: '#198754',        icon: CheckCircle, filter: 'approved' },
            { label: t('stats.pendingReview'), value: pending,         bg: 'rgba(255, 193, 7,.12)', color: '#b45309',        icon: TrendingUp,  filter: 'pending' },
            { label: t('stats.rejected'),       value: rejected,        bg: 'rgba(220, 53, 69,.12)',  color: '#dc3545',        icon: XCircle,     filter: 'rejected' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: 'rgba(33, 74, 171,.06)', border: '1px solid rgba(33, 74, 171,.2)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{t('table.selectedCount', { count: selectedIds.size })}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{t('table.draftOnly')}</span>
            <button onClick={() => setBulkEditOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.08)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Edit3 size={12} /> {t('bulkEdit.button')}
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {t('table.clearSelection')}
            </button>
          </div>
        )}

        {/* Bulk edit panel */}
        {bulkEditOpen && selectedIds.size > 0 && (
          <Card>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag size={14} color="var(--primary)" />
              {t('bulkEdit.title', { count: selectedIds.size })}
            </div>
            <div style={{ fontSize: 11.5, color: '#d97706', background: 'rgba(255, 193, 7,.08)', border: '1px solid rgba(255, 193, 7,.2)', borderRadius: 7, padding: '6px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} color="#d97706" />
              {t('bulkEdit.warning')}
            </div>
            <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[
                { label: t('common.department'), key: 'dept', opts: DEPTS, translate: false },
                { label: t('common.type'),       key: 'type', opts: TYPES, translate: true },
              ].map(({ label, key, opts, translate }) => (
                <div key={key}>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{label}</div>
                  <select value={bulkFields[key]} onChange={e => setBulkFields(f => ({ ...f, [key]: e.target.value }))}
                    style={{ ...INPUT_BASE, cursor: 'pointer', appearance: 'none' }}
                    onFocus={focusStyle} onBlur={blurStyle}>
                    <option value="">{t('bulkEdit.keepExisting')}</option>
                    {opts.map(o => <option key={o} value={o}>{translate && DOC_TYPE_KEY[o] ? t(`docTypes.${DOC_TYPE_KEY[o]}`) : o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.year')}</div>
                <input type="number" value={bulkFields.year} onChange={e => setBulkFields(f => ({ ...f, year: e.target.value }))}
                  placeholder={t('bulkEdit.leaveBlankPlaceholder')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkEditOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={applyBulkEdit}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('bulkEdit.applyButton', { count: selectedIds.size })}
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

          return (
        <div ref={uploadsTableRef} style={{ scrollMarginTop: 16 }}>
        <Card padding="0">

          {/* ── Header ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 8 }}>
            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('table.title')}</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20 }}>
              {t('table.documentCount', { count: filtered.length })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {bulkSelectMode ? (
                <button onClick={() => { setBulkSelectMode(false); setSelectedIds(new Set()); setBulkEditOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(220, 53, 69,.3)', background: 'rgba(220, 53, 69,.06)', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <X size={12} /> {t('table.cancelSelection')}
                </button>
              ) : (
                <button onClick={() => setBulkSelectMode(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <CheckSquare size={13} /> {t('table.selectButton')}
                </button>
              )}
              <button onClick={downloadAuditTrail}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                <Download size={13} /> {t('table.auditTrail')}
              </button>
            </div>
          </div>

          {/* ── Search + Sort + Filter ── */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-50)' }}>
            <div className="ud-search-row" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search */}
              <div className="ud-search-box" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 320 }}>
                <Search size={13} color="var(--text-color-secondary)" />
                <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder={t('table.searchPlaceholder')}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text-color)', width: '100%' }} />
                {tableSearch && <button onClick={() => setTableSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={12} /></button>}
              </div>
              {/* Active status filter chip */}
              {filterStatus && filterStatus !== 'all' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 20, background: 'rgba(33, 74, 171,.08)', border: '1px solid rgba(33, 74, 171,.2)', fontSize: 12, fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                  {{ approved: t('stats.approved'), pending: t('stats.pendingReview'), rejected: t('stats.rejected') }[filterStatus]}
                  <button onClick={() => setFilterStatus('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0, marginLeft: 2 }}><X size={11} /></button>
                </div>
              )}
              {/* Sort controls */}
              <div className="ud-sort-row" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', marginRight: 2 }}>{t('table.sortLabel')}</span>
                {[
                  { col: 'uploadedAt', label: t('table.sortDate') },
                  { col: 'title',      label: t('table.sortTitle') },
                  { col: 'status',     label: t('table.sortStatus') },
                  { col: 'type',       label: t('table.sortType') },
                ].map(({ col, label }) => {
                  const active = sortCol === col;
                  return (
                    <button key={col} onClick={() => toggleSort(col)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 11px', borderRadius: 20, border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`, background: active ? 'rgba(33, 74, 171,.08)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s' }}>
                      {label}{active && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Type filter: dropdown on mobile (pill row wraps to too many lines to be usable), pills on desktop */}
            {isMobile ? (
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setTypeDropdownOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font)',
                    fontSize: 13, fontWeight: 600,
                    color: filterType ? (TYPE_CARD_COLORS[filterType]?.text || TYPE_CARD_COLORS[filterType]?.accent) : 'var(--text-color)',
                    background: 'rgba(255,255,255,.5)',
                    backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: `1px solid ${filterType ? `${TYPE_CARD_COLORS[filterType]?.accent}55` : 'rgba(255,255,255,.7)'}`,
                    boxShadow: typeDropdownOpen ? '0 4px 18px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.6)' : '0 2px 10px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.6)',
                    transition: 'all .15s',
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {filterType && <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_CARD_COLORS[filterType]?.accent, flexShrink: 0 }} />}
                    {filterType ? (DOC_TYPE_KEY[filterType] ? t(`docTypes.${DOC_TYPE_KEY[filterType]}`) : filterType) : t('table.allTypes')}
                  </span>
                  <ChevronDown size={15} color="var(--text-color-secondary)" style={{ transform: typeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                </button>
                {typeDropdownOpen && (
                  <>
                    <div onClick={() => setTypeDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 160,
                      background: 'rgba(255,255,255,.7)',
                      backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255,255,255,.7)', borderRadius: 14,
                      boxShadow: '0 20px 56px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.7)',
                      padding: 6, maxHeight: 300, overflowY: 'auto',
                      animation: 'fadeSlideIn .15s ease',
                    }}>
                      <button type="button" onClick={() => { setFilterType(''); setTypeDropdownOpen(false); }}
                        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 9, border: 'none', background: !filterType ? 'rgba(33, 74, 171,.12)' : 'transparent', color: !filterType ? 'var(--primary)' : 'var(--text-color)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        {t('table.allTypes')}
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', opacity: .6 }}>{uploads.length}</span>
                      </button>
                      {TYPES.map(type => {
                        const count  = uploads.filter(d => d.type === type).length;
                        const active = filterType === type;
                        const c = TYPE_CARD_COLORS[type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                        return (
                          <button key={type} type="button" onClick={() => { setFilterType(active ? '' : type); setTypeDropdownOpen(false); }}
                            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 9, border: 'none', background: active ? `${c.accent}20` : 'transparent', color: active ? (c.text || c.accent) : 'var(--text-color)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', opacity: count === 0 ? .5 : 1 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent, flexShrink: 0 }} />
                              {DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}
                            </span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', opacity: .6 }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(type => {
                const count  = uploads.filter(d => d.type === type).length;
                const active = filterType === type;
                const c = TYPE_CARD_COLORS[type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                return (
                  <button key={type} type="button" onClick={() => setFilterType(active ? '' : type)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, transition: 'all .15s', background: active ? c.accent : 'var(--surface-card)', border: `1.5px solid ${active ? c.accent : c.accent + '55'}`, color: active ? 'white' : c.text || c.accent, opacity: count === 0 ? 0.4 : 1 }}>
                    {DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: active ? 'rgba(255,255,255,.25)' : 'var(--surface-ground)', color: active ? 'white' : 'var(--text-color-secondary)', padding: '0 5px', borderRadius: 10 }}>{count}</span>
                  </button>
                );
              })}
              {filterType && (
                <button type="button" onClick={() => setFilterType('')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--surface-border)', color: 'var(--text-color-secondary)' }}>
                  <X size={10} /> {t('common.clear')}
                </button>
              )}
            </div>
            )}
          </div>

          {/* ── Column headers (desktop only — a card list has no use for them) ── */}
          {(() => {
            const cols = bulkSelectMode ? '4px 48px 1fr 190px 115px 280px' : '4px 1fr 190px 115px 280px';
            return (
              <>
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-50)', borderBottom: '2px solid var(--surface-border)' }}>
                    <div />
                    {bulkSelectMode && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 16px' }}>
                        <button onClick={toggleSelectAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center' }}>
                          {selectedIds.size === draftUploads.length && draftUploads.length > 0 ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} />}
                        </button>
                      </div>
                    )}
                    <div style={{ ...LABEL, padding: '10px 16px 10px 68px' }}>{t('table.colDocument')}</div>
                    <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.status')}</div>
                    <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('table.colUploadedOn')}</div>
                    <div style={{ ...LABEL, padding: '10px 16px', borderLeft: '1px solid var(--surface-border)' }}>{t('table.colActions')}</div>
                  </div>
                )}

                {/* ── Document rows ── */}
                <div>
                  {filtered.length === 0 && (
                    <div style={{ padding: '52px 0', textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13 }}>
                      {t('table.noDocumentsFound')}
                    </div>
                  )}
                  {filtered.map(doc => {
                    const isDraft      = !doc.workflowStatus || doc.workflowStatus === WORKFLOW_STATUS.DRAFT;
                    const isPublished  = doc.workflowStatus === WORKFLOW_STATUS.PUBLISHED;
                    const isSelected   = selectedIds.has(doc.id);
                    const statusAccent = doc.status === 'approved' ? '#16a34a' : doc.status === 'rejected' ? '#dc3545' : '#ffc107';
                    const statusBg     = doc.status === 'approved' ? 'rgba(25, 135, 84,.07)' : doc.status === 'rejected' ? 'rgba(220, 53, 69,.07)' : 'rgba(255, 193, 7,.07)';
                    const statusBorder = doc.status === 'approved' ? 'rgba(25, 135, 84,.25)' : doc.status === 'rejected' ? 'rgba(220, 53, 69,.25)' : 'rgba(255, 193, 7,.25)';
                    const typeColor    = TYPE_CARD_COLORS[doc.type] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
                    const approverName = doc.approval?.approver_first_name
                      ? `${doc.approval.approver_first_name} ${doc.approval.approver_last_name || ''}`.trim()
                      : doc.approval?.approver_username;
                    const StatusIcon = doc.status === 'approved' ? CheckCircle : doc.status === 'rejected' ? XCircle : Clock;

                    // Mobile: the desktop layout is a fixed 5-6 column grid row (~585px of fixed
                    // columns alone) that can't be reflowed with CSS alone, so it becomes a stacked
                    // card instead of a grid row here.
                    if (isMobile) {
                      return (
                        <div key={doc.id}
                          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--surface-border)', borderLeft: `3px solid ${statusAccent}`, background: isSelected ? 'rgba(33, 74, 171,.04)' : 'transparent' }}>

                          {/* Row 1: (select) + icon + title + status pill */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            {bulkSelectMode && (
                              isDraft ? (
                                <button onClick={() => toggleSelectDoc(doc.id)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: 3 }}>
                                  {isSelected ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} />}
                                </button>
                              ) : (
                                <Square size={14} color="var(--surface-200)" style={{ flexShrink: 0, marginTop: 3 }} />
                              )
                            )}
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {doc.isWord ? <FileType size={15} color={typeColor.accent} /> : <FileText size={15} color={typeColor.accent} />}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              {doc.title}
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 6px', borderRadius: 20, background: statusBg, border: `1px solid ${statusBorder}`, flexShrink: 0 }}>
                              <StatusIcon size={10} color={statusAccent} />
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: statusAccent, fontFamily: 'var(--mono)' }}>
                                {doc.status === 'approved' ? t('common.statusApproved') : doc.status === 'rejected' ? t('common.statusRejected') : t('common.statusPending')}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: meta chips */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>
                              {DOC_TYPE_KEY[doc.type] ? t(`docTypes.${DOC_TYPE_KEY[doc.type]}`) : doc.type}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.dept}</span>
                            <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '1px 7px', borderRadius: 20 }}>{doc.year}</span>
                          </div>

                          {/* Row 3: date + actions */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{doc.uploadedAt}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {(doc.status === 'pending' || doc.status === 'rejected') && (
                                <button onClick={() => openEditDoc(doc)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(100,116,139,.3)', background: 'rgba(100,116,139,.07)', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                  <Edit3 size={12} /> {t('editDocument.editButton')}
                                </button>
                              )}
                              {doc.approval?.comments && (
                                <button onClick={() => setRemarksModal(doc)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: `1px solid ${statusBorder}`, background: statusBg, color: statusAccent, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                  <MessageSquare size={12} /> {t('table.remarksButton')}
                                </button>
                              )}
                              <button onClick={() => setVersionModal(doc)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                                <GitBranch size={11} /> v{doc.version || '1.0'}
                              </button>
                              <button onClick={() => setViewDoc(doc)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                <Eye size={13} /> {t('common.view')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={doc.id}
                        style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--surface-border)', background: isSelected ? 'rgba(33, 74, 171,.04)' : 'transparent', transition: 'background .15s' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(33, 74, 171,.04)' : 'transparent'; }}>

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
                                {DOC_TYPE_KEY[doc.type] ? t(`docTypes.${DOC_TYPE_KEY[doc.type]}`) : doc.type}
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
                              {doc.status === 'approved' ? t('common.statusApproved') : doc.status === 'rejected' ? t('common.statusRejected') : t('common.statusPending')}
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
                        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <button onClick={() => setViewDoc(doc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.14)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.07)'}>
                            <Eye size={13} /> {t('common.view')}
                          </button>
                          {(doc.status === 'pending' || doc.status === 'rejected') && (
                            <button onClick={() => openEditDoc(doc)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(100,116,139,.3)', background: 'rgba(100,116,139,.07)', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: 'background .15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,116,139,.14)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,116,139,.07)'}>
                              <Edit3 size={13} /> {t('editDocument.editButton')}
                            </button>
                          )}
                          {doc.approval?.comments && (
                            <button onClick={() => setRemarksModal(doc)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: `1px solid ${statusBorder}`, background: statusBg, color: statusAccent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: 'opacity .15s' }}>
                              <MessageSquare size={13} /> {t('table.remarksButton')}
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
        </>
        )}

        {/* ── Linked Documents section ── */}
        {linkedDocs.length > 0 && (
          <Card padding="0">
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>{t('linkedDocs.title')}</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#d97706', background: 'rgba(255, 193, 7,.08)', border: '1px solid rgba(255, 193, 7,.25)', padding: '2px 9px', borderRadius: 20 }}>
                {linkedDocs.length}
              </span>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginLeft: 4 }}>{t('linkedDocs.subtitle')}</span>
            </div>
            {linkedDocs.map(l => {
              const typeColor   = TYPE_CARD_COLORS[l.document_type_name] || { accent: '#94a3b8', bg: 'rgba(148,163,184,.1)', text: '#64748b' };
              const isApproved  = l.link_status === 'approved';
              const isRejected  = l.link_status === 'rejected';
              const linkAccent  = isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#d97706';
              const linkBg      = isApproved ? 'rgba(25, 135, 84,.07)' : isRejected ? 'rgba(220, 53, 69,.07)' : 'rgba(255, 193, 7,.07)';
              const linkBorder  = isApproved ? 'rgba(25, 135, 84,.25)' : isRejected ? 'rgba(220, 53, 69,.25)' : 'rgba(255, 193, 7,.25)';
              const linkLabel   = isApproved ? t('linkedDocs.linkApproved') : isRejected ? t('linkedDocs.linkRejected') : t('linkedDocs.linkPending');
              const LinkIcon    = isApproved ? CheckCircle : isRejected ? XCircle : Clock;
              // getLinkedDocuments() returns full document rows (same shape mapApiDoc
              // parses) plus link-specific fields — reuse mapApiDoc for everything
              // (typeFields, shortTitle, gazette, authority, uploader, etc.) and only
              // override status/approval with the cross-department link's own review,
              // which is distinct from the document's original approval.
              const mapLinkedDocForViewer = () => {
                const hasLinkReview = l.link_reviewed_by_username || l.link_reviewed_by_first_name || l.review_comments || l.link_annotations_json;
                return {
                  ...mapApiDoc(l),
                  status:      l.link_status || 'pending',
                  reviewTitle: l.link_status === 'approved' ? t('linkedDocs.linkApprovedTitle') : l.link_status === 'rejected' ? t('linkedDocs.linkRejectedTitle') : t('linkedDocs.linkPendingTitle'),
                  approval: hasLinkReview ? {
                    approver_first_name: l.link_reviewed_by_first_name || null,
                    approver_last_name:  l.link_reviewed_by_last_name  || null,
                    approver_username:   l.link_reviewed_by_username   || null,
                    acted_at:            l.reviewed_at || null,
                    comments:            l.review_comments || null,
                    annotations_json:    l.link_annotations_json || null,
                  } : null,
                };
              };
              if (isMobile) {
                return (
                  <div key={l.link_id} style={{ borderBottom: '1px solid var(--surface-border)', borderLeft: `3px solid ${linkAccent}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={15} color={typeColor.accent} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {l.document_name || l.original_filename}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: linkBg, border: `1px solid ${linkBorder}`, flexShrink: 0 }}>
                        <LinkIcon size={10} color={linkAccent} />
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: linkAccent, fontFamily: 'var(--mono)' }}>{linkLabel}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>{DOC_TYPE_KEY[l.document_type_name] ? t(`docTypes.${DOC_TYPE_KEY[l.document_type_name]}`) : l.document_type_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{l.department_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)' }}>{l.created_at?.split('T')[0] || ''}</span>
                      <button
                        onClick={() => setViewingLinkedDoc(mapLinkedDocForViewer())}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Eye size={13} /> {t('common.view')}
                      </button>
                    </div>
                    {isRejected && l.review_comments && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <XCircle size={13} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--mono)', marginBottom: 3 }}>{t('linkedDocs.rejectionRemarks')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', lineHeight: 1.6 }}>{l.review_comments}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={l.link_id} style={{ borderBottom: '1px solid var(--surface-border)', background: 'transparent', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'grid', gridTemplateColumns: '4px 1fr 190px 90px 115px' }}>
                    <div style={{ background: linkAccent }} />
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={17} color={typeColor.accent} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.document_name || l.original_filename}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'rgba(255, 193, 7,.12)', color: '#d97706', flexShrink: 0, letterSpacing: '.05em' }}>{t('linkedDocs.linkedBadge')}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeColor.bg, color: typeColor.text || typeColor.accent }}>{DOC_TYPE_KEY[l.document_type_name] ? t(`docTypes.${DOC_TYPE_KEY[l.document_type_name]}`) : l.document_type_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-color-secondary)' }}>{l.department_name}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: linkBg, border: `1px solid ${linkBorder}` }}>
                        <LinkIcon size={11} color={linkAccent} />
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: linkAccent, fontFamily: 'var(--mono)', letterSpacing: '.05em' }}>{linkLabel}</span>
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => setViewingLinkedDoc(mapLinkedDocForViewer())}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.07)'}>
                        <Eye size={12} /> {t('common.view')}
                      </button>
                    </div>
                    <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                      {l.created_at?.split('T')[0] || ''}
                    </div>
                  </div>
                  {/* Reviewer remarks for rejected links */}
                  {isRejected && l.review_comments && (
                    <div style={{ marginLeft: 4, padding: '8px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <XCircle size={13} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--mono)', marginBottom: 3 }}>{t('linkedDocs.rejectionRemarks')}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-color-secondary)', lineHeight: 1.6 }}>{l.review_comments}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}

      {viewingLinkedDoc && (
        <DocViewModal doc={viewingLinkedDoc} onClose={() => setViewingLinkedDoc(null)} />
      )}
      </div>
    );
  }

  // Edit Document page: pick a type → table of that type's docs → edit form
  if (activePage === 'editdocument') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease', justifyContent: editType ? 'flex-start' : 'center', minHeight: editType ? 'auto' : 'calc(100vh - 220px)' }}>
        <style>{UD_RESPONSIVE_CSS}</style>
        <Toast toast={toast} onClose={() => setToast(null)} />

        {!editType ? (
          /* Starting state — big centered type picker, identical to the Upload wizard's Step 1 */
          <Card padding="28px 26px">
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 'var(--font-size-h2)', fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>{t('editDocument.pickTypeHeading')}</div>
                <div style={{ fontSize: 'var(--font-size-p2)', color: 'var(--text-color-secondary)' }}>{t('editDocument.pickTypeSubheading')}</div>
              </div>
              <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: 20 }}>
                {TYPES.map(type => {
                  const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                  return (
                    <button key={type} type="button"
                        onClick={() => setEditType(type)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '22px 20px', borderRadius: 14, textAlign: 'left',
                          border: `1.5px solid ${c.accent}30`,
                          background: 'var(--surface-card)',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.accent + '55'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.borderColor = c.accent + '30'; }}>
                        <div style={{ width: 46, height: 46, borderRadius: 11, background: c.bg, border: `1px solid ${c.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={21} color={c.accent} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>{t('editDocument.editPrefix', { defaultValue: 'Edit' })} {DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</div>
                          <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>{DOC_TYPE_KEY[type] ? t(`docTypeDesc.${DOC_TYPE_KEY[type]}`) : TYPE_CARD_DESC[type]}</div>
                        </div>
                      </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ) : (
          <>
          {/* Once a type is picked, it moves to the compact pill row at the top — same fully-collapsed
              size as the Upload wizard uses once a file is checked (its "typeCompact" state), so both
              flows shrink the same way once there's content below the picker. */}
          <Card padding="14px 22px" style={{ animation: 'fadeSlideIn .25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ ...LABEL, fontSize: 10.5, color: 'var(--text-heading)', flexShrink: 0 }}>{t('wizard.step1.label')}</div>
              {isMobile ? (
                <select value={editType || ''} onChange={e => setEditType(e.target.value)}
                  style={{ ...INPUT_BASE, flex: 1, cursor: 'pointer', appearance: 'none', fontSize: 12.5 }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  {TYPES.map(type => (
                    <option key={type} value={type}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</option>
                  ))}
                </select>
              ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {TYPES.map(type => {
                  const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                  const active = editType === type;
                  return (
                    <button key={type} type="button"
                        onClick={() => setEditType(type)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 8,
                          border: active ? `1.5px solid ${c.accent}` : `1.5px solid ${c.accent}30`,
                          background: active ? c.bg : 'var(--surface-card)',
                          opacity: active ? 1 : 0.72,
                          boxShadow: active ? `0 0 0 3px ${c.accent}15` : 'none',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = c.accent + '60'; }}}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = 0.72; e.currentTarget.style.borderColor = c.accent + '30'; }}}>
                        <FileText size={11} color={c.accent} />
                        <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color: active ? c.text : 'var(--text-heading)', whiteSpace: 'nowrap' }}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</span>
                        {active && <CheckCircle size={11} color={c.accent} />}
                      </button>
                  );
                })}
              </div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Edit3 size={13} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('editDocument.tableHeading', { type: DOC_TYPE_KEY[editType] ? t(`docTypes.${DOC_TYPE_KEY[editType]}`) : editType })}
              </span>
            </div>
            {editListError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626', fontSize: 12.5, marginBottom: 14 }}>
                {editListError}
              </div>
            )}
            {editListLoading ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', padding: '10px 0' }}>{t('common.loading')}</div>
            ) : (
              <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div className="table-scroll-wrap">
                <table className="ud-editlist-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-ground)' }}>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px' }}>{t('wizard.step3.colDocumentName')}</th>
                      <th className="ud-editlist-refno" style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.referenceNo')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.issueDate')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.department')}</th>
                      <th className="ud-editlist-version" style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.version')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.status')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('editDocument.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-color-secondary)' }}>
                          {t('editDocument.noDocsOfType', { type: DOC_TYPE_KEY[editType] ? t(`docTypes.${DOC_TYPE_KEY[editType]}`) : editType })}
                        </td>
                      </tr>
                    ) : editList.map(d => {
                      const editable = d.status !== 'approved';
                      return (
                        <tr key={d.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-heading)', fontWeight: 600 }}>{d.title || '—'}</td>
                          <td className="ud-editlist-refno" style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.referenceNumber || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.enactmentDate || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)' }}>{d.dept || '—'}</td>
                          <td className="ud-editlist-version" style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.version || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', textTransform: 'capitalize' }}>
                            {{ approved: t('common.statusWordApproved'), pending: t('common.statusWordPending'), rejected: t('common.statusWordRejected') }[d.status] || d.status || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button type="button" onClick={() => setViewingEditDoc(d)} title={t('common.view')}
                                disabled={!d.id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: d.id ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', opacity: d.id ? 1 : 0.5 }}>
                                <Eye size={12} /> {t('common.view')}
                              </button>
                              {editable ? (
                                <button type="button" onClick={() => openEditDoc(d)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                  <Edit3 size={12} /> {t('editDocument.editButton')}
                                </button>
                              ) : (
                                <span title={t('editDocument.lockedHint')}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)', opacity: 0.7 }}>
                                  {t('editDocument.locked')}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </Card>
          </>
        )}

        {viewingEditDoc && (
          <DocViewModal doc={viewingEditDoc} onClose={() => setViewingEditDoc(null)} />
        )}

        {/* Edit form drawer */}
        {editingDoc && editForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1500, display: 'flex', justifyContent: 'flex-end' }} onClick={closeEditDoc}>
            <div style={{ width: 520, maxWidth: '100%', height: '100%', background: 'var(--surface-card)', boxShadow: '-8px 0 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('editDocument.editHeading')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingDoc.title}</div>
                </div>
                <button type="button" onClick={closeEditDoc}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              <div className="ud-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {editError && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626', fontSize: 12.5 }}>
                    {editError}
                  </div>
                )}

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('editDocument.documentName')} <span style={{ color: '#dc3545' }}>*</span></div>
                  <input value={editForm.document_name}
                    onChange={e => setEditForm(f => ({ ...f, document_name: e.target.value }))}
                    style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.referenceNo')}</div>
                  <input value={editForm.reference_number}
                    onChange={e => setEditForm(f => ({ ...f, reference_number: e.target.value }))}
                    style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')}</div>
                    <input type="date" value={editForm.issue_date || ''}
                      onChange={e => setEditForm(f => ({ ...f, issue_date: e.target.value }))}
                      style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                    <input type="date" value={editForm.effective_from || ''}
                      onChange={e => setEditForm(f => ({ ...f, effective_from: e.target.value }))}
                      style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                  <input value={editForm.gazette_reference}
                    onChange={e => setEditForm(f => ({ ...f, gazette_reference: e.target.value }))}
                    style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('docViewModal.legalAuthority')}</div>
                  <input value={editForm.legal_authority}
                    onChange={e => setEditForm(f => ({ ...f, legal_authority: e.target.value }))}
                    style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('editDocument.shortTitle')}</div>
                    <input value={editForm.short_title}
                      onChange={e => setEditForm(f => ({ ...f, short_title: e.target.value }))}
                      style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.version')}</div>
                    <input value={editForm.version_no}
                      onChange={e => setEditForm(f => ({ ...f, version_no: e.target.value }))}
                      style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                </div>

                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.description')}</div>
                  <textarea value={editForm.description} rows={5}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{ ...INPUT_BASE, resize: 'vertical', fontFamily: 'var(--font)' }} onFocus={focusStyle} onBlur={blurStyle} />
                </div>

                {(EDIT_TYPE_FIELD_KEYS[editingDoc.type] || []).length > 0 && (
                  <div>
                    <div style={{ ...LABEL, marginBottom: 10 }}>{t('editDocument.typeSpecificFields')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {EDIT_TYPE_FIELD_KEYS[editingDoc.type].map(({ key, inputType }) => (
                        <div key={key}>
                          {inputType === 'checkbox' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-color)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={!!editForm.typeFields[key]}
                                onChange={e => setEditForm(f => ({ ...f, typeFields: { ...f.typeFields, [key]: e.target.checked } }))} />
                              {fieldLabel(key)}
                            </label>
                          ) : (
                            <>
                              <div style={{ ...LABEL, marginBottom: 6 }}>{fieldLabel(key)}</div>
                              <input type={inputType} value={editForm.typeFields[key] || ''}
                                onChange={e => setEditForm(f => ({ ...f, typeFields: { ...f.typeFields, [key]: e.target.value } }))}
                                style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Replace File section — shown for pending and rejected docs */}
                {(editingDoc.status === 'pending' || editingDoc.status === 'rejected') && (
                  <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 16 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>
                      {t('replaceFileModal.title')} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-color-secondary)', textTransform: 'none', letterSpacing: 0 }}>({t('common.optional', 'optional')})</span>
                    </div>
                    <input ref={editFileInputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setEditFileSelected(f); e.target.value = ''; }} />
                    {editFileSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(33,74,171,.3)', background: 'rgba(33,74,171,.05)' }}>
                        <FileText size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editFileSelected.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>({(editFileSelected.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => setEditFileSelected(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', padding: 0 }}><X size={13} /></button>
                      </div>
                    ) : (
                      <div
                        style={{ border: '2px dashed var(--surface-border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-ground)', transition: 'all .15s' }}
                        onClick={() => editFileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(33,74,171,.04)'; }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = 'var(--surface-ground)'; }}
                        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = 'var(--surface-ground)'; const f = e.dataTransfer.files[0]; if (f) setEditFileSelected(f); }}>
                        <Upload size={18} color="var(--text-color-secondary)" style={{ marginBottom: 4 }} />
                        <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>{t('replaceFileModal.dropzone')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 3, opacity: .7 }}>PDF or Word (.docx)</div>
                      </div>
                    )}
                    {editingDoc.status === 'rejected' && editFileSelected && (
                      <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, background: 'rgba(33,74,171,.06)', border: '1px solid rgba(33,74,171,.25)', fontSize: 12.5, color: 'var(--primary)' }}>
                        {t('replaceFileModal.resubmitDesc')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                <button type="button" onClick={closeEditDoc} disabled={editSaving}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 13, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', opacity: editSaving ? .5 : 1 }}>
                  {t('common.cancel')}
                </button>
                {(() => {
                  const disabled = editSaving || !(editForm?.document_name || '').trim();
                  return (
                    <button type="button" onClick={saveEditDoc} disabled={disabled}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: disabled ? 'rgba(33,74,171,.5)' : 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
                      {editFileUploading ? <RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                      {editSaving ? t('editDocument.saving') : t('editDocument.saveChanges')}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activePage === 'adddocuments') {
    const activeSubTab = SUBDOC_TABS.find(tb => tb.key === subDocTab);

    // Click a collapsed chapter to expand it; click the expanded one's own badge again to
    // collapse it back — a plain toggle, same idea for sections below.
    function toggleChapter(ci) {
      setActiveChapterIdx(prev => (prev === ci ? -1 : ci));
    }
    function toggleSection(si) {
      setActiveSectionIdx(prev => (prev === si ? -1 : si));
    }
    function toggleFlatSection(si) {
      setActiveFlatSectionIdx(prev => (prev === si ? -1 : si));
    }
    function toggleEntry(idx) {
      setActiveEntryIdx(prev => (prev === idx ? -1 : idx));
    }

    function addChapter() {
      setSecChapters(prev => {
        setActiveChapterIdx(prev.length);
        return [...prev, { id: null, name: '', isDeleted: false, sections: [] }];
      });
      setActiveSectionIdx(0);
    }
    function removeChapter(idx) {
      setSecChapters(prev => prev.map((c, i) => i !== idx ? c : {
        ...c, isDeleted: true,
        sections: c.sections.map(s => ({ ...s, isDeleted: true })),
      }));
      setActiveChapterIdx(prev => prev === idx ? -1 : prev);
    }
    function restoreChapter(idx) {
      setSecChapters(prev => prev.map((c, i) => i !== idx ? c : {
        ...c, isDeleted: false,
        sections: c.sections.map(s => ({ ...s, isDeleted: false })),
      }));
      setActiveChapterIdx(idx);
    }
    function setChapterName(idx, name) {
      setSecChapters(prev => prev.map((ch, i) => i === idx ? { ...ch, name } : ch));
    }
    function addChapterSection(chIdx) {
      setSecChapters(prev => prev.map((ch, i) => i === chIdx ? { ...ch, sections: [...ch.sections, { id: null, name: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: false }] } : ch));
      setActiveSectionIdx(secChapters[chIdx]?.sections.length ?? 0);
    }
    function removeChapterSection(chIdx, secIdx) {
      setSecChapters(prev => prev.map((ch, i) => i !== chIdx ? ch : {
        ...ch, sections: ch.sections.map((s, si) => si === secIdx ? { ...s, isDeleted: true } : s),
      }));
      setActiveSectionIdx(prev => prev === secIdx ? -1 : prev);
    }
    function restoreChapterSection(chIdx, secIdx) {
      setSecChapters(prev => prev.map((ch, i) => i !== chIdx ? ch : {
        ...ch, sections: ch.sections.map((s, si) => si === secIdx ? { ...s, isDeleted: false } : s),
      }));
      setActiveSectionIdx(secIdx);
    }
    function setChapterSectionField(chIdx, secIdx, field, value) {
      setSecChapters(prev => prev.map((ch, i) => {
        if (i !== chIdx) return ch;
        const sections = [...ch.sections];
        sections[secIdx] = { ...sections[secIdx], [field]: value };
        return { ...ch, sections };
      }));
    }
    function addFlatSection() {
      setSecFlatSections(prev => {
        setActiveFlatSectionIdx(prev.length);
        return [...prev, { id: null, name: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: false }];
      });
    }
    function removeFlatSection(idx) {
      setSecFlatSections(prev => prev.map((s, i) => i === idx ? { ...s, isDeleted: true } : s));
      setActiveFlatSectionIdx(prev => prev === idx ? -1 : prev);
    }
    function restoreFlatSection(idx) {
      setSecFlatSections(prev => prev.map((s, i) => i === idx ? { ...s, isDeleted: false } : s));
      setActiveFlatSectionIdx(idx);
    }
    function setFlatSectionField(idx, field, value) {
      setSecFlatSections(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: value }; return next; });
    }

    async function openActPartFile(fileRef, filename) {
      try {
        const res = await getActPartFile(fileRef);
        const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch {
        showToast('error', `Could not open file: ${filename || fileRef}`);
      }
    }

    async function handleAddDocSubmit() {
      if (!subDocAct || !subDocTab) return;
      setSubDocSaving(true);
      try {
        if (subDocTab === 'sections') {
          // Upload files for sections that have one attached
          async function uploadSecFile(file) {
            if (!file) return null;
            const fd = new FormData();
            fd.append('file', file);
            const res = await uploadActPartFile(fd);
            return res.data?.file_ref || null;
          }

          let payload;
          if (secHasChapters) {
            const chapters = (await Promise.all(
              secChapters.map(async (ch, ci) => ({
                id: ch.id ?? null,
                chapter_number: `Chapter ${toRoman(ci + 1)}`,
                chapter_title: ch.name || '',
                is_deleted: ch.isDeleted,
                sections: (await Promise.all(
                  ch.sections.map(async (sec, si) => ({
                    id: sec.id ?? null,
                    section_number: `Section ${si + 1}`,
                    section_title: sec.name || '',
                    section_content: sec.description || '',
                    file_ref: sec.isDeleted ? null : (await uploadSecFile(sec.file) || sec.existingFileRef || null),
                    is_deleted: sec.isDeleted,
                  }))
                )).filter(s => !(s.is_deleted && s.id == null)),
              }))
            )).filter(c => !(c.is_deleted && c.id == null));
            payload = { has_chapters: true, chapters };
          } else {
            const flat_sections = (await Promise.all(
              secFlatSections.map(async (sec, si) => ({
                id: sec.id ?? null,
                section_number: `Section ${si + 1}`,
                section_title: sec.name || '',
                section_content: sec.description || '',
                file_ref: sec.isDeleted ? null : (await uploadSecFile(sec.file) || sec.existingFileRef || null),
                is_deleted: sec.isDeleted,
              }))
            )).filter(s => !(s.is_deleted && s.id == null));
            payload = { has_chapters: false, flat_sections };
          }
          await saveActPartSections(subDocAct, payload);
          try {
            const submitRes = await submitActPartForApproval(subDocAct, PART_TYPE_FOR_API[subDocTab] || subDocTab);
            setSubDocApprovals(prev => ({ ...prev, [subDocTab]: submitRes.data }));
            showToast('success', 'Sections saved and submitted for approval.');
          } catch (submitErr) {
            showToast('error', `Sections saved, but submitting for approval failed: ${submitErr?.response?.data?.detail || submitErr?.message || 'unknown error'}`);
          }
          resetSubDocFormAfterSave('sections');
        } else {
          // Non-sections tab: upload per-entry files then save entries
          const ENTRY_SINGULAR = { schedules: 'Schedule', annexures: 'Annexure', appendices: 'Appendix', forms: 'Form' };
          const entryLabel = ENTRY_SINGULAR[subDocTab] || subDocTab;
          const entries = subDocEntries[subDocTab] || [];
          const builtEntries = (await Promise.all(
            entries.map(async (entry, i) => {
              // Use existing file ref as fallback so re-saving without a new file doesn't wipe the stored path
              let fileRef = entry.fileRef || entry.existingFileRef || null;
              if (!entry.isDeleted && entry.file) {
                const fd = new FormData();
                fd.append('file', entry.file);
                const res = await uploadActPartFile(fd);
                fileRef = res.data?.file_ref || fileRef;
              }
              return {
                id: entry.id ?? null,
                entry_number: `${entryLabel} ${i + 1}`,
                title: entry.title || '',
                description: entry.description || '',
                file_ref: entry.isDeleted ? null : fileRef,
                is_deleted: entry.isDeleted,
              };
            })
          )).filter(e => !(e.is_deleted && e.id == null));
          await saveActPartEntries(subDocAct, subDocTab, { entries: builtEntries });
          try {
            const submitRes = await submitActPartForApproval(subDocAct, PART_TYPE_FOR_API[subDocTab] || subDocTab);
            setSubDocApprovals(prev => ({ ...prev, [subDocTab]: submitRes.data }));
            showToast('success', `${subDocTab.charAt(0).toUpperCase() + subDocTab.slice(1)} saved and submitted for approval.`);
          } catch (submitErr) {
            showToast('error', `${entryLabel} saved, but submitting for approval failed: ${submitErr?.response?.data?.detail || submitErr?.message || 'unknown error'}`);
          }
          resetSubDocFormAfterSave(subDocTab);
        }
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || 'Save failed.';
        showToast('error', msg);
      } finally {
        setSubDocSaving(false);
      }
    }

    // After a successful save the form collapses back to the "pick an Act" prompt instead of
    // staying open on the just-saved Act — adding another one means picking again, on purpose.
    function resetSubDocFormAfterSave(tab) {
      setSubDocActByTab(prev => ({ ...prev, [tab]: '' }));
      if (tab === 'sections') {
        setSecHasChapters(null); setSecChapters([]); setSecFlatSections([]);
        setSectionsBaseline(sectionsSignature(null, [], []));
        setActiveChapterIdx(-1); setActiveSectionIdx(0); setActiveFlatSectionIdx(0);
      } else {
        setSubDocEntries(prev => ({ ...prev, [tab]: [] }));
        setEntriesBaseline(prev => ({ ...prev, [tab]: entriesSignature([]) }));
        setActiveEntryIdx(-1);
      }
      setSubDocLoadedFor({ actId: null, tab: null });
      setSubDocApprovals({});
    }

    // Switching tabs (Sections/Schedule/Annexure/Appendix/Forms) always drops back to the
    // "pick an Act" prompt too — no tab keeps a previously opened Act sitting expanded once
    // you've navigated away from it.
    function handleSubDocTabChange(newTab) {
      setSubDocActByTab({});
      setSecHasChapters(null); setSecChapters([]); setSecFlatSections([]);
      setSectionsBaseline(sectionsSignature(null, [], []));
      setActiveChapterIdx(-1); setActiveSectionIdx(0); setActiveFlatSectionIdx(0);
      setSubDocEntries({});
      setEntriesBaseline({});
      setActiveEntryIdx(-1);
      setSubDocLoadedFor({ actId: null, tab: null });
      setSubDocApprovals({});
      setSubDocTab(newTab);
    }

    // Shared by the structure/entries card headers (status badge) and the footer save button
    // (disabled state) below — computed once so both stay in sync.
    const APPROVAL_STATUS_STYLES = {
      pending:  { bg: '#fef3c7', color: '#92400e', border: '#ffc107', icon: '⏳' },
      approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981', icon: '✓' },
      rejected: { bg: '#fee2e2', color: '#991b1b', border: '#dc3545', icon: '✗' },
    };
    const tabApproval = subDocApprovals[subDocTab];
    const approvalStatus = tabApproval?.status;
    const approvalStyle = APPROVAL_STATUS_STYLES[approvalStatus] || null;

    const subDocDirty = subDocTab === 'sections'
      ? sectionsSignature(secHasChapters, secChapters, secFlatSections) !== sectionsBaseline
      : entriesSignature(subDocEntries[subDocTab] || []) !== (entriesBaseline[subDocTab] ?? entriesSignature([]));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>
        <style>{UD_RESPONSIVE_CSS}</style>
        <Toast toast={toast} onClose={() => setToast(null)} />

        <div>
          <div style={{ fontSize: 'var(--font-size-h3)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-.01em' }}>{t('addDocuments.heading')}</div>
          <div style={{ fontSize: 'var(--font-size-p2)', color: 'var(--text-color-secondary)', marginTop: 4 }}>{t('addDocuments.subheading')}</div>
        </div>

        {!subDocTab ? (
          /* Big centered picker — identical design to the Upload wizard's Document Type picker */
          <Card padding="28px 26px">
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 'var(--font-size-h2)', fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>{t('addDocuments.pickHeading')} <span style={{ color: '#dc3545' }}>*</span></div>
                <div style={{ fontSize: 'var(--font-size-p2)', color: 'var(--text-color-secondary)' }}>{t('addDocuments.pickSubheading')}</div>
              </div>
              <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: 20 }}>
                {SUBDOC_TABS.map(tab => (
                  <button key={tab.key} type="button"
                      onClick={() => handleSubDocTabChange(tab.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        padding: '22px 20px', borderRadius: 14, textAlign: 'left',
                        border: `1.5px solid ${tab.accent}30`,
                        background: 'var(--surface-card)',
                        cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = tab.bg; e.currentTarget.style.borderColor = tab.accent + '55'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.borderColor = tab.accent + '30'; }}>
                      <div style={{ width: 46, height: 46, borderRadius: 11, background: tab.bg, border: `1px solid ${tab.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={21} color={tab.accent} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>{t(tab.labelKey)}</div>
                        <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>{t(tab.descKey)}</div>
                      </div>
                    </button>
                ))}
              </div>
            </div>
          </Card>
        ) : (
        <>
        {/* Compact selected-part row — same collapsed pattern as the Upload wizard's Step 1.
            Parent Act (Sections only) lives in the same card, below a divider, instead of its
            own separate card — saves vertical space, same idea as the Document Type + file-info
            rows sharing one card in the main Upload wizard. */}
        <Card padding="0">
          <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...LABEL, fontSize: 10.5, color: 'var(--text-heading)', flexShrink: 0 }}>{t('addDocuments.pickLabel')}</div>
            {isMobile ? (
              <select value={subDocTab} onChange={e => handleSubDocTabChange(e.target.value)}
                style={{ ...INPUT_BASE, flex: 1, cursor: 'pointer', appearance: 'none', fontSize: 12.5 }}
                onFocus={focusStyle} onBlur={blurStyle}>
                {SUBDOC_TABS.map(tab => (
                  <option key={tab.key} value={tab.key}>{t(tab.labelKey)}</option>
                ))}
              </select>
            ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {SUBDOC_TABS.map(tab => {
                const active = subDocTab === tab.key;
                return (
                  <button key={tab.key} type="button" onClick={() => handleSubDocTabChange(tab.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 8,
                      border: active ? `1.5px solid ${tab.accent}` : `1.5px solid ${tab.accent}30`,
                      background: active ? tab.bg : 'var(--surface-card)',
                      opacity: active ? 1 : 0.72,
                      boxShadow: active ? `0 0 0 3px ${tab.accent}15` : 'none',
                      cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = tab.accent + '60'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = 0.72; e.currentTarget.style.borderColor = tab.accent + '30'; }}}>
                    <FileText size={11} color={tab.accent} />
                    <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color: active ? tab.text : 'var(--text-heading)', whiteSpace: 'nowrap' }}>{t(tab.labelKey)}</span>
                    {active && <CheckCircle size={11} color={tab.accent} />}
                    {((subDocEntries[tab.key] || []).filter(e => !e.isDeleted).length > 0) && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: tab.accent, background: 'rgba(255,255,255,.5)', padding: '0 6px', borderRadius: 20 }}>{(subDocEntries[tab.key] || []).filter(e => !e.isDeleted).length}</span>
                    )}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* Sections tab only: parent Act gate (same pattern as Amendment's Parent Act field) —
              merged into this same card, below a divider, instead of a separate card. */}
          {!!subDocTab && (
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...LABEL, fontSize: 10.5, color: 'var(--text-heading)', flexShrink: 0 }}>{t('wizard.step3.parentActLabel')}</div>
                <select value={subDocAct} onChange={e => {
                    const v = e.target.value;
                    setSubDocActByTab(prev => ({ ...prev, [subDocTab]: v }));
                    if (subDocTab === 'sections') { setSecHasChapters(null); setSecChapters([]); setSecFlatSections([]); setSectionsBaseline(sectionsSignature(null, [], [])); }
                    else { setSubDocEntries(prev => ({ ...prev, [subDocTab]: [] })); setEntriesBaseline(prev => ({ ...prev, [subDocTab]: entriesSignature([]) })); }
                    setSubDocLoadedFor({ actId: null, tab: null });
                    setSubDocApprovals({});
                    if (v) loadActPartApprovals(v);
                  }}
                  disabled={subDocActsLoading}
                  style={{ ...INPUT_BASE, flex: 1, cursor: 'pointer', appearance: 'none', fontSize: 12.5 }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">{subDocActsLoading ? t('addDocuments.sections.selectActLoading') : t('addDocuments.sections.selectActPlaceholder')}</option>
                  {(subDocActsList || []).map(act => (
                    <option key={act.id} value={act.id}>{act.document_name}</option>
                  ))}
                </select>
              </div>
              {!subDocActsLoading && subDocActsList?.length === 0 && (
                <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 8 }}>{t('addDocuments.sections.selectActEmpty')}</div>
              )}
              {!subDocAct && (
                <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 8 }}>{t('wizard.step3.selectActNotice')}</div>
              )}
            </div>
          )}
        </Card>

        {subDocTab === 'sections' && subDocAct && (
          <div ref={subDocStructureRef} style={{ scrollMarginTop: 16 }}>
          <Card padding="0">
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: activeSubTab.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={14} color={activeSubTab.accent} />
              </div>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)', flex: 1 }}>{t('addDocuments.sections.structureHeading')}</div>
              {approvalStyle && (
                <span style={{ fontSize: 11, fontWeight: 700, background: approvalStyle.bg, color: approvalStyle.color, border: `1px solid ${approvalStyle.border}`, borderRadius: 20, padding: '3px 11px', flexShrink: 0 }}>
                  {approvalStyle.icon} {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                </span>
              )}
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Which structure this Act uses — picking either just sets secHasChapters, same
                    as the old Yes/No toggle; these are just clearer about what each choice does. */}
                <div>
                  <div className="ud-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { v: true, icon: Layers, title: t('addDocuments.sections.withChaptersOption'), desc: t('addDocuments.sections.withChaptersDesc') },
                      { v: false, icon: FileText, title: t('addDocuments.sections.withoutChaptersOption'), desc: t('addDocuments.sections.withoutChaptersDesc') },
                    ].map(opt => {
                      const active = secHasChapters === opt.v;
                      const hasDbRecords = secChapters.some(c => c.id != null) || secFlatSections.some(s => s.id != null);
                      const locked = hasDbRecords && !active; // disable switching structure when DB rows already exist
                      return (
                        <button key={String(opt.v)} type="button" onClick={() => !locked && setSecHasChapters(opt.v)}
                          disabled={locked}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                            padding: '14px 16px', borderRadius: 12, cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                            border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--surface-border)',
                            background: active ? 'rgba(33, 74, 171,.06)' : 'var(--surface-card)',
                            opacity: locked ? 0.45 : 1,
                            transition: 'all .15s',
                          }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: active ? 'rgba(33, 74, 171,.14)' : 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <opt.icon size={18} color={active ? 'var(--primary)' : 'var(--text-color-secondary)'} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text-heading)' }}>{opt.title}</div>
                            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-color-secondary)', marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                          </div>
                          {active && <CheckCircle size={16} color="var(--primary)" style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* With chapters: only one chapter is open for editing at a time — its sections
                    (each with a name and a description, which can run long) nest below it.
                    Other chapters collapse to a summary row; click one to switch to it. */}
                {secHasChapters === true && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {secChapters.map((ch, ci) => {
                      if (ch.isDeleted) {
                        return (
                          <div key={ci} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--surface-border)', background: 'transparent' }}>
                            <button type="button" onClick={() => restoreChapter(ci)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: activeSubTab.accent, background: 'transparent', border: `1px dashed ${activeSubTab.accent}60`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              <Plus size={12} /> Add Chapter {toRoman(ci + 1)}
                            </button>
                          </div>
                        );
                      }
                      if (ci !== activeChapterIdx) {
                        const chStatusChip = ch.id ? (ch.status || 'draft') : null;
                        return (
                          <div key={ci} role="button" tabIndex={0} onClick={() => toggleChapter(ci)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleChapter(ci); } }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                              padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)',
                              border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', boxSizing: 'border-box',
                            }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: activeSubTab.accent, fontFamily: 'var(--mono)', letterSpacing: '.04em', flexShrink: 0 }}>
                              {t('addDocuments.sections.chapterNumber', { number: toRoman(ci + 1) })}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: ch.name ? 'var(--text-heading)' : 'var(--text-color-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ch.name || t('addDocuments.sections.chapterNamePlaceholder')}
                            </span>
                            {ch.sections.filter(s => !s.isDeleted).length > 0 && (
                              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-color-secondary)', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', padding: '1px 8px', borderRadius: 20, flexShrink: 0 }}>
                                {t('addDocuments.sections.sectionCountBadge', { count: ch.sections.filter(s => !s.isDeleted).length })}
                              </span>
                            )}
                            {chStatusChip && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '1px 8px', flexShrink: 0,
                                ...(chStatusChip === 'draft'          ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' } :
                                    chStatusChip === 'pending'        ? { background: '#fef3c7', color: '#92400e', border: '1px solid #ffc107' } :
                                    chStatusChip === 'approved'       ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' } :
                                    chStatusChip === 'pending_delete' ? { background: '#fff1f2', color: '#9f1239', border: '1px solid #fda4af' } :
                                                                        { background: '#fee2e2', color: '#991b1b', border: '1px solid #dc3545' }),
                              }}>{{ draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', pending_delete: 'Del. Pending' }[chStatusChip] || chStatusChip}</span>
                            )}
                            <ChevronRight size={14} color="var(--text-color-secondary)" style={{ flexShrink: 0 }} />
                          </div>
                        );
                      }

                      return (
                        <div key={ci} style={{ padding: '16px 18px', borderRadius: 12, border: `1.5px solid ${activeSubTab.accent}40`, background: activeSubTab.bg }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <button type="button" onClick={() => toggleChapter(ci)} title={t('addDocuments.sections.collapseHint')}
                              style={{ fontSize: 11, fontWeight: 700, color: activeSubTab.accent, fontFamily: 'var(--mono)', letterSpacing: '.04em', background: 'var(--surface-card)', border: 'none', padding: '3px 10px', borderRadius: 20, cursor: 'pointer' }}>
                              {t('addDocuments.sections.chapterNumber', { number: toRoman(ci + 1) })}
                            </button>
                            <div style={{ flex: 1 }} />
                            <button type="button" onClick={() => removeChapter(ci)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                              <X size={15} />
                            </button>
                          </div>
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.chapterNameLabel')}</div>
                            <input value={ch.name} onChange={e => setChapterName(ci, e.target.value)}
                              placeholder={t('addDocuments.sections.chapterNamePlaceholder')}
                              style={{ ...INPUT_BASE, fontWeight: 700, background: 'var(--surface-card)' }} onFocus={focusStyle} onBlur={blurStyle} />
                          </div>

                          {ch.sections.length > 0 && (
                            <div style={{ marginLeft: 10, paddingLeft: 20, borderLeft: `2px solid ${activeSubTab.accent}40`, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                              {ch.sections.map((sec, si) => {
                                if (sec.isDeleted) {
                                  return (
                                    <div key={si} style={{ position: 'relative', padding: '8px 12px', borderRadius: 8, border: '1px dashed var(--surface-border)' }}>
                                      <div aria-hidden="true" style={{ position: 'absolute', left: -20, top: 16, width: 20, height: 1, background: activeSubTab.accent + '50' }} />
                                      <button type="button" onClick={() => restoreChapterSection(ci, si)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: activeSubTab.accent, background: 'transparent', border: `1px dashed ${activeSubTab.accent}60`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                        <Plus size={11} /> Add Section {si + 1}
                                      </button>
                                    </div>
                                  );
                                }
                                if (si !== activeSectionIdx) {
                                  // Collapsed — done editing this one; show its name + a clipped
                                  // preview of the description so the active section (usually the
                                  // newest) doesn't get crowded out.
                                  const secStatusChip = sec.id ? (sec.status || 'draft') : null;
                                  return (
                                    <div key={si} role="button" tabIndex={0} onClick={() => toggleSection(si)}
                                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(si); } }}
                                      style={{ position: 'relative', padding: 12, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', cursor: 'pointer' }}>
                                      <div aria-hidden="true" style={{ position: 'absolute', left: -20, top: 20, width: 20, height: 1, background: activeSubTab.accent + '50' }} />
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{t('addDocuments.sections.sectionNumber', { number: si + 1 })}</span>
                                        {secStatusChip && (
                                          <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '1px 7px', flexShrink: 0,
                                            ...(secStatusChip === 'draft'          ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' } :
                                                secStatusChip === 'pending'        ? { background: '#fef3c7', color: '#92400e', border: '1px solid #ffc107' } :
                                                secStatusChip === 'approved'       ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' } :
                                                secStatusChip === 'pending_delete' ? { background: '#fff1f2', color: '#9f1239', border: '1px solid #fda4af' } :
                                                                                     { background: '#fee2e2', color: '#991b1b', border: '1px solid #dc3545' }),
                                          }}>{({ draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', pending_delete: 'Del. Pending' })[secStatusChip] || secStatusChip}</span>
                                        )}
                                        <span style={{ fontSize: 13, fontWeight: 600, color: sec.name ? 'var(--text-heading)' : 'var(--text-color-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {sec.name || t('addDocuments.sections.sectionNamePlain')}
                                        </span>
                                        <button type="button" onClick={e => { e.stopPropagation(); setPreviewTarget({ chapterIdx: ci, sectionIdx: si }); }}
                                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                          <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                                        </button>
                                        <button type="button" onClick={e => { e.stopPropagation(); removeChapterSection(ci, si); }}
                                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                                          <X size={13} />
                                        </button>
                                      </div>
                                      {sec.description && (
                                        <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5, marginTop: 6, marginLeft: 42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                          {sec.description}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={si} style={{ position: 'relative', padding: 14, borderRadius: 10, border: `1.5px solid ${activeSubTab.accent}60`, background: 'var(--surface-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div aria-hidden="true" style={{ position: 'absolute', left: -20, top: 22, width: 20, height: 1, background: activeSubTab.accent + '50' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <button type="button" onClick={() => toggleSection(si)} title={t('addDocuments.sections.collapseHint')}
                                        style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20, cursor: 'pointer' }}>
                                        {t('addDocuments.sections.sectionNumber', { number: si + 1 })}
                                      </button>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button type="button" onClick={() => setPreviewTarget({ chapterIdx: ci, sectionIdx: si })}
                                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                          <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                                        </button>
                                        <button type="button" onClick={() => removeChapterSection(ci, si)}
                                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                                          <X size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.sectionNameLabel')}</div>
                                      <input value={sec.name} onChange={e => setChapterSectionField(ci, si, 'name', e.target.value)}
                                        placeholder={t('addDocuments.sections.sectionNamePlain')}
                                        style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                                    </div>
                                    <div>
                                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.descriptionLabel')}</div>
                                      <textarea value={sec.description} onChange={e => setChapterSectionField(ci, si, 'description', e.target.value)}
                                        placeholder={t('addDocuments.sections.descriptionPlaceholder')} rows={3}
                                        style={{ ...INPUT_BASE, resize: 'vertical', minHeight: 70, fontFamily: 'var(--font)', fontSize: 12.5, lineHeight: 1.5 }}
                                        onFocus={focusStyle} onBlur={blurStyle} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                                        id={`sec-file-ch${ci}-s${si}`}
                                        onChange={e => {
                                          const f = e.target.files?.[0] || null;
                                          if (f && !isAccepted(f)) { showToast('error', t('wizard.unsupportedFileToast', { name: f.name })); e.target.value = ''; return; }
                                          if (f && !isUnderSizeLimit(f)) { showToast('error', t('wizard.fileTooLargeToast', { name: f.name, size: formatSize(MAX_UPLOAD_SIZE_BYTES) })); e.target.value = ''; return; }
                                          setChapterSectionField(ci, si, 'file', f); setChapterSectionField(ci, si, 'fileRef', null); e.target.value = '';
                                        }} />
                                      {sec.file ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', flex: 1 }}>
                                          <Paperclip size={12} color={activeSubTab.accent} />
                                          <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.file.name}</span>
                                          <button type="button" onClick={() => { setChapterSectionField(ci, si, 'file', null); setChapterSectionField(ci, si, 'fileRef', null); }}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ) : sec.existingFilename ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', flex: 1, minWidth: 0 }}>
                                            <Paperclip size={12} color={activeSubTab.accent} />
                                            <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.existingFilename}</span>
                                            <button type="button" onClick={() => openActPartFile(sec.existingFileRef, sec.existingFilename)}
                                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                              <ExternalLink size={11} /> Open
                                            </button>
                                          </div>
                                          <label htmlFor={`sec-file-ch${ci}-s${si}`}
                                            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-color-secondary)', background: 'transparent', border: '1px dashed var(--surface-border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                            Replace
                                          </label>
                                        </div>
                                      ) : (
                                        <label htmlFor={`sec-file-ch${ci}-s${si}`}
                                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: activeSubTab.accent, background: 'transparent', border: `1px dashed ${activeSubTab.accent}60`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                          <Paperclip size={11} /> Attach file (optional)
                                        </label>
                                      )}
                                    </div>
                                    <button type="button" onClick={() => toggleSection(si)}
                                      style={{ alignSelf: 'flex-end', padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                      {t('addDocuments.sections.confirmButton')}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <button type="button" onClick={() => addChapterSection(ci)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: ch.sections.length > 0 ? 30 : 0, fontSize: 11.5, fontWeight: 700, color: activeSubTab.accent, background: 'var(--surface-card)', border: `1px dashed ${activeSubTab.accent}60`, borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              <Plus size={12} /> {t('addDocuments.sections.addSection')}
                            </button>
                            {/* Only show the chapter's own Confirm once no section inside it is
                                still expanded — otherwise two Confirm buttons show at once, which
                                is confusing about which one finishes what. */}
                            {(ch.sections.length === 0 || activeSectionIdx === -1) && (
                              <button type="button" onClick={() => toggleChapter(ci)}
                                style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                {t('addDocuments.sections.confirmButton')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addChapter}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: activeSubTab.accent, background: activeSubTab.bg, border: `1px solid ${activeSubTab.accent}40`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <Plus size={13} /> {t('addDocuments.sections.addChapter')}
                    </button>
                  </div>
                )}

                {/* Without chapters: flat list of sections, each with a name and a description, not tied to any chapter */}
                {secHasChapters === false && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {secFlatSections.map((sec, si) => {
                      if (sec.isDeleted) {
                        return (
                          <div key={si} style={{ padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--surface-border)' }}>
                            <button type="button" onClick={() => restoreFlatSection(si)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px dashed rgba(33, 74, 171,.4)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              <Plus size={12} /> Add Section {si + 1}
                            </button>
                          </div>
                        );
                      }
                      if (si !== activeFlatSectionIdx) {
                        const flatSecStatusChip = sec.id ? (sec.status || 'draft') : null;
                        return (
                          <div key={si} role="button" tabIndex={0} onClick={() => toggleFlatSection(si)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFlatSection(si); } }}
                            style={{ padding: 12, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{t('addDocuments.sections.sectionNumber', { number: si + 1 })}</span>
                              {flatSecStatusChip && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '1px 7px', flexShrink: 0,
                                  ...(flatSecStatusChip === 'draft'          ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' } :
                                      flatSecStatusChip === 'pending'        ? { background: '#fef3c7', color: '#92400e', border: '1px solid #ffc107' } :
                                      flatSecStatusChip === 'approved'       ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' } :
                                      flatSecStatusChip === 'pending_delete' ? { background: '#fff1f2', color: '#9f1239', border: '1px solid #fda4af' } :
                                                                               { background: '#fee2e2', color: '#991b1b', border: '1px solid #dc3545' }),
                                }}>{({ draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', pending_delete: 'Del. Pending' })[flatSecStatusChip] || flatSecStatusChip}</span>
                              )}
                              <span style={{ fontSize: 13, fontWeight: 600, color: sec.name ? 'var(--text-heading)' : 'var(--text-color-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sec.name || t('addDocuments.sections.sectionNamePlain')}
                              </span>
                              <button type="button" onClick={e => { e.stopPropagation(); setPreviewTarget({ chapterIdx: null, sectionIdx: si }); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); removeFlatSection(si); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                                <X size={13} />
                              </button>
                            </div>
                            {sec.description && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5, marginTop: 6, marginLeft: 42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {sec.description}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={si} style={{ padding: 14, borderRadius: 10, border: '1.5px solid var(--primary)', background: 'var(--surface-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <button type="button" onClick={() => toggleFlatSection(si)} title={t('addDocuments.sections.collapseHint')}
                              style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20, cursor: 'pointer' }}>
                              {t('addDocuments.sections.sectionNumber', { number: si + 1 })}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" onClick={() => setPreviewTarget({ chapterIdx: null, sectionIdx: si })}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                              </button>
                              <button type="button" onClick={() => removeFlatSection(si)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.sectionNameLabel')}</div>
                            <input value={sec.name} onChange={e => setFlatSectionField(si, 'name', e.target.value)}
                              placeholder={t('addDocuments.sections.sectionNamePlain')}
                              style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                          </div>
                          <div>
                            <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.descriptionLabel')}</div>
                            <textarea value={sec.description} onChange={e => setFlatSectionField(si, 'description', e.target.value)}
                              placeholder={t('addDocuments.sections.descriptionPlaceholder')} rows={3}
                              style={{ ...INPUT_BASE, resize: 'vertical', minHeight: 70, fontFamily: 'var(--font)', fontSize: 12.5, lineHeight: 1.5 }}
                              onFocus={focusStyle} onBlur={blurStyle} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                              id={`sec-flat-file-${si}`}
                              onChange={e => {
                                const f = e.target.files?.[0] || null;
                                if (f && !isAccepted(f)) { showToast('error', t('wizard.unsupportedFileToast', { name: f.name })); e.target.value = ''; return; }
                                if (f && !isUnderSizeLimit(f)) { showToast('error', t('wizard.fileTooLargeToast', { name: f.name, size: formatSize(MAX_UPLOAD_SIZE_BYTES) })); e.target.value = ''; return; }
                                setFlatSectionField(si, 'file', f); setFlatSectionField(si, 'fileRef', null); e.target.value = '';
                              }} />
                            {sec.file ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', flex: 1 }}>
                                <Paperclip size={12} color="var(--primary)" />
                                <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.file.name}</span>
                                <button type="button" onClick={() => { setFlatSectionField(si, 'file', null); setFlatSectionField(si, 'fileRef', null); }}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                                  <X size={11} />
                                </button>
                              </div>
                            ) : sec.existingFilename ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', flex: 1, minWidth: 0 }}>
                                  <Paperclip size={12} color="var(--primary)" />
                                  <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.existingFilename}</span>
                                  <button type="button" onClick={() => openActPartFile(sec.existingFileRef, sec.existingFilename)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                    <ExternalLink size={11} /> Open
                                  </button>
                                </div>
                                <label htmlFor={`sec-flat-file-${si}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-color-secondary)', background: 'transparent', border: '1px dashed var(--surface-border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                                  Replace
                                </label>
                              </div>
                            ) : (
                              <label htmlFor={`sec-flat-file-${si}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', background: 'transparent', border: '1px dashed rgba(33, 74, 171,.4)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                <Paperclip size={11} /> Attach file (optional)
                              </label>
                            )}
                          </div>
                          <button type="button" onClick={() => toggleFlatSection(si)}
                            style={{ alignSelf: 'flex-end', padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                            {t('addDocuments.sections.confirmButton')}
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addFlatSection}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: activeSubTab.accent, background: activeSubTab.bg, border: `1px solid ${activeSubTab.accent}40`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <Plus size={13} /> {t('addDocuments.sections.addSection')}
                    </button>
                  </div>
                )}
              </div>
          </Card>
          </div>
        )}

        {/* Entry-based form for schedule / annexure / appendix / forms tabs */}
        {subDocTab !== 'sections' && subDocAct && (() => {
          const entries = subDocEntries[subDocTab] || [];
          function addEntry() {
            setSubDocEntries(prev => {
              const list = prev[subDocTab] || [];
              setActiveEntryIdx(list.length);
              return { ...prev, [subDocTab]: [...list, { id: null, number: '', title: '', description: '', file: null, fileRef: null, existingFilename: null, existingFileRef: null, isDeleted: false }] };
            });
          }
          const ENTRY_SINGULAR = { schedules: 'Schedule', annexures: 'Annexure', appendices: 'Appendix', forms: 'Form' };
          function singularLabel(tab) { return ENTRY_SINGULAR[tab] || tab; }
          function removeEntry(idx) {
            const entry = (subDocEntries[subDocTab] || [])[idx];
            if (entry?.id != null) {
              setSubDocEntries(prev => ({
                ...prev,
                [subDocTab]: (prev[subDocTab] || []).map((e, i) => i === idx ? { ...e, isDeleted: true } : e),
              }));
              setActiveEntryIdx(prev => (prev === idx ? -1 : prev));
            } else {
              setSubDocEntries(prev => ({ ...prev, [subDocTab]: (prev[subDocTab] || []).filter((_, i) => i !== idx) }));
              setActiveEntryIdx(prev => (idx <= prev ? Math.max(-1, prev - 1) : prev));
            }
          }
          function restoreEntry(idx) {
            setSubDocEntries(prev => ({
              ...prev,
              [subDocTab]: (prev[subDocTab] || []).map((e, i) => i === idx ? { ...e, isDeleted: false } : e),
            }));
          }
          function setEntryField(idx, field, val) {
            setSubDocEntries(prev => {
              const next = [...(prev[subDocTab] || [])];
              next[idx] = { ...next[idx], [field]: val };
              return { ...prev, [subDocTab]: next };
            });
          }
          return (
          <>
          <Card padding="0">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 'var(--font-size-p2)', fontWeight: 700, color: 'var(--text-heading)' }}>
                {activeSubTab ? t(activeSubTab.labelKey) : subDocTab}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 8px', borderRadius: 20 }}>
                {entries.filter(e => !e.isDeleted).length} {entries.filter(e => !e.isDeleted).length === 1 ? 'entry' : 'entries'}
              </span>
              {approvalStyle && (
                <span style={{ fontSize: 11, fontWeight: 700, background: approvalStyle.bg, color: approvalStyle.color, border: `1px solid ${approvalStyle.border}`, borderRadius: 20, padding: '3px 11px', flexShrink: 0, marginLeft: 'auto' }}>
                  {approvalStyle.icon} {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                </span>
              )}
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {entries.map((entry, i) => {
                if (entry.isDeleted) {
                  return (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 10, border: '1px dashed var(--surface-border)' }}>
                      <button type="button" onClick={() => restoreEntry(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: activeSubTab ? activeSubTab.accent : 'var(--primary)', background: 'transparent', border: `1px dashed ${activeSubTab ? activeSubTab.accent + '60' : 'rgba(33, 74, 171,.4)'}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Plus size={12} /> Add {singularLabel(subDocTab)} {i + 1}
                      </button>
                    </div>
                  );
                }
                const entryStatusChip = entry.id ? (entry.status || 'draft') : null;

                if (i !== activeEntryIdx) {
                  return (
                    <div key={i} role="button" tabIndex={0} onClick={() => toggleEntry(i)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(i); } }}
                      style={{ padding: 12, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-color-secondary)', background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                          {entry.number || `#${i + 1}`}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: entry.title ? 'var(--text-heading)' : 'var(--text-color-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.title || 'Untitled entry'}
                        </span>
                        {entryStatusChip && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '1px 7px', flexShrink: 0,
                            ...(entryStatusChip === 'draft'          ? { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' } :
                                entryStatusChip === 'pending'        ? { background: '#fef3c7', color: '#92400e', border: '1px solid #ffc107' } :
                                entryStatusChip === 'approved'       ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' } :
                                entryStatusChip === 'pending_delete' ? { background: '#fff1f2', color: '#9f1239', border: '1px solid #fda4af' } :
                                                                       { background: '#fee2e2', color: '#991b1b', border: '1px solid #dc3545' }),
                          }}>{({ draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', pending_delete: 'Del. Pending' })[entryStatusChip] || entryStatusChip}</span>
                        )}
                        {(entry.file || entry.existingFilename) && <Paperclip size={12} color={activeSubTab ? activeSubTab.accent : 'var(--primary)'} style={{ flexShrink: 0 }} />}
                        <button type="button" onClick={e => { e.stopPropagation(); setEntryPreviewIdx(i); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                          <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); removeEntry(i); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                          <X size={13} />
                        </button>
                      </div>
                      {entry.description && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', lineHeight: 1.5, marginTop: 6, marginLeft: 42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {entry.description}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${activeSubTab ? activeSubTab.accent : 'var(--surface-border)'}30`, background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button type="button" onClick={() => toggleEntry(i)} title={t('addDocuments.sections.collapseHint')}
                      style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', background: 'var(--surface-card)', border: '1px solid var(--surface-border)', padding: '2px 9px', borderRadius: 20, cursor: 'pointer' }}>
                      {singularLabel(subDocTab)} {i + 1}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => setEntryPreviewIdx(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Eye size={11} /> {t('addDocuments.sections.previewButton')}
                      </button>
                      <button type="button" onClick={() => removeEntry(i)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 5 }}>Title</div>
                    <input value={entry.title} onChange={e => setEntryField(i, 'title', e.target.value)}
                      placeholder="Entry title"
                      style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div>
                    <div style={{ ...LABEL, marginBottom: 5 }}>Description (optional)</div>
                    <textarea value={entry.description} onChange={e => setEntryField(i, 'description', e.target.value)}
                      placeholder="Brief description or content summary" rows={2}
                      style={{ ...INPUT_BASE, resize: 'vertical', minHeight: 56, fontFamily: 'var(--font)', fontSize: 12.5, lineHeight: 1.5 }}
                      onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                      id={`entry-file-${subDocTab}-${i}`}
                      onChange={e => {
                        const f = e.target.files?.[0] || null;
                        if (f && !isAccepted(f)) { showToast('error', t('wizard.unsupportedFileToast', { name: f.name })); e.target.value = ''; return; }
                        if (f && !isUnderSizeLimit(f)) { showToast('error', t('wizard.fileTooLargeToast', { name: f.name, size: formatSize(MAX_UPLOAD_SIZE_BYTES) })); e.target.value = ''; return; }
                        setEntryField(i, 'file', f); setEntryField(i, 'fileRef', null); e.target.value = '';
                      }} />
                    {entry.file ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', flex: 1 }}>
                        {fileIcon(entry.file)}
                        <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</span>
                        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', flexShrink: 0 }}>{formatSize(entry.file.size)}</span>
                        <button type="button" onClick={() => { setEntryField(i, 'file', null); setEntryField(i, 'fileRef', null); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                          <X size={11} />
                        </button>
                      </div>
                    ) : entry.existingFilename ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', flex: 1, minWidth: 0 }}>
                          <Paperclip size={12} color={activeSubTab ? activeSubTab.accent : 'var(--primary)'} />
                          <span style={{ fontSize: 11.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.existingFilename}</span>
                          <button type="button" onClick={() => openActPartFile(entry.existingFileRef, entry.existingFilename)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                            <ExternalLink size={11} /> Open
                          </button>
                        </div>
                        <label htmlFor={`entry-file-${subDocTab}-${i}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-color-secondary)', background: 'transparent', border: '1px dashed var(--surface-border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                          Replace
                        </label>
                      </div>
                    ) : (
                      <label htmlFor={`entry-file-${subDocTab}-${i}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: activeSubTab ? activeSubTab.text : 'var(--primary)', background: 'transparent', border: `1px dashed ${activeSubTab ? activeSubTab.accent + '50' : 'rgba(33, 74, 171,.4)'}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Paperclip size={11} /> Attach file (optional)
                      </label>
                    )}
                  </div>
                  <button type="button" onClick={() => toggleEntry(i)}
                    style={{ alignSelf: 'flex-end', padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    {t('addDocuments.sections.confirmButton')}
                  </button>
                </div>
              );
              })}
              <button type="button" onClick={addEntry}
                style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 700, color: activeSubTab ? activeSubTab.accent : 'var(--primary)', background: activeSubTab ? activeSubTab.bg : 'transparent', border: `1px solid ${activeSubTab ? activeSubTab.accent + '40' : 'var(--surface-border)'}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                <Plus size={13} /> Add Entry
              </button>
            </div>
          </Card>

          {/* Preview & edit — full-page modal for one entry, shown regardless of whether it
              has a description yet, so the uploader can always open it and start typing. */}
          {entryPreviewIdx !== null && entries[entryPreviewIdx] && (() => {
            const entry = entries[entryPreviewIdx];
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                onClick={() => setEntryPreviewIdx(null)}>
                <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 1200, height: '94vh', boxShadow: '0 28px 80px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-p1)', fontWeight: 700, color: 'var(--text-heading)' }}>
                        {singularLabel(subDocTab)} {entryPreviewIdx + 1}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(subDocActsList || []).find(a => String(a.id) === String(subDocAct))?.document_name}
                      </div>
                    </div>
                    <button onClick={() => setEntryPreviewIdx(null)}
                      style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ ...LABEL, marginBottom: 6 }}>Title</div>
                      <input value={entry.title} onChange={e => setEntryField(entryPreviewIdx, 'title', e.target.value)}
                        placeholder="Entry title"
                        style={{ ...INPUT_BASE, background: 'var(--surface-ground)' }} onFocus={focusStyle} onBlur={blurStyle} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <div style={{ ...LABEL, marginBottom: 6, flexShrink: 0 }}>Description (optional)</div>
                      <textarea value={entry.description} onChange={e => setEntryField(entryPreviewIdx, 'description', e.target.value)}
                        placeholder="Brief description or content summary"
                        style={{ ...INPUT_BASE, width: '100%', flex: 1, background: 'var(--surface-ground)', resize: 'none', minHeight: 300, fontFamily: 'var(--font)', fontSize: 13.5, lineHeight: 1.8, boxSizing: 'border-box' }}
                        onFocus={focusStyle} onBlur={blurStyle} autoFocus />
                    </div>
                  </div>

                  <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button type="button" onClick={() => setEntryPreviewIdx(null)}
                      style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      {t('addDocuments.sections.confirmButton')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          </>
          );
        })()}

        {/* Save + Approval — always visible when an act and tab are selected. The status badge
            itself now lives in the structure/entries card header (top-right corner) instead of
            here, so this row is just the rejection note (if any) and the save button. */}
        {subDocAct && subDocTab && (() => {
          const saveDisabled = subDocSaving || !subDocDirty;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              {approvalStatus === 'rejected' && tabApproval?.comments && (
                <span style={{ fontSize: 11.5, color: '#991b1b', fontStyle: 'italic', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 'auto' }}
                  title={tabApproval.comments}>
                  "{tabApproval.comments}"
                </span>
              )}

              <button type="button" onClick={handleAddDocSubmit} disabled={saveDisabled}
                title={!subDocSaving && !subDocDirty ? 'No changes since the last save' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 10, border: 'none', background: saveDisabled ? '#94a3b8' : 'var(--primary)', color: 'white', fontSize: 13.5, fontWeight: 700, cursor: saveDisabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', boxShadow: saveDisabled ? 'none' : '0 2px 12px rgba(33, 74, 171,.25)' }}>
                <Save size={15} /> {subDocSaving ? 'Saving…' : `Save ${activeSubTab ? t(activeSubTab.labelKey) : ''}`}
              </button>
            </div>
          );
        })()}
        </>
        )}

        {/* Preview & edit — scoped to a single section (one at a time), whether it's chapter-nested
            or flat. Fields here are live-editable, wired to the same setters as the main form,
            so fixing a typo while reviewing doesn't require closing the modal. */}
        {previewTarget !== null && (() => {
          const { chapterIdx, sectionIdx } = previewTarget;
          const isFlat = chapterIdx === null;
          const chapter = isFlat ? null : secChapters[chapterIdx];
          const sec = isFlat ? secFlatSections[sectionIdx] : chapter?.sections[sectionIdx];
          if (!sec) return null; // section was removed while its preview was open
          const setName = val => isFlat ? setFlatSectionField(sectionIdx, 'name', val) : setChapterSectionField(chapterIdx, sectionIdx, 'name', val);
          const setDesc = val => isFlat ? setFlatSectionField(sectionIdx, 'description', val) : setChapterSectionField(chapterIdx, sectionIdx, 'description', val);

          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              onClick={() => setPreviewTarget(null)}>
              <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 1200, height: '94vh', boxShadow: '0 28px 80px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>
                      {t('addDocuments.sections.sectionNumber', { number: sectionIdx + 1 })}
                      {!isFlat && <span style={{ color: 'var(--text-color-secondary)', fontWeight: 500 }}> · {t('addDocuments.sections.chapterNumber', { number: toRoman(chapterIdx + 1) })}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(subDocActsList || []).find(a => String(a.id) === String(subDocAct))?.document_name}
                    </div>
                  </div>
                  <button onClick={() => setPreviewTarget(null)}
                    style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
                  {/* Name on top, full width */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ ...LABEL, marginBottom: 6 }}>{t('addDocuments.sections.sectionNameLabel')}</div>
                    <input value={sec.name} onChange={e => setName(e.target.value)}
                      placeholder={t('addDocuments.sections.sectionNamePlain')}
                      style={{ ...INPUT_BASE, background: 'var(--surface-ground)' }} onFocus={focusStyle} onBlur={blurStyle} />
                  </div>
                  {/* Description below, full width and tall so it needs as little scrolling as possible */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ ...LABEL, marginBottom: 6, flexShrink: 0 }}>{t('addDocuments.sections.descriptionLabel')}</div>
                    <textarea value={sec.description} onChange={e => setDesc(e.target.value)}
                      placeholder={t('addDocuments.sections.descriptionPlaceholder')}
                      style={{ ...INPUT_BASE, width: '100%', flex: 1, background: 'var(--surface-ground)', resize: 'none', minHeight: 300, fontFamily: 'var(--font)', fontSize: 13.5, lineHeight: 1.8, boxSizing: 'border-box' }}
                      onFocus={focusStyle} onBlur={blurStyle} autoFocus />
                  </div>
                </div>

                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setPreviewTarget(null)}
                    style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    {t('addDocuments.sections.confirmButton')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Picking a document type resets every type-dependent field below it — shared by the
  // full picker, the compact pill row, and (on mobile) the dropdown that replaces it.
  function pickDocType(type) {
    fmt('type', type); setTypeFields({}); setLegalAuthorities([{ act: '', sections: [''] }]);
    setAmendChanges([{ chapter: '', section: '', subsection: '', changeType: 'Amended', description: '' }]);
    setHierarchy({ act: '', chapter: '', section: '', subsection: '' }); setRelations([]);
    setRelType((REL_TYPES_BY_DOCTYPE[type] || REL_TYPES)[0]); setRelDocType(''); setRelTarget(''); setRelSearch('');
  }

  // Upload page
  return (
    <div style={{ animation: 'fadeSlideIn .3s ease' }}>
      <style>{UD_RESPONSIVE_CSS}</style>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {conflictModal && (
        <VersionConflictModal
          existingDoc={conflictModal.existingDoc}
          newVersion={conflictModal.newVersion}
          onUploadAsNew={handleConflictResolve}
          onCancel={() => setConflictModal(null)}
        />
      )}

      {/* ── Duplicate document modal ──────────────────────────────────────── */}
      {duplicateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDuplicateModal(null)}>
          <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 28px 80px rgba(0,0,0,.35)', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header — stays put; only the matches below scroll */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '28px 28px 20px', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <AlertTriangle size={18} color="#d97706" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{t('duplicateModal.title')}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)' }}>
                  {t('duplicateModal.subtitle')}
                </div>
              </div>
              <button onClick={() => setDuplicateModal(null)} style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '0 28px' }}>
              {/* Own-department matches — version upgrade */}
              {duplicateModal.matches.filter(m => m.match_type === 'own_dept').map(m => (
                <div key={m.id} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(13, 110, 253,.06)', border: '1px solid rgba(13, 110, 253,.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0d6efd', letterSpacing: '.06em', marginBottom: 8 }}>{t('duplicateModal.inYourDepartment')}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>{m.document_name}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                    <span style={{ background: 'rgba(13, 110, 253,.1)', color: '#0d6efd', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{DOC_TYPE_KEY[m.document_type_name] ? t(`docTypes.${DOC_TYPE_KEY[m.document_type_name]}`) : m.document_type_name}</span>
                    <span>v{m.version_no || '1.0'}</span>
                    <span style={{ background: m.status === 'approved' ? 'rgba(25, 135, 84,.1)' : 'rgba(255, 193, 7,.1)', color: m.status === 'approved' ? '#16a34a' : '#d97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>{{ approved: t('common.statusWordApproved'), pending: t('common.statusWordPending'), rejected: t('common.statusWordRejected') }[m.status] || m.status}</span>
                    <span>{m.created_at?.split('T')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const nextVer = (parseFloat(m.version_no || '1.0') + 0.1).toFixed(1);
                      fmt('version', nextVer);
                      setDuplicateModal(null);
                    }} style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0d6efd', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      {t('duplicateModal.uploadAsNewVersion', { version: (parseFloat(m.version_no || '1.0') + 0.1).toFixed(1) })}
                    </button>
                  </div>
                </div>
              ))}

              {/* Other-department matches — link */}
              {duplicateModal.matches.filter(m => m.match_type === 'other_dept').length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', letterSpacing: '.06em', marginBottom: 10 }}>{t('duplicateModal.inOtherDepartments')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {duplicateModal.matches.filter(m => m.match_type === 'other_dept').map(m => (
                      <div key={m.id} style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255, 193, 7,.06)', border: '1px solid rgba(255, 193, 7,.2)' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>{m.document_name}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 11.5, color: 'var(--text-color-secondary)' }}>
                          <span style={{ background: 'rgba(255, 193, 7,.1)', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{DOC_TYPE_KEY[m.document_type_name] ? t(`docTypes.${DOC_TYPE_KEY[m.document_type_name]}`) : m.document_type_name}</span>
                          <span style={{ fontWeight: 600 }}>{m.department_name}</span>
                          <span style={{ background: m.status === 'approved' ? 'rgba(25, 135, 84,.1)' : 'rgba(255, 193, 7,.1)', color: m.status === 'approved' ? '#16a34a' : '#d97706', padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>{{ approved: t('common.statusWordApproved'), pending: t('common.statusWordPending'), rejected: t('common.statusWordRejected') }[m.status] || m.status}</span>
                          <span>{m.created_at?.split('T')[0]}</span>
                        </div>
                        <button onClick={() => handleLinkDocument(m.id)}
                          disabled={linkingId === m.id}
                          style={{ width: '100%', padding: '8px 14px', borderRadius: 8, border: 'none', background: linkingId === m.id ? 'rgba(255, 193, 7,.4)' : '#d97706', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: linkingId === m.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
                          {linkingId === m.id ? t('duplicateModal.sendingRequest') : t('duplicateModal.linkToDepartment')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — stays put, always reachable */}
            <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setDuplicateModal(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-color-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('duplicateModal.continueAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unified single-page upload layout ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, justifyContent: form.type ? 'flex-start' : 'center', minHeight: form.type ? 'auto' : 'calc(100vh - 220px)' }}>

        {/* Hidden file input */}
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        {/* Rejected files alert */}
        {rejected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1 }}>{t('wizard.step2.unsupportedFileType')}</div>
              <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)' }}>{rejected.join(', ')}</div>
            </div>
            <button onClick={() => setRejected([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><X size={13} /></button>
          </div>
        )}

        {/* Oversized files alert — DBIM 6.1.1 upload size ceiling */}
        {oversizedFiles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.2)', color: '#dc2626' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1 }}>{t('wizard.step2.fileTooLarge', { size: formatSize(MAX_UPLOAD_SIZE_BYTES) })}</div>
              <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)' }}>{oversizedFiles.map(f => `${f.name} (${formatSize(f.size)})`).join(', ')}</div>
            </div>
            <button onClick={() => setOversizedFiles([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><X size={13} /></button>
          </div>
        )}

        {/* ── STEP 1 + 2 merged: once the type is picked AND every file is checked, show one compact
             card instead of two stacked ones — less scrolling, less wasted space. ── */}
        {form.type && allFilesChecked ? (
          <Card padding="12px 22px" style={{ animation: 'fadeSlideIn .25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ ...LABEL, fontSize: 10.5, color: 'var(--text-heading)', flexShrink: 0 }}>{t('wizard.step1.label')}</div>
              {isMobile ? (
                <select value={form.type} onChange={e => pickDocType(e.target.value)}
                  style={{ ...INPUT_BASE, flex: 1, cursor: 'pointer', appearance: 'none', fontSize: 12.5 }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  {TYPES.map(type => (
                    <option key={type} value={type}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</option>
                  ))}
                </select>
              ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {TYPES.map(type => {
                  const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                  const active = form.type === type;
                  return (
                    <button key={type} type="button"
                        onClick={() => pickDocType(type)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 8,
                          border: active ? `1.5px solid ${c.accent}` : `1.5px solid ${c.accent}30`,
                          background: active ? c.bg : 'var(--surface-card)',
                          opacity: active ? 1 : 0.72,
                          boxShadow: active ? `0 0 0 3px ${c.accent}15` : 'none',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = c.accent + '60'; }}}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = 0.72; e.currentTarget.style.borderColor = c.accent + '30'; }}}>
                        <FileText size={11} color={c.accent} />
                        <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600, color: active ? c.text : 'var(--text-heading)', whiteSpace: 'nowrap' }}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</span>
                        {active && <CheckCircle size={11} color={c.accent} />}
                      </button>
                    );
                  })}
              </div>
              )}
            </div>
            <div style={{ height: 1, background: 'var(--surface-border)', margin: '10px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(22,163,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {fileIcon(files[0])}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...LABEL, marginBottom: 2 }}>{t('wizard.step2.filesUploaded', { count: files.length })}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {files.length > 1 ? t('wizard.step2.fileCount', { count: files.length }) : files[0]?.name}
                </div>
              </div>
              <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0 }} />
              <button type="button" onClick={() => inputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                <Plus size={12} /> {t('wizard.step2.addFile')}
              </button>
              <button type="button" onClick={() => { setFiles([]); setFileRefs([]); setUploadStep(null); setUploadError(''); }}
                style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                {t('wizard.step2.changeFiles')}
              </button>
            </div>
          </Card>
        ) : (
        <>
        {/* ── STEP 1: Document Type — big centered picker until chosen; medium header until a file is dropped; then compact ── */}
        <Card padding={!form.type ? '28px 26px' : typeCompact ? '14px 22px' : '18px 22px'}>
          {form.type ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: typeCompact ? 10 : 14, animation: 'fadeSlideIn .25s ease' }}>
              <div style={{ ...LABEL, fontSize: typeCompact ? 10.5 : 11.5, color: 'var(--text-heading)', flexShrink: 0 }}>{t('wizard.step1.label')}</div>
              {isMobile ? (
                <select value={form.type} onChange={e => pickDocType(e.target.value)}
                  style={{ ...INPUT_BASE, flex: 1, cursor: 'pointer', appearance: 'none', fontSize: 12.5 }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  {TYPES.map(type => (
                    <option key={type} value={type}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</option>
                  ))}
                </select>
              ) : (
              <div style={{ display: 'flex', gap: typeCompact ? 6 : 8, flexWrap: 'wrap', flex: 1 }}>
                {TYPES.map(type => {
                  const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                  const active = form.type === type;
                  return (
                    <button key={type} type="button"
                        onClick={() => pickDocType(type)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: typeCompact ? 6 : 8,
                          padding: typeCompact ? '6px 10px' : '9px 14px', borderRadius: typeCompact ? 8 : 10,
                          border: active ? `1.5px solid ${c.accent}` : `1.5px solid ${c.accent}30`,
                          background: active ? c.bg : 'var(--surface-card)',
                          opacity: active ? 1 : 0.72,
                          boxShadow: active ? `0 0 0 3px ${c.accent}15` : 'none',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = c.accent + '60'; }}}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = 0.72; e.currentTarget.style.borderColor = c.accent + '30'; }}}>
                        <FileText size={typeCompact ? 11 : 14} color={c.accent} />
                        <span style={{ fontSize: typeCompact ? 11.5 : 12.5, fontWeight: active ? 700 : 600, color: active ? c.text : 'var(--text-heading)', whiteSpace: 'nowrap' }}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</span>
                        {active && <CheckCircle size={typeCompact ? 11 : 13} color={c.accent} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>{t('wizard.step1.heading')} <span style={{ color: '#dc3545' }}>*</span></div>
                <div style={{ fontSize: 13.5, color: 'var(--text-color-secondary)' }}>{t('wizard.step1.subheading')}</div>
              </div>
              <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: 20 }}>
                {TYPES.map(type => {
                  const c = TYPE_CARD_COLORS[type] || { bg: 'rgba(148,163,184,.08)', accent: '#94a3b8', text: '#64748b' };
                  return (
                    <button key={type} type="button"
                        onClick={() => pickDocType(type)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '22px 20px', borderRadius: 14, textAlign: 'left',
                          border: `1.5px solid ${c.accent}30`,
                          background: 'var(--surface-card)',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.accent + '55'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-card)'; e.currentTarget.style.borderColor = c.accent + '30'; }}>
                        <div style={{ width: 46, height: 46, borderRadius: 11, background: c.bg, border: `1px solid ${c.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={21} color={c.accent} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.3 }}>{DOC_TYPE_KEY[type] ? t(`docTypes.${DOC_TYPE_KEY[type]}`) : type}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', lineHeight: 1.45, marginTop: 3 }}>{DOC_TYPE_KEY[type] ? t(`docTypeDesc.${DOC_TYPE_KEY[type]}`) : TYPE_CARD_DESC[type]}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* ── STEP 2: File upload — big while active, collapses into a header once files are checked ── */}
          {form.type && (
          <div ref={uploadSectionRef}>
          <Card padding={allFilesChecked ? '14px 22px' : '28px 26px'}>
            {allFilesChecked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(22,163,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {fileIcon(files[0])}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...LABEL, marginBottom: 2 }}>{t('wizard.step2.filesUploaded', { count: files.length })}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {files.length > 1 ? t('wizard.step2.fileCount', { count: files.length }) : files[0]?.name}
                  </div>
                </div>
                <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                <button type="button" onClick={() => inputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                  <Plus size={12} /> {t('wizard.step2.addFile')}
                </button>
                <button type="button" onClick={() => { setFiles([]); setFileRefs([]); setUploadStep(null); setUploadError(''); }}
                  style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', background: 'transparent', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                  {t('wizard.step2.changeFiles')}
                </button>
              </div>
            ) : files.length === 0 ? (
              <div
                className="ud-dropzone"
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                style={{
                  border: `2px dashed ${TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)'}${dragOver ? '' : '50'}`,
                  borderRadius: 16, padding: '80px 24px',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center',
                  background: dragOver ? (TYPE_CARD_COLORS[form.type]?.bg || 'rgba(33, 74, 171,.05)') : 'var(--surface-card)',
                  transition: 'all .25s',
                  boxShadow: dragOver ? `0 0 0 3px ${TYPE_CARD_COLORS[form.type]?.accent || '#214aab'}18` : 'none',
                }}>
                <div style={{ width: 68, height: 68, borderRadius: 16, flexShrink: 0, background: TYPE_CARD_COLORS[form.type]?.bg || 'rgba(33, 74, 171,.12)', border: `1px solid ${(TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)')}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s' }}>
                  <Upload size={30} color={TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)'} strokeWidth={1.6} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 8 }}>{t('wizard.step2.dropHere')} <span style={{ color: 'var(--primary)' }}>{t('wizard.step2.clickToBrowse')}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-color-secondary)' }}>{t('wizard.step2.fileTypeHint', { size: formatSize(MAX_UPLOAD_SIZE_BYTES) })}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--primary)', background: 'rgba(33, 74, 171,.08)', border: '1px solid rgba(33, 74, 171,.2)', padding: '2px 7px', borderRadius: 20 }}>.PDF</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#2b579a', background: 'rgba(43,87,154,.08)', border: '1px solid rgba(43,87,154,.3)', padding: '2px 7px', borderRadius: 20 }}>.DOC</span>
                    </div>
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
                        background: uploaded ? 'rgba(22,163,74,.05)' : isUploading ? 'rgba(13, 110, 253,.05)' : 'var(--surface-ground)',
                        border: `1.5px solid ${uploaded ? 'rgba(22,163,74,.25)' : isUploading ? 'rgba(13, 110, 253,.2)' : 'var(--surface-border)'}`,
                        transition: 'all .3s',
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: uploaded ? 'rgba(22,163,74,.1)' : 'rgba(33, 74, 171,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {fileIcon(f)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{formatSize(f.size)}</div>
                        </div>
                        {uploaded && <CheckCircle size={13} color="#16a34a" style={{ flexShrink: 0 }} />}
                        {isUploading && <Clock size={12} color="#0d6efd" style={{ flexShrink: 0 }} />}
                        <button type="button"
                          onClick={() => { removeFile(f.name); if (files.length <= 1) { setFileRefs([]); setUploadStep(null); setUploadError(''); } }}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--surface-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                  {files.length > 4 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)', fontWeight: 600, paddingLeft: 4 }}>{t('wizard.step2.moreFiles', { count: files.length - 4 })}</div>
                  )}
                </div>

                {/* Upload & OCR-eligibility check */}
                {!allFilesChecked && uploadStep === 'error' ? (
                  <>
                    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <AlertCircle size={14} color="#dc3545" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: '#dc2626', flex: 1, lineHeight: 1.5 }}>{uploadError}</span>
                    </div>
                    <button type="button" onClick={checkFiles}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      <RotateCcw size={13} /> {t('wizard.step2.tryAgain')}
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
                    {uploadStep === 'uploading' ? <><Clock size={13} /> {t('wizard.step2.checkingDocument')}</> : <><Upload size={13} /> {t('wizard.step2.uploadCheckButton')}</>}
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 2px 4px', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
                    <CheckCircle size={13} /> {t('wizard.step2.eligibilityPassed')}
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
          )}
        </>
        )}

        {/* ── STEP 3: Document Details form — only once all files are checked, full width ── */}
        {allFilesChecked && (
        <>
        <div ref={detailsSectionRef}>
        <Card padding="16px 18px">
              {/* Form header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: TYPE_CARD_COLORS[form.type]?.bg || 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={13} color={TYPE_CARD_COLORS[form.type]?.accent || 'var(--primary)'} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{t('common.documentDetails')}</span>
                {files.length > 1 && <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(13, 110, 253,.1)', color: '#0d6efd', padding: '2px 9px', borderRadius: 20 }}>{t('wizard.step3.appliedToAllFiles', { count: files.length })}</span>}
              </div>
              {uploadError && uploadStep === 'error' && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(220, 53, 69,.08)', border: '1px solid rgba(220, 53, 69,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#dc3545" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#dc2626', flex: 1 }}>{uploadError}</span>
                  <button type="button" onClick={() => { setUploadError(''); setUploadStep(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc3545', display: 'flex' }}><X size={12} /></button>
                </div>
              )}
        <form onSubmit={handleSubmit}>
          <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>

            {/* Act / Legal Authority — must be set first for every type except Act; gates the rest of the form */}
            {form.type !== 'Act' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ ...LABEL, marginBottom: 6 }}>
                  {form.type === 'Amendment' ? t('wizard.step3.parentActLabel') : t('wizard.step3.legalAuthorityLabel')} <span style={{ color: '#dc3545' }}>*</span>
                </div>
                <HierarchyTag hierarchy={hierarchy} onOpen={() => { setDrawerHierarchy({ ...hierarchy }); setDrawerType('hierarchy'); }} isRef={true} legalAuthorities={usesLegalAuthorities ? legalAuthorities : undefined} />
                {detailsLocked && (
                  <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 6 }}>{t('wizard.step3.selectActNotice')}</div>
                )}
              </div>
            )}

            <fieldset disabled={detailsLocked} style={{ display: 'contents', border: 0, margin: 0, padding: 0 }}>

            {/* Per-file name + description panels (shown when all files are checked) */}
            {allFilesChecked && files.length > 0 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 2 }}>
                {files.map(f => (
                  <div key={f.name} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--surface-border)', background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(33, 74, 171,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {fileIcon(f)}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{f.name}</span>
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)', flexShrink: 0 }}>{formatSize(f.size)}</span>
                    </div>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 3 }}>
                        {(DOC_TYPE_KEY[form.type] && t(`wizard.fields.${DOC_TYPE_KEY[form.type]}.nameLabel`, { defaultValue: '' })) || t('wizard.fields.generic.nameLabel')} <span style={{ color: '#dc3545' }}>*</span>
                      </div>
                      <input
                        value={fileMeta[f.name]?.documentName ?? ''}
                        onChange={e => setFileMeta(prev => ({ ...prev, [f.name]: { ...prev[f.name], documentName: e.target.value } }))}
                        onFocus={focusStyle}
                        onBlur={e => { blurStyle(e); checkDuplicate(e.target.value); }}
                        placeholder={(DOC_TYPE_KEY[form.type] && t(`wizard.placeholders.${DOC_TYPE_KEY[form.type]}.name`, { defaultValue: '' })) || t('wizard.placeholders.generic.name')}
                        style={INPUT_BASE} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ACT: all fields inline ── */}
            {form.type === 'Act' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.actNumber || ''} onChange={e => setTypeFields(f => ({ ...f, actNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.year')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.year || ''} onChange={e => setTypeFields(f => ({ ...f, year: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.year')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.shortTitle')}</div>
                <input value={typeFields.shortTitle || ''} onChange={e => setTypeFields(f => ({ ...f, shortTitle: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.shortTitle')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div className="ud-grid-2" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.longTitle')}</div>
                  <input value={typeFields.longTitle || ''} onChange={e => setTypeFields(f => ({ ...f, longTitle: e.target.value }))}
                    placeholder={t('wizard.placeholders.act.longTitle')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.regionalTitle')}</div>
                  <HindiKeyboardInput value={typeFields.regionalTitle || ''} onChange={e => setTypeFields(f => ({ ...f, regionalTitle: e.target.value }))}
                    placeholder={t('wizard.placeholders.act.regionalTitle')} label={t('wizard.fields.act.regionalTitle')} style={INPUT_BASE} />
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.notificationNo')}</div>
                <input value={typeFields.notificationNo || ''} onChange={e => setTypeFields(f => ({ ...f, notificationNo: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.notificationNo')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.actId')} <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{t('wizard.fields.act.ifAvailable')}</span></div>
                <input value={typeFields.actId || ''} onChange={e => setTypeFields(f => ({ ...f, actId: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.actId')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.soReason')}</div>
                <input value={typeFields.soReason || ''} onChange={e => setTypeFields(f => ({ ...f, soReason: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.soReason')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('wizard.fields.act.addReferenceAct')}
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Linked-instrument counts */}
              {[
                ['noOfRules', t('wizard.fields.act.noOfRules')],
                ['noOfNotifications', t('wizard.fields.act.noOfNotifications')],
                ['noOfRegulations', t('wizard.fields.act.noOfRegulations')],
                ['noOfCirculars', t('wizard.fields.act.noOfCirculars')],
                ['noOfStatutes', t('wizard.fields.act.noOfStatutes')],
                ['noOfOrdinances', t('wizard.fields.act.noOfOrdinances')],
                ['noOfOrder', t('wizard.fields.act.noOfOrder')],
              ].map(([key, label]) => (
                <div key={key}>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{label}</div>
                  <input type="number" min="0" value={typeFields[key] || ''} onChange={e => setTypeFields(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={t('wizard.placeholders.numericValue')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
              ))}

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.act.keywords')}</div>
                <input value={typeFields.keywords || ''} onChange={e => setTypeFields(f => ({ ...f, keywords: e.target.value }))}
                  placeholder={t('wizard.placeholders.act.keywords')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>

            </>)}

            {/* ── Amendment: unified inline fields ── */}
            {form.type === 'Amendment' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.amendment.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.amendmentNumber || ''} onChange={e => setTypeFields(f => ({ ...f, amendmentNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.amendment.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.amendment.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Circular: unified inline fields ── */}
            {form.type === 'Circular' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.circular.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.circularNumber || ''} onChange={e => setTypeFields(f => ({ ...f, circularNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.circular.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.validUntil')}</div>
                <input type="date" value={typeFields.validity || ''} onChange={e => setTypeFields(f => ({ ...f, validity: e.target.value }))}
                  placeholder={t('wizard.placeholders.validUntil')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Miscellaneous: mirrors Circular's field set ── */}
            {form.type === 'Miscellaneous' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.miscellaneous.referenceNumber')}</div>
                <input value={typeFields.miscNumber || ''} onChange={e => setTypeFields(f => ({ ...f, miscNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.miscellaneous.referenceNumber')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.validUntil')}</div>
                <input type="date" value={typeFields.validity || ''} onChange={e => setTypeFields(f => ({ ...f, validity: e.target.value }))}
                  placeholder={t('wizard.placeholders.validUntil')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Notification: unified inline fields ── */}
            {form.type === 'Notification' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.notification.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.notificationNumber || ''} onChange={e => setTypeFields(f => ({ ...f, notificationNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.notification.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.notification.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Order/Gazette: unified inline fields ── */}
            {form.type === 'Order/Gazette' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.orderGazette.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.orderNumber || ''} onChange={e => setTypeFields(f => ({ ...f, orderNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.orderGazette.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.commencementDate || ''} onChange={e => setTypeFields(f => ({ ...f, commencementDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.orderGazette.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Policy ── */}
            {form.type === 'Policy' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.policy.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.policyNumber || ''} onChange={e => setTypeFields(f => ({ ...f, policyNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.policy.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.policy.sector')}</div>
                <input value={typeFields.sector || ''} onChange={e => setTypeFields(f => ({ ...f, sector: e.target.value }))}
                  placeholder={t('wizard.placeholders.policy.sector')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.policy.implementingAgency')}</div>
                <input value={typeFields.implementingAgency || ''} onChange={e => setTypeFields(f => ({ ...f, implementingAgency: e.target.value }))}
                  placeholder={t('wizard.placeholders.policy.implementingAgency')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.policy.reviewDate')}</div>
                <input type="date" value={typeFields.reviewDate || ''} onChange={e => setTypeFields(f => ({ ...f, reviewDate: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Rules & Regulations ── */}
            {form.type === 'Rules & Regulations' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.rulesRegulations.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.ruleNumber || ''} onChange={e => setTypeFields(f => ({ ...f, ruleNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.rulesRegulations.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.rulesRegulations.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.rulesRegulations.authority')}</div>
                <input value={typeFields.ruleAuthority || ''} onChange={e => setTypeFields(f => ({ ...f, ruleAuthority: e.target.value }))}
                  placeholder={t('wizard.placeholders.rulesRegulations.authority')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── Bye Laws: mirrors Rules & Regulations' field set ── */}
            {form.type === 'Bye Laws' && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.byeLaws.number')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input value={typeFields.byeLawNumber || ''} onChange={e => setTypeFields(f => ({ ...f, byeLawNumber: e.target.value }))}
                  placeholder={t('wizard.placeholders.byeLaws.number')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.effectiveFrom')}</div>
                <input type="date" value={typeFields.effectiveFrom || ''} onChange={e => setTypeFields(f => ({ ...f, effectiveFrom: e.target.value }))}
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.gazetteReference')}</div>
                <input value={typeFields.gazetteRef || ''} onChange={e => setTypeFields(f => ({ ...f, gazetteRef: e.target.value }))}
                  placeholder={t('wizard.placeholders.byeLaws.gazetteRef')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('wizard.fields.byeLaws.authority')}</div>
                <input value={typeFields.ruleAuthority || ''} onChange={e => setTypeFields(f => ({ ...f, ruleAuthority: e.target.value }))}
                  placeholder={t('wizard.placeholders.byeLaws.authority')} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
            </>)}

            {/* ── All other non-Act, non-Amendment, non-Circular, non-Notification types ── */}
            {!['Act', 'Amendment', 'Circular', 'Notification', 'Order/Gazette', 'Policy', 'Rules & Regulations', 'Bye Laws', 'Miscellaneous'].includes(form.type) && (<>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.issueDate')} <span style={{ color: '#dc3545' }}>*</span></div>
                <input type="date" value={form.enactmentDate} onChange={e => fmt('enactmentDate', e.target.value)} required
                  style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.department')}</div>
                <div style={{ ...INPUT_BASE, color: 'var(--text-color)', opacity: 0.8, userSelect: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, opacity: 0.7 }} />
                  {user?.dept || form.dept || '—'}
                </div>
              </div>
              <div>
                <div style={{ ...LABEL, marginBottom: 6 }}>{t('common.relationships')}</div>
                <button type="button" onClick={() => setDrawerType('relationship')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', color: relations.length > 0 ? 'var(--primary)' : 'var(--text-color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <GitBranch size={13} />
                  {relations.length > 0 ? t('common.relationshipsAdded', { count: relations.length }) : t('common.addRelationship')}
                  <ChevronRight size={12} />
                </button>
              </div>
              {TYPE_FIELDS[form.type]?.map(field => (
                <div key={field.key} style={{ gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
                  <div style={{ ...LABEL, marginBottom: 6 }}>{field.label}{field.required && <span style={{ color: '#dc3545' }}> *</span>}</div>
                  <input type={field.inputType || 'text'} value={typeFields[field.key] || ''}
                    onChange={e => setTypeFields(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder || ''} style={INPUT_BASE} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
              ))}
            </>)}

            {/* Per-file description — shown last, one per file */}
            {files.length > 0 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...LABEL, marginBottom: 0 }}>
                  {t('wizard.step3.descriptionLabel')}
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-color-secondary)', textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>{t('wizard.step3.setPerFile')}</span>
                </div>
                {files.map(f => (
                  <div key={f.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {files.length > 1 && (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        )}
                        {fileMeta[f.name]?.desc && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', textTransform: 'none', letterSpacing: 0, flexShrink: 0 }}>{t('wizard.step3.autoFilled')}</span>
                        )}
                      </div>
                      {/* Full-page preview/edit — the inline box here is only 3 rows, too
                          cramped to read a longer auto-generated description comfortably. */}
                      <button type="button" onClick={() => setDescPreviewFile(f.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
                        <Eye size={11} /> {t('wizard.step3.previewButton')}
                      </button>
                    </div>
                    {/* Read-only here — editing only happens in the Preview modal now, so there's
                        a single place it can be changed instead of two boxes drifting apart. */}
                    <textarea
                      value={fileMeta[f.name]?.desc ?? ''}
                      readOnly
                      onClick={() => setDescPreviewFile(f.name)}
                      rows={3}
                      placeholder={t('wizard.step3.descriptionPlaceholder')}
                      style={{ ...INPUT_BASE, resize: 'none', lineHeight: 1.6, cursor: 'pointer', background: 'var(--surface-ground)', color: 'var(--text-color-secondary)' }} />
                  </div>
                ))}
              </div>
            )}

            </fieldset>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--surface-border)' }}>
            <button type="button"
              onClick={resetUploadForm}
              style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', padding: '9px 22px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
              {t('wizard.step3.clearAll')}
            </button>
            <button type="submit"
              disabled={files.length === 0 || detailsLocked || uploadStep === 'uploading' || uploadStep === 'saving' || uploadStep === 'done'}
              style={{
                background: uploadStep === 'done' ? '#16a34a'
                  : files.length > 0 && !detailsLocked && (!uploadStep || uploadStep === 'ready' || uploadStep === 'error') ? 'var(--primary)'
                  : 'var(--surface-200)',
                color: files.length > 0 && !detailsLocked && (!uploadStep || uploadStep === 'ready' || uploadStep === 'error' || uploadStep === 'done') ? 'white' : '#94a3b8',
                border: 'none', padding: '10px 28px', borderRadius: 8, fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700,
                cursor: files.length > 0 && !detailsLocked && (!uploadStep || uploadStep === 'ready' || uploadStep === 'error') ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: files.length > 0 && !detailsLocked && (!uploadStep || uploadStep === 'ready' || uploadStep === 'error') ? '0 2px 8px rgba(33, 74, 171,.2)' : 'none',
                transition: 'all .2s',
              }}>
              {uploadStep === 'uploading' && <><Clock size={14} /> {t('wizard.step3.uploadingFile')}</>}
              {uploadStep === 'saving'    && <><Clock size={14} /> {t('wizard.step3.savingDetails')}</>}
              {uploadStep === 'done'      && <><CheckCircle size={14} /> {t('wizard.step3.submitted')}</>}
              {(!uploadStep || uploadStep === 'ready' || uploadStep === 'error') && <><CheckCircle size={14} /> {t('wizard.step3.submitForApproval')}</>}
            </button>
          </div>
        </form>
        </Card>
        </div>

        {/* Existing documents of this same type already linked to the chosen Act — its own standalone card */}
        {form.type !== 'Act' && primaryActId && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={13} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{t('wizard.step3.existingDocsUnderAct', { type: DOC_TYPE_KEY[form.type] ? t(`docTypes.${DOC_TYPE_KEY[form.type]}`) : form.type })}</span>
            </div>
            {actChildrenLoading ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', padding: '10px 0' }}>{t('common.loading')}</div>
            ) : (() => {
              const list = extractTypeChildren(actChildren, form.type);
              return (
                <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div className="table-scroll-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-ground)' }}>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px' }}>{t('wizard.step3.colDocumentName')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.referenceNo')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.issueDate')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.department')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.version')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.status')}</th>
                        <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.view')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-color-secondary)' }}>
                            {t('wizard.step3.noDocsUnderAct', { type: DOC_TYPE_KEY[form.type] ? t(`docTypes.${DOC_TYPE_KEY[form.type]}`) : form.type })}
                          </td>
                        </tr>
                      ) : list.map((d, i) => (
                        <tr key={d.id ?? i} style={{ borderTop: '1px solid var(--surface-border)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-heading)', fontWeight: 600 }}>{d.document_name || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.reference_number || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.issue_date || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)' }}>{d.department_name || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.version_no || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', textTransform: 'capitalize' }}>{{ approved: t('common.statusWordApproved'), pending: t('common.statusWordPending'), rejected: t('common.statusWordRejected') }[d.status] || d.status || '—'}</td>
                          <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>
                            <button type="button" onClick={() => setViewingActChildDoc(mapApiDoc(d))}
                              disabled={!d.id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: d.id ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', opacity: d.id ? 1 : 0.5 }}>
                              <Eye size={12} /> {t('common.view')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              );
            })()}
          </Card>
        )}

        {/* Acts already uploaded in the uploader's department — shown while uploading a new Act */}
        {form.type === 'Act' && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-ground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={13} color="var(--primary)" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{t('wizard.step3.existingActsInDept')}</span>
            </div>
            {departmentActsLoading ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', padding: '10px 0' }}>{t('common.loading')}</div>
            ) : (
              <div style={{ border: '1px solid var(--surface-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div className="table-scroll-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-ground)' }}>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px' }}>{t('wizard.step3.colDocumentName')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.referenceNo')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.issueDate')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.department')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.version')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.status')}</th>
                      <th style={{ ...LABEL, textAlign: 'left', padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>{t('common.view')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!departmentActs || departmentActs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-color-secondary)' }}>
                          {t('wizard.step3.noActsInDept')}
                        </td>
                      </tr>
                    ) : departmentActs.map((d, i) => (
                      <tr key={d.id ?? i} style={{ borderTop: '1px solid var(--surface-border)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-heading)', fontWeight: 600 }}>{d.document_name || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.reference_number || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.issue_date || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)' }}>{d.department_name || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', fontFamily: 'var(--mono)', color: 'var(--text-color-secondary)' }}>{d.version_no || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)', color: 'var(--text-color-secondary)', textTransform: 'capitalize' }}>{{ approved: t('common.statusWordApproved'), pending: t('common.statusWordPending'), rejected: t('common.statusWordRejected') }[d.status] || d.status || '—'}</td>
                        <td style={{ padding: '8px 12px', borderLeft: '1px solid var(--surface-border)' }}>
                          <button type="button" onClick={() => setViewingActChildDoc(mapApiDoc(d))}
                            disabled={!d.id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(33, 74, 171,.3)', background: 'rgba(33, 74, 171,.07)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: d.id ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', opacity: d.id ? 1 : 0.5 }}>
                            <Eye size={12} /> {t('common.view')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </Card>
        )}
        {viewingActChildDoc && (
          <DocViewModal doc={viewingActChildDoc} onClose={() => setViewingActChildDoc(null)} />
        )}
        </>
        )}

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
            position: 'fixed', right: 0, top: 0, height: '100vh', width: 420, maxWidth: '100%',
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
  ? (form.type === 'Amendment' ? t('drawer.titleParentActChanges')
      : ['Circular', 'Notification', 'Order/Gazette', 'Miscellaneous'].includes(form.type) ? t('drawer.titleLegalAuthority')
      : ['Policy', 'Rules & Regulations', 'Bye Laws'].includes(form.type) ? t('drawer.titleActReference')
      : t('drawer.titleHierarchicalTags'))
  : t('drawer.titleAddRelationship')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 1 }}>
                  {drawerType === 'hierarchy'
                    ? (form.type === 'Amendment' ? t('drawer.subtitleParentActChanges')
                        : t('drawer.subtitleHierarchyTags'))
                    : (form.type === 'Amendment' ? t('drawer.subtitleAmendmentRelationship') : t('drawer.subtitleLinkDocument'))}
                </div>
              </div>
              <button onClick={closeDrawer}
                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-secondary)', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            {/* Drawer body */}
            <div className="ud-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* ── Hierarchy form ── */}
              {drawerType === 'hierarchy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Parent Act Name — only for Amendment; other types get their own Act/Rule Name field below (multi-legal-authority list or Act/Chapter/Section block) */}
                  {form.type === 'Amendment' && (
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>
                        {t('drawer.parentActName')}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.act}
                          onChange={e => { setDrawerHierarchy(v => ({ ...v, act: e.target.value, actId: null })); fetchDocSuggestions('Act', e.target.value); }}
                          onFocus={e => { focusStyle(e); if (drawerHierarchy.act) fetchDocSuggestions('Act', drawerHierarchy.act); setShowHierActDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierActDrop(false), 180); }}
                          placeholder={t('drawer.searchActsPlaceholder')} style={{ ...INPUT_BASE, width: '100%' }}
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
                  {['Circular', 'Notification', 'Order/Gazette', 'Policy', 'Miscellaneous'].includes(form.type) && (<>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...LABEL }}>{t('drawer.legalAuthorities')}</span>
                      <button type="button"
                        onClick={() => { setLegalAuthorities(p => [...p, { act: '', sections: [''], confirmed: false }]); setEditingAuthIdx(legalAuthorities.length); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Plus size={12} /> {t('drawer.addAnother')}
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
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{t('drawer.authorityNumber', { number: i + 1 })}</span>
                          {legalAuthorities.length > 1 && (
                            <button type="button" onClick={() => { setLegalAuthorities(p => p.filter((_, idx) => idx !== i)); setEditingAuthIdx(null); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div>
                          <div style={{ ...LABEL, marginBottom: 5 }}>{t('drawer.actRuleName')}</div>
                          <div style={{ position: 'relative' }}>
                            <input value={auth.act}
                              onChange={e => { setEditingAuthIdx(i); setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, act: e.target.value } : r)); fetchDocSuggestions('Act', e.target.value); }}
                              onFocus={e => { focusStyle(e); setEditingAuthIdx(i); setShowAuthDrop(i); if (auth.act) fetchDocSuggestions('Act', auth.act); }}
                              onBlur={e => { blurStyle(e); setTimeout(() => setShowAuthDrop(null), 180); }}
                              placeholder={t('drawer.searchActsPlaceholder')} style={{ ...INPUT_BASE, fontSize: 12 }} />
                            {showAuthDrop === i && actSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-color-secondary)' }}>…</div>}
                            {showAuthDrop === i && actSuggestions.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 220, overflow: 'auto', marginTop: 3 }}>
                                {actSuggestions.map(a => (
                                  <div key={a.id}
                                    onMouseDown={() => { setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, act: a.document_name, actId: a.id } : r)); setActSuggestions([]); setShowAuthDrop(null); }}
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
                            <div style={{ ...LABEL }}>{t('drawer.sectionsProvisions')}</div>
                            <button type="button"
                              onClick={() => setLegalAuthorities(p => p.map((r, idx) => idx === i ? { ...r, sections: [...(r.sections || ['']), ''] } : r))}
                              style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={10} /> {t('drawer.addSection')}
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
                                  placeholder={auth.act ? t('drawer.pickSectionPlaceholder') : t('drawer.sectionExamplePlaceholder', { number: si === 0 ? '4' : '17' })}
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
                          <CheckCircle size={14} /> {t('drawer.confirmAuthority')}
                        </button>
                      </div>
                      );
                    })}
                  </>)}


                  {/* Act / Rules & Regulations: Act name + Chapter/Section/Sub-section with dropdowns */}
                  {!['Circular', 'Notification', 'Policy', 'Order/Gazette', 'Amendment', 'Miscellaneous'].includes(form.type) && (<>
                    {/* Act Name — search-acts API */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.actRuleName')}</div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.act}
                          onChange={e => { setDrawerHierarchy(v => ({ ...v, act: e.target.value, actId: null, section: '', chapter: '' })); fetchDocSuggestions('Act', e.target.value); }}
                          onFocus={e => { focusStyle(e); if (drawerHierarchy.act) fetchDocSuggestions('Act', drawerHierarchy.act); setShowHierActDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierActDrop(false), 180); }}
                          placeholder={t('drawer.searchActsPlaceholder')} style={{ ...INPUT_BASE, width: '100%' }} />
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
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.chapter')}</div>
                      <input value={drawerHierarchy.chapter}
                        onChange={e => setDrawerHierarchy(v => ({ ...v, chapter: e.target.value }))}
                        placeholder={t('drawer.chapterPlaceholder')} style={{ ...INPUT_BASE, width: '100%' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </div>

                    {/* Section — dropdown from selected act */}
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.section')}</div>
                      <div style={{ position: 'relative' }}>
                        <input value={drawerHierarchy.section}
                          onChange={e => setDrawerHierarchy(v => ({ ...v, section: e.target.value }))}
                          onFocus={e => { focusStyle(e); setShowHierSecDrop(true); }}
                          onBlur={e => { blurStyle(e); setTimeout(() => setShowHierSecDrop(false), 180); }}
                          placeholder={drawerHierarchy.act ? t('drawer.pickSectionPlaceholder') : t('drawer.sectionPlaceholderExample')}
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
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.subsection')}</div>
                      <input value={drawerHierarchy.subsection}
                        onChange={e => setDrawerHierarchy(v => ({ ...v, subsection: e.target.value }))}
                        placeholder={t('drawer.subsectionPlaceholder')} style={{ ...INPUT_BASE, width: '100%' }}
                        onFocus={focusStyle} onBlur={blurStyle} />
                    </div>
                  </>)}

                  {/* Amendment: dynamic change entries */}
                  {form.type === 'Amendment' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Edit3 size={12} color="var(--primary)" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)' }}>{t('drawer.changesMade')}</span>
                        </div>
                        <button type="button"
                          onClick={() => setAmendChanges(p => [...p, { chapter: '', section: '', subsection: '', changeType: 'Amended', description: '' }])}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                          <Plus size={12} /> {t('drawer.addChange')}
                        </button>
                      </div>

                      {amendChanges.map((ch, i) => (
                        <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{t('drawer.changeNumber', { number: i + 1 })}</span>
                            {amendChanges.length > 1 && (
                              <button type="button" onClick={() => setAmendChanges(p => p.filter((_, idx) => idx !== i))}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)' }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                          <div className="ud-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            {[
                              { key: 'chapter', ph: t('drawer.changeChapterPlaceholder') },
                              { key: 'section', ph: t('drawer.changeSectionPlaceholder') },
                              { key: 'subsection', ph: t('drawer.changeSubsectionPlaceholder') },
                            ].map(({ key, ph }) => (
                              <input key={key} value={ch[key]}
                                onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, [key]: e.target.value } : r))}
                                placeholder={ph} style={{ ...INPUT_BASE, fontSize: 12 }}
                                onFocus={focusStyle} onBlur={blurStyle} />
                            ))}
                          </div>
                          <SelectField value={ch.changeType}
                            onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, changeType: e.target.value } : r))}>
                            {AMEND_CHANGE_TYPES.map(o => <option key={o} value={o}>{t(`amendChangeTypes.${AMEND_CHANGE_KEY[o]}`)}</option>)}
                          </SelectField>
                          <textarea value={ch.description}
                            onChange={e => setAmendChanges(p => p.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                            rows={2} placeholder={t('drawer.describeChangePlaceholder')}
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
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.relationshipType')}</div>
                      <SelectField value={relType} onChange={e => setRelType(e.target.value)}>
                        {(REL_TYPES_BY_DOCTYPE[form.type] || REL_TYPES).map(r => <option key={r} value={r}>{t(`relTypes.${REL_TYPE_KEY[r]}`)}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.targetDocumentType')}</div>
                      <SelectField value={relDocType} onChange={e => { setRelDocType(e.target.value); setRelTarget(''); setRelSearch(''); }} placeholder={t('drawer.selectTypePlaceholder')}>
                        {(REL_TARGET_TYPES[form.type] || Object.keys(TYPE_CARD_COLORS)).map(docType => <option key={docType} value={docType}>{DOC_TYPE_KEY[docType] ? t(`docTypes.${DOC_TYPE_KEY[docType]}`) : docType}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.linkToDocument')}</div>
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
                          placeholder={!relDocType ? t('drawer.selectTypeFirst') : t('drawer.searchDocType', { type: relDocType })}
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
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: 'rgba(255, 193, 7,.1)', border: '1px solid rgba(255, 193, 7,.3)', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--mono)' }}>{t('drawer.pendingBadge')}</span>
                                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>"{relSearch.trim()}"</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-color-secondary)', marginTop: 3 }}>{t('drawer.pendingDocNote')}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Section of linked document — shows only when a document is selected */}
                    {relTarget && !relTarget.startsWith('__pending__:') && (
                      <div>
                        <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.sectionOfLinkedDoc')} <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('drawer.optional')}</span></div>
                        <div style={{ position: 'relative' }}>
                          <input value={relSection}
                            onChange={e => setRelSection(e.target.value)}
                            onFocus={e => { focusStyle(e); setShowRelSecDrop(true); }}
                            onBlur={e => { blurStyle(e); setTimeout(() => setShowRelSecDrop(false), 180); }}
                            placeholder={t('drawer.relSectionPlaceholder')}
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
                      <div style={{ ...LABEL, marginBottom: 6 }}>{t('drawer.howRelated')} <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('drawer.optional')}</span></div>
                      <textarea
                        value={relNote}
                        onChange={e => setRelNote(e.target.value)}
                        rows={3}
                        placeholder={t('drawer.howRelatedPlaceholder')}
                        style={{ ...INPUT_BASE, resize: 'vertical', lineHeight: 1.6, fontSize: 12.5 }}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                    </div>
                    <button type="button" onClick={addRelation} disabled={!relTarget}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 8, border: 'none', background: relTarget ? (relTarget.startsWith('__pending__:') ? '#ffc107' : 'var(--primary)') : 'var(--surface-200)', color: relTarget ? 'white' : '#94a3b8', cursor: relTarget ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, width: '100%' }}>
                      <Plus size={14} /> {t('common.addRelationship')}
                    </button>
                  </>)}

                  {relations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ ...LABEL }}>{t('drawer.addedRelationships')}</div>
                      {relations.map((r, i) => (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(33, 74, 171,.05)', border: '1px solid rgba(33, 74, 171,.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GitBranch size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: r.isPending ? '#ffc107' : 'var(--primary)', fontFamily: 'var(--mono)' }}>{REL_TYPE_KEY[r.label] ? t(`relTypes.${REL_TYPE_KEY[r.label]}`) : r.label}</span>
                            {r.targetType && <span style={{ fontSize: 10.5, fontWeight: 600, color: TYPE_CARD_COLORS[r.targetType]?.text || 'var(--text-color-secondary)', background: TYPE_CARD_COLORS[r.targetType]?.bg || 'rgba(148,163,184,.1)', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>{DOC_TYPE_KEY[r.targetType] ? t(`docTypes.${DOC_TYPE_KEY[r.targetType]}`) : r.targetType}</span>}
                            {r.isPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: 'rgba(255, 193, 7,.1)', border: '1px solid rgba(255, 193, 7,.3)', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--mono)', flexShrink: 0 }}>{t('drawer.pendingBadge')}</span>}
                            <span style={{ fontSize: 12.5, color: 'var(--text-heading)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {r.targetTitle}{r.section ? ` · ${r.section}` : ''}</span>
                            <button type="button" onClick={() => removeRelation(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color-secondary)', flexShrink: 0 }}><X size={12} /></button>
                          </div>
                          {r.note && (
                            <div style={{ marginTop: 7, fontSize: 12, color: 'var(--text-color-secondary)', lineHeight: 1.5, paddingLeft: 20, borderLeft: '2px solid rgba(33, 74, 171,.2)', fontStyle: 'italic' }}>
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
                {t('common.cancel')}
              </button>
              <button type="button"
                onClick={() => {
                  if (drawerType === 'hierarchy') setHierarchy({ ...drawerHierarchy });
                  closeDrawer();
                }}
                style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {drawerType === 'hierarchy' ? t('drawer.saveTags') : t('drawer.done')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Full-page description preview/edit — the inline textarea is only 3 rows, too small to
          read a longer auto-generated summary comfortably; this gives it room, still editable. */}
      {descPreviewFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDescPreviewFile(null)}>
          <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '100%', maxWidth: 1200, height: '94vh', boxShadow: '0 28px 80px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{t('wizard.step3.descriptionLabel')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{descPreviewFile}</div>
              </div>
              <button onClick={() => setDescPreviewFile(null)}
                style={{ background: 'var(--surface-ground)', border: '1px solid var(--surface-border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-color-secondary)', display: 'flex', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <textarea value={fileMeta[descPreviewFile]?.desc ?? ''}
                onChange={e => setFileMeta(prev => ({ ...prev, [descPreviewFile]: { ...prev[descPreviewFile], desc: e.target.value } }))}
                placeholder={t('wizard.step3.descriptionPlaceholder')}
                style={{ ...INPUT_BASE, width: '100%', flex: 1, background: 'var(--surface-ground)', resize: 'none', minHeight: 300, fontFamily: 'var(--font)', fontSize: 13.5, lineHeight: 1.8, boxSizing: 'border-box' }}
                onFocus={focusStyle} onBlur={blurStyle} autoFocus />
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setDescPreviewFile(null)}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {t('wizard.step3.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}