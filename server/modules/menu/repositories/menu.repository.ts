// Menus, categories, items, option groups and options — the only layer that touches these entities.
import { In } from "typeorm";
import { likePattern } from "../../../infrastructure/database/sql";
import { db, updateReturning, type Tx } from "../../../infrastructure/database/transaction";
import type { CategoryDTO, ItemDTO, MenuDTO, OptionDTO, OptionGroupDTO } from "../dto/menu.dto";
import { CategoryEntity, type Category } from "../entities/category.entity";
import { ItemEntity, type Item } from "../entities/item.entity";
import { ItemOptionGroupEntity } from "../entities/itemOptionGroup.entity";
import { MenuEntity, type Menu } from "../entities/menu.entity";
import { OptionEntity, type Option } from "../entities/option.entity";
import { OptionGroupEntity, type OptionGroup } from "../entities/optionGroup.entity";

/** Flat rows used to assemble the storefront tree. */
export interface ItemRow {
  id: string;
  categoryId: string;
  categoryName: string;
  menuId: string;
  menuName: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  /** Every photo in display order (cover first), without storage internals. */
  images: Array<{ id: string; url: string }>;
  isFeatured: boolean;
  pairsWithCategoryIds: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface GroupRow {
  itemId: string;
  groupId: string;
  groupName: string;
  helpText: string | null;
  minSelect: number;
  maxSelect: number;
  groupSort: number;
  optionId: string | null;
  optionName: string | null;
  priceDelta: number | null;
  optionSort: number | null;
}

const SELECT_ITEM_ROW = `
  SELECT i.id, i.category_id AS "categoryId", c.name AS "categoryName", c.menu_id AS "menuId", m.name AS "menuName", i.name, i.description,
         i.base_price AS "basePrice", i.image_url AS "imageUrl",
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.e->>'id', 'url', p.e->>'url') ORDER BY p.n), '[]'::jsonb) FROM jsonb_array_elements(i.photos) WITH ORDINALITY AS p(e, n)) AS "images",
         i.is_featured AS "isFeatured", i.pairs_with_category_ids AS "pairsWithCategoryIds", i.is_active AS "isActive", i.sort_order AS "sortOrder"
  FROM items i JOIN categories c ON c.id = i.category_id AND c.deleted_at IS NULL JOIN menus m ON m.id = c.menu_id AND m.deleted_at IS NULL`;

export class MenuRepository {
  static Instance = new MenuRepository();
  private constructor() {}

  // ── Menus ──────────────────────────────────────────────────────────────────

  async listMenus(organizationId: string): Promise<MenuDTO[]> {
    return db().query(
      `SELECT m.id, m.name, m.description, m.image_url AS "imageUrl", m.sort_order AS "sortOrder", m.version, m.is_active AS "isActive", m.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM categories c WHERE c.menu_id = m.id AND c.deleted_at IS NULL) AS "categoryCount",
              (SELECT COUNT(*)::int FROM items i JOIN categories c ON c.id = i.category_id WHERE c.menu_id = m.id AND i.deleted_at IS NULL AND c.deleted_at IS NULL) AS "itemCount",
              COALESCE((SELECT array_agg(bm.branch_id) FROM branch_menus bm WHERE bm.menu_id = m.id), '{}') AS "branchIds"
       FROM menus m WHERE m.organization_id = $1 AND m.deleted_at IS NULL ORDER BY m.sort_order, m.name`,
      [organizationId]
    );
  }

  async findMenu(organizationId: string, id: string, tx?: Tx): Promise<Menu | null> {
    return db(tx).getRepository(MenuEntity).findOne({ where: { id, organizationId } });
  }

  async existingIds(organizationId: string, ids: string[]): Promise<string[]> {
    const rows = await db().getRepository(MenuEntity).find({ where: { organizationId, id: In(ids) }, select: ["id"] });
    return rows.map((r) => r.id);
  }

