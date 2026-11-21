// Every email the system sends, driven by domain events: restaurant welcome, staff invites, password
// codes, order placed / transfer instructions / status updates / payment rejected, and new-order
// alerts to branch staff. Sends are fire-and-forget; failures are logged and never reach the caller.
import { env } from "../../../config/env";
import type { OrderStatus } from "../../../config/constants";
import { domainEvents } from "../../../shared/events/domainEvents";
import { accountDeactivatedEmail, passwordChangedEmail, passwordResetCodeEmail, restaurantWelcomeEmail, staffInviteEmail } from "../../../shared/utils/mail/account.mail";
import { contactMessageEmail } from "../../../shared/utils/mail/contact.mail";
import { customerSignInCodeEmail } from "../../../shared/utils/mail/customer.mail";
import { newOrderStaffEmail, orderPlacedEmail, orderStatusEmail, paymentRejectedEmail, transferInstructionsEmail, type OrderMailSummary } from "../../../shared/utils/mail/order.mail";
import { builtInBadgeUrl } from "../../../shared/utils/brandAssets";
import { sendMail, type ComposedMail, type LayoutBrand } from "../../../shared/utils/mailer";
import { formatDateTime } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import { OrderRepository } from "../../order/repositories/order.repository";
import { OrderService } from "../../order/services/order.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { PaymentRepository } from "../../payment/repositories/payment.repository";
import { PaymentSettingsService } from "../../payment/services/paymentSettings.service";
import { RoleRepository } from "../../access/repositories/role.repository";
import { StaffInviteRepository } from "../../user/repositories/staffInvite.repository";
import { UserRepository } from "../../user/repositories/user.repository";

interface Ctx {
  brand: LayoutBrand;
  timezone: string;
  symbol: string;
  decimals: number;
  replyTo: string | null;
  notifyStaff: boolean;
  notifyCustomers: boolean;
  slug: string;
}

const CUSTOMER_STATUS_EMAILS: OrderStatus[] = ["accepted", "ready", "out_for_delivery", "completed", "cancelled", "refunded"];

