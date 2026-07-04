import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Calculator,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Hotel,
  LineChart,
  PieChartIcon,
  Printer,
  RefreshCw,
  Scale,
  Target,
  TrendingUp,
  Utensils,
  WalletCards,
  Wrench,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { MiniTable, StatusPill, money } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import {
  buildAdvancedReportAnalysis,
  endOfMonth,
  endOfYear,
  isoDate,
  startOfMonth,
  startOfYear,
  type AdvancedReportAnalysis,
  type DailyReportRow,
  type DailyStateMetricRow,
  type LegacySummaryRow,
  type OccupancyMatrixRow,
  type ProfitCenter,
  type ReportGranularity,
  type RoomCategoryReportRow,
  type RoomRevenueRow,
  type UtilityDistributionRow,
  type WeekdaySalesRow,
} from "@/lib/reporting"
import { formatDate, useStore } from "@/lib/store"
import type { Reservation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { exportCurrentView } from "@/lib/view-export"

const chartConfig = {
  revenue: { label: "Ingresos", color: "var(--color-chart-1)" },
  cost: { label: "Costos", color: "var(--color-chart-4)" },
  profit: { label: "Utilidad", color: "var(--color-chart-2)" },
  occupancy: { label: "Ocupacion", color: "var(--color-chart-5)" },
  rooms: { label: "Habitaciones", color: "var(--color-chart-3)" },
  roomNights: { label: "Vendidas", color: "var(--color-chart-5)" },
  availableRooms: { label: "Disponibles", color: "var(--color-muted)" },
  actualRooms: { label: "Real", color: "var(--color-chart-5)" },
  forecastRooms: { label: "Pronostico", color: "var(--color-chart-2)" },
} satisfies ChartConfig

const distributionColors = {
  revenue: "var(--color-chart-1)",
  cost: "var(--color-chart-4)",
  expense: "var(--color-chart-3)",
  tax: "var(--color-chart-5)",
  profit: "var(--color-chart-2)",
}

type ReportInvoiceRow = {
  date: string
  invoice: string
  customer: string
  nit: string
  total: number
  status: string
}

type ProfitChartRow = {
  name: string
  revenue: number
  cost: number
  profit: number
}

type AuxiliaryReportRow = {
  label: string
  endpoint: string
  status: "ok" | "error"
  count: number
  total?: number
  message: string
}

function pct(value: number) {
  return `${Math.round(value)}%`
}

function number(value: number) {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(value)
}

function decimal(value: number) {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 }).format(value)
}

function percentOf(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function occupancyTone(value: number): "success" | "info" | "warning" | "danger" | "muted" {
  if (value <= 0) return "muted"
  if (value >= 80) return "success"
  if (value >= 55) return "info"
  if (value >= 30) return "warning"
  return "danger"
}

function occupancyColor(value: number) {
  if (value <= 0) return "var(--color-muted)"
  if (value >= 80) return "var(--color-chart-4)"
  if (value >= 55) return "var(--color-chart-5)"
  if (value >= 30) return "var(--color-chart-2)"
  return "var(--color-destructive)"
}

function labelFor(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function inRange(value: string | undefined, from: string, to: string) {
  const date = value?.slice(0, 10)
  return Boolean(date && date >= from && date <= to)
}

function reportValue(value: number, kind: "number" | "money" | "percent") {
  if (kind === "money") return money(value)
  if (kind === "percent") return pct(value)
  return number(value)
}

function toneForProfit(center: ProfitCenter) {
  if (center.netProfit < 0) return "danger"
  if (center.margin < 18) return "warning"
  return "success"
}

function confidenceLabel(value: ProfitCenter["confidence"]) {
  if (value === "real") return "Dato real"
  if (value === "estimado") return "Estimado"
  return "Mixto"
}

function accountingPaymentLabel(type: string, subtype?: string) {
  if (type === "CASH") return "Efectivo"
  if (type === "CC") return subtype ? `Tarjeta ${subtype}` : "Tarjeta"
  if (type === "TR") return "Transferencia"
  if (type === "DEP") return "Deposito"
  if (type === "OTRO") return "Otros"
  return labelFor(type)
}

function ReportMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: ReactNode
  helper: string
  icon: ComponentType<{ className?: string }>
  tone?: "default" | "success" | "warning" | "danger" | "info"
}) {
  const toneClass = {
    default: "bg-muted text-foreground",
    success: "bg-emerald-500/12 text-emerald-700",
    warning: "bg-amber-500/14 text-amber-700",
    danger: "bg-red-500/12 text-red-700",
    info: "bg-sky-500/12 text-sky-700",
  }[tone]

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneClass)}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <p className="mobile-safe-text text-sm text-muted-foreground">{label}</p>
          <p className="mobile-safe-text font-serif text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mobile-safe-text text-xs leading-5 text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h2 className="mobile-safe-text text-xl font-semibold">{title}</h2>
      <p className="mobile-safe-text mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function reportRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function reportArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = reportRecord(value)
  return Array.isArray(record.data) ? record.data : []
}

function reportNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function reportText(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") return String(value)
  return fallback
}

function reportDataRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const root = reportRecord(value)
  if (Array.isArray(root.data)) return root.data
  const data = reportRecord(root.data)
  const nested =
    Object.values(data).find(Array.isArray) ??
    Object.values(root).find(Array.isArray)
  return Array.isArray(nested) ? nested : []
}

function optionalReportNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = reportNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : undefined
}

function summarizeAuxiliaryReport(label: string, endpoint: string, value: unknown): AuxiliaryReportRow {
  const root = reportRecord(value)
  const dataRecord = reportRecord(root.data)
  const data = Object.keys(dataRecord).length ? dataRecord : root
  const rows = reportDataRows(value)
  const total =
    optionalReportNumber(data.total) ??
    optionalReportNumber(data.total_amount) ??
    optionalReportNumber(data.amount) ??
    optionalReportNumber(data.revenue) ??
    optionalReportNumber(data.income) ??
    optionalReportNumber(data.net_utility) ??
    optionalReportNumber(data.netProfit) ??
    optionalReportNumber(data.profit) ??
    optionalReportNumber(data.cost) ??
    optionalReportNumber(data.balance)
  const message =
    reportText(root.message) ||
    reportText(data.description) ||
    (rows.length ? `${rows.length} registro(s) del periodo` : "Endpoint consultado sin filas para este periodo")

  return {
    label,
    endpoint,
    status: "ok",
    count: rows.length,
    total,
    message,
  }
}

function pickReportNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = reportNumber(record[key], Number.NaN)
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function pickReportText(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = reportText(record[key])
    if (value) return value
  }
  return fallback
}

function reportDate(value: unknown, fallback = isoDate(new Date())) {
  const text = reportText(value)
  return text ? text.slice(0, 10) : fallback
}

function reportConfidence(value: string): ProfitCenter["confidence"] {
  const normalized = value.toLowerCase()
  if (normalized.includes("real")) return "real"
  if (normalized.includes("mixt")) return "mixto"
  return "estimado"
}

function utilityKind(label: string): UtilityDistributionRow["kind"] {
  const normalized = label.toLowerCase()
  if (normalized.includes("costo")) return "cost"
  if (normalized.includes("gasto")) return "expense"
  if (normalized.includes("impuesto")) return "tax"
  if (normalized.includes("utilidad")) return "profit"
  return "revenue"
}

function legacyKind(value: string): LegacySummaryRow["kind"] {
  if (value.includes("%")) return "percent"
  if (value.toLowerCase().includes("q")) return "money"
  return "number"
}

function paymentTypeFromLabel(method: string) {
  const normalized = method.toLowerCase()
  if (normalized.includes("efect")) return "CASH"
  if (normalized.includes("tarj")) return "CC"
  if (normalized.includes("transfer")) return "TR"
  if (normalized.includes("deposit")) return "DEP"
  return "OTRO"
}

function backendReservationStatus(value: string): Reservation["status"] {
  const normalized = value.toLowerCase()
  if (normalized.includes("checkout") || normalized.includes("check-out")) return "checkout"
  if (normalized.includes("checkin") || normalized.includes("check-in")) return "in-house"
  if (normalized.includes("cancel")) return "cancelada"
  if (normalized.includes("no")) return "no-show"
  if (normalized.includes("ready") || normalized.includes("lista")) return "ready-for-check-in"
  if (normalized.includes("pend")) return "pendiente"
  return "confirmada"
}

function backendReservationSource(value: string): Reservation["source"] {
  const normalized = value.toLowerCase()
  if (normalized.includes("booking")) return "booking"
  if (normalized.includes("expedia")) return "expedia"
  if (normalized.includes("airbnb")) return "airbnb"
  if (normalized.includes("agencia")) return "agencia"
  if (normalized.includes("corpor")) return "corporativo"
  return "directo"
}

function mapBackendInvoiceRows(response: unknown): ReportInvoiceRow[] {
  const envelope = reportRecord(response)
  const data = reportRecord(envelope.data ?? response)

  return reportArray(data.accounting_invoices).map((value) => {
    const row = reportRecord(value)
    return {
      date: reportDate(row.date),
      invoice: pickReportText(row, ["invoice"], "-"),
      customer: pickReportText(row, ["client", "customer"], "Cliente"),
      nit: pickReportText(row, ["nit"], "CF"),
      total: pickReportNumber(row, ["total"], 0),
      status: pickReportText(row, ["status"], "CERTIFIED"),
    }
  })
}

function mapBackendProfitChartRows(response: unknown): ProfitChartRow[] {
  const envelope = reportRecord(response)
  const data = reportRecord(envelope.data ?? response)

  return reportArray(data.income_cost_utility_chart).map((value) => {
    const row = reportRecord(value)
    return {
      name: pickReportText(row, ["label"], "Rubro"),
      revenue: pickReportNumber(row, ["income", "revenue"], 0),
      cost: pickReportNumber(row, ["cost"], 0),
      profit: pickReportNumber(row, ["utility", "profit"], 0),
    }
  })
}

