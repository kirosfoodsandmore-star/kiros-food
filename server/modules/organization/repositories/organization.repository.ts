import { db, type Tx, updateReturning } from "../../../infrastructure/database/transaction";
import type { RestaurantProfileDTO, StorefrontProfileDTO } from "../dto/organization.dto";
import { CounterEntity } from "../entities/counter.entity";
import { OrganizationEntity, type Organization } from "../entities/organization.entity";

const PROFILE_FIELDS: Array<keyof Organization> = [
  "id",
  "name",
  "slug",
  "legalName",
  "phone",
  "email",
  "address",
  "logoUrl",
  "tagline",
  "socialLinks",
  "currencyCode",
  "currencySymbol",
  "currencyDecimals",
  "timezone",
  "orderPrefix",
  "notifyStaffNewOrders",
  "notifyCustomersByEmail",
  "defaultBranchId",
  "isSuspended",
  "createdAt",
];

export class OrganizationRepository {
  static Instance = new OrganizationRepository();
  private constructor() {}

  async create(data: Partial<Organization>, tx?: Tx): Promise<Organization> {
    const repo = db(tx).getRepository(OrganizationEntity);
    return repo.save(repo.create(data));
  }

  async findById(id: string, tx?: Tx): Promise<Organization | null> {
    return db(tx).getRepository(OrganizationEntity).findOne({ where: { id } });
  }

  async findProfile(id: string): Promise<RestaurantProfileDTO | null> {
    return db().getRepository(OrganizationEntity).findOne({ where: { id }, select: PROFILE_FIELDS }) as Promise<RestaurantProfileDTO | null>;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return db().getRepository(OrganizationEntity).findOne({ where: { slug: slug.toLowerCase() } });
  }

  async storefrontProfile(slug: string): Promise<(StorefrontProfileDTO & { isSuspended: boolean }) | null> {
    const org = await this.findBySlug(slug);
    if (!org) return null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      tagline: org.tagline,
      phone: org.phone,
      email: org.email,
      address: org.address,
      socialLinks: org.socialLinks,
      currencyCode: org.currencyCode,
      currencySymbol: org.currencySymbol,
      currencyDecimals: org.currencyDecimals,
      timezone: org.timezone,
      defaultBranchId: org.defaultBranchId,
      isSuspended: org.isSuspended,
    };
  }

  async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const found = await db().getRepository(OrganizationEntity).findOne({ where: { slug: slug.toLowerCase() }, select: ["id"] });
    return Boolean(found && found.id !== exceptId);
  }

  /** Forget the default branch when it is the one that just went away (deleted or deactivated). */
  async clearDefaultBranch(id: string, branchId: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OrganizationEntity).update({ id, defaultBranchId: branchId }, { defaultBranchId: null });
  }

  async update(id: string, data: Partial<Organization>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OrganizationEntity).update({ id }, data);
  }

  /** Next value of a per-restaurant sequence, atomically. */
  async nextCounter(organizationId: string, key: string, tx: Tx): Promise<number> {
    await tx.getRepository(CounterEntity).query(
      `INSERT INTO counters (organization_id, key, value) VALUES ($1, $2, 0) ON CONFLICT (organization_id, key) DO NOTHING`,
      [organizationId, key]
    );
    const rows = await updateReturning<{ value: number }>(
      tx,
      `UPDATE counters SET value = value + 1 WHERE organization_id = $1 AND key = $2 RETURNING value`,
      [organizationId, key]
    );
    return Number(rows[0].value);
  }

  async count(): Promise<number> {
    return db().getRepository(OrganizationEntity).count();
  }

  async listIds(): Promise<string[]> {
    const rows: Array<{ id: string }> = await db().query(`SELECT id FROM organizations WHERE is_suspended = false`);
    return rows.map((r) => r.id);
  }
}
