import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Riders accept or decline a delivery they are given, and get push notifications (Firebase Cloud Messaging).
 *  - orders.rider_response: 'pending' until the rider answers, then 'accepted'. NULL on orders assigned before this
 *    existed, which the apps treat as accepted.
 *  - push_devices: one row per browser/phone that turned notifications on, keyed by its FCM token.
 */
export class RiderResponseAndPush1794500000006 implements MigrationInterface {
  name = "RiderResponseAndPush1794500000006";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "rider_response" varchar(10), ADD COLUMN "rider_responded_at" timestamptz`);
    await q.query(`CREATE TABLE "push_devices" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token" text NOT NULL,
      "user_agent" varchar(255),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "last_seen_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_push_devices" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_push_devices_token" UNIQUE ("token")
    )`);
    await q.query(`CREATE INDEX "IDX_push_devices_user" ON "push_devices" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "push_devices"`);
    await q.query(`ALTER TABLE "orders" DROP COLUMN "rider_response", DROP COLUMN "rider_responded_at"`);
  }
}
