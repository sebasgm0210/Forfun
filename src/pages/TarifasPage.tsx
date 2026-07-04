import { useEffect, useMemo, useState } from "react"
import { BedDouble, RefreshCw, Search, ShieldAlert, Tags } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { MiniTable, SectionCard, StatCard, StatusPill, Workflow, money } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { useStore } from "@/lib/store"
import type { Room, RoomRateOption, RoomType } from "@/lib/types"

type RateRow = {
  id: string
  typeId: string
  typeName: string
  pax: number
  regular: number
  corporate: number
  source: "tipo" | "base"
}

type RateChange = {
  id: string
  date: string
  user: string
  change: string
  reason: string
}

const occupancyCounts = [1, 2, 3, 4]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function arrayFromApi(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.items)) return record.items
  return []
}

function textFrom(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return fallback
}

function mapRateAuditLog(value: unknown, index: number): RateChange {
  const record = asRecord(value)
  return {
    id: textFrom(record, ["id_audit_log", "idAuditLog", "id"], `audit-${index}`),
    date: textFrom(record, ["created_at", "createdAt", "date", "movement_date"], "Sin fecha"),
    user: textFrom(record, ["user", "username", "registered_by", "created_by"], "Servidor"),
    change: textFrom(record, ["action", "change", "movement_type", "description"], "Cambio registrado"),
    reason: textFrom(record, ["reason", "notes", "detail", "after"], ""),
  }
}

function occupancyOptionsForMax(maxOccupancy: number) {
  return occupancyCounts.filter((people) => people <= Math.max(1, maxOccupancy))
}

function roomMaxOccupancy(room: Room, type?: RoomType) {
  return (
    room.maxOccupancy ??
    (Math.max(0, ...(room.occupancyOptions ?? [])) ||
      type?.capacity ||
      1)
  )
}

function roomOccupancyOptions(room: Room, type?: RoomType) {
  const max = roomMaxOccupancy(room, type)
  const configured = room.occupancyOptions?.length
    ? room.occupancyOptions
    : occupancyOptionsForMax(max)
  return [...new Set(configured)]
    .filter((people) => people >= 1 && people <= max)
    .sort((a, b) => a - b)
}

function backendTypeRate(type: RoomType | undefined, people: number) {
  const configured = type?.rates?.find((rate) => rate.peopleCount === people)
  if (configured) return configured.price
  if (!type || people > type.capacity) return 0
  return type.basePrice
}

function backendCorporateRate(type: RoomType | undefined, people: number) {
  if (!type || people > type.capacity) return 0
  return type.corporatePrice ?? 0
}

function buildTypeRateRows(roomTypes: RoomType[]): RateRow[] {
  return roomTypes.flatMap((type) =>
    occupancyOptionsForMax(type.capacity).map((people) => {
      const configured = type.rates?.find((rate) => rate.peopleCount === people)
      return {
        id: `${type.id}-${people}`,
        typeId: type.id,
        typeName: type.name,
        pax: people,
        regular: configured?.price ?? backendTypeRate(type, people),
        corporate: backendCorporateRate(type, people),
        source: configured ? "tipo" : "base",
      }
    }),
  )
}

function displayRateForRoom(
  room: Room,
  type: RoomType | undefined,
  people: number,
): RoomRateOption {
  const configured =
    room.rateOptions?.find((rate) => rate.peopleCount === people) ??
    type?.rates?.find((rate) => rate.peopleCount === people)
  const specific = room.specificRates?.find((rate) => rate.peopleCount === people)

  return {
    peopleCount: people,
    price: specific?.price ?? configured?.price ?? backendTypeRate(type, people),
    isSpecific: Boolean(specific?.price ?? configured?.isSpecific),
    reason: specific?.reason ?? configured?.reason,
    source: specific ? "habitacion" : configured?.source ?? "tipo",
  }
}

