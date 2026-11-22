import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The business's own books, alongside the storefront's orders.
 *  - finance_entries: one row per money movement the app doesn't see: capital put in (owners, investors, loans,
 *    the opening balance from before the app), expenses (ingredients, rent, salaries, equipment…), income earned
 *    off-app (walk-in sales, catering) and money taken out (drawings, loan repayments). Dated by the day it
 *    happened, so history from before the app can be back-filled. branch_id null = the whole business.
 *    Category keys come from modules/finance/catalog/finance.catalog.ts. Soft-deleted.
 *  - finance_budgets: a monthly budget per expense category, for budget-vs-actual.
 */
export class FinanceLedger1794500000015 implements MigrationInterface {
  name = "FinanceLedger1794500000015";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "finance_entries" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
      "kind" varchar(12) NOT NULL,
      "category" varchar(30) NOT NULL,
      "title" varchar(160) NOT NULL,
      "amount" bigint NOT NULL,
      "entry_date" date NOT NULL,
      "payment_method" varchar(12),
      "party" varchar(160),
      "reference" varchar(80),
      "notes" text,
      "created_by" uuid,
      "created_by_name" varchar(120),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_finance_entries" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_finance_entries_kind" CHECK ("kind" IN ('capital', 'expense', 'income', 'withdrawal')),
      CONSTRAINT "CHK_finance_entries_amount" CHECK ("amount" > 0)
    )`);
    await q.query(`CREATE INDEX "IDX_finance_entries_org_date" ON "finance_entries" ("organization_id", "entry_date" DESC) WHERE "deleted_at" IS NULL`);
    await q.query(`CREATE INDEX "IDX_finance_entries_org_kind" ON "finance_entries" ("organization_id", "kind", "entry_date") WHERE "deleted_at" IS NULL`);

    await q.query(`CREATE TABLE "finance_budgets" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "category" varchar(30) NOT NULL,
      "monthly_amount" bigint NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_finance_budgets" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_finance_budgets_org_category" UNIQUE ("organization_id", "category"),
      CONSTRAINT "CHK_finance_budgets_amount" CHECK ("monthly_amount" > 0)
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "finance_budgets"`);
    await q.query(`DROP TABLE "finance_entries"`);
  }
}
