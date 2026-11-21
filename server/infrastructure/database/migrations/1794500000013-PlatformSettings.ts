import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Settings that belong to the whole platform rather than to one restaurant, changed by the platform admins.
 *  - platform_settings: one row per setting (key → JSON value), with who last changed it. A missing row means the setting's
 *    default, so the table starts empty and nothing about today's behaviour changes.
 * First setting: skipEmailWhenPushDelivered (see modules/platform/services/platformSettings.service.ts).
 */
export class PlatformSettings1794500000013 implements MigrationInterface {
  name = "PlatformSettings1794500000013";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "platform_settings" (
      "key" varchar(60) NOT NULL,
      "value" jsonb NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "updated_by" varchar(160),
      CONSTRAINT "PK_platform_settings" PRIMARY KEY ("key")
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "platform_settings"`);
  }
}
