// Act "Contents" outline (Sections/Schedules/Annexures/Appendix/Forms).
//
// TODO: placeholder content until a public (non-authenticated) API exists
// for act-parts data — the real staff-side data lives behind
// services/act_parts.js, which requires a Bearer token citizens don't have.
// Swap getMockActOutline(doc) for a real fetch once that endpoint ships;
// the shape below already mirrors what getActPartSections/getActPartEntries
// return, so callers shouldn't need to change, just the data source.

export const PART_META = {
  sections:  { label: 'Sections',   accent: '#214aab', bg: 'rgba(33, 74, 171,.08)' },
  schedules: { label: 'Schedules',  accent: '#0f766e', bg: 'rgba(20,184,166,.08)' },
  annexures: { label: 'Annexures',  accent: '#7c3aed', bg: 'rgba(139,92,246,.08)' },
  appendix:  { label: 'Appendix',   accent: '#b45309', bg: 'rgba(255,193,7,.1)' },
  forms:     { label: 'Forms',      accent: '#16a34a', bg: 'rgba(25,135,84,.08)' },
};

export function getMockActOutline(doc) {
  return {
    sections: {
      chapters: [
        { title: 'Preliminary', sections: [
          { title: 'Short title, extent and commencement', page: 1,
            content: `(1) This Act may be called the ${doc.title}.\n(2) It extends to the whole of the State of Haryana.\n(3) It shall come into force on such date as the State Government may, by notification in the Official Gazette, appoint.` },
          { title: 'Definitions and interpretation', page: 1,
            content: 'In this Act, unless the context otherwise requires — (a) "appointed day" means the date on which this Act comes into force; (b) "prescribed" means prescribed by rules made under this Act; (c) "State Government" means the Government of Haryana.' },
        ] },
        { title: `Administration of the ${doc.title}`, sections: [
          { title: 'Constitution of the governing authority', page: 2,
            content: 'The State Government shall, by notification, constitute an authority for carrying out the purposes of this Act, consisting of a Chairperson and such other members as may be prescribed.' },
          { title: 'Powers and functions', page: 2,
            content: 'The authority constituted under section 3 shall exercise such powers and perform such functions as are assigned to it under this Act or the rules made thereunder.' },
          { title: 'Term of office', page: 3,
            content: 'The Chairperson and every member of the authority shall hold office for a term of three years from the date of appointment and shall be eligible for re-appointment.' },
        ] },
        { title: 'Miscellaneous', sections: [
          { title: 'Power to make rules', page: 4,
            content: 'The State Government may, by notification, make rules for carrying out the purposes of this Act.' },
          { title: 'Repeal and savings', page: 4,
            content: 'Any law corresponding to this Act in force immediately before the commencement of this Act is hereby repealed; provided that such repeal shall not affect anything done or any action taken under the law so repealed.' },
        ] },
      ],
    },
    schedules: [{ title: 'First Schedule — Forms of Declaration', page: 5, content: 'Prescribed forms for declarations to be filed under section 4, to be furnished in the manner specified by the authority.' }],
    annexures: [],
    appendix:  [],
    forms:     [{ title: 'Form A — Application for Registration', page: 6, content: 'Application form for registration under this Act, to be submitted in duplicate along with the prescribed fee.' }],
  };
}

// Other document types issued *under* this Act (its Rules, Amendments,
// Notifications etc.) — the badge row at the top of ActContentsView. Only
// types with at least one related document are returned; callers should not
// render a badge for anything not present here (no greyed-out placeholders).
export function getMockRelatedDocTypes(doc) {
  return {
    'Rules & Regulations': [{ title: `${doc.title} — Rules, 2024` }],
    'Amendment':           [{ title: `${doc.title} (Amendment) Act, 2023` }],
    'Notification':        [{ title: 'Notification regarding commencement date' }, { title: 'Notification — Fee Revision' }],
  };
}
