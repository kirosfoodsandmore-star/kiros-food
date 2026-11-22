// Push notifications through Firebase Cloud Messaging (web push). Messages are data-only: the service worker on the
// device (client/public/push-sw.js) decides how to show them and skips showing one while the app is open on screen,
// because the in-app alert already covers that. Without a Firebase service account everything here is a quiet no-op.
// Staff devices live in push_devices, customers' in customer_push_devices; sending works the same for both.
//
// A send reports who it REACHED: people for whom FCM accepted the message on at least one device. A caller can pass that on
// with publishOutcome(key, reached), and anything that would repeat the alert another way (the new-order email) can ask
// reachedForEmailSkip(key) to learn who already has it. See PlatformSettings.skipEmailWhenPushDelivered.
import { getMessaging } from "firebase-admin/messaging";
import { firebaseConfigured, getFirebaseApp } from "../../../infrastructure/firebase/firebaseAdmin";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { PlatformSettingsService } from "../../platform/services/platformSettings.service";
import { CustomerPushDeviceRepository } from "../repositories/customerPushDevice.repository";
import { PushDeviceRepository } from "../repositories/pushDevice.repository";

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app to open when the notification is tapped, e.g. "/rider". */
  url: string;
  /** Same tag = replaces the earlier notification on the device (one card per delivery, not a pile). */
  tag?: string;
  /** Path of the notification's icon, e.g. "/app-icon-192.png". Leave out for the service worker's default. */
  icon?: string;
  /** Show it even while the app is open on screen. Normally the device stays quiet then, because the in-app alert covers it; a test must be seen. */
  always?: boolean;
}

/** The key under which the new-order push publishes who it reached (the new-order email asks for the same key). */
export const newOrderPushKey = (orderId: string): string => `order-${orderId}`;

const STALE_TOKEN_CODES = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);
const BATCH = 500;
/** How long an answer stays available, and the longest the email waits for the push to finish before it just goes out. */
const OUTCOME_KEEP_MS = 5 * 60_000;
const OUTCOME_WAIT_MS = 15_000;

interface Device {
  owner: string;
  token: string;
}
interface SendResult {
  ok: boolean;
  code?: string;
}
interface Outcome {
  promise: Promise<Set<string>>;
  resolve: (reached: Set<string>) => void;
}

export class PushService {
  static Instance = new PushService();
  private readonly outcomes = new Map<string, Outcome>();
  /** When each staff member last asked for a test, so the button can't be used to spam a device. */
  private readonly lastTest = new Map<string, number>();
  private constructor(
    private readonly devices = PushDeviceRepository.Instance,
    private readonly customerDevices = CustomerPushDeviceRepository.Instance
  ) {}

  get enabled(): boolean {
    return firebaseConfigured();
  }

