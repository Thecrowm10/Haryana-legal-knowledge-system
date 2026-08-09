// Part-tab metadata for the Act "Contents" reading view (Sections/Schedules/
// Annexures/Appendix/Forms). Actual outline data comes from GET
// /pdf/{act_id}/full (see src/utils/actFull.js for the response mapping).

export const PART_META = {
  sections:  { label: 'Sections',   accent: '#214aab', bg: 'rgba(33, 74, 171,.08)' },
  schedules: { label: 'Schedules',  accent: '#0f766e', bg: 'rgba(20,184,166,.08)' },
  annexures: { label: 'Annexures',  accent: '#7c3aed', bg: 'rgba(139,92,246,.08)' },
  appendix:  { label: 'Appendix',   accent: '#b45309', bg: 'rgba(255,193,7,.1)' },
  forms:     { label: 'Forms',      accent: '#16a34a', bg: 'rgba(25,135,84,.08)' },
};
