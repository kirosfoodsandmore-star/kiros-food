import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * "Goes well with": the categories an item's page should recommend from (a salad → Smoothies and Juices). Empty means
 * "no preference", and the storefront falls back to favourites from other categories.
 */
export class ItemGoesWellWith1794500000011 implements MigrationInterface {
  name = "ItemGoesWellWith1794500000011";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "items" ADD COLUMN "pairs_with_category_ids" uuid[] NOT NULL DEFAULT '{}'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "items" DROP COLUMN "pairs_with_category_ids"`);
  }
}
