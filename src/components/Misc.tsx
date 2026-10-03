import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';

/** Bugra Note: a titled rule or decision with a muted explanation. */
export function Note({ title, children, tone, icon }: { title?: string; children?: ComponentChildren; tone?: 'info' | 'warn' | 'ok'; icon?: string }) {
  return (
    <div class={['bg-note', tone && `note-${tone}`].filter(Boolean).join(' ')} role={tone === 'warn' ? 'alert' : undefined}>
      {icon ? <Icon name={icon} size={18} class={tone ? `tone-${tone}` : ''} /> : null}
      <p>
        {title ? <strong>{title}</strong> : null}
        {children}
      </p>
    </div>
  );
}

/** Empty state (added): says what is missing and offers the next action. */
export function EmptyState({ icon, title, children, actions }: { icon: string; title: string; children?: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <div class="empty-state">
      <div class="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {actions ? <div class="empty-actions">{actions}</div> : null}
    </div>
  );
}

/** Badge (added): a small pill with text; status badges always carry a word, never color alone. */
export function Badge({ children, tone, title }: { children: ComponentChildren; tone?: 'ok' | 'warn' | 'info' | 'accent' | 'muted'; title?: string }) {
  return (
    <span class={['badge', tone && `badge-${tone}`].filter(Boolean).join(' ')} title={title}>
      <span class="badge-text">{children}</span>
    </span>
  );
}

/** Progress (added): an indeterminate line, or a spinner inline with text. */
export function Spinner({ label }: { label: string }) {
  return (
    <span class="spinner" role="progressbar" aria-label={label}>
      <span class="spinner-dot" />
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  return (
    <div class="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
      <div class={value === null ? 'progress-bar is-indeterminate' : 'progress-bar'} style={value === null ? undefined : { width: `${value}%` }} />
    </div>
  );
}

/** Keyboard key (added). */
export function Kbd({ children }: { children: ComponentChildren }) {
  return <kbd class="kbd">{children}</kbd>;
}

/** Tabs (added): a row of pill tabs with roving focus. */
export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: string; count?: number }>; label: string }) {
  return (
    <div class="tabs" role="tablist" aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabs.findIndex((x) => x.value === value);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
        onChange(next.value);
        (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus();
      }}>
      {tabs.map((tab) => (
        <button type="button" role="tab" key={tab.value} data-tab={tab.value} aria-selected={tab.value === value} tabIndex={tab.value === value ? 0 : -1}
          class="tab" onClick={() => onChange(tab.value)}>
          {tab.label}
          {tab.count !== undefined ? <span class="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
