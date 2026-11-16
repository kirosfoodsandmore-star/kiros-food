// Storefront reads: profile, branches, menus, items, search, slots, quotes, payment methods.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { unwrap } from "@/transport/http"
import type { Fulfilment } from "@/types/store.types"

export const STORE_KEY = "store"

export function useStoreProfile(slug: string | null) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "profile"],
    queryFn: async () => unwrap(await StoreEndpoints.profile(slug!)),
    enabled: Boolean(slug),
    staleTime: 60_000, // the profile drives the footer, hero and contact details, so pick up admin edits within a minute
    retry: false,
  })
}

export function useStoreBranches(slug: string | null, at?: { lat: number; lng: number } | null, q?: string) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "branches", at ?? null, q ?? ""],
    queryFn: async () => unwrap(await StoreEndpoints.branches(slug!, { ...at, ...(q ? { q } : {}) })),
    enabled: Boolean(slug),
    staleTime: 60_000,
  })
}

export function useBranchMenus(slug: string | null, branchId: string | null) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "branch-menus", branchId],
    queryFn: async () => unwrap(await StoreEndpoints.menus(slug!, branchId!)),
    enabled: Boolean(slug && branchId),
  })
}

/** Full menu tree. Polls the cheap version endpoint and refetches when it changes. */
export function useStoreMenu(slug: string | null, menuId: string | null, branchId: string | null) {
  const qc = useQueryClient()
  const menu = useQuery({
    queryKey: [STORE_KEY, slug, "menu", menuId, branchId],
    queryFn: async () => unwrap(await StoreEndpoints.menu(slug!, menuId!, branchId!)),
    enabled: Boolean(slug && menuId && branchId),
    staleTime: 5 * 60_000,
  })
  const version = useQuery({
    queryKey: [STORE_KEY, slug, "menu-version", menuId, branchId],
    queryFn: async () => unwrap(await StoreEndpoints.menuVersion(slug!, menuId!, branchId!)),
    enabled: Boolean(slug && menuId && branchId && menu.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })
  useEffect(() => {
    if (menu.data && version.data && version.data.version !== menu.data.version) {
      void qc.invalidateQueries({ queryKey: [STORE_KEY, slug, "menu", menuId, branchId] })
      void qc.invalidateQueries({ queryKey: [STORE_KEY, slug, "cart"] })
    }
  }, [version.data, menu.data, qc, slug, menuId, branchId])
  return menu
}

export function useStoreItem(slug: string | null, itemId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "item", itemId, branchId],
    queryFn: async () => unwrap(await StoreEndpoints.item(slug!, itemId!, branchId!)),
    enabled: Boolean(slug && itemId && branchId),
  })
}

export function useStoreSearch(slug: string | null, branchId: string | null, q: string, menuId?: string | null) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "search", branchId, q, menuId ?? null],
    queryFn: async () => unwrap(await StoreEndpoints.search(slug!, { branchId: branchId!, q, ...(menuId ? { menuId } : {}) })),
    enabled: Boolean(slug && branchId && q.trim().length > 0),
    staleTime: 30_000,
  })
}

export function useFeatured(slug: string | null, branchId: string | null) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "featured", branchId],
    queryFn: async () => unwrap(await StoreEndpoints.featured(slug!, branchId!)),
    enabled: Boolean(slug && branchId),
  })
}

export function useSlots(slug: string | null, branchId: string | null, fulfilment: Fulfilment, at?: { lat: number; lng: number } | null, enabled = true) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "slots", branchId, fulfilment, at ?? null],
    queryFn: async () => unwrap(await StoreEndpoints.slots(slug!, branchId!, { fulfilment, ...at })),
    enabled: enabled && Boolean(slug && branchId),
    staleTime: 60_000,
  })
}

export function usePaymentMethods(slug: string | null, branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: [STORE_KEY, slug, "payment-methods", branchId],
    queryFn: async () => unwrap(await StoreEndpoints.paymentMethods(slug!, branchId!)),
    enabled: enabled && Boolean(slug && branchId),
  })
}
