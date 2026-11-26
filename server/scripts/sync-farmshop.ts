// npm run sync:farmshop            → DRY RUN: shows every change it would make, writes nothing.
// npm run sync:farmshop -- --apply → makes the changes, all in one transaction (all or nothing).
//
// Adds categories from scripts/farmshopMenu.ts that are newer than the seeded menu. `seed:farmshop` can't do
// this: it skips when the menu already exists.
//
// It is ADD-ONLY, because the owner edits the live menu in admin: it never changes, shows, hides or removes
// anything already there, and an item the owner has since deleted is not brought back. Safe to run twice.
// (The one-off edits for the 21 Nov notes have been applied; they are in git history, not repeated here.)
//
//   SEED_SLUG=<slug>   restaurant to update (default: kiros)
//   MENU_NAME=<name>   menu to update, if the restaurant has several and none has the seeded name
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { inTransaction, type Tx } from "../infrastructure/database/transaction";
import { MenuRepository } from "../modules/menu/repositories/menu.repository";
import { OrganizationRepository } from "../modules/organization/repositories/organization.repository";
import { CATEGORIES, FARMSHOP_MENU_NAME, LEGACY_FARMSHOP_MENU_NAME } from "./farmshopMenu";

const APPLY = process.argv.includes("--apply");

/** Categories to bring into an existing menu, by their name in scripts/farmshopMenu.ts. */
const NEW_CATEGORIES = ["Detox juices", "Wellness shots", "Glowing skin shots"];

/** Thrown at the end of a dry run so the transaction rolls back. */
class DryRunRollback extends Error {}

const norm = (s: string) => s.trim().toLowerCase();

async function sync(tx: Tx, organizationId: string, menuId: string): Promise<number> {
  const menus = MenuRepository.Instance;
  let changes = 0;
  const did = (msg: string): void => {
    changes++;
    console.log(`  ${APPLY ? "✔" : "○"} ${msg}`);
  };

  const categories: Array<{ id: string; name: string }> = await tx.query(`SELECT id, name FROM categories WHERE menu_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`, [menuId]);
  // Deleted items are included on purpose: something the owner removed must stay removed.
  const items: Array<{ name: string; deleted: boolean }> = await tx.query(
    `SELECT i.name, i.deleted_at IS NOT NULL AS "deleted" FROM items i JOIN categories c ON c.id = i.category_id WHERE c.menu_id = $1`,
    [menuId]
  );
  const order = categories.map((c) => c.id);
  let createdCategory = false;

  for (const spec of CATEGORIES.filter((c) => NEW_CATEGORIES.includes(c.name))) {
    const missing = spec.items.filter((item) => {
      const matches = items.filter((i) => norm(i.name) === norm(item.name));
      if (matches.length === 0) return true;
      console.log(`  · "${item.name}" ${matches.some((m) => !m.deleted) ? "is already on the menu" : "was deleted in admin"}: left alone`);
      return false;
    });
    if (missing.length === 0) continue;

    let categoryId = categories.find((c) => norm(c.name) === norm(spec.name))?.id;
    if (!categoryId) {
      const made = await menus.createCategory({ organizationId, menuId, name: spec.name, description: spec.description, imageUrl: null, imagePublicId: null, sortOrder: order.length }, tx);
      categoryId = made.id;
      // Sit it after the nearest earlier category from the menu file that the live menu has (else first), keeping the owner's ordering.
      const earlier = CATEGORIES.slice(0, CATEGORIES.indexOf(spec)).reverse();
      const anchor = earlier.map((e) => categories.find((c) => norm(c.name) === norm(e.name))).find(Boolean);
      order.splice(anchor ? order.indexOf(anchor.id) + 1 : 0, 0, made.id);
      categories.push({ id: made.id, name: made.name });
      createdCategory = true;
      did(`Created category "${spec.name}"${anchor ? ` after "${anchor.name}"` : ""}`);
    }
    const [{ last }]: Array<{ last: number }> = await tx.query(`SELECT COALESCE(MAX(sort_order), -1)::int AS last FROM items WHERE category_id = $1 AND deleted_at IS NULL`, [categoryId]);
    for (let i = 0; i < missing.length; i++) {
      const item = missing[i];
      const isActive = item.active ?? true;
      await menus.createItem(
        { organizationId, categoryId, name: item.name, description: item.description, basePrice: item.price, imageUrl: null, imagePublicId: null, photos: [], isFeatured: Boolean(item.featured), pairsWithCategoryIds: [], isActive, sortOrder: last + 1 + i },
        tx
      );
      did(`Created "${item.name}" in "${spec.name}" at ₦${item.price / 100}${isActive ? "" : " (hidden)"}`);
    }
  }

  if (createdCategory) await menus.reorder("categories", organizationId, order, tx);
  if (changes > 0) console.log(`  · menu version → ${await menus.bumpVersion(menuId, tx)}`);
  return changes;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const slug = process.env.SEED_SLUG ?? "kiros";
  const org = await OrganizationRepository.Instance.findBySlug(slug);
  if (!org) throw new Error(`No restaurant with slug "${slug}".`);
  // The owner can rename the menu in admin, so a restaurant's only menu is taken to be the one.
  const all = await MenuRepository.Instance.listMenus(org.id);
  const wanted = process.env.MENU_NAME;
  const menu = wanted ? all.find((m) => m.name === wanted) : (all.find((m) => m.name === FARMSHOP_MENU_NAME || m.name === LEGACY_FARMSHOP_MENU_NAME) ?? (all.length === 1 ? all[0] : undefined));
  if (!menu) {
    const names = all.map((m) => `"${m.name}"`).join(", ") || "none";
    throw new Error(`Can't tell which menu to update for "${slug}" (menus: ${names}). Set MENU_NAME. Don't run seed:farmshop if the menu was only renamed: it would add a second copy.`);
  }

  console.log(`${APPLY ? "APPLYING" : "DRY RUN (nothing is written)"} — "${menu.name}" for "${slug}"`);
  let changes = 0;
  try {
    await inTransaction(async (tx) => {
      changes = await sync(tx, org.id, menu.id);
      if (!APPLY) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  console.log(changes === 0 ? "\nNothing to do: the menu already has everything." : `\n${changes} change(s) ${APPLY ? "applied." : "would be made. Re-run with --apply to make them."}`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
