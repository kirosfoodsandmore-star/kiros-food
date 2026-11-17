import { In } from "typeorm";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { BranchDTO, DeliveryZoneDTO, HolidayClosureDTO, OpeningHourDTO } from "../dto/branch.dto";
import { BranchEntity, type Branch } from "../entities/branch.entity";
import { BranchMenuEntity } from "../entities/branchMenu.entity";
import { DeliveryZoneEntity, type DeliveryZone } from "../entities/deliveryZone.entity";
import { HolidayClosureEntity } from "../entities/holidayClosure.entity";
import { OpeningHourEntity } from "../entities/openingHour.entity";

const SELECT_BRANCH = `
  SELECT b.id, b.name, b.city, b.address, b.lat, b.lng, b.phone, b.timezone, b.is_paused AS "isPaused", b.pause_reason AS "pauseReason",
         b.delivery_enabled AS "deliveryEnabled", b.pickup_enabled AS "pickupEnabled", b.prep_time_minutes AS "prepTimeMinutes",
         b.slot_interval_minutes AS "slotIntervalMinutes", b.payment_method_override AS "paymentMethodOverride", b.is_active AS "isActive",
         b.sort_order AS "sortOrder", b.created_at AS "createdAt",
         COALESCE((SELECT array_agg(bm.menu_id ORDER BY bm.sort_order) FROM branch_menus bm JOIN menus m ON m.id = bm.menu_id AND m.deleted_at IS NULL WHERE bm.branch_id = b.id), '{}') AS "menuIds"
  FROM branches b`;

export class BranchRepository {
  static Instance = new BranchRepository();
  private constructor() {}

  // ── Branches ───────────────────────────────────────────────────────────────

