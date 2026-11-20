// npm run seed:farmshop — adds the KIROS FarmShop menu (salads, shawarma, smoothies, parfait, juices) to an
// existing restaurant and serves it first at every branch. Safe to re-run: skips when the menu already exists.
//
//   SEED_SLUG=<slug>            restaurant to install into (default: kiros)
//   SEED_HIDE_OTHER_MENUS=1     also hide the restaurant's other menus (e.g. the old café / bubble-tea demo),
//                               so the storefront shows only the FarmShop menu. They stay in admin and can be
//                               switched back on there.
//
// Prices are placeholders: confirm and set them in Admin → Menus before go-live (see scripts/farmshopMenu.ts).
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { BranchRepository } from "../modules/branch/repositories/branch.repository";
import { MenuRepository } from "../modules/menu/repositories/menu.repository";
import { OrganizationRepository } from "../modules/organization/repositories/organization.repository";
import { FARMSHOP_MENU_NAME, LEGACY_FARMSHOP_MENU_NAME, installFarmshopMenu } from "./farmshopMenu";

const OLD_DEMO_NAME = "Demo Kitchen";
const OLD_DEMO_TAGLINE = "Two kitchens, one bag: café classics and bubble tea.";

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const slug = process.env.SEED_SLUG ?? "kiros";
  const org = await OrganizationRepository.Instance.findBySlug(slug);
  if (!org) throw new Error(`No restaurant with slug "${slug}". Run \`npm run seed\` first, or set SEED_SLUG.`);

  const menus = MenuRepository.Instance;
  const existing = await menus.listMenus(org.id);
  if (existing.some((m) => m.name === FARMSHOP_MENU_NAME || m.name === LEGACY_FARMSHOP_MENU_NAME)) {
    console.log(`"${FARMSHOP_MENU_NAME}" already exists for "${slug}" — nothing to do.`);
    await AppDataSource.destroy();
    return;
  }

  const { menuId, itemCount, hiddenItems } = await installFarmshopMenu(org.id, 0);

  // Serve it first at every branch, keeping whatever else each branch already serves.
  const branches = await BranchRepository.Instance.list(org.id, null);
  for (const b of branches) {
    const current: Array<{ menu_id: string }> = await AppDataSource.query(`SELECT menu_id FROM branch_menus WHERE branch_id = $1 ORDER BY sort_order`, [b.id]);
    await BranchRepository.Instance.setMenus(b.id, [menuId, ...current.map((r) => r.menu_id).filter((id) => id !== menuId)]);
  }

  if (process.env.SEED_HIDE_OTHER_MENUS === "1") {
    for (const m of existing) await menus.updateMenu(org.id, m.id, { isActive: false });
    for (const m of existing) await menus.bumpVersion(m.id);
  }

  // Only replace the storefront name / headline when they are still the old demo text.
  const profile: Record<string, string> = {};
  if (org.name === OLD_DEMO_NAME) profile.name = "KIROS Foods";
  if (org.tagline === OLD_DEMO_TAGLINE) profile.tagline = "Fresh from the farm: salads, smoothies and juices.";
  if (Object.keys(profile).length > 0) await OrganizationRepository.Instance.update(org.id, profile);

  console.log(`Added "${FARMSHOP_MENU_NAME}" to "${slug}" with ${itemCount} items, served at ${branches.length} branches.`);
  if (process.env.SEED_HIDE_OTHER_MENUS === "1" && existing.length > 0) console.log(`Hid ${existing.length} other menu(s): ${existing.map((m) => m.name).join(", ")}.`);
  console.log(`Hidden until confirmed with the shop: ${hiddenItems.join("; ")}.`);
  console.log("All prices are placeholders — set the real ones in Admin → Menus and Admin → Option groups.");
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