function roomCategoriesFromRooms(rows: unknown[], fallback: RoomCategoryReportRow[]) {
  const grouped = new Map<string, { rooms: Set<string>; roomNights: number; revenue: number }>()

  rows.forEach((value) => {
    const row = reportRecord(value)
    const category = pickReportText(row, ["room_type", "roomType", "category"], "Sin tipo")
    const room = pickReportText(row, ["room_number", "roomNumber", "room"], category)
    const current = grouped.get(category) ?? { rooms: new Set<string>(), roomNights: 0, revenue: 0 }

    current.rooms.add(room)
    current.roomNights += pickReportNumber(row, ["room_nights", "roomNights", "nights"], 0)
    current.revenue += pickReportNumber(row, ["revenue", "income", "total"], 0)
    grouped.set(category, current)
  })

  const totalRoomNights = Array.from(grouped.values()).reduce((sum, row) => sum + row.roomNights, 0)
  const mapped = Array.from(grouped.entries()).map(([category, row]) => ({
    category,
    rooms: row.rooms.size,
    roomNights: row.roomNights,
    revenue: row.revenue,
    adr: row.roomNights > 0 ? row.revenue / row.roomNights : 0,
    occupancyShare: percentOf(row.roomNights, totalRoomNights),
  }))

  return mapped.length ? mapped : fallback
}

