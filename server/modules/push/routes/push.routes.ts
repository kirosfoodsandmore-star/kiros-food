import { Router } from "express";
import { requireAuthenticatedOnly } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PushController as C } from "../controllers/push.controller";
import { pushTokenSchema } from "../validators/push.schema";

/** /api/v1/admin/push: any signed-in staff member can turn notifications on for their own device. */
export const adminPushRouter = Router();
adminPushRouter.get("/status", authMiddleware, requireAuthenticatedOnly(), C.status);
adminPushRouter.put("/token", authMiddleware, requireAuthenticatedOnly(), validate(pushTokenSchema), C.register);
adminPushRouter.delete("/token", authMiddleware, requireAuthenticatedOnly(), validate(pushTokenSchema), C.unregister);
