import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { FinanceService } from "../services/finance.service";
import { FinanceAnalyticsService } from "../services/financeAnalytics.service";
import { analyticsSchema, createEntrySchema, createPartySchema, entryIdSchema, importEntriesSchema, listEntriesSchema, mergePartySchema, partyIdSchema, saleItemsQuerySchema, setBudgetsSchema, updateEntrySchema, updatePartySchema } from "../validators/finance.schema";

export class FinanceController {
  static categories = handle("Finance categories", async () => FinanceService.Instance.categories());
  static list = handle("Finance entries fetched", async (req) => {
    const result = await FinanceService.Instance.list(actorOf(req), input(req, listEntriesSchema).query);
    if (!("meta" in result)) return result; // CSV download
    // The filtered total rides in the pagination meta's summary so the list stays a plain array.
    return new Paged(result.data, { ...result.meta, summary: { amount: result.sum } });
  });
  static create = handle("Entry recorded", (req) => FinanceService.Instance.create(actorOf(req), input(req, createEntrySchema).body), 201);
  static importMany = handle("Entries imported", (req) => FinanceService.Instance.importMany(actorOf(req), input(req, importEntriesSchema).body.entries), 201);
  static update = handle("Entry updated", (req) => {
    const { params, body } = input(req, updateEntrySchema);
    return FinanceService.Instance.update(actorOf(req), params.id, body);
  });
  static remove = handle("Entry deleted", (req) => FinanceService.Instance.remove(actorOf(req), input(req, entryIdSchema).params.id));
  static budgets = handle("Budgets fetched", (req) => FinanceService.Instance.budgets(actorOf(req)));
  static setBudgets = handle("Budgets saved", (req) => FinanceService.Instance.setBudgets(actorOf(req), input(req, setBudgetsSchema).body.budgets));
  static saleMenu = handle("Menu items for sales", (req) => FinanceService.Instance.menuForSale(actorOf(req), input(req, saleItemsQuerySchema).query.branchId));
  static parties = handle("Vendors & customers", (req) => FinanceService.Instance.listParties(actorOf(req)));
  static createParty = handle("Added", (req) => FinanceService.Instance.createParty(actorOf(req), input(req, createPartySchema).body), 201);
  static updateParty = handle("Saved", (req) => {
    const { params, body } = input(req, updatePartySchema);
    return FinanceService.Instance.updateParty(actorOf(req), params.id, body);
  });
  static mergeParty = handle("Merged", (req) => {
    const { params, body } = input(req, mergePartySchema);
    return FinanceService.Instance.mergeParty(actorOf(req), params.id, body.intoId);
  });
  static removeParty = handle("Removed", (req) => FinanceService.Instance.removeParty(actorOf(req), input(req, partyIdSchema).params.id));
  static analytics = handle("Business analytics", (req) => FinanceAnalyticsService.Instance.analytics(actorOf(req), input(req, analyticsSchema).query));
}
