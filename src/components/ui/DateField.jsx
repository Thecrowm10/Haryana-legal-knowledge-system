import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date) {
  return `${pad2(date.getDate())}-${MONTH_NAMES[date.getMonth()].slice(0, 3)}-${date.getFullYear()}`;
}

function isSameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBeforeDay(a, b) {
  return new Date(a.getFullYear(), a.getMonth(), a.getDate()) < new Date(b.getFullYear(), b.getMonth(), b.getDate());
}

function isAfterDay(a, b) {
  return new Date(a.getFullYear(), a.getMonth(), a.getDate()) > new Date(b.getFullYear(), b.getMonth(), b.getDate());
}

function isDisabled(date, min, max) {
  if (min && isBeforeDay(date, min)) return true;
  if (max && isAfterDay(date, max)) return true;
  return false;
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return cells;
}

const TRIGGER = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 12px 10px 14px',
  fontFamily: 'var(--font)',
  fontSize: 13,
  borderRadius: 8,
  background: 'var(--surface-ground)',
  border: '1px solid var(--surface-border)',
  boxShadow: 'none',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color .2s, box-shadow .2s',
  textAlign: 'left',
};

const PANEL = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 600,
  width: 264,
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1.5px solid rgba(255,255,255,0.8)',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
  padding: 12,
  animation: 'dropdownIn .15s cubic-bezier(.2,.8,.3,1)',
};

const YEAR_RANGE_BACK = 150;
const YEAR_RANGE_FWD = 10;

const NAV_BTN = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, flexShrink: 0,
  border: '1px solid var(--surface-border)', borderRadius: 8,
  background: 'var(--surface-ground)', cursor: 'pointer',
  color: 'var(--text-color)', transition: 'background .12s, border-color .12s',
};

function chipStyle(active) {
  return {
    padding: '6px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
    border: '1px solid ' + (active ? 'var(--primary)' : 'var(--surface-border)'),
    borderRadius: 8, cursor: 'pointer',
    color: active ? 'var(--primary)' : 'var(--text-color)',
    background: active ? 'rgba(33, 74, 171,.08)' : 'var(--surface-ground)',
    transition: 'background .12s, border-color .12s',
  };
}

export default function DateField({ id, value, onChange, required, min, max, placeholder, style = {}, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null); // null | 'month' | 'year'
  const ref = useRef(null);
  const yearListRef = useRef(null);
  const selected = parseISO(value);
  const minDate = parseISO(min);
  const maxDate = parseISO(max);
  const today = new Date();

  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());

  function openPicker() {
    const base = selected || today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setMenu(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (menu !== 'year' || !yearListRef.current) return;
    const activeBtn = yearListRef.current.querySelector('[data-active="true"]');
    activeBtn?.scrollIntoView({ block: 'center' });
  }, [menu]);

  function pick(date) {
    onChange({ target: { value: toISO(date) } });
    setOpen(false);
  }

  function prevMonth() {
    setMenu(null);
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function nextMonth() {
    setMenu(null);
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const cells = buildMonthGrid(viewYear, viewMonth);
  const yearOptions = [];
  if (menu === 'year') {
    for (let y = today.getFullYear() + YEAR_RANGE_FWD; y >= today.getFullYear() - YEAR_RANGE_BACK; y--) {
      yearOptions.push(y);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        onClick={() => { if (disabled) return; open ? setOpen(false) : openPicker(); }}
        disabled={disabled}
        style={{
          ...TRIGGER,
          ...style,
          width: '100%',
          color: selected ? 'var(--text-color)' : 'var(--text-color-secondary)',
          fontWeight: selected ? 500 : 400,
          borderColor: open ? 'var(--primary)' : 'var(--surface-border)',
          boxShadow: open ? '0 0 0 3px rgba(33, 74, 171,.1)' : 'none',
          background: disabled ? 'var(--surface-border)' : 'var(--surface-ground)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? formatDisplay(selected) : (placeholder || 'Select date...')}
        </span>
        <Calendar
          size={15} strokeWidth={2}
          style={{ flexShrink: 0, color: 'var(--text-color-secondary)' }}
        />
      </button>

      {/* Calendar popup */}
      {open && (
        <div style={PANEL}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={prevMonth}
              style={NAV_BTN}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setMenu(m => m === 'month' ? null : 'month')}
                style={chipStyle(menu === 'month')}
              >
                {MONTH_NAMES[viewMonth]}
              </button>
              <button
                type="button"
                onClick={() => setMenu(m => m === 'year' ? null : 'year')}
                style={chipStyle(menu === 'year')}
              >
                {viewYear}
              </button>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              style={NAV_BTN}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-ground)'}
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>

          {menu === 'month' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {Array.from({ length: 12 }, (_, m) => m).map(m => {
                const isActive = m === viewMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setViewMonth(m); setMenu(null); }}
                    style={{
                      padding: '10px 0',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--font)', fontSize: 13, fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'var(--text-color)',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {MONTH_NAMES[m].slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {menu === 'year' && (
            <div ref={yearListRef} style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {yearOptions.map(y => {
                const isActive = y === viewYear;
                return (
                  <button
                    key={y}
                    type="button"
                    data-active={isActive}
                    onClick={() => { setViewYear(y); setMenu(null); }}
                    style={{
                      padding: '8px 10px', textAlign: 'left',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--font)', fontSize: 13, fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'var(--text-color)',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {!menu && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
                {WEEKDAYS.map(w => (
                  <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-color-secondary)', padding: '4px 0' }}>
                    {w}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((date, i) => {
                  const inMonth = date.getMonth() === viewMonth;
                  const isSelected = isSameDay(date, selected);
                  const isToday = isSameDay(date, today);
                  const disabledCell = isDisabled(date, minDate, maxDate);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabledCell}
                      onClick={() => pick(date)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        border: 'none',
                        borderRadius: '50%',
                        fontFamily: 'var(--font)',
                        fontSize: 12,
                        fontWeight: isSelected ? 600 : 400,
                        color: disabledCell ? 'var(--text-color-secondary)' : isSelected ? '#fff' : !inMonth ? 'var(--text-color-secondary)' : 'var(--text-color)',
                        opacity: disabledCell ? 0.4 : !inMonth ? 0.5 : 1,
                        background: isSelected ? 'var(--primary)' : isToday ? 'rgba(33, 74, 171,.12)' : 'transparent',
                        cursor: disabledCell ? 'not-allowed' : 'pointer',
                        transition: 'background .12s',
                      }}
                      onMouseEnter={e => { if (!disabledCell && !isSelected) e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'; }}
                      onMouseLeave={e => { if (!disabledCell && !isSelected) e.currentTarget.style.background = isToday ? 'rgba(33, 74, 171,.12)' : 'transparent'; }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden native input for browser form validation */}
      {required && (
        <input
          type="date" value={value ?? ''} onChange={onChange} required tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
