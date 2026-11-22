// Express wiring. Three surfaces: /api/v1/store/:slug (storefront, public + customer tokens),
// /api/v1/admin (staff), /api/v1/platform (platform operators), plus /api/v1/auth and /api/v1/webhooks.
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import path from "node:path";
import { permissionRouter, roleRouter } from "./modules/access/routes/role.routes";
import auditRoutes from "./modules/audit/routes/audit.routes";
import authRoutes from "./modules/auth/routes/auth.routes";
import availabilityRoutes from "./modules/availability/routes/availability.routes";
import { adminBranchRouter, storeBranchRouter } from "./modules/branch/routes/branch.routes";
import cartRoutes from "./modules/cart/routes/cart.routes";
import { adminChatRouter, storeChatRouter } from "./modules/chat/routes/chat.routes";
import { adminCustomerRouter, storeAddressRouter, storeCustomerAuthRouter } from "./modules/customer/routes/customer.routes";
import { adminCategoryRouter, adminItemRouter, adminMenuRouter, adminOptionGroupRouter, storeMenuRouter } from "./modules/menu/routes/menu.routes";
import { adminOrderRouter, storeOrderRouter } from "./modules/order/routes/order.routes";
import { adminPushRouter, storePushRouter } from "./modules/push/routes/push.routes";
import { OrganizationController } from "./modules/organization/controllers/organization.controller";
import { settingsRouter } from "./modules/organization/routes/organization.routes";
import { contactMessageSchema } from "./modules/organization/validators/contact.schema";
import { slugParams } from "./modules/organization/validators/organization.schema";
import { adminPaymentRouter, paymentSettingsRouter, webhookRouter } from "./modules/payment/routes/payment.routes";
import platformRoutes from "./modules/platform/routes/platform.routes";
import financeRoutes from "./modules/finance/routes/finance.routes";
import promoRoutes from "./modules/promo/routes/promo.routes";
import { dashboardRouter, reportRouter } from "./modules/report/routes/report.routes";
import staffRoutes from "./modules/user/routes/staff.routes";
import { publicRoute } from "./shared/access/can";
import { enforceRouteGuards } from "./shared/access/routeAudit";
import { isAllowedOrigin } from "./shared/http/cors";
import { globalErrorHandler, notFoundHandler } from "./shared/middleware/errorHandler.middleware";
import { apiRateLimiter, contactRateLimiter } from "./shared/middleware/rateLimiter.middleware";
import { validate } from "./shared/middleware/validate.middleware";
import { ApiResponse } from "./shared/response/apiResponse";

export function createApp(): Application {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true, exposedHeaders: ["Content-Disposition"] }));
  // Keep the raw body for webhook signature checks.
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // Brand artwork for emails (they need a public web address for images): server/public/brand
  app.use("/brand", express.static(path.join(__dirname, "public", "brand"), { maxAge: "7d", index: false, fallthrough: true }));

  const health = express.Router();
  health.get("/", publicRoute("health check"), (_req, res) => {
    res.json(ApiResponse.ok("Kiros API is running", { status: "ok", time: new Date().toISOString() }));
  });
  app.use("/health", health);

  const v1 = express.Router();
  v1.use(apiRateLimiter);

  // ── Staff auth & webhooks ──────────────────────────────────────────────────
  v1.use("/auth", authRoutes);
  v1.use("/webhooks", webhookRouter);

  // ── Storefront: /api/v1/store/:slug/… ──────────────────────────────────────
  const store = express.Router({ mergeParams: true });
  store.get("/", publicRoute("storefront restaurant profile"), validate(slugParams), OrganizationController.storefront);
  store.post("/contact", publicRoute("storefront contact form"), contactRateLimiter, validate(contactMessageSchema), OrganizationController.contact);
  store.use("/branches", storeBranchRouter);
  store.use("/", storeMenuRouter); // /branches/:branchId/menus, /menus/:id, /items/:id, /search, /featured
  store.use("/carts", cartRoutes);
  store.use("/auth", storeCustomerAuthRouter);
  store.use("/addresses", storeAddressRouter);
  store.use("/push", storePushRouter);
  store.use("/", storeChatRouter); // /orders/:id/chat (declared before the order router's /orders/:id)
  store.use("/", storeOrderRouter); // /branches/:branchId/payment-methods, /checkout, /orders…
  v1.use("/store/:slug", store);

  // ── Admin portal: /api/v1/admin/… ──────────────────────────────────────────
  const admin = express.Router();
  admin.use("/permissions", permissionRouter);
  admin.use("/roles", roleRouter);
  admin.use("/staff", staffRoutes);
  admin.use("/settings/payments", paymentSettingsRouter);
  admin.use("/settings", settingsRouter);
  admin.use("/branches", adminBranchRouter);
  admin.use("/menus", adminMenuRouter);
  admin.use("/categories", adminCategoryRouter);
  admin.use("/items", adminItemRouter);
  admin.use("/option-groups", adminOptionGroupRouter);
  admin.use("/availability", availabilityRoutes);
  admin.use("/promos", promoRoutes);
  admin.use("/customers", adminCustomerRouter);
  admin.use("/orders", adminOrderRouter);
  admin.use("/push", adminPushRouter);
  admin.use("/payments", adminPaymentRouter);
  admin.use("/chat", adminChatRouter);
  admin.use("/reports", reportRouter);
  admin.use("/dashboard", dashboardRouter);
  admin.use("/finance", financeRoutes);
  admin.use("/audit-logs", auditRoutes);
  v1.use("/admin", admin);

  // ── Platform operators ─────────────────────────────────────────────────────
  v1.use("/platform", platformRoutes);

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  // Deny-by-default: any route that forgot its access guard is blocked (and logged).
  enforceRouteGuards(app);
  return app;
}
