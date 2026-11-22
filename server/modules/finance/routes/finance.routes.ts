import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { FinanceController } from "../controllers/finance.controller";
import { analyticsSchema, createEntrySchema, entryIdSchema, importEntriesSchema, listEntriesSchema, setBudgetsSchema, updateEntrySchema } from "../validators/finance.schema";

/** /api/v1/admin/finance */
const router = Router();
router.get("/categories", authMiddleware, requirePermission("finance.view"), FinanceController.categories);
router.get("/analytics", authMiddleware, requirePermission("finance.view"), validate(analyticsSchema), FinanceController.analytics);
router.get("/entries", authMiddleware, requirePermission("finance.view"), validate(listEntriesSchema), FinanceController.list);
router.post("/entries", authMiddleware, requirePermission("finance.manage"), validate(createEntrySchema), FinanceController.create);
router.post("/entries/import", authMiddleware, requirePermission("finance.manage"), validate(importEntriesSchema), FinanceController.importMany);
router.put("/entries/:id", authMiddleware, requirePermission("finance.manage"), validate(updateEntrySchema), FinanceController.update);
router.delete("/entries/:id", authMiddleware, requirePermission("finance.manage"), validate(entryIdSchema), FinanceController.remove);
router.get("/budgets", authMiddleware, requirePermission("finance.view"), FinanceController.budgets);
router.put("/budgets", authMiddleware, requirePermission("finance.manage"), validate(setBudgetsSchema), FinanceController.setBudgets);

export default router;
