// ASAP or a scheduled slot. When the branch is closed, ASAP is disabled and a slot is required.
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Slots } from "@/types/store.types"

interface Props {
  slots: Slots | undefined
  value: string | null
  onChange: (iso: string | null) => void
  loading?: boolean
}

export function SlotPicker({ slots, value, onChange, loading }: Props) {
  const asapOk = slots?.asapAvailable ?? false
  const days = (slots?.days ?? []).filter((d) => d.slots.length > 0)
  const selectedDay = value ? days.find((d) => d.slots.some((s) => s.at === value))?.date : undefined
  return (
    <div className="space-y-2" data-cy="slot-picker">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!asapOk}
          onClick={() => onChange(null)}
          className={cn("rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50", value === null && asapOk ? "border-primary bg-secondary/50" : "")}
          data-cy="slot-asap"
        >
          As soon as possible
          {!asapOk ? <span className="block text-xs font-normal text-muted-foreground">Closed right now</span> : null}
        </button>
        <Select
          value={selectedDay ?? ""}
          onValueChange={(date) => {
            const first = days.find((d) => d.date === date)?.slots[0]
            if (first) onChange(first.at)
          }}
          disabled={loading || days.length === 0}
        >
          <SelectTrigger className={cn("h-auto py-2", value ? "border-primary bg-secondary/50" : "")} data-cy="slot-day">
            <SelectValue placeholder={loading ? "Loading…" : "Schedule for later"} />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d.date} value={d.date}>
                {format(new Date(`${d.date}T00:00:00`), "EEE d MMM")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selectedDay ? (
        <div className="flex flex-wrap gap-1.5" data-cy="slot-times">
          {days
            .find((d) => d.date === selectedDay)!
            .slots.map((s) => (
              <button key={s.at} type="button" onClick={() => onChange(s.at)} className={cn("rounded-md border px-2.5 py-1 text-xs", value === s.at ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")} data-cy={`slot-${s.label}`}>
                {s.label}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  )
}
