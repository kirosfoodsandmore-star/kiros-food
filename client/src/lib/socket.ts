// Socket.io client lifecycle. One connection per token kind; reconnects with a fresh token.
import { io, type Socket } from "socket.io-client"
import { tokenStorage, type TokenKind } from "@/lib/storage"
import { BASE_URL } from "@/transport/http"

const sockets: Partial<Record<TokenKind, Socket>> = {}

export function connectSocket(kind: TokenKind): Socket | null {
  const token = kind === "staff" ? tokenStorage.getAccess("staff") : tokenStorage.getAccess("customer")
  if (!token) return null
  const existing = sockets[kind]
  if (existing) {
    existing.auth = kind === "staff" ? { token } : { customerToken: token }
    if (!existing.connected) existing.connect()
    return existing
  }
  const socket = io(BASE_URL, {
    auth: kind === "staff" ? { token } : { customerToken: token },
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 10_000,
  })
  socket.on("connect_error", (err) => {
    if (err.message === "unauthorised") {
      const fresh = tokenStorage.getAccess(kind)
      if (fresh) socket.auth = kind === "staff" ? { token: fresh } : { customerToken: fresh }
    }
  })
  sockets[kind] = socket
  return socket
}

export function disconnectSocket(kind: TokenKind): void {
  sockets[kind]?.disconnect()
  delete sockets[kind]
}
