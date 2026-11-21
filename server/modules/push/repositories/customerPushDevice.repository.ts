import { db } from "../../../infrastructure/database/transaction";

/** Customers' browsers and phones that turned reply alerts on, one row per FCM token. */
export class CustomerPushDeviceRepository {
  static Instance = new CustomerPushDeviceRepository();
  private constructor() {}

  /** A token belongs to whoever registered it last: a phone handed to someone else stops alerting the first customer. */
  async upsert(organizationId: string, customerId: string, token: string, userAgent: string | null): Promise<void> {
    await db().query(
      `INSERT INTO customer_push_devices (organization_id, customer_id, token, user_agent) VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET organization_id = EXCLUDED.organization_id, customer_id = EXCLUDED.customer_id, user_agent = EXCLUDED.user_agent, last_seen_at = now()`,
      [organizationId, customerId, token, userAgent]
    );
  }

  async remove(customerId: string, token: string): Promise<void> {
    await db().query(`DELETE FROM customer_push_devices WHERE customer_id = $1 AND token = $2`, [customerId, token]);
  }

  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await db().query(`DELETE FROM customer_push_devices WHERE token = ANY($1::text[])`, [tokens]);
  }

  async tokensForCustomers(customerIds: string[]): Promise<string[]> {
    if (customerIds.length === 0) return [];
    const rows: Array<{ token: string }> = await db().query(`SELECT token FROM customer_push_devices WHERE customer_id = ANY($1::uuid[])`, [customerIds]);
    return rows.map((r) => r.token);
  }
}
