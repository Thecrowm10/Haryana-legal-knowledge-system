import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export default function MultiSelectField({ id, value = [], onChange, options = [], placeholder = 'Select...', selectedLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggle(id) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  }

  const selectedOptions = options.filter(o => value.includes(o.id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button id={id} type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px 10px 14px', fontFamily: 'var(--font)', fontSize: 13,
        borderRadius: 8, background: 'var(--surface-ground)',
        border: `1px solid ${open ? 'var(--primary)' : 'var(--surface-border)'}`,
        boxShadow: open ? '0 0 0 3px rgba(33, 74, 171,.1)' : 'none',
        cursor: 'pointer', outline: 'none', textAlign: 'left',
        color: selectedOptions.length ? 'var(--text-color)' : 'var(--text-color-secondary)',
        transition: 'border-color .2s, box-shadow .2s',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOptions.length === 0
            ? placeholder
            : selectedOptions.length === 1
            ? selectedOptions[0].name
            : (selectedLabel ? selectedLabel(selectedOptions.length) : `${selectedOptions.length} selected`)}
        </span>
        <ChevronDown size={15} strokeWidth={2} style={{
          flexShrink: 0, color: 'var(--text-color-secondary)',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
        }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 600,
          background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255,255,255,.8)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.95)',
          maxHeight: 200, overflowY: 'auto', animation: 'dropdownIn .15s cubic-bezier(.2,.8,.3,1)',
        }}>
          {options.map(opt => {
            const isChecked = value.includes(opt.id);
            return (
              <div key={opt.id} onMouseDown={() => toggle(opt.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font)',
                color: isChecked ? 'var(--primary)' : 'var(--text-color)',
                fontWeight: isChecked ? 600 : 400, cursor: 'pointer',
                transition: 'background .12s', background: 'transparent',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--surface-border)'}`,
                  background: isChecked ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s, border-color .15s',
                }}>
                  {isChecked && <Check size={9} color="white" strokeWidth={3} />}
                </div>
                {opt.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected tags */}
      {selectedOptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {selectedOptions.map(o => (
            <span key={o.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 6px 3px 10px', borderRadius: 20,
              background: 'rgba(33, 74, 171,.1)', border: '1px solid rgba(33, 74, 171,.2)',
              fontSize: 11.5, color: 'var(--primary)', fontWeight: 600,
            }}>
              {o.name}
              <button type="button" onMouseDown={e => { e.stopPropagation(); toggle(o.id); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary)', display: 'flex', padding: '1px',
              }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
