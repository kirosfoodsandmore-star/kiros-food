// Small hand-built SVG chart kit for the analytics pages. One axis per chart, thin marks, 2px surface gaps between
// stacked fills, hover tooltips on every mark, a legend for two or more series, and a table view of the same data.
// Colours come from the --chart-N tokens in index.css (validated colour-blind-safe order); text stays in text tokens.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Table2, LineChart as LineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface Series {
  key: string
  label: string
  /** A CSS colour, normally var(--chart-N). */
  color: string
  values: number[]
  /** Line charts: a ~10% wash under the line. */
  area?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    setW(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

/** Clean ticks covering [min, max] (always including zero). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min)
  const hi = Math.max(0, max)
  if (lo === hi) return [0, 1]
  const step = niceStep((hi - lo) / count)
  const start = Math.floor(lo / step) * step
  const ticks: number[] = []
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Short tick label for the axis: 0 / 500 / 1.2K / 3.4M. */
export function compactNumber(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? "−" : ""
  if (a >= 1e9) return `${s}${+(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${s}${+(a / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${s}${+(a / 1e3).toFixed(0)}K`
  if (a >= 1e3) return `${s}${+(a / 1e3).toFixed(1)}K`
  return `${s}${+a.toFixed(0)}`
}

/** Path for a bar with a 4px rounded data-end and a square baseline. */
function barPath(x: number, base: number, end: number, w: number, roundEnd: boolean): string {
  const up = end < base
  const h = Math.abs(base - end)
  const r = roundEnd ? Math.min(4, w / 2, h) : 0
  if (up) return `M${x},${base}V${end + r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end + r}V${base}Z`
  return `M${x},${base}V${end - r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end - r}V${base}Z`
}

function pickTicks(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const step = Math.ceil((n - 1) / (max - 1))
  const out: number[] = []
  for (let i = 0; i < n; i += step) out.push(i)
  if (out[out.length - 1] !== n - 1) out[out.length - 1] = n - 1
  return out
}

export function Legend({ series, className }: { series: Array<Pick<Series, "key" | "label" | "color">>; className?: string }) {
  if (series.length < 2) return null
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground", className)} aria-label="Legend">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</li>
      ))}
    </ul>
  )
}

function Tooltip({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  const w = Math.min(230, width)
  const x = Math.max(0, Math.min(left - w / 2, width - w))
  return (
    <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md" style={{ left: x, width: w }} role="status">
      {children}
    </div>
  )
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">{color ? <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} /> : null}<span className="truncate">{label}</span></span>
      <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

const PAD = { l: 46, r: 10, t: 10, b: 24 }

/** Default y-axis: kobo shown as compact major units. */
export const moneyAxis = (v: number) => compactNumber(v / 100)

// ── Line / area ──────────────────────────────────────────────────────────

export function TrendChart({ labels, series, format, height = 240, tickLabel, axis = moneyAxis }: { labels: string[]; series: Series[]; format: (v: number) => string; height?: number; tickLabel: (i: number) => string; axis?: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  const all = series.flatMap((s) => s.values)
  const ticks = niceTicks(Math.min(...all, 0), Math.max(...all, 0))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const iw = Math.max(1, width - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1))
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih
  const xTicks = pickTicks(n, Math.max(2, Math.floor(iw / 72)))

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / iw) * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null) }} className="touch-pan-y select-none" role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.25 : 1} />
              <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{axis(t)}</text>
            </g>
          ))}
          {xTicks.map((i) => <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">{tickLabel(i)}</text>)}
          {series.map((s) => {
            const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("")
            return (
              <g key={s.key}>
                {s.area && n > 1 ? <path d={`${d}L${x(n - 1)},${y(Math.max(lo, 0))}L${x(0)},${y(Math.max(lo, 0))}Z`} fill={s.color} opacity={0.1} /> : null}
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {n === 1 ? <circle cx={x(0)} cy={y(s.values[0])} r={4} fill={s.color} /> : null}
              </g>
            )
          })}
          {hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="var(--card)" strokeWidth={2} />)}
            </g>
          ) : null}
        </svg>
      ) : null}
      {hover !== null ? (
        <Tooltip left={x(hover)} width={width}>
          <p className="mb-1 font-medium text-foreground">{labels[hover]}</p>
          {series.map((s) => <TipRow key={s.key} color={s.color} label={s.label} value={format(s.values[hover])} />)}
        </Tooltip>
      ) : null}
    </div>
  )
}

// ── Columns (stacked, or one signed series) ──────────────────────────────

