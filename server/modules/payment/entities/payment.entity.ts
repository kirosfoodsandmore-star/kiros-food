// One payment attempt per order (a new attempt is a new row). The Paystack reference is unique and
// handling is idempotent on it.
import { EntitySchema } from "typeorm";
import type { PaymentMethod, PaymentStatus } from "../../../config/constants";
import { createdAt, jsonColumn, manyToOne, moneyColumn, primaryId, textColumn, timestampColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Payment {
  id: string;
  organizationId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  reference: string;
  status: PaymentStatus;
  authorizationUrl: string | null;
  channel: string | null;
  proofUrl: string | null;
  proofPublicId: string | null;
  claimNote: string | null;
  claimedAt: Date | null;
  /** Bank transfer: pay-by deadline. Paystack: pending TTL. */
  expiresAt: Date | null;
  paidAt: Date | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  rejectedById: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  refundedAt: Date | null;
  refundAmount: number | null;
  refundReference: string | null;
  providerPayload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  order?: { id: string };
}

export const PaymentEntity = new EntitySchema<Payment>({
  name: "Payment",
  tableName: "payments",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    orderId: uuidColumn("order_id"),
    method: varchar("method", 10),
    amount: moneyColumn("amount"),
    currency: varchar("currency", 3, false, "NGN"),
    reference: varchar("reference", 80),
    status: varchar("status", 12, false, "pending"),
    authorizationUrl: varchar("authorization_url", 500, true),
    channel: varchar("channel", 40, true),
    proofUrl: varchar("proof_url", 500, true),
    proofPublicId: varchar("proof_public_id", 255, true),
    claimNote: varchar("claim_note", 255, true),
    claimedAt: timestampColumn("claimed_at"),
    expiresAt: timestampColumn("expires_at"),
    paidAt: timestampColumn("paid_at"),
    confirmedById: uuidColumn("confirmed_by_id", true),
    confirmedAt: timestampColumn("confirmed_at"),
    rejectedById: uuidColumn("rejected_by_id", true),
    rejectedAt: timestampColumn("rejected_at"),
    rejectReason: textColumn("reject_reason"),
    refundedAt: timestampColumn("refunded_at"),
    refundAmount: moneyColumn("refund_amount", true),
    refundReference: varchar("refund_reference", 80, true),
    providerPayload: jsonColumn("provider_payload"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { order: manyToOne("Order", "order_id", "CASCADE") },
  indices: [
    { name: "UQ_payments_reference", columns: ["reference"], unique: true },
    { name: "IDX_payments_order", columns: ["orderId", "createdAt"] },
    { name: "IDX_payments_org_status", columns: ["organizationId", "status", "createdAt"] },
  ],
});
