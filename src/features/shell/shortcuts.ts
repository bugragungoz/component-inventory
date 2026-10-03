/** Keyboard shortcuts: Ctrl+F or / search, Ctrl+N new part, Ctrl+I import, ? shortcut list. */
import { useEffect } from 'preact/hooks';
import { editing, shortcutsOpen, view } from '../../state/ui';

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function focusSearch(): void {
  view.value = 'inventory';
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#inventory-search')?.focus());
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.bg-scrim')) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && e.key.toLowerCase() === 'f') || (!mod && e.key === '/' && !typing(e))) {
        e.preventDefault();
        focusSearch();
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        editing.value = 'new';
      } else if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        view.value = 'import';
      } else if (!mod && e.key === '?' && !typing(e)) {
        e.preventDefault();
        shortcutsOpen.value = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
