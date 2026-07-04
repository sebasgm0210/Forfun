import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CircleDollarSign,
  Clock3,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  PartyPopper,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  Save,
  Trash2,
  Users,
  Wallet,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  INVOICE_BILLING_MODES,
  INVOICE_FORMATS,
  INVOICE_ITEM_TYPES,
  INVOICE_SOURCE_MODULES,
  api,
  getApiErrorMessage,
  type InvoiceFormat,
  type InvoiceItemType,
  type IssueInvoiceModel,
} from "@/lib/api"
import { printSimpleReceipt } from "@/lib/simple-receipt"
import { formatDate, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type {
  CreditAccount,
  EventSalon,
  EventStatus,
  Guest,
  HotelEvent,
  PaymentMethod,
  PaymentRecord,
} from "@/lib/types"

type EventTab = "agenda" | "nuevo" | "salones" | "resumen" | "backend"
type EventFilter = "todos" | "con-saldo" | EventStatus

type EventForm = {
  guestId: string
  title: string
  client: string
  contact: string
  salonId: string
  date: string
  startTime: string
  endTime: string
  guests: number
  type: HotelEvent["type"]
  clientKind: NonNullable<HotelEvent["clientKind"]>
  breakfastCount: number
  snackCount: number
  lunchCount: number
  services: string
  total: number
  paid: number
  paymentMethod: PaymentMethod
}

type SalonForm = {
  name: string
  capacity: number
  kind: EventSalon["kind"]
  description: string
  freeForGuests: boolean
}

type PendingDialog = {
  title: string
  description: string
  confirmLabel: string
  tone: "default" | "danger"
  onConfirm: () => void
} | null

type EventInvoiceConcept = {
  id: number
  name: string
  itemType: InvoiceItemType
}

type EventInvoiceForm = {
  useCustomerTaxInfo: boolean
  taxId: string
  name: string
  address: string
  format: InvoiceFormat
  conceptId: string
  itemType: InvoiceItemType
  description: string
  notes: string
  selectedPaymentIds: string[]
}

const emptyForm: EventForm = {
  guestId: "",
  title: "",
  client: "",
  contact: "",
  salonId: "salon-principal",
  date: new Date().toISOString().slice(0, 10),
  startTime: "08:00",
  endTime: "12:00",
  guests: 20,
  type: "alquiler",
  clientKind: "externo",
  breakfastCount: 0,
  snackCount: 0,
  lunchCount: 0,
  services: "",
  total: 0,
  paid: 0,
  paymentMethod: "efectivo",
}

const eventPaymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "deposito", label: "Deposito bancario" },
  { value: "credito", label: "Credito" },
]

function apiRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function apiString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function invoiceNitInfo(response: unknown) {
  const root = apiRecord(response)
  const data = Object.keys(apiRecord(root.data)).length ? apiRecord(root.data) : root
  return {
    name: apiString(data, [
      "name",
      "nombre",
      "taxpayer_name",
      "taxpayerName",
      "business_name",
      "businessName",
      "nombre_receptor",
      "nombreReceptor",
    ]),
    address: apiString(data, ["address", "direccion", "tax_address", "taxAddress"]),
  }
}

const emptySalonForm: SalonForm = {
  name: "",
  capacity: 35,
  kind: "salon",
  description: "",
  freeForGuests: false,
}

const statusLabels: Record<EventStatus, string> = {
  reservado: "Reservado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
}

const statusStyles: Record<EventStatus, string> = {
  reservado: "border-amber-200 bg-amber-50 text-amber-900",
  confirmado: "border-emerald-200 bg-emerald-50 text-emerald-900",
  realizado: "border-zinc-300 bg-zinc-100 text-zinc-800",
  cancelado: "border-red-200 bg-red-50 text-red-900",
}

const typeLabels: Record<HotelEvent["type"], string> = {
  alquiler: "Alquiler de salón",
  consumo: "Por consumo",
  coworking: "Coworking",
}

const typeStyles: Record<HotelEvent["type"], string> = {
  alquiler: "border-blue-200 bg-blue-50 text-blue-950",
  consumo: "border-emerald-200 bg-emerald-50 text-emerald-950",
  coworking: "border-amber-200 bg-amber-50 text-amber-950",
}

const SALON_MAX_CAPACITY = 35
const SALON_RENTAL_PRICE = 500
const SALON_RENTAL_HOURS = 4
const REQUIRED_DEPOSIT_RATE = 0.5
const MIN_CONSUMPTION_GUESTS = 10

const menuItems = [
  { key: "breakfastCount", label: "Desayunos", price: 60 },
  { key: "snackCount", label: "Refacciones", price: 50 },
  { key: "lunchCount", label: "Almuerzos", price: 85 },
] as const

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function creditAccountAvailable(account: CreditAccount) {
  return Math.max(0, Number(account.limit || 0) - Number(account.balance || 0))
}

function creditDisabledReason(account: CreditAccount) {
  if (account.creditStatus === "bloqueado") return "Credito bloqueado"
  if (account.creditStatus === "pausado") return "Credito pausado"
  if (account.status === "vencido") return "Credito vencido"
  if (account.dueDate && account.dueDate < new Date().toISOString().slice(0, 10)) {
    return "Credito vencido"
  }
  if (creditAccountAvailable(account) <= 0) return "Sin credito disponible"
  return undefined
}

function creditCanBeUsed(account?: CreditAccount) {
  return Boolean(account && !creditDisabledReason(account) && creditAccountAvailable(account) > 0)
}

function paymentMethodOptionsForCredit(
  account: CreditAccount | undefined,
  currentMethod?: PaymentMethod,
) {
  const canUseCredit = creditCanBeUsed(account)
  return eventPaymentMethods.filter(
    (method) =>
      method.value !== "credito" ||
      canUseCredit ||
      currentMethod === "credito",
  )
}

function guestSearchText(guest: Guest) {
  return [
    guest.name,
    guest.document,
    guest.nit,
    guest.phone,
    guest.email,
    guest.country,
    guest.department,
  ]
    .filter(Boolean)
    .join(" ")
}

function timeToMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":")
  return Number(hours) * 60 + Number(minutes)
}

function dateToDayIndex(iso: string) {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function intervalFor(date: string, startTime: string, endTime: string) {
  const dayStart = dateToDayIndex(date) * 1440
  const start = dayStart + timeToMinutes(startTime)
  let end = dayStart + timeToMinutes(endTime)
  if (end <= start) end += 1440
  return { start, end }
}

function intervalsOverlap(
  aDate: string,
  aStart: string,
  aEnd: string,
  bDate: string,
  bStart: string,
  bEnd: string,
) {
  const a = intervalFor(aDate, aStart, aEnd)
  const b = intervalFor(bDate, bStart, bEnd)
  return a.start < b.end && b.start < a.end
}

function timeRangeLabel(startTime: string, endTime: string) {
  const crossesMidnight = timeToMinutes(endTime) <= timeToMinutes(startTime)
  return `${startTime} - ${endTime}${crossesMidnight ? " (dia siguiente)" : ""}`
}

function menuTotal(form: EventForm) {
  return menuItems.reduce((sum, item) => sum + form[item.key] * item.price, 0)
}

function menuQuantity(form: EventForm) {
  return menuItems.reduce((sum, item) => sum + form[item.key], 0)
}

function menuSummary(form: EventForm) {
  const items = menuItems
    .filter((item) => form[item.key] > 0)
    .map((item) => `${item.label} x ${form[item.key]}`)

  return items.length ? items.join(" · ") : "Sin platillos seleccionados"
}

function eventDurationMinutes(startTime: string, endTime: string) {
  return timeToMinutes(endTime) - timeToMinutes(startTime)
}

function salonTone(salon?: EventSalon) {
  return salon?.kind === "coworking"
    ? "border-amber-200 bg-amber-50/70"
    : "border-blue-200 bg-blue-50/70"
}

type ApiRecord = Record<string, unknown>

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pickApiString(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return ""
}

function pickApiId(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" || typeof value === "string") return String(value)
  }
  return null
}

function apiArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isApiRecord(value) && Array.isArray(value.data)) return value.data
  return []
}

function findApiId(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = findApiId(item, keys, depth + 1)
      if (id) return id
    }
    return null
  }

  if (!isApiRecord(value)) return null

  const direct = pickApiId(value, keys)
  if (direct) return direct

  for (const nested of Object.values(value)) {
    const id = findApiId(nested, keys, depth + 1)
    if (id) return id
  }

  return null
}

function findSalonIdByName(value: unknown, name: string) {
  const expected = normalizeSearchText(name)

  for (const item of apiArray(value)) {
    if (!isApiRecord(item)) continue
    const itemName = normalizeSearchText(pickApiString(item, ["name", "salon_name", "salon"]))
    if (itemName === expected) return pickApiId(item, ["id_event_salon", "id"])
  }

  return null
}

function numericBackendId(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return null
  return Number(value)
}

function paymentIsInvoiced(payment: PaymentRecord) {
  return (
    Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
    (Number.isFinite(payment.invoicedAmount) &&
      Number(payment.invoicedAmount) > 0.01) ||
    (Number.isFinite(payment.pendingToInvoiceAmount) &&
      Number(payment.pendingToInvoiceAmount) <= 0.01)
  )
}

function eventInvoiceablePayments(event: HotelEvent) {
  return (event.payments ?? []).filter(
    (payment) =>
      Number(payment.amount || 0) > 0 &&
      numericBackendId(payment.id) !== null &&
      !paymentIsInvoiced(payment),
  )
}

