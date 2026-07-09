import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Download,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  WashingMachine,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { QuickGuide } from "@/components/modules/view-kit"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { useStore } from "@/lib/store"

type LinenCategory =
  | "Toalla de cuerpo"
  | "Toalla de manos"
  | "Toalla de pies"
  | "Ropa de cama"
  | "Almohada"
  | "Mobiliario"

type MovementType =
  | "Entrada"
  | "Ajuste"
  | "Asignación"
  | "Lavandería"
  | "Regreso limpio"
  | "Daño"
  | "Cobro"
  | "Retiro de inventario"

type LinenItem = {
  id: string
  code: string
  name: string
  category: LinenCategory
  totalQty: number
  availableQty: number
  inUseQty: number
  laundryQty: number
  damagedQty: number
  retiredQty: number
  replacementCost: number
  minStock: number
  location: string
  lastUpdate: string
  responsible: string
}

type RoomAssignment = {
  id: string
  room: string
  guest: string
  itemId: string
  itemName: string
  category: LinenCategory
  qty: number
  checkIn: string
  responsible: string
}

type RoomAssignmentGroup = {
  key: string
  room: string
  guest: string
  checkIn: string
  assignments: RoomAssignment[]
}

type LaundryBatch = {
  id: string
  assignmentId?: string
  itemId: string
  itemName: string
  category: LinenCategory
  qty: number
  room: string
  guest: string
  sentAt: string
  expectedReturn: string
  status: "En lavandería" | "Lista para regresar"
  responsible: string
  notes: string
}

type DamageRecord = {
  id: string
  itemId: string
  itemName: string
  category: LinenCategory
  qty: number
  room: string
  guest: string
  reason: string
  replacementCost: number
  status: "Pendiente de cobro" | "Cobrado" | "Retirado del inventario"
  createdAt: string
  responsible: string
}

type Movement = {
  id: string
  date: string
  type: MovementType
  itemName: string
  qty: number
  from: string
  to: string
  reason: string
  user: string
}

type PendingDialog = {
  title: string
  description: string
  confirmLabel: string
  tone?: "danger" | "default"
  onConfirm: () => void
} | null

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function nowLabel() {
  return new Date().toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
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

function normalizeApiText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function linenCategory(value: string, itemName = ""): LinenCategory {
  const normalized = normalizeApiText(`${value} ${itemName}`)
  if (normalized.includes("mobili")) return "Mobiliario"
  if (normalized.includes("almoh")) return "Almohada"
  if (
    normalized.includes("cama") ||
    normalized.includes("sabana") ||
    normalized.includes("cobert")
  ) {
    return "Ropa de cama"
  }
  if (normalized.includes("mano")) return "Toalla de manos"
  if (normalized.includes("pie")) return "Toalla de pies"
  return "Toalla de cuerpo"
}

function mapLinenItem(value: unknown): LinenItem | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_linen_item", "idLinenItem", "id"])
  if (!id) return null

  const availableQty = apiNumber(record, ["available", "available_quantity"])
  const inUseQty = apiNumber(record, ["rooms", "in_use", "in_use_quantity"])
  const laundryQty = apiNumber(record, ["laundry", "laundry_quantity"])
  const damagedQty = apiNumber(record, ["damaged", "damaged_quantity"])
  const retiredQty = apiNumber(record, ["retired", "retired_quantity"])
  const name = apiText(record, ["name"], `Artículo ${id}`)

  return {
    id,
    code: apiText(record, ["code"], `BL-${id}`),
    name,
    category: linenCategory(apiText(record, ["category"]), name),
    totalQty: availableQty + inUseQty + laundryQty + damagedQty + retiredQty,
    availableQty,
    inUseQty,
    laundryQty,
    damagedQty,
    retiredQty,
    replacementCost: apiNumber(record, ["replacement_cost", "replacementCost"]),
    minStock: apiNumber(record, ["minimum", "minimum_quantity", "minStock"]),
    location: apiText(record, ["location", "warehouse_name"], "Bodega general"),
    lastUpdate: apiText(record, ["updated_at", "created_at"], nowLabel()),
    responsible: apiText(record, ["updated_by", "created_by"], "Inventario"),
  }
}

function assignmentRecords(value: unknown) {
  return apiArray(value).flatMap((entry) => {
    const room = apiRecord(entry)
    const nested = apiArray(room.items ?? room.assignments)
    if (nested.length === 0) return [room]
    return nested.map((assignment) => ({
      ...room,
      ...apiRecord(assignment),
    }))
  })
}

function mapRoomAssignment(
  value: unknown,
  itemById: Map<string, LinenItem>,
): RoomAssignment | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_linen_assignment", "idLinenAssignment", "id"])
  const itemId = apiText(record, ["id_linen_item", "idLinenItem"])
  const room = apiText(record, ["room_number", "roomNumber"])
  if (!id || !itemId || !room) return null
  const item = itemById.get(itemId)

  return {
    id,
    room,
    guest: apiText(record, ["guest_name", "guest"], "Habitación ocupada"),
    itemId,
    itemName: apiText(record, ["item_name", "linen_item_name"], item?.name ?? "Artículo"),
    category: item?.category ?? linenCategory(apiText(record, ["category"])),
    qty: apiNumber(record, ["quantity", "qty"], 1),
    checkIn: apiText(record, ["assigned_at", "check_in", "created_at"], nowLabel()),
    responsible: apiText(record, ["assigned_by", "responsible"], "Recepción"),
  }
}

function mapLaundryBatch(
  value: unknown,
  itemById: Map<string, LinenItem>,
): LaundryBatch | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_linen_laundry", "idLinenLaundry", "id"])
  const itemId = apiText(record, ["id_linen_item", "idLinenItem"])
  if (!id || !itemId) return null
  const item = itemById.get(itemId)
  const status = normalizeApiText(apiText(record, ["status"]))

  return {
    id,
    assignmentId: apiText(record, ["id_linen_assignment", "idLinenAssignment", "linen_assignment_id"]) || undefined,
    itemId,
    itemName: apiText(record, ["item_name"], item?.name ?? "Artículo"),
    category: item?.category ?? linenCategory("", apiText(record, ["item_name"])),
    qty: apiNumber(record, ["quantity", "qty"], 1),
    room: apiText(record, ["room_number", "roomNumber"], "Bodega"),
    guest: apiText(record, ["guest_name", "guest"], ""),
    sentAt: apiText(record, ["sent_at", "sentAt"], nowLabel()),
    expectedReturn: apiText(
      record,
      ["estimated_return_at", "expected_return", "expectedReturn"],
      "Pendiente",
    ),
    status: status.includes("lista") || status.includes("ready")
      ? "Lista para regresar"
      : "En lavandería",
    responsible: apiText(record, ["sent_by", "ready_by"], "Camarería"),
    notes: apiText(record, ["notes"]),
  }
}

