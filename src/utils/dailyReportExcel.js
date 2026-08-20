import ExcelJS from 'exceljs';

// ── Colour palette (matches screenshot) ──────────────────────────────────────
const C = {
  titleBg:   'FF1B3767',  // dark navy  — title row
  titleFg:   'FFFFFFFF',
  genBg:     'FFD9E8F5',  // light blue — "Generated on" row
  genFg:     'FF1B3767',
  sumBg:     'FFE2EEF9',  // pale blue  — summary row
  sumFg:     'FF1B3767',
  usersBg:   'FF2E75B6',  // medium blue — Active Users group
  usersFg:   'FFFFFFFF',
  dateBg:    'FF538135',  // dark green  — On Date group
  dateFg:    'FFFFFFFF',
  cumBg:     'FF833C00',  // dark brown  — Cumulative group
  cumFg:     'FFFFFFFF',
  headerFg:  'FFFFFFFF',
  totalBg:   'FFDAE3F3',  // light blue  — TOTAL row
  totalFg:   'FF1B3767',
  evenBg:    'FFF2F2F2',  // alternating data rows
  border:    'FFB8CCE4',
};

const thin = (argb) => ({ style: 'thin', color: { argb } });
const border = { top: thin(C.border), left: thin(C.border), bottom: thin(C.border), right: thin(C.border) };

function cell(sheet, addr, value, { bgArgb, fgArgb = 'FF000000', bold = false, size = 10, hAlign = 'center', vAlign = 'middle', wrapText = false, italic = false } = {}) {
  const c = sheet.getCell(addr);
  c.value = value;
  c.font  = { color: { argb: fgArgb }, bold, size, italic };
  c.alignment = { horizontal: hAlign, vertical: vAlign, wrapText };
  c.border = border;
  if (bgArgb) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
  return c;
}

