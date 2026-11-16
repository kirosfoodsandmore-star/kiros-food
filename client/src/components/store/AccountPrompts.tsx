// Shown instead of a page that needs something saved on this device (orders, an order, account) when this browser
// has nothing. There are no customer accounts to sign in to: orders are saved on the device they were placed from, so
// the screen just explains that and points to the menu and to the restaurant for help.
import { PackageOpen } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useStore } from "@/contexts/StoreContext"

export function NothingSavedNotice({ title, text, cy }: { title: string; text: string; cy: string }) {
  const { slug } = useStore()
  return (
    <div className="mx-auto max-w-sm py-16 text-center" data-cy={cy}>
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><PackageOpen className="size-7" /></span>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild><Link to={`/${slug}/menu`}>Browse the menu</Link></Button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Need a hand? <Link to={`/${slug}/contact`} className="text-primary hover:underline">Contact us</Link></p>
    </div>
  )
}
