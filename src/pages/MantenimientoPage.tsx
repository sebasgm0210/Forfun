import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Hammer,
  MapPin,
  PlayCircle,
  Plus,
  ReceiptText,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EndpointPanel, MoneyInput, SectionCard, StatCard, StatusPill, money } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiErrorMessage } from "@/lib/api"
import { formatDate, useStore } from "@/lib/store"
import type { MaintenancePriority, MaintenanceStatus, MaintenanceTicket } from "@/lib/types"
import { cn } from "@/lib/utils"

const priorityTone: Record<MaintenancePriority, "muted" | "info" | "warning" | "danger"> = {
  baja: "muted",
  media: "info",
  alta: "warning",
  urgente: "danger",
}

const statusTone: Record<MaintenanceStatus, "warning" | "info" | "success" | "danger"> = {
  abierto: "warning",
  "en progreso": "info",
  resuelto: "success",
  cancelado: "danger",
}

const priorityText: Record<MaintenancePriority, string> = {
  baja: "Puede esperar",
  media: "Revisar pronto",
  alta: "Atender hoy",
  urgente: "No ofrecer el cuarto",
}

const typeLabels: Record<MaintenanceTicket["type"], string> = {
  AC: "Aire acondicionado",
  plomeria: "Agua o baño",
  electrico: "Luz o electricidad",
  carpinteria: "Puertas o muebles",
  limpieza: "Limpieza especial",
  otro: "Otro",
}

type TicketForm = {
  location: string
  isRoom: boolean
  type: MaintenanceTicket["type"]
  priority: MaintenancePriority
  responsible: string
  description: string
  estimatedCost: number
}

const emptyForm: TicketForm = {
  location: "",
  isRoom: true,
  type: "AC",
  priority: "media",
  responsible: "",
  description: "",
  estimatedCost: 0,
}

type MaintenanceServerRow = {
  id: string
  title: string
  description: string
  status: string
  date: string
}

function apiRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function apiArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = apiRecord(value)
  return Array.isArray(record.data) ? record.data : []
}

