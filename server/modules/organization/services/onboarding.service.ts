// Creates a new restaurant with everything it needs on day one: preset roles, default payment
// settings and the Owner login. Called by self-service registration (form or Google) and by the seed script; only
// the former is subject to signupOpen().
import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import { FirebaseAuthService } from "../../../shared/firebase/firebaseAuth.service";
import { orderPrefix } from "../../../shared/utils/referenceCode";
import { OWNER_ROLE_KEY } from "../../access/catalog/roles.catalog";
import { RoleService } from "../../access/services/role.service";
import { AuditService } from "../../audit/services/audit.service";
import { PaymentSettingsRepository } from "../../payment/repositories/paymentSettings.repository";
import { UserRepository } from "../../user/repositories/user.repository";
import { OrganizationRepository } from "../repositories/organization.repository";

export interface CreateRestaurantInput {
  restaurantName: string;
  slug?: string | null;
  ownerName: string;
  ownerEmail: string;
  /** null for Google sign-ups: Firebase already holds the identity. */
  ownerPassword: string | null;
  firebaseUid?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface CreatedRestaurant {
  organizationId: string;
  ownerUserId: string;
  slug: string;
  roleIds: Record<string, string>;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export class OnboardingService {
  static Instance = new OnboardingService();
  private constructor(
    private readonly organizations = OrganizationRepository.Instance,
    private readonly roles = RoleService.Instance,
    private readonly users = UserRepository.Instance,
    private readonly paymentSettings = PaymentSettingsRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private async uniqueSlug(wanted: string): Promise<string> {
    const base = slugify(wanted) || "restaurant";
    let slug = base.length < 3 ? `${base}-kitchen` : base;
    for (let i = 2; await this.organizations.slugTaken(slug); i++) slug = `${base}-${i}`;
    return slug;
  }

  /** Self-service sign-up is open for the very first restaurant, and afterwards only when ALLOW_SIGNUP is on. */
  async signupOpen(): Promise<boolean> {
    return env.allowSignup || (await this.organizations.count()) === 0;
  }

  async assertSignupOpen(): Promise<void> {
    if (!(await this.signupOpen())) throw AppError.forbidden("Sign-up is closed. Ask the restaurant owner to invite you.");
  }

  async createRestaurant(input: CreateRestaurantInput): Promise<CreatedRestaurant> {
    const email = input.ownerEmail.trim().toLowerCase();
    if (await this.users.existsByEmail(email)) throw AppError.conflict("A staff account with this email already exists");
    if (input.slug && (await this.organizations.slugTaken(input.slug))) throw AppError.conflict("That storefront address is already taken");

    // The password goes to Firebase and nowhere else; we keep only the Firebase uid it gives back.
    let firebaseUid = input.firebaseUid ?? null;
    if (input.ownerPassword) firebaseUid = await FirebaseAuthService.Instance.upsertUserPassword(email, input.ownerPassword, input.ownerName);
    else if (!firebaseUid) throw AppError.badRequest("A password is required");

    const slug = input.slug ?? (await this.uniqueSlug(input.restaurantName));
    return inTransaction(async (tx) => {
      const org = await this.organizations.create(
        {
          name: input.restaurantName.trim(),
          slug,
          phone: input.phone ?? null,
          address: input.address ?? null,
          email,
          orderPrefix: orderPrefix(input.restaurantName),
        },
        tx
      );
      const roleIds = await this.roles.seedPresets(org.id, tx);
      await this.paymentSettings.ensure(org.id, tx);
      const ownerUserId = await this.users.create(
        {
          organizationId: org.id,
          roleId: roleIds[OWNER_ROLE_KEY],
          name: input.ownerName.trim(),
          email,
          firebaseUid,
          phone: input.phone ?? null,
          branchIds: [],
          allBranches: true,
          isActive: true,
        },
        tx
      );
      await this.audit.record(null, org.id, { action: "create", entityType: "restaurant", entityId: org.id, summary: `Restaurant "${org.name}" created for ${email}` }, tx);
      return { organizationId: org.id, ownerUserId, slug, roleIds };
    });
  }
}
