import { IsNull } from "typeorm";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { RefreshTokenEntity, type TokenSubject } from "../entities/refreshToken.entity";

export interface RefreshTokenRow {
  id: string;
  subjectType: TokenSubject;
  subjectId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export class RefreshTokenRepository {
  static Instance = new RefreshTokenRepository();
  private constructor() {}

  async create(
    data: { subjectType: TokenSubject; subjectId: string; tokenHash: string; expiresAt: Date; userAgent: string | null; ip: string | null },
    tx?: Tx
  ): Promise<void> {
    await db(tx).getRepository(RefreshTokenEntity).insert(data);
  }

  /** Locks the row so two concurrent refreshes with the same token cannot both succeed. */
  async findByHashForUpdate(tokenHash: string, tx: Tx): Promise<RefreshTokenRow | null> {
    return tx
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder("t")
      .setLock("pessimistic_write")
      .select(["t.id", "t.subjectType", "t.subjectId", "t.expiresAt", "t.revokedAt"])
      .where("t.tokenHash = :tokenHash", { tokenHash })
      .getOne();
  }

  async revoke(id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RefreshTokenEntity).update({ id }, { revokedAt: new Date() });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await db().getRepository(RefreshTokenEntity).update({ tokenHash, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeAllForSubject(subjectType: TokenSubject, subjectId: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RefreshTokenEntity).update({ subjectType, subjectId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async purgeExpired(): Promise<void> {
    await db().query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days'`);
  }
}
