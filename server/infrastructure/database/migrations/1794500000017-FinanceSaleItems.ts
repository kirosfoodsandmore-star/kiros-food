import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * What was sold in an offline sale (walk-in, catering), so it can be tracked like app orders.
 *  - finance_entry_items: one row per menu item on a sale: the item (kept even if it's later deleted from the menu,
 *    like order_lines), its name and category as they were, the quantity and the price charged per unit (usually the
 *    menu price, but walk-in discounts are allowed). A sale's amount is the sum of quantity × unit price over its items.
 */
export class FinanceSaleItems1794500000017 implements MigrationInterface {
  name = "FinanceSaleItems1794500000017";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "finance_entry_items" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "entry_id" uuid NOT NULL REFERENCES "finance_entries"("id") ON DELETE CASCADE,
      "item_id" uuid REFERENCES "items"("id") ON DELETE SET NULL,
      "item_name" varchar(160) NOT NULL,
      "category_name" varchar(120),
      "quantity" int NOT NULL,
      "unit_price" bigint NOT NULL,
      "sort_order" int NOT NULL DEFAULT 0,
      CONSTRAINT "PK_finance_entry_items" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_finance_entry_items_qty" CHECK ("quantity" > 0),
      CONSTRAINT "CHK_finance_entry_items_price" CHECK ("unit_price" >= 0)
    )`);
    await q.query(`CREATE INDEX "IDX_finance_entry_items_entry" ON "finance_entry_items" ("entry_id")`);
    await q.query(`CREATE INDEX "IDX_finance_entry_items_item" ON "finance_entry_items" ("item_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "finance_entry_items"`);
  }
}
