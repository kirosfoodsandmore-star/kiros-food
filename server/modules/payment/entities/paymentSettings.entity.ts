// Per-restaurant payment configuration. The Paystack secret key is sealed (AES-256-GCM) and never
// returned to a client; only its last four characters are shown.
import { EntitySchema } from "typeorm";
import type { PaystackMode } from "../../../config/constants";
import { boolColumn, intColumn, manyToOne, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface PaymentSettings {
  id: string;
  organizationId: string;
  paystackEnabled: boolean;
  transferEnabled: boolean;
  paystackPublicKey: string | null;
  paystackSecretKeySealed: string | null;
  paystackMode: PaystackMode;
  transferWindowMinutes: number;
  transferInstructions: string | null;
  updatedAt: Date;
  organization?: { id: string };
}

export const PaymentSettingsEntity = new EntitySchema<PaymentSettings>({
  name: "PaymentSettings",
  tableName: "payment_settings",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    paystackEnabled: boolColumn("paystack_enabled", false),
    transferEnabled: boolColumn("transfer_enabled", true),
    paystackPublicKey: varchar("paystack_public_key", 120, true),
    paystackSecretKeySealed: textColumn("paystack_secret_key_sealed"),
    paystackMode: varchar("paystack_mode", 5, false, "test"),
    transferWindowMinutes: intColumn("transfer_window_minutes", 30),
    transferInstructions: textColumn("transfer_instructions"),
    updatedAt: updatedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_payment_settings_org", columns: ["organizationId"], unique: true }],
});
