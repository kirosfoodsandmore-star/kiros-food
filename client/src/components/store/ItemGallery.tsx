// The item page's picture: one photo as before, or a gallery (arrows, count and thumbnails) when there are several.
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { FoodArt } from "@/components/store/FoodArt"
import { cn } from "@/lib/utils"

interface Props {
  name: string
  hint: string
  /** Photo URLs, cover first. */
  images: string[]
  /** The cover, used if `images` is empty. */
  fallbackUrl: string | null
}

export function ItemGallery({ name, hint, images, fallbackUrl }: Props) {
  const urls = images.length > 0 ? images : fallbackUrl ? [fallbackUrl] : []
  const [index, setIndex] = useState(0)
  const current = Math.min(index, Math.max(0, urls.length - 1))
  const many = urls.length > 1
  const go = (step: number) => setIndex((current + step + urls.length) % urls.length)

  return (
    <div className="min-w-0 space-y-3" data-cy="item-gallery">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-sm">
        <FoodArt name={name} hint={hint} imageUrl={urls[current] ?? null} alt={many ? `${name}, photo ${current + 1} of ${urls.length}` : name} iconClassName="size-1/3" />
        {many ? (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow hover:bg-card" aria-label="Previous photo" data-cy="gallery-prev">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow hover:bg-card" aria-label="Next photo" data-cy="gallery-next">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-2 right-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">{current + 1} / {urls.length}</span>
          </>
        ) : null}
      </div>
      {many ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" data-cy="gallery-thumbs">
          {urls.map((url, i) => (
            <li key={`${i}-${url}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn("block size-16 overflow-hidden rounded-lg border-2 transition", i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
                aria-label={`Show photo ${i + 1} of ${urls.length}`}
                aria-current={i === current}
              >
                <img src={url} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
