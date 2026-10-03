import { describe, expect, it } from 'vitest';
import { confirm, confirmQueue } from './dialogs';

describe('confirm', () => {
  it('waits for the answer: nothing resolves before the owner clicks', async () => {
    let settled = false;
    const p = confirm({ title: 'Delete?', body: 'b', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }).then((v) => {
      settled = true;
      return v;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(confirmQueue.value).toHaveLength(1);
    confirmQueue.value[0]!.resolve(false);
    expect(await p).toBe(false);
    expect(confirmQueue.value).toHaveLength(0);
  });
});
