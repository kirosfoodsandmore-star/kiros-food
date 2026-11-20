// npm run seed — the KIROS FarmShop restaurant: the FarmShop menu (build-your-own salad with 5 option groups,
// signature salads, shawarma, smoothies, parfait, juices), 7 branches, promo code, bank account. Idempotent by slug.
// To add the FarmShop menu to a database seeded before this, run `npm run seed:farmshop` instead.
//
//   Owner login: owner@kiros.test / Password123   (storefront slug: kiros)
//   SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD override the login (use a real email to sign in through Firebase).
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { db } from "../infrastructure/database/transaction";
import { BranchRepository } from "../modules/branch/repositories/branch.repository";
import { OrganizationRepository } from "../modules/organization/repositories/organization.repository";
import { OnboardingService } from "../modules/organization/services/onboarding.service";
import { PaymentSettingsRepository } from "../modules/payment/repositories/paymentSettings.repository";
import { PromoRepository } from "../modules/promo/repositories/promo.repository";
import { installFarmshopMenu } from "./farmshopMenu";

const SLUG = "kiros";
const K = (naira: number) => naira * 100;

const BRANCHES = [
  { name: "Lekki Phase 1", city: "Lagos", address: "12 Admiralty Way, Lekki Phase 1", lat: 6.4474, lng: 3.4706 },
  { name: "Victoria Island", city: "Lagos", address: "27 Akin Adesola St, Victoria Island", lat: 6.4281, lng: 3.4219 },
  { name: "Ikeja GRA", city: "Lagos", address: "5 Isaac John St, Ikeja GRA", lat: 6.5833, lng: 3.3553 },
  { name: "Yaba", city: "Lagos", address: "3 Herbert Macaulay Way, Yaba", lat: 6.5095, lng: 3.3711 },
  { name: "Surulere", city: "Lagos", address: "41 Adeniran Ogunsanya St, Surulere", lat: 6.4969, lng: 3.3553 },
  { name: "Wuse 2", city: "Abuja", address: "18 Aminu Kano Crescent, Wuse 2", lat: 9.0765, lng: 7.4785 },
  { name: "Maitama", city: "Abuja", address: "9 Gana St, Maitama", lat: 9.0867, lng: 7.4936 },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const organizations = OrganizationRepository.Instance;
  const branches = BranchRepository.Instance;

  if (await organizations.findBySlug(SLUG)) {
    console.log(`Restaurant "${SLUG}" already exists — nothing to do. (To add the FarmShop menu to it, run \`npm run seed:farmshop\`.)`);
    await AppDataSource.destroy();
    return;
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@kiros.test";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Password123";
  const created = await OnboardingService.Instance.createRestaurant({
    restaurantName: "KIROS Foods",
    slug: SLUG,
    ownerName: "KIROS Owner",
    ownerEmail,
    ownerPassword,
    phone: "+2348000000000",
    address: "Lagos, Nigeria",
  });
  const org = created.organizationId;
  await organizations.update(org, { tagline: "Fresh from the farm: salads, smoothies and juices.", orderPrefix: "KRS" });

  // Menu ────────────────────────────────────────────────────────────────────
  // Salads, shawarma, smoothies, parfait and juices. Prices are placeholders; see scripts/farmshopMenu.ts.
  const { menuId, itemCount, hiddenItems } = await installFarmshopMenu(org, 0);

  // Branches ────────────────────────────────────────────────────────────────
  for (let i = 0; i < BRANCHES.length; i++) {
    const b = BRANCHES[i];
    const branch = await branches.create({
      organizationId: org,
      name: b.name,
      city: b.city,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      phone: null,
      timezone: "Africa/Lagos",
      isPaused: false,
      pauseReason: null,
      deliveryEnabled: true,
      pickupEnabled: true,
      prepTimeMinutes: 20,
      slotIntervalMinutes: 15,
      paymentMethodOverride: null,
      isActive: true,
      sortOrder: i,
    });
    await branches.setMenus(branch.id, [menuId]);
    await db().transaction(async (tx) => {
      const hours = [];
      for (let weekday = 0; weekday <= 6; weekday++) hours.push({ weekday, opensAt: weekday === 0 ? "12:00" : "09:00", closesAt: weekday >= 5 || weekday === 0 ? "23:00" : "22:00" });
      await branches.replaceHours(branch.id, hours, tx);
    });
    await branches.createZone({ branchId: branch.id, organizationId: org, name: "Nearby (≤ 3 km)", maxDistanceKm: 3, fee: K(800), minOrder: K(2000), freeAboveAmount: K(15000), extraMinutes: 10, isActive: true });
    await branches.createZone({ branchId: branch.id, organizationId: org, name: "Wider area (≤ 8 km)", maxDistanceKm: 8, fee: K(1500), minOrder: K(3500), freeAboveAmount: null, extraMinutes: 25, isActive: true });
  }

  // Payments & promo ────────────────────────────────────────────────────────
  await PaymentSettingsRepository.Instance.createBankAccount({ organizationId: org, branchId: null, bankName: "Demo Bank", accountName: "KIROS Foods (demo)", accountNumber: "0123456789", isActive: true, sortOrder: 0 });
  await PaymentSettingsRepository.Instance.update(org, { transferEnabled: true, transferInstructions: "Use your order number as the transfer narration." });
  await PromoRepository.Instance.create({ organizationId: org, code: "WELCOME10", type: "percent", value: 10, startsAt: null, endsAt: null, maxUses: null, maxUsesPerCustomer: 1, minSpend: K(3000), branchId: null, menuId: null, isActive: true });

  console.log(`Seeded "KIROS Foods" (slug ${SLUG}) with ${itemCount} menu items at ${BRANCHES.length} branches.`);
  console.log(`Hidden until confirmed with the shop: ${hiddenItems.join("; ")}.`);
  console.log("All prices are placeholders — set the real ones in Admin → Menus and Admin → Option groups.");
  console.log(`Owner login: ${ownerEmail} / ${ownerPassword}`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
