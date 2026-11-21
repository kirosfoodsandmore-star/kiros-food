// Platform-wide switches the platform admins control (Platform → Settings). Read often (the notifiers consult them on every
// order), so values are cached briefly. If the settings can't be read (the table isn't there yet, or the database blinked)
// every setting takes its default, which is today's behaviour: the platform never changes how it acts because of a failed read.
import type { Actor } from "../../../shared/types/actor";
import { PlatformSettingsRepository } from "../repositories/platformSettings.repository";

export interface PlatformSettings {
  /**
   * New-order alerts go to staff by push and by email. When on, staff whose devices the push reached are not emailed the
   * same alert; anyone it didn't reach (no device set up, or the send failed) still gets the email.
   */
  skipEmailWhenPushDelivered: boolean;
}

const DEFAULTS: PlatformSettings = { skipEmailWhenPushDelivered: false };
const CACHE_MS = 30_000;

export class PlatformSettingsService {
  static Instance = new PlatformSettingsService();
  private cache: { at: number; value: PlatformSettings } | null = null;
  private warned = false;
  private constructor(private readonly repo = PlatformSettingsRepository.Instance) {}

  async get(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    let value = DEFAULTS;
    try {
      const stored = await this.repo.all();
      value = { skipEmailWhenPushDelivered: typeof stored.skipEmailWhenPushDelivered === "boolean" ? stored.skipEmailWhenPushDelivered : DEFAULTS.skipEmailWhenPushDelivered };
      this.warned = false;
    } catch (err) {
      if (!this.warned) console.warn("[platform] settings could not be read, using defaults:", err instanceof Error ? err.message : err);
      this.warned = true;
    }
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** The caller has already checked that `actor` is a platform admin (see PlatformService). */
  async update(actor: Pick<Actor, "email">, patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    if (patch.skipEmailWhenPushDelivered !== undefined) await this.repo.set("skipEmailWhenPushDelivered", patch.skipEmailWhenPushDelivered, actor.email);
    this.cache = null;
    return this.get();
  }
}
