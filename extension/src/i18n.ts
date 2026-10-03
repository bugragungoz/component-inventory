/** Messages from _locales through chrome.i18n; English from the bundle when there is no chrome (tests). */
import en from '../_locales/en/messages.json';

declare const chrome: { i18n?: { getMessage(key: string, substitutions?: string[]): string } } | undefined;

const fallback = en as Record<string, { message: string }>;

export function msg(key: string, ...subs: Array<string | number>): string {
  const s = subs.map(String);
  try {
    const m = typeof chrome !== 'undefined' ? chrome?.i18n?.getMessage(key, s) : '';
    if (m) return m;
  } catch {
    /* not in an extension */
  }
  return (fallback[key]?.message ?? key).replace(/\$(\d)/g, (_, i: string) => s[Number(i) - 1] ?? '');
}
