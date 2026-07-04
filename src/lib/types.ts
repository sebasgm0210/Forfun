// Tipos del dominio Casa Luna. Diseñados para mapear 1:1 con un backend real.

export type RoomStatus =
  | "disponible"
  | "ocupada"
  | "reservada"
  | "ready-for-check-in"
  | "limpieza"
  | "mantenimiento"

export interface RoomType {
  id: string
  name: string
  description: string
  basePrice: number
  corporatePrice?: number
  capacity: number
  beds: string
  amenities: string[]
  rates?: RoomRateOption[]
}

export interface RoomRateOption {
  peopleCount: number
  price: number
  isSpecific?: boolean
  reason?: string
  source?: "tipo" | "habitacion" | "manual"
}

export interface RoomSpecificRate {
  peopleCount: number
  price: number
  reason?: string
}

export interface Room {
  id: string
  number: string
  floor: number
  typeId: string
  status: RoomStatus
  maxOccupancy?: number
  occupancyOptions?: number[]
  rateOptions?: RoomRateOption[]
  specificRates?: RoomSpecificRate[]
  breakfastQrCode?: string
  notes?: string
}

export interface Guest {
  id: string
  name: string
  document: string
  documentType: "DPI" | "Pasaporte"
  nit: string
  email?: string
  phone?: string
  country: string
  department?: string
  vip?: boolean
  notes?: string
}

export type ReservationStatus =
  | "pendiente"
  | "confirmada"
  | "ready-for-check-in"
  | "in-house"
  | "checkout"
  | "cancelada"
  | "no-show"

export type ReservationSource =
  | "directo"
  | "booking"
  | "expedia"
  | "airbnb"
  | "agencia"
  | "corporativo"

export type ReservationRateType = "normal" | "corporativa" | "manual"

export type PaymentMethod =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "deposito"
  | "credito"

export type PaymentStage = "reserva" | "check-in" | "check-out"

export type CheckInPaymentDecision =
  | "CobradoCheckIn"
  | "CobrarSalida"
  | "SinSaldo"

export type ReservationBillingStatus = "NoFacturada" | "Parcial" | "Facturada"

export interface PaymentRecord {
  id: string
  backendPaymentId?: string
  method: PaymentMethod
  amount: number
  reference?: string
  notes?: string
  stage: PaymentStage
  date: string
  backendPaymentType?: "reservation" | "stay" | "event"
  issueSourceModule?: string
  issueSourceId?: string
  isInvoiced?: boolean
  invoiceId?: string
  invoicedAmount?: number
  pendingToInvoiceAmount?: number
  invoicedAt?: string
}

export interface Reservation {
  id: string
  reservationRoomId?: string
  code: string
  guestId: string
  roomId: string
  checkIn: string // ISO date
  checkOut: string // ISO date
  nights: number
  adults: number
  children: number
  rate: number
  rateType?: ReservationRateType
  manualRateReason?: string
  total: number
  paid: number
  status: ReservationStatus
  source: ReservationSource
  notes?: string
  createdAt: string
  payments?: PaymentRecord[]
  billingStatus?: ReservationBillingStatus
  lastInvoiceId?: string
  invoicedAmount?: number
  pendingToInvoiceAmount?: number
}

export interface Advance {
  id: string
  reservationId: string
  amount: number
  method: Exclude<PaymentMethod, "credito">
  date: string
  receivedBy: string
  notes?: string
}

export interface CreditAccount {
  id: string
  guestId?: string
  company: string
  contact: string
  email: string
  phone: string
  limit: number
  balance: number
  dueDate: string
  status: "al dia" | "por vencer" | "vencido"
  creditStatus?: "activo" | "pausado" | "bloqueado" | "autorizado"
  authorizationNote?: string
}

export interface CreditMovement {
  id: string
  accountId: string
  date: string
  concept: string
  charge: number
  payment: number
  reference: string
}

