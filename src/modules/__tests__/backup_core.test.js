import { describe, it, expect } from 'vitest';
import { formatBytes } from '../backup_core.js';

describe('backup_core', () => {
  it('formats bytes in human readable units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toContain('KB');
    expect(formatBytes(2 * 1024 * 1024)).toContain('MB');
  });
});
