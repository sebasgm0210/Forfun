import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Coffee,
  Home,
  Minus,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wine,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { FieldGrid, MiniTable, MoneyInput, SectionCard, StatCard, StatusPill, money } from "@/components/modules/view-kit"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { formatDate, useStore } from "@/lib/store"
import type { InventoryItem, InventoryMovement, Reservation, Room } from "@/lib/types"
import { cn } from "@/lib/utils"

type SnackForm = {
  name: string
  unit: string
  stock: number
  minStock: number
  cost: number
  price: number
  location: string
}

type ReviewLine = {
  itemId: string
  qty: number
}

type PendingChargeLine = {
  itemId: string
  name: string
  qty: number
  price: number
  total: number
}

type PendingCharge = {
  id: string
  room: string
  guest: string
  reservationId?: string
  reservationCode?: string
  reportedBy: string
  createdAt: string
  lines: PendingChargeLine[]
  total: number
  status: "pendiente" | "cargado"
}

type StockMode = "entrada" | "ajuste"
type ViewFilter = "todos" | "comprar" | "bodega" | "habitacion"
type RoomMiniBars = Record<string, Record<string, number>>
type RoomMiniBarConfig = Record<string, boolean>
type MinibarRoomContext = {
  roomId: string
  roomNumber: string
  status: string
  stayId?: string
  guestName?: string
}
type StayCharge = {
  id: string
  description: string
  amount: number
  status: string
  date: string
}
type PurchaseOrderLine = {
  id: string
  itemId: string
  itemName: string
  unitName: string
  orderedQty: number
  receivedQty: number
  unitCost: number
}
type PurchaseOrder = {
  id: string
  category: string
  supplierName: string
  orderedBy: string
  status: string
  estimatedTotal: number
  receivedTotal: number
  orderedAt: string
  receivedAt?: string
  receivedBy?: string
  notes?: string
  items: PurchaseOrderLine[]
}
type PurchaseOrderDraftLine = {
  itemId: string
  qty: number
  unitCost: number
}
type StaffOption = {
  name: string
  role: string
}

type CardFeedback = Record<string, string>

const emptyForm: SnackForm = {
  name: "",
  unit: "unidad",
  stock: 0,
  minStock: 6,
  cost: 0,
  price: 0,
  location: "Bodega A",
}

const locationOptions = ["Bodega A"]
const unitOptions = ["unidad", "botella", "bolsa", "barra", "lata", "paquete"]

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

function mapPendingCharge(value: unknown): PendingCharge | null {
  const record = apiRecord(value)
  const id = apiText(record, [
    "id_minibar_room_review",
    "idMinibarRoomReview",
    "id",
  ])
  if (!id) return null

  const lines = apiArray(record.details).map((value) => {
    const detail = apiRecord(value)
    const qty = apiNumber(detail, ["consumed_quantity", "quantity"], 1)
    const total = apiNumber(detail, ["amount", "total"])
    const price = apiNumber(
      detail,
      ["unit_price", "guest_price", "price"],
      qty > 0 ? total / qty : 0,
    )
    return {
      itemId: apiText(detail, [
        "id_inventory_item",
        "idInventoryItem",
        "id_minibar_room_review_detail",
      ]),
      name: apiText(detail, ["item_name", "description"], "Producto"),
      qty,
      price,
      total,
    }
  })
  const rawStatus = apiText(record, ["status"], "PorCargar").toLowerCase()

  return {
    id,
    room: apiText(record, ["room_number", "roomNumber"], "-"),
    guest: apiText(record, ["guest", "guest_name"], "Sin huésped asignado"),
    reportedBy: apiText(record, ["reviewed_by", "reviewedBy"], "Camarería"),
    createdAt: apiText(
      record,
      ["reviewed_at", "reviewedAt", "created_at"],
      new Date().toISOString(),
    ),
    lines,
    total: apiNumber(
      record,
      ["total_amount", "totalAmount"],
      lines.reduce((sum, line) => sum + line.total, 0),
    ),
    status:
      rawStatus.includes("carg") && !rawStatus.includes("por")
        ? "cargado"
        : "pendiente",
  }
}

function mapStayCharge(value: unknown, index: number): StayCharge {
  const record = apiRecord(value)
  return {
    id: apiText(record, ["id_minibar_charge", "id_minibar_room_review_detail", "id"], `stay-charge-${index}`),
    description: apiText(record, ["description", "item_name", "name"], "Cargo minibar"),
    amount: apiNumber(record, ["amount", "total", "total_amount", "price"]),
    status: apiText(record, ["status"], "Pendiente"),
    date: apiText(record, ["created_at", "createdAt", "date", "reviewed_at"], new Date().toISOString()),
  }
}

function mapPurchaseOrder(value: unknown): PurchaseOrder | null {
  const record = apiRecord(value)
  const id = apiText(record, ["id_inventory_purchase_order", "idInventoryPurchaseOrder", "id"])
  if (!id) return null

  const items = apiArray(record.items).map((lineValue, index): PurchaseOrderLine => {
    const line = apiRecord(lineValue)
    return {
      id: apiText(
        line,
        ["id_inventory_purchase_order_detail", "idInventoryPurchaseOrderDetail"],
        `${id}-${index}`,
      ),
      itemId: apiText(line, ["id_inventory_item", "idInventoryItem"]),
      itemName: apiText(line, ["item_name", "itemName"], "Producto"),
      unitName: apiText(line, ["unit_name", "unitName"], "unidad"),
      orderedQty: apiNumber(line, ["ordered_quantity", "orderedQuantity"]),
      receivedQty: apiNumber(line, ["received_quantity", "receivedQuantity"]),
      unitCost: apiNumber(line, ["unit_cost", "unitCost"]),
    }
  })

  return {
    id,
    category: apiText(record, ["category"], "snack"),
    supplierName: apiText(record, ["supplier_name", "supplierName"], "Sin proveedor"),
    orderedBy: apiText(record, ["ordered_by", "orderedBy"], "-"),
    status: apiText(record, ["status"], "Ordenado"),
    estimatedTotal: apiNumber(record, ["estimated_total", "estimatedTotal"]),
    receivedTotal: apiNumber(record, ["received_total", "receivedTotal"]),
    orderedAt: apiText(record, ["ordered_at", "orderedAt"], new Date().toISOString()),
    receivedAt: apiText(record, ["received_at", "receivedAt"]) || undefined,
    receivedBy: apiText(record, ["received_by", "receivedBy"]) || undefined,
    notes: apiText(record, ["notes"]) || undefined,
    items,
  }
}

function stockTone(item: InventoryItem) {
  if (item.stock === 0) return "danger"
  if (item.stock <= item.minStock) return "warning"
  return "success"
}

function stockLabel(item: InventoryItem) {
  if (item.stock === 0) return "no hay"
  if (item.stock <= item.minStock) return "comprar"
  return "bien"
}

function movementLabel(type: InventoryMovement["type"]) {
  if (type === "consumo") return "Consumo"
  if (type === "entrada") return "Llegaron productos"
  if (type === "salida") return "Salio de bodega"
  return "Conteo corregido"
}

function expectedRoomQty(item: InventoryItem) {
  const name = item.name.toLowerCase()
  if (name.includes("agua") || name.includes("soda") || name.includes("cerveza")) return 2
  return 1
}

function inventoryItemPayloadFromForm(form: SnackForm) {
  return {
    name: form.name.trim(),
    category: "snack",
    stock_quantity: Math.max(0, Math.floor(form.stock)),
    minimum_quantity: Math.max(0, Math.floor(form.minStock)),
    unit_name: form.unit.trim() || "unidad",
    cost_price: Math.max(0, form.cost),
    guest_price: Math.max(0, form.price),
    warehouse_name: form.location.trim() || "Bodega A",
    supplier_name: null,
  }
}

function backendNumericId(value: string | number | undefined, label: string) {
  const id = Number(value)
  if (Number.isInteger(id) && id > 0) return id

  toast.error(`${label} no tiene identificador real del backend`, {
    description: "Recarga la vista. No se guardó ningún cambio local falso.",
  })
  return null
}

function nestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return {}
}

function stayRoomRecords(stay: Record<string, unknown>) {
  const arrays = [
    ...apiArray(stay.rooms),
    ...apiArray(stay.Rooms),
    ...apiArray(stay.reservation_rooms),
    ...apiArray(stay.reservationRooms),
    ...apiArray(stay.stay_rooms),
    ...apiArray(stay.stayRooms),
  ]
  const nested = [
    nestedRecord(stay, ["room", "Room", "habitacion", "habitación"]),
    nestedRecord(stay, ["reservation_room", "reservationRoom", "room_reservation", "roomReservation"]),
    nestedRecord(stay, ["stay_room", "stayRoom"]),
  ].filter((record) => Object.keys(record).length > 0)

  return arrays.length > 0 ? arrays.map(apiRecord) : nested
}

function mapStayRoomRefs(value: unknown) {
  const stay = apiRecord(value)
  const stayId = apiText(stay, ["id_stay", "idStay", "stay_id", "stayId", "id"])
  if (!stayId) return []

  const guest = nestedRecord(stay, ["guest", "Guest", "customer", "Customer", "client", "Client"])
  const reservation = nestedRecord(stay, ["reservation", "Reservation"])
  const reservationGuest = nestedRecord(reservation, ["guest", "Guest", "customer", "Customer", "client", "Client"])
  const guestName = apiText(
    stay,
    ["guest_name", "guestName", "customer_name", "customerName", "client_name", "clientName", "full_name", "fullName"],
    apiText(
      guest,
      ["name_or_company", "name", "full_name", "fullName"],
      apiText(reservationGuest, ["name_or_company", "name", "full_name", "fullName"], "Sin huésped asignado"),
    ),
  )

  const directRoomId = apiText(stay, ["id_room", "idRoom", "room_id", "roomId"])
  const directRoomNumber = apiText(stay, ["room_number", "roomNumber", "number"])
  const records = stayRoomRecords(stay)
  const sourceRecords = records.length > 0 ? records : [stay]

  return sourceRecords.flatMap((entry) => {
    const record = apiRecord(entry)
    const nestedRoom = nestedRecord(record, ["room", "Room", "habitacion", "habitación"])
    const roomId =
      apiText(record, ["id_room", "idRoom", "room_id", "roomId"]) ||
      apiText(nestedRoom, ["id_room", "idRoom", "room_id", "roomId", "id"]) ||
      directRoomId
    const roomNumber =
      apiText(record, ["room_number", "roomNumber", "number"]) ||
      apiText(nestedRoom, ["room_number", "roomNumber", "number"]) ||
      directRoomNumber

    if (!roomId && !roomNumber) return []
    return [{ roomId, roomNumber, stayId, guestName }]
  })
}

function findRoomStay(room: Room | undefined, reservations: Reservation[]) {
  if (!room) return undefined
  return (
    reservations.find((reservation) => reservation.roomId === room.id && reservation.status === "in-house") ??
    reservations.find((reservation) => reservation.roomId === room.id && reservation.status === "checkout")
  )
}

function CardActionFeedback({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl border border-emerald-200 bg-card/95 p-4 text-center shadow-sm backdrop-blur-sm animate-card-action-success">
      <div>
        <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
        <p className="mt-2 font-semibold text-emerald-900">{message}</p>
      </div>
    </div>
  )
}

