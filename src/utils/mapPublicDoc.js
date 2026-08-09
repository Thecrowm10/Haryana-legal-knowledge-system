export function cleanFilename(filename) {
  if (!filename) return 'Document';
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
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
