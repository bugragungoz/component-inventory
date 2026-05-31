/**
 * Optional Ozdisan.com search enrichment (via Tauri fetch_url).
 * Parses category breadcrumbs from search result HTML.
 */

import { invoke } from '@tauri-apps/api/core';

const OZDISAN_SEARCH = 'https://www.ozdisan.com/arama?q=';

const PATH_CATEGORY_MAP = [
  { re: /\/direncler\//i, category: 'Resistors', subcategory: 'SMD' },
  { re: /\/smt-smd-ve-cip-direncler\//i, category: 'Resistors', subcategory: 'SMD' },
  { re: /\/kondansatorler\//i, category: 'Capacitors', subcategory: 'MLCC' },
  { re: /\/smt-smd-ve-mlcc-kondansatorlar\//i, category: 'Capacitors', subcategory: 'MLCC' },
  { re: /\/potansiyometre/i, category: 'Potentiometers', subcategory: 'Rotary' },
  { re: /\/diyotlar\//i, category: 'Diodes', subcategory: 'Rectifier' },
  { re: /\/transistorlar\//i, category: 'Transistors', subcategory: 'BJT' },
  { re: /\/entegreler\//i, category: 'ICs', subcategory: 'IC' },
  { re: /\/bobinler\//i, category: 'Inductors', subcategory: 'Inductor' },
  { re: /\/kristal\//i, category: 'Crystals', subcategory: 'Crystal' },
  { re: /\/role\//i, category: 'Relays', subcategory: 'Relay' },
  { re: /\/konnektor/i, category: 'Connectors', subcategory: 'Connector' },
];

/**
 * @param {string} html
 * @returns {{ category: string, subcategory: string, description?: string }|null}
 */
export function parseOzdisanSearchHtml(html) {
  if (!html || html.length < 200) return null;

  const hrefSlice = html.slice(0, 120000);
  for (const { re, category, subcategory } of PATH_CATEGORY_MAP) {
    if (re.test(hrefSlice)) {
      return { category, subcategory, description: 'From Ozdisan catalog' };
    }
  }

  const titleMatch = hrefSlice.match(/<title[^>]*>([^<]{10,200})<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    if (/diren[cç]/i.test(title)) return { category: 'Resistors', subcategory: 'SMD' };
    if (/kondansat/i.test(title)) return { category: 'Capacitors', subcategory: 'MLCC' };
    if (/potansiyometre/i.test(title)) return { category: 'Potentiometers', subcategory: 'Rotary' };
    if (/diyot/i.test(title)) return { category: 'Diodes', subcategory: 'Rectifier' };
  }

  return null;
}

/**
 * Fetch Ozdisan search page and infer component type (best-effort).
 * @param {string} partCode
 * @returns {Promise<object|null>}
 */
export async function lookupOzdisanCategory(partCode) {
  const code = String(partCode || '').trim();
  if (!code || code.length < 3) return null;

  const url = OZDISAN_SEARCH + encodeURIComponent(code);
  try {
    const html = await invoke('fetch_url', { url });
    return parseOzdisanSearchHtml(html);
  } catch {
    return null;
  }
}
