// Fallback PDF page renderer used only when pdfjs-dist's own page.render()
// has already failed (e.g. a JBig2-encoded scanned image pdf.js's decoder
// can't handle — a known, currently-unfixed pdf.js limitation, not a version
// issue: this app is already on the latest pdfjs-dist release).
//
// PDFium (the engine Chrome itself uses natively) decodes JBig2 correctly,
// so this renders just the one failing page as a fallback. Never imported
// statically — always via a dynamic import() from the caller's catch
// handler — so its ~4.9MB (mostly the .wasm binary) is only ever fetched
// the first time a page actually fails, never on the normal/working path.

// Module-level singleton — the initialized PDFium instance is created once
// and reused for the lifetime of the tab, not re-initialized per page/document.
let pdfiumPromise = null;

function getPdfium() {
  if (!pdfiumPromise) {
    pdfiumPromise = (async () => {
      const [{ init }, { default: wasmUrl }] = await Promise.all([
        import('@embedpdf/pdfium'),
        import('@embedpdf/pdfium/pdfium.wasm?url'),
      ]);
      const wasmBinary = await fetch(wasmUrl).then(r => r.arrayBuffer());
      const pdfium = await init({ wasmBinary });
      pdfium.PDFiumExt_Init();
      return pdfium;
    })();
    // Don't let a failed init permanently poison every later attempt for the
    // rest of the tab's life — let the next caller retry from scratch.
    pdfiumPromise.catch(() => { pdfiumPromise = null; });
  }
  return pdfiumPromise;
}

/**
 * Renders one page of a PDF (given as raw bytes) onto an existing canvas via
 * PDFium/WASM. The canvas's width/height must already be set by the caller
 * (matching pdf.js's own viewport pixel size) — this only paints pixels into
 * that same box, so anything stacked on top of the canvas via CSS (e.g. the
 * percentage-based annotation/highlight SVG overlay already used elsewhere
 * in this app) keeps working unchanged, regardless of which engine painted
 * the canvas underneath it.
 *
 * @param {ArrayBuffer} pdfBytes
 * @param {number} pageNumber 1-based, matching the caller's page numbering
 * @param {HTMLCanvasElement} canvas
 * @param {number} [rotationDegrees=0] 0 | 90 | 180 | 270
 * @returns {Promise<void>} resolves on success, rejects on any failure —
 *          the caller decides what "both renderers failed" means.
 */
export async function renderPageWithPdfium(pdfBytes, pageNumber, canvas, rotationDegrees = 0) {
  const pdfium = await getPdfium();
  const bytes = new Uint8Array(pdfBytes);
  const filePtr = pdfium.pdfium.wasmExports.malloc(bytes.length);
  let docPtr = 0, pagePtr = 0, bitmap = 0;
  try {
    pdfium.pdfium.HEAPU8.set(bytes, filePtr);
    docPtr = pdfium.FPDF_LoadMemDocument(filePtr, bytes.length, '');
    if (!docPtr) throw new Error('pdfium: FPDF_LoadMemDocument failed');

    pagePtr = pdfium.FPDF_LoadPage(docPtr, pageNumber - 1);
    if (!pagePtr) throw new Error('pdfium: FPDF_LoadPage failed');

    const width = canvas.width, height = canvas.height;
    const rotate = ((rotationDegrees / 90) % 4 + 4) % 4; // degrees -> 0..3 quarter-turns
    bitmap = pdfium.FPDFBitmap_Create(width, height, 1);
    if (!bitmap) throw new Error('pdfium: FPDFBitmap_Create failed');
    pdfium.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xFFFFFFFF); // white background
    pdfium.FPDF_RenderPageBitmap(bitmap, pagePtr, 0, 0, width, height, rotate, 0);

    const stride = pdfium.FPDFBitmap_GetStride(bitmap);
    const bufPtr = pdfium.FPDFBitmap_GetBuffer(bitmap);
    const bgra = pdfium.pdfium.HEAPU8.subarray(bufPtr, bufPtr + stride * height);

    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    // PDFium's public C API returns BGRA — swap to RGBA for canvas ImageData.
    // stride can exceed width*4 (row padding), so index rows by stride, not width*4.
    for (let y = 0; y < height; y++) {
      const rowStart = y * stride;
      for (let x = 0; x < width; x++) {
        const i = rowStart + x * 4, o = (y * width + x) * 4;
        imgData.data[o]     = bgra[i + 2]; // R <- B
        imgData.data[o + 1] = bgra[i + 1]; // G
        imgData.data[o + 2] = bgra[i];     // B <- R
        imgData.data[o + 3] = bgra[i + 3]; // A
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } finally {
    if (bitmap) pdfium.FPDFBitmap_Destroy(bitmap);
    if (pagePtr) pdfium.FPDF_ClosePage(pagePtr);
    if (docPtr) pdfium.FPDF_CloseDocument(docPtr);
    pdfium.pdfium.wasmExports.free(filePtr);
  }
}
