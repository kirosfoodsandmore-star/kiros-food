// npm run seed:demo — piles realistic activity on top of the base demo restaurant (run `npm run seed` first):
// staff for every branch, ~90 customers with addresses, ~650 orders over the last 45 days
// (completed / cancelled / refunded history) plus a live board of orders in every status, payments awaiting
// confirmation, promo codes in different states, sold-out items, a paused branch and an upcoming holiday.
//
//   Staff logins (all Password123): manager.<branch>@kiros.test, kitchen.<branch>@kiros.test, rider.<branch>@kiros.test
//   Idempotent: skips if demo customers already exist. SEED_DEMO_RESET=1 wipes the previous demo activity first.
import bcrypt from "bcryptjs";
import "reflect-metadata";
import { AppDataSource } from "../infrastructure/database/dataSource";

const SLUG = "kiros";
const K = (naira: number) => naira * 100;
const HIST_DAYS = 45;
const MARKER = "@demo.kiros.test";

// Deterministic PRNG so every run produces the same dataset.
let state = 20260101;
function rand(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
function weighted<T>(entries: Array<[T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Row = Record<string, unknown>;
type Q = (sql: string, params?: unknown[]) => Promise<any[]>;

async function insert(q: Q, table: string, row: Row, returning = false): Promise<any> {
  const keys = Object.keys(row);
  const values = keys.map((k) => {
    const v = row[k];
    // Plain objects go in as JSON; JS arrays stay arrays (uuid[] / text[] columns). jsonb arrays are pre-stringified by callers.
    return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) ? JSON.stringify(v) : v;
  });
  const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})${returning ? ' RETURNING "id"' : ""}`;
  const res = await q(sql, values);
  return returning ? res[0] : undefined;
}

const FIRST = ["Chinedu", "Adaeze", "Tunde", "Ngozi", "Emeka", "Funke", "Ibrahim", "Aisha", "Segun", "Folake", "Obinna", "Chiamaka", "Yusuf", "Zainab", "Femi", "Bisi", "Kelechi", "Amaka", "Daniel", "Grace", "Samuel", "Blessing", "Michael", "Esther", "David", "Rukky", "Tobi", "Ife", "Kemi", "Dayo", "Uche", "Nneka", "Sola", "Lola", "Hauwa", "Musa", "Peter", "Sade", "Ada", "Seyi"];
const LAST = ["Okafor", "Adeyemi", "Balogun", "Eze", "Mohammed", "Okonkwo", "Bello", "Adebayo", "Nwosu", "Ogunleye", "Abubakar", "Olawale", "Ibe", "Fashola", "Chukwu", "Lawal", "Obi", "Akinola", "Danjuma", "Ojo", "Umeh", "Salami", "Onyeama", "Afolabi", "Ezekiel"];
const STREETS: Record<string, string[]> = {
  Lagos: ["Admiralty Way", "Ozumba Mbadiwe Ave", "Awolowo Road", "Bourdillon Rd", "Allen Avenue", "Opebi Road", "Ikorodu Road", "Herbert Macaulay Way", "Adeniran Ogunsanya St", "Bode Thomas St", "Fola Osibo St", "Ligali Ayorinde St", "Lekki-Epe Expressway", "Awolowo Way"],
  Abuja: ["Aminu Kano Crescent", "Gana St", "Ademola Adetokunbo Cres", "Ahmadu Bello Way", "Libreville St", "IBB Way"],
};
const AREAS = ["Lekki Phase 1", "Victoria Island", "Ikoyi", "Ikeja", "Yaba", "Surulere", "Maryland", "Ajah", "Gbagada", "Wuse 2", "Maitama", "Garki"];
const CANCEL_STAFF = ["Item sold out", "Kitchen closing early", "Outside delivery range", "Unable to reach customer", "Duplicate order"];
const NOTES = ["Please add extra napkins", "No onions please", "Call when you arrive", "Leave with the gate man", "Extra spicy please", "Allergic to peanuts", "Ring the bell twice", "Pack sauces separately"];
const LINE_NOTES = ["no onions", "dressing on the side", "no honey", "extra cold", "cut in half", "separate bag"];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const q: Q = (sql, params) => AppDataSource.query(sql, params);

  const orgRows = await q(`SELECT id, order_prefix FROM organizations WHERE slug = $1`, [SLUG]);
  if (orgRows.length === 0) {
    console.error(`Restaurant "${SLUG}" not found — run "npm run seed" first.`);
    process.exitCode = 1;
    await AppDataSource.destroy();
    return;
  }
  const org: string = orgRows[0].id;
  const prefix: string = orgRows[0].order_prefix;

  const existing = await q(`SELECT 1 FROM customers WHERE organization_id = $1 AND email LIKE $2 LIMIT 1`, [org, `%${MARKER}`]);
  if (existing.length > 0) {
    if (process.env.SEED_DEMO_RESET !== "1") {
      console.log("Demo activity already seeded — nothing to do. (Set SEED_DEMO_RESET=1 to wipe and reseed it.)");
      await AppDataSource.destroy();
      return;
    }
    console.log("Resetting previous demo activity…");
    await q(`DELETE FROM chat_conversations WHERE organization_id = $1`, [org]);
    await q(`DELETE FROM orders WHERE organization_id = $1`, [org]);
    await q(`DELETE FROM carts WHERE organization_id = $1`, [org]);
    await q(`DELETE FROM customers WHERE organization_id = $1`, [org]);
    await q(`DELETE FROM users WHERE organization_id = $1 AND email ~ '^(manager|kitchen|rider|rider2|former\\.employee|ops)(\\.|@).*@kiros\\.test$'`, [org]);
    await q(`DELETE FROM counters WHERE organization_id = $1 AND key = 'order'`, [org]);
  }

  await AppDataSource.transaction(async (em) => {
    const tq: Q = (sql, params) => em.query(sql, params);
    const now = new Date();

    // ── Branches / roles ───────────────────────────────────────────────────────
    const branches: Array<{ id: string; name: string; city: string; lat: number; lng: number; menuIds: string[] }> = await tq(
      `SELECT id, name, city, lat, lng FROM branches WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
      [org]
    );
    for (const b of branches) b.menuIds = (await tq(`SELECT menu_id FROM branch_menus WHERE branch_id = $1`, [b.id])).map((r) => r.menu_id);
    const roles: Record<string, string> = {};
    for (const r of await tq(`SELECT id, key FROM roles WHERE organization_id = $1 AND deleted_at IS NULL`, [org])) roles[r.key] = r.id;
    const ownerRow = (await tq(`SELECT id, name FROM users WHERE organization_id = $1 AND role_id = $2 AND deleted_at IS NULL LIMIT 1`, [org, roles.owner]))[0];

    // Full orderable catalogue: per menu → items with their option groups and options.
    interface Opt { id: string; name: string; delta: number }
    interface Grp { id: string; name: string; min: number; max: number; options: Opt[] }
    interface Item { id: string; name: string; category: string; base: number; menuId: string; groups: Grp[] }
    const items: Item[] = [];
    for (const r of await tq(
      `SELECT i.id, i.name, i.base_price, c.name AS category, c.menu_id FROM items i JOIN categories c ON c.id = i.category_id
       WHERE i.organization_id = $1 AND i.deleted_at IS NULL AND i.is_active AND c.deleted_at IS NULL`,
      [org]
    )) {
      const groups: Grp[] = [];
      for (const g of await tq(
        `SELECT g.id, g.name, g.min_select, g.max_select FROM item_option_groups iog JOIN option_groups g ON g.id = iog.group_id WHERE iog.item_id = $1 AND g.deleted_at IS NULL ORDER BY iog.sort_order`,
        [r.id]
      )) {
        const options = (await tq(`SELECT id, name, price_delta FROM options WHERE group_id = $1 AND is_active AND deleted_at IS NULL ORDER BY sort_order`, [g.id])).map((o) => ({ id: o.id, name: o.name, delta: Number(o.price_delta) }));
        groups.push({ id: g.id, name: g.name, min: g.min_select, max: g.max_select, options });
      }
      items.push({ id: r.id, name: r.name, category: r.category, base: Number(r.base_price), menuId: r.menu_id, groups });
    }

    // ── Staff ──────────────────────────────────────────────────────────────────
    const passwordHash = bcrypt.hashSync("Password123", 10);
    const staffByBranch: Record<string, { manager: { id: string; name: string }; riders: Array<{ id: string; name: string }> }> = {};
    for (const b of branches) {
      const tag = slugify(b.name);
      const mk = async (role: string, who: string, name: string, phone: string) => {
        const email = `${who}.${tag}@kiros.test`;
        const found = await tq(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
        if (found.length) return { id: found[0].id as string, name };
        const u = await insert(tq, "users", { organization_id: org, role_id: roles[role], name, email, password_hash: passwordHash, phone, branch_ids: [b.id], all_branches: false, is_active: true, last_login_at: addMin(now, -int(5, 2000)), last_seen_at: addMin(now, -int(1, 120)) }, true);
        return { id: u.id as string, name };
      };
      const manager = await mk("branch_manager", "manager", `${pick(FIRST)} ${pick(LAST)}`, `+23480${int(10000000, 99999999)}`);
      await mk("kitchen_staff", "kitchen", `${pick(FIRST)} ${pick(LAST)}`, `+23481${int(10000000, 99999999)}`);
      const rider = await mk("rider", "rider", `${pick(FIRST)} ${pick(LAST)}`, `+23470${int(10000000, 99999999)}`);
      const rider2 = await mk("rider", "rider2", `${pick(FIRST)} ${pick(LAST)}`, `+23490${int(10000000, 99999999)}`);
      staffByBranch[b.id] = { manager, riders: [rider, rider2] };
    }
    const opsEmail = "ops@kiros.test";
    if (!(await tq(`SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL`, [opsEmail])).length) {
      await insert(tq, "users", { organization_id: org, role_id: roles.branch_manager, name: "Ops Manager (Lagos Mainland)", email: opsEmail, password_hash: passwordHash, phone: "+2348099990000", branch_ids: branches.filter((b) => ["Ikeja GRA", "Yaba", "Surulere"].includes(b.name)).map((b) => b.id), all_branches: false, is_active: true, last_login_at: addMin(now, -90) });
    }
    // One deactivated ex-employee for the staff-management screen.
    if (!(await tq(`SELECT 1 FROM users WHERE email = $1`, ["former.employee@kiros.test"])).length) {
      await insert(tq, "users", { organization_id: org, role_id: roles.kitchen_staff, name: "Former Employee", email: "former.employee@kiros.test", password_hash: passwordHash, phone: null, branch_ids: [branches[0].id], all_branches: false, is_active: false });
    }

    // ── Promo codes ────────────────────────────────────────────────────────────
    const promoRows: Array<[string, "percent" | "fixed", number, Date | null, Date | null, number | null, number, number | null, boolean]> = [
      ["SAVE500", "fixed", K(500), null, null, null, K(4000), 3, true],
      ["WEEKEND15", "percent", 15, null, null, null, K(5000), null, true],
      ["LAGOS1000", "fixed", K(1000), null, null, 200, K(8000), 2, true],
      ["BOBA20", "percent", 20, addMin(now, -60 * 24 * 10), addMin(now, 60 * 24 * 20), 100, K(2500), 1, true],
      ["EXPIRED20", "percent", 20, addMin(now, -60 * 24 * 60), addMin(now, -60 * 24 * 14), null, 0, null, true],
      ["FULLYUSED", "fixed", K(700), null, null, 50, 0, null, true],
      ["PAUSED25", "percent", 25, null, null, null, K(6000), null, false],
    ];
    for (const [code, type, value, startsAt, endsAt, maxUses, minSpend, perCustomer, isActive] of promoRows) {
      if ((await tq(`SELECT 1 FROM promo_codes WHERE organization_id = $1 AND code = $2 AND deleted_at IS NULL`, [org, code])).length) continue;
      await insert(tq, "promo_codes", { organization_id: org, code, type, value, starts_at: startsAt, ends_at: endsAt, max_uses: maxUses, used_count: code === "FULLYUSED" ? 50 : 0, max_uses_per_customer: perCustomer, min_spend: minSpend, is_active: isActive });
    }
    const promoDefs: Record<string, { type: string; value: number; minSpend: number }> = {
      WELCOME10: { type: "percent", value: 10, minSpend: K(3000) },
      SAVE500: { type: "fixed", value: K(500), minSpend: K(4000) },
      WEEKEND15: { type: "percent", value: 15, minSpend: K(5000) },
      LAGOS1000: { type: "fixed", value: K(1000), minSpend: K(8000) },
    };

    // ── Customers ──────────────────────────────────────────────────────────────
    interface Cust { id: string; name: string; phone: string; email: string | null; city: string; home: { id: string }; addresses: Array<{ line: string; lat: number; lng: number; instructions: string | null }>; weight: number; blocked: boolean }
    const customers: Cust[] = [];
    const usedPhones = new Set<string>();
    const lagosBranches = branches.filter((b) => b.city === "Lagos");
    const abujaBranches = branches.filter((b) => b.city === "Abuja");
    for (let i = 0; i < 90; i++) {
      const first = pick(FIRST), last = pick(LAST);
      let phone: string;
      do phone = `+234${pick(["803", "806", "810", "813", "816", "703", "705", "902", "908"])}${int(1000000, 9999999)}`; while (usedPhones.has(phone));
      usedPhones.add(phone);
      const city = chance(0.14) && abujaBranches.length ? "Abuja" : "Lagos";
      const home = pick(city === "Abuja" ? abujaBranches : lagosBranches);
      const blocked = i >= 88; // two blocked customers
      const email = chance(0.6) ? `${first}.${last}${i}${MARKER}`.toLowerCase() : null;
      const lastSeen = addMin(now, -int(10, 60 * 24 * 40));
      const row = await insert(tq, "customers", {
        organization_id: org, phone, name: chance(0.93) ? `${first} ${last}` : null,
        // Every customer carries the demo marker domain so re-runs can detect them (even the "no email" ones get a guest alias).
        email: email ?? `guest${i}${MARKER}`, is_blocked: blocked, block_reason: blocked ? pick(["Repeated fake orders", "Abusive messages to riders"]) : null, last_seen_at: lastSeen,
        created_at: addMin(now, -60 * 24 * int(1, 80)),
      }, true);
      const addrCount = int(1, 2);
      const addresses: Cust["addresses"] = [];
      for (let a = 0; a < addrCount; a++) {
        const line = `${int(1, 90)} ${pick(STREETS[city])}, ${pick(city === "Abuja" ? AREAS.slice(9) : AREAS.slice(0, 9))}`;
        const lat = home.lat + (rand() - 0.5) * 0.07, lng = home.lng + (rand() - 0.5) * 0.07;
        const instructions = chance(0.4) ? pick(["Call on arrival", "Blue gate, 2nd floor", "Security will direct you", "Opposite the pharmacy"]) : null;
        addresses.push({ line, lat, lng, instructions });
        await insert(tq, "addresses", { organization_id: org, customer_id: row.id, label: a === 0 ? "Home" : pick(["Work", "Mum's place", "Office"]), line, lat, lng, instructions, is_default: a === 0 });
      }
      // Heavy-tailed ordering frequency: a few regulars account for most orders.
      customers.push({ id: row.id, name: `${first} ${last}`, phone, email, city, home, addresses, weight: Math.max(0.4, 14 / Math.pow(i + 1, 0.85)), blocked });
    }
    const orderable = customers.filter((c) => !c.blocked);
    const pickCustomer = (): Cust => weighted(orderable.map((c) => [c, c.weight] as [Cust, number]));

    // ── Orders ─────────────────────────────────────────────────────────────────
    type Status = "pending_payment" | "awaiting_confirmation" | "paid" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled" | "refunded";
    interface Plan { created: Date; status: Status; branch: (typeof branches)[number]; scheduled?: Date | null; forceMethod?: "paystack" | "transfer"; forceFulfilment?: "delivery" | "pickup"; cancelReason?: string; cancelledBy?: "staff" | "customer" | "system" }
    const plans: Plan[] = [];
    const branchWeight = (b: { name: string }) => ({ "Lekki Phase 1": 5, "Victoria Island": 4.5, "Ikeja GRA": 3.5, Yaba: 3, Surulere: 2, "Wuse 2": 2.5, Maitama: 2 } as Record<string, number>)[b.name] ?? 2;
    const pickBranch = () => weighted(branches.map((b) => [b, branchWeight(b)] as [(typeof branches)[number], number]));
    const HOUR_W: Array<[number, number]> = [[8, 1], [9, 2], [10, 2], [11, 4], [12, 9], [13, 10], [14, 6], [15, 3], [16, 3], [17, 4], [18, 8], [19, 10], [20, 9], [21, 5], [22, 1]];

    // History: oldest → newest, busier on weekends and trending up.
    for (let d = HIST_DAYS; d >= 0; d--) {
      const day = new Date(now.getTime() - d * 86_400_000);
      const dow = day.getUTCDay();
      const volume = Math.round((10 + (HIST_DAYS - d) * 0.12 + (dow === 5 || dow === 6 ? 6 : dow === 0 ? 3 : 0)) * (0.8 + rand() * 0.45));
      for (let n = 0; n < volume; n++) {
        const hourLocal = weighted(HOUR_W);
        const created = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hourLocal - 1, int(0, 59), int(0, 59)));
        if (created.getTime() > now.getTime() - 100 * 60_000) continue; // leave the recent window to the live board
        const roll = rand();
        const status: Status = roll < 0.84 ? "completed" : roll < 0.9 ? "cancelled" : roll < 0.94 ? "refunded" : "completed";
        plans.push({ created, status, branch: pickBranch() });
      }
    }
    // Live board: every status the admin order screens need to show.
    const live: Array<[Status, number, number, number?]> = [
      ["pending_payment", 4, 1, 18], ["awaiting_confirmation", 6, 3, 28], ["paid", 6, 1, 10], ["accepted", 5, 8, 24], ["preparing", 8, 12, 40],
      ["ready", 5, 25, 60], ["out_for_delivery", 6, 35, 75],
    ];
    for (const [status, count, minAge, maxAge] of live) {
      for (let n = 0; n < count; n++) {
        const base: Plan = { created: addMin(now, -int(minAge, maxAge ?? minAge + 10)), status, branch: pickBranch() };
        if (status === "awaiting_confirmation") base.forceMethod = "transfer";
        if (status === "pending_payment") base.forceMethod = chance(0.6) ? "paystack" : "transfer";
        if (status === "out_for_delivery") base.forceFulfilment = "delivery";
        plans.push(base);
      }
    }
    // Scheduled-for-later orders (already paid) and a few payment-window expiries from earlier today.
    for (let n = 0; n < 7; n++) plans.push({ created: addMin(now, -int(20, 240)), status: "paid", branch: pickBranch(), scheduled: addMin(now, int(120, 60 * 26)) });
    for (let n = 0; n < 4; n++) plans.push({ created: addMin(now, -int(120, 600)), status: "cancelled", branch: pickBranch(), forceMethod: "transfer", cancelReason: "Payment window expired", cancelledBy: "system" });

    plans.sort((a, b) => a.created.getTime() - b.created.getTime());

    const used: Record<string, number> = {};
    const spend: Record<string, { count: number; total: number; last: Date | null }> = {};
    const liveCustomers = new Set<string>();
    let sequence = 0;
    const orderIdsForChat: Array<{ id: string; branchId: string; customerId: string; status: Status; created: Date }> = [];
    const staffName = (branchId: string) => staffByBranch[branchId].manager;

    for (const plan of plans) {
      const branch = plan.branch;
      const isLive = plan.created.getTime() > now.getTime() - 100 * 60_000 || Boolean(plan.scheduled);
      let customer = pickCustomer();
      // Keep each live customer to a single in-flight order so the board reads naturally.
      if (isLive) {
        let guard = 0;
        while (liveCustomers.has(customer.id) && guard++ < 50) customer = pickCustomer();
        liveCustomers.add(customer.id);
      }
      const menuId = pick(branch.menuIds.length ? branch.menuIds : [items[0].menuId]);
      const pool = items.filter((i) => i.menuId === menuId);
      const fulfilment: "delivery" | "pickup" = plan.forceFulfilment ?? (plan.status === "out_for_delivery" ? "delivery" : chance(0.68) ? "delivery" : "pickup");
      const method: "paystack" | "transfer" = plan.forceMethod ?? (chance(0.62) ? "paystack" : "transfer");

      // Lines
      const lines: Row[] = [];
      let subtotal = 0;
      const lineCount = weighted<number>([[1, 3], [2, 5], [3, 3], [4, 1]]);
      const chosen = new Set<string>();
      for (let l = 0; l < lineCount; l++) {
        const item = pick(pool);
        if (chosen.has(item.id)) continue;
        chosen.add(item.id);
        const selected: Array<{ optionId: string; groupId: string; groupName: string; name: string; priceDelta: number }> = [];
        for (const g of item.groups) {
          if (g.options.length === 0) continue;
          const count = g.min === g.max ? g.min : Math.min(g.options.length, int(g.min, Math.min(g.max, g.min + 2)));
          const opts = [...g.options].sort(() => rand() - 0.5).slice(0, Math.max(count, g.min));
          for (const o of opts) selected.push({ optionId: o.id, groupId: g.id, groupName: g.name, name: o.name, priceDelta: o.delta });
        }
        const unit = item.base + selected.reduce((s, o) => s + o.priceDelta, 0);
        const qty = weighted<number>([[1, 6], [2, 3], [3, 1]]);
        subtotal += unit * qty;
        lines.push({ item_id: item.id, item_name: item.name, category_name: item.category, quantity: qty, unit_price: unit, line_total: unit * qty, note: chance(0.12) ? pick(LINE_NOTES) : null, options: JSON.stringify(selected) });
      }

      // Money
      let deliveryFee = 0;
      let address: Row | null = null;
      if (fulfilment === "delivery") {
        const a = pick(customer.addresses);
        address = { line: a.line, lat: a.lat, lng: a.lng, instructions: a.instructions };
        const km = Math.hypot((a.lat - branch.lat) * 111, (a.lng - branch.lng) * 111);
        deliveryFee = km <= 3 ? (subtotal >= K(15000) ? 0 : K(800)) : K(1500);
      }
      let promo: string | null = null;
      let discount = 0;
      if (chance(0.22)) {
        const candidates = Object.entries(promoDefs).filter(([code, p]) => subtotal >= p.minSpend && (code !== "WEEKEND15" || [0, 5, 6].includes(plan.created.getUTCDay())) && (code !== "LAGOS1000" || branch.city === "Lagos"));
        if (candidates.length) {
          const [code, def] = pick(candidates);
          promo = code;
          discount = def.type === "percent" ? Math.floor((subtotal * def.value) / 100) : Math.min(def.value, subtotal);
        }
      }
      const total = subtotal + deliveryFee - discount;

      // Timeline
      const events: Array<{ from: Status | null; to: Status; at: Date; actor: "staff" | "customer" | "system"; note?: string }> = [];
      let t = plan.created;
      let cur = "pending_payment" as Status; // mutated inside step(), so keep the wide type
      events.push({ from: null, to: "pending_payment", at: t, actor: "customer" });
      const step = (to: Status, minutes: number, actor: "staff" | "customer" | "system", note?: string) => {
        t = addMin(t, minutes);
        events.push({ from: cur, to, at: t, actor, note });
        cur = to;
      };
      const failed = plan.status === "cancelled" && (plan.cancelReason === "Payment window expired" || (method === "paystack" && chance(0.4)) || chance(0.5));
      if (plan.status === "pending_payment") {
        // stays here
      } else if (plan.status === "cancelled" && failed) {
        if (method === "transfer" && chance(0.5)) step("awaiting_confirmation", int(3, 12), "customer");
        step("cancelled", plan.cancelReason === "Payment window expired" ? 30 : int(5, 40), plan.cancelledBy ?? (chance(0.5) ? "customer" : "system"), plan.cancelReason ?? (plan.cancelledBy === "staff" ? pick(CANCEL_STAFF) : "Payment not completed"));
      } else {
        if (method === "transfer") step("awaiting_confirmation", int(3, 10), "customer");
        if (plan.status !== "awaiting_confirmation") {
          step("paid", method === "transfer" ? int(4, 20) : int(1, 3), method === "transfer" ? "staff" : "system");
          if (plan.status !== "paid") {
            if (plan.status === "cancelled") step("cancelled", int(5, 20), "staff", pick(CANCEL_STAFF));
            else {
              step("accepted", int(1, 4), "staff");
              if (plan.status !== "accepted") {
                step("preparing", int(1, 3), "staff");
                if (plan.status !== "preparing") {
                  step("ready", int(12, 26), "staff");
                  if (plan.status !== "ready") {
                    if (fulfilment === "delivery" && (plan.status === "out_for_delivery" || plan.status === "completed" || plan.status === "refunded")) step("out_for_delivery", int(2, 7), "staff");
                    if (plan.status === "completed" || plan.status === "refunded") step("completed", fulfilment === "delivery" ? int(12, 40) : int(2, 25), "staff");
                    if (plan.status === "refunded") step("refunded", int(60, 60 * 30), "staff", pick(["Order arrived cold", "Wrong items delivered", "Item missing from the bag", "Customer complaint"]));
                  }
                }
              }
            }
          }
        }
      }
      const finalStatus = cur;
      const at = (s: Status) => events.find((e) => e.to === s)?.at ?? null;
      const rider = fulfilment === "delivery" && ["out_for_delivery", "completed", "refunded"].includes(finalStatus) ? pick(staffByBranch[branch.id].riders) : null;
      const cancelEvent = events.find((e) => e.to === "cancelled");
      const refundEvent = events.find((e) => e.to === "refunded");
      sequence += 1;
      const number = `${prefix}-${String(sequence).padStart(6, "0")}`;
      const order = await insert(tq, "orders", {
        organization_id: org, branch_id: branch.id, menu_id: menuId, customer_id: customer.id, number, fulfilment,
        scheduled_for: plan.scheduled ?? null, delivery_address: address, customer_phone: customer.phone, customer_name: customer.name, customer_email: customer.email,
        subtotal, delivery_fee: deliveryFee, discount, promo_code: promo, total, status: finalStatus, payment_method: method,
        paid_at: at("paid"), accepted_at: at("accepted"), ready_at: at("ready"), completed_at: at("completed"), cancelled_at: cancelEvent?.at ?? null, cancel_reason: cancelEvent?.note ?? null,
        refunded_at: refundEvent?.at ?? null, refund_note: refundEvent?.note ?? null, rider_id: rider?.id ?? null, note: chance(0.15) ? pick(NOTES) : null,
        expires_at: finalStatus === "pending_payment" ? addMin(plan.created, 30) : finalStatus === "awaiting_confirmation" ? addMin(plan.created, 45) : null,
        created_at: plan.created, updated_at: t,
      }, true);
      for (const line of lines) await insert(tq, "order_lines", { ...line, order_id: order.id });
      for (const e of events) {
        const actorStaff = e.actor === "staff" ? (e.to === "out_for_delivery" && rider ? rider : staffName(branch.id)) : null;
        await insert(tq, "order_status_events", {
          order_id: order.id, organization_id: org, from_status: e.from, to_status: e.to, actor_type: e.actor,
          actor_id: e.actor === "staff" ? actorStaff!.id : e.actor === "customer" ? customer.id : null,
          actor_name: e.actor === "staff" ? actorStaff!.name : e.actor === "customer" ? customer.name : "System", note: e.note ?? null, created_at: e.at,
        });
      }

      // Payment row
      const paidEvent = events.find((e) => e.to === "paid");
      let payStatus: string = "pending";
      if (finalStatus === "refunded") payStatus = "refunded";
      else if (paidEvent) payStatus = "paid";
      else if (finalStatus === "awaiting_confirmation") payStatus = "claimed";
      else if (finalStatus === "cancelled") payStatus = plan.cancelReason === "Payment window expired" ? "expired" : method === "paystack" ? "failed" : chance(0.5) ? "rejected" : "expired";
      const claimed = events.find((e) => e.to === "awaiting_confirmation");
      await insert(tq, "payments", {
        organization_id: org, order_id: order.id, method, amount: total, reference: `${method === "paystack" ? "PSK" : "TRF"}_${number}_${int(100000, 999999)}`, status: payStatus,
        authorization_url: method === "paystack" && payStatus === "pending" ? `https://checkout.paystack.com/demo-${number}` : null,
        channel: method === "paystack" && paidEvent ? pick(["card", "card", "bank", "ussd", "bank_transfer"]) : null,
        proof_url: claimed ? "https://placehold.co/600x800/png?text=Transfer+receipt" : null,
        claim_note: claimed ? pick(["Sent from GTBank", "Paid via Opay", "Transfer done, sender Zenith", "Paid with Kuda"]) : null, claimed_at: claimed?.at ?? null,
        expires_at: payStatus === "pending" || payStatus === "claimed" ? addMin(plan.created, 45) : null, paid_at: paidEvent?.at ?? null,
        confirmed_by_id: method === "transfer" && paidEvent ? staffName(branch.id).id : null, confirmed_at: method === "transfer" ? (paidEvent?.at ?? null) : null,
        rejected_by_id: payStatus === "rejected" ? staffName(branch.id).id : null, rejected_at: payStatus === "rejected" ? t : null, reject_reason: payStatus === "rejected" ? "Payment not received in our account" : null,
        refunded_at: refundEvent?.at ?? null, refund_amount: refundEvent ? total : null, refund_reference: refundEvent ? `RFD_${number}` : null,
        created_at: plan.created, updated_at: t,
      });

      if (promo && !["cancelled"].includes(finalStatus)) used[promo] = (used[promo] ?? 0) + 1;
      if (["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"].includes(finalStatus)) {
        const s = (spend[customer.id] ??= { count: 0, total: 0, last: null });
        s.count += 1;
        s.total += total;
        if (!s.last || plan.created > s.last) s.last = plan.created;
      }
      if (isLive && finalStatus !== "cancelled") orderIdsForChat.push({ id: order.id, branchId: branch.id, customerId: customer.id, status: finalStatus, created: plan.created });
    }

    // Roll customer + promo + counter totals up from what we just created.
    for (const [id, s] of Object.entries(spend)) await tq(`UPDATE customers SET order_count = $2, total_spend = $3, last_order_at = $4 WHERE id = $1`, [id, s.count, s.total, s.last]);
    for (const [code, n] of Object.entries(used)) await tq(`UPDATE promo_codes SET used_count = used_count + $3 WHERE organization_id = $1 AND code = $2`, [org, code, n]);
    await tq(`INSERT INTO counters (organization_id, key, value) VALUES ($1, 'order', $2) ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`, [org, sequence]);

    // Chat threads on the live orders (message bodies live in Firestore, so only the conversation rows are seeded).
    for (const o of orderIdsForChat.slice(0, 10)) {
      const fromCustomer = chance(0.6);
      await insert(tq, "chat_conversations", {
        organization_id: org, branch_id: o.branchId, order_id: o.id, customer_id: o.customerId, last_message_at: addMin(o.created, int(2, 15)),
        last_message_preview: fromCustomer ? pick(["How long until it's ready?", "Please add extra pepper", "I'm outside", "Can I change my address?"]) : pick(["Your order is being prepared", "Rider is on the way", "Thanks! See you shortly"]),
        last_sender_type: fromCustomer ? "customer" : "staff", staff_unread: fromCustomer ? int(1, 3) : 0, customer_unread: fromCustomer ? 0 : 1, created_at: o.created,
      });
    }

    // ── Operational states worth testing ───────────────────────────────────────
    const soldOutAt = (branchName: string, itemName: string, restoreHours: number | null) => {
      const b = branches.find((x) => x.name === branchName);
      const it = items.find((x) => x.name === itemName);
      if (!b || !it) return Promise.resolve();
      return insert(tq, "availability", { organization_id: org, branch_id: b.id, item_id: it.id, restore_at: restoreHours ? addMin(now, restoreHours * 60) : null, updated_by_id: staffByBranch[b.id].manager.id }).catch(() => undefined);
    };
    await soldOutAt("Lekki Phase 1", "Very Berry", 3);
    await soldOutAt("Lekki Phase 1", "Beef shawarma", null);
    await soldOutAt("Victoria Island", "Imperial", 26);
    await soldOutAt("Ikeja GRA", "Chicken salad", 5);
    await soldOutAt("Yaba", "Mixed grill shawarma", null);
    // One salad ingredient sold out, so the builder shows a single unavailable option.
    const avocado = (await tq(`SELECT o.id FROM options o JOIN option_groups g ON g.id = o.group_id WHERE o.organization_id = $1 AND g.name = 'Cravings' AND o.name = 'Avocado' AND o.deleted_at IS NULL LIMIT 1`, [org]))[0];
    const yaba = branches.find((x) => x.name === "Yaba");
    if (avocado && yaba) await insert(tq, "availability", { organization_id: org, branch_id: yaba.id, option_id: avocado.id, restore_at: null, updated_by_id: staffByBranch[yaba.id].manager.id }).catch(() => undefined);

    const surulere = branches.find((b) => b.name === "Surulere");
    if (surulere) await tq(`UPDATE branches SET is_paused = true, pause_reason = 'Power outage — back shortly' WHERE id = $1`, [surulere.id]);
    const maitama = branches.find((b) => b.name === "Maitama");
    if (maitama) await insert(tq, "holiday_closures", { branch_id: maitama.id, date: addMin(now, 60 * 24 * 9).toISOString().slice(0, 10), reason: "Staff retreat" }).catch(() => undefined);

    // A few audit entries so the activity log isn't empty.
    for (let i = 0; i < 25; i++) {
      const b = pickBranch();
      const m = staffByBranch[b.id].manager;
      const entry = pick<[string, string, string]>([
        ["update", "item", "Changed the price of an item"], ["toggle", "availability", "Marked an item as sold out"], ["create", "promo", "Created a promo code"],
        ["update", "branch", "Updated branch opening hours"], ["login", "user", "Signed in"],
      ]);
      await insert(tq, "audit_logs", { organization_id: org, branch_id: b.id, user_id: m.id, user_name: m.name, action: entry[0], entity_type: entry[1], summary: entry[2], created_at: addMin(now, -int(10, 60 * 24 * 30)) });
    }
    void ownerRow;

    console.log(`Seeded ${plans.length} orders, ${customers.length} customers and ${branches.length * 4 + 2} staff accounts.`);
    console.log(`  live board: ${live.reduce((s, l) => s + l[1], 0)} in-flight orders + 7 scheduled`);
  });

  console.log("Staff logins (password Password123): manager.<branch>@kiros.test, kitchen.<branch>@kiros.test, rider.<branch>@kiros.test, ops@kiros.test");
  console.log("  e.g. manager.lekkiphase1@kiros.test");
  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error(err);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
