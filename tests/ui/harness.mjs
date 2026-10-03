// The UI harness (docs/adr/0004): the built frontend in Chromium, with `invoke` wired to the real
// Rust core through `inventory-bridge`. Desktop-only commands (native dialogs, links, deep links,
// the update check) are mocked here and listed in DESKTOP. Every request to another origin is
// aborted and counted; checks fail when any was made.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const EXE = process.platform === 'win32' ? '.exe' : '';

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, d, rel);
        if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = path.join(DIST, url === '/' ? 'index.html' : url);
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function startBridge(dataDir, library) {
  const bin = path.join(ROOT, 'target', 'debug', `inventory-bridge${EXE}`);
  if (!fs.existsSync(bin)) throw new Error(`build the bridge first: cargo build -p inventory-bridge (${bin})`);
  const args = [dataDir];
  if (library && fs.existsSync(path.join(ROOT, 'patched.db'))) args.push(path.join(ROOT, 'patched.db'));
  const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = new Map();
  let next = 1;
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(msg.error);
  });
  return {
    call(cmd, args) {
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        child.stdin.write(`${JSON.stringify({ id, cmd, args: args ?? {} })}\n`);
      });
    },
    stop: () => new Promise((r) => { child.once('exit', r); child.stdin.end(); setTimeout(() => child.kill(), 2000); }),
  };
}

/** Mocked desktop commands. Each gets (args, state) and returns the value Tauri would. */
const DESKTOP = {
  startup_status: (_a, s) => s.startup ?? { ok: true, error: null, data_dir: s.dataDir },
  take_deep_links: (_a, s) => s.deepLinks.splice(0),
  check_update: (a, s) => s.update(a),
  open_url: (a, s) => { s.opened.push(a.url); return null; },
  open_folder: (a, s) => { s.opened.push(`folder:${a.target}`); return null; },
  pick_folder: async (a, s) => {
    const p = s.nextFolder;
    s.nextFolder = null;
    return p ? s.bridge.call('set_folder_for_test', { kind: a.kind, path: p }) : null;
  },
  pick_component_image: () => null,
  pick_schematic: async (a, s) => {
    const p = s.nextSchematic;
    s.nextSchematic = null;
    if (!p) return null;
    s.schematics[a.projectId] = p;
    return s.bridge.call('set_schematic_for_test', { project_id: a.projectId, path: p });
  },
  read_image: () => { throw { code: 'not_found', detail: 'no image in the harness' }; },
  read_schematic: (a, s) => {
    const p = s.schematics[a.projectId];
    if (!p) throw { code: 'not_found', detail: 'the project has no schematic' };
    return fs.readFileSync(p);
  },
  export_inventory: async (a, s) => {
    const p = path.join(s.outDir, `export.${a.format}`);
    await s.bridge.call('export_to_path', { format: a.format, path: p });
    s.saved.push(p);
    return p;
  },
  save_generated_file: (a, s) => {
    const p = path.join(s.outDir, a.__fileName || `file.${a.__extension || 'bin'}`);
    fs.writeFileSync(p, Buffer.from(a.__bytes));
    s.saved.push(p);
    return p;
  },
  fetch_shop_page: () => { throw { code: 'network', detail: 'no network in the harness' }; },
  'plugin:app|version': () => '1.0.0-beta.1',
};

const INIT = () => {
  // The app must never use the browser's blocking dialogs (B7, B8); a call is recorded and fails a check.
  for (const k of ['confirm', 'alert', 'prompt']) {
    window[k] = () => {
      window.__blockingDialogs = [...(window.__blockingDialogs ?? []), k];
      return false;
    };
  }
  const callbacks = new Map();
  const listeners = new Map();
  let nextId = 1;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_e, id) => callbacks.delete(id) };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback(cb, once = false) {
      const id = nextId++;
      callbacks.set(id, (data) => { if (once) callbacks.delete(id); return cb && cb(data); });
      return id;
    },
    unregisterCallback: (id) => callbacks.delete(id),
    runCallback: (id, data) => callbacks.get(id)?.(data),
    convertFileSrc: (p) => p,
    async invoke(cmd, args, options) {
      if (cmd === 'plugin:event|listen') {
        const list = listeners.get(args.event) ?? [];
        list.push(args.handler);
        listeners.set(args.event, list);
        return args.handler;
      }
      if (cmd === 'plugin:event|unlisten') return null;
      let payload = args;
      if (args instanceof Uint8Array) {
        const h = options?.headers ?? {};
        payload = { __bytes: Array.from(args), __fileName: h['x-file-name'], __extension: h['x-extension'] };
      }
      const r = await window.__harnessInvoke(cmd, payload ?? {});
      if (!r.ok) throw r.error;
      return r.bytes ? new Uint8Array(r.bytes).buffer : r.value;
    },
  };
  window.__harnessEmit = (event, payload) => {
    for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
  };
};

/**
 * Starts everything. Options: locale (navigator language), theme ('dark'|'light'),
 * viewport, library (attach patched.db), dataDir (reuse a folder, e.g. with an old database).
 */
export async function startHarness(opts = {}) {
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'cinv-ui-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinv-out-'));
  const bridge = startBridge(dataDir, opts.library ?? false);
  const { server, origin } = await serve();
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--font-render-hinting=none'] });
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    locale: opts.locale ?? 'en-US',
    colorScheme: opts.theme ?? 'dark',
    deviceScaleFactor: opts.scale ?? 1,
    acceptDownloads: false,
  });
  const state = {
    dataDir, outDir, bridge, deepLinks: [], opened: [], saved: [], nextFolder: null, nextSchematic: null, schematics: {}, external: [], errors: [], calls: [], startup: opts.startup ?? null,
    update: () => ({ status: 'current', current: '1.0.0-beta.1', latest: null, url: null }),
  };
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    state.external.push(url);
    return route.abort();
  });
  await context.exposeBinding('__harnessInvoke', async (_src, cmd, args) => {
    state.calls.push(cmd);
    try {
      if (DESKTOP[cmd]) {
        const v = await DESKTOP[cmd](args, state);
        if (cmd === 'read_image' || cmd === 'read_schematic') return { ok: true, bytes: Array.from(v) };
        return { ok: true, value: v ?? null };
      }
      return { ok: true, value: await bridge.call(cmd, args.args ?? {}) };
    } catch (error) {
      return { ok: false, error: error && error.code ? error : { code: 'internal', detail: String(error?.message ?? error) } };
    }
  });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  page.on('pageerror', (e) => state.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') state.errors.push(m.text()); });

  return {
    page, context, browser, state, origin, bridge,
    async open(hash = '', timeout = 20_000) {
      await page.goto(`${origin}/${hash}`);
      await page.waitForSelector('.app, .startup-error', { timeout });
    },
    emit: (event, payload) => page.evaluate(([e, p]) => window.__harnessEmit(e, p), [event, payload]),
    call: (cmd, args) => bridge.call(cmd, args),
    async stop() {
      await browser.close();
      await bridge.stop();
      server.close();
    },
  };
}
