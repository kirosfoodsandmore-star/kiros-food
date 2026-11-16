// Generated artwork for dishes, categories and menus that have no photo: a palette gradient picked
// deterministically from the name, a dotted texture and a food icon matched to the name. The same
// dish always gets the same art, and photos (when uploaded) always win.
import {
  CakeSlice,
  Coffee,
  Croissant,
  CupSoda,
  Citrus,
  Donut,
  Drumstick,
  EggFried,
  Fish,
  GlassWater,
  Hamburger,
  IceCreamCone,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Apple,
  Banana,
  Beef,
  Carrot,
  Cherry,
  Cookie,
  Egg,
  Grape,
  Leaf,
  Milk,
  ShoppingBasket,
  Wheat,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS: Array<[RegExp, LucideIcon]> = [
  // Dish types win over the ingredients in their names ("Chicken salad", "Very Berry" smoothie).
  [/salad/i, Salad],
  [/shawarma|\bwraps?\b|sandwich/i, Sandwich],
  [/smoothie/i, CupSoda],
  [/juice/i, Citrus],
  [/parfait|granola/i, IceCreamCone],
  [/burger|smash/i, Hamburger],
  [/boba|bubble|milk ?tea|tea\b|matcha|chai/i, CupSoda],
  // Fresh produce and groceries
  [/apple|pear\b/i, Apple],
  [/banana|plantain/i, Banana],
  [/cherry|berry|berries/i, Cherry],
  [/grape/i, Grape],
  [/carrot|tomato|onion|potato|\byams?\b|cassava|cucumber|okra|vegetable|veggie/i, Carrot],
  [/spinach|ugu|lettuce|cabbage|kale|leaf|leaves|herb|basil|scent/i, Leaf],
  [/\beggs?\b/i, Egg],
  [/milk|dairy|yoghurt|yogurt|cheese|butter/i, Milk],
  [/grain|flour|beans|\boats?\b|cereal|wheat|garri|semo|maize/i, Wheat],
  [/grocer|pantry|provision|household|staple/i, ShoppingBasket],
  [/coffee|latte|espresso|cappuccino|caf[eé]|mocha/i, Coffee],
  [/smoothie|juice|mango|passion|fruit|lemon|citrus|orange/i, Citrus],
  [/fries|chips|popcorn|sides?\b/i, Popcorn],
  [/chicken|wing|drumstick|suya/i, Drumstick],
  [/pizza/i, Pizza],
  [/salad|greens|veg/i, Salad],
  [/wrap|sandwich|shawarma|sub\b|toast/i, Sandwich],
  [/breakfast|brunch|omelette|fried egg/i, EggFried],
  [/fish|prawn|shrimp|seafood|sushi/i, Fish],
  [/beef|steak|goat|meat|grill|bbq/i, Beef],
  [/rice|bowl|jollof|soup|stew|noodle|pasta|ramen/i, Soup],
  [/cake|dessert|sweet/i, CakeSlice],
  [/ice ?cream|gelato|sundae/i, IceCreamCone],
  [/donut|doughnut/i, Donut],
  [/croissant|pastr|bakery|bread/i, Croissant],
  [/cookie|biscuit/i, Cookie],
  [/water|drink|soda|beverage/i, GlassWater],
]

export function foodIcon(...hints: Array<string | null | undefined>): LucideIcon {
  const text = hints.filter(Boolean).join(" ")
  return ICONS.find(([re]) => re.test(text))?.[1] ?? ShoppingBasket
}

/** Palettes for a restaurant's collections (menus), by position, so they look the same on the home page and in the switcher. */
export const COLLECTION_PALETTES = ["art-0", "art-1", "art-3", "art-2"]

export function artPalette(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `art-${h % 6}`
}

interface FoodArtProps {
  name: string
  /** Extra words for icon matching (e.g. the category or menu name). */
  hint?: string | null
  imageUrl?: string | null
  className?: string
  iconClassName?: string
  /** Seed for the palette when siblings should differ (defaults to the name). */
  seed?: string
  grayscale?: boolean
  /** Alt text when a real photo is shown (decorative by default). */
  alt?: string
  /** Force a palette class (e.g. "art-1") instead of picking one from the name. */
  palette?: string
}

export function FoodArt({ name, hint, imageUrl, className, iconClassName, seed, grayscale, alt = "", palette }: FoodArtProps) {
  if (imageUrl) return <img src={imageUrl} alt={alt} loading="lazy" className={cn("size-full object-cover", grayscale && "grayscale", className)} />
  const Icon = foodIcon(name, hint)
  return (
    <div className={cn("food-art relative isolate grid size-full place-items-center overflow-hidden", palette ?? artPalette(seed ?? name), grayscale && "grayscale", className)} aria-hidden>
      <div className="food-art-dots absolute inset-0 -z-10 opacity-70" />
      <div className="absolute -right-[12%] -top-[18%] -z-10 aspect-square w-3/5 rounded-full border-[10px] border-white/15" />
      <div className="absolute -bottom-[25%] -left-[10%] -z-10 aspect-square w-1/2 rounded-full bg-white/10" />
      <Icon className={cn("size-2/5 text-white drop-shadow-[0_8px_16px_rgb(0_0_0/0.25)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110", iconClassName)} strokeWidth={1.5} />
    </div>
  )
}
