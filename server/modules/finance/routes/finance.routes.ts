import { Router } from "express";
import { requireAny, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { FinanceController } from "../controllers/finance.controller";
import {
  analyticsSchema,
  createEntrySchema,
  createPartySchema,
  entryIdSchema,
  importEntriesSchema,
  listEntriesSchema,
  mergePartySchema,
  partyIdSchema,
  saleItemsQuerySchema,
  setBudgetsSchema,
  updateEntrySchema,
  updatePartySchema,
} from "../validators/finance.schema";

/**
 * /api/v1/admin/finance
 * Routes say who may knock; the service decides the rest. In particular finance.record_sales (sales-only staff) can
 * record other income and see/correct only their own sales of the day: FinanceService enforces that.
 */
const router = Router();
const viewOrSales = requireAny("finance.view", "finance.record_sales");
const manageOrSales = requireAny("finance.manage", "finance.record_sales");

router.get("/categories", authMiddleware, viewOrSales, FinanceController.categories);
router.get("/analytics", authMiddleware, requirePermission("finance.view"), validate(analyticsSchema), FinanceController.analytics);

router.get("/entries", authMiddleware, viewOrSales, validate(listEntriesSchema), FinanceController.list);
router.post("/entries", authMiddleware, manageOrSales, validate(createEntrySchema), FinanceController.create);
router.post("/entries/import", authMiddleware, requirePermission("finance.manage"), validate(importEntriesSchema), FinanceController.importMany);
router.put("/entries/:id", authMiddleware, manageOrSales, validate(updateEntrySchema), FinanceController.update);
router.delete("/entries/:id", authMiddleware, manageOrSales, validate(entryIdSchema), FinanceController.remove);

router.get("/sale-items", authMiddleware, viewOrSales, validate(saleItemsQuerySchema), FinanceController.saleMenu);
router.get("/parties", authMiddleware, viewOrSales, FinanceController.parties);
router.post("/parties", authMiddleware, requirePermission("finance.manage"), validate(createPartySchema), FinanceController.createParty);
router.put("/parties/:id", authMiddleware, requirePermission("finance.manage"), validate(updatePartySchema), FinanceController.updateParty);
router.post("/parties/:id/merge", authMiddleware, requirePermission("finance.manage"), validate(mergePartySchema), FinanceController.mergeParty);
router.delete("/parties/:id", authMiddleware, requirePermission("finance.manage"), validate(partyIdSchema), FinanceController.removeParty);

router.get("/budgets", authMiddleware, requirePermission("finance.view"), FinanceController.budgets);
router.put("/budgets", authMiddleware, requirePermission("finance.manage"), validate(setBudgetsSchema), FinanceController.setBudgets);

export default router;
