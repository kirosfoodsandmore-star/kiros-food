import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { AvailabilityController } from "../controllers/availability.controller";
import { bulkSetAvailabilitySchema, listAvailabilitySchema, setAvailabilitySchema } from "../validators/availability.schema";

/** /api/v1/admin/availability */
const router = Router();
router.get("/", authMiddleware, requirePermission("availability.view"), validate(listAvailabilitySchema), AvailabilityController.list);
router.put("/", authMiddleware, requirePermission("availability.toggle"), validate(setAvailabilitySchema), AvailabilityController.set);
router.put("/bulk", authMiddleware, requirePermission("availability.toggle"), validate(bulkSetAvailabilitySchema), AvailabilityController.setMany);

export default router;
