// Prints the order page fixtures to PDF, the way the owner's "print to PDF" does, so the PDF import
// is tested against the same lines as the extension (brief section 9). The pages keep their shop
// links (made absolute with <base>), as a browser print does. Output: test-fixtures/orders/pdf/.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumPath, ROOT } from '../../tests/ui/harness.mjs';

const SHOPS = { ozdisan: 'https://www.ozdisan.com/', motorobit: 'https://www.motorobit.com/', robocombo: 'https://www.robocombo.com/' };
const dir = path.join(ROOT, 'test-fixtures', 'orders');
const out = path.join(dir, 'pdf');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();
await page.route('**/*', (r) => (r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort()));
for (const [shop, base] of Object.entries(SHOPS)) {
  const html = fs.readFileSync(path.join(dir, `${shop}-order-detail.html`), 'utf8')
    .replace('<head>', `<head><base href="${base}"><style>body{font-family:sans-serif;font-size:12px}img{display:none}</style>`);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const file = path.join(out, `${shop}-order.pdf`);
  await page.pdf({ path: file, format: 'A4', printBackground: false, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  console.log(`${path.relative(ROOT, file)} ${fs.statSync(file).size} bytes`);
}
await browser.close();
