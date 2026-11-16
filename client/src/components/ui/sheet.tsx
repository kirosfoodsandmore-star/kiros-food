// Side drawer built on Radix Dialog (nav drawer, cart drawer, branch picker on mobile).
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

const sheetVariants = cva("fixed z-50 flex flex-col bg-card shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300", {
  variants: {
    side: {
      left: "inset-y-0 left-0 h-dvh w-[86vw] max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
      right: "inset-y-0 right-0 h-dvh w-full sm:max-w-md border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      full: "inset-0 h-dvh w-full data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    },
  },
  defaultVariants: { side: "right" },
})

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, VariantProps<typeof sheetVariants> {
  hideClose?: boolean
}

export const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(({ side = "right", className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200" />
    <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      {hideClose ? null : (
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 opacity-70 hover:opacity-100 hover:bg-muted" aria-label="Close" data-cy="sheet-close">
          <X className="size-5" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = "SheetContent"

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1 p-4 pr-12 border-b", className)} {...props} />
export const SheetTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("font-display text-lg font-semibold", className)} {...props} />
))
SheetTitle.displayName = "SheetTitle"
export const SheetDescription = DialogPrimitive.Description
