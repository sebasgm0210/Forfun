import { useCallback, useEffect, useMemo, useState } from "react"
import { Banknote, Calculator, ClipboardCheck, Printer, Save, Send } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EndpointPanel, FieldGrid, MiniTable, MoneyInput, QuickGuide, SectionCard, StatCard, money } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { getSessionUser } from "@/lib/auth"
import { formatDate, useStore } from "@/lib/store"
import type { Advance, PaymentMethod, PaymentRecord, Reservation } from "@/lib/types"
import { exportCurrentView } from "@/lib/view-export"

type ChecklistKey = "cash" | "card" | "transfer" | "invoices" | "categories" | "notes"
type CategoryKey =
  | "lodging"
  | "advances"
  | "minibar"
  | "linenDamage"
  | "events"
  | "creditPayments"
  | "unbilledConsumptions"
  | "other"

type CloseForm = {
  closeId: string
  countedCash: number
  countedCard: number
  countedTransfer: number
  countedDeposit: number
  other: number
  otherPaymentMethod: PaymentMethodKey
  posClosure: string
  transferReferences: string
  depositReferences: string
  unbilledDetails: string
  notes: string
}

type CloseShift = "matutino" | "vespertino" | "nocturno"

const shiftSchedules: Record<CloseShift, { label: string; time: string; handoff: string }> = {
  matutino: {
    label: "Turno mañana",
    time: "06:00 a 14:00",
    handoff: "Debe quedar cerrado antes de entregar caja al turno de tarde.",
  },
  vespertino: {
    label: "Turno tarde",
    time: "14:00 a 22:00",
    handoff: "Debe quedar cerrado antes de entregar caja al turno de noche.",
  },
  nocturno: {
    label: "Turno noche",
    time: "22:00 a 06:00 del día siguiente",
    handoff: "Debe quedar cerrado antes de entregar caja al turno de mañana.",
  },
}

const categoryLabels: Record<CategoryKey, string> = {
  lodging: "Hospedaje / saldo check-out",
  advances: "Anticipos recibidos",
  minibar: "Minibar / snacks",
  linenDamage: "Daños blancos y mobiliario",
  events: "Eventos",
  creditPayments: "Abonos a crédito",
  unbilledConsumptions: "Consumos sin factura",
  other: "Otros (casos especiales)",
}

const emptyCategories: Record<CategoryKey, number> = {
  lodging: 0,
  advances: 0,
  minibar: 0,
  linenDamage: 0,
  events: 0,
  creditPayments: 0,
  unbilledConsumptions: 0,
  other: 0,
}

const checklistLabels: Record<ChecklistKey, string> = {
  cash: "Efectivo contado",
  card: "POS/tarjeta revisado",
  transfer: "Transferencias y depósitos revisados",
  invoices: "Facturas del turno revisadas",
  categories: "Rubros contables revisados",
  notes: "Observaciones agregadas si hay diferencia",
}

const initialChecklist: Record<ChecklistKey, boolean> = {
  cash: false,
  card: false,
  transfer: false,
  invoices: false,
  categories: false,
  notes: false,
}

type CashShiftSummary = {
  shiftId: string
  configId: string
  shiftName: string
  assignedUserId: string
  assignedUserName: string | null
  startAt: string
  endAt: string
  paymentMethods: Record<PaymentMethodKey, number>
  rubrics: Record<CategoryKey, number>
  checklist: Record<ChecklistKey, boolean>
  systemTotal: number
  rubricTotal: number
  manualEntries: Array<{
    id: string
    description: string
    amount: number
    paymentMethod: string
    reference: string
  }>
}

type ShiftConfigAssignment = {
  configId: string
  shiftKey: CloseShift
  shiftName: string
  startTime: string
  endTime: string
  userId: string
  userName: string | null
}

type ShiftUserOption = {
  id: string
  name: string
}

function apiRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function apiArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const source = apiRecord(value)
  return Array.isArray(source.data) ? source.data : []
}

function apiText(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
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

function apiNestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = apiRecord(record[key])
    if (Object.keys(value).length > 0) return value
  }

  return {}
}

function personNameFromNestedUser(record: Record<string, unknown>) {
  const names = apiText(record, ["names", "first_name", "firstName"], "")
  const lastnames = apiText(record, ["lastnames", "last_name", "lastName", "lastname"], "")
  const fullName = `${names} ${lastnames}`.trim()

  return (
    fullName ||
    apiText(record, ["full_name", "fullName", "display_name", "displayName", "name", "user_name", "username", "email"], "")
  )
}

function assignedUserFromRecord(record: Record<string, unknown>) {
  const nestedUser = apiNestedRecord(record, ["assigned_user", "assignedUser", "user", "responsible", "encargado"])
  const id =
    apiText(record, ["id_user", "user_id", "idUser", "assigned_user_id", "assignedUserId", "responsible_user_id", "encargado_id"]) ||
    apiText(nestedUser, ["id_user", "user_id", "idUser", "id"])
  const name =
    apiText(record, ["assigned_user_name", "assignedUserName", "user_name", "userName", "responsible_name", "encargado_nombre"]) ||
    personNameFromNestedUser(nestedUser) ||
    apiText(record, ["assigned_user", "assignedUser", "user", "responsible", "encargado"])

  return {
    id,
    name: name || null,
  }
}

function cleanShiftName(value: string) {
  return value
    .replace(/ma\?\?ana/gi, "mañana")
    .replace(/ma\uFFFDana/gi, "mañana")
    .replace(/ma\u00C3\u00B1ana/gi, "mañana")
    .replace(/\bma[nñ]ana\b/gi, "mañana")
}

