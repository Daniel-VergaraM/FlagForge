import { MemberRole, UserRole } from '@prisma/client';
import { CaslAbilityFactory } from './casl-ability.factory';

// @casl/prisma resolves subject type by string (or a Prisma model's static
// `modelName`), not by a plain class's `constructor.name` - so rules are
// checked against the string subject type, matching how `can('read', 'Flag')`
// is declared in the factory itself.
function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    role: UserRole.VIEWER,
    ...overrides,
  } as any;
}

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('VIEWER can read but not create/update/delete flags', () => {
    const ability = factory.createForUser(user({ projectRole: MemberRole.VIEWER }));
    expect(ability.can('read', 'Flag')).toBe(true);
    expect(ability.can('create', 'Flag')).toBe(false);
    expect(ability.can('update', 'Flag')).toBe(false);
    expect(ability.can('delete', 'Flag')).toBe(false);
  });

  it('EDITOR can manage flags but not read audit logs or manage the project', () => {
    const ability = factory.createForUser(user({ projectRole: MemberRole.EDITOR }));
    expect(ability.can('create', 'Flag')).toBe(true);
    expect(ability.can('update', 'Flag')).toBe(true);
    expect(ability.can('delete', 'Flag')).toBe(true);
    expect(ability.can('read', 'AuditLog')).toBe(false);
    expect(ability.can('manage', 'Project')).toBe(false);
  });

  it('ADMIN can manage the project and read audit logs', () => {
    const ability = factory.createForUser(user({ projectRole: MemberRole.ADMIN }));
    expect(ability.can('manage', 'Project')).toBe(true);
    expect(ability.can('read', 'AuditLog')).toBe(true);
    expect(ability.can('delete', 'Flag')).toBe(true);
  });

  it('OWNER can manage everything', () => {
    const ability = factory.createForUser(user({ projectRole: MemberRole.OWNER }));
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'AuditLog')).toBe(true);
  });

  it('falls back to VIEWER-equivalent permissions when there is no projectRole and the global role is VIEWER', () => {
    const ability = factory.createForUser(user({ role: UserRole.VIEWER }));
    expect(ability.can('read', 'Flag')).toBe(true);
    expect(ability.can('create', 'Flag')).toBe(false);
  });

  it('a global ADMIN role overrides the project role and can manage everything', () => {
    const ability = factory.createForUser(user({ role: UserRole.ADMIN, projectRole: MemberRole.VIEWER }));
    expect(ability.can('manage', 'all')).toBe(true);
  });
});
