// A signed-in customer, anywhere on the storefront, gets a pop-up when the branch replies in an order's chat, with a
// button to open it. No pop-up for their own messages, or when they're already looking at that order (its chat updates
// live). When the site isn't open at all, the push notification (server/modules/push chatNotifier) covers it instead.
import { useCallback, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useSocketEvent } from "./useSocketEvent"

interface ChatEvent {
  orderId: string
  orderNumber: string
  authorType: "staff" | "customer"
  authorName: string
  preview: string
}

export function useReplyToast(): void {
  const { slug } = useStore()
  const { isSignedIn } = useCustomer()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const onMessage = useCallback(
    (m: ChatEvent) => {
      if (m.authorType !== "staff") return
      if (pathRef.current.startsWith(`/${slug}/orders/${m.orderId}`)) return
      toast.info(`Reply on your order ${m.orderNumber}`, { description: `${m.authorName}: ${m.preview}`, duration: 12_000, action: { label: "Open", onClick: () => navigate(`/${slug}/orders/${m.orderId}`) } })
    },
    [slug, navigate]
  )
  useSocketEvent<ChatEvent>("customer", "chat:message", onMessage, isSignedIn)
}
