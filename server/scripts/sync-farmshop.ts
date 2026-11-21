// npm run sync:farmshop            → DRY RUN: shows every change it would make, writes nothing.
// npm run sync:farmshop -- --apply → makes the changes, all in one transaction (all or nothing).
//
// Brings a menu that was already seeded (and since edited in admin) up to the 21 Nov 2026 notes in
// scripts/farmshopMenu.ts. `seed:farmshop` can't do this: it skips when the menu already exists.
//
// It is deliberately additive and conservative, because the owner has been editing the live menu:
//   • never changes a price, a photo, a featured flag or the name of anything the notes didn't change;
//   • only rewrites an item's description when it is empty or still the exact text the seed wrote;
//   • only adds what is missing (matched by name, ignoring case) and never duplicates an existing item,
//     so the owner's own "Fish Wrap" / "Beef Wrap" are kept as they are;
//   • safe to run twice: the second run reports "nothing to do".
//
//   SEED_SLUG=<slug>   restaurant to update (default: kiros)
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { inTransaction, type Tx } from "../infrastructure/database/transaction";
import type { Item } from "../modules/menu/entities/item.entity";
import type { OptionGroup } from "../modules/menu/entities/optionGroup.entity";
import { MenuRepository } from "../modules/menu/repositories/menu.repository";
import { OrganizationRepository } from "../modules/organization/repositories/organization.repository";
import {
  CATEGORIES,
  FARMSHOP_MENU_DESCRIPTION,
  FARMSHOP_MENU_NAME,
  LEGACY_FARMSHOP_MENU_NAME,
  PROTEIN_GROUP,
  PROTEIN_SALAD_CRAVINGS,
  SALAD_GROUPS,
  type CategorySpec,
  type ItemSpec,
} from "./farmshopMenu";

const APPLY = process.argv.includes("--apply");

/** Thrown at the end of a dry run so the transaction rolls back. */
class DryRunRollback extends Error {}

/** New in the 21 Nov notes (or missing from the live menu): created when no item of that name exists anywhere in the menu. */
const ENSURE_ITEMS = ["Build Your Protein Salad", "Basic fruit salad", "Exotic fruit salad", "Fruit splash", "Overnight oat", "Chia pudding", "Beef wrap", "Fish wrap"];

/** Items whose notes changed. `was` is the text the seed originally wrote: anything else is the owner's own wording and is kept. */
const REVISED: Array<{ name: string; aliases?: string[]; was: string[]; activate?: boolean }> = [
  { name: "Avocado chicken salad", was: ["With chicken and avocado."], activate: true },
  { name: "Exclusive sandwich", was: ["Ingredients to be confirmed."], activate: true },
  { name: "Chicken sandwich", was: ["Cucumber, lettuce, avocado, tomatoes, onions, oregano and sesame seed."] },
  { name: "Mixed grill shawarma", was: ["Mixed grill shawarma."] },
  { name: "Chicken wrap", was: ["Chicken wrap."] },
  {
    name: "Parfait",
    was: ["Yoghurt, granola, walnuts, cashew nut, coconut, raisin and fresh fruit: blueberry, kiwi, strawberry, grapes, apple and pomegranate."],
    activate: true,
  },
  { name: "High protein smoothie 1 (name to confirm)", aliases: ["High protein smoothie (name to confirm)"], was: [] },
  { name: "High protein smoothie 2 (name to confirm)", aliases: ["Berry chia smoothie (name to confirm)"], was: [] },
];

/** No longer in the notes. Only removed while still hidden (nobody has switched it on). */
const RETIRE_ITEMS = ["Unnamed smoothie 1"];

const OLD_PROTEIN_HELP = ["Add as many proteins as you like, each for an extra charge.", "Add one protein for an extra charge."];
const OLD_BYO_CATEGORY_DESCRIPTION = "Pick a base, up to 10 fillings, 2 cravings and a dressing. Add a protein if you like.";
const OLD_MENU_DESCRIPTION = "Build-your-own salads, signature salads, shawarma, smoothies, parfait and fresh juices.";

