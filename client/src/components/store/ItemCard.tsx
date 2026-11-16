import { memo } from "react"
import { Link } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { Badge } from "@/components/ui/badge"
import { FoodArt } from "./FoodArt"
import type { CurrencyFormat } from "@/lib/money"
import { cn, plural } from "@/lib/utils"
import type { StoreItemCard as Item } from "@/types/store.types"

interface Props {
  item: Item
  slug: string
  fmt: CurrencyFormat
  view?: "grid" | "list"
}

export const ItemCard = memo(({ item, slug, fmt, view = "grid" }: Props) => {
  const price = (
    <span className="font-medium">
      {item.hasPricedVariants ? <span className="text-xs text-muted-foreground">From </span> : null}
      <Money value={item.fromPrice} fmt={fmt} />
    </span>
  )
  const soldOut = !item.isAvailable
  const body =
    view === "list" ? (
      <div className="flex gap-3 p-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          <FoodArt name={item.name} imageUrl={item.imageUrl} grayscale={soldOut} iconClassName="size-1/2" />
          {soldOut ? <Badge variant="destructive" className="absolute left-1 top-1">Sold out</Badge> : null}
        </div>
        <div className={cn("min-w-0 flex-1", soldOut && "opacity-60")}>
          <p className="font-medium leading-snug">{item.name}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-1 flex items-center justify-between text-sm">
            {price}
            {item.optionGroupCount > 0 ? <span className="text-xs text-muted-foreground">{plural(item.optionGroupCount, "option")}</span> : null}
          </div>
        </div>
      </div>
    ) : (
      <>
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <FoodArt name={item.name} imageUrl={item.imageUrl} grayscale={soldOut} className="transition duration-500 group-hover:scale-[1.04]" />
          {soldOut ? <Badge variant="destructive" className="absolute left-2 top-2">Sold out</Badge> : item.isFeatured ? <Badge variant="accent" className="absolute left-2 top-2">Favourite</Badge> : null}
        </div>
        <div className={cn("p-3", soldOut && "opacity-60")}>
          <p className="font-medium leading-snug">{item.name}</p>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-2 flex items-center justify-between text-sm">
            {price}
            {item.optionGroupCount > 0 ? <span className="text-xs text-muted-foreground">{plural(item.optionGroupCount, "option")}</span> : null}
          </div>
        </div>
      </>
    )
  return (
    <Link
      to={soldOut ? "#" : `/${slug}/item/${item.id}`}
      aria-disabled={soldOut}
      onClick={(e) => soldOut && e.preventDefault()}
      className={cn("group block overflow-hidden rounded-xl border bg-card transition hover:shadow-md", soldOut && "cursor-not-allowed")}
      data-cy={`item-card-${item.id}`}
    >
      {body}
    </Link>
  )
})
ItemCard.displayName = "ItemCard"
