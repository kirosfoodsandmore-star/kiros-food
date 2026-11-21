import { db } from "../../../infrastructure/database/transaction";

/** Browsers and phones that turned notifications on, one row per FCM token. */
export class PushDeviceRepository {
  static Instance = new PushDeviceRepository();
  private constructor() {}

  /** A token belongs to whoever registered it last: a phone handed to another rider stops notifying the first. */
  async upsert(organizationId: string, userId: string, token: string, userAgent: string | null): Promise<void> {
    await db().query(
      `INSERT INTO push_devices (organization_id, user_id, token, user_agent) VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET organization_id = EXCLUDED.organization_id, user_id = EXCLUDED.user_id, user_agent = EXCLUDED.user_agent, last_seen_at = now()`,
      [organizationId, userId, token, userAgent]
    );
  }

  async remove(userId: string, token: string): Promise<void> {
    await db().query(`DELETE FROM push_devices WHERE user_id = $1 AND token = $2`, [userId, token]);
  }

  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await db().query(`DELETE FROM push_devices WHERE token = ANY($1::text[])`, [tokens]);
  }

  /** Each device with the staff member it belongs to, so a send can report who it reached. */
  async devicesForUsers(userIds: string[]): Promise<Array<{ owner: string; token: string }>> {
    if (userIds.length === 0) return [];
    return db().query(`SELECT user_id AS owner, token FROM push_devices WHERE user_id = ANY($1::uuid[])`, [userIds]);
  }

  async countForUser(userId: string): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(`SELECT COUNT(*)::int AS n FROM push_devices WHERE user_id = $1`, [userId]);
    return rows[0]?.n ?? 0;
  }
}
