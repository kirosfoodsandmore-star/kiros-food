export interface AuditEntryInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditLogDTO {
  id: string;
  branchId: string | null;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
}

export interface AuditListFilter {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  branchIds?: string[] | null;
  from?: string;
  to?: string;
  timezone: string;
}
