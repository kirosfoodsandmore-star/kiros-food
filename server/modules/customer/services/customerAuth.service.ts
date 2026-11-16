// Customer sign-in: the storefront signs the customer in with Firebase (Phone Auth sends the SMS code;
// Google is also allowed) and posts the ID token here. The server verifies it, finds or creates the
// customer record for this restaurant, and issues its own customer JWT + refresh token.
import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import { FirebaseAuthService } from "../../../shared/firebase/firebaseAuth.service";
import type { ClientContext } from "../../../shared/http/handler";
import type { CustomerActor } from "../../../shared/types/actor";
import { hashRefreshToken, newRefreshToken, signCustomerToken } from "../../../shared/utils/jwt";
import { RefreshTokenRepository } from "../../auth/repositories/refreshToken.repository";
import type { CustomerLoginResultDTO, CustomerSessionDTO } from "../dto/customer.dto";
import type { Customer } from "../entities/customer.entity";
import { CustomerRepository } from "../repositories/customer.repository";
import type { CustomerFirebaseSignInInput, CustomerGuestInput } from "../validators/customer.schema";

export class CustomerAuthService {
  static Instance = new CustomerAuthService();
  private constructor(
    private readonly customers = CustomerRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly firebase = FirebaseAuthService.Instance
  ) {}

  async signInWithFirebase(organizationId: string, data: CustomerFirebaseSignInInput, client: ClientContext): Promise<CustomerLoginResultDTO> {
    const identity = await this.firebase.verifyIdToken(data.idToken);
    const phone = identity.phone ?? data.phone ?? null;
    const email = identity.email && identity.emailVerified ? identity.email : null;
    if (!phone && !email) throw AppError.badRequest("Sign in with your phone number or a verified Google account");

    let customer = await this.customers.findByUid(organizationId, identity.uid);
    if (!customer && phone) customer = await this.customers.findByPhone(organizationId, phone);
    if (!customer && email) customer = await this.customers.findByEmail(organizationId, email);

    if (customer) {
      if (customer.isBlocked) throw AppError.forbidden("Your account has been blocked by the restaurant");
      const patch: Partial<Customer> = {};
      if (!customer.firebaseUid) patch.firebaseUid = identity.uid;
      if (!customer.phone && phone) patch.phone = phone;
      if (!customer.email && email) patch.email = email;
      if (!customer.name && (data.name || identity.name)) patch.name = data.name ?? identity.name;
      patch.lastSeenAt = new Date();
      await this.customers.update(organizationId, customer.id, patch);
    } else {
      customer = await this.customers.create({ organizationId, firebaseUid: identity.uid, phone, email, name: data.name ?? identity.name ?? null, lastSeenAt: new Date() });
    }
    const tokens = await this.issueTokens(customer.id, organizationId, client);
    return { ...(await this.session({ id: customer.id, organizationId, phone: customer.phone ?? "", name: customer.name, email: customer.email })), tokens };
  }

  /**
   * Guest checkout. Always creates a NEW customer: nothing is looked up by name, email or phone, so a guest can
   * never be handed someone else's orders or saved addresses. The session lets this browser pay, track the order
   * and chat about it, exactly like a signed-in customer. (Blocks are enforced at checkout by phone number.)
   */
  async signInAsGuest(organizationId: string, data: CustomerGuestInput, client: ClientContext): Promise<CustomerLoginResultDTO> {
    const customer = await this.customers.create({ organizationId, firebaseUid: null, phone: null, email: data.email || null, name: data.name, lastSeenAt: new Date() });
    const tokens = await this.issueTokens(customer.id, organizationId, client);
    return { ...(await this.session({ id: customer.id, organizationId, phone: "", name: customer.name, email: customer.email })), tokens };
  }

  /** A session for an existing customer: used once an emailed code has been verified. */
  async startSession(organizationId: string, customerId: string, client: ClientContext): Promise<CustomerLoginResultDTO> {
    const customer = await this.customers.findById(organizationId, customerId);
    if (!customer) throw AppError.unauthorised();
    const tokens = await this.issueTokens(customer.id, organizationId, client);
    return { ...(await this.session({ id: customer.id, organizationId, phone: customer.phone ?? "", name: customer.name, email: customer.email })), tokens };
  }

  async refresh(organizationId: string, refreshToken: string, client: ClientContext) {
    const hash = hashRefreshToken(refreshToken);
    return inTransaction(async (tx) => {
      const row = await this.tokens.findByHashForUpdate(hash, tx);
      if (!row || row.subjectType !== "customer") throw AppError.unauthorised("Session expired — please sign in again");
      if (row.revokedAt) {
        await this.tokens.revokeAllForSubject("customer", row.subjectId, tx);
        throw AppError.unauthorised("Session expired — please sign in again");
      }
      if (row.expiresAt.getTime() < Date.now()) throw AppError.unauthorised("Session expired — please sign in again");
      const customer = await this.customers.findById(organizationId, row.subjectId, tx);
      if (!customer || customer.isBlocked) throw AppError.unauthorised("Your account is blocked");
      await this.tokens.revoke(row.id, tx);
      return this.issueTokens(customer.id, organizationId, client, tx);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeByHash(hashRefreshToken(refreshToken));
  }

  async session(actor: CustomerActor): Promise<CustomerSessionDTO> {
    const customer = await this.customers.findById(actor.organizationId, actor.id);
    if (!customer) throw AppError.unauthorised();
    return {
      customer: { id: customer.id, phone: customer.phone, name: customer.name, email: customer.email, guest: !customer.firebaseUid && !customer.emailVerifiedAt },
      addresses: await this.customers.addresses(customer.id),
    };
  }

  private async issueTokens(customerId: string, organizationId: string, client: ClientContext, tx?: Parameters<RefreshTokenRepository["create"]>[1]) {
    const refreshToken = newRefreshToken();
    await this.tokens.create(
      {
        subjectType: "customer",
        subjectId: customerId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
        userAgent: client.userAgent?.slice(0, 255) ?? null,
        ip: client.ip,
      },
      tx
    );
    return { accessToken: signCustomerToken(customerId, organizationId), refreshToken, expiresIn: Math.max(env.jwt.accessTtlSeconds, 3600) };
  }
}
