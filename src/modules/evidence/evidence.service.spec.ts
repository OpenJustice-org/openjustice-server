import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { EvidenceRepository } from './evidence.repository';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BusinessRuleException } from '../../common/errors/business-rule.exception';

const mockEvidence = {
  id: 'ev-1',
  qrCode: 'QR-001',
  type: 'physical',
  description: 'Knife found at scene',
  status: 'collected',
  isSealed: false,
  stationId: 'st-1',
  collectedBy: { id: 'off-1', name: 'Officer A' },
  collectedDate: new Date(),
  cases: [{ case: { id: 'case-1' }, caseId: 'case-1' }],
};

describe('EvidenceService', () => {
  let service: EvidenceService;
  let evidenceRepository: Record<string, jest.Mock>;
  let prisma: Record<string, any>;
  let auditService: { createAuditLog: jest.Mock };

  beforeEach(async () => {
    evidenceRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByQrCode: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      createCustodyEvent: jest.fn(),
      getCustodyChain: jest.fn(),
      linkToCase: jest.fn(),
      findByCase: jest.fn(),
      seal: jest.fn(),
      delete: jest.fn(),
    };
    prisma = {
      evidence: {
        count: jest.fn().mockResolvedValue(10),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    auditService = { createAuditLog: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: EvidenceRepository, useValue: evidenceRepository },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(EvidenceService);
  });

  describe('findById', () => {
    it('returns evidence and logs audit read', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      const result = await service.findById('ev-1', 'off-1');
      expect(result).toHaveProperty('collectedAt');
      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'read', entityId: 'ev-1' }),
      );
    });

    it('throws NotFoundException', async () => {
      evidenceRepository.findById.mockResolvedValue(null);
      await expect(service.findById('missing', 'off-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates evidence with custody event and case link', async () => {
      evidenceRepository.create.mockResolvedValue(mockEvidence);
      evidenceRepository.createCustodyEvent.mockResolvedValue({});
      evidenceRepository.linkToCase.mockResolvedValue({});

      const result = await service.create(
        {
          caseId: 'case-1',
          type: 'physical',
          description: 'Test',
          collectedBy: 'off-1',
        },
        'off-1',
        'st-1',
      );
      expect(result.id).toBe('ev-1');
      expect(evidenceRepository.createCustodyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COLLECTED' }),
      );
      expect(evidenceRepository.linkToCase).toHaveBeenCalled();
    });

    it('rejects invalid evidence type', async () => {
      await expect(
        service.create(
          {
            caseId: 'case-1',
            type: 'alien',
            description: 'X',
            collectedBy: 'off-1',
          },
          'off-1',
          'st-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates unsealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      evidenceRepository.update.mockResolvedValue({
        ...mockEvidence,
        description: 'Updated',
      });
      const result = await service.update(
        'ev-1',
        { description: 'Updated' },
        'off-1',
      );
      expect(result.description).toBe('Updated');
    });

    it('prevents modification of sealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      await expect(
        service.update('ev-1', { description: 'X' }, 'off-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('updateStatus', () => {
    it.each([
      ['collected', 'stored'],
      ['collected', 'analyzed'],
      ['stored', 'court'],
      ['court', 'returned'],
      ['returned', 'destroyed'],
    ])('allows %s -> %s', async (from, to) => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        status: from,
      });
      evidenceRepository.updateStatus.mockResolvedValue({
        ...mockEvidence,
        status: to,
      });
      const result = await service.updateStatus('ev-1', to, 'off-1');
      expect(result.status).toBe(to);
    });

    it.each([
      ['destroyed', 'stored'],
      ['disposed', 'court'],
      ['collected', 'court'],
    ])('rejects %s -> %s', async (from, to) => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        status: from,
      });
      await expect(service.updateStatus('ev-1', to, 'off-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('rejects status change on sealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      await expect(
        service.updateStatus('ev-1', 'stored', 'off-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('addCustodyEvent', () => {
    it('adds a valid custody event with signature', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      evidenceRepository.createCustodyEvent.mockResolvedValue({ id: 'ce-1' });

      const result = await service.addCustodyEvent(
        'ev-1',
        { officerId: 'off-1', action: 'TRANSFERRED', toLocation: 'Lab' },
        'off-1',
      );
      expect(result.id).toBe('ce-1');
      expect(evidenceRepository.createCustodyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ signature: expect.any(String) }),
      );
    });

    it('rejects invalid custody action', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      await expect(
        service.addCustodyEvent(
          'ev-1',
          { officerId: 'off-1', action: 'DESTROY' },
          'off-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects custody event on sealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      await expect(
        service.addCustodyEvent(
          'ev-1',
          { officerId: 'off-1', action: 'TRANSFERRED' },
          'off-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('seal', () => {
    it('seals evidence and creates custody event', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      evidenceRepository.seal.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      evidenceRepository.createCustodyEvent.mockResolvedValue({});

      const result = await service.seal('ev-1', 'off-1');
      expect(result.isSealed).toBe(true);
      expect(evidenceRepository.createCustodyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SEALED' }),
      );
    });

    it('rejects sealing already sealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      await expect(service.seal('ev-1', 'off-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('deletes unsealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue(mockEvidence);
      evidenceRepository.delete.mockResolvedValue({});
      const result = await service.delete('ev-1', 'off-1');
      expect(result).toEqual({ deleted: true });
    });

    it('prevents deletion of sealed evidence', async () => {
      evidenceRepository.findById.mockResolvedValue({
        ...mockEvidence,
        isSealed: true,
      });
      await expect(service.delete('ev-1', 'off-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('getStats', () => {
    it('returns aggregated statistics', async () => {
      const result = await service.getStats('st-1');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('sealed');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('byStatus');
    });
  });
});
