import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BranchEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"
import type { OpeningHourRow } from "@/types/admin.types"

export const BRANCHES_KEY = "admin-branches"
type Body = Record<string, unknown>

export function useBranches() {
  return useQuery({ queryKey: [BRANCHES_KEY, "list"], queryFn: async () => unwrap(await BranchEndpoints.list()), staleTime: 5 * 60_000 })
}
export function useBranch(id: string | undefined) {
  return useQuery({ queryKey: [BRANCHES_KEY, "detail", id], queryFn: async () => unwrap(await BranchEndpoints.get(id!)), enabled: Boolean(id) })
}

export function useBranchMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [BRANCHES_KEY] })
  const m = <V,>(fn: (v: V) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done })
  return {
    create: m((b: Body) => BranchEndpoints.create(b).then(unwrap)),
    update: m((v: { id: string; body: Body }) => BranchEndpoints.update(v.id, v.body).then(unwrap)),
    remove: m((id: string) => BranchEndpoints.remove(id).then(unwrap)),
    removeMany: m((ids: string[]) => BranchEndpoints.removeMany(ids).then(unwrap)),
    pause: m((v: { id: string; paused: boolean; reason?: string | null }) => BranchEndpoints.pause(v.id, v.paused, v.reason).then(unwrap)),
    setHours: m((v: { id: string; hours: OpeningHourRow[] }) => BranchEndpoints.setHours(v.id, v.hours).then(unwrap)),
    addClosure: m((v: { id: string; date: string; reason?: string | null }) => BranchEndpoints.addClosure(v.id, { date: v.date, reason: v.reason }).then(unwrap)),
    removeClosure: m((v: { id: string; closureId: string }) => BranchEndpoints.removeClosure(v.id, v.closureId).then(unwrap)),
    createZone: m((v: { id: string; body: Body }) => BranchEndpoints.createZone(v.id, v.body).then(unwrap)),
    updateZone: m((v: { id: string; zoneId: string; body: Body }) => BranchEndpoints.updateZone(v.id, v.zoneId, v.body).then(unwrap)),
    deleteZone: m((v: { id: string; zoneId: string }) => BranchEndpoints.deleteZone(v.id, v.zoneId).then(unwrap)),
  }
}
