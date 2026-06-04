import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MemberRole } from '@prisma/client';

@Injectable()
export class MockAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // For development: simulate authenticated user
    // In production, this would validate JWT/OAuth2 token
    const role = (req.headers['x-role'] as string) || 'viewer';
    const userId = (req.headers['x-user-id'] as string) || 'system';

    const roleMap: Record<string, MemberRole> = {
      owner: MemberRole.OWNER,
      admin: MemberRole.ADMIN,
      editor: MemberRole.EDITOR,
      viewer: MemberRole.VIEWER,
    };

    (req as any).user = {
      id: userId,
      email: `${role}@flagforge.local`,
      name: role.charAt(0).toUpperCase() + role.slice(1) + ' User',
      role: role,
      projectRole: roleMap[role] || MemberRole.VIEWER,
    };

    next();
  }
}
