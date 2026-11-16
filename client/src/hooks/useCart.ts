// Server-side cart. The cart id + anonymous token live in the Zustand session; contents in React Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { useStoreSession } from "@/stores/storeSession"
import { ApiError, unwrap } from "@/transport/http"
import type { Cart, Fulfilment } from "@/types/store.types"
import { STORE_KEY } from "./useStore"

export function useCart() {
  const qc = useQueryClient()
  const { slug, branchId, menuId, fulfilment, cartId, cartToken, setCart, clearCart, setBranch } = useStoreSession()
  const key = [STORE_KEY, slug, "cart", cartId]

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await StoreEndpoints.cart(slug!, cartId!, cartToken!)
      if (!res.success && (res.statusCode === 404 || res.statusCode === 401)) {
        clearCart()
        return null
      }
      return unwrap(res)
    },
    enabled: Boolean(slug && cartId && cartToken),
    staleTime: 15_000,
  })

  const put = useCallback(
    (cart: Cart) => {
      qc.setQueryData([STORE_KEY, slug, "cart", cart.id], cart)
    },
    [qc, slug]
  )

  /** Get the current cart or create one for the selected branch. */
  const ensureCart = useCallback(async (): Promise<{ id: string; token: string }> => {
    if (cartId && cartToken) return { id: cartId, token: cartToken }
    if (!slug || !branchId) throw new ApiError("Choose a branch first", 400)
    const cart = unwrap(await StoreEndpoints.createCart(slug, { branchId, menuId, fulfilment }))
    if (!cart.token) throw new ApiError("Could not start a bag", 500)
    setCart(cart.id, cart.token)
    put(cart)
    return { id: cart.id, token: cart.token }
  }, [cartId, cartToken, slug, branchId, menuId, fulfilment, setCart, put])

  const mutate = <TVars>(fn: (ids: { id: string; token: string }, vars: TVars) => Promise<Cart>) =>
    useMutation({
      mutationFn: async (vars: TVars) => fn(await ensureCart(), vars),
      onSuccess: (cart) => put(cart),
    })

  const addLine = mutate<{ itemId: string; quantity: number; note?: string | null; selectedOptionIds: string[] }>(async ({ id, token }, body) => unwrap(await StoreEndpoints.addLine(slug!, id, token, body)))
  const updateLine = mutate<{ lineId: string; quantity?: number; note?: string | null; selectedOptionIds?: string[] }>(async ({ id, token }, { lineId, ...body }) => unwrap(await StoreEndpoints.updateLine(slug!, id, token, lineId, body)))
  const removeLine = mutate<string>(async ({ id, token }, lineId) => unwrap(await StoreEndpoints.removeLine(slug!, id, token, lineId)))
  const clear = mutate<void>(async ({ id, token }) => unwrap(await StoreEndpoints.clearCart(slug!, id, token)))
  const update = mutate<Record<string, unknown>>(async ({ id, token }, body) => unwrap(await StoreEndpoints.updateCart(slug!, id, token, body)))
  const applyPromo = mutate<string>(async ({ id, token }, code) => unwrap(await StoreEndpoints.applyPromo(slug!, id, token, code)))
  const removePromo = mutate<void>(async ({ id, token }) => unwrap(await StoreEndpoints.removePromo(slug!, id, token)))
  const switchBranch = useMutation({
    mutationFn: async (vars: { branchId: string; menuId?: string | null }) => {
      setBranch(vars.branchId, vars.menuId ?? null)
      if (!cartId || !cartToken) return null
      return unwrap(await StoreEndpoints.switchBranch(slug!, cartId, cartToken, vars))
    },
    onSuccess: (cart) => {
      if (cart) put(cart)
    },
  })
  const setFulfilment = useMutation({
    mutationFn: async (f: Fulfilment) => {
      useStoreSession.getState().setFulfilment(f)
      if (!cartId || !cartToken) return null
      return unwrap(await StoreEndpoints.updateCart(slug!, cartId, cartToken, { fulfilment: f, scheduledFor: null }))
    },
    onSuccess: (cart) => {
      if (cart) put(cart)
    },
  })

  return {
    cart: query.data ?? null,
    isLoading: query.isLoading,
    itemCount: query.data?.itemCount ?? 0,
    ensureCart,
    addLine,
    updateLine,
    removeLine,
    clear,
    update,
    applyPromo,
    removePromo,
    switchBranch,
    setFulfilment,
    refetch: query.refetch,
    reset: clearCart,
  }
}
