import type { Request, Response } from "express";
import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { PaymentService } from "../services/payment.service";
import { PaymentSettingsService } from "../services/paymentSettings.service";
import { bankAccountIdSchema, createBankAccountSchema, paymentIdSchema, paymentQueueSchema, rejectPaymentSchema, updateBankAccountSchema, updatePaymentSettingsSchema } from "../validators/payment.schema";

export class PaymentController {
  // Settings (Owner)
  static settings = handle("Payment settings fetched", (req) => PaymentSettingsService.Instance.get(actorOf(req)));
  static updateSettings = handle("Payment settings updated", (req) => PaymentSettingsService.Instance.update(actorOf(req), input(req, updatePaymentSettingsSchema).body));
  static testConnection = handle("Paystack connection works", (req) => PaymentSettingsService.Instance.testConnection(actorOf(req)));
  static addBankAccount = handle("Bank account added", (req) => PaymentSettingsService.Instance.addBankAccount(actorOf(req), input(req, createBankAccountSchema).body), 201);
  static updateBankAccount = handle("Bank account updated", (req) => {
    const { params, body } = input(req, updateBankAccountSchema);
    return PaymentSettingsService.Instance.updateBankAccount(actorOf(req), params.id, body);
  });
  static deleteBankAccount = handle("Bank account removed", (req) => PaymentSettingsService.Instance.deleteBankAccount(actorOf(req), input(req, bankAccountIdSchema).params.id));

  // Payments to confirm
  static queue = handle("Payments to confirm", (req) => {
    const { query } = input(req, paymentQueueSchema);
    return PaymentService.Instance.queue(actorOf(req), query).then(Paged.of);
  });
  static confirm = handle("Payment confirmed", (req) => PaymentService.Instance.confirm(actorOf(req), input(req, paymentIdSchema).params.id));
  static reject = handle("Payment rejected", (req) => {
    const { params, body } = input(req, rejectPaymentSchema);
    return PaymentService.Instance.reject(actorOf(req), params.id, body.reason);
  });

  /** Paystack webhook: answers 200 quickly; signature failures are 401. */
  static async paystackWebhook(req: Request, res: Response): Promise<void> {
    try {
      const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const result = await PaymentService.Instance.handlePaystackWebhook(raw, req.get("x-paystack-signature"));
      res.status(200).json(ApiResponse.ok("ok", result));
    } catch (err) {
      const status = err instanceof Error && "statusCode" in err ? (err as { statusCode: number }).statusCode : 500;
      if (status >= 500) console.error("[webhook] paystack failed", err);
      res.status(status >= 500 ? 500 : status).json(ApiResponse.error(status >= 500 ? "Webhook failed" : (err as Error).message, status));
    }
  }
}
