import { describe, expect, it } from 'vitest';
import { detectShop, packFromName } from './shops';

describe('pack rules (B11)', () => {
  it('Motorobit "- N Adet" is a pack of N', () => {
    expect(packFromName('motorobit', '91K 603 SMD Direnç - 10 Adet')).toEqual({ size: 10, rule: 'motorobit-suffix', base: '91K 603 SMD Direnç' });
    expect(packFromName('motorobit', '47K 603 SMD Direnç - 10 adet ')).toMatchObject({ size: 10, base: '47K 603 SMD Direnç' });
  });
  it('position and pin counts are not packs', () => {
    for (const shop of ['motorobit', 'robocombo', 'ozdisan', 'robotistan']) {
      expect(packFromName(shop, "8'li DIP Switch")).toBeNull();
      expect(packFromName(shop, "16'lı Entegre Soketi")).toBeNull();
      expect(packFromName(shop, '40 pin Erkek Header')).toBeNull();
    }
  });
  it('only Motorobit has a proven rule', () => {
    expect(packFromName('robocombo', '91K 603 SMD Direnç - 10 Adet')).toBeNull();
    expect(packFromName('motorobit', 'IRFZ44N - 55V 49A Mosfet - TO220')).toBeNull();
    expect(packFromName('motorobit', '1 Adet')).toBeNull();
  });
  it('detects shops by host', () => {
    expect(detectShop('www.motorobit.com')?.id).toBe('motorobit');
    expect(detectShop('motorobit.com.evil.example')).toBeNull();
  });
});
