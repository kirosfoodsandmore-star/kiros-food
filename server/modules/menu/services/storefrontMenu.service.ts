// Storefront reads: the full menu tree for a branch (with per-branch availability), one item with its
// option groups, search, featured items and the cheap version check.
import { AppError } from "../../../shared/errors/AppError";
import { AvailabilityRepository } from "../../availability/repositories/availability.repository";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import type { StoreItemCardDTO, StoreItemDTO, StoreMenuDTO, StoreOptionGroupDTO } from "../dto/menu.dto";
import { MenuRepository, type GroupRow, type ItemRow } from "../repositories/menu.repository";

export interface ResolvedGroups {
  byItem: Map<string, StoreOptionGroupDTO[]>;
}

export class StorefrontMenuService {
  static Instance = new StorefrontMenuService();
  private constructor(
    private readonly menus = MenuRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly availability = AvailabilityRepository.Instance
  ) {}

  private buildGroups(rows: GroupRow[], soldOutOptions: Set<string>): Map<string, StoreOptionGroupDTO[]> {
    const byItem = new Map<string, Map<string, StoreOptionGroupDTO>>();
    for (const r of rows) {
      const groups = byItem.get(r.itemId) ?? new Map<string, StoreOptionGroupDTO>();
      let group = groups.get(r.groupId);
      if (!group) {
        group = { id: r.groupId, name: r.groupName, helpText: r.helpText, minSelect: r.minSelect, maxSelect: r.maxSelect, required: r.minSelect > 0, options: [] };
        groups.set(r.groupId, group);
      }
      if (r.optionId) group.options.push({ id: r.optionId, name: r.optionName!, priceDelta: Number(r.priceDelta), isAvailable: !soldOutOptions.has(r.optionId) });
      byItem.set(r.itemId, groups);
    }
    const out = new Map<string, StoreOptionGroupDTO[]>();
    for (const [itemId, groups] of byItem) out.set(itemId, [...groups.values()]);
    return out;
  }