function buildBackendReportAnalysis(
  response: unknown,
  fallback: AdvancedReportAnalysis,
  granularity: ReportGranularity,
): AdvancedReportAnalysis {
  const envelope = reportRecord(response)
  const data = reportRecord(envelope.data ?? response)
  if (Object.keys(data).length === 0) return fallback

  const period = reportRecord(data.period)
  const hero = reportRecord(data.hero)
  const kpis = reportRecord(data.kpis)
  const incomeKpi = reportRecord(kpis.income)
  const netProfitKpi = reportRecord(kpis.net_profit)
  const occupancyKpi = reportRecord(kpis.occupancy)
  const costsKpi = reportRecord(kpis.costs_expenses_taxes)
  const overdueCreditKpi = reportRecord(kpis.overdue_credit)
  const inventoryKpi = reportRecord(kpis.inventory_at_cost)
  const expensesKpi = reportRecord(kpis.expenses)
  const bestDayKpi = reportRecord(kpis.best_day)
  const occupancyVisual = reportRecord(data.occupancy_visual)
  const periodOccupancy = reportRecord(occupancyVisual.period)
  const selectedDayOccupancy = reportRecord(occupancyVisual.selected_day)
  const peakOccupancy = reportRecord(occupancyVisual.peak)
  const operationalCosts = reportRecord(data.operational_costs)
  const dailyFallbackByDate = new Map(fallback.daily.map((row) => [row.date, row]))
  const roomRows = reportArray(data.profitability_by_room)

  const daily = reportArray(data.daily_series).map((value) => {
    const row = reportRecord(value)
    const date = reportDate(row.date, fallback.range.from)
    const local = dailyFallbackByDate.get(date)
    const roomNights = pickReportNumber(row, ["room_nights", "roomNights"], local?.roomNights ?? 0)
    const guests = pickReportNumber(row, ["guest_nights", "guestNights", "guests"], local?.guests ?? 0)
    const revenue = pickReportNumber(row, ["revenue", "income"], local?.revenue ?? 0)

    return {
      date,
      label: pickReportText(row, ["label"], local?.label ?? date.slice(5)),
      weekday: pickReportText(row, ["weekday"], local?.weekday ?? ""),
      roomNights,
      arrivals: local?.arrivals ?? 0,
      departures: local?.departures ?? 0,
      stayovers: local?.stayovers ?? 0,
      guests,
      revenue,
      adr: roomNights > 0 ? revenue / roomNights : 0,
      revpar: fallback.metrics.availableRoomNights > 0 ? revenue / Math.max(1, fallback.metrics.availableRoomNights / Math.max(1, fallback.range.days.length)) : 0,
      occupancy: pickReportNumber(row, ["occupancy_percentage", "occupancy"], local?.occupancy ?? 0),
    }
  })

  const effectiveDaily = daily.length ? daily : fallback.daily
  const roomNights = effectiveDaily.reduce((sum, row) => sum + row.roomNights, 0)
  const guests = effectiveDaily.reduce((sum, row) => sum + row.guests, 0)
  const totalRevenue = reportNumber(incomeKpi.value, reportNumber(hero.gross_income, fallback.metrics.totalRevenue))
  const netProfit = reportNumber(netProfitKpi.value, reportNumber(hero.net_profit, fallback.metrics.netProfit))
  const occupancy = reportNumber(occupancyKpi.value, reportNumber(periodOccupancy.percentage, fallback.metrics.occupancy))
  const availableRoomNights = reportNumber(periodOccupancy.available_room_nights, fallback.metrics.availableRoomNights)
  const adr = roomNights > 0 ? totalRevenue / roomNights : fallback.metrics.adr
  const revpar = availableRoomNights > 0 ? totalRevenue / availableRoomNights : fallback.metrics.revpar

  const profitCenters = reportArray(data.profitability_by_category).map((value) => {
    const row = reportRecord(value)
    const revenue = pickReportNumber(row, ["income", "revenue", "sale"], 0)
    const directCost = pickReportNumber(row, ["cost", "direct_cost"], 0)
    const grossProfit = pickReportNumber(row, ["gross_utility", "grossProfit"], revenue - directCost)
    const net = pickReportNumber(row, ["net_utility", "netProfit"], grossProfit)

    return {
      id: pickReportText(row, ["key", "id"], pickReportText(row, ["label"], "rubro").toLowerCase()),
      name: pickReportText(row, ["label", "name"], "Rubro"),
      description: pickReportText(row, ["description"], ""),
      revenue,
      directCost,
      iva: pickReportNumber(row, ["value_added_tax", "iva"], 0),
      inguat: pickReportNumber(row, ["tourism_tax", "inguat"], 0),
      isr: pickReportNumber(row, ["income_tax", "isr"], 0),
      grossProfit,
      netProfit: net,
      margin: pickReportNumber(row, ["margin_percentage", "margin"], percentOf(net, revenue)),
      confidence: reportConfidence(pickReportText(row, ["data_type", "source"], "Estimado")),
    }
  })

  const accounting = reportRecord(data.accounting)
  const accountingTotals = reportRecord(accounting.totals)
  const accountingFilters = reportRecord(accounting.filters)
  const accountingPaymentSummary = reportArray(accounting.payment_summary)
  const paymentMethods = reportArray(data.payment_methods)
  const backendReservations = reportArray(data.period_reservations).map((value, index): Reservation => {
    const row = reportRecord(value)
    const code = pickReportText(row, ["code"], `RES-${index + 1}`)
    const nights = Math.max(1, pickReportNumber(row, ["nights"], 1))
    const total = pickReportNumber(row, ["total"], 0)
    const client = pickReportText(row, ["client"], "Huésped")
    const room = pickReportText(row, ["room"], "-")

    return {
      id: `report-${code}`,
      code,
      guestId: client,
      roomId: room,
      checkIn: reportDate(row.check_in, fallback.range.from),
      checkOut: reportDate(row.check_out, fallback.range.to),
      nights,
      adults: 1,
      children: 0,
      rate: total / nights,
      total,
      paid: pickReportNumber(row, ["paid"], 0),
      status: backendReservationStatus(pickReportText(row, ["status"], "confirmada")),
      source: backendReservationSource(pickReportText(row, ["channel"], "directo")),
      notes: client,
      createdAt: reportDate(row.check_in, fallback.range.from),
    }
  })
  const backendUtilityBreakdown = reportArray(data.utility_distribution).map((value) => {
    const row = reportRecord(value)

    return {
      area: pickReportText(row, ["area"], "Rubro"),
      grossProfit: pickReportNumber(row, ["gross_utility", "grossProfit"], 0),
      iva: pickReportNumber(row, ["value_added_tax", "iva"], 0),
      isr: pickReportNumber(row, ["income_tax", "isr"], 0),
      inguat: pickReportNumber(row, ["tourism_tax", "inguat"], 0),
      netProfit: pickReportNumber(row, ["net_utility", "netProfit"], 0),
    }
  })

  return {
    ...fallback,
    reservations: backendReservations.length ? backendReservations : fallback.reservations,
    range: {
      from: reportDate(period.from, fallback.range.from),
      to: reportDate(period.to, fallback.range.to),
      days: effectiveDaily.map((row) => row.date),
      granularity,
    },
    daily: effectiveDaily,
    roomCategories: roomCategoriesFromRooms(roomRows, fallback.roomCategories),
    channels: reportArray(data.sales_channels).map((value) => {
      const row = reportRecord(value)
      const revenue = pickReportNumber(row, ["income", "revenue"], 0)
      const guestsCount = pickReportNumber(row, ["people", "guests"], 0)

      return {
        code: pickReportText(row, ["code"], "DIRECTO"),
        channel: pickReportText(row, ["channel"], "directo"),
        reservations: pickReportNumber(row, ["reservations"], 0),
        roomNights: pickReportNumber(row, ["nights", "room_nights"], 0),
        guests: guestsCount,
        revenue,
        adr: pickReportNumber(row, ["average_rate", "adr"], 0),
        occupancyShare: pickReportNumber(row, ["participation", "occupancyShare"], 0),
        guestRate: guestsCount > 0 ? revenue / guestsCount : 0,
        share: pickReportNumber(row, ["participation", "share"], 0),
      }
    }),
    agents: reportArray(data.agent_performance).map((value) => {
      const row = reportRecord(value)
      return {
        agent: pickReportText(row, ["agent"], "Recepción"),
        target: pickReportNumber(row, ["goal", "target"], 0),
        projected: pickReportNumber(row, ["projection", "projected"], 0),
        executed: pickReportNumber(row, ["executed"], 0),
        percent: pickReportNumber(row, ["percentage", "percent"], 0),
      }
    }),
    credits: reportArray(data.credit_clients).map((value) => {
      const row = reportRecord(value)
      return {
        company: pickReportText(row, ["company", "name"], "Cliente"),
        contact: pickReportText(row, ["contact"], "-"),
        limit: pickReportNumber(row, ["limit", "credit_limit"], 0),
        balance: pickReportNumber(row, ["balance", "used_amount"], 0),
        available: pickReportNumber(row, ["available", "available_credit"], 0),
        dueDate: reportDate(row.due_date, fallback.range.to),
        status: pickReportText(row, ["status"], "activa").toLowerCase(),
      }
    }),
    inventoryProfit: reportArray(data.snacks_and_beverages_summary).map((value) => {
      const row = reportRecord(value)
      const label = pickReportText(row, ["rubric", "label"], "Inventario")
      const normalized = label.toLowerCase()
      const category = normalized.includes("blanco") ? "blanco" : normalized.includes("suministro") ? "suministro" : "snack"

      return {
        category,
        label,
        revenue: pickReportNumber(row, ["sale", "revenue"], 0),
        cost: pickReportNumber(row, ["cost"], 0),
        profit: pickReportNumber(row, ["utility", "profit"], 0),
        units: pickReportNumber(row, ["units"], 0),
      }
    }),
    breakfast: reportArray(data.breakfasts_report).map((value) => {
      const row = reportRecord(value)
      return {
        label: pickReportText(row, ["type", "label"], "Desayuno"),
        issued: pickReportNumber(row, ["issued"], 0),
        redeemed: pickReportNumber(row, ["consumed", "redeemed"], 0),
        cost: pickReportNumber(row, ["cost"], 0),
        retailValue: pickReportNumber(row, ["menu_value", "retailValue"], 0),
        profitImpact: pickReportNumber(row, ["impact", "profitImpact"], 0),
      }
    }),
    events: reportArray(data.event_hall_report).map((value) => {
      const row = reportRecord(value)
      const revenue = pickReportNumber(row, ["sale", "revenue"], 0)
      const cost = pickReportNumber(row, ["cost", "estimated_cost"], 0)
      return {
        title: pickReportText(row, ["event", "title"], "Evento"),
        client: pickReportText(row, ["client"], "Cliente"),
        salon: pickReportText(row, ["space", "salon"], "Salón"),
        type: "alquiler",
        revenue,
        estimatedCost: cost,
        profit: pickReportNumber(row, ["utility", "profit"], revenue - cost),
        margin: pickReportNumber(row, ["gross_utility_percentage", "margin"], percentOf(revenue - cost, revenue)),
      }
    }),
    profitCenters: profitCenters.length ? profitCenters : fallback.profitCenters,
    utilityDistribution: reportArray(data.financial_distribution).map((value) => {
      const row = reportRecord(value)
      const label = pickReportText(row, ["label"], "Rubro")
      return {
        label,
        amount: pickReportNumber(row, ["amount"], 0),
        kind: utilityKind(label),
      }
    }),
    utilityBreakdown: backendUtilityBreakdown.length
      ? backendUtilityBreakdown
      : (profitCenters.length ? profitCenters : fallback.profitCenters).map((center) => ({
        area: center.name,
        grossProfit: center.grossProfit,
        iva: center.iva,
        isr: center.isr,
        inguat: center.inguat,
        netProfit: center.netProfit,
      })),
    adjustments: [
      { setting: "Periodo", value: `${reportDate(period.from, fallback.range.from)} - ${reportDate(period.to, fallback.range.to)}` },
      { setting: "Fecha seleccionada", value: reportDate(period.selected_date, fallback.range.to) },
      {
        setting: "Día seleccionado",
        value: `${pickReportText(selectedDayOccupancy, ["label"], "-")} · ${pickReportNumber(selectedDayOccupancy, ["room_nights"], 0)} hab. · ${money(pickReportNumber(selectedDayOccupancy, ["revenue"], 0))}`,
      },
      {
        setting: "Pico de ocupación",
        value: `${pickReportText(peakOccupancy, ["label"], "-")} · ${pickReportNumber(peakOccupancy, ["room_nights"], 0)} hab. · ${decimal(pickReportNumber(peakOccupancy, ["occupancy_percentage"], 0))}%`,
      },
      { setting: "Moneda", value: "GTQ" },
    ],
    accountingIncome: reportArray(accounting.rows).map((value) => {
      const row = reportRecord(value)
      return {
        date: reportDate(row.date, fallback.range.from),
        user: pickReportText(row, ["user"], "-"),
        account: pickReportText(row, ["account"], "-"),
        receipt: pickReportText(row, ["receipt"], "-"),
        customer: pickReportText(row, ["client", "customer"], "-"),
        description: pickReportText(row, ["description"], "-"),
        type: pickReportText(row, ["type"], "-"),
        subtype: pickReportText(row, ["subtype"], "-"),
        amount: pickReportNumber(row, ["amount"], 0),
        currency: pickReportText(row, ["currency"], "GTQ"),
        country: pickReportText(row, ["country"], "Guatemala"),
        rooms: pickReportText(row, ["rooms"], "0"),
      }
    }),
    accountingPayments: (accountingPaymentSummary.length ? accountingPaymentSummary : paymentMethods).map((value) => {
      const row = reportRecord(value)
      const method = pickReportText(row, ["method"], "")

      return {
        type: pickReportText(row, ["type"], method ? paymentTypeFromLabel(method) : "OTRO"),
        subtype: pickReportText(row, ["subtype"], method),
        amount: pickReportNumber(row, ["amount"], 0),
        currency: pickReportText(row, ["currency"], "GTQ"),
        localLabel: pickReportText(row, ["local_reading", "localLabel"], method),
      }
    }),
    accountingTotals: Object.entries(accountingTotals).map(([key, value]) => ({
      label: labelFor(key),
      amount: reportNumber(value),
    })),
    accountingFilters: Object.entries(accountingFilters).map(([key, value]) => ({
      label: labelFor(key),
      value: reportText(value, "-"),
    })),
    roomRevenue: roomRows.map((value) => {
      const row = reportRecord(value)
      const roomNightsValue = pickReportNumber(row, ["room_nights", "roomNights"], 0)
      const revenue = pickReportNumber(row, ["revenue"], 0)
      return {
        room: pickReportText(row, ["room_number", "roomNumber"], "-"),
        roomType: pickReportText(row, ["room_type", "roomType"], "Sin tipo"),
        roomNights: roomNightsValue,
        guests: pickReportNumber(row, ["people_count", "guests"], 0),
        revenue,
        adr: pickReportNumber(row, ["average_rate", "adr"], roomNightsValue > 0 ? revenue / roomNightsValue : 0),
        occupancyShare: pickReportNumber(row, ["participation", "occupancyShare"], 0),
      }
    }),
    currentAccountsLegacy: reportArray(data.current_accounts).map((value) => {
      const row = reportRecord(value)
      return {
        account: pickReportText(row, ["account"], "-"),
        name: pickReportText(row, ["name"], "Cliente"),
        roomNights: pickReportNumber(row, ["room_nights"], 0),
        personNights: pickReportNumber(row, ["person_nights"], 0),
        reservations: pickReportNumber(row, ["reservations"], 0),
        lodgingCharge: pickReportNumber(row, ["lodging_charge", "used_amount"], 0),
        otherCharges: pickReportNumber(row, ["other_charges"], 0),
      }
    }),
    dailyState: reportArray(data.hotel_metrics).map((value) => {
      const row = reportRecord(value)
      const metric = pickReportText(row, ["metric"], "Métrica")
      const kind: DailyStateMetricRow["kind"] =
        metric.includes("%") ? "percent" : metric.toLowerCase().includes("ingreso") || metric.toLowerCase().includes("promedio") ? "money" : "number"

      return {
        metric,
        scope: pickReportText(row, ["scope"], "Hotel"),
        selectedDay: pickReportNumber(row, ["selected_day", "selectedDay"], 0),
        period: pickReportNumber(row, ["period"], 0),
        yearToDate: pickReportNumber(row, ["year_to_date", "yearToDate"], 0),
        kind,
      }
    }),
    weekdaySales: reportArray(data.weekdays).map((value) => {
      const row = reportRecord(value)
      return {
        weekday: pickReportText(row, ["weekday"], "-"),
        roomNights: pickReportNumber(row, ["room_nights", "roomNights"], 0),
        share: pickReportNumber(row, ["percentage", "share"], 0),
      }
    }),
    restaurant: reportArray(data.restaurant).map((value) => {
      const row = reportRecord(value)
      const sales = pickReportNumber(row, ["sale", "sales"], 0)
      const cost = pickReportNumber(row, ["cost"], 0)
      return {
        name: pickReportText(row, ["area", "name"], "Restaurante"),
        sales,
        cost,
        grossProfit: pickReportNumber(row, ["utility", "grossProfit"], sales - cost),
        margin: pickReportNumber(row, ["gross_utility_percentage", "margin"], percentOf(sales - cost, sales)),
        source: pickReportText(row, ["source"], "Backend"),
      }
    }),
    restaurantSummary: reportArray(data.restaurant_summary).map((value) => {
      const row = reportRecord(value)
      return {
        area: pickReportText(row, ["area"], "Restaurante"),
        sales: pickReportNumber(row, ["sale", "sales"], 0),
        cost: pickReportNumber(row, ["cost"], 0),
        profit: pickReportNumber(row, ["utility", "profit"], 0),
        margin: pickReportNumber(row, ["gross_utility_percentage", "margin"], 0),
      }
    }),
    minibarProducts: reportArray(data.snacks_by_product).map((value) => {
      const row = reportRecord(value)
      const sale = pickReportNumber(row, ["sale", "sales"], 0)
      const cost = pickReportNumber(row, ["cost"], 0)
      const grossProfit = pickReportNumber(row, ["gross_utility", "grossProfit"], sale - cost)
      return {
        sku: pickReportText(row, ["sku", "code"], "-"),
        product: pickReportText(row, ["product", "name"], "Producto"),
        units: pickReportNumber(row, ["units", "quantity"], 0),
        sale,
        cost,
        grossProfit,
        iva: pickReportNumber(row, ["value_added_tax", "iva"], 0),
        isr: pickReportNumber(row, ["income_tax", "isr"], 0),
        netProfit: pickReportNumber(row, ["net_utility", "netProfit"], grossProfit),
      }
    }),
    breakfastOccupancy: reportArray(data.breakfast_analysis).map((value) => {
      const row = reportRecord(value)
      return {
        category: pickReportText(row, ["category"], "Categoría"),
        quantity: pickReportNumber(row, ["quantity"], 0),
        platesSold: pickReportNumber(row, ["plates_sold", "platesSold"], 0),
        share: pickReportNumber(row, ["percentage", "share"], 0),
      }
    }),
    legacySummary: reportArray(data.legacy_summary).map((value) => {
      const row = reportRecord(value)
      const rawValue = pickReportText(row, ["value"], "0")
      return {
        section: pickReportText(row, ["section"], "-"),
        indicator: pickReportText(row, ["indicator"], "-"),
        value: reportNumber(rawValue),
        kind: legacyKind(rawValue),
        helper: pickReportText(row, ["reading", "helper"], ""),
      }
    }),
    occupancyMatrix: reportArray(data.occupancy_matrix).map((value) => {
      const row = reportRecord(value)
      const days = reportArray(row.days)
      return {
        level: pickReportNumber(row, ["nights", "level"], 0),
        values: days.map((day) => pickReportNumber(reportRecord(day), ["value"], 0)),
        total: pickReportNumber(row, ["total"], 0),
      }
    }),
    metadata: [
      { label: "Fuente", value: "Backend /api/reports/hotel-dashboard" },
      { label: "Desde", value: reportDate(period.from, fallback.range.from) },
      { label: "Hasta", value: reportDate(period.to, fallback.range.to) },
      { label: "Fecha seleccionada", value: reportDate(period.selected_date, fallback.range.to) },
      {
        label: "Día seleccionado",
        value: `${pickReportText(selectedDayOccupancy, ["label"], "-")} · ${pickReportText(selectedDayOccupancy, ["weekday"], "-")}`,
      },
      {
        label: "Pico de ocupación",
        value: `${pickReportText(peakOccupancy, ["label"], "-")} · ${pickReportNumber(peakOccupancy, ["room_nights"], 0)} habitación(es)`,
      },
    ],
    metrics: {
      ...fallback.metrics,
      totalRevenue,
      operatingCosts: reportNumber(hero.operational_cost, fallback.metrics.operatingCosts),
      expenses: reportNumber(expensesKpi.value, reportNumber(hero.expenses, fallback.metrics.expenses)),
      directCosts: reportNumber(costsKpi.costs, reportNumber(hero.operational_cost, fallback.metrics.directCosts)),
      taxes: reportNumber(hero.taxes, reportNumber(costsKpi.taxes, fallback.metrics.taxes)),
      grossProfit: totalRevenue - reportNumber(hero.operational_cost, fallback.metrics.operatingCosts),
      netProfit,
      margin: reportNumber(hero.net_margin, totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : fallback.metrics.margin),
      roomNights,
      availableRoomNights,
      occupancy,
      adr,
      revpar,
      guests,
      bestWeekday: pickReportText(bestDayKpi, ["day"], fallback.metrics.bestWeekday),
      bestWeekdayRoomNights: pickReportNumber(bestDayKpi, ["room_nights", "roomNights"], fallback.metrics.bestWeekdayRoomNights),
      creditBalance: reportNumber(overdueCreditKpi.description?.toString().match(/\d+(?:\.\d+)?/)?.[0], fallback.metrics.creditBalance),
      overdueCredit: reportNumber(overdueCreditKpi.value, fallback.metrics.overdueCredit),
      cashExpenses: reportNumber(expensesKpi.value, fallback.metrics.cashExpenses),
      maintenanceCost: reportNumber(operationalCosts.maintenance, fallback.metrics.maintenanceCost),
      inventoryValueAtCost: reportNumber(inventoryKpi.value, reportNumber(operationalCosts.inventory_at_cost, fallback.metrics.inventoryValueAtCost)),
      inventoryRetailValue: reportNumber(inventoryKpi.potential_sale_value, fallback.metrics.inventoryRetailValue),
    },
  }
}

