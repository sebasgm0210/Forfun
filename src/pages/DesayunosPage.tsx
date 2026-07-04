import { useEffect, useMemo, useRef, useState } from "react"
import {
  BadgeCheck,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  Copy,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  MessageSquareText,
  QrCode,
  Search,
  Save,
  Smartphone,
  TicketCheck,
  Trash2,
  Utensils,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
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
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiErrorMessage } from "@/lib/api"
import { breakfastQrSvgDataUrl, breakfastQrUrl, roomQrCode } from "@/lib/breakfast-qr"
import { formatDate, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { BreakfastOption, BreakfastType, Reservation, Room } from "@/lib/types"

type BreakfastSelectionStatus = "recibido" | "canjeado"
type BreakfastTab = "pedidos" | "habitaciones" | "vistaQr" | "catalogo" | "tickets" | "backend"
type BreakfastFilter = "todos" | BreakfastSelectionStatus

type BreakfastSelection = {
  id: string
  reservationId?: string
  date: string
  requestedAt: string
  room: string
  qrCode: string
  guestName: string
  type: BreakfastType
  drink: string
  notes: string
  status: BreakfastSelectionStatus
  redeemedAt?: string
}

type PendingDialog = {
  title: string
  description: string
  confirmLabel: string
  tone?: "danger" | "default"
  onConfirm: () => void
} | null

type RoomQr = {
  room: Room
  qrCode: string
  qrUrl: string
  reservation?: Reservation
  guestName: string
  pendingSelection?: BreakfastSelection
  allowance: BreakfastAllowance
}

type BreakfastRoomQrSummary = {
  stayRoomId: number
  roomId: string
  roomNumber: string
  guestName: string
  qrCode: string
  qrUrl?: string
  peopleCount: number
  todayAllowed: number
  todayUsed: number
  todayAvailable: number
}

type BreakfastAllowance = {
  guests: number
  nights: number
  total: number
  daily: number
  usedTotal: number
  usedToday: number
  availableTotal: number
  availableToday: number
  dateInStay: boolean
}

const drinkOptions = ["Café", "Té", "Jugo natural", "Agua pura"]
const breakfastAccents = [
  "border-sky-200 bg-sky-50 text-sky-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-lime-200 bg-lime-50 text-lime-950",
  "border-rose-200 bg-rose-50 text-rose-950",
  "border-violet-200 bg-violet-50 text-violet-950",
]
type BreakfastDailyReportMetric = {
  label: string
  value: number
  helper: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const currentTime = () =>
  new Date().toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  })

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

function apiNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(record[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function mapBreakfastDailyReport(value: unknown): BreakfastDailyReportMetric[] {
  const root = apiRecord(value)
  const dataRecord = apiRecord(root.data)
  const data = Object.keys(dataRecord).length ? dataRecord : root
  const rows = apiArray(data.items).length
    ? apiArray(data.items)
    : apiArray(data.options).length
      ? apiArray(data.options)
      : apiArray(data.details)
  const issued = apiNumber(data, ["issued", "total_issued", "totalIssued", "total", "tickets"], rows.length)
  const redeemed = apiNumber(data, ["redeemed", "total_redeemed", "totalRedeemed", "used", "canjeados"])
  const pending = apiNumber(data, ["pending", "total_pending", "totalPending", "available", "pendientes"], Math.max(0, issued - redeemed))

  return [
    { label: "Tickets emitidos hoy", value: issued, helper: "GET /api/breakfast/reports/daily" },
    { label: "Canjeados", value: redeemed, helper: "Registrados como entregados" },
    { label: "Pendientes", value: pending, helper: "Aún disponibles para canjear" },
  ]
}

function timeFromApi(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || value
  return date.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })
}

function dateFromApi(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

function mapBreakfastRoomQr(value: unknown): BreakfastRoomQrSummary | null {
  const record = apiRecord(value)
  const roomId = apiText(record, ["id_room", "idRoom", "room_id"])
  const roomNumber = apiText(record, ["room_number", "roomNumber"])
  const qrCode = apiText(record, ["qr_code", "qrCode"])
  if (!roomId || !roomNumber || !qrCode) return null

  return {
    stayRoomId: apiNumber(record, ["id_stay_room", "idStayRoom"]),
    roomId,
    roomNumber,
    guestName: apiText(record, ["guest_name", "guestName"], "Huésped"),
    qrCode,
    qrUrl: apiText(record, ["qr_url", "qrUrl", "public_url", "publicUrl"]) || undefined,
    peopleCount: apiNumber(record, ["people_count", "peopleCount"], 1),
    todayAllowed: apiNumber(record, ["today_allowed", "todayAllowed"], 1),
    todayUsed: apiNumber(record, ["today_used", "todayUsed"]),
    todayAvailable: apiNumber(record, ["today_available", "todayAvailable"], 1),
  }
}

function mapBreakfastSelection(
  value: unknown,
  options: BreakfastOption[],
): BreakfastSelection | null {
  const record = apiRecord(value)
  const id = apiText(record, [
    "id_breakfast_selection",
    "idBreakfastSelection",
    "selection_id",
    "id",
  ])
  if (!id) return null

  const optionId = apiText(record, [
    "id_breakfast_option",
    "idBreakfastOption",
    "breakfast_option_id",
  ])
  const optionName = apiText(record, [
    "breakfast_option_name",
    "breakfast_name",
    "option_name",
    "type",
  ])
  const type =
    options.find((option) => option.id === optionId)?.id ??
    options.find((option) => option.label.toLowerCase() === optionName.toLowerCase())?.id ??
    (optionId || options[0]?.id)
  if (!type) return null

  const requestedAt = apiText(record, [
    "requested_at",
    "requestedAt",
    "created_at",
    "createdAt",
  ], new Date().toISOString())
  const redeemedAt = apiText(record, ["redeemed_at", "redeemedAt"])
  const rawStatus = apiText(record, ["status"], redeemedAt ? "Canjeado" : "Recibido")
    .toLowerCase()
  const status: BreakfastSelectionStatus =
    rawStatus.includes("canje") ||
    rawStatus.includes("redim") ||
    rawStatus.includes("entreg")
      ? "canjeado"
      : "recibido"

  return {
    id,
    reservationId: apiText(record, ["id_reservation", "reservation_id"]) || undefined,
    date: dateFromApi(
      apiText(record, ["selection_date", "date", "requested_at", "created_at"], requestedAt),
    ),
    requestedAt: timeFromApi(requestedAt),
    room: apiText(record, ["room_number", "roomNumber", "room"]),
    qrCode: apiText(record, ["qr_code", "qrCode"]),
    guestName: apiText(record, ["guest_name", "guestName"], "Huésped"),
    type,
    drink: apiText(record, ["beverage", "drink"], "Sin bebida"),
    notes: apiText(record, ["notes"]),
    status,
    redeemedAt: redeemedAt ? timeFromApi(redeemedAt) : undefined,
  }
}

function reservationGuestCount(reservation: Reservation) {
  return Math.max(1, reservation.adults + reservation.children)
}

function reservationBreakfastTotal(reservation: Reservation) {
  return reservationGuestCount(reservation) * Math.max(0, reservation.nights)
}

function dateInBreakfastStay(reservation: Reservation, date: string) {
  return date >= reservation.checkIn && date < reservation.checkOut
}

function emptyAllowance(): BreakfastAllowance {
  return {
    guests: 0,
    nights: 0,
    total: 0,
    daily: 0,
    usedTotal: 0,
    usedToday: 0,
    availableTotal: 0,
    availableToday: 0,
    dateInStay: false,
  }
}

function BreakfastStatusBadge({ status }: { status: BreakfastSelectionStatus }) {
  const redeemed = status === "canjeado"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        redeemed
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {redeemed ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <Clock3 className="size-3.5" />
      )}
      {redeemed ? "Canjeado" : "Recibido por QR"}
    </span>
  )
}