  /**
   * The setup guide's last step: send this staff member a real notification so they know it works. `delivered` means
   * Google accepted it for at least one of their devices (it may still be held back by the phone's own settings).
   */
  async sendTest(actor: Actor): Promise<{ delivered: boolean }> {
    if (!this.enabled) throw AppError.unavailable("Notifications haven't been set up on the server yet");
    if (Date.now() - (this.lastTest.get(actor.id) ?? 0) < 10_000) throw AppError.conflict("Wait a few seconds before sending another test");
    this.lastTest.set(actor.id, Date.now());
    const reached = await this.sendToUsers([actor.id], {
      title: "Notifications are on",
      body: "This is a test. Alerts for your orders and deliveries will arrive like this.",
      url: "/admin",
      tag: "test-notification",
      always: true,
    });
    return { delivered: reached.has(actor.id) };
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

  async registerCustomerDevice(customer: CustomerActor, token: string, userAgent: string | null): Promise<void> {
    await this.customerDevices.upsert(customer.organizationId, customer.id, token, userAgent?.slice(0, 255) ?? null);
  }

  async unregisterCustomerDevice(customer: CustomerActor, token: string): Promise<void> {
    await this.customerDevices.remove(customer.id, token);
  }

  /** Never throws: a failed notification must not break the order flow that triggered it. Returns the staff it reached. */
  async sendToUsers(userIds: string[], message: PushMessage): Promise<Set<string>> {
    if (!this.enabled || userIds.length === 0) return new Set();
    const ids = [...new Set(userIds)];
    return this.deliver(() => this.devices.devicesForUsers(ids), (stale) => this.devices.removeTokens(stale), message);
  }

  /** Same, for customers (their devices are kept separately). Never throws. Returns the customers it reached. */
  async sendToCustomers(customerIds: string[], message: PushMessage): Promise<Set<string>> {
    if (!this.enabled || customerIds.length === 0) return new Set();
    const ids = [...new Set(customerIds)];
    return this.deliver(() => this.customerDevices.devicesForCustomers(ids), (stale) => this.customerDevices.removeTokens(stale), message);
  }

  /** The one place FCM is called (kept apart so tests can stand in for Google). */
  private async sendBatch(tokens: string[], message: PushMessage): Promise<SendResult[]> {
    const res = await getMessaging(getFirebaseApp()).sendEachForMulticast({
      tokens,
      data: { title: message.title, body: message.body, url: message.url, tag: message.tag ?? "", ...(message.icon ? { icon: message.icon } : {}), ...(message.always ? { always: "1" } : {}) },
      // High urgency wakes a sleeping phone; one hour is plenty, an old "new delivery" is worse than none.
      webpush: { headers: { Urgency: "high", TTL: "3600" } },
    });
    return res.responses.map((r) => ({ ok: r.success, code: r.error?.code ?? r.error?.message }));
  }

  private async deliver(findDevices: () => Promise<Device[]>, removeStale: (tokens: string[]) => Promise<void>, message: PushMessage): Promise<Set<string>> {
    const reached = new Set<string>();
    try {
      const seen = new Set<string>();
      const devices = (await findDevices()).filter((d) => !seen.has(d.token) && !!seen.add(d.token));
      const stale: string[] = [];
      for (let i = 0; i < devices.length; i += BATCH) {
        const chunk = devices.slice(i, i + BATCH);
        const results = await this.sendBatch(chunk.map((d) => d.token), message);
        results.forEach((r, idx) => {
          if (r.ok) reached.add(chunk[idx].owner);
          else if (r.code && STALE_TOKEN_CODES.has(r.code)) stale.push(chunk[idx].token);
          else console.warn("[push] send failed:", r.code);
        });
      }
      await removeStale(stale);
    } catch (err) {
      console.error("[push] could not send", err instanceof Error ? err.message : err);
    }
    return reached;
  }

  // ── Who a push reached, for the email that would repeat it ──────────────────

  private outcome(key: string): Outcome {
    let o = this.outcomes.get(key);
    if (!o) {
      let resolve!: (reached: Set<string>) => void;
      const promise = new Promise<Set<string>>((r) => { resolve = r; });
      o = { promise, resolve };
      this.outcomes.set(key, o);
      setTimeout(() => this.outcomes.delete(key), OUTCOME_KEEP_MS).unref();
    }
    return o;
  }

  /** Say who the push for `key` reached (an empty set when nothing was sent). The first answer counts. */
  publishOutcome(key: string, reached: Set<string>): void {
    this.outcome(key).resolve(reached);
  }

  /**
   * The people an email can leave out because the push already reached them. Empty (so everyone is emailed) unless push is
   * set up AND a platform admin switched "skip the email when the push was delivered" on. Waits (briefly) for the push to
   * finish; if it doesn't, everyone is emailed: a repeated alert is better than a missing one.
   */
  async reachedForEmailSkip(key: string): Promise<Set<string>> {
    if (!this.enabled) return new Set();
    if (!(await PlatformSettingsService.Instance.get()).skipEmailWhenPushDelivered) return new Set();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<Set<string>>((r) => { timer = setTimeout(() => r(new Set()), OUTCOME_WAIT_MS); });
    try {
      return await Promise.race([this.outcome(key).promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
