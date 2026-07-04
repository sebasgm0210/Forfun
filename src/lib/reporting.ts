import type { State } from "@/lib/store"
import type { HotelEvent, InventoryCategory, InventoryItem, Reservation } from "@/lib/types"

export type ReportGranularity = "dia" | "mes" | "anio" | "rango"

export type ReportRange = {
  from: string
  to: string
  days: string[]
  granularity: ReportGranularity
}

export type ProfitCenter = {
  id: string
  name: string
  description: string
  revenue: number
  directCost: number
  iva: number
  inguat: number
  isr: number
  grossProfit: number
  netProfit: number
  margin: number
  confidence: "real" | "estimado" | "mixto"
}

export type DailyReportRow = {
  date: string
  label: string
  weekday: string
  roomNights: number
  arrivals: number
  departures: number
  stayovers: number
  guests: number
  revenue: number
  adr: number
  revpar: number
  occupancy: number
}

export type RoomCategoryReportRow = {
  category: string
  rooms: number
  roomNights: number
  revenue: number
  adr: number
  occupancyShare: number
}

export type SalesChannelReportRow = {
  code: string
  channel: string
  reservations: number
  roomNights: number
  guests: number
  revenue: number
  adr: number
  occupancyShare: number
  guestRate: number
  share: number
}

export type AgentReportRow = {
  agent: string
  target: number
  projected: number
  executed: number
  percent: number
}

export type CreditReportRow = {
  company: string
  contact: string
  limit: number
  balance: number
  dueDate: string
  status: string
  available: number
}

export type InventoryProfitRow = {
  category: InventoryCategory
  label: string
  revenue: number
  cost: number
  profit: number
  units: number
}

export type BreakfastReportRow = {
  label: string
  issued: number
  redeemed: number
  cost: number
  retailValue: number
  profitImpact: number
}

export type EventProfitRow = {
  title: string
  client: string
  salon: string
  type: HotelEvent["type"]
  revenue: number
  estimatedCost: number
  profit: number
  margin: number
}

export type UtilityDistributionRow = {
  label: string
  amount: number
  kind: "revenue" | "cost" | "expense" | "tax" | "profit"
}

export type UtilityBreakdownRow = {
  area: string
  grossProfit: number
  iva: number
  isr: number
  inguat: number
  netProfit: number
}

export type AdjustmentRow = {
  setting: string
  value: string
}

export type AccountingIncomeRow = {
  date: string
  user: string
  account: string
  receipt: string
  customer: string
  description: string
  type: string
  subtype: string
  amount: number
  currency: string
  country: string
  rooms: string
}

export type AccountingPaymentSummaryRow = {
  type: string
  subtype: string
  amount: number
  currency: string
  localLabel: string
}

export type AccountingTotalRow = {
  label: string
  amount: number
}

export type AccountingFilterRow = {
  label: string
  value: string
}

export type RoomRevenueRow = {
  room: string
  roomType: string
  roomNights: number
  guests: number
  revenue: number
  adr: number
  occupancyShare: number
}

export type CurrentAccountLegacyRow = {
  account: string
  name: string
  roomNights: number
  personNights: number
  reservations: number
  lodgingCharge: number
  otherCharges: number
}

export type DailyStateMetricRow = {
  metric: string
  scope: string
  selectedDay: number
  period: number
  yearToDate: number
  kind: "number" | "money" | "percent"
}

export type WeekdaySalesRow = {
  weekday: string
  roomNights: number
  share: number
}

export type PromotionRow = {
  name: string
  description: string
  roomsSold: number
  discountRate: number
  estimatedImpact: number
}

export type ForecastReportRow = DailyReportRow & {
  hotel: string
  kind: "Real" | "Pronostico"
}

export type RestaurantProfitRow = {
  name: string
  sales: number
  cost: number
  grossProfit: number
  margin: number
  source: string
}

export type RestaurantSummaryRow = {
  area: string
  sales: number
  cost: number
  profit: number
  margin: number
}

export type MinibarProductProfitRow = {
  sku: string
  product: string
  units: number
  sale: number
  cost: number
  grossProfit: number
  iva: number
  isr: number
  netProfit: number
}

export type BreakfastOccupancyAnalysisRow = {
  category: string
  quantity: number
  platesSold: number
  share: number
}

export type LegacySummaryRow = {
  section: string
  indicator: string
  value: number
  kind: "number" | "money" | "percent"
  helper: string
}

export type OccupancyMatrixRow = {
  level: number
  values: number[]
  total: number
}

export type ReportMetadataRow = {
  label: string
  value: string
}

export type AdvancedReportAnalysis = {
  range: ReportRange
  reservations: Reservation[]
  daily: DailyReportRow[]
  roomCategories: RoomCategoryReportRow[]
  channels: SalesChannelReportRow[]
  agents: AgentReportRow[]
  credits: CreditReportRow[]
  inventoryProfit: InventoryProfitRow[]
  breakfast: BreakfastReportRow[]
  events: EventProfitRow[]
  profitCenters: ProfitCenter[]
  utilityDistribution: UtilityDistributionRow[]
  utilityBreakdown: UtilityBreakdownRow[]
  adjustments: AdjustmentRow[]
  accountingIncome: AccountingIncomeRow[]
  accountingPayments: AccountingPaymentSummaryRow[]
  accountingTotals: AccountingTotalRow[]
  accountingFilters: AccountingFilterRow[]
  roomRevenue: RoomRevenueRow[]
  currentAccountsLegacy: CurrentAccountLegacyRow[]
  dailyState: DailyStateMetricRow[]
  weekdaySales: WeekdaySalesRow[]
  promotions: PromotionRow[]
  forecast: ForecastReportRow[]
  restaurant: RestaurantProfitRow[]
  restaurantSummary: RestaurantSummaryRow[]
  minibarProducts: MinibarProductProfitRow[]
  breakfastOccupancy: BreakfastOccupancyAnalysisRow[]
  legacySummary: LegacySummaryRow[]
  occupancyMatrix: OccupancyMatrixRow[]
  metadata: ReportMetadataRow[]
  metrics: {
    totalRevenue: number
    operatingCosts: number
    expenses: number
    directCosts: number
    taxes: number
    grossProfit: number
    netProfit: number
    margin: number
    roomNights: number
    availableRoomNights: number
    occupancy: number
    adr: number
    revpar: number
    guests: number
    bestWeekday: string
    bestWeekdayRoomNights: number
    creditBalance: number
    overdueCredit: number
    cashExpenses: number
    maintenanceCost: number
    inventoryValueAtCost: number
    inventoryRetailValue: number
  }
}

