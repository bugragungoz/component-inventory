/**
 * Ozdisan.com price lookup module.
 * Uses Tauri backend proxy (reqwest) to bypass CORS on Ozdisan's website.
 * Falls back to opening the search URL in the default browser if parsing fails.
 */

import { invoke }  from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

const OZDISAN_SEARCH = 'https://www.ozdisan.com/arama?q=';

// Price patterns common on Turkish e-commerce sites
const PRICE_PATTERNS = [
  /[\u20ba]?\s*([\d]+[.,][\d]{2})\s*(?:TL|\u20ba)/i,  // "₺12,34 TL" or "12.34 TL"
  /"price"\s*:\s*([\d.]+)/,                              // JSON-LD "price":"12.34"
  /data-price="([\d.,]+)"/i,                             // data attribute
  /class="[^"]*price[^"]*"[^>]*>\s*[\u20ba]?\s*([\d.,]+)/i, // price class
];

function extractPrice(html) {
  for (const pattern of PRICE_PATTERNS) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const raw = match[1].replace(',', '.');
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/**
 * Attempt to fetch a price for the given part code from Ozdisan.
 * Returns a price (number) if found, or null if not found.
 * On failure, opens Ozdisan search in the default browser.
 */
export async function fetchOzdisanPrice(partCode) {
  const url = OZDISAN_SEARCH + encodeURIComponent(partCode);

  try {
    const html = await invoke('fetch_url', { url });
    const price = extractPrice(html);
    if (price !== null) return price;
    // Price not found in HTML — open browser as fallback
    await openUrl(url);
    return null;
  } catch (_) {
    // Network error or command not available — open browser
    try { await openUrl(url); } catch (_2) { /* ignore */ }
    return null;
  }
}
