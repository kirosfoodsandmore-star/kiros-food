import * as React from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COUNTRIES, countryByIso, parsePhone, toE164 } from "@/lib/phone"
import { cn } from "@/lib/utils"

interface PhoneInputProps {
  /** International format ("+2348012345678"), or "" when empty. */
  value: string
  /** Called with the international number, or "" when the number box is empty. */
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "data-cy"?: string
}

/**
 * A country-code picker beside a local-number box. Nobody has to type "+234" or remember to drop the leading 0:
 * the value handed back is always in the international format the API expects.
 */
export function PhoneInput({ value, onChange, placeholder = "801 234 5678", disabled, className, "data-cy": cy }: PhoneInputProps) {
  const [iso, setIso] = React.useState(() => parsePhone(value).iso)
  const [national, setNational] = React.useState(() => parsePhone(value).national)

  // The form can set the value after this mounts (editing an existing record). Re-read it, but only when it's not
  // already what we hold, so typing and an empty box with a chosen country are left alone.
  React.useEffect(() => {
    if (toE164(iso, national) === value) return
    const p = parsePhone(value)
    setIso(p.iso)
    setNational(p.national)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const country = countryByIso(iso)

  const changeCountry = (next: string) => {
    setIso(next)
    onChange(toE164(next, national))
  }

  const changeNumber = (text: string) => {
    // Digits and the usual separators only; the country code lives in the picker, so a typed "+" has nowhere to go.
    const clean = text.replace(/[^\d\s\-()]/g, "")
    setNational(clean)
    onChange(toE164(iso, clean))
  }

  const paste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim()
    if (!text.startsWith("+") && !text.startsWith("00")) return
    // A full international number: pick the country from it instead of tacking it onto the current code.
    e.preventDefault()
    const p = parsePhone(text)
    setIso(p.iso)
    setNational(p.national)
    onChange(toE164(p.iso, p.national))
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={iso} onValueChange={changeCountry} disabled={disabled}>
        <SelectTrigger className="w-[7rem] shrink-0 px-2.5" aria-label="Country code" data-cy={cy ? `${cy}-country` : undefined}>
          <SelectValue>{country.dial ? <span className="tabular-nums">{country.iso} +{country.dial}</span> : "Other"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              {c.name}{c.dial ? <span className="ml-2 tabular-nums text-muted-foreground">+{c.dial}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label="Phone number"
        className="min-w-0 flex-1"
        value={national}
        onChange={(e) => changeNumber(e.target.value)}
        onPaste={paste}
        placeholder={country.iso === "OTHER" ? "Full number, e.g. 971 50 123 4567" : placeholder}
        disabled={disabled}
        data-cy={cy}
      />
    </div>
  )
}
