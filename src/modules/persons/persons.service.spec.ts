import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsRepository } from './persons.repository';
import { PrismaService } from '../../common/database/prisma.service';

const mockPerson = {
  id: 'p-1',
  nationalId: 'NIN-001',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  gender: 'male',
  nationality: 'Sierra Leonean',
  isWanted: false,
  wantedSince: null,
  riskLevel: 'low',
  aliases: ['JD'],
  createdById: 'off-1',
};

describe('PersonsService', () => {
  let service: PersonsService;
  let personsRepository: Record<string, jest.Mock>;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    personsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNationalId: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      person: {
        findFirst: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        PersonsService,
        { provide: PersonsRepository, useValue: personsRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PersonsService);
  });

  describe('findById', () => {
    it('returns person when found', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      const result = await service.findById('p-1', 'off-1');
      expect(result.id).toBe('p-1');
    });

    it('throws NotFoundException when not found', async () => {
      personsRepository.findById.mockResolvedValue(null);
      await expect(service.findById('missing', 'off-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a person', async () => {
      personsRepository.findByNationalId.mockResolvedValue(null);
      personsRepository.create.mockResolvedValue(mockPerson);
      const result = await service.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          nationalId: 'NIN-001',
        },
        'off-1',
      );
      expect(result.id).toBe('p-1');
    });

    it('throws ConflictException when NIN already exists', async () => {
      personsRepository.findByNationalId.mockResolvedValue(mockPerson);
      await expect(
        service.create(
          {
            firstName: 'Jane',
            lastName: 'Doe',
            nationalId: 'NIN-001',
          },
          'off-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates person without NIN (no uniqueness check)', async () => {
      personsRepository.create.mockResolvedValue({
        ...mockPerson,
        nationalId: undefined,
      });
      const result = await service.create(
        { firstName: 'Jane', lastName: 'Doe' },
        'off-1',
      );
      expect(result).toBeDefined();
      expect(personsRepository.findByNationalId).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates person data', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        firstName: 'Updated',
      });
      const result = await service.update(
        'p-1',
        { firstName: 'Updated' },
        'off-1',
      );
      expect(result.firstName).toBe('Updated');
    });

    it('checks NIN uniqueness when NIN is changed', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.findByNationalId.mockResolvedValue({ id: 'p-other' });
      await expect(
        service.update('p-1', { nationalId: 'NIN-TAKEN' }, 'off-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateWantedStatus', () => {
    it('sets wantedSince when marking as wanted', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        isWanted: true,
        wantedSince: new Date(),
      });
      const result = await service.updateWantedStatus('p-1', true, 'off-1');
      expect(result.isWanted).toBe(true);
      expect(personsRepository.update).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({
          isWanted: true,
          wantedSince: expect.any(Date),
        }),
      );
    });

    it('clears wantedSince when un-marking', async () => {
      personsRepository.findById.mockResolvedValue({
        ...mockPerson,
        isWanted: true,
      });
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        isWanted: false,
        wantedSince: null,
      });
      await service.updateWantedStatus('p-1', false, 'off-1');
      expect(personsRepository.update).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ isWanted: false, wantedSince: null }),
      );
    });
  });

  describe('updateRiskLevel', () => {
    it('accepts valid risk levels', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        riskLevel: 'high',
      });
      const result = await service.updateRiskLevel('p-1', 'high', 'off-1');
      expect(result.riskLevel).toBe('high');
    });

    it('rejects invalid risk level', async () => {
      await expect(
        service.updateRiskLevel('p-1', 'extreme', 'off-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addAlias / removeAlias', () => {
    it('adds a new alias', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        aliases: ['JD', 'Johnny'],
      });
      const result = await service.addAlias('p-1', 'Johnny', 'off-1');
      expect(result.aliases).toContain('Johnny');
    });

    it('rejects duplicate alias', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      await expect(service.addAlias('p-1', 'JD', 'off-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('removes existing alias', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      personsRepository.update.mockResolvedValue({
        ...mockPerson,
        aliases: [],
      });
      const result = await service.removeAlias('p-1', 'JD', 'off-1');
      expect(result.aliases).not.toContain('JD');
    });

    it('rejects removal of non-existing alias', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      await expect(
        service.removeAlias('p-1', 'Unknown', 'off-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('deletes an existing person', async () => {
      personsRepository.findById.mockResolvedValue(mockPerson);
      prisma.person.delete.mockResolvedValue({});
      const result = await service.delete('p-1', 'off-1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException for missing person', async () => {
      personsRepository.findById.mockResolvedValue(null);
      await expect(service.delete('missing', 'off-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
