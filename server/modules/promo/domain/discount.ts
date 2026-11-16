// Pure promo-code evaluation. No I/O.
import { percentOf } from "../../../shared/utils/money";

export interface PromoRule {
  code: string;
  type: "percent" | "fixed";
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  minSpend: number;
  branchId: string | null;
  menuId: string | null;
  isActive: boolean;
}

export interface PromoContext {
  subtotal: number;
  branchId: string;
  menuId: string | null;
  customerUses: number;
  now?: Date;
}

export type PromoResult = { ok: true; discount: number } | { ok: false; reason: string };

export function evaluatePromo(promo: PromoRule, ctx: PromoContext): PromoResult {
  const now = ctx.now ?? new Date();
  if (!promo.isActive) return { ok: false, reason: "This promo code is no longer active" };
  if (promo.startsAt && now < promo.startsAt) return { ok: false, reason: "This promo code is not active yet" };
  if (promo.endsAt && now > promo.endsAt) return { ok: false, reason: "This promo code has expired" };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { ok: false, reason: "This promo code has been fully used" };
  if (promo.maxUsesPerCustomer !== null && ctx.customerUses >= promo.maxUsesPerCustomer) return { ok: false, reason: "You have already used this promo code" };
  if (promo.branchId && promo.branchId !== ctx.branchId) return { ok: false, reason: "This promo code is not valid at this branch" };
  if (promo.menuId && promo.menuId !== ctx.menuId) return { ok: false, reason: "This promo code is not valid for this menu" };
  if (ctx.subtotal < promo.minSpend) return { ok: false, reason: `Spend at least ${promo.minSpend} to use this code` };
  const raw = promo.type === "percent" ? percentOf(ctx.subtotal, Math.min(100, promo.value)) : promo.value;
  return { ok: true, discount: Math.max(0, Math.min(raw, ctx.subtotal)) };
}