const IVA_RATE = 0.12
const INGUAT_RATE = 0.1
const ISR_RATE = 0.05

const roomNightCostByType = [
  { match: /jr|suite/i, cost: 125 },
  { match: /estandar|standard/i, cost: 95 },
]

const breakfastCostByType: Record<string, number> = {
  continental: 18,
  americano: 24,
  ejecutivo: 28,
  vegetariano: 22,
}

const breakfastRetailByType: Record<string, number> = {
  continental: 45,
  americano: 55,
  ejecutivo: 65,
  vegetariano: 52,
}

export function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addDaysIso(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + days)
  return isoDate(next)
}

export function createReportRange(from: string, to: string, granularity: ReportGranularity = "rango"): ReportRange {
  const fallback = isoDate(new Date())
  const start = normalizeIsoDate(from) ?? fallback
  const end = normalizeIsoDate(to) ?? start
  const [safeFrom, safeTo] = start <= end ? [start, end] : [end, start]
  const days: string[] = []

  for (let day = safeFrom; day <= safeTo; day = addDaysIso(day, 1)) {
    days.push(day)
  }

  return { from: safeFrom, to: safeTo, days, granularity }
}

export function startOfMonth(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function startOfYear(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), 0, 1))
}

export function endOfYear(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), 11, 31))
}

export function buildAdvancedReportAnalysis(
  state: State,
  from: string,
  to: string,
  granularity: ReportGranularity = "rango",
): AdvancedReportAnalysis {
  const range = createReportRange(from, to, granularity)
  const activeReservations = state.reservations.filter(
    (reservation) =>
      !["cancelada", "no-show"].includes(reservation.status) &&
      (reservationOverlapsRange(reservation, range) || dateInRange(reservation.createdAt, range)),
  )
  const stayReservations = activeReservations.filter((reservation) => reservationOverlapsRange(reservation, range))
  const roomNights = sum(stayReservations, (reservation) => reservationNightsInRange(reservation, range))
  const lodgingRevenue = sum(stayReservations, (reservation) => reservationRevenueInRange(reservation, range))
  const guests = sum(stayReservations, (reservation) => {
    const nights = reservationNightsInRange(reservation, range)
    return nights * Math.max(1, reservation.adults + reservation.children)
  })
  const availableRoomNights = state.rooms.length * range.days.length
  const daily = buildDailyRows(state, range)
  const roomCategories = buildRoomCategories(state, stayReservations, range, availableRoomNights)
  const roomRevenue = buildRoomRevenueRows(state, stayReservations, range, availableRoomNights)
  const channels = buildChannels(state, stayReservations, range, lodgingRevenue, availableRoomNights)
  const agents = buildAgents(state, range, roomNights, availableRoomNights)
  const credits = state.creditAccounts.map((account) => ({
    company: account.company,
    contact: account.contact,
    limit: account.limit,
    balance: account.balance,
    dueDate: account.dueDate,
    status: account.status,
    available: Math.max(0, account.limit - account.balance),
  }))
  const breakfast = buildBreakfastRows(state, range)
  const breakfastCost = sum(breakfast, (row) => row.cost)
  const breakfastRetailValue = sum(breakfast, (row) => row.retailValue)
  const inventoryProfit = buildInventoryProfitRows(state, range)
  const minibarProducts = buildMinibarProductRows(state, range)
  const snackProfit = inventoryProfit.find((row) => row.category === "snack")
  const inventoryOperatingCost = sum(
    inventoryProfit.filter((row) => row.category !== "snack"),
    (row) => row.cost,
  )
  const eventRows = buildEventRows(state, range)
  const eventRevenue = sum(eventRows, (row) => row.revenue)
  const eventCost = sum(eventRows, (row) => row.estimatedCost)
  const restaurant = buildRestaurantRows(state, range, breakfastRetailValue)
  const cashExpenses = sum(
    state.cashCloses.filter((close) => dateInRange(close.closedAt ?? close.openedAt, range)),
    (close) => close.expenses,
  )
  const maintenanceCost = sum(
    state.maintenance.filter((ticket) => dateInRange(ticket.resolvedAt ?? ticket.createdAt, range)),
    (ticket) => ticket.cost ?? 0,
  )
  const roomOperatingCost = sum(stayReservations, (reservation) => {
    const room = state.rooms.find((entry) => entry.id === reservation.roomId)
    const roomType = room ? state.roomTypes.find((entry) => entry.id === room.typeId) : undefined
    return reservationNightsInRange(reservation, range) * roomNightCost(roomType?.name ?? "")
  })
  const invoiceOtherRevenue = invoiceOtherChargeRevenue(state, range)
  const accountingIncome = buildAccountingIncomeRows(state, range)
  const accountingPayments = buildAccountingPaymentSummaryRows(state, range, accountingIncome)
  const accountingTotals = buildAccountingTotalRows(accountingPayments)
  const accountingFilters = buildAccountingFilterRows(range)
  const currentAccountsLegacy = buildCurrentAccountLegacyRows(state, stayReservations, range)
  const dailyState = buildDailyStateRows(state, range, daily, stayReservations)
  const weekdaySales = buildWeekdaySalesRows(daily)
  const promotions = buildPromotionRows(stayReservations, range)
  const forecast = buildForecastRows(state, range)
  const occupancyMatrix = buildOccupancyMatrixRows(daily, state.rooms.length)
  const metadata = buildMetadataRows(range)

  const profitCenters = [
    buildProfitCenter({
      id: "habitaciones",
      name: "Habitaciones",
      description: "Alojamiento, ocupacion, tarifa promedio y costo variable por habitacion-noche.",
      revenue: lodgingRevenue,
      directCost: roomOperatingCost,
      inguatApplies: true,
      confidence: "mixto",
    }),
    buildProfitCenter({
      id: "eventos",
      name: "Salones, eventos y coworking",
      description: "Alquiler, eventos por consumo y coworking externo.",
      revenue: eventRevenue,
      directCost: eventCost,
      confidence: "mixto",
    }),
    buildProfitCenter({
      id: "snacks",
      name: "Snacks y minibar",
      description: "Consumos cargados desde revision de minibar contra costo de inventario.",
      revenue: snackProfit?.revenue ?? 0,
      directCost: snackProfit?.cost ?? 0,
      confidence: "real",
    }),
    buildProfitCenter({
      id: "desayunos",
      name: "Desayunos",
      description: "Costo real estimado por voucher y valor de menu para medir impacto.",
      revenue: 0,
      directCost: breakfastCost,
      confidence: "estimado",
    }),
    buildProfitCenter({
      id: "restaurante",
      name: "Restaurante / Parmigiano",
      description: "Consumos de restaurante identificados o inferidos desde eventos por consumo y desayunos.",
      revenue: sum(restaurant.filter((row) => row.name.includes("Parmigiano")), (row) => row.sales),
      directCost: sum(restaurant.filter((row) => row.name.includes("Parmigiano")), (row) => row.cost),
      confidence: "estimado",
    }),
    buildProfitCenter({
      id: "otros-cargos",
      name: "Otros cargos facturados",
      description: "Extras en facturas no clasificados como habitacion, evento, desayuno o minibar.",
      revenue: invoiceOtherRevenue,
      directCost: 0,
      confidence: "mixto",
    }),
    buildProfitCenter({
      id: "blancos-suministros",
      name: "Blancos, suministros y reposiciones",
      description: "Salidas, ajustes y reposiciones que afectan el costo operativo.",
      revenue: 0,
      directCost: inventoryOperatingCost,
      confidence: "real",
    }),
    buildProfitCenter({
      id: "mantenimiento",
      name: "Mantenimiento",
      description: "Tickets resueltos con costo y gastos tecnicos del periodo.",
      revenue: 0,
      directCost: maintenanceCost,
      confidence: "real",
    }),
    buildProfitCenter({
      id: "gastos",
      name: "Gastos",
      description: "Egresos registrados en cierres de caja que reducen la utilidad del periodo.",
      revenue: 0,
      directCost: cashExpenses,
      confidence: "real",
    }),
  ]

  const totalRevenue = sum(profitCenters, (center) => center.revenue)
  const directCosts = sum(profitCenters, (center) => center.directCost)
  const expenses = cashExpenses
  const operatingCosts = Math.max(0, directCosts - expenses)
  const taxes = sum(profitCenters, (center) => center.iva + center.inguat + center.isr)
  const grossProfit = totalRevenue - directCosts
  const netProfit = sum(profitCenters, (center) => center.netProfit)
  const weekdayStats = bestWeekday(daily)
  const inventoryValueAtCost = sum(state.inventory, (item) => item.stock * item.cost)
  const inventoryRetailValue = sum(state.inventory, (item) => item.stock * (item.price ?? item.cost))
  const utilityBreakdown = buildUtilityBreakdownRows(profitCenters)
  const restaurantSummary = buildRestaurantSummaryRows(restaurant)
  const breakfastOccupancy = buildBreakfastOccupancyRows(breakfast, roomNights, guests)
  const legacySummary = buildLegacySummaryRows({
    range,
    daily,
    roomNights,
    guests,
    totalRevenue,
    occupancy: safePercent(roomNights, availableRoomNights),
    netProfit,
    bestWeekday: weekdayStats.weekday,
    bestWeekdayRoomNights: weekdayStats.roomNights,
    accountingTotal: sum(accountingTotals, (row) => row.label === "Moneda local" ? row.amount : 0),
  })

  return {
    range,
    reservations: activeReservations,
    daily,
    roomCategories,
    roomRevenue,
    channels,
    agents,
    credits,
    inventoryProfit,
    breakfast: breakfast.map((row) => ({
      ...row,
      profitImpact: row.retailValue - row.cost,
    })),
    events: eventRows,
    profitCenters,
    utilityDistribution: [
      { label: "Ingresos brutos", amount: totalRevenue, kind: "revenue" },
      { label: "Costos operativos", amount: operatingCosts, kind: "cost" },
      { label: "Gastos", amount: expenses, kind: "expense" },
      { label: "Impuestos", amount: taxes, kind: "tax" },
      { label: "Utilidad neta", amount: netProfit, kind: "profit" },
      { label: "Valor operativo desayunos", amount: breakfastRetailValue, kind: "revenue" },
    ],
    utilityBreakdown,
    adjustments: buildAdjustmentRows(),
    accountingIncome,
    accountingPayments,
    accountingTotals,
    accountingFilters,
    currentAccountsLegacy,
    dailyState,
    weekdaySales,
    promotions,
    forecast,
    restaurant,
    restaurantSummary,
    minibarProducts,
    breakfastOccupancy,
    legacySummary,
    occupancyMatrix,
    metadata,
    metrics: {
      totalRevenue,
      operatingCosts,
      expenses,
      directCosts,
      taxes,
      grossProfit,
      netProfit,
      margin: safePercent(netProfit, totalRevenue),
      roomNights,
      availableRoomNights,
      occupancy: safePercent(roomNights, availableRoomNights),
      adr: roomNights ? lodgingRevenue / roomNights : 0,
      revpar: availableRoomNights ? lodgingRevenue / availableRoomNights : 0,
      guests,
      bestWeekday: weekdayStats.weekday,
      bestWeekdayRoomNights: weekdayStats.roomNights,
      creditBalance: sum(state.creditAccounts, (account) => account.balance),
      overdueCredit: sum(
        state.creditAccounts.filter((account) => account.status === "vencido"),
        (account) => account.balance,
      ),
      cashExpenses,
      maintenanceCost,
      inventoryValueAtCost,
      inventoryRetailValue,
    },
  }
}

