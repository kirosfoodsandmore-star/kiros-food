import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, intColumn, manyToOne, moneyColumn, primaryId, timestampColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface PromoCode {
  id: string;
  organizationId: string;
  /** Stored upper-case. */
  code: string;
  type: "percent" | "fixed";
  /** Percent (1–100) or fixed amount in kobo. */
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  minSpend: number;
  /** Restrict to one branch or one menu (null = any). */
  branchId: string | null;
  menuId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const PromoCodeEntity = new EntitySchema<PromoCode>({
  name: "PromoCode",
  tableName: "promo_codes",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    code: varchar("code", 40),
    type: varchar("type", 10),
    value: { type: "bigint", name: "value", default: 0, transformer: moneyColumn("x").transformer },
    startsAt: timestampColumn("starts_at"),
    endsAt: timestampColumn("ends_at"),
    maxUses: intColumn("max_uses", null),
    usedCount: intColumn("used_count", 0),
    maxUsesPerCustomer: intColumn("max_uses_per_customer", null),
    minSpend: moneyColumn("min_spend"),
    branchId: uuidColumn("branch_id", true),
    menuId: uuidColumn("menu_id", true),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_promo_codes_org_code", columns: ["organizationId", "code"], unique: true, where: "deleted_at IS NULL" }],
});
