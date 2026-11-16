import { db, type Tx } from "../../../infrastructure/database/transaction";
import { PasswordResetEntity, type PasswordReset } from "../entities/passwordReset.entity";

export class PasswordResetRepository {
  static Instance = new PasswordResetRepository();
  private constructor() {}

  async create(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
    // One live code per user: a new request replaces the previous one.
    await db().query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [userId]);
    await db().getRepository(PasswordResetEntity).insert({ userId, codeHash, expiresAt, attempts: 0, usedAt: null });
  }

  async countRecent(userId: string, minutes: number): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(
      `SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
      [userId, String(minutes)]
    );
    return rows[0]?.n ?? 0;
  }

  async activeForUpdate(userId: string, tx: Tx): Promise<PasswordReset | null> {
    return tx
      .getRepository(PasswordResetEntity)
      .createQueryBuilder("r")
      .setLock("pessimistic_write")
      .where("r.userId = :userId AND r.usedAt IS NULL AND r.expiresAt > now()", { userId })
      .orderBy("r.createdAt", "DESC")
      .getOne();
  }

  async addAttempt(id: string, tx: Tx): Promise<void> {
    await tx.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1`, [id]);
  }

  async markUsed(id: string, tx: Tx): Promise<void> {
    await tx.getRepository(PasswordResetEntity).update({ id }, { usedAt: new Date() });
  }
}
