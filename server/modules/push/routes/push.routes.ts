import { Router } from "express";
import { requireAuthenticatedOnly, requireCustomer } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { customerAuthMiddleware } from "../../../shared/middleware/customerAuth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PushController as C } from "../controllers/push.controller";
import { pushTokenSchema } from "../validators/push.schema";

/** /api/v1/admin/push: any signed-in staff member can turn notifications on for their own device. */
export const adminPushRouter = Router();
adminPushRouter.get("/status", authMiddleware, requireAuthenticatedOnly(), C.status);
adminPushRouter.post("/test", authMiddleware, requireAuthenticatedOnly(), C.test);
adminPushRouter.put("/token", authMiddleware, requireAuthenticatedOnly(), validate(pushTokenSchema), C.register);
adminPushRouter.delete("/token", authMiddleware, requireAuthenticatedOnly(), validate(pushTokenSchema), C.unregister);

/** /api/v1/store/:slug/push (mergeParams): a signed-in customer turns reply alerts on for their own device. */
export const storePushRouter = Router({ mergeParams: true });
storePushRouter.put("/token", customerAuthMiddleware, requireCustomer(), validate(pushTokenSchema), C.customerRegister);
storePushRouter.delete("/token", customerAuthMiddleware, requireCustomer(), validate(pushTokenSchema), C.customerUnregister);
