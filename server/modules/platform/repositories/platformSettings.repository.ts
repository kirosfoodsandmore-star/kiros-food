import { db } from "../../../infrastructure/database/transaction";

/** Platform-wide settings, one row per setting. */
export class PlatformSettingsRepository {
  static Instance = new PlatformSettingsRepository();
  private constructor() {}

  async all(): Promise<Record<string, unknown>> {
    const rows: Array<{ key: string; value: unknown }> = await db().query(`SELECT key, value FROM platform_settings`);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: unknown, updatedBy: string): Promise<void> {
    await db().query(
      `INSERT INTO platform_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), updatedBy.slice(0, 160)]
    );
  }
}
