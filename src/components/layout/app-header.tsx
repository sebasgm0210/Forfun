"use client"

import { Bell, Calendar, LogOut, Search } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocation } from "react-router-dom"
import { navigation } from "@/lib/navigation"
import { GlobalSearch } from "@/components/layout/global-search"
import { ViewExportMenu } from "@/components/layout/view-export-menu"
import { formatQ, useStore, type BackendResource } from "@/lib/store"
import {
  DEFAULT_ADMIN_SESSION,
  canAccessPath,
  filterNavigationForUser,
  getUserInitials,
  getUserRoleLabel,
  type SessionUser,
} from "@/lib/auth"

function useCurrentDate() {
  const [date, setDate] = useState<string>("")
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("es-GT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    setDate(formatter.format(new Date()))
  }, [])
  return date
}

function getBreadcrumbs(pathname: string, visibleNavigation: typeof navigation) {
  for (const section of visibleNavigation) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return { section: section.label, page: item.title }
      }
    }
  }
  return { section: "General", page: "Casa Luna" }
}

const ROUTE_BACKEND_RESOURCES: Array<{ path: string; resources: BackendResource[] }> = [
  {
    path: "/dashboard",
    resources: ["rooms", "reservations", "guests", "creditAccounts", "events", "maintenance", "inventory"],
  },
  {
    path: "/reportes",
    resources: ["rooms", "reservations", "guests", "creditAccounts", "events", "maintenance", "cashCloses"],
  },
  { path: "/recepcion/reservaciones", resources: ["guests", "roomTypes", "rooms", "reservations", "creditAccounts"] },
  { path: "/recepcion/clientes", resources: ["guests", "reservations", "creditAccounts"] },
  { path: "/recepcion/check-in", resources: ["guests", "rooms", "reservations", "creditAccounts"] },
  { path: "/recepcion/credito", resources: ["guests", "creditAccounts", "creditMovements", "creditAuthorizationRequests"] },
  { path: "/recepcion/cierres", resources: ["cashCloses"] },
  { path: "/desayunos", resources: ["breakfastOptions", "breakfasts", "rooms", "reservations"] },
  { path: "/salones", resources: ["salons", "events", "creditAccounts"] },
  { path: "/eventos", resources: ["salons", "events", "creditAccounts"] },
  { path: "/habitaciones", resources: ["roomTypes", "rooms", "roomRateOptions"] },
  { path: "/mantenimiento", resources: ["maintenance", "rooms"] },
  {
    path: "/inventarios/snacks",
    resources: [
      "inventory",
      "inventoryMovements",
      "rooms",
      "reservations",
      "guests",
      "users",
    ],
  },
  { path: "/inventarios/blancos", resources: ["rooms"] },
  {
    path: "/inventarios/suministros",
    resources: ["inventory", "inventoryMovements", "users"],
  },
  { path: "/administracion/tarifas", resources: ["roomTypes"] },
  { path: "/administracion/creditos", resources: ["guests", "creditAccounts", "creditAuthorizationRequests"] },
  { path: "/usuarios", resources: ["users", "roles", "menuRoles"] },
  { path: "/administracion/auditoria", resources: [] },
  { path: "/administracion/configuracion/cierres-turno", resources: ["cashShiftConfigs", "users"] },
  { path: "/administracion/configuracion", resources: [] },
]

function getRouteResources(pathname: string) {
  return ROUTE_BACKEND_RESOURCES
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.resources ?? []
}

