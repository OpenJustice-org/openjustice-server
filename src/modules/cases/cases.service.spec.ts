import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesRepository } from './cases.repository';
import { PrismaService } from '../../common/database/prisma.service';
import { BusinessRuleException } from '../../common/errors/business-rule.exception';

const mockCase = {
  id: 'case-1',
  caseNumber: 'SL-2026-0001',
  title: 'Test Case',
  status: 'open',
  severity: 'major',
  category: 'theft',
  reportedDate: new Date(),
  incidentDate: new Date(),
  stationId: 'st-1',
  officerId: 'off-1',
  officer: { id: 'off-1', name: 'Officer A' },
};

describe('CasesService', () => {
  let service: CasesService;
  let casesRepository: Record<string, jest.Mock>;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    casesRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      addPerson: jest.fn(),
      removePerson: jest.fn(),
      addNote: jest.fn(),
    };
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const module = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: CasesRepository, useValue: casesRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CasesService);
  });

  describe('findById', () => {
    it('returns mapped case when found', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      const result = await service.findById('case-1', 'off-1');
      expect(result).toHaveProperty('assignedTo');
      expect(result).toHaveProperty('reportedAt');
    });

    it('throws NotFoundException when case not found', async () => {
      casesRepository.findById.mockResolvedValue(null);
      await expect(service.findById('missing', 'off-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a case with valid data', async () => {
      casesRepository.create.mockResolvedValue(mockCase);
      const data = {
        title: 'New Case',
        category: 'theft',
        severity: 'major',
        incidentDate: new Date(),
        stationId: 'st-1',
      };
      const result = await service.create(data, 'off-1');
      expect(result.id).toBe('case-1');
      expect(casesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ officerId: 'off-1' }),
      );
    });

    it('rejects invalid severity', async () => {
      const data = {
        title: 'Bad Case',
        category: 'theft',
        severity: 'extreme',
        incidentDate: new Date(),
        stationId: 'st-1',
      };
      await expect(service.create(data, 'off-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates an open case', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      casesRepository.update.mockResolvedValue({
        ...mockCase,
        title: 'Updated',
      });
      const result = await service.update(
        'case-1',
        { title: 'Updated' },
        'off-1',
      );
      expect(result.title).toBe('Updated');
    });

    it('prevents updating a closed case', async () => {
      casesRepository.findById.mockResolvedValue({
        ...mockCase,
        status: 'closed',
      });
      await expect(
        service.update('case-1', { title: 'X' }, 'off-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('rejects invalid severity on update', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      await expect(
        service.update('case-1', { severity: 'extreme' }, 'off-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it.each([
      ['open', 'investigating'],
      ['open', 'closed'],
      ['investigating', 'charged'],
      ['charged', 'court'],
      ['court', 'closed'],
    ])('allows %s -> %s', async (from, to) => {
      casesRepository.findById.mockResolvedValue({ ...mockCase, status: from });
      casesRepository.updateStatus.mockResolvedValue({
        ...mockCase,
        status: to,
      });
      const result = await service.updateStatus('case-1', to, 'off-1');
      expect(result.status).toBe(to);
    });

    it.each([
      ['closed', 'open'],
      ['open', 'court'],
      ['investigating', 'open'],
    ])('rejects %s -> %s', async (from, to) => {
      casesRepository.findById.mockResolvedValue({ ...mockCase, status: from });
      await expect(service.updateStatus('case-1', to, 'off-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('throws NotFoundException for missing case', async () => {
      casesRepository.findById.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', 'closed', 'off-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPerson', () => {
    it('adds a person with valid role', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      casesRepository.addPerson.mockResolvedValue({
        caseId: 'case-1',
        personId: 'p-1',
        role: 'suspect',
      });
      const result = await service.addPerson(
        'case-1',
        'p-1',
        'suspect',
        'off-1',
      );
      expect(result.role).toBe('suspect');
    });

    it('rejects invalid person role', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      await expect(
        service.addPerson('case-1', 'p-1', 'judge', 'off-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addNote', () => {
    it('adds a note to an existing case', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      casesRepository.addNote.mockResolvedValue({
        id: 'note-1',
        content: 'Observation',
      });
      const result = await service.addNote('case-1', 'off-1', 'Observation');
      expect(result.id).toBe('note-1');
    });

    it('rejects empty note content', async () => {
      casesRepository.findById.mockResolvedValue(mockCase);
      await expect(service.addNote('case-1', 'off-1', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addNote('case-1', 'off-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
