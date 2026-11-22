// A restaurant's finance categories as a lookup: label, kind, expense group and whether an income category is a sale.
// Pure: no I/O. Unknown keys (a category that was removed) fall back to the key itself and to "running cost".
import type { ExpenseGroup, FinanceKind } from "../catalog/finance.catalog";

export interface CategoryInfo {
  id: string;
  key: string;
  label: string;
  kind: FinanceKind;
  group: ExpenseGroup | null;
  isSale: boolean;
  isBuiltin: boolean;
  isActive: boolean;
  sortOrder: number;
}

export class Catalog {
  private readonly byKey: Map<string, CategoryInfo>;
  constructor(readonly all: readonly CategoryInfo[]) {
    this.byKey = new Map(all.map((c) => [c.key, c]));
  }

  get(key: string): CategoryInfo | undefined {
    return this.byKey.get(key);
  }

  label = (key: string): string => this.byKey.get(key)?.label ?? key;
  kindOf = (key: string): FinanceKind | undefined => this.byKey.get(key)?.kind;
  /** Where an expense sits on the profit-and-loss. Categories nobody can find any more count as running costs. */
  groupOf = (key: string): ExpenseGroup => this.byKey.get(key)?.group ?? "operating";
  isSale = (key: string): boolean => this.byKey.get(key)?.isSale ?? false;

  /** Categories offered for new entries. */
  active(): CategoryInfo[] {
    return this.all.filter((c) => c.isActive);
  }
}
