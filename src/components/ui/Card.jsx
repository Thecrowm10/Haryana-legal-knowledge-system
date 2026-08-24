export default function Card({ children, style = {}, className = '', padding = '20px 22px', onClick, ...rest }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } }) : undefined}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--card-shadow)',
        padding,
        ...style,
      }} className={className} {...rest}>
      {children}
    </div>
  );
}
