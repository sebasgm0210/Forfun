import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ClipboardCheck,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  Search,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"

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
import {
  MiniTable,
  QuickGuide,
  SectionCard,
  StatCard,
  StatusPill,
  money,
} from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, getApiErrorMessage } from "@/lib/api"
import { formatDate, useStore } from "@/lib/store"
import { localDateIso } from "@/lib/utils"
import type { InventoryItem, InventoryMovement } from "@/lib/types"

type SupplyFilter = "todos" | "bajo" | "suficiente"
type PurchaseStatus = "ordenado" | "recibido"

type PurchaseDetail = {
  id: string
  itemId: string
  itemName: string
  orderedQty: number
  receivedQty: number
  unit: string
  unitCost: number
}

type PurchaseOrder = {
  id: string
  code: string
  supplier: string
  orderedBy: string
  orderedAt: string
  receivedAt?: string
  status: PurchaseStatus
  notes?: string
  details: PurchaseDetail[]
}

type ProductForm = {
  name: string
  unit: string
  stock: number
  minStock: number
  cost: number
  location: string
  supplier: string
}

type PurchaseForm = {
  itemId: string
  qty: number
  supplier: string
  reference: string
  notes: string
}

const emptyProductForm: ProductForm = {
  name: "",
  unit: "unidad",
  stock: 0,
  minStock: 5,
  cost: 0,
  location: "Bodega general",
  supplier: "",
}

const emptyPurchaseForm = (itemId = ""): PurchaseForm => ({
  itemId,
  qty: 1,
  supplier: "",
  reference: "",
  notes: "",
})

const units = ["unidad", "botella", "rollo", "paquete", "caja", "galón", "libra", "bolsa"]

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

function mapPurchaseOrder(value: unknown, inventory: InventoryItem[]): PurchaseOrder | null {
  const record = apiRecord(value)
  const id = apiText(record, [
    "id_inventory_purchase_order",
    "idInventoryPurchaseOrder",
    "purchase_order_id",
    "id",
  ])
  if (!id) return null

  const rawDetails =
    apiArray(record.details).length > 0
      ? apiArray(record.details)
      : apiArray(record.items).length > 0
        ? apiArray(record.items)
        : apiArray(record.purchase_order_details)
  const details = rawDetails.map((detailValue, index): PurchaseDetail => {
    const detail = apiRecord(detailValue)
    const itemId = apiText(detail, [
      "id_inventory_item",
      "idInventoryItem",
      "inventory_item_id",
    ])
    const inventoryItem = inventory.find((item) => item.id === itemId)
    return {
      id: apiText(detail, [
        "id_inventory_purchase_order_detail",
        "idInventoryPurchaseOrderDetail",
        "purchase_order_detail_id",
        "id",
      ], `${id}-${index}`),
      itemId,
      itemName: apiText(
        detail,
        ["item_name", "name"],
        inventoryItem?.name ?? "Producto",
      ),
      orderedQty: apiNumber(detail, [
        "ordered_quantity",
        "orderedQuantity",
        "quantity",
      ]),
      receivedQty: apiNumber(detail, [
        "received_quantity",
        "receivedQuantity",
      ]),
      unit: apiText(detail, ["unit_name", "unit"], inventoryItem?.unit ?? "unidad"),
      unitCost: apiNumber(detail, ["unit_cost", "unitCost"], inventoryItem?.cost ?? 0),
    }
  })
  const rawStatus = apiText(record, ["status"], "Ordenado").toLowerCase()
  const receivedAt = apiText(record, ["received_at", "receivedAt"])

  return {
    id,
    code: apiText(record, ["code", "order_number"], `OC-${id}`),
    supplier: apiText(record, ["supplier_name", "supplierName"], "Sin proveedor"),
    orderedBy: apiText(record, ["ordered_by", "orderedBy"], "Inventario"),
    orderedAt: apiText(
      record,
      ["ordered_at", "orderedAt", "created_at", "createdAt"],
      localDateIso(),
    ),
    receivedAt: receivedAt || undefined,
    status:
      receivedAt ||
      rawStatus.includes("recib") ||
      rawStatus.includes("received") ||
      rawStatus.includes("complet")
        ? "recibido"
        : "ordenado",
    notes: apiText(record, ["notes"]) || undefined,
    details,
  }
}

