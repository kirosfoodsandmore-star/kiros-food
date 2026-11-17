// Staff management: invite by email, resend / revoke, edit role & branches, deactivate (ends sessions
// immediately), transfer ownership. Rules from the spec: always at least one active Owner; a user
// cannot edit their own role; a user cannot grant a role holding permissions they do not hold.
import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { can, hasWildcard } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import { FirebaseAuthService } from "../../../shared/firebase/firebaseAuth.service";
import type { Actor } from "../../../shared/types/actor";
import { hashToken, randomToken } from "../../../shared/utils/jwt";
import { WILDCARD, type PermissionCode } from "../../access/catalog/permissions.catalog";
import { OWNER_ROLE_KEY } from "../../access/catalog/roles.catalog";
import { RoleRepository } from "../../access/repositories/role.repository";
import { AuditService } from "../../audit/services/audit.service";
import { RefreshTokenRepository } from "../../auth/repositories/refreshToken.repository";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import type { StaffDTO, StaffInviteDTO } from "../dto/user.dto";
import { StaffInviteRepository } from "../repositories/staffInvite.repository";
import { UserRepository } from "../repositories/user.repository";
import type { AcceptInviteInput, InviteStaffInput, ListStaffQuery, UpdateStaffInput } from "../validators/user.schema";

export class StaffService {
  static Instance = new StaffService();
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly invites = StaffInviteRepository.Instance,
    private readonly roles = RoleRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  list(actor: Actor, query: ListStaffQuery) {
    return this.users.list(actor.organizationId, { ...query, scopeBranchIds: branchScope(actor) });
  }

  async get(actor: Actor, id: string): Promise<StaffDTO> {
    const user = await this.users.findById(actor.organizationId, id);
    if (!user) throw AppError.notFound("Staff member not found");
    const scope = branchScope(actor);
    if (scope && !user.allBranches && !user.branchIds.some((b) => scope.includes(b))) throw AppError.notFound("Staff member not found");
    return user;
  }

  listInvites(actor: Actor): Promise<StaffInviteDTO[]> {
    return this.invites.list(actor.organizationId);
  }

  /** A role may only be handed out by someone who holds every permission in it. */
  private async assertCanAssignRole(actor: Actor, roleId: string) {
    const role = await this.roles.findById(actor.organizationId, roleId);
    if (!role) throw AppError.notFound("Role not found");
    if (hasWildcard(actor)) return role;
    if (role.permissions.includes(WILDCARD)) throw AppError.forbidden("Only an Owner can assign the Owner role");
    const missing = role.permissions.filter((code) => !can(actor, code as PermissionCode));
    if (missing.length > 0) throw AppError.forbidden("You cannot assign a role with permissions you do not hold");
    return role;
  }