function eventSelectedPayments(event: HotelEvent, selectedIds: string[]) {
  const selected = new Set(selectedIds)
  return eventInvoiceablePayments(event).filter((payment) => selected.has(payment.id))
}

function paymentListTotal(payments: PaymentRecord[]) {
  return Math.round(
    payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) * 100,
  ) / 100
}

function mapEventInvoiceConcept(value: unknown): EventInvoiceConcept | null {
  if (!isApiRecord(value)) return null
  const id = Number(pickApiId(value, ["id_invoice_concept", "id"]))
  if (!Number.isFinite(id) || id <= 0) return null
  const itemType = pickApiString(value, ["item_type", "itemType"])

  return {
    id,
    name: pickApiString(value, ["name"]) || `Concepto ${id}`,
    itemType:
      itemType === INVOICE_ITEM_TYPES.BIEN
        ? INVOICE_ITEM_TYPES.BIEN
        : INVOICE_ITEM_TYPES.SERVICIO,
  }
}

function backendEventTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function backendEventDate(value: string) {
  return value.length === 10 ? `${value}T00:00:00` : value
}

function eventApiPayload(
  event: HotelEvent,
  salonId: number,
  paymentMethod: PaymentMethod = "efectivo",
) {
  return {
    id_event_salon: salonId,
    event_name: event.title,
    event_type: event.type,
    client_name: event.client,
    contact_phone: event.contact,
    people_count: event.guests,
    event_date: backendEventDate(event.date),
    start_time: backendEventTime(event.startTime),
    end_time: backendEventTime(event.endTime),
    services_notes: event.notes,
    quoted_total: event.total,
    meal_unit_cost: event.type === "consumo" && event.guests > 0 ? event.total / event.guests : undefined,
    calculate_total_by_consumption: event.type === "consumo",
    advance_amount: event.paid,
    payment_method: event.paid > 0 ? paymentMethod : undefined,
    payment_reference: event.paid > 0 ? `Anticipo ${event.title}` : undefined,
    confirm_event: event.status === "confirmado",
  }
}

type EventSalonPayload = {
  name: string
  description: string
  capacity: number
  base_price: number
}

async function createEventSalonFromModal(payload: EventSalonPayload) {
  return api.eventSalons.create(payload)
}

function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(iso)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function eventBalance(event: HotelEvent) {
  return Math.max(0, event.total - event.paid)
}

function eventPaidPercent(event: HotelEvent) {
  return event.total > 0
    ? Math.min(100, Math.round((event.paid / event.total) * 100))
    : 0
}

function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusStyles[status],
      )}
    >
      {status === "reservado" ? <Clock3 className="size-3.5" /> : null}
      {status === "confirmado" ? <BadgeCheck className="size-3.5" /> : null}
      {status === "realizado" ? <CheckCircle2 className="size-3.5" /> : null}
      {status === "cancelado" ? <Ban className="size-3.5" /> : null}
      {statusLabels[status]}
    </span>
  )
}

function EventMetric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string
  value: string | number
  helper: string
  tone?: "default" | "warning" | "success" | "danger" | "info"
}) {
  const tones = {
    default: "border-border bg-card",
    warning: "border-amber-200 bg-amber-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    danger: "border-red-200 bg-red-50/80",
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

function MoneyField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
        Q.
      </span>
      <Input
        type="number"
        min={0}
        value={value || ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? 0 : Number(event.target.value))
        }
        className="rounded-2xl pl-10"
        placeholder={placeholder ?? "0.00"}
      />
    </div>
  )
}

