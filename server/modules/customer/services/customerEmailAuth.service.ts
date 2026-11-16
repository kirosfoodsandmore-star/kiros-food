// Optional customer accounts by email: "email me a code". Customers never have to do this to order (guest
// checkout is the default); it exists so they can come back to their orders from any device.
//
// Safety: only a customer who has entered the emailed code is treated as the owner of that address. When the
// code is verified, any guest records that used that address (and the guest session making the request) are
// merged into the one account, so earlier orders aren't lost. Nothing is merged without the code.
import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import type { ClientContext } from "../../../shared/http/handler";
import type { CustomerActor } from "../../../shared/types/actor";
import { hashToken, sixDigitCode, timingSafeEqualString } from "../../../shared/utils/jwt";
import { EmailNotifierService } from "../../notification/services/emailNotifier.service";
import type { CustomerLoginResultDTO } from "../dto/customer.dto";
import type { Customer } from "../entities/customer.entity";
import { CustomerEmailCodeRepository } from "../repositories/customerEmailCode.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import type { CustomerEmailVerifyInput } from "../validators/customer.schema";
import { CustomerAuthService } from "./customerAuth.service";

const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_15_MIN = 3;
const isAccount = (c: Customer) => Boolean(c.firebaseUid || c.emailVerifiedAt);

export class CustomerEmailAuthService {
  static Instance = new CustomerEmailAuthService();
  private constructor(
    private readonly customers = CustomerRepository.Instance,
    private readonly codes = CustomerEmailCodeRepository.Instance,
    private readonly auth = CustomerAuthService.Instance,
    private readonly notifier = EmailNotifierService.Instance
  ) {}

  private key(organizationId: string, email: string, code: string): string {
    return `custmail:${organizationId}:${email}:${code}`;
  }

  /** Emails a code. The same call signs people in and signs them up, so it never reveals whether an account exists. */
  async request(organizationId: string, email: string): Promise<{ sent: true; devCode?: string }> {
    if ((await this.codes.countRecent(organizationId, email, 15)) >= MAX_CODES_PER_15_MIN) throw AppError.badRequest("Too many codes requested. Please wait a few minutes and try again.");
    const code = sixDigitCode();
    const minutes = env.otpTtlMinutes;
    await this.codes.create(organizationId, email, hashToken(this.key(organizationId, email, code)), new Date(Date.now() + minutes * 60_000));
    const delivered = await this.notifier.customerSignInCode(organizationId, email, code, minutes);
    if (!delivered) {
      if (env.isProduction) throw AppError.unavailable("We couldn't email you a code just now. Please try again in a moment.");
      return { sent: true, devCode: code }; // development only: nothing was delivered (no email set up, or a reserved test address)
    }
    return { sent: true };
  }

  async verify(organizationId: string, data: CustomerEmailVerifyInput, session: CustomerActor | null, client: ClientContext): Promise<CustomerLoginResultDTO> {
    const guestSession = session && session.organizationId === organizationId ? session : null;
    const outcome = await inTransaction(async (tx) => {
      const row = await this.codes.activeForUpdate(organizationId, data.email, tx);
      if (!row || row.attempts >= MAX_ATTEMPTS) return { reason: "invalid" as const };
      if (!timingSafeEqualString(row.codeHash, hashToken(this.key(organizationId, data.email, data.code)))) {
        await this.codes.addAttempt(row.id, tx);
        return { reason: "invalid" as const };
      }
      await this.codes.markUsed(row.id, tx);

      const now = new Date();
      const withEmail = await this.customers.findAllByEmail(organizationId, data.email, tx);
      const sessionRow = guestSession ? await this.customers.findById(organizationId, guestSession.id, tx) : null;
      const sessionGuest = sessionRow && !isAccount(sessionRow) ? sessionRow : null;
      // The account is: an existing account with this address, else the guest record making this request, else the
      // oldest guest record that used this address, else a new customer.
      const primary = withEmail.find(isAccount) ?? sessionGuest ?? withEmail[0] ?? null;
      if (primary?.isBlocked) return { reason: "blocked" as const };

      const absorb = [...withEmail, ...(sessionGuest ? [sessionGuest] : [])].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i && c.id !== primary?.id && !isAccount(c) && !c.isBlocked);
      const current = primary ?? (await this.customers.create({ organizationId, email: data.email, emailVerifiedAt: now, name: data.name ?? null, lastSeenAt: now }, tx));
      let phone: string | null = null;
      for (const other of absorb) {
        const merged = await this.customers.mergeInto(current.id, other.id, tx);
        phone = phone ?? merged.phone;
      }
      const name = current.name ?? data.name ?? absorb.find((c) => c.name)?.name ?? null;
      await this.customers.update(
        organizationId,
        current.id,
        { email: data.email, emailVerifiedAt: current.emailVerifiedAt ?? now, ...(name && !current.name ? { name } : {}), ...(phone && !current.phone ? { phone } : {}), lastSeenAt: now },
        tx
      );
      return { customerId: current.id };
    });
    if ("reason" in outcome) {
      if (outcome.reason === "blocked") throw AppError.forbidden("Your account has been blocked by the restaurant");
      throw AppError.badRequest("That code is wrong or has expired. Request a new one.");
    }
    return this.auth.startSession(organizationId, outcome.customerId, client);
  }
}
