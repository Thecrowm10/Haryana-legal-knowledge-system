export default function Card({ children, style = {}, className = '', padding = '20px 22px' }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--card-shadow)',
      padding,
      ...style,
    }} className={className}>
      {children}
    </div>
  );
}
