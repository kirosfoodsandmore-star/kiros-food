import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Optional customer accounts by email. Customers can already check out as guests; this adds a way to sign up
 * (or sign in) with a code emailed to them, without a password or an SMS provider.
 *
 *  - customers.email_verified_at: set once the emailed code was entered. A customer with neither a Firebase
 *    uid nor a verified email is a guest.
 *  - customer_email_codes: one row per emailed code. Only the keyed hash is stored; 5 attempts, short expiry.
 */
export class CustomerEmailAuth1794500000003 implements MigrationInterface {
  name = "CustomerEmailAuth1794500000003";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "customers" ADD COLUMN "email_verified_at" timestamptz`);
    await q.query(`CREATE TABLE "customer_email_codes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "email" varchar(160) NOT NULL,
      "code_hash" varchar(64) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "attempts" int NOT NULL DEFAULT 0,
      "used_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_customer_email_codes" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_customer_email_codes_lookup" ON "customer_email_codes" ("organization_id", "email", "created_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "customer_email_codes"`);
    await q.query(`ALTER TABLE "customers" DROP COLUMN "email_verified_at"`);
  }
}
