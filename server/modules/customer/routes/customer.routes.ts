import { Router } from "express";
import { publicRoute, requireCustomer, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { customerAuthMiddleware, optionalCustomerAuth } from "../../../shared/middleware/customerAuth.middleware";
import { authRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CustomerController as C } from "../controllers/customer.controller";
import {
  addressIdSchema,
  blockCustomerSchema,
  createAddressSchema,
  customerFirebaseSignInSchema,
  customerEmailStartSchema,
  customerEmailVerifySchema,
  customerGuestSchema,
  customerIdSchema,
  customerRefreshSchema,
  listCustomersSchema,
  storeSlugOnlySchema,
  updateAddressSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

/** /api/v1/store/:slug/auth — customers (mergeParams) */
export const storeCustomerAuthRouter = Router({ mergeParams: true });
storeCustomerAuthRouter.post("/firebase", publicRoute("customer sign-in with a Firebase ID token (phone / Google)"), authRateLimiter, validate(customerFirebaseSignInSchema), C.firebase);
storeCustomerAuthRouter.post("/guest", publicRoute("guest checkout: starts an anonymous customer session"), authRateLimiter, validate(customerGuestSchema), C.guest);
storeCustomerAuthRouter.post("/email/start", publicRoute("emails a sign-in code to a customer (sign in or sign up)"), authRateLimiter, validate(customerEmailStartSchema), C.emailStart);
storeCustomerAuthRouter.post("/email/verify", publicRoute("verifies the emailed code; merges the guest session into the account"), optionalCustomerAuth, authRateLimiter, validate(customerEmailVerifySchema), C.emailVerify);
storeCustomerAuthRouter.post("/refresh", publicRoute("customer token refresh"), authRateLimiter, validate(customerRefreshSchema), C.refresh);
storeCustomerAuthRouter.post("/logout", publicRoute("customer sign-out"), validate(customerRefreshSchema), C.logout);
storeCustomerAuthRouter.get("/me", customerAuthMiddleware, requireCustomer(), validate(storeSlugOnlySchema), C.me);
storeCustomerAuthRouter.patch("/me", customerAuthMiddleware, requireCustomer(), validate(updateCustomerSchema), C.updateMe);

/** /api/v1/store/:slug/addresses (mergeParams) */
export const storeAddressRouter = Router({ mergeParams: true });
storeAddressRouter.get("/", customerAuthMiddleware, requireCustomer(), validate(storeSlugOnlySchema), C.addresses);
storeAddressRouter.post("/", customerAuthMiddleware, requireCustomer(), validate(createAddressSchema), C.addAddress);
storeAddressRouter.put("/:id", customerAuthMiddleware, requireCustomer(), validate(updateAddressSchema), C.updateAddress);
storeAddressRouter.delete("/:id", customerAuthMiddleware, requireCustomer(), validate(addressIdSchema), C.deleteAddress);

/** /api/v1/admin/customers */
export const adminCustomerRouter = Router();
adminCustomerRouter.get("/", authMiddleware, requirePermission("customers.view"), validate(listCustomersSchema), C.list);
adminCustomerRouter.get("/:id", authMiddleware, requirePermission("customers.view"), validate(customerIdSchema), C.get);
adminCustomerRouter.post("/:id/block", authMiddleware, requirePermission("customers.block"), validate(blockCustomerSchema), C.block);
adminCustomerRouter.post("/:id/unblock", authMiddleware, requirePermission("customers.block"), validate(customerIdSchema), C.unblock);
