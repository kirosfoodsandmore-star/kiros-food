import { likePattern, SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { AuditListFilter, AuditLogDTO } from "../dto/audit.dto";
import { AuditLogEntity, type AuditLog } from "../entities/auditLog.entity";

export class AuditRepository {
  static Instance = new AuditRepository();
  private constructor() {}

  async insert(entry: Omit<AuditLog, "id" | "createdAt">, tx?: Tx): Promise<void> {
    const repo = db(tx).getRepository(AuditLogEntity);
    await repo.save(repo.create(entry));
  }

  async list(organizationId: string, f: AuditListFilter): Promise<PagedRows<AuditLogDTO>> {
    const p = new SqlParams();
    const where = [`a.organization_id = ${p.add(organizationId)}`];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(a.summary ILIKE ${s} OR a.user_name ILIKE ${s})`);
    }
    if (f.action) where.push(`a.action = ${p.add(f.action)}`);
    if (f.entityType) where.push(`a.entity_type = ${p.add(f.entityType)}`);
    if (f.entityId) where.push(`a.entity_id = ${p.add(f.entityId)}`);
    if (f.userId) where.push(`a.user_id = ${p.add(f.userId)}`);
    // Entries with no branch are organisation-wide (settings, roles, staff, sign-ins): only people who see every branch read those.
    if (f.branchIds) where.push(`a.branch_id = ANY(${p.add(f.branchIds)}::uuid[])`);
    if (f.from && f.to) where.push(tzDateBetween("a.created_at", p.add(f.from), p.add(f.to), p.add(f.timezone)));
    const rows = await db().query(
      `SELECT a.id, a.branch_id AS "branchId", a.user_id AS "userId", a.user_name AS "userName", a.action,
              a.entity_type AS "entityType", a.entity_id AS "entityId", a.summary, a.before, a.after, a.ip,
              a.created_at AS "createdAt", COUNT(*) OVER() AS "__total"
       FROM audit_logs a WHERE ${where.join(" AND ")}
       ORDER BY a.created_at DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<AuditLogDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }
}
