/** pdf.js, loaded on first use. XFA forms are off: the PDF is untrusted input. */
import type * as PdfJs from 'pdfjs-dist';

let lib: Promise<typeof PdfJs> | null = null;

export function loadPdfjs(): Promise<typeof PdfJs> {
  lib ??= (async () => {
    const [mod, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    return mod;
  })();
  return lib;
}

export async function openPdf(bytes: Uint8Array): Promise<PdfJs.PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data: bytes, enableXfa: false }).promise;
}
