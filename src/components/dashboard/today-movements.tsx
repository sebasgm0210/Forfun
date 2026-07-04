import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type TodayMovement = {
  id: string
  type: "check-in" | "check-out"
  guest: string
  room: string
  roomType: string
  nights?: number
  balance?: number
  time: string
  status: string
}

const todayMovements: TodayMovement[] = []

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

const statusBadge: Record<string, string> = {
  pendiente:
    "border-transparent bg-[color-mix(in_oklch,var(--status-pending)_20%,transparent)] text-[var(--status-pending)]",
  confirmado:
    "border-transparent bg-[color-mix(in_oklch,var(--status-occupied)_15%,transparent)] text-[var(--status-occupied)]",
  completado:
    "border-transparent bg-[color-mix(in_oklch,var(--status-available)_18%,transparent)] text-[var(--status-available)]",
}

function MovementRow({ movement }: { movement: TodayMovement }) {
  const isCheckIn = movement.type === "check-in"
  const Icon = isCheckIn ? ArrowDownLeft : ArrowUpRight
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3 transition-colors hover:bg-secondary/40">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          isCheckIn
            ? "bg-[color-mix(in_oklch,var(--status-available)_15%,transparent)] text-[var(--status-available)]"
            : "bg-[color-mix(in_oklch,var(--primary)_15%,transparent)] text-primary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{movement.guest}</p>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            #{movement.room}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {movement.roomType}
          {movement.nights ? ` - ${movement.nights} noches` : ""}
          {movement.balance !== undefined && movement.balance > 0
            ? ` - saldo ${money(movement.balance)}`
            : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <Clock className="size-3" />
          {movement.time}
        </span>
        <Badge variant="outline" className={cn("capitalize text-[10px]", statusBadge[movement.status])}>
          {movement.status}
        </Badge>
      </div>
    </div>
  )
}

function EmptyMovements() {
  return (
    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
      Sin movimientos del dia desde el servidor.
    </div>
  )
}

export function TodayMovements() {
  const checkIns = todayMovements.filter((movement) => movement.type === "check-in")
  const checkOuts = todayMovements.filter((movement) => movement.type === "check-out")

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Movimientos del dia
            </CardTitle>
            <CardDescription>
              {checkIns.length} llegadas - {checkOuts.length} salidas
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="in">Check-in</TabsTrigger>
            <TabsTrigger value="out">Check-out</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4 space-y-2">
            {todayMovements.length === 0 ? <EmptyMovements /> : null}
            {todayMovements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </TabsContent>
          <TabsContent value="in" className="mt-4 space-y-2">
            {checkIns.length === 0 ? <EmptyMovements /> : null}
            {checkIns.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </TabsContent>
          <TabsContent value="out" className="mt-4 space-y-2">
            {checkOuts.length === 0 ? <EmptyMovements /> : null}
            {checkOuts.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
