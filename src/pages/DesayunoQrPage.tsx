import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { BadgeCheck, Coffee, Loader2, MessageSquareText, Utensils } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiErrorMessage } from "@/lib/api"
import { roomNumberFromQrCode } from "@/lib/breakfast-qr"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { BreakfastOption, BreakfastType } from "@/lib/types"

const drinkOptions = ["Café", "Té", "Jugo natural", "Agua pura"]
const todayIso = () => new Date().toISOString().slice(0, 10)

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

export default function DesayunoQrPage() {
  const { qrCode } = useParams()
  const { breakfastOptions, rooms, reservations, getGuest } = useStore()
  const [serverOptions, setServerOptions] = useState<BreakfastOption[]>([])
  const [qrRoom, setQrRoom] = useState<PublicQrRoom | null>(null)
  const options = serverOptions.length ? serverOptions : breakfastOptions
  const firstOption = options[0]
  const [selectedType, setSelectedType] = useState<BreakfastType>(firstOption?.id ?? "")
  const [drink, setDrink] = useState(drinkOptions[0])
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const roomNumber =
    qrRoom?.roomNumber ??
    rooms.find((room) => room.breakfastQrCode === qrCode)?.number ??
    roomNumberFromQrCode(qrCode)

  useEffect(() => {
    let cancelled = false

    async function loadPublicBreakfastData() {
      const [optionsResult, roomsResult] = await Promise.allSettled([
        api.breakfast.listOptions<unknown>(),
        api.breakfast.listRoomQrCodes<unknown>(),
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

      if (roomsResult.status === "fulfilled" && qrCode) {
        const matchingRooms = apiArray(roomsResult.value)
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
        setQrRoom(matchingRooms[0] ?? null)
      }
    }

    void loadPublicBreakfastData()
    return () => {
      cancelled = true
    }
  }, [qrCode])

  useEffect(() => {
    if (!options.some((option) => option.id === selectedType)) {
      setSelectedType(options[0]?.id ?? "")
    }
  }, [options, selectedType])

  const selectedOption = options.find((option) => option.id === selectedType) ?? firstOption
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
  const availableToday = qrRoom
    ? qrRoom.todayAvailable
    : activeReservation
    ? guestCount(activeReservation.adults, activeReservation.children)
    : 0
  const qrFound = Boolean(qrRoom || activeReservation)
  const canSubmit = Boolean(selectedOption && qrCode && qrFound && availableToday > 0 && !sent && !submitting)

  async function submitSelection() {
    if (!selectedOption || !qrCode) return
    const optionId = numericBreakfastId(selectedOption.id)
    if (!optionId) {
      toast.error("La opción de desayuno no tiene un identificador válido del servidor")
      return
    }

    setSubmitting(true)
    try {
      await api.breakfast.createSelectionFromQr({
        qr_code: qrCode,
        id_breakfast_option: optionId,
        beverage: drink,
        guest_name: guest?.name,
        notes: notes.trim(),
      })
      setSent(true)
      toast.success("Desayuno enviado")
    } catch (error) {
      toast.error("No se pudo enviar el desayuno", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSubmitting(false)
    }
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
            {qrRoom || activeReservation
              ? `${availableToday} desayuno(s) disponible(s) hoy`
              : "QR no encontrado"}
          </p>
          {qrRoom ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Asignados</p>
                <p className="mt-1 font-bold">{qrRoom.todayAllowed}</p>
              </div>
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Canjeados</p>
                <p className="mt-1 font-bold">{qrRoom.todayUsed}</p>
              </div>
              <div className="rounded-xl border bg-white px-2 py-2">
                <p className="text-muted-foreground">Pendientes</p>
                <p className="mt-1 font-bold">{qrRoom.todayAvailable}</p>
              </div>
            </div>
          ) : null}
        </div>

        {sent ? (
          <div className="mt-5 grid flex-1 place-items-center rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950">
            <div>
              <BadgeCheck className="mx-auto size-12" />
              <h1 className="mt-4 text-2xl font-bold">Pedido recibido</h1>
              <p className="mt-2 text-sm">
                Recepción ya puede verlo para preparar y canjear tu desayuno.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex-1 space-y-4">
            <div className="grid gap-3">
              {options.map((option) => {
                const selected = selectedOption?.id === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedType(option.id)}
                    className={cn(
                      "rounded-3xl border bg-background p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40",
                      selected && "border-primary shadow-md",
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
                )
              })}
            </div>

            <label className="space-y-2 text-sm font-medium">
              Bebida
              <select
                value={drink}
                onChange={(event) => setDrink(event.target.value)}
                className="h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {drinkOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Observaciones
              <div className="relative">
                <MessageSquareText className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
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
            {qrFound && availableToday <= 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Ya no hay desayunos pendientes para esta habitación hoy.
              </div>
            ) : null}
          </div>
        )}

        {!sent ? (
          <Button
            className="mt-5 h-12 gap-2 rounded-full"
            onClick={submitSelection}
            disabled={!canSubmit}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            Confirmar desayuno
          </Button>
        ) : null}
      </section>
    </main>
  )
}
