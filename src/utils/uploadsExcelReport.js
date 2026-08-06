import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF214AAB' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const TOTAL_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF7' } };
const THIN_BORDER = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

const STATUS_LABEL = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected' };

function nameOf(first, last, username, fallback = '—') {
  return [first, last].filter(Boolean).join(' ') || username || fallback;
}

function addHeaderRow(sheet, columns) {
  sheet.columns = columns;
  const row = sheet.getRow(1);
  row.values = columns.map(c => c.header);
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = CELL_BORDER;
  });
  row.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function styleDataRow(row, { bold = false, fill = null } = {}) {
  row.eachCell(cell => {
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle' };
    if (bold) cell.font = { bold: true };
    if (fill) cell.fill = fill;
  });
}

/**
 * Builds and downloads a multi-sheet .xlsx report for a set of documents,
 * scoped to one or more departments (any combination) — summary counts,
 * a per-department/per-uploader breakdown, a pending-items list, and the
 * full underlying document list.
 *
 * @param {object} params
 * @param {Array}  params.docs        Documents already scoped to the caller's authorised departments.
 * @param {Array}  params.departments Selected department names to include; empty = every department present in docs.
 * @param {string} params.fileLabel   Short label used in the downloaded filename (e.g. "Admin", "Nodal").
 */
