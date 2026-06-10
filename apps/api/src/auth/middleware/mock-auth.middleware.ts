import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberRole } from '@prisma/client';

@Injectable()
export class MockAuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const apiKeyHeader = req.headers['x-api-key'] as string;

    if (apiKeyHeader) {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { key: apiKeyHeader, revokedAt: null },
        include: { environment: true },
      });

      if (apiKey) {
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        (req as any).user = {
          id: 'system',
          email: 'system@flagforge.local',
          name: 'System',
          role: 'system',
          projectRole: MemberRole.OWNER,
          apiKeyId: apiKey.id,
          environmentId: apiKey.environmentId,
        };

        return next();
      }
    }

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
