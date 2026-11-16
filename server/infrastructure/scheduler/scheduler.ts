// Background sweeps: expire unpaid orders and stale payments, auto-restore sold-out items, purge old
// carts and refresh tokens. One run at a time; failures are logged, never thrown.
import { env } from "../../config/env";
import { RefreshTokenRepository } from "../../modules/auth/repositories/refreshToken.repository";
import { AvailabilityService } from "../../modules/availability/services/availability.service";
import { CartService } from "../../modules/cart/services/cart.service";
import { OrderService } from "../../modules/order/services/order.service";
import { PaymentService } from "../../modules/payment/services/payment.service";

let timer: NodeJS.Timeout | null = null;
let riderTimer: NodeJS.Timeout | null = null;
let running = false;
let passing = false;

/** Unanswered deliveries are checked every 20 seconds: the main sweep is too slow for a few-minute deadline. */
async function passUnanswered(): Promise<void> {
  if (passing) return;
  passing = true;
  try {
    const n = await OrderService.Instance.passUnansweredAssignments();
    if (n) console.info(`[scheduler] unanswered deliveries passed on ${n}`);
  } catch (err) {
    console.error("[scheduler] rider sweep failed", err);
  } finally {
    passing = false;
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const expiredPayments = await PaymentService.Instance.expireStale();
    const expiredOrders = await OrderService.Instance.expireUnpaid();
    const restored = await AvailabilityService.Instance.restoreDue();
    const carts = await CartService.Instance.purgeExpired();
    await RefreshTokenRepository.Instance.purgeExpired();
    if (expiredPayments || expiredOrders || restored || carts) {
      console.info(`[scheduler] payments expired ${expiredPayments}, orders expired ${expiredOrders}, items restored ${restored}, carts purged ${carts}`);
    }
  } catch (err) {
    console.error("[scheduler] sweep failed", err);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (!env.scheduler.enabled || timer) return;
  const intervalMs = Math.max(env.scheduler.intervalMinutes, 1) * 60_000;
  setTimeout(() => void tick(), 10_000).unref();
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  if (env.riderAcceptMinutes > 0) {
    riderTimer = setInterval(() => void passUnanswered(), 20_000);
    riderTimer.unref();
    console.log(`[scheduler] riders have ${env.riderAcceptMinutes} min to answer a delivery`);
  }
  console.log(`[scheduler] sweeps every ${Math.round(intervalMs / 60_000)} min`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  if (riderTimer) clearInterval(riderTimer);
  timer = null;
  riderTimer = null;
}
