// Sticky category tabs that scroll to a section and highlight the one in view.
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export function CategoryTabs({ categories, offset = 112 }: { categories: Array<{ id: string; name: string }>; offset?: number }) {
  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sections = categories.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id.replace("cat-", ""))
      },
      { rootMargin: `-${offset}px 0px -60% 0px`, threshold: 0 }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [categories, offset])

  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [active])

  const go = (id: string) => {
    const el = document.getElementById(`cat-${id}`)
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset + 8, behavior: "smooth" })
  }

  return (
    <div ref={barRef} className="sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur scrollbar-none" role="tablist" data-cy="category-tabs">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          data-id={c.id}
          aria-selected={active === c.id}
          onClick={() => go(c.id)}
          className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition", active === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          data-cy={`category-tab-${c.id}`}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
