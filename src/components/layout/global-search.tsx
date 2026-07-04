"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BedDouble, CalendarRange, ConciergeBell, FileText, User } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useStore } from "@/lib/store"
import { navigation } from "@/lib/navigation"
import {
  canAccessPath,
  filterNavigationForUser,
  type SessionUser,
} from "@/lib/auth"

interface Props {
  currentUser: SessionUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ currentUser, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { reservations, guests, rooms, getGuest } = useStore()
  const [search, setSearch] = useState("")
  const visibleNavigation = filterNavigationForUser(navigation, currentUser)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const go = (href: string) => {
    onOpenChange(false)
    navigate(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar reserva, huésped, habitación..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Sin resultados</CommandEmpty>

        <CommandGroup heading="Navegación">
          {visibleNavigation.flatMap((s) => s.items).map((item) => (
            <CommandItem key={item.href} value={`nav ${item.title}`} onSelect={() => go(item.href)}>
              <item.icon className="size-4" />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {canAccessPath(currentUser, "/recepcion/reservaciones") && (
          <CommandGroup heading="Reservaciones">
            {reservations.slice(0, 8).map((r) => {
            const g = getGuest(r.guestId)
            return (
              <CommandItem
                key={r.id}
                value={`res ${r.code} ${g?.name ?? ""}`}
                onSelect={() => go(`/recepcion/reservaciones?focus=${r.id}`)}
              >
                <CalendarRange className="size-4" />
                <span>{r.code}</span>
                <span className="ml-auto text-xs text-muted-foreground">{g?.name}</span>
              </CommandItem>
            )
            })}
          </CommandGroup>
        )}

        {canAccessPath(currentUser, "/recepcion/clientes") && (
          <CommandGroup heading="Huéspedes">
            {guests.slice(0, 6).map((g) => (
            <CommandItem
              key={g.id}
              value={`guest ${g.name} ${g.document}`}
              onSelect={() => go(`/recepcion/reservaciones?guest=${g.id}`)}
            >
              <User className="size-4" />
              <span>{g.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{g.country}</span>
            </CommandItem>
            ))}
          </CommandGroup>
        )}

        {canAccessPath(currentUser, "/habitaciones") && (
          <CommandGroup heading="Habitaciones">
            {rooms.slice(0, 8).map((r) => (
            <CommandItem
              key={r.id}
              value={`room ${r.number}`}
              onSelect={() => go(`/habitaciones?room=${r.id}`)}
            >
              <BedDouble className="size-4" />
              <span>Habitación {r.number}</span>
              <span className="ml-auto text-xs capitalize text-muted-foreground">{r.status}</span>
            </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Acciones rápidas">
          {canAccessPath(currentUser, "/recepcion/check-in") && (
            <CommandItem value="action checkin" onSelect={() => go("/recepcion/check-in")}>
              <ConciergeBell className="size-4" /> Ir a check-in / check-out
            </CommandItem>
          )}
          {canAccessPath(currentUser, "/recepcion/cierres") && (
            <CommandItem value="action close" onSelect={() => go("/recepcion/cierres")}>
              <FileText className="size-4" /> Cierres de turno
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