function stockTone(item: InventoryItem) {
  if (item.stock === 0) return "danger" as const
  if (item.stock <= item.minStock) return "warning" as const
  return "success" as const
}

function stockLabel(item: InventoryItem) {
  if (item.stock === 0) return "sin existencia"
  if (item.stock <= item.minStock) return "comprar"
  return "suficiente"
}

function movementLabel(type: InventoryMovement["type"]) {
  if (type === "entrada") return "Compra recibida"
  if (type === "salida") return "Salida"
  if (type === "consumo") return "Consumo"
  return "Ajuste"
}

export function InventarioSuministrosPage() {
  const {
    inventory,
    inventoryMovements,
    users,
    refreshApiState,
  } = useStore()
  const items = inventory.filter((item) => item.category === "suministro")
  const movements = inventoryMovements.filter((movement) =>
    items.some((item) => item.id === movement.itemId),
  )
  const currentUserName = useMemo(() => {
    const user = users.find(
      (item) =>
        item.status === "activo" &&
        ["administrador", "inventario", "gerencia"].includes(item.role),
    )
    return user?.name ?? "Encargado de inventario"
  }, [users])

  const [purchases, setPurchases] = useState<PurchaseOrder[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(emptyPurchaseForm())
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SupplyFilter>("todos")
  const [saving, setSaving] = useState(false)

  const loadPurchases = useCallback(async () => {
    try {
      const response = await api.inventory.listPurchaseOrders<unknown>({
        category: "suministro",
      })
      setPurchases(
        apiArray(response)
          .map((order) => mapPurchaseOrder(order, inventory))
          .filter((order): order is PurchaseOrder => Boolean(order)),
      )
    } catch (error) {
      toast.error("No se pudieron cargar las órdenes de compra", {
        description: getApiErrorMessage(error),
      })
    }
  }, [inventory])

  useEffect(() => {
    void refreshApiState(
      ["inventory", "inventoryMovements", "users"],
      { force: false },
    )
  }, [refreshApiState])

  useEffect(() => {
    void loadPurchases()
  }, [loadPurchases])

  const low = items.filter((item) => item.stock <= item.minStock)
  const orderedPurchases = purchases.filter((purchase) => purchase.status === "ordenado")
  const receivedPurchases = purchases.filter((purchase) => purchase.status === "recibido")
  const inventoryValue = items.reduce((sum, item) => sum + item.stock * item.cost, 0)
  const selectedItem = items.find((item) => item.id === purchaseForm.itemId) ?? items[0]

  const visibleItems = useMemo(() => {
    const text = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesText =
        !text ||
        `${item.name} ${item.sku} ${item.location}`.toLowerCase().includes(text)
      const matchesFilter =
        filter === "todos" ||
        (filter === "bajo" && item.stock <= item.minStock) ||
        (filter === "suficiente" && item.stock > item.minStock)
      return matchesText && matchesFilter
    })
  }, [filter, items, query])

  function openCreateProduct() {
    setEditingProductId(null)
    setProductForm(emptyProductForm)
    setProductOpen(true)
  }

  function openEditProduct(item: InventoryItem) {
    setEditingProductId(item.id)
    setProductForm({
      name: item.name,
      unit: item.unit,
      stock: item.stock,
      minStock: item.minStock,
      cost: item.cost,
      location: item.location || "Bodega general",
      supplier: "",
    })
    setProductOpen(true)
  }

  function openPurchase(itemId = items[0]?.id ?? "") {
    if (!items.length) {
      toast.info("Agrega primero un producto de suministros")
      setProductOpen(true)
      return
    }
    setPurchaseForm(emptyPurchaseForm(itemId))
    setPurchaseOpen(true)
  }

  async function saveProduct() {
    if (
      productForm.name.trim().length < 2 ||
      productForm.stock < 0 ||
      productForm.minStock < 0 ||
      productForm.cost < 0
    ) {
      toast.error("Revisa el nombre, cantidades y costo")
      return
    }

    const payload = {
      name: productForm.name.trim(),
      category: "suministro",
      stock_quantity: productForm.stock,
      minimum_quantity: productForm.minStock,
      unit_name: productForm.unit,
      cost_price: productForm.cost,
      guest_price: 0,
      warehouse_name: productForm.location.trim() || "Bodega general",
      supplier_name: productForm.supplier.trim() || null,
      is_active: true,
    }

    setSaving(true)
    try {
      if (editingProductId) {
        const id = Number(editingProductId)
        if (!Number.isFinite(id)) {
          toast.error("Este producto no tiene identificador real de backend")
          return
        }
        await api.inventory.updateItem(id, payload)
      } else {
        await api.inventory.createItem(payload)
      }
      await refreshApiState(["inventory"], { force: true })
      setProductForm(emptyProductForm)
      setEditingProductId(null)
      setProductOpen(false)
      toast.success(editingProductId ? "Producto actualizado en backend" : "Producto agregado al catálogo")
    } catch (error) {
      toast.error(editingProductId ? "No se pudo actualizar el producto" : "No se pudo agregar el producto", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(item: InventoryItem) {
    const id = Number(item.id)
    if (!Number.isFinite(id)) {
      toast.error("Este producto no tiene identificador real de backend")
      return
    }

    setSaving(true)
    try {
      await api.inventory.deleteItem(id)
      await refreshApiState(["inventory", "inventoryMovements"], { force: true })
      await loadPurchases()
      setProductToDelete(null)
      toast.success("Producto eliminado del backend")
    } catch (error) {
      toast.error("No se pudo eliminar el producto", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function savePurchase() {
    if (
      !selectedItem ||
      purchaseForm.qty <= 0 ||
      purchaseForm.supplier.trim().length < 2
    ) {
      toast.error("Completa producto, cantidad y proveedor")
      return
    }
    const itemId = Number(selectedItem.id)
    if (!Number.isFinite(itemId)) {
      toast.error("Actualiza el catálogo antes de ordenar este producto")
      return
    }

    setSaving(true)
    try {
      await api.inventory.createPurchaseOrder({
        category: "suministro",
        supplier_name: purchaseForm.supplier.trim(),
        ordered_by: currentUserName,
        notes: [purchaseForm.reference.trim(), purchaseForm.notes.trim()]
          .filter(Boolean)
          .join(" · ") || null,
        items: [
          {
            id_inventory_item: itemId,
            ordered_quantity: purchaseForm.qty,
            unit_cost: selectedItem.cost,
          },
        ],
      })
      await loadPurchases()
      setPurchaseOpen(false)
      toast.success("Orden de compra guardada", {
        description: `${selectedItem.name} · ${purchaseForm.qty} ${selectedItem.unit}`,
      })
    } catch (error) {
      toast.error("No se pudo guardar la orden", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function receivePurchase(purchase: PurchaseOrder) {
    if (purchase.status === "recibido") return
    const details = purchase.details
      .map((detail) => ({
        id_inventory_purchase_order_detail: Number(detail.id),
        received_quantity: Math.max(
          0,
          detail.orderedQty - detail.receivedQty,
        ),
      }))
      .filter(
        (detail) =>
          Number.isFinite(detail.id_inventory_purchase_order_detail) &&
          detail.received_quantity > 0,
      )

    if (!details.length) {
      toast.error("La orden no devolvió detalles válidos para recibir")
      return
    }

    setSaving(true)
    try {
      await api.inventory.receivePurchaseOrder(purchase.id, {
        received_by: currentUserName,
        notes: "Compra recibida desde suministros.",
        items: details,
      })
      await Promise.all([
        loadPurchases(),
        refreshApiState(["inventory", "inventoryMovements"], { force: true }),
      ])
      toast.success("Compra recibida y sumada al inventario")
    } catch (error) {
      toast.error("No se pudo recibir la compra", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bodega"
        title="Suministros"
        description="Catálogo, existencias y órdenes de compra de los productos que usa el hotel."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={openCreateProduct}>
              <PackagePlus className="size-4" />
              Agregar producto
            </Button>
            <Button size="sm" className="gap-2 rounded-full" onClick={() => openPurchase()}>
              <ShoppingCart className="size-4" />
              Ordenar compra
            </Button>
          </div>
        }
      />

      <QuickGuide
        title="Flujo de suministros"
        description="Primero crea el producto, luego podrás ordenarlo y recibirlo en bodega."
        steps={[
          { icon: PackagePlus, title: "Agrega productos", text: "Registra jabón, papel, cloro, café u otro suministro." },
          { icon: Search, title: "Revisa existencias", text: "El sistema indica qué productos llegaron al mínimo." },
          { icon: ShoppingCart, title: "Ordena la compra", text: "Selecciona un producto real del catálogo, cantidad y proveedor." },
          { icon: PackageCheck, title: "Marca recibido", text: "La recepción de la orden actualiza la existencia en backend." },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Productos" value={items.length} />
        <StatCard label="Falta comprar" value={low.length} tone={low.length ? "warning" : "success"} />
        <StatCard label="Órdenes pendientes" value={orderedPurchases.length} helper={`${receivedPurchases.length} recibidas`} tone={orderedPurchases.length ? "warning" : "success"} />
        <StatCard label="Valor en bodega" value={money(inventoryValue)} />
      </section>

      <Tabs defaultValue="productos" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="compras">Órdenes de compra</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <SectionCard
            title="Productos de uso diario"
            description="Existencias reales cargadas desde inventario."
            actions={
              <Button size="sm" className="gap-2 rounded-full" onClick={openCreateProduct}>
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            }
          >
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-md items-center gap-2 rounded-full border px-3">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto o bodega"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["todos", "bajo", "suficiente"] as SupplyFilter[]).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? "default" : "outline"}
                    className="rounded-full capitalize"
                    onClick={() => setFilter(value)}
                  >
                    {value === "bajo" ? "Falta comprar" : value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <article key={item.id} className="rounded-3xl border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-xs text-muted-foreground">{item.location}</p>
                    </div>
                    <StatusPill tone={stockTone(item)}>{stockLabel(item)}</StatusPill>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Existencia</p>
                      <p className="font-bold">{item.stock} {item.unit}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="font-bold">{item.minStock} {item.unit}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Button
                      size="sm"
                      variant={item.stock <= item.minStock ? "default" : "outline"}
                      className="gap-2 rounded-full sm:col-span-3"
                      onClick={() => openPurchase(item.id)}
                    >
                      <ShoppingCart className="size-4" />
                      Ordenar producto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 rounded-full sm:col-span-2"
                      disabled={saving}
                      onClick={() => openEditProduct(item)}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2 rounded-full"
                      disabled={saving}
                      onClick={() => setProductToDelete(item)}
                    >
                      <Trash2 className="size-4" />
                      Borrar
                    </Button>
                  </div>
                </article>
              ))}

              {!visibleItems.length ? (
                <div className="rounded-3xl border border-dashed p-8 text-center md:col-span-2 xl:col-span-3">
                  <p className="font-semibold">Aún no hay suministros registrados</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Agrega el primer producto para poder crear órdenes de compra.
                  </p>
                  <Button className="mt-4 gap-2 rounded-full" onClick={openCreateProduct}>
                    <Plus className="size-4" />
                    Agregar producto
                  </Button>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="compras">
          <SectionCard
            title="Órdenes de compra"
            description="Órdenes guardadas en backend y pendientes de recibir."
            actions={
              <Button size="sm" className="gap-2 rounded-full" onClick={() => openPurchase()}>
                <ShoppingCart className="size-4" />
                Nueva orden
              </Button>
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {purchases.map((purchase) => (
                <article key={purchase.id} className="rounded-3xl border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{purchase.code}</h3>
                      <p className="text-sm text-muted-foreground">
                        {purchase.supplier} · {formatDate(purchase.orderedAt)}
                      </p>
                    </div>
                    <StatusPill tone={purchase.status === "ordenado" ? "warning" : "success"}>
                      {purchase.status}
                    </StatusPill>
                  </div>
                  <div className="mt-4 space-y-2">
                    {purchase.details.map((detail) => (
                      <div key={detail.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2 text-sm">
                        <span>{detail.itemName}</span>
                        <strong>{detail.orderedQty} {detail.unit}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Ordenado por {purchase.orderedBy}
                    {purchase.notes ? ` · ${purchase.notes}` : ""}
                  </p>
                  {purchase.status === "ordenado" ? (
                    <Button
                      className="mt-4 w-full gap-2 rounded-full"
                      disabled={saving}
                      onClick={() => receivePurchase(purchase)}
                    >
                      <PackageCheck className="size-4" />
                      Marcar recibido
                    </Button>
                  ) : null}
                </article>
              ))}

              {!purchases.length ? (
                <div className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground lg:col-span-2">
                  No hay órdenes de compra registradas.
                </div>
              ) : null}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="historial">
          <SectionCard title="Movimientos de suministros" description="Entradas y ajustes registrados en inventario.">
            <MiniTable
              headers={["Fecha", "Producto", "Movimiento", "Cantidad", "Detalle", "Responsable"]}
              rows={movements.map((movement) => {
                const item = items.find((candidate) => candidate.id === movement.itemId)
                return [
                  formatDate(movement.date),
                  item?.name ?? "Producto",
                  <StatusPill tone={movement.type === "entrada" ? "success" : "info"}>
                    {movementLabel(movement.type)}
                  </StatusPill>,
                  `${movement.qty} ${item?.unit ?? ""}`,
                  movement.reason,
                  movement.user,
                ]
              })}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProductId ? "Editar suministro" : "Agregar suministro"}</DialogTitle>
            <DialogDescription>
              {editingProductId ? "Los cambios se guardarán en backend." : "El producto quedará disponible para inventario y órdenes de compra."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Nombre
              <Input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Unidad
              <select value={productForm.unit} onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {units.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Existencia inicial
              <Input type="number" min={0} value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: Number(event.target.value) }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Cantidad mínima
              <Input type="number" min={0} value={productForm.minStock} onChange={(event) => setProductForm((current) => ({ ...current, minStock: Number(event.target.value) }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Costo unitario
              <Input type="number" min={0} step="0.01" value={productForm.cost} onChange={(event) => setProductForm((current) => ({ ...current, cost: Number(event.target.value) }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Bodega
              <Input value={productForm.location} onChange={(event) => setProductForm((current) => ({ ...current, location: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Proveedor habitual
              <Input value={productForm.supplier} onChange={(event) => setProductForm((current) => ({ ...current, supplier: event.target.value }))} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setProductOpen(false)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" disabled={saving} onClick={saveProduct}>
              <PackagePlus className="size-4" />
              {saving ? "Guardando..." : editingProductId ? "Guardar cambios" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Ordenar compra</DialogTitle>
            <DialogDescription>
              Selecciona un producto del catálogo y registra la orden en backend.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="space-y-2 text-sm font-medium">
              Producto
              <select value={purchaseForm.itemId} onChange={(event) => setPurchaseForm((current) => ({ ...current, itemId: event.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · hay {item.stock} {item.unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Cantidad
              <Input type="number" min={1} value={purchaseForm.qty} onChange={(event) => setPurchaseForm((current) => ({ ...current, qty: Number(event.target.value) }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Proveedor
              <Input value={purchaseForm.supplier} onChange={(event) => setPurchaseForm((current) => ({ ...current, supplier: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Cotización o referencia
              <Input value={purchaseForm.reference} onChange={(event) => setPurchaseForm((current) => ({ ...current, reference: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Notas
              <Input value={purchaseForm.notes} onChange={(event) => setPurchaseForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="rounded-2xl bg-muted/40 p-3 text-sm">
              Encargado: <strong>{currentUserName}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setPurchaseOpen(false)}>Cancelar</Button>
            <Button className="gap-2 rounded-full" disabled={saving} onClick={savePurchase}>
              <ReceiptText className="size-4" />
              {saving ? "Guardando..." : "Guardar orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(productToDelete)} onOpenChange={(open) => {
        if (!open) setProductToDelete(null)
      }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar suministro</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el producto {productToDelete?.name ?? "seleccionado"} usando el endpoint real de inventario.
              Si el backend bloquea el borrado por historial, la vista mostrará el error real.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault()
                if (productToDelete) void deleteProduct(productToDelete)
              }}
            >
              {saving ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default InventarioSuministrosPage
