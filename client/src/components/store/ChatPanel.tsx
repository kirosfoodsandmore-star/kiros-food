// Order conversation UI shared by the storefront (customer) and admin (staff). A message is text, one photo or PDF, or both.
import { format } from "date-fns"
import { FileText, Paperclip, Send, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOrderChat } from "@/hooks/useOrderChat"
import type { TokenKind } from "@/lib/storage"
import { cn } from "@/lib/utils"
import type { ChatAttachment } from "@/types/store.types"

/** The server refuses larger files. */
const MAX_FILE_MB = 10

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function Attachment({ a, mine }: { a: ChatAttachment; mine: boolean }) {
  // Links come from the server (only it writes messages), but never render anything that isn't an https address.
  if (!/^https:\/\//i.test(a.url)) return null
  if (a.mimeType.startsWith("image/")) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-lg" data-cy="chat-attachment-image">
        <img src={a.url} alt={a.name} loading="lazy" className="max-h-52 w-full rounded-lg object-cover" />
      </a>
    )
  }
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className={cn("mt-1 flex items-center gap-2 rounded-lg border px-2 py-1.5", mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border bg-background hover:bg-muted")} data-cy="chat-attachment-file">
      <FileText className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{a.name}</span>
        <span className="block text-[10px] opacity-70">PDF · {sizeLabel(a.bytes)}</span>
      </span>
    </a>
  )
}

export function ChatPanel({ kind, slug, orderId, canReply = true, className }: { kind: TokenKind; slug?: string; orderId: string; canReply?: boolean; className?: string }) {
  const { messages, isLoading, isLive, send, error } = useOrderChat({ kind, slug, orderId })
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Pin the message list to the newest message. Scroll only the list (scrollIntoView would also scroll
  // the page), and use a block body: an effect must return a cleanup function or nothing.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const pickFile = (picked: File | undefined) => {
    if (!picked) return
    if (picked.size > MAX_FILE_MB * 1024 * 1024) return void toast.error(`That file is too big. Please choose one under ${MAX_FILE_MB} MB.`)
    setFile(picked)
  }
  const canSend = Boolean(text.trim() || file)
  const submit = () => {
    const body = text.trim()
    if (!body && !file) return
    send.mutate({ body, file }, { onSuccess: () => { setText(""); setFile(null) }, onError: (e) => toast.error(e.message) })
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
                {m.attachment ? <Attachment a={m.attachment} mine={mine} /> : null}
                {m.body ? <p className={cn("whitespace-pre-wrap break-words", m.attachment && "mt-1")}>{m.body}</p> : null}
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.createdAt ? format(new Date(m.createdAt), "HH:mm") : "sending…"}</p>
              </div>
            </div>
          )
        })}
      </div>
      {canReply ? (
        <form
          className="border-t p-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {file ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1.5 text-sm" data-cy="chat-file-chosen">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{sizeLabel(file.size)}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} disabled={send.isPending} aria-label="Remove attachment" data-cy="chat-file-remove"><X /></Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} data-cy="chat-file-input" />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={send.isPending} aria-label="Attach a photo or PDF" title="Attach a photo or PDF" data-cy="chat-attach"><Paperclip /></Button>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={file ? "Add a message (optional)" : "Type a message"} maxLength={2000} data-cy="chat-input" />
            <Button type="submit" size="icon" loading={send.isPending} disabled={!canSend} aria-label="Send" data-cy="chat-send">
              <Send />
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
