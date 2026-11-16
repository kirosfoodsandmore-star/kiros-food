import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Riders switch themselves on and off duty. Only on-duty riders can be given a delivery. Defaults to true so
 * existing riders keep working exactly as before until they choose to switch off.
 */
export class RiderOnDuty1794500000005 implements MigrationInterface {
  name = "RiderOnDuty1794500000005";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "on_duty" boolean NOT NULL DEFAULT true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN "on_duty"`);
  }
}
