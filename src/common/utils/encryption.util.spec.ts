import {
  encrypt,
  decrypt,
  hash,
  generateEncryptionKey,
  encryptPII,
  decryptPII,
} from './encryption.util';

const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('encrypt / decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'Hello, OpenJustice!';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('returns empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('produces different ciphertext for each call (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    // both must decrypt to the same value
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('handles unicode / multi-byte strings', () => {
    const text = '日本語テスト 🔒';
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow(
      'ENCRYPTION_KEY environment variable is not set',
    );
  });

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow(
      'ENCRYPTION_KEY must be 64 hex characters',
    );
  });

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('test');
    const tampered = ciphertext.slice(0, -2) + 'XX';
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('hash', () => {
  it('returns SHA-256 hex digest', () => {
    const result = hash('hello');
    expect(result).toHaveLength(64);
    // deterministic
    expect(hash('hello')).toBe(result);
  });

  it('returns empty string for empty input', () => {
    expect(hash('')).toBe('');
  });
});

describe('generateEncryptionKey', () => {
  it('returns a 64-character hex string', () => {
    const key = generateEncryptionKey();
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it('generates unique keys', () => {
    const keys = new Set(
      Array.from({ length: 10 }, () => generateEncryptionKey()),
    );
    expect(keys.size).toBe(10);
  });
});

describe('encryptPII / decryptPII', () => {
  it('returns null for null, undefined, empty string', () => {
    expect(encryptPII(null)).toBeNull();
    expect(encryptPII(undefined)).toBeNull();
    expect(encryptPII('')).toBeNull();
    expect(decryptPII(null)).toBeNull();
    expect(decryptPII(undefined)).toBeNull();
    expect(decryptPII('')).toBeNull();
  });

  it('round-trips a non-empty value', () => {
    const value = '+23276123456';
    const encrypted = encryptPII(value);
    expect(encrypted).not.toBeNull();
    expect(decryptPII(encrypted!)).toBe(value);
  });
});
