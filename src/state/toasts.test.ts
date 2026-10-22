import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, toasts } from './toasts';

afterEach(() => {
  toasts.value = [];
  vi.useRealTimers();
});

describe('toast', () => {
  it('shows the same notice once, with its time started again', () => {
    vi.useFakeTimers();
    toast('Another list from the extension is waiting.');
    vi.advanceTimersByTime(3000);
    toast('Another list from the extension is waiting.');
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(toasts.value).toHaveLength(0);
  });

  it('keeps different notices, and every notice with an action (each Undo is its own)', () => {
    toast('Saved');
    toast('Deleted LM7805', { actionLabel: 'Undo', onAction: () => {} });
    toast('Deleted LM7805', { actionLabel: 'Undo', onAction: () => {} });
    toast('Saved', { tone: 'warn' });
    expect(toasts.value.map((x) => x.message)).toEqual(['Saved', 'Deleted LM7805', 'Deleted LM7805', 'Saved']);
  });

  it('keeps at most four on screen', () => {
    for (let i = 0; i < 6; i++) toast(`Notice ${i}`);
    expect(toasts.value.map((x) => x.message)).toEqual(['Notice 2', 'Notice 3', 'Notice 4', 'Notice 5']);
  });
});
