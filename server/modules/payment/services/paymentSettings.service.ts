// Payment settings (Owner only): enabled methods, Paystack keys (secret sealed at rest), transfer window,
// bank accounts. Also answers "which methods does this branch offer" for checkout.
import type { PaymentMethod } from "../../../config/constants";
import { paystackClient } from "../../../infrastructure/payments/paystackClient";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { last4, open, seal, secretBoxReady } from "../../../shared/utils/secretBox";
import { AuditService } from "../../audit/services/audit.service";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import type { BankAccount } from "../entities/bankAccount.entity";
import { PaymentSettingsRepository } from "../repositories/paymentSettings.repository";
import type { BankAccountBody, UpdatePaymentSettingsInput } from "../validators/payment.schema";

export interface PaymentSettingsDTO {
  paystackEnabled: boolean;
  transferEnabled: boolean;
  paystackPublicKey: string | null;
  paystackSecretKeyLast4: string | null;
  paystackMode: "test" | "live";
  transferWindowMinutes: number;
  transferInstructions: string | null;
  secretsStorageReady: boolean;
  bankAccounts: BankAccount[];
}

export interface PublicBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export class PaymentSettingsService {
  static Instance = new PaymentSettingsService();
  private constructor(
    private readonly repo = PaymentSettingsRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  async get(actor: Actor): Promise<PaymentSettingsDTO> {
    const s = await this.repo.ensure(actor.organizationId);
    return {
      paystackEnabled: s.paystackEnabled,
      transferEnabled: s.transferEnabled,
      paystackPublicKey: s.paystackPublicKey,
      paystackSecretKeyLast4: s.paystackSecretKeySealed ? this.safeLast4(actor.organizationId, s.paystackSecretKeySealed) : null,
      paystackMode: s.paystackMode,
      transferWindowMinutes: s.transferWindowMinutes,
      transferInstructions: s.transferInstructions,
      secretsStorageReady: secretBoxReady(),
      bankAccounts: await this.repo.bankAccounts(actor.organizationId),
    };
  }

  private safeLast4(organizationId: string, sealed: string): string | null {
    try {
      return last4(open(sealed, organizationId));
    } catch {
      return null;
    }
  }

  async update(actor: Actor, data: UpdatePaymentSettingsInput): Promise<PaymentSettingsDTO> {
    assertPermission(actor, "settings.payments");
    const current = await this.repo.ensure(actor.organizationId);
    const paystackEnabled = data.paystackEnabled ?? current.paystackEnabled;
    const transferEnabled = data.transferEnabled ?? current.transferEnabled;
    if (!paystackEnabled && !transferEnabled) throw AppError.badRequest("At least one payment method must stay enabled");
    const { paystackSecretKey, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (paystackSecretKey !== undefined) {
      patch.paystackSecretKeySealed = paystackSecretKey ? seal(paystackSecretKey, actor.organizationId) : null;
    }
    const hasSecret = paystackSecretKey !== undefined ? Boolean(paystackSecretKey) : Boolean(current.paystackSecretKeySealed);
    if (paystackEnabled && !hasSecret) throw AppError.badRequest("Add the Paystack secret key before enabling Paystack");
    if (transferEnabled && (await this.repo.bankAccounts(actor.organizationId, true)).length === 0 && data.transferEnabled === true) {
      throw AppError.badRequest("Add at least one bank account before enabling bank transfer");
    }
    await this.repo.update(actor.organizationId, patch);
    await this.audit.log(actor, {
      action: "update",
      entityType: "payment_settings",
      entityId: actor.organizationId,
      summary: `Updated payment settings (Paystack ${paystackEnabled ? "on" : "off"}, transfer ${transferEnabled ? "on" : "off"})${paystackSecretKey !== undefined ? ", Paystack secret key changed" : ""}`,
      before: { paystackEnabled: current.paystackEnabled, transferEnabled: current.transferEnabled, paystackMode: current.paystackMode, transferWindowMinutes: current.transferWindowMinutes },
      after: rest as Record<string, unknown>,
    });
    return this.get(actor);
  }

  async testConnection(actor: Actor): Promise<{ ok: true; integration: string | null; mode: "test" | "live" }> {
    assertPermission(actor, "settings.payments");
    const s = await this.repo.ensure(actor.organizationId);
    const key = this.secretFrom(actor.organizationId, s.paystackSecretKeySealed);
    const result = await paystackClient.testConnection(key);
    return { ...result, mode: s.paystackMode };
  }

  private secretFrom(organizationId: string, sealed: string | null): string {
    if (!sealed) throw AppError.badRequest("Paystack is not set up: add the secret key in payment settings");
    return open(sealed, organizationId);
  }

  /** Internal: decrypted Paystack secret for a restaurant. */
  async paystackSecret(organizationId: string): Promise<string> {
    const s = await this.repo.ensure(organizationId);
    return this.secretFrom(organizationId, s.paystackSecretKeySealed);
  }

  async paystackPublicKey(organizationId: string): Promise<string | null> {
    return (await this.repo.ensure(organizationId)).paystackPublicKey;
  }

  // ── Bank accounts ──────────────────────────────────────────────────────────

  async addBankAccount(actor: Actor, data: BankAccountBody): Promise<BankAccount[]> {
    assertPermission(actor, "settings.payments");
    if (data.branchId && !(await this.branches.findById(actor.organizationId, data.branchId))) throw AppError.notFound("Branch not found");
    const account = await this.repo.createBankAccount({ ...data, organizationId: actor.organizationId, branchId: data.branchId ?? null });
    await this.audit.log(actor, { action: "create", entityType: "bank_account", entityId: account.id, summary: `Added bank account ${account.bankName} ${account.accountNumber}` });
    return this.repo.bankAccounts(actor.organizationId);
  }

  async updateBankAccount(actor: Actor, id: string, data: Partial<BankAccountBody>): Promise<BankAccount[]> {
    assertPermission(actor, "settings.payments");
    const account = await this.repo.findBankAccount(actor.organizationId, id);
    if (!account) throw AppError.notFound("Bank account not found");
    await this.repo.updateBankAccount(actor.organizationId, id, data);
    await this.audit.log(actor, { action: "update", entityType: "bank_account", entityId: id, summary: `Updated bank account ${account.bankName} ${account.accountNumber}`, before: account as unknown as Record<string, unknown>, after: data });
    return this.repo.bankAccounts(actor.organizationId);
  }

  async deleteBankAccount(actor: Actor, id: string): Promise<BankAccount[]> {
    assertPermission(actor, "settings.payments");
    const account = await this.repo.findBankAccount(actor.organizationId, id);
    if (!account) throw AppError.notFound("Bank account not found");
    await this.repo.deleteBankAccount(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "bank_account", entityId: id, summary: `Removed bank account ${account.bankName} ${account.accountNumber}` });
    return this.repo.bankAccounts(actor.organizationId);
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  /** Enabled methods for a branch (restaurant settings, narrowed by the branch override). */
  async methodsForBranch(organizationId: string, branchId: string): Promise<{ methods: PaymentMethod[]; paystackPublicKey: string | null; transferWindowMinutes: number }> {
    const [s, branch] = await Promise.all([this.repo.ensure(organizationId), this.branches.findById(organizationId, branchId)]);
    if (!branch) throw AppError.notFound("Branch not found");
    let methods: PaymentMethod[] = [];
    if (s.paystackEnabled && s.paystackSecretKeySealed) methods.push("paystack");
    if (s.transferEnabled && (await this.bankAccountsForBranch(organizationId, branchId)).length > 0) methods.push("transfer");
    if (branch.paymentMethodOverride) methods = methods.filter((m) => m === branch.paymentMethodOverride);
    return { methods, paystackPublicKey: methods.includes("paystack") ? s.paystackPublicKey : null, transferWindowMinutes: s.transferWindowMinutes };
  }

  async bankAccountsForBranch(organizationId: string, branchId: string): Promise<PublicBankAccount[]> {
    const all = await this.repo.bankAccounts(organizationId, true);
    const specific = all.filter((a) => a.branchId === branchId);
    const chosen = specific.length > 0 ? specific : all.filter((a) => a.branchId === null);
    return chosen.map((a) => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber }));
  }

  async transferTerms(organizationId: string): Promise<{ windowMinutes: number; instructions: string | null }> {
    const s = await this.repo.ensure(organizationId);
    return { windowMinutes: s.transferWindowMinutes, instructions: s.transferInstructions };
  }
}
