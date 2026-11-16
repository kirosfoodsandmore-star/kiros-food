import { db, type Tx } from "../../../infrastructure/database/transaction";
import type { StaffInviteDTO } from "../dto/user.dto";
import { StaffInviteEntity, type StaffInvite } from "../entities/staffInvite.entity";

const SELECT = `
  SELECT i.id, i.email, i.name, i.role_id AS "roleId", r.name AS "roleName", i.branch_ids AS "branchIds", i.all_branches AS "allBranches",
         i.expires_at AS "expiresAt", i.accepted_at AS "acceptedAt", i.revoked_at AS "revokedAt", u.name AS "invitedByName", i.created_at AS "createdAt",
         CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.expires_at < now() THEN 'expired' ELSE 'pending' END AS status
  FROM staff_invites i JOIN roles r ON r.id = i.role_id LEFT JOIN users u ON u.id = i.invited_by_id`;

export class StaffInviteRepository {
  static Instance = new StaffInviteRepository();
  private constructor() {}

  async create(data: Omit<StaffInvite, "id" | "createdAt" | "acceptedAt" | "revokedAt">, tx?: Tx): Promise<StaffInvite> {
    const repo = db(tx).getRepository(StaffInviteEntity);
    return repo.save(repo.create({ ...data, acceptedAt: null, revokedAt: null }));
  }

  async list(organizationId: string): Promise<StaffInviteDTO[]> {
    return db().query(`${SELECT} WHERE i.organization_id = $1 ORDER BY i.created_at DESC LIMIT 200`, [organizationId]);
  }

  async findById(organizationId: string, id: string): Promise<StaffInvite | null> {
    return db().getRepository(StaffInviteEntity).findOne({ where: { id, organizationId } });
  }

  async findPendingByEmail(organizationId: string, email: string): Promise<StaffInvite | null> {
    const rows: StaffInvite[] = await db().query(
      `SELECT id, organization_id AS "organizationId", email, name, role_id AS "roleId", branch_ids AS "branchIds", all_branches AS "allBranches",
              token_hash AS "tokenHash", expires_at AS "expiresAt", accepted_at AS "acceptedAt", revoked_at AS "revokedAt", invited_by_id AS "invitedById", created_at AS "createdAt"
       FROM staff_invites WHERE organization_id = $1 AND email = $2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
      [organizationId, email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  async findByTokenHash(tokenHash: string, tx?: Tx): Promise<StaffInvite | null> {
    return db(tx).getRepository(StaffInviteEntity).findOne({ where: { tokenHash } });
  }

  async update(id: string, data: Partial<StaffInvite>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(StaffInviteEntity).update({ id }, data);
  }
}
