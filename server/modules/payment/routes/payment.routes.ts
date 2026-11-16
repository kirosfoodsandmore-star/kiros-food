import { Router } from "express";
import { publicRoute, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PaymentController as C } from "../controllers/payment.controller";
import { bankAccountIdSchema, createBankAccountSchema, paymentIdSchema, paymentQueueSchema, rejectPaymentSchema, updateBankAccountSchema, updatePaymentSettingsSchema } from "../validators/payment.schema";

/** /api/v1/admin/settings/payments */
export const paymentSettingsRouter = Router();
paymentSettingsRouter.get("/", authMiddleware, requirePermission("settings.payments"), C.settings);
paymentSettingsRouter.put("/", authMiddleware, requirePermission("settings.payments"), validate(updatePaymentSettingsSchema), C.updateSettings);
paymentSettingsRouter.post("/test", authMiddleware, requirePermission("settings.payments"), C.testConnection);
paymentSettingsRouter.post("/bank-accounts", authMiddleware, requirePermission("settings.payments"), validate(createBankAccountSchema), C.addBankAccount);
paymentSettingsRouter.put("/bank-accounts/:id", authMiddleware, requirePermission("settings.payments"), validate(updateBankAccountSchema), C.updateBankAccount);
paymentSettingsRouter.delete("/bank-accounts/:id", authMiddleware, requirePermission("settings.payments"), validate(bankAccountIdSchema), C.deleteBankAccount);

/** /api/v1/admin/payments */
export const adminPaymentRouter = Router();
adminPaymentRouter.get("/", authMiddleware, requirePermission("payments.view"), validate(paymentQueueSchema), C.queue);
adminPaymentRouter.post("/:id/confirm", authMiddleware, requirePermission("payments.confirm"), validate(paymentIdSchema), C.confirm);
adminPaymentRouter.post("/:id/reject", authMiddleware, requirePermission("payments.confirm"), validate(rejectPaymentSchema), C.reject);

/** /api/v1/webhooks */
export const webhookRouter = Router();
webhookRouter.post("/paystack", publicRoute("Paystack webhook (signature-checked)"), C.paystackWebhook);
