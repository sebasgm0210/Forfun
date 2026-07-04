import { getLatestExportState } from "./export-state"
import { buildAdvancedReportAnalysis } from "./reporting"
import type { State } from "./store"
import type {
  CashClose,
  CreditAccount,
  InventoryCategory,
  InventoryItem,
  Reservation,
} from "./types"

export type ViewExportFormat = "excel" | "word" | "pdf" | "print"

type ExportViewOptions = {
  title: string
  format: ViewExportFormat
  from?: string
  to?: string
}

type CellKind = "text" | "number" | "money" | "percent" | "date"
type Tone = "default" | "success" | "warning" | "danger" | "info"

type ExportCellObject = {
  value: string | number
  display?: string
  kind?: CellKind
  style?: string
  mergeAcross?: number
}

type ExportCell = string | number | ExportCellObject | null | undefined

type ExportMetric = {
  label: string
  value: string
  helper?: string
  raw?: number
  kind?: CellKind
  tone?: Tone
}

type ExportFilter = {
  label: string
  value: string
}

type ExportSection = {
  title: string
  body: string[]
  tone?: Tone
}

type ExportChartItem = {
  label: string
  value: number
  valueLabel?: string
  tone?: Tone
}

type ExportChart = {
  title: string
  description?: string
  data: ExportChartItem[]
}

type ExportTable = {
  title: string
  description?: string
  headers: string[]
  rows: ExportCell[][]
}

type ExportReport = {
  title: string
  description?: string
  fileName?: string
  generatedAt: string
  filters: ExportFilter[]
  metrics: ExportMetric[]
  charts: ExportChart[]
  sections: ExportSection[]
  tables: ExportTable[]
}

type ExportDateRange = {
  from: string
  to: string
  label: string
  fileSuffix: string
  isSingleDay: boolean
}

const EXPORT_ROOT_SELECTOR = "[data-view-export-root]"
const LOGO_PATH = "/casa-luna-logo.jpg"
const CONTROL_SELECTOR = "input, textarea, select"
const CARD_SELECTOR = "[data-slot='card']"
const TABLE_SELECTOR = "table"
const CLEANUP_SELECTOR = [
  "[data-export-exclude]",
  ".no-print",
  "button",
  "script",
  "style",
  "svg",
  "canvas",
  "[role='tab']",
  "[role='tablist']",
  "[hidden]",
  "[aria-hidden='true']",
  "[data-state='inactive']",
].join(",")

const statusLabels: Record<string, string> = {
  "al dia": "Al dia",
  "por vencer": "Por vencer",
  vencido: "Vencido",
  activo: "Activo",
  pausado: "Pausado",
  bloqueado: "Bloqueado",
  autorizado: "Autorizado",
  disponible: "Disponible",
  ocupada: "Ocupada",
  reservada: "Reservada",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  "ready-for-check-in": "Lista para check-in",
  "in-house": "En casa",
  checkout: "Check-out",
  cancelada: "Cancelada",
  "no-show": "No-show",
  abierto: "Abierto",
  "en progreso": "En progreso",
  resuelto: "Resuelto",
  emitida: "Emitida",
  anulada: "Anulada",
}

const toneClass: Record<Tone, string> = {
  default: "tone-default",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
  info: "tone-info",
}

export function exportCurrentView({ title, format, from, to }: ExportViewOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return

  const range = normalizeExportDateRange(from, to)
  const root = document.querySelector<HTMLElement>(EXPORT_ROOT_SELECTOR) ?? document.querySelector<HTMLElement>("main")
  const state = getLatestExportState()
  const report =
    state
      ? buildDomainReport(state, window.location.pathname, title, range)
      : root
        ? buildDomFallbackReport(root, title, range)
        : emptyReport(title, range)
  const fileName = `${slug(report.title)}-${range.fileSuffix}`
  report.fileName = fileName

  if (format === "pdf" || format === "print") {
    openPrintableReport(report, format === "print")
    return
  }

  if (format === "excel") {
    usedSheetNames.clear()
    downloadFile(`${fileName}.xls`, buildSpreadsheetXml(report), "application/vnd.ms-excel;charset=utf-8")
    return
  }

  downloadFile(`${fileName}.doc`, buildDocumentHtml(report), "application/msword;charset=utf-8")
}

function buildDomainReport(state: State, pathname: string, fallbackTitle: string, range: ExportDateRange): ExportReport {
  if (pathname === "/dashboard") return buildDashboardReport(state, range)
  if (pathname === "/reportes") return buildProfitabilityReport(state, range)
  if (pathname === "/recepcion/credito") return buildCreditReport(state, "Clientes al credito", "Cartera operativa para recepcion: saldos, limites, vencimientos, bloqueos, autorizaciones y movimientos.", range)
  if (pathname === "/administracion/creditos") return buildCreditReport(state, "Control de creditos", "Reporte administrativo de cartera: riesgo, cupos, solicitudes, bloqueos y decisiones de credito.", range)
  if (pathname === "/recepcion/clientes") return buildClientsReport(state, range)
  if (pathname === "/recepcion/reservaciones") return buildReservationsReport(state, range)
  if (pathname === "/recepcion/check-in") return buildCheckInReport(state, range)
  if (pathname === "/recepcion/cierres") return buildCashCloseReport(state, range)
  if (pathname === "/desayunos") return buildBreakfastReport(state, range)
  if (pathname === "/eventos" || pathname === "/salones") return buildEventsReport(state, range)
  if (pathname === "/habitaciones") return buildRoomsReport(state, range)
  if (pathname === "/mantenimiento") return buildMaintenanceReport(state, range)
  if (pathname === "/inventarios/snacks") return buildInventoryReport(state, "snack", "Snacks / minibar", range)
  if (pathname === "/inventarios/blancos") return buildInventoryReport(state, "blanco", "Blancos y mobiliario", range)
  if (pathname === "/inventarios/suministros") return buildInventoryReport(state, "suministro", "Suministros", range)
  if (pathname === "/administracion/tarifas") return buildRatesReport(state, range)
  if (pathname === "/usuarios") return buildUsersReport(state, range)
  if (pathname === "/administracion/auditoria") return buildAuditReport(state, range)
  if (pathname === "/administracion/configuracion") return buildConfigurationReport(state, range)

  return buildExecutiveReport(state, fallbackTitle || "Reporte ejecutivo", range)
}

function emptyReport(title: string, range = normalizeExportDateRange()): ExportReport {
  return {
    title: title || "Reporte",
    description: "Reporte generado desde Casa Luna.",
    generatedAt: formatDateTime(new Date()),
    filters: [periodFilter(range)],
    metrics: [],
    charts: [],
    sections: [],
    tables: [],
  }
}

function baseReport(title: string, description: string, range: ExportDateRange): ExportReport {
  return {
    title,
    description,
    generatedAt: formatDateTime(new Date()),
    filters: [periodFilter(range)],
    metrics: [],
    charts: [],
    sections: [],
    tables: [],
  }
}

function buildDashboardReport(state: State, range: ExportDateRange): ExportReport {
  const report = buildExecutiveReport(state, "Centro de operaciones", range)
  report.description = "Resumen ejecutivo de ocupacion, ventas, cobros pendientes, alertas y actividad operativa."
  return report
}

function buildProfitabilityReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport(
    "Reporteria avanzada de utilidad",
    "Reporte financiero integral: ocupacion, pronostico, ingresos, categorias, canales, creditos, agentes, eventos, desayunos, minibar, costos, impuestos y utilidad por rubro.",
    range,
  )
  const analysis = buildAdvancedReportAnalysis(
    state,
    range.from,
    range.to,
    range.isSingleDay ? "dia" : "rango",
  )
  const invoices = state.invoices.filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range))

  report.metrics = [
    metric("Ingresos totales", money(analysis.metrics.totalRevenue), "Venta y cargos reconocidos del periodo", analysis.metrics.totalRevenue, "money", "success"),
    metric("Costos operativos", money(analysis.metrics.operatingCosts), "Costos identificados o estimados, sin incluir gastos de caja", analysis.metrics.operatingCosts, "money", analysis.metrics.operatingCosts ? "warning" : "success"),
    metric("Gastos", money(analysis.metrics.expenses), "Egresos registrados en cierres de caja", analysis.metrics.expenses, "money", analysis.metrics.expenses ? "warning" : "success"),
    metric("Impuestos", money(analysis.metrics.taxes), "Impuestos estimados por rubro", analysis.metrics.taxes, "money", "info"),
    metric("Utilidad bruta", money(analysis.metrics.grossProfit), "Ingresos menos costos operativos y gastos", analysis.metrics.grossProfit, "money", analysis.metrics.grossProfit >= 0 ? "success" : "danger"),
    metric("Utilidad neta", money(analysis.metrics.netProfit), `Margen ${formatPercent(analysis.metrics.margin)}`, analysis.metrics.netProfit, "money", analysis.metrics.netProfit >= 0 ? "success" : "danger"),
    metric("Ocupacion", formatPercent(analysis.metrics.occupancy), `${analysis.metrics.roomNights} de ${analysis.metrics.availableRoomNights} habitaciones-noche`, analysis.metrics.occupancy, "percent", "info"),
    metric("Tarifa promedio", money(analysis.metrics.adr), "Ingreso promedio por habitacion vendida", analysis.metrics.adr, "money", "info"),
    metric("Ingreso por habitacion disponible", money(analysis.metrics.revpar), "Ingreso por habitacion disponible", analysis.metrics.revpar, "money", "info"),
    metric("Credito vencido", money(analysis.metrics.overdueCredit), `Cartera total ${money(analysis.metrics.creditBalance)}`, analysis.metrics.overdueCredit, "money", analysis.metrics.overdueCredit ? "danger" : "success"),
  ]

  report.charts = [
    chartFromRows(
      "Utilidad neta por rubro",
      analysis.profitCenters.map((center) => [center.name, center.netProfit]),
      true,
    ),
    chartFromRows(
      "Ingresos por categoria de habitacion",
      analysis.roomCategories.map((category) => [category.category, category.revenue]),
      true,
    ),
    chartFromRows(
      "Canales de venta",
      analysis.channels.map((channel) => [labelFor(channel.channel), channel.revenue]),
      true,
    ),
    chartFromRows(
      "Distribucion financiera",
      analysis.utilityDistribution.map((row) => [row.label, row.amount]),
      true,
    ),
  ]

  report.sections = [
    {
      title: "Lectura de utilidad",
      tone: analysis.metrics.netProfit >= 0 ? "success" : "danger",
      body: [
        `El periodo ${range.label} genero ${money(analysis.metrics.totalRevenue)} en ingresos y ${money(analysis.metrics.netProfit)} de utilidad neta.`,
        `Los costos operativos suman ${money(analysis.metrics.operatingCosts)}, los gastos ${money(analysis.metrics.expenses)} y la reserva fiscal estimada ${money(analysis.metrics.taxes)}.`,
        `La ocupacion fue ${formatPercent(analysis.metrics.occupancy)}, con tarifa promedio ${money(analysis.metrics.adr)} e ingreso por habitacion disponible ${money(analysis.metrics.revpar)}.`,
      ],
    },
    {
      title: "Continuidad del reporte anterior",
      tone: "info",
      body: [
        "El archivo conserva el enfoque del reporte recibido: estado diario, rentabilidad por categoria, canales, cuentas corrientes, agentes, desayunos, botanas y bebidas, salon de eventos y distribucion de utilidad.",
        "La mejora principal es que cada rubro incluye costos, gastos, impuestos, utilidad bruta, utilidad neta, margen y origen del dato real/estimado.",
      ],
    },
  ]

  report.tables = [
    {
      title: "Metadatos del informe",
      description: "Encabezado, version, moneda, pais y periodo del reporte.",
      headers: ["Campo", "Valor"],
      rows: analysis.metadata.map((row) => [row.label, row.value]),
    },
    {
      title: "Ajustes",
      description: "Configuracion base heredada del reporte anterior.",
      headers: ["Ajuste", "Valor"],
      rows: analysis.adjustments.map((row) => [row.setting, row.value]),
    },
    {
      title: "Resumen hotelero heredado",
      description: "Lectura compacta del Resumen anterior: venta acumulada, dias mas vendidos, ocupacion, huespedes, contabilidad y utilidad.",
      headers: ["Seccion", "Indicador", "Valor", "Lectura"],
      rows: analysis.legacySummary.map((row) => [
        row.section,
        row.indicator,
        reportMetricCell(row.value, row.kind),
        row.helper,
      ]),
    },
    {
      title: "Utilidad por rubro",
      description: "Ingresos, costos, impuestos y utilidad por centro operativo.",
      headers: ["Rubro", "Ingreso", "Costo directo", "Impuesto al valor agregado", "Impuesto de turismo", "Impuesto sobre la renta", "Utilidad bruta", "Utilidad neta", "Margen", "Dato"],
      rows: analysis.profitCenters.map((center) => [
        center.name,
        moneyCell(center.revenue),
        moneyCell(center.directCost),
        moneyCell(center.iva),
        moneyCell(center.inguat),
        moneyCell(center.isr),
        moneyCell(center.grossProfit),
        moneyCell(center.netProfit),
        percentCell(center.margin),
        center.confidence === "real" ? "Real" : center.confidence === "mixto" ? "Mixto" : "Estimado",
      ]),
    },
    {
      title: "Distribucion de utilidad",
      description: "Utilidad bruta, impuestos y utilidad neta por cada rubro del hotel.",
      headers: ["Area", "Utilidad bruta", "Impuesto al valor agregado", "Impuesto sobre la renta", "Impuesto de turismo", "Utilidad neta"],
      rows: analysis.utilityBreakdown.map((row) => [
        row.area,
        moneyCell(row.grossProfit),
        moneyCell(row.iva),
        moneyCell(row.isr),
        moneyCell(row.inguat),
        moneyCell(row.netProfit),
      ]),
    },
    {
      title: "Estado diario resumido",
      description: "Total de habitaciones, reservadas, ocupacion, empresas, huespedes, ingresos, promedios y day use.",
      headers: ["Metrica", "Alcance", "Dia seleccionado", "Periodo", "Año a fecha"],
      rows: analysis.dailyState.map((row) => [
        row.metric,
        row.scope,
        reportMetricCell(row.selectedDay, row.kind),
        reportMetricCell(row.period, row.kind),
        reportMetricCell(row.yearToDate, row.kind),
      ]),
    },
    {
      title: "Ingresos y Pronosticos",
      description: "Estado diario real y pipeline de noches futuras con los mismos campos del Excel anterior.",
      headers: ["Tipo", "Fecha", "Hotel", "Habitaciones", "Llegadas", "Partidas", "Continua la estadia", "Ingreso total", "Ingreso medio habitacion", "Personas noche", "Tarifa media huesped", "% Ocupacion", "Huesped/habitacion", "Dia"],
      rows: [
        ...analysis.daily.map((row) => [
          "Real",
          dateCell(row.date),
          "Casa Luna",
          numberCell(row.roomNights),
          numberCell(row.arrivals),
          numberCell(row.departures),
          numberCell(row.stayovers),
          moneyCell(row.revenue),
          moneyCell(row.adr),
          numberCell(row.guests),
          moneyCell(row.guests ? row.revenue / row.guests : 0),
          percentCell(row.occupancy),
          numberCell(row.roomNights ? row.guests / row.roomNights : 0),
          labelFor(row.weekday),
        ]),
        ...analysis.forecast.map((row) => [
          row.kind,
          dateCell(row.date),
          row.hotel,
          numberCell(row.roomNights),
          numberCell(row.arrivals),
          numberCell(row.departures),
          numberCell(row.stayovers),
          moneyCell(row.revenue),
          moneyCell(row.adr),
          numberCell(row.guests),
          moneyCell(row.guests ? row.revenue / row.guests : 0),
          percentCell(row.occupancy),
          numberCell(row.roomNights ? row.guests / row.roomNights : 0),
          labelFor(row.weekday),
        ]),
      ],
    },
    {
      title: "Estado diario",
      description: "Habitaciones, llegadas, partidas, estadia continua, ingresos, tarifa promedio, ingreso por habitacion disponible y ocupacion.",
      headers: ["Fecha", "Dia", "Habitaciones", "Llegadas", "Partidas", "Continua", "Personas", "Ingresos", "Tarifa promedio", "Ingreso por habitacion disponible", "% Ocupacion"],
      rows: analysis.daily.map((row) => [
        dateCell(row.date),
        labelFor(row.weekday),
        numberCell(row.roomNights),
        numberCell(row.arrivals),
        numberCell(row.departures),
        numberCell(row.stayovers),
        numberCell(row.guests),
        moneyCell(row.revenue),
        moneyCell(row.adr),
        moneyCell(row.revpar),
        percentCell(row.occupancy),
      ]),
    },
    {
      title: "Matriz estadistica de ocupacion",
      description: "Niveles de habitaciones vendidas por fecha, igual al resumen visual del Excel anterior.",
      headers: ["Habitaciones-noche", ...analysis.daily.map((row) => row.label), "Total"],
      rows: analysis.occupancyMatrix.map((row) => [
        numberCell(row.level),
        ...row.values.map((value) => numberCell(value)),
        numberCell(row.total),
      ]),
    },
    {
      title: "Dias mas vendidos",
      description: "Habitaciones-noche por dia de la semana y participacion.",
      headers: ["Dia", "Habitaciones-noche", "%"],
      rows: analysis.weekdaySales.map((row) => [
        labelFor(row.weekday),
        numberCell(row.roomNights),
        percentCell(row.share),
      ]),
    },
    {
      title: "Rentabilidad por categoria de habitacion",
      description: "Ingreso y rendimiento por tipo de habitacion.",
      headers: ["Categoria", "Habitaciones", "Noches vendidas", "Ingresos", "Tarifa promedio", "% Ocupacion hotel"],
      rows: analysis.roomCategories.map((row) => [
        row.category,
        numberCell(row.rooms),
        numberCell(row.roomNights),
        moneyCell(row.revenue),
        moneyCell(row.adr),
        percentCell(row.occupancyShare),
      ]),
    },
    {
      title: "Rentabilidad por habitacion",
      description: "Importe por habitacion individual y tipo de habitacion.",
      headers: ["Habitacion", "Tipo", "Noches", "Personas", "Importe", "Tarifa promedio", "% Hotel"],
      rows: analysis.roomRevenue.map((row) => [
        row.room,
        row.roomType,
        numberCell(row.roomNights),
        numberCell(row.guests),
        moneyCell(row.revenue),
        moneyCell(row.adr),
        percentCell(row.occupancyShare),
      ]),
    },
    {
      title: "Canales de venta",
      description: "Participacion por canal, noches, personas e ingreso.",
      headers: ["Codigo", "Canal", "Reservas", "Noches", "Personas", "Ingreso", "Tarifa promedio", "% Ocupacion hotel", "Tarifa media huesped", "% Ingreso"],
      rows: analysis.channels.map((row) => [
        row.code,
        labelFor(row.channel),
        numberCell(row.reservations),
        numberCell(row.roomNights),
        numberCell(row.guests),
        moneyCell(row.revenue),
        moneyCell(row.adr),
        percentCell(row.occupancyShare),
        moneyCell(row.guestRate),
        percentCell(row.share),
      ]),
    },
    {
      title: "Ingresos contabilidad",
      description: "Matriz cruda: fecha, usuario, cuenta, recibo, cliente, descripcion, forma de pago, moneda, pais y habitaciones.",
      headers: ["Fecha", "Usuario", "Cuenta", "Recibo", "Cliente", "Descripcion", "Tipo", "Subtipo", "Monto", "Moneda", "Pais", "Habitaciones"],
      rows: analysis.accountingIncome.map((row) => [
        dateCell(row.date),
        row.user,
        row.account,
        row.receipt,
        row.customer,
        row.description,
        row.type,
        labelFor(row.subtype),
        moneyCell(row.amount),
        row.currency,
        row.country,
        row.rooms,
      ]),
    },
    {
      title: "Resumen contable por forma de pago",
      description: "Bloque inferior del Excel anterior: tipo, subtipo, importe, moneda y lectura local.",
      headers: ["Tipo", "Subtipo", "Importe", "Moneda", "Lectura local"],
      rows: analysis.accountingPayments.map((row) => [
        row.type,
        row.subtype,
        moneyCell(row.amount),
        row.currency,
        row.localLabel,
      ]),
    },
    {
      title: "Totales contables",
      description: "Totales de efectivo, tarjetas, otros y moneda local.",
      headers: ["Total", "Importe"],
      rows: analysis.accountingTotals.map((row) => [row.label, moneyCell(row.amount)]),
    },
    {
      title: "Filtros contables",
      description: "Canal, fechas, tipo de informe y version del reporte.",
      headers: ["Filtro", "Valor"],
      rows: analysis.accountingFilters.map((row) => [row.label, row.value]),
    },
    {
      title: "Rendimiento de agentes",
      description: "Cobros por usuario de cierres/anticipos y avance contra meta operativa.",
      headers: ["Agente", "Meta", "Proyeccion", "Ejecutado", "%"],
      rows: analysis.agents.map((row) => [
        row.agent,
        numberCell(row.target),
        numberCell(row.projected),
        moneyCell(row.executed),
        percentCell(row.percent),
      ]),
    },
    {
      title: "Promociones",
      description: "Promociones del periodo, habitaciones vendidas e impacto estimado.",
      headers: ["Promocion", "Descripcion", "Habitaciones vendidas", "% Descuento", "Impacto estimado"],
      rows: analysis.promotions.map((row) => [
        row.name,
        row.description,
        numberCell(row.roomsSold),
        percentCell(row.discountRate),
        moneyCell(row.estimatedImpact),
      ]),
    },
    {
      title: "Clientes al credito",
      description: "Cuentas corrientes, limites, saldos y vencimientos.",
      headers: ["Empresa", "Contacto", "Limite", "Saldo", "Disponible", "Vence", "Estado"],
      rows: analysis.credits.map((row) => [
        row.company,
        row.contact,
        moneyCell(row.limit),
        moneyCell(row.balance),
        moneyCell(row.available),
        dateCell(row.dueDate),
        labelFor(row.status),
      ]),
    },
    {
      title: "Cuentas corrientes",
      description: "Formato heredado con habitaciones-noches, personas-noches, reservas, cargo de alojamiento y otros cargos.",
      headers: ["Cuenta", "Nombre", "Habitaciones-noches", "Personas-noches", "Reservas", "Cargo alojamiento", "Otros cargos"],
      rows: analysis.currentAccountsLegacy.map((row) => [
        row.account,
        row.name,
        numberCell(row.roomNights),
        numberCell(row.personNights),
        numberCell(row.reservations),
        moneyCell(row.lodgingCharge),
        moneyCell(row.otherCharges),
      ]),
    },
    {
      title: "Desayunos",
      description: "Emitidos, consumidos, costo, valor de menu e impacto.",
      headers: ["Tipo", "Emitidos", "Consumidos", "Costo", "Valor menu", "Impacto"],
      rows: analysis.breakfast.map((row) => [
        row.label,
        numberCell(row.issued),
        numberCell(row.redeemed),
        moneyCell(row.cost),
        moneyCell(row.retailValue),
        moneyCell(row.profitImpact),
      ]),
    },
    {
      title: "Analisis desayunos habitaciones personas",
      description: "Relacion entre habitaciones, personas y platillos vendidos.",
      headers: ["Categoria", "Cantidad", "Platillos vendidos", "%"],
      rows: analysis.breakfastOccupancy.map((row) => [
        row.category,
        numberCell(row.quantity),
        numberCell(row.platesSold),
        percentCell(row.share),
      ]),
    },
    {
      title: "Restaurante resumen",
      description: "Desayunos, extras/restaurante y total con venta, costo, utilidad y margen.",
      headers: ["Area", "Venta", "Costo", "Utilidad", "% utilidad bruta"],
      rows: analysis.restaurantSummary.map((row) => [
        row.area,
        moneyCell(row.sales),
        moneyCell(row.cost),
        moneyCell(row.profit),
        percentCell(row.margin),
      ]),
    },
    {
      title: "Restaurante",
      description: "Restaurante / Parmigiano, desayunos de cortesia, ventas, costos, utilidad y fuente.",
      headers: ["Area", "Venta", "Costo", "Utilidad", "% utilidad bruta", "Fuente"],
      rows: analysis.restaurant.map((row) => [
        row.name,
        moneyCell(row.sales),
        moneyCell(row.cost),
        moneyCell(row.grossProfit),
        percentCell(row.margin),
        row.source,
      ]),
    },
    {
      title: "Botanas y bebidas / inventarios",
      description: "Venta, costo y utilidad por categoria de inventario.",
      headers: ["Categoria", "Unidades", "Venta", "Costo", "Utilidad"],
      rows: analysis.inventoryProfit.map((row) => [
        row.label,
        numberCell(row.units),
        moneyCell(row.revenue),
        moneyCell(row.cost),
        moneyCell(row.profit),
      ]),
    },
    {
      title: "Botanas y bebidas por producto",
      description: "Detalle por codigo de producto vendido con impuestos y utilidad neta.",
      headers: ["Codigo de producto", "Producto", "Cantidad", "Venta", "Costo", "Utilidad bruta", "Impuesto al valor agregado", "Impuesto sobre la renta", "Utilidad neta"],
      rows: analysis.minibarProducts.map((row) => [
        row.sku,
        row.product,
        numberCell(row.units),
        moneyCell(row.sale),
        moneyCell(row.cost),
        moneyCell(row.grossProfit),
        moneyCell(row.iva),
        moneyCell(row.isr),
        moneyCell(row.netProfit),
      ]),
    },
    {
      title: "Salon de eventos",
      description: "Venta, costo estimado, utilidad y margen por evento.",
      headers: ["Evento", "Cliente", "Espacio", "Tipo", "Venta", "Costo", "Utilidad", "% utilidad bruta"],
      rows: analysis.events.map((event) => [
        event.title,
        event.client,
        event.salon,
        labelFor(event.type),
        moneyCell(event.revenue),
        moneyCell(event.estimatedCost),
        moneyCell(event.profit),
        percentCell(event.margin),
      ]),
    },
    invoicesTable(invoices, "Ingresos contables", "Facturas no anuladas del periodo."),
    reservationsTable(state, analysis.reservations, "Reservas del periodo", "Detalle base para ocupacion, ingresos y saldos."),
  ]

  return report
}

function buildExecutiveReport(state: State, title: string, range: ExportDateRange): ExportReport {
  const report = baseReport(title, "Reporte ejecutivo con numeros operativos y financieros relevantes para gerencia.", range)
  const periodReservations = state.reservations.filter((reservation) => reservationTouchesRange(reservation, range))
  const activeReservations = periodReservations.filter((reservation) => !["cancelada", "no-show"].includes(reservation.status))
  const inHouse = state.reservations.filter((reservation) => reservation.status === "in-house")
  const activeInvoices = state.invoices.filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range))
  const revenue = sum(activeInvoices, (invoice) => invoice.total)
  const pendingStayBalance = sum(inHouse.filter((reservation) => reservationTouchesRange(reservation, range)), reservationBalance)
  const creditBalance = sum(state.creditAccounts, (account) => account.balance)
  const lowStock = state.inventory.filter((item) => item.stock <= item.minStock)
  const openMaintenance = state.maintenance.filter((ticket) => ticket.status === "abierto" || ticket.status === "en progreso")
  const occupancy = safePercent(
    state.rooms.filter((room) => room.status === "ocupada" || room.status === "reservada").length,
    state.rooms.length,
  )

  report.metrics = [
    metric("Ocupacion activa", formatPercent(occupancy), `${state.rooms.length} habitaciones en inventario`, occupancy, "percent", occupancy >= 70 ? "success" : "warning"),
    metric("Ingresos emitidos", money(revenue), `${activeInvoices.length} facturas no anuladas en el periodo`, revenue, "money", "success"),
    metric("Saldo en casa", money(pendingStayBalance), "Pendiente de cobrar a huespedes in-house del periodo", pendingStayBalance, "money", pendingStayBalance > 0 ? "warning" : "success"),
    metric("Cartera al credito", money(creditBalance), `${state.creditAccounts.length} cuentas con limite`, creditBalance, "money", creditBalance > 0 ? "info" : "success"),
    metric("Alertas operativas", String(lowStock.length + openMaintenance.length), `${lowStock.length} stock bajo, ${openMaintenance.length} mantenimiento`, lowStock.length + openMaintenance.length, "number", lowStock.length + openMaintenance.length ? "warning" : "success"),
  ]
  report.charts = [
    chartFromCounts("Estado de habitaciones", countBy(state.rooms, (room) => labelFor(room.status))),
    chartFromCounts("Reservas por estado", countBy(periodReservations, (reservation) => labelFor(reservation.status))),
    chartFromRows("Riesgo operativo", [
      ["Credito vencido", state.creditAccounts.filter((account) => account.status === "vencido").length],
      ["Mantenimiento abierto", openMaintenance.length],
      ["Stock bajo", lowStock.length],
      ["Habitaciones limpieza", state.rooms.filter((room) => room.status === "limpieza").length],
    ]),
  ]
  report.sections = [
    {
      title: "Lectura gerencial",
      tone: pendingStayBalance || lowStock.length || openMaintenance.length ? "warning" : "success",
      body: [
        `Para ${range.label}, el ingreso facturado no anulado suma ${money(revenue)} y la ocupacion actual es ${formatPercent(occupancy)}.`,
        pendingStayBalance > 0
          ? `Hay ${money(pendingStayBalance)} por cobrar antes de cerrar salidas en casa.`
          : "Los saldos en casa no muestran cobros pendientes relevantes.",
        lowStock.length || openMaintenance.length
          ? `Priorizar ${lowStock.length} articulos bajo minimo y ${openMaintenance.length} tickets de mantenimiento abiertos.`
          : "No hay alertas criticas de stock o mantenimiento abiertas en este corte.",
      ],
    },
  ]
  report.tables = [
    reservationsTable(state, activeReservations, "Reservas operativas del periodo", "Reservas activas que cruzan el periodo seleccionado, con saldo y canal."),
    invoicesTable(activeInvoices.slice(0, 60), "Facturacion no anulada del periodo", "Facturas emitidas o pendientes usadas para el resumen financiero."),
    inventoryTable(lowStock, "Inventario bajo minimo", "Articulos que requieren reposicion o revision."),
    maintenanceTable(openMaintenance, "Mantenimiento abierto", "Tickets activos que afectan operacion o experiencia del huesped."),
  ]

  return report
}

