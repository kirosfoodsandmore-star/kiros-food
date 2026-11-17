// Branches: CRUD, opening hours, closures, delivery zones, menus served, pause/resume, and the
// storefront views (open state, distance sort, slots, delivery quote).
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { haversineKm, roundKm } from "../../../shared/utils/geo";
import { AuditService } from "../../audit/services/audit.service";
import { MenuRepository } from "../../menu/repositories/menu.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { computeOpenState, generateSlots, isValidScheduledTime, type BranchClock } from "../domain/openState";
import type { BranchDTO, DeliveryQuoteDTO, DeliveryZoneDTO, HolidayClosureDTO, OpeningHourDTO, StorefrontBranchDTO } from "../dto/branch.dto";
import { BranchRepository } from "../repositories/branch.repository";
import type { BranchBody, HourRow, UpdateBranchBody, ZoneBody } from "../validators/branch.schema";

export class BranchService {
  static Instance = new BranchService();
  private constructor(
    private readonly branches = BranchRepository.Instance,
    private readonly menus = MenuRepository.Instance,
    private readonly audit = AuditService.Instance,
    private readonly organizations = OrganizationRepository.Instance
  ) {}

  // ── Admin ──────────────────────────────────────────────────────────────────

  list(actor: Actor, activeOnly = false): Promise<BranchDTO[]> {
    return this.branches.list(actor.organizationId, branchScope(actor), activeOnly);
  }

  async get(actor: Actor, id: string): Promise<BranchDTO & { hours: OpeningHourDTO[]; closures: HolidayClosureDTO[]; zones: DeliveryZoneDTO[] }> {
    assertBranchAccess(actor, id);
    const branch = await this.branches.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    const [hours, closures, zones] = await Promise.all([this.branches.hours(id), this.branches.closures(id, todayIn(branch.timezone)), this.branches.zones(id)]);
    return { ...branch, hours, closures, zones };
  }

  private async assertMenusExist(organizationId: string, menuIds: string[]): Promise<void> {
    if (menuIds.length === 0) return;
    const known = await this.menus.existingIds(organizationId, menuIds);
    if (known.length !== new Set(menuIds).size) throw AppError.badRequest("One of the menus does not exist");
  }

  async create(actor: Actor, data: BranchBody): Promise<BranchDTO> {
    assertPermission(actor, "branches.edit");
    await this.assertMenusExist(actor.organizationId, data.menuIds);
    const { menuIds, ...fields } = data;
    const branch = await inTransaction(async (tx) => {
      const created = await this.branches.create({ ...fields, organizationId: actor.organizationId, isPaused: false, pauseReason: null, lat: fields.lat ?? null, lng: fields.lng ?? null, phone: fields.phone ?? null, paymentMethodOverride: fields.paymentMethodOverride ?? null }, tx);
      await this.branches.setMenus(created.id, menuIds, tx);
      await this.audit.log(actor, { action: "create", entityType: "branch", entityId: created.id, branchId: created.id, summary: `Created branch "${created.name}"` }, tx);
      return created;
    });
    return (await this.branches.findById(actor.organizationId, branch.id))!;
  }

