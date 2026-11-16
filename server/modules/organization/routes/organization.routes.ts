import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { uploadImage } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { OrganizationController } from "../controllers/organization.controller";
import { updateRestaurantSchema } from "../validators/organization.schema";

/** /api/v1/admin/settings */
export const settingsRouter = Router();
settingsRouter.get("/", authMiddleware, requirePermission("settings.view"), OrganizationController.settings);
settingsRouter.put("/", authMiddleware, requirePermission("settings.manage"), validate(updateRestaurantSchema), OrganizationController.update);
settingsRouter.post("/logo", authMiddleware, requirePermission("settings.manage"), uploadImage("logo", 3), OrganizationController.uploadLogo);
settingsRouter.delete("/logo", authMiddleware, requirePermission("settings.manage"), OrganizationController.removeLogo);
