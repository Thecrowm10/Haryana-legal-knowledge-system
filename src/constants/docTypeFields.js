// Canonical type-specific field keys per document type — the single source of
// truth for which typeFields keys belong to a given document type. Used by
// the Uploader's Edit form AND every document-detail viewer (DocViewModal,
// ApproverDashboard's DocumentDetailsPanel), so a document always shows every
// field relevant to its own type — blank if not filled in, but never fields
// that belong to a different type. inputType is only meaningful for the edit
// form; viewers only need the key.
export const TYPE_SPECIFIC_FIELD_KEYS = {
  'Act': [
    { key: 'actYear', inputType: 'number' },
    { key: 'longTitle', inputType: 'text' },
    { key: 'regionalTitle', inputType: 'text' },
    { key: 'notificationNo', inputType: 'text' },
    { key: 'actCode', inputType: 'text' },
    { key: 'soReason', inputType: 'text' },
    { key: 'noOfRules', inputType: 'number' },
    { key: 'noOfNotifications', inputType: 'number' },
    { key: 'noOfRegulations', inputType: 'number' },
    { key: 'noOfCirculars', inputType: 'number' },
    { key: 'noOfStatutes', inputType: 'number' },
    { key: 'noOfOrdinances', inputType: 'number' },
    { key: 'noOfOrders', inputType: 'number' },
    { key: 'keywords', inputType: 'text' },
    { key: 'repealed', inputType: 'checkbox' },
  ],
  'Amendment': [],
  'Circular': [{ key: 'validity', inputType: 'date' }],
  'Notification': [],
  'Order/Gazette': [],
  'Policy': [
    { key: 'sector', inputType: 'text' },
    { key: 'implementingAgency', inputType: 'text' },
    { key: 'reviewDate', inputType: 'date' },
  ],
  'Rules & Regulations': [{ key: 'ruleAuthority', inputType: 'text' }],
  'Bye Laws': [{ key: 'ruleAuthority', inputType: 'text' }],
  'Miscellaneous': [{ key: 'validity', inputType: 'date' }],
};
