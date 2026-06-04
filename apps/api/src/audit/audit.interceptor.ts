import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditMetadata, AUDIT_KEY } from '../auth/decorators/audit.decorator';
import { AuditService } from './audit.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id: string; email: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const actorId = user?.id || 'system';

    const entityId = this.extractEntityId(request, auditMeta);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.auditService.log({
            actorId,
            action: auditMeta.action,
            entity: auditMeta.entity,
            entityId: entityId || response?.id || 'unknown',
            newValue: auditMeta.action !== 'DELETE' ? this.sanitize(response) : null,
            previousValue: null, // For updates, we would need to fetch before
            metadata: {
              path: request.path,
              method: request.method,
            },
          });
        } catch (err) {
          // Fail silently - don't break the request if audit fails
          console.error('Audit log failed:', err);
        }
      }),
    );
  }

  private extractEntityId(request: RequestWithUser, meta: AuditMetadata): string | undefined {
    if (meta.entityIdParam) {
      return request.params[meta.entityIdParam];
    }
    return undefined;
  }

  private sanitize(data: any): any {
    if (!data) return null;
    if (typeof data !== 'object') return data;
    // Remove sensitive fields
    const { password, token, secret, ...safe } = data;
    return safe;
  }
}
