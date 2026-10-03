import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';

export interface MenuItem {
  label: string;
  icon?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

interface MenuProps {
  label: string;
  items: Array<MenuItem | 'separator'>;
  /** The button that opens the menu; it must be the first element it renders. */
  trigger: (props: { onClick: () => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean }) => ComponentChildren;
  align?: 'start' | 'end';
}

/** Menu (added): a popover list; arrows move, Enter selects, Escape closes and focus returns. */
export function Menu({ label, items, trigger, align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  // The trigger is found in the DOM: a ref given to a component (IconButton) is the component, not
  // its button, and focus() on it threw before the chosen item ran.
  const wrap = useRef<HTMLDivElement>(null);
  const triggerEl = () => (wrap.current?.firstElementChild as HTMLElement | null) ?? null;
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]');
    first?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !triggerEl()?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const onKey = (e: KeyboardEvent) => {
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      setOpen(false);
      triggerEl()?.focus();
    }
  };
  return (
    <div class="menu-wrap" ref={wrap}>
      {trigger({ onClick: () => setOpen(!open), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      {open ? (
        <div ref={list} class={`menu menu-${align}`} role="menu" aria-label={label} onKeyDown={onKey}>
          {items.map((it, i) =>
            it === 'separator' ? (
              <div class="menu-sep" role="separator" key={`s${i}`} />
            ) : (
              <button
                type="button"
                key={it.label}
                role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={it.checked}
                aria-disabled={it.disabled || undefined}
                class={['menu-item', it.danger && 'is-danger'].filter(Boolean).join(' ')}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  triggerEl()?.focus();
                  it.onSelect();
                }}
              >
                {it.icon ? <Icon name={it.icon} size={16} /> : it.checked !== undefined ? <Icon name={it.checked ? 'check' : 'minus'} size={16} class={it.checked ? '' : 'invisible'} /> : <span class="menu-icon-gap" />}
                <span>{it.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
