const STYLES = {
  approved: { bg: 'rgba(25, 135, 84,.1)',   color: '#1e40af', border: 'rgba(25, 135, 84,.25)' },
  pending:  { bg: 'rgba(255, 193, 7,.1)',  color: '#b45309', border: 'rgba(255, 193, 7,.25)' },
  rejected: { bg: 'rgba(220, 53, 69,.1)',   color: '#b91c1c', border: 'rgba(220, 53, 69,.25)' },
  draft:    { bg: 'rgba(100, 116, 139,.1)', color: '#64748b', border: 'rgba(100, 116, 139,.25)' },
  citizen:  { bg: 'rgba(33, 74, 171,.1)',   color: '#214aab', border: 'rgba(33, 74, 171,.25)' },
  uploader: { bg: 'rgba(13, 110, 253,.1)',  color: '#1d4ed8', border: 'rgba(13, 110, 253,.25)' },
  approver: { bg: 'rgba(255, 193, 7,.1)',  color: '#b45309', border: 'rgba(255, 193, 7,.25)' },
  csoffice: { bg: 'rgba(25, 135, 84,.1)',   color: '#1e40af', border: 'rgba(25, 135, 84,.25)' },
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
