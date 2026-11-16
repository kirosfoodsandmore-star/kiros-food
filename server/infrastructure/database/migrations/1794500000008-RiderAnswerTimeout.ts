import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A delivery a rider doesn't answer is passed on after a few minutes (RIDER_ACCEPT_MINUTES).
 *  - rider_assigned_at: when it was given to the current rider (the answer clock starts here)
 *  - tried_rider_ids: riders who already declined it or let the time run out, so it isn't offered to them again
 */
export class RiderAnswerTimeout1794500000008 implements MigrationInterface {
  name = "RiderAnswerTimeout1794500000008";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "rider_assigned_at" timestamptz, ADD COLUMN "tried_rider_ids" uuid[] NOT NULL DEFAULT '{}'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN "rider_assigned_at", DROP COLUMN "tried_rider_ids"`);
  }
}