export function AppHeader({
  currentUser,
  onLogout,
}: {
  currentUser: SessionUser | null
  onLogout: () => void
}) {
  const today = useCurrentDate()
  const { pathname } = useLocation()
  const user = currentUser ?? DEFAULT_ADMIN_SESSION
  const visibleNavigation = filterNavigationForUser(navigation, user)
  const { section, page } = getBreadcrumbs(pathname, visibleNavigation)
  const isRoomsPage = pathname === "/habitaciones"
  const [searchOpen, setSearchOpen] = useState(false)
  const { creditAccounts, inventory, maintenance, refreshApiState } = useStore()

  useEffect(() => {
    const resources = getRouteResources(pathname)
    if (resources.length === 0) return

    // Carga inicial por vista solamente.
    // Antes se refrescaba tambien al volver el foco y cada 30s, lo que generaba
    // multiples requests extra mientras recepción estaba operando una card.
    void refreshApiState(resources, { force: false })
  }, [pathname, refreshApiState])

  // Generar notificaciones derivadas del estado real
  const notifications = [
    ...creditAccounts
      .filter((c) => c.status === "vencido")
      .map((c) => ({
        id: `cred-${c.id}`,
        title: `Crédito vencido · ${c.company}`,
        detail: `Saldo ${formatQ(c.balance)}`,
        href: "/recepcion/credito",
      })),
    ...inventory
      .filter((i) => i.stock <= i.minStock)
      .slice(0, 3)
      .map((i) => ({
        id: `inv-${i.id}`,
        title: `Stock bajo · ${i.name}`,
        detail: `Quedan ${i.stock} ${i.unit}`,
        href: `/inventarios/${i.category === "snack" ? "snacks" : i.category === "blanco" ? "blancos" : "suministros"}`,
      })),
    ...maintenance
      .filter((m) => m.priority === "urgente" && m.status !== "resuelto")
      .map((m) => ({
        id: `mto-${m.id}`,
        title: `Mantenimiento urgente · ${m.code}`,
        detail: m.description,
        href: "/mantenimiento",
      })),
  ].filter((item) => canAccessPath(user, item.href))

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-border/70 bg-background/85 px-3 backdrop-blur-md sm:gap-3 md:px-5">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground md:hidden" />
        <Separator orientation="vertical" className="h-5 md:hidden" />

        <Breadcrumb className="hidden min-w-0 max-w-[min(34vw,420px)] overflow-hidden lg:block">
          <BreadcrumbList className="text-xs tracking-wide">
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard" className="font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Casa Luna
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <span className="block truncate uppercase tracking-[0.2em] text-muted-foreground/70">{section}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="block truncate font-semibold text-foreground">{page}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
          {!isRoomsPage && (
            <>
              {/* Búsqueda global */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="relative hidden h-9 w-56 items-center gap-2 rounded-full border border-border/80 bg-card pl-9 pr-3 text-left text-sm text-muted-foreground shadow-none transition hover:border-primary/40 hover:text-foreground xl:flex 2xl:w-72"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <span className="truncate">Buscar reserva, huésped, habitación...</span>
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
                  ⌘ K
                </kbd>
              </button>

              {/* Búsqueda mobile */}
              <Button
                variant="ghost"
                size="icon"
                className="xl:hidden"
                aria-label="Buscar"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
            </>
          )}

          {/* Fecha */}
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground 2xl:flex">
            <Calendar className="size-3.5 text-primary" />
            <span className="capitalize">{today || "—"}</span>
          </div>

          <ViewExportMenu title={page} />

          {/* Notificaciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notificaciones">
                <Bell className="size-4" />
                {notifications.length > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full border-2 border-background bg-destructive p-0 text-[10px] text-destructive-foreground">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
              <DropdownMenuLabel>Alertas operativas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Todo en orden</div>
              )}
              {notifications.slice(0, 8).map((n) => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link to={n.href} className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.detail}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toast.success("Notificaciones marcadas como leídas")}
              >
                Marcar todas como leídas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sesión */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Cuenta">
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getUserInitials(user)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span>{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {getUserRoleLabel(user)}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAccessPath(user, "/usuarios") && (
                <DropdownMenuItem asChild>
                  <Link to="/usuarios">Mi cuenta</Link>
                </DropdownMenuItem>
              )}
              {canAccessPath(user, "/recepcion/cierres") && (
                <DropdownMenuItem asChild>
                  <Link to="/recepcion/cierres">Cierres de turno</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  toast.info("Sesión cerrada", { description: "Hasta luego" })
                  onLogout()
                }}
              >
                <LogOut className="mr-2 size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <GlobalSearch currentUser={user} open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}

// Hidden Input ref for build-tooling parity
export const _RawInput = Input
