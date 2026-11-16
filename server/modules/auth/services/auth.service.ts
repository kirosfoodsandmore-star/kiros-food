// Staff authentication. Firebase Authentication is the identity provider (email/password and Google);
// the server verifies with Firebase, then issues its own short-lived access JWT + rotating refresh
// token so permissions are always resolved from the database. Without Firebase credentials the
// server falls back to bcrypt so local development still works.
import crypto from "crypto";
import { env } from "../../../config/env";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { isPlatformAdmin } from "../../../shared/access/can";
import { PermissionCache } from "../../../shared/access/permissionCache";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import { FIREBASE_MANAGED_PASSWORD, FirebaseAuthService } from "../../../shared/firebase/firebaseAuth.service";
import type { ClientContext } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { hashRefreshToken, hashToken, newRefreshToken, signAccessToken, sixDigitCode, timingSafeEqualString } from "../../../shared/utils/jwt";
import { dummyHash, hashPassword, verifyPassword } from "../../../shared/utils/password";
import { AuditService } from "../../audit/services/audit.service";
import { OnboardingService } from "../../organization/services/onboarding.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { UserRepository } from "../../user/repositories/user.repository";
import { StaffService } from "../../user/services/staff.service";
import type { AcceptInviteInput } from "../../user/validators/user.schema";
import type { LoginResultDTO, SessionDTO, TokenPairDTO } from "../dto/auth.dto";
import { PasswordResetRepository } from "../repositories/passwordReset.repository";
import { RefreshTokenRepository } from "../repositories/refreshToken.repository";
import type { ChangePasswordInput, FirebaseSignInInput, LoginInput, RegisterInput, ResetPasswordWithCodeInput, UpdateProfileInput } from "../validators/auth.schema";
import { resolveActor } from "./actorResolver";

