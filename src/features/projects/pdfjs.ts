/**
 * pdf.js, loaded on first use. XFA forms are off: the PDF is untrusted input.
 *
 * The legacy build, not the modern one: the modern build calls JavaScript added to browsers only
 * recently (Map.prototype.getOrInsertComputed), and in a WebView without it a page was
 * drawn blank. The legacy build carries what it needs. The unit tests use it too.
 */
import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';

let lib: Promise<typeof PdfJs> | null = null;

export function loadPdfjs(): Promise<typeof PdfJs> {
  lib ??= (async () => {
    const [mod, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    return mod;
  })();
  return lib;
}

/** Opens a PDF. Aborting `signal` tells pdf.js and its worker to give up. */
export async function openPdf(bytes: Uint8Array, signal?: AbortSignal): Promise<PdfJs.PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes, enableXfa: false });
  signal?.addEventListener('abort', () => void task.destroy(), { once: true });
  return task.promise;
}
