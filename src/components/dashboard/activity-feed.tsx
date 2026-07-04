import {
  CalendarPlus,
  Coffee,
  CreditCard,
  FileText,
  PartyPopper,
  Sparkles,
  Wine,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ActivityItem = {
  id: string
  type: "reserva" | "desayuno" | "pago" | "limpieza" | "snack" | "evento" | "factura"
  actor: string
  action: string
  target: string
  time: string
}

const recentActivity: ActivityItem[] = []

const typeIcon: Record<ActivityItem["type"], LucideIcon> = {
  reserva: CalendarPlus,
  desayuno: Coffee,
  pago: CreditCard,
  limpieza: Sparkles,
  snack: Wine,
  evento: PartyPopper,
  factura: FileText,
}

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">
          Actividad reciente
        </CardTitle>
        <CardDescription>Últimas acciones registradas en el sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 pl-6">
          <span className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />
          {recentActivity.length === 0 ? (
            <li className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Sin actividad reciente desde el servidor.
            </li>
          ) : null}
          {recentActivity.map((activity) => {
            const Icon = typeIcon[activity.type]
            return (
              <li key={activity.id} className="relative">
                <span className="absolute -left-6 top-0 flex size-6 items-center justify-center rounded-full border border-border bg-card text-primary">
                  <Icon className="size-3" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm leading-snug">
                    <span className="font-medium text-foreground">{activity.actor}</span>{" "}
                    <span className="text-muted-foreground">{activity.action}</span>{" "}
                    <span className="font-medium text-foreground">{activity.target}</span>
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {activity.time}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
