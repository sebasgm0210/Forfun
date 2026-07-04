import { useEffect, useState } from "react"
import { CreditCard, FileText, RefreshCw, Settings2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import {
  FieldGrid,
  MiniTable,
  SectionCard,
  StatCard,
  StatusPill,
  Workflow,
} from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"

type InvoiceRemainingSummary = {
  total?: number
  used?: number
  remaining?: number
}

type InvoiceAdminRow = {
  id: string
  number: string
  customer: string
  nit: string
  total: number
  status: string
}

type InvoiceConceptAdminRow = {
  id: string
  name: string
  itemType: string
  defaultDescription: string
  defaultPrice: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  return Array.isArray(record.data) ? record.data : []
}

function textFrom(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function numberFrom(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value === undefined || value === null || value === "") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function mapInvoiceAdminRows(value: unknown): InvoiceAdminRow[] {
  return asArray(value).map((item, index) => {
    const row = asRecord(item)
    const serie = textFrom(row, ["serie", "series"])
    const number = textFrom(row, ["number", "numero", "invoice_number"], `Factura ${index + 1}`)
    return {
      id: textFrom(row, ["id_invoice", "idInvoice", "id"], String(index + 1)),
      number: serie ? `${serie}-${number}` : number,
      customer: textFrom(row, ["customer", "customer_name", "client_name", "buyer_name"], "Cliente"),
      nit: textFrom(row, ["nit", "tax_id", "taxId"], "CF"),
      total: numberFrom(row, ["total", "total_amount", "amount"]) ?? 0,
      status: textFrom(row, ["status"], "Vigente"),
    }
  })
}

function mapInvoiceConceptRows(value: unknown): InvoiceConceptAdminRow[] {
  return asArray(value).map((item, index) => {
    const row = asRecord(item)
    return {
      id: textFrom(row, ["id_invoice_concept", "idInvoiceConcept", "id"], String(index + 1)),
      name: textFrom(row, ["name"], "Concepto"),
      itemType: textFrom(row, ["item_type", "itemType"], "SERVICIO"),
      defaultDescription: textFrom(row, ["default_description", "defaultDescription"], ""),
      defaultPrice: numberFrom(row, ["default_price", "defaultPrice"]) ?? 0,
    }
  })
}

function invoiceRemainingSummary(value: unknown): InvoiceRemainingSummary | null {
  const record = asRecord(value)
  const dataRecord = asRecord(record.data)
  const nested = Object.keys(dataRecord).length ? dataRecord : record
  const total = numberFrom(nested, ["total", "total_dtes", "totalDtes", "purchased", "compradas"])
  const used = numberFrom(nested, ["used", "usadas", "used_dtes", "usedDtes"])
  const remaining = numberFrom(nested, [
    "remaining",
    "restantes",
    "available",
    "remaining_dtes",
    "remainingDtes",
  ])

  if (total === undefined && used === undefined && remaining === undefined) return null
  return { total, used, remaining }
}

function formatNumber(value: number | undefined) {
  return value === undefined ? "N/D" : value.toLocaleString("es-GT")
}

const paymentMethods = [
  { label: "Efectivo", reference: "No obligatoria", use: "Pagos y abonos" },
  { label: "Tarjeta", reference: "Obligatoria", use: "Pagos y abonos" },
  { label: "Transferencia", reference: "Obligatoria", use: "Pagos y abonos" },
  { label: "Depósito bancario", reference: "Obligatoria", use: "Pagos y abonos" },
  { label: "Crédito", reference: "Movimiento de cuenta", use: "Solo clientes con crédito disponible" },
]

export function ConfiguracionPage() {
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceRemainingSummary | null>(null)
  const [invoices, setInvoices] = useState<InvoiceAdminRow[]>([])
  const [invoiceConcepts, setInvoiceConcepts] = useState<InvoiceConceptAdminRow[]>([])
  const [cancelInvoiceId, setCancelInvoiceId] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [conceptName, setConceptName] = useState("")
  const [conceptItemType, setConceptItemType] = useState("SERVICIO")
  const [conceptPrice, setConceptPrice] = useState("")
  const [loading, setLoading] = useState(false)

  const loadInvoiceCount = async (silent = false) => {
    setLoading(true)
    try {
      const [remainingResponse, invoicesResponse, conceptsResponse] = await Promise.all([
        api.invoices.getRemaining<unknown>(),
        api.invoices.list<unknown>(),
        api.invoiceConcepts.list<unknown>(),
      ])
      setInvoiceSummary(invoiceRemainingSummary(remainingResponse))
      setInvoices(mapInvoiceAdminRows(invoicesResponse))
      setInvoiceConcepts(mapInvoiceConceptRows(conceptsResponse))
      if (!silent) toast.success("Conteo de facturas actualizado")
    } catch (error) {
      setInvoiceSummary(null)
      setInvoices([])
      setInvoiceConcepts([])
      toast.error("No se pudo cargar el conteo de facturas", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  async function cancelInvoice() {
    if (!cancelInvoiceId.trim() || cancelReason.trim().length < 4) {
      toast.error("Escribe el ID de factura y una razon de anulacion")
      return
    }
    try {
      await api.invoices.cancel(cancelInvoiceId.trim(), { reason: cancelReason.trim() })
      toast.success("Factura enviada a anular")
      setCancelInvoiceId("")
      setCancelReason("")
      await loadInvoiceCount(true)
    } catch (error) {
      toast.error("No se pudo anular la factura", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function createInvoiceConcept() {
    if (!conceptName.trim()) {
      toast.error("Escribe el nombre del concepto")
      return
    }
    try {
      await api.invoiceConcepts.create({
        name: conceptName.trim(),
        item_type: conceptItemType,
        default_description: conceptName.trim(),
        default_price: conceptPrice ? Number(conceptPrice) : null,
      })
      toast.success("Concepto FEL creado")
      setConceptName("")
      setConceptPrice("")
      await loadInvoiceCount(true)
    } catch (error) {
      toast.error("No se pudo crear el concepto", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function updateInvoiceConcept(concept: InvoiceConceptAdminRow) {
    try {
      await api.invoiceConcepts.update(concept.id, {
        name: concept.name,
        item_type: concept.itemType,
        default_description: concept.defaultDescription || concept.name,
        default_price: concept.defaultPrice,
      })
      toast.success("Concepto FEL actualizado")
      await loadInvoiceCount(true)
    } catch (error) {
      toast.error("No se pudo actualizar el concepto", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function deleteInvoiceConcept(id: string) {
    try {
      await api.invoiceConcepts.delete(id)
      toast.success("Concepto FEL eliminado")
      await loadInvoiceCount(true)
    } catch (error) {
      toast.error("No se pudo eliminar el concepto", {
        description: getApiErrorMessage(error),
      })
    }
  }

  useEffect(() => {
    void loadInvoiceCount(true)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Parámetros visibles conectados a backend. Los cambios solo se habilitan cuando exista endpoint."
        actions={
          <Button type="button" size="sm" className="gap-2 rounded-full" onClick={() => void loadInvoiceCount()} disabled={loading}>
            <RefreshCw className="size-3.5" />
            Actualizar
          </Button>
        }
      />

      <SectionCard title="Cómo usar esta pantalla">
        <Workflow
          steps={[
            { title: "Revisar", description: "Consulta datos que sí vienen del servidor." },
            { title: "Validar", description: "Si falta una configuración editable, se debe pedir endpoint antes de habilitarla." },
            { title: "Solo backend", description: "Esta pantalla no persiste cambios si no existe endpoint." },
            { title: "Actualizar", description: "Usa el botón para volver a consultar el conteo real de facturas." },
          ]}
        />
      </SectionCard>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facturas compradas" value={formatNumber(invoiceSummary?.total)} tone="info" />
        <StatCard label="Facturas usadas" value={formatNumber(invoiceSummary?.used)} />
        <StatCard label="Facturas restantes" value={formatNumber(invoiceSummary?.remaining)} tone="success" />
        <StatCard label="Configuración editable" value="Sin endpoint" helper="Edición deshabilitada hasta tener backend" tone="warning" />
      </section>

      <Tabs defaultValue="facturas" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="operacion">Operación</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <SectionCard
            title="Facturas disponibles"
            description="Este conteo se obtiene de /api/invoices/remaining."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <FieldGrid
                items={[
                  { label: "Compradas", value: formatNumber(invoiceSummary?.total) },
                  { label: "Restantes", value: formatNumber(invoiceSummary?.remaining) },
                  { label: "Usadas", value: formatNumber(invoiceSummary?.used) },
                  { label: "Fuente", value: "/api/invoices/remaining" },
                ]}
              />
              <div className="rounded-3xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                <FileText className="mb-3 size-5 text-primary" />
                Emitir o anular factura consume documentos fiscales según la lógica del backend.
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Facturas emitidas"
            description="Listado real consultado desde /api/invoices."
          >
            <MiniTable
              headers={["ID", "Factura", "Cliente", "NIT", "Total", "Estado"]}
              rows={invoices.slice(0, 12).map((invoice) => [
                invoice.id,
                invoice.number,
                invoice.customer,
                invoice.nit,
                `Q. ${invoice.total.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                <StatusPill tone={invoice.status.toLowerCase().includes("anul") ? "danger" : "success"}>{invoice.status}</StatusPill>,
              ])}
            />
          </SectionCard>

          <SectionCard
            title="Anular factura"
            description="Accion explícita conectada a POST /api/invoices/{id}/cancel."
          >
            <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="space-y-1 text-sm font-medium">
                ID factura
                <Input value={cancelInvoiceId} onChange={(event) => setCancelInvoiceId(event.target.value)} className="rounded-full" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Razon
                <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="rounded-full" />
              </label>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void cancelInvoice()}>
                Anular
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Conceptos FEL"
            description="Catalogo conectado a /api/invoice-concepts para crear, actualizar o eliminar conceptos."
          >
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
              <label className="space-y-1 text-sm font-medium">
                Nombre
                <Input value={conceptName} onChange={(event) => setConceptName(event.target.value)} className="rounded-full" />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Tipo
                <select value={conceptItemType} onChange={(event) => setConceptItemType(event.target.value)} className="h-10 w-full rounded-full border bg-background px-3 text-sm">
                  <option value="SERVICIO">SERVICIO</option>
                  <option value="BIEN">BIEN</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Precio base
                <Input value={conceptPrice} onChange={(event) => setConceptPrice(event.target.value)} className="rounded-full" />
              </label>
              <Button type="button" className="rounded-full" onClick={() => void createInvoiceConcept()}>
                Crear concepto
              </Button>
            </div>
            <div className="mt-4">
              <MiniTable
                headers={["ID", "Nombre", "Tipo", "Precio", "Accion"]}
                rows={invoiceConcepts.map((concept) => [
                  concept.id,
                  concept.name,
                  concept.itemType,
                  `Q. ${concept.defaultPrice.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  <span className="inline-flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-full" onClick={() => void updateInvoiceConcept(concept)}>
                      Actualizar
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-full" onClick={() => void deleteInvoiceConcept(concept.id)}>
                      Eliminar
                    </Button>
                  </span>,
                ])}
              />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="operacion">
          <SectionCard
            title="Parámetros operativos"
            description="No hay endpoint conectado para editar nombre del hotel, horarios base o políticas generales desde esta vista."
          >
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Settings2 className="mb-3 size-5" />
              Para habilitar edición real aquí hace falta un endpoint de configuración operativa. Mientras no exista, no hay botón de guardar.
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pagos">
          <SectionCard
            title="Métodos de pago usados por los flujos"
            description="Listado informativo de los métodos que ya usan reservaciones, check-in, check-out y crédito. No se activan/desactivan desde local."
          >
            <MiniTable
              headers={["Método", "Referencia", "Uso", "Estado"]}
              rows={paymentMethods.map((method) => [
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  {method.label}
                </span>,
                method.reference,
                method.use,
                <StatusPill tone="info">Definido por flujo</StatusPill>,
              ])}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ConfiguracionPage
