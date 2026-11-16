// Pickers for the two settings people mistype: currency and timezone. Memoised because each holds hundreds of
// options and the Settings form re-renders on every keystroke elsewhere.
import { memo } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { currencyGroups, currencyName, timezoneGroups, timezoneOffset } from "@/lib/regional"

interface PickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  dataCy?: string
}

export const CurrencySelect = memo(function CurrencySelect({ value, onChange, disabled, dataCy }: PickerProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger data-cy={dataCy} aria-label="Currency">
        <SelectValue>{value} · {currencyName(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {currencyGroups(value).map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.codes.map((code) => <SelectItem key={code} value={code}>{code} · {currencyName(code)}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
})

export const TimezoneSelect = memo(function TimezoneSelect({ value, onChange, disabled, dataCy }: PickerProps) {
  const offset = timezoneOffset(value)
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger data-cy={dataCy} aria-label="Timezone">
        <SelectValue>{value}{offset ? ` (${offset})` : ""}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {timezoneGroups(value).map((g) => (
          <SelectGroup key={g.region}>
            <SelectLabel>{g.region}</SelectLabel>
            {g.zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
})
