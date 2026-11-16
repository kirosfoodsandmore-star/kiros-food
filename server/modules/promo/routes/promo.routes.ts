import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PromoController } from "../controllers/promo.controller";
import { createPromoSchema, listPromosSchema, promoIdSchema, updatePromoSchema } from "../validators/promo.schema";

/** /api/v1/admin/promos */
const router = Router();
router.get("/", authMiddleware, requirePermission("promos.view"), validate(listPromosSchema), PromoController.list);
router.post("/", authMiddleware, requirePermission("promos.manage"), validate(createPromoSchema), PromoController.create);
router.put("/:id", authMiddleware, requirePermission("promos.manage"), validate(updatePromoSchema), PromoController.update);
router.delete("/:id", authMiddleware, requirePermission("promos.manage"), validate(promoIdSchema), PromoController.remove);

export default router;