export function ColumnChart({ labels, series, format, height = 220, tickLabel, signed = false, negativeColor, axis = moneyAxis }: { labels: string[]; series: Series[]; format: (v: number) => string; height?: number; tickLabel: (i: number) => string; signed?: boolean; negativeColor?: string; axis?: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  const totals = labels.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0))
  const mins = signed ? series[0].values : [0]
  const ticks = niceTicks(Math.min(...mins, 0), Math.max(...(signed ? series[0].values : totals), 0))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const iw = Math.max(1, width - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const band = iw / Math.max(1, n)
  const bw = Math.max(2, Math.min(24, band * 0.62))
  const cx = (i: number) => PAD.l + band * i + band / 2
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih
  const xTicks = pickTicks(n, Math.max(2, Math.floor(iw / 72)))

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null) }} className="touch-pan-y select-none" role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.25 : 1} />
              <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{axis(t)}</text>
            </g>
          ))}
          {xTicks.map((i) => <text key={i} x={cx(i)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{tickLabel(i)}</text>)}
          {labels.map((_, i) => {
            const left = cx(i) - bw / 2
            const active = hover === null || hover === i
            if (signed) {
              const v = series[0].values[i] ?? 0
              if (v === 0) return null
              return <path key={i} d={barPath(left, y(0), y(v), bw, true)} fill={v < 0 ? (negativeColor ?? series[0].color) : series[0].color} opacity={active ? 1 : 0.45} />
            }
            let base = y(0)
            const segs = series.map((s) => Math.max(0, s.values[i] ?? 0))
            const topIndex = segs.reduce((t, v, k) => (v > 0 ? k : t), -1)
            return (
              <g key={i} opacity={active ? 1 : 0.45}>
                {segs.map((v, k) => {
                  if (v <= 0) return null
                  const end = y(0) - ((v / (hi - lo || 1)) * ih) - (y(0) - base)
                  const top = k === topIndex
                  const d = barPath(left, base, Math.min(base - 0.5, end + (top ? 0 : 2)), bw, top)
                  base = end
                  return <path key={k} d={d} fill={series[k].color} />
                })}
              </g>
            )
          })}
          {labels.map((_, i) => <rect key={i} x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} />)}
        </svg>
      ) : null}
      {hover !== null ? (
        <Tooltip left={cx(hover)} width={width}>
          <p className="mb-1 font-medium text-foreground">{labels[hover]}</p>
          {series.map((s) => <TipRow key={s.key} color={signed && (s.values[hover] ?? 0) < 0 ? negativeColor : s.color} label={s.label} value={format(s.values[hover] ?? 0)} />)}
          {!signed && series.length > 1 ? <TipRow label="Total" value={format(totals[hover])} /> : null}
        </Tooltip>
      ) : null}
    </div>
  )
}

// ── Sparkline (stat tiles) ───────────────────────────────────────────────

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const w = 96
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6)
  const x = (i: number) => (i * w) / (values.length - 1)
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  )
}

// ── Heatmap (weekday × hour) ─────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DOW = [1, 2, 3, 4, 5, 6, 0]
const hourName = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`

export function Heatmap({ cells, format }: { cells: Array<{ weekday: number; hour: number; orders: number; revenue: number }>; format: (v: number) => string }) {
  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null)
  const grid = useMemo(() => {
    const m = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c]))
    return DOW.map((d) => Array.from({ length: 24 }, (_, h) => m.get(`${d}:${h}`) ?? { weekday: d, hour: h, orders: 0, revenue: 0 }))
  }, [cells])
  const max = Math.max(1, ...cells.map((c) => c.orders))
  const cur = hover ? grid[DOW.indexOf(hover.weekday)][hover.hour] : null
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[270px] gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, minmax(8px, 1fr))" }} onPointerLeave={() => setHover(null)}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[9px] text-muted-foreground">{h % 3 === 0 ? hourName(h) : ""}</span>)}
          {grid.map((row, r) => (
            <div key={r} className="contents">
              <span className="pr-1 text-[10px] leading-[18px] text-muted-foreground">{DAYS[r]}</span>
              {row.map((c) => {
                const p = c.orders === 0 ? 0 : 14 + Math.round((c.orders / max) * 86)
                return (
                  <span
                    key={c.hour}
                    className={cn("h-[18px] rounded-[3px]", hover && hover.weekday === c.weekday && hover.hour === c.hour && "ring-2 ring-foreground/60")}
                    style={{ background: p === 0 ? "var(--muted)" : `color-mix(in srgb, var(--chart-1) ${p}%, var(--card))` }}
                    onPointerEnter={() => setHover({ weekday: c.weekday, hour: c.hour })}
                    aria-label={`${DAYS[r]} ${hourName(c.hour)}: ${c.orders} orders`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-h-4">{cur ? <><span className="font-medium text-foreground">{DAYS[DOW.indexOf(cur.weekday)]} {hourName(cur.hour)}–{hourName((cur.hour + 1) % 24)}</span> · {cur.orders} orders · {format(cur.revenue)}</> : "Tap or hover a square for the numbers."}</span>
        <span className="flex items-center gap-1">Fewer<span className="flex gap-[2px]">{[14, 35, 57, 78, 100].map((p) => <span key={p} className="inline-block size-3 rounded-[2px]" style={{ background: `color-mix(in srgb, var(--chart-1) ${p}%, var(--card))` }} />)}</span>More</span>
      </div>
    </div>
  )
}

// ── Card with a chart / table switch ─────────────────────────────────────

export interface TableSpec {
  columns: string[]
  rows: Array<Array<ReactNode>>
}

export function ChartCard({ title, description, legend, table, children, className, actions }: { title: string; description?: ReactNode; legend?: Array<Pick<Series, "key" | "label" | "color">>; table?: TableSpec; children: ReactNode; className?: string; actions?: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {table ? <Button variant="ghost" size="icon-sm" onClick={() => setAsTable((v) => !v)} aria-label={asTable ? "Show chart" : "Show as table"} title={asTable ? "Show chart" : "Show as table"}>{asTable ? <LineIcon /> : <Table2 />}</Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        {legend && !asTable ? <Legend series={legend} className="mb-3" /> : null}
        {asTable && table ? (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader><TableRow>{table.columns.map((c, i) => <TableHead key={c} className={i ? "text-right" : undefined}>{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{table.rows.map((r, i) => <TableRow key={i}>{r.map((c, k) => <TableCell key={k} className={k ? "text-right tabular-nums" : undefined}>{c}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </div>
        ) : children}
      </CardContent>
    </Card>
  )
}
