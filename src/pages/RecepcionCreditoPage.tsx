import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  Mail,
  Phone,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { formatDate, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { CreditAccount, CreditMovement } from "@/lib/types"

type CreditTab = "cuentas" | "abono" | "movimientos" | "backend"
type CreditView = "todos" | "al-dia" | "por-vencer" | "vencidos" | "sin-credito"
type AccountHealth =
  | "al dia"
  | "por vencer"
  | "vencido"
  | "pausado"
  | "bloqueado"
  | "autorizado"
  | "sin credito"

type PaymentForm = {
  accountId: string
  amount: number
  reference: string
  invoice: string
}

type AccountWithHealth = CreditAccount & {
  available: number
  usage: number
  daysToDue: number
  health: AccountHealth
  paused: boolean
  authorized: boolean
}

type CreditReceptionSummaryMetric = {
  label: string
  value: string
  helper: string
  tone: "default" | "success" | "warning" | "danger" | "info"
}

const healthLabels: Record<AccountHealth, string> = {
  "al dia": "Al día",
  "por vencer": "Por vencer",
  vencido: "Vencido",
  pausado: "Crédito pausado",
  bloqueado: "Credito bloqueado",
  autorizado: "Autorizado por admin",
  "sin credito": "Sin crédito disponible",
}

const healthStyles: Record<AccountHealth, string> = {
  "al dia": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "por vencer": "border-amber-200 bg-amber-50 text-amber-900",
  vencido: "border-red-200 bg-red-50 text-red-900",
  pausado: "border-zinc-300 bg-zinc-100 text-zinc-800",
  bloqueado: "border-red-300 bg-red-100 text-red-950",
  autorizado: "border-blue-200 bg-blue-50 text-blue-900",
  "sin credito": "border-orange-200 bg-orange-50 text-orange-900",
}

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
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

function mapReceptionSummary(value: unknown): CreditReceptionSummaryMetric[] {
  const root = apiRecord(value)
  const dataRecord = apiRecord(root.data)
  const data = Object.keys(dataRecord).length ? dataRecord : root
  const totalBalance = apiNumber(data, ["total_balance", "totalBalance", "balance"])
  const available = apiNumber(data, ["available_credit", "availableCredit", "available"])
  const overdue = apiNumber(data, ["overdue_balance", "overdueBalance", "overdue"])
  const accounts = apiNumber(data, ["accounts", "total_accounts", "totalAccounts", "count"])

  return [
    { label: "Saldo por cobrar", value: money(totalBalance), helper: "GET /api/credit/report/reception-summary", tone: totalBalance ? "warning" : "success" },
    { label: "Credito disponible", value: money(available), helper: "Disponible total de clientes activos", tone: "info" },
    { label: "Vencido", value: money(overdue), helper: "Cuentas que requieren seguimiento", tone: overdue ? "danger" : "success" },
    { label: "Cuentas", value: String(accounts), helper: "Clientes con crédito en recepción", tone: "default" },
  ]
}

function mapStatementMovements(value: unknown, accountId: string): CreditMovement[] {
  const root = apiRecord(value)
  const data = apiRecord(root.data)
  const movementRows =
    apiArray(data.movements).length
      ? apiArray(data.movements)
      : apiArray(root.movements).length
        ? apiArray(root.movements)
        : apiArray(value)

  return movementRows.map((item, index) => {
    const row = apiRecord(item)
    return {
      id: apiText(row, ["id_credit_movement", "idCreditMovement", "id"], `${accountId}-${index}`),
      accountId,
      date: apiText(row, ["date", "created_at", "createdAt", "movement_date"], new Date().toISOString()),
      concept: apiText(row, ["concept", "description", "notes"], "Movimiento de crédito"),
      charge: apiNumber(row, ["charge", "debit", "amount_charged", "amountCharged"]),
      payment: apiNumber(row, ["payment", "credit", "amount_paid", "amountPaid"]),
      reference: apiText(row, ["reference", "payment_reference", "invoice", "document"], "-"),
    }
  })
}

function daysBetweenToday(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function healthForAccount(account: CreditAccount): AccountHealth {
  if (account.creditStatus === "bloqueado") return "bloqueado"
  if (account.creditStatus === "pausado") return "pausado"
  if (account.creditStatus === "autorizado") return "autorizado"
  if (account.status === "vencido") return "vencido"
  if (account.balance >= account.limit) return "sin credito"
  if (account.status === "por vencer") return "por vencer"
  return "al dia"
}

function CreditBadge({ health }: { health: AccountHealth }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        healthStyles[health],
      )}
    >
      {health === "al dia" ? <CheckCircle2 className="size-3.5" /> : null}
      {health === "por vencer" ? <CalendarClock className="size-3.5" /> : null}
      {health === "vencido" ? <ShieldAlert className="size-3.5" /> : null}
      {health === "pausado" ? <Ban className="size-3.5" /> : null}
      {health === "bloqueado" ? <LockKeyhole className="size-3.5" /> : null}
      {health === "autorizado" ? <BadgeCheck className="size-3.5" /> : null}
      {health === "sin credito" ? <AlertTriangle className="size-3.5" /> : null}
      {healthLabels[health]}
    </span>
  )
}