export function ReportesPage() {
  const store = useStore()
  const { refreshApiState } = store
  const today = useMemo(() => new Date(), [])
  const [from, setFrom] = useState(startOfMonth(today))
  const [to, setTo] = useState(endOfMonth(today))
  const [granularity, setGranularity] = useState<ReportGranularity>("mes")
  const [backendAnalysis, setBackendAnalysis] = useState<AdvancedReportAnalysis | null>(null)
  const [backendInvoiceRows, setBackendInvoiceRows] = useState<ReportInvoiceRow[]>([])
  const [backendProfitChartRows, setBackendProfitChartRows] = useState<ProfitChartRow[]>([])
  const [auxiliaryReports, setAuxiliaryReports] = useState<AuxiliaryReportRow[]>([])
  const [backendReportLoading, setBackendReportLoading] = useState(false)
  const [backendReportError, setBackendReportError] = useState("")

  useEffect(() => {
    void refreshApiState(
      [
        "roomTypes",
        "rooms",
        "reservations",
        "guests",
        "cashCloses",
        "events",
        "salons",
        "inventory",
        "inventoryMovements",
        "creditAccounts",
        "breakfastOptions",
        "breakfasts",
      ],
      { force: true },
    )
  }, [refreshApiState])

  const localAnalysis = useMemo(
    () => buildAdvancedReportAnalysis(store, from, to, granularity),
    [from, granularity, store, to],
  )
  const analysis = backendAnalysis ?? localAnalysis

  useEffect(() => {
    let cancelled = false

    setBackendReportLoading(true)
    setBackendReportError("")
    setAuxiliaryReports([])

    const reportQuery = { from, to, granularity }
    const individualReports = [
      {
        label: "Rentabilidad general",
        endpoint: "GET /api/reports/profitability",
        request: () => api.reports.getProfitability<unknown>(reportQuery),
      },
      {
        label: "Ingresos contables",
        endpoint: "GET /api/reports/revenue/accounting",
        request: () => api.reports.getRevenueAccounting<unknown>(reportQuery),
      },
      {
        label: "Pagos",
        endpoint: "GET /api/reports/payments",
        request: () => api.reports.getPayments<unknown>(reportQuery),
      },
      {
        label: "Ocupacion diaria",
        endpoint: "GET /api/reports/occupancy/daily",
        request: () => api.reports.getDailyOccupancy<unknown>(reportQuery),
      },
      {
        label: "Rentabilidad minibar",
        endpoint: "GET /api/reports/minibar/profitability",
        request: () => api.reports.getMinibarProfitability<unknown>(reportQuery),
      },
      {
        label: "Rentabilidad desayunos",
        endpoint: "GET /api/reports/breakfast/profitability",
        request: () => api.reports.getBreakfastProfitability<unknown>(reportQuery),
      },
      {
        label: "Rentabilidad eventos",
        endpoint: "GET /api/reports/events/profitability",
        request: () => api.reports.getEventsProfitability<unknown>(reportQuery),
      },
      {
        label: "Cuentas por cobrar",
        endpoint: "GET /api/reports/credits/current-accounts",
        request: () => api.reports.getCurrentAccounts<unknown>(reportQuery),
      },
      {
        label: "Costos directos",
        endpoint: "GET /api/reports/costs/direct",
        request: () => api.reports.getDirectCosts<unknown>(reportQuery),
      },
    ]

    Promise.allSettled(individualReports.map((item) => item.request()))
      .then((results) => {
        if (cancelled) return
        setAuxiliaryReports(
          results.map((result, index) => {
            const source = individualReports[index]
            if (result.status === "fulfilled") {
              return summarizeAuxiliaryReport(source.label, source.endpoint, result.value)
            }
            return {
              label: source.label,
              endpoint: source.endpoint,
              status: "error",
              count: 0,
              message: getApiErrorMessage(result.reason),
            }
          }),
        )
      })

    api.reports.getHotelDashboard({
      from,
      to,
      selected_date: to,
    })
      .then((response) => {
        if (cancelled) return
        setBackendAnalysis(buildBackendReportAnalysis(response, localAnalysis, granularity))
        setBackendInvoiceRows(mapBackendInvoiceRows(response))
        setBackendProfitChartRows(mapBackendProfitChartRows(response))
      })
      .catch((error) => {
        if (cancelled) return
        setBackendAnalysis(null)
        setBackendInvoiceRows([])
        setBackendProfitChartRows([])
        setBackendReportError(getApiErrorMessage(error))
        toast.error("No se pudo cargar el reporte del backend", {
          description: getApiErrorMessage(error),
        })
      })
      .finally(() => {
        if (!cancelled) setBackendReportLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [from, granularity, localAnalysis, to])

  const filteredInvoices = useMemo(
    () => store.invoices.filter((invoice) => invoice.status !== "anulada" && inRange(invoice.date, from, to)),
    [from, store.invoices, to],
  )
  const reportInvoiceRows = useMemo<ReportInvoiceRow[]>(
    () =>
      backendInvoiceRows.length
        ? backendInvoiceRows
        : filteredInvoices.map((invoice) => ({
          date: invoice.date,
          invoice: `${invoice.serie}-${invoice.number}`,
          customer: invoice.customer,
          nit: invoice.nit,
          total: invoice.total,
          status: invoice.status,
        })),
    [backendInvoiceRows, filteredInvoices],
  )

  const filteredCashCloses = useMemo(
    () =>
      store.cashCloses.filter((close) =>
        inRange(close.closedAt ?? close.openedAt, from, to),
      ),
    [from, store.cashCloses, to],
  )

  const paymentData = useMemo(
    () => {
      const fills = ["var(--color-chart-1)", "var(--color-chart-5)", "var(--color-chart-4)", "var(--color-chart-2)", "var(--color-chart-3)"]

      return analysis.accountingPayments.map((row, index) => ({
        method: accountingPaymentLabel(row.type, row.subtype),
        value: row.amount,
        fill: fills[index % fills.length],
      }))
    },
    [analysis.accountingPayments],
  )

  const applyPreset = (preset: ReportGranularity) => {
    const now = new Date()
    setGranularity(preset)

    if (preset === "dia") {
      const day = isoDate(now)
      setFrom(day)
      setTo(day)
      return
    }

    if (preset === "mes") {
      setFrom(startOfMonth(now))
      setTo(endOfMonth(now))
      return
    }

    if (preset === "anio") {
      setFrom(startOfYear(now))
      setTo(endOfYear(now))
      return
    }

    setFrom(startOfYear(now))
    setTo(isoDate(now))
  }

  const exportExcel = () => {
    exportCurrentView({
      title: "Reporteria avanzada de utilidad",
      format: "excel",
      from,
      to,
    })
    toast.success("Excel financiero generado", {
      description: `${formatDate(from)} - ${formatDate(to)}`,
    })
  }

  const printReport = () => {
    exportCurrentView({
      title: "Reporteria avanzada de utilidad",
      format: "print",
      from,
      to,
    })
  }

  const profitChartData = backendProfitChartRows.length
    ? backendProfitChartRows
    : analysis.profitCenters.map((center) => ({
      name: center.name,
      revenue: center.revenue,
      cost: center.directCost + center.iva + center.inguat + center.isr,
      profit: center.netProfit,
    }))
  const daysInRange = Math.max(1, analysis.range.days.length)
  const roomCountFromReport = Math.round(analysis.metrics.availableRoomNights / daysInRange)
  const roomCount = Math.max(1, roomCountFromReport || store.rooms.length)
  const dailyOccupancyData = analysis.daily.map((row) => ({
    ...row,
    weekdayLabel: labelFor(row.weekday),
    availableRooms: Math.max(0, roomCount - row.roomNights),
  }))
  const forecastOccupancyData = [
    ...analysis.daily.map((row) => ({
      label: row.label,
      date: row.date,
      type: "Real",
      actualRooms: row.roomNights,
      forecastRooms: 0,
      occupancy: row.occupancy,
    })),
    ...analysis.forecast.slice(0, Math.min(14, analysis.forecast.length)).map((row) => ({
      label: row.label,
      date: row.date,
      type: "Pronostico",
      actualRooms: 0,
      forecastRooms: row.roomNights,
      occupancy: row.occupancy,
    })),
  ]
  const dailyChartMinWidth = Math.max(760, dailyOccupancyData.length * 34)
  const forecastChartMinWidth = Math.max(760, forecastOccupancyData.length * 30)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporteria financiera"
        title="Utilidad del hotel"
        description="Ocupacion, ingresos, costos, impuestos, creditos, canales, desayunos, eventos, minibar e inventarios en una sola lectura gerencial."
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={exportExcel}>
              <FileSpreadsheet className="size-3.5" />
              Exportar Excel
            </Button>
            <Button size="sm" className="gap-2 rounded-full" onClick={printReport}>
              <Printer className="size-3.5" />
              Imprimir
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
        <StatusPill tone={backendAnalysis ? "success" : backendReportError ? "warning" : "info"}>
          {backendReportLoading ? "Actualizando" : backendAnalysis ? "Datos reales del servidor" : "Esperando servidor"}
        </StatusPill>
        <span className="text-muted-foreground">
          {backendAnalysis
            ? "El periodo seleccionado se está leyendo desde el backend."
            : backendReportError
              ? `No se pudo leer el backend: ${backendReportError}`
              : "Cargando información oficial del servidor..."}
        </span>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="touch-scroll sticky top-0 z-20 -mx-1 flex h-auto justify-start gap-1 overflow-x-auto rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur sm:static sm:mx-0 sm:flex-wrap sm:rounded-2xl sm:bg-muted/70 sm:shadow-none">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="anterior">Periodo consultado</TabsTrigger>
          <TabsTrigger value="utilidad">Utilidad</TabsTrigger>
          <TabsTrigger value="ocupacion">Ocupacion</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
      <section className="grid gap-3 2xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden border-primary/20 py-4 sm:py-6">
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
                    <CalendarDays className="size-3.5" />
                    {formatDate(from)} - {formatDate(to)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
                    <Scale className="size-3.5 text-primary" />
                    Margen neto {pct(analysis.metrics.margin)}
                  </span>
                </div>

                <h2 className="mt-3 max-w-3xl font-serif text-xl font-semibold tracking-normal sm:mt-4 sm:text-3xl lg:text-4xl">
                  {analysis.metrics.netProfit >= 0
                    ? "La utilidad esta visible por cada rubro operativo."
                    : "El periodo muestra utilidad negativa y requiere revisar costos."}
                </h2>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
                  El reporte mantiene ocupacion, pronosticos, categorias, canales, agentes y creditos; y separa costos operativos, gastos, impuestos y utilidad por rubro.
                </p>

                <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
                  <Signal label="Ingreso" value={analysis.metrics.totalRevenue} helper="Venta y cargos del periodo" />
                  <Signal
                    label="Costos y gastos"
                    value={analysis.metrics.directCosts}
                    helper={`${money(analysis.metrics.operatingCosts)} costos + ${money(analysis.metrics.expenses)} gastos`}
                    tone="warning"
                  />
                  <Signal label="Utilidad neta" value={analysis.metrics.netProfit} helper="Despues de costos e impuestos" tone={analysis.metrics.netProfit >= 0 ? "success" : "danger"} />
                </div>
              </div>

              <div className="h-[170px] sm:h-[220px] 2xl:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Pie
                      data={analysis.utilityDistribution.filter((item) => item.amount !== 0)}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={46}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      {analysis.utilityDistribution.map((item) => (
                        <Cell key={item.label} fill={distributionColors[item.kind]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4 sm:py-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="size-4 text-primary" />
              Periodo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <label className="space-y-1 text-sm font-medium">
                Desde
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Hasta
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["dia", "Dia"],
                ["mes", "Mes"],
                ["anio", "Año"],
                ["rango", "Año a fecha"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={granularity === value ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => applyPreset(value as ReportGranularity)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          label="Ingresos totales"
          value={money(analysis.metrics.totalRevenue)}
          helper={`${analysis.metrics.roomNights} habitaciones-noche vendidas`}
          icon={TrendingUp}
          tone="success"
        />
        <ReportMetric
          label="Utilidad neta"
          value={money(analysis.metrics.netProfit)}
          helper={`Margen ${pct(analysis.metrics.margin)} despues de impuestos`}
          icon={CircleDollarSign}
          tone={analysis.metrics.netProfit >= 0 ? "success" : "danger"}
        />
        <ReportMetric
          label="Ocupacion"
          value={pct(analysis.metrics.occupancy)}
          helper={`Tarifa promedio ${money(analysis.metrics.adr)} / ingreso por habitacion disponible ${money(analysis.metrics.revpar)}`}
          icon={Hotel}
          tone="info"
        />
        <ReportMetric
          label="Costos, gastos e impuestos"
          value={money(analysis.metrics.directCosts + analysis.metrics.taxes)}
          helper={`${money(analysis.metrics.operatingCosts)} costos, ${money(analysis.metrics.expenses)} gastos, ${money(analysis.metrics.taxes)} impuestos`}
          icon={Calculator}
          tone="warning"
        />
        <ReportMetric
          label="Credito vencido"
          value={money(analysis.metrics.overdueCredit)}
          helper={`Cartera total ${money(analysis.metrics.creditBalance)}`}
          icon={WalletCards}
          tone={analysis.metrics.overdueCredit ? "danger" : "success"}
        />
        <ReportMetric
          label="Inventario a costo"
          value={money(analysis.metrics.inventoryValueAtCost)}
          helper={`Valor venta potencial ${money(analysis.metrics.inventoryRetailValue)}`}
          icon={Boxes}
          tone="info"
        />
        <ReportMetric
          label="Gastos"
          value={money(analysis.metrics.expenses)}
          helper={`${filteredCashCloses.length} cierre(s) en el periodo`}
          icon={CreditCard}
          tone={analysis.metrics.expenses ? "warning" : "success"}
        />
        <ReportMetric
          label="Mejor dia"
          value={labelFor(analysis.metrics.bestWeekday)}
          helper={`${analysis.metrics.bestWeekdayRoomNights} habitaciones-noche`}
          icon={Target}
          tone="info"
        />
      </section>

          <section className="grid gap-4 2xl:grid-cols-[1.25fr_0.75fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LineChart className="size-5 text-primary" />
                  Ingreso, ocupacion y habitaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[340px] w-full">
                  <ComposedChart data={analysis.daily} margin={{ left: 0, right: 12, top: 10 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="money" tickLine={false} axisLine={false} tickFormatter={(value) => `Q${Number(value) / 1000}k`} />
                    <YAxis yAxisId="pct" orientation="right" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area yAxisId="money" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.16} strokeWidth={2} />
                    <Bar yAxisId="money" dataKey="roomNights" fill="var(--color-rooms)" radius={[6, 6, 0, 0]} />
                    <Area yAxisId="pct" type="monotone" dataKey="occupancy" stroke="var(--color-occupancy)" fill="var(--color-occupancy)" fillOpacity={0.08} strokeWidth={2} />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <PieChartIcon className="size-5 text-primary" />
                  Distribucion financiera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.utilityDistribution.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: distributionColors[item.kind] }} />
                      {item.label}
                    </span>
                    <strong>{money(item.amount)}</strong>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="anterior" className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionHeading
                  title="Metadatos del informe"
                  description="Datos base del informe: fuente, moneda, fecha seleccionada y periodo consultado."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Campo", "Valor"]}
                  rows={analysis.metadata.map((row) => [row.label, row.value])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Ajustes"
                  description="Catalogo de dias, moneda y configuracion base usada por el reporte."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Ajuste", "Valor"]}
                  rows={analysis.adjustments.map((row) => [row.setting, row.value])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Resumen hotelero heredado"
                  description="Venta acumulada, dia seleccionado, dias mas vendidos, ocupacion, contabilidad y utilidad neta del periodo."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Seccion", "Indicador", "Valor", "Lectura"]}
                  rows={analysis.legacySummary.map((row) => [
                    row.section,
                    row.indicator,
                    reportValue(row.value, row.kind),
                    row.helper,
                  ])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Ocupacion visual del periodo"
                  description="La lectura de ocupacion se ve como barras: periodo, dia seleccionado y pico del rango."
                />
              </CardHeader>
              <CardContent>
                <OccupancySummaryBars analysis={analysis} roomCount={roomCount} />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Estado diario resumido"
                  description="La misma lectura del Excel: total de habitaciones, reservadas, ocupacion, empresas, huespedes, ingresos y promedios."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <DailyStateMetricBars rows={analysis.dailyState} />
                <MiniTable
                  headers={["Metrica", "Alcance", "Dia seleccionado", "Periodo", "Año a fecha"]}
                  rows={analysis.dailyState.map((row) => [
                    row.metric,
                    row.scope,
                    reportValue(row.selectedDay, row.kind),
                    reportValue(row.period, row.kind),
                    reportValue(row.yearToDate, row.kind),
                  ])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Ingresos y pronosticos"
                  description="Tabla diaria con habitaciones, llegadas, partidas, continua la estadia, ingreso, tarifas medias, ocupacion, huespedes por habitacion y dia."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="touch-scroll overflow-x-auto">
                  <ChartContainer config={chartConfig} className="h-[320px] w-full" style={{ minWidth: forecastChartMinWidth }}>
                    <ComposedChart data={forecastOccupancyData} margin={{ left: 0, right: 12, top: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="rooms" tickLine={false} axisLine={false} domain={[0, Math.max(roomCount, 1)]} />
                      <YAxis yAxisId="pct" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "occupancy" ? pct(Number(value)) : number(Number(value)),
                          name === "actualRooms" ? "Real" : name === "forecastRooms" ? "Pronostico" : "Ocupacion",
                        ]}
                        labelFormatter={(label) => `Fecha ${label}`}
                      />
                      <Bar yAxisId="rooms" dataKey="actualRooms" fill="var(--color-actualRooms)" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="rooms" dataKey="forecastRooms" fill="var(--color-forecastRooms)" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="pct" type="monotone" dataKey="occupancy" stroke="var(--color-occupancy)" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ChartContainer>
                </div>
                <MiniTable
                  headers={["Tipo", "Fecha", "Hotel", "Habitaciones", "Llegadas", "Partidas", "Continua", "Ingreso", "Tarifa promedio", "Personas", "Tarifa por huesped", "% ocupacion", "Huespedes por habitacion", "Dia"]}
                  rows={[
                    ...analysis.daily.map((row) => [
                      "Real",
                      formatDate(row.date),
                      "Casa Luna",
                      row.roomNights,
                      row.arrivals,
                      row.departures,
                      row.stayovers,
                      money(row.revenue),
                      money(row.adr),
                      row.guests,
                      money(row.guests ? row.revenue / row.guests : 0),
                      pct(row.occupancy),
                      decimal(row.roomNights ? row.guests / row.roomNights : 0),
                      labelFor(row.weekday),
                    ]),
                    ...analysis.forecast.map((row) => [
                      row.kind,
                      formatDate(row.date),
                      row.hotel,
                      row.roomNights,
                      row.arrivals,
                      row.departures,
                      row.stayovers,
                      money(row.revenue),
                      money(row.adr),
                      row.guests,
                      money(row.guests ? row.revenue / row.guests : 0),
                      pct(row.occupancy),
                      decimal(row.roomNights ? row.guests / row.roomNights : 0),
                      labelFor(row.weekday),
                    ]),
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Dias mas vendidos"
                  description="Habitaciones-noche acumuladas por dia de la semana y participacion sobre el periodo."
                />
              </CardHeader>
              <CardContent>
                <WeekdaySalesBars rows={analysis.weekdaySales} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Promociones"
                  description="Promociones del periodo, habitaciones vendidas e impacto estimado del descuento."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Promocion", "Descripcion", "Habitaciones vendidas", "% descuento", "Impacto"]}
                  rows={analysis.promotions.map((row) => [
                    row.name,
                    row.description,
                    row.roomsSold,
                    pct(row.discountRate),
                    money(row.estimatedImpact),
                  ])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Ingresos contabilidad"
                  description="Matriz cruda equivalente a la hoja contable: fecha, usuario, cuenta, recibo, cliente, concepto, forma de pago, moneda, pais y habitaciones."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Fecha", "Usuario", "Cuenta", "Recibo", "Cliente", "Descripcion", "Tipo", "Subtipo", "Monto", "Moneda", "Pais", "Habitaciones"]}
                  rows={analysis.accountingIncome.map((row) => [
                    formatDate(row.date),
                    row.user,
                    row.account,
                    row.receipt,
                    row.customer,
                    row.description,
                    row.type,
                    labelFor(row.subtype),
                    money(row.amount),
                    row.currency,
                    row.country,
                    row.rooms,
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Resumen contable por pago"
                  description="Tipo, subtipo, importe, moneda y lectura local del periodo consultado."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Tipo", "Subtipo", "Importe", "Moneda", "Lectura local"]}
                  rows={analysis.accountingPayments.map((row) => [
                    row.type,
                    row.subtype,
                    money(row.amount),
                    row.currency,
                    row.localLabel,
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Totales y filtros contables"
                  description="Totales por efectivo, tarjeta, otros, moneda local, canal, fechas, tipo de informe y version."
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <MiniTable
                  headers={["Total", "Importe"]}
                  rows={analysis.accountingTotals.map((row) => [row.label, money(row.amount)])}
                />
                <MiniTable
                  headers={["Filtro", "Valor"]}
                  rows={analysis.accountingFilters.map((row) => [row.label, row.value])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Rentabilidad por habitacion"
                  description="Importe por habitacion individual, tipo de habitacion, noches, personas, tarifa promedio y participacion."
                />
              </CardHeader>
              <CardContent>
                <RoomRevenueOccupancyBars rows={analysis.roomRevenue} />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Cuentas corrientes"
                  description="Cuenta corriente, nombre, habitaciones-noches, personas-noches, reservas, alojamiento y otros cargos."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Cuenta", "Nombre", "Habitaciones-noches", "Personas-noches", "Reservas", "Cargo alojamiento", "Otros cargos"]}
                  rows={analysis.currentAccountsLegacy.map((row) => [
                    row.account,
                    row.name,
                    row.roomNights,
                    row.personNights,
                    row.reservations,
                    money(row.lodgingCharge),
                    money(row.otherCharges),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Restaurante"
                  description="Seccion heredada de restaurante/Parmigiano con ventas, costo, utilidad y fuente."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Area", "Venta", "Costo", "Utilidad", "% utilidad bruta", "Fuente"]}
                  rows={analysis.restaurant.map((row) => [
                    row.name,
                    money(row.sales),
                    money(row.cost),
                    money(row.grossProfit),
                    pct(row.margin),
                    row.source,
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Botanas y bebidas por producto"
                  description="Detalle por codigo de producto vendido: venta, costo, impuesto al valor agregado, impuesto sobre la renta y utilidad neta."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Codigo de producto", "Producto", "Cantidad", "Venta", "Costo", "Utilidad", "Impuesto al valor agregado", "Impuesto sobre la renta", "Neta"]}
                  rows={analysis.minibarProducts.map((row) => [
                    row.sku,
                    row.product,
                    row.units,
                    money(row.sale),
                    money(row.cost),
                    money(row.grossProfit),
                    money(row.iva),
                    money(row.isr),
                    money(row.netProfit),
                  ])}
                />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Matriz estadistica de ocupacion"
                  description="Matriz visual del periodo: niveles de habitaciones vendidas por cada fecha consultada."
                />
              </CardHeader>
              <CardContent>
                <OccupancyMatrixHeatmap daily={analysis.daily} matrix={analysis.occupancyMatrix} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="utilidad" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[minmax(360px,0.85fr)_minmax(640px,1.15fr)]">
            <Card>
              <CardHeader>
                <SectionHeading
                  title="Utilidad por rubro"
                  description="Cada rubro muestra ingreso, costo directo, impuestos y utilidad neta. Los costos estimados quedan marcados."
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.profitCenters.map((center) => (
                  <article key={center.id} className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm">
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="mobile-safe-text text-lg font-semibold">{center.name}</h3>
                          <StatusPill tone={toneForProfit(center)}>{pct(center.margin)}</StatusPill>
                          <StatusPill tone={center.confidence === "real" ? "success" : center.confidence === "mixto" ? "info" : "warning"}>
                            {confidenceLabel(center.confidence)}
                          </StatusPill>
                        </div>
                        <p className="mobile-safe-text mt-1 text-sm text-muted-foreground">{center.description}</p>
                      </div>
                      <div className="shrink-0 text-left lg:text-right">
                        <p className="text-xs text-muted-foreground">Utilidad neta</p>
                        <p className={cn("text-2xl font-bold", center.netProfit < 0 ? "text-red-700" : "text-emerald-700")}>
                          {money(center.netProfit)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(132px,100%),1fr))] gap-2">
                      <MiniValue label="Ingreso" value={money(center.revenue)} />
                      <MiniValue label="Costo" value={money(center.directCost)} />
                      <MiniValue label="Impuesto al valor agregado" value={money(center.iva)} />
                      <MiniValue label="Impuesto de turismo y renta" value={money(center.inguat + center.isr)} />
                      <MiniValue label="Bruta" value={money(center.grossProfit)} />
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="size-5 text-primary" />
                  Ingreso, costo y utilidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="touch-scroll overflow-x-auto">
                  <ChartContainer config={chartConfig} className="h-[440px] min-w-[620px] w-full">
                  <BarChart data={profitChartData} layout="vertical" margin={{ left: 10, right: 18 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="4 4" />
                    <XAxis type="number" tickFormatter={(value) => `Q${Number(value) / 1000}k`} />
                    <YAxis type="category" dataKey="name" width={145} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="cost" fill="var(--color-cost)" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="profit" fill="var(--color-profit)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <SectionHeading
                title="Distribucion de utilidad"
                description="Utilidad bruta, impuesto al valor agregado, impuesto sobre la renta, impuesto de turismo y utilidad neta por cada rubro que genera o consume dinero en el hotel."
              />
            </CardHeader>
            <CardContent>
              <MiniTable
                headers={["Area", "Utilidad bruta", "Impuesto al valor agregado", "Impuesto sobre la renta", "Impuesto de turismo", "Utilidad neta"]}
                rows={analysis.utilityBreakdown.map((row) => [
                  row.area,
                  money(row.grossProfit),
                  money(row.iva),
                  money(row.isr),
                  money(row.inguat),
                  money(row.netProfit),
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocupacion" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="2xl:col-span-2">
              <CardHeader>
                <SectionHeading
                  title="Ocupacion diaria"
                  description="Barras por fecha con habitaciones vendidas, habitaciones disponibles y linea de porcentaje para leer picos y caidas al instante."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <MiniValue label="Habitaciones-noche" value={`${number(analysis.metrics.roomNights)} / ${number(analysis.metrics.availableRoomNights)}`} />
                  <MiniValue label="Ocupacion promedio" value={pct(analysis.metrics.occupancy)} />
                  <MiniValue label="Tarifa promedio / ingreso por habitacion disponible" value={`${money(analysis.metrics.adr)} / ${money(analysis.metrics.revpar)}`} />
                </div>
                <div className="touch-scroll overflow-x-auto">
                  <ChartContainer config={chartConfig} className="h-[360px] w-full" style={{ minWidth: dailyChartMinWidth }}>
                    <ComposedChart data={dailyOccupancyData} margin={{ left: 0, right: 12, top: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="rooms" tickLine={false} axisLine={false} domain={[0, Math.max(roomCount, 1)]} />
                      <YAxis yAxisId="pct" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "occupancy" ? pct(Number(value)) : number(Number(value)),
                          name === "roomNights" ? "Vendidas" : name === "availableRooms" ? "Disponibles" : "Ocupacion",
                        ]}
                        labelFormatter={(label) => `Fecha ${label}`}
                      />
                      <Bar yAxisId="rooms" dataKey="roomNights" stackId="rooms" fill="var(--color-roomNights)" radius={[0, 0, 0, 0]} />
                      <Bar yAxisId="rooms" dataKey="availableRooms" stackId="rooms" fill="var(--color-availableRooms)" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="pct" type="monotone" dataKey="occupancy" stroke="var(--color-occupancy)" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Rentabilidad por categoria"
                  description="Ingreso y rendimiento por tipo de habitacion, como el Excel, con tarifa promedio y participacion de ocupacion."
                />
              </CardHeader>
              <CardContent>
                <RoomCategoryBars rows={analysis.roomCategories} days={daysInRange} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Pulso diario"
                  description="Detalle rapido de cada fecha: ocupacion, llegadas, partidas, continuacion, ingreso, tarifa promedio e ingreso por habitacion disponible."
                />
              </CardHeader>
              <CardContent>
                <DailyOccupancyBars rows={analysis.daily} roomCount={roomCount} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="ingresos" className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionHeading
                  title="Canales de venta"
                  description="Reservas, noches, personas, ingresos, tarifa media y participacion por canal."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Codigo", "Canal", "Reservas", "Noches", "Personas", "Ingreso", "Tarifa promedio", "% ocupacion", "Tarifa por huesped", "% ingreso"]}
                  rows={analysis.channels.map((row) => [
                    row.code,
                    labelFor(row.channel),
                    row.reservations,
                    row.roomNights,
                    row.guests,
                    money(row.revenue),
                    money(row.adr),
                    pct(row.occupancyShare),
                    money(row.guestRate),
                    pct(row.share),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading
                  title="Rendimiento de agentes"
                  description="Cobros registrados por usuario de cierres/anticipos y avance contra meta operativa."
                />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Agente", "Meta", "Proyeccion", "Ejecutado", "%"]}
                  rows={analysis.agents.map((row) => [
                    row.agent,
                    number(row.target),
                    number(row.projected),
                    typeof row.executed === "number" ? money(row.executed) : row.executed,
                    pct(row.percent),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Ingresos contables" description="Facturas no anuladas del periodo por cliente, serie y total." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Fecha", "Factura", "Cliente", "NIT", "Total", "Estado"]}
                  rows={reportInvoiceRows.map((invoice) => [
                    formatDate(invoice.date),
                    invoice.invoice,
                    invoice.customer,
                    invoice.nit,
                    money(invoice.total),
                    <StatusPill tone={invoice.status.toLowerCase().includes("cert") || invoice.status === "emitida" ? "success" : "warning"}>{invoice.status}</StatusPill>,
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Metodos de pago" description="Efectivo, tarjeta, transferencia, depositos y otros desde el resumen contable del periodo." />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 2xl:grid-cols-[260px_1fr]">
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Tooltip formatter={(value) => money(Number(value))} />
                      <Pie data={paymentData} dataKey="value" nameKey="method" innerRadius={54} outerRadius={86} paddingAngle={3}>
                        {paymentData.map((entry) => (
                          <Cell key={entry.method} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {paymentData.map((item) => (
                      <div key={item.method} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: item.fill }} />
                          {item.method}
                        </span>
                        <strong>{money(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <SectionHeading title="Clientes al credito" description="Cuentas corrientes, cupos, saldos, vencimiento y disponibilidad." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Empresa", "Contacto", "Limite", "Saldo", "Disponible", "Vence", "Estado"]}
                  rows={analysis.credits.map((row) => [
                    row.company,
                    row.contact,
                    money(row.limit),
                    money(row.balance),
                    money(row.available),
                    formatDate(row.dueDate),
                    <StatusPill tone={row.status === "vencido" ? "danger" : row.status === "por vencer" ? "warning" : "success"}>{row.status}</StatusPill>,
                  ])}
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="operaciones" className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionHeading title="Desayunos" description="Emitidos, consumidos, costo, valor de menu e impacto operativo." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Tipo", "Emitidos", "Consumidos", "Costo", "Valor menu", "Impacto"]}
                  rows={analysis.breakfast.map((row) => [
                    row.label,
                    row.issued,
                    row.redeemed,
                    money(row.cost),
                    money(row.retailValue),
                    money(row.profitImpact),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Analisis desayunos" description="Relacion entre habitaciones, personas y platillos vendidos." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Categoria", "Cantidad", "Platillos vendidos", "%"]}
                  rows={analysis.breakfastOccupancy.map((row) => [
                    row.category,
                    row.quantity,
                    row.platesSold,
                    pct(row.share),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Restaurante resumen" description="Desayunos, extras/restaurante y total con venta, costo, utilidad y margen." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Area", "Venta", "Costo", "Utilidad", "% utilidad bruta"]}
                  rows={analysis.restaurantSummary.map((row) => [
                    row.area,
                    money(row.sales),
                    money(row.cost),
                    money(row.profit),
                    pct(row.margin),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Botanas y bebidas" description="Consumos de minibar contra costo del producto vendido." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Rubro", "Unidades", "Venta", "Costo", "Utilidad"]}
                  rows={analysis.inventoryProfit.map((row) => [
                    row.label,
                    row.units,
                    money(row.revenue),
                    money(row.cost),
                    money(row.profit),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Salon de eventos" description="Venta, costo estimado, utilidad y margen por evento o coworking." />
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={["Evento", "Cliente", "Espacio", "Tipo", "Venta", "Costo", "Utilidad", "% utilidad bruta"]}
                  rows={analysis.events.map((event) => [
                    event.title,
                    event.client,
                    event.salon,
                    labelFor(event.type),
                    money(event.revenue),
                    money(event.estimatedCost),
                    money(event.profit),
                    pct(event.margin),
                  ])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeading title="Costos y gastos operativos" description="Desglose de costos identificados y egresos registrados que reducen la utilidad." />
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <CostBox icon={Wrench} label="Mantenimiento" value={analysis.metrics.maintenanceCost} />
                <CostBox icon={CreditCard} label="Gastos" value={analysis.metrics.expenses} />
                <CostBox icon={Boxes} label="Inventario a costo" value={analysis.metrics.inventoryValueAtCost} />
                <CostBox icon={Utensils} label="Costo desayunos" value={analysis.breakfast.reduce((sum, row) => sum + row.cost, 0)} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="detalle" className="space-y-4">
          <Card>
            <CardHeader>
              <SectionHeading
                title="Reportes individuales del backend"
                description="Consulta directa de los endpoints específicos del periodo seleccionado; se muestran aquí para validar que cada reporte responde con datos reales."
              />
            </CardHeader>
            <CardContent>
              <MiniTable
                headers={["Reporte", "Endpoint", "Estado", "Filas", "Total / valor", "Lectura"]}
                rows={auxiliaryReports.map((row) => [
                  row.label,
                  row.endpoint,
                  <StatusPill tone={row.status === "ok" ? "success" : "danger"}>
                    {row.status === "ok" ? "Conectado" : "Error"}
                  </StatusPill>,
                  number(row.count),
                  row.total === undefined ? "N/D" : money(row.total),
                  row.message,
                ])}
              />
              {!auxiliaryReports.length ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {backendReportLoading ? "Cargando reportes del backend..." : "Sin consultas registradas para este periodo."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
            <SectionHeading title="Reservas del periodo" description="Base del calculo de ocupacion, ingresos por habitacion, tarifa promedio e ingreso por habitacion disponible." />
            </CardHeader>
            <CardContent>
              <MiniTable
                headers={["Codigo", "Cliente", "Habitacion", "Entrada", "Salida", "Noches", "Canal", "Total", "Pagado", "Estado"]}
                rows={analysis.reservations.map((reservation) => {
                  const room = store.rooms.find((item) => item.id === reservation.roomId)
                  const guest = store.guests.find((item) => item.id === reservation.guestId)
                  const guestName = guest?.name ?? reservation.notes ?? reservation.guestId ?? "Huésped"
                  const roomNumber = room?.number ?? reservation.roomId ?? "-"

                  return [
                    reservation.code,
                    guestName,
                    roomNumber,
                    formatDate(reservation.checkIn),
                    formatDate(reservation.checkOut),
                    reservation.nights,
                    labelFor(reservation.source),
                    money(reservation.total),
                    money(reservation.paid),
                    <StatusPill tone={reservation.status === "checkout" ? "muted" : reservation.status === "in-house" ? "info" : reservation.status === "confirmada" ? "success" : "warning"}>{reservation.status}</StatusPill>,
                  ]
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}

function OccupancyBar({
  label,
  percent,
  value,
  helper,
  meta,
  tonePercent = percent,
}: {
  label: string
  percent: number
  value?: ReactNode
  helper?: ReactNode
  meta?: ReactNode
  tonePercent?: number
}) {
  const safePercent = clampPercent(percent)
  const safeTone = clampPercent(tonePercent)

  return (
    <article className="min-w-0 rounded-2xl border bg-background/65 p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mobile-safe-text text-sm font-semibold">{label}</p>
          {helper && <p className="mobile-safe-text mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta}
          <StatusPill tone={occupancyTone(safeTone)}>{value ?? pct(safeTone)}</StatusPill>
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${safePercent}%`, background: occupancyColor(safeTone) }}
        />
      </div>
    </article>
  )
}

function OccupancySummaryBars({ analysis, roomCount }: { analysis: AdvancedReportAnalysis; roomCount: number }) {
  const selectedDay = analysis.daily[analysis.daily.length - 1]
  const bestDay = [...analysis.daily].sort((a, b) => b.occupancy - a.occupancy)[0]

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <OccupancyBar
        label="Periodo"
        percent={analysis.metrics.occupancy}
        value={pct(analysis.metrics.occupancy)}
        helper={`${number(analysis.metrics.roomNights)} de ${number(analysis.metrics.availableRoomNights)} habitaciones-noche`}
      />
      <OccupancyBar
        label="Dia seleccionado"
        percent={selectedDay?.occupancy ?? 0}
        value={pct(selectedDay?.occupancy ?? 0)}
        helper={selectedDay ? `${formatDate(selectedDay.date)} · ${selectedDay.roomNights} de ${roomCount} habitaciones` : "Sin ocupacion registrada"}
      />
      <OccupancyBar
        label="Pico del rango"
        percent={bestDay?.occupancy ?? 0}
        value={pct(bestDay?.occupancy ?? 0)}
        helper={bestDay ? `${formatDate(bestDay.date)} · ${labelFor(bestDay.weekday)} · ${bestDay.roomNights} habitaciones` : "Sin datos del periodo"}
      />
    </div>
  )
}

function DailyStateMetricBars({ rows }: { rows: DailyStateMetricRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const isPercent = row.kind === "percent"

        return (
          <article key={`${row.metric}-${row.scope}`} className="min-w-0 rounded-2xl border bg-background/65 p-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mobile-safe-text text-sm font-semibold">{row.metric}</p>
                <p className="mobile-safe-text mt-1 text-xs text-muted-foreground">{row.scope}</p>
              </div>
              <StatusPill tone={isPercent ? occupancyTone(row.period) : "muted"}>
                {reportValue(row.period, row.kind)}
              </StatusPill>
            </div>

            {isPercent && (
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${clampPercent(row.period)}%`, background: occupancyColor(row.period) }}
                />
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MiniStateValue label="Dia" value={reportValue(row.selectedDay, row.kind)} />
              <MiniStateValue label="Periodo" value={reportValue(row.period, row.kind)} />
              <MiniStateValue label="Anio a fecha" value={reportValue(row.yearToDate, row.kind)} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MiniStateValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/45 px-2 py-2">
      <p className="mobile-safe-text text-[0.65rem] uppercase text-muted-foreground">{label}</p>
      <p className="mobile-safe-text mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function WeekdaySalesBars({ rows }: { rows: WeekdaySalesRow[] }) {
  const maxRoomNights = Math.max(1, ...rows.map((row) => row.roomNights))

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <OccupancyBar
          key={row.weekday}
          label={labelFor(row.weekday)}
          percent={percentOf(row.roomNights, maxRoomNights)}
          tonePercent={row.share}
          value={`${number(row.roomNights)} habitaciones-noche`}
          helper={`${pct(row.share)} del periodo`}
        />
      ))}
    </div>
  )
}

function RoomCategoryBars({ rows, days }: { rows: RoomCategoryReportRow[]; days: number }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
        No hay tipos de habitacion disponibles desde el servidor para calcular esta rentabilidad.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const capacity = row.rooms * days
        const categoryOccupancy = percentOf(row.roomNights, capacity)

        return (
          <OccupancyBar
            key={row.category}
            label={row.category}
            percent={categoryOccupancy}
            value={pct(categoryOccupancy)}
            helper={`${row.roomNights} de ${number(capacity)} noches · tarifa promedio ${money(row.adr)} · ${money(row.revenue)}`}
            meta={<span className="text-xs text-muted-foreground">{row.rooms} hab.</span>}
          />
        )
      })}
    </div>
  )
}

function DailyOccupancyBars({ rows, roomCount }: { rows: DailyReportRow[]; roomCount: number }) {
  return (
    <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
      {rows.map((row) => (
        <OccupancyBar
          key={row.date}
          label={`${formatDate(row.date)} · ${labelFor(row.weekday)}`}
          percent={row.occupancy}
          value={pct(row.occupancy)}
          helper={`${row.roomNights} de ${roomCount} habitaciones · ${row.arrivals} llegadas · ${row.departures} partidas · ${money(row.revenue)}`}
          meta={<span className="text-xs text-muted-foreground">Tarifa promedio {money(row.adr)}</span>}
        />
      ))}
    </div>
  )
}

function RoomRevenueOccupancyBars({ rows }: { rows: RoomRevenueRow[] }) {
  const sortedRows = [...rows].sort((a, b) => b.roomNights - a.roomNights)
  const maxShare = Math.max(1, ...sortedRows.map((row) => row.occupancyShare))

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sortedRows.map((row) => (
        <OccupancyBar
          key={row.room}
          label={`Habitacion ${row.room}`}
          percent={percentOf(row.occupancyShare, maxShare)}
          tonePercent={percentOf(row.occupancyShare, maxShare)}
          value={`${number(row.roomNights)} noches`}
          helper={`${row.roomType} · ${row.guests} personas · ${money(row.revenue)} · tarifa promedio ${money(row.adr)} · ${pct(row.occupancyShare)} del hotel`}
        />
      ))}
    </div>
  )
}

function OccupancyMatrixHeatmap({
  daily,
  matrix,
}: {
  daily: DailyReportRow[]
  matrix: OccupancyMatrixRow[]
}) {
  const minWidth = Math.max(620, daily.length * 38 + 132)
  const maxTotal = Math.max(1, ...matrix.map((row) => row.total))

  return (
    <div className="space-y-3">
      <div className="touch-scroll overflow-x-auto rounded-2xl border bg-background/60 p-3">
        <div
          className="grid gap-1.5 text-xs"
          style={{ minWidth, gridTemplateColumns: `56px repeat(${daily.length}, minmax(24px, 1fr)) 58px` }}
        >
          <div className="font-semibold text-muted-foreground">Noches</div>
          {daily.map((day) => (
            <div key={day.date} className="truncate text-center font-semibold text-muted-foreground" title={formatDate(day.date)}>
              {day.label}
            </div>
          ))}
          <div className="text-right font-semibold text-muted-foreground">Total</div>

          {matrix.map((row) => (
            <div key={row.level} className="contents">
              <div className="flex h-6 items-center font-medium tabular-nums">
                {row.level}
              </div>
              {row.values.map((value, index) => (
                <div
                  key={`${row.level}-${daily[index]?.date ?? index}`}
                  className="h-6 rounded-md"
                  title={`${daily[index] ? formatDate(daily[index].date) : "Fecha"} · nivel ${row.level}`}
                  style={{ background: value ? "var(--color-chart-5)" : "var(--color-muted)", opacity: value ? 0.86 : 0.45 }}
                />
              ))}
              <div className="flex h-6 items-center justify-end gap-2">
                <span className="tabular-nums">{row.total}</span>
                <span className="h-2 w-8 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${percentOf(row.total, maxTotal)}%`, background: "var(--color-chart-4)" }}
                  />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--color-chart-5)" }} /> Ocupada</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted" /> Disponible</span>
        <span>La altura forma la barra diaria; cada bloque representa un nivel de habitacion-noche.</span>
      </div>
    </div>
  )
}

function Signal({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string
  value: number
  helper: string
  tone?: "default" | "success" | "warning" | "danger"
}) {
  const color = {
    default: "border-sky-200 bg-sky-50 text-sky-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-950",
  }[tone]

  return (
    <div className={cn("rounded-2xl border p-3", color)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{money(value)}</p>
      <p className="mt-1 text-xs opacity-75">{helper}</p>
    </div>
  )
}

function MiniValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
      <p className="mobile-safe-text text-xs text-muted-foreground">{label}</p>
      <p className="mobile-safe-text mt-1 text-sm font-semibold tabular-nums sm:text-base">{value}</p>
    </div>
  )
}

function CostBox({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-3 text-xl font-bold">{money(value)}</p>
    </div>
  )
}

export default ReportesPage
