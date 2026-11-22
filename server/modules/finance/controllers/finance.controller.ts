import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { FinanceService } from "../services/finance.service";
import { FinanceAnalyticsService } from "../services/financeAnalytics.service";
import { analyticsSchema, createEntrySchema, entryIdSchema, importEntriesSchema, listEntriesSchema, setBudgetsSchema, updateEntrySchema } from "../validators/finance.schema";

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
  static analytics = handle("Business analytics", (req) => FinanceAnalyticsService.Instance.analytics(actorOf(req), input(req, analyticsSchema).query));
}
