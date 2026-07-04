import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

type Kpi = {
  id: string
  label: string
  value: string
  hint?: string
  tone?: "default" | "success" | "warning" | "danger"
  delta?: {
    value: string
    trend: "up" | "down" | "flat"
  }
}

const toneClasses: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "border-border/70",
  success:
    "border-[color-mix(in_oklch,var(--status-available)_30%,transparent)]",
  warning:
    "border-[color-mix(in_oklch,var(--status-pending)_30%,transparent)]",
  danger:
    "border-[color-mix(in_oklch,var(--destructive)_30%,transparent)]",
}

const accentBar: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "bg-primary/60",
  success: "bg-[var(--status-available)]",
  warning: "bg-[var(--status-pending)]",
  danger: "bg-destructive",
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const tone = kpi.tone ?? "default"
  const TrendIcon =
    kpi.delta?.trend === "up"
      ? ArrowUpRight
      : kpi.delta?.trend === "down"
        ? ArrowDownRight
        : Minus
  const trendClass =
    kpi.delta?.trend === "up"
      ? "text-[var(--status-available)]"
      : kpi.delta?.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground"

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 transition-all hover:shadow-sm",
        toneClasses[tone],
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-0.5", accentBar[tone])} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {kpi.label}
        </p>
        {kpi.delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[0.7rem] font-medium",
              trendClass,
            )}
          >
            <TrendIcon className="size-3" />
            {kpi.delta.value}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-foreground tabular-nums">
        {kpi.value}
      </p>
      {kpi.hint && (
        <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
      )}
    </Card>
  )
}
