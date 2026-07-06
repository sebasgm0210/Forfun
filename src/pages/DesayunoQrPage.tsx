import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Coffee,
  Loader2,
  MessageSquareText,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiErrorMessage } from "@/lib/api"
import { roomNumberFromQrCode } from "@/lib/breakfast-qr"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { BreakfastOption, BreakfastType } from "@/lib/types"

// El backend valida "beverage" contra una lista fija (sin tildes). Mostramos con tilde por estética
// pero mandamos el valor exacto que el backend acepta.
const drinkChoices = [
  { label: "Café", value: "Cafe" },
  { label: "Té", value: "Te" },
]
const todayIso = () => new Date().toISOString().slice(0, 10)

const BREAKFAST_HOURS_LABEL = "5:00 a.m. a 11:00 a.m."
// Bandera de control: en falso mientras se prueba el flujo; cambiar VITE_BREAKFAST_QR_ENFORCE_HOURS
// a "true" en el .env cuando el hotel quiera exigir el horario de desayunos en producción.
const ENFORCE_BREAKFAST_HOURS = import.meta.env.VITE_BREAKFAST_QR_ENFORCE_HOURS === "true"

function isWithinBreakfastHours(date = new Date()) {
  const hourText = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    hour: "numeric",
    hour12: false,
  }).format(date)
  const hour = Number(hourText) % 24
  return hour >= 5 && hour < 11
}

function BreakfastPhoto({ option }: { option: BreakfastOption }) {
  if (option.imageUrl) {
    return (
      <img
        src={option.imageUrl}
        alt={option.label}
        className="h-28 w-full rounded-2xl object-cover"
      />
    )
  }

  return (
    <div className="grid h-28 w-full place-items-center rounded-2xl border bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-primary">
      <div className="text-center">
        <Utensils className="mx-auto size-7" />
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Foto pendiente
        </p>
      </div>
    </div>
  )
}

function dateInStay(checkIn: string, checkOut: string, date: string) {
  return date >= checkIn && date < checkOut
}

function guestCount(adults: number, children: number) {
  return Math.max(1, adults + children)
}

type SubmittedOrder = {
  optionLabel: string
  drink: string
  notes: string
}

function breakfastSessionKey(qrCode: string | undefined, date: string) {
  return qrCode ? `casaluna-breakfast-session:${qrCode}:${date}` : null
}

function readBreakfastSession(key: string | null): SubmittedOrder[] {
  if (!key) return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SubmittedOrder => typeof item?.optionLabel === "string",
    )
  } catch {
    return []
  }
}

function appendBreakfastSession(key: string | null, order: SubmittedOrder) {
  if (!key) return [order]
  const next = [...readBreakfastSession(key), order]
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.)
  }
  return next
}

type DraftOrder = {
  type: BreakfastType
  drink: string
  notes: string
}

type PersistedCart = {
  drafts: DraftOrder[]
  sentIndices: number[]
  activeIndex: number
}

function breakfastCartKey(qrCode: string | undefined, date: string) {
  return qrCode ? `casaluna-breakfast-cart:${qrCode}:${date}` : null
}

function readBreakfastCart(key: string | null): PersistedCart | null {
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.drafts)) return null
    return {
      drafts: parsed.drafts.filter(
        (item: unknown): item is DraftOrder =>
          Boolean(item) && typeof (item as DraftOrder).type === "string",
      ),
      sentIndices: Array.isArray(parsed.sentIndices) ? parsed.sentIndices : [],
      activeIndex: typeof parsed.activeIndex === "number" ? parsed.activeIndex : 0,
    }
  } catch {
    return null
  }
}

function writeBreakfastCart(key: string | null, cart: PersistedCart) {
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(cart))
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.)
  }
}