function buildProfitCenter({
  id,
  name,
  description,
  revenue,
  directCost,
  inguatApplies = false,
  confidence,
}: {
  id: string
  name: string
  description: string
  revenue: number
  directCost: number
  inguatApplies?: boolean
  confidence: ProfitCenter["confidence"]
}): ProfitCenter {
  const iva = ivaIncluded(revenue)
  const netRevenueBeforeInguat = Math.max(0, revenue - iva)
  const inguat = inguatApplies ? netRevenueBeforeInguat * INGUAT_RATE : 0
  const grossProfit = revenue - directCost
  const taxableProfit = Math.max(0, revenue - directCost - iva - inguat)
  const isr = taxableProfit * ISR_RATE
  const netProfit = grossProfit - iva - inguat - isr

  return {
    id,
    name,
    description,
    revenue,
    directCost,
    iva,
    inguat,
    isr,
    grossProfit,
    netProfit,
    margin: safePercent(netProfit, revenue),
    confidence,
  }
}

function buildDailyRows(state: State, range: ReportRange): DailyReportRow[] {
  return range.days.map((day) => {
    const active = state.reservations.filter(
      (reservation) =>
        !["cancelada", "no-show"].includes(reservation.status) &&
        reservation.checkIn <= day &&
        reservation.checkOut > day,
    )
    const arrivals = state.reservations.filter((reservation) => reservation.checkIn === day).length
    const departures = state.reservations.filter((reservation) => reservation.checkOut === day).length
    const roomNights = active.length
    const revenue = sum(active, (reservation) => reservation.rate)
    const guests = sum(active, (reservation) => Math.max(1, reservation.adults + reservation.children))

    return {
      date: day,
      label: formatShortDate(day),
      weekday: formatWeekday(day),
      roomNights,
      arrivals,
      departures,
      stayovers: Math.max(0, roomNights - arrivals),
      guests,
      revenue,
      adr: roomNights ? revenue / roomNights : 0,
      revpar: state.rooms.length ? revenue / state.rooms.length : 0,
      occupancy: safePercent(roomNights, state.rooms.length),
    }
  })
}

