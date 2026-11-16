import { Router } from "express";
import { publicRoute, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { BranchController } from "../controllers/branch.controller";
import {
  addClosureSchema,
  branchIdSchema,
  closureIdSchema,
  createBranchSchema,
  createZoneSchema,
  listBranchesQuerySchema,
  pauseBranchSchema,
  setHoursSchema,
  storeBranchesSchema,
  storeBranchIdSchema,
  storeDeliveryQuoteSchema,
  storeSlotsSchema,
  updateBranchSchema,
  updateZoneSchema,
  zoneIdSchema,
} from "../validators/branch.schema";

/** /api/v1/admin/branches */
export const adminBranchRouter = Router();
adminBranchRouter.get("/", authMiddleware, requirePermission("branches.view"), validate(listBranchesQuerySchema), BranchController.list);
adminBranchRouter.post("/", authMiddleware, requirePermission("branches.edit"), validate(createBranchSchema), BranchController.create);
adminBranchRouter.get("/:id", authMiddleware, requirePermission("branches.view"), validate(branchIdSchema), BranchController.get);
adminBranchRouter.put("/:id", authMiddleware, requirePermission("branches.edit"), validate(updateBranchSchema), BranchController.update);
adminBranchRouter.delete("/:id", authMiddleware, requirePermission("branches.edit"), validate(branchIdSchema), BranchController.remove);
adminBranchRouter.post("/:id/pause", authMiddleware, requirePermission("branches.pause"), validate(pauseBranchSchema), BranchController.pause);
adminBranchRouter.put("/:id/hours", authMiddleware, requirePermission("branches.edit"), validate(setHoursSchema), BranchController.setHours);
adminBranchRouter.post("/:id/closures", authMiddleware, requirePermission("branches.edit"), validate(addClosureSchema), BranchController.addClosure);
adminBranchRouter.delete("/:id/closures/:closureId", authMiddleware, requirePermission("branches.edit"), validate(closureIdSchema), BranchController.removeClosure);
adminBranchRouter.post("/:id/zones", authMiddleware, requirePermission("branches.edit"), validate(createZoneSchema), BranchController.createZone);
adminBranchRouter.put("/:id/zones/:zoneId", authMiddleware, requirePermission("branches.edit"), validate(updateZoneSchema), BranchController.updateZone);
adminBranchRouter.delete("/:id/zones/:zoneId", authMiddleware, requirePermission("branches.edit"), validate(zoneIdSchema), BranchController.deleteZone);

/** /api/v1/store/:slug/branches — mounted with mergeParams */
export const storeBranchRouter = Router({ mergeParams: true });
storeBranchRouter.get("/", publicRoute("storefront branch list"), validate(storeBranchesSchema), BranchController.storeList);
storeBranchRouter.get("/:id", publicRoute("storefront branch detail"), validate(storeBranchIdSchema), BranchController.storeGet);
storeBranchRouter.get("/:id/slots", publicRoute("storefront time slots"), validate(storeSlotsSchema), BranchController.storeSlots);
storeBranchRouter.get("/:id/delivery-quote", publicRoute("storefront delivery quote"), validate(storeDeliveryQuoteSchema), BranchController.storeDeliveryQuote);
