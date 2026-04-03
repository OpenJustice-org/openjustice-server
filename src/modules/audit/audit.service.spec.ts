import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { PrismaService } from '../../common/database/prisma.service';
import * as cryptoUtil from '../../common/utils/crypto.util';

describe('AuditService', () => {
  let service: AuditService;
  let auditRepository: Record<string, jest.Mock>;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    auditRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getAuditChainForVerification: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: auditRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  describe('findById', () => {
    it('returns audit log when found', async () => {
      const log = { id: 'log-1', action: 'login' };
      auditRepository.findById.mockResolvedValue(log);
      expect(await service.findById('log-1')).toEqual(log);
    });

    it('throws NotFoundException when not found', async () => {
      auditRepository.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAuditLog', () => {
    it('creates an audit log entry with hash chain inside a transaction', async () => {
      const record = {
        id: 'log-1',
        action: 'login',
        officerId: 'off-1',
        createdAt: new Date(),
      };

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          $executeRawUnsafe: jest.fn(),
          auditLog: {
            findFirst: jest.fn().mockResolvedValue(null), // genesis entry
            create: jest.fn().mockResolvedValue(record),
            update: jest
              .fn()
              .mockResolvedValue({ ...record, entryHash: 'hash123' }),
          },
        };
        return fn(tx);
      });

      const result = await service.createAuditLog({
        entityType: 'officer',
        action: 'login',
        details: {},
        officerId: 'off-1',
      });

      expect(result).toMatchObject({
        id: 'log-1',
        entryHash: expect.any(String),
      });
    });

    it('returns null and logs error on failure (does not throw)', async () => {
      prisma.$transaction.mockRejectedValue(new Error('DB down'));
      const result = await service.createAuditLog({
        entityType: 'officer',
        action: 'login',
        details: {},
      });
      expect(result).toBeNull();
    });

    it('links to previous hash when chain already has entries', async () => {
      const previousEntry = { entryHash: 'prev-hash-abc' };
      const record = {
        id: 'log-2',
        action: 'read',
        officerId: 'off-1',
        createdAt: new Date(),
      };

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          $executeRawUnsafe: jest.fn(),
          auditLog: {
            findFirst: jest.fn().mockResolvedValue(previousEntry),
            create: jest.fn().mockResolvedValue(record),
            update: jest
              .fn()
              .mockResolvedValue({ ...record, entryHash: 'new-hash' }),
          },
        };
        return fn(tx);
      });

      const result = await service.createAuditLog({
        entityType: 'case',
        action: 'read',
        details: {},
      });
      expect(result).not.toBeNull();
    });
  });

  describe('verifyAuditChain', () => {
    it('returns valid when chain is intact', async () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      const hash1 = cryptoUtil.computeAuditEntryHash(
        'id-1',
        'login',
        'off-1',
        date,
        null,
      );
      const hash2 = cryptoUtil.computeAuditEntryHash(
        'id-2',
        'read',
        'off-1',
        date,
        hash1,
      );

      auditRepository.getAuditChainForVerification.mockResolvedValue([
        {
          id: 'id-1',
          action: 'login',
          officerId: 'off-1',
          createdAt: date,
          previousHash: null,
          entryHash: hash1,
        },
        {
          id: 'id-2',
          action: 'read',
          officerId: 'off-1',
          createdAt: date,
          previousHash: hash1,
          entryHash: hash2,
        },
      ]);

      const result = await service.verifyAuditChain();
      expect(result.valid).toBe(true);
      expect(result.verified).toBe(2);
      expect(result.breaks).toHaveLength(0);
    });

    it('detects tampered entry hash', async () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      auditRepository.getAuditChainForVerification.mockResolvedValue([
        {
          id: 'id-1',
          action: 'login',
          officerId: 'off-1',
          createdAt: date,
          previousHash: null,
          entryHash: 'tampered',
        },
      ]);

      const result = await service.verifyAuditChain();
      expect(result.valid).toBe(false);
      expect(result.breaks).toHaveLength(1);
    });

    it('detects broken chain linkage', async () => {
      const date = new Date('2026-01-01T00:00:00.000Z');
      const correctHash1 = cryptoUtil.computeAuditEntryHash(
        'id-1',
        'login',
        'off-1',
        date,
        null,
      );
      const hash2 = cryptoUtil.computeAuditEntryHash(
        'id-2',
        'read',
        'off-1',
        date,
        'wrong-prev',
      );

      auditRepository.getAuditChainForVerification.mockResolvedValue([
        {
          id: 'id-1',
          action: 'login',
          officerId: 'off-1',
          createdAt: date,
          previousHash: null,
          entryHash: correctHash1,
        },
        {
          id: 'id-2',
          action: 'read',
          officerId: 'off-1',
          createdAt: date,
          previousHash: 'wrong-prev',
          entryHash: hash2,
        },
      ]);

      const result = await service.verifyAuditChain();
      expect(result.valid).toBe(false);
      expect(result.breaks.length).toBeGreaterThanOrEqual(1);
    });

    it('skips pre-migration entries without hashes', async () => {
      auditRepository.getAuditChainForVerification.mockResolvedValue([
        {
          id: 'id-1',
          action: 'old',
          officerId: 'off-1',
          createdAt: new Date(),
          previousHash: null,
          entryHash: null,
        },
      ]);

      const result = await service.verifyAuditChain();
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(1);
      expect(result.verified).toBe(0);
    });
  });
});
