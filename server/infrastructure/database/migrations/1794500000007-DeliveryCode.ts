import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Proof of receipt. When a delivery goes out the customer is given a short code (shown on their order page and in the
 * "on its way" email); the rider has to type it in to mark the order delivered. Wrong guesses are counted so the code
 * can't be brute-forced. NULL on orders that went out before this existed: those can be completed as before.
 */
export class DeliveryCode1794500000007 implements MigrationInterface {
  name = "DeliveryCode1794500000007";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "delivery_code" varchar(6), ADD COLUMN "delivery_code_attempts" integer NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN "delivery_code", DROP COLUMN "delivery_code_attempts"`);
  }
}
