// The business's own books (capital, expenses, off-app income, money out) and the analytics built on them.
// Mirrors server/modules/finance. Money is kobo; ratios are 0–1 or null.

export type FinanceKind = "capital" | "expense" | "income" | "withdrawal"
export type ExpenseGroup = "cost_of_sales" | "operating" | "capex"
export type Granularity = "day" | "week" | "month"

/** One of the restaurant's own categories (some came with the app, the rest were added by the owner). */
export interface FinanceCategory {
  id: string
  /** The short code stored on entries and budgets. Never changes. */
  key: string
  kind: FinanceKind
  label: string
  /** Expenses only. */
  group?: ExpenseGroup | null
  /** Other income only: counts as a sale in Sales reports and the Dashboard. */
  isSale: boolean
  isBuiltin: boolean
  /** Hidden categories aren't offered for new entries; old entries keep showing them. */
  isActive: boolean
  sortOrder: number
  /** Entries and budgets using it (finance.view only). */
  entries?: number
  budgets?: number
}

export interface CategoryInput {
  label: string
  kind: FinanceKind
  group?: ExpenseGroup | null
  isSale?: boolean
}

export interface FinanceCatalog {
  kinds: Array<{ key: FinanceKind; label: string }>
  groups: Array<{ key: ExpenseGroup; label: string }>
  paymentMethods: string[]
  categories: FinanceCategory[]
  /** Local hour the sales day rolls over (6 = 6am). Sales-only staff can change a sale until then. */
  salesDayStartsHour: number
}

export interface FinanceEntry {
  id: string
  branchId: string | null
  kind: FinanceKind
  category: string
  title: string
  amount: number
  entryDate: string
  paymentMethod: string | null
  party: string | null
  reference: string | null
  notes: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  /** Who it was paid to / received from, each with their share (adds up to amount). */
  parties: PartyLine[]
  /** What was sold (offline sales): menu items with quantity and the price charged each. Empty when not itemised. */
  items: SaleItemLine[]
}

export interface SaleItemLine {
  itemId: string | null
  name: string
  categoryName: string | null
  quantity: number
  /** Kobo each, as charged. */
  unitPrice: number
}

/** A line as sent: a menu item by id (name is kept for items since removed from the menu), or a typed name. */
export interface SaleItemInput {
  itemId?: string
  name?: string
  quantity: number
  unitPrice: number
}

/** A menu item offered when recording a sale. */
export interface SaleMenuItem {
  id: string
  name: string
  price: number
  category: string
  menu: string
}

export interface BestSeller {
  key: string
  name: string
  units: number
  appUnits: number
  walkInUnits: number
  revenue: number
}

export interface PartyLine {
  partyId: string
  name: string
  amount: number
}

/** A line as sent: a saved party by id, or a name (found or created by the server). */
export interface PartyLineInput {
  partyId?: string
  name?: string
  amount: number
}

/** A saved vendor / customer / investor, with how it's been used. */
export interface FinanceParty {
  id: string
  name: string
  phone: string | null
  notes: string | null
  entries: number
  total: number
  lastUsed: string | null
  kinds: FinanceKind[]
}

export interface FinanceEntryInput {
  kind: FinanceKind
  category: string
  title: string
  amount: number
  entryDate: string
  branchId?: string | null
  paymentMethod?: string | null
  party?: string | null
  parties?: PartyLineInput[]
  items?: SaleItemInput[]
  reference?: string | null
  notes?: string | null
}

export interface FinanceBudget {
  category: string
  monthlyAmount: number
}

export interface PeriodTotals {
  appRevenue: number
  otherIncome: number
  revenue: number
  costOfSales: number
  operating: number
  capex: number
  expenses: number
  salaries: number
  capitalIn: number
  withdrawals: number
  grossProfit: number
  operatingProfit: number
  netCashFlow: number
  orders: number
  averageOrderValue: number
  grossMargin: number | null
  operatingMargin: number | null
  foodCostRatio: number | null
  labourRatio: number | null
  primeCostRatio: number | null
}

export interface SeriesPoint {
  bucket: string
  appRevenue: number
  otherIncome: number
  revenue: number
  costOfSales: number
  operating: number
  capex: number
  expenses: number
  capitalIn: number
  withdrawals: number
  operatingProfit: number
  netCashFlow: number
  orders: number
  averageOrderValue: number
  customers: number
  newCustomers: number
  cash: number
  cumulativeProfit: number
}

export type InsightTone = "good" | "warning" | "critical" | "info"

export interface FinanceAnalytics {
  range: { from: string; to: string; granularity: Granularity; timezone: string; allTime: boolean; previousFrom: string; previousTo: string; firstActivity: string | null; months: number }
  totals: PeriodTotals
  previous: PeriodTotals
  lifetime: { capitalInvested: number; withdrawals: number; netCapital: number; revenue: number; expenses: number; assets: number; operatingProfit: number; cashPosition: number; paybackRatio: number | null }
  kpis: { monthlyBurn: number; averageMonthlyRevenue: number; runwayMonths: number | null; breakEvenMonthlyRevenue: number | null; openingCash: number }
  series: SeriesPoint[]
  expenseByCategory: Array<{ category: string; label: string; group: ExpenseGroup; amount: number; previous: number; budget: number | null; budgetForPeriod: number | null; share: number | null }>
  expenseByGroup: Array<{ group: ExpenseGroup; label: string; amount: number }>
  revenueSources: Array<{ key: string; label: string; amount: number }>
  branches: Array<{ branchId: string | null; name: string; orders: number; revenue: number; expenses: number; capex: number; operatingProfit: number; operatingMargin: number | null }>
  heatmap: Array<{ weekday: number; hour: number; orders: number; revenue: number }>
  bestSellers: BestSeller[]
  topVendors: Array<{ party: string; amount: number; entries: number }>
  topCustomers: Array<{ party: string; amount: number; entries: number }>
  funding: Array<{ id: string; date: string; kind: "capital" | "withdrawal"; kindLabel: string; category: string; categoryLabel: string; title: string; party: string | null; amount: number; netCapital: number }>
  insights: Array<{ tone: InsightTone; title: string; detail: string }>
  hasLedger: boolean
  /** Single-branch view only: entries filed for the whole business (no branch), which are NOT in these numbers. */
  leftOut: { entries: number; income: number; expenses: number; capital: number; withdrawals: number } | null
}
