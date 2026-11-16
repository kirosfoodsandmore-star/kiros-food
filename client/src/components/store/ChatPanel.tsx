// Order conversation UI shared by the storefront (customer) and admin (staff).
import { format } from "date-fns"
import { Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOrderChat } from "@/hooks/useOrderChat"
import type { TokenKind } from "@/lib/storage"
import { cn } from "@/lib/utils"

export function ChatPanel({ kind, slug, orderId, canReply = true, className }: { kind: TokenKind; slug?: string; orderId: string; canReply?: boolean; className?: string }) {
  const { messages, isLoading, isLive, send, error } = useOrderChat({ kind, slug, orderId })
  const [text, setText] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  // Pin the message list to the newest message. Scroll only the list (scrollIntoView would also scroll
  // the page), and use a block body: an effect must return a cleanup function or nothing.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const submit = () => {
    const body = text.trim()
    if (!body) return
    send.mutate(body, { onSuccess: () => setText(""), onError: (e) => toast.error(e.message) })
  }

  return (
    <div className={cn("flex h-80 flex-col rounded-xl border bg-card", className)} data-cy="chat-panel">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="font-medium">Chat with {kind === "customer" ? "the branch" : "the customer"}</span>
        <span className={cn("text-xs", isLive ? "text-success" : "text-muted-foreground")}>{isLive ? "Live" : "Updates on refresh"}</span>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3" role="log" aria-live="polite" aria-label="Messages">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
        {!isLoading && messages.length === 0 ? <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello.</p> : null}
        {messages.map((m) => {
          const mine = m.authorType === kind
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")} data-cy="chat-message">
              <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {!mine ? <p className="text-[11px] font-medium opacity-80">{m.authorName}</p> : null}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.createdAt ? format(new Date(m.createdAt), "HH:mm") : "sending…"}</p>
              </div>
            </div>
          )
        })}
      </div>
      {canReply ? (
        <form
          className="flex gap-2 border-t p-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={2000} data-cy="chat-input" />
          <Button type="submit" size="icon" loading={send.isPending} disabled={!text.trim()} aria-label="Send" data-cy="chat-send">
            <Send />
          </Button>
        </form>
      ) : null}
    </div>
  )
}