const norm = (s: string) => s.trim().toLowerCase();

interface LiveGroup { id: string; name: string; helpText: string | null; minSelect: number; maxSelect: number; sortOrder: number }
interface LiveOption { id: string; groupId: string; name: string; priceDelta: number; isActive: boolean; sortOrder: number }
interface LiveCategory { id: string; name: string; description: string | null; sortOrder: number }
interface LiveItem { id: string; categoryId: string; name: string; description: string | null; basePrice: number; isActive: boolean; sortOrder: number }

let changes = 0;
const did = (msg: string): void => {
  changes++;
  console.log(`  ${APPLY ? "✔" : "○"} ${msg}`);
};
const note = (msg: string): void => console.log(`  · ${msg}`);

function specItem(name: string): { spec: ItemSpec; category: CategorySpec } {
  for (const category of CATEGORIES) {
    const spec = category.items.find((i) => i.name === name);
    if (spec) return { spec, category };
  }
  throw new Error(`"${name}" is not in scripts/farmshopMenu.ts`);
}

async function sync(tx: Tx, organizationId: string, menuId: string): Promise<void> {
  const menus = MenuRepository.Instance;
  const q = <T>(sql: string, params: unknown[]): Promise<T[]> => tx.query(sql, params);

  const loadGroups = () =>
    q<LiveGroup>(`SELECT id, name, help_text AS "helpText", min_select AS "minSelect", max_select AS "maxSelect", sort_order AS "sortOrder" FROM option_groups WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`, [organizationId]);
  const loadOptions = () =>
    q<LiveOption>(`SELECT id, group_id AS "groupId", name, price_delta AS "priceDelta", is_active AS "isActive", sort_order AS "sortOrder" FROM options WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`, [organizationId]);
  const loadCategories = () =>
    q<LiveCategory>(`SELECT id, name, description, sort_order AS "sortOrder" FROM categories WHERE menu_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`, [menuId]);
  const loadItems = () =>
    q<LiveItem>(
      `SELECT i.id, i.category_id AS "categoryId", i.name, i.description, i.base_price AS "basePrice", i.is_active AS "isActive", i.sort_order AS "sortOrder"
       FROM items i JOIN categories c ON c.id = i.category_id WHERE c.menu_id = $1 AND i.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY c.sort_order, i.sort_order`,
      [menuId]
    );
  const itemGroupIds = async (itemId: string) => (await q<{ groupId: string }>(`SELECT group_id AS "groupId" FROM item_option_groups WHERE item_id = $1 ORDER BY sort_order`, [itemId])).map((r) => r.groupId);

  // ── Option groups ─────────────────────────────────────────────────────────
  console.log("\nOption groups");
  let groups = await loadGroups();
  let options = await loadOptions();
  const group = (name: string) => groups.find((g) => norm(g.name) === norm(name));
  const optionsOf = (g: LiveGroup) => options.filter((o) => o.groupId === g.id);

  // Rocket is a craving now, not a filling.
  const fillings = group("Fillings");
  const cravings = group("Cravings");
  if (fillings) {
    for (const o of optionsOf(fillings).filter((o) => norm(o.name) === "rocket")) {
      await menus.softDeleteOption(organizationId, o.id, tx);
      did(`Fillings: removed "Rocket" (it's a craving now)`);
    }
  }
  if (cravings && !optionsOf(cravings).some((o) => norm(o.name) === "rocket")) {
    const sort = Math.max(-1, ...optionsOf(cravings).map((o) => o.sortOrder)) + 1;
    await menus.createOption({ organizationId, groupId: cravings.id, name: "Rocket", priceDelta: 0, isActive: true, sortOrder: sort }, tx);
    did(`Cravings: added "Rocket"`);
  }
  options = await loadOptions();

  // "Protein add-on" (0–7, optional) becomes "Protein": exactly one, required, used by the protein salad.
  const proteinSpec = SALAD_GROUPS.find((g) => g.name === PROTEIN_GROUP)!;
  let protein = group("Protein add-on") ?? group(PROTEIN_GROUP);
  if (protein) {
    const patch: Partial<OptionGroup> = {};
    if (protein.name !== PROTEIN_GROUP) patch.name = PROTEIN_GROUP;
    if (protein.minSelect !== proteinSpec.minSelect || protein.maxSelect !== proteinSpec.maxSelect) {
      patch.minSelect = proteinSpec.minSelect;
      patch.maxSelect = proteinSpec.maxSelect;
    }
    if (!protein.helpText || OLD_PROTEIN_HELP.includes(protein.helpText)) {
      if (protein.helpText !== proteinSpec.helpText) patch.helpText = proteinSpec.helpText;
    }
    if (Object.keys(patch).length > 0) {
      await menus.updateGroup(organizationId, protein.id, patch, tx);
      did(`Protein group: ${Object.entries(patch).map(([k, v]) => `${k} → ${JSON.stringify(v)}`).join(", ")} (was "${protein.name}" ${protein.minSelect}–${protein.maxSelect})`);
    } else note("Protein group already matches");
  } else {
    const created = await menus.createGroup({ organizationId, name: proteinSpec.name, helpText: proteinSpec.helpText, minSelect: proteinSpec.minSelect, maxSelect: proteinSpec.maxSelect, sortOrder: groups.length }, tx);
    for (let i = 0; i < proteinSpec.options.length; i++) await menus.createOption({ organizationId, groupId: created.id, name: proteinSpec.options[i][0], priceDelta: proteinSpec.options[i][1], isActive: true, sortOrder: i }, tx);
    did(`Created group "${PROTEIN_GROUP}" with ${proteinSpec.options.length} proteins`);
  }

  // Protein salad takes four cravings. A group owns its options, so it gets its own copy of the live Cravings list.
  groups = await loadGroups();
  options = await loadOptions();
  protein = group(PROTEIN_GROUP)!;
  let cravings4 = group(PROTEIN_SALAD_CRAVINGS);
  if (!cravings4) {
    const spec = SALAD_GROUPS.find((g) => g.name === PROTEIN_SALAD_CRAVINGS)!;
    const live = group("Cravings");
    const source: Array<{ name: string; priceDelta: number; isActive: boolean }> = live ? optionsOf(live) : spec.options.map(([name, priceDelta]) => ({ name, priceDelta, isActive: true }));
    cravings4 = await menus.createGroup(
      { organizationId, name: PROTEIN_SALAD_CRAVINGS, helpText: spec.helpText, minSelect: spec.minSelect, maxSelect: spec.maxSelect, sortOrder: Math.max(-1, ...groups.map((g) => g.sortOrder)) + 1 },
      tx
    );
    for (let i = 0; i < source.length; i++) await menus.createOption({ organizationId, groupId: cravings4.id, name: source[i].name, priceDelta: source[i].priceDelta, isActive: source[i].isActive, sortOrder: i }, tx);
    did(`Created group "${PROTEIN_SALAD_CRAVINGS}" (pick exactly 4) with ${source.length} cravings copied from "${live?.name ?? "the seed list"}"`);
    groups = await loadGroups();
  } else note(`"${PROTEIN_SALAD_CRAVINGS}" already exists`);

  // Parfait sizes carry the cup volume.
  const parfait = group("Parfait size");
  if (parfait) {
    for (const [from, to] of [["Medium", "Medium (350ml)"], ["Big", "Big (500ml)"]] as const) {
      const o = optionsOf(parfait).find((x) => x.name === from);
      if (o) {
        await menus.updateOption(organizationId, o.id, { name: to }, tx);
        did(`Parfait size: "${from}" → "${to}"`);
      }
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────
  console.log("\nCategories");
  let categories = await loadCategories();
  const categoryByName = (name: string) => categories.find((c) => norm(c.name) === norm(name));
  const order = categories.map((c) => c.id);
  let created = false;
  for (const name of new Set(ENSURE_ITEMS.map((n) => specItem(n).category.name))) {
    if (categoryByName(name)) continue;
    const idx = CATEGORIES.findIndex((c) => c.name === name);
    const spec = CATEGORIES[idx];
    const made = await menus.createCategory({ organizationId, menuId, name: spec.name, description: spec.description, imageUrl: null, imagePublicId: null, sortOrder: order.length }, tx);
    // Sit it after the nearest earlier category from the notes that the live menu has, keeping the owner's own ordering.
    let after = -1;
    for (let j = idx - 1; j >= 0 && after < 0; j--) {
      const anchor = categories.find((c) => norm(c.name) === norm(CATEGORIES[j].name));
      if (anchor) after = order.indexOf(anchor.id);
    }
    order.splice(after + 1, 0, made.id);
    categories = [...categories, { id: made.id, name: made.name, description: made.description, sortOrder: made.sortOrder }];
    created = true;
    did(`Created category "${spec.name}"`);
  }
  if (created) await menus.reorder("categories", organizationId, order, tx);

  const byo = categoryByName("Build your own salad");
  const byoSpec = CATEGORIES.find((c) => c.name === "Build your own salad")!;
  if (byo && byo.description === OLD_BYO_CATEGORY_DESCRIPTION) {
    await menus.updateCategory(organizationId, byo.id, { description: byoSpec.description }, tx);
    did(`"Build your own salad" description now mentions the protein salad`);
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  console.log("\nItems");
  let items = await loadItems();
  const itemByName = (name: string) => items.find((i) => norm(i.name) === norm(name));
  const salad = itemByName("Build Your Salad");
  const saladGroupIds = salad ? await itemGroupIds(salad.id) : [];

  for (const name of ENSURE_ITEMS) {
    const { spec, category } = specItem(name);
    const live = itemByName(name);
    if (live) {
      if (!live.description?.trim()) {
        await menus.updateItem(organizationId, live.id, { description: spec.description }, tx);
        did(`"${live.name}" had no description: set "${spec.description}"`);
      } else note(`"${live.name}" already on the menu (₦${live.basePrice / 100}): left as is`);
      continue;
    }
    const cat = categoryByName(category.name)!;
    const sort = Math.max(-1, ...items.filter((i) => i.categoryId === cat.id).map((i) => i.sortOrder)) + 1;
    // The protein salad starts at whatever the owner charges for the plain salad, since protein is added on top.
    const price = name === "Build Your Protein Salad" && salad ? salad.basePrice : spec.price;
    const pairs = (category.goesWith ?? []).map((n) => categoryByName(n)?.id).filter((id): id is string => Boolean(id));
    const made = await menus.createItem(
      { organizationId, categoryId: cat.id, name: spec.name, description: spec.description, basePrice: price, imageUrl: null, imagePublicId: null, photos: [], isFeatured: Boolean(spec.featured), pairsWithCategoryIds: pairs, isActive: spec.active ?? true, sortOrder: sort },
      tx
    );
    items = [...items, { id: made.id, categoryId: cat.id, name: made.name, description: made.description, basePrice: price, isActive: made.isActive, sortOrder: sort }];
    did(`Created "${spec.name}" in "${cat.name}" at ₦${price / 100}${spec.active === false ? " (hidden)" : ""}`);
    if (name === "Build Your Protein Salad") {
      // Same groups, in the same order, as the live plain salad, with the 4-cravings group in place of the 2-cravings one and Protein required.
      const craving2 = group("Cravings")?.id;
      let list = saladGroupIds.map((id) => (id === craving2 ? cravings4!.id : id));
      if (!list.includes(protein!.id)) {
        const dressing = group("Dressing")?.id;
        const at = dressing ? list.indexOf(dressing) : -1;
        list = at >= 0 ? [...list.slice(0, at + 1), protein!.id, ...list.slice(at + 1)] : [...list, protein!.id];
      }
      if (!list.includes(cravings4!.id)) list = [...list, cravings4!.id];
      await menus.setItemGroups(made.id, list, tx);
      did(`"${spec.name}" groups: ${list.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(" → ")}`);
    }
  }
  items = await loadItems();

  // The plain salad no longer carries the protein add-on (protein lives in the protein salad).
  if (salad && saladGroupIds.includes(protein!.id)) {
    await menus.setItemGroups(salad.id, saladGroupIds.filter((id) => id !== protein!.id), tx);
    did(`"${salad.name}": removed the protein group (protein is in the protein salad now)`);
  }

  for (const r of REVISED) {
    const live = [r.name, ...(r.aliases ?? [])].map(itemByName).find(Boolean);
    if (!live) {
      note(`"${r.name}" not found: skipped`);
      continue;
    }
    const { spec } = specItem(r.name);
    const patch: Partial<Item> = {};
    if (live.name !== spec.name) patch.name = spec.name;
    const text = live.description?.trim() ?? "";
    if (text !== spec.description) {
      if (!text || r.was.includes(text)) patch.description = spec.description;
      else note(`"${live.name}": kept the owner's description ("${text}")`);
    }
    if (r.activate && !live.isActive) patch.isActive = true;
    if (Object.keys(patch).length > 0) {
      await menus.updateItem(organizationId, live.id, patch, tx);
      did(`"${live.name}": ${Object.entries(patch).map(([k, v]) => `${k} → ${JSON.stringify(v)}`).join("; ")}`);
    }
  }

  for (const name of RETIRE_ITEMS) {
    const live = itemByName(name);
    if (!live) continue;
    if (live.isActive) {
      note(`"${name}" is switched on: left alone (remove it in admin if it's no longer wanted)`);
      continue;
    }
    await menus.softDeleteItem(organizationId, live.id, tx);
    did(`Removed hidden item "${name}" (no longer in the notes)`);
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  const [menu] = await q<{ description: string | null }>(`SELECT description FROM menus WHERE id = $1`, [menuId]);
  if (menu?.description === OLD_MENU_DESCRIPTION) {
    await menus.updateMenu(organizationId, menuId, { description: FARMSHOP_MENU_DESCRIPTION }, tx);
    did("Menu description lists fruit salads and overnight oats");
  }
  if (changes > 0) {
    const version = await menus.bumpVersion(menuId, tx);
    note(`menu version → ${version} (open storefronts will refresh)`);
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const slug = process.env.SEED_SLUG ?? "kiros";
  const org = await OrganizationRepository.Instance.findBySlug(slug);
  if (!org) throw new Error(`No restaurant with slug "${slug}".`);
  const menu = (await MenuRepository.Instance.listMenus(org.id)).find((m) => m.name === FARMSHOP_MENU_NAME || m.name === LEGACY_FARMSHOP_MENU_NAME);
  if (!menu) throw new Error(`"${slug}" has no "${FARMSHOP_MENU_NAME}" (or "${LEGACY_FARMSHOP_MENU_NAME}") menu. Run \`npm run seed:farmshop\` instead.`);

  console.log(`${APPLY ? "APPLYING" : "DRY RUN (nothing is written)"} — "${menu.name}" for "${slug}"`);
  try {
    await inTransaction(async (tx) => {
      await sync(tx, org.id, menu.id);
      if (!APPLY) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  console.log(changes === 0 ? "\nNothing to do: the menu already matches the notes." : `\n${changes} change(s) ${APPLY ? "applied." : "would be made. Re-run with --apply to make them."}`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
