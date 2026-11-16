import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AccessEndpoints, StaffEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"

export const STAFF_KEY = "admin-staff"
type Body = Record<string, unknown>

export function usePermissions(enabled = true) {
  return useQuery({ queryKey: [STAFF_KEY, "permissions"], queryFn: async () => unwrap(await AccessEndpoints.permissions()), staleTime: Infinity, enabled })
}
export function useRoles(enabled = true) {
  return useQuery({ queryKey: [STAFF_KEY, "roles"], queryFn: async () => unwrap(await AccessEndpoints.roles()), enabled })
}
export function useStaffList(params: Body) {
  return useQuery({
    queryKey: [STAFF_KEY, "list", params],
    queryFn: async () => {
      const res = await StaffEndpoints.list({ limit: 20, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
    placeholderData: keepPreviousData,
  })
}
export function useInvites(enabled = true) {
  return useQuery({ queryKey: [STAFF_KEY, "invites"], queryFn: async () => unwrap(await StaffEndpoints.invites()), enabled })
}

export function useStaffMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [STAFF_KEY] })
  const m = <V,>(fn: (v: V) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done })
  return {
    createRole: m((b: Body) => AccessEndpoints.createRole(b).then(unwrap)),
    updateRole: m((v: { id: string; body: Body }) => AccessEndpoints.updateRole(v.id, v.body).then(unwrap)),
    deleteRole: m((id: string) => AccessEndpoints.deleteRole(id).then(unwrap)),
    invite: m((b: Body) => StaffEndpoints.invite(b).then(unwrap)),
    resendInvite: m((id: string) => StaffEndpoints.resendInvite(id).then(unwrap)),
    revokeInvite: m((id: string) => StaffEndpoints.revokeInvite(id).then(unwrap)),
    update: m((v: { id: string; body: Body }) => StaffEndpoints.update(v.id, v.body).then(unwrap)),
    deactivate: m((id: string) => StaffEndpoints.deactivate(id).then(unwrap)),
    activate: m((id: string) => StaffEndpoints.activate(id).then(unwrap)),
    transferOwnership: m((v: { userId: string; password: string }) => StaffEndpoints.transferOwnership(v).then(unwrap)),
  }
}
