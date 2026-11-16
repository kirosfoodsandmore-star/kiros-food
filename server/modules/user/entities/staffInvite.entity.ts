// Pending staff invitations: a 48-hour link that lets the invitee set their own password.
import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, manyToOne, primaryId, timestampColumn, uuidArrayColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface StaffInvite {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roleId: string;
  branchIds: string[];
  allBranches: boolean;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedById: string | null;
  createdAt: Date;
  organization?: { id: string };
}

export const StaffInviteEntity = new EntitySchema<StaffInvite>({
  name: "StaffInvite",
  tableName: "staff_invites",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    email: varchar("email", 160),
    name: varchar("name", 120),
    roleId: uuidColumn("role_id"),
    branchIds: uuidArrayColumn("branch_ids"),
    allBranches: boolColumn("all_branches", false),
    tokenHash: varchar("token_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    acceptedAt: timestampColumn("accepted_at"),
    revokedAt: timestampColumn("revoked_at"),
    invitedById: uuidColumn("invited_by_id", true),
    createdAt: createdAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [
    { name: "UQ_staff_invites_token", columns: ["tokenHash"], unique: true },
    { name: "IDX_staff_invites_org_email", columns: ["organizationId", "email"] },
  ],
});
