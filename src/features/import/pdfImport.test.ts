// The PDF import against the order pages printed to PDF (tools/fixtures/print-orders.mjs) and the
// ground truth in test-fixtures/orders/expected.json: every line, its count and its pack size.
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { guessColumnMap } from '../../domain/importCore';
import { draftFromTable, pieces, totals } from './draft';
import { linesFromDocument, rowsFromPdfLines, shopFromLinks } from './parsers';

const dir = path.resolve(__dirname, '../../../test-fixtures/orders');
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')) as Record<string, Array<{ name: string; code: string; qty: number; packSize: number; pieces: number }>>;

async function draftFor(shop: string) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, 'pdf', `${shop}-order.pdf`)));
  const doc = await getDocument({ data, isEvalSupported: false } as Parameters<typeof getDocument>[0]).promise;
  const { lines } = await linesFromDocument(doc as never);
  const { rows, links, mode } = rowsFromPdfLines(lines);
  const site = shopFromLinks(links) ?? undefined;
  return { draft: draftFromTable(rows, guessColumnMap(rows), 'pdf', `${shop}.pdf`, site), site, mode };
}

describe.each(['ozdisan', 'motorobit', 'robocombo'])('PDF import of a printed %s order', (shop) => {
  it('finds every line with its count, pack size and pieces', async () => {
    const want = expected[shop]!;
    const { draft, site } = await draftFor(shop);
    expect(site).toBe(shop);
    expect(draft.rows.map((r) => r.units)).toEqual(want.map((w) => w.qty));
    expect(draft.rows.map((r) => r.pack)).toEqual(want.map((w) => w.packSize));
    expect(draft.rows.map(pieces)).toEqual(want.map((w) => w.pieces));
    expect(totals(draft.rows)).toMatchObject({ lines: want.length, pieces: want.reduce((a, w) => a + w.pieces, 0), unreadable: 0 });
    draft.rows.forEach((r, i) => expect(r.name).toContain(want[i]!.name.trim().slice(0, 12)));
  });
});

it('takes the manufacturer code Özdisan prints and never a shop stock code', async () => {
  const oz = (await draftFor('ozdisan')).draft;
  expect(oz.rows.map((r) => r.part_code)).toEqual(expected.ozdisan!.map((w) => w.code));
  const rc = (await draftFor('robocombo')).draft;
  for (const r of rc.rows) expect(r.part_code).not.toMatch(/^\d{6,}$/);
});