function mapDamageRecord(
  value: unknown,
  itemById: Map<string, LinenItem>,
): DamageRecord | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_linen_damage", "idLinenDamage", "id"])
  const itemId = apiText(record, ["id_linen_item", "idLinenItem"])
  if (!id || !itemId) return null
  const item = itemById.get(itemId)
  const rawStatus = normalizeApiText(apiText(record, ["status"]))
  const status: DamageRecord["status"] = rawStatus.includes("retir")
    ? "Retirado del inventario"
    : rawStatus.includes("cob") || rawStatus.includes("charg")
      ? "Cobrado"
      : "Pendiente de cobro"

  return {
    id,
    itemId,
    itemName: apiText(record, ["item_name"], item?.name ?? "Artículo"),
    category: item?.category ?? linenCategory("", apiText(record, ["item_name"])),
    qty: apiNumber(record, ["quantity", "qty"], 1),
    room: apiText(record, ["room_number", "roomNumber"], "-"),
    guest: apiText(record, ["guest_name", "guest"], ""),
    reason: apiText(record, ["reason"], "Daño reportado"),
    replacementCost: apiNumber(
      record,
      ["replacement_cost", "replacementCost", "total_amount"],
      item?.replacementCost ?? 0,
    ),
    status,
    createdAt: apiText(record, ["reported_at", "created_at"], nowLabel()),
    responsible: apiText(
      record,
      ["reported_by", "charged_by", "retired_by"],
      "Recepción",
    ),
  }
}

function movementType(value: string): MovementType {
  const normalized = normalizeApiText(value)
  if (normalized.includes("assign")) return "Asignación"
  if (normalized.includes("sendlaundry")) return "Lavandería"
  if (normalized.includes("ready")) return "Regreso limpio"
  if (normalized.includes("return")) return "Regreso limpio"
  if (normalized.includes("damage")) return "Daño"
  if (normalized.includes("charge")) return "Cobro"
  if (normalized.includes("retire")) return "Retiro de inventario"
  if (normalized.includes("create") || normalized.includes("entry")) return "Entrada"
  return "Ajuste"
}

function mapLinenMovement(value: unknown): Movement | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_linen_movement", "idLinenMovement", "id"])
  if (!id) return null
  const room = apiText(record, ["room_number", "roomNumber"])

  return {
    id,
    date: apiText(record, ["movement_date", "created_at"], nowLabel()),
    type: movementType(apiText(record, ["movement_type", "type"])),
    itemName: apiText(record, ["item_name"], "Artículo"),
    qty: apiNumber(record, ["quantity", "qty"], 0),
    from: apiText(record, ["source_module"], "Inventario"),
    to: room ? `Habitación ${room}` : "Bodega / lavandería",
    reason: apiText(record, ["notes", "reason"], "Movimiento registrado"),
    user: apiText(record, ["registered_by", "user"], "Sistema"),
  }
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function openPrintableDocument(title: string, body: string) {
  const win = window.open("", "_blank", "width=1100,height=800")
  if (!win) return

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2933;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.45;
          }
          .report { width: 100%; }
          .report-header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
            border-bottom: 2px solid #21395b;
            padding-bottom: 14px;
            margin-bottom: 18px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .brand {
            font-size: 22px;
            font-weight: 800;
            color: #21395b;
            letter-spacing: -0.02em;
          }
          .subtitle {
            margin-top: 4px;
            color: #6b7280;
            font-size: 11px;
          }
          .meta {
            text-align: right;
            color: #374151;
            font-size: 10px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .summary-card {
            border: 1px solid #d7dce3;
            border-radius: 10px;
            padding: 10px;
            background: #faf7f1;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .summary-label {
            color: #6b7280;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .summary-value {
            margin-top: 3px;
            font-size: 16px;
            font-weight: 800;
          }
          h2 {
            margin: 18px 0 8px;
            color: #21395b;
            font-size: 14px;
            break-after: avoid;
            page-break-after: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            break-inside: auto;
          }
          thead { display: table-header-group; }
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          th {
            background: #21395b;
            color: white;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 7px 6px;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
            padding: 7px 6px;
            vertical-align: top;
          }
          .note {
            border: 1px solid #d7dce3;
            background: #fbfbfb;
            border-radius: 10px;
            padding: 10px;
            margin-top: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 42px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .signature {
            border-top: 1px solid #111827;
            padding-top: 8px;
            text-align: center;
            font-size: 10px;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <main class="report">${body}</main>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `)

  win.document.close()
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "En habitación": "border-blue-200 bg-blue-50 text-blue-700",
    "En lavandería": "border-violet-200 bg-violet-50 text-violet-700",
    "Lista para regresar": "border-cyan-200 bg-cyan-50 text-cyan-700",
    "Pendiente de cobro": "border-amber-200 bg-amber-50 text-amber-700",
    Cobrado: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Retirado del inventario": "border-zinc-200 bg-zinc-100 text-zinc-700",
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] ?? "border-muted bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string | number
  helper?: string
  icon: typeof Shirt
  tone?: "default" | "warning" | "success" | "danger" | "info"
}) {
  const tones = {
    default: "border-border bg-card",
    warning: "border-amber-200 bg-amber-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    danger: "border-red-200 bg-red-50/80",
    info: "border-blue-200 bg-blue-50/80",
  }

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div className="rounded-2xl bg-background/80 p-2 text-primary shadow-sm">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className ?? ""}`}
    />
  )
}

function MoneyTextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
        Q.
      </span>
      <TextInput {...props} type="number" className={`pl-10 tabular-nums ${className ?? ""}`} />
    </div>
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className ?? ""}`}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className ?? ""}`}
    />
  )
}

