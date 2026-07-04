import { useEffect, useMemo, useState } from "react"
import {
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Tags,
  Users,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EndpointPanel, SectionCard, StatCard, StatusPill, money } from "@/components/modules/view-kit"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { useStore } from "@/lib/store"
import type { Room, RoomRateOption, RoomSpecificRate, RoomStatus, RoomType } from "@/lib/types"

type RoomForm = {
  number: string
  floor: number
  typeId: string
  status: RoomStatus
  maxOccupancy: number
  specialRates: Record<number, SpecialRateForm>
  notes: string
}

type SpecialRateForm = {
  enabled: boolean
  price: string
  reason: string
}

type EditableRoomStatus = "disponible" | "limpieza" | "mantenimiento"
type CatalogRoomFilter =
  | "todos"
  | "disponible"
  | "ocupada"
  | "reservada"
  | "ready-for-check-in"
  | "limpieza"

const roomRates = [
  { type: "Estándar", single: 350, double: 650, triple: 900, quadruple: 1100, corporate: 280 },
  { type: "Jr. Suite", single: 425, double: 750, triple: 1000, quadruple: 1150, corporate: 375 },
]
const occupancyCounts = [1, 2, 3, 4]
const ROOM_STATUS_TOAST_ID = "habitaciones-room-status"

const statusTone: Record<RoomStatus, "success" | "info" | "warning" | "danger" | "muted"> = {
  disponible: "success",
  ocupada: "info",
  reservada: "warning",
  "ready-for-check-in": "info",
  limpieza: "warning",
  mantenimiento: "danger",
}

const roomStatusPayload: Record<RoomStatus, string> = {
  disponible: "Disponible",
  ocupada: "Ocupada",
  reservada: "Reservada",
  "ready-for-check-in": "ListaParaCheckIn",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
}

const emptySpecialRates = (): Record<number, SpecialRateForm> =>
  occupancyCounts.reduce(
    (acc, people) => ({
      ...acc,
      [people]: { enabled: false, price: "", reason: "" },
    }),
    {} as Record<number, SpecialRateForm>,
  )

const emptyForm = (typeId = "", maxOccupancy = 2): RoomForm => ({
  number: "",
  floor: 1,
  typeId,
  status: "disponible",
  maxOccupancy,
  specialRates: emptySpecialRates(),
  notes: "",
})

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
  const configured = room.occupancyOptions?.length
    ? room.occupancyOptions
    : occupancyOptionsForMax(roomMaxOccupancy(room, type))
  return [...new Set(configured)].sort((a, b) => a - b)
}

function fallbackTypeRate(type: RoomType | undefined, people: number) {
  const dynamic = type?.rates?.find((rate) => rate.peopleCount === people)?.price
  if (dynamic) return dynamic

  const normalized = normalizeRoomText(type?.name ?? "")
  const rate = roomRates.find((item) =>
    normalized.includes("jr") || normalized.includes("suite")
      ? item.type.toLowerCase().includes("jr")
      : item.type.toLowerCase().includes("est"),
  )

  if (!rate) return type?.basePrice ?? 0
  if (people <= 1) return rate.single
  if (people === 2) return rate.double
  if (people === 3) return rate.triple
  return rate.quadruple
}

function specificRateFor(room: Room | undefined, people: number) {
  return room?.specificRates?.find((rate) => rate.peopleCount === people)
}

function displayRateForRoom(room: Room, type: RoomType | undefined, people: number): RoomRateOption {
  const configured =
    room.rateOptions?.find((rate) => rate.peopleCount === people) ??
    type?.rates?.find((rate) => rate.peopleCount === people)
  const specific = specificRateFor(room, people)

  return {
    peopleCount: people,
    price: specific?.price ?? configured?.price ?? fallbackTypeRate(type, people),
    isSpecific: Boolean(specific?.price ?? configured?.isSpecific),
    reason: specific?.reason ?? configured?.reason,
    source: specific ? "habitacion" : configured?.source ?? "tipo",
  }
}

function specialRateFormFromRoom(room?: Room) {
  const next = emptySpecialRates()
  room?.specificRates?.forEach((rate) => {
    next[rate.peopleCount] = {
      enabled: true,
      price: String(rate.price),
      reason: rate.reason ?? "",
    }
  })
  return next
}

