import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Standard "boundary + sibling" page-range algorithm — e.g. for page 5 of 40
// with the defaults below: [1, 'ellipsis', 4, 5, 6, 'ellipsis', 40]. Collapses
// to every page number with no ellipsis at all once totalPages is small enough
// to fit (siblingCount*2 + boundaryCount*2 + 3 numbers, including current).
function getPageRange(current, total, siblingCount = 1, boundaryCount = 1) {
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const totalNumbers = siblingCount * 2 + boundaryCount * 2 + 3;
  if (total <= totalNumbers) return range(1, total);

  const leftSibling = Math.max(current - siblingCount, boundaryCount + 2);
  const rightSibling = Math.min(current + siblingCount, total - boundaryCount - 1);
  const showLeftEllipsis = leftSibling > boundaryCount + 2;
  const showRightEllipsis = rightSibling < total - boundaryCount - 1;

  const items = [...range(1, boundaryCount)];
  items.push(showLeftEllipsis ? 'ellipsis-start' : boundaryCount + 1);
  items.push(...range(leftSibling, rightSibling));
  items.push(showRightEllipsis ? 'ellipsis-end' : total - boundaryCount);
  items.push(...range(total - boundaryCount + 1, total));
  return items;
}

// Shared numbered-pagination control — Previous/Next arrows, numbered page
// buttons with ellipsis for far-apart ranges, and a "go to page" jump input.
// Replaces every ad-hoc Previous/Next-only pager across the app. `page` and
// the value passed to `onChange` are always 1-indexed; callers that keep
// 0-indexed page state convert at the call site, e.g.
// <Pagination page={auditPage + 1} totalPages={...} onChange={p => setAuditPage(p - 1)} />.
// Renders nothing when there's only one page (or none), so callers can render
// it unconditionally instead of wrapping it in a `totalPages > 1 &&` guard.
export default function Pagination({ page, totalPages, onChange }) {
  const { t } = useTranslation('pagination');
  const [goValue, setGoValue] = useState('');
  if (!totalPages || totalPages <= 1) return null;

  function goTo(p) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== page) onChange(clamped);
  }
  function submitGo() {
    const n = parseInt(goValue, 10);
    if (!Number.isNaN(n)) goTo(n);
    setGoValue('');
  }

  const items = getPageRange(page, totalPages);
  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, padding: '0 8px',
    borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-heading)',
    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .15s, opacity .15s', flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <button type="button" aria-label={t('previousPage')} onClick={() => goTo(page - 1)} disabled={page === 1}
          style={{ ...btnBase, opacity: page === 1 ? .45 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
          <ChevronLeft size={14} />
        </button>
        {items.map((it, i) => (
          typeof it === 'number' ? (
            <button key={it} type="button" onClick={() => goTo(it)}
              style={{
                ...btnBase, border: it === page ? 'none' : btnBase.border,
                background: it === page ? 'var(--primary)' : 'var(--surface-card)',
                color: it === page ? '#fff' : 'var(--text-heading)',
              }}
              onMouseEnter={e => { if (it !== page) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { if (it !== page) e.currentTarget.style.background = 'var(--surface-card)'; }}>
              {it}
            </button>
          ) : (
            <span key={it + i} style={{ width: 24, textAlign: 'center', color: 'var(--text-color-secondary)', fontSize: 13, flexShrink: 0 }}>…</span>
          )
        ))}
        <button type="button" aria-label={t('nextPage')} onClick={() => goTo(page + 1)} disabled={page === totalPages}
          style={{ ...btnBase, opacity: page === totalPages ? .45 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{t('goToPage')}</span>
        <input type="number" min={1} max={totalPages} value={goValue}
          onChange={e => setGoValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitGo(); }}
          style={{ width: 52, padding: '5px 6px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', fontSize: 12.5, fontFamily: 'var(--font)', color: 'var(--text-color)', textAlign: 'center' }} />
        <button type="button" onClick={submitGo}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--surface-border)', background: 'var(--surface-card)', color: 'var(--text-heading)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-card)'}>
          {t('go')} <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
