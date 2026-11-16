// Roles are named permission bundles. Rules from the spec: the Owner role is locked; a user cannot
// grant a permission they do not hold; a user cannot edit their own role.
import type { Tx } from "../../../infrastructure/database/transaction";
import { can, hasWildcard } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { PERMISSIONS, WILDCARD, type PermissionCode, type PermissionDefinition } from "../catalog/permissions.catalog";
import { OWNER_ROLE_KEY, PRESET_ROLES } from "../catalog/roles.catalog";
import { RoleRepository, type RoleDTO } from "../repositories/role.repository";
import type { CreateRoleInput, UpdateRoleInput } from "../validators/role.schema";

function slugKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export class RoleService {
  static Instance = new RoleService();
  private constructor(
    private readonly roles = RoleRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  catalog() {
    return (PERMISSIONS as readonly PermissionDefinition[]).map((p) => ({ code: p.code, category: p.category, label: p.label, ownerOnlyDefault: Boolean(p.ownerOnlyDefault) }));
  }

  list(actor: Actor): Promise<RoleDTO[]> {
    return this.roles.list(actor.organizationId);
  }

  /** Called when a restaurant is created. Returns role ids by key. */
  async seedPresets(organizationId: string, tx: Tx): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const preset of PRESET_ROLES) {
      const existing = await this.roles.findByKey(organizationId, preset.key, tx);
      const role =
        existing ??
        (await this.roles.create(
          {
            organizationId,
            key: preset.key,
            name: preset.name,
            description: preset.description,
            permissions: [...preset.permissions],
            isPreset: true,
            isLocked: preset.locked,
          },
          tx
        ));
      ids[preset.key] = role.id;
    }
    return ids;
  }

  /** A user cannot grant a permission they do not hold. */
  private assertCanGrant(actor: Actor, permissions: string[]): void {
    if (hasWildcard(actor)) return;
    const missing = permissions.filter((code) => !can(actor, code as PermissionCode));
    if (missing.length > 0) throw AppError.forbidden(`You cannot grant permissions you do not hold: ${missing.join(", ")}`);
  }

  async create(actor: Actor, data: CreateRoleInput) {
    this.assertCanGrant(actor, data.permissions);
    let key = slugKey(data.name) || "role";
    if (key === OWNER_ROLE_KEY || (await this.roles.findByKey(actor.organizationId, key))) key = `${key}_${Date.now().toString(36)}`;
    const role = await this.roles.create({
      organizationId: actor.organizationId,
      key,
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
      isPreset: false,
      isLocked: false,
    });
    await this.audit.log(actor, { action: "create", entityType: "role", entityId: role.id, summary: `Created role "${role.name}"`, after: { permissions: role.permissions } });
    return role;
  }

  async update(actor: Actor, id: string, data: UpdateRoleInput) {
    const role = await this.roles.findById(actor.organizationId, id);
    if (!role) throw AppError.notFound("Role not found");
    if (role.isLocked) throw AppError.forbidden("The Owner role cannot be edited");
    if (role.id === actor.roleId) throw AppError.forbidden("You cannot edit your own role");
    if (data.permissions) {
      if ((data.permissions as string[]).includes(WILDCARD)) throw AppError.badRequest("Only the Owner role may hold every permission");
      this.assertCanGrant(actor, data.permissions);
      // Nobody may hand out a permission they only hold through the role being edited either — covered by assertCanGrant.
    }
    await this.roles.update(actor.organizationId, id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
    });
    PermissionCache.invalidateOrganization(actor.organizationId);
    await this.audit.log(actor, {
      action: "update",
      entityType: "role",
      entityId: id,
      summary: `Updated role "${data.name ?? role.name}"`,
      before: { permissions: role.permissions },
      after: { permissions: data.permissions ?? role.permissions },
    });
    return this.roles.findById(actor.organizationId, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const role = await this.roles.findById(actor.organizationId, id);
    if (!role) throw AppError.notFound("Role not found");
    if (role.isLocked) throw AppError.forbidden("The Owner role cannot be deleted");
    if (role.id === actor.roleId) throw AppError.forbidden("You cannot delete your own role");
    if ((await this.roles.countMembers(id)) > 0) throw AppError.conflict("Move the staff on this role to another role first");
    await this.roles.softDelete(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "role", entityId: id, summary: `Deleted role "${role.name}"` });
  }
}