function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition hover:bg-muted"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function InventarioBlancosPage() {
  const { rooms: rawRooms, refreshApiState } = useStore()
  const rooms = useMemo(
    () => [...rawRooms].sort((a, b) => a.number.localeCompare(b.number, "es", { numeric: true })),
    [rawRooms],
  )
  const [items, setItems] = useState<LinenItem[]>([])
  const [assignments, setAssignments] = useState<RoomAssignment[]>([])
  const [laundry, setLaundry] = useState<LaundryBatch[]>([])
  const [damages, setDamages] = useState<DamageRecord[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [query, setQuery] = useState("")
  const [modal, setModal] = useState<"newItem" | "editItem" | "assign" | "laundry" | "bulkLaundry" | "damage" | null>(null)
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null)
  const [linenSaving, setLinenSaving] = useState(false)

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Toalla de cuerpo" as LinenCategory,
    qty: "1",
    replacementCost: "",
    minStock: "1",
    location: "Bodega general",
    responsible: "Administrador",
  })

  const [editingItem, setEditingItem] = useState({
    id: "",
    name: "",
    category: "Toalla de cuerpo" as LinenCategory,
    availableQty: "",
    replacementCost: "",
    minStock: "",
    location: "",
    responsible: "Administrador",
  })

  const [assignmentForm, setAssignmentForm] = useState({
    itemId: "",
    room: "",
    qty: "1",
    responsible: "Recepción",
  })

  const [laundryForm, setLaundryForm] = useState({
    assignmentId: "",
    expectedReturn: "",
    responsible: "Camarería",
    notes: "",
  })

  const [bulkLaundryForm, setBulkLaundryForm] = useState({
    roomKey: "",
    expectedReturn: "",
    responsible: "Camarería",
    notes: "",
  })

  const [damageForm, setDamageForm] = useState({
    assignmentId: "",
    itemId: "",
    itemName: "",
    category: "Toalla de cuerpo" as LinenCategory,
    room: "",
    guest: "",
    qty: "1",
    reason: "",
    replacementCost: "125",
    responsible: "Recepción",
  })

  const loadLinenData = useCallback(async () => {
    const [
      itemsResult,
      allAssignmentsResult,
      assignmentsResult,
      laundryResult,
      damagesResult,
      movementsResult,
    ] = await Promise.allSettled([
      api.linen.listItems<unknown>(),
      api.linen.listAssignments<unknown>(),
      api.linen.listAssignmentsByRoom<unknown>(),
      api.linen.listLaundry<unknown>(),
      api.linen.listDamages<unknown>(),
      api.linen.listMovements<unknown>(),
    ])

    const loadedItems =
      itemsResult.status === "fulfilled"
        ? apiArray(itemsResult.value)
            .map(mapLinenItem)
            .filter((item): item is LinenItem => Boolean(item))
        : []
    const itemById = new Map(loadedItems.map((item) => [item.id, item]))

    if (itemsResult.status === "fulfilled") {
      setItems(loadedItems)
    }
    if (assignmentsResult.status === "fulfilled") {
      const assignmentSource =
        assignmentRecords(assignmentsResult.value).length
          ? assignmentsResult.value
          : allAssignmentsResult.status === "fulfilled"
            ? allAssignmentsResult.value
            : assignmentsResult.value
      setAssignments(
        assignmentRecords(assignmentSource)
          .map((assignment) => mapRoomAssignment(assignment, itemById))
          .filter((assignment): assignment is RoomAssignment => Boolean(assignment)),
      )
    }
    if (laundryResult.status === "fulfilled") {
      setLaundry(
        apiArray(laundryResult.value)
          .map((batch) => mapLaundryBatch(batch, itemById))
          .filter((batch): batch is LaundryBatch => Boolean(batch)),
      )
    }
    if (damagesResult.status === "fulfilled") {
      setDamages(
        apiArray(damagesResult.value)
          .map((damage) => mapDamageRecord(damage, itemById))
          .filter((damage): damage is DamageRecord => Boolean(damage)),
      )
    }
    if (movementsResult.status === "fulfilled") {
      setMovements(
        apiArray(movementsResult.value)
          .map(mapLinenMovement)
          .filter((movement): movement is Movement => Boolean(movement)),
      )
    }

    const failures = [
      itemsResult,
      allAssignmentsResult,
      assignmentsResult,
      laundryResult,
      damagesResult,
      movementsResult,
    ].flatMap((result) => result.status === "rejected" ? [result.reason] : [])

    if (failures.length > 0) {
      toast.error("Algunos datos de blancos no se pudieron cargar", {
        description: getApiErrorMessage(failures[0]),
      })
    }
  }, [])

  useEffect(() => {
    void Promise.all([
      refreshApiState(["rooms"], { force: false }),
      loadLinenData(),
    ])
  }, [loadLinenData, refreshApiState])

  const filteredItems = useMemo(() => {
    const text = query.toLowerCase().trim()

    if (!text) return items

    return items.filter((item) =>
      [item.code, item.name, item.category, item.location, item.responsible].some((value) => value.toLowerCase().includes(text)),
    )
  }, [items, query])

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += item.totalQty
        acc.available += item.availableQty
        acc.inUse += item.inUseQty
        acc.laundry += item.laundryQty
        acc.damaged += item.damagedQty
        acc.retired += item.retiredQty
        acc.value += item.totalQty * item.replacementCost
        if (item.availableQty <= item.minStock) acc.lowStock += 1
        return acc
      },
      {
        total: 0,
        available: 0,
        inUse: 0,
        laundry: 0,
        damaged: 0,
        retired: 0,
        value: 0,
        lowStock: 0,
      },
    )
  }, [items])

  const lowStockItems = items.filter((item) => item.availableQty <= item.minStock)
  const roomAssignmentGroups = useMemo<RoomAssignmentGroup[]>(() => {
    const groups = new Map<string, RoomAssignmentGroup>()

    assignments.forEach((assignment) => {
      const key = assignment.room
      const current = groups.get(key)

      if (current) {
        current.assignments.push(assignment)
        return
      }

      groups.set(key, {
        key,
        room: assignment.room,
        guest: assignment.guest,
        checkIn: assignment.checkIn,
        assignments: [assignment],
      })
    })

    return Array.from(groups.values()).sort((a, b) =>
      a.room.localeCompare(b.room, "es", { numeric: true }),
    )
  }, [assignments])

  function getItemReplacementCost(itemId: string) {
    return items.find((item) => item.id === itemId)?.replacementCost ?? 0
  }

  function backendNumericId(value: string, label: string) {
    const id = Number(value)
    if (Number.isInteger(id) && id > 0) return id

    toast.error(`${label} no tiene identificador del servidor.`, {
      description: "Recarga la vista y vuelve a intentarlo para guardar con identificadores válidos del servidor.",
    })
    return null
  }

  async function runLinenMutation(action: () => Promise<unknown>, success: string, afterSuccess?: () => void) {
    setLinenSaving(true)
    try {
      await action()
      await loadLinenData()
      afterSuccess?.()
      toast.success(success)
    } catch (error) {
      toast.error("No se pudo guardar el movimiento de blancos.", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setLinenSaving(false)
    }
  }

  function handleCreateItem() {
    if (!newItem.name.trim()) return

    void runLinenMutation(
      () =>
        api.linen.createItem({
          code: `BL-${newItem.category.slice(0, 2).toUpperCase()}-${Date.now().toString().slice(-5)}`,
          name: newItem.name.trim(),
          category: newItem.category,
          available_quantity: Math.max(0, Number(newItem.qty)),
          minimum_quantity: Math.max(0, Number(newItem.minStock)),
          replacement_cost: Math.max(0, Number(newItem.replacementCost)),
          notes: `Ubicacion: ${newItem.location || "Bodega general"} · Responsable: ${newItem.responsible || "Administrador"}`,
        }),
      "Artículo registrado en el servidor.",
      () => {
        setNewItem({
          name: "",
          category: "Toalla de cuerpo",
          qty: "1",
          replacementCost: "",
          minStock: "1",
          location: "Bodega general",
          responsible: "Administrador",
        })
        setModal(null)
        setPendingDialog(null)
      },
    )
  }

  function openEditItemModal(item: LinenItem) {
    setEditingItem({
      id: item.id,
      name: item.name,
      category: item.category,
      availableQty: String(item.availableQty),
      replacementCost: String(item.replacementCost),
      minStock: String(item.minStock),
      location: item.location,
      responsible: item.responsible,
    })
    setModal("editItem")
  }

  function handleUpdateItem() {
    const item = items.find((entry) => entry.id === editingItem.id)
    if (!item || !editingItem.name.trim()) return
    const itemId = backendNumericId(item.id, "Artículo")
    if (!itemId) return

    void runLinenMutation(
      () =>
        api.linen.updateItem(itemId, {
          code: item.code,
          name: editingItem.name.trim(),
          category: editingItem.category,
          available_quantity: Math.max(0, Number(editingItem.availableQty)),
          minimum_quantity: Math.max(0, Number(editingItem.minStock)),
          replacement_cost: Math.max(0, Number(editingItem.replacementCost)),
          notes: `Ubicacion: ${editingItem.location || "Sin ubicacion"} · Responsable: ${editingItem.responsible || "Administrador"}`,
          is_active: true,
        }),
      "Artículo actualizado en el servidor.",
      () => {
        setModal(null)
        setPendingDialog(null)
      },
    )
  }

  function requestDeleteInventoryItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) return

    const activeDetails = [
      item.inUseQty > 0 ? `${item.inUseQty} en habitaciones` : "",
      item.laundryQty > 0 ? `${item.laundryQty} en lavandería` : "",
      item.damagedQty > 0 ? `${item.damagedQty} en daños` : "",
    ].filter(Boolean)

    setPendingDialog({
      title: `Borrar ${item.name}`,
      description: activeDetails.length
        ? `Este artículo todavía tiene ${activeDetails.join(", ")}. Si confirmas, se quitará del catálogo y también se limpiarán esos registros activos en esta vista.`
        : "Este artículo se quitará del catálogo de blancos y mobiliario.",
      confirmLabel: "Sí, borrar",
      tone: "danger",
      onConfirm: () => deleteInventoryItem(itemId),
    })
  }

  function deleteInventoryItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) return
    const id = backendNumericId(item.id, "Artículo")
    if (!id) return

    void runLinenMutation(
      () => api.linen.deleteItem(id),
      "Artículo eliminado del servidor.",
      () => setPendingDialog(null),
    )
  }

  function handleAssignToRoom() {
    const item = items.find((entry) => entry.id === assignmentForm.itemId)
    const qty = Number(assignmentForm.qty)

    if (!item || !assignmentForm.room.trim() || qty <= 0 || item.availableQty < qty) return
    const itemId = backendNumericId(item.id, "Artículo")
    const room = rooms.find((entry) => entry.number === assignmentForm.room)
    const roomId = backendNumericId(room?.id ?? "", "Habitación")
    if (!itemId || !roomId) return

    void runLinenMutation(
      () =>
        api.linen.createAssignment({
          id_room: roomId,
          id_linen_item: itemId,
          quantity: qty,
          assigned_by: assignmentForm.responsible || "Recepción",
          notes: `Asignado a habitación ${assignmentForm.room}`,
        }),
      "Asignación guardada en el servidor.",
      () => {
        setAssignmentForm({
          itemId: items[0]?.id ?? "",
          room: "",
          qty: "1",
          responsible: "Recepción",
        })
        setModal(null)
      },
    )
  }

  function handleSendAssignmentToLaundry() {
    const assignment = assignments.find((entry) => entry.id === laundryForm.assignmentId)
    if (!assignment) return
    const assignmentId = backendNumericId(assignment.id, "Asignación")
    if (!assignmentId) return

    void runLinenMutation(
      () =>
        api.linen.sendAssignmentToLaundry({
          id_linen_assignment: assignmentId,
          quantity: assignment.qty,
          sent_by: laundryForm.responsible || "Camarería",
          estimated_return_at: laundryForm.expectedReturn || null,
          notes: laundryForm.notes || "Enviado desde habitación",
        }),
      "Artículo enviado a lavandería.",
      () => {
        setLaundryForm({
          assignmentId: assignments[0]?.id ?? "",
          expectedReturn: "",
          responsible: "Camarería",
          notes: "",
        })
        setModal(null)
      },
    )
  }

  function handleSendRoomToLaundry() {
    const group = roomAssignmentGroups.find((entry) => entry.key === bulkLaundryForm.roomKey)
    if (!group || group.assignments.length === 0) return
    const room = rooms.find((entry) => entry.number === group.room)
    const roomId = backendNumericId(room?.id ?? "", "Habitación")
    if (!roomId) return

    void runLinenMutation(
      () =>
        api.linen.sendRoomToLaundry({
          id_room: roomId,
          sent_by: bulkLaundryForm.responsible || "Camarería",
          estimated_return_at: bulkLaundryForm.expectedReturn || null,
          notes: bulkLaundryForm.notes || "Salida completa de habitación",
        }),
      "Habitación enviada a lavandería.",
      () => {
        setBulkLaundryForm({
          roomKey: "",
          expectedReturn: "",
          responsible: "Camarería",
          notes: "",
        })
        setModal(null)
      },
    )
  }

  function markLaundryReady(batchId: string) {
    const batch = laundry.find((entry) => entry.id === batchId)
    if (!batch) return

    const id = backendNumericId(batch.id, "Registro de lavandería")
    if (!id) return

    void runLinenMutation(
      () =>
        api.linen.markLaundryReady(id, {
          ready_by: batch.responsible || "Camarería",
          notes: "Lavandería confirmó que ya está limpio",
        }),
      "Lavandería marcada como lista.",
    )
  }

  function returnLaundry(batchId: string) {
    const batch = laundry.find((entry) => entry.id === batchId)
    if (!batch) return

    const id = backendNumericId(batch.id, "Registro de lavandería")
    if (!id) return

    if (batch.assignmentId) {
      void runLinenMutation(
        () =>
          api.linen.returnLaundryToRoom(id, {
            returned_by: batch.responsible || "Camareria",
            notes: "Articulo limpio regreso a la habitacion",
          }),
        "Articulo regresado a habitacion.",
      )
      return
    }

    void runLinenMutation(
      () =>
        api.linen.returnLaundryToAvailable(id, {
          returned_by: batch.responsible || "Camarería",
          notes: "Artículo limpio regresó a bodega",
        }),
      "Artículo regresado a disponible.",
    )
  }

  function handleReportDamage() {
    const assignment = assignments.find((entry) => entry.id === damageForm.assignmentId)
    const qty = Number(damageForm.qty)

    if (!assignment || !damageForm.reason.trim() || qty <= 0 || qty > assignment.qty) return
    const assignmentId = backendNumericId(assignment.id, "Asignación")
    if (!assignmentId) return

    void runLinenMutation(
      () =>
        api.linen.reportDamageFromAssignment({
          id_linen_assignment: assignmentId,
          quantity: qty,
          reason: damageForm.reason,
          reported_by: damageForm.responsible || "Recepción",
          should_charge_guest: true,
          notes: `Habitación ${assignment.room}`,
        }),
      "Daño reportado en el servidor.",
      () => {
        setDamageForm({
          assignmentId: assignments[0]?.id ?? "",
          itemId: assignments[0]?.itemId ?? items[0]?.id ?? "",
          itemName: assignments[0]?.itemName ?? items[0]?.name ?? "",
          category: assignments[0]?.category ?? "Toalla de cuerpo",
          room: assignments[0]?.room ?? "",
          guest: assignments[0]?.guest ?? "",
          qty: String(assignments[0]?.qty ?? 1),
          reason: "",
          replacementCost: assignments[0] ? String(getItemReplacementCost(assignments[0].itemId)) : "",
          responsible: "Recepción",
        })
        setModal(null)
      },
    )
  }

  function chargeDamage(recordId: string) {
    const record = damages.find((entry) => entry.id === recordId)
    if (!record) return
    const id = backendNumericId(record.id, "Daño")
    if (!id) return

    void runLinenMutation(
      () =>
        api.linen.chargeDamage(id, {
          charged_by: record.responsible || "Recepción",
          notes: `Cobro de reposición por ${money(record.replacementCost)}`,
        }),
      "Daño marcado como cobrado.",
    )
  }

  function retireDamagedItem(recordId: string) {
    const record = damages.find((entry) => entry.id === recordId)
    if (!record || record.status === "Retirado del inventario") return
    const id = backendNumericId(record.id, "Daño")
    if (!id) return

    void runLinenMutation(
      () =>
        api.linen.retireDamage(id, {
          retired_by: record.responsible || "Recepción",
          notes: record.reason,
        }),
      "Artículo dañado retirado del inventario.",
    )
  }

  function printInventoryReport() {
    const itemRows = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.code)}</td>
            <td><strong>${escapeHtml(item.name)}</strong><br/><span>${escapeHtml(item.category)}</span></td>
            <td>${escapeHtml(item.availableQty)}</td>
            <td>${escapeHtml(item.inUseQty)}</td>
            <td>${escapeHtml(item.laundryQty)}</td>
            <td>${escapeHtml(item.damagedQty)}</td>
            <td>${escapeHtml(item.retiredQty)}</td>
            <td>${escapeHtml(money(item.replacementCost))}</td>
          </tr>
        `,
      )
      .join("")

    openPrintableDocument(
      "Reporte de inventario de blancos",
      `
        <div class="report-header">
          <div>
            <div class="brand">Casa Luna Boutique Hotel</div>
            <div class="subtitle">Reporte general del inventario actual de blancos</div>
          </div>
          <div class="meta">
            <strong>Fecha de emisión:</strong><br/>
            ${escapeHtml(nowLabel())}<br/><br/>
            <strong>Módulo:</strong><br/>
            Inventario de blancos
          </div>
        </div>

        <section class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total</div>
            <div class="summary-value">${escapeHtml(totals.total)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Disponible</div>
            <div class="summary-value">${escapeHtml(totals.available)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">En lavandería</div>
            <div class="summary-value">${escapeHtml(totals.laundry)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Reposición total</div>
            <div class="summary-value">${escapeHtml(money(totals.value))}</div>
          </div>
        </section>

        <h2>Inventario actual</h2>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Artículo</th>
              <th>Disponible</th>
              <th>Habitacion</th>
              <th>Lavandería</th>
              <th>Daño</th>
              <th>Retirado</th>
              <th>Reposición</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="note">
          Este reporte muestra el estado actual del inventario: disponible, asignado a habitaciones, en lavandería, dañado y retirado del inventario.
        </div>

        <div class="signature-grid">
          <div class="signature">Responsable de inventario</div>
          <div class="signature">Gerencia / Administración</div>
        </div>
      `,
    )
  }

  function printDamageVoucher(record: DamageRecord) {
    openPrintableDocument(
      `Vale de daño ${record.id}`,
      `
        <div class="report-header">
          <div>
            <div class="brand">Casa Luna Boutique Hotel</div>
            <div class="subtitle">Vale de daño o retiro de inventario</div>
          </div>
          <div class="meta">
            <strong>No. de vale:</strong> ${escapeHtml(record.id)}<br/>
            <strong>Fecha:</strong> ${escapeHtml(nowLabel())}
          </div>
        </div>

        <section class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Artículo</div>
            <div class="summary-value">${escapeHtml(record.itemName)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Cantidad</div>
            <div class="summary-value">${escapeHtml(record.qty)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Habitación</div>
            <div class="summary-value">${escapeHtml(record.room)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Reposición</div>
            <div class="summary-value">${escapeHtml(money(record.replacementCost))}</div>
          </div>
        </section>

        <h2>Detalle</h2>
        <table>
          <tbody>
            <tr><th>Huésped</th><td>${escapeHtml(record.guest)}</td></tr>
            <tr><th>Motivo</th><td>${escapeHtml(record.reason)}</td></tr>
            <tr><th>Responsable</th><td>${escapeHtml(record.responsible)}</td></tr>
            <tr><th>Estado</th><td>${escapeHtml(record.status)}</td></tr>
          </tbody>
        </table>

        <div class="note">
          Este documento sirve como evidencia interna del daño, pérdida o retiro del artículo indicado.
        </div>

        <div class="signature-grid">
          <div class="signature">Firma del responsable</div>
          <div class="signature">Autorización administración / gerencia</div>
        </div>
      `,
    )
  }

  function openLaundryModalFromAssignment(assignment: RoomAssignment) {
    setLaundryForm({
      assignmentId: assignment.id,
      expectedReturn: "",
      responsible: "Camarería",
      notes: "",
    })
    setModal("laundry")
  }

  function openBulkLaundryModal(group: RoomAssignmentGroup) {
    setBulkLaundryForm({
      roomKey: group.key,
      expectedReturn: "",
      responsible: "Camarería",
      notes: "",
    })
    setModal("bulkLaundry")
  }

  function openDamageModalFromAssignment(assignment: RoomAssignment) {
    setDamageForm({
      assignmentId: assignment.id,
      itemId: assignment.itemId,
      itemName: assignment.itemName,
      category: assignment.category,
      room: assignment.room,
      guest: assignment.guest,
      qty: String(assignment.qty),
      reason: "",
      replacementCost: String(getItemReplacementCost(assignment.itemId)),
      responsible: "Recepción",
    })
    setModal("damage")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventarios"
        title="Blancos, lavandería y activos"
        description="Flujo simple: revisa inventario, asigna a habitación, envía a lavandería o registra daño."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={printInventoryReport}>
              <Download className="size-4" />
              Reporte de inventario
            </Button>
            <Button size="sm" className="gap-2 rounded-full" onClick={() => setModal("newItem")}>
              <Plus className="size-4" />
              Nuevo artículo
            </Button>
          </div>
        }
      />

      <QuickGuide
        title="Guía rápida para blancos y mobiliario"
        description="Usa esta pantalla para saber qué está disponible, qué está en habitaciones, qué fue a lavandería y qué debe revisarse por daño."
        steps={[
          { icon: Shirt, title: "Revisa disponibles", text: "Mira qué ropa, toallas o artículos están limpios y listos para usar." },
          { icon: BedDouble, title: "Revisa habitaciones", text: "Si algo salió de un cuarto, mándalo a lavandería o reporta el daño." },
          { icon: WashingMachine, title: "Recibe lavandería", text: "Cuando algo regrese limpio, márcalo como disponible otra vez." },
          { icon: AlertTriangle, title: "Reporta daños", text: "Si algo se perdió o se dañó, deja el registro para revisar cobro o retiro." },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Disponibles" value={totals.available} helper="Listos para usar" icon={CheckCircle2} tone="success" />
        <MetricCard label="En habitaciones" value={totals.inUse} helper="Asignados actualmente" icon={BedDouble} tone="info" />
        <MetricCard label="En lavandería" value={totals.laundry} helper="Pendientes de regresar limpios" icon={WashingMachine} tone="warning" />
        <MetricCard label="Daños pendientes" value={totals.damaged} helper="Revisar cobro o retiro" icon={AlertTriangle} tone="danger" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total registrado" value={totals.total} helper="Inventario físico total" icon={Shirt} />
        <MetricCard label="Retirados" value={totals.retired} helper="Fuera del inventario activo" icon={Trash2} />
        <MetricCard label="Stock bajo" value={totals.lowStock} helper="Artículos bajo mínimo" icon={ClipboardList} tone={totals.lowStock > 0 ? "warning" : "success"} />
        <MetricCard label="Valor reposición" value={money(totals.value)} helper="Referencia total de reposición" icon={Sparkles} />
      </section>

      {lowStockItems.length > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Hay artículos bajo mínimo</p>
              <p className="text-sm">Revisa: {lowStockItems.map((item) => item.name).join(", ")}.</p>
            </div>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="inventario" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="resumen">Resumen por habitación</TabsTrigger>
          <TabsTrigger value="habitaciones">Habitaciones</TabsTrigger>
          <TabsTrigger value="lavanderia">Lavandería</TabsTrigger>
          <TabsTrigger value="danos">Daños</TabsTrigger>
          <TabsTrigger value="movimientos">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="space-y-4">
          <Panel
            title="Inventario general"
            description="Lista de artículos disponibles, en habitaciones, en lavandería, dañados y retirados."
            action={
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar artículo..."
                  className="pl-9"
                />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Artículo</th>
                    <th className="py-3 pr-4">Disponible</th>
                    <th className="py-3 pr-4">Habitaciones</th>
                    <th className="py-3 pr-4">Lavandería</th>
                    <th className="py-3 pr-4">Daño</th>
                    <th className="py-3 pr-4">Retirado</th>
                    <th className="py-3 pr-4">Mínimo</th>
                    <th className="py-3 pr-4">Reposición</th>
                    <th className="py-3 pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.code} · {item.category}</div>
                      </td>
                      <td className="py-4 pr-4 font-semibold text-emerald-700">{item.availableQty}</td>
                      <td className="py-4 pr-4">{item.inUseQty}</td>
                      <td className="py-4 pr-4">{item.laundryQty}</td>
                      <td className="py-4 pr-4">{item.damagedQty}</td>
                      <td className="py-4 pr-4">{item.retiredQty}</td>
                      <td className="py-4 pr-4">
                        <span className={item.availableQty <= item.minStock ? "font-semibold text-amber-700" : ""}>
                          {item.minStock}
                        </span>
                      </td>
                      <td className="py-4 pr-4">{money(item.replacementCost)}</td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => {
                            setAssignmentForm((current) => ({ ...current, itemId: item.id }))
                            setModal("assign")
                          }}
                        >
                          Asignar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => openEditItemModal(item)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => requestDeleteInventoryItem(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Borrar
                        </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="resumen" className="space-y-4">
          <Panel
            title="Resumen por habitación"
            description="Vista rápida de qué artículo y cuánta cantidad tiene asignada cada habitación."
            action={
              <Button size="sm" className="gap-2 rounded-full" onClick={() => setModal("assign")}>
                <BedDouble className="size-4" />
                Asignar artículo
              </Button>
            }
          >
            {assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay artículos asignados a habitaciones.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4">Habitación</th>
                      <th className="py-3 pr-4">Artículo</th>
                      <th className="py-3 pr-4">Cantidad</th>
                      <th className="py-3 pr-4">Responsable</th>
                      <th className="py-3 pr-4">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...assignments]
                      .sort((a, b) => a.room.localeCompare(b.room, "es", { numeric: true }))
                      .map((assignment) => (
                        <tr key={assignment.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-semibold">Habitación {assignment.room}</td>
                          <td className="py-3 pr-4">{assignment.itemName}</td>
                          <td className="py-3 pr-4">{assignment.qty}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{assignment.responsible}</td>
                          <td className="py-3 pr-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 rounded-full"
                              onClick={() => openLaundryModalFromAssignment(assignment)}
                            >
                              <Trash2 className="size-3.5" />
                              Quitar (enviar a lavandería)
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="habitaciones" className="space-y-4">
          <Panel
            title="Artículos en habitaciones"
            description="Aquí el empleado decide qué pasa con cada artículo: enviarlo a lavandería o reportarlo como dañado/perdido."
            action={
              <Button size="sm" className="gap-2 rounded-full" onClick={() => setModal("assign")}>
                <BedDouble className="size-4" />
                Asignar a habitación
              </Button>
            }
          >
            {roomAssignmentGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay artículos asignados a habitaciones.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {roomAssignmentGroups.map((group) => (
                  <article key={group.key} className="rounded-3xl border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">Habitación {group.room}</h3>
                          <StatusBadge status="En habitación" />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">Check-in: {group.checkIn}</div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {group.assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl bg-muted/40 p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-semibold">{assignment.itemName}</p>
                              <p className="text-xs text-muted-foreground">
                                {assignment.category} · {assignment.responsible}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border bg-background px-3 py-1 text-sm font-semibold">
                                {assignment.qty} unidad(es)
                              </span>
                              <Button size="sm" className="gap-2 rounded-full" onClick={() => openLaundryModalFromAssignment(assignment)}>
                                <WashingMachine className="size-4" />
                                Lavandería
                              </Button>
                              <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => openDamageModalFromAssignment(assignment)}>
                                <AlertTriangle className="size-4" />
                                Daño
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <Button className="w-full gap-2 rounded-full" onClick={() => openBulkLaundryModal(group)}>
                        <WashingMachine className="size-4" />
                        Enviar toda la habitación a lavandería
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="lavanderia" className="space-y-4">
          <Panel title="Lavandería" description="Aquí solo aparecen artículos que ya fueron enviados a lavar. Cuando regresen limpios, márcalos como disponibles.">
            {laundry.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay artículos en lavandería.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {laundry.map((batch) => (
                  <article key={batch.id} className="rounded-3xl border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{batch.itemName}</h3>
                          <StatusBadge status={batch.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Habitación {batch.room}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-sm font-semibold">{batch.qty} unidades</div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Enviado</p>
                        <p className="font-semibold">{batch.sentAt}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Retorno estimado</p>
                        <p className="font-semibold">{batch.expectedReturn}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Responsable</p>
                        <p className="font-semibold">{batch.responsible}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full"
                        disabled={linenSaving || batch.status !== "En lavandería"}
                        onClick={() => markLaundryReady(batch.id)}
                      >
                        Marcar como limpio
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2 rounded-full"
                        disabled={linenSaving || batch.status !== "Lista para regresar"}
                        onClick={() => returnLaundry(batch.id)}
                      >
                        <RefreshCcw className="size-4" />
                        Regresar a disponible
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="danos" className="space-y-4">
          <Panel
            title="Daños y pérdidas"
            description="Aquí se revisan los artículos dañados o perdidos. Primero se cobra si aplica, luego se retira del inventario si ya no sirve."
            action={
              <Button size="sm" className="gap-2 rounded-full" onClick={() => setModal("damage")} disabled={assignments.length === 0}>
                <AlertTriangle className="size-4" />
                Reportar daño
              </Button>
            }
          >
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <strong>Flujo recomendado:</strong> 1) Reportar daño desde la habitación. 2) Marcar cobrado si se le cobró al huésped. 3) Retirar del inventario si el artículo ya no sirve.
            </div>

            {damages.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay daños registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {damages.map((record) => (
                  <article key={record.id} className="rounded-3xl border bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{record.itemName}</h3>
                          <StatusBadge status={record.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Habitación {record.room} · {record.guest} · {record.createdAt}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Costo de reposición</p>
                        <p className="text-2xl font-bold">{money(record.replacementCost)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-muted/40 p-3 text-sm">
                      <span className="font-semibold">Motivo:</span> {record.reason}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={linenSaving || record.status !== "Pendiente de cobro"}
                        onClick={() => chargeDamage(record.id)}
                      >
                        1. Marcar cobrado
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => printDamageVoucher(record)}>
                        <Printer className="size-4" />
                        2. Imprimir vale
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2 rounded-full"
                        disabled={linenSaving || record.status === "Retirado del inventario"}
                        onClick={() =>
                          setPendingDialog({
                            title: "Retirar artículo dañado",
                            description: `Confirma que quieres retirar ${record.qty} unidad(es) de ${record.itemName} del inventario activo.`,
                            confirmLabel: "Sí, retirar",
                            tone: "danger",
                            onConfirm: () => {
                              retireDamagedItem(record.id)
                              setPendingDialog(null)
                            },
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        3. Retirar del inventario
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4">
          <Panel
            title="Historial"
            description="Registro simple de todo lo que se hizo en blancos."
            action={
              <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={printInventoryReport}>
                <Printer className="size-4" />
                Imprimir reporte
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Acción</th>
                    <th className="py-3 pr-4">Artículo</th>
                    <th className="py-3 pr-4">Cantidad</th>
                    <th className="py-3 pr-4">Desde</th>
                    <th className="py-3 pr-4">Hacia</th>
                    <th className="py-3 pr-4">Motivo</th>
                    <th className="py-3 pr-4">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b last:border-0">
                      <td className="py-4 pr-4">{movement.date}</td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold">{movement.type}</span>
                      </td>
                      <td className="py-4 pr-4 font-semibold">{movement.itemName}</td>
                      <td className="py-4 pr-4">{movement.qty}</td>
                      <td className="py-4 pr-4">{movement.from}</td>
                      <td className="py-4 pr-4">{movement.to}</td>
                      <td className="py-4 pr-4">{movement.reason}</td>
                      <td className="py-4 pr-4">{movement.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

      </Tabs>

      {modal === "newItem" ? (
        <Modal title="Nuevo artículo" description="Agrega un artículo al inventario de blancos." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del artículo">
              <TextInput value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Toalla facial blanca" />
            </Field>
            <Field label="Categoría">
              <SelectInput value={newItem.category} onChange={(event) => setNewItem((current) => ({ ...current, category: event.target.value as LinenCategory }))}>
                <option>Toalla de cuerpo</option>
                <option>Toalla de manos</option>
                <option>Toalla de pies</option>
                <option>Ropa de cama</option>
                <option>Almohada</option>
                <option>Mobiliario</option>
              </SelectInput>
            </Field>
            <Field label="Cantidad inicial">
              <TextInput type="number" min={1} value={newItem.qty} onChange={(event) => setNewItem((current) => ({ ...current, qty: event.target.value }))} />
            </Field>
            <Field label="Costo de reposición (Q.)">
              <MoneyTextInput min={0} value={newItem.replacementCost} onChange={(event) => setNewItem((current) => ({ ...current, replacementCost: event.target.value }))} />
            </Field>
            <Field label="Stock mínimo">
              <TextInput type="number" min={1} value={newItem.minStock} onChange={(event) => setNewItem((current) => ({ ...current, minStock: event.target.value }))} />
            </Field>
            <Field label="Ubicación">
              <TextInput value={newItem.location} onChange={(event) => setNewItem((current) => ({ ...current, location: event.target.value }))} />
            </Field>
            <Field label="Responsable">
              <TextInput value={newItem.responsible} onChange={(event) => setNewItem((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" onClick={handleCreateItem} disabled={linenSaving}>
              <PackagePlus className="size-4" />
              Guardar
            </Button>
          </div>
        </Modal>
      ) : null}

      {modal === "editItem" ? (
        <Modal title="Editar artículo" description="Corrige nombre, costo, mínimo o cantidad disponible sin pasar por habitación ni daños." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del artículo">
              <TextInput value={editingItem.name} onChange={(event) => setEditingItem((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Categoría">
              <SelectInput value={editingItem.category} onChange={(event) => setEditingItem((current) => ({ ...current, category: event.target.value as LinenCategory }))}>
                <option>Toalla de cuerpo</option>
                <option>Toalla de manos</option>
                <option>Toalla de pies</option>
                <option>Ropa de cama</option>
                <option>Almohada</option>
                <option>Mobiliario</option>
              </SelectInput>
            </Field>
            <Field label="Cantidad disponible">
              <TextInput type="number" min={0} value={editingItem.availableQty} onChange={(event) => setEditingItem((current) => ({ ...current, availableQty: event.target.value }))} />
            </Field>
            <Field label="Costo de reposición (Q.)">
              <MoneyTextInput min={0} value={editingItem.replacementCost} onChange={(event) => setEditingItem((current) => ({ ...current, replacementCost: event.target.value }))} />
            </Field>
            <Field label="Stock mínimo">
              <TextInput type="number" min={0} value={editingItem.minStock} onChange={(event) => setEditingItem((current) => ({ ...current, minStock: event.target.value }))} />
            </Field>
            <Field label="Ubicación">
              <TextInput value={editingItem.location} onChange={(event) => setEditingItem((current) => ({ ...current, location: event.target.value }))} />
            </Field>
            <Field label="Responsable">
              <TextInput value={editingItem.responsible} onChange={(event) => setEditingItem((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
          </div>
          <div className="mt-4 rounded-2xl border bg-muted/30 p-3 text-sm text-muted-foreground">
            El total activo se recalcula con disponible + habitaciones + lavandería + daño. Los retirados quedan como histórico.
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="gap-2 rounded-full" onClick={() => setModal(null)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button
              className="gap-2 rounded-full"
              disabled={linenSaving}
              onClick={() =>
                setPendingDialog({
                  title: "Guardar cambios del artículo",
                  description: "Confirma que quieres aplicar esta edición al catálogo de blancos y mobiliario.",
                  confirmLabel: "Sí, guardar",
                  onConfirm: handleUpdateItem,
                })
              }
            >
              <Save className="size-4" />
              Guardar cambios
            </Button>
          </div>
        </Modal>
      ) : null}

      {modal === "assign" ? (
        <Modal title="Asignar a habitación" description="Usa esto cuando entreguen blancos o activos a una habitación." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artículo disponible">
              <SelectInput value={assignmentForm.itemId} onChange={(event) => setAssignmentForm((current) => ({ ...current, itemId: event.target.value }))}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · disponibles {item.availableQty}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Cantidad">
              <TextInput type="number" min={1} value={assignmentForm.qty} onChange={(event) => setAssignmentForm((current) => ({ ...current, qty: event.target.value }))} />
            </Field>
            <Field label="Habitación">
              <SelectInput value={assignmentForm.room} onChange={(event) => setAssignmentForm((current) => ({ ...current, room: event.target.value }))}>
                <option value="">Selecciona habitación</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.number}>
                    Habitacion {room.number}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Responsable">
              <TextInput value={assignmentForm.responsible} onChange={(event) => setAssignmentForm((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" onClick={handleAssignToRoom} disabled={linenSaving}>
              <BedDouble className="size-4" />
              Asignar
            </Button>
          </div>
        </Modal>
      ) : null}

      {modal === "laundry" ? (
        <Modal title="Enviar a lavandería" description="El artículo saldrá de la habitación y pasará directo a lavandería." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artículo en habitación">
              <SelectInput value={laundryForm.assignmentId} onChange={(event) => setLaundryForm((current) => ({ ...current, assignmentId: event.target.value }))}>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    Habitacion {assignment.room} · {assignment.itemName} · {assignment.qty}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Retorno estimado">
              <TextInput type="datetime-local" value={laundryForm.expectedReturn} onChange={(event) => setLaundryForm((current) => ({ ...current, expectedReturn: event.target.value }))} />
            </Field>
            <Field label="Responsable">
              <TextInput value={laundryForm.responsible} onChange={(event) => setLaundryForm((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observaciones">
                <TextArea value={laundryForm.notes} onChange={(event) => setLaundryForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej. check-out habitación 203, cambio de blancos..." />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" onClick={handleSendAssignmentToLaundry} disabled={linenSaving}>
              <WashingMachine className="size-4" />
              Enviar a lavandería
            </Button>
          </div>
        </Modal>
      ) : null}

      {modal === "bulkLaundry" ? (
        <Modal title="Enviar habitación a lavandería" description="Manda todos los artículos asignados a esa habitación en una sola salida." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Habitación">
              <SelectInput value={bulkLaundryForm.roomKey} onChange={(event) => setBulkLaundryForm((current) => ({ ...current, roomKey: event.target.value }))}>
                <option value="">Selecciona habitación</option>
                {roomAssignmentGroups.map((group) => (
                  <option key={group.key} value={group.key}>
                    Habitacion {group.room} · {group.assignments.length} artículo(s)
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Retorno estimado">
              <TextInput type="datetime-local" value={bulkLaundryForm.expectedReturn} onChange={(event) => setBulkLaundryForm((current) => ({ ...current, expectedReturn: event.target.value }))} />
            </Field>
            <Field label="Responsable">
              <TextInput value={bulkLaundryForm.responsible} onChange={(event) => setBulkLaundryForm((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observaciones">
                <TextArea value={bulkLaundryForm.notes} onChange={(event) => setBulkLaundryForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej. check-out, cambio completo de blancos..." />
              </Field>
            </div>
          </div>

          {roomAssignmentGroups.find((group) => group.key === bulkLaundryForm.roomKey) ? (
            <div className="mt-4 rounded-2xl border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">Se enviará:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {roomAssignmentGroups
                  .find((group) => group.key === bulkLaundryForm.roomKey)
                  ?.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      {assignment.qty} · {assignment.itemName}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" onClick={handleSendRoomToLaundry} disabled={linenSaving || !bulkLaundryForm.roomKey}>
              <WashingMachine className="size-4" />
              Enviar todo
            </Button>
          </div>
        </Modal>
      ) : null}

      {modal === "damage" ? (
        <Modal title="Reportar daño o pérdida" description="El artículo saldrá de la habitación y quedará pendiente de cobro o retiro." onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artículo en habitación">
              <SelectInput
                value={damageForm.assignmentId}
                onChange={(event) => {
                  const assignment = assignments.find((entry) => entry.id === event.target.value)
                  if (!assignment) return

                  setDamageForm((current) => ({
                    ...current,
                    assignmentId: assignment.id,
                    itemId: assignment.itemId,
                    itemName: assignment.itemName,
                    category: assignment.category,
                    room: assignment.room,
                    guest: assignment.guest,
                    qty: String(assignment.qty),
                    replacementCost: String(getItemReplacementCost(assignment.itemId)),
                  }))
                }}
              >
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    Habitacion {assignment.room} · {assignment.itemName} · {assignment.qty}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Cantidad dañada o perdida">
              <TextInput type="number" min={1} value={damageForm.qty} onChange={(event) => setDamageForm((current) => ({ ...current, qty: event.target.value }))} />
            </Field>
            <Field label="Habitación">
              <TextInput value={damageForm.room} readOnly />
            </Field>
            <Field label="Huésped">
              <TextInput value={damageForm.guest} readOnly />
            </Field>
            <Field label="Costo de reposición (Q.)">
              <MoneyTextInput min={0} value={damageForm.replacementCost} onChange={(event) => setDamageForm((current) => ({ ...current, replacementCost: event.target.value }))} />
            </Field>
            <Field label="Responsable">
              <TextInput value={damageForm.responsible} onChange={(event) => setDamageForm((current) => ({ ...current, responsible: event.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Motivo">
                <TextArea value={damageForm.reason} onChange={(event) => setDamageForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ej. mancha permanente, pieza perdida, control quebrado..." />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" onClick={handleReportDamage} disabled={linenSaving}>
              <AlertTriangle className="size-4" />
              Registrar daño
            </Button>
          </div>
        </Modal>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDialog)}
        onOpenChange={(open) => {
          if (!open) setPendingDialog(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingDialog?.tone === "danger"
                  ? "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "rounded-full"
              }
              disabled={linenSaving}
              onClick={pendingDialog?.onConfirm}
            >
              {pendingDialog?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default InventarioBlancosPage
