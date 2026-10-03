//! `component-inventory://import?z=...` links from the browser extension. Rust only queues them
//! (size-capped); the frontend takes them with `take_deep_links`, validates them with
//! `packages/cinv` and shows the review screen. Nothing is written before the owner confirms.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{App, AppHandle, Emitter, Manager, UserAttentionType, WebviewWindow};
use tauri_plugin_deep_link::DeepLinkExt;

use crate::AppState;

pub const SCHEME: &str = "component-inventory";
const MAX_LINK_CHARS: usize = 64 * 1024;
/// One click in the browser reached the app two or three times on the owner's laptop (the second
/// launch's arguments and the open-url event); the same link within this window is the same send.
const REPEAT_WINDOW: Duration = Duration::from_secs(15);
static RECENT: Mutex<Vec<(String, Instant)>> = Mutex::new(Vec::new());

/// True the first time a link is seen in REPEAT_WINDOW.
fn first_time(url: &str) -> bool {
    let Ok(mut recent) = RECENT.lock() else { return true };
    let now = Instant::now();
    recent.retain(|(_, at)| now.duration_since(*at) < REPEAT_WINDOW);
    if recent.iter().any(|(u, _)| u == url) {
        return false;
    }
    recent.push((url.to_string(), now));
    true
}

fn accept(app: &AppHandle, urls: impl IntoIterator<Item = String>) {
    let state = app.state::<AppState>();
    let mut added = false;
    if let Ok(mut q) = state.deep_links.lock() {
        for u in urls {
            if u.starts_with(&format!("{SCHEME}://")) && u.len() <= MAX_LINK_CHARS && q.len() < 20 && first_time(&u) {
                q.push(u);
                added = true;
            }
        }
    }
    if added {
        let _ = app.emit("deep-link-pending", ());
        if let Some(w) = app.get_webview_window("main") {
            bring_to_front(&w);
        }
    }
}

/// Shows the window in front of the browser that sent the link. Windows refuses keyboard focus
/// to a process that did not receive the last input, which left the review hidden behind the
/// shop page; a brief always-on-top (allowed for any process) still raises it, and the taskbar
/// button flashes when focus itself is refused.
pub fn bring_to_front(w: &WebviewWindow) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_always_on_top(true);
    let _ = w.set_focus();
    let _ = w.set_always_on_top(false);
    if !w.is_focused().unwrap_or(false) {
        let _ = w.request_user_attention(Some(UserAttentionType::Informational));
    }
}

pub fn setup(app: &App) {
    // Registered for the current user at every start, so the link opens this copy of the app
    // (the installer registers it too).
    #[cfg(any(windows, target_os = "linux"))]
    if let Err(e) = app.deep_link().register(SCHEME) {
        eprintln!("deep link registration failed: {e}");
    }
    if let Ok(Some(urls)) = app.deep_link().get_current() {
        accept(app.handle(), urls.into_iter().map(|u| u.to_string()));
    }
    let handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        accept(&handle, event.urls().into_iter().map(|u| u.to_string()));
    });
}