  async createMenu(data: Omit<Menu, "id" | "createdAt" | "updatedAt" | "deletedAt" | "version">, tx?: Tx): Promise<Menu> {
    const repo = db(tx).getRepository(MenuEntity);
    return repo.save(repo.create({ ...data, version: 1 }));
  }

  async updateMenu(organizationId: string, id: string, data: Partial<Menu>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(MenuEntity).update({ id, organizationId }, data);
  }

  async softDeleteMenu(organizationId: string, id: string): Promise<void> {
    await db().getRepository(MenuEntity).softDelete({ id, organizationId });
  }

  /** Every menu edit bumps the version; storefronts poll it. Returns the new version. */
  async bumpVersion(menuId: string, tx?: Tx): Promise<number> {
    const rows = await updateReturning<{ version: number }>(db(tx), `UPDATE menus SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version`, [menuId]);
    return Number(rows[0]?.version ?? 0);
  }

  async menuVersion(organizationId: string, id: string): Promise<number | null> {
    const row = await db().getRepository(MenuEntity).findOne({ where: { id, organizationId }, select: ["version"] });
    return row?.version ?? null;
  }

  /** Menu ids that an item or option-group change touches (for version bumps). */
  async menuIdsForItem(itemId: string): Promise<string[]> {
    const rows: Array<{ menuId: string }> = await db().query(`SELECT c.menu_id AS "menuId" FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`, [itemId]);
    return rows.map((r) => r.menuId);
  }

  async menuIdsForGroup(groupId: string): Promise<string[]> {
    const rows: Array<{ menuId: string }> = await db().query(
      `SELECT DISTINCT c.menu_id AS "menuId" FROM item_option_groups ig JOIN items i ON i.id = ig.item_id JOIN categories c ON c.id = i.category_id WHERE ig.group_id = $1`,
      [groupId]
    );
    return rows.map((r) => r.menuId);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  async listCategories(organizationId: string, menuId?: string): Promise<CategoryDTO[]> {
    return db().query(
      `SELECT c.id, c.menu_id AS "menuId", c.name, c.description, c.image_url AS "imageUrl", c.sort_order AS "sortOrder",
              (SELECT COUNT(*)::int FROM items i WHERE i.category_id = c.id AND i.deleted_at IS NULL) AS "itemCount"
       FROM categories c WHERE c.organization_id = $1 AND c.deleted_at IS NULL AND ($2::uuid IS NULL OR c.menu_id = $2) ORDER BY c.sort_order, c.name`,
      [organizationId, menuId ?? null]
    );
  }

  async findCategory(organizationId: string, id: string): Promise<Category | null> {
    return db().getRepository(CategoryEntity).findOne({ where: { id, organizationId } });
  }

  async createCategory(data: Omit<Category, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<Category> {
    const repo = db(tx).getRepository(CategoryEntity);
    return repo.save(repo.create(data));
  }

  async updateCategory(organizationId: string, id: string, data: Partial<Category>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CategoryEntity).update({ id, organizationId }, data);
  }

  async softDeleteCategory(organizationId: string, id: string): Promise<void> {
    await db().getRepository(CategoryEntity).softDelete({ id, organizationId });
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  async listItems(organizationId: string, f: { menuId?: string; categoryId?: string; search?: string; featured?: boolean }): Promise<ItemDTO[]> {
    const where = ["i.organization_id = $1", "i.deleted_at IS NULL"];
    const params: unknown[] = [organizationId];
    if (f.menuId) where.push(`c.menu_id = $${params.push(f.menuId)}`);
    if (f.categoryId) where.push(`i.category_id = $${params.push(f.categoryId)}`);
    if (f.search) where.push(`i.name ILIKE $${params.push(likePattern(f.search))}`);
    if (f.featured !== undefined) where.push(`i.is_featured = $${params.push(f.featured)}`);
    return db().query(
      `${SELECT_ITEM_ROW.replace("SELECT i.id,", `SELECT i.id, i.created_at AS "createdAt", COALESCE((SELECT array_agg(ig.group_id ORDER BY ig.sort_order) FROM item_option_groups ig WHERE ig.item_id = i.id), '{}') AS "optionGroupIds",`)}
       WHERE ${where.join(" AND ")} ORDER BY c.sort_order, i.sort_order, i.name LIMIT 1000`,
      params
    );
  }

  async findItem(organizationId: string, id: string, tx?: Tx): Promise<Item | null> {
    return db(tx).getRepository(ItemEntity).findOne({ where: { id, organizationId } });
  }

  async createItem(data: Omit<Item, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<Item> {
    const repo = db(tx).getRepository(ItemEntity);
    return repo.save(repo.create(data));
  }

  async updateItem(organizationId: string, id: string, data: Partial<Item>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ItemEntity).update({ id, organizationId }, data);
  }

  async softDeleteItem(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(ItemEntity).softDelete({ id, organizationId });
  }

  async setItemGroups(itemId: string, groupIds: string[], tx?: Tx): Promise<void> {
    const repo = db(tx).getRepository(ItemOptionGroupEntity);
    await repo.delete({ itemId });
    if (groupIds.length > 0) await repo.insert(groupIds.map((groupId, i) => ({ itemId, groupId, sortOrder: i })));
  }

  async reorder(table: "menus" | "categories" | "items" | "option_groups" | "options", organizationId: string, ids: string[], tx?: Tx): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db(tx).query(`UPDATE ${table} SET sort_order = $1 WHERE id = $2 AND organization_id = $3`, [i, ids[i], organizationId]);
    }
  }

