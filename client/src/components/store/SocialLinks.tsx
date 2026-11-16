// Round social icons, shared by the footer and the Contact page. Unknown platforms are skipped.
import { Facebook, Instagram, MessageCircle, Music2, Twitter, Youtube, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const SOCIAL: Record<string, { icon: LucideIcon; label: string }> = {
  instagram: { icon: Instagram, label: "Instagram" },
  facebook: { icon: Facebook, label: "Facebook" },
  twitter: { icon: Twitter, label: "Twitter" },
  tiktok: { icon: Music2, label: "TikTok" },
  youtube: { icon: Youtube, label: "YouTube" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
}

export function SocialLinks({ links, tone = "ink", className }: { links: Record<string, string | null | undefined>; tone?: "ink" | "light"; className?: string }) {
  const entries = Object.entries(links).filter(([k, v]) => v && SOCIAL[k]) as Array<[string, string]>
  if (entries.length === 0) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Social media">
      {entries.map(([k, v]) => {
        const { icon: Icon, label } = SOCIAL[k]
        return (
          <li key={k}>
            <a
              href={k === "whatsapp" ? `https://wa.me/${v.replace(/\D/g, "")}` : v}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              title={label}
              className={cn("grid size-10 place-items-center rounded-full border transition hover:-translate-y-0.5", tone === "ink" ? "border-white/15 bg-white/5 hover:border-gold hover:text-gold" : "bg-card hover:border-primary hover:text-primary")}
            >
              <Icon className="size-4" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
