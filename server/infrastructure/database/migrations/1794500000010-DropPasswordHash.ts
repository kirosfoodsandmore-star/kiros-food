import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Passwords now live only in Firebase Authentication, so `users.password_hash` goes. Accounts that were still on a
 * bcrypt hash (never signed in since Firebase was switched on) lose it here: they set a new password with
 * "Forgot password" or sign in with Google. Accounts already on Firebase hold only the "firebase:managed" marker.
 */
export class DropPasswordHash1794500000010 implements MigrationInterface {
  name = "DropPasswordHash1794500000010";

  public async up(q: QueryRunner): Promise<void> {
    const legacy: Array<{ n: string }> = await q.query(`SELECT count(*)::text AS n FROM "users" WHERE "password_hash" <> 'firebase:managed' AND "deleted_at" IS NULL`);
    if (Number(legacy[0]?.n ?? 0) > 0) {
      console.warn(`[migration] ${legacy[0].n} staff account(s) still had a local password hash; they must use "Forgot password" or Google to sign in.`);
    }
    await q.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "password_hash" varchar(100) NOT NULL DEFAULT 'firebase:managed'`);
    await q.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT`);
  }
}
