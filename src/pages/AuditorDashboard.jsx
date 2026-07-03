import { useState } from 'react';
import { ClipboardList, FileSearch, BarChart2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const LABEL = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-color-secondary)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--mono)' };


const roleLabel = role => role === 'citizen' ? 'Guest' : role;

const MOCK_AUDIT = [
  { time: '2026-05-25 10:42', user: 'Priya Sharma', role: 'uploader', action: 'Uploaded document: Haryana Municipal Act 2024',         aiGenerated: false },
  { time: '2026-05-25 10:18', user: 'Sunil Verma',  role: 'approver', action: 'Approved: Punjab Land Revenue Act Amendment',            aiGenerated: false },
  { time: '2026-05-25 09:55', user: 'Guest',         role: 'citizen',  action: 'Searched: "factory license renewal rules"',             aiGenerated: false },
  { time: '2026-05-25 09:30', user: 'Anita Singh',  role: 'csoffice', action: 'Viewed analytics dashboard',                            aiGenerated: false },
  { time: '2026-05-24 17:12', user: 'Sunil Verma',  role: 'approver', action: 'Rejected: Draft Notification — missing metadata',       aiGenerated: false },
  { time: '2026-05-24 16:45', user: 'Guest',         role: 'citizen',  action: 'Searched: "land acquisition compensation"',             aiGenerated: false },
  { time: '2026-05-24 15:30', user: 'Deepa Nair',   role: 'auditor',  action: 'Exported audit log (CSV)',                              aiGenerated: false },
  { time: '2026-05-24 14:10', user: 'Harish Gupta', role: 'approver', action: 'Approved: Excise Policy Circular 2026',                 aiGenerated: false },
  { time: '2026-05-23 11:20', user: 'Guest',         role: 'citizen',  action: 'Searched: "building bye-laws Panchkula"',               aiGenerated: false },
  { time: '2026-05-23 10:05', user: 'Priya Sharma', role: 'uploader', action: 'Uploaded document: Labour Welfare Fund Rules 2025',     aiGenerated: false },
];

const MOCK_QUERIES = [
  { time: '2026-05-25 10:55', userType: 'citizen',  query: 'factory license renewal rules',       results: 4, pointers: 'Haryana Factories Act §12, §14' },
  { time: '2026-05-25 09:42', userType: 'citizen',  query: 'land acquisition compensation',       results: 7, pointers: 'LARR Act 2013 §26, §27, §28' },
  { time: '2026-05-24 16:30', userType: 'csoffice', query: 'municipal solid waste rules',         results: 3, pointers: 'SWM Rules 2016 §4' },
  { time: '2026-05-24 14:55', userType: 'citizen',  query: 'building bye-laws Panchkula',         results: 2, pointers: 'Haryana Building Code §8.2' },
  { time: '2026-05-23 11:10', userType: 'citizen',  query: 'excise duty rates liquor 2026',       results: 5, pointers: 'Excise Policy 2026 §3.1, §3.2' },
  { time: '2026-05-23 09:00', userType: 'approver', query: 'notification amendment procedure',    results: 6, pointers: 'General Clauses Act §21' },
];

const COMPLIANCE_MONTHS = [
  { month: 'Feb 2026', totalQueries: 210, aiCharacters: 0, compliant: true  },
  { month: 'Mar 2026', totalQueries: 284, aiCharacters: 0, compliant: true  },
  { month: 'Apr 2026', totalQueries: 341, aiCharacters: 0, compliant: true  },
  { month: 'May 2026', totalQueries: 143, aiCharacters: 0, compliant: true  },
];

function exportCSV(data, filename) {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AuditorDashboard({ activePage }) {

  // ── Audit Log ────────────────────────────────────────────────────────────
  if (activePage === 'auditlog') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Total Log Entries', value: MOCK_AUDIT.length,                           color: 'var(--primary)', bg: 'rgba(26,86,219,.12)',  icon: ClipboardList },
            { label: 'AI Characters Generated', value: '0',                                   color: '#22c55e',        bg: 'rgba(34,197,94,.12)',  icon: CheckCircle   },
            { label: 'Compliance Status',  value: '100%',                                     color: '#22c55e',        bg: 'rgba(34,197,94,.12)',  icon: CheckCircle   },
          ].map(s => (
            <Card key={s.label}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={20} color={s.color} strokeWidth={1.8} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>System Audit Log</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>Read-only · Tamper-evident · Append-only</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => exportCSV(MOCK_AUDIT, 'audit-log.csv')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={13} /> Export CSV
              </button>
              <button onClick={() => exportCSV(MOCK_AUDIT, 'audit-log.json')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                <Download size={13} /> Export JSON
              </button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Timestamp', 'User', 'Role', 'Action', 'AI Generated'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{log.time}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{log.user}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={roleLabel(log.role)} variant={log.role} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color)' }}>{log.action}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#1e40af' }}>
                      <CheckCircle size={13} /> None
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ── Query History ────────────────────────────────────────────────────────
  if (activePage === 'queryhistory') {
    return (
      <div style={{ animation: 'fadeSlideIn .3s ease' }}>
        <Card padding="0">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Search Query History</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-color-secondary)', marginTop: 2 }}>Guests anonymised · No AI text in any response</div>
            </div>
            <button onClick={() => exportCSV(MOCK_QUERIES, 'query-history.csv')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-ground)', color: 'var(--text-color)', border: '1px solid var(--surface-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Timestamp', 'User Type', 'Query', 'Results', 'Document Pointers Returned'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_QUERIES.map((q, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-color-secondary)', whiteSpace: 'nowrap' }}>{q.time}</td>
                  <td style={{ padding: '12px 16px' }}><Badge label={roleLabel(q.userType)} variant={q.userType} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-color)', fontStyle: 'italic' }}>"{q.query}"</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--primary)', textAlign: 'center' }}>{q.results}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-color-secondary)', fontFamily: 'var(--mono)' }}>{q.pointers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ── Compliance Report ────────────────────────────────────────────────────
  if (activePage === 'compliance') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease' }}>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 10, marginBottom: 20 }}>
            <CheckCircle size={22} color="#22c55e" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Zero Generation Compliance — PASSED</div>
              <div style={{ fontSize: 12.5, color: '#166534', marginTop: 2 }}>No AI-generated text was present in any system response. All results are verbatim document pointers only.</div>
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 14 }}>Monthly Compliance Summary</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--surface-border)' }}>
                {['Month', 'Total Queries Sampled', 'AI Characters in Responses', 'Status'].map(h => (
                  <th key={h} style={{ ...LABEL, padding: '11px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPLIANCE_MONTHS.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{m.month}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-color)' }}>{m.totalQueries}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{m.aiCharacters}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', fontSize: 11.5, fontWeight: 700, color: '#1e40af' }}>
                      <CheckCircle size={12} /> Compliant
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>Compliance Certificate</div>
            <button onClick={() => alert('Generating compliance report PDF...')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> Download Report
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-color-secondary)', lineHeight: 1.8 }}>
            This report certifies that the Haryana Legal Knowledge System has operated in full compliance with the <strong>Zero Generation Constraint</strong> (TOR Module B, Requirement B-04 to B-08). All search results returned during the audit period contained exclusively verbatim document pointers with no AI-generated textual content.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
            {[['Audit Period','Feb – May 2026'],['Total Queries Reviewed','978'],['AI Violations Found','0'],['Compliance Rate','100%']].map(([k,v]) => (
              <div key={k}>
                <div style={{ ...LABEL, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--mono)' }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