  private async assertBranchesExist(organizationId: string, branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) return;
    const known = await this.branches.existingIds(organizationId, branchIds);
    if (known.length !== new Set(branchIds).size) throw AppError.badRequest("One of the branches does not exist");
  }

  async invite(actor: Actor, data: InviteStaffInput): Promise<StaffInviteDTO> {
    const role = await this.assertCanAssignRole(actor, data.roleId);
    await this.assertBranchesExist(actor.organizationId, data.branchIds);
    if (await this.users.existsByEmail(data.email)) throw AppError.conflict("A staff account with this email already exists");
    const existing = await this.invites.findPendingByEmail(actor.organizationId, data.email);
    if (existing) throw AppError.conflict("An invitation for this email is still pending — resend or revoke it");

    const token = randomToken(32);
    const invite = await this.invites.create({
      organizationId: actor.organizationId,
      email: data.email,
      name: data.name,
      roleId: role.id,
      branchIds: data.allBranches ? [] : data.branchIds,
      allBranches: data.allBranches,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.inviteTtlHours * 3_600_000),
      invitedById: actor.id,
    });
    await this.audit.log(actor, { action: "invite", entityType: "staff", entityId: invite.id, summary: `Invited ${data.email} as ${role.name}` });
    domainEvents.emit("staff.invited", { organizationId: actor.organizationId, inviteId: invite.id, token });
    const list = await this.invites.list(actor.organizationId);
    return list.find((i) => i.id === invite.id)!;
  }

  async resendInvite(actor: Actor, id: string): Promise<void> {
    const invite = await this.invites.findById(actor.organizationId, id);
    if (!invite || invite.acceptedAt || invite.revokedAt) throw AppError.notFound("Pending invitation not found");
    const token = randomToken(32);
    await this.invites.update(id, { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + env.inviteTtlHours * 3_600_000) });
    domainEvents.emit("staff.invited", { organizationId: actor.organizationId, inviteId: id, token });
  }

  async revokeInvite(actor: Actor, id: string): Promise<void> {
    const invite = await this.invites.findById(actor.organizationId, id);
    if (!invite || invite.acceptedAt) throw AppError.notFound("Pending invitation not found");
    await this.invites.update(id, { revokedAt: new Date() });
    await this.audit.log(actor, { action: "revoke", entityType: "staff_invite", entityId: id, summary: `Revoked the invitation for ${invite.email}` });
  }

  /** Public: what the invitee sees before choosing a password. */
  async previewInvite(token: string) {
    const invite = await this.invites.findByTokenHash(hashToken(token));
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
      throw AppError.notFound("This invitation link is invalid or has expired");
    }
    const role = await this.roles.findById(invite.organizationId, invite.roleId);
    return { email: invite.email, name: invite.name, roleName: role?.name ?? "Staff", expiresAt: invite.expiresAt };
  }

  /** Public: the invitee sets a password and becomes an active staff member. Returns ids for sign-in. */
  async acceptInvite(data: AcceptInviteInput): Promise<{ userId: string; organizationId: string }> {
    const invite = await this.invites.findByTokenHash(hashToken(data.token));
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
      throw AppError.notFound("This invitation link is invalid or has expired");
    }
    if (await this.users.existsByEmail(invite.email)) throw AppError.conflict("A staff account with this email already exists");
    const name = data.name ?? invite.name;
    const firebase = FirebaseAuthService.Instance;
    let firebaseUid: string;
    if (data.idToken) {
      // Google: the account must be the one the invitation was emailed to.
      const identity = await firebase.verifyIdToken(data.idToken);
      if (!identity.emailVerified || identity.email !== invite.email.toLowerCase()) {
        throw AppError.badRequest(`Sign in with the Google account for ${invite.email} to accept this invitation`);
      }
      firebaseUid = identity.uid;
    } else {
      firebaseUid = await firebase.upsertUserPassword(invite.email, data.password!, name);
    }

    const userId = await inTransaction(async (tx) => {
      const id = await this.users.create(
        {
          organizationId: invite.organizationId,
          roleId: invite.roleId,
          name,
          email: invite.email,
          firebaseUid,
          phone: data.phone ?? null,
          branchIds: invite.branchIds,
          allBranches: invite.allBranches,
          isActive: true,
        },
        tx
      );
      await this.invites.update(invite.id, { acceptedAt: new Date() }, tx);
      await this.audit.record(null, invite.organizationId, { action: "create", entityType: "staff", entityId: id, summary: `${name} accepted the invitation (${invite.email})` }, tx);
      return id;
    });
    return { userId, organizationId: invite.organizationId };
  }

  async update(actor: Actor, id: string, data: UpdateStaffInput): Promise<StaffDTO> {
    const user = await this.get(actor, id);
    if (data.roleId !== undefined && data.roleId !== user.roleId) {
      if (id === actor.id) throw AppError.forbidden("You cannot change your own role");
      await this.assertCanAssignRole(actor, data.roleId);
      if (user.roleKey === OWNER_ROLE_KEY) await this.assertNotLastOwner(actor.organizationId, user);
    }
    if (data.branchIds) await this.assertBranchesExist(actor.organizationId, data.branchIds);
    await this.users.update(actor.organizationId, id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
      ...(data.allBranches !== undefined ? { allBranches: data.allBranches } : {}),
      ...(data.branchIds !== undefined ? { branchIds: data.allBranches ? [] : data.branchIds } : {}),
    });
    PermissionCache.invalidateUser(id);
    const after = await this.get(actor, id);
    await this.audit.log(actor, {
      action: "update",
      entityType: "staff",
      entityId: id,
      summary: `Updated ${after.name} (${after.roleName}${after.allBranches ? ", all branches" : `, ${after.branchNames.join(", ") || "no branch"}`})`,
      before: { roleId: user.roleId, branchIds: user.branchIds, allBranches: user.allBranches },
      after: { roleId: after.roleId, branchIds: after.branchIds, allBranches: after.allBranches },
    });
    return after;
  }

  private async assertNotLastOwner(organizationId: string, user: StaffDTO): Promise<void> {
    if (user.roleKey !== OWNER_ROLE_KEY || !user.isActive) return;
    const owners = await this.users.countActiveOwners(organizationId, user.roleId, user.id);
    if (owners === 0) throw AppError.conflict("There must always be at least one active Owner");
  }

  async setActive(actor: Actor, id: string, isActive: boolean): Promise<StaffDTO> {
    const user = await this.get(actor, id);
    if (id === actor.id) throw AppError.forbidden("You cannot deactivate your own account");
    if (!isActive) await this.assertNotLastOwner(actor.organizationId, user);
    if (user.roleKey === OWNER_ROLE_KEY && !hasWildcard(actor)) throw AppError.forbidden("Only an Owner can change another Owner");
    await inTransaction(async (tx) => {
      await this.users.update(actor.organizationId, id, { isActive }, tx);
      if (!isActive) await this.tokens.revokeAllForSubject("staff", id, tx);
      await this.audit.log(actor, { action: isActive ? "activate" : "deactivate", entityType: "staff", entityId: id, summary: `${isActive ? "Reactivated" : "Deactivated"} ${user.name}` }, tx);
    });
    PermissionCache.invalidateUser(id);
    const creds = await this.users.findCredentialsByEmail(user.email);
    await FirebaseAuthService.Instance.disableUser(creds?.firebaseUid ?? null, !isActive);
    if (!isActive) {
      await FirebaseAuthService.Instance.revokeSessions(creds?.firebaseUid ?? null);
      domainEvents.emit("staff.deactivated", { organizationId: actor.organizationId, userId: id });
    }
    return this.get(actor, id);
  }

  /** Owner only: hand the Owner role to another active staff member; the caller becomes a Branch manager. */
  async transferOwnership(actor: Actor, targetUserId: string, password: string): Promise<void> {
    if (!hasWildcard(actor)) throw AppError.forbidden("Only an Owner can transfer ownership");
    if (targetUserId === actor.id) throw AppError.badRequest("Choose another staff member");
    if (!(await FirebaseAuthService.Instance.checkPassword(actor.email, password))) throw AppError.unauthorised("Your password is incorrect");
    const target = await this.get(actor, targetUserId);
    if (!target.isActive) throw AppError.badRequest("The new owner must be an active staff member");
    const ownerRole = await this.roles.findByKey(actor.organizationId, OWNER_ROLE_KEY);
    const managerRole = await this.roles.findByKey(actor.organizationId, "branch_manager");
    if (!ownerRole || !managerRole) throw AppError.unavailable("Preset roles are missing");
    await inTransaction(async (tx) => {
      await this.users.update(actor.organizationId, targetUserId, { roleId: ownerRole.id, allBranches: true, branchIds: [] }, tx);
      await this.users.update(actor.organizationId, actor.id, { roleId: managerRole.id }, tx);
      await this.audit.log(actor, { action: "transfer_ownership", entityType: "staff", entityId: targetUserId, summary: `Transferred ownership to ${target.name}` }, tx);
    });
    PermissionCache.invalidateOrganization(actor.organizationId);
  }
}
