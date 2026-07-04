import {
  AlertTriangle,
  CreditCard,
  Package,
  Shirt,
  Sparkles,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type OperationalAlert = {
  id: string
  category: "limpieza" | "inventario" | "credito" | "mantenimiento" | "blancos"
  level: "info" | "warning" | "danger" | "success"
  title: string
  detail: string
  time: string
}

const operationalAlerts: OperationalAlert[] = []

const categoryIcon: Record<OperationalAlert["category"], LucideIcon> = {
  limpieza: Sparkles,
  inventario: Package,
  credito: CreditCard,
  mantenimiento: Wrench,
  blancos: Shirt,
}

const levelStyle: Record<OperationalAlert["level"], string> = {
  info: "border-[var(--color-chart-5)]/30 bg-[var(--color-chart-5)]/5 text-[var(--color-chart-5)]",
  warning: "border-[var(--status-pending)]/30 bg-[var(--status-pending)]/8 text-[var(--status-pending)]",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  success: "border-[var(--status-available)]/30 bg-[var(--status-available)]/8 text-[var(--status-available)]",
}

export function AlertsPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Alertas operativas
            </CardTitle>
            <CardDescription>
              {operationalAlerts.length} pendientes de atender
            </CardDescription>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {operationalAlerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Sin alertas operativas desde el servidor.
          </div>
        ) : null}
        {operationalAlerts.map((alert) => {
          const Icon = categoryIcon[alert.category]
          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-shadow hover:shadow-sm",
                levelStyle[alert.level],
              )}
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {alert.time}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