function BreakfastMetric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string
  value: string | number
  helper: string
  tone?: "default" | "warning" | "success" | "info"
}) {
  const tones = {
    default: "border-border bg-card",
    warning: "border-amber-200 bg-amber-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    info: "border-blue-200 bg-blue-50/80",
  }

  return (
    <div className={cn("rounded-2xl border p-3 shadow-sm sm:rounded-3xl sm:p-4", tones[tone])}>
      <p className="mobile-safe-text text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      <p className="mobile-safe-text mt-1 text-xl font-bold tracking-tight sm:mt-2 sm:text-2xl">{value}</p>
      <p className="mobile-safe-text mt-1 text-[0.7rem] leading-4 text-muted-foreground sm:text-xs">{helper}</p>
    </div>
  )
}

function MiniQr({ code, value }: { code: string; value: string }) {
  return (
    <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white p-2 shadow-sm">
      <img
        src={breakfastQrSvgDataUrl(value)}
        alt={`QR real ${code}`}
        className="size-full"
        loading="lazy"
      />
    </div>
  )
}

function BreakfastPersonStatus({ item }: { item: RoomQr }) {
  const total = Math.max(0, item.allowance.daily)

  return (
    <div className="mt-3 grid gap-1.5">
      {Array.from({ length: total }).map((_, index) => {
        const redeemed = index < item.allowance.usedToday

        return (
          <div
            key={`${item.room.id}-person-${index}`}
            className={cn(
              "flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs font-semibold",
              redeemed
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <span>Persona {index + 1}</span>
            <span>{redeemed ? "Canjeado" : "Pendiente"}</span>
          </div>
        )
      })}
      {total === 0 ? (
        <div className="rounded-xl border border-dashed px-2.5 py-2 text-xs font-semibold text-muted-foreground">
          Sin cupos reportados por el servidor
        </div>
      ) : null}
    </div>
  )
}

function BreakfastOptionPhoto({
  option,
  className,
}: {
  option: BreakfastOption
  className?: string
}) {
  if (option.imageUrl) {
    return (
      <img
        src={option.imageUrl}
        alt={option.label}
        className={cn("h-28 w-full rounded-2xl object-cover", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "grid h-28 w-full place-items-center rounded-2xl border bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-primary",
        className,
      )}
    >
      <div className="text-center">
        <Utensils className="mx-auto size-7" />
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Foto pendiente
        </p>
      </div>
    </div>
  )
}

export function DesayunosPage() {
  const {
    breakfasts,
    breakfastOptions,
    rooms,
    reservations,
    getGuest,
    dispatch,
    refreshApiState,
  } = useStore()
  const [activeTab, setActiveTab] = useState<BreakfastTab>("pedidos")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<BreakfastFilter>("todos")
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("204")
  const [guestForm, setGuestForm] = useState({
    type: "americano" as BreakfastType,
    drink: "Café",
    notes: "",
  })
  const [physicalTicketForm, setPhysicalTicketForm] = useState({
    roomNumber: "204",
    type: "americano" as BreakfastType,
    drink: "Café",
    notes: "",
  })
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null)
  const optionFormRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [optionForm, setOptionForm] = useState({
    label: "",
    description: "",
    imageUrl: "",
    accent: breakfastAccents[0],
  })
  const [roomQrSummaries, setRoomQrSummaries] = useState<BreakfastRoomQrSummary[]>([])
  const [qrSelections, setQrSelections] = useState<BreakfastSelection[]>([])
  const [dailyReportMetrics, setDailyReportMetrics] = useState<BreakfastDailyReportMetric[]>([])

  useEffect(() => {
    void refreshApiState(
      ["breakfastOptions", "breakfasts", "rooms", "reservations"],
      { force: true },
    )
  }, [refreshApiState])

  useEffect(() => {
    let cancelled = false

    api.breakfast.getDailyReport<unknown>()
      .then((response) => {
        if (cancelled) return
        setDailyReportMetrics(mapBreakfastDailyReport(response))
      })
      .catch((error) => {
        if (cancelled) return
        setDailyReportMetrics([])
        toast.error("No se pudo cargar el reporte diario de desayunos", {
          description: getApiErrorMessage(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api.breakfast.listRoomQrCodes<unknown>()
      .then((response) => {
        if (cancelled) return
        const latestByRoom = new Map<string, BreakfastRoomQrSummary>()
        apiArray(response)
          .map(mapBreakfastRoomQr)
          .filter((item): item is BreakfastRoomQrSummary => Boolean(item))
          .forEach((item) => {
            const current = latestByRoom.get(item.roomId)
            if (!current || item.stayRoomId >= current.stayRoomId) {
              latestByRoom.set(item.roomId, item)
            }
          })
        setRoomQrSummaries(Array.from(latestByRoom.values()))
      })
      .catch((error) => {
        if (cancelled) return
        toast.error("No se pudieron cargar las habitaciones con desayuno", {
          description: getApiErrorMessage(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api.breakfast.listTodaySelections<unknown>()
      .then((response) => {
        if (cancelled) return
        setQrSelections(
          apiArray(response)
            .map((item) => mapBreakfastSelection(item, breakfastOptions))
            .filter((item): item is BreakfastSelection => Boolean(item)),
        )
      })
      .catch((error) => {
        if (cancelled) return
        toast.error("No se pudieron cargar los pedidos QR", {
          description: getApiErrorMessage(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [breakfastOptions])

  const firstBreakfastOption = breakfastOptions[0]
  const selectedBreakfastType = breakfastOptions.some(
    (option) => option.id === guestForm.type,
  )
    ? guestForm.type
    : firstBreakfastOption?.id ?? ""
  const selectedPhysicalBreakfastType = breakfastOptions.some(
    (option) => option.id === physicalTicketForm.type,
  )
    ? physicalTicketForm.type
    : firstBreakfastOption?.id ?? ""

  function getBreakfastOption(type: BreakfastType) {
    return breakfastOptions.find((option) => option.id === type)
  }

  function breakfastLabel(type: BreakfastType) {
    return getBreakfastOption(type)?.label ?? type
  }

  function breakfastAccent(type: BreakfastType) {
    return getBreakfastOption(type)?.accent ?? "border-muted bg-muted/20 text-foreground"
  }

  const activeReservations = useMemo(
    () =>
      reservations.filter((reservation) =>
        ["in-house", "confirmada"].includes(reservation.status),
      ),
    [reservations],
  )

  function reservationForRoomNumber(roomNumber: string, date = todayIso()) {
    const room = rooms.find((item) => item.number === roomNumber)
    if (!room) return undefined
    return (
      activeReservations.find(
        (reservation) =>
          reservation.roomId === room.id &&
          reservation.status === "in-house" &&
          dateInBreakfastStay(reservation, date),
      ) ??
      activeReservations.find(
        (reservation) =>
          reservation.roomId === room.id && dateInBreakfastStay(reservation, date),
      ) ??
      activeReservations.find((reservation) => reservation.roomId === room.id)
    )
  }

  function selectionReservationId(selection: BreakfastSelection) {
    return selection.reservationId ?? reservationForRoomNumber(selection.room, selection.date)?.id
  }

  function breakfastAllowanceFor(reservation?: Reservation): BreakfastAllowance {
    if (!reservation) return emptyAllowance()

    const today = todayIso()
    const total = reservationBreakfastTotal(reservation)
    const daily = reservationGuestCount(reservation)
    const usedQrTotal = qrSelections.filter(
      (selection) => selectionReservationId(selection) === reservation.id,
    ).length
    const usedPhysicalTotal = breakfasts.filter(
      (breakfast) => breakfast.reservationId === reservation.id,
    ).length
    const usedQrToday = qrSelections.filter(
      (selection) =>
        selectionReservationId(selection) === reservation.id && selection.date === today,
    ).length
    const usedPhysicalToday = breakfasts.filter(
      (breakfast) =>
        breakfast.reservationId === reservation.id && breakfast.date === today,
    ).length
    const usedTotal = usedQrTotal + usedPhysicalTotal
    const usedToday = usedQrToday + usedPhysicalToday
    const dateInStay = dateInBreakfastStay(reservation, today)

    return {
      guests: daily,
      nights: reservation.nights,
      total,
      daily,
      usedTotal,
      usedToday,
      availableTotal: Math.max(0, total - usedTotal),
      availableToday: dateInStay ? Math.max(0, daily - usedToday) : 0,
      dateInStay,
    }
  }

  const roomDirectory = useMemo<RoomQr[]>(() => {
    const occupiedRooms = roomQrSummaries.length
      ? roomQrSummaries.map((summary) => ({
          summary,
          room:
            rooms.find((room) => room.id === summary.roomId) ??
            rooms.find((room) => room.number === summary.roomNumber) ?? {
              id: summary.roomId,
              number: summary.roomNumber,
              floor: 1,
              typeId: "",
              status: "ocupada" as const,
              breakfastQrCode: summary.qrCode,
            },
        }))
      : rooms
          .filter((room) =>
            activeReservations.some(
              (reservation) =>
                reservation.roomId === room.id && reservation.status === "in-house",
            ),
          )
          .map((room) => ({ summary: undefined, room }))

    return occupiedRooms
      .sort((a, b) =>
        a.room.number.localeCompare(b.room.number, "es", { numeric: true }),
      )
      .map(({ room, summary }) => {
        const reservation =
          activeReservations.find(
            (item) => item.roomId === room.id && item.status === "in-house",
          ) ??
          activeReservations.find((item) => item.roomId === room.id)
        const guest = reservation ? getGuest(reservation.guestId) : undefined
        const qrCode =
          summary?.qrCode ??
          room.breakfastQrCode ??
          roomQrCode(room.number)
        const baseAllowance = breakfastAllowanceFor(reservation)
        const allowance = summary
          ? {
              ...baseAllowance,
              guests: summary.peopleCount,
              daily: summary.todayAllowed,
              usedToday: summary.todayUsed,
              availableToday: summary.todayAvailable,
              dateInStay: true,
            }
          : baseAllowance
        return {
          room,
          reservation,
          qrCode,
          qrUrl: summary?.qrUrl ?? breakfastQrUrl(qrCode),
          guestName: summary?.guestName ?? guest?.name ?? "Sin huésped asignado",
          allowance,
          pendingSelection: qrSelections.find(
            (selection) =>
              selection.room === room.number && selection.status === "recibido",
          ),
        }
      })
  }, [
    activeReservations,
    breakfasts,
    getGuest,
    qrSelections,
    roomQrSummaries,
    rooms,
  ])

  const selectedRoom =
    roomDirectory.find((item) => item.room.number === selectedRoomNumber) ??
    roomDirectory[0]
  const selectedPhysicalRoom =
    roomDirectory.find(
      (item) => item.room.number === physicalTicketForm.roomNumber && item.reservation,
    ) ?? roomDirectory.find((item) => item.reservation)
  const selectedRoomAllowance = selectedRoom?.allowance ?? emptyAllowance()
  const selectedPhysicalAllowance = selectedPhysicalRoom?.allowance ?? emptyAllowance()

  const filteredSelections = useMemo(() => {
    const text = query.trim().toLowerCase()
    return qrSelections.filter((selection) => {
      const matchesStatus = filter === "todos" || selection.status === filter
      const matchesText =
        !text ||
        [
          selection.room,
          selection.guestName,
          selection.qrCode,
          breakfastLabel(selection.type),
          selection.drink,
          selection.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text)

      return matchesStatus && matchesText
    })
  }, [filter, query, qrSelections])

  const received = qrSelections.filter(
    (selection) => selection.status === "recibido",
  )
  const redeemed = qrSelections.filter(
    (selection) => selection.status === "canjeado",
  )
  const occupiedQrRooms = roomDirectory.length
  const courtesyDailyTotal = roomDirectory.reduce(
    (sum, item) => sum + item.allowance.daily,
    0,
  )
  const courtesyDailyAvailable = roomDirectory.reduce(
    (sum, item) => sum + item.allowance.availableToday,
    0,
  )
  const physicalPending = breakfasts.filter((breakfast) => !breakfast.redeemed)
  const nextSelection = received[0]
  const typeSummary = breakfastOptions.map((option) => ({
    type: option.id,
    count: received.filter((selection) => selection.type === option.id).length,
  }))

  async function reloadTodaySelections() {
    const response = await api.breakfast.listTodaySelections<unknown>()
    setQrSelections(
      apiArray(response)
        .map((item) => mapBreakfastSelection(item, breakfastOptions))
        .filter((item): item is BreakfastSelection => Boolean(item)),
    )
  }

  async function canjearSelection(id: string) {
    const selection = qrSelections.find((item) => item.id === id)
    if (!selection || selection.status === "canjeado") return

    try {
      await api.breakfast.redeemSelection(id, { redeemed_by: "Recepción" })
      setQrSelections((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: "canjeado", redeemedAt: currentTime() }
            : item,
        ),
      )
      toast.success("Desayuno canjeado correctamente", {
        description: `Habitación ${selection.room} · ${breakfastLabel(selection.type)}`,
      })
    } catch (error) {
      toast.error("No se pudo canjear el desayuno", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function markSelectionReceived(id: string) {
    const selection = qrSelections.find((item) => item.id === id)
    if (!selection) return

    try {
      await api.breakfast.restoreSelection(id)
      setQrSelections((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: "recibido", redeemedAt: undefined }
            : item,
        ),
      )
      toast.info("Pedido devuelto a recibido", {
        description: `Habitación ${selection.room}`,
      })
    } catch (error) {
      toast.error("No se pudo restaurar el pedido", {
        description: getApiErrorMessage(error),
      })
    }
  }

  function openQrLink(room: RoomQr) {
    window.open(room.qrUrl, "_blank", "noopener,noreferrer")
    toast.success("Vista QR abierta", {
      description: `Habitación ${room.room.number}`,
    })
  }

  async function confirmSelection() {
    if (!selectedRoom || !selectedBreakfastType) return
    if (!selectedRoomAllowance.dateInStay) {
      toast.error("El desayuno no corresponde a la fecha de estadía", {
        description: "Cada huésped tiene desayuno por día de estadía.",
      })
      return
    }
    if (
      selectedRoomAllowance.availableToday <= 0
    ) {
      toast.error("Cupo de desayunos agotado", {
        description: `${selectedRoomAllowance.usedToday}/${selectedRoomAllowance.daily} usados hoy.`,
      })
      return
    }

    const optionId = Number(selectedBreakfastType)
    if (!Number.isFinite(optionId)) {
      toast.error("La opción de desayuno no tiene un identificador válido del servidor")
      return
    }

    try {
      await api.breakfast.createSelectionFromQr({
        qr_code: selectedRoom.qrCode,
        id_breakfast_option: optionId,
        beverage: guestForm.drink,
        guest_name: selectedRoom.guestName,
        notes: guestForm.notes.trim(),
      })
      await reloadTodaySelections()
      setGuestForm((current) => ({ ...current, notes: "" }))
      setActiveTab("pedidos")
      toast.success("Selección recibida desde QR", {
        description: `Habitación ${selectedRoom.room.number} · ${breakfastLabel(selectedBreakfastType)}`,
      })
    } catch (error) {
      toast.error("No se pudo registrar la selección", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function copyQrLink(room: RoomQr) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard no disponible")
      await navigator.clipboard.writeText(room.qrUrl)
      toast.success("Enlace del QR copiado", {
        description: `Habitación ${room.room.number}`,
      })
    } catch {
      toast.info("Código del QR", {
        description: room.qrCode,
      })
    }
  }

  function redeemPhysicalVoucher(id: string) {
    const voucher = breakfasts.find((breakfast) => breakfast.id === id)
    if (!voucher || voucher.redeemed) return
    dispatch({ type: "BREAKFAST_REDEEM", id })
    toast.success("Ticket físico canjeado", {
      description: `Habitación ${voucher.room} · ${breakfastLabel(voucher.type)}`,
    })
  }

  function createPhysicalVoucher() {
    if (!selectedPhysicalRoom || !selectedPhysicalBreakfastType) {
      toast.error("Selecciona una habitación activa y un desayuno disponible")
      return
    }
    if (!selectedPhysicalRoom.reservation) {
      toast.error("No hay reserva activa para esta habitación")
      return
    }
    if (!selectedPhysicalAllowance.dateInStay) {
      toast.error("El desayuno no corresponde a la fecha de estadía")
      return
    }
    if (
      selectedPhysicalAllowance.availableToday <= 0 ||
      selectedPhysicalAllowance.availableTotal <= 0
    ) {
      toast.error("Cupo de desayunos agotado", {
        description: `${selectedPhysicalAllowance.usedToday}/${selectedPhysicalAllowance.daily} usados hoy y ${selectedPhysicalAllowance.usedTotal}/${selectedPhysicalAllowance.total} de la estadía.`,
      })
      return
    }

    const notes = [
      `Bebida: ${physicalTicketForm.drink}`,
      physicalTicketForm.notes.trim(),
    ]
      .filter(Boolean)
      .join(" · ")

    dispatch({
      type: "BREAKFAST_CREATE",
      voucher: {
        id: `bf-manual-${Date.now()}`,
        reservationId: selectedPhysicalRoom.reservation.id,
        date: todayIso(),
        guestName:
          selectedPhysicalRoom.guestName === "Sin huésped asignado"
            ? `Habitación ${selectedPhysicalRoom.room.number}`
            : selectedPhysicalRoom.guestName,
        room: selectedPhysicalRoom.room.number,
        type: selectedPhysicalBreakfastType,
        redeemed: false,
        notes,
      },
    })
    setPhysicalTicketForm((current) => ({ ...current, notes: "" }))
    toast.success("Ticket físico asignado", {
      description: `Habitación ${selectedPhysicalRoom.room.number} · ${breakfastLabel(selectedPhysicalBreakfastType)}`,
    })
  }

  function breakfastOptionId(label: string) {
    return label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  function resetOptionForm() {
    setEditingOptionId(null)
    if (imageInputRef.current) imageInputRef.current.value = ""
    setOptionForm({
      label: "",
      description: "",
      imageUrl: "",
      accent: breakfastAccents[0],
    })
  }

  function uploadBreakfastImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : ""
      setOptionForm((current) => ({ ...current, imageUrl }))
      toast.success("Imagen cargada", { description: file.name })
    }
    reader.onerror = () => {
      toast.error("No se pudo cargar la imagen")
    }
    reader.readAsDataURL(file)
  }

  function saveBreakfastOption() {
    const label = optionForm.label.trim()
    const description = optionForm.description.trim()
    const imageUrl = optionForm.imageUrl.trim()
    if (!label || !description) {
      toast.error("Completa el nombre y la descripcion del desayuno")
      return
    }

    if (editingOptionId) {
      dispatch({
        type: "BREAKFAST_OPTION_UPDATE",
        id: editingOptionId,
        patch: { label, description, imageUrl, accent: optionForm.accent },
      })
      toast.success("Desayuno actualizado", { description: label })
      resetOptionForm()
      setPendingDialog(null)
      return
    }

    const baseId = breakfastOptionId(label) || `desayuno-${Date.now()}`
    const id = breakfastOptions.some((option) => option.id === baseId)
      ? `${baseId}-${Date.now()}`
      : baseId
    dispatch({
      type: "BREAKFAST_OPTION_CREATE",
      option: { id, label, description, imageUrl, accent: optionForm.accent },
    })
    toast.success("Desayuno agregado", { description: label })
    resetOptionForm()
  }

  function editBreakfastOption(option: BreakfastOption) {
    setEditingOptionId(option.id)
    setOptionForm({
      label: option.label,
      description: option.description,
      imageUrl: option.imageUrl ?? "",
      accent: option.accent,
    })
    setActiveTab("catalogo")
    window.setTimeout(() => {
      optionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)
  }

  function deleteBreakfastOption(option: BreakfastOption) {
    dispatch({ type: "BREAKFAST_OPTION_DELETE", id: option.id })
    if (editingOptionId === option.id) resetOptionForm()
    toast.info("Desayuno quitado del catalogo", { description: option.label })
    setPendingDialog(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Desayunos QR"
        description="Control simple para recibir elecciones desde el QR de cada habitación y cerrar cada desayuno cuando se canjea."
        actions={
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => setActiveTab("habitaciones")}
          >
            <QrCode className="size-3.5" />
            Ver QRs por habitación
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {dailyReportMetrics.map((metric, index) => (
          <BreakfastMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
            tone={index === 1 ? "success" : index === 2 ? "warning" : "info"}
          />
        ))}
        {!dailyReportMetrics.length ? (
          <div className="rounded-3xl border bg-card p-4 text-sm text-muted-foreground sm:col-span-3">
            Cargando reporte diario desde /api/breakfast/reports/daily.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guía rápida para desayunos QR</h2>
          <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
            Sigue estos pasos para que cada huésped reciba su desayuno.
          </p>
        </div>
        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            {
              icon: QrCode,
              title: "El QR está en el cuarto",
              text: "El huésped escanea el código que está en su habitación.",
            },
            {
              icon: Smartphone,
              title: "El huésped escoge",
              text: "Elige desayuno, bebida y escribe una nota si necesita algo.",
            },
            {
              icon: Utensils,
              title: "Recepción lo recibe",
              text: "El pedido aparece aquí con el número de habitación.",
            },
            {
              icon: TicketCheck,
              title: "Márcalo entregado",
              text: "Cuando ya se entregó, márcalo para que no se prepare dos veces.",
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

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <BreakfastMetric
          label="Recibidos por QR"
          value={qrSelections.length}
          helper="Elecciones enviadas por huéspedes"
          tone="info"
        />
        <BreakfastMetric
          label="Pendientes"
          value={received.length}
          helper="Faltan por entregar o validar"
          tone={received.length ? "warning" : "success"}
        />
        <BreakfastMetric
          label="Canjeados"
          value={redeemed.length}
          helper="Ya cerrados para el control diario"
          tone="success"
        />
        <BreakfastMetric
          label="Cupos hoy"
          value={`${courtesyDailyAvailable}/${courtesyDailyTotal}`}
          helper={`${occupiedQrRooms} habitaciones con reserva activa`}
          tone="default"
        />
      </section>

      {nextSelection ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">
                Siguiente pendiente: habitación {nextSelection.room}
              </h2>
              <p className="mt-1 text-sm text-amber-900/80">
                {nextSelection.guestName} pidió {breakfastLabel(nextSelection.type)} con{" "}
                {nextSelection.drink.toLowerCase()}
                {nextSelection.notes ? ` · ${nextSelection.notes}` : ""}.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => canjearSelection(nextSelection.id)}
            >
              <TicketCheck className="size-4" />
              Marcar canjeado
            </Button>
          </div>
        </section>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as BreakfastTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="pedidos">Pedidos QR</TabsTrigger>
          <TabsTrigger value="habitaciones">QR por habitación</TabsTrigger>
          <TabsTrigger value="vistaQr">Vista pública</TabsTrigger>
          <TabsTrigger value="catalogo">Desayunos disponibles</TabsTrigger>
          <TabsTrigger value="tickets">Tickets físicos</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_340px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Pedidos recibidos desde QR</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa habitación, huésped, elección y observaciones antes de canjear.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="rounded-2xl pl-9"
                    placeholder="Buscar habitación, huésped, desayuno..."
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  ["todos", "Todos"],
                  ["recibido", "Recibidos"],
                  ["canjeado", "Canjeados"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      filter === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:border-primary/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {filteredSelections.map((selection) => (
                  <article
                    key={selection.id}
                    className={cn(
                      "rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                      selection.status === "canjeado" && "bg-muted/20",
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <BedDouble className="size-6" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              Habitación {selection.room}
                            </p>
                            <h3 className="text-lg font-semibold">
                              {selection.guestName}
                            </h3>
                          </div>
                          <BreakfastStatusBadge status={selection.status} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div
                            className={cn(
                              "rounded-2xl border p-3",
                              breakfastAccent(selection.type),
                            )}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                              Desayuno
                            </p>
                            <p className="mt-1 font-bold">
                              {breakfastLabel(selection.type)}
                            </p>
                          </div>
                          <div className="rounded-2xl border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Bebida</p>
                            <p className="mt-1 font-semibold">{selection.drink}</p>
                          </div>
                          <div className="rounded-2xl border bg-muted/20 p-3">
                            <p className="text-xs text-muted-foreground">Recibido</p>
                            <p className="mt-1 font-semibold">
                              {selection.requestedAt}
                            </p>
                          </div>
                        </div>

                        {selection.notes ? (
                          <div className="mt-3 flex gap-2 rounded-2xl border bg-muted/20 p-3 text-sm">
                            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
                            <p>{selection.notes}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 xl:w-44">
                        <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                          <p className="text-xs text-muted-foreground">Código QR</p>
                          <p className="mt-1 font-semibold">{selection.qrCode}</p>
                          {selection.redeemedAt ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Canjeado {selection.redeemedAt}
                            </p>
                          ) : null}
                        </div>
                        {selection.status === "recibido" ? (
                          <Button
                            className="gap-2 rounded-full"
                            onClick={() => canjearSelection(selection.id)}
                          >
                            <TicketCheck className="size-4" />
                            Canjear
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="gap-2 rounded-full"
                            onClick={() => markSelectionReceived(selection.id)}
                          >
                            <Clock3 className="size-4" />
                            Volver a recibido
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                {filteredSelections.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-10 text-center">
                    <p className="font-semibold">No hay pedidos con ese filtro</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cuando un huésped confirme desde el QR de su habitación, aparecerá aquí.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Utensils className="size-5 text-primary" />
                  <h3 className="font-semibold">Pendientes por tipo</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {typeSummary.map(({ type, count }) => (
                    <div key={type}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{breakfastLabel(type)}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${received.length ? (count / received.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-primary" />
                  <h3 className="font-semibold">Control rápido</h3>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sin canjear</p>
                    <p className="mt-1 text-xl font-bold">{received.length}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Tickets físicos abiertos</p>
                    <p className="mt-1 text-xl font-bold">{physicalPending.length}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-full"
                    onClick={() => setActiveTab("habitaciones")}
                  >
                    <QrCode className="size-4" />
                    Ver QRs reales
                  </Button>
                </div>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="habitaciones" className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">QR único por habitación</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada tarjeta representa el QR fijo que vive en la habitación.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {roomDirectory.length} habitaciones ocupadas
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roomDirectory.map((item) => (
                <article
                  key={item.room.id}
                  className={cn(
                    "rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    item.pendingSelection && "border-amber-200 bg-amber-50/40",
                  )}
                >
                  <div className="flex gap-4">
                    <MiniQr code={item.qrCode} value={item.qrUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold">
                          Habitación {item.room.number}
                        </h3>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold",
                            item.allowance.availableToday <= 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : item.allowance.usedToday > 0
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-50 text-slate-700",
                          )}
                        >
                          {item.allowance.usedToday}/{item.allowance.daily} canjeados
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.guestName}
                      </p>
                      <p className="mt-3 rounded-2xl border bg-muted/20 px-3 py-2 text-xs font-semibold">
                        {item.qrCode}
                      </p>
                      {item.reservation ? (
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Hoy faltan {item.allowance.availableToday} de {item.allowance.daily} personas
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Hoy faltan {item.allowance.availableToday} de {item.allowance.daily} personas
                        </p>
                      )}
                      <BreakfastPersonStatus item={item} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={() => copyQrLink(item)}
                    >
                      <Copy className="size-4" />
                      Copiar QR
                    </Button>
                    <Button
                      className="gap-2 rounded-full"
                      onClick={() => openQrLink(item)}
                    >
                      <ExternalLink className="size-4" />
                      Abrir QR
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="vistaQr" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[360px_1fr]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Elegir habitación</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                En operación real, esto viene directo del QR escaneado.
              </p>
              <div className="mt-4 grid gap-2">
                {roomDirectory
                  .filter((item) => item.reservation)
                  .slice(0, 8)
                  .map((item) => (
                    <button
                      key={item.room.id}
                      type="button"
                      onClick={() => setSelectedRoomNumber(item.room.number)}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5",
                        selectedRoomNumber === item.room.number &&
                          "border-primary bg-primary/10",
                      )}
                    >
                      <p className="font-semibold">Habitación {item.room.number}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {item.guestName}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            <div className="rounded-[2rem] border bg-[#fffaf2] p-4 shadow-sm">
              <div className="mx-auto max-w-sm rounded-[2rem] border bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Coffee className="size-6" />
                    </div>
                    <div>
                      <p className="font-serif text-2xl">Casa Luna</p>
                      <p className="text-xs text-muted-foreground">
                        Desayuno de cortesía
                      </p>
                    </div>
                  </div>
                  {selectedRoom ? <MiniQr code={selectedRoom.qrCode} value={selectedRoom.qrUrl} /> : null}
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Habitación</p>
                    <p className="mt-1 text-xl font-bold">
                      {selectedRoom ? selectedRoom.room.number : "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRoom?.guestName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border bg-emerald-50 p-3 text-emerald-950">
                      <p className="text-xs opacity-70">Disponibles hoy</p>
                      <p className="mt-1 text-lg font-bold">
                        {selectedRoomAllowance.availableToday}/{selectedRoomAllowance.daily}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-blue-50 p-3 text-blue-950">
                      <p className="text-xs opacity-70">Estadia total</p>
                      <p className="mt-1 text-lg font-bold">
                        {selectedRoomAllowance.usedTotal}/{selectedRoomAllowance.total}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {breakfastOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setGuestForm((current) => ({ ...current, type: option.id }))
                        }
                        className={cn(
                          "rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                          selectedBreakfastType === option.id
                            ? option.accent
                            : "bg-background hover:border-primary/40",
                        )}
                      >
                        <BreakfastOptionPhoto option={option} className="h-24" />
                        <p className="mt-3 font-semibold">{option.label}</p>
                        <p className="mt-1 text-xs opacity-75">
                          {option.description}
                        </p>
                      </button>
                    ))}
                    {breakfastOptions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Recepción debe agregar desayunos disponibles antes de usar el QR.
                      </div>
                    ) : null}
                  </div>

                  <label className="space-y-2 text-sm font-medium">
                    Bebida
                    <select
                      value={guestForm.drink}
                      onChange={(event) =>
                        setGuestForm((current) => ({
                          ...current,
                          drink: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {drinkOptions.map((drink) => (
                        <option key={drink} value={drink}>
                          {drink}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Textarea
                    value={guestForm.notes}
                    onChange={(event) =>
                      setGuestForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="min-h-24 rounded-2xl"
                    placeholder="Observaciones: sin cebolla, sin azúcar, entregar después de las 8:30..."
                  />

                  <Button
                    className="h-11 gap-2 rounded-full"
                    onClick={confirmSelection}
                    disabled={
                      !selectedBreakfastType ||
                      !selectedRoom?.reservation ||
                      selectedRoomAllowance.availableToday <= 0 ||
                      selectedRoomAllowance.availableTotal <= 0
                    }
                  >
                    <BadgeCheck className="size-4" />
                    Confirmar desayuno
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[380px_1fr]">
            <div ref={optionFormRef} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                {editingOptionId ? (
                  <Pencil className="size-5 text-primary" />
                ) : (
                  <Plus className="size-5 text-primary" />
                )}
                <h2 className="text-xl font-semibold">
                  {editingOptionId ? "Editar desayuno" : "Agregar desayuno"}
                </h2>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="space-y-2 text-sm font-medium">
                  Nombre
                  <Input
                    value={optionForm.label}
                    onChange={(event) =>
                      setOptionForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="Ej. Chapín"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Descripción
                  <Textarea
                    value={optionForm.description}
                    onChange={(event) =>
                      setOptionForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-24 rounded-2xl"
                    placeholder="Describe qué incluye este desayuno."
                  />
                </label>

                <div className="space-y-2 text-sm font-medium">
                  Foto del platillo
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => uploadBreakfastImage(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-4 py-5 text-center transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    {optionForm.imageUrl ? (
                      <img
                        src={optionForm.imageUrl}
                        alt="Vista previa del desayuno"
                        className="h-28 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <>
                        <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                          <ImagePlus className="size-5" />
                        </span>
                        <span className="text-sm font-semibold">Seleccionar imagen</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Se abrirá el explorador de archivos del equipo.
                        </span>
                      </>
                    )}
                  </button>
                  {optionForm.imageUrl ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        Cambiar imagen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          if (imageInputRef.current) imageInputRef.current.value = ""
                          setOptionForm((current) => ({ ...current, imageUrl: "" }))
                        }}
                      >
                        Quitar imagen
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Color</p>
                  <div className="grid grid-cols-3 gap-2">
                    {breakfastAccents.map((accent, index) => (
                      <button
                        key={accent}
                        type="button"
                        onClick={() =>
                          setOptionForm((current) => ({ ...current, accent }))
                        }
                        className={cn(
                          "h-10 rounded-2xl border text-xs font-semibold",
                          accent,
                          optionForm.accent === accent && "ring-2 ring-primary",
                        )}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2 rounded-full"
                    onClick={() => {
                      if (!editingOptionId) {
                        saveBreakfastOption()
                        return
                      }
                      setPendingDialog({
                        title: "Guardar cambios del desayuno",
                        description: "Confirma que quieres actualizar esta opción disponible para huéspedes y tickets físicos.",
                        confirmLabel: "Sí, guardar",
                        onConfirm: saveBreakfastOption,
                      })
                    }}
                  >
                    <Save className="size-4" />
                    {editingOptionId ? "Guardar cambios" : "Agregar"}
                  </Button>
                  {editingOptionId ? (
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={resetOptionForm}
                    >
                      <X className="size-4" />
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Catálogo disponible</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Estas opciones son las que verá el huésped al escanear el QR.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {breakfastOptions.length} opciones
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {breakfastOptions.map((option) => (
                  <article
                    key={option.id}
                    className={cn("rounded-3xl border p-4", option.accent)}
                  >
                    <BreakfastOptionPhoto option={option} className="mb-3" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Desayuno
                        </p>
                        <h3 className="mt-1 text-lg font-bold">{option.label}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-full bg-background/70"
                          onClick={() => editBreakfastOption(option)}
                          title="Editar desayuno"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-full bg-background/70"
                          onClick={() =>
                            setPendingDialog({
                              title: `Quitar ${option.label}`,
                              description: "Esta opción dejará de aparecer para nuevos pedidos. Los pedidos o tickets anteriores conservarán su referencia histórica.",
                              confirmLabel: "Sí, quitar",
                              tone: "danger",
                              onConfirm: () => deleteBreakfastOption(option),
                            })
                          }
                          title="Quitar desayuno"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 opacity-80">
                      {option.description}
                    </p>
                  </article>
                ))}

                {breakfastOptions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-10 text-center md:col-span-2">
                    <p className="font-semibold">Aún no hay desayunos disponibles</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Agrega al menos una opción para habilitar la elección desde QR.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold">Tickets físicos del día</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para huéspedes que pidan apoyo en recepción o no usen el QR.
              </p>
            </div>

            <div className="mt-5 grid gap-4 2xl:grid-cols-[380px_1fr]">
              <div className="rounded-3xl border bg-background p-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-primary" />
                  <h3 className="font-semibold">Asignar desde recepción</h3>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="space-y-2 text-sm font-medium">
                    Habitación o huésped
                    <select
                      value={selectedPhysicalRoom?.room.number ?? physicalTicketForm.roomNumber}
                      onChange={(event) =>
                        setPhysicalTicketForm((current) => ({
                          ...current,
                          roomNumber: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {roomDirectory
                        .filter((item) => item.reservation)
                        .map((item) => (
                          <option key={item.room.id} value={item.room.number}>
                            Habitación {item.room.number} · {item.guestName}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium">
                    Desayuno
                    <select
                      value={selectedPhysicalBreakfastType}
                      onChange={(event) =>
                        setPhysicalTicketForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {breakfastOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Cupo de cortesía</p>
                    <p className="mt-1 font-semibold">
                      Hoy {selectedPhysicalAllowance.availableToday}/{selectedPhysicalAllowance.daily} - Estadia {selectedPhysicalAllowance.usedTotal}/{selectedPhysicalAllowance.total}
                    </p>
                  </div>

                  <label className="space-y-2 text-sm font-medium">
                    Bebida
                    <select
                      value={physicalTicketForm.drink}
                      onChange={(event) =>
                        setPhysicalTicketForm((current) => ({
                          ...current,
                          drink: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {drinkOptions.map((drink) => (
                        <option key={drink} value={drink}>
                          {drink}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Textarea
                    value={physicalTicketForm.notes}
                    onChange={(event) =>
                      setPhysicalTicketForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="min-h-24 rounded-2xl"
                    placeholder="Observaciones del huésped o recepción."
                  />

                  <Button
                    className="gap-2 rounded-full"
                    onClick={createPhysicalVoucher}
                    disabled={
                      !selectedPhysicalRoom ||
                      !selectedPhysicalBreakfastType ||
                      selectedPhysicalAllowance.availableToday <= 0 ||
                      selectedPhysicalAllowance.availableTotal <= 0
                    }
                  >
                    <Plus className="size-4" />
                    Crear ticket físico
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {breakfasts.map((breakfast) => (
                <article
                  key={breakfast.id}
                  className={cn(
                    "rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    breakfast.redeemed && "bg-muted/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Habitación {breakfast.room}
                      </p>
                      <h3 className="mt-1 font-semibold">{breakfast.guestName}</h3>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                        breakfast.redeemed
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-amber-200 bg-amber-50 text-amber-900",
                      )}
                    >
                      {breakfast.redeemed ? "Consumido" : "Pendiente"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div
                      className={cn(
                        "rounded-2xl border p-3",
                        breakfastAccent(breakfast.type),
                      )}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Desayuno
                      </p>
                      <p className="mt-1 font-bold">
                        {breakfastLabel(breakfast.type)}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="mt-1 font-semibold">{formatDate(breakfast.date)}</p>
                      {breakfast.redeemedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Canjeado {breakfast.redeemedAt}
                        </p>
                      ) : null}
                    </div>
                    {breakfast.notes ? (
                      <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Detalle</p>
                        <p className="mt-1">{breakfast.notes}</p>
                      </div>
                    ) : null}
                  </div>

                  <Button
                    className="mt-4 w-full gap-2 rounded-full"
                    variant={breakfast.redeemed ? "outline" : "default"}
                    disabled={breakfast.redeemed}
                    onClick={() => redeemPhysicalVoucher(breakfast.id)}
                  >
                    <TicketCheck className="size-4" />
                    {breakfast.redeemed ? "Ya canjeado" : "Canjear ticket"}
                  </Button>
                </article>
                ))}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="backend" className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Endpoints para Desayunos QR</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrato para QR fijo por habitación, selección del huésped, canje y control de tickets físicos.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {[
                ["GET", "/api/breakfast/options", "Catálogo editable de desayunos disponibles con id, nombre, descripción, color/acento, estado activo y orden visible para el QR."],
                ["POST", "/api/breakfast/options", "Crear un desayuno disponible para que aparezca en la vista del huésped y en tickets físicos."],
                ["PATCH", "/api/breakfast/options/{id}", "Editar nombre, descripción, color/acento, orden o estado activo/inactivo de una opción de desayuno."],
                ["DELETE", "/api/breakfast/options/{id}", "Quitar o desactivar un desayuno del catálogo sin romper pedidos o tickets históricos que ya lo usaron."],
                ["GET", "/api/breakfast/rooms/qr-codes", "Listado de habitaciones con QR único, URL pública, reserva activa y pedido pendiente si existe."],
                ["GET", "/api/breakfast/selections/today", "Pedidos QR del día con habitación, huésped, desayuno, bebida, notas y estado recibido/canjeado."],
                ["POST", "/api/breakfast/selections/from-qr", "Crear selección desde el QR público validando que breakfastOptionId exista y esté activo, sin exponer datos internos."],
                ["PATCH", "/api/breakfast/selections/{id}/redeem", "Marcar pedido QR como canjeado y guardar hora/usuario que lo validó."],
                ["PATCH", "/api/breakfast/selections/{id}/restore", "Devolver un pedido canjeado a recibido cuando se marcó por error."],
                ["GET", "/api/breakfast/vouchers/today", "Tickets físicos del día para huéspedes que no usen el QR."],
                ["POST", "/api/breakfast/vouchers", "Crear ticket físico desde recepción usando reserva/habitación, huésped, fecha, breakfastOptionId, bebida y notas."],
                ["PATCH", "/api/breakfast/vouchers/{id}/redeem", "Canjear ticket físico y guardar hora."],
                ["GET", "/api/breakfast/reports/daily", "Resumen diario por tipo de desayuno, habitación y estado para cocina/gerencia."],
              ].map(([method, endpoint, description]) => (
                <div key={endpoint} className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                      {method}
                    </span>
                    <code className="text-sm font-semibold">{endpoint}</code>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(pendingDialog)}
        onOpenChange={(open) => {
          if (!open) setPendingDialog(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingDialog?.tone === "danger"
                  ? "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "rounded-full"
              }
              onClick={pendingDialog?.onConfirm}
            >
              {pendingDialog?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default DesayunosPage
