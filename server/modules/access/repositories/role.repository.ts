import { db, type Tx } from "../../../infrastructure/database/transaction";
import { RoleEntity, type Role } from "../entities/role.entity";

export interface RoleDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  isPreset: boolean;
  isLocked: boolean;
  memberCount: number;
  createdAt: Date;
}

export class RoleRepository {
  static Instance = new RoleRepository();
  private constructor() {}

  async list(organizationId: string): Promise<RoleDTO[]> {
    return db().query(
      `SELECT r.id, r.key, r.name, r.description, r.permissions, r.is_preset AS "isPreset", r.is_locked AS "isLocked",
              r.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL AND u.is_active = true) AS "memberCount"
       FROM roles r WHERE r.organization_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.is_locked DESC, r.is_preset DESC, r.name`,
      [organizationId]
    );
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<Role | null> {
    return db(tx).getRepository(RoleEntity).findOne({ where: { id, organizationId } });
  }

  async findByKey(organizationId: string, key: string, tx?: Tx): Promise<Role | null> {
    return db(tx).getRepository(RoleEntity).findOne({ where: { key, organizationId } });
  }

  async create(data: Omit<Role, "id" | "createdAt" | "updatedAt" | "deletedAt">, tx?: Tx): Promise<Role> {
    const repo = db(tx).getRepository(RoleEntity);
    return repo.save(repo.create(data));
  }

  async update(organizationId: string, id: string, data: Partial<Role>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RoleEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(RoleEntity).softDelete({ id, organizationId });
  }

  async countMembers(roleId: string): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1 AND deleted_at IS NULL`, [roleId]);
    return rows[0]?.n ?? 0;
  }
}
