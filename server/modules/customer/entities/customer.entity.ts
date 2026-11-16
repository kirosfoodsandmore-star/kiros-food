// Storefront customers. Identity is the phone number (verified by Firebase Phone Auth) or a Google
// account; one customer record per restaurant per phone. Phone may be missing until checkout for
// Google sign-ins, which is why it is nullable with a partial unique index.
import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, intColumn, manyToOne, moneyColumn, primaryId, timestampColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Customer {
  id: string;
  organizationId: string;
  firebaseUid: string | null;
  phone: string | null;
  name: string | null;
  email: string | null;
  /** Set when the emailed sign-in code was entered. No Firebase uid and no verified email = a guest. */
  emailVerifiedAt: Date | null;
  isBlocked: boolean;
  blockReason: string | null;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: { id: string };
}

export const CustomerEntity = new EntitySchema<Customer>({
  name: "Customer",
  tableName: "customers",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    firebaseUid: varchar("firebase_uid", 128, true),
    phone: varchar("phone", 20, true),
    name: varchar("name", 120, true),
    email: varchar("email", 160, true),
    emailVerifiedAt: timestampColumn("email_verified_at"),
    isBlocked: boolColumn("is_blocked", false),
    blockReason: varchar("block_reason", 200, true),
    orderCount: intColumn("order_count", 0),
    totalSpend: moneyColumn("total_spend"),
    lastOrderAt: timestampColumn("last_order_at"),
    lastSeenAt: timestampColumn("last_seen_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "UQ_customers_org_phone", columns: ["organizationId", "phone"], unique: true, where: "phone IS NOT NULL" },
    { name: "UQ_customers_org_uid", columns: ["organizationId", "firebaseUid"], unique: true, where: "firebase_uid IS NOT NULL" },
    { name: "IDX_customers_org_email", columns: ["organizationId", "email"] },
  ],
});
