// Maps the response of GET /pdf/{act_id}/full into the shapes ActContentsView
// and DocViewModal render — kept separate from the API response's own field
// names (chapter_title/section_content/entry_number/etc.) so the UI code
// doesn't need to know the API's naming.

// Schedules/annexures/appendices/forms can each carry their own uploaded
// attachment (separate from the parent Act's own PDF) — file_ref is what
// downloadActPartFile() needs to fetch it; null when this entry has none.
function mapEntry(e) {
  return {
    title: e.title || e.entry_number || '',
    content: e.description || '',
    fileRef: e.file_ref || null,
    fileName: e.original_filename || null,
  };
}

// `act_parts.chapters[]` (when has_chapters) or `act_parts.flat_sections[]`
// (when the Act has no chapter grouping) → { sections: { chapters, isFlat }, schedules, annexures, appendix, forms }.
// A flat Act is represented as a single chapter with title:null so the reader
// can skip the "CHAPTER N" pill/rail for it while reusing the same render path.
export function mapActPartsToOutline(actParts) {
  let chapters = [];
  if (actParts?.has_chapters && actParts.chapters?.length) {
    chapters = actParts.chapters.map(ch => ({
      title: ch.chapter_title || ch.chapter_number || '',
      sections: (ch.sections || []).map(s => ({
        title: s.section_title || s.section_number || '',
        content: s.section_content || '',
      })),
    }));
  } else if (actParts?.flat_sections?.length) {
    chapters = [{
      title: null,
      sections: actParts.flat_sections.map(s => ({
        title: s.section_title || s.section_number || '',
        content: s.section_content || '',
      })),
    }];
  }
  return {
    sections:  { chapters, isFlat: chapters.length === 1 && chapters[0].title === null },
    schedules: (actParts?.schedules  || []).map(mapEntry),
    annexures: (actParts?.annexures  || []).map(mapEntry),
    appendix:  (actParts?.appendices || []).map(mapEntry),
    forms:     (actParts?.forms      || []).map(mapEntry),
  };
}

// `related_documents` (object keyed by the related document's own type, e.g.
// `{ Amendment: [...], Circular: [...] }`, each entry a full document record)
// → the same grouping, minus entries whose `relationship_type` is
// `parent_act` — that's this Act's own parent, not something published
// under it. Each item keeps every field the API sent (status, dates, gazette
// ref, legal authority, description, summary, …) so the UI can show full
// detail without a second fetch per related document.
export function mapRelationships(relatedDocuments) {
  const groups = {};
  for (const [type, items] of Object.entries(relatedDocuments || {})) {
    const filtered = (items || []).filter(it => it.relationship_type !== 'parent_act');
    if (filtered.length) groups[type] = filtered;
  }
  return groups;
}

// 'amended_by' -> 'Amended By'
export function humanizeRelationType(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
