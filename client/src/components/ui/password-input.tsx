import { Eye, EyeOff, TriangleAlert } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">

/**
 * Password field with a show/hide toggle and a Caps Lock warning.
 * Drop-in for `<Input type="password">`, including with react-hook-form's `register()`.
 * The toggle keeps keyboard focus in the field when clicked with a mouse, so you can keep typing.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ className, onBlur, onKeyDown, onKeyUp, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)
  const [capsLock, setCapsLock] = React.useState(false)

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"))

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          // A revealed password is plain text: stop the browser from spell-checking or capitalising it.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn("pr-11", className)}
          onKeyDown={(e) => {
            trackCapsLock(e)
            onKeyDown?.(e)
          }}
          onKeyUp={(e) => {
            trackCapsLock(e)
            onKeyUp?.(e)
          }}
          onBlur={(e) => {
            setCapsLock(false)
            onBlur?.(e)
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1 text-muted-foreground hover:text-foreground focus-visible:ring-offset-0"
          onClick={() => setVisible((v) => !v)}
          // Don't steal focus from the input on mouse click; keyboard users can still Tab to it.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={props.disabled}
          data-cy="password-toggle"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      {capsLock ? (
        <p className="flex items-center gap-1.5 text-xs text-warning" role="status">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> Caps Lock is on
        </p>
      ) : null}
    </div>
  )
})
PasswordInput.displayName = "PasswordInput"