function apiText(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function mapMaintenanceServerRow(value: unknown, index: number): MaintenanceServerRow {
  const row = apiRecord(value)
  const roomNumber = apiText(row, ["room_number", "roomNumber", "room"])
  const location = roomNumber ? `Habitacion ${roomNumber}` : apiText(row, ["area", "location"], "Mantenimiento")
  return {
    id: apiText(row, ["id_maintenance_ticket", "id", "code"], `mto-${index}`),
    title: apiText(row, ["title", "type", "code"], location),
    description: apiText(row, ["description", "notes", "problem"], "Sin descripcion"),
    status: apiText(row, ["status", "priority"], "Pendiente"),
    date: apiText(row, ["created_at", "createdAt", "date", "resolved_at"], new Date().toISOString()),
  }
}

function ticketPlace(ticket: MaintenanceTicket) {
  return ticket.roomNumber ? `Habitación ${ticket.roomNumber}` : ticket.area ?? "Área general"
}

function statusLabel(status: MaintenanceStatus) {
  if (status === "abierto") return "Reportado"
  if (status === "en progreso") return "Lo están arreglando"
  if (status === "resuelto") return "Listo"
  return "Cancelado"
}

export function MantenimientoPage() {
  const { maintenance, rooms, dispatch } = useStore()
  const [form, setForm] = useState<TicketForm>(emptyForm)
  const [finalCosts, setFinalCosts] = useState<Record<string, number>>({})
  const [roomAlerts, setRoomAlerts] = useState<MaintenanceServerRow[]>([])
  const [serverHistory, setServerHistory] = useState<MaintenanceServerRow[]>([])

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      api.maintenance.listRoomAlerts<unknown>(),
      api.maintenance.listHistory<unknown>(),
    ])
      .then(([alertsResult, historyResult]) => {
        if (cancelled) return
        if (alertsResult.status === "fulfilled") {
          setRoomAlerts(apiArray(alertsResult.value).map(mapMaintenanceServerRow))
        } else {
          const status = (alertsResult.reason as { status?: number } | undefined)?.status
          setRoomAlerts([])
          if (status !== 404) {
            toast.error("No se pudieron cargar alertas de habitaciones", {
              description: getApiErrorMessage(alertsResult.reason),
            })
          }
        }

        if (historyResult.status === "fulfilled") {
          setServerHistory(apiArray(historyResult.value).map(mapMaintenanceServerRow))
        } else {
          toast.error("No se pudo cargar historial de mantenimiento", {
            description: getApiErrorMessage(historyResult.reason),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const activeTickets = maintenance.filter((ticket) => ticket.status !== "resuelto" && ticket.status !== "cancelado")
  const urgentRooms = activeTickets.filter((ticket) => ticket.priority === "urgente" && ticket.roomNumber)
  const cost = maintenance.reduce((sum, ticket) => sum + (ticket.cost ?? 0), 0)
  const canCreate = form.location.trim().length > 0 && form.description.trim().length >= 10

  const grouped = useMemo(
    () => ({
      reported: maintenance.filter((ticket) => ticket.status === "abierto").length,
      progress: maintenance.filter((ticket) => ticket.status === "en progreso").length,
      resolved: maintenance.filter((ticket) => ticket.status === "resuelto").length,
      cancelled: maintenance.filter((ticket) => ticket.status === "cancelado").length,
    }),
    [maintenance],
  )

  const createTicket = () => {
    if (!canCreate) {
      toast.error("Falta información", {
        description: "Elige dónde pasa y escribe qué hay que revisar.",
      })
      return
    }

    const ticket: MaintenanceTicket = {
      id: `mt-${Date.now()}`,
      code: `MTO-${String(maintenance.length + 231).padStart(4, "0")}`,
      roomNumber: form.isRoom ? form.location : undefined,
      area: form.isRoom ? undefined : form.location,
      type: form.type,
      priority: form.priority,
      status: "abierto",
      description: form.description,
      reportedBy: "Recepción",
      assignedTo: form.responsible || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
      cost: form.estimatedCost || undefined,
    }

    dispatch({ type: "MTO_CREATE", ticket })
    if (form.isRoom && form.priority === "urgente") {
      toast.warning("Trabajo urgente creado", {
        description: "No ofrezcas esa habitación hasta que quede lista.",
      })
    } else {
      toast.success("Trabajo agregado a mantenimiento")
    }
    setForm(emptyForm)
  }

  const updateStatus = (id: string, status: MaintenanceStatus) => {
    const patch: Partial<MaintenanceTicket> = {
      status,
      ...(status === "resuelto"
        ? { resolvedAt: new Date().toISOString().slice(0, 10), cost: finalCosts[id] || undefined }
        : {}),
    }

    dispatch({ type: "MTO_UPDATE", id, patch })
    toast.success(status === "resuelto" ? "Trabajo marcado como listo" : `Estado actualizado`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Mantenimiento"
        description="Reporta lo que hay que arreglar en habitaciones o áreas del hotel, da seguimiento y deja claro cuándo ya se puede usar otra vez."
        actions={
          <Button size="sm" className="gap-2 rounded-full" onClick={createTicket} disabled={!canCreate}>
            <Plus className="size-3.5" />
            Agregar trabajo
          </Button>
        }
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guía rápida para mantenimiento</h2>
          <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
            Usa esta pantalla para avisar qué se dañó, quién lo revisa y cuándo ya quedó listo.
          </p>
        </div>

        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            {
              icon: MapPin,
              title: "Di dónde pasa",
              text: "Elige la habitación o escribe el área exacta, como lobby o lavandería.",
            },
            {
              icon: ShieldAlert,
              title: "Marca si es urgente",
              text: "Si el cuarto no se puede vender, ponlo como urgente para que nadie lo ofrezca.",
            },
            {
              icon: PlayCircle,
              title: "Avanza el trabajo",
              text: "Cuando alguien ya lo está viendo, márcalo como que lo están arreglando.",
            },
            {
              icon: ClipboardCheck,
              title: "Ciérralo al final",
              text: "Cuando ya quedó bien, ponlo listo y escribe el costo si hubo gasto.",
            },
          ].map((step, index) => {
            const StepIcon = step.icon

            return (
              <div key={step.title} className="min-w-0 rounded-xl border bg-white/75 p-2.5 sm:rounded-2xl sm:p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 sm:size-8 sm:rounded-xl">
                    <StepIcon className="size-4" />
                  </div>
                  <span className="mobile-safe-text text-[0.65rem] font-bold uppercase tracking-wide text-blue-700 sm:text-xs">
                    Paso {index + 1}
                  </span>
                </div>
                <p className="mobile-safe-text mt-2 text-sm font-semibold sm:mt-3 sm:text-base">{step.title}</p>
                <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/75 sm:text-sm">{step.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      {urgentRooms.length > 0 ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Habitaciones que no se deben ofrecer</h2>
                <p className="mt-1 text-sm text-red-900/80">
                  Estas habitaciones tienen algo urgente. Espera a que mantenimiento las marque como listas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {urgentRooms.map((ticket) => (
                <span key={ticket.id} className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold">
                  Habitacion {ticket.roomNumber}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Recién reportados" value={grouped.reported} tone="warning" />
        <StatCard label="Los están arreglando" value={grouped.progress} tone="info" />
        <StatCard label="Urgentes" value={urgentRooms.length} tone={urgentRooms.length ? "danger" : "success"} />
        <StatCard label="Gasto registrado" value={money(cost)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Alertas de habitaciones"
          description="Datos cargados desde /api/maintenance/room-alerts."
        >
          <div className="space-y-2">
            {roomAlerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-2xl border bg-background/70 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-1 text-muted-foreground">{alert.description}</p>
                  </div>
                  <StatusPill tone="warning">{alert.status}</StatusPill>
                </div>
              </div>
            ))}
            {!roomAlerts.length ? (
              <p className="rounded-2xl border bg-background/70 p-4 text-sm text-muted-foreground">
                No hay alertas activas del servidor.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Historial del servidor"
          description="Ultimos registros consultados en /api/maintenance/history."
        >
          <div className="space-y-2">
            {serverHistory.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl border bg-background/70 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                </div>
              </div>
            ))}
            {!serverHistory.length ? (
              <p className="rounded-2xl border bg-background/70 p-4 text-sm text-muted-foreground">
                No hay historial del servidor para mostrar.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <Tabs defaultValue="activos" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="activos">Trabajos activos</TabsTrigger>
          <TabsTrigger value="nuevo">Agregar trabajo</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              {activeTickets.length ? (
                activeTickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className={cn(
                      "rounded-3xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md",
                      ticket.priority === "urgente" && "border-red-200 bg-red-50/30",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <Wrench className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{ticketPlace(ticket)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {ticket.code} · {typeLabels[ticket.type]}
                            </p>
                          </div>
                          <StatusPill tone={priorityTone[ticket.priority]}>{priorityText[ticket.priority]}</StatusPill>
                          <StatusPill tone={statusTone[ticket.status]}>{statusLabel(ticket.status)}</StatusPill>
                        </div>

                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {ticket.description}
                        </p>

                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Clock3 className="size-4 shrink-0 text-primary" />
                            Reportado {formatDate(ticket.createdAt)}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Hammer className="size-4 shrink-0 text-primary" />
                            {ticket.assignedTo ? ticket.assignedTo : "Sin responsable todavía"}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <ReceiptText className="size-4 shrink-0 text-primary" />
                            {ticket.cost ? money(ticket.cost) : "Sin costo registrado"}
                          </span>
                        </div>
                      </div>

                      <div className="w-full shrink-0 space-y-3 lg:w-48">
                        <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
                          Costo final
                          <MoneyInput
                            min={0}
                            value={(finalCosts[ticket.id] ?? ticket.cost) || ""}
                            onChange={(event) =>
                              setFinalCosts((current) => ({
                                ...current,
                                [ticket.id]: event.target.value === "" ? 0 : Number(event.target.value),
                              }))
                            }
                            className="h-9 rounded-full"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2 lg:flex-col">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 rounded-full"
                            onClick={() => updateStatus(ticket.id, "en progreso")}
                            disabled={ticket.status === "en progreso"}
                          >
                            <PlayCircle className="size-3.5" />
                            Lo están arreglando
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 rounded-full"
                            onClick={() => updateStatus(ticket.id, "resuelto")}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Ya quedó listo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 rounded-full"
                            onClick={() => updateStatus(ticket.id, "cancelado")}
                          >
                            <Ban className="size-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">
                  No hay trabajos activos por ahora.
                </div>
              )}
            </div>

            <SectionCard
              title="Agregar rápido"
              description="Para avisar algo nuevo sin salir de la lista."
            >
              <TicketFormFields
                form={form}
                rooms={rooms}
                setForm={setForm}
              />
              <Button className="mt-4 w-full gap-2 rounded-full" onClick={createTicket} disabled={!canCreate}>
                <Plus className="size-4" />
                Agregar trabajo
              </Button>
            </SectionCard>
          </section>
        </TabsContent>

        <TabsContent value="nuevo">
          <SectionCard
            title="Agregar trabajo de mantenimiento"
            description="Llena solo lo necesario para que la persona encargada sepa dónde ir y qué revisar."
          >
            <TicketFormFields form={form} rooms={rooms} setForm={setForm} />
            <Button className="mt-4 gap-2 rounded-full" onClick={createTicket} disabled={!canCreate}>
              <Plus className="size-4" />
              Agregar trabajo
            </Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="historial">
          <section className="grid gap-3 md:grid-cols-2">
            {maintenance.map((ticket) => (
              <article key={ticket.id} className="rounded-3xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{ticketPlace(ticket)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {ticket.code} · {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <StatusPill tone={statusTone[ticket.status]}>{statusLabel(ticket.status)}</StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{ticket.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full bg-muted px-3 py-1">
                    {ticket.resolvedAt ? `Listo ${formatDate(ticket.resolvedAt)}` : "Todavía no cerrado"}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1">
                    {ticket.cost ? money(ticket.cost) : "Sin costo"}
                  </span>
                </div>
              </article>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="backend">
          <SectionCard title="Endpoints sugeridos para mantenimiento">
            <EndpointPanel
              endpoints={[
                "GET /api/maintenance/tickets",
                "POST /api/maintenance/tickets",
                "PATCH /api/maintenance/tickets/{id}/start",
                "PATCH /api/maintenance/tickets/{id}/resolve",
                "PATCH /api/maintenance/tickets/{id}/cancel",
                "GET /api/maintenance/room-alerts",
                "GET /api/maintenance/history",
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TicketFormFields({
  form,
  rooms,
  setForm,
}: {
  form: TicketForm
  rooms: { id: string; number: string }[]
  setForm: React.Dispatch<React.SetStateAction<TicketForm>>
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-2 text-sm font-medium">
        ¿Dónde pasa?
        <select
          value={form.isRoom ? "room" : "area"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              isRoom: event.target.value === "room",
              location: "",
            }))
          }
          className="h-10 w-full rounded-full border bg-background px-3 text-sm"
        >
          <option value="room">Habitación</option>
          <option value="area">Área del hotel</option>
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        {form.isRoom ? "Habitación" : "Área"}
        {form.isRoom ? (
          <select
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            className="h-10 w-full rounded-full border bg-background px-3 text-sm"
          >
            <option value="">Selecciona habitación</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.number}>
                Habitacion {room.number}
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            className="rounded-full"
            placeholder="Ej. Lobby"
          />
        )}
      </label>

      <label className="space-y-2 text-sm font-medium">
        ¿Qué tan urgente?
        <select
          value={form.priority}
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as MaintenancePriority }))}
          className="h-10 w-full rounded-full border bg-background px-3 text-sm"
        >
          <option value="baja">Puede esperar</option>
          <option value="media">Revisar pronto</option>
          <option value="alta">Atender hoy</option>
          <option value="urgente">No ofrecer el cuarto</option>
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        ¿Qué hay que revisar?
        <select
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MaintenanceTicket["type"] }))}
          className="h-10 w-full rounded-full border bg-background px-3 text-sm"
        >
          <option value="AC">Aire acondicionado</option>
          <option value="plomeria">Agua o baño</option>
          <option value="electrico">Luz o electricidad</option>
          <option value="carpinteria">Puertas o muebles</option>
          <option value="limpieza">Limpieza especial</option>
          <option value="otro">Otro</option>
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        ¿Quién lo verá?
        <Input
          value={form.responsible}
          onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))}
          className="rounded-full"
          placeholder="Opcional"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Gasto estimado
        <MoneyInput
          min={0}
          value={form.estimatedCost || ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              estimatedCost: event.target.value === "" ? 0 : Number(event.target.value),
            }))
          }
          className="rounded-full"
        />
      </label>

      <label className="space-y-2 text-sm font-medium md:col-span-3">
        Explica qué pasa
        <Textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          className="min-h-24 rounded-2xl"
          placeholder="Ej. El aire no enfría, la puerta no cierra bien, hay fuga en el baño..."
        />
      </label>
    </div>
  )
}

export default MantenimientoPage
