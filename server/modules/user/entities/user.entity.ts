// Staff accounts (admin portal). Customers are a separate table.
import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  manyToOne,
  primaryId,
  timestampColumn,
  updatedAt,
  uuidArrayColumn,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface User {
  id: string;
  organizationId: string;
  roleId: string;
  name: string;
  /** Always stored lower-case — lookups compare against the lower-cased input. */
  email: string;
  /** bcrypt hash, or the "firebase:managed" sentinel when Firebase Authentication holds the password. */
  passwordHash: string;
  firebaseUid: string | null;
  phone: string | null;
  /** Branches this person works in; ignored when allBranches is true. */
  branchIds: string[];
  allBranches: boolean;
  isActive: boolean;
  /** Riders only: switched on when available to take deliveries. Off-duty riders can't be assigned new orders. */
  onDuty: boolean;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
  role?: { id: string };
}

export const UserEntity = new EntitySchema<User>({
  name: "User",
  tableName: "users",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    roleId: uuidColumn("role_id"),
    name: varchar("name", 120),
    email: varchar("email", 160),
    passwordHash: varchar("password_hash", 100),
    firebaseUid: varchar("firebase_uid", 128, true),
    phone: varchar("phone", 30, true),
    branchIds: uuidArrayColumn("branch_ids"),
    allBranches: boolColumn("all_branches", false),
    isActive: boolColumn("is_active", true),
    onDuty: boolColumn("on_duty", true),
    lastLoginAt: timestampColumn("last_login_at"),
    lastSeenAt: timestampColumn("last_seen_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: {
    organization: manyToOne("Organization", "organization_id", "CASCADE"),
    role: manyToOne("Role", "role_id"),
  },
  indices: [
    { name: "IDX_users_org", columns: ["organizationId"] },
    { name: "UQ_users_email", columns: ["email"], unique: true, where: "deleted_at IS NULL" },
  ],
});