function buildRoomCategories(
  state: State,
  reservations: Reservation[],
  range: ReportRange,
  availableRoomNights: number,
): RoomCategoryReportRow[] {
  const knownTypes = state.roomTypes.map((type) => ({
    id: type.id,
    name: type.name,
  }))
  const roomOnlyTypes = Array.from(
    new Set(
      state.rooms
        .map((room) => room.typeId)
        .filter((typeId) => typeId && !knownTypes.some((type) => type.id === typeId)),
    ),
  ).map((typeId) => ({
    id: typeId,
    name: typeId.replace(/^rt-/, "Tipo "),
  }))
  const categories = [...knownTypes, ...roomOnlyTypes]

  return categories
    .map((type) => {
      const rooms = state.rooms.filter((room) => room.typeId === type.id)
      const typeReservations = reservations.filter((reservation) => {
        const room = state.rooms.find((entry) => entry.id === reservation.roomId)
        return room?.typeId === type.id
      })
      const roomNights = sum(typeReservations, (reservation) => reservationNightsInRange(reservation, range))
      const revenue = sum(typeReservations, (reservation) => reservationRevenueInRange(reservation, range))
      const capacity = rooms.length * range.days.length

      return {
        category: type.name,
        rooms: rooms.length,
        roomNights,
        revenue,
        adr: roomNights ? revenue / roomNights : 0,
        occupancyShare: safePercent(roomNights, capacity),
      }
    })
    .filter((row) => row.rooms > 0 || row.roomNights > 0 || row.revenue > 0)
}