function buildCreditReport(state: State, title: string, description: string, range: ExportDateRange): ExportReport {
  const report = baseReport(title, description, range)
  const accounts = creditAccountsView(state)
  const movements = state.creditMovements.filter((movement) => dateInRange(movement.date, range))
  const requests = state.creditAuthorizationRequests.filter((request) =>
    dateInRange(request.requestedAt, range) || dateInRange(request.resolvedAt, range) || request.status === "pendiente",
  )
  const totalLimit = sum(accounts, (account) => account.limit)
  const totalBalance = sum(accounts, (account) => account.balance)
  const totalAvailable = sum(accounts, (account) => account.available)
  const overdue = accounts.filter((account) => account.health === "vencido")
  const blocked = accounts.filter((account) => ["bloqueado", "pausado", "sin credito"].includes(account.health))
  const dueSoon = accounts.filter((account) => account.health === "por vencer")
  const utilization = safePercent(totalBalance, totalLimit)

  report.metrics = [
    metric("Cartera pendiente", money(totalBalance), `${accounts.length} cuentas al credito`, totalBalance, "money", totalBalance ? "warning" : "success"),
    metric("Limite aprobado", money(totalLimit), "Cupo total autorizado", totalLimit, "money", "info"),
    metric("Disponible", money(totalAvailable), "Credito utilizable sin ampliar limite", totalAvailable, "money", "success"),
    metric("Uso de cartera", formatPercent(utilization), "Saldo pendiente sobre limite aprobado", utilization, "percent", utilization >= 75 ? "warning" : "info"),
    metric("Cuentas criticas", String(overdue.length + blocked.length), `${overdue.length} vencidas, ${blocked.length} bloqueadas/pausadas/sin cupo`, overdue.length + blocked.length, "number", overdue.length + blocked.length ? "danger" : "success"),
    metric("Abonos del periodo", money(sum(movements, (movement) => movement.payment)), `${movements.length} movimiento(s) en ${range.label}`, sum(movements, (movement) => movement.payment), "money", "success"),
  ]
  report.charts = [
    chartFromCounts("Cartera por estado", countBy(accounts, (account) => account.healthLabel)),
    {
      title: "Uso del limite por empresa",
      description: "Porcentaje consumido del limite autorizado.",
      data: accounts
        .slice()
        .sort((a, b) => b.usage - a.usage)
        .map((account) => ({
          label: account.company,
          value: account.usage,
          valueLabel: formatPercent(account.usage),
          tone: account.usage >= 90 ? "danger" : account.usage >= 70 ? "warning" : "success",
        })),
    },
    {
      title: "Saldo expuesto por prioridad",
      description: "Monto pendiente donde recepcion debe tomar una decision.",
      data: [
        { label: "Vencido", value: sum(overdue, (account) => account.balance), valueLabel: money(sum(overdue, (account) => account.balance)), tone: "danger" },
        { label: "Por vencer", value: sum(dueSoon, (account) => account.balance), valueLabel: money(sum(dueSoon, (account) => account.balance)), tone: "warning" },
        { label: "Bloqueado/pausado", value: sum(blocked, (account) => account.balance), valueLabel: money(sum(blocked, (account) => account.balance)), tone: "danger" },
      ],
    },
  ]
  report.sections = [
    {
      title: "Decision operativa",
      tone: overdue.length || blocked.length ? "danger" : "success",
      body: [
        overdue.length || blocked.length
          ? `${overdue.length + blocked.length} cuenta(s) no deberian recibir mas credito sin abono o autorizacion.`
          : "La cartera no muestra bloqueos criticos en este corte.",
        dueSoon.length
          ? `${dueSoon.length} cuenta(s) vencen pronto; conviene solicitar abono preventivo antes de nuevas reservas.`
          : "No hay cuentas por vencer en ventana inmediata.",
        requests.length
          ? `${requests.length} solicitud(es) aparecen en el periodo o siguen pendientes de decision.`
          : "No hay autorizaciones relacionadas con el periodo.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Cartera por empresa",
      description: "Tabla principal para decidir credito: saldo, limite, vencimiento, cupo y accion recomendada.",
      headers: ["Empresa", "Contacto", "Limite", "Saldo", "Disponible", "Uso %", "Vence", "Dias", "Estado", "Credito", "Decision"],
      rows: accounts.map((account) => [
        account.company,
        `${account.contact} / ${account.phone}`,
        moneyCell(account.limit),
        moneyCell(account.balance),
        moneyCell(account.available),
        percentCell(account.usage),
        dateCell(account.dueDate),
        numberCell(account.daysToDue),
        account.healthLabel,
        labelFor(account.creditStatus ?? "activo"),
        creditDecision(account),
      ]),
    },
    {
      title: "Movimientos de credito",
      description: `Cargos, abonos y referencias del periodo ${range.label}.`,
      headers: ["Fecha", "Empresa", "Concepto", "Cargo", "Pago", "Referencia"],
      rows: movements.map((movement) => {
        const account = accounts.find((item) => item.id === movement.accountId)
        return [
          dateCell(movement.date),
          account?.company ?? "Sin cuenta",
          movement.concept,
          moneyCell(movement.charge),
          moneyCell(movement.payment),
          movement.reference,
        ]
      }),
    },
    {
      title: "Solicitudes de autorizacion",
      description: `Excepciones solicitadas/resueltas en ${range.label} y pendientes actuales.`,
      headers: ["Fecha solicitud", "Empresa", "Solicitado por", "Estado", "Motivo", "Resolucion", "Notas"],
      rows: requests.map((request) => {
        const account = accounts.find((item) => item.id === request.accountId)
        return [
          dateCell(request.requestedAt),
          account?.company ?? "Cuenta no encontrada",
          request.requestedBy,
          labelFor(request.status),
          request.reason,
          request.resolvedAt ? `${formatDate(request.resolvedAt)} / ${request.resolvedBy ?? "-"}` : "Pendiente",
          request.notes ?? "",
        ]
      }),
    },
  ]

  return report
}

function buildClientsReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Clientes", "Directorio operativo con historial, valor de estadias, credito asociado y datos de contacto.", range)
  const creditByGuest = new Map(state.creditAccounts.filter((account) => account.guestId).map((account) => [account.guestId, account]))
  const guestRows = state.guests.map((guest) => {
    const reservations = state.reservations.filter((reservation) => reservation.guestId === guest.id && reservationTouchesRange(reservation, range))
    const credit = creditByGuest.get(guest.id)
    return {
      guest,
      reservations,
      credit,
      total: sum(reservations, (reservation) => reservation.total),
      balance: sum(reservations, reservationBalance),
    }
  })
  const totalRevenue = sum(guestRows, (row) => row.total)
  const vip = guestRows.filter((row) => row.guest.vip).length
  const withCredit = guestRows.filter((row) => row.credit).length

  report.metrics = [
    metric("Clientes registrados", String(state.guests.length), "Directorio de recepcion", state.guests.length, "number", "info"),
    metric("Clientes frecuentes", String(vip), "Marcados como VIP/frecuentes", vip, "number", "success"),
    metric("Con credito", String(withCredit), "Tienen cuenta de credito asignada", withCredit, "number", withCredit ? "warning" : "default"),
    metric("Valor del periodo", money(totalRevenue), `Reservas de clientes en ${range.label}`, totalRevenue, "money", "success"),
  ]
  report.charts = [
    chartFromCounts("Clientes por pais", countBy(state.guests, (guest) => guest.country || "Sin pais")),
    chartFromRows("Segmentacion operativa", [
      ["Frecuentes", vip],
      ["Con credito", withCredit],
      ["Sin correo", state.guests.filter((guest) => !guest.email).length],
      ["Sin telefono", state.guests.filter((guest) => !guest.phone).length],
    ]),
  ]
  report.sections = [
    {
      title: "Lectura de clientes",
      body: [
        `El directorio tiene ${state.guests.length} clientes y ${vip} frecuentes con trato preferencial.`,
        `${withCredit} cliente(s) tienen credito asignado; revisar saldo y estado antes de confirmar reservas sin anticipo.`,
        `El valor de reservas que cruzan ${range.label} suma ${money(totalRevenue)}.`,
      ],
    },
  ]
  report.tables = [
    {
      title: "Directorio con valor operativo",
      description: `Clientes con contacto, documento, reservas del periodo ${range.label} y credito asociado.`,
      headers: ["Cliente", "Documento", "NIT", "Pais", "Telefono", "Correo", "Frecuente", "Reservas periodo", "Valor periodo", "Saldo periodo", "Credito", "Saldo credito"],
      rows: guestRows.map(({ guest, reservations, credit, total, balance }) => [
        guest.name,
        `${guest.documentType} ${guest.document}`,
        guest.nit,
        guest.country,
        guest.phone ?? "",
        guest.email ?? "",
        guest.vip ? "Si" : "No",
        numberCell(reservations.length),
        moneyCell(total),
        moneyCell(balance),
        credit ? `${credit.company} / ${labelFor(credit.status)}` : "No",
        moneyCell(credit?.balance ?? 0),
      ]),
    },
    reservationsTable(state, state.reservations.filter((reservation) => reservationTouchesRange(reservation, range)), "Reservas por cliente del periodo", "Reservas relacionadas al directorio en el periodo seleccionado."),
  ]

  return report
}

function buildReservationsReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Reservaciones", "Reporte de ventas futuras, ocupacion, anticipos, canales y saldos por cobrar.", range)
  const reservations = state.reservations.filter((reservation) => reservationTouchesRange(reservation, range))
  const advances = state.advances.filter((advance) => dateInRange(advance.date, range))
  const active = reservations.filter((reservation) => !["cancelada", "no-show"].includes(reservation.status))
  const totalSales = sum(active, (reservation) => reservation.total)
  const paid = sum(active, (reservation) => reservation.paid)
  const pending = sum(active, reservationBalance)
  const arrivals = active.filter((reservation) => dateInRange(reservation.checkIn, range)).length

  report.metrics = [
    metric("Reservas activas", String(active.length), `${reservations.length} registros en el periodo`, active.length, "number", "info"),
    metric("Valor reservado", money(totalSales), "Total de reservas no canceladas del periodo", totalSales, "money", "success"),
    metric("Cobrado", money(paid), "Anticipos y pagos registrados en reservas del periodo", paid, "money", "success"),
    metric("Por cobrar", money(pending), "Saldo pendiente de reservas activas del periodo", pending, "money", pending ? "warning" : "success"),
    metric("Llegadas", String(arrivals), `Check-ins programados en ${range.label}`, arrivals, "number", arrivals ? "info" : "default"),
  ]
  report.charts = [
    chartFromCounts("Reservas por estado", countBy(reservations, (reservation) => labelFor(reservation.status))),
    chartFromCounts("Reservas por canal", countBy(reservations, (reservation) => labelFor(reservation.source))),
  ]
  report.sections = [
    {
      title: "Lectura comercial",
      tone: pending ? "warning" : "success",
      body: [
        `La cartera activa de reservas en ${range.label} suma ${money(totalSales)} con ${money(pending)} pendiente de cobro.`,
        `${arrivals} reserva(s) tienen check-in en el periodo; validar anticipo, habitacion y forma de pago antes de la llegada.`,
        "Excel incluye tabla por reserva con total, pagado, saldo, habitacion, huesped y canal.",
      ],
    },
  ]
  report.tables = [
    reservationsTable(state, active, "Reservas activas del periodo", "Reservas no canceladas que cruzan el periodo seleccionado."),
    {
      title: "Anticipos registrados",
      description: `Pagos anticipados de ${range.label} para conciliacion con caja y bancos.`,
      headers: ["Fecha", "Reserva", "Huesped", "Metodo", "Monto", "Recibido por", "Notas"],
      rows: advances.map((advance) => {
        const reservation = state.reservations.find((item) => item.id === advance.reservationId)
        return [
          dateCell(advance.date),
          reservation?.code ?? advance.reservationId,
          reservation ? guestName(state, reservation.guestId) : "",
          labelFor(advance.method),
          moneyCell(advance.amount),
          advance.receivedBy,
          advance.notes ?? "",
        ]
      }),
    },
  ]

  return report
}

function buildCheckInReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Check-in / Check-out", "Movimiento del periodo: llegadas, salidas, huespedes en casa y saldos antes de cerrar folios.", range)
  const arrivals = state.reservations.filter((reservation) => dateInRange(reservation.checkIn, range) && !["cancelada", "no-show"].includes(reservation.status))
  const departures = state.reservations.filter((reservation) => dateInRange(reservation.checkOut, range) && reservation.status !== "cancelada")
  const inHouse = state.reservations.filter((reservation) => reservation.status === "in-house")
  const balance = sum(inHouse, reservationBalance)

  report.metrics = [
    metric("Llegadas", String(arrivals.length), `Reservas con check-in en ${range.label}`, arrivals.length, "number", "info"),
    metric("Salidas", String(departures.length), `Reservas con check-out en ${range.label}`, departures.length, "number", "warning"),
    metric("En casa", String(inHouse.length), "Huespedes actualmente hospedados", inHouse.length, "number", "success"),
    metric("Saldo en casa", money(balance), "Pendiente antes de check-out", balance, "money", balance ? "warning" : "success"),
  ]
  report.charts = [
    chartFromCounts("Movimiento por estado", countBy([...arrivals, ...departures, ...inHouse], (reservation) => labelFor(reservation.status))),
  ]
  report.sections = [
    {
      title: "Prioridades de recepcion",
      tone: balance ? "warning" : "success",
      body: [
        arrivals.length ? `${arrivals.length} llegada(s) requieren verificar anticipo, documento y habitacion.` : "No hay llegadas para el periodo.",
        departures.length ? `${departures.length} salida(s) deben cerrar folio y saldos antes del checkout.` : "No hay salidas programadas en el periodo.",
        balance ? `El saldo pendiente en casa es ${money(balance)}.` : "No hay saldos pendientes en reservas in-house.",
      ],
    },
  ]
  report.tables = [
    reservationsTable(state, arrivals, "Llegadas del periodo", "Reservas que deben pasar por check-in."),
    reservationsTable(state, departures, "Salidas del periodo", "Reservas que deben cerrar folio."),
    reservationsTable(state, inHouse, "Huespedes en casa", "Reservas activas con saldo y habitacion."),
  ]

  return report
}

function buildCashCloseReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Cierres de turno", "Cuadre de caja por turno, metodo de pago, diferencias y estado de aprobacion operativa.", range)
  const closes = state.cashCloses.filter((close) => dateInRange(close.openedAt, range) || dateInRange(close.closedAt, range))
  const expected = sum(closes, (close) => close.expected)
  const counted = sum(closes, (close) => close.counted)
  const difference = sum(closes, (close) => close.difference)
  const open = closes.filter((close) => close.status === "abierto")
  const closed = closes.filter((close) => close.status === "cerrado")

  report.metrics = [
    metric("Esperado", money(expected), "Total sistema", expected, "money", "info"),
    metric("Contado", money(counted), "Total cerrado", counted, "money", "success"),
    metric("Diferencia", money(difference), "Contado menos esperado", difference, "money", difference ? "danger" : "success"),
    metric("Turnos abiertos", String(open.length), `Pendientes de cierre en ${range.label}`, open.length, "number", open.length ? "warning" : "success"),
    metric("Turnos cerrados", String(closed.length), `Historial registrado en ${range.label}`, closed.length, "number", "info"),
  ]
  report.charts = [
    {
      title: "Cobros por metodo",
      description: `Totales registrados en cierres de ${range.label}.`,
      data: [
        { label: "Efectivo", value: sum(closes, (close) => close.cash), valueLabel: money(sum(closes, (close) => close.cash)), tone: "success" },
        { label: "Tarjeta", value: sum(closes, (close) => close.card), valueLabel: money(sum(closes, (close) => close.card)), tone: "info" },
        { label: "Transferencia", value: sum(closes, (close) => close.transfer), valueLabel: money(sum(closes, (close) => close.transfer)), tone: "warning" },
        { label: "Deposito", value: sum(closes, (close) => close.deposit), valueLabel: money(sum(closes, (close) => close.deposit)), tone: "default" },
        { label: "Otros", value: sum(closes, (close) => close.other), valueLabel: money(sum(closes, (close) => close.other)), tone: "default" },
      ],
    },
    chartFromCounts("Estado de cierres", countBy(closes, (close) => labelFor(close.status))),
  ]
  report.sections = [
    {
      title: "Control de caja",
      tone: difference ? "danger" : "success",
      body: [
        difference ? `Existe una diferencia acumulada de ${money(difference)} que requiere revision.` : "Los cierres del periodo cuadran contra lo esperado.",
        open.length ? `${open.length} turno(s) siguen abiertos y deben cerrarse antes del relevo.` : "No hay turnos abiertos pendientes.",
        "Excel incluye cada cierre con metodos, esperado, contado, diferencia y usuario.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Cierres por turno",
      description: `Cuadre detallado de ${range.label} por fecha, turno, usuario y metodo.`,
      headers: ["Apertura", "Cierre", "Turno", "Usuario", "Efectivo", "Tarjeta", "Transferencia", "Deposito", "Otros", "Gastos", "Esperado", "Contado", "Diferencia", "Estado"],
      rows: closes.map((close) => cashCloseRow(close)),
    },
  ]

  return report
}

function buildInvoicesReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Facturacion fiscal", "Reporte financiero de facturas, impuesto al valor agregado, anulaciones, pendientes y detalle de conceptos facturados.", range)
  const invoices = state.invoices.filter((invoice) => dateInRange(invoice.date, range))
  const issued = invoices.filter((invoice) => invoice.status === "emitida")
  const pending = invoices.filter((invoice) => invoice.status === "pendiente")
  const voided = invoices.filter((invoice) => invoice.status === "anulada")
  const issuedTotal = sum(issued, (invoice) => invoice.total)
  const iva = sum(issued, (invoice) => invoice.iva)

  report.metrics = [
    metric("Facturado emitido", money(issuedTotal), `${issued.length} facturas emitidas`, issuedTotal, "money", "success"),
    metric("Impuesto emitido", money(iva), "Impuesto incluido en emitidas", iva, "money", "info"),
    metric("Pendiente de emitir", money(sum(pending, (invoice) => invoice.total)), `${pending.length} documento(s)`, sum(pending, (invoice) => invoice.total), "money", pending.length ? "warning" : "success"),
    metric("Anuladas", String(voided.length), money(sum(voided, (invoice) => invoice.total)), voided.length, "number", voided.length ? "danger" : "success"),
  ]
  report.charts = [
    chartFromCounts("Facturas por estado", countBy(invoices, (invoice) => labelFor(invoice.status))),
    chartFromRows("Monto por estado", [
      ["Emitidas", issuedTotal],
      ["Pendientes", sum(pending, (invoice) => invoice.total)],
      ["Anuladas", sum(voided, (invoice) => invoice.total)],
    ], true),
  ]
  report.sections = [
    {
      title: "Lectura fiscal",
      tone: pending.length || voided.length ? "warning" : "success",
      body: [
        `La facturacion emitida en ${range.label} suma ${money(issuedTotal)} con impuesto al valor agregado por ${money(iva)}.`,
        pending.length ? `${pending.length} documento(s) estan pendientes de emision fiscal.` : "No hay documentos pendientes de emision.",
        voided.length ? `${voided.length} documento(s) anulados deben tener respaldo administrativo.` : "No hay anulaciones registradas en este corte.",
      ],
    },
  ]
  report.tables = [
    invoicesTable(invoices, "Facturas del periodo", `Listado de ${range.label} para contabilidad.`),
    {
      title: "Detalle de conceptos",
      description: `Lineas facturadas en ${range.label} para analisis de venta.`,
      headers: ["Fecha", "Documento", "Cliente", "Concepto", "Cantidad", "Precio unitario", "Total", "Estado"],
      rows: invoices.flatMap((invoice) =>
        invoice.items.map((item) => [
          dateCell(invoice.date),
          `${invoice.serie}-${invoice.number}`,
          invoice.customer,
          item.description,
          numberCell(item.qty),
          moneyCell(item.unitPrice),
          moneyCell(item.total),
          labelFor(invoice.status),
        ]),
      ),
    },
  ]

  return report
}

function buildBreakfastReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Desayunos QR", "Control de vouchers de desayuno, redencion, pendientes y preferencias por opcion.", range)
  const vouchers = state.breakfasts.filter((voucher) => dateInRange(voucher.date, range))
  const redeemed = vouchers.filter((voucher) => voucher.redeemed)
  const pending = vouchers.filter((voucher) => !voucher.redeemed)
  const rate = safePercent(redeemed.length, vouchers.length)

  report.metrics = [
    metric("Vouchers", String(vouchers.length), `Desayunos generados en ${range.label}`, vouchers.length, "number", "info"),
    metric("Redimidos", String(redeemed.length), formatPercent(rate), redeemed.length, "number", "success"),
    metric("Pendientes", String(pending.length), "Aun no canjeados", pending.length, "number", pending.length ? "warning" : "success"),
    metric("Tasa de redencion", formatPercent(rate), "Redimidos / generados", rate, "percent", rate >= 70 ? "success" : "warning"),
  ]
  report.charts = [
    chartFromCounts("Vouchers por opcion", countBy(vouchers, (voucher) => breakfastLabel(state, voucher.type))),
    chartFromRows("Estado de redencion", [
      ["Redimidos", redeemed.length],
      ["Pendientes", pending.length],
    ]),
  ]
  report.sections = [
    {
      title: "Operacion de desayuno",
      tone: pending.length ? "warning" : "success",
      body: [
        `${redeemed.length} de ${vouchers.length} vouchers del periodo ya fueron redimidos.`,
        pending.length ? `${pending.length} desayuno(s) siguen pendientes; cocina debe prever demanda restante.` : "Todos los vouchers registrados fueron redimidos.",
        "Excel incluye voucher por huesped, habitacion, opcion y hora de redencion.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Vouchers de desayuno",
      description: `Listado operativo de ${range.label} por habitacion y huesped.`,
      headers: ["Fecha", "Huesped", "Habitacion", "Opcion", "Redimido", "Hora", "Notas"],
      rows: vouchers.map((voucher) => [
        dateCell(voucher.date),
        voucher.guestName,
        voucher.room,
        breakfastLabel(state, voucher.type),
        voucher.redeemed ? "Si" : "No",
        voucher.redeemedAt ?? "",
        voucher.notes ?? "",
      ]),
    },
    {
      title: "Opciones configuradas",
      description: "Catalogo de desayuno usado por los vouchers.",
      headers: ["Codigo", "Opcion", "Descripcion"],
      rows: state.breakfastOptions.map((option) => [option.id, option.label, option.description]),
    },
  ]

  return report
}

function buildEventsReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Salones y coworking", "Reporte de eventos, pipeline, pagos, saldos y uso de espacios.", range)
  const events = state.events.filter((event) => dateInRange(event.date, range))
  const activeEvents = events.filter((event) => event.status !== "cancelado")
  const pipeline = sum(activeEvents, (event) => event.total)
  const paid = sum(activeEvents, (event) => event.paid)
  const balance = pipeline - paid

  report.metrics = [
    metric("Eventos activos", String(activeEvents.length), `No cancelados en ${range.label}`, activeEvents.length, "number", "info"),
    metric("Pipeline", money(pipeline), "Valor total de eventos", pipeline, "money", "success"),
    metric("Cobrado", money(paid), "Pagos registrados", paid, "money", "success"),
    metric("Saldo eventos", money(balance), "Pendiente por cobrar", balance, "money", balance ? "warning" : "success"),
    metric("Capacidad disponible", String(sum(state.salons, (salon) => salon.capacity)), `${state.salons.length} espacios`, sum(state.salons, (salon) => salon.capacity), "number", "info"),
  ]
  report.charts = [
    chartFromCounts("Eventos por estado", countBy(events, (event) => labelFor(event.status))),
    chartFromCounts("Eventos por tipo", countBy(events, (event) => labelFor(event.type))),
    chartFromCounts("Uso por salon", countBy(events, (event) => event.salon)),
  ]
  report.sections = [
    {
      title: "Lectura comercial de eventos",
      tone: balance ? "warning" : "success",
      body: [
        `El pipeline activo en ${range.label} suma ${money(pipeline)} y queda ${money(balance)} por cobrar.`,
        activeEvents.length ? `${activeEvents.length} evento(s) activos deben tener horario, responsable y saldo validados.` : "No hay eventos activos registrados.",
        "Excel incluye tabla de eventos y catalogo de salones con capacidad.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Eventos",
      description: `Agenda comercial y operativa de ${range.label}.`,
      headers: ["Fecha", "Evento", "Cliente", "Salon", "Horario", "Invitados", "Tipo", "Total", "Pagado", "Saldo", "Estado", "Notas"],
      rows: events.map((event) => [
        dateCell(event.date),
        event.title,
        event.client,
        event.salon,
        `${event.startTime} - ${event.endTime}`,
        numberCell(event.guests),
        labelFor(event.type),
        moneyCell(event.total),
        moneyCell(event.paid),
        moneyCell(Math.max(0, event.total - event.paid)),
        labelFor(event.status),
        event.notes ?? "",
      ]),
    },
    {
      title: "Salones y espacios",
      description: "Capacidad y reglas comerciales de espacios.",
      headers: ["Espacio", "Tipo", "Capacidad", "Gratis para huesped", "Descripcion"],
      rows: state.salons.map((salon) => [
        salon.name,
        labelFor(salon.kind),
        numberCell(salon.capacity),
        salon.freeForGuests ? "Si" : "No",
        salon.description,
      ]),
    },
  ]

  return report
}

function buildRoomsReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Habitaciones", "Mapa operativo de habitaciones por estado, piso, tipo, ocupacion y tarifa base.", range)
  const periodReservations = state.reservations.filter((reservation) => reservationStaysInRange(reservation, range) && !["cancelada", "no-show"].includes(reservation.status))
  const occupied = state.rooms.filter((room) => room.status === "ocupada")
  const reserved = state.rooms.filter((room) => room.status === "reservada")
  const unavailable = state.rooms.filter((room) => room.status === "mantenimiento" || room.status === "limpieza")
  const occupancy = safePercent(occupied.length + reserved.length, state.rooms.length)

  report.metrics = [
    metric("Habitaciones", String(state.rooms.length), "Inventario total", state.rooms.length, "number", "info"),
    metric("Ocupadas", String(occupied.length), "En uso", occupied.length, "number", "success"),
    metric("Reservadas", String(reserved.length), "Bloqueadas por reserva", reserved.length, "number", "warning"),
    metric("Fuera de venta", String(unavailable.length), "Limpieza o mantenimiento", unavailable.length, "number", unavailable.length ? "warning" : "success"),
    metric("Ocupacion", formatPercent(occupancy), "Ocupadas + reservadas / total", occupancy, "percent", occupancy >= 70 ? "success" : "info"),
    metric("Reservas periodo", String(periodReservations.length), `Cruzan ${range.label}`, periodReservations.length, "number", periodReservations.length ? "info" : "default"),
  ]
  report.charts = [
    chartFromCounts("Habitaciones por estado", countBy(state.rooms, (room) => labelFor(room.status))),
    chartFromCounts("Habitaciones por tipo", countBy(state.rooms, (room) => roomTypeName(state, room.typeId))),
    chartFromCounts("Reservas por estado", countBy(periodReservations, (reservation) => labelFor(reservation.status))),
  ]
  report.sections = [
    {
      title: "Lectura de disponibilidad",
      tone: unavailable.length ? "warning" : "success",
      body: [
        `La ocupacion operativa es ${formatPercent(occupancy)} sobre ${state.rooms.length} habitaciones.`,
        unavailable.length ? `${unavailable.length} habitacion(es) no estan disponibles para venta por limpieza o mantenimiento.` : "No hay habitaciones fuera de venta.",
        `Excel incluye habitacion, piso, tipo, tarifa base, estado y reservas que cruzan ${range.label}.`,
      ],
    },
  ]
  report.tables = [
    {
      title: "Inventario de habitaciones",
      description: "Habitaciones con estado actual, tipo y tarifa base.",
      headers: ["Habitacion", "Piso", "Tipo", "Tarifa base", "Capacidad", "Estado", "Notas"],
      rows: state.rooms.map((room) => {
        const type = state.roomTypes.find((item) => item.id === room.typeId)
        return [
          room.number,
          numberCell(room.floor),
          type?.name ?? room.typeId,
          moneyCell(type?.basePrice ?? 0),
          numberCell(type?.capacity ?? 0),
          labelFor(room.status),
          room.notes ?? "",
        ]
      }),
    },
    reservationsTable(state, periodReservations, "Reservas que afectan disponibilidad", "Reservas activas que cruzan el periodo seleccionado."),
  ]

  return report
}

function buildMaintenanceReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Mantenimiento", "Tickets abiertos, prioridades, costos resueltos y habitaciones/areas afectadas.", range)
  const periodTickets = state.maintenance.filter((ticket) =>
    dateInRange(ticket.createdAt, range) || dateInRange(ticket.resolvedAt, range) || ticket.status === "abierto" || ticket.status === "en progreso",
  )
  const open = state.maintenance.filter((ticket) => ticket.status === "abierto" || ticket.status === "en progreso")
  const urgent = state.maintenance.filter((ticket) => ticket.priority === "urgente" && ticket.status !== "resuelto")
  const resolvedCost = sum(periodTickets.filter((ticket) => ticket.status === "resuelto"), (ticket) => ticket.cost ?? 0)

  report.metrics = [
    metric("Tickets abiertos", String(open.length), "Abiertos o en progreso", open.length, "number", open.length ? "warning" : "success"),
    metric("Urgentes", String(urgent.length), "Prioridad urgente sin resolver", urgent.length, "number", urgent.length ? "danger" : "success"),
    metric("Costo resuelto", money(resolvedCost), `Tickets resueltos con costo en ${range.label}`, resolvedCost, "money", "info"),
    metric("Habitaciones afectadas", String(new Set(open.map((ticket) => ticket.roomNumber).filter(Boolean)).size), "Con tickets activos", new Set(open.map((ticket) => ticket.roomNumber).filter(Boolean)).size, "number", "warning"),
    metric("Tickets periodo", String(periodTickets.length), "Creados, resueltos o abiertos actuales", periodTickets.length, "number", "info"),
  ]
  report.charts = [
    chartFromCounts("Tickets por estado", countBy(periodTickets, (ticket) => labelFor(ticket.status))),
    chartFromCounts("Tickets por prioridad", countBy(periodTickets, (ticket) => labelFor(ticket.priority))),
    chartFromCounts("Tickets por tipo", countBy(periodTickets, (ticket) => labelFor(ticket.type))),
  ]
  report.sections = [
    {
      title: "Prioridad tecnica",
      tone: urgent.length ? "danger" : open.length ? "warning" : "success",
      body: [
        urgent.length ? `${urgent.length} ticket(s) urgente(s) requieren seguimiento inmediato.` : "No hay tickets urgentes abiertos.",
        open.length ? `${open.length} ticket(s) siguen abiertos o en progreso.` : "No hay tickets tecnicos abiertos.",
        `El costo resuelto registrado en ${range.label} suma ${money(resolvedCost)}.`,
      ],
    },
  ]
  report.tables = [maintenanceTable(periodTickets, "Tickets de mantenimiento del periodo", "Detalle creado, resuelto o aun abierto para seguimiento tecnico.")]

  return report
}

function buildInventoryReport(state: State, category: InventoryCategory, title: string, range: ExportDateRange): ExportReport {
  const report = baseReport(title, "Reporte de inventario con stock, minimo, valor, margen, bajo minimo y movimientos.", range)
  const items = state.inventory.filter((item) => item.category === category)
  const movements = state.inventoryMovements.filter((movement) => {
    const item = state.inventory.find((entry) => entry.id === movement.itemId)
    return item?.category === category && dateInRange(movement.date, range)
  })
  const low = items.filter((item) => item.stock <= item.minStock)
  const stockValue = sum(items, (item) => item.stock * item.cost)
  const retailValue = sum(items, (item) => item.stock * (item.price ?? item.cost))
  const margin = retailValue - stockValue

  report.metrics = [
    metric("Articulos", String(items.length), "Codigos de producto activos en categoria", items.length, "number", "info"),
    metric("Bajo minimo", String(low.length), "Requieren compra o ajuste", low.length, "number", low.length ? "warning" : "success"),
    metric("Valor costo", money(stockValue), "Stock x costo", stockValue, "money", "info"),
    metric(category === "snack" ? "Valor venta" : "Valor reposicion", money(retailValue), category === "snack" ? "Stock x precio de venta" : "Stock x costo", retailValue, "money", "success"),
    metric(category === "snack" ? "Margen potencial" : "Diferencia", money(margin), category === "snack" ? "Venta - costo" : "Normalmente debe ser Q0", margin, "money", category === "snack" ? "success" : "default"),
    metric("Movimientos", String(movements.length), `Entradas/salidas de ${range.label}`, movements.length, "number", movements.length ? "info" : "default"),
  ]
  report.charts = [
    chartFromRows("Stock vs minimo", items.map((item) => [item.name, item.stock]), false),
    chartFromCounts("Movimientos por tipo", countBy(movements, (movement) => labelFor(movement.type))),
  ]
  report.sections = [
    {
      title: "Lectura de inventario",
      tone: low.length ? "warning" : "success",
      body: [
        low.length ? `${low.length} articulo(s) estan en o bajo minimo y deben reponerse.` : "La categoria no tiene articulos bajo minimo.",
        `El valor de inventario a costo es ${money(stockValue)}.`,
        category === "snack"
          ? `El margen potencial de venta es ${money(margin)} sobre el stock actual.`
          : `Excel incluye stock, minimo, valor de reposicion y movimientos de ${range.label}.`,
      ],
    },
  ]
  report.tables = [
    inventoryTable(items, "Inventario actual", "Stock, minimo, costo, valor y margen por codigo de producto."),
    {
      title: "Movimientos",
      description: `Entradas, salidas, ajustes o consumos de ${range.label}.`,
      headers: ["Fecha", "Codigo de producto", "Articulo", "Tipo", "Cantidad", "Habitacion", "Usuario", "Motivo"],
      rows: movements.map((movement) => {
        const item = state.inventory.find((entry) => entry.id === movement.itemId)
        return [
          dateCell(movement.date.slice(0, 10)),
          item?.sku ?? movement.itemId,
          item?.name ?? "",
          labelFor(movement.type),
          numberCell(movement.qty),
          movement.room ?? "",
          movement.user,
          movement.reason,
        ]
      }),
    },
  ]

  return report
}

function buildRatesReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Tarifas", "Tarifas base por tipo de habitacion, capacidad, inventario asociado y potencial de ingreso.", range)
  const roomTypeRows = state.roomTypes.map((type) => {
    const rooms = state.rooms.filter((room) => room.typeId === type.id)
    return { type, rooms, potential: rooms.length * type.basePrice }
  })
  const potential = sum(roomTypeRows, (row) => row.potential)

  report.metrics = [
    metric("Tipos de habitacion", String(state.roomTypes.length), "Tarifas configuradas", state.roomTypes.length, "number", "info"),
    metric("Habitaciones tarifadas", String(state.rooms.length), "Inventario relacionado", state.rooms.length, "number", "success"),
    metric("Ingreso base potencial", money(potential), "Una noche a tarifa base", potential, "money", "success"),
  ]
  report.charts = [
    chartFromRows("Inventario por tarifa", roomTypeRows.map((row) => [row.type.name, row.rooms.length])),
    chartFromRows("Potencial por tipo", roomTypeRows.map((row) => [row.type.name, row.potential]), true),
  ]
  report.sections = [
    {
      title: "Lectura tarifaria",
      body: [
        `El potencial de una noche vendida a tarifa base es ${money(potential)}.`,
        "Validar que las tarifas por ocupacion real esten configuradas en el servidor antes de publicar.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Tarifas por tipo",
      description: "Base actual y potencial por inventario asignado.",
      headers: ["Tipo", "Descripcion", "Tarifa base", "Capacidad", "Habitaciones", "Potencial noche", "Amenidades"],
      rows: roomTypeRows.map(({ type, rooms, potential }) => [
        type.name,
        type.description,
        moneyCell(type.basePrice),
        numberCell(type.capacity),
        numberCell(rooms.length),
        moneyCell(potential),
        type.amenities.join(", "),
      ]),
    },
  ]

  return report
}

function buildUsersReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Usuarios y roles", "Usuarios, roles, estado de acceso y permisos visibles para administracion.", range)
  const active = state.users.filter((user) => user.status === "activo")

  report.metrics = [
    metric("Usuarios", String(state.users.length), "Cuentas configuradas", state.users.length, "number", "info"),
    metric("Activos", String(active.length), "Pueden ingresar", active.length, "number", "success"),
    metric("Inactivos", String(state.users.length - active.length), "Acceso pausado", state.users.length - active.length, "number", state.users.length - active.length ? "warning" : "success"),
    metric("Roles usados", String(new Set(state.users.map((user) => user.role)).size), "Roles distintos", new Set(state.users.map((user) => user.role)).size, "number", "info"),
  ]
  report.charts = [chartFromCounts("Usuarios por rol", countBy(state.users, (user) => labelFor(user.role)))]
  report.sections = [
    {
      title: "Control de acceso",
      body: [
        state.users.length ? "El detalle exportado permite auditar estado, rol y ultimo acceso." : "No hay usuarios cargados desde el servidor en este corte.",
        "Las altas, bajas y permisos deben validarse con los endpoints de usuarios y roles.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Usuarios",
      description: "Cuentas y permisos registrados.",
      headers: ["Nombre", "Correo", "Rol", "Estado", "Ultimo ingreso", "Permisos"],
      rows: state.users.map((user) => [
        user.name,
        user.email,
        labelFor(user.role),
        labelFor(user.status),
        user.lastLogin,
        user.permissions.join(", "),
      ]),
    },
  ]

  return report
}

function buildAuditReport(state: State, range: ExportDateRange): ExportReport {
  const report = baseReport("Auditoria", "Estado de integracion y fuentes de datos disponibles para revision tecnica.", range)
  const sources = Object.entries(state.apiSources)
  report.metrics = [
    metric("Recursos monitoreados", String(sources.length), "Fuentes del servidor", sources.length, "number", "info"),
    metric("Conectados", String(sources.filter(([, source]) => source === "connected").length), "Usando el servidor", sources.filter(([, source]) => source === "connected").length, "number", "success"),
    metric("Sin datos", String(sources.filter(([, source]) => source === "empty").length), "Endpoint sin datos", sources.filter(([, source]) => source === "empty").length, "number", "warning"),
    metric("Sin autorizacion", String(sources.filter(([, source]) => source === "unauthorized").length), "Requieren token/permiso", sources.filter(([, source]) => source === "unauthorized").length, "number", "danger"),
  ]
  report.charts = [chartFromCounts("Fuentes por estado", countBy(sources, ([, source]) => labelFor(source)))]
  report.sections = [
    {
      title: "Lectura tecnica",
      body: [
        "Este reporte resume si la vista esta alimentada por el servidor, datos vacios o consultas protegidas.",
        "Para auditoria real, el servidor debe exponer bitacora con usuario, accion, entidad, fecha, direccion de red y resultado.",
      ],
    },
  ]
  report.tables = [
    {
      title: "Fuentes de datos",
      description: "Estado de cada recurso conocido por el frontend.",
      headers: ["Recurso", "Estado"],
      rows: sources.map(([resource, source]) => [resource, labelFor(source)]),
    },
  ]

  return report
}

function buildConfigurationReport(state: State, range: ExportDateRange): ExportReport {
  const report = buildAuditReport(state, range)
  report.title = "Configuracion"
  report.description = "Resumen de configuracion operativa y estado de conexion de recursos."
  return report
}

function reservationsTable(state: State, reservations: Reservation[], title: string, description: string): ExportTable {
  return {
    title,
    description,
    headers: ["Codigo", "Huesped", "Habitacion", "Ingreso", "Salida", "Noches", "Estado", "Canal", "Total", "Pagado", "Saldo"],
    rows: reservations.map((reservation) => {
      const room = state.rooms.find((item) => item.id === reservation.roomId)
      return [
        reservation.code,
        guestName(state, reservation.guestId),
        room?.number ?? reservation.roomId,
        dateCell(reservation.checkIn),
        dateCell(reservation.checkOut),
        numberCell(reservation.nights),
        labelFor(reservation.status),
        labelFor(reservation.source),
        moneyCell(reservation.total),
        moneyCell(reservation.paid),
        moneyCell(reservationBalance(reservation)),
      ]
    }),
  }
}

function invoicesTable(invoices: State["invoices"], title: string, description: string): ExportTable {
  return {
    title,
    description,
    headers: ["Fecha", "Documento", "Cliente", "NIT", "Subtotal", "Impuesto al valor agregado", "Total", "Estado", "Identificador fiscal"],
    rows: invoices.map((invoice) => [
      dateCell(invoice.date),
      `${invoice.serie}-${invoice.number}`,
      invoice.customer,
      invoice.nit,
      moneyCell(invoice.subtotal),
      moneyCell(invoice.iva),
      moneyCell(invoice.total),
      labelFor(invoice.status),
      invoice.uuid ?? "",
    ]),
  }
}

function inventoryTable(items: InventoryItem[], title: string, description: string): ExportTable {
  return {
    title,
    description,
    headers: ["Codigo de producto", "Articulo", "Categoria", "Stock", "Minimo", "Unidad", "Costo", "Precio", "Valor costo", "Valor venta/reposicion", "Margen", "Ubicacion", "Estado"],
    rows: items.map((item) => {
      const retail = item.price ?? item.cost
      return [
        item.sku,
        item.name,
        labelFor(item.category),
        numberCell(item.stock),
        numberCell(item.minStock),
        item.unit,
        moneyCell(item.cost),
        moneyCell(retail),
        moneyCell(item.stock * item.cost),
        moneyCell(item.stock * retail),
        moneyCell(item.stock * (retail - item.cost)),
        item.location,
        item.stock <= item.minStock ? "Bajo minimo" : "OK",
      ]
    }),
  }
}

function maintenanceTable(tickets: State["maintenance"], title: string, description: string): ExportTable {
  return {
    title,
    description,
    headers: ["Codigo", "Fecha", "Habitacion/Area", "Tipo", "Prioridad", "Estado", "Reportado por", "Asignado a", "Costo", "Descripcion"],
    rows: tickets.map((ticket) => [
      ticket.code,
      dateCell(ticket.createdAt),
      ticket.roomNumber ?? ticket.area ?? "",
      labelFor(ticket.type),
      labelFor(ticket.priority),
      labelFor(ticket.status),
      ticket.reportedBy,
      ticket.assignedTo ?? "",
      moneyCell(ticket.cost ?? 0),
      ticket.description,
    ]),
  }
}

function cashCloseRow(close: CashClose): ExportCell[] {
  return [
    dateCell(close.openedAt.slice(0, 10)),
    close.closedAt ? dateCell(close.closedAt.slice(0, 10)) : "",
    labelFor(close.shift),
    close.user,
    moneyCell(close.cash),
    moneyCell(close.card),
    moneyCell(close.transfer),
    moneyCell(close.deposit),
    moneyCell(close.other),
    moneyCell(close.expenses),
    moneyCell(close.expected),
    moneyCell(close.counted),
    moneyCell(close.difference),
    labelFor(close.status),
  ]
}

type CreditAccountView = CreditAccount & {
  available: number
  usage: number
  daysToDue: number
  health: string
  healthLabel: string
}

function creditAccountsView(state: State): CreditAccountView[] {
  return state.creditAccounts.map((account) => {
    const health = creditHealth(account)
    const available = Math.max(0, account.limit - account.balance)
    return {
      ...account,
      available,
      usage: safePercent(account.balance, account.limit),
      daysToDue: daysBetweenToday(account.dueDate),
      health,
      healthLabel: creditHealthLabel(health),
    }
  })
}