function specialRatesFromForm(form: RoomForm): RoomSpecificRate[] {
  return occupancyOptionsForMax(form.maxOccupancy).reduce<RoomSpecificRate[]>((rates, people) => {
    const rate = form.specialRates[people]
    if (rate?.enabled && Number(rate.price || 0) > 0) {
      rates.push({
        peopleCount: people,
        price: Number(rate.price || 0),
        reason: rate.reason.trim() || undefined,
      })
    }
    return rates
  }, [])
}

function getCorporateRate(name: string) {
  const normalized = normalizeRoomText(name)
  if (normalized.includes("estandar") || normalized.includes("standard")) return 280
  if (normalized.includes("junior") || normalized.includes("jr")) return 375
  return null
}

function getVisibleStatus(status: RoomStatus) {
  if (status === "ready-for-check-in") return "Lista check-in"
  return status
}

function isEditableRoomStatus(status: RoomStatus): status is EditableRoomStatus {
  return status === "disponible" || status === "limpieza" || status === "mantenimiento"
}


function fixMojibakeText(value?: string | null) {
  if (!value) return ""

  const replacements: Array<[RegExp, string]> = [
    [/EstÃ¡ndar/g, "Estándar"],
    [/estÃ¡ndar/g, "estándar"],
    [/HabitaciÃ³n/g, "Habitación"],
    [/habitaciÃ³n/g, "habitación"],
    [/OcupaciÃ³n/g, "Ocupación"],
    [/ocupaciÃ³n/g, "ocupación"],
    [/LavanderÃ­a/g, "Lavandería"],
    [/lavanderÃ­a/g, "lavandería"],
    [/Ã¡/g, "á"],
    [/Ã©/g, "é"],
    [/Ã­/g, "í"],
    [/Ã³/g, "ó"],
    [/Ãº/g, "ú"],
    [/Ã±/g, "ñ"],
    [/Ã/g, "Á"],
    [/Ã‰/g, "É"],
    [/Ã/g, "Í"],
    [/Ã“/g, "Ó"],
    [/Ãš/g, "Ú"],
    [/Ã‘/g, "Ñ"],
    [/Â/g, ""],
  ]

  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), String(value))
}

function normalizeRoomText(value: string) {
  return fixMojibakeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function roomNumberSortValue(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+)([a-zA-Z]*)$/)
  if (!match) return { base: Number.MAX_SAFE_INTEGER, suffix: trimmed.toLowerCase() }

  return {
    base: Number(match[1]),
    suffix: match[2]?.toLowerCase() ?? "",
  }
}

function compareRoomNumbers(a: string, b: string) {
  const left = roomNumberSortValue(a)
  const right = roomNumberSortValue(b)
  if (left.base !== right.base) return left.base - right.base
  return left.suffix.localeCompare(right.suffix, "es")
}

function compareRooms(a: Room, b: Room) {
  return compareRoomNumbers(a.number, b.number)
}

function backendIdFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

function roomTypeBackendId(typeId: string, roomTypes: RoomType[]) {
  const direct = backendIdFromValue(typeId)
  if (direct) return direct

  const rtMatch = typeId.match(/^rt-(\d+)$/)
  if (rtMatch) return Number(rtMatch[1])

  const type = roomTypes.find((item) => item.id === typeId)
  const normalized = normalizeRoomText(type?.name ?? typeId)
  if (normalized.includes("estandar") || normalized.includes("standard")) return 1
  if (normalized.includes("jr") || normalized.includes("junior") || normalized.includes("suite")) return 2
  return null
}

function pickRoomIdFromResponse(value: unknown): number | null {
  const direct = backendIdFromValue(value)
  if (direct) return direct

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = pickRoomIdFromResponse(item)
      if (id) return id
    }
    return null
  }

  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const ownId =
    backendIdFromValue(record.id_room) ??
    backendIdFromValue(record.idRoom) ??
    backendIdFromValue(record.room_id) ??
    backendIdFromValue(record.roomId) ??
    backendIdFromValue(record.id)
  if (ownId) return ownId

  for (const key of ["room", "created_room", "createdRoom", "new_room", "newRoom", "result", "data", "item"]) {
    const id = pickRoomIdFromResponse(record[key])
    if (id) return id
  }

  return null
}

