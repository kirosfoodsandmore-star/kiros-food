import { db } from "../../../infrastructure/database/transaction";
import { AvailabilityEntity } from "../entities/availability.entity";

export interface SoldOutRow {
  id: string;
  branchId: string;
  itemId: string | null;
  optionId: string | null;
  restoreAt: Date | null;
  updatedAt: Date;
  name: string;
  kind: "item" | "option";
}

export class AvailabilityRepository {
  static Instance = new AvailabilityRepository();
  private constructor() {}

  /** Sold-out item and option ids at a branch. */
  async soldOutAt(branchId: string): Promise<{ items: Set<string>; options: Set<string> }> {
    const rows: Array<{ itemId: string | null; optionId: string | null }> = await db().query(
      `SELECT item_id AS "itemId", option_id AS "optionId" FROM availability WHERE branch_id = $1`,
      [branchId]
    );
    const items = new Set<string>();
    const options = new Set<string>();
    for (const r of rows) {
      if (r.itemId) items.add(r.itemId);
      if (r.optionId) options.add(r.optionId);
    }
    return { items, options };
  }

  async list(organizationId: string, branchIds: string[] | null): Promise<SoldOutRow[]> {
    return db().query(
      `SELECT a.id, a.branch_id AS "branchId", a.item_id AS "itemId", a.option_id AS "optionId", a.restore_at AS "restoreAt", a.updated_at AS "updatedAt",
              COALESCE(i.name, o.name) AS name, CASE WHEN a.item_id IS NOT NULL THEN 'item' ELSE 'option' END AS kind
       FROM availability a LEFT JOIN items i ON i.id = a.item_id LEFT JOIN options o ON o.id = a.option_id
       WHERE a.organization_id = $1 AND ($2::uuid[] IS NULL OR a.branch_id = ANY($2)) ORDER BY a.updated_at DESC LIMIT 500`,
      [organizationId, branchIds]
    );
  }

  async markSoldOut(organizationId: string, branchId: string, target: { itemId?: string; optionId?: string }, restoreAt: Date | null, updatedById: string | null): Promise<void> {
    const column = target.itemId ? "item_id" : "option_id";
    const value = target.itemId ?? target.optionId;
    await db().query(
      `INSERT INTO availability (organization_id, branch_id, ${column}, restore_at, updated_by_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (branch_id, ${column}) WHERE ${column} IS NOT NULL DO UPDATE SET restore_at = EXCLUDED.restore_at, updated_by_id = EXCLUDED.updated_by_id, updated_at = now()`,
      [organizationId, branchId, value, restoreAt, updatedById]
    );
  }

  async restore(branchId: string, target: { itemId?: string; optionId?: string }): Promise<void> {
    await db().getRepository(AvailabilityEntity).delete(target.itemId ? { branchId, itemId: target.itemId } : { branchId, optionId: target.optionId });
  }

  /** Rows whose auto-restore time has passed. Deletes them and returns what was restored. */
  async restoreDue(): Promise<Array<{ organizationId: string; branchId: string; itemId: string | null; optionId: string | null }>> {
    const result: unknown = await db().query(
      `DELETE FROM availability WHERE restore_at IS NOT NULL AND restore_at <= now() RETURNING organization_id AS "organizationId", branch_id AS "branchId", item_id AS "itemId", option_id AS "optionId"`
    );
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : (result as never[]);
  }
}