function buildChannels(
  state: State,
  reservations: Reservation[],
  range: ReportRange,
  lodgingRevenue: number,
  availableRoomNights: number,
): SalesChannelReportRow[] {
  const channels = new Map<string, Reservation[]>()
  reservations.forEach((reservation) => {
    const key = reservation.source || "directo"
    channels.set(key, [...(channels.get(key) ?? []), reservation])
  })

  return Array.from(channels.entries())
    .map(([channel, rows]) => {
      const roomNights = sum(rows, (reservation) => reservationNightsInRange(reservation, range))
      const revenue = sum(rows, (reservation) => reservationRevenueInRange(reservation, range))
      const guests = sum(rows, (reservation) =>
        reservationNightsInRange(reservation, range) * Math.max(1, reservation.adults + reservation.children),
      )

      return {
        code: channelCode(channel),
        channel,
        reservations: rows.length,
        roomNights,
        guests,
        revenue,
        adr: roomNights ? revenue / roomNights : 0,
        occupancyShare: safePercent(roomNights, availableRoomNights),
        guestRate: guests ? revenue / guests : 0,
        share: safePercent(revenue, lodgingRevenue),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

function buildAgents(state: State, range: ReportRange, roomNights: number, availableRoomNights: number): AgentReportRow[] {
  const totals = new Map<string, number>()
  state.advances
    .filter((advance) => dateInRange(advance.date, range))
    .forEach((advance) => totals.set(advance.receivedBy, (totals.get(advance.receivedBy) ?? 0) + advance.amount))
  state.cashCloses
    .filter((close) => dateInRange(close.closedAt ?? close.openedAt, range))
    .forEach((close) => totals.set(close.user, (totals.get(close.user) ?? 0) + close.cash + close.card + close.transfer + close.deposit + close.other))

  const defaultTarget = Math.max(1, Math.round(availableRoomNights * 0.65))
  const rows = Array.from(totals.entries()).map(([agent, amount]) => ({
    agent,
    target: defaultTarget,
    projected: defaultTarget,
    executed: amount,
    percent: safePercent(amount, Math.max(1, sum(Array.from(totals.values()), (value) => value))),
  }))

  if (rows.length === 0) {
    rows.push({
      agent: "Habitaciones vendidas",
      target: defaultTarget,
      projected: defaultTarget,
      executed: roomNights,
      percent: safePercent(roomNights, defaultTarget),
    })
  }

  return rows.sort((a, b) => b.executed - a.executed)
}

function buildBreakfastRows(state: State, range: ReportRange): BreakfastReportRow[] {
  return state.breakfastOptions.map((option) => {
    const vouchers = state.breakfasts.filter((voucher) => voucher.type === option.id && dateInRange(voucher.date, range))
    const redeemed = vouchers.filter((voucher) => voucher.redeemed)
    const issued = vouchers.length
    const cost = sum(redeemed, () => breakfastCostByType[option.id] ?? 22)
    const retailValue = sum(vouchers, () => breakfastRetailByType[option.id] ?? 50)

    return {
      label: option.label,
      issued,
      redeemed: redeemed.length,
      cost,
      retailValue,
      profitImpact: retailValue - cost,
    }
  })
}

function buildInventoryProfitRows(state: State, range: ReportRange): InventoryProfitRow[] {
  const rows: InventoryProfitRow[] = []

  ;(["snack", "blanco", "suministro"] as InventoryCategory[]).forEach((category) => {
    const movements = state.inventoryMovements.filter((movement) => {
      const item = itemForMovement(state, movement.itemId)
      return item?.category === category && dateInRange(movement.date, range)
    })
    const revenue = sum(movements, (movement) => {
      const item = itemForMovement(state, movement.itemId)
      return category === "snack" && movement.type === "consumo" ? Math.abs(movement.qty) * (item?.price ?? 0) : 0
    })
    const cost = sum(movements, (movement) => {
      const item = itemForMovement(state, movement.itemId)
      const isCostMovement =
        movement.type === "consumo" ||
        movement.type === "salida" ||
        (movement.type === "ajuste" && movement.qty < 0)
      return isCostMovement ? Math.abs(movement.qty) * (item?.cost ?? 0) : 0
    })
    const units = sum(movements, (movement) => Math.abs(movement.qty))

    rows.push({
      category,
      label:
        category === "snack"
          ? "Snacks y minibar"
          : category === "blanco"
            ? "Blancos y mobiliario"
            : "Suministros",
      revenue,
      cost,
      profit: revenue - cost,
      units,
    })
  })

  return rows
}

function buildEventRows(state: State, range: ReportRange): EventProfitRow[] {
  return state.events
    .filter((event) => event.status !== "cancelado" && dateInRange(event.date, range))
    .map((event) => {
      const estimatedCost = eventCost(event)
      const profit = event.total - estimatedCost
      return {
        title: event.title,
        client: event.client,
        salon: event.salon,
        type: event.type,
        revenue: event.total,
        estimatedCost,
        profit,
        margin: safePercent(profit, event.total),
      }
    })
}

function buildAdjustmentRows(): AdjustmentRow[] {
  return [
    { setting: "Dia", value: "Lunes" },
    { setting: "Dia", value: "Martes" },
    { setting: "Dia", value: "Miercoles" },
    { setting: "Dia", value: "Jueves" },
    { setting: "Dia", value: "Viernes" },
    { setting: "Dia", value: "Sabado" },
    { setting: "Dia", value: "Domingo" },
    { setting: "Moneda", value: "GTQ" },
    { setting: "Pais", value: "GT" },
    { setting: "Version de reporte", value: "Casa Luna utilidad v2" },
  ]
}

function buildAccountingIncomeRows(state: State, range: ReportRange): AccountingIncomeRow[] {
  const rows: AccountingIncomeRow[] = []

  state.invoices
    .filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range))
    .forEach((invoice) => {
      const reservation = invoice.reservationId
        ? state.reservations.find((item) => item.id === invoice.reservationId)
        : undefined
      const room = reservation ? state.rooms.find((item) => item.id === reservation.roomId) : undefined

      rows.push({
        date: invoice.date,
        user: "Facturacion",
        account: `${invoice.serie}-${invoice.number}`,
        receipt: invoice.uuid ?? invoice.id,
        customer: invoice.customer,
        description: invoice.items.map((item) => item.description).join("; "),
        type: "PAGO",
        subtype: "Factura",
        amount: invoice.total,
        currency: "GTQ",
        country: "GT",
        rooms: room?.number ?? "",
      })
    })

  state.advances
    .filter((advance) => dateInRange(advance.date, range))
    .forEach((advance) => {
      const reservation = state.reservations.find((item) => item.id === advance.reservationId)
      const room = reservation ? state.rooms.find((item) => item.id === reservation.roomId) : undefined
      const guest = reservation ? state.guests.find((item) => item.id === reservation.guestId) : undefined

      rows.push({
        date: advance.date,
        user: advance.receivedBy,
        account: reservation?.code ?? advance.reservationId,
        receipt: advance.id,
        customer: guest?.name ?? "Huesped",
        description: advance.notes ?? "PAGO ANTICIPO",
        type: "PAGO",
        subtype: advance.method,
        amount: advance.amount,
        currency: "GTQ",
        country: guest?.country ?? "GT",
        rooms: room?.number ?? "",
      })
    })

  state.reservations.forEach((reservation) => {
    const guest = state.guests.find((item) => item.id === reservation.guestId)
    const room = state.rooms.find((item) => item.id === reservation.roomId)

    reservation.payments
      ?.filter((payment) => dateInRange(payment.date, range))
      .forEach((payment) => {
        rows.push({
          date: payment.date,
          user: "Recepcion",
          account: reservation.code,
          receipt: payment.id,
          customer: guest?.name ?? "Huesped",
          description: payment.reference ?? `PAGO ${payment.stage.toUpperCase()}`,
          type: "PAGO",
          subtype: payment.method,
          amount: payment.amount,
          currency: "GTQ",
          country: guest?.country ?? "GT",
          rooms: room?.number ?? "",
        })
      })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

function buildAccountingPaymentSummaryRows(
  state: State,
  range: ReportRange,
  accountingIncome: AccountingIncomeRow[],
): AccountingPaymentSummaryRow[] {
  const closes = state.cashCloses.filter((close) => dateInRange(close.closedAt ?? close.openedAt, range))
  const closeTotals = {
    cash: sum(closes, (close) => close.cash),
    card: sum(closes, (close) => close.card),
    transfer: sum(closes, (close) => close.transfer),
    deposit: sum(closes, (close) => close.deposit),
    other: sum(closes, (close) => close.other),
  }
  const fallbackTotals = {
    cash: sum(accountingIncome.filter((row) => paymentBucket(row.subtype) === "cash"), (row) => row.amount),
    card: sum(accountingIncome.filter((row) => paymentBucket(row.subtype) === "card"), (row) => row.amount),
    transfer: sum(accountingIncome.filter((row) => paymentBucket(row.subtype) === "transfer"), (row) => row.amount),
    deposit: sum(accountingIncome.filter((row) => paymentBucket(row.subtype) === "deposit"), (row) => row.amount),
    other: sum(accountingIncome.filter((row) => paymentBucket(row.subtype) === "other"), (row) => row.amount),
  }
  const totals = {
    cash: closeTotals.cash || fallbackTotals.cash,
    card: closeTotals.card || fallbackTotals.card,
    transfer: closeTotals.transfer || fallbackTotals.transfer,
    deposit: closeTotals.deposit || fallbackTotals.deposit,
    other: closeTotals.other || fallbackTotals.other,
  }

  return [
    paymentSummaryRow("CASH", "", totals.cash),
    paymentSummaryRow("CC", "Tarjeta", totals.card),
    paymentSummaryRow("TR", "", totals.transfer),
    paymentSummaryRow("DEP", "", totals.deposit),
    paymentSummaryRow("OTRO", "", totals.other),
  ].filter((row) => row.amount !== 0)
}

function buildAccountingTotalRows(rows: AccountingPaymentSummaryRow[]): AccountingTotalRow[] {
  const cash = sum(rows.filter((row) => row.type === "CASH"), (row) => row.amount)
  const card = sum(rows.filter((row) => row.type === "CC"), (row) => row.amount)
  const transferOther = sum(rows.filter((row) => !["CASH", "CC"].includes(row.type)), (row) => row.amount)
  const local = cash + card + transferOther

  return [
    { label: "Efectivo", amount: cash },
    { label: "Tarjetas de credito", amount: card },
    { label: "Transferencias, depositos y otros", amount: transferOther },
    { label: "Moneda local", amount: local },
  ]
}

function buildAccountingFilterRows(range: ReportRange): AccountingFilterRow[] {
  return [
    { label: "Canales de ventas", value: "Todos" },
    { label: "Fechas", value: `${range.from} - ${range.to}` },
    { label: "Tipo de informe", value: "Todo" },
    { label: "Rep-Version", value: "CasaLuna-2026.05" },
  ]
}

function paymentSummaryRow(type: string, subtype: string, amount: number): AccountingPaymentSummaryRow {
  return {
    type,
    subtype,
    amount,
    currency: "GTQ",
    localLabel: `Locales: ${amount.toFixed(2)}`,
  }
}

function paymentBucket(method: string) {
  const text = normalizeText(method)
  if (/efectivo|cash/.test(text)) return "cash"
  if (/tarjeta|visa|card|cc/.test(text)) return "card"
  if (/transfer|tr/.test(text)) return "transfer"
  if (/deposit/.test(text)) return "deposit"
  return "other"
}

function buildRoomRevenueRows(
  state: State,
  reservations: Reservation[],
  range: ReportRange,
  availableRoomNights: number,
): RoomRevenueRow[] {
  return state.rooms.map((room) => {
    const roomReservations = reservations.filter((reservation) => reservation.roomId === room.id)
    const roomNights = sum(roomReservations, (reservation) => reservationNightsInRange(reservation, range))
    const revenue = sum(roomReservations, (reservation) => reservationRevenueInRange(reservation, range))
    const guests = sum(roomReservations, (reservation) => Math.max(1, reservation.adults + reservation.children))
    const roomType = state.roomTypes.find((type) => type.id === room.typeId)

    return {
      room: room.number,
      roomType: roomType?.name ?? room.typeId,
      roomNights,
      guests,
      revenue,
      adr: roomNights ? revenue / roomNights : 0,
      occupancyShare: safePercent(roomNights, availableRoomNights),
    }
  })
}

function buildCurrentAccountLegacyRows(
  state: State,
  reservations: Reservation[],
  range: ReportRange,
): CurrentAccountLegacyRow[] {
  return state.creditAccounts.map((account) => {
    const accountReservations = reservations.filter((reservation) => {
      const guest = state.guests.find((item) => item.id === reservation.guestId)
      return (
        reservation.source === "corporativo" ||
        reservation.guestId === account.guestId ||
        guest?.name.toLowerCase() === account.company.toLowerCase()
      )
    })
    const roomNights = sum(accountReservations, (reservation) => reservationNightsInRange(reservation, range))
    const personNights = sum(accountReservations, (reservation) =>
      reservationNightsInRange(reservation, range) * Math.max(1, reservation.adults + reservation.children),
    )
    const lodgingCharge = sum(accountReservations, (reservation) => reservationRevenueInRange(reservation, range))
    const accountMovements = state.creditMovements.filter(
      (movement) => movement.accountId === account.id && dateInRange(movement.date, range),
    )
    const otherCharges = Math.max(0, sum(accountMovements, (movement) => movement.charge) - lodgingCharge)

    return {
      account: account.id,
      name: account.company,
      roomNights,
      personNights,
      reservations: accountReservations.length,
      lodgingCharge,
      otherCharges,
    }
  })
}

function buildDailyStateRows(
  state: State,
  range: ReportRange,
  daily: DailyReportRow[],
  reservations: Reservation[],
): DailyStateMetricRow[] {
  const selectedDay = daily.find((row) => row.date === range.to) ?? daily[daily.length - 1]
  const periodRoomNights = sum(daily, (row) => row.roomNights)
  const periodGuests = sum(daily, (row) => row.guests)
  const periodRevenue = sum(daily, (row) => row.revenue)
  const available = state.rooms.length * range.days.length
  const creditReservations = reservations.filter((reservation) => reservation.source === "corporativo")
  const creditRoomNights = sum(creditReservations, (reservation) => reservationNightsInRange(reservation, range))
  const dayUseRevenue = sum(
    state.invoices.filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range)),
    (invoice) =>
      sum(invoice.items, (item) =>
        /day use|uso diario/i.test(item.description) ? item.total : 0,
      ),
  )

  return [
    {
      metric: "Total de habitaciones",
      scope: "Hotel",
      selectedDay: state.rooms.length,
      period: state.rooms.length,
      yearToDate: state.rooms.length,
      kind: "number",
    },
    {
      metric: "Habitaciones reservadas",
      scope: "Todo",
      selectedDay: selectedDay?.roomNights ?? 0,
      period: periodRoomNights,
      yearToDate: periodRoomNights,
      kind: "number",
    },
    {
      metric: "% de ocupacion / total habitaciones",
      scope: "Hotel",
      selectedDay: selectedDay?.occupancy ?? 0,
      period: safePercent(periodRoomNights, available),
      yearToDate: safePercent(periodRoomNights, available),
      kind: "percent",
    },
    {
      metric: "Habitaciones reservadas",
      scope: "Cuentas corrientes y empresas",
      selectedDay: 0,
      period: creditRoomNights,
      yearToDate: creditRoomNights,
      kind: "number",
    },
    {
      metric: "Numero de huespedes",
      scope: "Todo",
      selectedDay: selectedDay?.guests ?? 0,
      period: periodGuests,
      yearToDate: periodGuests,
      kind: "number",
    },
    {
      metric: "Ingresos de habitacion en moneda local",
      scope: "Sin incluir day use",
      selectedDay: selectedDay?.revenue ?? 0,
      period: periodRevenue,
      yearToDate: periodRevenue,
      kind: "money",
    },
    {
      metric: "Promedio",
      scope: "Huesped",
      selectedDay: selectedDay?.guests ? (selectedDay.revenue / selectedDay.guests) : 0,
      period: periodGuests ? periodRevenue / periodGuests : 0,
      yearToDate: periodGuests ? periodRevenue / periodGuests : 0,
      kind: "money",
    },
    {
      metric: "Promedio",
      scope: "Habitacion",
      selectedDay: selectedDay?.adr ?? 0,
      period: periodRoomNights ? periodRevenue / periodRoomNights : 0,
      yearToDate: periodRoomNights ? periodRevenue / periodRoomNights : 0,
      kind: "money",
    },
    {
      metric: "Ingresos de habitacion en moneda local",
      scope: "Uso diario",
      selectedDay: 0,
      period: dayUseRevenue,
      yearToDate: dayUseRevenue,
      kind: "money",
    },
  ]
}

function buildWeekdaySalesRows(daily: DailyReportRow[]): WeekdaySalesRow[] {
  const byWeekday = new Map<string, number>()
  daily.forEach((row) => {
    byWeekday.set(row.weekday, (byWeekday.get(row.weekday) ?? 0) + row.roomNights)
  })
  const total = sum(Array.from(byWeekday.values()), (value) => value)
  const order = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

  return Array.from(byWeekday.entries())
    .map(([weekday, roomNights]) => ({ weekday, roomNights, share: safePercent(roomNights, total) }))
    .sort((a, b) => order.indexOf(normalizeText(a.weekday)) - order.indexOf(normalizeText(b.weekday)))
}

function buildPromotionRows(reservations: Reservation[], range: ReportRange): PromotionRow[] {
  const promoReservations = reservations.filter((reservation) => /promo|descuento|oferta/i.test(reservation.notes ?? ""))
  const jrSuiteReservations = reservations.filter((reservation) => /jr|suite/i.test(reservation.notes ?? ""))
  const promoBase = promoReservations.length ? promoReservations : jrSuiteReservations
  const roomsSold = sum(promoBase, (reservation) => reservationNightsInRange(reservation, range))
  const revenue = sum(promoBase, (reservation) => reservationRevenueInRange(reservation, range))

  return [
    {
      name: "Promocion del periodo",
      description: "Promociones o descuentos registrados en notas de reservacion.",
      roomsSold,
      discountRate: 10,
      estimatedImpact: revenue * 0.1,
    },
  ]
}

function buildForecastRows(state: State, range: ReportRange): ForecastReportRow[] {
  const forecastDays = Math.min(31, Math.max(14, range.days.length))
  const forecastRange = createReportRange(addDaysIso(range.to, 1), addDaysIso(range.to, forecastDays), "rango")

  return buildDailyRows(state, forecastRange).map((row) => ({
    ...row,
    hotel: "Casa Luna",
    kind: "Pronostico",
  }))
}

function buildUtilityBreakdownRows(profitCenters: ProfitCenter[]): UtilityBreakdownRow[] {
  const rows = profitCenters.map((center) => ({
    area: center.name,
    grossProfit: center.grossProfit,
    iva: center.iva,
    isr: center.isr,
    inguat: center.inguat,
    netProfit: center.netProfit,
  }))

  rows.push({
    area: "Total",
    grossProfit: sum(profitCenters, (center) => center.grossProfit),
    iva: sum(profitCenters, (center) => center.iva),
    isr: sum(profitCenters, (center) => center.isr),
    inguat: sum(profitCenters, (center) => center.inguat),
    netProfit: sum(profitCenters, (center) => center.netProfit),
  })

  return rows
}

function buildRestaurantRows(state: State, range: ReportRange, breakfastRetailValue: number): RestaurantProfitRow[] {
  const restaurantInvoiceSales = sum(
    state.invoices.filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range)),
    (invoice) =>
      sum(invoice.items, (item) =>
        /restaurante|parmigiano|platillo|almuerzo|cena|comida|bebida/i.test(item.description)
          ? item.total
          : 0,
      ),
  )
  const restaurantCost = restaurantInvoiceSales * 0.44
  const breakfastCost = sum(
    state.breakfasts.filter((voucher) => voucher.redeemed && dateInRange(voucher.date, range)),
    (voucher) => breakfastCostByType[voucher.type] ?? 22,
  )

  return [
    {
      name: "Parmigiano / Restaurante",
      sales: restaurantInvoiceSales,
      cost: restaurantCost,
      grossProfit: restaurantInvoiceSales - restaurantCost,
      margin: safePercent(restaurantInvoiceSales - restaurantCost, restaurantInvoiceSales),
      source: "Facturas con conceptos de restaurante, platillos o bebidas",
    },
    {
      name: "Desayunos de cortesia",
      sales: breakfastRetailValue,
      cost: breakfastCost,
      grossProfit: breakfastRetailValue - breakfastCost,
      margin: safePercent(breakfastRetailValue - breakfastCost, breakfastRetailValue),
      source: "Valor operativo de desayunos incluidos",
    },
  ]
}

function buildRestaurantSummaryRows(rows: RestaurantProfitRow[]): RestaurantSummaryRow[] {
  const breakfast = rows.filter((row) => /desayuno/i.test(row.name))
  const extras = rows.filter((row) => !/desayuno/i.test(row.name))
  const breakfastSales = sum(breakfast, (row) => row.sales)
  const breakfastCost = sum(breakfast, (row) => row.cost)
  const extrasSales = sum(extras, (row) => row.sales)
  const extrasCost = sum(extras, (row) => row.cost)

  const result = [
    restaurantSummaryRow("Desayunos", breakfastSales, breakfastCost),
    restaurantSummaryRow("Extras / restaurante", extrasSales, extrasCost),
  ]
  const totalSales = sum(result, (row) => row.sales)
  const totalCost = sum(result, (row) => row.cost)

  result.push(restaurantSummaryRow("Total", totalSales, totalCost))
  return result
}

function restaurantSummaryRow(area: string, sales: number, cost: number): RestaurantSummaryRow {
  const profit = sales - cost

  return {
    area,
    sales,
    cost,
    profit,
    margin: safePercent(profit, sales),
  }
}

function buildBreakfastOccupancyRows(
  breakfast: BreakfastReportRow[],
  roomNights: number,
  guests: number,
): BreakfastOccupancyAnalysisRow[] {
  const platesSold = sum(breakfast, (row) => row.redeemed)

  return [
    {
      category: "Habitaciones",
      quantity: roomNights,
      platesSold,
      share: safePercent(platesSold, roomNights),
    },
    {
      category: "Personas",
      quantity: guests,
      platesSold,
      share: safePercent(platesSold, guests),
    },
  ]
}

function buildLegacySummaryRows({
  range,
  daily,
  roomNights,
  guests,
  totalRevenue,
  occupancy,
  netProfit,
  bestWeekday,
  bestWeekdayRoomNights,
  accountingTotal,
}: {
  range: ReportRange
  daily: DailyReportRow[]
  roomNights: number
  guests: number
  totalRevenue: number
  occupancy: number
  netProfit: number
  bestWeekday: string
  bestWeekdayRoomNights: number
  accountingTotal: number
}): LegacySummaryRow[] {
  const selectedDay = daily[daily.length - 1]
  const averageRooms = range.days.length ? roomNights / range.days.length : 0

  return [
    {
      section: "Venta acumulada",
      indicator: "Total de habitaciones",
      value: roomNights,
      kind: "number",
      helper: `${range.days.length} dia(s) del periodo`,
    },
    {
      section: "Venta acumulada",
      indicator: "Ingreso total",
      value: totalRevenue,
      kind: "money",
      helper: "Alojamiento y centros de ingreso reconocidos",
    },
    {
      section: "Venta acumulada",
      indicator: "Promedio habitaciones / dia",
      value: averageRooms,
      kind: "number",
      helper: "Promedio de habitaciones vendidas por dia",
    },
    {
      section: "Dias mas vendidos",
      indicator: labelForWeekday(bestWeekday),
      value: bestWeekdayRoomNights,
      kind: "number",
      helper: "Habitaciones-noche del dia con mas venta",
    },
    {
      section: "Seleccione dia",
      indicator: selectedDay?.label ?? range.to,
      value: selectedDay?.roomNights ?? 0,
      kind: "number",
      helper: `Ocupacion del dia ${formatPercentNumber(selectedDay?.occupancy ?? 0)}`,
    },
    {
      section: "Ocupacion",
      indicator: "% de ocupacion",
      value: occupancy,
      kind: "percent",
      helper: `${roomNights} habitaciones-noche vendidas`,
    },
    {
      section: "Huespedes",
      indicator: "Numero de huespedes",
      value: guests,
      kind: "number",
      helper: "Personas-noche del periodo",
    },
    {
      section: "Contabilidad",
      indicator: "Moneda local cobrada",
      value: accountingTotal,
      kind: "money",
      helper: "Efectivo, tarjeta, transferencia, depositos y otros",
    },
    {
      section: "Utilidad",
      indicator: "Utilidad neta",
      value: netProfit,
      kind: "money",
      helper: "Despues de costos, gastos e impuestos",
    },
  ]
}

function buildMinibarProductRows(state: State, range: ReportRange): MinibarProductProfitRow[] {
  return state.inventory
    .filter((item) => item.category === "snack")
    .map((item) => {
      const movements = state.inventoryMovements.filter(
        (movement) =>
          movement.itemId === item.id &&
          movement.type === "consumo" &&
          dateInRange(movement.date, range),
      )
      const units = sum(movements, (movement) => Math.abs(movement.qty))
      const sale = units * (item.price ?? 0)
      const cost = units * item.cost
      const grossProfit = sale - cost
      const iva = ivaIncluded(sale)
      const isr = Math.max(0, grossProfit - iva) * ISR_RATE

      return {
        sku: item.sku,
        product: item.name,
        units,
        sale,
        cost,
        grossProfit,
        iva,
        isr,
        netProfit: grossProfit - iva - isr,
      }
    })
}

function buildOccupancyMatrixRows(daily: DailyReportRow[], roomCount: number): OccupancyMatrixRow[] {
  return Array.from({ length: roomCount }, (_, index) => {
    const level = roomCount - index
    const values = daily.map((day) => (day.roomNights >= level ? 1 : 0))
    return {
      level,
      values,
      total: sum(values, (value) => value),
    }
  })
}

function buildMetadataRows(range: ReportRange): ReportMetadataRow[] {
  return [
    { label: "Hotel", value: "Casa Luna" },
    { label: "Tipo de informe", value: "Reporte hotelero de utilidad" },
    { label: "Periodo", value: `${range.from} - ${range.to}` },
    { label: "Moneda", value: "GTQ" },
    { label: "Pais", value: "GT" },
    { label: "Rep-Version", value: "CasaLuna-2026.05" },
  ]
}

function invoiceOtherChargeRevenue(state: State, range: ReportRange) {
  return sum(
    state.invoices.filter((invoice) => invoice.status !== "anulada" && dateInRange(invoice.date, range)),
    (invoice) =>
      sum(invoice.items, (item) => {
        const text = item.description.toLowerCase()
        if (/(hosped|habitaci|alojamiento|salon|evento|desayuno|minibar|snack|consumo|restaurante|parmigiano|platillo|almuerzo|cena|comida|bebida)/.test(text)) {
          return 0
        }
        return item.total
      }),
  )
}

function reservationNightsInRange(reservation: Reservation, range: ReportRange) {
  return range.days.filter((day) => reservation.checkIn <= day && reservation.checkOut > day).length
}

function reservationRevenueInRange(reservation: Reservation, range: ReportRange) {
  const nights = reservationNightsInRange(reservation, range)
  if (nights === 0) return 0
  if (reservation.rate > 0) return nights * reservation.rate
  return reservation.nights ? (reservation.total / reservation.nights) * nights : reservation.total
}

function reservationOverlapsRange(reservation: Reservation, range: ReportRange) {
  return reservation.checkIn <= range.to && reservation.checkOut >= range.from
}

function dateInRange(value: string | undefined, range: ReportRange) {
  const date = normalizeIsoDate(value)
  return Boolean(date && date >= range.from && date <= range.to)
}

function normalizeIsoDate(value: string | undefined) {
  const text = String(value ?? "").trim()
  if (!text) return undefined
  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? undefined : isoDate(parsed)
}

function roomNightCost(roomTypeName: string) {
  return roomNightCostByType.find((entry) => entry.match.test(roomTypeName))?.cost ?? 105
}

function eventCost(event: HotelEvent) {
  if (event.type === "consumo") return event.total * 0.45
  if (event.type === "alquiler") return 75 + event.guests * 8
  if (event.clientKind === "huesped" && event.total === 0) return event.guests * 12
  return event.total * 0.15
}

function itemForMovement(state: State, itemId: string): InventoryItem | undefined {
  return state.inventory.find((item) => item.id === itemId)
}

function channelCode(channel: string) {
  const text = normalizeText(channel)
  if (text.includes("booking")) return "BOOKING"
  if (text.includes("expedia")) return "EXPEDIA"
  if (text.includes("airbnb")) return "AIRBNB"
  if (text.includes("agencia")) return "AGENCIA"
  if (text.includes("corporativo")) return "CORP"
  if (text.includes("directo")) return "DIRECTO"
  return "*OTHERS"
}

function ivaIncluded(gross: number) {
  return gross > 0 ? gross - gross / (1 + IVA_RATE) : 0
}

function bestWeekday(daily: DailyReportRow[]) {
  const byWeekday = new Map<string, number>()
  daily.forEach((row) => byWeekday.set(row.weekday, (byWeekday.get(row.weekday) ?? 0) + row.roomNights))
  const [weekday = "Sin datos", roomNights = 0] = Array.from(byWeekday.entries()).sort((a, b) => b[1] - a[1])[0] ?? []
  return { weekday, roomNights }
}

function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { weekday: "long" }).format(new Date(`${iso}T00:00:00`))
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(new Date(`${iso}T00:00:00`))
}

function formatPercentNumber(value: number) {
  return `${Math.round(value)}%`
}

function labelForWeekday(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + Number(pick(item) || 0), 0)
}

function safePercent(value: number, total: number) {
  return total ? (value / total) * 100 : 0
}
