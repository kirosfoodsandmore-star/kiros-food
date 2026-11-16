// The authenticated callers. Built by the auth middlewares from the JWT + the database (never from
// the token alone), passed as the first argument to every service method.

/** A staff member of a restaurant (admin portal). */
export interface Actor {
  id: string;
  organizationId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  name: string;
  email: string;
  /** Resolved permission codes. `"*"` means every permission inside the organisation. */
  permissions: readonly string[];
  /** Branches this person works in. Ignored when `allBranches` is true. */
  branchIds: readonly string[];
  allBranches: boolean;
  ip?: string;
}

/** A customer of a restaurant (storefront). Identity is the phone number, verified through Firebase. */
export interface CustomerActor {
  id: string;
  organizationId: string;
  phone: string;
  name: string | null;
  email: string | null;
  ip?: string;
}
