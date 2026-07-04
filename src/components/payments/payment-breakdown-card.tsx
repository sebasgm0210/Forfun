import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CreditCard, Plus, Printer, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, localDateIso } from "@/lib/utils"
import type { PaymentMethod, PaymentRecord, PaymentStage } from "@/lib/types"

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "deposito", label: "Depósito bancario" },
  { value: "credito", label: "Crédito" },
]

const stageLabels: Record<PaymentStage, string> = {
  reserva: "Reserva",
  "check-in": "Check-in",
  "check-out": "Check-out",
}

export function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

export function paymentTotal(payments: PaymentRecord[]) {
  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

export function paymentRecordKey(payment: PaymentRecord) {
  return [
    payment.backendPaymentType ?? "local",
    payment.backendPaymentId ?? payment.id,
    payment.issueSourceModule ?? payment.stage,
    payment.issueSourceId ?? "",
  ].join(":")
}

function clampPaymentAmount(value: number, max: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), Math.max(max, 0))
}

export function paymentTotalByMethod(
  payments: PaymentRecord[],
  method: PaymentMethod,
) {
  return payments
    .filter((payment) => payment.method === method)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

export function paymentMethodLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.value === method)?.label ?? method
}

export function createPaymentRecord(
  stage: PaymentStage,
  method: PaymentMethod = "efectivo",
): PaymentRecord {
  return {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method,
    amount: 0,
    reference: "",
    stage,
    date: localDateIso(),
  }
}

type PaymentBreakdownCardProps = {
  title: string
  description?: string
  total: number
  payments: PaymentRecord[]
  onChange?: (payments: PaymentRecord[]) => void
  isPaymentReadOnly?: (payment: PaymentRecord) => boolean
  isPaymentRemovable?: (payment: PaymentRecord) => boolean
  stage: PaymentStage
  allowCredit?: boolean
  creditInfo?: {
    available: number
    limit?: number
    balance?: number
    label?: string
    disabledReason?: string
  }
  creditProjectionLabel?: string
  readOnly?: boolean
  addLabel?: string
  paidLabel?: string
  emptyLabel?: string
  referencePlaceholder?: string
  onPrintPayment?: (payment: PaymentRecord) => void
  showInvoiceStatus?: boolean
  onApplyPayment?: (payment: PaymentRecord) => void
  applyLabel?: string
  requireApply?: boolean
  autoApplyHint?: string | null
  headerLayout?: "stacked" | "inline"
  className?: string
}

