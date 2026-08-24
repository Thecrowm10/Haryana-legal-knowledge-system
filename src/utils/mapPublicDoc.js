export function cleanFilename(filename) {
  if (!filename) return 'Document';
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

// Opens the raw PDF straight in a new browser tab — the browser's own native
// PDF viewer (search, print, download, thumbnails all built in) rather than
// our custom in-app DocViewModal. Same endpoint DocViewModal itself fetches
// bytes from; hitting it directly needs no auth header for a citizen guest
// (no token is ever attached for that role), so a plain navigation works.
export function openPdfInNewTab(id) {
  window.open(`/api/v1/pdf/${id}/file`, '_blank', 'noopener,noreferrer');
}

// Triggers an actual file download (browser's save dialog / downloads folder)
// rather than opening the PDF for viewing — a temporary same-origin <a download>
// is enough for the browser to save it instead of navigating to it.
export function downloadPdf(id, filename) {
  const a = document.createElement('a');
  a.href = `/api/v1/pdf/${id}/file`;
  a.download = filename || `document-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Downloads a schedule/annexure/appendix/form entry's own attached file
// (separate from the parent Act's own PDF) by its file_ref, using the same
// <a download> technique as downloadPdf() above.
export function downloadActPartFile(fileRef, filename) {
  const a = document.createElement('a');
  a.href = `/api/v1/act-parts/file/${encodeURIComponent(fileRef)}`;
  a.download = filename || fileRef;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Same idea as openPdfInNewTab() above, but for a schedule/annexure/appendix/
// form entry's own attached file rather than the parent Act's PDF.
export function openActPartFileInNewTab(fileRef) {
  window.open(`/api/v1/act-parts/file/${encodeURIComponent(fileRef)}`, '_blank', 'noopener,noreferrer');
}

// Maps a public document record (from /pdf/public/search or /pdf/{id}/full)
// into the shape DocViewModal expects — same field names the authenticated
// dashboards read (mapApiDoc/mapDocForViewer), so every filled-in field from
// upload shows up here too, not just the filename. Deliberately omits
// uploader identity and internal approval/review details — those are internal
// workflow info, not for public display.
export function mapPublicDocForViewer(d) {
  return {
    id:              d.id,
    title:           d.document_name || cleanFilename(d.original_filename),
    type:            d.document_type_name || 'Miscellaneous',
    dept:            d.department_name || '',
    year:            d.issue_date ? new Date(d.issue_date).getFullYear() : (d.created_at ? new Date(d.created_at).getFullYear() : '—'),
    version:         d.version_no || '1.0',
    status:          d.status || 'approved',
    desc:            d.description || '',
    fileName:        d.original_filename || '',
    uploadedAt:      d.created_at?.split('T')[0] || '',
    referenceNumber: d.reference_number || null,
    enactmentDate:   d.issue_date?.split('T')[0] || null,
    effectiveFrom:   d.effective_from?.split('T')[0] || null,
    gazette:         d.gazette_reference || null,
    authority:       d.legal_authority || null,
    shortTitle:      d.short_title || null,
    typeFields: {
      ...(d.valid_until           ? { validity:           d.valid_until }           : {}),
      ...(d.sector_domain         ? { sector:             d.sector_domain }         : {}),
      ...(d.implementing_agency   ? { implementingAgency: d.implementing_agency }   : {}),
      ...(d.next_review_date      ? { reviewDate:         d.next_review_date }      : {}),
      ...(d.rule_making_authority ? { ruleAuthority:      d.rule_making_authority } : {}),
      ...(d.act_year              ? { actYear:            d.act_year }              : {}),
      ...(d.long_title            ? { longTitle:          d.long_title }            : {}),
      ...(d.regional_title        ? { regionalTitle:      d.regional_title }        : {}),
      ...(d.notification_no       ? { notificationNo:     d.notification_no }       : {}),
      ...(d.act_code              ? { actCode:            d.act_code }              : {}),
      ...(d.so_reason             ? { soReason:           d.so_reason }             : {}),
      ...(d.no_of_rules           ? { noOfRules:          d.no_of_rules }           : {}),
      ...(d.no_of_notifications   ? { noOfNotifications:  d.no_of_notifications }   : {}),
      ...(d.no_of_regulations     ? { noOfRegulations:    d.no_of_regulations }     : {}),
      ...(d.no_of_circulars       ? { noOfCirculars:      d.no_of_circulars }       : {}),
      ...(d.no_of_statutes        ? { noOfStatutes:       d.no_of_statutes }        : {}),
      ...(d.no_of_ordinances      ? { noOfOrdinances:     d.no_of_ordinances }      : {}),
      ...(d.no_of_orders          ? { noOfOrders:         d.no_of_orders }          : {}),
      ...(d.keywords              ? { keywords:           d.keywords }              : {}),
    },
  };
}
