// Finance ledger, budgets and business analytics.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FinanceEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"
import type { FinanceBudget, FinanceCategory, FinanceEntryInput } from "@/types/finance.types"

export const FINANCE_KEY = "admin-finance"
type Body = Record<string, unknown>

export function useFinanceCatalog() {
  const q = useQuery({ queryKey: [FINANCE_KEY, "catalog"], queryFn: async () => unwrap(await FinanceEndpoints.categories()), staleTime: Infinity })
  const byKey = new Map<string, FinanceCategory>((q.data?.categories ?? []).map((c) => [c.key, c]))
  return { ...q, byKey, label: (key: string) => byKey.get(key)?.label ?? key }
}

export function useFinanceEntries(params: Body) {
  return useQuery({
    queryKey: [FINANCE_KEY, "entries", params],
    queryFn: async () => {
      const res = await FinanceEndpoints.entries({ limit: 25, ...params })
      return { data: unwrap(res), meta: res.meta, sum: res.meta?.summary?.amount ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

export function useFinanceAnalytics(params: Body) {
  return useQuery({ queryKey: [FINANCE_KEY, "analytics", params], queryFn: async () => unwrap(await FinanceEndpoints.analytics(params)), placeholderData: keepPreviousData })
}

export function useFinanceBudgets() {
  return useQuery({ queryKey: [FINANCE_KEY, "budgets"], queryFn: async () => unwrap(await FinanceEndpoints.budgets()) })
}

export function useFinanceMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [FINANCE_KEY] })
  return {
    create: useMutation({ mutationFn: async (b: FinanceEntryInput) => unwrap(await FinanceEndpoints.create(b)), onSuccess: done }),
    importMany: useMutation({ mutationFn: async (rows: FinanceEntryInput[]) => unwrap(await FinanceEndpoints.importMany(rows)), onSuccess: done }),
    update: useMutation({ mutationFn: async (v: { id: string; body: Partial<FinanceEntryInput> }) => unwrap(await FinanceEndpoints.update(v.id, v.body)), onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => unwrap(await FinanceEndpoints.remove(id)), onSuccess: done }),
    setBudgets: useMutation({ mutationFn: async (rows: FinanceBudget[]) => unwrap(await FinanceEndpoints.setBudgets(rows)), onSuccess: done }),
  }
}
