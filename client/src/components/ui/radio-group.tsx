import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import * as React from "react"
import { cn } from "@/lib/utils"

export const RadioGroup = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />
))
RadioGroup.displayName = "RadioGroup"

export const RadioGroupItem = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item ref={ref} className={cn("aspect-square size-5 rounded-full border border-input bg-card disabled:opacity-50 data-[state=checked]:border-primary", className)} {...props}>
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <span className="block size-2.5 rounded-full bg-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = "RadioGroupItem"
