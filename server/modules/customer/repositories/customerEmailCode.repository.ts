import { db, type Tx } from "../../../infrastructure/database/transaction";
import { CustomerEmailCodeEntity, type CustomerEmailCode } from "../entities/customerEmailCode.entity";

export class CustomerEmailCodeRepository {
  static Instance = new CustomerEmailCodeRepository();
  private constructor() {}

  async create(organizationId: string, email: string, codeHash: string, expiresAt: Date): Promise<void> {
    // One live code per address: a new request replaces the previous one.
    await db().query(`UPDATE customer_email_codes SET used_at = now() WHERE organization_id = $1 AND email = $2 AND used_at IS NULL`, [organizationId, email]);
    await db().getRepository(CustomerEmailCodeEntity).insert({ organizationId, email, codeHash, expiresAt, attempts: 0, usedAt: null });
  }

  async countRecent(organizationId: string, email: string, minutes: number): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(
      `SELECT COUNT(*)::int AS n FROM customer_email_codes WHERE organization_id = $1 AND email = $2 AND created_at > now() - ($3 || ' minutes')::interval`,
      [organizationId, email, String(minutes)]
    );
    return rows[0]?.n ?? 0;
  }

  async activeForUpdate(organizationId: string, email: string, tx: Tx): Promise<CustomerEmailCode | null> {
    return tx
      .getRepository(CustomerEmailCodeEntity)
      .createQueryBuilder("c")
      .setLock("pessimistic_write")
      .where("c.organizationId = :organizationId AND c.email = :email AND c.usedAt IS NULL AND c.expiresAt > now()", { organizationId, email })
      .orderBy("c.createdAt", "DESC")
      .getOne();
  }

  async addAttempt(id: string, tx: Tx): Promise<void> {
    await tx.query(`UPDATE customer_email_codes SET attempts = attempts + 1 WHERE id = $1`, [id]);
  }

  async markUsed(id: string, tx: Tx): Promise<void> {
    await tx.getRepository(CustomerEmailCodeEntity).update({ id }, { usedAt: new Date() });
  }
}
