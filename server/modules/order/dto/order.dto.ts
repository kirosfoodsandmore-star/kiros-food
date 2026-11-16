import type { ActorType, Fulfilment, OrderStatus, PaymentMethod, PaymentStatus } from "../../../config/constants";
import type { DeliveryAddressSnapshot } from "../../cart/entities/cart.entity";
import type { OrderLineOption } from "../entities/orderLine.entity";

export interface OrderLineDTO {
  id: string;
  itemId: string | null;
  itemName: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
  options: OrderLineOption[];
}

export interface OrderEventDTO {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface OrderPaymentDTO {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference: string;
  authorizationUrl: string | null;
  proofUrl: string | null;
  claimedAt: Date | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  rejectReason: string | null;
  refundAmount: number | null;
  refundedAt: Date | null;
}

export interface OrderSummaryDTO {
  id: string;
  number: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerPhone: string;
  customerName: string | null;
  fulfilment: Fulfilment;
  scheduledFor: Date | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  itemCount: number;
  riderId: string | null;
  riderName: string | null;
  /** "pending" until the rider answers, "accepted" after; null on older assignments (treat as accepted). */
  riderResponse: "pending" | "accepted" | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A rider's delivery card: the summary plus where it's going and what the customer asked for. */
export interface RiderDeliveryDTO extends OrderSummaryDTO {
  deliveryAddress: DeliveryAddressSnapshot | null;
  note: string | null;
  /** When it was marked delivered (only set once it is). */
  completedAt: Date | null;
  /** While waiting for the rider's answer: when the time runs out and it is passed on (null if never). */
  answerBy: Date | null;
  /** True when the customer holds a code the rider must enter to finish. */
  needsCode: boolean;
  /** Wrong guesses left before only the restaurant can complete it. */
  codeAttemptsLeft: number;
}

export interface OrderDetailDTO extends OrderSummaryDTO {
  menuId: string | null;
  deliveryAddress: DeliveryAddressSnapshot | null;
  customerEmail: string | null;
  promoCode: string | null;
  note: string | null;
  cancelReason: string | null;
  refundNote: string | null;
  acceptedAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  expiresAt: Date | null;
  lines: OrderLineDTO[];
  events: OrderEventDTO[];
  payment: OrderPaymentDTO | null;
  /** Customer only, and only while the order is out for delivery: the code to read out to the rider. */
  deliveryCode: string | null;
  /** Staff: transitions available from the current status. */
  nextStatuses?: OrderStatus[];
  branch: { name: string; address: string; phone: string | null; timezone: string };
}

export interface CheckoutResultDTO {
  order: OrderDetailDTO;
  payment:
    | { method: "paystack"; authorizationUrl: string; reference: string; publicKey: string | null }
    | {
        method: "transfer";
        reference: string;
        amount: number;
        bankAccounts: Array<{ id: string; bankName: string; accountName: string; accountNumber: string }>;
        instructions: string | null;
        deadline: string;
      };
}

export interface OrderListFilter {
  page: number;
  limit: number;
  branchIds: string[] | null;
  status?: OrderStatus[];
  fulfilment?: Fulfilment;
  search?: string;
  customerId?: string;
  riderId?: string;
  from?: string;
  to?: string;
  timezone: string;
  scheduledOnly?: boolean;
  /** Only orders nobody on the staff has acted on yet (no status change by a staff member). Drives the sidebar badge. */
  unhandled?: boolean;
}