function creditHealth(account: CreditAccount) {
  if (account.creditStatus === "bloqueado") return "bloqueado"
  if (account.creditStatus === "pausado") return "pausado"
  if (account.creditStatus === "autorizado") return "autorizado"
  if (account.status === "vencido") return "vencido"
  if (account.balance >= account.limit) return "sin credito"
  if (account.status === "por vencer") return "por vencer"
  return "al dia"
}

function creditHealthLabel(health: string) {
  const labels: Record<string, string> = {
    "al dia": "Al dia",
    "por vencer": "Por vencer",
    vencido: "Vencido",
    pausado: "Credito pausado",
    bloqueado: "Credito bloqueado",
    autorizado: "Autorizado",
    "sin credito": "Sin credito disponible",
  }

  return labels[health] ?? labelFor(health)
}

function creditDecision(account: CreditAccountView) {
  if (account.health === "bloqueado") return "No otorgar credito"
  if (account.health === "pausado") return "Pedir autorizacion o reactivar desde administracion"
  if (account.health === "vencido") return "Pedir abono antes de nueva reserva"
  if (account.health === "sin credito") return "Sin cupo: pedir abono o ampliar limite"
  if (account.health === "por vencer") return "Puede operar con seguimiento de cobro"
  if (account.health === "autorizado") return "Puede operar por excepcion autorizada"
  return "Puede operar"
}

function buildDomFallbackReport(root: HTMLElement, fallbackTitle: string, range: ExportDateRange): ExportReport {
  const clone = sanitizeClone(root)
  const titleElement = clone.querySelector<HTMLElement>("h1")
  const title = normalizeText(titleElement?.textContent) || fallbackTitle || "Reporte"

  return {
    title,
    description: getPageDescription(clone, titleElement) || "Reporte generado desde el contenido visible.",
    generatedAt: formatDateTime(new Date()),
    filters: [periodFilter(range), ...extractFilters(root)],
    metrics: extractMetrics(clone),
    charts: [],
    sections: extractSections(clone),
    tables: extractTables(clone),
  }
}

function sanitizeClone(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement

  clone.querySelectorAll(CLEANUP_SELECTOR).forEach((node) => {
    node.remove()
  })

  clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(CONTROL_SELECTOR).forEach((node) => {
    const replacement = document.createElement("span")
    replacement.textContent = getControlValue(node)
    node.replaceWith(replacement)
  })

  return clone
}

function extractMetrics(root: HTMLElement): ExportMetric[] {
  const metrics: ExportMetric[] = []
  const seen = new Set<string>()

  root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((card) => {
    const valueElements = getMetricValueElements(card)

    valueElements.forEach((valueElement) => {
      const value = normalizeText(valueElement.textContent)
      if (!isMetricValue(value)) return

      const label = findMetricLabel(card, valueElement)
      if (!label || label === value || label.length > 80) return

      const helper = findMetricHelper(card, label, value)
      const key = `${label}::${value}`

      if (seen.has(key)) return
      seen.add(key)
      metrics.push({ label, value, helper })
    })
  })

  return metrics.slice(0, 16)
}

function getMetricValueElements(card: HTMLElement) {
  const selector = [
    "[data-slot='card-title']",
    "[class*='text-2xl']",
    "[class*='text-3xl']",
    "[class*='text-4xl']",
    "[class*='text-5xl']",
    "[class*='font-serif']",
  ].join(",")
  const candidates = Array.from(card.querySelectorAll<HTMLElement>(selector))
  const unique = new Map<string, HTMLElement>()

  candidates.forEach((candidate) => {
    if (candidate.querySelector(TABLE_SELECTOR)) return
    const text = normalizeText(candidate.textContent)
    if (!isMetricValue(text) || text.length > 72) return
    unique.set(text, candidate)
  })

  return Array.from(unique.values()).slice(0, 4)
}

function findMetricLabel(card: HTMLElement, valueElement: HTMLElement) {
  const previous = getPreviousText(valueElement)
  if (previous && !isMetricValue(previous)) return previous

  const description = normalizeText(card.querySelector<HTMLElement>("[data-slot='card-description']")?.textContent)
  if (description && description.length <= 80) return description

  const title = normalizeText(card.querySelector<HTMLElement>("[data-slot='card-title']")?.textContent)
  if (title && title !== normalizeText(valueElement.textContent) && title.length <= 80) return title

  return undefined
}

function findMetricHelper(card: HTMLElement, label: string, value: string) {
  return Array.from(card.querySelectorAll<HTMLElement>("p, span, [data-slot='card-description']"))
    .map((node) => normalizeText(node.textContent))
    .filter((text) => text && text !== label && text !== value)
    .filter((text) => text.length > 8 && text.length <= 140)
    .find((text) => !looksLikeRepeatedBlock(text))
}

function extractSections(root: HTMLElement): ExportSection[] {
  const sections: ExportSection[] = []
  const seen = new Set<string>()
  const cards = Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR))
  const standaloneSections = Array.from(root.querySelectorAll<HTMLElement>("section")).filter(
    (section) => !section.querySelector(CARD_SELECTOR),
  )

  ;[...cards, ...standaloneSections].forEach((container) => {
    if (container.querySelector(TABLE_SELECTOR)) return
    const title = getContainerTitle(container)
    if (!title) return

    const body = uniqueTexts(
      Array.from(container.querySelectorAll<HTMLElement>("p, li"))
        .map((node) => normalizeText(node.textContent))
        .filter((text) => text !== title)
        .filter(isUsefulSentence)
        .filter((text) => !isMetricValue(text)),
    ).slice(0, 4)

    if (body.length === 0) return

    const key = `${title}::${body.join("|")}`
    if (seen.has(key)) return
    seen.add(key)
    sections.push({ title, body })
  })

  return sections.slice(0, 6)
}

function extractTables(root: HTMLElement): ExportTable[] {
  const tables: ExportTable[] = []
  const seen = new Set<string>()

  root.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table, index) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) => normalizeText(cell.textContent)).filter(Boolean)
    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .map((row) => Array.from(row.querySelectorAll("td, th")).map((cell) => normalizeText(cell.textContent)).filter(Boolean))
      .filter((row) => row.length > 0)

    if (headers.length === 0 && rows.length === 0) return

    const normalizedHeaders = headers.length ? headers : Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, cellIndex) => `Columna ${cellIndex + 1}`)
    const title = getTableTitle(table, index)
    const key = `${title}::${normalizedHeaders.join("|")}::${rows.slice(0, 3).map((row) => row.join("|")).join("/")}`

    if (seen.has(key)) return
    seen.add(key)
    tables.push({
      title,
      description: getTableDescription(table),
      headers: normalizedHeaders,
      rows,
    })
  })

  return tables
}

function buildDocumentHtml(report: ExportReport) {
  return buildReportShell(report, buildReportBody(report), "document")
}

function buildReportBody(report: ExportReport) {
  const filters = report.filters.length
    ? `<section class="report-section compact">
        <div class="section-heading">
          <p>Filtros</p>
          <h2>Parametros del reporte</h2>
        </div>
        <div class="filter-grid">${report.filters.map(renderFilter).join("")}</div>
      </section>`
    : ""
  const metrics = report.metrics.length
    ? `<section class="report-section">
        <div class="section-heading">
          <p>Resumen</p>
          <h2>Indicadores principales</h2>
        </div>
        <div class="metric-grid">${report.metrics.map(renderMetric).join("")}</div>
      </section>`
    : ""
  const charts = report.charts.length
    ? `<section class="report-section">
        <div class="section-heading">
          <p>Analisis visual</p>
          <h2>Graficas del reporte</h2>
        </div>
        <div class="chart-grid">${report.charts.map(renderChart).join("")}</div>
      </section>`
    : ""
  const sections = report.sections.length
    ? `<section class="report-section">
        <div class="section-heading">
          <p>Lectura</p>
          <h2>Observaciones ejecutivas</h2>
        </div>
        <div class="insight-grid">${report.sections.map(renderSection).join("")}</div>
      </section>`
    : ""
  const tables = report.tables.length
    ? report.tables.map(renderTable).join("")
    : `<section class="report-section compact"><div class="empty-state">No hay tablas disponibles para este corte.</div></section>`

  return `${filters}${metrics}${charts}${sections}${tables}`
}

