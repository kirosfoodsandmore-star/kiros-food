import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"
import { OrderEndpoints, PaymentEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"
import type { OrderFilters } from "@/types/admin.types"
import type { OrderStatus } from "@/types/store.types"
import { useSocketEvent } from "./useSocketEvent"

export const ADMIN_ORDERS_KEY = "admin-orders"
export const PAYMENTS_KEY = "admin-payments"

/** Invalidates order queries whenever the socket reports a change. */
export function useLiveOrderInvalidation() {
  const qc = useQueryClient()
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [ADMIN_ORDERS_KEY] })
    void qc.invalidateQueries({ queryKey: [PAYMENTS_KEY] })
  }, [qc])
  useSocketEvent("staff", "order:new", invalidate)
  useSocketEvent("staff", "order:updated", invalidate)
  useSocketEvent("staff", "payment:claimed", invalidate)
  useSocketEvent("staff", "delivery:updated", invalidate)
}

/** Orders at the stage where the restaurant has to step in: paid, or a bank transfer waiting to be confirmed. */
const NEEDS_ATTENTION = "paid,awaiting_confirmation"

/**
 * How many new orders nobody has dealt with yet, for the sidebar badge: at one branch, or at all of them when `branchId`
 * is empty. An order stops counting as soon as someone on the team acts on it (confirms its payment, accepts or rejects
 * it), so the badge clears when you've processed it. It asks for a one-row page and reads the total, so it stays cheap,
 * and it lives under the orders query key, so order sockets and status changes refresh it along with everything else.
 */
export function useAttentionOrderCount(enabled: boolean, branchId?: string) {
  return useQuery({
    queryKey: [ADMIN_ORDERS_KEY, "attention-count", branchId || "all"],
    queryFn: async () => {
      const res = await OrderEndpoints.list({ status: NEEDS_ATTENTION, unhandled: true, limit: 1, branchId: branchId || undefined })
      unwrap(res)
      return res.meta?.total ?? 0
    },
    enabled,
    refetchInterval: 60_000,
  })
}

export function useAdminOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: [ADMIN_ORDERS_KEY, "list", filters],
    queryFn: async () => {
      const res = await OrderEndpoints.list({ limit: 20, ...filters })
      return { data: unwrap(res), meta: res.meta }
    },
  })
}

export function useOrderBoard(branchId?: string) {
  return useQuery({
    queryKey: [ADMIN_ORDERS_KEY, "board", branchId ?? "all"],
    queryFn: async () => unwrap(await OrderEndpoints.board(branchId)),
    refetchInterval: 30_000,
  })
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({ queryKey: [ADMIN_ORDERS_KEY, "detail", id], queryFn: async () => unwrap(await OrderEndpoints.get(id!)), enabled: Boolean(id) })
}

/** The rider's own list: still to do, or (with `done`) delivered in the last 24 hours. */
export function useMyDeliveries(done = false) {
  return useQuery({ queryKey: [ADMIN_ORDERS_KEY, "my-deliveries", done ? "done" : "active"], queryFn: async () => unwrap(await OrderEndpoints.myDeliveries(done)), refetchInterval: 30_000 })
}

export function useRiders(orderId: string | undefined, enabled: boolean) {
  // Always re-asked when a screen opens: who's on duty changes whenever a rider flips their switch.
  return useQuery({ queryKey: [ADMIN_ORDERS_KEY, "riders", orderId], queryFn: async () => unwrap(await OrderEndpoints.riders(orderId!)), enabled: enabled && Boolean(orderId), refetchOnMount: "always", refetchInterval: 30_000 })
}

/** A rider's own on/off-duty switch. Flips instantly on screen and rolls back if the server says no. */
export function useMyAvailability() {
  const qc = useQueryClient()
  const key = [ADMIN_ORDERS_KEY, "my-availability"]
  const query = useQuery({ queryKey: key, queryFn: async () => unwrap(await OrderEndpoints.myAvailability()) })
  const set = useMutation({
    mutationFn: async (onDuty: boolean) => unwrap(await OrderEndpoints.setMyAvailability(onDuty)),
    onMutate: async (onDuty) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<{ onDuty: boolean }>(key)
      qc.setQueryData(key, { onDuty })
      return { before }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  return { onDuty: query.data?.onDuty ?? null, loading: query.isPending, saving: set.isPending, set: (onDuty: boolean) => set.mutate(onDuty, { onError: (e) => toast.error(e.message) }) }
}

export function useOrderMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [ADMIN_ORDERS_KEY] })
  return {
    changeStatus: useMutation({ mutationFn: async (v: { id: string; status: OrderStatus; note?: string | null; code?: string }) => unwrap(await OrderEndpoints.changeStatus(v.id, v.status, v.note, v.code)), onSuccess: done }),
    respond: useMutation({ mutationFn: async (v: { id: string; action: "accept" | "decline"; reason?: string }) => unwrap(await OrderEndpoints.respond(v.id, v.action, v.reason)), onSuccess: done }),
    reject: useMutation({ mutationFn: async (v: { id: string; reason: string }) => unwrap(await OrderEndpoints.reject(v.id, v.reason)), onSuccess: done }),
    refund: useMutation({ mutationFn: async (v: { id: string; amount?: number; note: string }) => unwrap(await OrderEndpoints.refund(v.id, { amount: v.amount, note: v.note })), onSuccess: done }),
    assignRider: useMutation({ mutationFn: async (v: { id: string; riderId: string | null }) => unwrap(await OrderEndpoints.assignRider(v.id, v.riderId)), onSuccess: done }),
  }
}

export function usePaymentQueue(params: { branchId?: string; status?: "claimed" | "pending" | "all"; page: number }) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, params],
    queryFn: async () => {
      const res = await PaymentEndpoints.queue({ limit: 20, ...params })
      return { data: unwrap(res), meta: res.meta }
    },
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function usePaymentMutations() {
  const qc = useQueryClient()
  const done = () => {
    void qc.invalidateQueries({ queryKey: [PAYMENTS_KEY] })
    void qc.invalidateQueries({ queryKey: [ADMIN_ORDERS_KEY] })
  }
  return {
    confirm: useMutation({ mutationFn: async (id: string) => unwrap(await PaymentEndpoints.confirm(id)), onSuccess: done }),
    reject: useMutation({ mutationFn: async (v: { id: string; reason: string }) => unwrap(await PaymentEndpoints.reject(v.id, v.reason)), onSuccess: done }),
  }
}
