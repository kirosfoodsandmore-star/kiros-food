import { Router } from "express";
import { publicRoute, requireAny, requireCustomer, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { customerAuthMiddleware } from "../../../shared/middleware/customerAuth.middleware";
import { checkoutRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { uploadDocument } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { OrderController as C } from "../controllers/order.controller";
import {
  assignRiderSchema,
  boardSchema,
  changeStatusSchema,
  checkoutSchema,
  listOrdersSchema,
  availabilitySchema,
  respondDeliverySchema,
  myDeliveriesSchema,
  orderIdSchema,
  refundOrderSchema,
  rejectOrderSchema,
  storeOrderIdSchema,
  storeOrdersSchema,
  storePaymentMethodsSchema,
  transferClaimSchema,
} from "../validators/order.schema";

/** /api/v1/store/:slug (checkout + orders) — mergeParams */
export const storeOrderRouter = Router({ mergeParams: true });
storeOrderRouter.get("/branches/:branchId/payment-methods", publicRoute("enabled payment methods for a branch"), validate(storePaymentMethodsSchema), C.paymentMethods);
storeOrderRouter.post("/checkout", customerAuthMiddleware, requireCustomer(), checkoutRateLimiter, validate(checkoutSchema), C.checkout);
storeOrderRouter.get("/orders", customerAuthMiddleware, requireCustomer(), validate(storeOrdersSchema), C.listMine);
storeOrderRouter.get("/orders/:id", customerAuthMiddleware, requireCustomer(), validate(storeOrderIdSchema), C.getMine);
storeOrderRouter.post("/orders/:id/cancel", customerAuthMiddleware, requireCustomer(), validate(storeOrderIdSchema), C.cancelMine);
storeOrderRouter.post("/orders/:id/reorder", customerAuthMiddleware, requireCustomer(), validate(storeOrderIdSchema), C.reorder);
storeOrderRouter.post("/orders/:id/payment/verify", customerAuthMiddleware, requireCustomer(), checkoutRateLimiter, validate(storeOrderIdSchema), C.verifyPayment);
storeOrderRouter.post("/orders/:id/transfer-claim", customerAuthMiddleware, requireCustomer(), checkoutRateLimiter, uploadDocument("receipt", 10), validate(transferClaimSchema), C.transferClaim);

/** /api/v1/admin/orders */
export const adminOrderRouter = Router();
adminOrderRouter.get("/", authMiddleware, requirePermission("orders.view"), validate(listOrdersSchema), C.list);
adminOrderRouter.get("/board", authMiddleware, requirePermission("orders.view"), validate(boardSchema), C.board);
adminOrderRouter.get("/my-deliveries", authMiddleware, requirePermission("orders.deliver"), validate(myDeliveriesSchema), C.myDeliveries);
adminOrderRouter.get("/my-availability", authMiddleware, requirePermission("orders.deliver"), C.myAvailability);
adminOrderRouter.put("/my-availability", authMiddleware, requirePermission("orders.deliver"), validate(availabilitySchema), C.setMyAvailability);
adminOrderRouter.get("/:id",authMiddleware, requirePermission("orders.view"), validate(orderIdSchema), C.get);
adminOrderRouter.get("/:id/riders", authMiddleware, requirePermission("orders.assign_rider"), validate(orderIdSchema), C.riders);
adminOrderRouter.post("/:id/respond", authMiddleware, requirePermission("orders.deliver"), validate(respondDeliverySchema), C.respondToDelivery);
adminOrderRouter.post("/:id/status", authMiddleware, requireAny("orders.update_status", "orders.deliver", "orders.reject"), validate(changeStatusSchema), C.changeStatus);
adminOrderRouter.post("/:id/reject", authMiddleware, requirePermission("orders.reject"), validate(rejectOrderSchema), C.reject);
adminOrderRouter.post("/:id/refund", authMiddleware, requirePermission("orders.refund"), validate(refundOrderSchema), C.refund);
adminOrderRouter.post("/:id/assign-rider", authMiddleware, requirePermission("orders.assign_rider"), validate(assignRiderSchema), C.assignRider);