export function PaymentBreakdownCard({
  title,
  description,
  total,
  payments,
  onChange,
  isPaymentReadOnly,
  isPaymentRemovable,
  stage,
  allowCredit = false,
  creditInfo,
  creditProjectionLabel,
  readOnly = false,
  addLabel = "Agregar pago",
  paidLabel = "Pagos registrados",
  emptyLabel,
  referencePlaceholder = "Boleta, voucher, autorización...",
  onPrintPayment,
  showInvoiceStatus = false,
  onApplyPayment,
  applyLabel = "Aplicar",
  requireApply = false,
  autoApplyHint = "El monto queda aplicado automáticamente al escribirlo.",
  headerLayout = "stacked",
  className,
}: PaymentBreakdownCardProps) {
  const [draftPayments, setDraftPayments] = useState<PaymentRecord[]>(payments)
  const editablePayments = requireApply ? draftPayments : payments
  const appliedPaymentIds = useMemo(
    () => new Set(payments.map(paymentRecordKey)),
    [payments],
  )
  const paid = paymentTotal(payments)
  const balance = Math.max(0, total - paid)
  const overpaid = Math.max(0, paid - total)
  const canEdit = !readOnly && Boolean(onChange)
  const creditAvailable = Math.max(0, Number(creditInfo?.available ?? 0))
  const canUseCredit = allowCredit && creditAvailable > 0 && !creditInfo?.disabledReason
  const creditPendingUsage = paymentTotal(
    payments.filter(
      (payment) =>
        payment.method === "credito" &&
        !payment.backendPaymentId &&
        !payment.backendPaymentType &&
        !payment.issueSourceId &&
        !payment.issueSourceModule &&
        !/^\d+$/.test(payment.id),
    ),
  )
  const projectedCreditAvailable = Math.max(0, creditAvailable - creditPendingUsage)
  const creditDisplayAvailable =
    creditPendingUsage > 0 ? projectedCreditAvailable : creditAvailable
  const availableMethods = canUseCredit
    ? paymentMethods
    : paymentMethods.filter((method) => method.value !== "credito")

  function paymentIsInvoicedForCollapse(payment: PaymentRecord) {
    return (
      Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
      (Number.isFinite(payment.invoicedAmount) &&
        Number(payment.invoicedAmount) > 0.01) ||
      (Number.isFinite(payment.pendingToInvoiceAmount) &&
        Number(payment.pendingToInvoiceAmount) <= 0.01)
    )
  }

  const [showInvoicedPayments, setShowInvoicedPayments] = useState(false)
  const invoicedPaymentCount = showInvoiceStatus
    ? editablePayments.filter(paymentIsInvoicedForCollapse).length
    : 0
  const shouldCollapseInvoicedPayments = showInvoiceStatus && invoicedPaymentCount >= 2
  const visiblePayments = shouldCollapseInvoicedPayments && !showInvoicedPayments
    ? editablePayments.filter((payment) => !paymentIsInvoicedForCollapse(payment))
    : editablePayments

  useEffect(() => {
    if (!requireApply) {
      setDraftPayments(payments)
      return
    }

    setDraftPayments((current) => {
      const appliedIds = new Set(payments.map(paymentRecordKey))
      const pendingDrafts = current.filter((payment) => !appliedIds.has(paymentRecordKey(payment)))
      return [...payments, ...pendingDrafts]
    })
  }, [payments, requireApply])

  function creditMaxAmount(paymentKey: string) {
    const otherCreditTotal = paymentTotal(
      editablePayments.filter(
        (payment) =>
          paymentRecordKey(payment) !== paymentKey && payment.method === "credito",
      ),
    )
    return Math.max(0, creditAvailable - otherCreditTotal)
  }

  function paymentMaxAmount(paymentKey: string, method?: PaymentMethod) {
    const otherPaymentsTotal = paymentTotal(
      editablePayments.filter((payment) => paymentRecordKey(payment) !== paymentKey),
    )
    const maxByBalance = Math.max(0, total - otherPaymentsTotal)
    return method === "credito"
      ? Math.min(maxByBalance, creditMaxAmount(paymentKey))
      : maxByBalance
  }

  function updatePayment(paymentKey: string, patch: Partial<PaymentRecord>) {
    const currentPayment = editablePayments.find(
      (payment) => paymentRecordKey(payment) === paymentKey,
    )
    if (!currentPayment || isPaymentReadOnly?.(currentPayment)) return

    if (patch.method === "credito" && !canUseCredit && currentPayment.method !== "credito") {
      return
    }

    const nextMethod = patch.method ?? currentPayment.method
    const amountPatch =
      patch.amount !== undefined
        ? patch.amount
        : patch.method !== undefined
          ? currentPayment.amount
          : undefined
    const nextPatch =
      amountPatch === undefined
        ? patch
        : {
            ...patch,
            amount: clampPaymentAmount(amountPatch, paymentMaxAmount(paymentKey, nextMethod)),
          }

    if (requireApply) {
      setDraftPayments((current) =>
        current.map((payment) =>
          paymentRecordKey(payment) === paymentKey ? { ...payment, ...nextPatch } : payment,
        ),
      )
      return
    }

    onChange?.(
      payments.map((payment) =>
        paymentRecordKey(payment) === paymentKey ? { ...payment, ...nextPatch } : payment,
      ),
    )
  }

  function removePayment(paymentKey: string) {
    const currentPayment = editablePayments.find(
      (payment) => paymentRecordKey(payment) === paymentKey,
    )
    const canRemoveCurrentPayment =
      currentPayment && (isPaymentRemovable?.(currentPayment) ?? !isPaymentReadOnly?.(currentPayment))
    if (!currentPayment || !canRemoveCurrentPayment) return

    if (requireApply) {
      setDraftPayments((current) =>
        current.filter((payment) => paymentRecordKey(payment) !== paymentKey),
      )
      if (appliedPaymentIds.has(paymentKey)) {
        onChange?.(
          payments.filter((payment) => paymentRecordKey(payment) !== paymentKey),
        )
      }
      return
    }

    onChange?.(
      payments.filter((payment) => paymentRecordKey(payment) !== paymentKey),
    )
  }

  function addPayment() {
    if (balance <= 0) return
    if (requireApply) {
      setDraftPayments((current) => [...current, createPaymentRecord(stage)])
      return
    }

    onChange?.([...payments, createPaymentRecord(stage)])
  }

  function applyPayment(payment: PaymentRecord) {
    const paymentKey = paymentRecordKey(payment)
    const amount = clampPaymentAmount(
      Number(payment.amount || 0),
      paymentMaxAmount(paymentKey, payment.method),
    )
    if (amount <= 0) return

    const nextPayment = { ...payment, amount }
    const nextPayments = appliedPaymentIds.has(paymentKey)
      ? payments.map((entry) =>
          paymentRecordKey(entry) === paymentKey ? nextPayment : entry,
        )
      : [...payments, nextPayment]

    setDraftPayments((current) =>
      current.map((entry) =>
        paymentRecordKey(entry) === paymentKey ? nextPayment : entry,
      ),
    )
    onChange?.(nextPayments)
    onApplyPayment?.(nextPayment)
  }

  return (
    <section className={cn("min-w-0 rounded-3xl border bg-background p-4", className)}>
      <div
        className={cn(
          "flex flex-col gap-3",
          headerLayout === "inline" && "lg:flex-row lg:items-start lg:justify-between",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "justify-center gap-2 rounded-full border-2 border-emerald-600 bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300/60 ring-offset-1 ring-offset-background transition hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-700",
              headerLayout === "inline"
                ? "w-full px-4 lg:w-auto lg:shrink-0"
                : "w-full px-4 sm:w-auto sm:self-start",
            )}
            disabled={balance <= 0}
            onClick={addPayment}
          >
            <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs font-bold leading-none">
              Q.
            </span>
            <Plus className="size-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-3">
        <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Total a cubrir</p>
          <p className="mt-1 truncate text-lg font-bold">{money(total)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{paidLabel}</p>
          <p className="mt-1 truncate text-lg font-bold">{money(paid)}</p>
        </div>
        <div
          className={cn(
            "min-w-0 rounded-2xl border p-3",
            balance > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : overpaid > 0
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          <p className="text-xs">
            {overpaid > 0 ? "Excedente" : balance > 0 ? "Saldo" : "Completo"}
          </p>
          <p className="mt-1 truncate text-lg font-bold">
            {money(overpaid > 0 ? overpaid : balance)}
          </p>
        </div>
        {allowCredit ? (
          <div
            className={cn(
              "min-w-0 rounded-2xl border p-3",
              canUseCredit
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-zinc-200 bg-zinc-50 text-zinc-700",
            )}
          >
            <p className="text-xs">
              {canUseCredit ? "Crédito disponible" : "Crédito"}
            </p>
            <p className="mt-1 truncate text-lg font-bold">
              {money(creditDisplayAvailable)}
            </p>
            <p className="mt-1 space-y-1 text-xs">
              {creditPendingUsage > 0 && canUseCredit ? (
                <>
                  <span className="block">
                    Usando {money(creditPendingUsage)} de crédito.
                  </span>
                  <span className="block font-semibold">
                    {(creditProjectionLabel ?? "Si se guarda este pago, el nuevo crédito será")}{" "}
                    {money(projectedCreditAvailable)}.
                  </span>
                </>
              ) : (
                creditInfo?.disabledReason ??
                creditInfo?.label ??
                (canUseCredit ? "Disponible para este cliente" : "No disponible para este cliente")
              )}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            {emptyLabel ?? `Aún no hay pagos registrados para ${stageLabels[stage].toLowerCase()}.`}
          </div>
        ) : null}

        {shouldCollapseInvoicedPayments ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 shadow-sm ring-2 ring-blue-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-blue-950">
                {showInvoicedPayments
                  ? "Pagos facturados visibles"
                  : `${invoicedPaymentCount} pagos facturados están ocultos`}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-blue-300 bg-white px-4 text-sm font-semibold text-blue-900 shadow-sm animate-pulse hover:bg-blue-100"
                onClick={() => setShowInvoicedPayments((current) => !current)}
              >
                {showInvoicedPayments
                  ? "Ocultar pagos facturados"
                  : `Mostrar pagos facturados (${invoicedPaymentCount})`}
              </Button>
            </div>
          </div>
        ) : null}

        {visiblePayments.map((payment) => {
          const paymentKey = paymentRecordKey(payment)
          const methodOptions =
            payment.method === "credito" && !availableMethods.some((method) => method.value === "credito")
              ? [...availableMethods, { value: "credito" as const, label: "Crédito" }]
              : availableMethods
          const maxAmount = paymentMaxAmount(paymentKey, payment.method)
          const isApplied = requireApply && appliedPaymentIds.has(paymentKey)
          const paymentLockedByParent = Boolean(isPaymentReadOnly?.(payment))
          const paymentReadOnly = !canEdit || isApplied || paymentLockedByParent
          const paymentIsLocalDraft =
            !payment.backendPaymentId &&
            !payment.backendPaymentType &&
            !payment.issueSourceId &&
            !payment.issueSourceModule &&
            !/^\d+$/.test(String(payment.id))
          const paymentRemovableByParent =
            isPaymentRemovable?.(payment) ?? !paymentLockedByParent
          const canRemovePayment = canEdit && (paymentRemovableByParent || paymentIsLocalDraft)
          const paymentAmount = Math.max(0, Number(payment.amount || 0))
          const isPaymentInvoiced =
            Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
            (Number.isFinite(payment.invoicedAmount) &&
              Number(payment.invoicedAmount) > 0.01) ||
            (Number.isFinite(payment.pendingToInvoiceAmount) &&
              Number(payment.pendingToInvoiceAmount) <= 0.01)
          const pendingToInvoice = isPaymentInvoiced ? 0 : paymentAmount
          const invoiceStatus = isPaymentInvoiced
            ? payment.invoiceId
              ? `Facturado #${payment.invoiceId}`
              : "Facturado"
            : "No facturado"

          return (
            <div
              key={paymentKey}
              className={cn(
                "min-w-0 rounded-2xl border p-3",
                isApplied ? "border-emerald-200 bg-emerald-50/55" : "bg-muted/10",
              )}
            >
            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-2">
            <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
              Fecha
              <Input
                type="date"
                value={payment.date}
                disabled={paymentReadOnly}
                onChange={(event) =>
                  updatePayment(paymentKey, { date: event.target.value })
                }
                className="min-w-0 rounded-2xl"
              />
            </label>

            <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
              Metodo
              {!paymentReadOnly ? (
                <select
                  value={payment.method}
                  onChange={(event) =>
                    updatePayment(paymentKey, {
                      method: event.target.value as PaymentMethod,
                    })
                  }
                  className="h-10 w-full min-w-0 rounded-2xl border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {methodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-10 min-w-0 items-center rounded-2xl border bg-background px-3 text-sm font-semibold text-foreground">
                  {paymentMethodLabel(payment.method)}
                </div>
              )}
            </label>

            <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
              Monto
              <Input
                type="number"
                min={0}
                max={maxAmount}
                inputMode="decimal"
                value={payment.amount || ""}
                disabled={paymentReadOnly}
                onChange={(event) =>
                  updatePayment(paymentKey, {
                    amount:
                      event.target.value === ""
                        ? 0
                        : clampPaymentAmount(Number(event.target.value), maxAmount),
                  })
                }
                onKeyDown={(event) => {
                  if (["e", "E", "+", "-"].includes(event.key)) {
                    event.preventDefault()
                  }
                }}
                className="min-w-0 rounded-2xl"
              />
            </label>

            <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
              Referencia
              <Input
                value={payment.reference ?? ""}
                disabled={paymentReadOnly}
                onChange={(event) =>
                  updatePayment(paymentKey, { reference: event.target.value })
                }
                className="min-w-0 rounded-2xl"
                placeholder={referencePlaceholder}
              />
            </label>

            </div>

            <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {stageLabels[payment.stage]}
                </span>
                {showInvoiceStatus && paymentAmount > 0 ? (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-semibold",
                      pendingToInvoice <= 0.01
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700",
                    )}
                  >
                    {invoiceStatus}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {requireApply ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5 rounded-full",
                      isApplied
                        ? "border-slate-200 bg-slate-100 text-slate-600"
                        : "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
                    )}
                    onClick={() => applyPayment(payment)}
                    disabled={isApplied || Number(payment.amount || 0) <= 0}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {isApplied ? "Abono aplicado" : applyLabel}
                  </Button>
                ) : null}
                {onPrintPayment ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => onPrintPayment(payment)}
                    title="Recibo sin factura"
                    aria-label="Recibo sin factura"
                  >
                    <Printer className="size-4" />
                  </Button>
                ) : null}
                {canRemovePayment ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={() => removePayment(paymentKey)}
                    aria-label={isApplied ? "Quitar abono aplicado" : "Quitar pago"}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )})}

        {canEdit && payments.length > 0 && !requireApply && autoApplyHint ? (
          <p className="px-1 text-xs text-muted-foreground">
            {autoApplyHint}
          </p>
        ) : null}
      </div>
    </section>
  )
}
