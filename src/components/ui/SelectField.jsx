import { useState, useRef, useEffect, Children } from 'react';
import { ChevronDown, Check } from 'lucide-react';

function parseOptions(children) {
  return Children.toArray(children)
    .filter(c => c.type === 'option')
    .map(c => ({
      value: c.props.value !== undefined ? String(c.props.value) : String(c.props.children),
      label: c.props.children,
    }));
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
  right: 0,
  zIndex: 600,
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1.5px solid rgba(255,255,255,0.8)',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
  maxHeight: 168,
  overflowY: 'auto',
  animation: 'dropdownIn .15s cubic-bezier(.2,.8,.3,1)',
};

export default function SelectField({ id, value, onChange, required, placeholder, children, style = {} }) {
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const options           = parseOptions(children);
  const selected          = options.find(o => o.value === String(value ?? ''));

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function pick(val) {
    onChange({ target: { value: val } });
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...TRIGGER,
          color: selected ? 'var(--text-color)' : 'var(--text-color-secondary)',
          fontWeight: selected ? 500 : 400,
          borderColor: open ? 'var(--primary)' : 'var(--surface-border)',
          boxShadow: open ? '0 0 0 3px rgba(33, 74, 171,.1)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (placeholder || 'Select...')}
        </span>
        <ChevronDown
          size={15} strokeWidth={2}
          style={{
            flexShrink: 0,
            color: 'var(--text-color-secondary)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .2s',
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={PANEL}>
          {options.map((opt) => {
            const isActive = opt.value === String(value ?? '');
            return (
              <div
                key={opt.value}
                onMouseDown={() => pick(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: 'var(--font)',
                  color: isActive ? 'var(--primary)' : 'var(--text-color)',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background .12s',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(33, 74, 171,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>{opt.label}</span>
                {isActive && <Check size={13} strokeWidth={2.5} color="var(--primary)" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden native select for browser form validation */}
      {required && (
        <select
          value={value ?? ''} onChange={onChange} required tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: 'none' }}
        >
          <option value="" />
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
}
