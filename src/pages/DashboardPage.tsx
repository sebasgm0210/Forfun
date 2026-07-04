import { Download, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { KpiCard } from "@/components/dashboard/kpi-card"
import { PageHeader } from "@/components/layout/page-header"
import { ReservationDialog } from "@/components/reservations/reservation-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useStore } from "@/lib/store"
import { exportCurrentView } from "@/lib/view-export"

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function shortDate(value: string) {
  if (!value) return "--"
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`))
}

export function DashboardPage() {
  const [reservationOpen, setReservationOpen] = useState(false)
  const store = useStore()
  const today = todayIso()

  const occupiedRooms = store.rooms.filter((room) => room.status === "ocupada" || room.status === "reservada").length
  const occupancy = store.rooms.length ? Math.round((occupiedRooms / store.rooms.length) * 100) : 0
  const lodgingRevenue = store.reservations.reduce((total, reservation) => total + reservation.total, 0)
  const eventRevenue = store.events.reduce((total, event) => total + event.total, 0)
  const minibarRevenue = store.inventoryMovements.reduce((total, movement) => {
    if (movement.type !== "consumo") return total
    const item = store.inventory.find((candidate) => candidate.id === movement.itemId)
    return total + Math.abs(movement.qty) * (item?.price ?? 0)
  }, 0)
  const pendingBalance = store.reservations.reduce(
    (total, reservation) => total + Math.max(0, reservation.total - reservation.paid),
    0,
  )
  const todayCheckIns = store.reservations.filter((reservation) => reservation.checkIn === today)
  const todayCheckOuts = store.reservations.filter((reservation) => reservation.checkOut === today)

  const kpis = [
    {
      id: "occupancy",
      label: "Ocupacion actual",
      value: `${occupancy}%`,
      hint: `${occupiedRooms} de ${store.rooms.length} habitaciones`,
      tone: occupancy >= 70 ? "success" : occupancy > 0 ? "warning" : "default",
    },
    {
      id: "revenue",
      label: "Ingresos registrados",
      value: money(lodgingRevenue + eventRevenue + minibarRevenue),
      hint: "Reservas, eventos y minibar reales",
      tone: "success",
    },
    {
      id: "movements",
      label: "Movimientos hoy",
      value: String(todayCheckIns.length + todayCheckOuts.length),
      hint: `${todayCheckIns.length} llegadas, ${todayCheckOuts.length} salidas`,
      tone: "default",
    },
    {
      id: "balance",
      label: "Saldos pendientes",
      value: money(pendingBalance),
      hint: "Reservas con pago incompleto",
      tone: pendingBalance > 0 ? "warning" : "success",
    },
  ] as const

  const roomStatusRows = useMemo(() => {
    const statuses = [
      ["Disponible", store.rooms.filter((room) => room.status === "disponible").length],
      ["Reservada", store.rooms.filter((room) => room.status === "reservada").length],
      ["Ocupada", store.rooms.filter((room) => room.status === "ocupada").length],
      ["Limpieza", store.rooms.filter((room) => room.status === "limpieza").length],
      ["Mantenimiento", store.rooms.filter((room) => room.status === "mantenimiento").length],
    ] as const

    return statuses.map(([label, count]) => ({
      label,
      count,
      pct: store.rooms.length ? Math.round((count / store.rooms.length) * 100) : 0,
    }))
  }, [store.rooms])

  const alerts = [
    ...store.inventory
      .filter((item) => item.stock <= item.minStock)
      .map((item) => `${item.name}: ${item.stock} ${item.unit} disponibles`),
    ...store.maintenance
      .filter((ticket) => ticket.status !== "resuelto" && ticket.status !== "cancelado")
      .map((ticket) => ticket.roomNumber ? `Habitacion ${ticket.roomNumber}: ${ticket.description}` : ticket.description),
    ...store.creditAccounts
      .filter((account) => account.status === "vencido" || account.creditStatus === "bloqueado")
      .map((account) => `${account.company}: ${money(account.balance)} pendiente`),
  ].slice(0, 6)

  const recentReservations = store.reservations.slice(0, 6)

  const exportSummary = () => {
    toast.success("Resumen listo para imprimir")
    exportCurrentView({ title: "Centro de operaciones", format: "print" })
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Centro de operaciones"
          title="Buen dia, Casa Luna"
          description="Resumen operativo conectado a datos reales del servidor."
          actions={
            <>
              <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={exportSummary}>
                <Download className="size-3.5" />
                Exportar resumen
              </Button>
              <Button size="sm" className="gap-2 rounded-full" onClick={() => setReservationOpen(true)}>
                <Plus className="size-3.5" />
                Nueva reservacion
              </Button>
            </>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Ocupacion por estado</CardTitle>
              <CardDescription>Habitaciones reales reportadas por el servidor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {roomStatusRows.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Ingresos</CardTitle>
              <CardDescription>Acumulado segun datos reales cargados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Hospedaje", lodgingRevenue],
                ["Eventos", eventRevenue],
                ["Minibar", minibarRevenue],
                ["Saldo pendiente", pendingBalance],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{money(Number(value))}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Reservas recientes</CardTitle>
              <CardDescription>{recentReservations.length} registros cargados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentReservations.length ? (
                recentReservations.map((reservation) => (
                  <div key={reservation.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                    <div>
                      <p className="font-medium">{reservation.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {shortDate(reservation.checkIn)} - {shortDate(reservation.checkOut)}
                      </p>
                    </div>
                    <span className="font-semibold">{money(reservation.total)}</span>
                  </div>
                ))
              ) : (
                <div className="grid min-h-[160px] place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  Sin reservas reales cargadas.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Alertas</CardTitle>
              <CardDescription>Inventario, mantenimiento y credito</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length ? (
                alerts.map((alert) => (
                  <div key={alert} className="rounded-xl border p-3 text-sm">
                    {alert}
                  </div>
                ))
              ) : (
                <div className="grid min-h-[160px] place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  Sin alertas reales.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
      <ReservationDialog open={reservationOpen} onOpenChange={setReservationOpen} />
    </>
  )
}

export default DashboardPage
