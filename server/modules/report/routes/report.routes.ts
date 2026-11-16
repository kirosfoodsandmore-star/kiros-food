import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ReportController } from "../controllers/report.controller";
import { dashboardSchema, salesReportSchema } from "../validators/report.schema";

/** /api/v1/admin/reports */
export const reportRouter = Router();
reportRouter.get("/sales", authMiddleware, requirePermission("reports.view"), validate(salesReportSchema), ReportController.sales);

/** /api/v1/admin/dashboard */
export const dashboardRouter = Router();
dashboardRouter.get("/", authMiddleware, requirePermission("dashboard.view"), validate(dashboardSchema), ReportController.dashboard);
