import { EntitySchema } from "typeorm";
import { createdAt, dateColumn, deletedAt, manyToOne, moneyColumn, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";
import type { FinanceKind } from "../catalog/finance.catalog";

export interface FinanceEntry {
  id: string;
  organizationId: string;
  /** null = the whole business, not one branch. */
  branchId: string | null;
  kind: FinanceKind;
  /** A key from FINANCE_CATEGORIES that belongs to `kind`. */
  category: string;
  title: string;
  /** Kobo, always positive; the kind says which way it moved. */
  amount: number;
  /** YYYY-MM-DD, the day it happened (may be before the app existed). */
  entryDate: string;
  paymentMethod: string | null;
  /** Vendor, payee, investor or lender. */
  party: string | null;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const FinanceEntryEntity = new EntitySchema<FinanceEntry>({
  name: "FinanceEntry",
  tableName: "finance_entries",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    kind: varchar("kind", 12),
    category: varchar("category", 30),
    title: varchar("title", 160),
    amount: moneyColumn("amount"),
    entryDate: dateColumn("entry_date"),
    paymentMethod: varchar("payment_method", 12, true),
    party: varchar("party", 160, true),
    reference: varchar("reference", 80, true),
    notes: textColumn("notes"),
    createdBy: uuidColumn("created_by", true),
    createdByName: varchar("created_by_name", 120, true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
});
