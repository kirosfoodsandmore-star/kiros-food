import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The branch a first-time visitor sees on the storefront, chosen by the admin in Settings. NULL means automatic
 * (the first open branch). Deleting a branch row clears it; the services also clear it when a branch is
 * soft-deleted or deactivated, and the storefront ignores a default that is not offered any more.
 */
export class DefaultBranch1794500000004 implements MigrationInterface {
  name = "DefaultBranch1794500000004";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organizations" ADD COLUMN "default_branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organizations" DROP COLUMN "default_branch_id"`);
  }
}
