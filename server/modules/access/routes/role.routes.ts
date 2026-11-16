import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { RoleController } from "../controllers/role.controller";
import { createRoleSchema, roleIdSchema, updateRoleSchema } from "../validators/role.schema";

export const permissionRouter = Router();
permissionRouter.get("/", authMiddleware, requirePermission("staff.manage"), RoleController.permissions);

export const roleRouter = Router();
roleRouter.get("/", authMiddleware, requirePermission("staff.manage"), RoleController.list);
roleRouter.post("/", authMiddleware, requirePermission("staff.manage"), validate(createRoleSchema), RoleController.create);
roleRouter.put("/:id", authMiddleware, requirePermission("staff.manage"), validate(updateRoleSchema), RoleController.update);
roleRouter.delete("/:id", authMiddleware, requirePermission("staff.manage"), validate(roleIdSchema), RoleController.remove);
