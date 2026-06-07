const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface Flag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  flags: {
    list: () => fetchJson<Flag[]>('/flags'),
    get: (id: string) => fetchJson<Flag>(`/flags/${id}`),
    create: (data: Partial<Flag>) =>
      fetchJson<Flag>('/flags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Flag>) =>
      fetchJson<Flag>(`/flags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetch(`/flags/${id}`, { method: 'DELETE' }).then((r) => r.ok),
  },
  audit: {
    list: (entityId?: string) =>
      fetchJson<AuditEntry[]>(`/flags/${entityId || ''}/audit`.replace('//', '/').replace('/audit', `/${entityId}/audit`)),
    byFlag: (flagId: string) => fetchJson<AuditEntry[]>(`/flags/${flagId}/audit`),
  },
};
