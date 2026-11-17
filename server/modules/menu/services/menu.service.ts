// Admin menu management: menus, categories, items (+ photos), option groups and options.
// Every edit bumps the affected menu's version so storefronts refetch. Price changes need
// `menu.edit_prices` and are audited with before/after values.
import { randomUUID } from "node:crypto";
import { MAX_ITEM_PHOTOS, STORAGE_FOLDERS } from "../../../config/constants";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import type { CategoryDTO, ItemDTO, MenuDTO, OptionGroupDTO } from "../dto/menu.dto";
import type { ItemPhoto } from "../entities/item.entity";
import { MenuRepository } from "../repositories/menu.repository";
import type { CategoryBody, GroupBody, ItemBody, MenuBody, OptionBody, UpdateGroupBody } from "../validators/menu.schema";

export class MenuService {
  static Instance = new MenuService();
  private constructor(
    private readonly repo = MenuRepository.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async bump(organizationId: string, menuIds: string[]): Promise<void> {
    for (const menuId of new Set(menuIds)) {
      const version = await this.repo.bumpVersion(menuId);
      domainEvents.emit("menu.versionBumped", { organizationId, menuId, version });
    }
  }

  // ── Menus ──────────────────────────────────────────────────────────────────

  listMenus(actor: Actor): Promise<MenuDTO[]> {
    return this.repo.listMenus(actor.organizationId);
  }

  async createMenu(actor: Actor, data: MenuBody): Promise<MenuDTO> {
    assertPermission(actor, "menu.edit");
    const menu = await this.repo.createMenu({ ...data, organizationId: actor.organizationId, description: data.description ?? null, imageUrl: null, imagePublicId: null });
    await this.audit.log(actor, { action: "create", entityType: "menu", entityId: menu.id, summary: `Created menu "${menu.name}"` });
    return (await this.repo.listMenus(actor.organizationId)).find((m) => m.id === menu.id)!;
  }

  async updateMenu(actor: Actor, id: string, data: Partial<MenuBody>): Promise<MenuDTO> {
    assertPermission(actor, "menu.edit");
    const menu = await this.repo.findMenu(actor.organizationId, id);
    if (!menu) throw AppError.notFound("Menu not found");
    await this.repo.updateMenu(actor.organizationId, id, data);
    await this.audit.log(actor, { action: "update", entityType: "menu", entityId: id, summary: `Updated menu "${menu.name}"`, before: { name: menu.name, isActive: menu.isActive }, after: data });
    await this.bump(actor.organizationId, [id]);
    return (await this.repo.listMenus(actor.organizationId)).find((m) => m.id === id)!;
  }

  async deleteMenu(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "menu.edit");
    const menu = await this.repo.findMenu(actor.organizationId, id);
    if (!menu) throw AppError.notFound("Menu not found");
    await this.repo.softDeleteMenu(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "menu", entityId: id, summary: `Deleted menu "${menu.name}"` });
  }

  async uploadMenuImage(actor: Actor, id: string, buffer: Buffer): Promise<MenuDTO> {
    assertPermission(actor, "menu.edit");
    const menu = await this.repo.findMenu(actor.organizationId, id);
    if (!menu) throw AppError.notFound("Menu not found");
    const { url, publicId } = await this.storage.replace(buffer, { folder: STORAGE_FOLDERS.category }, menu.imagePublicId);
    await this.repo.updateMenu(actor.organizationId, id, { imageUrl: url, imagePublicId: publicId });
    await this.bump(actor.organizationId, [id]);
    return (await this.repo.listMenus(actor.organizationId)).find((m) => m.id === id)!;
  }

  async reorderMenus(actor: Actor, ids: string[]): Promise<MenuDTO[]> {
    assertPermission(actor, "menu.edit");
    await this.repo.reorder("menus", actor.organizationId, ids);
    return this.repo.listMenus(actor.organizationId);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  listCategories(actor: Actor, menuId?: string): Promise<CategoryDTO[]> {
    return this.repo.listCategories(actor.organizationId, menuId);
  }

  async createCategory(actor: Actor, data: CategoryBody): Promise<CategoryDTO> {
    assertPermission(actor, "menu.edit");
    const menu = await this.repo.findMenu(actor.organizationId, data.menuId);
    if (!menu) throw AppError.notFound("Menu not found");
    const category = await this.repo.createCategory({ ...data, organizationId: actor.organizationId, description: data.description ?? null, imageUrl: null, imagePublicId: null });
    await this.audit.log(actor, { action: "create", entityType: "category", entityId: category.id, summary: `Created category "${category.name}" in "${menu.name}"` });
    await this.bump(actor.organizationId, [data.menuId]);
    return (await this.repo.listCategories(actor.organizationId, data.menuId)).find((c) => c.id === category.id)!;
  }

  async updateCategory(actor: Actor, id: string, data: Partial<CategoryBody>): Promise<CategoryDTO> {
    assertPermission(actor, "menu.edit");
    const category = await this.repo.findCategory(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    if (data.menuId && data.menuId !== category.menuId && !(await this.repo.findMenu(actor.organizationId, data.menuId))) throw AppError.notFound("Menu not found");
    await this.repo.updateCategory(actor.organizationId, id, data);
    await this.audit.log(actor, { action: "update", entityType: "category", entityId: id, summary: `Updated category "${category.name}"`, before: { name: category.name }, after: data });
    await this.bump(actor.organizationId, [category.menuId, ...(data.menuId ? [data.menuId] : [])]);
    return (await this.repo.listCategories(actor.organizationId)).find((c) => c.id === id)!;
  }

  async deleteCategory(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "menu.edit");
    const category = await this.repo.findCategory(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    await this.repo.softDeleteCategory(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "category", entityId: id, summary: `Deleted category "${category.name}"` });
    await this.bump(actor.organizationId, [category.menuId]);
  }

  async uploadCategoryImage(actor: Actor, id: string, buffer: Buffer): Promise<CategoryDTO> {
    assertPermission(actor, "menu.edit");
    const category = await this.repo.findCategory(actor.organizationId, id);
    if (!category) throw AppError.notFound("Category not found");
    const { url, publicId } = await this.storage.replace(buffer, { folder: STORAGE_FOLDERS.category }, category.imagePublicId);
    await this.repo.updateCategory(actor.organizationId, id, { imageUrl: url, imagePublicId: publicId });
    await this.bump(actor.organizationId, [category.menuId]);
    return (await this.repo.listCategories(actor.organizationId)).find((c) => c.id === id)!;
  }

  async reorderCategories(actor: Actor, ids: string[]): Promise<void> {
    assertPermission(actor, "menu.edit");
    await this.repo.reorder("categories", actor.organizationId, ids);
    const first = ids[0] ? await this.repo.findCategory(actor.organizationId, ids[0]) : null;
    if (first) await this.bump(actor.organizationId, [first.menuId]);
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  listItems(actor: Actor, f: { menuId?: string; categoryId?: string; search?: string; featured?: boolean }): Promise<ItemDTO[]> {
    return this.repo.listItems(actor.organizationId, f);
  }

  async getItem(actor: Actor, id: string): Promise<ItemDTO> {
    const item = (await this.repo.listItems(actor.organizationId, {})).find((i) => i.id === id);
    if (!item) throw AppError.notFound("Item not found");
    return item;
  }

  private async assertGroups(organizationId: string, groupIds: string[]): Promise<void> {
    const known = await this.repo.existingGroupIds(organizationId, groupIds);
    if (known.length !== new Set(groupIds).size) throw AppError.badRequest("One of the option groups does not exist");
  }

  /** "Goes well with" may only name this restaurant's own categories. */
  private async assertCategories(organizationId: string, categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return;
    const known = new Set((await this.repo.listCategories(organizationId)).map((c) => c.id));
    if (!categoryIds.every((id) => known.has(id))) throw AppError.badRequest("One of the “goes well with” categories does not exist");
  }

  async createItem(actor: Actor, data: ItemBody): Promise<ItemDTO> {
    assertPermission(actor, "menu.edit");
    if (data.basePrice > 0) assertPermission(actor, "menu.edit_prices", "You cannot set prices");
    const category = await this.repo.findCategory(actor.organizationId, data.categoryId);
    if (!category) throw AppError.notFound("Category not found");
    await this.assertGroups(actor.organizationId, data.optionGroupIds);
    await this.assertCategories(actor.organizationId, data.pairsWithCategoryIds);
    const { optionGroupIds, ...fields } = data;
    const item = await inTransaction(async (tx) => {
      const created = await this.repo.createItem({ ...fields, organizationId: actor.organizationId, description: fields.description ?? null, imageUrl: null, imagePublicId: null, photos: [] }, tx);
      await this.repo.setItemGroups(created.id, optionGroupIds, tx);
      await this.audit.log(actor, { action: "create", entityType: "item", entityId: created.id, summary: `Created item "${created.name}" at ${created.basePrice}`, after: { basePrice: created.basePrice } }, tx);
      return created;
    });
    await this.bump(actor.organizationId, [category.menuId]);
    return this.getItem(actor, item.id);
  }

  async updateItem(actor: Actor, id: string, data: Partial<ItemBody>): Promise<ItemDTO> {
    assertPermission(actor, "menu.edit");
    const item = await this.repo.findItem(actor.organizationId, id);
    if (!item) throw AppError.notFound("Item not found");
    if (data.basePrice !== undefined && data.basePrice !== item.basePrice && !can(actor, "menu.edit_prices")) throw AppError.forbidden("You cannot change prices");
    const menuIds = await this.repo.menuIdsForItem(id);
    if (data.categoryId && data.categoryId !== item.categoryId) {
      const category = await this.repo.findCategory(actor.organizationId, data.categoryId);
      if (!category) throw AppError.notFound("Category not found");
      menuIds.push(category.menuId);
    }
    if (data.optionGroupIds) await this.assertGroups(actor.organizationId, data.optionGroupIds);
    if (data.pairsWithCategoryIds) await this.assertCategories(actor.organizationId, data.pairsWithCategoryIds);
    const { optionGroupIds, ...fields } = data;
    await inTransaction(async (tx) => {
      if (Object.keys(fields).length > 0) await this.repo.updateItem(actor.organizationId, id, fields, tx);
      if (optionGroupIds) await this.repo.setItemGroups(id, optionGroupIds, tx);
      const priceChanged = data.basePrice !== undefined && data.basePrice !== item.basePrice;
      await this.audit.log(
        actor,
        {
          action: priceChanged ? "price_change" : "update",
          entityType: "item",
          entityId: id,
          summary: priceChanged ? `Changed price of "${item.name}" from ${item.basePrice} to ${data.basePrice}` : `Updated item "${item.name}"`,
          before: { basePrice: item.basePrice, name: item.name, isActive: item.isActive, isFeatured: item.isFeatured },
          after: fields as Record<string, unknown>,
        },
        tx
      );
    });
    await this.bump(actor.organizationId, menuIds);
    return this.getItem(actor, id);
  }

  async deleteItem(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "menu.edit");
    const item = await this.repo.findItem(actor.organizationId, id);
    if (!item) throw AppError.notFound("Item not found");
    const menuIds = await this.repo.menuIdsForItem(id);
    await this.repo.softDeleteItem(actor.organizationId, id);
    await Promise.all([...new Set([...item.photos.map((p) => p.publicId), item.imagePublicId])].map((publicId) => this.storage.delete(publicId)));
    await this.audit.log(actor, { action: "delete", entityType: "item", entityId: id, summary: `Deleted item "${item.name}"` });
    await this.bump(actor.organizationId, menuIds);
  }

  /** Saves the photo list and mirrors the first one into the cover columns the rest of the app reads. */
  private async savePhotos(actor: Actor, id: string, photos: ItemPhoto[]): Promise<ItemDTO> {
    const cover = photos[0];
    await this.repo.updateItem(actor.organizationId, id, { photos, imageUrl: cover?.url ?? null, imagePublicId: cover?.publicId ?? null });
    await this.bump(actor.organizationId, await this.repo.menuIdsForItem(id));
    return this.getItem(actor, id);
  }

  private async itemForPhotos(actor: Actor, id: string) {
    assertPermission(actor, "menu.edit");
    const item = await this.repo.findItem(actor.organizationId, id);
    if (!item) throw AppError.notFound("Item not found");
    return item;
  }

  /** Adds photos to the end of the gallery (the first photo ever added becomes the cover). */
  async addItemPhotos(actor: Actor, id: string, buffers: Buffer[]): Promise<ItemDTO> {
    const item = await this.itemForPhotos(actor, id);
    if (item.photos.length + buffers.length > MAX_ITEM_PHOTOS) {
      const room = Math.max(0, MAX_ITEM_PHOTOS - item.photos.length);
      throw AppError.unprocessable(`An item can have up to ${MAX_ITEM_PHOTOS} photos${room > 0 ? `, so you can add ${room} more` : ""}`);
    }
    const results = await Promise.allSettled(buffers.map((b) => this.storage.upload(b, { folder: STORAGE_FOLDERS.item })));
    const stored = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) {
      // All or nothing: don't leave orphaned files in storage when part of a batch fails.
      await Promise.all(stored.map((s) => this.storage.delete(s.publicId)));
      throw failed.reason;
    }
    const added: ItemPhoto[] = stored.map((s) => ({ id: randomUUID(), url: s.url, publicId: s.publicId }));
    return this.savePhotos(actor, id, [...item.photos, ...added]);
  }

  async removeItemPhoto(actor: Actor, id: string, photoId: string): Promise<ItemDTO> {
    const item = await this.itemForPhotos(actor, id);
    const photo = item.photos.find((p) => p.id === photoId);
    if (!photo) throw AppError.notFound("Photo not found");
    const result = await this.savePhotos(actor, id, item.photos.filter((p) => p.id !== photoId));
    await this.storage.delete(photo.publicId);
    return result;
  }

  /** `ids` must be exactly the item's current photos in the wanted order; the first becomes the cover. */
  async reorderItemPhotos(actor: Actor, id: string, ids: string[]): Promise<ItemDTO> {
    const item = await this.itemForPhotos(actor, id);
    const byId = new Map(item.photos.map((p) => [p.id, p]));
    if (ids.length !== item.photos.length || new Set(ids).size !== ids.length || !ids.every((x) => byId.has(x))) {
      throw AppError.unprocessable("Send every photo of the item exactly once, in the order you want");
    }
    return this.savePhotos(actor, id, ids.map((x) => byId.get(x)!));
  }

  async reorderItems(actor: Actor, ids: string[]): Promise<void> {
    assertPermission(actor, "menu.edit");
    await this.repo.reorder("items", actor.organizationId, ids);
    if (ids[0]) await this.bump(actor.organizationId, await this.repo.menuIdsForItem(ids[0]));
  }

  // ── Option groups & options ────────────────────────────────────────────────

  listGroups(actor: Actor): Promise<OptionGroupDTO[]> {
    return this.repo.listGroups(actor.organizationId);
  }

  private async group(actor: Actor, id: string): Promise<OptionGroupDTO> {
    const group = (await this.repo.listGroups(actor.organizationId)).find((g) => g.id === id);
    if (!group) throw AppError.notFound("Option group not found");
    return group;
  }

  async createGroup(actor: Actor, data: GroupBody): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    const group = await this.repo.createGroup({ ...data, organizationId: actor.organizationId, helpText: data.helpText ?? null });
    await this.audit.log(actor, { action: "create", entityType: "option_group", entityId: group.id, summary: `Created option group "${group.name}"` });
    return this.group(actor, group.id);
  }

  /** "Dressing" → "Dressing (copy)", then "(copy 2)" and so on: the first name nobody is using. */
  private copyName(source: string, taken: string[]): string {
    const base = source.replace(/ \(copy(?: \d+)?\)$/i, "");
    const used = new Set(taken.map((n) => n.toLowerCase()));
    for (let n = 1; ; n++) {
      const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
      const name = base.slice(0, 120 - suffix.length) + suffix;
      if (!used.has(name.toLowerCase())) return name;
    }
  }

  /** A copy of a group with all of its options. The copy is not attached to any item until the owner attaches it. */
  async duplicateGroup(actor: Actor, id: string): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    const groups = await this.repo.listGroups(actor.organizationId);
    const source = groups.find((g) => g.id === id);
    if (!source) throw AppError.notFound("Option group not found");
    if (source.options.some((o) => o.priceDelta !== 0) && !can(actor, "menu.edit_prices")) throw AppError.forbidden("You cannot set prices");
    const name = this.copyName(source.name, groups.map((g) => g.name));
    const copy = await inTransaction(async (tx) => {
      const created = await this.repo.createGroup({ organizationId: actor.organizationId, name, helpText: source.helpText, minSelect: source.minSelect, maxSelect: source.maxSelect, sortOrder: source.sortOrder }, tx);
      for (const o of source.options) {
        await this.repo.createOption({ organizationId: actor.organizationId, groupId: created.id, name: o.name, priceDelta: o.priceDelta, isActive: o.isActive, sortOrder: o.sortOrder }, tx);
      }
      await this.audit.log(actor, { action: "create", entityType: "option_group", entityId: created.id, summary: `Duplicated option group "${source.name}" as "${name}" (${source.options.length} options)` }, tx);
      return created;
    });
    return this.group(actor, copy.id);
  }

  async updateGroup(actor: Actor, id: string, data: UpdateGroupBody): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    const group = await this.repo.findGroup(actor.organizationId, id);
    if (!group) throw AppError.notFound("Option group not found");
    const min = data.minSelect ?? group.minSelect;
    const max = data.maxSelect ?? group.maxSelect;
    if (min > max) throw AppError.badRequest("Minimum cannot exceed maximum");
    await this.repo.updateGroup(actor.organizationId, id, data);
    await this.audit.log(actor, { action: "update", entityType: "option_group", entityId: id, summary: `Updated option group "${group.name}"`, before: { minSelect: group.minSelect, maxSelect: group.maxSelect }, after: data });
    await this.bump(actor.organizationId, await this.repo.menuIdsForGroup(id));
    return this.group(actor, id);
  }

  async deleteGroup(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "menu.edit");
    const group = await this.repo.findGroup(actor.organizationId, id);
    if (!group) throw AppError.notFound("Option group not found");
    const menuIds = await this.repo.menuIdsForGroup(id);
    await this.repo.softDeleteGroup(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "option_group", entityId: id, summary: `Deleted option group "${group.name}"` });
    await this.bump(actor.organizationId, menuIds);
  }

  async createOption(actor: Actor, groupId: string, data: OptionBody): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    if (data.priceDelta !== 0) assertPermission(actor, "menu.edit_prices", "You cannot set prices");
    const group = await this.repo.findGroup(actor.organizationId, groupId);
    if (!group) throw AppError.notFound("Option group not found");
    const option = await this.repo.createOption({ ...data, organizationId: actor.organizationId, groupId });
    await this.audit.log(actor, { action: "create", entityType: "option", entityId: option.id, summary: `Added option "${option.name}" (${option.priceDelta >= 0 ? "+" : ""}${option.priceDelta}) to "${group.name}"` });
    await this.bump(actor.organizationId, await this.repo.menuIdsForGroup(groupId));
    return this.group(actor, groupId);
  }

  async updateOption(actor: Actor, groupId: string, optionId: string, data: Partial<OptionBody>): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    const option = await this.repo.findOption(actor.organizationId, optionId);
    if (!option || option.groupId !== groupId) throw AppError.notFound("Option not found");
    const priceChanged = data.priceDelta !== undefined && data.priceDelta !== option.priceDelta;
    if (priceChanged && !can(actor, "menu.edit_prices")) throw AppError.forbidden("You cannot change prices");
    await this.repo.updateOption(actor.organizationId, optionId, data);
    await this.audit.log(actor, {
      action: priceChanged ? "price_change" : "update",
      entityType: "option",
      entityId: optionId,
      summary: priceChanged ? `Changed price delta of "${option.name}" from ${option.priceDelta} to ${data.priceDelta}` : `Updated option "${option.name}"`,
      before: { priceDelta: option.priceDelta, name: option.name, isActive: option.isActive },
      after: data,
    });
    await this.bump(actor.organizationId, await this.repo.menuIdsForGroup(groupId));
    return this.group(actor, groupId);
  }

  async deleteOption(actor: Actor, groupId: string, optionId: string): Promise<OptionGroupDTO> {
    assertPermission(actor, "menu.edit");
    const option = await this.repo.findOption(actor.organizationId, optionId);
    if (!option || option.groupId !== groupId) throw AppError.notFound("Option not found");
    await this.repo.softDeleteOption(actor.organizationId, optionId);
    await this.audit.log(actor, { action: "delete", entityType: "option", entityId: optionId, summary: `Deleted option "${option.name}"` });
    await this.bump(actor.organizationId, await this.repo.menuIdsForGroup(groupId));
    return this.group(actor, groupId);
  }
}