  async update(actor: Actor, id: string, data: UpdateBranchBody): Promise<BranchDTO> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    const before = await this.branches.findById(actor.organizationId, id);
    if (!before) throw AppError.notFound("Branch not found");
    const { menuIds, ...fields } = data;
    if (menuIds) await this.assertMenusExist(actor.organizationId, menuIds);
    await inTransaction(async (tx) => {
      if (Object.keys(fields).length > 0) await this.branches.update(actor.organizationId, id, fields, tx);
      if (menuIds) await this.branches.setMenus(id, menuIds, tx);
      if (fields.isActive === false) await this.organizations.clearDefaultBranch(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "update", entityType: "branch", entityId: id, branchId: id, summary: `Updated branch "${before.name}"`, before: before as unknown as Record<string, unknown>, after: data as Record<string, unknown> }, tx);
    });
    return (await this.branches.findById(actor.organizationId, id))!;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await this.removeMany(actor, [id]);
  }

  /** Deletes several branches together. Every one is checked first, so either all of them go or none do. */
  async removeMany(actor: Actor, ids: string[]): Promise<{ deleted: number }> {
    assertPermission(actor, "branches.edit");
    const found: BranchDTO[] = [];
    for (const id of new Set(ids)) {
      assertBranchAccess(actor, id);
      const branch = await this.branches.findById(actor.organizationId, id);
      if (!branch) throw AppError.notFound("Branch not found");
      found.push(branch);
    }
    const leaving = found.filter((b) => b.isActive).length;
    if (leaving > 0 && (await this.branches.countActive(actor.organizationId)) - leaving < 1) throw AppError.conflict("A restaurant needs at least one active branch");
    await inTransaction(async (tx) => {
      for (const branch of found) {
        await this.branches.softDelete(actor.organizationId, branch.id, tx);
        await this.organizations.clearDefaultBranch(actor.organizationId, branch.id, tx);
        await this.audit.log(actor, { action: "delete", entityType: "branch", entityId: branch.id, branchId: branch.id, summary: `Deleted branch "${branch.name}"` }, tx);
      }
    });
    return { deleted: found.length };
  }

  async setPaused(actor: Actor, id: string, paused: boolean, reason: string | null): Promise<BranchDTO> {
    assertPermission(actor, "branches.pause");
    assertBranchAccess(actor, id);
    const branch = await this.branches.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    await this.branches.update(actor.organizationId, id, { isPaused: paused, pauseReason: paused ? reason : null });
    await this.audit.log(actor, { action: paused ? "pause" : "resume", entityType: "branch", entityId: id, branchId: id, summary: `${paused ? "Paused" : "Resumed"} ordering at "${branch.name}"${reason ? ` — ${reason}` : ""}` });
    return (await this.branches.findById(actor.organizationId, id))!;
  }

  async setHours(actor: Actor, id: string, hours: HourRow[]): Promise<OpeningHourDTO[]> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    const branch = await this.branches.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    await inTransaction(async (tx) => {
      await this.branches.replaceHours(id, hours, tx);
      await this.audit.log(actor, { action: "update", entityType: "branch_hours", entityId: id, branchId: id, summary: `Updated opening hours for "${branch.name}"`, after: { hours: hours.map((h) => `${h.weekday}:${h.opensAt}-${h.closesAt}`) } }, tx);
    });
    return this.branches.hours(id);
  }

  async addClosure(actor: Actor, id: string, date: string, reason: string | null): Promise<HolidayClosureDTO> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    const branch = await this.branches.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    const closure = await this.branches.addClosure(id, date, reason);
    await this.audit.log(actor, { action: "create", entityType: "branch_closure", entityId: closure.id, branchId: id, summary: `Closed "${branch.name}" on ${date}${reason ? ` (${reason})` : ""}` });
    return closure;
  }

  async removeClosure(actor: Actor, id: string, closureId: string): Promise<void> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    await this.branches.removeClosure(id, closureId);
  }

  async createZone(actor: Actor, id: string, data: ZoneBody): Promise<DeliveryZoneDTO[]> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    const branch = await this.branches.findById(actor.organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    const zone = await this.branches.createZone({ ...data, branchId: id, organizationId: actor.organizationId, freeAboveAmount: data.freeAboveAmount ?? null });
    await this.audit.log(actor, { action: "create", entityType: "delivery_zone", entityId: zone.id, branchId: id, summary: `Added delivery zone "${zone.name}" to "${branch.name}"`, after: data as Record<string, unknown> });
    return this.branches.zones(id);
  }

  async updateZone(actor: Actor, id: string, zoneId: string, data: Partial<ZoneBody>): Promise<DeliveryZoneDTO[]> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    const zone = await this.branches.findZone(id, zoneId);
    if (!zone) throw AppError.notFound("Delivery zone not found");
    await this.branches.updateZone(id, zoneId, data);
    await this.audit.log(actor, { action: "update", entityType: "delivery_zone", entityId: zoneId, branchId: id, summary: `Updated delivery zone "${zone.name}"`, before: zone as unknown as Record<string, unknown>, after: data as Record<string, unknown> });
    return this.branches.zones(id);
  }

  async deleteZone(actor: Actor, id: string, zoneId: string): Promise<void> {
    assertPermission(actor, "branches.edit");
    assertBranchAccess(actor, id);
    await this.branches.deleteZone(id, zoneId);
  }

  // ── Storefront ─────────────────────────────────────────────────────────────

  private clock(b: { timezone: string; isPaused: boolean; prepTimeMinutes: number; slotIntervalMinutes: number }): BranchClock {
    return { timezone: b.timezone, isPaused: b.isPaused, prepTimeMinutes: b.prepTimeMinutes, slotIntervalMinutes: b.slotIntervalMinutes };
  }

  async storefrontList(organizationId: string, at?: { lat: number; lng: number }, q?: string): Promise<StorefrontBranchDTO[]> {
    const branches = (await this.branches.list(organizationId, null, true)).filter((b) => !q || `${b.name} ${b.city} ${b.address}`.toLowerCase().includes(q.toLowerCase()));
    const ids = branches.map((b) => b.id);
    const today = todayIn(branches[0]?.timezone ?? "Africa/Lagos");
    const [hours, closures, menus] = await Promise.all([this.branches.hoursForBranches(ids), this.branches.closuresForBranches(ids, today), this.branches.menusForBranches(ids)]);
    const list = branches.map((b): StorefrontBranchDTO => {
      const state = computeOpenState(this.clock(b), hours.get(b.id) ?? [], closures.get(b.id) ?? []);
      const distanceKm = at && b.lat !== null && b.lng !== null ? roundKm(haversineKm(at.lat, at.lng, b.lat, b.lng)) : null;
      return {
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        phone: b.phone,
        timezone: b.timezone,
        deliveryEnabled: b.deliveryEnabled,
        pickupEnabled: b.pickupEnabled,
        isOpen: state.isOpen,
        isPaused: state.isPaused,
        closesAt: state.closesAt,
        nextOpenAt: state.nextOpenAt?.toISOString() ?? null,
        distanceKm,
        hours: hours.get(b.id) ?? [],
        menus: menus.get(b.id) ?? [],
      };
    });
    if (at) list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return list;
  }

  async storefrontGet(organizationId: string, id: string): Promise<StorefrontBranchDTO> {
    const [branch] = (await this.storefrontList(organizationId)).filter((b) => b.id === id);
    if (!branch) throw AppError.notFound("Branch not found");
    return branch;
  }

  /** Internal: a branch with its clock inputs, for pricing/validation in carts and checkout. */
  async loadForOrdering(organizationId: string, id: string) {
    const branch = await this.branches.findById(organizationId, id);
    if (!branch || !branch.isActive) throw AppError.notFound("Branch not found");
    const [hours, closures] = await Promise.all([this.branches.hours(id), this.branches.closures(id, todayIn(branch.timezone))]);
    const closureDates = closures.map((c) => c.date);
    return { branch, hours, closureDates, state: computeOpenState(this.clock(branch), hours, closureDates), clock: this.clock(branch) };
  }

  async slots(organizationId: string, id: string, fulfilment: "delivery" | "pickup", at?: { lat: number; lng: number }) {
    const { branch, hours, closureDates } = await this.loadForOrdering(organizationId, id);
    if (fulfilment === "delivery" && !branch.deliveryEnabled) throw AppError.badRequest("This branch does not deliver");
    if (fulfilment === "pickup" && !branch.pickupEnabled) throw AppError.badRequest("This branch does not offer pickup");
    let extraMinutes = 0;
    if (fulfilment === "delivery" && at) {
      const quote = await this.deliveryQuote(organizationId, id, at.lat, at.lng);
      extraMinutes = quote.extraMinutes;
    }
    return generateSlots(this.clock(branch), hours, closureDates, extraMinutes);
  }

  async isValidSlot(organizationId: string, id: string, at: Date, extraMinutes = 0): Promise<boolean> {
    const { branch, hours, closureDates } = await this.loadForOrdering(organizationId, id);
    return isValidScheduledTime(this.clock(branch), hours, closureDates, at, extraMinutes);
  }

  async deliveryQuote(organizationId: string, id: string, lat: number, lng: number, subtotal = 0): Promise<DeliveryQuoteDTO> {
    const branch = await this.branches.findById(organizationId, id);
    if (!branch) throw AppError.notFound("Branch not found");
    if (!branch.deliveryEnabled) return { deliverable: false, zoneId: null, zoneName: null, distanceKm: 0, fee: 0, minOrder: 0, freeAboveAmount: null, extraMinutes: 0, reason: "This branch does not deliver" };
    if (branch.lat === null || branch.lng === null) return { deliverable: false, zoneId: null, zoneName: null, distanceKm: 0, fee: 0, minOrder: 0, freeAboveAmount: null, extraMinutes: 0, reason: "This branch has no map location yet" };
    const distanceKm = roundKm(haversineKm(lat, lng, branch.lat, branch.lng));
    const zones = await this.branches.zones(id, true);
    const zone = zones.find((z) => distanceKm <= z.maxDistanceKm);
    if (!zone) return { deliverable: false, zoneId: null, zoneName: null, distanceKm, fee: 0, minOrder: 0, freeAboveAmount: null, extraMinutes: 0, reason: "This address is outside our delivery area" };
    const fee = zone.freeAboveAmount !== null && subtotal >= zone.freeAboveAmount ? 0 : zone.fee;
    return { deliverable: true, zoneId: zone.id, zoneName: zone.name, distanceKm, fee, minOrder: zone.minOrder, freeAboveAmount: zone.freeAboveAmount, extraMinutes: zone.extraMinutes, reason: null };
  }
}
