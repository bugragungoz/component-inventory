/**
 * The shops the extension and the importers know, and their pack rules (B11).
 *
 * A pack rule turns "units ordered" into "pieces". It is per shop and narrow on purpose: the old
 * app read "8'li DIP Switch" as a pack of 8 and "16'lı Entegre Soketi" as a pack of 16, but those
 * are one part with 8 positions and one socket with 16 pins. The only rule proven against a real
 * order and the product price is Motorobit's name suffix "- N Adet" (2026-10-03: ten "91K 603 SMD
 * Direnç - 10 Adet" units are 100 resistors). Everything else is one piece per unit until proven.
 */

export interface Shop {
  id: string;
  label: string;
  hosts: string[];
  /** The shop's `sku` / item id is its own stock code, not a manufacturer part number. */
  skuIsStockCode: boolean;
}

export const SHOPS: Shop[] = [
  { id: 'ozdisan', label: 'Özdisan', hosts: ['ozdisan.com'], skuIsStockCode: false },
  { id: 'motorobit', label: 'Motorobit', hosts: ['motorobit.com'], skuIsStockCode: true },
  { id: 'robocombo', label: 'Robocombo', hosts: ['robocombo.com'], skuIsStockCode: true },
  { id: 'robotistan', label: 'Robotistan', hosts: ['robotistan.com'], skuIsStockCode: true },
  { id: 'direncnet', label: 'Direnç.net', hosts: ['direnc.net'], skuIsStockCode: true },
  { id: 'robiz', label: 'Robiz', hosts: ['robiz.com.tr'], skuIsStockCode: true },
];

export function detectShop(hostname: string): Shop | null {
  const h = String(hostname || '').toLowerCase();
  return SHOPS.find((s) => s.hosts.some((x) => h === x || h.endsWith(`.${x}`))) ?? null;
}

export function shopLabel(id: string): string {
  return SHOPS.find((s) => s.id === id)?.label ?? id;
}

export interface PackRule {
  size: number;
  /** Machine-readable reason, shown translated on the review screen. */
  rule: 'motorobit-suffix';
  /** The name without the pack wording ("91K 603 SMD Direnç - 10 Adet" -> "91K 603 SMD Direnç"). */
  base: string;
}

const MOTOROBIT_SUFFIX = /(?:^|\s)-\s*(\d{1,5})\s*adet\s*$/i;

/** The pack size a shop's product name proves, or null (one piece per unit). */
export function packFromName(shopId: string, name: string): PackRule | null {
  if (shopId !== 'motorobit') return null;
  const text = String(name || '').trim();
  const m = MOTOROBIT_SUFFIX.exec(text);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return n > 1 && n <= 10000 ? { size: n, rule: 'motorobit-suffix', base: text.slice(0, m.index).trim() } : null;
}
