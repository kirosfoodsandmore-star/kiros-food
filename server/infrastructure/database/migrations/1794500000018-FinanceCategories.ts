import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Finance categories move out of the code and into the database, one list per restaurant, so owners can add their own,
 * rename them, move expenses between cost of sales / running costs / assets, and hide the ones they never use.
 *  - finance_categories: key (the short code stored on entries and budgets: never changes), label, kind (fixed once
 *    created), expense_group (expenses only), is_sale (income only: counts as a sale in Sales reports and the Dashboard),
 *    is_builtin (came with the app: can be renamed or hidden, never deleted), is_active (hidden = not offered for new
 *    entries; old entries keep showing it) and sort_order.
 *  - Seeded here for every restaurant that already exists with the 28 categories that were built in, using the same keys,
 *    so every existing entry and budget keeps pointing at the right category. A restaurant created later gets the same
 *    list the first time it opens finance (see modules/finance/services/category.service.ts).
 * The list below is a deliberate copy of DEFAULT_FINANCE_CATEGORIES as it was today: a migration must not change when the
 * app's defaults do.
 */
const DEFAULTS: Array<[key: string, kind: string, label: string, group: string | null, isSale: boolean]> = [
  ["owner_investment", "capital", "Owner's investment", null, false],
  ["investor", "capital", "Investor / partner", null, false],
  ["loan", "capital", "Loan received", null, false],
  ["grant", "capital", "Grant", null, false],
  ["opening_balance", "capital", "Opening balance", null, false],
  ["ingredients", "expense", "Ingredients & stock", "cost_of_sales", false],
  ["packaging", "expense", "Packaging", "cost_of_sales", false],
  ["salaries", "expense", "Salaries & wages", "operating", false],
  ["rent", "expense", "Rent", "operating", false],
  ["utilities", "expense", "Electricity & water", "operating", false],
  ["fuel", "expense", "Fuel, gas & diesel", "operating", false],
  ["logistics", "expense", "Delivery & transport", "operating", false],
  ["marketing", "expense", "Marketing & promotion", "operating", false],
  ["maintenance", "expense", "Repairs & maintenance", "operating", false],
  ["fees", "expense", "Bank, POS & payment fees", "operating", false],
  ["licences", "expense", "Licences, permits & tax", "operating", false],
  ["software", "expense", "Software & subscriptions", "operating", false],
  ["cleaning", "expense", "Cleaning & supplies", "operating", false],
  ["other_expense", "expense", "Other running cost", "operating", false],
  ["equipment", "expense", "Equipment & tools", "capex", false],
  ["fitout", "expense", "Renovation & fit-out", "capex", false],
  ["vehicle", "expense", "Vehicles & bikes", "capex", false],
  ["offline_sales", "income", "Walk-in / offline sales", null, true],
  ["catering", "income", "Catering & events", null, true],
  ["other_income", "income", "Other income", null, false],
  ["drawings", "withdrawal", "Owner's drawings", null, false],
  ["loan_repayment", "withdrawal", "Loan repayment", null, false],
  ["dividend", "withdrawal", "Dividend / profit share", null, false],
];

export class FinanceCategories1794500000018 implements MigrationInterface {
  name = "FinanceCategories1794500000018";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "finance_categories" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "key" varchar(30) NOT NULL,
      "label" varchar(80) NOT NULL,
      "kind" varchar(12) NOT NULL,
      "expense_group" varchar(20),
      "is_sale" boolean NOT NULL DEFAULT false,
      "is_builtin" boolean NOT NULL DEFAULT false,
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" int NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_finance_categories" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_finance_categories_org_key" UNIQUE ("organization_id", "key"),
      CONSTRAINT "CHK_finance_categories_kind" CHECK ("kind" IN ('capital', 'expense', 'income', 'withdrawal')),
      CONSTRAINT "CHK_finance_categories_group" CHECK (("kind" = 'expense' AND "expense_group" IN ('cost_of_sales', 'operating', 'capex')) OR ("kind" <> 'expense' AND "expense_group" IS NULL)),
      CONSTRAINT "CHK_finance_categories_sale" CHECK ("is_sale" = false OR "kind" = 'income')
    )`);
    await q.query(`CREATE INDEX "IDX_finance_categories_org" ON "finance_categories" ("organization_id", "sort_order")`);

    const values = DEFAULTS.map((d, i) => `(${[d[0], d[1], d[2], d[3]].map((v) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`)).join(", ")}, ${d[4]}, ${i + 1})`).join(",\n      ");
    await q.query(`INSERT INTO "finance_categories" ("organization_id", "key", "label", "kind", "expense_group", "is_sale", "is_builtin", "is_active", "sort_order")
      SELECT o.id, d.key, d.label, d.kind, d.grp, d.is_sale, true, true, d.sort_order
      FROM "organizations" o
      CROSS JOIN (VALUES
      ${values}
      ) AS d(key, kind, label, grp, is_sale, sort_order)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "finance_categories"`);
  }
}
