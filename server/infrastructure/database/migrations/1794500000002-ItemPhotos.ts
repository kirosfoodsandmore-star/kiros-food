import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Several photos per item. `photos` is an ordered list of { id, url, publicId }; the first one is the cover and
 * is mirrored into the existing `image_url` / `image_public_id` columns, so everything that already reads those
 * (storefront cards, carts, orders) keeps working untouched. Existing single photos are carried over as the cover.
 */
export class ItemPhotos1794500000002 implements MigrationInterface {
  name = "ItemPhotos1794500000002";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "items" ADD COLUMN "photos" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await q.query(`UPDATE "items"
      SET "photos" = jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'url', "image_url", 'publicId', "image_public_id"))
      WHERE "image_url" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // The cover stays in image_url, so going back loses only the extra photos' records.
    await q.query(`ALTER TABLE "items" DROP COLUMN "photos"`);
  }
}
