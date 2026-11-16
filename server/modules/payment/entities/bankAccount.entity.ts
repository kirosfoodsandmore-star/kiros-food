import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, intColumn, manyToOne, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface BankAccount {
  id: string;
  organizationId: string;
  /** null = shown for every branch; set = only for that branch. */
  branchId: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const BankAccountEntity = new EntitySchema<BankAccount>({
  name: "BankAccount",
  tableName: "bank_accounts",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id", true),
    bankName: varchar("bank_name", 120),
    accountName: varchar("account_name", 160),
    accountNumber: varchar("account_number", 34),
    isActive: boolColumn("is_active", true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "IDX_bank_accounts_org", columns: ["organizationId"] }],
});
