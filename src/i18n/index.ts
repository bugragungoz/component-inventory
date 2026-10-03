/**
 * Messages, plurals and formatting. One JSON file per locale (src/locales); English is the fallback.
 * A message is a string with {placeholders}, or a plural object with CLDR forms
 * ({ "one": "...", "other": "..." }) chosen with Intl.PluralRules on the `count` parameter.
 * Numbers in parameters are formatted for the locale. See docs/adr/0005-languages-and-fonts.md.
 */
import { computed, signal } from '@preact/signals';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import de from '../locales/de.json';
import ru from '../locales/ru.json';
import zhCN from '../locales/zh-CN.json';
import ar from '../locales/ar.json';
import { pseudoize } from './pseudo';

export type Messages = { [key: string]: string | Messages };

export interface LocaleInfo {
  code: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  reviewed: boolean;
}

type LocaleFile = Messages & { _meta: { nativeName: string; dir: 'ltr' | 'rtl'; reviewed: boolean } };

const FILES: Record<string, LocaleFile> = {
  en: en as unknown as LocaleFile,
  tr: tr as unknown as LocaleFile,
  de: de as unknown as LocaleFile,
  ru: ru as unknown as LocaleFile,
  'zh-CN': zhCN as unknown as LocaleFile,
  ar: ar as unknown as LocaleFile,
};

/** Order shown in Settings: Turkish and English first, then the others. */
export const LOCALES: LocaleInfo[] = ['tr', 'en', 'de', 'ru', 'zh-CN', 'ar'].map((code) => {
  const m = FILES[code]!._meta;
  return { code, nativeName: m.nativeName, dir: m.dir, reviewed: m.reviewed };
});

export const PSEUDO_LOCALE = 'en-XA';
let pseudo: Messages | null = null;

function flatten(obj: Messages, prefix = '', out: Record<string, string | Record<string, string>> = {}): Record<string, string | Record<string, string>> {
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (isPlural(v)) out[key] = v as Record<string, string>;
    else flatten(v, key, out);
  }
  return out;
}

const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
export function isPlural(v: unknown): boolean {
  return !!v && typeof v === 'object' && Object.keys(v).length > 0 && Object.keys(v).every((k) => PLURAL_FORMS.has(k)) && 'other' in (v as object);
}

const cache = new Map<string, Record<string, string | Record<string, string>>>();
function table(code: string): Record<string, string | Record<string, string>> {
  let t = cache.get(code);
  if (!t) {
    if (code === PSEUDO_LOCALE) {
      pseudo ??= pseudoize(FILES.en!);
      t = flatten(pseudo);
    } else {
      t = flatten(FILES[code] ?? FILES.en!);
    }
    cache.set(code, t);
  }
  return t;
}

export function supported(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === PSEUDO_LOCALE || FILES[code]) return code;
  const base = code.split('-')[0]!.toLowerCase();
  if (base === 'zh') return 'zh-CN';
  return FILES[base] ? base : null;
}

/** The first supported language of the system, else Turkish (the owner's language). */
export function systemLocale(): string {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const l of langs) {
    const s = supported(l);
    if (s) return s;
  }
  return 'tr';
}

export const locale = signal<string>('en');
export const dir = computed<'ltr' | 'rtl'>(() => (locale.value === 'ar' ? 'rtl' : 'ltr'));
/** The locale Intl should use (the pseudo-locale formats like English). */
export const intlLocale = computed(() => (locale.value === PSEUDO_LOCALE ? 'en' : locale.value));

export function setLocale(code: string): void {
  const s = supported(code) ?? 'en';
  locale.value = s;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = s === PSEUDO_LOCALE ? 'en' : s;
    document.documentElement.dir = dir.value;
  }
}

export type Params = Record<string, string | number>;

function interpolate(text: string, params: Params | undefined, loc: string): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = params[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? formatNumber(v, loc) : v;
  });
}

/** Translates a key. Reading `locale.value` here makes components re-render on a language change. */
export function t(key: string, params?: Params): string {
  const loc = locale.value;
  const msg = table(loc)[key] ?? table('en')[key];
  if (msg === undefined) {
    if (import.meta.env?.DEV) console.warn(`missing message: ${key}`);
    return key;
  }
  if (typeof msg === 'string') return interpolate(msg, params, intlLocale.value);
  const count = Number(params?.count ?? 0);
  const form = new Intl.PluralRules(intlLocale.value).select(count);
  return interpolate(msg[form] ?? msg.other ?? '', params, intlLocale.value);
}

/** True when the key exists (used for optional labels such as taxonomy names). */
export function has(key: string): boolean {
  return table('en')[key] !== undefined;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** Formatters are cached: the table formats thousands of cells while scrolling. */
export function formatNumber(n: number, loc = intlLocale.value, opts?: Intl.NumberFormatOptions): string {
  const key = opts ? `${loc}|${JSON.stringify(opts)}` : loc;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(loc, opts)));
  return f.format(n);
}

/** Dates from the database are "YYYY-MM-DD HH:MM:SS" in UTC. */
export function parseDbDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Backup names carry local time, "YYYY-MM-DD HH:MM:SS" without a zone. */
export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(loc: string, kind: 'datetime' | 'time'): Intl.DateTimeFormat {
  const key = `${loc}|${kind}`;
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(loc, kind === 'time' ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' })));
  return f;
}

export function formatDateTime(d: Date | null, loc = intlLocale.value): string {
  return d ? dateFormat(loc, 'datetime').format(d) : '-';
}

export function formatTime(d: Date | null, loc = intlLocale.value): string {
  return d ? dateFormat(loc, 'time').format(d) : '-';
}

export function formatList(items: string[], loc = intlLocale.value): string {
  return new Intl.ListFormat(loc, { style: 'long', type: 'conjunction' }).format(items);
}

export function formatBytes(bytes: number, loc = intlLocale.value): string {
  if (bytes < 1024) return `${formatNumber(bytes, loc)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, loc, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(bytes / (1024 * 1024), loc, { maximumFractionDigits: 1 })} MB`;
}

let collator: { loc: string; c: Intl.Collator } | null = null;
export function compareText(a: string, b: string): number {
  const loc = intlLocale.value;
  if (!collator || collator.loc !== loc) collator = { loc, c: new Intl.Collator(loc, { sensitivity: 'base', numeric: true }) };
  return collator.c.compare(a, b);
}

/** All message keys of English (for tests and the locale checker). */
export function englishKeys(): string[] {
  return Object.keys(table('en'));
}