function numericBreakfastId(type: BreakfastType) {
  return /^\d+$/.test(type) ? Number(type) : undefined
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

function apiNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(record[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

type PublicQrRoom = {
  stayRoomId: number
  roomNumber: string
  guestName: string
  todayAllowed: number
  todayUsed: number
  todayAvailable: number
}

async function fetchQrRoom(qrCode: string): Promise<PublicQrRoom | null> {
  const roomsResponse = await api.breakfast.listRoomQrCodes<unknown>()
  const matchingRooms = apiArray(roomsResponse)
    .map((value) => apiRecord(value))
    .filter((record) => apiText(record, ["qr_code", "qrCode"]) === qrCode)
    .map((record) => ({
      stayRoomId: apiNumber(record, ["id_stay_room", "idStayRoom"]),
      roomNumber: apiText(record, ["room_number", "roomNumber"]),
      guestName: apiText(record, ["guest_name", "guestName"], "Huésped"),
      todayAllowed: apiNumber(record, ["today_allowed", "todayAllowed"], 1),
      todayUsed: apiNumber(record, ["today_used", "todayUsed"]),
      todayAvailable: apiNumber(record, ["today_available", "todayAvailable"]),
    }))
    .sort((a, b) => b.stayRoomId - a.stayRoomId)
  return matchingRooms[0] ?? null
}

export default function DesayunoQrPage() {
  const { qrCode } = useParams()
  const { breakfastOptions, rooms, reservations, getGuest } = useStore()
  const [serverOptions, setServerOptions] = useState<BreakfastOption[]>([])
  const [qrRoom, setQrRoom] = useState<PublicQrRoom | null>(null)
  const [submittedOrders, setSubmittedOrders] = useState<SubmittedOrder[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [cartInitialized, setCartInitialized] = useState(false)
  const [drafts, setDrafts] = useState<DraftOrder[]>([])
  const [sentIndices, setSentIndices] = useState<Set<number>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [justCompletedNow, setJustCompletedNow] = useState(false)
  const [optionsCarouselApi, setOptionsCarouselApi] = useState<CarouselApi>()
  const outsideHours = ENFORCE_BREAKFAST_HOURS && !isWithinBreakfastHours()
  const options = serverOptions.length ? serverOptions : breakfastOptions
  const firstOption = options[0]
  const sessionKey = breakfastSessionKey(qrCode, todayIso())
  const cartStorageKey = breakfastCartKey(qrCode, todayIso())
  const roomNumber =
    qrRoom?.roomNumber ??
    rooms.find((room) => room.breakfastQrCode === qrCode)?.number ??
    roomNumberFromQrCode(qrCode)

  useEffect(() => {
    setSubmittedOrders(readBreakfastSession(sessionKey))
  }, [sessionKey])

  useEffect(() => {
    let cancelled = false

    async function loadPublicBreakfastData() {
      const [optionsResult, roomResult] = await Promise.allSettled([
        api.breakfast.listOptions<unknown>(),
        qrCode ? fetchQrRoom(qrCode) : Promise.resolve(null),
      ])
      if (cancelled) return

      if (optionsResult.status === "fulfilled") {
        setServerOptions(
          apiArray(optionsResult.value)
            .flatMap((value): BreakfastOption[] => {
              const record = apiRecord(value)
              const id = apiText(record, ["id_breakfast_option", "idBreakfastOption", "id"])
              if (!id) return []
              return [{
                id,
                label: apiText(record, ["name", "label"], "Desayuno"),
                description: apiText(record, ["description"]),
                imageUrl: apiText(record, ["image_url", "imageUrl"]) || undefined,
                accent: "border-amber-200 bg-amber-50 text-amber-950",
              }]
            }),
        )
      }

      if (roomResult.status === "fulfilled") {
        setQrRoom(roomResult.value)
      }
    }

    void loadPublicBreakfastData()
    return () => {
      cancelled = true
    }
  }, [qrCode])

  const room = rooms.find((item) => item.number === roomNumber)
  const activeReservation = useMemo(() => {
    if (!room) return undefined
    const today = todayIso()
    return reservations.find(
      (reservation) =>
        reservation.roomId === room.id &&
        ["in-house", "confirmada"].includes(reservation.status) &&
        dateInStay(reservation.checkIn, reservation.checkOut, today),
    )
  }, [reservations, room])
  const guest = activeReservation ? getGuest(activeReservation.guestId) : undefined
  const qrFound = Boolean(qrRoom || activeReservation)
  const totalAllowed =
    qrRoom?.todayAllowed ??
    (activeReservation ? guestCount(activeReservation.adults, activeReservation.children) : 0)
  const baseUsed = qrRoom?.todayUsed ?? 0

  useEffect(() => {
    if (cartInitialized || !qrFound) return

    const size = Math.max(0, totalAllowed - baseUsed)
    const persisted = readBreakfastCart(cartStorageKey)

    if (persisted && persisted.drafts.length === size && size > 0) {
      setDrafts(persisted.drafts)
      setSentIndices(new Set(persisted.sentIndices.filter((index) => index < size)))
      setActiveIndex(Math.min(persisted.activeIndex, Math.max(0, size - 1)))
    } else {
      setDrafts(
        Array.from({ length: size }, () => ({
          type: firstOption?.id ?? "",
          drink: drinkChoices[0].value,
          notes: "",
        })),
      )
      setSentIndices(new Set())
      setActiveIndex(0)
    }
    setCartInitialized(true)
  }, [cartInitialized, qrFound, totalAllowed, baseUsed, firstOption, cartStorageKey])

  useEffect(() => {
    if (!cartInitialized || !firstOption) return
    setDrafts((current) => {
      let changed = false
      const next = current.map((draft) => {
        if (draft.type && options.some((option) => option.id === draft.type)) return draft
        changed = true
        return { ...draft, type: firstOption.id }
      })
      return changed ? next : current
    })
  }, [cartInitialized, firstOption, options])

  useEffect(() => {
    if (!cartInitialized) return
    writeBreakfastCart(cartStorageKey, {
      drafts,
      sentIndices: Array.from(sentIndices),
      activeIndex,
    })
  }, [cartInitialized, drafts, sentIndices, activeIndex, cartStorageKey])

  const usedToday = baseUsed + sentIndices.size
  const availableToday = qrFound ? Math.max(0, totalAllowed - usedToday) : 0
  const allOrdersDone = qrFound && cartInitialized && sentIndices.size >= drafts.length
  const activeDraft = drafts[activeIndex]
  const isLastSlot = activeIndex === drafts.length - 1
  const guestNumber = baseUsed + activeIndex + 1
  const canAct = Boolean(
    qrCode && qrFound && cartInitialized && activeDraft && !submitting && drafts.length > 0,
  )

  useEffect(() => {
    if (!optionsCarouselApi) return
    const index = options.findIndex((option) => option.id === activeDraft?.type)
    optionsCarouselApi.scrollTo(index >= 0 ? index : 0, true)
  }, [optionsCarouselApi, activeIndex])

  const [canScrollPrevOption, setCanScrollPrevOption] = useState(false)
  const [canScrollNextOption, setCanScrollNextOption] = useState(false)
  const [currentOptionSlide, setCurrentOptionSlide] = useState(0)

  useEffect(() => {
    if (!optionsCarouselApi) return
    const onSelect = () => {
      setCanScrollPrevOption(optionsCarouselApi.canScrollPrev())
      setCanScrollNextOption(optionsCarouselApi.canScrollNext())
      const snap = optionsCarouselApi.selectedScrollSnap()
      setCurrentOptionSlide(snap)
      const option = options[snap]
      if (option) {
        setDrafts((current) =>
          current.map((draft, index) =>
            index === activeIndex ? { ...draft, type: option.id } : draft,
          ),
        )
      }
    }
    onSelect()
    optionsCarouselApi.on("select", onSelect)
    optionsCarouselApi.on("reInit", onSelect)
    return () => {
      optionsCarouselApi.off("select", onSelect)
      optionsCarouselApi.off("reInit", onSelect)
    }
  }, [optionsCarouselApi, activeIndex, options])

  function updateActiveDraft(patch: Partial<DraftOrder>) {
    setDrafts((current) =>
      current.map((draft, index) => (index === activeIndex ? { ...draft, ...patch } : draft)),
    )
  }

  async function confirmAllDrafts() {
    if (!qrCode) return
    setSubmitting(true)

    for (let index = 0; index < drafts.length; index += 1) {
      if (sentIndices.has(index)) continue
      const draft = drafts[index]
      const option = options.find((item) => item.id === draft.type)
      const optionId = option ? numericBreakfastId(option.id) : undefined
      if (!option || !optionId) {
        toast.error(`El huésped ${index + 1} no tiene un desayuno válido seleccionado`)
        setActiveIndex(index)
        setSubmitting(false)
        return
      }

      try {
        await api.breakfast.createSelectionFromQr({
          qr_code: qrCode,
          id_breakfast_option: optionId,
          beverage: draft.drink,
          guest_name: guest?.name,
          notes: draft.notes.trim(),
        })
        setSentIndices((current) => new Set(current).add(index))
        setSubmittedOrders(
          appendBreakfastSession(sessionKey, {
            optionLabel: option.label,
            drink: draft.drink,
            notes: draft.notes.trim(),
          }),
        )
      } catch (error) {
        toast.error(`No se pudo enviar el pedido del huésped ${index + 1}`, {
          description: getApiErrorMessage(error),
        })
        setActiveIndex(index)
        setSubmitting(false)
        return
      }
    }

    toast.success("Desayunos confirmados")
    setJustCompletedNow(true)
    setSubmitting(false)
  }

  function handlePrimaryAction() {
    if (!canAct) return
    if (!isLastSlot) {
      setActiveIndex((index) => Math.min(drafts.length - 1, index + 1))
      toast.success("Agregado al carrito", {
        description: `Huésped ${activeIndex + 1} de ${drafts.length}`,
      })
      return
    }
    void confirmAllDrafts()
  }

  return (
    <main className="min-h-screen bg-[#fff8ee] px-4 py-6 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col rounded-[2rem] border bg-white p-5 shadow-xl">
        <header className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Coffee className="size-6" />
          </div>
          <div>
            <p className="font-serif text-2xl">Casa Luna</p>
            <p className="text-sm text-muted-foreground">Desayuno de cortesía</p>
          </div>
        </header>

        <div className="mt-5 rounded-2xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Habitación</p>
          <p className="mt-1 text-2xl font-bold">{roomNumber || "-"}</p>
          <p className="text-sm text-muted-foreground">
            {qrRoom?.guestName ?? guest?.name ?? "Validaremos tu estadía al enviar"}
          </p>
          <p className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
            {qrFound ? `${availableToday} desayuno(s) disponible(s) hoy` : "QR no encontrado"}
          </p>
          {qrFound ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Asignados</p>
                <p className="mt-1 font-bold">{totalAllowed}</p>
              </div>
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Canjeados</p>
                <p className="mt-1 font-bold">{usedToday}</p>
              </div>
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Pendientes</p>
                <p className="mt-1 font-bold">{availableToday}</p>
              </div>
            </div>
          ) : null}
        </div>

        {submittedOrders.length > 0 ? (
          <div className="mt-4 space-y-2 rounded-2xl border bg-muted/10 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ya enviados desde este teléfono
            </p>
            {submittedOrders.map((order, index) => (
              <div key={`${order.optionLabel}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                <p className="font-semibold">
                  Huésped {index + 1}: {order.optionLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.drink}
                  {order.notes ? ` · ${order.notes}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {!cartInitialized ? (
          <div className="mt-5 grid flex-1 place-items-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : outsideHours ? (
          <div className="mt-5 grid flex-1 place-items-center rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-950">
            <div>
              <Clock3 className="mx-auto size-12" />
              <h1 className="mt-4 text-2xl font-bold">Servicio de desayuno no disponible</h1>
              <p className="mt-2 text-sm">
                Con mucho gusto le atenderemos en nuestro horario de desayunos de cortesía,
                de {BREAKFAST_HOURS_LABEL}. Le invitamos a escanear nuevamente este código
                dentro de ese horario.
              </p>
              <p className="mt-4 text-xs text-amber-900/70">
                Si necesita asistencia, nuestro equipo de recepción estará encantado de ayudarle.
              </p>
            </div>
          </div>
        ) : allOrdersDone ? (
          <div className="mt-5 grid flex-1 place-items-center rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950">
            <div>
              <BadgeCheck className="mx-auto size-12" />
              {justCompletedNow ? (
                <>
                  <h1 className="mt-4 text-2xl font-bold">¡Su pedido ha sido recibido!</h1>
                  <p className="mt-2 text-sm">
                    Nuestro equipo de cocina ya fue notificado y preparará su desayuno con
                    mucho gusto.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-4 text-2xl font-bold">Su habitación ya no tiene desayunos disponibles</h1>
                  <p className="mt-2 text-sm">
                    Hemos verificado que los {totalAllowed} desayuno(s) de cortesía asignados a
                    su habitación ya fueron solicitados el día de hoy.
                  </p>
                </>
              )}
              <p className="mt-4 text-xs text-emerald-900/70">
                Si considera que esto es un error o necesita ayuda adicional, con gusto le
                atenderemos en recepción.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex-1 space-y-4">
            {drafts.length > 1 ? (
              <div className="space-y-2">
                <p className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
                  Selecciona el desayuno del huésped {guestNumber} de {totalAllowed}
                </p>
                <div className="flex flex-wrap gap-2">
                  {drafts.map((_, index) => {
                    const sent = sentIndices.has(index)
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={sent}
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          sent
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : activeIndex === index
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:border-primary/40",
                        )}
                      >
                        {sent ? <Check className="size-3.5" /> : null}
                        Huésped {baseUsed + index + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <Carousel setApi={setOptionsCarouselApi} className="w-full">
              <CarouselContent>
                {options.map((option) => {
                  const selected = activeDraft?.type === option.id
                  return (
                    <CarouselItem key={option.id}>
                      <button
                        type="button"
                        onClick={() => updateActiveDraft({ type: option.id })}
                        className={cn(
                          "w-full rounded-3xl border-2 bg-background p-3 text-left transition",
                          selected
                            ? "border-primary bg-primary/10 shadow-md"
                            : "border-transparent",
                        )}
                      >
                        <BreakfastPhoto option={option} />
                        <div className="mt-3">
                          <p className="text-lg font-bold">{option.label}</p>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
            </Carousel>

            {options.length > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full"
                  onClick={() => optionsCarouselApi?.scrollPrev()}
                  disabled={!canScrollPrevOption}
                >
                  <ArrowLeft className="size-4" />
                  Anterior
                </Button>
                <p className="text-sm text-muted-foreground">
                  {currentOptionSlide + 1} de {options.length}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full"
                  onClick={() => optionsCarouselApi?.scrollNext()}
                  disabled={!canScrollNextOption}
                >
                  Siguiente
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}

            <label className="space-y-2 text-sm font-medium">
              Bebida
              <select
                value={activeDraft?.drink ?? drinkChoices[0].value}
                onChange={(event) => updateActiveDraft({ drink: event.target.value })}
                className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {drinkChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Observaciones
              <div className="relative">
                <MessageSquareText className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Textarea
                  value={activeDraft?.notes ?? ""}
                  onChange={(event) => updateActiveDraft({ notes: event.target.value })}
                  className="min-h-24 rounded-2xl pl-9"
                  placeholder="Sin cebolla, sin azúcar, entregar después de las 8:30..."
                />
              </div>
            </label>
            {!qrFound ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Este código QR no aparece en el endpoint de habitaciones con desayuno.
              </div>
            ) : null}
          </div>
        )}

        {cartInitialized && !outsideHours && !allOrdersDone ? (
          <Button
            className="mt-5 h-12 gap-2 rounded-full"
            onClick={handlePrimaryAction}
            disabled={!canAct}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            {isLastSlot ? "Confirmar desayuno" : "Agregar al carrito"}
          </Button>
        ) : null}
      </section>
    </main>
  )
}
