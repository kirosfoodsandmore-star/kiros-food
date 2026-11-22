import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, intColumn, manyToOne, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";
import type { ExpenseGroup, FinanceKind } from "../catalog/finance.catalog";

/** One of a restaurant's finance categories (built-in ones came with the app; the rest are the owner's own). */
export interface FinanceCategoryRow {
  id: string;
  organizationId: string;
  /** The short code stored on entries and budgets. Never changes. */
  key: string;
  label: string;
  /** Fixed once created. */
  kind: FinanceKind;
  /** Expenses only. */
  expenseGroup: ExpenseGroup | null;
  /** Income only: counts as a sale in Sales reports and the Dashboard. */
  isSale: boolean;
  isBuiltin: boolean;
  /** Hidden categories aren't offered for new entries; old entries keep showing them. */
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  organization?: { id: string };
}

export const FinanceCategoryEntity = new EntitySchema<FinanceCategoryRow>({
  name: "FinanceCategory",
  tableName: "finance_categories",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    key: varchar("key", 30),
    label: varchar("label", 80),
    kind: varchar("kind", 12),
    expenseGroup: varchar("expense_group", 20, true),
    isSale: boolColumn("is_sale", false),
    isBuiltin: boolColumn("is_builtin", false),
    isActive: boolColumn("is_active", true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_finance_categories_org_key", columns: ["organizationId", "key"], unique: true }],
});
