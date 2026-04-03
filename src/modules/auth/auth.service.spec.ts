import { Test } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as hashUtil from '../../common/utils/hash.util';

// Mock hash utilities
jest.mock('../../common/utils/hash.util');
const mockedHash = hashUtil as jest.Mocked<typeof hashUtil>;

const mockOfficer = {
  id: 'off-1',
  badge: 'SL-001',
  name: 'Test Officer',
  email: 'test@police.sl',
  phone: '232000000',
  roleId: 'role-1',
  stationId: 'st-1',
  active: true,
  pinHash: '$argon2id$hashed',
  pinChangedAt: new Date(),
  failedAttempts: 0,
  lockedUntil: null,
  mfaEnabled: false,
  lastLogin: null,
  role: {
    name: 'Inspector',
    level: 3,
    permissions: [{ resource: 'cases', action: 'read', scope: 'station' }],
  },
  station: {
    name: 'HQ Station',
    code: 'HQ-001',
    region: 'Western',
    district: 'Freetown',
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { officer: { findUnique: jest.Mock; update: jest.Mock } };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let auditService: { createAuditLog: jest.Mock };

  beforeEach(async () => {
    prisma = {
      officer: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        const map: Record<string, any> = {
          'auth.pinExpiryDays': 90,
          'auth.refreshSecret': 'refresh-secret',
          'auth.refreshExpiry': '7d',
          'auth.maxFailedAttempts': 5,
          'auth.lockDurationMinutes': 30,
        };
        return map[key] ?? defaultVal;
      }),
    };
    auditService = { createAuditLog: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('login', () => {
    it('throws BadRequestException when badge or pin missing', async () => {
      await expect(service.login('', 'pin')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login('badge', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when officer not found', async () => {
      prisma.officer.findUnique.mockResolvedValue(null);
      await expect(service.login('UNKNOWN', '12345678')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login', success: false }),
      );
    });

    it('throws UnauthorizedException when account is deactivated', async () => {
      prisma.officer.findUnique.mockResolvedValue({
        ...mockOfficer,
        active: false,
      });
      await expect(service.login('SL-001', '12345678')).rejects.toThrow(
        'Account is deactivated',
      );
    });

    it('throws UnauthorizedException when account is locked', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      prisma.officer.findUnique.mockResolvedValue({
        ...mockOfficer,
        lockedUntil: futureDate,
      });
      await expect(service.login('SL-001', '12345678')).rejects.toThrow(
        'Account is locked',
      );
    });

    it('throws UnauthorizedException when PIN is expired', async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      prisma.officer.findUnique.mockResolvedValue({
        ...mockOfficer,
        pinChangedAt: oldDate,
      });
      await expect(service.login('SL-001', '12345678')).rejects.toThrow(
        'PIN has expired',
      );
    });

    it('throws UnauthorizedException on wrong PIN and increments failed attempts', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.verifyPin.mockResolvedValue(false);
      prisma.officer.update.mockResolvedValue({
        ...mockOfficer,
        failedAttempts: 1,
      });

      await expect(service.login('SL-001', 'wrongpin')).rejects.toThrow(
        'Invalid credentials',
      );
      expect(prisma.officer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedAttempts: { increment: 1 } } }),
      );
    });

    it('locks account after max failed attempts', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.verifyPin.mockResolvedValue(false);
      prisma.officer.update
        .mockResolvedValueOnce({ ...mockOfficer, failedAttempts: 5 }) // increment
        .mockResolvedValueOnce({}); // lock

      await expect(service.login('SL-001', 'wrongpin')).rejects.toThrow(
        'Invalid credentials',
      );
      // Second update call should set lockedUntil
      expect(prisma.officer.update).toHaveBeenCalledTimes(2);
      expect(prisma.officer.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        }),
      );
    });

    it('returns tokens and officer data on successful login', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.verifyPin.mockResolvedValue(true);
      prisma.officer.update.mockResolvedValue({});

      const result = await service.login('SL-001', '12345678');
      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result).toHaveProperty('refreshToken', 'jwt-token');
      expect(result.officer).toMatchObject({
        id: 'off-1',
        badge: 'SL-001',
        roleName: 'Inspector',
        stationName: 'HQ Station',
      });
      // Should reset failed attempts
      expect(prisma.officer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('gives ExternalAuditor (level 0) short-lived tokens', async () => {
      const auditorOfficer = {
        ...mockOfficer,
        role: { ...mockOfficer.role, level: 0, name: 'ExternalAuditor' },
      };
      prisma.officer.findUnique.mockResolvedValue(auditorOfficer);
      mockedHash.verifyPin.mockResolvedValue(true);
      prisma.officer.update.mockResolvedValue({});

      await service.login('SL-001', '12345678');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '2h' }),
      );
    });
  });

  describe('changePin', () => {
    it('changes PIN when current PIN is valid', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.verifyPin.mockResolvedValue(true);
      mockedHash.hashPin.mockResolvedValue('new-hash');
      prisma.officer.update.mockResolvedValue({});

      await expect(
        service.changePin('off-1', '12345678', '98765432'),
      ).resolves.not.toThrow();
      expect(prisma.officer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pinHash: 'new-hash' }),
        }),
      );
    });

    it('throws on invalid current PIN', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.verifyPin.mockResolvedValue(false);

      await expect(
        service.changePin('off-1', 'wrong', '98765432'),
      ).rejects.toThrow('Invalid current PIN');
    });

    it('rejects weak new PIN', async () => {
      await expect(
        service.changePin('off-1', '12345678', '1234'),
      ).rejects.toThrow('at least 8 digits');
      await expect(
        service.changePin('off-1', '12345678', 'abcdefgh'),
      ).rejects.toThrow('only digits');
      await expect(
        service.changePin('off-1', '12345678', '11111111'),
      ).rejects.toThrow('same digit');
    });
  });

  describe('resetPin', () => {
    it('resets PIN and clears lockout', async () => {
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);
      mockedHash.hashPin.mockResolvedValue('reset-hash');
      prisma.officer.update.mockResolvedValue({});

      await service.resetPin('off-1', '98765432', 'admin-1');
      expect(prisma.officer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pinHash: 'reset-hash',
            failedAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('throws when officer not found', async () => {
      prisma.officer.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPin('bad-id', '98765432', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('returns new tokens when refresh token is valid', async () => {
      jwtService.verify.mockReturnValue({ sub: 'off-1' });
      prisma.officer.findUnique.mockResolvedValue(mockOfficer);

      const result = await service.refreshToken('valid-refresh-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.officer.id).toBe('off-1');
    });

    it('throws on invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });
      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when officer is deactivated', async () => {
      jwtService.verify.mockReturnValue({ sub: 'off-1' });
      prisma.officer.findUnique.mockResolvedValue({
        ...mockOfficer,
        active: false,
      });
      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        'Invalid session',
      );
    });
  });
});
