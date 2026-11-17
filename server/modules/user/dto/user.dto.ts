export interface ActorRow {
  id: string;
  organizationId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  name: string;
  email: string;
  isActive: boolean;
  permissions: string[];
  branchIds: string[];
  allBranches: boolean;
  orgSuspended: boolean;
}

export interface CredentialRow {
  id: string;
  organizationId: string;
  isActive: boolean;
  firebaseUid: string | null;
}

export interface StaffDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  branchIds: string[];
  branchNames: string[];
  allBranches: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface StaffInviteDTO {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  branchIds: string[];
  allBranches: boolean;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedByName: string | null;
  createdAt: Date;
  /** "pending" | "accepted" | "revoked" | "expired" */
  status: string;
}
