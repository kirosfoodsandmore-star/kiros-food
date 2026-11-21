import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Customers can turn on reply alerts for an order's chat (web push through Firebase Cloud Messaging).
 *  - customer_push_devices: one row per browser/phone, keyed by its FCM token. Like push_devices for staff, but tied to a
 *    customer, so a staff reply can reach the customer who is not looking at the site. A new table, so nothing that
 *    exists today changes.
 */
export class CustomerPushDevices1794500000012 implements MigrationInterface {
  name = "CustomerPushDevices1794500000012";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "customer_push_devices" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
      "token" text NOT NULL,
      "user_agent" varchar(255),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "last_seen_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_customer_push_devices" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_customer_push_devices_token" UNIQUE ("token")
    )`);
    await q.query(`CREATE INDEX "IDX_customer_push_devices_customer" ON "customer_push_devices" ("customer_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "customer_push_devices"`);
  }
}
