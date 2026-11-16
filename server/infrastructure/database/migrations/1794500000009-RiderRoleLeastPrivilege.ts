import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The Rider preset used to include orders.view, which let a rider browse every order (customer names, addresses, items)
 * at their branches. A rider only needs orders.deliver: their own deliveries come from a dedicated endpoint. Only Rider
 * roles that still match the old preset exactly are changed; anything an Owner customised is left alone.
 */
export class RiderRoleLeastPrivilege1794500000009 implements MigrationInterface {
  name = "RiderRoleLeastPrivilege1794500000009";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "roles" SET "permissions" = ARRAY['orders.deliver']::text[]
       WHERE "key" = 'rider' AND "is_preset" = true
         AND (SELECT array_agg(p ORDER BY p) FROM unnest("permissions") AS p) = ARRAY['orders.deliver', 'orders.view']::text[]`
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "roles" SET "permissions" = ARRAY['orders.view', 'orders.deliver']::text[]
       WHERE "key" = 'rider' AND "is_preset" = true AND "permissions" = ARRAY['orders.deliver']::text[]`
    );
  }
}
