// Photos for an item that already exists: every change (add, remove, new cover) saves straight away.
import { useState } from "react"
import { toast } from "sonner"
import { PhotoUploader, type PhotoEntry } from "@/components/admin/PhotoUploader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMenuMutations } from "@/hooks/useAdminMenu"
import type { Item } from "@/types/admin.types"

export function ItemPhotosPanel({ item, disabled }: { item: Item; disabled?: boolean }) {
  const { addItemPhotos, removeItemPhoto, reorderItemPhotos } = useMenuMutations()
  // Previews of files still on their way up, so the grid fills in at once instead of after the upload.
  const [pending, setPending] = useState<PhotoEntry[]>([])
  const busy = addItemPhotos.isPending || removeItemPhoto.isPending || reorderItemPhotos.isPending

  const add = async (files: File[]) => {
    const previews = files.map((f) => ({ id: `pending-${crypto.randomUUID()}`, url: URL.createObjectURL(f), uploading: true }))
    setPending(previews)
    try {
      await addItemPhotos.mutateAsync({ id: item.id, files })
      toast.success(files.length === 1 ? "Photo added" : `${files.length} photos added`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending([])
      for (const p of previews) URL.revokeObjectURL(p.url)
    }
  }

  const remove = async (photoId: string) => {
    try {
      await removeItemPhoto.mutateAsync({ id: item.id, photoId })
      toast.success("Photo removed")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const makeCover = async (photoId: string) => {
    try {
      await reorderItemPhotos.mutateAsync({ id: item.id, ids: [photoId, ...item.images.map((p) => p.id).filter((id) => id !== photoId)] })
      toast.success("Cover photo changed")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return <PhotoUploader photos={[...item.images, ...pending]} busy={busy} disabled={disabled} onAdd={(f) => void add(f)} onRemove={(id) => void remove(id)} onMakeCover={(id) => void makeCover(id)} />
}

/** A small dialog just for photos, opened from the item card so adding pictures is one obvious click away. */
export function ItemPhotosDialog({ item, onOpenChange }: { item: Item | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-cy="item-photos-dialog">
        <DialogHeader>
          <DialogTitle>Photos{item ? `: ${item.name}` : ""}</DialogTitle>
          <DialogDescription>Add as many as you like. Changes save as you go.</DialogDescription>
        </DialogHeader>
        {item ? <ItemPhotosPanel item={item} /> : null}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)} data-cy="item-photos-done">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