  // ── Option groups & options ────────────────────────────────────────────────

  async listGroups(organizationId: string): Promise<OptionGroupDTO[]> {
    const groups: Array<Omit<OptionGroupDTO, "options">> = await db().query(
      `SELECT g.id, g.name, g.help_text AS "helpText", g.min_select AS "minSelect", g.max_select AS "maxSelect", g.sort_order AS "sortOrder",
              (SELECT COUNT(*)::int FROM item_option_groups ig JOIN items i ON i.id = ig.item_id AND i.deleted_at IS NULL WHERE ig.group_id = g.id) AS "itemCount"
       FROM option_groups g WHERE g.organization_id = $1 AND g.deleted_at IS NULL ORDER BY g.sort_order, g.name`,
      [organizationId]
    );
    const options: OptionDTO[] = await db().query(
      `SELECT o.id, o.group_id AS "groupId", o.name, o.price_delta AS "priceDelta", o.is_active AS "isActive", o.sort_order AS "sortOrder"
       FROM options o WHERE o.organization_id = $1 AND o.deleted_at IS NULL ORDER BY o.sort_order, o.name`,
      [organizationId]
    );
    return groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) }));
  }

  async findGroup(organizationId: string, id: string): Promise<OptionGroup | null> {
    return db().getRepository(OptionGroupEntity).findOne({ where: { id, organizationId } });
  }

  async existingGroupIds(organizationId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await db().getRepository(OptionGroupEntity).find({ where: { organizationId, id: In(ids) }, select: ["id"] });
    return rows.map((r) => r.id);
  }

  async createGroup(data: Omit<OptionGroup, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<OptionGroup> {
    const repo = db(tx).getRepository(OptionGroupEntity);
    return repo.save(repo.create(data));
  }

  async updateGroup(organizationId: string, id: string, data: Partial<OptionGroup>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OptionGroupEntity).update({ id, organizationId }, data);
  }

  async softDeleteGroup(organizationId: string, id: string): Promise<void> {
    await db().getRepository(OptionGroupEntity).softDelete({ id, organizationId });
  }

  async findOption(organizationId: string, id: string): Promise<Option | null> {
    return db().getRepository(OptionEntity).findOne({ where: { id, organizationId } });
  }

  async createOption(data: Omit<Option, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<Option> {
    const repo = db(tx).getRepository(OptionEntity);
    return repo.save(repo.create(data));
  }

  async updateOption(organizationId: string, id: string, data: Partial<Option>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OptionEntity).update({ id, organizationId }, data);
  }

  async softDeleteOption(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OptionEntity).softDelete({ id, organizationId });
  }

  // ── Storefront reads ───────────────────────────────────────────────────────

  async activeItemsForMenu(organizationId: string, menuId: string): Promise<ItemRow[]> {
    return db().query(`${SELECT_ITEM_ROW} WHERE i.organization_id = $1 AND c.menu_id = $2 AND i.deleted_at IS NULL AND i.is_active = true ORDER BY c.sort_order, i.sort_order, i.name`, [
      organizationId,
      menuId,
    ]);
  }

  async itemRow(organizationId: string, itemId: string): Promise<ItemRow | null> {
    const rows: ItemRow[] = await db().query(`${SELECT_ITEM_ROW} WHERE i.organization_id = $1 AND i.id = $2 AND i.deleted_at IS NULL`, [organizationId, itemId]);
    return rows[0] ?? null;
  }

  async itemRows(organizationId: string, itemIds: string[]): Promise<ItemRow[]> {
    if (itemIds.length === 0) return [];
    return db().query(`${SELECT_ITEM_ROW} WHERE i.organization_id = $1 AND i.id = ANY($2::uuid[]) AND i.deleted_at IS NULL`, [organizationId, itemIds]);
  }

  async featuredItems(organizationId: string, menuIds: string[]): Promise<ItemRow[]> {
    if (menuIds.length === 0) return [];
    return db().query(
      `${SELECT_ITEM_ROW} WHERE i.organization_id = $1 AND c.menu_id = ANY($2::uuid[]) AND i.deleted_at IS NULL AND i.is_active = true AND i.is_featured = true ORDER BY i.sort_order, i.name LIMIT 30`,
      [organizationId, menuIds]
    );
  }

  async searchItems(organizationId: string, menuIds: string[], q: string): Promise<ItemRow[]> {
    if (menuIds.length === 0) return [];
    return db().query(
      `${SELECT_ITEM_ROW} WHERE i.organization_id = $1 AND c.menu_id = ANY($2::uuid[]) AND i.deleted_at IS NULL AND i.is_active = true
         AND (i.name ILIKE $3 OR i.description ILIKE $3 OR c.name ILIKE $3) ORDER BY i.name LIMIT 50`,
      [organizationId, menuIds, likePattern(q)]
    );
  }

  /** Option groups + options for a set of items, flattened. */
  async groupRows(itemIds: string[]): Promise<GroupRow[]> {
    if (itemIds.length === 0) return [];
    return db().query(
      `SELECT ig.item_id AS "itemId", g.id AS "groupId", g.name AS "groupName", g.help_text AS "helpText", g.min_select AS "minSelect", g.max_select AS "maxSelect",
              ig.sort_order AS "groupSort", o.id AS "optionId", o.name AS "optionName", o.price_delta AS "priceDelta", o.sort_order AS "optionSort"
       FROM item_option_groups ig
       JOIN option_groups g ON g.id = ig.group_id AND g.deleted_at IS NULL
       LEFT JOIN options o ON o.group_id = g.id AND o.deleted_at IS NULL AND o.is_active = true
       WHERE ig.item_id = ANY($1::uuid[]) ORDER BY ig.sort_order, g.name, o.sort_order, o.name`,
      [itemIds]
    );
  }

  async categoriesForMenu(menuId: string): Promise<Array<{ id: string; name: string; description: string | null; imageUrl: string | null }>> {
    return db().query(`SELECT id, name, description, image_url AS "imageUrl" FROM categories WHERE menu_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`, [menuId]);
  }
}