export function TarifasPage() {
  const { rooms, roomTypes, refreshApiState } = useStore()
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState<RateChange[]>([])
  const [loading, setLoading] = useState(false)

  const loadRateData = async (silent = false) => {
    setLoading(true)
    try {
      const [, auditResult] = await Promise.allSettled([
        refreshApiState(["roomTypes", "rooms"], { force: true }),
        api.rooms.listAuditLog<unknown[]>(),
      ])

      if (auditResult.status === "fulfilled") {
        setHistory(arrayFromApi(auditResult.value).map(mapRateAuditLog))
      } else {
        setHistory([])
      }

      if (!silent) toast.success("Tarifas actualizadas desde el servidor")
    } catch (error) {
      toast.error("No se pudieron actualizar las tarifas", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRateData(true)
  }, [])

  const activeRows = useMemo(() => buildTypeRateRows(roomTypes), [roomTypes])
  const specialRateCount = rooms.reduce(
    (sum, room) => sum + (room.specificRates?.length ?? 0),
    0,
  )
  const filteredRooms = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return rooms

    return rooms.filter((room) => {
      const type = roomTypes.find((item) => item.id === room.typeId)
      return [room.number, String(room.floor), type?.name ?? "", room.status, room.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(value)
    })
  }, [query, roomTypes, rooms])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Tarifas"
        description="Consulta precios reales por tipo de cuarto y por habitación. No se simulan cambios locales."
        actions={
          <Button size="sm" className="gap-2 rounded-full" onClick={() => void loadRateData()} disabled={loading}>
            <RefreshCw className="size-3.5" />
            Actualizar tarifas
          </Button>
        }
      />

      <SectionCard title="Cómo usar esta pantalla">
        <Workflow
          steps={[
            { title: "Revisar primero", description: "Mira el tipo de cuarto, capacidad y precios que devuelve el servidor." },
            { title: "Validar ocupación", description: "Una tarifa no aumenta la capacidad de una habitación." },
            { title: "Ver especiales", description: "Las tarifas especiales por habitación se muestran aparte cuando existen." },
            { title: "Pedir cambio", description: "Si hay que editar tarifas base, se necesita endpoint de administración." },
          ]}
        />
      </SectionCard>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tipos tarifarios" value={roomTypes.length} tone="info" />
        <StatCard label="Tarifas base visibles" value={activeRows.length} />
        <StatCard label="Habitaciones cargadas" value={rooms.length} tone="success" />
        <StatCard label="Especiales por habitación" value={specialRateCount} tone={specialRateCount ? "warning" : "success"} />
      </section>

      <Tabs defaultValue="tarifas" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="tarifas">Tarifas</TabsTrigger>
          <TabsTrigger value="habitaciones">Por habitación</TabsTrigger>
          <TabsTrigger value="manual">Tarifa manual</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="tarifas" className="space-y-4">
          <SectionCard
            title="Matriz de tarifas"
            description="Datos de tipos de habitación y tarifas configuradas en el backend."
          >
            {activeRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay tarifas base devueltas por el servidor.
              </div>
            ) : (
              <MiniTable
                headers={["Tipo", "Personas", "Tarifa normal (Q.)", "Corporativa (Q.)", "Origen"]}
                rows={activeRows.map((rate) => [
                  rate.typeName,
                  rate.pax,
                  money(rate.regular),
                  rate.corporate ? money(rate.corporate) : "No configurada",
                  <StatusPill tone={rate.source === "tipo" ? "success" : "info"}>
                    {rate.source === "tipo" ? "Tarifa configurada" : "Precio base"}
                  </StatusPill>,
                ])}
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="habitaciones" className="space-y-4">
          <SectionCard
            title="Tarifas por habitación"
            description="Lista cada habitación con capacidad real y tarifas por ocupación permitida."
          >
            <div className="mb-4 flex justify-end">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar habitación, tipo, estado..."
                  className="rounded-2xl pl-9"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredRooms.length === 0 ? (
                <div className="col-span-full rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay habitaciones con ese filtro.
                </div>
              ) : null}

              {filteredRooms.map((room) => {
                const type = roomTypes.find((item) => item.id === room.typeId)
                const ratesForRoom = roomOccupancyOptions(room, type).map((people) =>
                  displayRateForRoom(room, type, people),
                )

                return (
                  <article key={room.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {room.floor ? `Piso ${room.floor}` : "Habitación"}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold">Habitación {room.number}</h3>
                        <p className="text-sm text-muted-foreground">{type?.name ?? "Sin tipo"}</p>
                      </div>
                      <StatusPill tone={room.status === "disponible" ? "success" : room.status === "ocupada" ? "info" : "warning"}>
                        {room.status}
                      </StatusPill>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border bg-card p-3">
                        <BedDouble className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Camas</p>
                        <p className="font-semibold">{type?.beds ?? "-"}</p>
                      </div>
                      <div className="rounded-2xl border bg-card p-3">
                        <Tags className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Capacidad</p>
                        <p className="font-semibold">{roomMaxOccupancy(room, type)} personas</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {ratesForRoom.map((rate) => (
                        <div key={rate.peopleCount} className="rounded-2xl border bg-card p-3">
                          <p className="text-xs text-muted-foreground">
                            {rate.peopleCount} persona{rate.peopleCount > 1 ? "s" : ""}
                          </p>
                          <p className="mt-1 font-semibold">{money(rate.price)}</p>
                          <StatusPill tone={rate.isSpecific ? "warning" : "success"}>
                            {rate.isSpecific ? "Especial" : "Normal"}
                          </StatusPill>
                          {rate.reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">{rate.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="manual">
          <SectionCard title="Regla para tarifa manual">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                "Recepción puede cotizar un precio especial desde reservaciones.",
                "Gerencia o administración debe autorizarlo antes de confirmar.",
                "Debe quedar guardado el precio normal, el precio especial y la razón.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border bg-background/60 p-4 text-sm leading-relaxed">
                  <ShieldAlert className="mb-3 size-5 text-amber-600" />
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="historial">
          <SectionCard title="Historial de cambios">
            {history.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                El servidor no devolvió historial de cambios de habitaciones/tarifas.
              </div>
            ) : (
              <MiniTable
                headers={["Fecha", "Usuario", "Cambio", "Razón"]}
                rows={history.map((item) => [item.date, item.user, item.change, item.reason || "-"])}
              />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TarifasPage
