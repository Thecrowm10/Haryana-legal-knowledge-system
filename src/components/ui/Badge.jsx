const STYLES = {
  approved: { bg: 'rgba(34,197,94,.1)',   color: '#15803d', border: 'rgba(34,197,94,.25)' },
  pending:  { bg: 'rgba(245,158,11,.1)',  color: '#b45309', border: 'rgba(245,158,11,.25)' },
  rejected: { bg: 'rgba(239,68,68,.1)',   color: '#b91c1c', border: 'rgba(239,68,68,.25)' },
  citizen:  { bg: 'rgba(26,107,60,.1)',   color: '#1A6B3C', border: 'rgba(26,107,60,.25)' },
  uploader: { bg: 'rgba(59,130,246,.1)',  color: '#1d4ed8', border: 'rgba(59,130,246,.25)' },
  approver: { bg: 'rgba(245,158,11,.1)',  color: '#b45309', border: 'rgba(245,158,11,.25)' },
  csoffice: { bg: 'rgba(34,197,94,.1)',   color: '#15803d', border: 'rgba(34,197,94,.25)' },
};

export default function Badge({ label, variant }) {
  const s = STYLES[variant?.toLowerCase()] || { bg: 'var(--surface-100)', color: 'var(--text-color-secondary)', border: 'var(--surface-200)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '.04em',
      textTransform: 'uppercase', fontFamily: 'var(--mono)',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}
