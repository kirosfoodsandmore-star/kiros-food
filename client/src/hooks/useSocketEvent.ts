import { useEffect } from "react"
import { connectSocket } from "@/lib/socket"
import type { TokenKind } from "@/lib/storage"

/** Subscribe to a Socket.io event for the lifetime of the component. */
export function useSocketEvent<T = unknown>(kind: TokenKind, event: string, handler: (payload: T) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const socket = connectSocket(kind)
    if (!socket) return
    socket.on(event, handler as (...args: unknown[]) => void)
    return () => {
      socket.off(event, handler as (...args: unknown[]) => void)
    }
  }, [kind, event, handler, enabled])
}
