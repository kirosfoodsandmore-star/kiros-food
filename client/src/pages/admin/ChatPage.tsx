import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { ChevronLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { Pagination } from "@/components/shared/Pagination"
import { EmptyState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ChatPanel } from "@/components/store/ChatPanel"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/AuthContext"
import { CHAT_KEY, useConversations } from "@/hooks/useAdminMisc"
import { useAdminBranch } from "@/hooks/useAdminBranch"
import { useSocketEvent } from "@/hooks/useSocketEvent"
import { cn } from "@/lib/utils"
import type { ConversationRow } from "@/types/admin.types"

export default function ChatPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [branchId, setBranchId] = useAdminBranch()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [branchId, unreadOnly])
  // The open conversation is kept as a row, so it stays open when new messages move it to another page.
  const [opened, setOpened] = useState<ConversationRow | null>(null)
  const active = opened?.orderId ?? null
  const setActive = (row: ConversationRow | null) => setOpened(row)
  const { data: res } = useConversations({ branchId: branchId || undefined, unreadOnly, page })
  const data = res?.data
  useSocketEvent("staff", "chat:message", useCallback(() => void qc.invalidateQueries({ queryKey: [CHAT_KEY] }), [qc]))
  const current = data?.find((c) => c.orderId === active) ?? opened

  return (
    <div data-cy="chat-page">
      <PageHeader title="Chat" description="Conversations with customers about their orders." actions={
        // The filters only affect the list, so on phones they step aside while a conversation is open.
        <div className={cn("flex flex-wrap items-center gap-2", current && "hidden lg:flex")}><label className="flex items-center gap-2 text-sm"><Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} data-cy="chat-unread-toggle" /> Unread only</label><BranchSelect value={branchId} onChange={setBranchId} allowAll /></div>
      } />
      {/* Master/detail: below lg only one pane shows at a time (list, or the open conversation with a back link). */}
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ul className={cn("max-h-[70dvh] divide-y overflow-y-auto rounded-xl border bg-card", current && "hidden lg:block")} data-cy="chat-list">
          {!data || data.length === 0 ? <li className="p-4"><EmptyState title="No conversations" className="border-0" /></li> : null}
          {(data ?? []).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setActive(c)} className={cn("w-full p-3 text-left hover:bg-muted/60", active === c.orderId && "bg-muted")} data-cy={`conversation-${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.orderNumber}</span>
                  {c.staffUnread > 0 ? <span className="rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">{c.staffUnread}</span> : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{c.lastSenderType === "staff" ? "You: " : ""}{c.lastMessagePreview}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.customerName ?? c.customerPhone} · {c.branchName}</span>
                  <span>{c.lastMessageAt ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true }) : ""}</span>
                </div>
              </button>
            </li>
          ))}
          {res?.meta && res.meta.totalPages > 1 ? <li className="px-3 pb-3"><Pagination meta={res.meta} onPageChange={setPage} /></li> : null}
        </ul>
        {active && current ? (
          <div className="min-w-0 space-y-3">
            <button type="button" onClick={() => setActive(null)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline lg:hidden" data-cy="chat-back">
              <ChevronLeft className="size-4" /> All conversations
            </button>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">{current.orderNumber} · {current.customerName ?? current.customerPhone}</span>
              <StatusBadge status={current.orderStatus} />
            </div>
            <ChatPanel kind="staff" orderId={active} canReply={can("chat.reply")} className="h-[min(36rem,calc(100dvh-16rem))] min-h-80" />
          </div>
        ) : <EmptyState title="Pick a conversation" className="hidden h-full lg:flex" />}
      </div>
    </div>
  )
}