function formatDate(iso) {
  // "2026-08-19" → "19 August 2026"
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function now() {
  return new Date().toLocaleString('en-IN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).replace(/\//g, '-');
}

/**
 * Builds and downloads the daily department report in the standard
 * Haryana Government format (single sheet, merged group headers).
 *
 * @param {string} reportDate  ISO date string YYYY-MM-DD
 * @param {Array}  rows        Rows returned by GET /pdf/report/daily
 */
export async function downloadDailyReportExcel(reportDate, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Haryana Government Digital Repository';
  wb.created = new Date();

  const ws = wb.addWorksheet('Department Report', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // ── Column widths  (A…O = 15 columns) ─────────────────────────────────────
  ws.columns = [
    { key: 'A', width: 7  },   // Sr. No.
    { key: 'B', width: 34 },   // Department
    { key: 'C', width: 11 },   // Uploaders
    { key: 'D', width: 11 },   // Approvers
    { key: 'E', width: 14 },   // Nodal Officers
    { key: 'F', width: 9  },   // Admins
    { key: 'G', width: 12 },   // Total Users
    { key: 'H', width: 11 },   // Uploaded (date)
    { key: 'I', width: 10 },   // Pending  (date)
    { key: 'J', width: 11 },   // Approved (date)
    { key: 'K', width: 10 },   // Rejected (date)
    { key: 'L', width: 11 },   // Uploaded (cum)
    { key: 'M', width: 10 },   // Pending  (cum)
    { key: 'N', width: 11 },   // Approved (cum)
    { key: 'O', width: 10 },   // Rejected (cum)
  ];

  // ── Aggregate totals ───────────────────────────────────────────────────────
  const totalDepts     = rows.length;
  const totalUsers     = rows.reduce((s, r) => s + (r.total_active_users || 0), 0);
  const totUpDate      = rows.reduce((s, r) => s + (r.uploaded_on_date  || 0), 0);
  const totPendDate    = rows.reduce((s, r) => s + (r.pending_on_date   || 0), 0);
  const totAppDate     = rows.reduce((s, r) => s + (r.approved_on_date  || 0), 0);
  const totRejDate     = rows.reduce((s, r) => s + (r.rejected_on_date  || 0), 0);
  const totUpCum       = rows.reduce((s, r) => s + (r.total_uploaded    || 0), 0);
  const totPendCum     = rows.reduce((s, r) => s + (r.total_pending     || 0), 0);
  const totAppCum      = rows.reduce((s, r) => s + (r.total_approved    || 0), 0);
  const totRejCum      = rows.reduce((s, r) => s + (r.total_rejected    || 0), 0);

  const fmtDate = formatDate(reportDate);

  // ── Row 1 — Title ──────────────────────────────────────────────────────────
  ws.mergeCells('A1:O1');
  cell(ws, 'A1',
    `Haryana Government Digital Repository — Department Report  |  ${fmtDate}`,
    { bgArgb: C.titleBg, fgArgb: C.titleFg, bold: true, size: 13 });
  ws.getRow(1).height = 28;

  // ── Row 2 — Generated on ───────────────────────────────────────────────────
  ws.mergeCells('A2:O2');
  cell(ws, 'A2', `Generated on: ${now()}`,
    { bgArgb: C.genBg, fgArgb: C.genFg, italic: true, size: 10, hAlign: 'left' });
  ws.getRow(2).height = 16;

  // ── Row 3 — Summary bar ────────────────────────────────────────────────────
  ws.mergeCells('A3:O3');
  const summary = `Departments: ${totalDepts}   |   Active Users: ${totalUsers}   |   ` +
    `Uploaded today: ${totUpDate}   Pending today: ${totPendDate}   Approved today: ${totAppDate}   Rejected today: ${totRejDate}   |   ` +
    `Total Uploaded: ${totUpCum}   Total Pending: ${totPendCum}   Total Approved: ${totAppCum}   Total Rejected: ${totRejCum}`;
  cell(ws, 'A3', summary,
    { bgArgb: C.sumBg, fgArgb: C.sumFg, bold: false, size: 10, hAlign: 'center' });
  ws.getRow(3).height = 18;

  // ── Row 4 — Group headers (merged) ─────────────────────────────────────────
  ws.mergeCells('A4:A5');   cell(ws, 'A4', 'Sr. No.',    { bgArgb: C.titleBg, fgArgb: C.titleFg, bold: true, size: 10 });
  ws.mergeCells('B4:B5');   cell(ws, 'B4', 'Department', { bgArgb: C.titleBg, fgArgb: C.titleFg, bold: true, size: 10, hAlign: 'center' });
  ws.mergeCells('C4:G4');   cell(ws, 'C4', 'Active Users by Role',   { bgArgb: C.usersBg, fgArgb: C.usersFg, bold: true, size: 10 });
  ws.mergeCells('H4:K4');   cell(ws, 'H4', `On  ${fmtDate}`,         { bgArgb: C.dateBg,  fgArgb: C.dateFg,  bold: true, size: 10 });
  ws.mergeCells('L4:O4');   cell(ws, 'L4', 'Cumulative (up to date)', { bgArgb: C.cumBg,   fgArgb: C.cumFg,   bold: true, size: 10 });
  ws.getRow(4).height = 22;

  // ── Row 5 — Sub-headers ────────────────────────────────────────────────────
  const subHdr = (addr, label, bgArgb, fgArgb) =>
    cell(ws, addr, label, { bgArgb, fgArgb, bold: true, size: 10, wrapText: true });

  subHdr('C5', 'Uploaders',      C.usersBg, C.usersFg);
  subHdr('D5', 'Approvers',      C.usersBg, C.usersFg);
  subHdr('E5', 'Nodal Officers', C.usersBg, C.usersFg);
  subHdr('F5', 'Admins',         C.usersBg, C.usersFg);
  subHdr('G5', 'Total Users',    C.usersBg, C.usersFg);
  subHdr('H5', 'Uploaded',       C.dateBg,  C.dateFg);
  subHdr('I5', 'Pending',        C.dateBg,  C.dateFg);
  subHdr('J5', 'Approved',       C.dateBg,  C.dateFg);
  subHdr('K5', 'Rejected',       C.dateBg,  C.dateFg);
  subHdr('L5', 'Uploaded',       C.cumBg,   C.cumFg);
  subHdr('M5', 'Pending',        C.cumBg,   C.cumFg);
  subHdr('N5', 'Approved',       C.cumBg,   C.cumFg);
  subHdr('O5', 'Rejected',       C.cumBg,   C.cumFg);
  ws.getRow(5).height = 20;

  // ── Freeze panes at row 6 ──────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  // ── Data rows ─────────────────────────────────────────────────────────────
  const numOpts = { hAlign: 'center' };
  rows.forEach((r, i) => {
    const rowNum = 6 + i;
    const bg = i % 2 === 1 ? C.evenBg : null;
    const o = { bgArgb: bg };

    cell(ws, `A${rowNum}`, i + 1,                { ...o, hAlign: 'center' });
    cell(ws, `B${rowNum}`, r.department || '—',   { ...o, hAlign: 'left'   });
    cell(ws, `C${rowNum}`, r.uploaders        || 0, { ...o, ...numOpts });
    cell(ws, `D${rowNum}`, r.approvers        || 0, { ...o, ...numOpts });
    cell(ws, `E${rowNum}`, r.nodal_officers   || 0, { ...o, ...numOpts });
    cell(ws, `F${rowNum}`, r.admins           || 0, { ...o, ...numOpts });
    cell(ws, `G${rowNum}`, r.total_active_users || 0, { ...o, ...numOpts, bold: true });
    cell(ws, `H${rowNum}`, r.uploaded_on_date || 0, { ...o, ...numOpts });
    cell(ws, `I${rowNum}`, r.pending_on_date  || 0, { ...o, ...numOpts });
    cell(ws, `J${rowNum}`, r.approved_on_date || 0, { ...o, ...numOpts });
    cell(ws, `K${rowNum}`, r.rejected_on_date || 0, { ...o, ...numOpts });
    cell(ws, `L${rowNum}`, r.total_uploaded   || 0, { ...o, ...numOpts });
    cell(ws, `M${rowNum}`, r.total_pending    || 0, { ...o, ...numOpts });
    cell(ws, `N${rowNum}`, r.total_approved   || 0, { ...o, ...numOpts });
    cell(ws, `O${rowNum}`, r.total_rejected   || 0, { ...o, ...numOpts });
    ws.getRow(rowNum).height = 16;
  });

  // ── Totals row ─────────────────────────────────────────────────────────────
  const tr = 6 + rows.length;
  const to = { bgArgb: C.totalBg, fgArgb: C.totalFg, bold: true };

  cell(ws, `A${tr}`, '',           { ...to });
  cell(ws, `B${tr}`, 'TOTAL',      { ...to, hAlign: 'left' });
  cell(ws, `C${tr}`, rows.reduce((s, r) => s + (r.uploaders        || 0), 0), { ...to, hAlign: 'center' });
  cell(ws, `D${tr}`, rows.reduce((s, r) => s + (r.approvers        || 0), 0), { ...to, hAlign: 'center' });
  cell(ws, `E${tr}`, rows.reduce((s, r) => s + (r.nodal_officers   || 0), 0), { ...to, hAlign: 'center' });
  cell(ws, `F${tr}`, rows.reduce((s, r) => s + (r.admins           || 0), 0), { ...to, hAlign: 'center' });
  cell(ws, `G${tr}`, totalUsers,   { ...to, hAlign: 'center' });
  cell(ws, `H${tr}`, totUpDate,    { ...to, hAlign: 'center' });
  cell(ws, `I${tr}`, totPendDate,  { ...to, hAlign: 'center' });
  cell(ws, `J${tr}`, totAppDate,   { ...to, hAlign: 'center' });
  cell(ws, `K${tr}`, totRejDate,   { ...to, hAlign: 'center' });
  cell(ws, `L${tr}`, totUpCum,     { ...to, hAlign: 'center' });
  cell(ws, `M${tr}`, totPendCum,   { ...to, hAlign: 'center' });
  cell(ws, `N${tr}`, totAppCum,    { ...to, hAlign: 'center' });
  cell(ws, `O${tr}`, totRejCum,    { ...to, hAlign: 'center' });
  ws.getRow(tr).height = 18;

  // ── Download ───────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Department_Report_${reportDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
