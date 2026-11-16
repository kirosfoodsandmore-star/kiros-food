// A photo drop zone you can't miss, plus the photos so far. Add several at once by dragging them in or
// browsing; the first photo is the cover (what customers see on the menu), and any other can be made the cover.
// It only displays and reports: the caller decides whether changes save straight away or wait for a Save button.
import { Loader2, Star, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface PhotoEntry {
  id: string
  url: string
  /** Still uploading: shown dimmed with a spinner and no actions. */
  uploading?: boolean
}

/** What the server accepts; anything else is turned away here with a clear message instead of a failed upload. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_MB = 5

interface Props {
  photos: PhotoEntry[]
  max?: number
  /** Something is saving: the zone shows progress and nothing can be changed meanwhile. */
  busy?: boolean
  disabled?: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onMakeCover: (id: string) => void
  className?: string
}

export function PhotoUploader({ photos, max = 8, busy = false, disabled = false, onAdd, onRemove, onMakeCover, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave fire for every child the pointer crosses; counting keeps the highlight from flickering.
  const depth = useRef(0)
  const room = max - photos.length
  const locked = disabled || busy
  const full = room <= 0

  const take = (list: FileList | File[]) => {
    const picked = Array.from(list)
    const images = picked.filter((f) => ACCEPTED.includes(f.type))
    if (images.length < picked.length) toast.error(`${picked.length - images.length} file(s) skipped: use JPG, PNG, WebP or GIF images`)
    const sized = images.filter((f) => f.size <= MAX_MB * 1024 * 1024)
    if (sized.length < images.length) toast.error(`${images.length - sized.length} photo(s) skipped: each must be under ${MAX_MB} MB`)
    const use = sized.slice(0, Math.max(room, 0))
    if (sized.length > use.length) toast.error(room > 0 ? `Only ${room} more photo${room === 1 ? "" : "s"} fit (the limit is ${max}). The rest were skipped.` : `This item already has the maximum of ${max} photos`)
    if (use.length > 0) onAdd(use)
  }

  const drag = (e: React.DragEvent, kind: "enter" | "over" | "leave" | "drop") => {
    if (locked || full) return
    e.preventDefault()
    if (kind === "enter") {
      depth.current++
      setDragging(true)
    } else if (kind === "leave") {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    } else if (kind === "drop") {
      depth.current = 0
      setDragging(false)
      take(e.dataTransfer.files)
    }
  }

  const empty = photos.length === 0

  return (
    <div className={cn("space-y-3", className)} data-cy="photo-uploader">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => drag(e, "enter")}
        onDragOver={(e) => drag(e, "over")}
        onDragLeave={(e) => drag(e, "leave")}
        onDrop={(e) => drag(e, "drop")}
        disabled={locked || full}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          empty ? "py-8" : "py-4",
          dragging ? "border-primary bg-primary/10" : "border-input bg-muted/30 hover:border-primary/60 hover:bg-muted/60"
        )}
        data-cy="photo-dropzone"
      >
        {busy ? <Loader2 className="size-7 animate-spin text-primary" aria-hidden /> : <UploadCloud className={cn("text-primary", empty ? "size-8" : "size-6")} aria-hidden />}
        <span className="text-sm font-medium">
          {busy ? "Uploading…" : full ? `Photo limit reached (${max})` : dragging ? "Drop to add" : <>Drag photos here, or <span className="text-primary underline underline-offset-2">browse</span></>}
        </span>
        <span className="text-xs text-muted-foreground">
          {empty ? "Add several: " : ""}JPG, PNG or WebP, up to {MAX_MB} MB each · {photos.length} of {max} added
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) take(e.target.files)
          e.target.value = "" // so choosing the same file again still fires
        }}
        data-cy="photo-input"
      />

      {photos.length > 0 ? (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-cy="photo-list">
            {photos.map((p, i) => (
              <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted" data-cy="photo-tile">
                <img src={p.url} alt={`Photo ${i + 1}`} className={cn("size-full object-cover", p.uploading && "opacity-50")} />
                {i === 0 ? <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Cover</span> : null}
                {p.uploading ? (
                  <span className="absolute inset-0 grid place-items-center"><Loader2 className="size-5 animate-spin" aria-label="Uploading" /></span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      disabled={locked}
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-destructive shadow hover:bg-background disabled:opacity-50"
                      aria-label={`Remove photo ${i + 1}`}
                      data-cy="photo-remove"
                    >
                      <X className="size-3.5" />
                    </button>
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => onMakeCover(p.id)}
                        disabled={locked}
                        className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded bg-black/60 py-0.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:opacity-50"
                        data-cy="photo-cover"
                      >
                        <Star className="size-3" aria-hidden /> Make cover
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">The cover is the photo customers see first on the menu.</p>
        </>
      ) : null}
    </div>
  )
}
