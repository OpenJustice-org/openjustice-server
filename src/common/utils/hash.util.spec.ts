import { hashPin, verifyPin } from './hash.util';

describe('hashPin / verifyPin', () => {
  it('hashes a PIN and verifies it', async () => {
    const pin = '12349876';
    const hashed = await hashPin(pin);
    expect(hashed).not.toBe(pin);
    expect(await verifyPin(pin, hashed)).toBe(true);
  });

  it('rejects wrong PIN', async () => {
    const hashed = await hashPin('12349876');
    expect(await verifyPin('00000001', hashed)).toBe(false);
  });

  it('returns false for invalid hash (no throw)', async () => {
    expect(await verifyPin('12345678', 'not-a-valid-hash')).toBe(false);
  });

  it('produces different hashes for the same PIN (salt)', async () => {
    const a = await hashPin('12349876');
    const b = await hashPin('12349876');
    expect(a).not.toBe(b);
  });
});
