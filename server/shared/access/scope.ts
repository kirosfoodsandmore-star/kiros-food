// Record-scope helpers. Organisation isolation always applies first (every query filters on
// actor.organizationId); branch scope applies on top: a staff member sees the branches on their
// account, or every branch when `allBranches` is set (the Owner always has it).
import { AppError } from "../errors/AppError";
import type { Actor } from "../types/actor";
import { hasWildcard } from "./can";

export function seesAllBranches(actor: Actor): boolean {
  return actor.allBranches || hasWildcard(actor);
}

export function canAccessBranch(actor: Actor, branchId: string): boolean {
  return seesAllBranches(actor) || actor.branchIds.includes(branchId);
}

export function assertBranchAccess(actor: Actor, branchId: string, message = "This branch is not assigned to you"): void {
  if (!canAccessBranch(actor, branchId)) throw AppError.forbidden(message);
}

/**
 * Branch filter for list queries: `null` means every branch; otherwise the branch ids to filter on.
 * A requested branch outside the actor's scope is refused rather than silently widened.
 */
export function branchScope(actor: Actor, requested?: string | null): string[] | null {
  if (requested) {
    assertBranchAccess(actor, requested);
    return [requested];
  }
  if (seesAllBranches(actor)) return null;
  if (actor.branchIds.length === 0) throw AppError.forbidden("Your account is not assigned to any branch");
  return [...actor.branchIds];
}