function shiftKeyFromName(value: string): CloseShift {
  const normalized = normalizeText(cleanShiftName(value))

  if (normalized.includes("tarde") || normalized.includes("vespertino")) return "vespertino"
  if (normalized.includes("noche") || normalized.includes("nocturno")) return "nocturno"
  return "matutino"
}

function mapShiftConfigAssignment(item: unknown): ShiftConfigAssignment | null {
  const record = apiRecord(item)
  const configId = apiText(record, ["id_cash_shift_config", "id_shift_config", "cash_shift_config_id", "shift_config_id", "id"])
  if (!configId) return null

  const shiftName = cleanShiftName(apiText(record, ["shift_name", "name", "shift"], "Turno"))
  const assignedUser = assignedUserFromRecord(record)

  return {
    configId,
    shiftKey: shiftKeyFromName(shiftName),
    shiftName,
    startTime: apiText(record, ["start_time", "startTime"]),
    endTime: apiText(record, ["end_time", "endTime"]),
    userId: assignedUser.id,
    userName: assignedUser.name,
  }
}

function mapShiftUserOption(item: unknown): ShiftUserOption | null {
  const record = apiRecord(item)
  const id = apiText(record, ["id_user", "user_id", "id"])
  if (!id) return null

  const name = personNameFromNestedUser(record) || `Usuario ${id}`

  return { id, name }
}

