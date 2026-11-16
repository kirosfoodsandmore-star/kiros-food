import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      neutral: "border-border bg-muted text-foreground",
      info: "border-transparent bg-info/15 text-info",
      success: "border-transparent bg-success/15 text-success",
      warning: "border-transparent bg-warning/15 text-warning",
      danger: "border-transparent bg-destructive/15 text-destructive",
      // Solid: stays readable on top of photos and artwork, where the tinted variants wash out.
      destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm",
      primary: "border-transparent bg-primary text-primary-foreground",
      accent: "border-transparent bg-accent text-accent-foreground",
      outline: "border-border text-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