export interface CreditAuthorizationRequest {
  id: string
  accountId: string
  requestedBy: string
  requestedAt: string
  reason: string
  status: "pendiente" | "aprobada" | "rechazada"
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

export type ShiftStatus = "abierto" | "cerrado"

export interface CashClose {
  id: string
  shift: "matutino" | "vespertino" | "nocturno"
  user: string
  openedAt: string
  closedAt?: string
  opening: number
  cash: number
  card: number
  transfer: number
  deposit: number
  other: number
  expenses: number
  expected: number
  counted: number
  difference: number
  status: ShiftStatus
  notes?: string
}

export type BreakfastType = string

export interface BreakfastOption {
  id: BreakfastType
  label: string
  description: string
  accent: string
  imageUrl?: string
}

export interface BreakfastVoucher {
  id: string
  reservationId: string
  date: string
  guestName: string
  room: string
  type: BreakfastType
  drink?: string
  redeemed: boolean
  redeemedAt?: string
  notes?: string
}

export type EventStatus = "reservado" | "confirmado" | "realizado" | "cancelado"

export type SalonKind = "salon" | "coworking"

export interface EventSalon {
  id: string
  name: string
  capacity: number
  kind: SalonKind
  description: string
  freeForGuests?: boolean
}

export interface HotelEvent {
  id: string
  guestId?: string
  title: string
  client: string
  contact: string
  salonId?: string
  salon: string
  date: string
  startTime: string
  endTime: string
  guests: number
  type: "alquiler" | "consumo" | "coworking"
  clientKind?: "huesped" | "externo"
  total: number
  paid: number
  payments?: PaymentRecord[]
  billingStatus?: ReservationBillingStatus
  lastInvoiceId?: string
  invoicedAmount?: number
  pendingToInvoiceAmount?: number
  status: EventStatus
  notes?: string
}

export type MaintenancePriority = "baja" | "media" | "alta" | "urgente"
export type MaintenanceStatus = "abierto" | "en progreso" | "resuelto" | "cancelado"

export interface MaintenanceTicket {
  id: string
  code: string
  roomNumber?: string
  area?: string
  type: "electrico" | "plomeria" | "AC" | "carpinteria" | "limpieza" | "otro"
  priority: MaintenancePriority
  status: MaintenanceStatus
  description: string
  reportedBy: string
  assignedTo?: string
  createdAt: string
  resolvedAt?: string
  cost?: number
}

export type HousekeepingTaskType = "estancia" | "post-checkout"
export type HousekeepingTaskStatus = "pendiente" | "en progreso" | "completada"

export interface HousekeepingTask {
  id: string
  roomId: string
  reservationId?: string
  type: HousekeepingTaskType
  status: HousekeepingTaskStatus
  requestedBy: string
  assignedTo?: string
  notes?: string
  createdAt: string
  completedAt?: string
}

export type InventoryCategory = "snack" | "blanco" | "suministro"

export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: InventoryCategory
  unit: string
  stock: number
  minStock: number
  cost: number
  price?: number
  location: string
}

export interface InventoryMovement {
  id: string
  itemId: string
  type: "entrada" | "salida" | "ajuste" | "consumo"
  qty: number
  reason: string
  room?: string
  user: string
  date: string
}

export type InvoiceStatus = "emitida" | "anulada" | "pendiente"

export interface InvoiceItem {
  description: string
  qty: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  serie: string
  number: string
  date: string
  customer: string
  nit: string
  email?: string
  items: InvoiceItem[]
  subtotal: number
  iva: number
  total: number
  status: InvoiceStatus
  uuid?: string
  reservationId?: string
}

export type UserRole = "gerencia" | "administrador" | "inventario" | "contabilidad" | "recepcion" | "mantenimiento" | "camarera"

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  roleId?: number
  roleName?: string
  status: "activo" | "inactivo"
  lastLogin: string
  permissions: string[]
}
