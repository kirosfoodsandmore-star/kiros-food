import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { useStoreSession } from "@/stores/storeSession"
import { unwrap } from "@/transport/http"
import type { OrderDetail, OrderStatus } from "@/types/store.types"
import { useSocketEvent } from "./useSocketEvent"
import { STORE_KEY } from "./useStore"

export const ORDERS_KEY = "orders"

/** An order is in progress until it is completed, cancelled or refunded. */
export const isActiveOrder = (status: OrderStatus) => !["completed", "cancelled", "refunded"].includes(status)

/** `poll` keeps the list fresh (every 30 s) for as long as something in it is still in progress. */
export function useMyOrders(slug: string, page: number, enabled: boolean, poll = false) {
  return useQuery({
    queryKey: [STORE_KEY, slug, ORDERS_KEY, page],
    queryFn: async () => {
      const res = await StoreEndpoints.orders(slug, { page, limit: 10 })
      return { data: unwrap(res), meta: res.meta }
    },
    enabled,
    refetchInterval: poll ? (q) => (q.state.data?.data.some((o) => isActiveOrder(o.status)) ? 30_000 : false) : false,
  })
}

/** The customer's orders still in progress, newest first: what the bar under the header points back to. */
export function useActiveOrders(slug: string, enabled: boolean) {
  const { data } = useMyOrders(slug, 1, enabled, true)
  return (data?.data ?? []).filter((o) => isActiveOrder(o.status))
}

export function useMyOrder(slug: string, id: string | undefined, enabled: boolean) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: [STORE_KEY, slug, ORDERS_KEY, "detail", id],
    queryFn: async () => unwrap(await StoreEndpoints.order(slug, id!)),
    enabled: enabled && Boolean(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s && ["completed", "cancelled", "refunded"].includes(s) ? false : 20_000
    },
  })
  const onUpdate = useCallback(
    (payload: { id: string }) => {
      if (payload.id === id) void qc.invalidateQueries({ queryKey: [STORE_KEY, slug, ORDERS_KEY] })
    },
    [qc, slug, id]
  )
  useSocketEvent<{ id: string }>("customer", "order:updated", onUpdate, enabled)
  return query
}

export function useOrderActions(slug: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: [STORE_KEY, slug, ORDERS_KEY] })
  const cancel = useMutation({ mutationFn: async (id: string) => unwrap(await StoreEndpoints.cancelOrder(slug, id)), onSuccess: invalidate })
  const verifyPayment = useMutation({ mutationFn: async (id: string) => unwrap(await StoreEndpoints.verifyPayment(slug, id)), onSuccess: invalidate })
  const claimTransfer = useMutation({
    mutationFn: async (vars: { id: string; receipt: File | null; note?: string }) => unwrap(await StoreEndpoints.transferClaim(slug, vars.id, vars.receipt, vars.note)),
    onSuccess: (order: OrderDetail) => {
      qc.setQueryData([STORE_KEY, slug, ORDERS_KEY, "detail", order.id], order)
      void invalidate()
    },
  })
  const reorder = useMutation({
    mutationFn: async (id: string) => unwrap(await StoreEndpoints.reorder(slug, id)),
    onSuccess: (cart) => {
      if (cart.token) {
        useStoreSession.getState().setBranch(cart.branchId, cart.menuId)
        useStoreSession.getState().setCart(cart.id, cart.token)
        qc.setQueryData([STORE_KEY, slug, "cart", cart.id], cart)
      }
    },
  })
  return { cancel, verifyPayment, claimTransfer, reorder }
}
