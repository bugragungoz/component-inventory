// Runs in the page's own JS world (manifest: "world": "MAIN") because content scripts cannot see
// window.dataLayer. It only answers snapshot requests from the content script.
window.addEventListener('message', (ev: MessageEvent) => {
  if (ev.source !== window || !ev.data || ev.data.cinv !== 'request-datalayer') return;
  let snapshot: unknown[] = [];
  try {
    snapshot = JSON.parse(JSON.stringify(Array.from((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [])));
  } catch {
    snapshot = [];
  }
  window.postMessage({ cinv: 'datalayer', id: ev.data.id, data: snapshot }, window.location.origin);
});
