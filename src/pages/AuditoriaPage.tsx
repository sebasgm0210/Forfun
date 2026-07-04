import { useEffect, useMemo, useState } from "react"
import { Download, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { MiniTable, SectionCard, StatCard, StatusPill, Workflow } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"

type AuditRisk = "normal" | "sensible" | "crítico"
type AuditLog = {
  id: string
  date: string
  user: string
  module: string
  action: string
  before: string
  after: string
  risk: AuditRisk
}

const riskTone: Record<AuditRisk, "info" | "warning" | "danger"> = {
  normal: "info",
  sensible: "warning",
  crítico: "danger",
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function arrayFromApi(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.items)) return record.items
  return []
}

function textFrom(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return fallback
}

function riskFromAction(action: string): AuditRisk {
  const normalized = action.toLowerCase()
  if (/(delete|cancel|anul|retir|bloque|permiso|role|rol)/i.test(normalized)) return "crítico"
  if (/(rate|tarifa|price|precio|payment|pago|invoice|factura|checkout|check-out)/i.test(normalized)) return "sensible"
  return "normal"
}

function mapAuditLog(value: unknown, index: number): AuditLog {
  const record = asRecord(value)
  const action = textFrom(record, ["action", "change", "movement_type", "description"], "Acción registrada")
  const module = textFrom(record, ["module", "source_module", "entity", "table"], "Habitaciones / tarifas")

  return {
    id: textFrom(record, ["id_audit_log", "idAuditLog", "id"], `audit-${index}`),
    date: textFrom(record, ["created_at", "createdAt", "date", "movement_date"], "Sin fecha"),
    user: textFrom(record, ["user", "username", "registered_by", "created_by"], "Servidor"),
    module,
    action,
    before: textFrom(record, ["before", "previous_value", "old_value"], "-"),
    after: textFrom(record, ["after", "new_value", "detail", "notes", "reason"], "-"),
    risk: riskFromAction(`${module} ${action}`),
  }
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

export function AuditoriaPage() {
  const [query, setQuery] = useState("")
  const [moduleFilter, setModuleFilter] = useState("Todos")
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)

  const loadAuditLogs = async (silent = false) => {
    setLoading(true)
    try {
      const response = await api.rooms.listAuditLog<unknown[]>()
      setLogs(arrayFromApi(response).map(mapAuditLog))
      if (!silent) toast.success("Auditoría actualizada desde el servidor")
    } catch (error) {
      setLogs([])
      toast.error("No se pudo cargar auditoría", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAuditLogs(true)
  }, [])

  const modules = useMemo(() => ["Todos", ...Array.from(new Set(logs.map((log) => log.module)))], [logs])
  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const text = `${log.user} ${log.module} ${log.action} ${log.before} ${log.after}`.toLowerCase()
        const matchesQuery = text.includes(query.toLowerCase())
        const matchesModule = moduleFilter === "Todos" || log.module === moduleFilter
        return matchesQuery && matchesModule
      }),
    [logs, moduleFilter, query],
  )

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.info("No hay eventos para exportar")
      return
    }

    const headers = ["Fecha", "Usuario", "Módulo", "Acción", "Antes", "Después", "Riesgo"]
    const rows = filteredLogs.map((log) => [log.date, log.user, log.module, log.action, log.before, log.after, log.risk])
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("CSV de auditoría generado", {
      description: `${filteredLogs.length} evento(s) reales incluidos.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Auditoría"
        description="Registro consultable de acciones devueltas por el servidor. No se muestran eventos de prueba."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={() => void loadAuditLogs()} disabled={loading}>
              <RefreshCw className="size-3.5" />
              Actualizar
            </Button>
            <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={exportCsv} disabled={filteredLogs.length === 0}>
              <Download className="size-3.5" />
              Exportar CSV
            </Button>
          </div>
        }
      />

      <SectionCard title="Cómo usar esta pantalla">
        <Workflow
          steps={[
            { title: "Cargar", description: "Consulta el historial real que devuelve el servidor." },
            { title: "Filtrar", description: "Busca por usuario, módulo, acción o detalle." },
            { title: "Revisar riesgo", description: "Empieza por lo sensible o crítico." },
            { title: "Exportar", description: "Descarga CSV solo con eventos reales cargados." },
          ]}
        />
      </SectionCard>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Eventos visibles" value={filteredLogs.length} />
        <StatCard label="Críticos" value={logs.filter((log) => log.risk === "crítico").length} tone="danger" />
        <StatCard label="Sensibles" value={logs.filter((log) => log.risk === "sensible").length} tone="warning" />
        <StatCard label="Fuente" value="Servidor" helper="/api/rooms/audit-log" tone="info" />
      </section>

      <Tabs defaultValue="acciones" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="acciones">Acciones</TabsTrigger>
          <TabsTrigger value="reglas">Reglas</TabsTrigger>
        </TabsList>

        <TabsContent value="acciones" className="space-y-4">
          <SectionCard title="Filtros">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar usuario, módulo o acción"
                  className="rounded-full pl-9"
                />
              </div>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="h-10 rounded-full border bg-background px-3 text-sm"
              >
                {modules.map((module) => (
                  <option key={module}>{module}</option>
                ))}
              </select>
            </div>
          </SectionCard>

          <SectionCard title="Registro de acciones">
            {filteredLogs.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay eventos de auditoría devueltos por el servidor para estos filtros.
              </div>
            ) : (
              <MiniTable
                headers={["Fecha", "Usuario", "Módulo", "Acción", "Antes", "Después", "Riesgo"]}
                rows={filteredLogs.map((log) => [
                  log.date,
                  log.user,
                  log.module,
                  log.action,
                  log.before,
                  log.after,
                  <StatusPill tone={riskTone[log.risk]}>{log.risk}</StatusPill>,
                ])}
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="reglas">
          <SectionCard title="Acciones que deben auditarse">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {["Cambios de tarifa", "Anulación de factura", "Aprobación/rechazo de cierre", "Pagos y abonos", "Cancelación de reserva", "Cambio de permisos", "Ajuste de inventario", "Configuración FEL"].map((item) => (
                <div key={item} className="rounded-2xl border bg-background/60 p-4 text-sm">
                  <ShieldCheck className="mb-3 size-5 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AuditoriaPage
