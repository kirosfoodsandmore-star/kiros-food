import { EntitySchema } from "typeorm";
import { createdAt, manyToOne, moneyColumn, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

/** A monthly spending budget for one expense category. */
export interface FinanceBudget {
  id: string;
  organizationId: string;
  category: string;
  /** Kobo per month. */
  monthlyAmount: number;
  createdAt: Date;
  updatedAt: Date;
  organization?: { id: string };
}

export const FinanceBudgetEntity = new EntitySchema<FinanceBudget>({
  name: "FinanceBudget",
  tableName: "finance_budgets",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    category: varchar("category", 30),
    monthlyAmount: moneyColumn("monthly_amount"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_finance_budgets_org_category", columns: ["organizationId", "category"], unique: true }],
});
