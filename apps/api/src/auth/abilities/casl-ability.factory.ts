import { PureAbility, AbilityBuilder, ExtractSubjectType } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { Injectable } from '@nestjs/common';
import { MemberRole, UserRole } from '@prisma/client';
import { Flag, Project, Environment, User, AuditLog } from '@prisma/client';

type AppSubjects = Subjects<{
  Flag: Flag;
  Project: Project;
  Environment: Environment;
  User: User;
  AuditLog: AuditLog;
  all: 'all';
}>;

export type AppAbility = PureAbility<[string, AppSubjects], PrismaQuery>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User & { projectRole?: MemberRole }) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

    // Base permissions for all authenticated users
    can('read', 'Flag');
    can('read', 'Project');
    can('read', 'Environment');

    const effectiveRole = user.projectRole || this.mapGlobalRoleToMemberRole(user.role);

    switch (effectiveRole) {
      case MemberRole.VIEWER:
        // Viewers can only read
        break;

      case MemberRole.EDITOR:
        can('create', 'Flag');
        can('update', 'Flag');
        can('delete', 'Flag');
        break;

      case MemberRole.ADMIN:
        can('create', 'Flag');
        can('update', 'Flag');
        can('delete', 'Flag');
        can('manage', 'Project');
        can('create', 'Environment');
        can('update', 'Environment');
        can('delete', 'Environment');
        can('read', 'AuditLog');
        break;

      case MemberRole.OWNER:
        can('manage', 'all');
        can('create', 'all');
        can('read', 'all');
        can('update', 'all');
        can('delete', 'all');
        break;
    }

    // Global admin override
    if (user.role === UserRole.ADMIN) {
      can('manage', 'all');
    }

    return build({
      detectSubjectType: (item) =>
        (item as any).constructor as ExtractSubjectType<AppSubjects>,
    });
  }

  private mapGlobalRoleToMemberRole(role: UserRole): MemberRole {
    return role === UserRole.ADMIN ? MemberRole.ADMIN : MemberRole.VIEWER;
  }
}
