import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, manyToOne, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Role {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  isPreset: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const RoleEntity = new EntitySchema<Role>({
  name: "Role",
  tableName: "roles",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    key: varchar("key", 40),
    name: varchar("name", 80),
    description: textColumn("description"),
    permissions: { type: "text", name: "permissions", array: true, default: () => "'{}'" },
    isPreset: boolColumn("is_preset", false),
    isLocked: boolColumn("is_locked", false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "UQ_roles_org_key", columns: ["organizationId", "key"], unique: true, where: "deleted_at IS NULL" }],
});
