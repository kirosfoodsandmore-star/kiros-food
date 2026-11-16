// Push notifications through Firebase Cloud Messaging (web push). Messages are data-only: the service worker on the
// device (client/public/push-sw.js) decides how to show them and skips showing one while the app is open on screen,
// because the in-app alert already covers that. Without a Firebase service account everything here is a quiet no-op.
import { getMessaging } from "firebase-admin/messaging";
import { firebaseConfigured, getFirebaseApp } from "../../../infrastructure/firebase/firebaseAdmin";
import type { Actor } from "../../../shared/types/actor";
import { PushDeviceRepository } from "../repositories/pushDevice.repository";

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app to open when the notification is tapped, e.g. "/rider". */
  url: string;
  /** Same tag = replaces the earlier notification on the device (one card per delivery, not a pile). */
  tag?: string;
}

const STALE_TOKEN_CODES = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);
const BATCH = 500;

export class PushService {
  static Instance = new PushService();
  private constructor(private readonly devices = PushDeviceRepository.Instance) {}

  get enabled(): boolean {
    return firebaseConfigured();
  }

  async status(actor: Actor): Promise<{ enabled: boolean; devices: number }> {
    return { enabled: this.enabled, devices: await this.devices.countForUser(actor.id) };
  }

  async registerDevice(actor: Actor, token: string, userAgent: string | null): Promise<void> {
    await this.devices.upsert(actor.organizationId, actor.id, token, userAgent?.slice(0, 255) ?? null);
  }

  async unregisterDevice(actor: Actor, token: string): Promise<void> {
    await this.devices.remove(actor.id, token);
  }

  /** Never throws: a failed notification must not break the order flow that triggered it. */
  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;
    try {
      const tokens = [...new Set(await this.devices.tokensForUsers([...new Set(userIds)]))];
      const stale: string[] = [];
      for (let i = 0; i < tokens.length; i += BATCH) {
        const chunk = tokens.slice(i, i + BATCH);
        const res = await getMessaging(getFirebaseApp()).sendEachForMulticast({
          tokens: chunk,
          data: { title: message.title, body: message.body, url: message.url, tag: message.tag ?? "" },
          // High urgency wakes a sleeping phone; one hour is plenty, an old "new delivery" is worse than none.
          webpush: { headers: { Urgency: "high", TTL: "3600" } },
        });
        res.responses.forEach((r, idx) => {
          if (!r.success && r.error && STALE_TOKEN_CODES.has(r.error.code)) stale.push(chunk[idx]);
          else if (!r.success) console.warn("[push] send failed:", r.error?.code ?? r.error?.message);
        });
      }
      await this.devices.removeTokens(stale);
    } catch (err) {
      console.error("[push] could not send", err instanceof Error ? err.message : err);
    }
  }
}
