// Platform operators (PLATFORM_ADMIN_EMAILS): every restaurant, sign-ups, who is online, suspend.
import { presence } from "../../../infrastructure/realtime/presence";
import { isPlatformAdmin } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { EmailLogRepository, type EmailLogCountFilters, type EmailLogFilters } from "../../notification/repositories/emailLog.repository";
import { PlatformRepository } from "../repositories/platform.repository";
import { PlatformSettingsService, type PlatformSettings } from "./platformSettings.service";

export class PlatformService {
  static Instance = new PlatformService();
  private constructor(
    private readonly repo = PlatformRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly audit = AuditService.Instance,
    private readonly settings = PlatformSettingsService.Instance,
    private readonly emailLog = EmailLogRepository.Instance
  ) {}

  private assertPlatform(actor: Actor): void {
    if (!isPlatformAdmin(actor)) throw AppError.forbidden();
  }

  overview(actor: Actor) {
    this.assertPlatform(actor);
    return this.repo.overview();
  }

  restaurants(actor: Actor, f: { page: number; limit: number; search?: string; suspended?: boolean }) {
    this.assertPlatform(actor);
    return this.repo.restaurants(f);
  }

  getSettings(actor: Actor): Promise<PlatformSettings> {
    this.assertPlatform(actor);
    return this.settings.get();
  }

  updateSettings(actor: Actor, patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    this.assertPlatform(actor);
    return this.settings.update(actor, patch);
  }

  /** The email log: every email the platform sent, tried to send or skipped. Platform admins only. */
  emailLogs(actor: Actor, f: EmailLogFilters) {
    this.assertPlatform(actor);
    return this.emailLog.list(f);
  }

  emailLogSummary(actor: Actor, f: EmailLogCountFilters) {
    this.assertPlatform(actor);
    return this.emailLog.summary(f);
  }

  online(actor: Actor) {
    this.assertPlatform(actor);
    return presence.list();
  }

  async setSuspended(actor: Actor, organizationId: string, suspended: boolean): Promise<void> {
    this.assertPlatform(actor);
    const org = await this.organizations.findById(organizationId);
    if (!org) throw AppError.notFound("Restaurant not found");
    if (organizationId === actor.organizationId && suspended) throw AppError.badRequest("You cannot suspend your own restaurant");
    await this.organizations.update(organizationId, { isSuspended: suspended });
    PermissionCache.invalidateOrganization(organizationId);
    await this.audit.record(actor, organizationId, { action: suspended ? "suspend" : "unsuspend", entityType: "restaurant", entityId: organizationId, summary: `${suspended ? "Suspended" : "Reinstated"} by platform admin ${actor.email}` });
  }
}