function GuestCombobox({
  guests,
  value,
  onChange,
}: {
  guests: Guest[]
  value: string
  onChange: (guestId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedGuest = guests.find((guest) => guest.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between gap-3 rounded-2xl bg-background px-3 py-2 text-left font-normal"
        >
          {selectedGuest ? (
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-semibold">{selectedGuest.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {selectedGuest.document || "Sin documento"} - NIT {selectedGuest.nit || "Pendiente"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Buscar o seleccionar cliente</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command
          filter={(value, search) =>
            normalizeSearchText(value).includes(normalizeSearchText(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar por nombre, DPI, NIT, telefono..." />
          <CommandList className="max-h-[380px]">
            <CommandEmpty>No hay clientes con esa busqueda.</CommandEmpty>
            <CommandGroup>
              {selectedGuest ? (
                <CommandItem
                  value="limpiar seleccion cliente"
                  onSelect={() => {
                    onChange("")
                    setOpen(false)
                  }}
                >
                  Limpiar seleccion
                </CommandItem>
              ) : null}
              {guests.map((guest) => (
                <CommandItem
                  key={guest.id}
                  value={guestSearchText(guest)}
                  className="items-start gap-3 py-3"
                  onSelect={() => {
                    onChange(guest.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mt-1 size-4",
                      value === guest.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{guest.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {guest.document || "Sin documento"} - {guest.phone || "Sin telefono"} - NIT {guest.nit || "Pendiente"}
                    </p>
                    {guest.email ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {guest.email}
                      </p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function EventosPage() {
  const {
    events,
    salons: eventSalons,
    guests,
    creditAccounts,
    dispatch,
    refreshApiState,
  } = useStore()
  const [activeTab, setActiveTab] = useState<EventTab>("agenda")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<EventFilter>("todos")
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [salonForm, setSalonForm] = useState<SalonForm>(emptySalonForm)
  const [editingSalonId, setEditingSalonId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [savingSalon, setSavingSalon] = useState(false)
  const [advanceByEvent, setAdvanceByEvent] = useState<Record<string, number>>({})
  const [advanceMethodByEvent, setAdvanceMethodByEvent] = useState<Record<string, PaymentMethod>>({})
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null)
  const [invoiceEventTarget, setInvoiceEventTarget] = useState<HotelEvent | null>(null)
  const [eventInvoiceForm, setEventInvoiceForm] = useState<EventInvoiceForm | null>(null)
  const [eventInvoiceConcepts, setEventInvoiceConcepts] = useState<EventInvoiceConcept[]>([])
  const [eventInvoiceRemaining, setEventInvoiceRemaining] = useState<number | null>(null)
  const [eventInvoiceLoading, setEventInvoiceLoading] = useState(false)
  const [eventInvoiceSubmitting, setEventInvoiceSubmitting] = useState(false)
  const [salonAvailabilityMessage, setSalonAvailabilityMessage] = useState("Sin consultar")
  const salonFormRef = useRef<HTMLDivElement>(null)
  const bookableSalons = eventSalons.filter((salon) => salon.kind === "salon")
  const guestOptions = useMemo(
    () =>
      [...guests].sort((a, b) =>
        normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name)),
      ),
    [guests],
  )
  const selectedGuest = form.guestId
    ? guestOptions.find((guest) => guest.id === form.guestId)
    : undefined
  const selectedCreditAccount = creditAccountForClient(
    form.guestId,
    form.client,
  )
  const selectedCreditAvailable = selectedCreditAccount
    ? creditAccountAvailable(selectedCreditAccount)
    : 0
  const selectedCreditDisabledReason = selectedCreditAccount
    ? creditDisabledReason(selectedCreditAccount)
    : undefined

  const selectedSalon =
    bookableSalons.find((salon) => salon.id === form.salonId) ?? bookableSalons[0]
  const selectedSalonId = selectedSalon?.id ?? form.salonId
  const eventTitle = form.title.trim() || `${typeLabels[form.type]} - ${form.client.trim()}`

  useEffect(() => {
    const salonId = numericBackendId(form.salonId)
    if (!salonId) {
      setSalonAvailabilityMessage("Selecciona salon backend para consultar disponibilidad")
      return
    }

    let cancelled = false
    api.events.getSalonAvailability<unknown>({
      id_event_salon: salonId,
      event_date: form.date,
      start_time: form.startTime,
      end_time: form.endTime,
    })
      .then((response) => {
        if (cancelled) return
        const record = apiRecord(response)
        const data = Object.keys(apiRecord(record.data)).length ? apiRecord(record.data) : record
        const available = data.available ?? data.is_available ?? data.isAvailable
        setSalonAvailabilityMessage(
          typeof available === "boolean"
            ? available ? "Disponible segun backend" : "No disponible segun backend"
            : "Disponibilidad consultada en backend",
        )
      })
      .catch((error) => {
        if (cancelled) return
        setSalonAvailabilityMessage(`Error: ${getApiErrorMessage(error)}`)
      })

    return () => {
      cancelled = true
    }
  }, [form.date, form.endTime, form.salonId, form.startTime])

  function eventSalonId(event: HotelEvent) {
    if (event.salonId) return event.salonId
    return (
      eventSalons.find((salon) => salon.name === event.salon)?.id ??
      eventSalons.find((salon) =>
        event.salon.toLowerCase().includes(salon.kind === "coworking" ? "cowork" : "salon"),
      )?.id ??
      event.salon
    )
  }

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
      ),
    [events],
  )
  const visibleEvents = useMemo(() => {
    const text = query.trim().toLowerCase()

    return sortedEvents.filter((event) => {
      const matchesFilter =
        filter === "todos" ||
        (filter === "con-saldo" &&
          eventBalance(event) > 0 &&
          event.status !== "cancelado") ||
        event.status === filter
      const matchesText =
        !text ||
        [
          event.title,
          event.client,
          event.contact,
          event.salon,
          typeLabels[event.type],
          event.notes ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(text)

      return matchesFilter && matchesText
    })
  }, [filter, query, sortedEvents])

  const totalSold = events
    .filter((event) => event.status !== "cancelado")
    .reduce((sum, event) => sum + event.total, 0)
  const totalPaid = events
    .filter((event) => event.status !== "cancelado")
    .reduce((sum, event) => sum + event.paid, 0)
  const totalBalance = Math.max(0, totalSold - totalPaid)
  const activeEvents = events.filter(
    (event) => !["cancelado", "realizado"].includes(event.status),
  )
  const confirmedEvents = events.filter((event) => event.status === "confirmado")
  const tentativeEvents = events.filter((event) => event.status === "reservado")
  const eventsWithBalance = activeEvents.filter((event) => eventBalance(event) > 0)
  const nextEvent = sortedEvents.find(
    (event) => !["cancelado", "realizado"].includes(event.status),
  )
  const effectiveSalonCapacity = selectedSalon
    ? Math.min(selectedSalon.capacity, SALON_MAX_CAPACITY)
    : SALON_MAX_CAPACITY
  const selectedMenuTotal = menuTotal(form)
  const selectedMenuQuantity = menuQuantity(form)
  const formTotal =
    form.type === "alquiler" ? SALON_RENTAL_PRICE : selectedMenuTotal
  const requiredDeposit = formTotal * REQUIRED_DEPOSIT_RATE
  const consumptionMinimumMet =
    form.type !== "consumo" ||
    (form.guests >= MIN_CONSUMPTION_GUESTS &&
      selectedMenuQuantity >= MIN_CONSUMPTION_GUESTS)
  const rentalDurationValid =
    form.type !== "alquiler" ||
    (eventDurationMinutes(form.startTime, form.endTime) > 0 &&
      eventDurationMinutes(form.startTime, form.endTime) <= SALON_RENTAL_HOURS * 60)
  const capacityExceeded = form.guests > effectiveSalonCapacity
  const depositReady = formTotal > 0 && form.paid >= requiredDeposit
  const canCreate =
    Boolean(selectedSalon) &&
    form.client.trim().length > 2 &&
    form.guests > 0 &&
    !capacityExceeded &&
    formTotal > 0 &&
    form.paid <= formTotal &&
    depositReady &&
    consumptionMinimumMet &&
    rentalDurationValid
  const formBalance = Math.max(0, formTotal - form.paid)

  const salonConflict = sortedEvents.find(
    (event) =>
      event.status !== "cancelado" &&
      eventSalonId(event) === selectedSalonId &&
      intervalsOverlap(
        form.date,
        form.startTime,
        form.endTime,
        event.date,
        event.startTime,
        event.endTime,
      ),
  )

  const salonSummaries = eventSalons.map((salon) => {
    const salonEvents = sortedEvents.filter(
      (event) => eventSalonId(event) === salon.id && event.status !== "cancelado",
    )
    return {
      salon,
      events: salonEvents,
      next: salonEvents.find((event) => event.status !== "realizado"),
      balance: salonEvents.reduce((sum, event) => sum + eventBalance(event), 0),
    }
  })

  const typeSummary = (Object.keys(typeLabels) as HotelEvent["type"][]).map(
    (type) => {
      const items = events.filter(
        (event) => event.type === type && event.status !== "cancelado",
      )
      return {
        type,
        count: items.length,
        total: items.reduce((sum, event) => sum + event.total, 0),
      }
    },
  )

  function creditAccountForClient(guestId?: string, clientName?: string) {
    const normalizedName = normalizeSearchText(clientName)
    return creditAccounts.find(
      (account) =>
        (guestId && account.guestId === guestId) ||
        (normalizedName &&
          normalizeSearchText(account.company) === normalizedName),
    )
  }

  function creditAccountForEvent(event: HotelEvent) {
    return creditAccountForClient(event.guestId, event.client)
  }

  function validateCreditPayment(
    account: CreditAccount | undefined,
    amount: number,
    clientName: string,
  ) {
    if (amount <= 0) return
    if (!account) {
      throw new Error(`${clientName || "El cliente"} no tiene credito asignado.`)
    }

    const disabledReason = creditDisabledReason(account)
    if (disabledReason) {
      throw new Error(`${disabledReason} para ${clientName || account.company}.`)
    }

    const available = creditAccountAvailable(account)
    if (amount > available + 0.01) {
      throw new Error(
        `El monto en credito (${money(amount)}) supera el disponible (${money(available)}).`,
      )
    }
  }

  async function syncEventCreditCharge(
    account: CreditAccount | undefined,
    amount: number,
    eventId: number,
    eventTitle: string,
    clientName: string,
    reference: string,
  ) {
    if (amount <= 0) return false
    validateCreditPayment(account, amount, clientName)

    const accountId = numericBackendId(account?.id)
    if (!accountId) {
      throw new Error(`No se encontro el identificador de credito para ${clientName}.`)
    }

    await api.credit.createAccountMovement(accountId, {
      concept: "Cargo por pago de evento",
      amount,
      source_module: INVOICE_SOURCE_MODULES.EVENT,
      source_id: eventId,
      reference,
      notes: `Credito usado por ${clientName} en evento ${eventTitle}.`,
    })

    return true
  }

  function selectGuest(guestId: string) {
    const guest = guestOptions.find((item) => item.id === guestId)
    const account = creditAccountForClient(guestId, guest?.name)
    const keepCredit = creditCanBeUsed(account)

    setForm((current) => ({
      ...current,
      guestId,
      client: guest?.name ?? "",
      contact: guest?.phone ?? "",
      clientKind: guest ? "huesped" : "externo",
      paymentMethod:
        current.paymentMethod === "credito" && !keepCredit
          ? "efectivo"
          : current.paymentMethod,
    }))
  }

  function printDraftEventReceipt() {
    if (form.paid <= 0) {
      toast.error("No hay anticipo para imprimir recibo.")
      return
    }

    printSimpleReceipt({
      title: "Recibo simple de evento",
      code: "Evento en creacion",
      customer: form.client.trim() || "Cliente",
      concept: `Anticipo de evento - ${eventTitle || "Evento"}`,
      amount: form.paid,
      details: [
        { label: "Salon", value: selectedSalon?.name ?? "Sin salon" },
        { label: "Fecha", value: formatDate(form.date) },
        { label: "Horario", value: timeRangeLabel(form.startTime, form.endTime) },
        { label: "Platillos", value: form.type === "consumo" ? menuSummary(form) : "Alquiler 4 horas" },
        { label: "Total", value: money(formTotal) },
        { label: "Saldo", value: money(Math.max(0, formTotal - form.paid)) },
      ],
    })
  }

  async function createEvent() {
    if (savingEvent) return

    if (!selectedSalon) {
      toast.error("No hay salon seleccionado", {
        description: "Crea o selecciona un salon antes de reservar.",
      })
      return
    }

    if (!form.client.trim()) {
      toast.error("Selecciona un cliente para el evento.", {
        description: "Usa el buscador de clientes. Si no existe, agregalo primero en Clientes.",
      })
      return
    }

    if (form.guests <= 0) {
      toast.error("Indica cuantas personas asistiran al evento.")
      return
    }

    if (formTotal <= 0) {
      toast.error("El evento no tiene total calculado.", {
        description: form.type === "consumo"
          ? "Agrega platillos para calcular el total."
          : "Revisa la tarifa de alquiler del salon.",
      })
      return
    }

    if (form.paid > formTotal) {
      toast.error("El anticipo no puede ser mayor que el total.", {
        description: `Total del evento: ${money(formTotal)}.`,
      })
      return
    }

    if (capacityExceeded) {
      toast.error("La capacidad del salon no alcanza", {
        description: `${selectedSalon.name} permite hasta ${effectiveSalonCapacity} personas.`,
      })
      return
    }

    if (!consumptionMinimumMet) {
      toast.error("El consumo requiere minimo 10 personas y 10 platillos.", {
        description: "Agrega desayunos, refacciones o almuerzos para llegar al minimo.",
      })
      return
    }

    if (!rentalDurationValid) {
      toast.error("El alquiler del salon cubre hasta 4 horas.", {
        description: "Ajusta la hora de inicio y fin antes de reservar.",
      })
      return
    }

    if (!depositReady) {
      toast.error("El anticipo obligatorio es del 50%.", {
        description: `Debe recibir al menos ${money(requiredDeposit)} para reservar.`,
      })
      return
    }

    if (salonConflict) {
      toast.error("Ese salón ya tiene un evento en ese horario", {
        description: `${salonConflict.title} - ${salonConflict.startTime} a ${salonConflict.endTime}`,
      })
      return
    }

    if (!canCreate) {
      toast.error("Faltan datos para crear el evento", {
        description: "Revisa cliente, capacidad, platillos, horario o anticipo.",
      })
      return
    }

    const backendSalonId = numericBackendId(selectedSalon.id)
    if (!backendSalonId) {
      toast.error("El salon aun no esta confirmado por el servidor", {
        description: "Vuelve a seleccionarlo cuando aparezca desde /api/event-salons.",
      })
      return
    }

    if (form.paid > 0 && form.paymentMethod === "credito") {
      try {
        validateCreditPayment(selectedCreditAccount, form.paid, form.client.trim())
      } catch (error) {
        toast.error("No se puede usar credito en este evento", {
          description: getApiErrorMessage(error),
        })
        return
      }
    }

    const event: HotelEvent = {
      id: `ev-${Date.now()}`,
      title: eventTitle,
      client: form.client.trim(),
      contact: form.contact.trim(),
      salonId: selectedSalon.id,
      salon: selectedSalon.name,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      guests: form.guests,
      type: form.type,
      clientKind: form.clientKind,
      total: formTotal,
      paid: form.paid,
      status: "confirmado",
      notes: [
        form.type === "alquiler"
          ? `Alquiler de salon por ${money(SALON_RENTAL_PRICE)} hasta ${SALON_RENTAL_HOURS} horas.`
          : `Consumo de platillos: ${menuSummary(form)}.`,
        form.services.trim(),
      ]
        .filter(Boolean)
        .join(" "),
    }

    setSavingEvent(true)
    try {
      const response = await api.events.create(
        eventApiPayload(event, backendSalonId, form.paymentMethod),
      )
      const responseId = findApiId(response, ["id_event", "id"])

      if (!responseId) {
        throw new Error("El servidor recibio el evento, pero no devolvio identificador.")
      }

      const backendEventId = numericBackendId(responseId)
      if (form.paid > 0 && form.paymentMethod === "credito" && backendEventId === null) {
        throw new Error("El servidor recibio el evento, pero no devolvio un identificador valido para descontar el credito.")
      }
      const chargedCredit =
        form.paid > 0 &&
        form.paymentMethod === "credito" &&
        backendEventId !== null
          ? await syncEventCreditCharge(
              selectedCreditAccount,
              form.paid,
              backendEventId,
              event.title,
              event.client,
              `Anticipo ${event.title}`,
            )
          : false

      await refreshApiState(
        chargedCredit ? ["events", "creditAccounts"] : ["events"],
        { force: true },
      )
      setForm({ ...emptyForm, salonId: selectedSalon.id })
      setActiveTab("agenda")
      toast.success("Evento creado correctamente", {
        description: `${event.title} - ${event.salon}`,
      })
    } catch (error) {
      await refreshApiState(["events", "creditAccounts"], { force: true })
      toast.error("No se pudo crear el evento en el servidor", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingEvent(false)
    }
  }

  function updateEvent(id: string, patch: Partial<HotelEvent>, message: string) {
    dispatch({ type: "EVENT_UPDATE", id, patch })
    toast.success(message)
  }

  async function registerAdvance(event: HotelEvent) {
    const amount = advanceByEvent[event.id] ?? 0
    const balance = eventBalance(event)
    const paymentMethod = advanceMethodByEvent[event.id] ?? "efectivo"
    const creditAccount = creditAccountForEvent(event)

    if (amount <= 0 || amount > balance) {
      toast.error("El anticipo no es válido", {
        description: `El saldo pendiente es ${money(balance)}.`,
      })
      return
    }

    if (paymentMethod === "credito") {
      try {
        validateCreditPayment(creditAccount, amount, event.client)
      } catch (error) {
        toast.error("No se puede usar credito en este abono", {
          description: getApiErrorMessage(error),
        })
        return
      }
    }

    const backendEventId = numericBackendId(event.id)
    if (!backendEventId) {
      toast.error("Este evento no tiene identificador del servidor para registrar abonos.")
      return
    }

    try {
      await api.events.createPayment(backendEventId, {
        amount,
        payment_method: paymentMethod,
        payment_reference: `Anticipo ${event.title}`,
        notes: "Anticipo registrado desde recepcion.",
      })
      const chargedCredit =
        paymentMethod === "credito"
          ? await syncEventCreditCharge(
              creditAccount,
              amount,
              backendEventId,
              event.title,
              event.client,
              `Anticipo ${event.title}`,
            )
          : false

      await refreshApiState(
        chargedCredit ? ["events", "creditAccounts"] : ["events"],
        { force: true },
      )
      setAdvanceByEvent((current) => ({ ...current, [event.id]: 0 }))
      setAdvanceMethodByEvent((current) => ({
        ...current,
        [event.id]: "efectivo",
      }))
      toast.success("Anticipo registrado correctamente", {
        description: `${event.title} - ${money(amount)}`,
      })
    } catch (error) {
      await refreshApiState(["events", "creditAccounts"], { force: true })
      toast.error("No se pudo registrar el anticipo en el servidor", {
        description: getApiErrorMessage(error),
      })
    }
  }

  function startEvent(event: HotelEvent) {
    if (event.status !== "confirmado") return
    updateEvent(event.id, { status: "confirmado" }, "Evento confirmado")
  }

  async function finishEvent(event: HotelEvent) {
    const balance = eventBalance(event)
    if (balance > 0) {
      toast.error("No se puede finalizar con saldo pendiente", {
        description: `Falta cobrar ${money(balance)}.`,
      })
      return
    }
    const backendEventId = numericBackendId(event.id)
    if (!backendEventId) {
      toast.error("Este evento no tiene identificador del servidor para finalizarlo.")
      return
    }
    try {
      await api.events.finish(backendEventId, {
        allow_pending_balance: false,
        notes: "Evento finalizado desde salones",
      })
      await refreshApiState(["events"], { force: true })
    } catch (error) {
      toast.error("No se pudo finalizar el evento en backend", {
        description: getApiErrorMessage(error),
      })
      return
    }
    updateEvent(event.id, { status: "realizado" }, "Evento realizado correctamente")
  }

  async function invoiceEvent(event: HotelEvent) {
    const payments = eventInvoiceablePayments(event)
    if (payments.length === 0) {
      toast.info("No hay pagos pendientes para facturar.", {
        description:
          event.paid > 0
            ? "Los pagos ya estan facturados o el servidor no devolvio sus identificadores."
            : "Registra primero un pago por el monto que deseas facturar.",
      })
      return
    }

    const guest = event.guestId
      ? guests.find((candidate) => candidate.id === event.guestId)
      : undefined

    const customerTaxId = guest?.nit?.trim().toUpperCase() || "CF"

    setInvoiceEventTarget(event)
    setEventInvoiceForm({
      useCustomerTaxInfo: true,
      taxId: customerTaxId,
      name: customerTaxId === "CF" ? "CONSUMIDOR FINAL" : guest?.name || event.client || "",
      address: "CIUDAD",
      format: INVOICE_FORMATS.PDF_XML,
      conceptId: "1",
      itemType: INVOICE_ITEM_TYPES.SERVICIO,
      description: `Pagos de evento ${event.title}`,
      notes: "Facturacion de pagos completos seleccionados",
      selectedPaymentIds: payments.map((payment) => payment.id),
    })
    setEventInvoiceLoading(true)

    const [conceptsResult, remainingResult] = await Promise.allSettled([
      api.invoiceConcepts.list<unknown[]>({ item_type: INVOICE_ITEM_TYPES.SERVICIO }),
      api.invoices.getRemaining<unknown>(),
    ])

    if (conceptsResult.status === "fulfilled") {
      const concepts = apiArray(conceptsResult.value)
        .map(mapEventInvoiceConcept)
        .filter((concept): concept is EventInvoiceConcept => Boolean(concept))
      setEventInvoiceConcepts(concepts)
      if (concepts[0]) {
        setEventInvoiceForm((current) =>
          current
            ? {
                ...current,
                conceptId: String(concepts[0].id),
                itemType: concepts[0].itemType,
              }
            : current,
        )
      }
    } else {
      setEventInvoiceConcepts([])
      toast.error("No se pudieron cargar los conceptos de factura.", {
        description: getApiErrorMessage(conceptsResult.reason),
      })
    }

    if (remainingResult.status === "fulfilled") {
      const response = isApiRecord(remainingResult.value)
        ? remainingResult.value
        : {}
      const data = isApiRecord(response.data) ? response.data : response
      const remaining = Number(
        data.remaining ??
          data.remaining_quantity ??
          data.available ??
          data.remaining_dtes,
      )
      setEventInvoiceRemaining(Number.isFinite(remaining) ? remaining : null)
    } else {
      setEventInvoiceRemaining(null)
    }

    setEventInvoiceLoading(false)
  }

  function closeEventInvoice(open: boolean) {
    if (open || eventInvoiceSubmitting) return
    setInvoiceEventTarget(null)
    setEventInvoiceForm(null)
  }

  async function lookupEventInvoiceNitInfo() {
    if (!eventInvoiceForm) return
    const taxId = eventInvoiceForm.taxId.trim().toUpperCase()
    if (!taxId || taxId === "CF") {
      setEventInvoiceForm((current) =>
        current ? { ...current, name: "CONSUMIDOR FINAL" } : current,
      )
      return
    }

    try {
      const response = await api.invoices.getNitInfo<unknown>(taxId)
      const info = invoiceNitInfo(response)
      if (!info.name) {
        toast.warning("DIGIFACT no devolvio nombre para ese NIT")
        return
      }
      setEventInvoiceForm((current) =>
        current
          ? {
              ...current,
              name: info.name,
              address: info.address || current.address,
            }
          : current,
      )
      toast.success("Datos fiscales cargados", { description: `${taxId} · ${info.name}` })
    } catch (error) {
      toast.error("No se pudo consultar el NIT", {
        description: getApiErrorMessage(error),
      })
    }
  }

  function toggleEventInvoicePayment(paymentId: string, checked: boolean) {
    if (!invoiceEventTarget) return

    setEventInvoiceForm((current) => {
      if (!current) return current
      const allowedIds = new Set(
        eventInvoiceablePayments(invoiceEventTarget).map((payment) => payment.id),
      )
      const selected = new Set(current.selectedPaymentIds)
      if (checked && allowedIds.has(paymentId)) selected.add(paymentId)
      if (!checked) selected.delete(paymentId)

      return {
        ...current,
        selectedPaymentIds: [...selected].filter((id) => allowedIds.has(id)),
      }
    })
  }

  async function issueEventInvoice() {
    if (!invoiceEventTarget || !eventInvoiceForm) return

    const eventId = numericBackendId(invoiceEventTarget.id)
    const conceptId = numericBackendId(eventInvoiceForm.conceptId)
    const selectedPayments = eventSelectedPayments(
      invoiceEventTarget,
      eventInvoiceForm.selectedPaymentIds,
    )
    const eventPaymentIds = selectedPayments
      .map((payment) => numericBackendId(payment.id))
      .filter((id): id is number => id !== null)
    const invoiceTotal = paymentListTotal(selectedPayments)

    if (!eventId || !conceptId) {
      toast.error("Falta el identificador del evento o concepto.")
      return
    }

    if (eventPaymentIds.length === 0 || invoiceTotal <= 0) {
      toast.error("Selecciona al menos un pago pendiente.")
      return
    }

    const taxId = eventInvoiceForm.taxId.trim().toUpperCase() || "CF"
    const buyerName = eventInvoiceForm.name.trim()
    const buyerNameForPayload = eventInvoiceForm.useCustomerTaxInfo
      ? buyerName || (taxId === "CF" ? "CONSUMIDOR FINAL" : " ")
      : taxId === "CF"
        ? "CONSUMIDOR FINAL"
        : buyerName || " "

    const payload: IssueInvoiceModel = {
      source_module: INVOICE_SOURCE_MODULES.EVENT,
      source_id: eventId,
      id_guest: numericBackendId(invoiceEventTarget.guestId),
      buyer: {
        taxId,
        name: buyerNameForPayload,
        address: eventInvoiceForm.address.trim() || "CIUDAD",
        city: "09001",
        district: "Quetzaltenango",
        state: "Quetzaltenango",
        country: "GT",
      },
      format: eventInvoiceForm.format,
      billing_mode: INVOICE_BILLING_MODES.BY_PAYMENTS,
      reservation_payment_ids: [],
      stay_payment_ids: [],
      event_payment_ids: eventPaymentIds,
      minibar_review_detail_ids: [],
      items: [
        {
          id_invoice_concept: conceptId,
          item_type: INVOICE_ITEM_TYPES.SERVICIO,
          description: eventInvoiceForm.description.trim(),
          quantity: 1,
          unit_price_with_tax: invoiceTotal,
          notes: eventInvoiceForm.notes.trim() || null,
        },
      ],
    }

    setEventInvoiceSubmitting(true)
    try {
      await api.invoices.issue(payload)
      await refreshApiState(["events"], { force: true })
      toast.success("Factura de evento emitida correctamente.", {
        description: `${invoiceEventTarget.title} - ${money(invoiceTotal)}`,
      })
      setInvoiceEventTarget(null)
      setEventInvoiceForm(null)
    } catch (error) {
      toast.error("No se pudo emitir la factura del evento.", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setEventInvoiceSubmitting(false)
    }
  }

  function printEventReceipt(event: HotelEvent, amount = event.paid) {
    if (amount <= 0) {
      toast.error("No hay monto para imprimir recibo.")
      return
    }

    printSimpleReceipt({
      title: "Recibo simple de evento",
      code: event.id,
      customer: event.client,
      concept: `Pago de evento - ${event.title}`,
      amount,
      date: new Date().toLocaleString("es-GT", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      details: [
        { label: "Salon", value: event.salon },
        { label: "Fecha", value: formatDate(event.date) },
        { label: "Horario", value: timeRangeLabel(event.startTime, event.endTime) },
        { label: "Total", value: money(event.total) },
        { label: "Saldo", value: money(eventBalance(event)) },
      ],
    })
  }

  function cancelEvent(event: HotelEvent) {
    setPendingDialog({
      title: "Cancelar evento",
      description: `¿Seguro que quieres cancelar ${event.title}? La agenda lo mostrará como cancelado y el salón quedará libre para otra reserva.`,
      confirmLabel: "Sí, cancelar evento",
      tone: "danger",
      onConfirm: () => {
        dispatch({ type: "EVENT_CANCEL", id: event.id })
        setPendingDialog(null)
        toast.success("Evento cancelado correctamente", {
          description: event.title,
        })
      },
    })
  }

  function prepareNewEventForSalon(salon: EventSalon) {
    if (salon.kind !== "salon") {
      toast.info("El coworking no se ofrece como reserva de salon.")
      return
    }

    setForm((current) => ({
      ...current,
      salonId: salon.id,
      type: current.type === "coworking" ? "alquiler" : current.type,
      clientKind: "externo",
    }))
    setActiveTab("nuevo")
    toast.info("Salón seleccionado para cotizar", {
      description: salon.name,
    })
  }

  function resetSalonForm() {
    setEditingSalonId(null)
    setSalonForm(emptySalonForm)
  }

  function editSalon(salon: EventSalon) {
    setEditingSalonId(salon.id)
    setSalonForm({
      name: salon.name,
      capacity: salon.capacity,
      kind: salon.kind,
      description: salon.description,
      freeForGuests: Boolean(salon.freeForGuests),
    })
    setActiveTab("salones")
    window.setTimeout(() => {
      salonFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)
  }

  async function saveSalon() {
    if (savingSalon) return

    const name = salonForm.name.trim()
    const description = salonForm.description.trim()

    if (
      !name ||
      salonForm.capacity < 1 ||
      salonForm.capacity > SALON_MAX_CAPACITY
    ) {
      toast.error(`Completa nombre y capacidad del salon (maximo ${SALON_MAX_CAPACITY})`)
      return
    }

    if (editingSalonId) {
      toast.error("No se puede editar el salon todavia", {
        description: "El servidor solo expone creacion y listado de salones.",
      })
      return
    }

    const savedDescription =
      description ||
      (salonForm.kind === "coworking"
        ? "Area de coworking disponible para huespedes y renta externa."
        : "Salon disponible para reservas.")

    setSavingSalon(true)
    try {
      const response = await createEventSalonFromModal({
        name,
        description: savedDescription,
        capacity: salonForm.capacity,
        base_price: salonForm.kind === "salon" ? SALON_RENTAL_PRICE : 0,
      })
      let backendId = findApiId(response, ["id_event_salon", "id"])

      if (!backendId) {
        const latestSalons = await api.eventSalons.list()
        backendId = findSalonIdByName(latestSalons, name)
      }

      if (!backendId || !numericBackendId(backendId)) {
        throw new Error("El servidor recibio el salon, pero no lo devuelve con identificador en /api/event-salons.")
      }

      await refreshApiState(["salons"], { force: true })
      setForm((current) => ({ ...current, salonId: backendId }))
      toast.success("Salon agregado", { description: name })
      resetSalonForm()
    } catch (error) {
      toast.error("No se pudo guardar el salon en el servidor", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingSalon(false)
    }
  }

  function deleteSalon(salon: EventSalon) {
    toast.error("No se puede eliminar el salon desde el front todavia", {
      description: "El servidor no expone DELETE /api/event-salons.",
    })
  }

  const activeEventInvoicePayments = invoiceEventTarget
    ? eventInvoiceablePayments(invoiceEventTarget)
    : []
  const selectedEventInvoicePayments =
    invoiceEventTarget && eventInvoiceForm
      ? eventSelectedPayments(invoiceEventTarget, eventInvoiceForm.selectedPaymentIds)
      : []
  const selectedEventInvoiceTotal = paymentListTotal(selectedEventInvoicePayments)
  const canIssueEventInvoice =
    Boolean(invoiceEventTarget && eventInvoiceForm) &&
    !eventInvoiceLoading &&
    !eventInvoiceSubmitting &&
    selectedEventInvoicePayments.length > 0 &&
    selectedEventInvoiceTotal > 0 &&
    Boolean(eventInvoiceForm?.description.trim())

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Salones y coworking"
        description="Reserva espacios por consumo de platillos, uso de coworking o alquiler del salon por horario."
        actions={
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => setActiveTab("nuevo")}
          >
            <CalendarPlus className="size-3.5" />
            Reservar salon
          </Button>
        }
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guia rapida para operar salones</h2>
            <p className="mobile-safe-text mt-1 max-w-3xl text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
              Elige el salon, define fecha y horario real, y controla saldos.
            </p>
          </div>
          <div className="touch-scroll -mx-1 flex min-w-0 flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <Button
              size="sm"
              className="gap-2 rounded-full"
              onClick={() => setActiveTab("nuevo")}
            >
              <CalendarPlus className="size-4" />
              Reservar salon
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-full bg-white/70"
              onClick={() => setActiveTab("salones")}
            >
              <Building2 className="size-4" />
              Ver espacios
            </Button>
          </div>
        </div>
        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            {
              icon: CalendarPlus,
              title: "Elige el espacio",
              text: "Usa el salon registrado desde el catalogo.",
            },
            {
              icon: Clock3,
              title: "Define horario",
              text: "Usa hora de inicio y fin segun la reserva real.",
            },
            {
              icon: Wallet,
              title: "Anota el anticipo",
              text: "Cuando el cliente deja anticipo, el evento queda confirmado.",
            },
            {
              icon: PartyPopper,
              title: "Marca cuando termina",
              text: "Cuando el evento ya termino, marcalo como realizado.",
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
        <EventMetric
          label="Próximo evento"
          value={nextEvent ? formatDate(nextEvent.date) : "Sin agenda"}
          helper={nextEvent ? `${nextEvent.title} · ${nextEvent.salon}` : "No hay eventos activos"}
          tone="info"
        />
        <EventMetric
          label="Confirmados"
          value={confirmedEvents.length}
          helper="Listos para operación"
          tone={confirmedEvents.length ? "success" : "default"}
        />
        <EventMetric
          label="Reservados"
          value={tentativeEvents.length}
          helper="Necesitan seguimiento o anticipo"
          tone={tentativeEvents.length ? "warning" : "success"}
        />
        <EventMetric
          label="Saldo pendiente"
          value={money(totalBalance)}
          helper="Por cobrar en eventos activos"
          tone={totalBalance ? "warning" : "success"}
        />
      </section>

      {eventsWithBalance.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Eventos con saldo por cobrar</h2>
              <p className="mt-1 text-sm text-amber-900/80">
                Antes de cerrar o facturar, revisa estos saldos para no perder
                cobros de salón, montaje o alimentación.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {eventsWithBalance.slice(0, 4).map((event) => (
                <span
                  key={event.id}
                  className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold"
                >
                  {event.title}: {money(eventBalance(event))}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as EventTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="nuevo">Reservar salon</TabsTrigger>
          <TabsTrigger value="salones">Espacios</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_340px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Agenda operativa</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Eventos ordenados por fecha, con saldo y acciones visibles.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="rounded-2xl pl-9"
                    placeholder="Buscar evento, cliente, salón..."
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  ["todos", "Todos"],
                  ["reservado", "Reservados"],
                  ["confirmado", "Confirmados"],
                  ["con-saldo", "Con saldo"],
                  ["realizado", "Realizados"],
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
                {visibleEvents.map((event) => {
                  const balance = eventBalance(event)
                  const percent = eventPaidPercent(event)
                  const days = daysUntil(event.date)
                  const canAct = !["realizado", "cancelado"].includes(event.status)
                  const eventCreditAccount = creditAccountForEvent(event)
                  const eventCreditDisabledReason = eventCreditAccount
                    ? creditDisabledReason(eventCreditAccount)
                    : undefined
                  const eventCreditAvailable = eventCreditAccount
                    ? creditAccountAvailable(eventCreditAccount)
                    : 0
                  const selectedAdvanceMethod =
                    advanceMethodByEvent[event.id] ?? "efectivo"

                  return (
                    <article
                      key={event.id}
                      className={cn(
                        "rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                        event.status === "cancelado" && "bg-muted/20 opacity-75",
                        event.status === "confirmado" && "border-blue-200 bg-blue-50/30",
                      )}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                              <PartyPopper className="size-6" />
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {formatDate(event.date)} - {timeRangeLabel(event.startTime, event.endTime)}
                              </p>
                              <h3 className="text-lg font-semibold">{event.title}</h3>
                            </div>
                            <StatusBadge status={event.status} />
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Cliente</p>
                              <p className="mt-1 font-semibold">{event.client}</p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="size-3.5" />
                                {event.contact}
                              </p>
                            </div>
                            <div className="rounded-2xl border bg-muted/20 p-3">
                              <p className="text-xs text-muted-foreground">Salón</p>
                              <p className="mt-1 font-semibold">{event.salon}</p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="size-3.5" />
                                {event.guests} personas
                              </p>
                            </div>
                            <div
                              className={cn(
                                "rounded-2xl border p-3",
                                typeStyles[event.type],
                              )}
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                Tipo
                              </p>
                              <p className="mt-1 font-bold">{typeLabels[event.type]}</p>
                              <p className="mt-1 text-xs opacity-75">
                                {days < 0
                                  ? `${Math.abs(days)} día(s) atrás`
                                  : days === 0
                                    ? "Hoy"
                                    : `En ${days} día(s)`}
                              </p>
                            </div>
                          </div>

                          {event.notes ? (
                            <div className="mt-3 flex gap-2 rounded-2xl border bg-muted/20 p-3 text-sm">
                              <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" />
                              <p>{event.notes}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 space-y-3 xl:w-72">
                          <div className="rounded-2xl border bg-muted/20 p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Pagado</span>
                              <span className="font-semibold">{percent}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  balance === 0 ? "bg-emerald-500" : "bg-amber-500",
                                )}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="font-bold">{money(event.total)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Saldo</p>
                                <p className="font-bold">{money(balance)}</p>
                              </div>
                            </div>
                          </div>

                          {canAct ? (
                            <div className="space-y-2">
                              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <MoneyField
                                  value={advanceByEvent[event.id] ?? 0}
                                  onChange={(amount) =>
                                    setAdvanceByEvent((current) => ({
                                      ...current,
                                      [event.id]: amount,
                                    }))
                                  }
                                  className="min-w-0"
                                  placeholder="Anticipo"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-10 gap-2 rounded-full"
                                  onClick={() => registerAdvance(event)}
                                >
                                  <Wallet className="size-3.5" />
                                  Registrar abono
                                </Button>
                              </div>
                              <select
                                value={selectedAdvanceMethod}
                                onChange={(item) =>
                                  setAdvanceMethodByEvent((current) => ({
                                    ...current,
                                    [event.id]: item.target.value as PaymentMethod,
                                  }))
                                }
                                className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                              >
                                {paymentMethodOptionsForCredit(
                                  eventCreditAccount,
                                  selectedAdvanceMethod,
                                ).map((method) => (
                                  <option key={method.value} value={method.value}>
                                    {method.label}
                                  </option>
                                ))}
                              </select>
                              {eventCreditAccount ? (
                                <div
                                  className={cn(
                                    "rounded-2xl border px-3 py-2 text-xs",
                                    eventCreditDisabledReason
                                      ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                                      : "border-blue-200 bg-blue-50 text-blue-900",
                                  )}
                                >
                                  <span className="font-semibold">
                                    Credito disponible: {money(eventCreditAvailable)}
                                  </span>
                                  <span className="block">
                                    {eventCreditDisabledReason ??
                                      `Limite ${money(eventCreditAccount.limit)} · usado ${money(eventCreditAccount.balance)}`}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {event.status === "reservado" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                onClick={() =>
                                  updateEvent(
                                    event.id,
                                    { status: "confirmado" },
                                    "Evento confirmado",
                                  )
                                }
                              >
                                <BadgeCheck className="size-3.5" />
                                Confirmar
                              </Button>
                            ) : null}
                            {event.status === "confirmado" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 rounded-full"
                                onClick={() => void finishEvent(event)}
                              >
                                <FileText className="size-3.5" />
                                Marcar realizado
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 rounded-full"
                              onClick={() => invoiceEvent(event)}
                              disabled={
                                event.status === "cancelado" ||
                                eventInvoiceablePayments(event).length === 0
                              }
                              title={
                                eventInvoiceablePayments(event).length === 0
                                  ? "No hay pagos guardados pendientes para facturar."
                                  : "Facturar pagos completos seleccionados."
                              }
                            >
                              <Receipt className="size-3.5" />
                              Facturar pagos
                            </Button>
                            {event.paid > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                onClick={() => printEventReceipt(event)}
                              >
                                <Printer className="size-3.5" />
                                Recibo sin factura
                              </Button>
                            ) : null}
                            {canAct ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 rounded-full border-red-200 text-red-800 hover:bg-red-50"
                                onClick={() => cancelEvent(event)}
                              >
                                <XCircle className="size-3.5" />
                                Cancelar evento
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}

                {visibleEvents.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-10 text-center">
                    <p className="font-semibold">No hay eventos con ese filtro</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cambia la búsqueda o crea una nueva cotización.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-5 text-primary" />
                  <h3 className="font-semibold">Próximo montaje</h3>
                </div>
                {nextEvent ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {formatDate(nextEvent.date)}
                      </p>
                      <p className="mt-1 text-xl font-semibold">{nextEvent.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {nextEvent.salon} - {timeRangeLabel(nextEvent.startTime, nextEvent.endTime)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2 rounded-full"
                      onClick={() => setFilter("con-saldo")}
                    >
                      <CircleDollarSign className="size-4" />
                      Revisar saldos
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No hay eventos activos por ahora.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-600" />
                  <h3 className="font-semibold">Atención</h3>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Tentativos</p>
                    <p className="mt-1 text-xl font-bold">{tentativeEvents.length}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Con saldo abierto</p>
                    <p className="mt-1 text-xl font-bold">{eventsWithBalance.length}</p>
                  </div>
                  <Button
                    className="w-full gap-2 rounded-full"
                    onClick={() => setActiveTab("nuevo")}
                  >
                    <CalendarPlus className="size-4" />
                    Empezar cotización
                  </Button>
                </div>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="nuevo" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_360px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold">Nueva cotización de evento</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra lo mínimo necesario para reservar salón y dar seguimiento.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Nombre del evento
                  <Input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="Reserva de salón, consumo de platillos..."
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Tipo
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as HotelEvent["type"],
                        clientKind: current.guestId ? "huesped" : "externo",
                      }))
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="alquiler">Alquiler de salón</option>
                    <option value="consumo">Evento por consumo</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Nombre del cliente
                  <GuestCombobox
                    guests={guestOptions}
                    value={form.guestId}
                    onChange={selectGuest}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedGuest
                      ? `${selectedGuest.phone || "Sin telefono"} · NIT ${selectedGuest.nit || "Pendiente"}`
                      : "Si no aparece, registralo primero en Clientes."}
                  </p>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Contacto
                  <Input
                    value={form.contact}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contact: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="+502 5555 0000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Personas
                  <Input
                    type="number"
                    min={form.type === "consumo" ? MIN_CONSUMPTION_GUESTS : 1}
                    max={effectiveSalonCapacity}
                    value={form.guests || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        guests:
                          event.target.value === ""
                            ? 0
                            : Math.min(
                                effectiveSalonCapacity,
                                Math.max(1, Number(event.target.value)),
                              ),
                      }))
                    }
                    className="rounded-2xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Capacidad máxima {effectiveSalonCapacity}. En consumo, mínimo {MIN_CONSUMPTION_GUESTS}.
                  </p>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Fecha
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Hora inicio
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Hora fin
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Salón
                  <select
                    value={form.salonId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        salonId: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {bookableSalons.map((salon) => (
                      <option key={salon.id} value={salon.id}>
                        {salon.name}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {salonAvailabilityMessage}
                  </span>
                </label>
                {form.type === "consumo" ? (
                  <div className="space-y-3 rounded-3xl border bg-muted/10 p-4 md:col-span-3">
                    <div>
                      <h3 className="font-semibold">Platillos para consumo</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Puedes mezclar desayunos, refacciones y almuerzos. El total se calcula automáticamente.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {menuItems.map((item) => (
                        <label key={item.key} className="space-y-2 text-sm font-medium">
                          {item.label} · {money(item.price)}
                          <Input
                            type="number"
                            min={0}
                            value={form[item.key] || ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [item.key]:
                                  event.target.value === ""
                                    ? 0
                                    : Math.max(0, Number(event.target.value)),
                              }))
                            }
                            className="rounded-2xl"
                            placeholder="0"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      {menuSummary(form)} · {selectedMenuQuantity} platillo(s)
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border bg-blue-50 p-4 text-blue-950 md:col-span-3">
                    <p className="font-semibold">Alquiler del salón</p>
                    <p className="mt-1 text-sm">
                      {money(SALON_RENTAL_PRICE)} por {SALON_RENTAL_HOURS} horas.
                    </p>
                  </div>
                )}
                <div className="rounded-3xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Total de reserva</p>
                  <p className="mt-1 text-2xl font-bold">{money(formTotal)}</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Anticipo recibido
                  <MoneyField
                    value={form.paid}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, paid: value }))
                    }
                  />
                  <select
                    value={form.paymentMethod}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentMethod: event.target.value as PaymentMethod,
                      }))
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {paymentMethodOptionsForCredit(
                      selectedCreditAccount,
                      form.paymentMethod,
                    ).map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  {selectedCreditAccount ? (
                    <p
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-xs",
                        selectedCreditDisabledReason
                          ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                          : "border-blue-200 bg-blue-50 text-blue-900",
                      )}
                    >
                      <span className="font-semibold">
                        Credito disponible: {money(selectedCreditAvailable)}
                      </span>
                      <span className="block">
                        {selectedCreditDisabledReason ??
                          `Limite ${money(selectedCreditAccount.limit)} · usado ${money(selectedCreditAccount.balance)}`}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Obligatorio: 50% mínimo ({money(requiredDeposit)}).
                  </p>
                </label>
                <div className="rounded-3xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Saldo después del anticipo</p>
                  <p className="mt-1 text-2xl font-bold">{money(formBalance)}</p>
                </div>
                <label className="space-y-2 text-sm font-medium md:col-span-3">
                  Servicios, montaje y notas
                  <Textarea
                    value={form.services}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        services: event.target.value,
                      }))
                    }
                    className="min-h-28 rounded-2xl"
                    placeholder="Montaje, coffee break, menú, equipo, decoración, horarios de proveedor..."
                  />
                </label>
              </div>

              {salonConflict ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  Ese horario se cruza con {salonConflict.title} en {selectedSalon?.name}.
                </div>
              ) : null}

              {capacityExceeded ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {selectedSalon?.name} permite hasta {effectiveSalonCapacity} personas.
                </div>
              ) : null}

              {form.type === "consumo" && !consumptionMinimumMet ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  El consumo requiere mínimo {MIN_CONSUMPTION_GUESTS} personas y {MIN_CONSUMPTION_GUESTS} platillos seleccionados.
                </div>
              ) : null}

              {form.type === "alquiler" && !rentalDurationValid ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  El alquiler de {money(SALON_RENTAL_PRICE)} cubre hasta {SALON_RENTAL_HOURS} horas.
                </div>
              ) : null}

              {!depositReady ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Para reservar se debe registrar un anticipo mínimo de {money(requiredDeposit)}.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {form.paid > 0 ? (
                  <Button
                    variant="outline"
                    className="gap-2 rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={printDraftEventReceipt}
                  >
                    <Printer className="size-4" />
                    Recibo sin factura
                  </Button>
                ) : null}
                <Button
                  className="gap-2 rounded-full"
                  onClick={createEvent}
                  disabled={savingEvent}
                >
                  {savingEvent ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )}
                  {savingEvent ? "Guardando" : "Crear evento"}
                </Button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className={cn("rounded-3xl border p-5 shadow-sm", salonTone(selectedSalon))}>
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  <h3 className="font-semibold">{selectedSalon?.name ?? "Sin salon"}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedSalon?.description ?? "Crea un salon para poder reservar."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-white/70 p-3">
                    <p className="text-xs text-muted-foreground">Capacidad</p>
                    <p className="mt-1 font-bold">
                      {effectiveSalonCapacity} pax
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-white/70 p-3">
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="mt-1 font-bold">{timeRangeLabel(form.startTime, form.endTime)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-5 text-primary" />
                  <h3 className="font-semibold">Resumen financiero</h3>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="mt-1 text-xl font-bold">{money(formTotal)}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Anticipo obligatorio</p>
                    <p className="mt-1 text-xl font-bold">{money(requiredDeposit)}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Anticipo</p>
                    <p className="mt-1 text-xl font-bold">{money(form.paid)}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Saldo al confirmar</p>
                    <p className="mt-1 text-xl font-bold">{money(formBalance)}</p>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="salones" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[380px_1fr]">
            <div ref={salonFormRef} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                {editingSalonId ? (
                  <Pencil className="size-5 text-primary" />
                ) : (
                  <Plus className="size-5 text-primary" />
                )}
                <h2 className="text-xl font-semibold">
                  {editingSalonId ? "Editar salon" : "Agregar salon"}
                </h2>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="space-y-2 text-sm font-medium">
                  Nombre
                  <Input
                    value={salonForm.name}
                    onChange={(event) =>
                      setSalonForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="Ej. Salon terraza"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Capacidad
                  <Input
                    type="number"
                    min={1}
                    max={SALON_MAX_CAPACITY}
                    value={salonForm.capacity || ""}
                    onChange={(event) =>
                      setSalonForm((current) => ({
                        ...current,
                        capacity:
                          event.target.value === ""
                            ? 0
                            : Math.min(
                                SALON_MAX_CAPACITY,
                                Math.max(1, Number(event.target.value)),
                              ),
                      }))
                    }
                    className="rounded-2xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Capacidad máxima del salón: {SALON_MAX_CAPACITY} personas.
                  </p>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Tipo
                  <select
                    value={salonForm.kind}
                    onChange={(event) =>
                      setSalonForm((current) => ({
                        ...current,
                        kind: event.target.value as EventSalon["kind"],
                        freeForGuests:
                          event.target.value === "coworking"
                            ? current.freeForGuests
                            : false,
                      }))
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="salon">Salon</option>
                    <option value="coworking">Coworking</option>
                  </select>
                </label>

                {salonForm.kind === "coworking" ? (
                  <label className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={salonForm.freeForGuests}
                      onChange={(event) =>
                        setSalonForm((current) => ({
                          ...current,
                          freeForGuests: event.target.checked,
                        }))
                      }
                      className="size-4"
                    />
                    Gratis para huespedes
                  </label>
                ) : null}

                <label className="space-y-2 text-sm font-medium">
                  Detalle
                  <Textarea
                    value={salonForm.description}
                    onChange={(event) =>
                      setSalonForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-24 rounded-2xl"
                    placeholder="Uso, mobiliario, reglas o notas operativas."
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2 rounded-full"
                    onClick={saveSalon}
                    disabled={savingSalon}
                  >
                    {savingSalon ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {savingSalon ? "Guardando" : editingSalonId ? "Guardar cambios" : "Agregar"}
                  </Button>
                  {editingSalonId ? (
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={resetSalonForm}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold">Disponibilidad por espacio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vista rápida para saber qué espacio está comprometido y cuál conviene cotizar.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {salonSummaries.map(({ salon, events: salonEvents, next, balance }) => (
                <article
                  key={salon.id}
                  className={cn(
                    "rounded-3xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    salonTone(salon),
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="grid size-11 place-items-center rounded-2xl bg-white/70 text-primary">
                          <Building2 className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold">{salon.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Hasta {salon.capacity} personas
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {salon.description}
                      </p>
                      {salon.kind === "coworking" && salon.freeForGuests ? (
                        <p className="mt-2 inline-flex rounded-full border bg-white/70 px-3 py-1 text-xs font-semibold">
                          Gratis para huespedes
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full bg-white/70"
                        onClick={() => editSalon(salon)}
                        title="Editar salon"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full bg-white/70"
                        onClick={() => deleteSalon(salon)}
                        title="Eliminar salon"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full bg-white/70"
                        onClick={() => prepareNewEventForSalon(salon)}
                      >
                        <CalendarPlus className="size-4" />
                        Reservar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border bg-white/70 p-3">
                      <p className="text-xs text-muted-foreground">Eventos</p>
                      <p className="mt-1 text-xl font-bold">{salonEvents.length}</p>
                    </div>
                    <div className="rounded-2xl border bg-white/70 p-3">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="mt-1 text-xl font-bold">{money(balance)}</p>
                    </div>
                    <div className="rounded-2xl border bg-white/70 p-3">
                      <p className="text-xs text-muted-foreground">Siguiente</p>
                      <p className="mt-1 font-bold">
                        {next ? formatDate(next.date) : "Libre"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {salonEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col gap-2 rounded-2xl border bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(event.date)} - {timeRangeLabel(event.startTime, event.endTime)}
                          </p>
                        </div>
                        <StatusBadge status={event.status} />
                      </div>
                    ))}
                    {salonEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-white/60 p-4 text-sm text-muted-foreground">
                        No hay eventos programados en este salón.
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="resumen" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_360px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Resumen para gerencia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Una lectura rápida de ventas, anticipos, saldos y mezcla de eventos.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <EventMetric
                  label="Eventos activos"
                  value={activeEvents.length}
                  helper="Sin realizados ni cancelados"
                />
                <EventMetric
                  label="Total vendido"
                  value={money(totalSold)}
                  helper="Eventos no cancelados"
                  tone="success"
                />
                <EventMetric
                  label="Anticipos"
                  value={money(totalPaid)}
                  helper="Cobros registrados"
                  tone="info"
                />
                <EventMetric
                  label="Por cobrar"
                  value={money(totalBalance)}
                  helper="Saldo operativo"
                  tone={totalBalance ? "warning" : "success"}
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {typeSummary.map(({ type, count, total }) => (
                  <div
                    key={type}
                    className={cn("rounded-3xl border p-4", typeStyles[type])}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{typeLabels[type]}</p>
                        <p className="text-sm opacity-75">{count} evento(s)</p>
                      </div>
                      <p className="text-lg font-bold">{money(total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                <h3 className="font-semibold">Cierre recomendado</h3>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="font-semibold">1. Revisar saldos</p>
                  <p className="mt-1 text-muted-foreground">
                    No finalices eventos con saldo pendiente sin enviarlo a FEL o registrar abono.
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="font-semibold">2. Confirmar montaje</p>
                  <p className="mt-1 text-muted-foreground">
                    Valida salón, personas, hora de proveedor y notas de cocina.
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="font-semibold">3. Cerrar facturación</p>
                  <p className="mt-1 text-muted-foreground">
                    Envía el evento a Facturación FEL cuando el servicio quede listo.
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="backend" className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Endpoints para Eventos y salones</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrato para agenda, cotización, control de salones, anticipos, cierre y facturación.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {[
                ["GET", "/api/events", "Agenda con filtros por estado, fecha, salón, cliente, saldo pendiente y tipo de evento."],
                ["POST", "/api/events", "Crear cotización o evento confirmado con salón, horario, personas, servicios, total y anticipo."],
                ["GET", "/api/events/salon-availability", "Validar cruces de salón por fecha/hora antes de guardar una cotización."],
                ["POST", "/api/events/{id}/payments", "Registrar abonos/anticipos y cambiar reservado a confirmado cuando aplique."],
                ["PATCH", "/api/events/{id}/confirm", "Confirmar evento manualmente con auditoría."],
                ["PATCH", "/api/events/{id}/complete", "Marcar evento como realizado cuando ya terminó."],
                ["PATCH", "/api/events/{id}/finish", "Finalizar evento solo si no queda saldo o si facturación autorizó el cierre."],
                ["PATCH", "/api/events/{id}/cancel", "Cancelar evento, liberar salón y guardar motivo/auditoría."],
                [
                  "POST",
                  "/api/invoices/issue",
                  "Facturar pagos completos del evento con billing_mode ByPayments y event_payment_ids.",
                ],
                ["GET", "/api/event-salons", "Listado de salones con capacidad, descripción y próximos eventos."],
                ["GET", "/api/reports/events/profitability", "Resumen de rentabilidad de eventos para el periodo seleccionado."],
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

      <Dialog open={Boolean(invoiceEventTarget)} onOpenChange={closeEventInvoice}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Facturar pagos del evento</DialogTitle>
            <DialogDescription>
              {invoiceEventTarget?.title ?? "Evento"} · cada pago seleccionado se factura completo.
            </DialogDescription>
          </DialogHeader>

          {invoiceEventTarget && eventInvoiceForm ? (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Pagos pendientes</p>
                  <p className="mt-1 text-lg font-bold">{activeEventInvoicePayments.length}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Esta factura</p>
                  <p className="mt-1 text-lg font-bold">{money(selectedEventInvoiceTotal)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Documentos disponibles</p>
                  <p className="mt-1 text-lg font-bold">
                    {eventInvoiceRemaining ?? (eventInvoiceLoading ? "..." : "N/D")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">Pagos a incluir</p>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {selectedEventInvoicePayments.length} de {activeEventInvoicePayments.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {activeEventInvoicePayments.map((payment) => (
                    <label
                      key={payment.id}
                      className="flex items-center gap-3 rounded-2xl border bg-muted/10 p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={eventInvoiceForm.selectedPaymentIds.includes(payment.id)}
                        onChange={(event) =>
                          toggleEventInvoicePayment(payment.id, event.target.checked)
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {payment.method} · {payment.date}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {payment.reference || "Sin referencia"}
                        </span>
                      </span>
                      <strong>{money(payment.amount)}</strong>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  <span className="flex items-center justify-between gap-2">
                    <span>NIT</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-2 text-xs"
                      onClick={() => {
                        if (!invoiceEventTarget) return
                        setEventInvoiceForm((current) => {
                          if (!current) return current
                          if (current.useCustomerTaxInfo) {
                            return {
                              ...current,
                              useCustomerTaxInfo: false,
                              taxId: "",
                              name: "",
                            }
                          }

                          const guest = invoiceEventTarget.guestId
                            ? guests.find((candidate) => candidate.id === invoiceEventTarget.guestId)
                            : undefined
                          const customerTaxId = guest?.nit?.trim().toUpperCase() || "CF"
                          return {
                            ...current,
                            useCustomerTaxInfo: true,
                            taxId: customerTaxId,
                            name:
                              customerTaxId === "CF"
                                ? "CONSUMIDOR FINAL"
                                : guest?.name || invoiceEventTarget.client || "",
                          }
                        })
                      }}
                    >
                      {eventInvoiceForm.useCustomerTaxInfo
                        ? "Facturar a otro nombre"
                        : "Usar datos del cliente"}
                    </Button>
                  </span>
                  <Input
                    value={eventInvoiceForm.taxId}
                    readOnly={eventInvoiceForm.useCustomerTaxInfo}
                    className={eventInvoiceForm.useCustomerTaxInfo ? "bg-muted/40" : undefined}
                    onChange={(event) =>
                      setEventInvoiceForm((current) =>
                        current
                          ? { ...current, taxId: event.target.value.toUpperCase(), name: "" }
                          : current,
                      )
                    }
                  />
                  {!eventInvoiceForm.useCustomerTaxInfo ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 rounded-full px-3 text-xs"
                      onClick={() => void lookupEventInvoiceNitInfo()}
                    >
                      Consultar NIT
                    </Button>
                  ) : null}
                </label>
                <div className="space-y-1 text-sm font-medium">
                  Nombre receptor
                  <div className="flex min-h-10 items-center rounded-2xl border bg-muted/20 px-3 text-sm font-semibold">
                    {eventInvoiceForm.useCustomerTaxInfo
                      ? eventInvoiceForm.name || "CONSUMIDOR FINAL"
                      : eventInvoiceForm.taxId.trim().toUpperCase() === "CF"
                        ? "CONSUMIDOR FINAL"
                        : eventInvoiceForm.name || "Pendiente de consulta DIGIFACT"}
                  </div>
                  {!eventInvoiceForm.useCustomerTaxInfo ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Al tener el endpoint de DIGIFACT aqui se mostrara el nombre fiscal del NIT.
                    </span>
                  ) : null}
                </div>
                <label className="space-y-1 text-sm font-medium">
                  Direccion
                  <Input
                    value={eventInvoiceForm.address}
                    onChange={(event) =>
                      setEventInvoiceForm((current) =>
                        current ? { ...current, address: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Formato
                  <select
                    value={eventInvoiceForm.format}
                    onChange={(event) =>
                      setEventInvoiceForm((current) =>
                        current
                          ? { ...current, format: event.target.value as InvoiceFormat }
                          : current,
                      )
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm"
                  >
                    <option value={INVOICE_FORMATS.PDF_XML}>Documento + archivo de datos</option>
                    <option value={INVOICE_FORMATS.PDF}>Documento</option>
                    <option value={INVOICE_FORMATS.XML}>Archivo de datos</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Concepto
                  <select
                    value={eventInvoiceForm.conceptId}
                    onChange={(event) =>
                      setEventInvoiceForm((current) =>
                        current ? { ...current, conceptId: event.target.value } : current,
                      )
                    }
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm"
                  >
                    {eventInvoiceConcepts.length === 0 ? (
                      <option value={eventInvoiceForm.conceptId}>
                        Concepto {eventInvoiceForm.conceptId}
                      </option>
                    ) : (
                      eventInvoiceConcepts.map((concept) => (
                        <option key={concept.id} value={String(concept.id)}>
                          {concept.id} · {concept.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Monto exacto
                  <Input value={selectedEventInvoiceTotal} disabled />
                  <span className="block text-xs font-normal text-muted-foreground">
                    No se puede dividir un mismo pago.
                  </span>
                </label>
              </div>

              <label className="block space-y-1 text-sm font-medium">
                Descripcion
                <Textarea
                  value={eventInvoiceForm.description}
                  onChange={(event) =>
                    setEventInvoiceForm((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={eventInvoiceSubmitting}
              onClick={() => closeEventInvoice(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full"
              disabled={!canIssueEventInvoice}
              onClick={issueEventInvoice}
            >
              <Receipt className="size-4" />
              {eventInvoiceSubmitting ? "Emitiendo..." : "Emitir factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              className={cn(
                "rounded-full",
                pendingDialog?.tone === "danger"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
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

export default EventosPage