function buildReportShell(report: ExportReport, body: string, mode: "document" | "spreadsheet") {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base href="${escapeHtml(getDocumentBaseUrl())}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.fileName ?? report.title)}</title>
    <style>${mode === "spreadsheet" ? "" : documentStyles()}</style>
  </head>
  <body>
    <main class="report-shell">
      <header class="report-cover">
        <div class="cover-brand">
          <div class="logo-frame">
            <img src="${escapeHtml(getAssetUrl(LOGO_PATH))}" alt="Casa Luna" />
          </div>
          <div>
            <p class="brand">Casa Luna Boutique Hotel</p>
            <p class="brand-line">Reporte operativo premium</p>
          </div>
        </div>
        <div class="cover-title">
          <h1>${escapeHtml(report.title)}</h1>
          ${report.description ? `<p class="description">${escapeHtml(report.description)}</p>` : ""}
        </div>
        <div class="report-meta">
          <span>Generado</span>
          <strong>${escapeHtml(report.generatedAt)}</strong>
        </div>
      </header>
      ${body}
      <footer class="report-footer">
        <span>Reporte generado desde Casa Luna</span>
        <span>${escapeHtml(report.title)}</span>
      </footer>
    </main>
  </body>
</html>`
}

function renderFilter(filter: ExportFilter) {
  return `<div class="filter-card"><span>${escapeHtml(filter.label)}</span><strong>${escapeHtml(filter.value)}</strong></div>`
}

function renderMetric(metric: ExportMetric) {
  return `<article class="metric-card ${toneClass[metric.tone ?? "default"]}">
    <p>${escapeHtml(metric.label)}</p>
    <strong>${escapeHtml(metric.value)}</strong>
    ${metric.helper ? `<span>${escapeHtml(metric.helper)}</span>` : ""}
  </article>`
}

function renderSection(section: ExportSection) {
  return `<article class="insight-card ${toneClass[section.tone ?? "default"]}">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.body.map((body) => `<p>${escapeHtml(body)}</p>`).join("")}
  </article>`
}

function renderChart(chart: ExportChart) {
  const max = Math.max(1, ...chart.data.map((item) => Math.abs(item.value)))

  return `<article class="chart-card">
    <div class="chart-heading">
      <h3>${escapeHtml(chart.title)}</h3>
      ${chart.description ? `<p>${escapeHtml(chart.description)}</p>` : ""}
    </div>
    <div class="chart-bars">
      ${chart.data
        .map((item) => {
          const width = Math.max(3, Math.min(100, (Math.abs(item.value) / max) * 100))
          return `<div class="chart-row">
            <div class="chart-label">${escapeHtml(item.label)}</div>
            <div class="chart-track">
              <div class="chart-bar ${toneClass[item.tone ?? "default"]}" style="width:${width}%"></div>
            </div>
            <div class="chart-value">${escapeHtml(item.valueLabel ?? formatNumber(item.value))}</div>
          </div>`
        })
        .join("")}
    </div>
  </article>`
}

function renderTable(table: ExportTable) {
  return `<section class="report-section table-section">
    <div class="section-heading">
      <p>Detalle</p>
      <h2>${escapeHtml(table.title)}</h2>
      ${table.description ? `<span>${escapeHtml(table.description)}</span>` : ""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${table.rows
            .map((row) => `<tr>${table.headers.map((_, index) => `<td class="${cellClass(row[index])}">${escapeHtml(displayCell(row[index]))}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`
}

function buildSpreadsheetXml(report: ExportReport) {
  const worksheets = [
    renderWorksheet("Resumen", summaryRows(report)),
    ...report.charts.map((chart) =>
      renderWorksheet(`Grafica ${chart.title}`, [
        ["CASA LUNA BOUTIQUE HOTEL"],
        [chart.title],
        [chart.description ?? "Datos listos para graficar en Excel."],
        [],
        ["Concepto", "Valor", "Lectura visual"],
        ...chart.data.map((item) => [item.label, numberCell(item.value), excelDataBar(item.value, chart.data)]),
      ]),
    ),
    ...report.tables.map((table) =>
      renderWorksheet(table.title, [
        ["CASA LUNA BOUTIQUE HOTEL"],
        [table.title],
        [table.description ?? "Tabla exportable con datos operativos."],
        [],
        table.headers,
        ...table.rows,
      ]),
    ),
  ].join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(report.title)}</Title>
    <Author>Casa Luna</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1F2933"/><Alignment ss:Vertical="Top"/></Style>
    <Style ss:ID="Brand"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="13" ss:Color="#FFFFFF"/><Interior ss:Color="#1F2933" ss:Pattern="Solid"/></Style>
    <Style ss:ID="HeroTitle"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="22" ss:Color="#20140F"/><Interior ss:Color="#FFF4E6" ss:Pattern="Solid"/></Style>
    <Style ss:ID="HeroSubtitle"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:Color="#52616F" ss:Size="11"/><Interior ss:Color="#FFFDF7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Title"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="21" ss:Color="#20140F"/><Interior ss:Color="#FFF4E6" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Subtitle"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:Color="#52616F" ss:Size="11"/><Interior ss:Color="#FFFDF7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Meta"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#1F2933" ss:Size="11"/><Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetaBand"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0F766E" ss:Pattern="Solid"/><Borders>${xmlBorders("#0F766E")}</Borders></Style>
    <Style ss:ID="MetaLabel"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#7A3D1C" ss:Pattern="Solid"/><Borders>${xmlBorders("#7A3D1C")}</Borders></Style>
    <Style ss:ID="MetaValue"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#20140F" ss:Size="12"/><Interior ss:Color="#FFF4E6" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="Section"><Alignment ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/><Interior ss:Color="#B85F2B" ss:Pattern="Solid"/></Style>
    <Style ss:ID="SectionDark"><Alignment ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/><Interior ss:Color="#1F2933" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#7A3D1C" ss:Pattern="Solid"/><Borders>${xmlBorders("#7A3D1C")}</Borders></Style>
    <Style ss:ID="MetricLabel"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Size="9" ss:Color="#7A3D1C"/><Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetricValue"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16" ss:Color="#20140F"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetricMoney"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16" ss:Color="#20140F"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><NumberFormat ss:Format="&quot;Q&quot; #,##0.00"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetricNumber"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16" ss:Color="#20140F"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetricPercent"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="16" ss:Color="#20140F"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><NumberFormat ss:Format="0.00"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="MetricHelper"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:Color="#64748B" ss:Size="9"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="ChartTitle"><Alignment ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#0F766E" ss:Pattern="Solid"/></Style>
    <Style ss:ID="ChartLabel"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Color="#334155" ss:Size="9"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="ChartValue"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#334155" ss:Size="9"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="InsightTitle"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#7A3D1C" ss:Size="10"/><Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="InsightText"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:Color="#334155" ss:Size="10"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders>${xmlBorders("#E7D3BA")}</Borders></Style>
    <Style ss:ID="Text"><Borders>${xmlBorders("#D9E0E8")}</Borders><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
    <Style ss:ID="TextAlt"><Interior ss:Color="#FCFAF7" ss:Pattern="Solid"/><Borders>${xmlBorders("#D9E0E8")}</Borders><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
    <Style ss:ID="Bar"><Font ss:Color="#0F766E" ss:Bold="1"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="Number"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0.00"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="Integer"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="Money"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="&quot;Q&quot; #,##0.00"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
    <Style ss:ID="Percent"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="0.00"/><Borders>${xmlBorders("#D9E0E8")}</Borders></Style>
  </Styles>
  ${worksheets}
</Workbook>`
}

function summaryRows(report: ExportReport): ExportCell[][] {
  const rows: ExportCell[][] = [
    [styledCell("CASA LUNA BOUTIQUE HOTEL", "Brand", 7)],
    [
      styledCell(report.title, "HeroTitle", 4),
      styledCell("Generado", "MetaLabel"),
      styledCell(report.generatedAt, "MetaValue", 1),
    ],
    [styledCell(report.description ?? "Reporte operativo premium.", "HeroSubtitle", 7)],
    [styledCell("RESUMEN DEL ARCHIVO", "MetaBand", 7)],
    [
      styledCell("Tipo", "MetaLabel"),
      styledCell("Reporte operativo", "MetaValue"),
      styledCell("Hojas de datos", "MetaLabel"),
      styledCell(report.tables.length, "MetaValue"),
      styledCell("Graficas", "MetaLabel"),
      styledCell(report.charts.length, "MetaValue"),
      styledCell("Indicadores", "MetaLabel"),
      styledCell(report.metrics.length, "MetaValue"),
    ],
    [],
  ]

  if (report.metrics.length) {
    rows.push([styledCell("TABLERO EJECUTIVO", "SectionDark", 7)])
    rows.push(...metricDashboardRows(report.metrics))
    rows.push([])
  }

  if (report.charts.length) {
    rows.push([styledCell("LECTURA VISUAL", "Section", 7)])
    rows.push(...chartDashboardRows(report.charts.slice(0, 2)))
    rows.push([])
  }

  if (report.sections.length) {
    rows.push([styledCell("OBSERVACIONES EJECUTIVAS", "Section", 7)])
    rows.push(
      ...report.sections.flatMap((section) =>
        section.body.map((body) => [
          styledCell(section.title, "InsightTitle", 1),
          styledCell(body, "InsightText", 5),
        ]),
      ),
    )
    rows.push([])
  }

  if (report.filters.length) {
    rows.push([styledCell("FILTROS Y CORTE", "Section", 7)])
    rows.push(["Filtro", "Valor"])
    rows.push(...report.filters.map((item) => [item.label, item.value]))
  }

  return rows
}

function metricDashboardRows(metrics: ExportMetric[]) {
  const rows: ExportCell[][] = []
  const groups = chunk(metrics.slice(0, 8), 4)

  groups.forEach((group) => {
    rows.push(group.flatMap((item) => [styledCell(item.label.toUpperCase(), "MetricLabel", 1)]))
    rows.push(group.flatMap((item) => [metricCardValueCell(item)]))
    rows.push(group.flatMap((item) => [styledCell(item.helper ?? "", "MetricHelper", 1)]))
    rows.push([])
  })

  return rows
}

function chartDashboardRows(charts: ExportChart[]) {
  const [left, right] = charts
  const rows: ExportCell[][] = []
  const maxRows = Math.max(left?.data.length ?? 0, right?.data.length ?? 0, 1)

  rows.push([
    styledCell(left?.title ?? "Grafica", "ChartTitle", 3),
    styledCell(right?.title ?? "Grafica", "ChartTitle", 3),
  ])

  for (let index = 0; index < maxRows; index += 1) {
    const leftItem = left?.data[index]
    const rightItem = right?.data[index]

    rows.push([
      styledCell(leftItem?.label ?? "", "ChartLabel"),
      styledCell(leftItem ? excelDataBar(leftItem.value, left?.data ?? []) : "", "Bar", 1),
      styledCell(leftItem?.valueLabel ?? "", "ChartValue"),
      styledCell(rightItem?.label ?? "", "ChartLabel"),
      styledCell(rightItem ? excelDataBar(rightItem.value, right?.data ?? []) : "", "Bar", 1),
      styledCell(rightItem?.valueLabel ?? "", "ChartValue"),
    ])
  }

  return rows
}

function renderWorksheet(name: string, rows: ExportCell[][]) {
  const sheetName = uniqueSheetName(name)
  const widths = sheetName === "Resumen" ? summaryColumnWidths() : columnWidthsForRows(rows)
  const freezeRow = sheetName === "Resumen" ? 5 : firstHeaderRowIndex(rows)

  return `<Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table ss:DefaultRowHeight="21">
      ${widths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join("")}
      ${rows.map((row, index) => renderExcelRow(row, index, widths.length)).join("")}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>${freezeRow}</SplitHorizontal>
      <TopRowBottomPane>${freezeRow}</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
        <FitToPage/>
      </PageSetup>
    </WorksheetOptions>
  </Worksheet>`
}

function summaryColumnWidths() {
  return [165, 120, 165, 86, 165, 120, 165, 86]
}

function renderExcelRow(row: ExportCell[], rowIndex: number, columnCount: number) {
  if (row.length === 0) return `<Row ss:Height="8"></Row>`

  const isBrand = row.length === 1 && rowIndex === 0
  const isTitle = row.length === 1 && rowIndex === 1
  const isSubtitle = row.length === 1 && rowIndex === 2
  const isMeta = isSummaryMetaRow(row)
  const isSection = row.length === 1 && rowIndex > 2
  const isHeader = isExcelHeaderRow(row)
  const rowStyle = isBrand
    ? "Brand"
    : isTitle
      ? "Title"
      : isSubtitle
        ? "Subtitle"
        : isMeta
          ? "Meta"
          : isSection
            ? "Section"
            : isHeader
              ? "Header"
              : undefined
  const height = isBrand
    ? 26
    : isTitle
      ? 34
      : isSubtitle
        ? 38
        : isMeta
          ? 32
          : isSection
            ? 24
            : isHeader
              ? 25
              : rowHeight(row)

  if (isBrand || isTitle || isSubtitle || isSection) {
    return `<Row ss:Height="${height}">${renderExcelCell(row[0], rowStyle, columnCount - 1)}</Row>`
  }

  return `<Row ss:Height="${height}">${row.map((cell) => renderExcelCell(cell, rowStyle, undefined, rowIndex)).join("")}</Row>`
}

function isExcelHeaderRow(row: ExportCell[]) {
  const first = String(rawCell(row[0]) ?? "").toLowerCase()
  return [
    "indicador",
    "filtro",
    "observacion",
    "concepto",
    "codigo",
    "fecha",
    "empresa",
    "cliente",
    "huesped",
    "habitacion",
    "sku",
    "articulo",
    "apertura",
    "nombre",
    "recurso",
    "espacio",
    "tipo",
  ].includes(first)
}

function isSummaryMetaRow(row: ExportCell[]) {
  const labels = row.map((cell) => String(rawCell(cell) ?? "").toLowerCase())
  return labels.includes("tipo") && labels.includes("hojas de datos") && labels.includes("graficas")
}

function firstHeaderRowIndex(rows: ExportCell[][]) {
  const index = rows.findIndex(isExcelHeaderRow)
  return index >= 0 ? index + 1 : 4
}

function columnWidthsForRows(rows: ExportCell[][]) {
  const columnCount = Math.max(8, ...rows.map((row) => row.length))

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const samples = rows.slice(0, 90).map((row) => displayCell(row[columnIndex]))
    const header = samples.find(Boolean) ?? ""
    const maxLength = Math.max(...samples.map((value) => String(value).length), 8)
    const hasMoney = rows.some((row) => cellKind(row[columnIndex]) === "money")
    const hasNumber = rows.some((row) => ["number", "percent"].includes(cellKind(row[columnIndex])))

    if (columnIndex === 0) return clamp(maxLength * 6.2 + 58, 170, 285)
    if (hasMoney) return 118
    if (hasNumber) return 92
    if (/contexto|detalle|descripcion|observacion|decision|motivo|notas|referencia/i.test(header)) {
      return clamp(maxLength * 4.8 + 80, 220, 380)
    }
    if (/correo|email|contacto|cliente|empresa|huesped|concepto|articulo/i.test(header)) {
      return clamp(maxLength * 5.5 + 64, 170, 320)
    }
    if (/fecha|vence|ingreso|salida|apertura|cierre/i.test(header)) return 112

    return clamp(maxLength * 5.8 + 44, 96, 260)
  })
}

function rowHeight(row: ExportCell[]) {
  const maxLength = Math.max(...row.map((cell) => displayCell(cell).length), 0)
  if (maxLength > 110) return 58
  if (maxLength > 70) return 44
  if (maxLength > 42) return 32
  return 22
}

function excelDataBar(value: number, items: ExportChartItem[]): string {
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)))
  const blocks = Math.max(1, Math.round((Math.abs(value) / max) * 24))
  return String.fromCharCode(9608).repeat(blocks)
}

function renderExcelCell(cell: ExportCell, forcedStyle?: string, mergeAcross?: number, rowIndex?: number) {
  const kind = cellKind(cell)
  const raw = rawCell(cell)
  const isNumber = typeof raw === "number" && Number.isFinite(raw)
  const explicitStyle = typeof cell === "object" && cell ? cell.style : undefined
  const explicitMerge = typeof cell === "object" && cell ? cell.mergeAcross : undefined
  const style = explicitStyle ?? forcedStyle ?? excelStyleForKind(kind, raw, rowIndex)
  const type = isNumber ? "Number" : "String"
  const value = isNumber ? String(raw) : escapeXml(String(raw ?? ""))
  const mergeValue = explicitMerge ?? mergeAcross
  const merge = mergeValue && mergeValue > 0 ? ` ss:MergeAcross="${mergeValue}"` : ""

  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${value}</Data></Cell>`
}

function xmlBorders(color = "#D9E0E8") {
  return `<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${color}"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${color}"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${color}"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="${color}"/>`
}

function openPrintableReport(report: ExportReport, autoPrint: boolean) {
  const html = buildDocumentHtml(report).replace(
    "</body>",
    `<script>
      window.addEventListener("load", () => {
        window.focus();
        ${autoPrint ? "setTimeout(() => window.print(), 250);" : ""}
      });
    </script></body>`,
  )
  const printWindow = window.open("", "_blank", "width=1120,height=780")

  if (!printWindow) {
    downloadFile(`${report.fileName ?? `${slug(report.title)}-${localIsoDate()}`}.html`, html, "text/html;charset=utf-8")
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

function documentStyles() {
  return `
    :root {
      color-scheme: light;
      --ink: #1f2933;
      --muted: #64748b;
      --line: #d9e0e8;
      --soft: #f6efe3;
      --brand: #b85f2b;
      --brand-strong: #7a3d1c;
      --success: #0f766e;
      --warning: #b7791f;
      --danger: #b42318;
      --info: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #f3eadb 0%, #fffaf2 35%, #ffffff 100%);
      color: var(--ink);
      font-family: Inter, Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }
    .report-shell {
      width: min(1140px, calc(100% - 32px));
      margin: 24px auto;
      border: 1px solid rgba(122, 61, 28, 0.16);
      background: #ffffff;
      box-shadow: 0 20px 48px rgba(31, 41, 51, 0.12);
    }
    .report-cover {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: start;
      border-bottom: 1px solid var(--line);
      background:
        linear-gradient(135deg, rgba(184, 95, 43, 0.12), rgba(15, 118, 110, 0.08)),
        #fffaf2;
      padding: 34px;
    }
    .cover-brand {
      display: flex;
      grid-column: 1 / -1;
      align-items: center;
      gap: 14px;
    }
    .cover-title {
      min-width: 0;
    }
    .logo-frame {
      display: grid;
      width: 64px;
      height: 64px;
      place-items: center;
      overflow: hidden;
      border: 1px solid rgba(122, 61, 28, 0.24);
      background: #ffffff;
    }
    .logo-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .brand {
      margin: 0;
      color: var(--brand-strong);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.24em;
      text-transform: uppercase;
    }
    .brand-line {
      margin: 4px 0 0;
      color: #52616f;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1, h2, h3, p { overflow-wrap: anywhere; }
    h1 {
      margin: 0;
      color: #20140f;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(30px, 4vw, 48px);
      font-weight: 600;
      line-height: 1.02;
      letter-spacing: 0;
    }
    .description {
      max-width: 820px;
      margin: 14px 0 0;
      color: #52616f;
      font-size: 15px;
    }
    .report-meta {
      min-width: 190px;
      border: 1px solid rgba(184, 95, 43, 0.2);
      background: rgba(255, 255, 255, 0.78);
      padding: 14px 16px;
    }
    .report-meta span,
    .section-heading p,
    .filter-card span,
    .metric-card p {
      display: block;
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .report-meta strong {
      display: block;
      margin-top: 6px;
      font-size: 13px;
    }
    .report-section {
      padding: 28px 34px;
      border-bottom: 1px solid var(--line);
    }
    .report-section.compact {
      padding-block: 22px;
    }
    .section-heading {
      display: grid;
      gap: 4px;
      margin-bottom: 16px;
    }
    .section-heading p,
    .section-heading h2,
    .section-heading span {
      margin: 0;
    }
    .section-heading h2 {
      color: #20140f;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 23px;
      font-weight: 600;
      letter-spacing: 0;
    }
    .section-heading span {
      color: var(--muted);
      font-size: 13px;
    }
    .filter-grid,
    .metric-grid,
    .insight-grid,
    .chart-grid {
      display: grid;
      gap: 12px;
    }
    .filter-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .metric-grid { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .insight-grid { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .chart-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
    .filter-card,
    .metric-card,
    .insight-card,
    .chart-card {
      border: 1px solid var(--line);
      background: #ffffff;
      padding: 16px;
    }
    .filter-card strong {
      display: block;
      margin-top: 6px;
      color: var(--ink);
      font-size: 14px;
    }
    .metric-card { border-top: 3px solid var(--brand); }
    .metric-card.tone-success { border-top-color: var(--success); }
    .metric-card.tone-warning { border-top-color: var(--warning); }
    .metric-card.tone-danger { border-top-color: var(--danger); }
    .metric-card.tone-info { border-top-color: var(--info); }
    .metric-card strong {
      display: block;
      margin-top: 8px;
      color: #20140f;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 27px;
      font-weight: 700;
      line-height: 1.05;
    }
    .metric-card span {
      display: block;
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .chart-heading h3,
    .insight-card h3 {
      margin: 0 0 8px;
      color: #20140f;
      font-size: 15px;
    }
    .chart-heading p,
    .insight-card p {
      margin: 0 0 8px;
      color: #52616f;
      font-size: 13px;
    }
    .chart-bars {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .chart-row {
      display: grid;
      grid-template-columns: minmax(94px, 0.9fr) minmax(120px, 2fr) minmax(68px, auto);
      gap: 10px;
      align-items: center;
      font-size: 12px;
    }
    .chart-label,
    .chart-value {
      color: #334155;
      font-weight: 650;
    }
    .chart-value {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .chart-track {
      height: 11px;
      overflow: hidden;
      background: #eef2f7;
      border: 1px solid #d9e0e8;
    }
    .chart-bar {
      height: 100%;
      background: var(--brand);
    }
    .chart-bar.tone-success { background: var(--success); }
    .chart-bar.tone-warning { background: var(--warning); }
    .chart-bar.tone-danger { background: var(--danger); }
    .chart-bar.tone-info { background: var(--info); }
    .insight-card { border-left: 4px solid var(--brand); }
    .insight-card.tone-success { border-left-color: var(--success); }
    .insight-card.tone-warning { border-left-color: var(--warning); }
    .insight-card.tone-danger { border-left-color: var(--danger); }
    .insight-card.tone-info { border-left-color: var(--info); }
    .insight-card p:last-child { margin-bottom: 0; }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--line);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      font-size: 12px;
    }
    th,
    td {
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f6efe3;
      color: #4a3425;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    td.cell-money,
    td.cell-number,
    td.cell-percent {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    tr:nth-child(even) td { background: #fcfaf7; }
    .empty-state {
      border: 1px dashed var(--line);
      background: #fcfaf7;
      padding: 18px;
      color: var(--muted);
      font-size: 13px;
    }
    .report-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 34px;
      color: var(--muted);
      font-size: 11px;
    }

    @media (max-width: 720px) {
      .report-shell {
        width: 100%;
        margin: 0;
        border-width: 0;
      }
      .report-cover,
      .report-section,
      .report-footer {
        padding-inline: 18px;
      }
      .report-cover,
      .chart-row {
        grid-template-columns: 1fr;
      }
      .cover-brand {
        grid-column: auto;
      }
      .report-meta { min-width: 0; }
      .report-footer { flex-direction: column; }
      .chart-value { text-align: left; }
    }

    @media print {
      @page { size: A4; margin: 12mm; }
      body {
        background: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .report-shell {
        width: 100%;
        margin: 0;
        border: 0;
        box-shadow: none;
      }
      .report-cover { padding: 0 0 18px; }
      .report-section { padding: 18px 0; }
      .report-footer { padding: 12px 0 0; }
      .report-section,
      .metric-card,
      .insight-card,
      .chart-card,
      table,
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .table-wrap { overflow: visible; }
      h1 { font-size: 32px; }
      .metric-card strong { font-size: 22px; }
    }
  `
}

function chartFromCounts(title: string, counts: Map<string, number>): ExportChart {
  return {
    title,
    data: Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, valueLabel: formatNumber(value), tone: toneForLabel(label) })),
  }
}

