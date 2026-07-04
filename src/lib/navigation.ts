import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  LayoutDashboard,
  ConciergeBell,
  CalendarRange,
  BedDouble,
  Coffee,
  UtensilsCrossed,
  PartyPopper,
  Boxes,
  Wrench,
  Users,
  UserRoundCheck,
  ScrollText,
  ClipboardList,
  Tags,
  ShieldCheck,
  Settings2,
  Clock3,
  CalendarCheck,
  Building2,
  Package,
  Shirt,
  Beaker,
  ReceiptText,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  badge?: string
  permissions?: string[]
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    label: "General",
    items: [
      {
        title: "Centro de operaciones",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Vista ejecutiva del hotel",
        permissions: ["dashboard"],
      },
    ],
  },
  {
    label: "Recepción",
    items: [
      {
        title: "Reservaciones",
        href: "/recepcion/reservaciones",
        icon: CalendarRange,
        permissions: ["recepcion"],
      },
      {
        title: "Clientes",
        href: "/recepcion/clientes",
        icon: UserRoundCheck,
        permissions: ["recepcion"],
      },
      {
        title: "Check-in / Check-out",
        href: "/recepcion/check-in",
        icon: ConciergeBell,
        permissions: ["recepcion", "facturacion"],
      },
      {
        title: "Clientes al crédito",
        href: "/recepcion/credito",
        icon: ScrollText,
        permissions: ["credito"],
      },
      {
        title: "Cierres de turno",
        href: "/recepcion/cierres",
        icon: ClipboardList,
        permissions: ["recepcion", "facturacion"],
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      {
        title: "Desayunos QR",
        href: "/desayunos",
        icon: Coffee,
        permissions: ["desayunos"],
      },
      {
        title: "Salones y coworking",
        href: "/salones",
        icon: PartyPopper,
        permissions: ["eventos"],
      },
      {
        title: "Habitaciones",
        href: "/habitaciones",
        icon: BedDouble,
        permissions: ["habitaciones"],
      },
      {
        title: "Mantenimiento",
        href: "/mantenimiento",
        icon: Wrench,
        permissions: ["mantenimiento"],
      },
    ],
  },
  {
    label: "Inventarios",
    items: [
      {
        title: "Snacks / minibar",
        href: "/inventarios/snacks",
        icon: UtensilsCrossed,
        permissions: ["inventarios"],
      },
      {
        title: "Blancos y mobiliario",
        href: "/inventarios/blancos",
        icon: Shirt,
        permissions: ["inventarios"],
      },
      {
        title: "Suministros",
        href: "/inventarios/suministros",
        icon: Beaker,
        permissions: ["inventarios"],
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        title: "Reportes de utilidad",
        href: "/reportes",
        icon: BarChart3,
        description: "Utilidad, costos e ingresos por rubro",
        permissions: ["dashboard", "facturacion"],
      },
      {
        title: "Tarifas",
        href: "/administracion/tarifas",
        icon: Tags,
        permissions: ["tarifas"],
      },
      {
        title: "Facturación FEL",
        href: "/administracion/facturacion",
        icon: ReceiptText,
        description: "Historial, DTEs y anulaciones",
        permissions: ["facturacion"],
      },
      {
        title: "Control de créditos",
        href: "/administracion/creditos",
        icon: ShieldCheck,
        permissions: ["creditos.admin"],
      },
      {
        title: "Usuarios y roles",
        href: "/usuarios",
        icon: Users,
        permissions: ["usuarios"],
      },
      {
        title: "Auditoría",
        href: "/administracion/auditoria",
        icon: ShieldCheck,
        permissions: ["auditoria"],
      },
      {
        title: "Configuración",
        href: "/administracion/configuracion",
        icon: Settings2,
        permissions: ["configuracion"],
      },
      {
        title: "Cierres de turno",
        href: "/administracion/configuracion/cierres-turno",
        icon: Clock3,
        description: "Asignar encargados de cierre",
        permissions: ["configuracion"],
      },
    ],
  },
]

export const moduleIcons = {
  dashboard: LayoutDashboard,
  rooms: BedDouble,
  events: PartyPopper,
  inventory: Boxes,
  building: Building2,
  package: Package,
  calendar: CalendarCheck,
}
