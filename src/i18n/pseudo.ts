/**
 * Pseudo-locale for visual tests: accented letters and 40 % longer text, in brackets, so clipped,
 * concatenated or untranslated strings stand out. Placeholders stay intact.
 */
import type { Messages } from './index';

const MAP: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

export function pseudoString(s: string): string {
  let out = '';
  let inPlaceholder = false;
  for (const ch of s) {
    if (ch === '{') inPlaceholder = true;
    out += inPlaceholder ? ch : MAP[ch] ?? ch;
    if (ch === '}') inPlaceholder = false;
  }
  const pad = Math.max(1, Math.round(s.length * 0.4));
  return `[${out}${' ~'.repeat(Math.ceil(pad / 2)).slice(0, pad)}]`;
}

/** The product name is the same in every language, so it is not stretched either. */
const KEEP = new Set(['app.name']);

export function pseudoize(m: Messages, prefix = ''): Messages {
  const out: Messages = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    out[k] = typeof v === 'string' ? (KEEP.has(key) ? v : pseudoString(v)) : pseudoize(v, key);
  }
  return out;
}
