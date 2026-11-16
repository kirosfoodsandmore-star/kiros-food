import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { PagedRows } from "../../../shared/pagination/paginate";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { evaluatePromo, type PromoResult } from "../domain/discount";
import type { PromoCode } from "../entities/promoCode.entity";
import { PromoRepository } from "../repositories/promo.repository";
import type { PromoBody, UpdatePromoBody } from "../validators/promo.schema";

export class PromoService {
  static Instance = new PromoService();
  private constructor(
    private readonly repo = PromoRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  list(actor: Actor, f: { page: number; limit: number; search?: string }): Promise<PagedRows<PromoCode>> {
    return this.repo.list(actor.organizationId, f);
  }

  async create(actor: Actor, data: PromoBody): Promise<PromoCode> {
    assertPermission(actor, "promos.manage");
    if (await this.repo.findByCode(actor.organizationId, data.code)) throw AppError.conflict("That promo code already exists");
    const promo = await this.repo.create({
      organizationId: actor.organizationId,
      code: data.code,
      type: data.type,
      value: data.value,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      maxUses: data.maxUses ?? null,
      maxUsesPerCustomer: data.maxUsesPerCustomer ?? null,
      minSpend: data.minSpend,
      branchId: data.branchId ?? null,
      menuId: data.menuId ?? null,
      isActive: data.isActive,
    });
    await this.audit.log(actor, { action: "create", entityType: "promo", entityId: promo.id, summary: `Created promo code ${promo.code} (${promo.type} ${promo.value})`, after: data });
    return promo;
  }

  async update(actor: Actor, id: string, data: UpdatePromoBody): Promise<PromoCode> {
    assertPermission(actor, "promos.manage");
    const promo = await this.repo.findById(actor.organizationId, id);
    if (!promo) throw AppError.notFound("Promo code not found");
    if (data.code && data.code !== promo.code && (await this.repo.findByCode(actor.organizationId, data.code))) throw AppError.conflict("That promo code already exists");
    const type = data.type ?? promo.type;
    const value = data.value ?? promo.value;
    if (type === "percent" && value > 100) throw AppError.badRequest("Percent must be 1–100");
    await this.repo.update(actor.organizationId, id, {
      ...data,
      startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null,
    });
    await this.audit.log(actor, { action: "update", entityType: "promo", entityId: id, summary: `Updated promo code ${promo.code}`, before: promo as unknown as Record<string, unknown>, after: data });
    return (await this.repo.findById(actor.organizationId, id))!;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "promos.manage");
    const promo = await this.repo.findById(actor.organizationId, id);
    if (!promo) throw AppError.notFound("Promo code not found");
    await this.repo.softDelete(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "promo", entityId: id, summary: `Deleted promo code ${promo.code}` });
  }

  /** Cart/checkout: evaluate a code for a context. */
  async evaluate(organizationId: string, code: string, ctx: { subtotal: number; branchId: string; menuId: string | null; customerId: string | null }): Promise<PromoResult & { promo?: PromoCode }> {
    const promo = await this.repo.findByCode(organizationId, code);
    if (!promo) return { ok: false, reason: "Unknown promo code" };
    const customerUses = ctx.customerId ? await this.repo.usesByCustomer(organizationId, code, ctx.customerId) : 0;
    const result = evaluatePromo(promo, { ...ctx, customerUses });
    return { ...result, promo };
  }
}
