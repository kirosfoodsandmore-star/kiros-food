// Storefront client state (Zustand, persisted per browser): the selected branch & menu, fulfilment, the
// cart token, view mode and which overlay is open. Server state (menu, cart contents) stays in React Query.
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Fulfilment } from "@/types/store.types"

export type Overlay = "nav" | "branch" | "menu" | "search" | "cart" | null

interface StoreSessionState {
  slug: string | null
  branchId: string | null
  menuId: string | null
  fulfilment: Fulfilment
  cartId: string | null
  cartToken: string | null
  viewMode: "grid" | "list"
  overlay: Overlay
  setSlug: (slug: string) => void
  setBranch: (branchId: string, menuId?: string | null) => void
  setMenu: (menuId: string | null) => void
  setFulfilment: (f: Fulfilment) => void
  setCart: (cartId: string, token: string) => void
  clearCart: () => void
  setViewMode: (m: "grid" | "list") => void
  open: (o: Overlay) => void
  close: () => void
}

export const useStoreSession = create<StoreSessionState>()(
  persist(
    (set, get) => ({
      slug: null,
      branchId: null,
      menuId: null,
      fulfilment: "delivery",
      cartId: null,
      cartToken: null,
      viewMode: "grid",
      overlay: null,
      setSlug: (slug) => {
        // Switching restaurant resets everything tied to the previous one.
        if (get().slug !== slug) set({ slug, branchId: null, menuId: null, cartId: null, cartToken: null, overlay: null })
      },
      setBranch: (branchId, menuId) => set({ branchId, menuId: menuId === undefined ? (get().branchId === branchId ? get().menuId : null) : menuId }),
      setMenu: (menuId) => set({ menuId }),
      setFulfilment: (fulfilment) => set({ fulfilment }),
      setCart: (cartId, cartToken) => set({ cartId, cartToken }),
      clearCart: () => set({ cartId: null, cartToken: null }),
      setViewMode: (viewMode) => set({ viewMode }),
      open: (overlay) => set({ overlay }),
      close: () => set({ overlay: null }),
    }),
    { name: "kiros.store", partialize: (s) => ({ slug: s.slug, branchId: s.branchId, menuId: s.menuId, fulfilment: s.fulfilment, cartId: s.cartId, cartToken: s.cartToken, viewMode: s.viewMode }) }
  )
)
