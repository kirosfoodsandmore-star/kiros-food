// Light / System / Dark choice. `ThemeSwitcher` is a segmented control (side menu, top bar); `ThemeMenu` is an
// icon button with a dropdown for tight spaces (admin header).
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { type ThemePreference, useTheme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
]

interface SwitcherProps {
  /** "icons" shows only the three symbols (compact); "labels" adds the words. */
  variant?: "icons" | "labels"
  /** Set when the control sits on the dark ink surface (top bar), where the page theme doesn't apply. */
  onInk?: boolean
  className?: string
}

export function ThemeSwitcher({ variant = "labels", onInk = false, className }: SwitcherProps) {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("inline-flex rounded-lg p-0.5", onInk ? "bg-white/10" : "bg-muted", variant === "labels" && "flex w-full", className)} data-cy="theme-switcher">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
              variant === "labels" ? "h-9 flex-1 px-2" : "size-6",
              on ? (onInk ? "bg-white/20 text-ink-foreground shadow-sm" : "bg-card text-foreground shadow-sm") : onInk ? "text-ink-foreground/60 hover:text-ink-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            data-cy={`theme-${value}`}
          >
            <Icon className={variant === "labels" ? "size-4" : "size-3.5"} />
            {variant === "labels" ? label : null}
          </button>
        )
      })}
    </div>
  )
}

export function ThemeMenu() {
  const { preference, setPreference, theme } = useTheme()
  const Current = preference === "system" ? Monitor : theme === "dark" ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Colour theme" data-cy="theme-toggle">
          <Current />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setPreference(value)} data-cy={`theme-${value}`}>
            <Icon /> {label}
            {preference === value ? <Check className="ml-auto size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
