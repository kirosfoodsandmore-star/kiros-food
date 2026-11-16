// Per-branch sold-out toggles. A change reaches open storefronts within seconds through Socket.io
// (`availability:changed`) and the menu version bump; carts re-validate on their next call.
import { assertPermission } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { MenuRepository } from "../../menu/repositories/menu.repository";
import { AvailabilityRepository, type SoldOutRow } from "../repositories/availability.repository";
import type { BulkSetAvailabilityInput, SetAvailabilityInput } from "../validators/availability.schema";

type Target = { itemId?: string; optionId?: string };

export class AvailabilityService {
  static Instance = new AvailabilityService();
  private constructor(
    private readonly repo = AvailabilityRepository.Instance,
    private readonly menus = MenuRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  list(actor: Actor, branchId?: string): Promise<SoldOutRow[]> {
    return this.repo.list(actor.organizationId, branchScope(actor, branchId));
  }

  async set(actor: Actor, data: SetAvailabilityInput): Promise<SoldOutRow[]> {
    assertPermission(actor, "availability.toggle");
    assertBranchAccess(actor, data.branchId);
    const target: Target = data.itemId ? { itemId: data.itemId } : { optionId: data.optionId! };
    const resolved = await this.resolve(actor, target);
    await this.apply(actor, data.branchId, target, resolved.name, data.isAvailable, data.restoreAt);
    await this.bumpMenus(actor, resolved.menuIds);
    return this.repo.list(actor.organizationId, [data.branchId]);
  }

  /** Same change for many items/options. Every target is checked before anything is written, and each affected menu is bumped once. */
  async setMany(actor: Actor, data: BulkSetAvailabilityInput): Promise<SoldOutRow[]> {
    assertPermission(actor, "availability.toggle");
    assertBranchAccess(actor, data.branchId);
    const unique = new Map<string, Target>();
    for (const t of data.targets) unique.set((t.itemId ?? t.optionId)!, t.itemId ? { itemId: t.itemId } : { optionId: t.optionId! });
    const resolved: Array<{ target: Target; name: string }> = [];
    const menuIds = new Set<string>();
    for (const target of unique.values()) {
      const r = await this.resolve(actor, target);
      resolved.push({ target, name: r.name });
      for (const id of r.menuIds) menuIds.add(id);
    }
    for (const { target, name } of resolved) await this.apply(actor, data.branchId, target, name, data.isAvailable, data.restoreAt);
    await this.bumpMenus(actor, menuIds);
    return this.repo.list(actor.organizationId, [data.branchId]);
  }

  private async resolve(actor: Actor, target: Target): Promise<{ name: string; menuIds: string[] }> {
    if (target.itemId) {
      const item = await this.menus.findItem(actor.organizationId, target.itemId);
      if (!item) throw AppError.notFound("Item not found");
      return { name: item.name, menuIds: await this.menus.menuIdsForItem(item.id) };
    }
    const option = await this.menus.findOption(actor.organizationId, target.optionId!);
    if (!option) throw AppError.notFound("Option not found");
    return { name: option.name, menuIds: await this.menus.menuIdsForGroup(option.groupId) };
  }

  /** Writes one sold-out/restore change, audits it and tells open storefronts. Menu version bumps are the caller's job. */
  private async apply(actor: Actor, branchId: string, target: Target, name: string, isAvailable: boolean, restoreAt: string | null | undefined): Promise<void> {
    if (isAvailable) await this.repo.restore(branchId, target);
    else await this.repo.markSoldOut(actor.organizationId, branchId, target, restoreAt ? new Date(restoreAt) : null, actor.id);
    await this.audit.log(actor, {
      action: isAvailable ? "restore" : "sold_out",
      entityType: target.itemId ? "item" : "option",
      entityId: target.itemId ?? target.optionId,
      branchId,
      summary: `${isAvailable ? "Back in stock" : "Sold out"}: ${name}${restoreAt && !isAvailable ? ` (auto-restore ${restoreAt})` : ""}`,
    });
    domainEvents.emit("availability.changed", { organizationId: actor.organizationId, branchId, itemId: target.itemId ?? null, optionId: target.optionId ?? null, isAvailable });
  }

  private async bumpMenus(actor: Actor, menuIds: Iterable<string>): Promise<void> {
    for (const menuId of new Set(menuIds)) {
      const version = await this.menus.bumpVersion(menuId);
      domainEvents.emit("menu.versionBumped", { organizationId: actor.organizationId, menuId, version });
    }
  }

  /** Scheduler: put back items and options (e.g. one salad ingredient) whose auto-restore time passed. */
  async restoreDue(): Promise<number> {
    const restored = await this.repo.restoreDue();
    for (const r of restored) {
      domainEvents.emit("availability.changed", { organizationId: r.organizationId, branchId: r.branchId, itemId: r.itemId, optionId: r.optionId, isAvailable: true });
      const option = !r.itemId && r.optionId ? await this.menus.findOption(r.organizationId, r.optionId) : null;
      const menuIds = r.itemId ? await this.menus.menuIdsForItem(r.itemId) : option ? await this.menus.menuIdsForGroup(option.groupId) : [];
      for (const menuId of menuIds) domainEvents.emit("menu.versionBumped", { organizationId: r.organizationId, menuId, version: await this.menus.bumpVersion(menuId) });
    }
    return restored.length;
  }
}
