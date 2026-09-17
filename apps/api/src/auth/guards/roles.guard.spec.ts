import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function makeContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows the request when the route has no @Roles() metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ projectRole: MemberRole.VIEWER }))).toBe(true);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([MemberRole.ADMIN]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the user role is not in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([MemberRole.ADMIN, MemberRole.OWNER]);
    expect(() =>
      guard.canActivate(makeContext({ projectRole: MemberRole.EDITOR })),
    ).toThrow(ForbiddenException);
  });

  it('allows the request when the user role is in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([MemberRole.ADMIN, MemberRole.OWNER]);
    expect(guard.canActivate(makeContext({ projectRole: MemberRole.OWNER }))).toBe(true);
  });

  it('defaults an authenticated user with no projectRole to VIEWER (least privilege)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([MemberRole.EDITOR]);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('reads metadata via ROLES_KEY from both handler and class', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([MemberRole.VIEWER]);
    const ctx = makeContext({ projectRole: MemberRole.VIEWER });
    guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
  });
});
