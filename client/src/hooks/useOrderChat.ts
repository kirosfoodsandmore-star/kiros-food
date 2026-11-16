// Order chat: the API opens the conversation (and gives its id); messages stream from Firestore with
// onSnapshot when Firebase is configured, otherwise fall back to the API list + socket nudges.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { collection, onSnapshot, orderBy, query as fsQuery, where, type Timestamp } from "firebase/firestore"
import { useCallback, useEffect, useState } from "react"
import { ChatEndpoints } from "@/endpoints/admin.endpoints"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { firebaseAuth, firebaseConfigured, firestoreDb } from "@/lib/firebase"
import type { TokenKind } from "@/lib/storage"
import { unwrap } from "@/transport/http"
import type { ChatMessage, ConversationView } from "@/types/store.types"
import { useSocketEvent } from "./useSocketEvent"

interface Options {
  kind: TokenKind
  slug?: string
  orderId: string | undefined
  enabled?: boolean
}

export function useOrderChat({ kind, slug, orderId, enabled = true }: Options) {
  const qc = useQueryClient()
  const key = ["chat", kind, orderId]
  const conversation = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ConversationView> => (kind === "customer" ? unwrap(await StoreEndpoints.chat(slug!, orderId!)) : unwrap(await ChatEndpoints.open(orderId!))),
    enabled: enabled && Boolean(orderId) && (kind === "staff" || Boolean(slug)),
  })

  const [live, setLive] = useState<ChatMessage[] | null>(null)
  const [liveError, setLiveError] = useState(false)
  const conversationId = conversation.data?.conversationId

  useEffect(() => {
    setLive(null)
    if (!conversationId || !firebaseConfigured || !firebaseAuth().currentUser) return
    const q = fsQuery(collection(firestoreDb(), "orderChatMessages"), where("conversationId", "==", conversationId), where("deletedAt", "==", null), orderBy("createdAt", "asc"))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLive(
          snap.docs.map((d) => {
            const data = d.data() as Omit<ChatMessage, "id" | "createdAt"> & { createdAt: Timestamp | null }
            return { ...data, id: d.id, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null }
          })
        )
        setLiveError(false)
      },
      () => setLiveError(true)
    )
    return unsubscribe
  }, [conversationId])

  // Without a Firestore listener, refetch the API list when the socket says a message arrived.
  const onSocketMessage = useCallback(
    (payload: { orderId: string }) => {
      if (payload.orderId === orderId && live === null) void qc.invalidateQueries({ queryKey: key })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId, live, qc]
  )
  useSocketEvent<{ orderId: string }>(kind, "chat:message", onSocketMessage, enabled)

  const send = useMutation({
    mutationFn: async (body: string) => (kind === "customer" ? unwrap(await StoreEndpoints.sendChat(slug!, orderId!, body)) : unwrap(await ChatEndpoints.send(orderId!, body))),
    onSuccess: () => {
      if (live === null) void qc.invalidateQueries({ queryKey: key })
    },
  })

  return {
    conversation: conversation.data ?? null,
    messages: live ?? conversation.data?.messages ?? [],
    isLoading: conversation.isLoading,
    isLive: live !== null && !liveError,
    error: conversation.error,
    send,
  }
}
