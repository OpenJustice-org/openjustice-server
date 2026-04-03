import {
  sha256,
  computeCustodySignature,
  computeAuditEntryHash,
} from './crypto.util';

describe('sha256', () => {
  it('returns 64-char hex digest', () => {
    const result = sha256('test');
    expect(result).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });
});

describe('computeCustodySignature', () => {
  it('returns deterministic hash for the same inputs', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const a = computeCustodySignature('ev1', 'off1', 'COLLECTED', date);
    const b = computeCustodySignature('ev1', 'off1', 'COLLECTED', date);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('differs when any input changes', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const base = computeCustodySignature('ev1', 'off1', 'COLLECTED', date);
    expect(computeCustodySignature('ev2', 'off1', 'COLLECTED', date)).not.toBe(
      base,
    );
    expect(computeCustodySignature('ev1', 'off2', 'COLLECTED', date)).not.toBe(
      base,
    );
    expect(computeCustodySignature('ev1', 'off1', 'SEALED', date)).not.toBe(
      base,
    );
  });
});

describe('computeAuditEntryHash', () => {
  it('includes previousHash in computation', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const genesis = computeAuditEntryHash('id1', 'login', 'off1', date, null);
    const chained = computeAuditEntryHash(
      'id1',
      'login',
      'off1',
      date,
      'abc123',
    );
    expect(genesis).not.toBe(chained);
  });

  it('uses GENESIS for null previousHash', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const result = computeAuditEntryHash('id1', 'login', null, date, null);
    expect(result).toHaveLength(64);
  });
});
