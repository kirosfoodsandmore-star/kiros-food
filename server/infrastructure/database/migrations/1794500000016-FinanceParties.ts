import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Saved vendors & customers, and entries split between several of them.
 *  - finance_parties: everyone the business pays or is paid by (vendors, customers, investors, lenders), one row per
 *    name (case-insensitive) per restaurant.
 *  - finance_entry_parties: who an entry was paid to or received from, with each one's share. An entry's amount is
 *    the sum of its lines. finance_entries.party stays as the readable list of names (search, older clients).
 * Backfill: every distinct name already typed into finance_entries.party becomes a saved party, and each such entry
 * gets one line for its full amount, so existing books carry straight over.
 */
export class FinanceParties1794500000016 implements MigrationInterface {
  name = "FinanceParties1794500000016";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "finance_parties" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" varchar(160) NOT NULL,
      "phone" varchar(40),
      "notes" varchar(500),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "PK_finance_parties" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_finance_parties_org_name" ON "finance_parties" ("organization_id", lower("name")) WHERE "deleted_at" IS NULL`);

    await q.query(`CREATE TABLE "finance_entry_parties" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "entry_id" uuid NOT NULL REFERENCES "finance_entries"("id") ON DELETE CASCADE,
      "party_id" uuid NOT NULL REFERENCES "finance_parties"("id") ON DELETE RESTRICT,
      "amount" bigint NOT NULL,
      "sort_order" int NOT NULL DEFAULT 0,
      CONSTRAINT "PK_finance_entry_parties" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_finance_entry_parties_amount" CHECK ("amount" > 0)
    )`);
    await q.query(`CREATE INDEX "IDX_finance_entry_parties_entry" ON "finance_entry_parties" ("entry_id")`);
    await q.query(`CREATE INDEX "IDX_finance_entry_parties_party" ON "finance_entry_parties" ("party_id")`);

    // Backfill from the free-text names already recorded (soft-deleted entries included, so a restore stays consistent).
    await q.query(`INSERT INTO "finance_parties" ("organization_id", "name")
      SELECT DISTINCT ON (e.organization_id, lower(trim(e.party))) e.organization_id, trim(e.party)
      FROM "finance_entries" e
      WHERE e.party IS NOT NULL AND trim(e.party) <> ''
      ORDER BY e.organization_id, lower(trim(e.party)), e.created_at`);
    await q.query(`INSERT INTO "finance_entry_parties" ("entry_id", "party_id", "amount")
      SELECT e.id, p.id, e.amount
      FROM "finance_entries" e
      JOIN "finance_parties" p ON p.organization_id = e.organization_id AND lower(p.name) = lower(trim(e.party)) AND p.deleted_at IS NULL
      WHERE e.party IS NOT NULL AND trim(e.party) <> ''`);
    // Show the saved spelling everywhere ("  mile 12 MARKET " → "Mile 12 market"); blank names become NULL.
    await q.query(`UPDATE "finance_entries" e SET "party" = p.name
      FROM "finance_entry_parties" l JOIN "finance_parties" p ON p.id = l.party_id
      WHERE l.entry_id = e.id AND e.party IS DISTINCT FROM p.name`);
    await q.query(`UPDATE "finance_entries" SET "party" = NULL WHERE "party" IS NOT NULL AND trim("party") = ''`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "finance_entry_parties"`);
    await q.query(`DROP TABLE "finance_parties"`);
  }
}
