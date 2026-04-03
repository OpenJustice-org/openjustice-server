import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard, buildScopeFilter } from './permissions.guard';

function mockContext(
  user: any,
  handler = jest.fn(),
  cls = jest.fn(),
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows access when no permission metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('throws ForbiddenException when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'cases',
      action: 'read',
      scope: 'station',
    });
    expect(() => guard.canActivate(mockContext(null))).toThrow(
      ForbiddenException,
    );
  });

  it('allows SuperAdmin (roleLevel 1) regardless of permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'cases',
      action: 'delete',
      scope: 'national',
    });
    const user = { roleLevel: 1, permissions: [] };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('allows when user has matching permission with sufficient scope', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'cases',
      action: 'read',
      scope: 'station',
    });
    const user = {
      roleLevel: 3,
      permissions: [{ resource: 'cases', action: 'read', scope: 'national' }],
    };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies when user scope is lower than required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'cases',
      action: 'read',
      scope: 'national',
    });
    const user = {
      roleLevel: 3,
      permissions: [{ resource: 'cases', action: 'read', scope: 'station' }],
    };
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when user has no matching resource/action', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'evidence',
      action: 'delete',
      scope: 'own',
    });
    const user = {
      roleLevel: 3,
      permissions: [{ resource: 'cases', action: 'read', scope: 'national' }],
    };
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when permissions array is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      resource: 'cases',
      action: 'read',
      scope: 'own',
    });
    const user = { roleLevel: 3 };
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });
});

describe('buildScopeFilter', () => {
  it('returns empty filter for SuperAdmin', () => {
    const user = { roleLevel: 1, permissions: [] };
    expect(buildScopeFilter(user, 'cases', 'read')).toEqual({});
  });

  it('returns station filter for station scope', () => {
    const user = {
      roleLevel: 3,
      stationId: 'st-1',
      permissions: [{ resource: 'cases', action: 'read', scope: 'station' }],
    };
    expect(buildScopeFilter(user, 'cases', 'read')).toEqual({
      stationId: 'st-1',
    });
  });

  it('returns own filter for own scope', () => {
    const user = {
      id: 'off-1',
      roleLevel: 3,
      permissions: [{ resource: 'cases', action: 'read', scope: 'own' }],
    };
    expect(buildScopeFilter(user, 'cases', 'read')).toEqual({
      officerId: 'off-1',
    });
  });

  it('returns empty filter for national scope', () => {
    const user = {
      roleLevel: 2,
      permissions: [{ resource: 'cases', action: 'read', scope: 'national' }],
    };
    expect(buildScopeFilter(user, 'cases', 'read')).toEqual({});
  });

  it('returns null-id filter when user is null', () => {
    expect(buildScopeFilter(null, 'cases', 'read')).toEqual({ id: null });
  });

  it('returns null-id filter when no matching permission exists', () => {
    const user = { roleLevel: 3, permissions: [] };
    expect(buildScopeFilter(user, 'cases', 'read')).toEqual({ id: null });
  });
});