  async list(organizationId: string, branchIds: string[] | null, activeOnly = false): Promise<BranchDTO[]> {
    const where = ["b.organization_id = $1", "b.deleted_at IS NULL"];
    const params: unknown[] = [organizationId];
    if (branchIds) {
      params.push(branchIds);
      where.push(`b.id = ANY($${params.length}::uuid[])`);
    }
    if (activeOnly) where.push("b.is_active = true");
    return db().query(`${SELECT_BRANCH} WHERE ${where.join(" AND ")} ORDER BY b.sort_order, b.name`, params);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<BranchDTO | null> {
    const rows: BranchDTO[] = await db(tx).query(`${SELECT_BRANCH} WHERE b.organization_id = $1 AND b.id = $2 AND b.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async findEntity(organizationId: string, id: string, tx?: Tx): Promise<Branch | null> {
    return db(tx).getRepository(BranchEntity).findOne({ where: { id, organizationId } });
  }

  async existingIds(organizationId: string, ids: string[]): Promise<string[]> {
    const rows = await db().getRepository(BranchEntity).find({ where: { organizationId, id: In(ids) }, select: ["id"] });
    return rows.map((r) => r.id);
  }

  async create(data: Omit<Branch, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<Branch> {
    const repo = db(tx).getRepository(BranchEntity);
    return repo.save(repo.create(data));
  }

  async update(organizationId: string, id: string, data: Partial<Branch>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(BranchEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(BranchEntity).softDelete({ id, organizationId });
  }

  async countActive(organizationId: string): Promise<number> {
    return db().getRepository(BranchEntity).count({ where: { organizationId, isActive: true } });
  }

  // ── Opening hours & closures ───────────────────────────────────────────────

  async hours(branchId: string, tx?: Tx): Promise<OpeningHourDTO[]> {
    return db(tx).query(`SELECT weekday, opens_at AS "opensAt", closes_at AS "closesAt" FROM opening_hours WHERE branch_id = $1 ORDER BY weekday, opens_at`, [branchId]);
  }

  async hoursForBranches(branchIds: string[]): Promise<Map<string, OpeningHourDTO[]>> {
    const map = new Map<string, OpeningHourDTO[]>();
    if (branchIds.length === 0) return map;
    const rows: Array<OpeningHourDTO & { branchId: string }> = await db().query(
      `SELECT branch_id AS "branchId", weekday, opens_at AS "opensAt", closes_at AS "closesAt" FROM opening_hours WHERE branch_id = ANY($1::uuid[]) ORDER BY weekday, opens_at`,
      [branchIds]
    );
    for (const r of rows) {
      const list = map.get(r.branchId) ?? [];
      list.push({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt });
      map.set(r.branchId, list);
    }
    return map;
  }

  async replaceHours(branchId: string, hours: OpeningHourDTO[], tx: Tx): Promise<void> {
    await tx.getRepository(OpeningHourEntity).delete({ branchId });
    if (hours.length > 0) await tx.getRepository(OpeningHourEntity).insert(hours.map((h) => ({ ...h, branchId })));
  }

  async closures(branchId: string, fromDate?: string): Promise<HolidayClosureDTO[]> {
    return db().query(
      `SELECT id, date, reason FROM holiday_closures WHERE branch_id = $1 AND ($2::date IS NULL OR date >= $2) ORDER BY date LIMIT 200`,
      [branchId, fromDate ?? null]
    );
  }

  async closuresForBranches(branchIds: string[], fromDate: string): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (branchIds.length === 0) return map;
    const rows: Array<{ branchId: string; date: string }> = await db().query(
      `SELECT branch_id AS "branchId", date FROM holiday_closures WHERE branch_id = ANY($1::uuid[]) AND date >= $2`,
      [branchIds, fromDate]
    );
    for (const r of rows) map.set(r.branchId, [...(map.get(r.branchId) ?? []), r.date]);
    return map;
  }

  async addClosure(branchId: string, date: string, reason: string | null): Promise<HolidayClosureDTO> {
    const repo = db().getRepository(HolidayClosureEntity);
    const saved = await repo.save(repo.create({ branchId, date, reason }));
    return { id: saved.id, date: saved.date, reason: saved.reason };
  }

  async removeClosure(branchId: string, id: string): Promise<void> {
    await db().getRepository(HolidayClosureEntity).delete({ id, branchId });
  }

  // ── Delivery zones ─────────────────────────────────────────────────────────

  async zones(branchId: string, activeOnly = false): Promise<DeliveryZoneDTO[]> {
    return db().query(
      `SELECT id, name, max_distance_km AS "maxDistanceKm", fee, min_order AS "minOrder", free_above_amount AS "freeAboveAmount", extra_minutes AS "extraMinutes", is_active AS "isActive"
       FROM delivery_zones WHERE branch_id = $1 AND deleted_at IS NULL ${activeOnly ? "AND is_active = true" : ""} ORDER BY max_distance_km`,
      [branchId]
    );
  }

  async findZone(branchId: string, id: string): Promise<DeliveryZone | null> {
    return db().getRepository(DeliveryZoneEntity).findOne({ where: { id, branchId } });
  }

  async createZone(data: Omit<DeliveryZone, "id" | "createdAt" | "updatedAt" | "deletedAt">): Promise<DeliveryZone> {
    const repo = db().getRepository(DeliveryZoneEntity);
    return repo.save(repo.create(data));
  }

  async updateZone(branchId: string, id: string, data: Partial<DeliveryZone>): Promise<void> {
    await db().getRepository(DeliveryZoneEntity).update({ id, branchId }, data);
  }

  async deleteZone(branchId: string, id: string): Promise<void> {
    await db().getRepository(DeliveryZoneEntity).softDelete({ id, branchId });
  }

  // ── Menus served ───────────────────────────────────────────────────────────

  async setMenus(branchId: string, menuIds: string[], tx?: Tx): Promise<void> {
    const repo = db(tx).getRepository(BranchMenuEntity);
    await repo.delete({ branchId });
    if (menuIds.length > 0) await repo.insert(menuIds.map((menuId, i) => ({ branchId, menuId, sortOrder: i })));
  }

  async servesMenu(branchId: string, menuId: string): Promise<boolean> {
    return (await db().getRepository(BranchMenuEntity).count({ where: { branchId, menuId } })) > 0;
  }

  async menusForBranches(branchIds: string[]): Promise<Map<string, Array<{ id: string; name: string; description: string | null; imageUrl: string | null }>>> {
    const map = new Map<string, Array<{ id: string; name: string; description: string | null; imageUrl: string | null }>>();
    if (branchIds.length === 0) return map;
    const rows: Array<{ branchId: string; id: string; name: string; description: string | null; imageUrl: string | null }> = await db().query(
      `SELECT bm.branch_id AS "branchId", m.id, m.name, m.description, m.image_url AS "imageUrl"
       FROM branch_menus bm JOIN menus m ON m.id = bm.menu_id AND m.deleted_at IS NULL AND m.is_active = true
       WHERE bm.branch_id = ANY($1::uuid[]) ORDER BY bm.sort_order, m.sort_order`,
      [branchIds]
    );
    for (const r of rows) map.set(r.branchId, [...(map.get(r.branchId) ?? []), { id: r.id, name: r.name, description: r.description, imageUrl: r.imageUrl }]);
    return map;
  }
}
