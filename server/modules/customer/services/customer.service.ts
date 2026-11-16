// Customer profile & addresses (storefront) and the admin customer list / block flag.
import { assertPermission, can } from "../../../shared/access/can";
import { branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { maskEmail, maskPhone } from "../../../shared/utils/mask";
import { AuditService } from "../../audit/services/audit.service";
import { RefreshTokenRepository } from "../../auth/repositories/refreshToken.repository";
import type { AddressDTO, CustomerDTO, CustomerSessionDTO } from "../dto/customer.dto";
import { CustomerRepository } from "../repositories/customer.repository";
import type { AddressBody, ListCustomersQuery, UpdateCustomerInput } from "../validators/customer.schema";
import { CustomerAuthService } from "./customerAuth.service";

export class CustomerService {
  static Instance = new CustomerService();
  private constructor(
    private readonly customers = CustomerRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  // ── Storefront ─────────────────────────────────────────────────────────────

  async updateMe(actor: CustomerActor, data: UpdateCustomerInput): Promise<CustomerSessionDTO> {
    if (data.phone && data.phone !== actor.phone) {
      const taken = await this.customers.findByPhone(actor.organizationId, data.phone);
      if (taken && taken.id !== actor.id) throw AppError.conflict("That phone number belongs to another account");
    }
    await this.customers.update(actor.organizationId, actor.id, data);
    return CustomerAuthService.Instance.session(actor);
  }

  addresses(actor: CustomerActor): Promise<AddressDTO[]> {
    return this.customers.addresses(actor.id);
  }

  async addAddress(actor: CustomerActor, data: AddressBody): Promise<AddressDTO[]> {
    const existing = await this.customers.addresses(actor.id);
    if (existing.length >= 10) throw AppError.badRequest("You can save up to 10 addresses");
    await this.customers.createAddress({ ...data, organizationId: actor.organizationId, customerId: actor.id, label: data.label ?? null, lat: data.lat ?? null, lng: data.lng ?? null, instructions: data.instructions ?? null, isDefault: data.isDefault || existing.length === 0 });
    return this.customers.addresses(actor.id);
  }

  async updateAddress(actor: CustomerActor, id: string, data: Partial<AddressBody>): Promise<AddressDTO[]> {
    if (!(await this.customers.findAddress(actor.id, id))) throw AppError.notFound("Address not found");
    await this.customers.updateAddress(actor.id, id, data);
    return this.customers.addresses(actor.id);
  }

  async deleteAddress(actor: CustomerActor, id: string): Promise<AddressDTO[]> {
    await this.customers.deleteAddress(actor.id, id);
    return this.customers.addresses(actor.id);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  private mask(actor: Actor, c: CustomerDTO): CustomerDTO {
    return can(actor, "customers.view_contact") ? c : { ...c, phone: maskPhone(c.phone), email: maskEmail(c.email) };
  }

  async list(actor: Actor, query: ListCustomersQuery) {
    const result = await this.customers.list(actor.organizationId, { ...query, branchIds: branchScope(actor) });
    return { ...result, data: result.data.map((c) => this.mask(actor, c)) };
  }

  async get(actor: Actor, id: string): Promise<CustomerDTO> {
    const customer = await this.customers.detail(actor.organizationId, id, branchScope(actor));
    if (!customer) throw AppError.notFound("Customer not found");
    return this.mask(actor, customer);
  }

  async setBlocked(actor: Actor, id: string, blocked: boolean, reason: string | null): Promise<CustomerDTO> {
    assertPermission(actor, "customers.block");
    const customer = await this.customers.detail(actor.organizationId, id, branchScope(actor));
    if (!customer) throw AppError.notFound("Customer not found");
    await this.customers.update(actor.organizationId, id, { isBlocked: blocked, blockReason: blocked ? reason : null });
    if (blocked) await this.tokens.revokeAllForSubject("customer", id);
    await this.audit.log(actor, { action: blocked ? "block" : "unblock", entityType: "customer", entityId: id, summary: `${blocked ? "Blocked" : "Unblocked"} customer ${customer.name ?? customer.phone ?? id}${reason ? ` — ${reason}` : ""}` });
    return this.get(actor, id);
  }
}
