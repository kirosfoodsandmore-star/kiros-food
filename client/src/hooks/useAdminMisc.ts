// Promo codes, customers, reports, dashboard, audit log, chat inbox, platform.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChatEndpoints, CustomerEndpoints, PlatformEndpoints, PromoEndpoints, ReportEndpoints } from "@/endpoints/admin.endpoints"
import { periodWindow, type Period } from "@/lib/emailLogPeriod"
import { unwrap } from "@/transport/http"
import type { PlatformSettings } from "@/types/admin.types"

type Body = Record<string, unknown>
export const PROMOS_KEY = "admin-promos"
export const CUSTOMERS_KEY = "admin-customers"
export const REPORTS_KEY = "admin-reports"
export const AUDIT_KEY = "admin-audit"
export const CHAT_KEY = "admin-chat"
export const PLATFORM_KEY = "platform"

export function usePromos(params: { page: number; search?: string }) {
  return useQuery({
    queryKey: [PROMOS_KEY, params],
    queryFn: async () => {
      const res = await PromoEndpoints.list({ limit: 20, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
    placeholderData: keepPreviousData,
  })
}
export function usePromoMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [PROMOS_KEY] })
  return {
    create: useMutation({ mutationFn: async (b: Body) => unwrap(await PromoEndpoints.create(b)), onSuccess: done }),
    update: useMutation({ mutationFn: async (v: { id: string; body: Body }) => unwrap(await PromoEndpoints.update(v.id, v.body)), onSuccess: done }),
    remove: useMutation({ mutationFn: async (id: string) => unwrap(await PromoEndpoints.remove(id)), onSuccess: done }),
  }
}

export function useCustomers(params: Body) {
  return useQuery({
    queryKey: [CUSTOMERS_KEY, params],
    queryFn: async () => {
      const res = await CustomerEndpoints.list({ limit: 20, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
  })
}
export function useCustomerMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] })
  return {
    block: useMutation({ mutationFn: async (v: { id: string; reason?: string }) => unwrap(await CustomerEndpoints.block(v.id, v.reason)), onSuccess: done }),
    unblock: useMutation({ mutationFn: async (id: string) => unwrap(await CustomerEndpoints.unblock(id)), onSuccess: done }),
  }
}

export function useSalesReport(params: Body, enabled = true) {
  return useQuery({ queryKey: [REPORTS_KEY, "sales", params], queryFn: async () => unwrap(await ReportEndpoints.sales(params)), enabled, placeholderData: keepPreviousData })
}
export function useDashboard(branchId?: string) {
  return useQuery({ queryKey: [REPORTS_KEY, "dashboard", branchId ?? "all"], queryFn: async () => unwrap(await ReportEndpoints.dashboard(branchId)), refetchInterval: 60_000 })
}
export function useAuditLog(params: Body) {
  return useQuery({
    queryKey: [AUDIT_KEY, params],
    queryFn: async () => {
      const res = await ReportEndpoints.audit({ limit: 25, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
  })
}

export function useConversations(params: { branchId?: string; unreadOnly?: boolean; page: number }) {
  return useQuery({
    queryKey: [CHAT_KEY, "conversations", params],
    queryFn: async () => {
      const res = await ChatEndpoints.conversations({ limit: 30, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function usePlatformOverview() {
  return useQuery({ queryKey: [PLATFORM_KEY, "overview"], queryFn: async () => unwrap(await PlatformEndpoints.overview()) })
}
export function usePlatformRestaurants(params: Body) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "restaurants", params],
    queryFn: async () => {
      const res = await PlatformEndpoints.restaurants({ limit: 20, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
  })
}
export function usePlatformOnline() {
  return useQuery({ queryKey: [PLATFORM_KEY, "online"], queryFn: async () => unwrap(await PlatformEndpoints.online()), refetchInterval: 15_000 })
}
/** The log for the filters in `params` and the chosen period. A relative period ("last 24 hours") is resolved every time it loads. */
export function usePlatformEmailLogs(params: Body, period: Period) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "email-logs", params, period],
    queryFn: async () => {
      const res = await PlatformEndpoints.emailLogs({ limit: 25, ...params, ...periodWindow(period) })
      return { data: unwrap(res), meta: res.meta }
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    retry: false,
  })
}
/** Sent / failed / skipped counts for the same period and filters (without the status filter). */
export function usePlatformEmailSummary(params: Body, period: Period) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "email-summary", params, period],
    queryFn: async () => unwrap(await PlatformEndpoints.emailLogSummary({ ...params, ...periodWindow(period) })),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    retry: false,
  })
}
export function usePlatformSettings() {
  return useQuery({ queryKey: [PLATFORM_KEY, "settings"], queryFn: async () => unwrap(await PlatformEndpoints.settings()), retry: false })
}
export function usePlatformMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [PLATFORM_KEY] })
  return {
    suspend: useMutation({ mutationFn: async (id: string) => unwrap(await PlatformEndpoints.suspend(id)), onSuccess: done }),
    unsuspend: useMutation({ mutationFn: async (id: string) => unwrap(await PlatformEndpoints.unsuspend(id)), onSuccess: done }),
    updateSettings: useMutation({
      mutationFn: async (body: Partial<PlatformSettings>) => unwrap(await PlatformEndpoints.updateSettings(body)),
      onSuccess: (saved) => qc.setQueryData([PLATFORM_KEY, "settings"], saved),
    }),
  }
}
