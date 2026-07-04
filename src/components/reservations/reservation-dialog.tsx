"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, BedDouble, User, Phone, Globe2, FileText, AlertCircle } from "lucide-react"
import { toast } from "sonner"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MoneyInput } from "@/components/modules/view-kit"
import { useStore, formatQ } from "@/lib/store"
import type { Reservation, ReservationSource } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRoomId?: string
  defaultDates?: { checkIn: string; checkOut: string }
}

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const tomorrowISO = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function ReservationDialog({ open, onOpenChange, defaultRoomId, defaultDates }: Props) {
  const { roomTypes, availableRoomsFor, getRoomType, dispatch, reservations } = useStore()

  const [checkIn, setCheckIn] = useState(defaultDates?.checkIn ?? todayISO())
  const [checkOut, setCheckOut] = useState(defaultDates?.checkOut ?? tomorrowISO())
  const [typeId, setTypeId] = useState<string>("")
  const [roomId, setRoomId] = useState(defaultRoomId ?? "")
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [source, setSource] = useState<ReservationSource>("directo")
  const [name, setName] = useState("")
  const [document, setDocumentVal] = useState("")
  const [docType, setDocType] = useState<"DPI" | "Pasaporte">("DPI")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [country, setCountry] = useState("Guatemala")
  const [notes, setNotes] = useState("")
  const [abono, setAbono] = useState(0)

  useEffect(() => {
    if (open) {
      setCheckIn(defaultDates?.checkIn ?? todayISO())
      setCheckOut(defaultDates?.checkOut ?? tomorrowISO())
      setRoomId(defaultRoomId ?? "")
    }
  }, [open, defaultRoomId, defaultDates])

  const nights = nightsBetween(checkIn, checkOut)
  const availableRooms = useMemo(
    () => availableRoomsFor(checkIn, checkOut, typeId || undefined),
    [availableRoomsFor, checkIn, checkOut, typeId],
  )
  const selectedType = typeId ? getRoomType(typeId) : undefined
  const rate = selectedType?.basePrice ?? 0
  const total = rate * nights

  const canSubmit =
    name.trim().length > 1 &&
    document.trim().length > 4 &&
    roomId &&
    nights > 0 &&
    abono >= 0 &&
    abono <= total

  const submit = () => {
    if (!canSubmit) return
    const id = `res-${Date.now()}`
    const code = `RES-${1100 + reservations.length}`
    const guestId = `g-${Date.now()}`
    const payments =
      abono > 0
        ? [
            {
              id: `pay-${Date.now()}`,
              method: "efectivo" as const,
              amount: abono,
              reference: "Abono inicial",
              stage: "reserva" as const,
              date: todayISO(),
            },
          ]
        : []
    const reservation: Reservation = {
      id,
      code,
      guestId,
      roomId,
      checkIn,
      checkOut,
      nights,
      adults,
      children,
      rate,
      total,
      paid: abono,
      status: "confirmada",
      source,
      notes,
      createdAt: todayISO(),
      payments,
    }
    dispatch({
      type: "RES_CREATE",
      reservation,
      guest: {
        id: guestId,
        name,
        document,
        documentType: docType,
        nit: "CF",
        email,
        phone,
        country,
      },
    })
    toast.success(`Reservación ${code} creada`, {
      description: `${name} · ${nights} noche(s) · ${formatQ(total)}`,
    })
    onOpenChange(false)
    // Reset
    setName("")
    setDocumentVal("")
    setPhone("")
    setEmail("")
    setNotes("")
    setAbono(0)
    setRoomId("")
    setTypeId("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nueva reservación</DialogTitle>
          <DialogDescription>
            Verifica disponibilidad real, registra al huésped y bloquea la habitación.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Fechas y tipo */}
          <section className="grid gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarRange className="size-4 text-primary" /> Estancia
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ci">Check-in</Label>
                <Input id="ci" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="co">Check-out</Label>
                <Input id="co" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Adultos</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={adults || ""}
                  onChange={(e) =>
                    setAdults(
                      e.target.value === ""
                        ? 0
                        : Math.min(10, Math.max(1, Number(e.target.value))),
                    )
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Niños</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={children || ""}
                  onChange={(e) =>
                    setChildren(
                      e.target.value === ""
                        ? 0
                        : Math.min(10, Math.max(0, Number(e.target.value))),
                    )
                  }
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Habitación */}
          <section className="grid gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <BedDouble className="size-4 text-primary" /> Habitación disponible
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo de habitación</Label>
                <Select value={typeId || "any"} onValueChange={(v) => { setTypeId(v === "any" ? "" : v); setRoomId("") }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cualquier tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquier tipo</SelectItem>
                    {roomTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {formatQ(t.basePrice)}/noche
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Habitación asignada</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`${availableRooms.length} disponibles`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        Sin disponibilidad para esas fechas
                      </div>
                    ) : (
                      availableRooms.map((r) => {
                        const t = getRoomType(r.typeId)
                        return (
                          <SelectItem key={r.id} value={r.id}>
                            Habitacion {r.number} · {t?.name} · {formatQ(t?.basePrice ?? 0)}
                          </SelectItem>
                        )
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {availableRooms.length === 0 && nights > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 size-4 flex-none" />
                <span>
                  No hay habitaciones del tipo seleccionado para esas fechas. Cambia el tipo o ajusta el rango.
                </span>
              </div>
            )}
          </section>

          <Separator />

          {/* Huésped */}
          <section className="grid gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <User className="size-4 text-primary" /> Huésped principal
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nombre completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Andrea Morales" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1.5">
                  <Label>Tipo doc.</Label>
                  <Select value={docType} onValueChange={(v) => setDocType(v as "DPI" | "Pasaporte")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DPI">DPI</SelectItem>
                      <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 grid gap-1.5">
                  <Label>Documento</Label>
                  <Input value={document} onChange={(e) => setDocumentVal(e.target.value)} placeholder="Número" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5"><Phone className="size-3" /> Teléfono</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+502 ..." />
              </div>
              <div className="grid gap-1.5">
                <Label>Correo</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="huesped@correo.com" />
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5"><Globe2 className="size-3" /> País</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Origen de la reserva</Label>
                <Select value={source} onValueChange={(v) => setSource(v as ReservationSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="directo">Directo</SelectItem>
                    <SelectItem value="booking">Booking.com</SelectItem>
                    <SelectItem value="expedia">Expedia</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="agencia">Agencia</SelectItem>
                    <SelectItem value="corporativo">Corporativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Notas y total */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5"><FileText className="size-3" /> Notas internas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Solicitudes especiales..." rows={4} />
            </div>
            <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tarifa por noche</span>
                <span className="font-medium">{formatQ(rate)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Noches</span>
                <span className="font-medium">{nights}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-serif text-xl text-primary">{formatQ(total)}</span>
              </div>
              <div className="grid gap-1.5">
                <Label>Abono (opcional)</Label>
                <MoneyInput
                  min={0}
                  max={total}
                  value={abono || ""}
                  onChange={(e) =>
                    setAbono(
                      e.target.value === ""
                        ? 0
                        : Math.min(total, Math.max(0, Number(e.target.value))),
                    )
                  }
                />
              </div>
              <Badge variant={abono > 0 ? "default" : "outline"} className="w-fit">
                {abono > 0 ? "Reserva con abono" : "Reserva sin abono inicial"}
              </Badge>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Crear reservación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