export class AuthService {
  static Instance = new AuthService();
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly tokens = RefreshTokenRepository.Instance,
    private readonly resets = PasswordResetRepository.Instance,
    private readonly organizations = OrganizationService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly firebase = FirebaseAuthService.Instance
  ) {}

  // ── Sign in / up ───────────────────────────────────────────────────────────

  async login(data: LoginInput, client: ClientContext): Promise<LoginResultDTO> {
    const creds = await this.users.findCredentialsByEmail(data.email);
    if (!creds) {
      await verifyPassword(data.password, dummyHash());
      throw AppError.unauthorised("Incorrect email or password");
    }
    const ok = await this.verifyAndMigratePassword(data.email, creds.id, creds.organizationId, creds.passwordHash, data.password);
    if (!ok) throw AppError.unauthorised("Incorrect email or password");
    if (!creds.isActive) throw AppError.forbidden("Your account has been deactivated. Contact the restaurant owner.");
    return this.complete(creds.id, creds.organizationId, client, "password");
  }

  /**
   * Firebase holds the password: verify there, and move a pre-Firebase bcrypt account over on first
   * successful sign-in so no password hash lingers in Postgres.
   */
  private async verifyAndMigratePassword(email: string, userId: string, organizationId: string, stored: string | null, plain: string): Promise<boolean> {
    if (this.firebase.isConfigured) {
      const result = await this.firebase.verifyUserPassword(email, plain);
      if (result.ok) {
        if (stored !== FIREBASE_MANAGED_PASSWORD) await this.users.update(organizationId, userId, { passwordHash: FIREBASE_MANAGED_PASSWORD, firebaseUid: result.uid });
        return true;
      }
      if (stored && stored !== FIREBASE_MANAGED_PASSWORD && (await verifyPassword(plain, stored))) {
        const uid = await this.firebase.upsertUserPassword(email, plain);
        await this.users.update(organizationId, userId, { passwordHash: FIREBASE_MANAGED_PASSWORD, firebaseUid: uid });
        return true;
      }
      return false;
    }
    return verifyPassword(plain, stored ?? dummyHash());
  }

  /** Whether the public "Create your restaurant" page works right now (the admin login hides the link when it doesn't). */
  async signupStatus(): Promise<{ open: boolean }> {
    return { open: await OnboardingService.Instance.signupOpen() };
  }

  async register(data: RegisterInput, client: ClientContext): Promise<LoginResultDTO> {
    await OnboardingService.Instance.assertSignupOpen();
    const created = await OnboardingService.Instance.createRestaurant({
      restaurantName: data.restaurantName,
      slug: data.slug ?? null,
      ownerName: data.ownerName,
      ownerEmail: data.email,
      ownerPassword: data.password,
      phone: data.phone,
      address: data.address,
    });
    domainEvents.emit("restaurant.registered", { organizationId: created.organizationId, ownerUserId: created.ownerUserId, method: "form" });
    return this.complete(created.ownerUserId, created.organizationId, client, "register");
  }

  /** Firebase ID token (Google sign-in or Firebase email/password on the client). */
  async firebaseSignIn(data: FirebaseSignInInput, client: ClientContext): Promise<LoginResultDTO> {
    const identity = await this.firebase.verifyIdToken(data.idToken);
    if (!identity.email || !identity.emailVerified) throw AppError.unauthorised("Your account email must be verified to sign in");
    return this.signInByIdentity(identity.email, identity.name, identity.uid, identity.provider, data, client);
  }

  /** Raw Google ID token (clients using Google Identity Services directly). */
  async googleSignIn(data: FirebaseSignInInput, client: ClientContext): Promise<LoginResultDTO> {
    const google = await this.firebase.verifyGoogleIdToken(data.idToken);
    return this.signInByIdentity(google.email, google.name, null, "google.com", data, client);
  }

  private async signInByIdentity(
    email: string,
    name: string | null,
    firebaseUid: string | null,
    provider: string,
    data: FirebaseSignInInput,
    client: ClientContext
  ): Promise<LoginResultDTO> {
    const existing = await this.users.findCredentialsByEmail(email);
    if (existing) {
      if (!existing.isActive) throw AppError.forbidden("Your account has been deactivated. Contact the restaurant owner.");
      if (firebaseUid && existing.firebaseUid !== firebaseUid) await this.users.update(existing.organizationId, existing.id, { firebaseUid });
      return this.complete(existing.id, existing.organizationId, client, provider);
    }
    // Unknown email: offer to create a restaurant only while sign-up is open; otherwise the person needs an invite.
    if (!(await OnboardingService.Instance.signupOpen())) {
      throw new AppError("No staff account exists for this email. Ask the restaurant owner to invite you.", 404);
    }
    if (!data.restaurantName) {
      throw new AppError("No staff account exists for this email. Create a restaurant to continue.", 404, [], { needsRegistration: true, email, name });
    }
    const created = await OnboardingService.Instance.createRestaurant({
      restaurantName: data.restaurantName,
      slug: data.slug ?? null,
      ownerName: name || email.split("@")[0],
      ownerEmail: email,
      ownerPassword: firebaseUid ? null : `Ggl_${crypto.randomBytes(12).toString("hex")}1a`,
      firebaseUid,
    });
    domainEvents.emit("restaurant.registered", { organizationId: created.organizationId, ownerUserId: created.ownerUserId, method: "google" });
    return this.complete(created.ownerUserId, created.organizationId, client, provider);
  }

  /** Staff invite accepted → signed in straight away. */
  async acceptInvite(data: AcceptInviteInput, client: ClientContext): Promise<LoginResultDTO> {
    const { userId, organizationId } = await StaffService.Instance.acceptInvite(data);
    return this.complete(userId, organizationId, client, "invite");
  }

  private async complete(userId: string, organizationId: string, client: ClientContext, method: string): Promise<LoginResultDTO> {
    const actor = await resolveActor(userId, organizationId);
    if (!actor) throw AppError.forbidden("This restaurant is suspended or your account is inactive");
    const tokens = await this.issueTokens(actor.id, client);
    await this.users.touchLogin(actor.id);
    this.audit
      .record({ ...actor, ip: client.ip ?? undefined }, actor.organizationId, { action: "login", entityType: "staff", entityId: actor.id, summary: `${actor.name} signed in (${method})` })
      .catch((err) => console.error("[audit] login log failed", err));
    domainEvents.emit("auth.signedIn", { organizationId: actor.organizationId, userId: actor.id, method, ip: client.ip });
    return { ...(await this.session(actor)), tokens };
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async refresh(refreshToken: string, client: ClientContext): Promise<TokenPairDTO> {
    const hash = hashRefreshToken(refreshToken);
    return inTransaction(async (tx) => {
      const row = await this.tokens.findByHashForUpdate(hash, tx);
      if (!row || row.subjectType !== "staff") throw AppError.unauthorised("Session expired — please sign in again");
      if (row.revokedAt) {
        // A revoked token being replayed means it may have been stolen: end every session for this user.
        await this.tokens.revokeAllForSubject("staff", row.subjectId, tx);
        throw AppError.unauthorised("Session expired — please sign in again");
      }
      if (row.expiresAt.getTime() < Date.now()) throw AppError.unauthorised("Session expired — please sign in again");
      const actorRow = await this.users.findActor(row.subjectId);
      if (!actorRow || !actorRow.isActive || actorRow.orgSuspended) throw AppError.unauthorised("Your account is inactive");
      await this.tokens.revoke(row.id, tx);
      return this.issueTokens(actorRow.id, client, tx, actorRow.organizationId);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeByHash(hashRefreshToken(refreshToken));
  }

  async session(actor: Actor): Promise<SessionDTO> {
    const user = await this.users.findById(actor.organizationId, actor.id);
    if (!user) throw AppError.unauthorised();
    const restaurant = await this.organizations.profile(actor.organizationId);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        roleKey: user.roleKey,
        roleName: user.roleName,
        branchIds: user.branchIds,
        allBranches: user.allBranches,
        isPlatformAdmin: isPlatformAdmin(user),
      },
      permissions: actor.permissions,
      restaurant,
    };
  }

  async updateProfile(actor: Actor, data: UpdateProfileInput): Promise<SessionDTO> {
    await this.users.update(actor.organizationId, actor.id, data);
    PermissionCache.invalidateUser(actor.id);
    const fresh = (await resolveActor(actor.id, actor.organizationId)) ?? actor;
    return this.session(fresh);
  }

  // ── Passwords ──────────────────────────────────────────────────────────────

  async changePassword(actor: Actor, data: ChangePasswordInput, client: ClientContext): Promise<TokenPairDTO> {
    const hash = await this.users.findPasswordHash(actor.id);
    const ok = await this.verifyAndMigratePassword(actor.email, actor.id, actor.organizationId, hash, data.currentPassword);
    if (!ok) throw AppError.badRequest("Your current password is incorrect");
    if (data.currentPassword === data.newPassword) throw AppError.badRequest("Choose a new password you haven't used here");
    let passwordHash = FIREBASE_MANAGED_PASSWORD;
    let firebaseUid: string | null = null;
    if (this.firebase.isConfigured) firebaseUid = await this.firebase.upsertUserPassword(actor.email, data.newPassword, actor.name);
    else passwordHash = await hashPassword(data.newPassword);
    const tokens = await inTransaction(async (tx) => {
      await this.users.update(actor.organizationId, actor.id, { passwordHash, ...(firebaseUid ? { firebaseUid } : {}) }, tx);
      await this.tokens.revokeAllForSubject("staff", actor.id, tx);
      await this.audit.log(actor, { action: "update", entityType: "staff", entityId: actor.id, summary: "Changed own password" }, tx);
      return this.issueTokens(actor.id, client, tx, actor.organizationId);
    });
    await this.firebase.revokeSessions(firebaseUid);
    domainEvents.emit("user.passwordChanged", { organizationId: actor.organizationId, userId: actor.id });
    return tokens;
  }

  /** Always answers the same way so it cannot be used to discover which emails have accounts. */
  async forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
    const message = "If an account exists for that email, a reset code has been sent to it.";
    const user = await this.users.findContactByEmail(email);
    if (!user || !user.isActive) return { message };
    if ((await this.resets.countRecent(user.id, 15)) >= 3) return { message };
    const code = sixDigitCode();
    await this.resets.create(user.id, hashToken(`reset:${user.id}:${code}`), new Date(Date.now() + env.otpTtlMinutes * 60_000));
    domainEvents.emit("auth.passwordResetRequested", { organizationId: user.organizationId, userId: user.id, code });
    return env.isProduction ? { message } : { message, devCode: code };
  }

  async resetPasswordWithCode(data: ResetPasswordWithCodeInput): Promise<{ message: string }> {
    const invalid = AppError.badRequest("That code is wrong or has expired. Request a new one.");
    const user = await this.users.findContactByEmail(data.email);
    if (!user || !user.isActive) throw invalid;
    let passwordHash = FIREBASE_MANAGED_PASSWORD;
    if (!this.firebase.isConfigured) passwordHash = await hashPassword(data.newPassword);
    let firebaseUid: string | null = null;
    const ok = await inTransaction(async (tx) => {
      const reset = await this.resets.activeForUpdate(user.id, tx);
      if (!reset || reset.attempts >= 5) return false;
      if (!timingSafeEqualString(reset.codeHash, hashToken(`reset:${user.id}:${data.code}`))) {
        await this.resets.addAttempt(reset.id, tx);
        return false;
      }
      if (this.firebase.isConfigured) firebaseUid = await this.firebase.upsertUserPassword(user.email, data.newPassword, user.name);
      await this.resets.markUsed(reset.id, tx);
      await this.users.update(user.organizationId, user.id, { passwordHash, ...(firebaseUid ? { firebaseUid } : {}) }, tx);
      await this.tokens.revokeAllForSubject("staff", user.id, tx);
      await this.audit.record(null, user.organizationId, { action: "update", entityType: "staff", entityId: user.id, summary: `${user.name} reset their password by email` }, tx);
      return true;
    });
    if (!ok) throw invalid;
    PermissionCache.invalidateUser(user.id);
    await this.firebase.revokeSessions(firebaseUid);
    domainEvents.emit("user.passwordChanged", { organizationId: user.organizationId, userId: user.id });
    return { message: "Your password has been reset. You can sign in now." };
  }

  private async issueTokens(userId: string, client: ClientContext, tx?: Parameters<RefreshTokenRepository["create"]>[1], organizationId?: string): Promise<TokenPairDTO> {
    const org = organizationId ?? (await this.users.findActor(userId))?.organizationId;
    if (!org) throw AppError.unauthorised();
    const refreshToken = newRefreshToken();
    await this.tokens.create(
      {
        subjectType: "staff",
        subjectId: userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
        userAgent: client.userAgent?.slice(0, 255) ?? null,
        ip: client.ip,
      },
      tx
    );
    return { accessToken: signAccessToken(userId, org), refreshToken, expiresIn: env.jwt.accessTtlSeconds };
  }
}
