// Audit trail. Writes that matter (prices, availability, order status, settings, staff) call record()
// with their transaction so the log row commits (or rolls back) together with the change.
import type { Tx } from "../../../infrastructure/database/transaction";
import { branchScope } from "../../../shared/access/scope";
import type { Actor } from "../../../shared/types/actor";
import { resolveRange } from "../../../shared/utils/dates";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import type { AuditEntryInput, AuditListFilter } from "../dto/audit.dto";
import { AuditRepository } from "../repositories/audit.repository";
import type { ListAuditQuery } from "../validators/audit.schema";

/** Drop secrets and bulky fields before storing a snapshot. */
function sanitize(snapshot: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!snapshot) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (/password|token|secret|sealed/i.test(key)) continue;
    if (value !== null && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

export class AuditService {
  static Instance = new AuditService();
  private constructor(
    private readonly repo = AuditRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance
  ) {}

  async record(actor: Actor | null, organizationId: string, entry: AuditEntryInput, tx?: Tx): Promise<void> {
    await this.repo.insert(
      {
        organizationId,
        branchId: entry.branchId ?? null,
        userId: actor?.id ?? null,
        userName: actor?.name ?? "System",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 255),
        before: sanitize(entry.before),
        after: sanitize(entry.after),
        ip: actor?.ip ?? null,
      },
      tx
    );
  }

  /** Shorthand for the common case: the actor's own restaurant. */
  log(actor: Actor, entry: AuditEntryInput, tx?: Tx): Promise<void> {
    return this.record(actor, actor.organizationId, entry, tx);
  }

  async list(actor: Actor, query: ListAuditQuery) {
    const org = await this.organizations.findById(actor.organizationId);
    const timezone = org?.timezone ?? "Africa/Lagos";
    const range = query.from || query.to ? resolveRange(timezone, query.from, query.to) : null;
    const filter: AuditListFilter = { ...query, timezone, from: range?.from, to: range?.to, branchIds: branchScope(actor, query.branchId) };
    return this.repo.list(actor.organizationId, filter);
  }
}
