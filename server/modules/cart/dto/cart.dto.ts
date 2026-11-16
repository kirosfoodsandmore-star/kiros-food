import type { Fulfilment } from "../../../config/constants";
import type { DeliveryQuoteDTO } from "../../branch/dto/branch.dto";
import type { LineWarning, PricedLine } from "../domain/pricing";
import type { DeliveryAddressSnapshot } from "../entities/cart.entity";

export interface CartDTO {
  id: string;
  /** Only returned when the cart is created. */
  token?: string;
  branchId: string;
  branchName: string;
  menuId: string | null;
  fulfilment: Fulfilment;
  scheduledFor: string | null;
  promoCode: string | null;
  deliveryAddress: DeliveryAddressSnapshot | null;
  phone: string | null;
  lines: PricedLine[];
  itemCount: number;
  warnings: LineWarning[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promo: { applied: boolean; reason: string | null };
  delivery: DeliveryQuoteDTO | null;
  branch: { isOpen: boolean; isPaused: boolean; nextOpenAt: string | null; deliveryEnabled: boolean; pickupEnabled: boolean };
  /** Human-readable reasons checkout is blocked (empty = ready). */
  blockers: string[];
  expiresAt: string;
}