export function HabitacionesPage() {
  const { rooms, roomTypes, reservations, guests, refreshApiState } = useStore()
  const [roomStatusSavingId, setRoomStatusSavingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmEditOpen, setConfirmEditOpen] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [catalogFilter, setCatalogFilter] = useState<CatalogRoomFilter>("todos")
  const [form, setForm] = useState<RoomForm>(emptyForm(roomTypes[0]?.id))
  const [backendAvailableRooms, setBackendAvailableRooms] = useState<number | null>(null)
  const [savingRoom, setSavingRoom] = useState(false)

  useEffect(() => {
    let cancelled = false
    const checkInDate = new Date()
    const checkOutDate = new Date(checkInDate)
    checkOutDate.setDate(checkOutDate.getDate() + 1)

    api.rooms.listAvailability<unknown>({
      check_in_date: checkInDate.toISOString(),
      check_out_date: checkOutDate.toISOString(),
    })
      .then((response) => {
        if (cancelled) return
        const rows = Array.isArray(response)
          ? response
          : response && typeof response === "object" && Array.isArray((response as { data?: unknown[] }).data)
            ? (response as { data: unknown[] }).data
            : []
        setBackendAvailableRooms(rows.length)
      })
      .catch((error) => {
        if (cancelled) return
        setBackendAvailableRooms(null)
        toast.error("No se pudo consultar disponibilidad del backend", {
          description: getApiErrorMessage(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const editingRoom = editingRoomId ? rooms.find((room) => room.id === editingRoomId) : undefined
  const occupied = rooms.filter((room) => room.status === "ocupada").length
  const available = rooms.filter((room) => room.status === "disponible").length
  const cleaning = rooms.filter((room) => room.status === "limpieza").length
  const maintenance = rooms.filter((room) => room.status === "mantenimiento").length
  const reserved = rooms.filter((room) => room.status === "reservada").length
  const readyForCheckIn = rooms.filter((room) => room.status === "ready-for-check-in").length
  const sortedRooms = useMemo(() => [...rooms].sort(compareRooms), [rooms])
  const canCreateRooms = roomTypes.length > 0
  const editingCanChangeStatus = !editingRoom || isEditableRoomStatus(editingRoom.status)
  const selectedFormType = roomTypes.find((type) => type.id === form.typeId)
  const catalogFilters: Array<{
    value: CatalogRoomFilter
    label: string
    count: number
    tone: "success" | "info" | "warning" | "muted"
  }> = [
    { value: "todos", label: "Todas", count: rooms.length, tone: "muted" },
    { value: "disponible", label: "Disponibles", count: available, tone: "success" },
    { value: "ocupada", label: "Ocupadas", count: occupied, tone: "info" },
    { value: "reservada", label: "Reservadas", count: reserved, tone: "warning" },
    { value: "ready-for-check-in", label: "Listas check-in", count: readyForCheckIn, tone: "info" },
    { value: "limpieza", label: "Limpieza", count: cleaning, tone: "warning" },
  ]
  const filteredCatalogRooms = useMemo(
    () =>
      catalogFilter === "todos"
        ? sortedRooms
        : sortedRooms.filter((room) => room.status === catalogFilter),
    [catalogFilter, sortedRooms],
  )

  const inHouseByRoom = useMemo(() => {
    const map = new Map<string, (typeof reservations)[number]>()
    reservations
      .filter((reservation) => reservation.status === "in-house")
      .forEach((reservation) => map.set(reservation.roomId, reservation))
    return map
  }, [reservations])

  const roomTypeCards = useMemo(
    () =>
      roomTypes.map((type) => {
        const roomsByType = rooms.filter((room) => room.typeId === type.id)
        return {
          type,
          total: roomsByType.length,
          available: roomsByType.filter((room) => room.status === "disponible").length,
          occupied: roomsByType.filter((room) => room.status === "ocupada").length,
          corporate: getCorporateRate(type.name),
        }
      }),
    [roomTypes, rooms],
  )

  const openCreate = () => {
    const defaultType = roomTypes[0]
    setEditingRoomId(null)
    setForm(emptyForm(defaultType?.id, defaultType?.capacity ?? 2))
    setDialogOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditingRoomId(room.id)
    setForm({
      number: room.number,
      floor: room.floor,
      typeId: room.typeId,
      status: room.status,
      maxOccupancy: roomMaxOccupancy(room, roomTypes.find((type) => type.id === room.typeId)),
      specialRates: specialRateFormFromRoom(room),
      notes: room.notes ?? "",
    })
    setDialogOpen(true)
  }

  const resetDialog = () => {
    setDialogOpen(false)
    setEditingRoomId(null)
    setForm(emptyForm(roomTypes[0]?.id, roomTypes[0]?.capacity ?? 2))
  }

  const saveRoom = async () => {
    const number = form.number.trim()
    if (!number) {
      toast.error("El número de habitación es obligatorio")
      return
    }
    if (!form.typeId) {
      toast.error("Selecciona un tipo de habitación")
      return
    }

    const idRoomType = roomTypeBackendId(form.typeId, roomTypes)
    if (!idRoomType) {
      toast.error("El tipo de habitación no tiene ID real del backend", {
        description: "Primero carga el catálogo base de tipos de habitación.",
      })
      return
    }

    const maxOccupancy = Math.max(1, Math.min(4, Number(form.maxOccupancy || 1)))
    const occupancyOptions = occupancyOptionsForMax(maxOccupancy)
    const specificRates = specialRatesFromForm({ ...form, maxOccupancy })
    const invalidSpecialRate = occupancyOptions.some((people) => {
      const rate = form.specialRates[people]
      return rate?.enabled && (!Number(rate.price || 0) || rate.reason.trim().length < 3)
    })
    if (invalidSpecialRate) {
      toast.error("Cada tarifa especial necesita precio y razón")
      return
    }
    const duplicate = rooms.some((room) => room.number.toLowerCase() === number.toLowerCase() && room.id !== editingRoomId)
    if (duplicate) {
      toast.error("Ya existe una habitación con ese número")
      return
    }

    const payload = {
      room_number: number,
      floor: form.floor,
      id_room_type: idRoomType,
      status: roomStatusPayload[editingRoom && !editingCanChangeStatus ? editingRoom.status : form.status],
      internal_notes: form.notes.trim() || null,
      amenity_ids: [],
    }

    setSavingRoom(true)
    try {
      const roomId = editingRoom
        ? backendIdFromValue(editingRoom.id)
        : pickRoomIdFromResponse(await api.rooms.create<unknown>(payload))

      if (editingRoom) {
        if (!roomId) {
          toast.error("La habitación no tiene identificador real del backend", {
            description: "No se guardó ningún cambio local falso.",
          })
          return
        }
        await api.rooms.update(roomId, payload)
      }

      if (!roomId) {
        throw new Error("El backend creó la habitación, pero no devolvió el ID para terminar la configuración.")
      }

      await api.rooms.setOccupancyOptions(roomId, { people_counts: occupancyOptions })

      for (const rate of specificRates) {
        await api.rooms.createSpecificRate(roomId, {
          people_count: rate.peopleCount,
          price: rate.price,
          reason: rate.reason ?? null,
        })
      }

      await refreshApiState(["roomTypes", "rooms", "roomRateOptions"], { force: true })
      toast.success(editingRoom ? `Habitación ${number} actualizada` : `Habitación ${number} creada`)
      resetDialog()
    } catch (error) {
      toast.error(editingRoom ? "No se pudo actualizar la habitación" : "No se pudo crear la habitación", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingRoom(false)
    }
  }

  const updateStatus = async (roomId: string, status: RoomStatus, notes?: string) => {
    const id = Number(roomId)
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("La habitación no tiene identificador real del backend", {
        description: "Recarga la vista. No se guardó ningún cambio local falso.",
      })
      return false
    }

    setRoomStatusSavingId(roomId)
    try {
      await api.rooms.updateStatus(id, {
        status: roomStatusPayload[status],
        notes: notes ?? null,
      })
      await refreshApiState(["rooms"], { force: true })
      toast.success(`Estado actualizado a ${status}`, {
        id: ROOM_STATUS_TOAST_ID,
        duration: 2400,
      })
      return true
    } catch (error) {
      toast.error("No se pudo actualizar la habitación en backend", {
        description: getApiErrorMessage(error),
      })
      return false
    } finally {
      setRoomStatusSavingId(null)
    }
  }

  const requestStayCleaning = async (room: Room) => {
    const saved = await updateStatus(
      room.id,
      "limpieza",
      `Limpieza durante estadía solicitada para habitación ${room.number}`,
    )
    if (saved) {
      toast.success(`Limpieza de estancia solicitada para habitación ${room.number}`)
    }
  }

  const completeStayCleaning = async (room: Room) => {
    const roomId = Number(room.id)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      toast.error("La habitación no tiene identificador real del backend", {
        description: "No se marcó la limpieza como completada.",
      })
      return
    }

    setRoomStatusSavingId(room.id)
    try {
      await api.rooms.markClean(roomId)
      if (inHouseByRoom.has(room.id)) {
        await api.rooms.updateStatus(roomId, {
          status: roomStatusPayload.ocupada,
          notes: `Limpieza durante estadía completada en habitación ${room.number}`,
        })
      }
      await refreshApiState(["rooms"], { force: true })
      toast.success(`Limpieza completada en habitación ${room.number}`, {
        id: ROOM_STATUS_TOAST_ID,
        duration: 2400,
      })
    } catch (error) {
      toast.error("No se pudo marcar la habitación como limpia en backend", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setRoomStatusSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Habitaciones y tarifas"
        description="Catálogo visual para recepción y administración: revisa tipos, tarifas guía y habitaciones registradas sin mezclarlo con reservaciones o check-in."
        actions={
          <Button size="sm" className="gap-2 rounded-full px-4" onClick={openCreate} disabled={!canCreateRooms || savingRoom}>
            <Plus className="size-4" />
            Nueva habitación
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard label="Habitaciones" value={rooms.length} helper={`${roomTypes.length} tipos configurados`} />
        <StatCard label="Disponibles" value={available} tone="success" />
        <StatCard
          label="Disponibles backend"
          value={backendAvailableRooms ?? "N/D"}
          helper="/api/rooms/availability"
          tone={backendAvailableRooms === null ? "warning" : "success"}
        />
        <StatCard label="Ocupadas" value={occupied} tone="info" />
        <StatCard label="Limpieza" value={cleaning} tone={cleaning ? "warning" : "success"} />
        <StatCard label="Mantenimiento" value={maintenance} tone={maintenance ? "danger" : "success"} />
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="hidden">Guia rapida</p>
              <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guia rapida para habitaciones</h2>
              <p className="mobile-safe-text mt-1 max-w-2xl text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
                Aquí solo se arreglan datos del cuarto: número, piso, tipo, estado y notas. Las reservas y entradas de huéspedes se hacen en Recepción.
              </p>
            </div>
          </div>

          <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
            {[
              { icon: BedDouble, title: "Ver qué se vende", text: "Aquí se mira qué tipo de cuarto es, cuántas personas caben y qué camas tiene." },
              { icon: Pencil, title: "Arreglar el catálogo", text: "Usa esto si un número, piso, tipo o nota de una habitación está mal." },
              { icon: Tags, title: "Revisar precios", text: "Las tarifas sirven como guía rápida antes de ofrecer una habitación." },
              { icon: ClipboardList, title: "Limpieza con huésped", text: "Si el huésped sigue hospedado, solo se pide limpieza. El cuarto sigue ocupado." },
            ].map((item, index) => {
              const StepIcon = item.icon

              return (
                <div key={item.title} className="min-w-0 rounded-xl border bg-white/75 p-2.5 sm:rounded-2xl sm:p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 sm:size-8 sm:rounded-xl">
                      <StepIcon className="size-4" />
                    </div>
                    <span className="mobile-safe-text text-[0.65rem] font-bold uppercase tracking-wide text-blue-700 sm:text-xs">
                      Paso {index + 1}
                    </span>
                  </div>
                  <p className="mobile-safe-text mt-2 text-sm font-semibold sm:mt-3 sm:text-base">{item.title}</p>
                  <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/75 sm:text-sm">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {roomTypes.length === 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">Falta catálogo base de tipos de habitación</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/80">
            La base quedó vacía y el backend solo expone GET /api/room-types. Antes de crear habitaciones, carga el seed de tipos 
            Estándar y Jr Suite para que cada habitación quede relacionada con un tipo real.
          </p>
        </section>
      ) : null}

      <Tabs defaultValue="tipos" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-2xl bg-muted/60 p-1 sm:w-auto">
          <TabsTrigger value="tipos">Tipos y tarifas</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="limpieza-estancia">Limpieza de estancia</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos" className="space-y-4">
          <SectionCard
            title="Tipos actuales"
            description="Tarjetas pensadas para que recepción entienda rápido qué puede ofrecer y con qué tarifa de referencia."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {roomTypeCards.map(({ type, total, available: typeAvailable, occupied: typeOccupied, corporate }) => (
                <article key={type.id} className="overflow-hidden rounded-3xl border bg-background/70 shadow-sm">
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_180px]">
                    <div>
                      <div className="flex items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <BedDouble className="size-5" />
                        </span>
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-muted-foreground">Tipo de habitación</p>
                          <h3 className="mt-1 font-serif text-2xl font-light">{fixMojibakeText(type.name)}</h3>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{fixMojibakeText(type.description)}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <StatusPill tone="info">{fixMojibakeText(type.beds)}</StatusPill>
                        <StatusPill tone="success">{typeAvailable} disponibles</StatusPill>
                        <StatusPill tone="warning">{typeOccupied} ocupadas</StatusPill>
                        {corporate && <StatusPill tone="muted">Corp. {money(corporate)}</StatusPill>}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                      <div className="rounded-2xl border bg-card p-3">
                        <Users className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Capacidad</p>
                        <p className="font-semibold">{type.capacity} personas</p>
                      </div>
                      <div className="rounded-2xl border bg-card p-3">
                        <Tags className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Base</p>
                        <p className="font-semibold">{money(type.basePrice)}</p>
                      </div>
                      <div className="rounded-2xl border bg-card p-3">
                        <Building2 className="size-4 text-muted-foreground" />
                        <p className="mt-2 text-xs text-muted-foreground">Unidades</p>
                        <p className="font-semibold">{total}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t bg-muted/25 px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {type.amenities.map((item) => (
                        <span key={fixMojibakeText(item)} className="rounded-full border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
                          {fixMojibakeText(item)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Tarifas guía por ocupación">
            <div className="grid gap-3 md:grid-cols-2">
              {roomRates.map((rate) => (
                <div key={rate.type} className="rounded-3xl border bg-background/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-muted-foreground">Tarifa autorizada</p>
                      <h3 className="font-serif text-2xl font-light">{rate.type}</h3>
                    </div>
                    <StatusPill tone="info">Corp. {money(rate.corporate)}</StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["1 persona", rate.single],
                      ["2 personas", rate.double],
                      ["3 personas", rate.triple],
                      ["4 personas", rate.quadruple],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border bg-card p-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 font-semibold">{money(Number(value))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="catalogo">
          <SectionCard
            title="Habitaciones registradas"
            description="Crea, edita y revisa habitaciones del catálogo. Los cambios de disponibilidad del día se manejan desde recepción."
            actions={
              <Button size="sm" className="gap-2 rounded-full" onClick={openCreate} disabled={!canCreateRooms || savingRoom}>
                <Plus className="size-4" />
                Nueva habitación
              </Button>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2 rounded-3xl border bg-muted/20 p-2">
              {catalogFilters.map((filter) => {
                const active = catalogFilter === filter.value
                const toneClass = {
                  success: active
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                  info: active
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
                  warning: active
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                  muted: active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted",
                }[filter.tone]

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCatalogFilter(filter.value)}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${toneClass}`}
                  >
                    {filter.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-background/70"}`}>
                      {filter.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCatalogRooms.length === 0 ? (
                <div className="col-span-full rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay habitaciones con este filtro.
                </div>
              ) : null}

              {filteredCatalogRooms.map((room) => {
                const type = roomTypes.find((roomType) => roomType.id === room.typeId)
                const occupancyOptions = roomOccupancyOptions(room, type)
                const rates = occupancyOptions.map((people) =>
                  displayRateForRoom(room, type, people),
                )
                return (
                  <article key={room.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                          {room.floor ? `Piso ${room.floor}` : "Bungalow"}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold">Habitación {room.number}</h3>
                        <p className="text-sm text-muted-foreground">{fixMojibakeText(type?.name) || "Sin tipo"}</p>
                      </div>
                      <StatusPill tone={statusTone[room.status]}>{getVisibleStatus(room.status)}</StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border bg-card p-3">
                        <p className="text-xs text-muted-foreground">Camas</p>
                        <p className="mt-1 font-medium">{fixMojibakeText(type?.beds) || "-"}</p>
                      </div>
                      <div className="rounded-2xl border bg-card p-3">
                        <p className="text-xs text-muted-foreground">Capacidad</p>
                        <p className="mt-1 font-medium">{roomMaxOccupancy(room, type)} personas</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">Tarifas por ocupación</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {rates.map((rate) => (
                          <div key={rate.peopleCount} className="rounded-xl border bg-background/70 p-2">
                            <p className="text-xs text-muted-foreground">{rate.peopleCount} persona{rate.peopleCount > 1 ? "s" : ""}</p>
                            <p className="font-semibold">{money(rate.price)}</p>
                            {rate.isSpecific ? (
                              <p className="text-[0.68rem] font-semibold text-amber-700">
                                Especial{rate.reason ? `: ${fixMojibakeText(rate.reason)}` : ""}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    {room.notes && <p className="mt-3 rounded-2xl bg-muted/45 p-3 text-sm text-muted-foreground">{fixMojibakeText(room.notes)}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={() => openEdit(room)}>
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                      {(room.status === "limpieza" || room.status === "mantenimiento") && (
                        <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={() => void updateStatus(room.id, "disponible", "Habitación marcada disponible desde catálogo") } disabled={roomStatusSavingId === room.id}>
                          <DoorOpen className="size-3.5" />
                          Disponible
                        </Button>
                      )}
                      {room.status === "disponible" && (
                        <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={() => void updateStatus(room.id, "mantenimiento", "Habitación enviada a mantenimiento desde catálogo") } disabled={roomStatusSavingId === room.id}>
                          <Wrench className="size-3.5" />
                          Mantenimiento
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="limpieza-estancia">
          <SectionCard
            title="Limpieza durante estadía"
            description="Usa esto cuando el huésped sigue hospedado y pide que limpien su cuarto."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rooms
                .filter((room) => room.status === "ocupada" || (room.status === "limpieza" && inHouseByRoom.has(room.id)))
                .map((room) => {
                  const reservation = inHouseByRoom.get(room.id)
                  const guest = reservation ? guests.find((item) => item.id === reservation.guestId) : undefined
                  const isCleaning = room.status === "limpieza"

                  return (
                    <article key={room.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Habitación ocupada</p>
                          <h3 className="mt-1 text-2xl font-semibold">Habitación {room.number}</h3>
                          <p className="text-sm text-muted-foreground">{fixMojibakeText(guest?.name) || "Huésped en casa"}</p>
                        </div>
                        <StatusPill tone={isCleaning ? "warning" : "info"}>
                          {isCleaning ? "limpieza" : "ocupada"}
                        </StatusPill>
                      </div>

                      <div className="mt-4 rounded-2xl border bg-card p-3 text-sm">
                        <div className="flex items-start gap-3">
                          <ClipboardList className="mt-0.5 size-4 text-primary" />
                          <div>
                            <p className="font-medium">Room service de limpieza</p>
                            <p className="mt-1 text-muted-foreground">
                              {isCleaning
                                ? "Limpieza durante estancia marcada en el servidor."
                                : "Sin limpieza pendiente para esta estadía."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isCleaning ? (
                          <Button size="sm" className="gap-2 rounded-full" onClick={() => void completeStayCleaning(room)} disabled={roomStatusSavingId === room.id}>
                            <CheckCircle2 className="size-3.5" />
                            {roomStatusSavingId === room.id ? "Guardando..." : "Completar limpieza"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={() => void requestStayCleaning(room)} disabled={roomStatusSavingId === room.id}>
                            <Sparkles className="size-3.5" />
                            {roomStatusSavingId === room.id ? "Guardando..." : "Solicitar limpieza"}
                          </Button>
                        )}
                        <StatusPill tone="muted">Sigue ocupada</StatusPill>
                      </div>
                    </article>
                  )
                })}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="backend">
          <SectionCard
            title="Endpoints reales para Habitaciones"
            description="Rutas disponibles en Swagger que alimentan catalogo, tarifas, disponibilidad y cambios de estado."
          >
            <EndpointPanel
              endpoints={[
                "GET /api/rooms",
                "GET /api/rooms/availability",
                "GET /api/rooms/audit-log",
                "POST /api/rooms",
                "PATCH /api/rooms/{id}",
                "PATCH /api/rooms/{id}/status",
                "PATCH /api/rooms/{id}/occupancy-options",
                "POST /api/rooms/{id}/specific-rates",
                "GET /api/rooms/{id}/rate-options",
                "PATCH /api/rooms/{roomId}/clean",
                "GET /api/room-types",
                "POST /api/rates/calculate",
                "POST /api/rates/quote",
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : resetDialog())}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar habitación" : "Nueva habitación"}</DialogTitle>
            <DialogDescription>
              Completa solo datos de catálogo. La disponibilidad operativa diaria vive en Reservaciones y Check-in / Check-out.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Número
              <Input
                value={form.number}
                onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
                placeholder="Ej. 212"
                className="rounded-full"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Piso
              <Input
                type="number"
                value={form.floor || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    floor: event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
                className="rounded-full"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo de habitación
              <select
                value={form.typeId}
                onChange={(event) => setForm((current) => ({ ...current, typeId: event.target.value }))}
                className="h-10 w-full rounded-full border bg-background px-3 text-sm"
              >
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {fixMojibakeText(type.name)} · {type.capacity} personas
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Estado operativo
              {editingCanChangeStatus ? (
                <select
                  value={isEditableRoomStatus(form.status) ? form.status : "disponible"}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EditableRoomStatus }))}
                  className="h-10 w-full rounded-full border bg-background px-3 text-sm"
                >
                  <option value="disponible">Disponible</option>
                  <option value="limpieza">Limpieza</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-full border bg-muted/35 px-3 text-sm text-muted-foreground">
                  {getVisibleStatus(editingRoom.status)}
                </div>
              )}
            </label>
            <label className="space-y-2 text-sm font-medium">
              Capacidad máxima
              <select
                value={form.maxOccupancy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxOccupancy: Number(event.target.value),
                  }))
                }
                className="h-10 w-full rounded-full border bg-background px-3 text-sm"
              >
                {occupancyCounts.map((people) => (
                  <option key={people} value={people}>
                    {people} persona{people > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Notas internas
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ej. Cama extra disponible, balcón interior, pendiente revisión de aire."
                className="min-h-24 rounded-2xl"
              />
            </label>
            <div className="space-y-3 rounded-2xl border bg-muted/20 p-4 md:col-span-2">
              <div>
                <p className="font-semibold">Tarifas especiales por habitacion</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Solo activa las ocupaciones que tienen un precio distinto al tipo de habitación.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {occupancyOptionsForMax(form.maxOccupancy).map((people) => {
                  const special = form.specialRates[people] ?? { enabled: false, price: "", reason: "" }
                  const normalRate = fallbackTypeRate(selectedFormType, people)

                  return (
                    <div key={people} className="rounded-2xl border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {people} persona{people > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Normal {money(normalRate)}
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={special.enabled}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                specialRates: {
                                  ...current.specialRates,
                                  [people]: {
                                    ...(current.specialRates[people] ?? { enabled: false, price: "", reason: "" }),
                                    enabled: event.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          Especial
                        </label>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <Input
                          type="number"
                          value={special.price}
                          disabled={!special.enabled}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              specialRates: {
                                ...current.specialRates,
                                [people]: {
                                  ...(current.specialRates[people] ?? { enabled: false, price: "", reason: "" }),
                                  price: event.target.value,
                                },
                              },
                            }))
                          }
                          className="rounded-full"
                          placeholder="Precio especial"
                        />
                        <Input
                          value={special.reason}
                          disabled={!special.enabled}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              specialRates: {
                                ...current.specialRates,
                                [people]: {
                                  ...(current.specialRates[people] ?? { enabled: false, price: "", reason: "" }),
                                  reason: event.target.value,
                                },
                              },
                            }))
                          }
                          className="rounded-full"
                          placeholder="Razón del precio"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Sparkles className="mb-2 size-4 text-primary" />
            El tipo seleccionado define capacidad, camas y tarifa base. Así recepción no puede vender una habitación con el tipo equivocado por error.
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={resetDialog}>
              Cancelar
            </Button>
            <Button
              className="gap-2 rounded-full"
              onClick={() => (editingRoom ? setConfirmEditOpen(true) : void saveRoom())}
              disabled={savingRoom}
            >
              <Save className="size-4" />
              {savingRoom ? "Guardando..." : "Guardar habitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Guardar cambios de habitación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres actualizar esta habitación? El cambio afectará cómo se ve en disponibilidad y operación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              disabled={savingRoom}
              onClick={() => {
                void saveRoom()
                setConfirmEditOpen(false)
              }}
            >
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default HabitacionesPage
