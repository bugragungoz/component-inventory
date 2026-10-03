/**
 * The panel on shop pages (bottom right, in a shadow root so the shop's CSS cannot reach
 * it). Styled with the Bugra tokens. Sends the page to the app through a component-inventory://
 * link, or as a .cinv.json file when the link would be too long, and always keeps "save as file"
 * one click away: the page cannot tell whether Windows opened the app.
 */
import { DEEP_LINK_MAX_CHARS, encodeDeepLink, type CinvPayload } from '@cinv/core';
import tokens from '../../src/styles/tokens.css?inline';
import { collect, type Collected } from './collect';
import { diagnose } from './diagnose';
import { msg } from './i18n';
import panelCss from './panel.css?inline';

const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5"/></svg>';

function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const saveFile = (p: CinvPayload) => download(`${p.source.site}-${p.source.kind}.cinv.json`, JSON.stringify(p, null, 2));

const host = document.createElement('div');
host.setAttribute('data-cinv', '');
host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647';
const dark = matchMedia('(prefers-color-scheme: dark)');
const setTheme = () => host.setAttribute('data-theme', dark.matches ? 'dark' : 'light');
setTheme();
dark.addEventListener?.('change', setTheme);
const root = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = tokens.replace(/:root\[data-theme='(dark|light)'\]/g, ":host([data-theme='$1'])").replace(/:root/g, ':host') + panelCss;
root.append(style);

const panel = document.createElement('section');
panel.className = 'panel';
panel.setAttribute('aria-label', msg('panelLabel'));
panel.innerHTML = `
  <header><span class="mark">${MARK}</span><strong>${msg('panelTitle')}</strong><button class="icon" data-act="min" aria-label="${msg('minimize')}" title="${msg('minimize')}">&#x2212;</button></header>
  <p class="status" role="status"></p>
  <label class="qty" hidden><span>${msg('quantity')}</span><input type="number" min="1" step="1" value="1" inputmode="numeric"></label>
  <div class="actions">
    <button class="primary" data-act="send">${msg('send')}</button>
    <button data-act="file">${msg('saveFile')}</button>
    <button class="quiet" data-act="diag" title="${msg('diagnoseTitle')}">${msg('diagnose')}</button>
  </div>
  <div class="note" role="alert" hidden></div>`;
const pill = document.createElement('button');
pill.className = 'pill';
pill.innerHTML = `${MARK}<span>${msg('panelTitle')}</span>`;
pill.setAttribute('aria-label', msg('expand'));
root.append(panel, pill);

const $ = <T extends Element>(sel: string) => panel.querySelector(sel) as T;
const status = $<HTMLParagraphElement>('.status');
const note = $<HTMLDivElement>('.note');
const qtyBox = $<HTMLLabelElement>('.qty');
const qtyInput = $<HTMLInputElement>('.qty input');

let minimized = false;
try {
  minimized = sessionStorage.getItem('cinv-min') === '1';
} catch {
  /* storage blocked */
}
const showPanel = (open: boolean) => {
  minimized = !open;
  panel.hidden = !open;
  pill.hidden = open;
  try {
    sessionStorage.setItem('cinv-min', open ? '0' : '1');
  } catch {
    /* storage blocked */
  }
};
showPanel(!minimized);
pill.addEventListener('click', () => showPanel(true));

let noteTimer = 0;
function say(text: string, action?: { label: string; run: () => void }): void {
  note.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => {
      note.hidden = true;
      action.run();
    });
    note.append(b);
  }
  note.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { note.hidden = true; }, action ? 60_000 : 8000);
}

const kindLabel = (k: string) => msg(k === 'order' ? 'kindOrder' : k === 'cart' ? 'kindCart' : 'kindProduct');
let current: Collected | null = null;

async function refresh(): Promise<void> {
  current = await collect();
  const sendBtn = $<HTMLButtonElement>('[data-act="send"]');
  const fileBtn = $<HTMLButtonElement>('[data-act="file"]');
  if (!current) {
    status.textContent = msg('nothing');
    qtyBox.hidden = true;
    sendBtn.disabled = fileBtn.disabled = true;
    return;
  }
  const p = current.payload;
  status.textContent = `${msg('found', p.items.length, kindLabel(p.source.kind))}${current.skipped ? ` ${msg('skipped', current.skipped)}` : ''}`;
  qtyBox.hidden = p.source.kind !== 'product';
  sendBtn.disabled = fileBtn.disabled = false;
}

/** The payload to send, with the typed quantity on a product page; null when the quantity is wrong. */
function ready(): CinvPayload | null {
  if (!current) return null;
  const p: CinvPayload = JSON.parse(JSON.stringify(current.payload));
  if (p.source.kind === 'product') {
    const q = Number(qtyInput.value);
    if (!Number.isInteger(q) || q < 1 || q > 999_999) {
      say(msg('qtyInvalid'));
      return null;
    }
    p.items.forEach((i) => { i.qty = q; });
  }
  return p;
}

panel.addEventListener('click', async (e) => {
  const act = (e.target as HTMLElement).closest('button')?.dataset.act;
  if (act === 'min') showPanel(false);
  if (act === 'send' || act === 'file') {
    await refresh();
    const p = ready();
    if (!p) return;
    const n = p.items.length;
    if (act === 'file') {
      saveFile(p);
      say(msg('saved', n));
      return;
    }
    const link = await encodeDeepLink(p);
    if (link.length > DEEP_LINK_MAX_CHARS) {
      saveFile(p);
      say(msg('tooBig', n));
      return;
    }
    location.href = link;
    say(msg('sent', n), { label: msg('notOpened'), run: () => { saveFile(p); say(msg('saved', n)); } });
  }
  if (act === 'diag') {
    const text = JSON.stringify(await diagnose(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      say(msg('diagCopied'));
    } catch {
      download('tani-raporu.json', text);
      say(msg('diagSaved'));
    }
  }
});

document.documentElement.appendChild(host);
void refresh();
// Single-page shops add their data after load and change the URL without reloading.
let checks = 0;
const timer = setInterval(() => {
  void refresh();
  if (++checks >= 12) clearInterval(timer);
}, 2500);
window.addEventListener('popstate', () => void refresh());
window.addEventListener('hashchange', () => void refresh());