  /** "From" price: base + the cheapest available option of every required group. */
  private card(item: ItemRow, groups: StoreOptionGroupDTO[], soldOutItems: Set<string>): StoreItemCardDTO {
    let fromPrice = Number(item.basePrice);
    let hasPricedVariants = false;
    for (const g of groups) {
      const priced = g.options.some((o) => o.priceDelta !== 0);
      if (priced) hasPricedVariants = true;
      if (g.required && g.options.length > 0) {
        const cheapest = Math.min(...g.options.filter((o) => o.isAvailable).map((o) => o.priceDelta), ...(g.options.every((o) => !o.isAvailable) ? [0] : []));
        fromPrice += Math.max(0, cheapest) * Math.max(1, g.minSelect);
      }
    }
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      basePrice: Number(item.basePrice),
      fromPrice,
      hasPricedVariants,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      isAvailable: !soldOutItems.has(item.id),
      optionGroupCount: groups.length,
    };
  }

  private async assertServes(organizationId: string, branchId: string, menuId: string): Promise<void> {
    const branch = await this.branches.findById(organizationId, branchId);
    if (!branch || !branch.isActive) throw AppError.notFound("Branch not found");
    if (!(await this.branches.servesMenu(branchId, menuId))) throw AppError.notFound("This branch does not serve that menu");
  }

  async menusForBranch(organizationId: string, branchId: string) {
    const branch = await this.branches.findById(organizationId, branchId);
    if (!branch || !branch.isActive) throw AppError.notFound("Branch not found");
    const map = await this.branches.menusForBranches([branchId]);
    const versions = await this.menus.listMenus(organizationId);
    return (map.get(branchId) ?? []).map((m) => ({ ...m, version: versions.find((v) => v.id === m.id)?.version ?? 1 }));
  }

  async menuTree(organizationId: string, menuId: string, branchId: string): Promise<StoreMenuDTO> {
    await this.assertServes(organizationId, branchId, menuId);
    const menu = await this.menus.findMenu(organizationId, menuId);
    if (!menu || !menu.isActive) throw AppError.notFound("Menu not found");
    const [items, categories, soldOut] = await Promise.all([this.menus.activeItemsForMenu(organizationId, menuId), this.menus.categoriesForMenu(menuId), this.availability.soldOutAt(branchId)]);
    const groups = this.buildGroups(await this.menus.groupRows(items.map((i) => i.id)), soldOut.options);
    return {
      id: menu.id,
      name: menu.name,
      description: menu.description,
      imageUrl: menu.imageUrl,
      version: menu.version,
      branchId,
      categories: categories.map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id).map((i) => this.card(i, groups.get(i.id) ?? [], soldOut.items)) })),
    };
  }

  async version(organizationId: string, menuId: string): Promise<{ menuId: string; version: number }> {
    const version = await this.menus.menuVersion(organizationId, menuId);
    if (version === null) throw AppError.notFound("Menu not found");
    return { menuId, version };
  }

  async item(organizationId: string, itemId: string, branchId: string): Promise<StoreItemDTO> {
    const row = await this.menus.itemRow(organizationId, itemId);
    if (!row || !row.isActive) throw AppError.notFound("Item not found");
    await this.assertServes(organizationId, branchId, row.menuId);
    const soldOut = await this.availability.soldOutAt(branchId);
    const groups = this.buildGroups(await this.menus.groupRows([itemId]), soldOut.options).get(itemId) ?? [];
    // Recommendations: featured items from the same menu, then siblings in the same category.
    const siblings = (await this.menus.activeItemsForMenu(organizationId, row.menuId)).filter((i) => i.id !== itemId);
    const picks = [...siblings.filter((i) => i.isFeatured), ...siblings.filter((i) => !i.isFeatured && i.categoryId === row.categoryId)].slice(0, 8);
    const pickGroups = this.buildGroups(await this.menus.groupRows(picks.map((i) => i.id)), soldOut.options);
    return {
      ...this.card(row, groups, soldOut.items),
      images: row.images.map((p) => p.url),
      categoryName: row.categoryName,
      menuId: row.menuId,
      menuName: row.menuName,
      optionGroups: groups,
      recommendations: picks.map((i) => this.card(i, pickGroups.get(i.id) ?? [], soldOut.items)),
    };
  }

  private async menuIdsServed(organizationId: string, branchId: string): Promise<string[]> {
    return (await this.menusForBranch(organizationId, branchId)).map((m) => m.id);
  }

  async featured(organizationId: string, branchId: string): Promise<StoreItemCardDTO[]> {
    const items = await this.menus.featuredItems(organizationId, await this.menuIdsServed(organizationId, branchId));
    const soldOut = await this.availability.soldOutAt(branchId);
    const groups = this.buildGroups(await this.menus.groupRows(items.map((i) => i.id)), soldOut.options);
    return items.map((i) => this.card(i, groups.get(i.id) ?? [], soldOut.items));
  }

  async search(organizationId: string, branchId: string, q: string, menuId?: string): Promise<StoreItemCardDTO[]> {
    const served = await this.menuIdsServed(organizationId, branchId);
    const items = await this.menus.searchItems(organizationId, menuId ? served.filter((m) => m === menuId) : served, q);
    const soldOut = await this.availability.soldOutAt(branchId);
    const groups = this.buildGroups(await this.menus.groupRows(items.map((i) => i.id)), soldOut.options);
    return items.map((i) => this.card(i, groups.get(i.id) ?? [], soldOut.items));
  }

  /** Used by cart pricing: items + their groups for a branch, with availability. */
  async itemsForPricing(organizationId: string, branchId: string, itemIds: string[]) {
    const [rows, soldOut] = await Promise.all([this.menus.itemRows(organizationId, itemIds), this.availability.soldOutAt(branchId)]);
    const groups = this.buildGroups(await this.menus.groupRows(rows.map((r) => r.id)), soldOut.options);
    const served = new Set(await this.menuIdsServed(organizationId, branchId));
    return { rows, groups, soldOutItems: soldOut.items, served };
  }
}