export class EmailNotifierService {
  static Instance = new EmailNotifierService();
  private registered = false;
  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly invites = StaffInviteRepository.Instance,
    private readonly roles = RoleRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly orderService = OrderService.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly paymentSettings = PaymentSettingsService.Instance
  ) {}

  // Same rule as the web app's BrandLogo: a restaurant with its own artwork shipped in the server (see brandAssets) uses that
  // badge everywhere, so emails match the app; any other restaurant uses the logo uploaded in Admin → Settings.
  private brandFor(org: { name: string; slug: string; email: string | null; logoUrl: string | null }): LayoutBrand {
    const badge = builtInBadgeUrl(org.slug);
    if (badge) return { businessName: org.name, footerEmail: org.email, logoUrl: badge, logoKind: "badge" };
    return { businessName: org.name, footerEmail: org.email, logoUrl: org.logoUrl, logoKind: org.logoUrl ? "wide" : undefined };
  }

  private async ctx(organizationId: string): Promise<Ctx | null> {
    const org = await this.organizations.findById(organizationId);
    if (!org) return null;
    return {
      brand: this.brandFor(org),
      timezone: org.timezone,
      symbol: org.currencySymbol,
      decimals: org.currencyDecimals,
      replyTo: org.email,
      notifyStaff: org.notifyStaffNewOrders,
      notifyCustomers: org.notifyCustomersByEmail,
      slug: org.slug,
    };
  }

  private send(ctx: Ctx, to: string, mail: ComposedMail): Promise<boolean> {
    return sendMail({ to, ...mail, fromName: ctx.brand.businessName, replyTo: ctx.replyTo });
  }

  register(): void {
    if (this.registered) return;
    this.registered = true;
    domainEvents.on("restaurant.registered", (e) => this.welcome(e.organizationId, e.ownerUserId));
    domainEvents.on("staff.invited", (e) => this.invite(e.organizationId, e.inviteId, e.token));
    domainEvents.on("staff.deactivated", (e) => this.deactivated(e.organizationId, e.userId));
    domainEvents.on("auth.passwordResetRequested", (e) => this.passwordResetCode(e.organizationId, e.userId, e.code));
    domainEvents.on("user.passwordChanged", (e) => this.passwordChanged(e.organizationId, e.userId));
    domainEvents.on("order.created", (e) => this.orderCreated(e.organizationId, e.orderId));
    domainEvents.on("order.paid", (e) => this.orderPaid(e.organizationId, e.orderId));
    // from === to is a refresh signal (a rider was assigned, accepted, declined...), not a status change: no email.
    domainEvents.on("order.statusChanged", (e) => (e.from === e.to ? undefined : this.statusChanged(e.organizationId, e.orderId, e.to, e.note)));
    domainEvents.on("payment.rejected", (e) => this.paymentRejected(e.organizationId, e.orderId, e.reason));
  }

  // ── Storefront contact form ───────────────────────────────────────────────

  /** To the restaurant's own address, Reply-To the visitor. Returns whether it was handed to the mail provider. */
  async contactMessage(organizationId: string, msg: { name: string; email: string; phone: string | null; message: string }): Promise<boolean> {
    const ctx = await this.ctx(organizationId);
    if (!ctx?.replyTo) return false;
    return sendMail({ to: ctx.replyTo, ...contactMessageEmail({ brand: ctx.brand, ...msg }), fromName: ctx.brand.businessName, replyTo: msg.email });
  }

  /** The optional customer sign-in code. Returns whether it was handed to the mail provider. */
  async customerSignInCode(organizationId: string, email: string, code: string, minutes: number): Promise<boolean> {
    const ctx = await this.ctx(organizationId);
    if (!ctx) return false;
    return sendMail({ to: email, ...customerSignInCodeEmail({ brand: ctx.brand, code, minutes }), fromName: ctx.brand.businessName, replyTo: ctx.replyTo });
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  private async welcome(organizationId: string, userId: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.ctx(organizationId), this.users.findById(organizationId, userId)]);
    if (!ctx || !user) return;
    await this.send(ctx, user.email, restaurantWelcomeEmail({ brand: ctx.brand, ownerName: user.name, adminUrl: env.adminUrl, storefrontUrl: `${env.storefrontUrl}/${ctx.slug}` }));
  }

  private async invite(organizationId: string, inviteId: string, token: string): Promise<void> {
    const ctx = await this.ctx(organizationId);
    const invite = await this.invites.findById(organizationId, inviteId);
    if (!ctx || !invite) return;
    const [role, inviter] = await Promise.all([this.roles.findById(organizationId, invite.roleId), invite.invitedById ? this.users.findById(organizationId, invite.invitedById) : null]);
    const branches = invite.allBranches ? "All branches" : (await this.branches.list(organizationId, invite.branchIds)).map((b) => b.name).join(", ") || "No branch yet";
    await this.send(
      ctx,
      invite.email,
      staffInviteEmail({ brand: ctx.brand, name: invite.name, inviterName: inviter?.name ?? "The owner", roleName: role?.name ?? "Staff", branches, acceptUrl: `${env.adminUrl}/accept-invite?token=${encodeURIComponent(token)}`, hours: env.inviteTtlHours })
    );
  }

  private async deactivated(organizationId: string, userId: string): Promise<void> {
    const ctx = await this.ctx(organizationId);
    const contact = await this.users.findActor(userId);
    if (!ctx || !contact) return;
    await this.send(ctx, contact.email, accountDeactivatedEmail({ brand: ctx.brand, name: contact.name }));
  }

  private async passwordResetCode(organizationId: string, userId: string, code: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.ctx(organizationId), this.users.findById(organizationId, userId)]);
    if (!ctx || !user) return;
    await this.send(ctx, user.email, passwordResetCodeEmail({ brand: ctx.brand, name: user.name, code, minutes: env.otpTtlMinutes }));
  }

  private async passwordChanged(organizationId: string, userId: string): Promise<void> {
    const [ctx, user] = await Promise.all([this.ctx(organizationId), this.users.findById(organizationId, userId)]);
    if (!ctx || !user) return;
    await this.send(ctx, user.email, passwordChangedEmail({ brand: ctx.brand, name: user.name, when: formatDateTime(new Date(), ctx.timezone) }));
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  private async summary(ctx: Ctx, organizationId: string, orderId: string): Promise<{ s: OrderMailSummary; customerEmail: string | null; customerName: string; customerPhone: string; branchId: string } | null> {
    const detail = await this.orderService.detail(organizationId, orderId).catch(() => null);
    if (!detail) return null;
    const money = (v: number) => formatMoney(v, ctx.symbol, ctx.decimals);
    return {
      s: {
        number: detail.number,
        branchName: detail.branch.name,
        fulfilment: detail.fulfilment,
        when: detail.scheduledFor ? formatDateTime(detail.scheduledFor, detail.branch.timezone) : "As soon as possible",
        address: detail.deliveryAddress?.line ?? null,
        lines: detail.lines.map((l) => ({ name: l.itemName, quantity: l.quantity, options: l.options.map((o) => o.name).join(", "), lineTotal: money(l.lineTotal) })),
        subtotal: money(detail.subtotal),
        deliveryFee: money(detail.deliveryFee),
        discount: detail.discount > 0 ? money(detail.discount) : null,
        total: money(detail.total),
        trackUrl: `${env.storefrontUrl}/${ctx.slug}/orders/${detail.id}`,
      },
      customerEmail: detail.customerEmail,
      customerName: detail.customerName ?? "there",
      customerPhone: detail.customerPhone,
      branchId: detail.branchId,
    };
  }

  /** Bank-transfer orders: send the instructions right away. Paystack orders wait for `order.paid`. */
  private async orderCreated(organizationId: string, orderId: string): Promise<void> {
    const ctx = await this.ctx(organizationId);
    if (!ctx || !ctx.notifyCustomers) return;
    const order = await this.orders.findById(organizationId, orderId);
    if (!order || order.paymentMethod !== "transfer" || !order.customerEmail) return;
    const data = await this.summary(ctx, organizationId, orderId);
    const [bank] = await this.paymentSettings.bankAccountsForBranch(organizationId, order.branchId);
    const payment = await this.payments.latestForOrder(orderId);
    if (!data || !bank) return;
    const terms = await this.paymentSettings.transferTerms(organizationId);
    await this.send(ctx, order.customerEmail, transferInstructionsEmail({ brand: ctx.brand, customerName: data.customerName, order: data.s, bank, deadline: payment?.expiresAt ? formatDateTime(payment.expiresAt, ctx.timezone) : "soon", instructions: terms.instructions }));
  }

  private async orderPaid(organizationId: string, orderId: string): Promise<void> {
    const ctx = await this.ctx(organizationId);
    if (!ctx) return;
    const data = await this.summary(ctx, organizationId, orderId);
    if (!data) return;
    if (ctx.notifyCustomers && data.customerEmail) await this.send(ctx, data.customerEmail, orderPlacedEmail({ brand: ctx.brand, customerName: data.customerName, order: data.s }));
    if (ctx.notifyStaff) {
      for (const staff of await this.users.recipientsWithPermission(organizationId, "orders.view", data.branchId)) {
        await this.send(ctx, staff.email, newOrderStaffEmail({ brand: ctx.brand, staffName: staff.name, order: data.s, customerPhone: data.customerPhone, adminUrl: `${env.adminUrl}/orders/${orderId}` }));
      }
    }
  }

  private async statusChanged(organizationId: string, orderId: string, to: OrderStatus, note: string | null): Promise<void> {
    if (!CUSTOMER_STATUS_EMAILS.includes(to)) return;
    const ctx = await this.ctx(organizationId);
    if (!ctx || !ctx.notifyCustomers) return;
    const data = await this.summary(ctx, organizationId, orderId);
    if (!data || !data.customerEmail) return;
    const deliveryCode = to === "out_for_delivery" ? await this.orderService.deliveryCodeFor(organizationId, orderId) : null;
    await this.send(ctx, data.customerEmail, orderStatusEmail({ brand: ctx.brand, customerName: data.customerName, order: data.s, status: to, note, deliveryCode }));
  }

  private async paymentRejected(organizationId: string, orderId: string, reason: string): Promise<void> {
    const ctx = await this.ctx(organizationId);
    if (!ctx || !ctx.notifyCustomers) return;
    const data = await this.summary(ctx, organizationId, orderId);
    if (!data || !data.customerEmail) return;
    await this.send(ctx, data.customerEmail, paymentRejectedEmail({ brand: ctx.brand, customerName: data.customerName, order: data.s, reason }));
  }
}