function chartFromRows(title: string, rows: Array<[string, number]>, moneyValues = false): ExportChart {
  return {
    title,
    data: rows.map(([label, value]) => ({
      label,
      value,
      valueLabel: moneyValues ? money(value) : formatNumber(value),
      tone: toneForLabel(label),
    })),
  }
}

function metric(label: string, value: string, helper: string, raw?: number, kind?: CellKind, tone?: Tone): ExportMetric {
  return { label, value, helper, raw, kind, tone }
}

function moneyCell(value: number): ExportCellObject {
  return { value, display: money(value), kind: "money" }
}

function numberCell(value: number): ExportCellObject {
  return { value, display: formatNumber(value), kind: Number.isInteger(value) ? "number" : "number" }
}

function percentCell(value: number): ExportCellObject {
  return { value, display: formatPercent(value), kind: "percent" }
}

function dateCell(value: string): ExportCellObject {
  return { value, display: formatDate(value), kind: "date" }
}

function reportMetricCell(value: number, kind: "number" | "money" | "percent") {
  if (kind === "money") return moneyCell(value)
  if (kind === "percent") return percentCell(value)
  return numberCell(value)
}

function metricExcelCell(metricItem: ExportMetric): ExportCell {
  if (typeof metricItem.raw !== "number") return metricItem.value
  if (metricItem.kind === "money") return moneyCell(metricItem.raw)
  if (metricItem.kind === "percent") return percentCell(metricItem.raw)
  return numberCell(metricItem.raw)
}

function metricCardValueCell(metricItem: ExportMetric): ExportCell {
  const value = metricExcelCell(metricItem)
  const style =
    metricItem.kind === "money"
      ? "MetricMoney"
      : metricItem.kind === "percent"
        ? "MetricPercent"
        : typeof rawCell(value) === "number"
          ? "MetricNumber"
          : "MetricValue"

  return {
    value: rawCell(value),
    display: displayCell(value),
    kind: cellKind(value),
    style,
    mergeAcross: 1,
  }
}

function styledCell(
  value: string | number | ExportCellObject,
  style: string,
  mergeAcross?: number,
): ExportCellObject {
  if (typeof value === "object") {
    return { ...value, style, mergeAcross: mergeAcross ?? value.mergeAcross }
  }

  return { value, style, mergeAcross }
}

function cellKind(cell: ExportCell): CellKind {
  if (typeof cell === "object" && cell && "kind" in cell && cell.kind) return cell.kind
  if (typeof cell === "number") return "number"
  return "text"
}

function rawCell(cell: ExportCell) {
  if (cell == null) return ""
  if (typeof cell === "object" && "value" in cell) return cell.value
  return cell
}

function displayCell(cell: ExportCell) {
  if (cell == null) return ""
  if (typeof cell === "object" && "display" in cell && cell.display != null) return cell.display
  if (typeof cell === "number") return formatNumber(cell)
  return String(cell)
}

function cellClass(cell: ExportCell) {
  const kind = cellKind(cell)
  if (kind === "money") return "cell-money"
  if (kind === "percent") return "cell-percent"
  if (kind === "number") return "cell-number"
  return "cell-text"
}

function excelStyleForKind(kind: CellKind, value: unknown, rowIndex?: number) {
  if (kind === "money") return "Money"
  if (kind === "percent") return "Percent"
  if (kind === "number") return typeof value === "number" && Number.isInteger(value) ? "Integer" : "Number"
  if (typeof value === "string" && value.includes("█")) return "Bar"
  return typeof rowIndex === "number" && rowIndex % 2 === 0 ? "TextAlt" : "Text"
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>()
  items.forEach((item) => {
    const key = getKey(item) || "Sin clasificar"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return counts
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + Number(pick(item) || 0), 0)
}

function safePercent(value: number, total: number) {
  return total ? (value / total) * 100 : 0
}

function normalizeExportDateRange(from?: string, to?: string): ExportDateRange {
  const fallback = localIsoDate()
  const rawFrom = normalizeIsoDate(from) ?? normalizeIsoDate(to) ?? fallback
  const rawTo = normalizeIsoDate(to) ?? normalizeIsoDate(from) ?? fallback
  const [start, end] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom]
  const isSingleDay = start === end

  return {
    from: start,
    to: end,
    isSingleDay,
    label: isSingleDay ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`,
    fileSuffix: isSingleDay ? start : `${start}_a_${end}`,
  }
}

function periodFilter(range: ExportDateRange): ExportFilter {
  return {
    label: range.isSingleDay ? "Fecha del reporte" : "Rango del reporte",
    value: range.label,
  }
}

function dateInRange(value: string | null | undefined, range: ExportDateRange) {
  const date = normalizeIsoDate(value)
  return Boolean(date && date >= range.from && date <= range.to)
}

function reservationTouchesRange(reservation: Reservation, range: ExportDateRange) {
  return reservationStaysInRange(reservation, range) || dateInRange(reservation.createdAt, range)
}

function reservationStaysInRange(reservation: Reservation, range: ExportDateRange) {
  return dateRangeOverlaps(reservation.checkIn, reservation.checkOut, range)
}

function dateRangeOverlaps(start: string | null | undefined, end: string | null | undefined, range: ExportDateRange) {
  const normalizedStart = normalizeIsoDate(start)
  const normalizedEnd = normalizeIsoDate(end) ?? normalizedStart

  if (!normalizedStart && !normalizedEnd) return false
  if (!normalizedStart) return dateInRange(normalizedEnd, range)

  const [startDate, endDate] =
    normalizedEnd && normalizedEnd < normalizedStart
      ? [normalizedEnd, normalizedStart]
      : [normalizedStart, normalizedEnd ?? normalizedStart]

  return startDate <= range.to && endDate >= range.from
}

function normalizeIsoDate(value: string | null | undefined) {
  const text = String(value ?? "").trim()
  if (!text) return undefined

  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return undefined
  return localIsoDate(date)
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }

  return groups
}

function reservationBalance(reservation: Reservation) {
  return Math.max(0, reservation.total - reservation.paid)
}

function guestName(state: State, guestId: string) {
  return state.guests.find((guest) => guest.id === guestId)?.name ?? "Huesped"
}

function roomTypeName(state: State, typeId: string) {
  return state.roomTypes.find((type) => type.id === typeId)?.name ?? typeId
}

function breakfastLabel(state: State, type: string) {
  return state.breakfastOptions.find((option) => option.id === type)?.label ?? type
}

function daysBetweenToday(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function labelFor(value: string) {
  return statusLabels[value] ?? value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toneForLabel(label: string): Tone {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (/(venc|bloq|urg|anulad|cancel|mantenimiento|sin credito|diferencia)/.test(normalized)) return "danger"
  if (/(pend|limpieza|paus|por vencer|reserv|bajo|minimo|transfer)/.test(normalized)) return "warning"
  if (/(emit|activo|dispon|al dia|resuelto|ocupada|efectivo)/.test(normalized)) return "success"
  if (/(tarjeta|autoriz|info|en casa)/.test(normalized)) return "info"
  return "default"
}

function getPageDescription(root: HTMLElement, titleElement: HTMLElement | null) {
  if (!titleElement) {
    const paragraph = root.querySelector<HTMLElement>("p")
    return normalizeText(paragraph?.textContent)
  }

  let sibling = titleElement.nextElementSibling

  while (sibling) {
    if (sibling instanceof HTMLElement) {
      const text = normalizeText(sibling.textContent)
      if (isUsefulSentence(text)) return text
    }
    sibling = sibling.nextElementSibling
  }

  const parentParagraph = titleElement.parentElement?.querySelector<HTMLElement>("p")
  const text = normalizeText(parentParagraph?.textContent)
  return isUsefulSentence(text) ? text : undefined
}

function extractFilters(root: HTMLElement) {
  const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(CONTROL_SELECTOR))
  const dateLabels = ["Desde", "Hasta"]
  let dateIndex = 0
  const filters: ExportFilter[] = []
  const seen = new Set<string>()

  controls.forEach((control, index) => {
    if (isControlExcluded(control)) return

    const value = getControlValue(control)
    if (!value || value === "0") return

    const fallbackLabel =
      control instanceof HTMLInputElement && control.type === "date"
        ? dateLabels[dateIndex++] ?? `Fecha ${dateIndex}`
        : `Filtro ${index + 1}`
    const label = getControlLabel(control, fallbackLabel)
    const key = `${label}::${value}`

    if (seen.has(key)) return
    seen.add(key)
    filters.push({ label, value })
  })

  return filters.slice(0, 10)
}

function getControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions).map((option) => normalizeText(option.textContent || option.value)).filter(Boolean).join(", ")
  }
  if (control instanceof HTMLTextAreaElement) return normalizeText(control.value)
  if (control.type === "checkbox" || control.type === "radio") return control.checked ? "Si" : ""
  if (control.type === "password" || control.type === "hidden" || control.type === "file") return ""
  if (control.type === "date") return formatDate(control.value)
  return normalizeText(control.value)
}

function getControlLabel(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, fallback: string) {
  const ariaLabel = normalizeText(control.getAttribute("aria-label"))
  if (ariaLabel) return ariaLabel

  if (control.id) {
    const label = Array.from(document.querySelectorAll("label")).find((item) => item.htmlFor === control.id)
    const text = normalizeText(label?.textContent)
    if (text) return text
  }

  const wrappingLabel = control.closest("label")
  const wrappingText = normalizeText(wrappingLabel?.textContent).replace(getControlValue(control), "").trim()
  if (wrappingText) return wrappingText

  const placeholder = normalizeText(control.getAttribute("placeholder"))
  if (placeholder) return placeholder

  return fallback
}

function isControlExcluded(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (control.closest("[data-export-exclude], .no-print, [hidden], [aria-hidden='true']")) return true
  if (control instanceof HTMLInputElement) return ["button", "submit", "reset", "password", "hidden", "file", "search"].includes(control.type)
  return false
}

function getPreviousText(element: HTMLElement) {
  let sibling = element.previousElementSibling

  while (sibling) {
    const text = normalizeText(sibling.textContent)
    if (text && text.length <= 80) return text
    sibling = sibling.previousElementSibling
  }

  return undefined
}

function getContainerTitle(container: HTMLElement) {
  const cardTitle = normalizeText(container.querySelector<HTMLElement>("[data-slot='card-title']")?.textContent)
  if (cardTitle) return cardTitle
  return normalizeText(container.querySelector<HTMLElement>("h2, h3, h4")?.textContent)
}

function getTableTitle(table: HTMLTableElement, index: number) {
  const card = table.closest<HTMLElement>(CARD_SELECTOR)
  const cardTitle = normalizeText(card?.querySelector<HTMLElement>("[data-slot='card-title']")?.textContent)
  if (cardTitle) return cardTitle
  return `Detalle ${index + 1}`
}

function getTableDescription(table: HTMLTableElement) {
  const card = table.closest<HTMLElement>(CARD_SELECTOR)
  const description = normalizeText(card?.querySelector<HTMLElement>("[data-slot='card-description']")?.textContent)
  return description || undefined
}

const usedSheetNames = new Map<string, number>()

function uniqueSheetName(name: string) {
  const clean = (name || "Hoja")
    .replace(/[\[\]\*\/\\\?:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28) || "Hoja"
  const count = usedSheetNames.get(clean) ?? 0
  usedSheetNames.set(clean, count + 1)
  return count ? `${clean.slice(0, 25)} ${count + 1}` : clean
}

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getDocumentBaseUrl() {
  if (typeof window === "undefined") return "/"
  return `${window.location.origin}/`
}

function getAssetUrl(path: string) {
  if (typeof window === "undefined") return path
  return new URL(path, window.location.origin).toString()
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDate(iso: string) {
  if (!iso) return ""
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-GT", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(value)}%`
}

function isMetricValue(value: string) {
  if (!value || value.length > 90 || looksLikeRepeatedBlock(value)) return false
  return /(\d|Q\.?|%)/i.test(value)
}

function isUsefulSentence(value: string) {
  if (!value || value.length < 12 || value.length > 240 || looksLikeRepeatedBlock(value)) return false
  return !/^(exportar|imprimir|guardar|generar vista)$/i.test(value)
}

function looksLikeRepeatedBlock(value: string) {
  const words = value.split(/\s+/)
  return words.length > 22 && new Set(words).size < words.length * 0.55
}

function uniqueTexts(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeText(value?: string | null) {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "reporte"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeXml(value: string) {
  return escapeHtml(value)
}
