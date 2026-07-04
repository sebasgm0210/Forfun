import type { ComponentType } from "react"
import AdminCierresTurnoPage from "@/pages/AdminCierresTurnoPage"
import AdminCreditosPage from "@/pages/AdminCreditosPage"
import AdminFacturacionPage from "@/pages/AdminFacturacionPage"
import AuditoriaPage from "@/pages/AuditoriaPage"
import ConfiguracionPage from "@/pages/ConfiguracionPage"
import DashboardPage from "@/pages/DashboardPage"
import DesayunosPage from "@/pages/DesayunosPage"
import EventosPage from "@/pages/EventosPage"
import HabitacionesPage from "@/pages/HabitacionesPage"
import InventariosBlancosPage from "@/pages/InventariosBlancosPage"
import InventariosSnacksPage from "@/pages/InventariosSnacksPage"
import InventariosSuministrosPage from "@/pages/InventariosSuministrosPage"
import MantenimientoPage from "@/pages/MantenimientoPage"
import RecepcionClientesPage from "@/pages/RecepcionClientesPage"
import RecepcionCheckinPage from "@/pages/RecepcionCheckinPage"
import RecepcionCierresPage from "@/pages/RecepcionCierresPage"
import RecepcionCreditoPage from "@/pages/RecepcionCreditoPage"
import RecepcionReservacionesPage from "@/pages/RecepcionReservacionesPage"
import ReportesPage from "@/pages/ReportesPage"
import TarifasPage from "@/pages/TarifasPage"
import UsuariosPage from "@/pages/UsuariosPage"

export const appRoutes: Array<{ path: string; component: ComponentType }> = [
  { path: "/dashboard", component: DashboardPage },
  { path: "/reportes", component: ReportesPage },
  { path: "/administracion/auditoria", component: AuditoriaPage },
  { path: "/administracion/configuracion", component: ConfiguracionPage },
  { path: "/administracion/configuracion/cierres-turno", component: AdminCierresTurnoPage },
  { path: "/administracion/creditos", component: AdminCreditosPage },
  { path: "/administracion/facturacion", component: AdminFacturacionPage },
  { path: "/administracion/tarifas", component: TarifasPage },
  { path: "/desayunos", component: DesayunosPage },
  { path: "/eventos", component: EventosPage },
  { path: "/salones", component: EventosPage },
  { path: "/habitaciones", component: HabitacionesPage },
  { path: "/inventarios/blancos", component: InventariosBlancosPage },
  { path: "/inventarios/snacks", component: InventariosSnacksPage },
  { path: "/inventarios/suministros", component: InventariosSuministrosPage },
  { path: "/mantenimiento", component: MantenimientoPage },
  { path: "/recepcion/clientes", component: RecepcionClientesPage },
  { path: "/recepcion/check-in", component: RecepcionCheckinPage },
  { path: "/recepcion/estancias-activas", component: RecepcionCheckinPage },
  { path: "/recepcion/cierres", component: RecepcionCierresPage },
  { path: "/recepcion/credito", component: RecepcionCreditoPage },
  { path: "/recepcion/reservaciones", component: RecepcionReservacionesPage },
  { path: "/usuarios", component: UsuariosPage },
]
