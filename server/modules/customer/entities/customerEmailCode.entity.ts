// Emailed 6-digit sign-in codes for storefront customers. Only the keyed hash is stored; 5 attempts max.
import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, timestampColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface CustomerEmailCode {
  id: string;
  organizationId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
  organization?: { id: string };
}

export const CustomerEmailCodeEntity = new EntitySchema<CustomerEmailCode>({
  name: "CustomerEmailCode",
  tableName: "customer_email_codes",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    email: varchar("email", 160),
    codeHash: varchar("code_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    attempts: intColumn("attempts", 0),
    usedAt: timestampColumn("used_at"),
    createdAt: createdAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "IDX_customer_email_codes_lookup", columns: ["organizationId", "email", "createdAt"] }],
});