function mapCashShiftSummary(value: unknown): CashShiftSummary | null {
  const summary = apiRecord(value)
  const nestedShift = apiRecord(summary.shift)
  const shift = Object.keys(nestedShift).length > 0 ? nestedShift : summary
  const methods = Object.keys(apiRecord(summary.payment_methods)).length > 0
    ? apiRecord(summary.payment_methods)
    : apiRecord(summary.paymentMethods)
  const rubrics = apiRecord(summary.rubrics)
  const shiftId = apiText(shift, ["id_cash_shift", "id"])
  if (!shiftId) return null
  const assignedUser = assignedUserFromRecord(shift)

  const checklistByKey = new Map(
    apiArray(summary.checklist).map((value) => {
      const item = apiRecord(value)
      return [
        apiText(item, ["item_key"]),
        Boolean(item.is_checked),
      ] as const
    }),
  )

  return {
    shiftId,
    configId: apiText(shift, ["id_cash_shift_config", "id_shift_config", "cash_shift_config_id", "shift_config_id"]),
    shiftName: cleanShiftName(apiText(shift, ["shift_name", "name"], "Turno")),
    assignedUserId: assignedUser.id,
    assignedUserName: assignedUser.name,
    startAt: apiText(shift, ["start_at", "opened_at"]),
    endAt: apiText(shift, ["end_at", "closed_at"]),
    paymentMethods: {
      cash: apiNumber(methods, ["cash"]),
      card: apiNumber(methods, ["card"]),
      transfer: apiNumber(methods, ["transfer"]),
      deposit: apiNumber(methods, ["deposit"]),
    },
    rubrics: {
      lodging: apiNumber(rubrics, ["hospedaje"]),
      advances: apiNumber(rubrics, ["anticipos"]),
      minibar: apiNumber(rubrics, ["minibar_snacks"]),
      linenDamage: apiNumber(rubrics, ["danos_inmobiliario"]),
      events: apiNumber(rubrics, ["eventos"]),
      creditPayments: apiNumber(rubrics, ["abonos_credito"]),
      unbilledConsumptions: apiNumber(rubrics, ["consumos_sin_factura"]),
      other: apiNumber(rubrics, ["otros"]),
    },
    checklist: {
      cash: checklistByKey.get("cash_counted") ?? false,
      card: checklistByKey.get("pos_card_reviewed") ?? false,
      transfer: checklistByKey.get("transfers_deposits_reviewed") ?? false,
      invoices: checklistByKey.get("invoices_reviewed") ?? false,
      categories: checklistByKey.get("accounting_rubrics_reviewed") ?? false,
      notes: checklistByKey.get("observations_added_if_difference") ?? false,
    },
    systemTotal: apiNumber(apiRecord(summary.totals), ["system_total", "total_income"]),
    rubricTotal: apiNumber(apiRecord(summary.totals), ["rubric_total"]),
    manualEntries: apiArray(summary.manual_entries).map((value) => {
      const entry = apiRecord(value)
      return {
        id: apiText(entry, ["id_cash_manual_entry", "id_manual_entry", "id"]),
        description: apiText(entry, ["description", "concept"], "Movimiento manual"),
        amount: apiNumber(entry, ["amount"]),
        paymentMethod: apiText(entry, ["payment_method"]),
        reference: apiText(entry, ["reference"]),
      }
    }),
  }
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

type PaymentMethodKey = "cash" | "card" | "transfer" | "deposit"

const emptyMethodTotals: Record<PaymentMethodKey, number> = {
  cash: 0,
  card: 0,
  transfer: 0,
  deposit: 0,
}

const methodLabels: Record<PaymentMethodKey, string> = {
  cash: "Efectivo",
  card: "Tarjeta / POS",
  transfer: "Transferencia",
  deposit: "Deposito",
}

const methodPayloads: Record<PaymentMethodKey, string> = {
  cash: "efectivo",
  card: "tarjeta",
  transfer: "transferencia",
  deposit: "deposito",
}

function paymentMethodKey(method: PaymentMethod): PaymentMethodKey | null {
  if (method === "efectivo") return "cash"
  if (method === "tarjeta") return "card"
  if (method === "transferencia") return "transfer"
  if (method === "deposito") return "deposit"
  return null
}

function paymentFingerprint(reservationId: string, payment: PaymentRecord) {
  return [
    reservationId,
    payment.method,
    payment.amount,
    payment.date,
    payment.stage,
    payment.reference ?? "",
  ].join("|")
}

function buildPaymentMethodSummary(
  reservations: Reservation[],
  advances: Advance[],
  businessDate: string,
) {
  const totals = { ...emptyMethodTotals }
  const references: Record<PaymentMethodKey, string[]> = {
    cash: [],
    card: [],
    transfer: [],
    deposit: [],
  }
  const seen = new Set<string>()
  let count = 0

  const addPayment = (reservationId: string, payment: PaymentRecord, source: string) => {
    if (payment.date !== businessDate) return
    const key = paymentMethodKey(payment.method)
    if (!key) return

    totals[key] += Number(payment.amount || 0)
    count += 1
    seen.add(paymentFingerprint(reservationId, payment))

    const reference = payment.reference?.trim()
    if (reference) {
      references[key].push(`${source}: ${reference} ${money(payment.amount)}`)
    }
  }

  reservations.forEach((reservation) => {
    ;(reservation.payments ?? []).forEach((payment) => {
      addPayment(reservation.id, payment, reservation.code)
    })
  })

  advances.forEach((advance) => {
    const payment: PaymentRecord = {
      id: `pay-${advance.id}`,
      method: advance.method,
      amount: advance.amount,
      reference: advance.notes ?? advance.receivedBy,
      stage: "reserva",
      date: advance.date,
    }

    if (seen.has(paymentFingerprint(advance.reservationId, payment))) return
    addPayment(advance.reservationId, payment, `Anticipo ${advance.reservationId}`)
  })

  return {
    totals,
    references,
    count,
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
  }
}

export function RecepcionCierresPage() {
  const currentUserName = getSessionUser()?.name ?? "Recepción"
  const {
    advances,
    cashCloses,
    creditMovements,
    events,
    inventory,
    inventoryMovements,
    invoices,
    reservations,
  } = useStore()
  const [cashShiftSummary, setCashShiftSummary] = useState<CashShiftSummary | null>(null)
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfigAssignment[]>([])
  const [shiftUsers, setShiftUsers] = useState<ShiftUserOption[]>([])
  const [shiftConfigError, setShiftConfigError] = useState<string | null>(null)
  const [loadingShift, setLoadingShift] = useState(true)
  const [savingManualEntry, setSavingManualEntry] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [closingShift, setClosingShift] = useState(false)
  const openClose = cashCloses.find((close) => close.status === "abierto")
  const [form, setForm] = useState<CloseForm>({
    closeId: openClose?.id ?? cashCloses[0]?.id ?? "",
    countedCash: 0,
    countedCard: 0,
    countedTransfer: 0,
    countedDeposit: 0,
    other: openClose?.other ?? 0,
    otherPaymentMethod: "cash",
    posClosure: "",
    transferReferences: "",
    depositReferences: "",
    unbilledDetails: "",
    notes: "",
  })
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(initialChecklist)
  const [categories, setCategories] = useState<Record<CategoryKey, number>>(emptyCategories)

  const loadCurrentShift = useCallback(async (resetCounted = true) => {
    setLoadingShift(true)
    try {
      const current = apiRecord(await api.cashShifts.getCurrent<unknown>())
      const shiftId = apiText(current, ["id_cash_shift", "id"])
      if (!shiftId) {
        setCashShiftSummary(null)
        setShiftConfigError(null)
        return false
      }

      const [summaryResult, configsResult, usersResult] = await Promise.allSettled([
        api.cashShifts.getSummary<unknown>(shiftId),
        api.cashShifts.listConfigs<unknown>(),
        api.users.list<unknown>(),
      ])

      if (summaryResult.status === "rejected") {
        throw summaryResult.reason
      }

      const summary = mapCashShiftSummary(summaryResult.value)
      const nextConfigs = configsResult.status === "fulfilled"
        ? apiArray(configsResult.value).map(mapShiftConfigAssignment).filter((config): config is ShiftConfigAssignment => Boolean(config))
        : []
      const nextUsers = usersResult.status === "fulfilled"
        ? apiArray(usersResult.value).map(mapShiftUserOption).filter((user): user is ShiftUserOption => Boolean(user))
        : []

      setCashShiftSummary(summary)
      setShiftConfigs(nextConfigs)
      setShiftUsers(nextUsers)
      setShiftConfigError(configsResult.status === "rejected" ? getApiErrorMessage(configsResult.reason) : null)
      if (summary) {
        setForm((currentForm) => ({
          ...currentForm,
          closeId: summary.shiftId,
          ...(resetCounted
            ? {
                countedCash: summary.paymentMethods.cash,
                countedCard: summary.paymentMethods.card,
                countedTransfer: summary.paymentMethods.transfer,
                countedDeposit: summary.paymentMethods.deposit,
              }
            : {}),
          other: 0,
          unbilledDetails: "",
        }))
        setCategories(summary.rubrics)
        setChecklist(summary.checklist)
      }
      return Boolean(summary)
    } catch (error) {
      setCashShiftSummary(null)
      toast.error("No se pudo cargar el cierre del turno actual", {
        description: getApiErrorMessage(error),
      })
      return false
    } finally {
      setLoadingShift(false)
    }
  }, [])

  useEffect(() => {
    void loadCurrentShift()
  }, [loadCurrentShift])

  useEffect(() => {
    if (!openClose || cashShiftSummary) return
    setForm((current) => ({
      ...current,
      closeId: openClose.id,
      countedCash: openClose.cash,
      countedCard: openClose.card,
      countedTransfer: openClose.transfer,
      countedDeposit: openClose.deposit,
    }))
  }, [cashShiftSummary, openClose])

  const selectedClose = cashCloses.find((close) => close.id === form.closeId) ?? openClose
  const summaryShiftKey: CloseShift = cashShiftSummary
    ? shiftKeyFromName(cashShiftSummary.shiftName)
    : "matutino"
  const selectedShiftSchedule = cashShiftSummary
    ? shiftSchedules[summaryShiftKey]
    : selectedClose
      ? shiftSchedules[selectedClose.shift]
      : undefined
  const shiftUsersById = useMemo(() => new Map(shiftUsers.map((user) => [user.id, user])), [shiftUsers])
  const matchedShiftConfig = useMemo(() => {
    if (!cashShiftSummary) return null
    if (cashShiftSummary.configId) {
      const byId = shiftConfigs.find((config) => config.configId === cashShiftSummary.configId)
      if (byId) return byId
    }

    return shiftConfigs.find((config) => config.shiftKey === summaryShiftKey) ?? null
  }, [cashShiftSummary, shiftConfigs, summaryShiftKey])
  const resolvedShiftAssignment = useMemo(() => {
    if (matchedShiftConfig) {
      return {
        source: "config" as const,
        userId: matchedShiftConfig.userId,
        userName: matchedShiftConfig.userName ?? shiftUsersById.get(matchedShiftConfig.userId)?.name ?? null,
      }
    }

    if (cashShiftSummary?.assignedUserId || cashShiftSummary?.assignedUserName) {
      return {
        source: "summary" as const,
        userId: cashShiftSummary.assignedUserId,
        userName: cashShiftSummary.assignedUserName ?? shiftUsersById.get(cashShiftSummary.assignedUserId)?.name ?? null,
      }
    }

    return null
  }, [cashShiftSummary, matchedShiftConfig, shiftUsersById])
  const hasActiveShift = Boolean(cashShiftSummary?.shiftId || selectedClose)
  const selectedShiftTime = cashShiftSummary?.startAt && cashShiftSummary?.endAt
    ? `${cashShiftSummary.startAt.slice(11, 16)} a ${cashShiftSummary.endAt.slice(11, 16)}`
    : selectedShiftSchedule?.time
  const selectedShiftOwner = resolvedShiftAssignment?.userName ??
    (resolvedShiftAssignment?.userId ? `Usuario #${resolvedShiftAssignment.userId}` : "Encargado no encontrado")
  const selectedShiftOwnerHelper = resolvedShiftAssignment?.userId || resolvedShiftAssignment?.userName
    ? resolvedShiftAssignment.source === "config"
      ? "Asignado en configuración"
      : "Asignado en turno activo"
    : shiftConfigError
      ? "No se pudo validar configuración"
      : "El backend no devolvió encargado"
  const closeBusinessDate =
    cashShiftSummary?.startAt.slice(0, 10) ??
    selectedClose?.openedAt.slice(0, 10) ??
    new Date().toISOString().slice(0, 10)
  const methodSummary = useMemo(
    () => buildPaymentMethodSummary(reservations, advances, closeBusinessDate),
    [advances, closeBusinessDate, reservations],
  )
  const methodTotals = cashShiftSummary?.paymentMethods ??
    (methodSummary.total > 0
      ? methodSummary.totals
      : {
          cash: selectedClose?.cash ?? 0,
          card: selectedClose?.card ?? 0,
          transfer: selectedClose?.transfer ?? 0,
          deposit: selectedClose?.deposit ?? 0,
        })
  const methodRows = (Object.keys(methodLabels) as PaymentMethodKey[]).map((key) => [
    methodLabels[key],
    money(methodTotals[key]),
    methodSummary.references[key].join("\n") || "Sin referencias registradas",
  ])
  const systemMethodTotal = Object.values(methodTotals).reduce((sum, value) => sum + value, 0)
  const expected = cashShiftSummary?.systemTotal ?? systemMethodTotal
  const countedTotal =
    form.countedCash +
    form.countedCard +
    form.countedTransfer +
    form.countedDeposit
  const countedDifference = countedTotal - expected
  const suggestedCategories = useMemo<Record<CategoryKey, number>>(() => {
    if (cashShiftSummary) return cashShiftSummary.rubrics

    const totals: Record<CategoryKey, number> = { ...emptyCategories }

    invoices
      .filter((invoice) => invoice.status === "emitida" && invoice.date === closeBusinessDate)
      .forEach((invoice) => {
        invoice.items.forEach((item) => {
          const description = normalizeText(item.description)
          if (description.includes("sin factura") || description.includes("no factura")) {
            totals.unbilledConsumptions += item.total
          } else if (description.includes("minibar") || description.includes("snack") || description.includes("consumo")) {
            totals.minibar += item.total
          } else if (description.includes("dan") || description.includes("blanco") || description.includes("mobiliario")) {
            totals.linenDamage += item.total
          } else if (description.includes("evento") || description.includes("salon") || description.includes("cowork") || description.includes("cena")) {
            totals.events += item.total
          } else if (description.includes("anticipo")) {
            totals.advances += item.total
          } else if (description.includes("hospedaje") || description.includes("habitacion")) {
            totals.lodging += item.total
          } else {
            totals.other += item.total
          }
        })
      })

    advances
      .filter((advance) => advance.date === closeBusinessDate)
      .forEach((advance) => {
        totals.advances += advance.amount
      })

    creditMovements
      .filter((movement) => movement.date === closeBusinessDate && movement.payment > 0)
      .forEach((movement) => {
        totals.creditPayments += movement.payment
      })

    events
      .filter((event) => event.date === closeBusinessDate && event.paid > 0)
      .forEach((event) => {
        totals.events += event.paid
      })

    inventoryMovements
      .filter((movement) => movement.type === "consumo" && movement.date.slice(0, 10) === closeBusinessDate)
      .forEach((movement) => {
        const item = inventory.find((entry) => entry.id === movement.itemId)
        if (item?.category === "snack") {
          totals.minibar += Math.abs(movement.qty) * (item.price ?? 0)
        }
        if (item?.category === "blanco") {
          totals.linenDamage += Math.abs(movement.qty) * item.cost
        }
      })

    return totals
  }, [advances, cashShiftSummary, closeBusinessDate, creditMovements, events, inventory, inventoryMovements, invoices])

  const closeCategories = cashShiftSummary?.rubrics ?? categories
  const categoryTotal =
    cashShiftSummary?.rubricTotal ??
    Object.values(closeCategories).reduce((sum, value) => sum + value, 0)
  const categoryDifference = expected - categoryTotal
  const hasDifference = Math.abs(countedDifference) > 0.009
  const checklistReady = Object.entries(checklist).every(([key, value]) =>
    key === "notes" ? (!hasDifference || value) : value,
  )
  const canClose = Boolean(
    cashShiftSummary?.shiftId &&
      checklistReady &&
      expected >= 0 &&
      Math.abs(categoryDifference) <= 0.01 &&
      form.other <= 0 &&
      (!hasDifference || form.notes.trim().length >= 8),
  )

  const suggestionSourceRows = useMemo(() => {
    const emittedInvoices = invoices.filter((invoice) => invoice.status === "emitida" && invoice.date === closeBusinessDate)
    const shiftAdvances = advances.filter((advance) => advance.date === closeBusinessDate)
    const previousAdvances = advances.filter((advance) => advance.date !== closeBusinessDate)
    const shiftEvents = events.filter((event) => event.date === closeBusinessDate && event.paid > 0)
    const creditPayments = creditMovements.filter((movement) => movement.date === closeBusinessDate && movement.payment > 0)
    const minibarMovements = inventoryMovements.filter((movement) => {
      const item = inventory.find((entry) => entry.id === movement.itemId)
      return movement.type === "consumo" && movement.date.slice(0, 10) === closeBusinessDate && item?.category === "snack"
    })
    const damageMovements = inventoryMovements.filter((movement) => {
      const item = inventory.find((entry) => entry.id === movement.itemId)
      const reason = normalizeText(movement.reason)
      return movement.date.slice(0, 10) === closeBusinessDate && (item?.category === "blanco" || reason.includes("dano"))
    })

    return [
      ["Eventos pagados en este turno/dia", shiftEvents.length, "Entran en Eventos."],
      ["Abonos a credito recibidos", creditPayments.length, "Entran en Abonos a credito."],
      ["Danos cobrados o registrados", damageMovements.length, "Entran en Danos si fueron cobrados o registrados hoy."],
      ["Facturas emitidas del turno/día", emittedInvoices.length, "Se separan por descripción: hospedaje, minibar, daños, eventos u otros."],
      ["Anticipos recibidos en este turno/día", shiftAdvances.length, "Sí entran en Anticipos recibidos."],
      ["Anticipos de días anteriores", previousAdvances.length, "No entran al cierre actual; ya cerraron en el turno en que se recibieron."],
      ["Consumos de minibar del turno/día", minibarMovements.length, "Entran en Minibar / snacks si fueron consumidos o facturados hoy."],
      ["Consumos sin factura", "Manual", "Minibar, hospedaje, reservas, coworking u otros cobros que el cliente pago pero no quiso facturar."],
      ["Habitaciones ocupadas", "No aplica", "No generan cierre por sí solas; solo cuenta cuando hay cobro, factura o pago."],
    ]
  }, [advances, closeBusinessDate, creditMovements, events, inventory, inventoryMovements, invoices])

  const updateOther = (value: string) => {
    const other = value === "" ? 0 : Number(value)
    setForm((current) => ({ ...current, other }))
  }

  const loadSuggestedCategories = async () => {
    const loaded = await loadCurrentShift(false)
    if (!loaded) return
    toast.success("Datos del sistema actualizados", {
      description: "Los métodos de pago y los rubros se volvieron a consultar en el resumen del turno.",
    })
  }

  const saveManualEntry = async () => {
    const shiftId = cashShiftSummary?.shiftId
    if (!shiftId) return
    if (form.other <= 0 || form.unbilledDetails.trim().length < 4) {
      toast.error("Completa el monto y el detalle del movimiento manual")
      return
    }

    const amount = form.other
    const paymentMethod = form.otherPaymentMethod
    setSavingManualEntry(true)
    try {
      await api.cashShifts.createManualEntry(shiftId, {
        entry_type: "Other",
        movement_type: "Income",
        amount,
        payment_method: methodPayloads[paymentMethod],
        description: form.unbilledDetails.trim(),
        reference:
          paymentMethod === "card"
            ? form.posClosure.trim() || null
            : paymentMethod === "transfer"
              ? form.transferReferences.trim() || null
              : paymentMethod === "deposit"
                ? form.depositReferences.trim() || null
                : null,
        registered_by: currentUserName,
      })
      await loadCurrentShift(false)
      toast.success("Movimiento manual guardado", {
        description: `${methodLabels[paymentMethod]} · ${money(amount)}`,
      })
    } catch (error) {
      toast.error("No se pudo guardar el movimiento manual", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingManualEntry(false)
    }
  }

  const checklistPayload = (values: Record<ChecklistKey, boolean>) => ({
    cash_counted: values.cash,
    pos_card_reviewed: values.card,
    transfers_deposits_reviewed: values.transfer,
    invoices_reviewed: values.invoices,
    accounting_rubrics_reviewed: values.categories,
    observations_added_if_difference: hasDifference ? values.notes : true,
  })

  const updateChecklistItem = async (key: ChecklistKey, checked: boolean) => {
    const shiftId = cashShiftSummary?.shiftId
    if (!shiftId || savingChecklist) return
    const previous = checklist
    const next = { ...checklist, [key]: checked }
    setChecklist(next)
    setSavingChecklist(true)
    try {
      await api.cashShifts.updateChecklist(shiftId, checklistPayload(next))
    } catch (error) {
      setChecklist(previous)
      toast.error("No se pudo guardar el checklist", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingChecklist(false)
    }
  }

  const closeShift = async () => {
    const shiftId = cashShiftSummary?.shiftId
    if (!shiftId) return
    if (!canClose) {
      toast.error("No se puede cerrar el turno todavía", {
        description:
          form.other > 0
            ? "Guarda primero el movimiento manual pendiente."
            : Math.abs(categoryDifference) > 0.01
              ? "El resumen del sistema todavía no cuadra entre métodos y rubros."
              : hasDifference
                ? "Completa el checklist y explica la diferencia de caja."
                : "Completa el checklist operativo.",
      })
      return
    }

    setClosingShift(true)
    try {
      await api.cashShifts.updateChecklist(shiftId, checklistPayload(checklist))
      await api.cashShifts.close(shiftId, {
        counted_cash: form.countedCash,
        counted_card: form.countedCard,
        counted_transfer: form.countedTransfer,
        counted_deposit: form.countedDeposit,
        difference_notes: form.notes.trim() || null,
      })
      toast.success("Turno cerrado correctamente", {
        description: hasDifference
          ? `Diferencia registrada: ${money(countedDifference)}.`
          : "El cierre quedó cuadrado.",
      })
      await loadCurrentShift()
    } catch (error) {
      toast.error("No se pudo cerrar el turno", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setClosingShift(false)
    }
  }

  const printSummary = () => {
    toast.success("Resumen de cierre listo para imprimir")
    exportCurrentView({ title: "Cierres de turno", format: "print" })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Cierres de turno"
        description="Cuadre de caja por método de pago, horarios reales de turno y cierre contable por rubro: hospedaje, anticipos, minibar, daños, eventos, consumos sin factura, crédito y otros."
        actions={
          <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={printSummary}>
            <Printer className="size-3.5" />
            Imprimir resumen
          </Button>
        }
      />

      <QuickGuide
        title="Guía rápida para cierre de turno"
        description="Usa esta pantalla al final del turno para contar el dinero, revisar los rubros y cerrar el turno en el sistema."
        steps={[
          { icon: Banknote, title: "Cuenta el dinero", text: "Suma efectivo, tarjetas, depósitos y transferencias del turno." },
          { icon: ClipboardCheck, title: "Separa los cobros", text: "Indica cuánto fue hospedaje, minibar, daños, eventos, anticipos, sin factura o crédito." },
          { icon: Calculator, title: "Revisa diferencias", text: "Lo contado debe cuadrar con lo que el sistema dice que se vendió." },
          { icon: Send, title: "Cierra el turno", text: "Cuando todo esté revisado, guarda el conteo final y cierra el turno actual." },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Turno seleccionado" value={money(expected)} helper={selectedShiftSchedule ? `${selectedShiftSchedule.label} · ${selectedShiftSchedule.time}` : "Pagos guardados para este turno"} />
        <StatCard label="Total contado" value={money(countedTotal)} helper="Montos físicos ingresados por recepción" />
        <StatCard label="Encargado" value={selectedShiftOwner} helper={selectedShiftOwnerHelper} tone={resolvedShiftAssignment?.userId || resolvedShiftAssignment?.userName ? "success" : "warning"} />
        <StatCard label="Diferencia de caja" value={money(countedDifference)} tone={hasDifference ? "danger" : "success"} />
        <StatCard label="Rubros del sistema" value={money(categoryTotal)} tone={Math.abs(categoryDifference) > 0.01 ? "warning" : "success"} />
      </section>

      <Tabs defaultValue="nuevo" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="nuevo">Cerrar turno</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="nuevo" className="space-y-4">
          <SectionCard
            title="1. ¿Cómo entró el dinero?"
            description="El sistema muestra lo registrado. Recepción ingresa aparte lo contado físicamente para comparar y cerrar."
            actions={
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border bg-background px-4 py-2 text-sm font-semibold">
                  {cashShiftSummary?.shiftName ?? "Turno actual"}
                </div>
                <div className="rounded-full border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground">
                  Encargado: {selectedShiftOwner}
                </div>
              </div>
            }
          >
            {loadingShift ? (
              <div className="mb-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Cargando el turno actual y su resumen...
              </div>
            ) : !hasActiveShift ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No hay un turno activo disponible para cerrar.
              </div>
            ) : null}

            {hasActiveShift && selectedShiftSchedule ? (
              <div className="mb-4 grid gap-3 rounded-2xl border bg-muted/25 p-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Horario de cierre</p>
                  <p className="mt-1 font-semibold">{selectedShiftSchedule.label}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Horas</p>
                  <p className="mt-1 font-semibold">{selectedShiftTime}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Encargado</p>
                  <p className="mt-1 font-semibold">{selectedShiftOwner}</p>
                </div>
                <p className="text-sm text-muted-foreground md:self-end">{selectedShiftSchedule.handoff}</p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-4 rounded-2xl border bg-background/60 p-4">
                <div>
                  <p className="text-sm font-semibold">Efectivo</p>
                  <p className="mt-1 text-xs text-muted-foreground">Billetes y monedas contados físicamente en caja.</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Total efectivo contado (Q.)
                  <MoneyInput
                    min={0}
                    value={form.countedCash || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countedCash: Number(event.target.value || 0),
                      }))
                    }
                    className="rounded-full"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    Sistema: {money(methodTotals.cash)}
                  </span>
                </label>
              </div>

              <div className="space-y-4 rounded-2xl border bg-background/60 p-4">
                <div>
                  <p className="text-sm font-semibold">Tarjeta / POS</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total que marca el cierre del POS, no cada recibo individual.</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  No. de cierre del POS
                  <Input
                    value={form.posClosure}
                    onChange={(event) => setForm((current) => ({ ...current, posClosure: event.target.value }))}
                    className="rounded-full"
                    placeholder="Opcional: cierre 0142"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    La terminal de tarjetas suele imprimir un cierre con el total. Si no lo tienen, puede quedar vacío.
                  </span>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Total tarjetas según POS (Q.)
                  <MoneyInput
                    min={0}
                    value={form.countedCard || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countedCard: Number(event.target.value || 0),
                      }))
                    }
                    className="rounded-full"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    Sistema: {money(methodTotals.card)}
                  </span>
                </label>
              </div>

              <div className="space-y-4 rounded-2xl border bg-background/60 p-4">
                <div>
                  <p className="text-sm font-semibold">Transferencia</p>
                  <p className="mt-1 text-xs text-muted-foreground">Pagos confirmados en banco o comprobante digital.</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Total transferencias confirmadas (Q.)
                  <MoneyInput
                    min={0}
                    value={form.countedTransfer || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countedTransfer: Number(event.target.value || 0),
                      }))
                    }
                    className="rounded-full"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    Sistema: {money(methodTotals.transfer)}
                  </span>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  Referencias de transferencias
                  <Textarea
                    value={form.transferReferences}
                    onChange={(event) => setForm((current) => ({ ...current, transferReferences: event.target.value }))}
                    className="min-h-20 rounded-2xl"
                    placeholder={"Ej. Transferencia BI Q. 650 ref. 88291\nTransferencia BAC Q. 900 ref. 12045"}
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-2xl border bg-background/60 p-4">
                <div>
                  <p className="text-sm font-semibold">Depósito</p>
                  <p className="mt-1 text-xs text-muted-foreground">Boletas bancarias depositadas y verificadas.</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Total depósitos confirmados (Q.)
                  <MoneyInput
                    min={0}
                    value={form.countedDeposit || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countedDeposit: Number(event.target.value || 0),
                      }))
                    }
                    className="rounded-full"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    Sistema: {money(methodTotals.deposit)}
                  </span>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  Referencias de depósitos
                  <Textarea
                    value={form.depositReferences}
                    onChange={(event) => setForm((current) => ({ ...current, depositReferences: event.target.value }))}
                    className="min-h-20 rounded-2xl"
                    placeholder={"Ej. Depósito BAC Q. 150 boleta 55210\nDepósito BI Q. 425 boleta 88902"}
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <div>
                  <p className="text-sm font-semibold">Otros manuales</p>
                  <p className="mt-1 text-xs text-amber-900/80">Solo para casos que aun no nacen de un pago del sistema.</p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Monto del nuevo movimiento (Q.)
                  <MoneyInput min={0} value={form.other || ""} onChange={(event) => updateOther(event.target.value)} className="rounded-full bg-white" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Método de pago
                  <select
                    value={form.otherPaymentMethod}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        otherPaymentMethod: event.target.value as PaymentMethodKey,
                      }))
                    }
                    className="h-10 w-full rounded-full border bg-white px-3 text-sm"
                  >
                    {(Object.keys(methodLabels) as PaymentMethodKey[]).map((key) => (
                      <option key={key} value={key}>{methodLabels[key]}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-amber-900/80">
                  Otros ya registrados en el turno: {money(closeCategories.other)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <MiniTable headers={["Metodo", "Total del sistema", "Referencias"]} rows={methodRows} />
            </div>
          </SectionCard>

          <SectionCard title="Ejemplo rápido para no confundirse" description="El cierre suma muchas ventas del turno. No importa si fueron varios clientes; primero se agrupan por forma de pago y luego por rubro contable.">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-sm font-semibold">Clientes del turno</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  2 pagaron con tarjeta, 1 pagó en efectivo y 1 hizo transferencia.
                </p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-sm font-semibold">Forma de pago</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  El sistema suma el total: tarjeta Q. 1,300, efectivo Q. 350, transferencia Q. 650.
                </p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="text-sm font-semibold">Rubro</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Luego se separa qué fue: hospedaje, anticipo, minibar, daño, evento, consumo sin factura o crédito.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="2. ¿Qué se cobró?"
            description="Después de saber cómo entró el dinero, separa por qué se cobró: hospedaje, anticipos, minibar, daños, eventos, consumos sin factura, crédito u otros."
            actions={
              <Button size="sm" variant="outline" className="rounded-full" onClick={loadSuggestedCategories}>
                Actualizar desde sistema
              </Button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(categoryLabels) as CategoryKey[]).map((key) => (
                <label key={key} className="space-y-2 rounded-2xl border bg-background/60 p-4 text-sm font-medium">
                  <span>{categoryLabels[key]} (Q.)</span>
                  <MoneyInput
                    min={0}
                    value={closeCategories[key] || ""}
                    disabled
                    readOnly
                    className="rounded-full"
                  />
                  <span className="block text-xs font-normal text-muted-foreground">
                    {key === "other"
                      ? "Se actualiza al guardar movimientos manuales en el servidor."
                      : `Sistema carga ${money(suggestedCategories[key])} para ${formatDate(closeBusinessDate)}`}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block space-y-2 text-sm font-medium">
                Detalle del movimiento manual
                <Textarea
                  value={form.unbilledDetails}
                  onChange={(event) => setForm((current) => ({ ...current, unbilledDetails: event.target.value }))}
                  className="min-h-24 rounded-2xl"
                  placeholder="Ej. cobro externo autorizado o ingreso especial del turno."
                />
                <span className="block text-xs font-normal text-muted-foreground">
                  El monto, método y detalle se guardan antes de poder cerrar.
                </span>
              </label>
              <Button
                type="button"
                className="gap-2 rounded-full"
                onClick={saveManualEntry}
                disabled={savingManualEntry || form.other <= 0 || form.unbilledDetails.trim().length < 4}
              >
                <Save className="size-4" />
                {savingManualEntry ? "Guardando..." : "Guardar movimiento"}
              </Button>
            </div>

            {cashShiftSummary?.manualEntries.length ? (
              <div className="mt-4">
                <MiniTable
                  headers={["Movimiento manual", "Método", "Referencia", "Monto"]}
                  rows={cashShiftSummary.manualEntries.map((entry) => [
                    entry.description,
                    entry.paymentMethod || "Sin método",
                    entry.reference || "Sin referencia",
                    money(entry.amount),
                  ])}
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Forma de pago vs rubro" description="Esto es lo más importante del cierre: una cosa es cómo pagó el cliente y otra cosa es qué estaba pagando.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="font-semibold">Forma de pago</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Efectivo, tarjeta/POS, transferencia o depósito. Responde: ¿cómo entró el dinero?
                </p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <p className="font-semibold">Rubro contable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hospedaje, anticipo, minibar, daño, evento, consumo sin factura o crédito. Responde: ¿por qué se cobró?
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="De dónde salen los rubros sugeridos" description="El botón no mira habitaciones ocupadas; mira transacciones. Una habitación ocupada no entra al cierre hasta que hay cobro.">
            <MiniTable
              headers={["Fuente", "Registros", "Cómo se usa"]}
              rows={suggestionSourceRows}
            />
          </SectionCard>

          <section className="grid gap-4 2xl:grid-cols-[1fr_420px]">
            <SectionCard title="Checklist obligatorio">
              <div className="grid gap-3 md:grid-cols-2">
                {(Object.keys(checklistLabels) as ChecklistKey[]).map((key) => {
                  const disabled = key === "notes" && !hasDifference
                  return (
                    <label key={key} className="flex items-start gap-3 rounded-2xl border bg-background/60 p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={disabled ? true : checklist[key]}
                        disabled={disabled || savingChecklist}
                        onChange={(event) => void updateChecklistItem(key, event.target.checked)}
                        className="mt-1 size-4"
                      />
                      <span>
                        <span className="block font-medium">{checklistLabels[key]}</span>
                        <span className="text-xs text-muted-foreground">
                          {disabled
                            ? "No aplica porque no hay diferencia."
                            : key === "categories"
                              ? "Incluye minibar, daños y consumos sin factura."
                              : "Requerido antes de cerrar."}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard title="¿Cuadra el cierre?">
              <FieldGrid
                items={[
                  { label: "El sistema dice que entró", value: money(expected), helper: "Solo pagos guardados para el turno seleccionado." },
                  { label: "Total contado", value: money(countedTotal), helper: "Efectivo, POS, transferencias y depósitos ingresados arriba." },
                  { label: "Los rubros explican", value: money(categoryTotal), helper: "Hospedaje, anticipos, minibar, daños, eventos, sin factura y crédito." },
                  { label: "Diferencia de caja", value: <span className={!hasDifference ? "text-emerald-600" : "text-red-600"}>{money(countedDifference)}</span>, helper: "Compara el total contado contra el total del sistema." },
                ]}
              />
              <div className={`mt-4 rounded-2xl border p-4 text-sm ${!hasDifference ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                {!hasDifference
                  ? "El conteo coincide con el total registrado por el sistema."
                  : `Hay una diferencia de caja de ${money(Math.abs(countedDifference))}. Revisa el conteo y, si es correcta, deja la explicación antes de cerrar.`}
              </div>
              {Math.abs(categoryDifference) > 0.01 ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Los rubros del resumen tienen una diferencia de {money(Math.abs(categoryDifference))} contra los métodos de pago. Actualiza el resumen antes de cerrar.
                </div>
              ) : null}
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder={hasDifference ? "Escribe por qué hay diferencia antes de cerrar" : "Observaciones opcionales del turno"}
                className="mt-4 min-h-24 rounded-2xl"
              />
              <Button
                className="mt-4 w-full rounded-full"
                onClick={closeShift}
                disabled={!canClose || closingShift || savingChecklist || savingManualEntry}
              >
                {closingShift ? "Cerrando turno..." : "Cerrar turno"}
              </Button>
            </SectionCard>
          </section>
        </TabsContent>

        <TabsContent value="backend">
          <SectionCard title="Endpoints usados por Cierres">
            <EndpointPanel
              endpoints={[
                "GET /api/cash-shifts/current",
                "GET /api/cash-shifts/{id}/summary",
                "POST /api/cash-shifts/{id}/manual-entries",
                "PATCH /api/cash-shifts/{id}/checklist",
                "POST /api/cash-shifts/{id}/close",
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RecepcionCierresPage
