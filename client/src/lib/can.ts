// Permission helper mirroring server/shared/access/can.ts. Client checks are for usability only.
export const WILDCARD = "*"

export function can(permissions: readonly string[] | undefined, code: string): boolean {
  if (!permissions) return false
  return permissions.includes(WILDCARD) || permissions.includes(code)
}

export function canAny(permissions: readonly string[] | undefined, ...codes: string[]): boolean {
  return codes.some((c) => can(permissions, c))
}

export function canAll(permissions: readonly string[] | undefined, ...codes: string[]): boolean {
  return codes.every((c) => can(permissions, c))
}
