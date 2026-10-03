/**
 * In-app questions that return a Promise (B7, B8). Never window.confirm, alert or prompt: the
 * dialog plugin replaces confirm with an async function, and code that did not await it deleted a
 * project the moment the question appeared. `await confirm(...)` resolves only when the owner
 * answers; Escape, the scrim and Cancel all answer false.
 */
import { signal } from '@preact/signals';

export interface ConfirmRequest {
  id: number;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

export const confirmQueue = signal<ConfirmRequest[]>([]);
let next = 1;

export function confirm(opts: { title: string; body: string; confirmLabel: string; cancelLabel: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const id = next++;
    const done = (ok: boolean) => {
      confirmQueue.value = confirmQueue.value.filter((c) => c.id !== id);
      resolve(ok);
    };
    confirmQueue.value = [...confirmQueue.value, { id, danger: false, ...opts, resolve: done }];
  });
}