export function InventarioSnacksPage() {
  const {
    inventory,
    inventoryMovements,
    rooms,
    reservations,
    guests,
    users,
    housekeepingTasks,
    refreshApiState,
  } = useStore()
  const items = inventory.filter((item) => item.category === "snack")
  const cleaningStaff = useMemo<StaffOption[]>(() => {
    const staffByName = new Map<string, StaffOption>()

    users
      .filter((user) => user.status === "activo" && user.role === "camarera")
      .forEach((user) => staffByName.set(user.name, { name: user.name, role: "Camarera" }))

    housekeepingTasks.forEach((task) => {
      if (task.assignedTo && !staffByName.has(task.assignedTo)) {
        staffByName.set(task.assignedTo, { name: task.assignedTo, role: "Camarera" })
      }
    })

    return Array.from(staffByName.values())
  }, [housekeepingTasks, users])

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SnackForm>(emptyForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ViewFilter>("todos")
  const [minibarRooms, setMinibarRooms] = useState<MinibarRoomContext[]>([])
  const [selectedRoom, setSelectedRoom] = useState("")
  const [reviewedBy, setReviewedBy] = useState(cleaningStaff[0]?.name ?? "Beatriz López")
  const [review, setReview] = useState<ReviewLine[]>([])
  const [roomMiniBars, setRoomMiniBars] = useState<RoomMiniBars>({})
  const [roomExpectedMiniBars, setRoomExpectedMiniBars] = useState<RoomMiniBars>({})
  const [configuredMiniBars, setConfiguredMiniBars] = useState<RoomMiniBarConfig>({})
  const [pendingCharges, setPendingCharges] = useState<PendingCharge[]>([])
  const [stayChargesByStay, setStayChargesByStay] = useState<Record<string, StayCharge[]>>({})
  const [chargeToDelete, setChargeToDelete] = useState<PendingCharge | null>(null)
  const [stockItemId, setStockItemId] = useState("")
  const [stockQty, setStockQty] = useState(1)
  const [stockMode, setStockMode] = useState<StockMode>("entrada")
  const [stockReason, setStockReason] = useState("Reposicion de minibar")
  const [productSaving, setProductSaving] = useState(false)
  const [stockSaving, setStockSaving] = useState(false)
  const [cardFeedback, setCardFeedback] = useState<CardFeedback>({})
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [poSupplier, setPoSupplier] = useState("")
  const [poNotes, setPoNotes] = useState("")
  const [poDraftItemId, setPoDraftItemId] = useState("")
  const [poDraftQty, setPoDraftQty] = useState(1)
  const [poDraftLines, setPoDraftLines] = useState<PurchaseOrderDraftLine[]>([])
  const [poSaving, setPoSaving] = useState(false)
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({})
  const [receivingSaving, setReceivingSaving] = useState(false)

  const roomOptions = useMemo(
    () =>
      minibarRooms
        .filter(
          (room) =>
            Boolean(room.stayId) ||
            room.status.toLowerCase().includes("ocup"),
        )
        .map((context) =>
          rooms.find((room) => room.id === context.roomId) ??
          rooms.find((room) => room.number === context.roomNumber) ?? {
            id: context.roomId,
            number: context.roomNumber,
            floor: 1,
            typeId: "",
            status: "ocupada" as const,
          },
        ),
    [minibarRooms, rooms],
  )
  const movements = inventoryMovements.filter((movement) => items.some((item) => item.id === movement.itemId))
  const low = items.filter((item) => item.stock <= item.minStock)
  const selectedStockItem = items.find((item) => item.id === stockItemId) ?? items[0]
  const selectedRoomRecord = rooms.find((room) => room.number === selectedRoom)
  const selectedReservation = findRoomStay(selectedRoomRecord, reservations)
  const selectedGuest = selectedReservation ? guests.find((guest) => guest.id === selectedReservation.guestId) : undefined
  const selectedRoomContext = minibarRooms.find((room) => room.roomNumber === selectedRoom)
  const guestName =
    selectedRoomContext?.guestName ??
    selectedGuest?.name ??
    "Sin huesped asignado"
  const selectedStayCharges =
    selectedRoomContext?.stayId ? stayChargesByStay[selectedRoomContext.stayId] ?? [] : []
  const pendingTotal = pendingCharges
    .filter((charge) => charge.status === "pendiente")
    .reduce((sum, charge) => sum + charge.total, 0)
  const totalSaleValue = items.reduce((sum, item) => sum + item.stock * (item.price ?? 0), 0)
  const canSave =
    form.name.trim().length > 2 &&
    form.unit.trim().length > 0 &&
    form.price >= form.cost &&
    form.price > 0 &&
    form.stock >= 0 &&
    form.minStock >= 0

  const hasRoomMinibarConfig = (roomNumber: string) => Boolean(configuredMiniBars[roomNumber])
  const getRoomQty = (roomNumber: string, item: InventoryItem, source = roomMiniBars) =>
    source[roomNumber]?.[item.id] ?? 0
  const getExpectedRoomQty = (roomNumber: string, item: InventoryItem) =>
    roomExpectedMiniBars[roomNumber]?.[item.id] ?? expectedRoomQty(item)

  const restockRooms = useMemo(
    () =>
      roomOptions
        .map((room) => ({
          room,
          missing: items
            .filter(() => hasRoomMinibarConfig(room.number))
            .map((item) => {
              const expected = roomExpectedMiniBars[room.number]?.[item.id] ?? 0
              const current = roomMiniBars[room.number]?.[item.id] ?? 0
              return { item, expected, current, missing: Math.max(0, expected - current) }
            })
            .filter((need) => need.missing > 0),
        }))
        .filter((room) => room.missing.length > 0),
    [items, roomExpectedMiniBars, roomMiniBars, roomOptions],
  )

  const selectedRoomMiniBar = items.map((item) => {
    const expected = getExpectedRoomQty(selectedRoom, item)
    const current = getRoomQty(selectedRoom, item)
    return { item, expected, current, missing: Math.max(0, expected - current) }
  })

  const visibleItems = useMemo(() => {
    const text = query.trim().toLowerCase()

    return items.filter((item) => {
      const matchesText = !text || `${item.name} ${item.location}`.toLowerCase().includes(text)
      const matchesFilter =
        filter === "todos" ||
        (filter === "comprar" && item.stock <= item.minStock) ||
        (filter === "bodega" && item.location.toLowerCase().includes("bodega")) ||
        (filter === "habitacion" && item.location.toLowerCase().includes("minibar"))

      return matchesText && matchesFilter
    })
  }, [filter, items, query])

  const reviewItems = review
    .map((line) => {
      const item = items.find((snack) => snack.id === line.itemId)
      return item ? { item, qty: line.qty, total: line.qty * (item.price ?? 0) } : null
    })
    .filter(Boolean) as Array<{ item: InventoryItem; qty: number; total: number }>
  const reviewTotal = reviewItems.reduce((sum, line) => sum + line.total, 0)

  const loadMinibarData = useCallback(async () => {
    const [roomsResult, staysResult, chargesResult] = await Promise.allSettled([
      api.minibar.listRooms<unknown>(),
      api.checkOut.listInHouse<unknown>(),
      api.minibar.listPendingCharges<unknown>(),
    ])

    const stayByRoom = new Map<
      string,
      { stayId: string; guestName: string }
    >()
    const stayByRoomNumber = new Map<
      string,
      { stayId: string; guestName: string }
    >()
    if (staysResult.status === "fulfilled") {
      apiArray(staysResult.value).forEach((value) => {
        mapStayRoomRefs(value).forEach((stay) => {
          if (stay.roomId) stayByRoom.set(stay.roomId, { stayId: stay.stayId, guestName: stay.guestName })
          if (stay.roomNumber) stayByRoomNumber.set(stay.roomNumber, { stayId: stay.stayId, guestName: stay.guestName })
        })
      })
    }

    if (roomsResult.status === "fulfilled") {
      const contexts = apiArray(roomsResult.value)
        .flatMap((value): MinibarRoomContext[] => {
          const room = apiRecord(value)
          const roomId = apiText(room, ["id_room", "idRoom", "id"])
          const roomNumber = apiText(room, ["room_number", "roomNumber"])
          if (!roomId || !roomNumber) return []
          const stay = stayByRoom.get(roomId) ?? stayByRoomNumber.get(roomNumber)
          return [{
            roomId,
            roomNumber,
            status: apiText(room, ["status"]),
            stayId: stay?.stayId,
            guestName: stay?.guestName,
          }]
        })

      setMinibarRooms(contexts)
      const activeContexts = contexts.filter(
        (room) =>
          Boolean(room.stayId) ||
          room.status.toLowerCase().includes("ocup"),
      )
      setSelectedRoom((current) =>
        activeContexts.some((room) => room.roomNumber === current)
          ? current
          : activeContexts[0]?.roomNumber ?? "",
      )

      const roomItemResults = await Promise.allSettled(
        activeContexts.map(async (room) => ({
          room,
          response: await api.minibar.listRoomItems<unknown>(room.roomId),
        })),
      )
      const currentByRoom: RoomMiniBars = {}
      const expectedByRoom: RoomMiniBars = {}
      const configuredByRoom: RoomMiniBarConfig = {}

      roomItemResults.forEach((result) => {
        if (result.status !== "fulfilled") return
        const response = apiRecord(result.value.response)
        const responseItems = apiArray(response.items).length > 0
          ? apiArray(response.items)
          : apiArray(result.value.response)
        currentByRoom[result.value.room.roomNumber] = {}
        expectedByRoom[result.value.room.roomNumber] = {}
        configuredByRoom[result.value.room.roomNumber] = responseItems.length > 0
        responseItems.forEach((value) => {
          const item = apiRecord(value)
          const inventoryItem = nestedRecord(item, ["inventory_item", "inventoryItem", "item", "Item"])
          const itemId =
            apiText(item, ["id_inventory_item", "idInventoryItem", "inventory_item_id", "inventoryItemId"]) ||
            apiText(inventoryItem, ["id_inventory_item", "idInventoryItem", "inventory_item_id", "id"])
          if (!itemId) return
          currentByRoom[result.value.room.roomNumber]![itemId] = apiNumber(
            item,
            ["current_quantity", "currentQuantity"],
          )
          expectedByRoom[result.value.room.roomNumber]![itemId] = apiNumber(
            item,
            ["expected_quantity", "expectedQuantity"],
          )
        })
      })

      setRoomMiniBars(currentByRoom)
      setRoomExpectedMiniBars(expectedByRoom)
      setConfiguredMiniBars(configuredByRoom)

      const stayChargeResults = await Promise.allSettled(
        activeContexts
          .filter((room) => room.stayId)
          .map(async (room) => ({
            stayId: room.stayId!,
            response: await api.minibar.listStayCharges<unknown>(room.stayId!),
          })),
      )
      const nextStayCharges: Record<string, StayCharge[]> = {}
      stayChargeResults.forEach((result) => {
        if (result.status !== "fulfilled") return
        nextStayCharges[result.value.stayId] = apiArray(result.value.response).map(mapStayCharge)
      })
      setStayChargesByStay(nextStayCharges)
    } else {
      toast.error("No se pudieron cargar las habitaciones de minibar", {
        description: getApiErrorMessage(roomsResult.reason),
      })
    }

    if (chargesResult.status === "fulfilled") {
      setPendingCharges(
        apiArray(chargesResult.value)
          .map(mapPendingCharge)
          .filter((charge): charge is PendingCharge => Boolean(charge)),
      )
    } else {
      toast.error("No se pudieron cargar los cargos de minibar", {
        description: getApiErrorMessage(chargesResult.reason),
      })
    }
  }, [])

  const loadPurchaseOrders = useCallback(async () => {
    try {
      const response = await api.inventory.listPurchaseOrders<unknown>({ category: "snack" })
      setPurchaseOrders(
        apiArray(response)
          .map(mapPurchaseOrder)
          .filter((order): order is PurchaseOrder => Boolean(order)),
      )
    } catch (error) {
      toast.error("No se pudieron cargar las ordenes de compra", {
        description: getApiErrorMessage(error),
      })
    }
  }, [])

  useEffect(() => {
    void Promise.all([
      refreshApiState(
        [
          "inventory",
          "inventoryMovements",
          "rooms",
          "reservations",
          "guests",
          "users",
        ],
        { force: false },
      ),
      loadMinibarData(),
      loadPurchaseOrders(),
    ])
  }, [loadMinibarData, loadPurchaseOrders, refreshApiState])

  const openCreateProduct = () => {
    setEditingItemId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEditProduct = (item: InventoryItem) => {
    setEditingItemId(item.id)
    setForm({
      name: item.name,
      unit: item.unit,
      stock: item.stock,
      minStock: item.minStock,
      cost: item.cost,
      price: item.price ?? 0,
      location: item.location,
    })
    setOpen(true)
  }

  const saveProduct = async () => {
    if (!canSave || productSaving) {
      toast.error("Revisa nombre, cantidades y precios antes de guardar")
      return
    }

    setProductSaving(true)
    try {
      if (editingItemId) {
        const id = backendNumericId(editingItemId, "Producto")
        if (!id) return

        await api.inventory.updateItem(id, {
          ...inventoryItemPayloadFromForm(form),
          is_active: true,
        })
        toast.success("Producto actualizado en backend")
      } else {
        await api.inventory.createItem(inventoryItemPayloadFromForm(form))
        toast.success("Producto agregado en backend")
      }

      await refreshApiState(["inventory", "inventoryMovements"], { force: true })
      await loadMinibarData()
      setForm(emptyForm)
      setEditingItemId(null)
      setOpen(false)
    } catch (error) {
      toast.error("No se pudo guardar el producto", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setProductSaving(false)
    }
  }

  const deleteProduct = async (item: InventoryItem) => {
    const id = backendNumericId(item.id, "Producto")
    if (!id || productSaving) return

    setProductSaving(true)
    try {
      await api.inventory.deleteItem(id)
      setReview((current) => current.filter((line) => line.itemId !== item.id))
      if (stockItemId === item.id) {
        setStockItemId(items.find((nextItem) => nextItem.id !== item.id)?.id ?? "")
      }
      if (editingItemId === item.id) {
        setEditingItemId(null)
        setForm(emptyForm)
        setOpen(false)
      }
      await refreshApiState(["inventory", "inventoryMovements"], { force: true })
      await loadMinibarData()
      setProductToDelete(null)
      toast.info("Producto retirado del inventario", { description: item.name })
    } catch (error) {
      toast.error("No se pudo retirar el producto", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setProductSaving(false)
    }
  }

  const showCardFeedback = (cardId: string, message: string) => {
    setCardFeedback((current) => ({ ...current, [cardId]: message }))
    window.setTimeout(() => {
      setCardFeedback((current) => {
        const next = { ...current }
        delete next[cardId]
        return next
      })
    }, 2200)
  }

  const setMissingQty = (item: InventoryItem, nextQty: number) => {
    const max = getRoomQty(selectedRoom, item)
    const qty = Math.max(0, Math.min(max, nextQty))

    setReview((current) => {
      if (qty === 0) return current.filter((line) => line.itemId !== item.id)
      const existing = current.find((line) => line.itemId === item.id)
      if (existing) return current.map((line) => line.itemId === item.id ? { ...line, qty } : line)
      return [...current, { itemId: item.id, qty }]
    })
  }

  const setExpectedQty = (roomNumber: string, item: InventoryItem, nextQty: number) => {
    const qty = Math.max(0, Math.min(50, Math.floor(nextQty)))

    setRoomExpectedMiniBars((current) => ({
      ...current,
      [roomNumber]: {
        ...(current[roomNumber] ?? {}),
        [item.id]: qty,
      },
    }))

    setRoomMiniBars((current) => ({
      ...current,
      [roomNumber]: {
        ...(current[roomNumber] ?? {}),
        [item.id]: Math.min(current[roomNumber]?.[item.id] ?? 0, qty),
      },
    }))
  }

  const configureSelectedRoomMinibar = async () => {
    if (!selectedRoom) {
      toast.error("Elige una habitación")
      return
    }

    const roomId = Number(selectedRoomContext?.roomId ?? selectedRoomRecord?.id)
    if (!Number.isFinite(roomId)) {
      toast.error("La habitación no tiene identificador del servidor")
      return
    }

    const payloadItems = selectedRoomMiniBar
      .map(({ item, expected }) => ({
        id_inventory_item: Number(item.id),
        expected_quantity: expected,
      }))
      .filter((item) => Number.isFinite(item.id_inventory_item) && item.expected_quantity > 0)

    if (payloadItems.length === 0) {
      toast.error("Deja al menos un producto con cantidad base mayor a cero")
      return
    }

    try {
      await api.inventory.configureRoomMinibar(roomId, { items: payloadItems })
      setConfiguredMiniBars((current) => ({ ...current, [selectedRoom]: true }))
      showCardFeedback(`config-${selectedRoom}`, "Configuración guardada")
      await Promise.all([loadMinibarData(), refreshApiState(["inventory"], { force: true })])
      toast.success(`Minibar configurado para habitación ${selectedRoom}`)
    } catch (error) {
      toast.error("No se pudo configurar el minibar", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const sendReviewToReception = async () => {
    if (!selectedRoom) {
      toast.error("Elige una habitacion")
      return
    }

    if (reviewItems.length === 0) {
      toast.success("Habitacion revisada sin consumo")
      return
    }

    const roomId = Number(selectedRoomContext?.roomId ?? selectedRoomRecord?.id)
    const stayId = Number(selectedRoomContext?.stayId)
    if (!Number.isFinite(roomId)) {
      toast.error("La habitación no tiene identificador del servidor")
      return
    }
    const reviewPayloadItems = reviewItems
      .map(({ item, qty }) => ({
        id_inventory_item: Number(item.id),
        consumed_quantity: qty,
      }))
      .filter((item) => Number.isFinite(item.id_inventory_item))
    if (reviewPayloadItems.length !== reviewItems.length) {
      toast.error("Actualiza el catálogo antes de enviar la revisión")
      return
    }

    try {
      await api.minibar.createRoomReview({
        id_room: roomId,
        id_stay: Number.isFinite(stayId) ? stayId : undefined,
        reviewed_by: reviewedBy.trim() || "Camarería",
        notes: `Revisión de minibar habitación ${selectedRoom}`,
        items: reviewPayloadItems,
      })
      setReview([])
      showCardFeedback("review-summary", "Aviso enviado con exito")
      await loadMinibarData()
      toast.success("Aviso enviado a recepcion", {
        description: `Habitacion ${selectedRoom} · ${money(reviewTotal)}`,
      })
    } catch (error) {
      toast.error("No se pudo enviar la revisión", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const chargeToRoom = async (chargeId: string) => {
    const charge = pendingCharges.find((item) => item.id === chargeId)
    if (!charge) return

    try {
      await api.minibar.chargePendingCharge(chargeId)
      showCardFeedback(`charge-${chargeId}`, "Consumo cargado con exito")
      await Promise.all([
        loadMinibarData(),
        refreshApiState(
          ["inventory", "inventoryMovements", "reservations"],
          { force: true },
        ),
      ])
      toast.success("Consumo cargado a la habitacion", {
        description: `Habitacion ${charge.room} · ${money(charge.total)}`,
      })
    } catch (error) {
      toast.error("No se pudo cargar el consumo", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const deleteCharge = async (chargeId: string) => {
    try {
      await api.minibar.deletePendingCharge(chargeId)
      showCardFeedback(`charge-${chargeId}`, "Aviso eliminado con exito")
      setPendingCharges((current) =>
        current.filter((charge) => charge.id !== chargeId),
      )
      setChargeToDelete(null)
      toast.success("Aviso quitado")
    } catch (error) {
      toast.error("No se pudo quitar el aviso", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const fillRoomItem = async (roomNumber: string, item: InventoryItem) => {
    const room = minibarRooms.find((entry) => entry.roomNumber === roomNumber)
    const roomId = Number(room?.roomId)
    const itemId = Number(item.id)
    if (!Number.isFinite(roomId) || !Number.isFinite(itemId)) return

    try {
      await api.minibar.restockRoom(roomId, {
        registered_by: reviewedBy.trim() || "Camarería",
        notes: `Reposición de ${item.name} para habitación ${roomNumber}`,
        items: [
          {
            id_inventory_item: itemId,
            quantity: Math.max(1, getExpectedRoomQty(roomNumber, item) - getRoomQty(roomNumber, item)),
            expected_quantity: getExpectedRoomQty(roomNumber, item),
          },
        ],
      })
      showCardFeedback(`restock-${roomNumber}`, "Reposicion registrada con exito")
      await Promise.all([loadMinibarData(), refreshApiState(["inventory"], { force: true })])
      toast.success(`Reposicion registrada para habitacion ${roomNumber}`, {
        description: item.name,
      })
    } catch (error) {
      toast.error("No se pudo registrar la reposición", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const fillWholeRoom = async (roomNumber: string) => {
    const room = minibarRooms.find((entry) => entry.roomNumber === roomNumber)
    const roomId = Number(room?.roomId)
    if (!Number.isFinite(roomId)) return

    try {
      await api.minibar.restockRoom(roomId, {
        registered_by: reviewedBy.trim() || "Camarería",
        notes: `Reposición completa de minibar habitación ${roomNumber}`,
        items: items
          .map((item) => {
            const expected = getExpectedRoomQty(roomNumber, item)
            const current = getRoomQty(roomNumber, item)

            return {
              id_inventory_item: Number(item.id),
              quantity: Math.max(0, expected - current),
              expected_quantity: expected,
            }
          })
          .filter((item) => Number.isFinite(item.id_inventory_item) && item.quantity > 0),
      })
      showCardFeedback(`restock-${roomNumber}`, "Minibar completo con exito")
      await Promise.all([loadMinibarData(), refreshApiState(["inventory"], { force: true })])
      toast.success(`Minibar de habitacion ${roomNumber} completo`)
    } catch (error) {
      toast.error("No se pudo completar la reposición", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const saveStockMovement = async () => {
    if (!selectedStockItem || stockQty <= 0 || stockSaving) {
      toast.error("Elige producto y cantidad")
      return
    }

    const itemId = backendNumericId(selectedStockItem.id, "Producto")
    if (!itemId) return

    setStockSaving(true)
    try {
      await api.inventory.createMovement({
        id_inventory_item: itemId,
        movement_type: stockMode === "entrada" ? "Entrada" : "Ajuste",
        quantity: Math.max(1, Math.floor(stockQty)),
        notes: stockReason.trim() || (stockMode === "entrada" ? "Reposición" : "Conteo corregido"),
        registered_by: "Inventario",
      })
      await refreshApiState(["inventory", "inventoryMovements"], { force: true })
      await loadMinibarData()
      toast.success(stockMode === "entrada" ? "Productos agregados en backend" : "Conteo corregido en backend")
      setStockQty(1)
    } catch (error) {
      toast.error("No se pudo guardar el movimiento", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setStockSaving(false)
    }
  }

  const addPurchaseOrderDraftLine = () => {
    const item = items.find((candidate) => candidate.id === poDraftItemId)
    if (!item || poDraftQty <= 0) {
      toast.error("Elige producto y cantidad")
      return
    }
    if (poDraftLines.some((line) => line.itemId === item.id)) {
      toast.error("Ese producto ya esta en la orden")
      return
    }
    setPoDraftLines((current) => [
      ...current,
      { itemId: item.id, qty: Math.max(1, Math.floor(poDraftQty)), unitCost: item.cost },
    ])
    setPoDraftItemId("")
    setPoDraftQty(1)
  }

  const removePurchaseOrderDraftLine = (itemId: string) => {
    setPoDraftLines((current) => current.filter((line) => line.itemId !== itemId))
  }

  const createPurchaseOrderHandler = async () => {
    if (!poDraftLines.length || poSaving) {
      toast.error("Agrega al menos un producto a la orden")
      return
    }
    if (!poSupplier.trim()) {
      toast.error("Indica el proveedor")
      return
    }

    const detailItems = poDraftLines.map((line) => ({
      id_inventory_item: backendNumericId(line.itemId, "Producto") ?? undefined,
      ordered_quantity: line.qty,
      unit_cost: line.unitCost,
    }))
    if (detailItems.some((line) => !line.id_inventory_item)) return

    setPoSaving(true)
    try {
      await api.inventory.createPurchaseOrder({
        category: "snack",
        supplier_name: poSupplier.trim(),
        ordered_by: "Inventario",
        notes: poNotes.trim() || null,
        items: detailItems,
      })
      await loadPurchaseOrders()
      toast.success("Orden de compra creada")
      setPoDraftLines([])
      setPoSupplier("")
      setPoNotes("")
    } catch (error) {
      toast.error("No se pudo crear la orden de compra", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setPoSaving(false)
    }
  }

  const openReceivePurchaseOrder = (order: PurchaseOrder) => {
    setReceivingOrder(order)
    setReceiveQuantities(
      Object.fromEntries(
        order.items.map((line) => [line.id, Math.max(0, line.orderedQty - line.receivedQty)]),
      ),
    )
  }

  const receivePurchaseOrderHandler = async () => {
    if (!receivingOrder || receivingSaving) return

    const orderId = backendNumericId(receivingOrder.id, "Orden de compra")
    if (!orderId) return

    const lines = receivingOrder.items
      .map((line) => ({
        id_inventory_purchase_order_detail: backendNumericId(line.id, "Producto de la orden") ?? undefined,
        received_quantity: Math.max(0, Math.floor(receiveQuantities[line.id] ?? 0)),
      }))
      .filter(
        (line): line is { id_inventory_purchase_order_detail: number; received_quantity: number } =>
          Boolean(line.id_inventory_purchase_order_detail) && line.received_quantity > 0,
      )

    if (!lines.length) {
      toast.error("Indica cuanto llego de cada producto")
      return
    }

    setReceivingSaving(true)
    try {
      await api.inventory.receivePurchaseOrder(orderId, {
        received_by: "Inventario",
        notes: null,
        items: lines,
      })
      await Promise.all([loadPurchaseOrders(), refreshApiState(["inventory"], { force: true })])
      toast.success("Recepcion de mercaderia registrada")
      setReceivingOrder(null)
      setReceiveQuantities({})
    } catch (error) {
      toast.error("No se pudo registrar la recepcion", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setReceivingSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Minibar"
        title="Revision de snacks por habitacion"
        description="La camarera elige la habitacion, registra consumos de minibar y recepcion lo ve listo para cargarlo a la cuenta."
        actions={
          <Button size="sm" className="gap-2 rounded-full" onClick={openCreateProduct}>
            <Plus className="size-3.5" />
            Nuevo producto
          </Button>
        }
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guia rapida para minibar</h2>
          <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
            Pensado para checkout: se revisa el minibar, se registran consumos y recepcion recibe el aviso.
          </p>
        </div>

        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            { icon: Home, title: "Selecciona habitacion", text: "Busca la habitacion que acaba de salir o que esta ocupada." },
            { icon: ClipboardCheck, title: "Registra consumos", text: "Si una bebida o snack fue consumido, toca el boton +." },
            { icon: ReceiptText, title: "Envia a recepcion", text: "Recepcion lo vera con total, cuarto y huesped." },
            { icon: CheckCircle2, title: "Rellena el minibar", text: "Tambien queda alerta para reponer lo consumido en la habitacion." },
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

      {restockRooms.length > 0 ? (
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                <PackagePlus className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Reposicion pendiente por habitacion</h2>
                <p className="mt-1 text-sm text-sky-900/80">
                  El sistema avisa que cuarto necesita reposicion y que producto se debe llevar.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {restockRooms.slice(0, 4).map(({ room, missing }) => (
                <button
                  key={room.id}
                  className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold transition hover:bg-white"
                  onClick={() => fillWholeRoom(room.number)}
                >
                  Habitacion {room.number}: {missing.map((need) => `${need.missing} ${need.item.name}`).join(", ")}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {low.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Hay que comprar pronto</h2>
                <p className="mt-1 text-sm text-amber-900/80">
                  Estos productos ya estan bajos. Toca uno para prepararlo en la entrada de productos.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {low.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold transition hover:bg-white"
                  onClick={() => {
                    setStockItemId(item.id)
                    setStockMode("entrada")
                    toast.info(`${item.name} listo para agregar`)
                  }}
                >
                  {item.name} · quedan {item.stock}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Cuartos a revisar" value={roomOptions.length} helper="Ocupados o con salida" />
        <StatCard label="Avisos para recepcion" value={pendingCharges.filter((charge) => charge.status === "pendiente").length} tone={pendingTotal ? "warning" : "success"} helper={money(pendingTotal)} />
        <StatCard label="Reposicion pendiente" value={restockRooms.length} tone={restockRooms.length ? "warning" : "success"} helper="Minibar incompleto" />
        <StatCard label="Hay que comprar" value={low.length} tone={low.length ? "warning" : "success"} helper="Productos bajos en bodega" />
      </section>

      <Tabs defaultValue="recepcion" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="recepcion">Recepcion</TabsTrigger>
          <TabsTrigger value="revisar">Revisar cuarto</TabsTrigger>
          <TabsTrigger value="reposicion">Reposicion minibar</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="historial">Registro</TabsTrigger>
        </TabsList>

        <TabsContent value="revisar" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <SectionCard title="1. Elige la habitacion" description="Usa esta parte cuando una camarera revisa el minibar despues del checkout.">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-2 text-sm font-medium">
                    Habitacion
                    <select
                      value={selectedRoom}
                      onChange={(event) => {
                        setSelectedRoom(event.target.value)
                        setReview([])
                      }}
                      className="h-10 w-full rounded-full border bg-background px-3 text-sm"
                    >
                      {roomOptions.map((room) => (
                        <option key={room.id} value={room.number}>Habitacion {room.number}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium md:col-span-2">
                    Huesped
                    <Input
                      value={selectedGuest ? `${selectedGuest.name}${selectedReservation?.code ? ` · ${selectedReservation.code}` : ""}` : "Sin huesped en sistema"}
                      readOnly
                      className="rounded-full bg-muted/50"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium md:col-span-3">
                    Personal que reviso
                    <select
                      value={reviewedBy}
                      onChange={(event) => setReviewedBy(event.target.value)}
                      className="h-10 w-full rounded-full border bg-background px-3 text-sm"
                    >
                      {cleaningStaff.map((person) => (
                        <option key={person.name} value={person.name}>{person.name} · {person.role}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </SectionCard>

              <SectionCard title="2. Registra consumos" description="Toca + en las unidades consumidas durante la estadia.">
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedRoomMiniBar.map(({ item, expected, current }) => {
                    const qty = review.find((line) => line.itemId === item.id)?.qty ?? 0
                    const ItemIcon = item.name.toLowerCase().includes("vino") || item.name.toLowerCase().includes("cerveza")
                      ? Wine
                      : item.name.toLowerCase().includes("agua") || item.name.toLowerCase().includes("soda")
                        ? Coffee
                        : Sparkles

                    return (
                      <article
                        key={item.id}
                        className={cn(
                          "rounded-3xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md",
                          qty > 0 && "border-primary/30 bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <ItemIcon className="size-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-semibold">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              En cuarto hay {current} de {expected} · {money(item.price ?? 0)} cada uno
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
                          <span className="text-sm font-medium">Consumo</span>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="size-9 rounded-full p-0" onClick={() => setMissingQty(item, qty - 1)} disabled={!qty}>
                              <Minus className="size-4" />
                            </Button>
                            <span className="grid size-10 place-items-center rounded-2xl bg-background text-lg font-bold tabular-nums">
                              {qty}
                            </span>
                            <Button size="sm" className="size-9 rounded-full p-0" onClick={() => setMissingQty(item, qty + 1)} disabled={qty >= current}>
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4">
              <div className="relative">
                <CardActionFeedback message={cardFeedback[`config-${selectedRoom}`]} />
                <SectionCard
                  title="Inventario de este cuarto"
                  description="Define una sola lista base de productos por habitación; no crees productos duplicados por cuarto."
                  actions={
                    <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={configureSelectedRoomMinibar} disabled={!selectedRoom || items.length === 0}>
                      <Save className="size-4" />
                      Guardar configuración
                    </Button>
                  }
                >
                <div className="space-y-2">
                  {selectedRoomMiniBar.map(({ item, expected, current }) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Actual: {current} · Base configurada: {expected}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="size-8 rounded-full p-0"
                          onClick={() => setExpectedQty(selectedRoom, item, expected - 1)}
                          disabled={expected <= 0}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className={cn("grid min-w-10 place-items-center rounded-full px-2.5 py-1 text-xs font-semibold", current < expected ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                          {expected}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="size-8 rounded-full p-0"
                          onClick={() => setExpectedQty(selectedRoom, item, expected + 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </SectionCard>
              </div>

              <div className="relative">
                <CardActionFeedback message={cardFeedback["review-summary"]} />
                <SectionCard title="3. Aviso para recepcion" description="Revisa antes de enviar. Si no hubo consumo, no se carga nada.">
                  <div className="space-y-3">
                    <div className="rounded-2xl border bg-background/60 p-3">
                      <p className="font-semibold">Habitacion {selectedRoom}</p>
                      <p className="text-sm text-muted-foreground">{guestName}</p>
                    </div>

                    <div className="space-y-2 rounded-2xl border bg-background/60 p-3">
                      {reviewItems.length ? (
                        reviewItems.map(({ item, qty, total }) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{qty} x {money(item.price ?? 0)}</p>
                            </div>
                            <span className="font-semibold">{money(total)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="py-5 text-center text-sm text-muted-foreground">
                          Todavia no marcaste consumos.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-xl font-bold">{money(reviewTotal)}</span>
                    </div>

                    <Button className="w-full gap-2 rounded-full" onClick={sendReviewToReception}>
                      <ReceiptText className="size-4" />
                      Enviar a recepcion
                    </Button>
                  </div>
                </SectionCard>
              </div>

              <SectionCard
                title="Cargos de esta estadia"
                description="Consulta real desde /api/minibar/stay/{stayId}/charges."
              >
                <div className="space-y-2">
                  {selectedStayCharges.map((charge) => (
                    <div key={charge.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{charge.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(charge.date)} · {charge.status}
                        </p>
                      </div>
                      <strong>{money(charge.amount)}</strong>
                    </div>
                  ))}
                  {!selectedStayCharges.length ? (
                    <p className="rounded-2xl border bg-background/60 p-4 text-sm text-muted-foreground">
                      No hay cargos de minibar registrados para esta estadia.
                    </p>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="Llegaron productos" description="Para sumar productos nuevos o corregir un conteo.">
                <StockMovementForm
                  items={items}
                  stockItemId={stockItemId || selectedStockItem?.id || ""}
                  stockMode={stockMode}
                  stockQty={stockQty}
                  stockReason={stockReason}
                  setStockItemId={setStockItemId}
                  setStockMode={setStockMode}
                  setStockQty={setStockQty}
                  setStockReason={setStockReason}
                  onSave={saveStockMovement}
                  saving={stockSaving}
                />
              </SectionCard>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="recepcion">
          <section className="grid gap-3 lg:grid-cols-2">
            {pendingCharges.length ? (
              pendingCharges.map((charge) => (
                <article key={charge.id} className={cn("relative overflow-hidden rounded-3xl border bg-card p-4 shadow-sm", charge.status === "cargado" && "bg-muted/35")}>
                  <CardActionFeedback message={cardFeedback[`charge-${charge.id}`]} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Habitacion {charge.room}</h3>
                      <p className="text-sm text-muted-foreground">
                        {charge.guest}{charge.reservationCode ? ` · ${charge.reservationCode}` : ""}
                      </p>
                    </div>
                    <StatusPill tone={charge.status === "pendiente" ? "warning" : "success"}>
                      {charge.status === "pendiente" ? "Por cargar" : "Cargado"}
                    </StatusPill>
                  </div>

                  <div className="mt-4 space-y-2">
                    {charge.lines.map((line) => (
                      <div key={line.itemId} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 px-3 py-2 text-sm">
                        <span>{line.qty} x {line.name}</span>
                        <strong>{money(line.total)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-xl font-bold">{money(charge.total)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="gap-2 rounded-full" onClick={() => chargeToRoom(charge.id)} disabled={charge.status === "cargado"}>
                      <CheckCircle2 className="size-4" />
                      Cargar a cuenta
                    </Button>
                    <Button variant="outline" className="gap-2 rounded-full" onClick={() => setChargeToDelete(charge)} disabled={charge.status === "cargado"}>
                      <Trash2 className="size-4" />
                      Quitar
                    </Button>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Aviso enviado por {charge.reportedBy} · {formatDate(charge.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground lg:col-span-2">
                No hay consumos pendientes para recepcion.
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="reposicion">
          <section className="grid gap-3 lg:grid-cols-2">
            {restockRooms.length ? (
              restockRooms.map(({ room, missing }) => (
                <article key={room.id} className="relative overflow-hidden rounded-3xl border bg-card p-4 shadow-sm">
                  <CardActionFeedback message={cardFeedback[`restock-${room.number}`]} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Habitacion {room.number}</h3>
                      <p className="text-sm text-muted-foreground">
                        Llevar estos productos y dejar el minibar completo.
                      </p>
                    </div>
                    <StatusPill tone="warning">Reposicion</StatusPill>
                  </div>

                  <div className="mt-4 space-y-2">
                    {missing.map(({ item, missing: missingQty, current, expected }) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-2xl bg-muted/45 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Hay {current}. Debe haber {expected}.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <strong>Reponer {missingQty}</strong>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => fillRoomItem(room.number, item)}>
                            Repuesto
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button className="mt-4 w-full gap-2 rounded-full" onClick={() => fillWholeRoom(room.number)}>
                    <CheckCircle2 className="size-4" />
                    Marcar minibar completo
                  </Button>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground lg:col-span-2">
                Todos los minibares estan completos.
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="productos">
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-3xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Productos activos</p>
                <p className="mt-2 text-2xl font-bold">{items.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Disponibles para minibar</p>
              </div>
              <div className="rounded-3xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Por comprar</p>
                <p className="mt-2 text-2xl font-bold">{low.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Bajo el minimo definido</p>
              </div>
              <div className="rounded-3xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Unidades</p>
                <p className="mt-2 text-2xl font-bold">{items.reduce((sum, item) => sum + item.stock, 0)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Existencia en bodega</p>
              </div>
              <div className="rounded-3xl border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Valor venta</p>
                <p className="mt-2 text-2xl font-bold">{money(totalSaleValue)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Stock por precio al huesped</p>
              </div>
            </div>

            <SectionCard
              title="Catalogo de productos"
              description="Administra lo que se vende en snacks y minibar."
              actions={
                <Button className="gap-2 rounded-full" onClick={openCreateProduct}>
                  <Plus className="size-4" />
                  Nuevo producto
                </Button>
              }
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nombre o lugar"
                    className="rounded-full pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["todos", "Todos"],
                    ["comprar", "Comprar"],
                    ["bodega", "Bodega"],
                    ["habitacion", "Asignados"],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={filter === value ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setFilter(value as ViewFilter)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {visibleItems.map((item) => {
                  const stockTarget = Math.max(item.minStock * 2, item.stock, 1)
                  const stockPercent = Math.min(100, Math.round((item.stock / stockTarget) * 100))

                  return (
                    <article key={item.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <Wine className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-lg font-semibold">{item.name}</h3>
                              <StatusPill tone={stockTone(item)}>{stockLabel(item)}</StatusPill>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.sku} - {item.location}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted-foreground">Precio huesped</p>
                          <p className="text-xl font-bold">{money(item.price ?? 0)}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl border bg-card/80 p-3">
                          <p className="text-xs text-muted-foreground">Existencia</p>
                          <p className="mt-1 font-semibold">{item.stock} {item.unit}</p>
                        </div>
                        <div className="rounded-2xl border bg-card/80 p-3">
                          <p className="text-xs text-muted-foreground">Comprar al llegar a</p>
                          <p className="mt-1 font-semibold">{item.minStock} {item.unit}</p>
                        </div>
                        <div className="rounded-2xl border bg-card/80 p-3">
                          <p className="text-xs text-muted-foreground">Costo</p>
                          <p className="mt-1 font-semibold">{money(item.cost)}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Nivel de inventario</span>
                          <span>{stockPercent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              item.stock === 0
                                ? "bg-red-500"
                                : item.stock <= item.minStock
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                            style={{ width: `${stockPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" className="gap-2 rounded-full" onClick={() => openEditProduct(item)}>
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setProductToDelete(item)}
                        >
                          <PackageX className="size-4" />
                          Retirar
                        </Button>
                      </div>
                    </article>
                  )
                })}

                {visibleItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground lg:col-span-2">
                    No hay productos con ese filtro.
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </section>
        </TabsContent>

        <TabsContent value="compras" className="space-y-4">
          <section className="grid gap-4 2xl:grid-cols-[1fr_380px]">
            <SectionCard
              title="Ordenes de compra"
              description="Historial de pedidos a proveedor y su estado de recepcion."
            >
              <div className="space-y-3">
                {purchaseOrders.map((order) => {
                  const isReceived = order.status.toLowerCase().includes("recib") && order.receivedTotal >= order.estimatedTotal
                  return (
                    <article key={order.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{order.supplierName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(order.orderedAt)} · Pedido por {order.orderedBy}
                          </p>
                        </div>
                        <StatusPill tone={isReceived ? "success" : "warning"}>{order.status}</StatusPill>
                      </div>

                      <div className="mt-3 space-y-1">
                        {order.items.map((line) => (
                          <div key={line.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 px-3 py-2 text-sm">
                            <span>{line.orderedQty} {line.unitName} x {line.itemName}</span>
                            <span className="text-muted-foreground">
                              recibido {line.receivedQty}/{line.orderedQty}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                        <span className="text-sm font-semibold">Total estimado</span>
                        <span className="text-xl font-bold">{money(order.estimatedTotal)}</span>
                      </div>

                      {!isReceived ? (
                        <div className="mt-3 flex justify-end">
                          <Button className="gap-2 rounded-full" onClick={() => openReceivePurchaseOrder(order)}>
                            <PackagePlus className="size-4" />
                            Recibir mercaderia
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  )
                })}

                {!purchaseOrders.length ? (
                  <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    No hay ordenes de compra registradas.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Nueva orden de compra" description="Registra un pedido nuevo a proveedor.">
              <div className="space-y-3">
                <label className="space-y-2 text-sm font-medium">
                  Proveedor
                  <Input
                    value={poSupplier}
                    onChange={(event) => setPoSupplier(event.target.value)}
                    placeholder="Nombre del proveedor"
                    className="rounded-full"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Notas
                  <Input
                    value={poNotes}
                    onChange={(event) => setPoNotes(event.target.value)}
                    placeholder="Opcional"
                    className="rounded-full"
                  />
                </label>

                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <label className="space-y-2 text-sm font-medium">
                    Producto
                    <select
                      value={poDraftItemId}
                      onChange={(event) => setPoDraftItemId(event.target.value)}
                      className="h-10 w-full rounded-full border bg-background px-3 text-sm"
                    >
                      <option value="">Elige un producto</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Cant.
                    <Input
                      type="number"
                      min={1}
                      value={poDraftQty}
                      onChange={(event) => setPoDraftQty(Number(event.target.value) || 1)}
                      className="rounded-full"
                    />
                  </label>
                </div>

                <Button variant="outline" className="w-full gap-2 rounded-full" onClick={addPurchaseOrderDraftLine}>
                  <Plus className="size-4" />
                  Agregar producto a la orden
                </Button>

                <div className="space-y-2">
                  {poDraftLines.map((line) => {
                    const item = items.find((candidate) => candidate.id === line.itemId)
                    return (
                      <div key={line.itemId} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 px-3 py-2 text-sm">
                        <span>{line.qty} x {item?.name ?? "Producto"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{money(line.qty * line.unitCost)}</span>
                          <button
                            type="button"
                            onClick={() => removePurchaseOrderDraftLine(line.itemId)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {!poDraftLines.length ? (
                    <p className="rounded-2xl border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                      Agrega productos para armar la orden.
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3 text-primary">
                  <span className="text-sm font-semibold">Total estimado</span>
                  <span className="text-xl font-bold">
                    {money(poDraftLines.reduce((sum, line) => sum + line.qty * line.unitCost, 0))}
                  </span>
                </div>

                <Button
                  className="w-full gap-2 rounded-full"
                  onClick={createPurchaseOrderHandler}
                  disabled={poSaving || !poDraftLines.length}
                >
                  <Save className="size-4" />
                  Crear orden de compra
                </Button>
              </div>
            </SectionCard>
          </section>
        </TabsContent>

        <TabsContent value="historial">
          <section className="grid gap-4 2xl:grid-cols-[1fr_360px]">
            <SectionCard title="Registro reciente" description="Aqui queda lo que recepcion cargo y lo que se sumo a bodega.">
              <MiniTable
                headers={["Fecha", "Producto", "Que paso", "Cantidad", "Habitacion", "Hecho por"]}
                rows={movements.map((movement) => [
                  formatDate(movement.date),
                  items.find((item) => item.id === movement.itemId)?.name,
                  <StatusPill tone={movement.type === "consumo" ? "info" : movement.type === "entrada" ? "success" : "muted"}>{movementLabel(movement.type)}</StatusPill>,
                  movement.qty,
                  movement.room ?? "-",
                  movement.user,
                ])}
              />
            </SectionCard>

            <SectionCard title="Resumen" description="Numeros sencillos para cuadre interno.">
              <FieldGrid
                items={[
                  { label: "Consumos cargados", value: movements.filter((movement) => movement.type === "consumo").length },
                  { label: "Productos agregados", value: movements.filter((movement) => movement.type === "entrada").length },
                  { label: "Venta registrada", value: money(movements.filter((movement) => movement.type === "consumo").reduce((sum, movement) => {
                    const item = items.find((snack) => snack.id === movement.itemId)
                    return sum + movement.qty * (item?.price ?? 0)
                  }, 0)) },
                  { label: "Por comprar", value: low.length },
                ]}
              />
            </SectionCard>
          </section>
        </TabsContent>

      </Tabs>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setEditingItemId(null)
            setForm(emptyForm)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <DialogTitle>{editingItemId ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              Datos del producto para inventario, reposicion y cobro al huesped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium sm:col-span-2">
                Nombre del producto
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-2xl"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                Unidad de venta
                <select
                  value={form.unit}
                  onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                  className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium">
                Ubicacion
                <select
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Para poner este producto en una habitación, usa la configuración de minibar del cuarto.
                </p>
              </label>

              <label className="space-y-2 text-sm font-medium">
                Existencia actual
                <Input
                  type="number"
                  min={0}
                  value={form.stock || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stock: event.target.value === "" ? 0 : Number(event.target.value),
                    }))
                  }
                  className="rounded-2xl"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                Comprar cuando queden
                <Input
                  type="number"
                  min={0}
                  value={form.minStock || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minStock: event.target.value === "" ? 0 : Number(event.target.value),
                    }))
                  }
                  className="rounded-2xl"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                Costo
                <MoneyInput
                  min={0}
                  value={form.cost || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cost: event.target.value === "" ? 0 : Number(event.target.value),
                    }))
                  }
                  className="rounded-2xl"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                Precio al huesped
                <MoneyInput
                  min={0}
                  value={form.price || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value === "" ? 0 : Number(event.target.value),
                    }))
                  }
                  className="rounded-2xl"
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Existencia</p>
                <p className="mt-1 font-semibold">{form.stock || 0} {form.unit || "unidad"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margen unitario</p>
                <p className="mt-1 font-semibold">{money(Math.max(0, form.price - form.cost))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor de venta</p>
                <p className="mt-1 font-semibold">{money((form.stock || 0) * (form.price || 0))}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setOpen(false)
                setEditingItemId(null)
                setForm(emptyForm)
              }}
            >
              Cancelar
            </Button>
            <Button className="gap-2 rounded-full" onClick={() => void saveProduct()} disabled={!canSave || productSaving}>
              <Save className="size-4" />
              {productSaving ? "Guardando..." : editingItemId ? "Guardar cambios" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(productToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setProductToDelete(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar producto del inventario</AlertDialogTitle>
            <AlertDialogDescription>
              {productToDelete?.name} ya no aparecera en el catalogo, en revision de cuartos ni en reposicion de minibar. Los avisos ya enviados conservaran su detalle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={productSaving}
              onClick={(event) => {
                event.preventDefault()
                if (productToDelete) void deleteProduct(productToDelete)
              }}
            >
              {productSaving ? "Retirando..." : "Si, retirar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(chargeToDelete)}
        onOpenChange={(open) => {
          if (!open) setChargeToDelete(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar aviso de consumo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres quitar el aviso pendiente de la habitación {chargeToDelete?.room}? Esta acción no cargará el consumo al checkout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (chargeToDelete) deleteCharge(chargeToDelete.id)
              }}
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(receivingOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setReceivingOrder(null)
            setReceiveQuantities({})
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Recibir mercaderia</DialogTitle>
            <DialogDescription>
              Confirma cuanto llego de {receivingOrder?.supplierName}. El stock de bodega se actualiza al guardar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {receivingOrder?.items.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {line.orderedQty} {line.unitName} · recibido {line.receivedQty}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={Math.max(0, line.orderedQty - line.receivedQty)}
                  value={receiveQuantities[line.id] ?? 0}
                  onChange={(event) =>
                    setReceiveQuantities((current) => ({
                      ...current,
                      [line.id]: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                  className="w-24 rounded-full text-right"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setReceivingOrder(null)}>
              Cancelar
            </Button>
            <Button className="gap-2 rounded-full" onClick={receivePurchaseOrderHandler} disabled={receivingSaving}>
              <CheckCircle2 className="size-4" />
              Confirmar recepcion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StockMovementForm({
  items,
  stockItemId,
  stockMode,
  stockQty,
  stockReason,
  setStockItemId,
  setStockMode,
  setStockQty,
  setStockReason,
  onSave,
  saving = false,
}: {
  items: InventoryItem[]
  stockItemId: string
  stockMode: StockMode
  stockQty: number
  stockReason: string
  setStockItemId: (value: string) => void
  setStockMode: (value: StockMode) => void
  setStockQty: (value: number) => void
  setStockReason: (value: string) => void
  onSave: () => void
  saving?: boolean
}) {
  return (
    <div className="space-y-3">
      <label className="space-y-2 text-sm font-medium">
        Producto
        <select
          value={stockItemId}
          onChange={(event) => setStockItemId(event.target.value)}
          className="h-10 w-full rounded-full border bg-background px-3 text-sm"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={stockMode === "entrada" ? "default" : "outline"} className="gap-2 rounded-full" onClick={() => setStockMode("entrada")}>
          <Boxes className="size-4" />
          Sumar
        </Button>
        <Button type="button" variant={stockMode === "ajuste" ? "default" : "outline"} className="gap-2 rounded-full" onClick={() => setStockMode("ajuste")}>
          <ClipboardList className="size-4" />
          Corregir
        </Button>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Cuantos
        <Input type="number" min={1} value={stockQty || ""} onChange={(event) => setStockQty(event.target.value === "" ? 0 : Number(event.target.value))} className="rounded-full" />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Nota
        <Input value={stockReason} onChange={(event) => setStockReason(event.target.value)} className="rounded-full" />
      </label>

      <Button className="w-full gap-2 rounded-full" onClick={onSave} disabled={saving || items.length === 0}>
        <PackagePlus className="size-4" />
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  )
}

export default InventarioSnacksPage
