// "Answer within 2:41": how long a rider has left to accept or decline before the delivery is passed to someone else.
import { Timer } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function AnswerClock({ answerBy }: { answerBy: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!answerBy) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [answerBy])
  if (!answerBy) return null

  const ms = new Date(answerBy).getTime() - now
  const late = ms <= 0
  const left = `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-medium", late || ms < 60_000 ? "text-destructive" : "text-warning")} role="timer" data-cy="answer-clock">
      <Timer className="size-4" aria-hidden />
      {late ? "Time's up, it's being passed to another rider" : `Answer within ${left}`}
    </p>
  )
}