function CreditMetric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string
  value: string | number
  helper?: string
  tone?: "default" | "success" | "warning" | "danger" | "info"
}) {
  const tones = {
    default: "border-border bg-card",
    success: "border-emerald-200 bg-emerald-50/80",
    warning: "border-amber-200 bg-amber-50/80",
    danger: "border-red-200 bg-red-50/80",
    info: "border-blue-200 bg-blue-50/80",
  }

  return (
    <div className={cn("rounded-2xl border p-3 shadow-sm sm:rounded-3xl sm:p-4", tones[tone])}>
      <p className="mobile-safe-text text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
      <p className="mobile-safe-text mt-1 text-xl font-bold tracking-tight sm:mt-2 sm:text-2xl">{value}</p>
      {helper ? <p className="mobile-safe-text mt-1 text-[0.7rem] leading-4 text-muted-foreground sm:text-xs">{helper}</p> : null}
    </div>
  )
}

export function RecepcionCreditoPage() {
  const {
    creditAccounts,
    creditAuthorizationRequests,
    creditMovements,
    dispatch,
  } = useStore()
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<CreditTab>("cuentas")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<CreditView>("todos")
  const [selectedAccountId, setSelectedAccountId] = useState(
    creditAccounts[0]?.id ?? "",
  )
  const [statementAccount, setStatementAccount] =
    useState<AccountWithHealth | null>(null)
  const [statementRows, setStatementRows] = useState<CreditMovement[]>([])
  const [statementLoading, setStatementLoading] = useState(false)
  const [receptionSummary, setReceptionSummary] = useState<CreditReceptionSummaryMetric[]>([])
  const [payment, setPayment] = useState<PaymentForm>({
    accountId: creditAccounts[0]?.id ?? "",
    amount: 0,
    reference: "",
    invoice: "",
  })

  useEffect(() => {
    let cancelled = false

    api.credit.getReceptionSummary<unknown>()
      .then((response) => {
        if (cancelled) return
        setReceptionSummary(mapReceptionSummary(response))
      })
      .catch((error) => {
        if (cancelled) return
        setReceptionSummary([])
        toast.error("No se pudo cargar el resumen de credito", {
          description: getApiErrorMessage(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const accounts = useMemo<AccountWithHealth[]>(
    () =>
      creditAccounts.map((account) => {
        const paused = account.creditStatus === "pausado"
        const authorized = account.creditStatus === "autorizado"
        const available = Math.max(0, account.limit - account.balance)
        const usage = account.limit > 0 ? Math.min(100, Math.round((account.balance / account.limit) * 100)) : 0
        return {
          ...account,
          paused,
          authorized,
          available,
          usage,
          daysToDue: daysBetweenToday(account.dueDate),
          health: healthForAccount(account),
        }
      }),
    [creditAccounts],
  )

  const filteredAccounts = useMemo(() => {
    const text = query.toLowerCase().trim()

    return accounts.filter((account) => {
      const matchesSearch =
        !text ||
        [
          account.company,
          account.contact,
          account.email,
          account.phone,
          account.health,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text)

      const matchesView =
        view === "todos" ||
        (view === "al-dia" && account.health === "al dia") ||
        (view === "por-vencer" && account.health === "por vencer") ||
        (view === "vencidos" && account.health === "vencido") ||
        (view === "sin-credito" &&
          ["bloqueado", "pausado", "sin credito", "vencido"].includes(account.health))

      return matchesSearch && matchesView
    })
  }, [accounts, query, view])

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]
  const paymentAccount =
    accounts.find((account) => account.id === payment.accountId) ?? accounts[0]
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalAvailable = accounts.reduce((sum, account) => sum + account.available, 0)
  const riskyAccounts = accounts.filter((account) =>
    ["vencido", "pausado", "bloqueado", "sin credito"].includes(account.health),
  )
  const dueSoon = accounts.filter((account) => account.health === "por vencer")
  const pendingRequests = creditAuthorizationRequests.filter(
    (request) => request.status === "pendiente",
  )
  const selectedPendingRequest = selectedAccount
    ? pendingRequests.find((request) => request.accountId === selectedAccount.id)
    : undefined
  const paymentValid = Boolean(
    paymentAccount &&
      payment.amount > 0 &&
      payment.amount <= paymentAccount.balance &&
      payment.reference.trim().length >= 4,
  )
  const statementMovements = useMemo(() => {
    if (!statementAccount) return []
    if (statementRows.length) return statementRows
    return creditMovements.filter(
      (movement) => movement.accountId === statementAccount.id,
    )
  }, [creditMovements, statementAccount, statementRows])

  function selectAccount(accountId: string) {
    setSelectedAccountId(accountId)
    setPayment((current) => ({ ...current, accountId }))
  }

  function preparePayment(account: AccountWithHealth) {
    setSelectedAccountId(account.id)
    setPayment((current) => ({
      ...current,
      accountId: account.id,
      amount: current.accountId === account.id ? current.amount : 0,
    }))
    setActiveTab("abono")
    window.setTimeout(() => amountInputRef.current?.focus(), 80)
    toast.success("Abono listo para registrar", {
      description: `${account.company} quedó seleccionado en el formulario.`,
    })
  }

  function requestCreditAuthorization(account: AccountWithHealth) {
    const existing = pendingRequests.find((request) => request.accountId === account.id)
    if (existing) {
      toast.info("Esta solicitud ya está en administración", {
        description: `${account.company} está pendiente de respuesta.`,
      })
      return
    }

    dispatch({
      type: "CREDIT_AUTH_REQUEST_CREATE",
      request: {
        id: `car-${Date.now()}`,
        accountId: account.id,
        requestedBy: "Recepción",
        requestedAt: new Date().toISOString().slice(0, 10),
        reason:
          account.health === "pausado"
            ? "Recepción solicita reanudar el crédito porque la empresa necesita operar de nuevo."
            : "Recepción solicita autorización especial porque la cuenta tiene saldo vencido o sin margen.",
        status: "pendiente",
      },
    })

    toast.success("Solicitud enviada a administración", {
      description: `${account.company} aparecerá en Créditos admin.`,
    })
  }

  function registerPayment() {
    if (!paymentAccount) return
    if (!paymentValid) {
      toast.error("No se puede registrar el abono", {
        description: "Revisa cliente, monto y referencia. El abono no debe exceder el saldo.",
      })
      return
    }

    dispatch({
      type: "CREDIT_PAYMENT",
      accountId: paymentAccount.id,
      amount: payment.amount,
      reference: payment.invoice
        ? `${payment.reference} · ${payment.invoice}`
        : payment.reference,
    })

    toast.success("Abono registrado correctamente", {
      description: `${paymentAccount.company} · ${money(payment.amount)}`,
    })
    setPayment((current) => ({ ...current, amount: 0, reference: "", invoice: "" }))
  }

  async function openStatement(account: AccountWithHealth) {
    setStatementAccount(account)
    setStatementRows([])
    setStatementLoading(true)
    try {
      const response = await api.credit.getAccountStatement<unknown>(account.id)
      setStatementRows(mapStatementMovements(response, account.id))
      toast.success("Estado de cuenta cargado", {
        description: `${account.company} · saldo ${money(account.balance)}`,
      })
    } catch (error) {
      toast.error("No se pudo cargar el estado de cuenta del backend", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setStatementLoading(false)
    }
    return
    toast.success("Estado de cuenta abierto", {
      description: `${account.company} · saldo ${money(account.balance)}`,
    })
  }

  function printStatement() {
    if (!statementAccount) return
    const escapeHtml = (value: string | number) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    const company = escapeHtml(statementAccount.company)
    const contact = escapeHtml(statementAccount.contact)
    const email = escapeHtml(statementAccount.email)
    const phone = escapeHtml(statementAccount.phone)
    const health = escapeHtml(healthLabels[statementAccount.health])
    const rows = statementMovements
      .map(
        (movement) => `
          <tr>
            <td>${formatDate(movement.date)}</td>
            <td>${escapeHtml(movement.concept)}</td>
            <td class="money">${money(movement.charge)}</td>
            <td class="money">${money(movement.payment)}</td>
            <td>${escapeHtml(movement.reference)}</td>
          </tr>
        `,
      )
      .join("")
    const win = window.open("", "_blank", "width=900,height=720")
    if (!win) {
      toast.error("No se pudo abrir la impresión", {
        description: "Permite ventanas emergentes para imprimir este estado de cuenta.",
      })
      return
    }

    win.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Estado de cuenta · ${company}</title>
          <style>
            body {
              margin: 0;
              padding: 32px;
              color: #2f241d;
              font-family: Inter, Arial, sans-serif;
              background: #fffaf2;
            }
            .page {
              max-width: 920px;
              margin: 0 auto;
              background: white;
              border: 1px solid #eadfce;
              border-radius: 18px;
              padding: 28px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 1px solid #eadfce;
              padding-bottom: 18px;
            }
            .eyebrow {
              color: #9a6b3d;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.18em;
              text-transform: uppercase;
            }
            h1 {
              margin: 8px 0 4px;
              font-family: Georgia, serif;
              font-size: 30px;
              font-weight: 500;
            }
            .muted {
              color: #6f6257;
              font-size: 13px;
            }
            .badge {
              display: inline-block;
              border: 1px solid #e7cf9a;
              border-radius: 999px;
              background: #fff4d8;
              padding: 7px 11px;
              font-size: 12px;
              font-weight: 700;
              color: #725018;
              text-transform: uppercase;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin: 20px 0;
            }
            .box {
              border: 1px solid #eadfce;
              border-radius: 14px;
              padding: 14px;
              background: #fffdf9;
            }
            .label {
              color: #776a5d;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
            }
            .value {
              margin-top: 6px;
              font-size: 18px;
              font-weight: 800;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 18px;
              font-size: 13px;
            }
            th {
              background: #f6efe4;
              color: #6f6257;
              font-size: 11px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              text-align: left;
            }
            th, td {
              border-bottom: 1px solid #eadfce;
              padding: 11px 10px;
              vertical-align: top;
            }
            .money {
              font-weight: 700;
              white-space: nowrap;
            }
            .footer {
              margin-top: 22px;
              color: #6f6257;
              font-size: 12px;
              border-top: 1px solid #eadfce;
              padding-top: 14px;
            }
            @media print {
              body { background: white; padding: 0; }
              .page { border: 0; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div>
                <div class="eyebrow">Casa Luna Boutique Hotel</div>
                <h1>Estado de cuenta</h1>
                <div class="muted">${company}</div>
                <div class="muted">${contact} · ${email} · ${phone}</div>
              </div>
              <div>
                <div class="badge">${health}</div>
                <div class="muted" style="margin-top: 10px;">Corte generado hoy</div>
                <div class="muted">Vence ${formatDate(statementAccount.dueDate)}</div>
              </div>
            </section>

            <section class="grid">
              <div class="box"><div class="label">Límite aprobado</div><div class="value">${money(statementAccount.limit)}</div></div>
              <div class="box"><div class="label">Saldo pendiente</div><div class="value">${money(statementAccount.balance)}</div></div>
              <div class="box"><div class="label">Crédito disponible</div><div class="value">${money(statementAccount.available)}</div></div>
              <div class="box"><div class="label">Uso del límite</div><div class="value">${statementAccount.usage}%</div></div>
            </section>

            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Cargo</th>
                  <th>Pago</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  `<tr><td colspan="5" style="text-align:center;color:#6f6257;padding:24px;">Esta cuenta no tiene movimientos registrados.</td></tr>`
                }
              </tbody>
            </table>

            <div class="footer">
              Documento operativo para revisión de crédito. La emisión fiscal de abonos se realiza desde Facturación FEL.
            </div>
          </main>
          <script>window.onload = () => { window.focus(); window.print(); }</script>
        </body>
      </html>
    `)
    win.document.close()

    toast.success("Estado de cuenta listo para imprimir", {
      description: statementAccount.company,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Clientes al crédito"
        description="Control claro para decidir si una empresa puede reservar al crédito, cuándo debe pagar y qué cuentas necesitan autorización."
        actions={
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => {
              setActiveTab("abono")
              window.setTimeout(() => amountInputRef.current?.focus(), 80)
            }}
          >
            <CreditCard className="size-3.5" />
            Registrar abono
          </Button>
        }
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guía rápida para crédito</h2>
          <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
            Antes de reservar al crédito, revisa si la empresa puede seguir usando crédito.
          </p>
        </div>
        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            {
              icon: Search,
              title: "Busca la empresa",
              text: "Mira cuánto debe, cuándo vence y si todavía tiene cupo.",
            },
            {
              icon: CreditCard,
              title: "Pide abono si debe",
              text: "Si tiene saldo pendiente, registra el pago en la cuenta correcta.",
            },
            {
              icon: ShieldCheck,
              title: "Pide autorización",
              text: "Si está vencida, pausada o sin cupo, pide permiso a administración.",
            },
            {
              icon: FileText,
              title: "Da respaldo",
              text: "Si el cliente lo pide, imprime o muestra su estado de cuenta.",
            },
          ].map((step, index) => {
            const StepIcon = step.icon
            return (
              <div key={step.title} className="min-w-0 rounded-xl border bg-white/75 p-2.5 sm:rounded-2xl sm:p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 sm:size-8 sm:rounded-xl">
                    <StepIcon className="size-4" />
                  </div>
                  <span className="mobile-safe-text text-[0.65rem] font-bold uppercase tracking-wide text-blue-700 sm:text-xs">
                    Paso {index + 1}
                  </span>
                </div>
                <p className="mobile-safe-text mt-2 text-sm font-semibold sm:mt-3 sm:text-base">{step.title}</p>
                <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/75 sm:text-sm">{step.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CreditMetric
          label="Saldo pendiente"
          value={money(totalBalance)}
          helper="Total por cobrar a crédito"
          tone={totalBalance > 0 ? "warning" : "success"}
        />
        <CreditMetric
          label="Crédito disponible"
          value={money(totalAvailable)}
          helper="Límite no utilizado"
          tone="info"
        />
        <CreditMetric
          label="Por vencer"
          value={dueSoon.length}
          helper="Conviene cobrar antes de aceptar más deuda"
          tone={dueSoon.length ? "warning" : "success"}
        />
        <CreditMetric
          label="Sin crédito"
          value={riskyAccounts.length}
          helper="Bloqueados, vencidos o sin margen"
          tone={riskyAccounts.length ? "danger" : "success"}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {receptionSummary.map((metric) => (
          <CreditMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
            tone={metric.tone}
          />
        ))}
      </section>

      {riskyAccounts.length > 0 ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Cuentas que no deberían recibir más crédito</h2>
              <p className="mt-1 text-sm text-red-900/80">
                Pide abono o autorización antes de crear nuevas reservaciones para estas empresas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {riskyAccounts.slice(0, 5).map((account) => (
                <CreditBadge key={account.id} health={account.health} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as CreditTab)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
          <TabsTrigger value="abono">Registrar abono</TabsTrigger>
          <TabsTrigger value="movimientos">Historial</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="cuentas" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_390px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Empresas con crédito</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Filtra por riesgo y abre el detalle antes de aprobar una reserva.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="rounded-2xl pl-9"
                    placeholder="Buscar empresa, contacto, correo..."
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  ["todos", "Todos"],
                  ["al-dia", "Al día"],
                  ["por-vencer", "Por vencer"],
                  ["vencidos", "Vencidos"],
                  ["sin-credito", "Sin crédito"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      view === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:border-primary/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {filteredAccounts.map((account) => (
                  <article
                    key={account.id}
                    className={cn(
                      "cursor-pointer rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                      selectedAccount?.id === account.id &&
                        "border-primary bg-primary/5 ring-2 ring-primary/15",
                    )}
                    onClick={() => selectAccount(account.id)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <Building2 className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{account.company}</h3>
                            <p className="text-sm text-muted-foreground">
                              {account.contact}
                            </p>
                          </div>
                          <CreditBadge health={account.health} />
                        </div>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="text-lg font-bold">{money(account.balance)}</p>
                        <p className="text-xs text-muted-foreground">
                          Disponible {money(account.available)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Uso del límite</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              account.usage >= 100
                                ? "bg-red-500"
                                : account.usage >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                            style={{ width: `${account.usage}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-medium">{account.usage}% utilizado</p>
                      </div>
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Vencimiento</p>
                        <p className="font-semibold">{formatDate(account.dueDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.daysToDue < 0
                            ? `${Math.abs(account.daysToDue)} día(s) vencido`
                            : `${account.daysToDue} día(s) restantes`}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Contacto</p>
                        <p className="truncate font-semibold">{account.phone}</p>
                        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                      </div>
                    </div>
                  </article>
                ))}

                {filteredAccounts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    No hay cuentas que coincidan con ese filtro.
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="rounded-3xl border bg-card p-5 shadow-sm">
              {selectedAccount ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Detalle de crédito
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {selectedAccount.company}
                    </h2>
                    <div className="mt-3">
                      <CreditBadge health={selectedAccount.health} />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">Límite aprobado</p>
                      <p className="mt-1 text-xl font-bold">{money(selectedAccount.limit)}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                      <p className="mt-1 text-xl font-bold">{money(selectedAccount.balance)}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground">Puede usar todavía</p>
                      <p className="mt-1 text-xl font-bold">{money(selectedAccount.available)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border bg-muted/20 p-4 text-sm">
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 text-primary" />
                      {selectedAccount.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 text-primary" />
                      {selectedAccount.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-primary" />
                      Vence {formatDate(selectedAccount.dueDate)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-semibold">Regla operativa</p>
                    <p className="mt-1 text-amber-900/80">
                      Si está vencido, pausado o sin margen, recepción registra el
                      abono o solicita autorización. La decisión de pausar o reanudar
                      queda solo para administración.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Button
                      className="gap-2 rounded-full"
                      onClick={() => preparePayment(selectedAccount)}
                    >
                      <CreditCard className="size-4" />
                      Preparar abono
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={() => void openStatement(selectedAccount)}
                    >
                      <FileText className="size-4" />
                      Ver estado de cuenta
                    </Button>
                    {["pausado", "bloqueado", "vencido", "sin credito"].includes(
                      selectedAccount.health,
                    ) ? (
                      <Button
                        variant="outline"
                        className={cn(
                          "gap-2 rounded-full",
                          selectedPendingRequest
                            ? "border-blue-200 text-blue-800 hover:bg-blue-50"
                            : "border-amber-200 text-amber-900 hover:bg-amber-50",
                        )}
                        onClick={() => requestCreditAuthorization(selectedAccount)}
                        disabled={Boolean(selectedPendingRequest)}
                      >
                        <ShieldCheck className="size-4" />
                        {selectedPendingRequest
                          ? "Solicitud enviada"
                          : "Solicitar autorización"}
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        Esta cuenta puede operar sin permiso adicional.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="abono" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_380px]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold">Registrar abono</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra el pago recibido. Facturación FEL puede emitir el documento correspondiente.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Cliente
                  <select
                    value={payment.accountId}
                    onChange={(event) => {
                      setPayment((current) => ({
                        ...current,
                        accountId: event.target.value,
                      }))
                      setSelectedAccountId(event.target.value)
                    }}
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.company} · saldo {money(account.balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Monto recibido
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      Q.
                    </span>
                    <Input
                      ref={amountInputRef}
                      type="number"
                      min={0}
                      value={payment.amount || ""}
                      onChange={(event) =>
                        setPayment((current) => ({
                          ...current,
                          amount:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Referencia del pago
                  <Input
                    value={payment.reference}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="Boleta, transferencia, POS..."
                  />
                </label>

                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Factura o recibo vinculado
                  <Input
                    value={payment.invoice}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        invoice: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                    placeholder="Opcional: FAC-A-00130"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  className="gap-2 rounded-full"
                  onClick={registerPayment}
                  disabled={!paymentValid}
                >
                  <ReceiptText className="size-4" />
                  Registrar abono
                </Button>
              </div>
            </div>

            <aside className="rounded-3xl border bg-card p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Después del abono
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                {paymentAccount?.company ?? "Selecciona cliente"}
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Saldo actual</p>
                  <p className="mt-1 text-xl font-bold">
                    {paymentAccount ? money(paymentAccount.balance) : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Saldo posterior</p>
                  <p className="mt-1 text-xl font-bold">
                    {paymentAccount
                      ? money(Math.max(0, paymentAccount.balance - payment.amount))
                      : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Crédito disponible posterior</p>
                  <p className="mt-1 text-xl font-bold">
                    {paymentAccount
                      ? money(
                          Math.min(
                            paymentAccount.limit,
                            paymentAccount.available + payment.amount,
                          ),
                        )
                      : "-"}
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="movimientos">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold">Historial de crédito</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cargos y pagos parciales registrados para cuentas al crédito.
              </p>
            </div>

            <div className="touch-scroll mt-5 overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Cargo</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {creditMovements.map((movement) => {
                    const account = accounts.find(
                      (item) => item.id === movement.accountId,
                    )
                    return (
                      <tr key={movement.id} className="border-t">
                        <td className="px-4 py-3">{formatDate(movement.date)}</td>
                        <td className="px-4 py-3 font-medium">
                          {account?.company ?? "Sin cuenta"}
                        </td>
                        <td className="px-4 py-3">{movement.concept}</td>
                        <td className="px-4 py-3">{money(movement.charge)}</td>
                        <td className="px-4 py-3">{money(movement.payment)}</td>
                        <td className="px-4 py-3">{movement.reference}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="backend">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Endpoints sugeridos para Crédito</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {[
                ["GET", "/api/credit/accounts", "Listado para recepción con límite, saldo, vencimiento, estado operativo y crédito disponible."],
                ["GET", "/api/credit/accounts/{id}/movements", "Movimientos de la cuenta para historial y estado de cuenta."],
                ["GET", "/api/credit/accounts/{id}/statement", "Estado de cuenta imprimible por empresa, sin mostrar otras cuentas."],
                ["POST", "/api/credit/accounts/{id}/payments", "Registrar abono recibido, referencia y documento vinculado."],
                ["GET", "/api/credit/authorization-requests?status=pending", "Ver si una empresa ya tiene solicitud pendiente para no duplicarla."],
                ["POST", "/api/credit/authorization-requests", "Recepción solicita permiso para operar una cuenta pausada, vencida o sin margen."],
                ["POST", "/api/invoices/issue", "Emitir documento FEL del abono cuando aplique."],
                ["GET", "/api/credit/report/reception-summary", "Resumen para recepcion: por vencer, vencidas, sin margen y abonos del dia."],
              ].map(([method, endpoint, description]) => (
                <div key={endpoint} className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                      {method}
                    </span>
                    <code className="text-sm font-semibold">{endpoint}</code>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {statementAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Estado de cuenta
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {statementAccount.company}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Corte generado hoy · vence {formatDate(statementAccount.dueDate)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full"
                  onClick={printStatement}
                >
                  <FileText className="size-4" />
                  Imprimir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Cerrar estado de cuenta"
                  onClick={() => setStatementAccount(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Límite aprobado</p>
                  <p className="mt-1 text-xl font-bold">{money(statementAccount.limit)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p className="mt-1 text-xl font-bold">{money(statementAccount.balance)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Crédito disponible</p>
                  <p className="mt-1 text-xl font-bold">{money(statementAccount.available)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-2">
                    <CreditBadge health={statementAccount.health} />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">Contacto</p>
                  <p className="mt-1 font-semibold">{statementAccount.contact}</p>
                  <p className="text-sm text-muted-foreground">{statementAccount.phone}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4 md:col-span-2">
                  <p className="text-xs text-muted-foreground">Correo para envío</p>
                  <p className="mt-1 font-semibold">{statementAccount.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Este estado se puede imprimir o enviar por correo cuando el servidor lo genere como documento.
                  </p>
                </div>
              </div>

              {statementLoading ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Consultando estado de cuenta en /api/credit/accounts/{statementAccount.id}/statement...
                </div>
              ) : null}

              <div className="touch-scroll overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Concepto</th>
                      <th className="px-4 py-3">Cargo</th>
                      <th className="px-4 py-3">Pago</th>
                      <th className="px-4 py-3">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementMovements.map((movement) => (
                      <tr key={movement.id} className="border-t">
                        <td className="px-4 py-3">{formatDate(movement.date)}</td>
                        <td className="px-4 py-3">{movement.concept}</td>
                        <td className="px-4 py-3 font-medium">{money(movement.charge)}</td>
                        <td className="px-4 py-3 font-medium">{money(movement.payment)}</td>
                        <td className="px-4 py-3">{movement.reference}</td>
                      </tr>
                    ))}
                    {statementMovements.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Esta cuenta no tiene movimientos registrados.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default RecepcionCreditoPage
