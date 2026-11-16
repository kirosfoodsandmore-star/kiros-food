import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { ActorRow, CredentialRow, StaffDTO } from "../dto/user.dto";
import { UserEntity, type User } from "../entities/user.entity";

const SELECT_STAFF = `
  SELECT u.id, u.name, u.email, u.phone, u.role_id AS "roleId", r.key AS "roleKey", r.name AS "roleName",
         u.branch_ids AS "branchIds", u.all_branches AS "allBranches", u.is_active AS "isActive",
         u.last_login_at AS "lastLoginAt", u.last_seen_at AS "lastSeenAt", u.created_at AS "createdAt",
         COALESCE((SELECT array_agg(b.name ORDER BY b.name) FROM branches b WHERE b.id = ANY(u.branch_ids) AND b.deleted_at IS NULL), '{}') AS "branchNames"
  FROM users u JOIN roles r ON r.id = u.role_id`;

export interface StaffListFilter {
  page: number;
  limit: number;
  search?: string;
  roleId?: string;
  branchId?: string;
  /** The caller's own branches (null = every branch): only staff working in at least one of them are listed. */
  scopeBranchIds?: string[] | null;
  isActive?: boolean;
}

export class UserRepository {
  static Instance = new UserRepository();
  private constructor() {}

  async findActor(userId: string): Promise<ActorRow | null> {
    const rows: ActorRow[] = await db().query(
      `SELECT u.id, u.organization_id AS "organizationId", u.role_id AS "roleId", r.key AS "roleKey", r.name AS "roleName",
              u.name, u.email, u.is_active AS "isActive", r.permissions, u.branch_ids AS "branchIds", u.all_branches AS "allBranches",
              o.is_suspended AS "orgSuspended"
       FROM users u JOIN roles r ON r.id = u.role_id JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1 AND u.deleted_at IS NULL AND r.deleted_at IS NULL`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async findCredentialsByEmail(email: string): Promise<CredentialRow | null> {
    return db()
      .getRepository(UserEntity)
      .findOne({ where: { email: email.toLowerCase() }, select: ["id", "organizationId", "passwordHash", "isActive", "firebaseUid"] });
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    const row = await db().getRepository(UserEntity).findOne({ where: { id: userId }, select: ["passwordHash"] });
    return row?.passwordHash ?? null;
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<StaffDTO | null> {
    const rows: StaffDTO[] = await db(tx).query(`${SELECT_STAFF} WHERE u.organization_id = $1 AND u.id = $2 AND u.deleted_at IS NULL`, [organizationId, id]);
    return rows[0] ?? null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await db().getRepository(UserEntity).count({ where: { email: email.toLowerCase() } })) > 0;
  }

  async list(organizationId: string, f: StaffListFilter): Promise<PagedRows<StaffDTO>> {
    const p = new SqlParams();
    const where = [`u.organization_id = ${p.add(organizationId)}`, "u.deleted_at IS NULL"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(u.name ILIKE ${s} OR u.email ILIKE ${s} OR u.phone ILIKE ${s})`);
    }
    if (f.roleId) where.push(`u.role_id = ${p.add(f.roleId)}`);
    if (f.branchId) where.push(`(u.all_branches = true OR ${p.add(f.branchId)} = ANY(u.branch_ids))`);
    if (f.scopeBranchIds) where.push(`(u.all_branches = true OR u.branch_ids && ${p.add(f.scopeBranchIds)}::uuid[])`);
    if (f.isActive !== undefined) where.push(`u.is_active = ${p.add(f.isActive)}`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT_STAFF} WHERE ${where.join(" AND ")}) x
       ORDER BY x."isActive" DESC, x.name LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<StaffDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  /** Active riders (hold orders.deliver) who can work the given branch; those on duty come first. */
  async ridersForBranch(organizationId: string, branchId: string): Promise<Array<{ id: string; name: string; phone: string | null; onDuty: boolean }>> {
    return db().query(
      `SELECT u.id, u.name, u.phone, u.on_duty AS "onDuty" FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.organization_id = $1 AND u.deleted_at IS NULL AND u.is_active = true AND r.deleted_at IS NULL
         AND ('orders.deliver' = ANY(r.permissions)) AND (u.all_branches = true OR $2 = ANY(u.branch_ids))
       ORDER BY u.on_duty DESC, u.name LIMIT 200`,
      [organizationId, branchId]
    );
  }

  /** The on-duty rider with the fewest deliveries in hand who hasn't already been offered this order. */
  async nextRider(organizationId: string, branchId: string, excludeIds: string[]): Promise<{ id: string; name: string } | null> {
    const rows: Array<{ id: string; name: string }> = await db().query(
      `SELECT u.id, u.name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.organization_id = $1 AND u.deleted_at IS NULL AND u.is_active = true AND u.on_duty = true AND r.deleted_at IS NULL
         AND ('orders.deliver' = ANY(r.permissions)) AND (u.all_branches = true OR $2 = ANY(u.branch_ids)) AND NOT (u.id = ANY($3::uuid[]))
       ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.rider_id = u.id AND o.status IN ('paid','accepted','preparing','ready','out_for_delivery')), u.name
       LIMIT 1`,
      [organizationId, branchId, excludeIds]
    );
    return rows[0] ?? null;
  }

  async onDuty(id: string): Promise<boolean> {
    const rows: Array<{ onDuty: boolean }> = await db().query(`SELECT on_duty AS "onDuty" FROM users WHERE id = $1`, [id]);
    return rows[0]?.onDuty ?? true;
  }

  async create(data: Omit<User, "id" | "createdAt" | "updatedAt" | "deletedAt" | "lastLoginAt" | "lastSeenAt" | "onDuty"> & { onDuty?: boolean }, tx?: Tx): Promise<string> {
    const repo = db(tx).getRepository(UserEntity);
    const saved = await repo.save(repo.create(data));
    return saved.id;
  }

  async update(organizationId: string, id: string, data: Partial<User>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(UserEntity).update({ id, organizationId }, data);
  }

  async touchLogin(id: string): Promise<void> {
    const now = new Date();
    await db().getRepository(UserEntity).update({ id }, { lastLoginAt: now, lastSeenAt: now });
  }

  async touchSeen(id: string, at = new Date()): Promise<void> {
    await db().query(`UPDATE users SET last_seen_at = $2 WHERE id = $1`, [id, at]);
  }

  async findContactByEmail(email: string): Promise<{ id: string; organizationId: string; name: string; email: string; isActive: boolean } | null> {
    const rows = await db().query(
      `SELECT id, organization_id AS "organizationId", name, email, is_active AS "isActive" FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  /** Active staff who hold `permission` (directly or via "*") and can see `branchId`. */
  async recipientsWithPermission(organizationId: string, permission: string, branchId: string | null = null): Promise<Array<{ id: string; name: string; email: string }>> {
    return db().query(
      `SELECT u.id, u.name, u.email FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.organization_id = $1 AND u.deleted_at IS NULL AND u.is_active = true AND r.deleted_at IS NULL
         AND ('*' = ANY(r.permissions) OR $2 = ANY(r.permissions))
         AND ($3::uuid IS NULL OR u.all_branches = true OR $3 = ANY(u.branch_ids))
       ORDER BY u.name LIMIT 50`,
      [organizationId, permission, branchId]
    );
  }

  async countActiveOwners(organizationId: string, ownerRoleId: string, exceptUserId?: string): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(
      `SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND role_id = $2 AND is_active = true AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [organizationId, ownerRoleId, exceptUserId ?? null]
    );
    return rows[0]?.n ?? 0;
  }
}