export async function downloadUploadsExcelReport({ docs, departments = [], fileLabel = 'Uploads' }) {
  const selected = new Set(departments.filter(Boolean));
  const scoped = selected.size ? docs.filter(d => selected.has(d.department_name)) : docs;

  const deptNames = selected.size
    ? [...selected]
    : [...new Set(scoped.map(d => d.department_name || 'Unassigned'))].sort((a, b) => a.localeCompare(b));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Haryana Government Digital Repository';
  workbook.created = new Date();

  // ── Sheet 1: Summary ────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');
  addHeaderRow(summarySheet, [
    { header: 'Department', key: 'dept', width: 32 },
    { header: 'Total Uploads', key: 'total', width: 16 },
    { header: 'Approved', key: 'approved', width: 14 },
    { header: 'Pending', key: 'pending', width: 14 },
    { header: 'Rejected', key: 'rejected', width: 14 },
  ]);

  let grandTotal = 0, grandApproved = 0, grandPending = 0, grandRejected = 0;
  for (const dept of deptNames) {
    const deptDocs = scoped.filter(d => (d.department_name || 'Unassigned') === dept);
    const approved = deptDocs.filter(d => d.status === 'approved').length;
    const pending  = deptDocs.filter(d => d.status === 'pending').length;
    const rejected = deptDocs.filter(d => d.status === 'rejected').length;
    grandTotal += deptDocs.length; grandApproved += approved; grandPending += pending; grandRejected += rejected;
    const row = summarySheet.addRow({ dept, total: deptDocs.length, approved, pending, rejected });
    styleDataRow(row);
  }
  if (deptNames.length > 1) {
    const row = summarySheet.addRow({ dept: 'TOTAL', total: grandTotal, approved: grandApproved, pending: grandPending, rejected: grandRejected });
    styleDataRow(row, { bold: true, fill: TOTAL_FILL });
  }

  // ── Sheet 2: By Uploader ────────────────────────────────────────────
  const uploaderSheet = workbook.addWorksheet('By Uploader');
  addHeaderRow(uploaderSheet, [
    { header: 'Department', key: 'dept', width: 28 },
    { header: 'Uploader', key: 'uploader', width: 26 },
    { header: 'Username', key: 'username', width: 18 },
    { header: 'Total Uploaded', key: 'total', width: 16 },
    { header: 'Approved', key: 'approved', width: 12 },
    { header: 'Pending', key: 'pending', width: 12 },
    { header: 'Rejected', key: 'rejected', width: 12 },
  ]);

  for (const dept of deptNames) {
    const deptDocs = scoped.filter(d => (d.department_name || 'Unassigned') === dept);
    const byUploader = new Map();
    for (const d of deptDocs) {
      const key = d.uploader_username || '—';
      if (!byUploader.has(key)) {
        byUploader.set(key, { uploader: nameOf(d.uploader_first_name, d.uploader_last_name, d.uploader_username), username: d.uploader_username || '—', total: 0, approved: 0, pending: 0, rejected: 0 });
      }
      const entry = byUploader.get(key);
      entry.total += 1;
      entry[d.status] = (entry[d.status] || 0) + 1;
    }
    const uploaders = [...byUploader.values()].sort((a, b) => a.uploader.localeCompare(b.uploader));
    for (const u of uploaders) {
      const row = uploaderSheet.addRow({ dept, uploader: u.uploader, username: u.username, total: u.total, approved: u.approved, pending: u.pending, rejected: u.rejected });
      styleDataRow(row);
    }
  }

  // ── Sheet 3: Pending Details ────────────────────────────────────────
  const pendingSheet = workbook.addWorksheet('Pending Details');
  addHeaderRow(pendingSheet, [
    { header: 'Department', key: 'dept', width: 26 },
    { header: 'Document', key: 'doc', width: 40 },
    { header: 'Document Type', key: 'type', width: 20 },
    { header: 'Uploaded By', key: 'uploader', width: 24 },
    { header: 'Uploader Username', key: 'username', width: 18 },
    { header: 'Uploaded On', key: 'date', width: 14 },
  ]);

  const pendingDocs = scoped
    .filter(d => d.status === 'pending')
    .sort((a, b) => (a.department_name || '').localeCompare(b.department_name || '') || (a.uploader_username || '').localeCompare(b.uploader_username || ''));
  for (const d of pendingDocs) {
    const row = pendingSheet.addRow({
      dept: d.department_name || 'Unassigned',
      doc: d.document_name || d.original_filename || '—',
      type: d.document_type_name || '—',
      uploader: nameOf(d.uploader_first_name, d.uploader_last_name, d.uploader_username),
      username: d.uploader_username || '—',
      date: d.created_at ? d.created_at.split('T')[0] : '—',
    });
    styleDataRow(row);
  }
  if (pendingDocs.length === 0) {
    const row = pendingSheet.addRow({ dept: 'No pending documents in the selected scope.' });
    styleDataRow(row);
  }

  // ── Sheet 4: All Documents (full detail) ────────────────────────────
  const allSheet = workbook.addWorksheet('All Documents');
  addHeaderRow(allSheet, [
    { header: 'Department', key: 'dept', width: 26 },
    { header: 'Document', key: 'doc', width: 40 },
    { header: 'Document Type', key: 'type', width: 20 },
    { header: 'Uploaded By', key: 'uploader', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Uploaded On', key: 'date', width: 14 },
    { header: 'Reviewed By', key: 'reviewer', width: 24 },
    { header: 'Reviewed On', key: 'reviewedDate', width: 14 },
  ]);
  const sortedAll = [...scoped].sort((a, b) => (a.department_name || '').localeCompare(b.department_name || '') || (a.created_at || '').localeCompare(b.created_at || ''));
  for (const d of sortedAll) {
    const row = allSheet.addRow({
      dept: d.department_name || 'Unassigned',
      doc: d.document_name || d.original_filename || '—',
      type: d.document_type_name || '—',
      uploader: nameOf(d.uploader_first_name, d.uploader_last_name, d.uploader_username),
      status: STATUS_LABEL[d.status] || d.status || '—',
      date: d.created_at ? d.created_at.split('T')[0] : '—',
      reviewer: d.latest_approval ? nameOf(d.latest_approval.approver_first_name, d.latest_approval.approver_last_name, d.latest_approval.approver_username) : '—',
      reviewedDate: d.latest_approval?.acted_at ? d.latest_approval.acted_at.split('T')[0] : '—',
    });
    styleDataRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const deptSlug = deptNames.length === 1 ? deptNames[0].replace(/[^a-z0-9]+/gi, '_') : `${deptNames.length}_Departments`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileLabel}_Uploads_Report_${deptSlug}_${dateStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
