// Shared colour/badge styling per document type — used by CitizenDashboard's
// search results and ActContentsView's "related documents" badge row, so a
// document type reads as the same colour everywhere in the citizen-facing UI.
export const DOC_TYPE_META = {
  'Act':                 { color: '#214aab', bg: 'rgba(33, 74, 171,.1)',   border: 'rgba(33, 74, 171,.25)' },
  'Amendment':           { color: '#d97706', bg: 'rgba(217,119,6,.1)',   border: 'rgba(217,119,6,.25)' },
  'Notification':        { color: '#7c3aed', bg: 'rgba(124,58,237,.1)',  border: 'rgba(124,58,237,.25)' },
  'Circular':            { color: '#0f766e', bg: 'rgba(20,184,166,.1)',  border: 'rgba(20,184,166,.25)' },
  'Policy':              { color: '#16a34a', bg: 'rgba(25, 135, 84,.1)',   border: 'rgba(25, 135, 84,.25)' },
  'Rules & Regulations': { color: '#dc2626', bg: 'rgba(220,38,38,.1)',  border: 'rgba(220,38,38,.25)' },
  'Order/Gazette':       { color: '#a16207', bg: 'rgba(234,179,8,.1)',   border: 'rgba(234,179,8,.25)' },
};
