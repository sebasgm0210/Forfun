import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  FileText,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, getApiErrorMessage } from "@/lib/api"
import { printOfficialInvoice } from "@/lib/invoice-document"

type InvoiceStatusFilter = "todas" | "emitidas" | "anuladas"

type InvoiceRow = {
  id: string
  status: string
  statusLabel: string
  isCancelled: boolean
  authorization: string
  series: string
  number: string
  customerNit: string
  customerName: string
  sourceModule: string
  sourceId: string
  issuedAt: string
  total: number
  raw: unknown
}

type DteSummary = {
  total?: number
  used?: number
  remaining?: number
  message?: string
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function unwrapData(value: unknown) {
  const root = record(value)
  const data = record(root.data)
  return Object.keys(data).length > 0 ? data : root
}

function stringValue(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function numberValue(source: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key]
    const numeric = typeof value === "number" ? value : Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return fallback
}

function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const root = record(value)
  const data = root.data
  if (Array.isArray(data)) return data

  const dataRecord = record(data)
  for (const key of ["items", "results", "records", "invoices", "facturas", "data"]) {
    const candidate = dataRecord[key]
    if (Array.isArray(candidate)) return candidate
  }

  for (const key of ["items", "results", "records", "invoices", "facturas"]) {
    const candidate = root[key]
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function normalizeStatus(value: string) {
  const text = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

  if (
    text.includes("anul") ||
    text.includes("voided") ||
    text.includes("annul")
  ) {
    return {
      label: "Anulada",
      isCancelled: true,
    }
  }

  if (text.includes("cancel")) {
    return {
      label: "Cancelada",
      isCancelled: false,
    }
  }

  if (
    text.includes("emit") ||
    text.includes("issued") ||
    text.includes("cert") ||
    text.includes("valid") ||
    text.includes("active")
  ) {
    return {
      label: "Emitida",
      isCancelled: false,
    }
  }

  return {
    label: value || "Emitida",
    isCancelled: false,
  }
}

function invoiceFromResponse(item: unknown): InvoiceRow | null {
  const itemRecord = unwrapData(item)
  const id = stringValue(itemRecord, [
    "id_invoice",
    "idInvoice",
    "invoice_id",
    "invoiceId",
    "id",
  ])

  const status = stringValue(itemRecord, [
    "status",
    "invoice_status",
    "invoiceStatus",
    "fel_status",
    "felStatus",
    "digifact_status",
    "digifactStatus",
  ], "Emitida")
  const normalized = normalizeStatus(status)

  const row: InvoiceRow = {
    id,
    status,
    statusLabel: normalized.label,
    isCancelled: normalized.isCancelled,
    authorization: stringValue(itemRecord, [
      "digifact_auth_number",
      "digifactAuthNumber",
      "authorization_number",
      "authorizationNumber",
      "certification_uuid",
      "uuid",
    ]),
    series: stringValue(itemRecord, [
      "digifact_serie",
      "digifactSerie",
      "series",
      "serie",
    ]),
    number: stringValue(itemRecord, [
      "digifact_numero",
      "digifactNumero",
      "dte_number",
      "dteNumber",
      "correlativo",
      "number",
      "invoice_number",
      "invoiceNumber",
    ]),
    customerNit: stringValue(itemRecord, [
      "buyer_tax_id",
      "buyerTaxId",
      "customer_nit",
      "customerNit",
      "nit",
    ], "CF"),
    customerName: stringValue(itemRecord, [
      "buyer_name",
      "buyerName",
      "customer_name",
      "customerName",
      "guest_name",
      "guestName",
      "name",
    ], "Consumidor final"),
    sourceModule: stringValue(itemRecord, [
      "source_module",
      "sourceModule",
      "module",
    ]),
    sourceId: stringValue(itemRecord, [
      "source_id",
      "sourceId",
      "id_source",
      "idSource",
    ]),
    issuedAt: stringValue(itemRecord, [
      "issued_at",
      "issuedAt",
      "created_at",
      "createdAt",
      "certification_date",
      "certificationDate",
    ]),
    total: numberValue(itemRecord, [
      "total_amount",
      "totalAmount",
      "grand_total",
      "grandTotal",
      "total",
    ]),
    raw: item,
  }

  if (!row.id && !row.authorization && !row.number) return null
  return row
}

function dteSummaryFromResponse(value: unknown): DteSummary {
  const data = unwrapData(value)
  const remaining = numberValue(data, [
    "remaining_quantity",
    "remainingQuantity",
    "documents_remaining",
    "documentsRemaining",
    "available_quantity",
    "availableQuantity",
    "remaining",
    "available",
  ], Number.NaN)
  const used = numberValue(data, [
    "used_quantity",
    "usedQuantity",
    "used_documents",
    "usedDocuments",
    "used",
  ], Number.NaN)
  const total = numberValue(data, [
    "total_quantity",
    "totalQuantity",
    "purchased_quantity",
    "purchasedQuantity",
    "documents_total",
    "documentsTotal",
    "total",
  ], Number.NaN)

  return {
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    used: Number.isFinite(used) ? used : undefined,
    total: Number.isFinite(total) ? total : undefined,
    message: stringValue(data, ["message", "description"]),
  }
}

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function formatDateTime(value: string) {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function dteEndpointAvailable(summary: DteSummary | null) {
  if (!summary) return false
  const hasNumbers =
    summary.remaining !== undefined ||
    summary.used !== undefined ||
    summary.total !== undefined
  const message = summary.message
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

  if (message?.includes("sin endpoint") || message?.includes("no endpoint")) {
    return false
  }

  return hasNumbers
}

function statusClass(row: InvoiceRow) {
  return row.isCancelled
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800"
}

export default function AdminFacturacionPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [dteSummary, setDteSummary] = useState<DteSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("todas")
  const [query, setQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [canceling, setCanceling] = useState(false)

  async function loadInvoices() {
    setLoading(true)
    try {
      const [invoiceResult, remainingResult] = await Promise.allSettled([
        api.invoices.list<unknown>(),
        api.invoices.getRemaining<unknown>(),
      ])

      if (invoiceResult.status === "fulfilled") {
        const rows = firstArray(invoiceResult.value)
          .map(invoiceFromResponse)
          .filter((row): row is InvoiceRow => Boolean(row))
        setInvoices(rows)
      } else {
        toast.error("No se pudo cargar el historial de facturas.", {
          description: getApiErrorMessage(invoiceResult.reason),
        })
      }

      if (remainingResult.status === "fulfilled") {
        setDteSummary(dteSummaryFromResponse(remainingResult.value))
      } else {
        setDteSummary(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvoices()
  }, [statusFilter])

  const filteredInvoices = useMemo(() => {
    const text = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesText =
        !text ||
        [
          invoice.id,
          invoice.status,
          invoice.statusLabel,
          invoice.authorization,
          invoice.series,
          invoice.number,
          invoice.customerNit,
          invoice.customerName,
          invoice.sourceModule,
          invoice.sourceId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text)

      const issuedDate = invoice.issuedAt ? invoice.issuedAt.slice(0, 10) : ""
      const matchesFrom = !fromDate || !issuedDate || issuedDate >= fromDate
      const matchesTo = !toDate || !issuedDate || issuedDate <= toDate
      const matchesStatus =
        statusFilter === "todas" ||
        (statusFilter === "emitidas" && !invoice.isCancelled) ||
        (statusFilter === "anuladas" && invoice.isCancelled)

      return matchesText && matchesFrom && matchesTo && matchesStatus
    })
  }, [fromDate, invoices, query, statusFilter, toDate])

  const emittedCount = invoices.filter((invoice) => !invoice.isCancelled).length
  const cancelledCount = invoices.filter((invoice) => invoice.isCancelled).length
  const emittedTotal = invoices
    .filter((invoice) => !invoice.isCancelled)
    .reduce((sum, invoice) => sum + invoice.total, 0)
  const hasDteEndpointData = dteEndpointAvailable(dteSummary)

  async function reprintInvoice(invoice: InvoiceRow) {
    const invoiceId = invoice.id || invoice.authorization
    if (!invoiceId) {
      toast.error("La factura no tiene identificador para reimprimir.")
      return
    }

    try {
      await printOfficialInvoice(invoiceId, invoice.raw)
    } catch (error) {
      toast.error("No se pudo abrir la factura para imprimir.", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      })
    }
  }

  async function cancelInvoice() {
    if (!cancelTarget) return
    const invoiceId = cancelTarget.id || cancelTarget.authorization
    if (!invoiceId) {
      toast.error("La factura no tiene identificador para anular.")
      return
    }

    const reason = cancelReason.trim()
    if (reason.length < 6) {
      toast.error("Escribí un motivo de anulación más claro.")
      return
    }

    setCanceling(true)
    try {
      await api.invoices.cancel(invoiceId, {
        reason,
        notes: `Anulación solicitada desde Administración / Facturación. ${reason}`,
      })
      toast.success("Factura anulada formalmente.", {
        description: cancelTarget.number
          ? `Factura #${cancelTarget.number}`
          : cancelTarget.authorization || cancelTarget.id,
      })
      setCancelTarget(null)
      setCancelReason("")
      await loadInvoices()
    } catch (error) {
      toast.error("No se pudo anular la factura.", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Facturación FEL"
        description="Historial de facturas, control de DTEs, reimpresión y anulación."
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Emitidas
          </p>
          <p className="mt-2 text-3xl font-semibold">{emittedCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">{money(emittedTotal)}</p>
        </div>
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Anuladas
          </p>
          <p className="mt-2 text-3xl font-semibold">{cancelledCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Filtrables en historial</p>
        </div>
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            DTE restantes
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {hasDteEndpointData ? dteSummary?.remaining ?? "N/D" : "No disponible"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasDteEndpointData && dteSummary?.total
              ? `Total comprado: ${dteSummary.total}`
              : "Pendiente de dato real del backend"}
          </p>
        </div>
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            DTE usados
          </p>
          <p className="mt-2 text-3xl font-semibold">
            {hasDteEndpointData ? dteSummary?.used ?? "N/D" : "No disponible"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasDteEndpointData
              ? "Dato devuelto por backend"
              : "No se inventan DTEs en frontend"}
          </p>
        </div>
      </section>

      {!hasDteEndpointData ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">DTE restantes no disponible desde backend</p>
              <p className="mt-1 text-sm">
                La vista no está usando datos mock. El endpoint de DTEs debe devolver usados/restantes reales del entorno DIGIFACT/SAT para mostrar estos contadores.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">
              Buscar
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadInvoices()
                  }}
                  placeholder="NIT, cliente, serie, número..."
                  className="h-10 w-full rounded-2xl border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            <label className="space-y-1 text-sm font-medium">
              Estado
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
                className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="todas">Todas</option>
                <option value="emitidas">Emitidas</option>
                <option value="anuladas">Anuladas</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium">
              Desde
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="space-y-1 text-sm font-medium">
              Hasta
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <Button
            type="button"
            className="gap-2 rounded-full"
            onClick={() => void loadInvoices()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Los contadores superiores salen del historial completo devuelto por el backend. Los filtros solo cambian la lista visible.
        </p>
      </section>

      <section className="rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Historial de facturas</p>
            <p className="text-sm text-muted-foreground">
              {filteredInvoices.length} resultado(s) visibles.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
              Emitidas {emittedCount}
            </span>
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-800">
              Anuladas {cancelledCount}
            </span>
          </div>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              Cargando facturas...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay facturas con los filtros actuales.
            </div>
          ) : (
            filteredInvoices.map((invoice) => (
              <article
                key={`${invoice.id}-${invoice.authorization}-${invoice.number}`}
                className="grid gap-4 p-4 xl:grid-cols-[1.4fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(invoice)}`}>
                      {invoice.statusLabel}
                    </span>
                    <p className="font-semibold">
                      {invoice.series ? `${invoice.series}-` : ""}
                      {invoice.number || invoice.id || "Sin número"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.customerName} · NIT {invoice.customerNit || "CF"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Autorización {invoice.authorization || "No reportada"}
                  </p>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatDateTime(invoice.issuedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Origen</p>
                    <p className="font-medium">
                      {invoice.sourceModule || "No reportado"}
                      {invoice.sourceId ? ` #${invoice.sourceId}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold">{money(invoice.total)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full"
                    onClick={() => void reprintInvoice(invoice)}
                  >
                    <Printer className="size-4" />
                    Reimprimir
                  </Button>

                  {!invoice.isCancelled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => {
                        setCancelTarget(invoice)
                        setCancelReason("")
                      }}
                    >
                      <Ban className="size-4" />
                      Anular FEL/SAT
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                      <BadgeCheck className="size-3.5" />
                      Anulada FEL/SAT
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (open) return
          if (canceling) return
          setCancelTarget(null)
          setCancelReason("")
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Anular FEL/SAT factura FEL/SAT</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción llama al endpoint real de anulación. La factura debe quedar anulada formalmente en SAT por medio del certificador DIGIFACT; no se marca localmente si el endpoint falla.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cancelTarget ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {cancelTarget.series ? `${cancelTarget.series}-` : ""}
                    {cancelTarget.number || cancelTarget.id}
                  </p>
                  <p>{cancelTarget.customerName} · {money(cancelTarget.total)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <label className="space-y-1 text-sm font-medium">
            Motivo de anulación
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ej. Error en datos fiscales, factura duplicada, corrección solicitada..."
              className="min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={canceling}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void cancelInvoice()
              }}
              disabled={canceling}
            >
              {canceling ? "Anulando..." : "Anular FEL/SAT factura FEL/SAT"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
