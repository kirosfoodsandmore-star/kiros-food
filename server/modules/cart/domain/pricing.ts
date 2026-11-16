// Pure cart pricing + validation. The server computes every amount; the client total is display only.
import type { StoreOptionGroupDTO } from "../../menu/dto/menu.dto";
import type { ItemRow } from "../../menu/repositories/menu.repository";
import type { OrderLineOption } from "../../order/entities/orderLine.entity";

export interface LineInput {
  id: string;
  itemId: string;
  quantity: number;
  note: string | null;
  selectedOptionIds: string[];
}

export type WarningCode = "item_unavailable" | "item_sold_out" | "option_sold_out" | "option_invalid" | "group_rule";

export interface LineWarning {
  lineId: string;
  code: WarningCode;
  message: string;
  /** The customer can fix it by changing an option (otherwise the line must be removed). */
  canChangeOption: boolean;
}

export interface PricedLine {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantity: number;
  note: string | null;
  unitPrice: number;
  lineTotal: number;
  options: OrderLineOption[];
  optionSummary: string;
  warnings: LineWarning[];
}

export interface PricingCatalog {
  rows: ItemRow[];
  groups: Map<string, StoreOptionGroupDTO[]>;
  soldOutItems: Set<string>;
  served: Set<string>;
}

export function priceLines(lines: LineInput[], catalog: PricingCatalog): { lines: PricedLine[]; subtotal: number; warnings: LineWarning[] } {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const row = catalog.rows.find((r) => r.id === line.itemId);
    const warnings: LineWarning[] = [];
    if (!row || !row.isActive || !catalog.served.has(row.menuId)) {
      priced.push({
        id: line.id,
        itemId: line.itemId,
        itemName: row?.name ?? "Unavailable item",
        categoryName: row?.categoryName ?? null,
        imageUrl: row?.imageUrl ?? null,
        quantity: line.quantity,
        note: line.note,
        unitPrice: 0,
        lineTotal: 0,
        options: [],
        optionSummary: "",
        warnings: [{ lineId: line.id, code: "item_unavailable", message: "This item is no longer on the menu at this branch", canChangeOption: false }],
      });
      continue;
    }
    if (catalog.soldOutItems.has(row.id)) warnings.push({ lineId: line.id, code: "item_sold_out", message: `${row.name} is sold out right now`, canChangeOption: false });

    const groups = catalog.groups.get(row.id) ?? [];
    const chosen = new Set(line.selectedOptionIds);
    const options: OrderLineOption[] = [];
    let delta = 0;
    for (const g of groups) {
      const picked = g.options.filter((o) => chosen.has(o.id));
      for (const o of picked) {
        chosen.delete(o.id);
        if (!o.isAvailable) warnings.push({ lineId: line.id, code: "option_sold_out", message: `${o.name} (${g.name}) is sold out`, canChangeOption: true });
        options.push({ optionId: o.id, groupId: g.id, groupName: g.name, name: o.name, priceDelta: o.priceDelta });
        delta += o.priceDelta;
      }
      if (picked.length < g.minSelect) warnings.push({ lineId: line.id, code: "group_rule", message: `Choose at least ${g.minSelect} for ${g.name}`, canChangeOption: true });
      if (picked.length > g.maxSelect) warnings.push({ lineId: line.id, code: "group_rule", message: `Choose at most ${g.maxSelect} for ${g.name}`, canChangeOption: true });
    }
    if (chosen.size > 0) warnings.push({ lineId: line.id, code: "option_invalid", message: "One of the chosen options no longer exists", canChangeOption: true });

    const unitPrice = Math.max(0, Number(row.basePrice) + delta);
    priced.push({
      id: line.id,
      itemId: row.id,
      itemName: row.name,
      categoryName: row.categoryName,
      imageUrl: row.imageUrl,
      quantity: line.quantity,
      note: line.note,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
      options,
      optionSummary: options.map((o) => o.name).join(", "),
      warnings,
    });
  }
  const subtotal = priced.filter((l) => l.warnings.length === 0).reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines: priced, subtotal, warnings: priced.flatMap((l) => l.warnings) };
}

/** Same item, same options (order-insensitive) and same note → one line. */
export function sameLine(a: { itemId: string; note: string | null; selectedOptionIds: string[] }, b: { itemId: string; note: string | null; selectedOptionIds: string[] }): boolean {
  if (a.itemId !== b.itemId || (a.note ?? "") !== (b.note ?? "")) return false;
  const x = [...a.selectedOptionIds].sort().join(",");
  const y = [...b.selectedOptionIds].sort().join(",");
  return x === y;
}
