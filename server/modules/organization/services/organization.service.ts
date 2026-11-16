// Restaurant profile & settings (brand, currency, timezone, social links, notifications, logo).
import { STORAGE_FOLDERS } from "../../../config/constants";
import { assertPermission } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import type { RestaurantProfileDTO, StorefrontProfileDTO } from "../dto/organization.dto";
import { OrganizationRepository } from "../repositories/organization.repository";
import type { UpdateRestaurantBody } from "../validators/organization.schema";

export class OrganizationService {
  static Instance = new OrganizationService();
  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly branches = BranchRepository.Instance
  ) {}

  async profile(organizationId: string): Promise<RestaurantProfileDTO> {
    const profile = await this.organizations.findProfile(organizationId);
    if (!profile) throw AppError.notFound("Restaurant not found");
    return profile;
  }

  /** Public storefront profile by slug; suspended restaurants are not served. */
  async storefront(slug: string): Promise<StorefrontProfileDTO> {
    const profile = await this.organizations.storefrontProfile(slug);
    if (!profile || profile.isSuspended) throw AppError.notFound("Restaurant not found");
    const { isSuspended: _ignored, ...rest } = profile;
    return rest;
  }

  /** Resolve the tenant for a storefront request. */
  async resolveStore(slug: string): Promise<{ id: string; name: string; timezone: string; currencyCode: string; currencySymbol: string; currencyDecimals: number }> {
    const org = await this.organizations.findBySlug(slug);
    if (!org || org.isSuspended) throw AppError.notFound("Restaurant not found");
    return { id: org.id, name: org.name, timezone: org.timezone, currencyCode: org.currencyCode, currencySymbol: org.currencySymbol, currencyDecimals: org.currencyDecimals };
  }

  async update(actor: Actor, data: UpdateRestaurantBody): Promise<RestaurantProfileDTO> {
    assertPermission(actor, "settings.manage");
    const before = await this.profile(actor.organizationId);
    if (data.slug && data.slug !== before.slug && (await this.organizations.slugTaken(data.slug, actor.organizationId))) {
      throw AppError.conflict("That storefront address is already taken");
    }
    if (data.defaultBranchId) {
      const branch = await this.branches.findById(actor.organizationId, data.defaultBranchId);
      if (!branch || !branch.isActive) throw AppError.badRequest("Choose one of your active branches as the default");
    }
    await this.organizations.update(actor.organizationId, data);
    const after = await this.profile(actor.organizationId);
    await this.audit.log(actor, {
      action: "update",
      entityType: "settings",
      entityId: actor.organizationId,
      summary: "Updated restaurant settings",
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  async uploadLogo(actor: Actor, buffer: Buffer): Promise<RestaurantProfileDTO> {
    assertPermission(actor, "settings.manage");
    const org = await this.organizations.findById(actor.organizationId);
    if (!org) throw AppError.notFound("Restaurant not found");
    const { url, publicId } = await this.storage.replace(buffer, { folder: STORAGE_FOLDERS.logo, maxDimension: 800 }, org.logoPublicId);
    await this.organizations.update(actor.organizationId, { logoUrl: url, logoPublicId: publicId });
    await this.audit.log(actor, { action: "update", entityType: "settings", entityId: actor.organizationId, summary: "Changed the logo" });
    return this.profile(actor.organizationId);
  }

  async removeLogo(actor: Actor): Promise<RestaurantProfileDTO> {
    assertPermission(actor, "settings.manage");
    const org = await this.organizations.findById(actor.organizationId);
    if (!org) throw AppError.notFound("Restaurant not found");
    await this.storage.delete(org.logoPublicId);
    await this.organizations.update(actor.organizationId, { logoUrl: null, logoPublicId: null });
    return this.profile(actor.organizationId);
  }
}
