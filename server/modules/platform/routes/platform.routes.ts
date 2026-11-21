import { Router } from "express";
import { requirePlatformAdmin } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PlatformController } from "../controllers/platform.controller";
import { emailLogsSchema, emailLogSummarySchema, listRestaurantsSchema, restaurantIdSchema, updatePlatformSettingsSchema } from "../validators/platform.schema";

/** /api/v1/platform — PLATFORM_ADMIN_EMAILS only */
const router = Router();
router.get("/overview", authMiddleware, requirePlatformAdmin(), PlatformController.overview);
router.get("/restaurants", authMiddleware, requirePlatformAdmin(), validate(listRestaurantsSchema), PlatformController.restaurants);
router.get("/settings", authMiddleware, requirePlatformAdmin(), PlatformController.settings);
router.put("/settings", authMiddleware, requirePlatformAdmin(), validate(updatePlatformSettingsSchema), PlatformController.updateSettings);
router.get("/email-logs", authMiddleware, requirePlatformAdmin(), validate(emailLogsSchema), PlatformController.emailLogs);
router.get("/email-logs/summary", authMiddleware, requirePlatformAdmin(), validate(emailLogSummarySchema), PlatformController.emailLogSummary);
router.get("/online", authMiddleware, requirePlatformAdmin(), PlatformController.online);
router.post("/restaurants/:id/suspend", authMiddleware, requirePlatformAdmin(), validate(restaurantIdSchema), PlatformController.suspend);
router.post("/restaurants/:id/unsuspend", authMiddleware, requirePlatformAdmin(), validate(restaurantIdSchema), PlatformController.unsuspend);

export default router;
