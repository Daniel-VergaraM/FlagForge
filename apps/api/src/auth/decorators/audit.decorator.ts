import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: string;
  entity: string;
  entityIdParam?: string; // param name to extract entity ID from
}

export const Audit = (action: string, entity: string, entityIdParam?: string) =>
  SetMetadata(AUDIT_KEY, { action, entity, entityIdParam } as AuditMetadata);
