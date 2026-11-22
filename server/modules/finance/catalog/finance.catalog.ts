// The money that moves outside the storefront: what the owners put in, what the business spends, what it earns
// off-app (walk-in sales, catering) and what goes back out to owners and lenders.
//
// The kinds, expense groups and payment methods are fixed. The CATEGORIES are not: every restaurant has its own list in
// the finance_categories table (managed on Capital & expenses → Categories), and these defaults are only what each
// restaurant starts with (copied in by migration 1794500000018 and, for a new restaurant, the first time it opens finance).

export const FINANCE_KINDS = ["capital", "expense", "income", "withdrawal"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

/** Where an expense sits on the profit-and-loss: cost of sales (food, packaging), running costs, or one-off investment in assets. */
export const EXPENSE_GROUPS = ["cost_of_sales", "operating", "capex"] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number];

export const FINANCE_PAYMENT_METHODS = ["cash", "transfer", "pos", "card", "cheque", "other"] as const;
export type FinancePaymentMethod = (typeof FINANCE_PAYMENT_METHODS)[number];

export interface DefaultCategory {
  key: string;
  kind: FinanceKind;
  label: string;
  /** Expenses only. */
  group?: ExpenseGroup;
  /** Income only: counts as a SALE (walk-in, catering) rather than other income, so Sales reports and the Dashboard include it. */
  isSale?: boolean;
}

export const DEFAULT_FINANCE_CATEGORIES: readonly DefaultCategory[] = [
  // ── Capital: money put into the business ──────────────────────────────────
  { key: "owner_investment", kind: "capital", label: "Owner's investment" },
  { key: "investor", kind: "capital", label: "Investor / partner" },
  { key: "loan", kind: "capital", label: "Loan received" },
  { key: "grant", kind: "capital", label: "Grant" },
  { key: "opening_balance", kind: "capital", label: "Opening balance" },

  // ── Expenses: cost of sales ───────────────────────────────────────────────
  { key: "ingredients", kind: "expense", group: "cost_of_sales", label: "Ingredients & stock" },
  { key: "packaging", kind: "expense", group: "cost_of_sales", label: "Packaging" },
  // ── Expenses: running costs ───────────────────────────────────────────────
  { key: "salaries", kind: "expense", group: "operating", label: "Salaries & wages" },
  { key: "rent", kind: "expense", group: "operating", label: "Rent" },
  { key: "utilities", kind: "expense", group: "operating", label: "Electricity & water" },
  { key: "fuel", kind: "expense", group: "operating", label: "Fuel, gas & diesel" },
  { key: "logistics", kind: "expense", group: "operating", label: "Delivery & transport" },
  { key: "marketing", kind: "expense", group: "operating", label: "Marketing & promotion" },
  { key: "maintenance", kind: "expense", group: "operating", label: "Repairs & maintenance" },
  { key: "fees", kind: "expense", group: "operating", label: "Bank, POS & payment fees" },
  { key: "licences", kind: "expense", group: "operating", label: "Licences, permits & tax" },
  { key: "software", kind: "expense", group: "operating", label: "Software & subscriptions" },
  { key: "cleaning", kind: "expense", group: "operating", label: "Cleaning & supplies" },
  { key: "other_expense", kind: "expense", group: "operating", label: "Other running cost" },
  // ── Expenses: investment in assets ────────────────────────────────────────
  { key: "equipment", kind: "expense", group: "capex", label: "Equipment & tools" },
  { key: "fitout", kind: "expense", group: "capex", label: "Renovation & fit-out" },
  { key: "vehicle", kind: "expense", group: "capex", label: "Vehicles & bikes" },

  // ── Income outside the app ────────────────────────────────────────────────
  { key: "offline_sales", kind: "income", label: "Walk-in / offline sales", isSale: true },
  { key: "catering", kind: "income", label: "Catering & events", isSale: true },
  { key: "other_income", kind: "income", label: "Other income" },

  // ── Money taken out ───────────────────────────────────────────────────────
  { key: "drawings", kind: "withdrawal", label: "Owner's drawings" },
  { key: "loan_repayment", kind: "withdrawal", label: "Loan repayment" },
  { key: "dividend", kind: "withdrawal", label: "Dividend / profit share" },
];

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  cost_of_sales: "Cost of sales",
  operating: "Running costs",
  capex: "Assets & fit-out",
};

export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = {
  capital: "Capital in",
  expense: "Expense",
  income: "Other income",
  withdrawal: "Money out",
};

/** Category keys are short codes stored on every entry and budget (columns are varchar(30)). */
export const CATEGORY_KEY_PATTERN = /^[a-z0-9_]{1,30}$/;
export const CATEGORY_LABEL_MAX = 80;
