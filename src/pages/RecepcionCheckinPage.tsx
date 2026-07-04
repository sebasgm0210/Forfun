import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  KeyRound,
  LogIn,
  LogOut,
  MonitorPlay,
  Printer,
  Receipt,
  Search,
  Sparkles,
  Ticket,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { QuickGuide } from "@/components/modules/view-kit";
import {
  PaymentBreakdownCard,
  createPaymentRecord,
  paymentMethodLabel,
  paymentRecordKey,
  paymentTotal,
  paymentTotalByMethod,
} from "@/components/payments/payment-breakdown-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  INVOICE_BILLING_MODES,
  INVOICE_FORMATS,
  INVOICE_ITEM_TYPES,
  INVOICE_SOURCE_MODULES,
  api,
  getApiErrorMessage,
  type InvoiceBillingMode,
  type InvoiceFormat,
  type InvoiceItemType,
  type IssueInvoiceModel,
} from "@/lib/api";
import { printOfficialInvoice } from "@/lib/invoice-document";
import { formatDate, useStore } from "@/lib/store";
import type { Advance, CreditAccount, Guest, PaymentRecord, Reservation } from "@/lib/types";

type StayStatus = "Lista para check-in" | "En habitación" | "Check-out finalizado";
type RoomStatus = "Disponible" | "Reservada" | "Lista para check-in" | "Ocupada" | "Limpieza";

type ChecklistKey =
  | "inguat"
  | "key"
  | "remote"
  | "breakfast"
  | "paymentCollectedAtCheckIn"
  | "paymentDeferredToCheckOut"
  | "roomInspection"
  | "keyReturned"
  | "remoteReturned"
  | "chargesReviewed"
  | "paymentClosedAtCheckOut";

type Stay = {
  id: string;
  backendStayId?: string;
  reservationRoomId?: string;
  guestId?: string;
  code: string;
  guestName: string;
  dpi: string;
  phone: string;
  roomNumber: string;
  roomType: "Estándar" | "Jr. Suite";
  occupancy: "1 persona" | "2 personas" | "3 personas" | "4 personas";
  guests: number;
  checkIn: string;
  checkOut: string;
  total: number;
  paid: number;
  paidBeforeCheckIn?: number;
  paidBeforeCheckOut?: number;
  payments: PaymentRecord[];
  paymentsBeforeCheckIn?: PaymentRecord[];
  paymentsBeforeCheckOut?: PaymentRecord[];
  extraCharges: number;
  checkoutMinibarCharges?: CheckoutMinibarCharge[];
  status: StayStatus;
  notes: string;
  checklist: Record<ChecklistKey, boolean>;
};

type ArrivalCancelTarget = {
  stays: Stay[];
};

type FelPaymentStage = "check-in" | "check-out";
type CashInvoicePreference = "con-factura" | "sin-factura";
type PaymentIdUpdate = {
  localId: string;
  backendId: string;
  backendPaymentType?: PaymentRecord["backendPaymentType"];
  isInvoiced?: boolean;
  invoiceId?: string;
  invoicedAmount?: number;
  pendingToInvoiceAmount?: number;
  invoicedAt?: string;
};

type FelDispatch = {
  id: string;
  stayId: string;
  stage: FelPaymentStage;
  kind: "Abono" | "Pago total";
  amount: number;
  paymentIds: string[];
  paymentAllocations?: Record<string, number>;
  minibarReviewDetailIds?: string[];
  createdAt: string;
  invoiceId?: string;
  buyerName?: string;
  buyerTaxId?: string;
  billingMode?: InvoiceBillingMode | "PaymentSelection";
};

type DirtyCheckInPayments = Record<string, string[]>;
const ROOM_CLEAN_TOAST_ID = "checkin-room-clean";

type CreditPaymentInfo = {
  available: number;
  limit?: number;
  balance?: number;
  label?: string;
  disabledReason?: string;
};

type InvoiceConceptOption = {
  id: number;
  name: string;
  itemType: InvoiceItemType | string;
  defaultDescription: string;
  defaultPrice?: number;
};

type InvoiceRemainingSummary = {
  total?: number;
  used?: number;
  remaining?: number;
};

type StayInvoiceTarget = {
  key: string;
  stage: FelPaymentStage;
  stays: Stay[];
  payments: PaymentRecord[];
  minibarCharges: CheckoutMinibarCharge[];
};

type CheckoutMinibarCharge = {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  roomNumber?: string;
  isInvoiced?: boolean;
  invoiceId?: string;
};

type CheckoutStaySnapshot = {
  stayId: string;
  reservationId: string;
  paidAmount?: number;
  pendingAmount?: number;
  invoicedAmount?: number;
  pendingToInvoiceAmount?: number;
  minibarTotalAmount: number;
  minibarInvoicedAmount: number;
  minibarPendingToInvoiceAmount: number;
  payments: PaymentRecord[];
  minibarCharges: CheckoutMinibarCharge[];
};

type StayInvoiceForm = {
  useCustomerTaxInfo: boolean;
  taxId: string;
  name: string;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  format: InvoiceFormat;
  conceptId: string;
  itemType: InvoiceItemType;
  amountToInvoice: string;
  description: string;
  notes: string;
  selectedPaymentIds: string[];
};

type Room = {
  number: string;
  type: "Estándar" | "Jr. Suite";
  status: RoomStatus;
};

const initialRooms: Room[] = [
  { number: "101", type: "Estándar", status: "Ocupada" },
  { number: "102", type: "Estándar", status: "Disponible" },
  { number: "103", type: "Estándar", status: "Reservada" },
  { number: "201", type: "Jr. Suite", status: "Reservada" },
  { number: "202", type: "Jr. Suite", status: "Ocupada" },
  { number: "203", type: "Jr. Suite", status: "Limpieza" },
];

const emptyChecklist: Record<ChecklistKey, boolean> = {
  inguat: false,
  key: false,
  remote: false,
  breakfast: false,
  paymentCollectedAtCheckIn: false,
  paymentDeferredToCheckOut: false,
  roomInspection: false,
  keyReturned: false,
  remoteReturned: false,
  chargesReviewed: false,
  paymentClosedAtCheckOut: false,
};

const initialStays: Stay[] = [
  {
    id: "ST-001",
    code: "CL-0001",
    guestName: "Carlos Estrada",
    dpi: "1689 55421 0101",
    phone: "5555-2222",
    roomNumber: "201",
    roomType: "Jr. Suite",
    occupancy: "1 persona",
    guests: 1,
    checkIn: "2026-05-08",
    checkOut: "2026-05-10",
    total: 850,
    paid: 150,
    payments: [
      {
        id: "pay-st-001",
        method: "transferencia",
        amount: 150,
        reference: "Anticipo",
        stage: "reserva",
        date: "2026-05-06",
      },
    ],
    extraCharges: 0,
    status: "Lista para check-in",
    notes: "Reserva confirmada por transferencia. Falta saldo de hospedaje.",
    checklist: { ...emptyChecklist },
  },
  {
    id: "ST-003",
    code: "CL-0001-B",
    guestName: "Carlos Estrada",
    dpi: "1689 55421 0101",
    phone: "5555-2222",
    roomNumber: "103",
    roomType: "Estándar",
    occupancy: "2 personas",
    guests: 2,
    checkIn: "2026-05-08",
    checkOut: "2026-05-10",
    total: 1300,
    paid: 150,
    payments: [
      {
        id: "pay-st-003",
        method: "transferencia",
        amount: 150,
        reference: "Anticipo",
        stage: "reserva",
        date: "2026-05-06",
      },
    ],
    extraCharges: 0,
    status: "Lista para check-in",
    notes: "Segunda habitación de la misma reserva familiar.",
    checklist: { ...emptyChecklist },
  },
  {
    id: "ST-002",
    code: "CL-0004",
    guestName: "Andrea Morales",
    dpi: "2458 96321 0901",
    phone: "5555-1111",
    roomNumber: "101",
    roomType: "Estándar",
    occupancy: "2 personas",
    guests: 2,
    checkIn: "2026-05-07",
    checkOut: "2026-05-08",
    total: 650,
    paid: 650,
    payments: [
      {
        id: "pay-st-002-card",
        method: "tarjeta",
        amount: 500,
        reference: "POS check-in",
        stage: "check-in",
        date: "2026-05-07",
      },
      {
        id: "pay-st-002-cash",
        method: "efectivo",
        amount: 150,
        reference: "Caja",
        stage: "check-in",
        date: "2026-05-07",
      },
    ],
    extraCharges: 45,
    status: "En habitación",
    notes: "Tiene consumo de minibar pendiente de revisar.",
    checklist: {
      ...emptyChecklist,
      inguat: true,
      key: true,
      remote: true,
      breakfast: true,
      paymentCollectedAtCheckIn: true,
    },
  },
  {
    id: "ST-004",
    code: "CL-0004-B",
    guestName: "Andrea Morales",
    dpi: "2458 96321 0901",
    phone: "5555-1111",
    roomNumber: "202",
    roomType: "Jr. Suite",
    occupancy: "1 persona",
    guests: 1,
    checkIn: "2026-05-07",
    checkOut: "2026-05-08",
    total: 425,
    paid: 425,
    payments: [
      {
        id: "pay-st-004",
        method: "tarjeta",
        amount: 425,
        reference: "POS check-in",
        stage: "check-in",
        date: "2026-05-07",
      },
    ],
    extraCharges: 0,
    status: "En habitación",
    notes: "Habitación adicional del mismo cliente.",
    checklist: {
      ...emptyChecklist,
      inguat: true,
      key: true,
      remote: true,
      breakfast: true,
      paymentCollectedAtCheckIn: true,
    },
  },
];

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}Q. ${amount}`;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function creditAccountAvailable(account: CreditAccount) {
  return Math.max(0, Number(account.limit || 0) - Number(account.balance || 0));
}

function creditDisabledReason(account: CreditAccount) {
  if (account.creditStatus === "bloqueado") return "Crédito bloqueado";
  if (account.creditStatus === "pausado") return "Crédito pausado";
  if (account.status === "vencido") return "Crédito vencido";
  if (account.dueDate && account.dueDate < new Date().toISOString().slice(0, 10)) {
    return "Crédito vencido";
  }
  if (creditAccountAvailable(account) <= 0) return "Sin crédito disponible";
  return undefined;
}

function creditPaymentInfo(account?: CreditAccount): CreditPaymentInfo | undefined {
  if (!account) return undefined;
  const available = creditAccountAvailable(account);
  const disabledReason = creditDisabledReason(account);
  return {
    available,
    limit: account.limit,
    balance: account.balance,
    disabledReason,
    label: `Límite ${money(account.limit)} · usado ${money(account.balance)}`,
  };
}

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function apiRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function apiArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = apiRecord(value);
  return Array.isArray(record.data) ? record.data : [];
}

function collectApiRecords(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectApiRecords(item, depth + 1));
  }

  const record = apiRecord(value);
  if (Object.keys(record).length === 0) return [];

  return [
    record,
    ...Object.values(record).flatMap((item) => collectApiRecords(item, depth + 1)),
  ];
}

function apiString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function normalizeNitForLookup(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

function invoiceNitInfo(response: unknown) {
  const candidateRecords = collectApiRecords(response);
  const nameKeys = [
    "name",
    "nombre",
    "Nombre",
    "NOMBRE",
    "taxpayer_name",
    "taxpayerName",
    "business_name",
    "businessName",
    "razonSocial",
    "razon_social",
    "RazonSocial",
    "razon",
    "nombre_receptor",
    "nombreReceptor",
    "nombreContribuyente",
    "nombre_contribuyente",
    "contribuyente",
    "nombreCompleto",
    "nombre_completo",
    "fullName",
    "full_name",
    "clientName",
    "cliente",
  ];
  const addressKeys = [
    "address",
    "Address",
    "direccion",
    "Direccion",
    "DIRECCION",
    "tax_address",
    "taxAddress",
    "direccionFiscal",
    "direccion_fiscal",
    "domicilioFiscal",
    "domicilio_fiscal",
  ];
  const cityKeys = ["city", "municipio", "municipality", "ciudad", "Ciudad"];
  const stateKeys = ["state", "departamento", "department", "Departamento"];

  const recordWithName =
    candidateRecords.find((record) => apiString(record, nameKeys)) ??
    candidateRecords[0] ??
    {};

  return {
    name: apiString(recordWithName, nameKeys),
    address: apiString(recordWithName, addressKeys),
    city: apiString(recordWithName, cityKeys, "09001"),
    state: apiString(recordWithName, stateKeys, "Quetzaltenango"),
  };
}

function apiNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function apiBoolean(record: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "si", "yes", "y", "facturado", "invoiced"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n", "pendiente", "not_invoiced"].includes(normalized)) {
        return false;
      }
    }
  }
  return fallback;
}

function paymentMethodFromApi(value: string): PaymentRecord["method"] {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("tarj") || normalized.includes("card")) return "tarjeta";
  if (normalized.includes("trans")) return "transferencia";
  if (normalized.includes("dep")) return "deposito";
  if (normalized.includes("cred")) return "credito";
  return "efectivo";
}

function paymentStageFromApi(value: string): PaymentRecord["stage"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("checkout") || normalized.includes("check-out") || normalized.includes("salida")) {
    return "check-out";
  }
  if (normalized.includes("checkin") || normalized.includes("check-in") || normalized.includes("entrada")) {
    return "check-in";
  }
  return "reserva";
}

function mapCheckoutPayment(item: unknown, index = 0): PaymentRecord | null {
  const record = apiRecord(item);
  const id = apiNumber(record, [
    "id_stay_payment",
    "idStayPayment",
    "stay_payment_id",
    "id_payment",
    "id",
  ]);
  const amount = apiNumber(record, ["amount", "total_amount", "totalAmount"]);

  if (!id || !amount || amount <= 0) return null;

  return {
    id: String(id),
    method: paymentMethodFromApi(apiString(record, ["payment_method", "method"], "efectivo")),
    amount,
    reference: apiString(record, ["payment_reference", "reference", "notes"]),
    stage: paymentStageFromApi(
      apiString(record, ["payment_stage", "paymentStage", "stage"], "CheckOut"),
    ),
    date: apiString(record, ["createdAt", "created_at", "date"], new Date().toISOString()).slice(0, 10),
    backendPaymentType: "stay",
    isInvoiced: apiBoolean(record, ["is_invoiced", "isInvoiced"], false),
    invoiceId: apiString(record, ["id_invoice", "idInvoice", "invoice_id"]),
    invoicedAmount: apiNumber(record, ["invoiced_amount", "invoicedAmount"]),
    pendingToInvoiceAmount: apiNumber(record, [
      "pending_to_invoice_amount",
      "pendingToInvoiceAmount",
    ]),
    invoicedAt: apiString(record, ["invoiced_at", "invoicedAt"]),
  };
}

function mapCheckoutMinibarCharge(item: unknown, index = 0): CheckoutMinibarCharge | null {
  const record = apiRecord(item);
  const id = apiNumber(record, [
    "id_minibar_room_review_detail",
    "idMinibarRoomReviewDetail",
    "id_minibar_review_detail",
    "minibar_review_detail_id",
    "id",
  ]);
  const amount = apiNumber(record, ["amount", "total", "line_total_with_tax"]);

  if (!id || !amount || amount <= 0) return null;

  return {
    id: String(id),
    description: apiString(record, ["description", "name", "item_name"], `Consumo minibar ${index + 1}`),
    amount,
    quantity: apiNumber(record, ["quantity", "qty"]),
    unitPrice: apiNumber(record, ["unit_price", "unitPrice", "price"]),
    roomNumber: apiString(record, ["room_number", "roomNumber"]),
    isInvoiced: apiBoolean(record, ["is_invoiced", "isInvoiced"], false),
    invoiceId: apiString(record, ["id_invoice", "idInvoice", "invoice_id", "last_invoice_id"]),
  };
}

function mapCheckoutStaySnapshot(item: unknown): CheckoutStaySnapshot | null {
  const record = apiRecord(item);
  const stayId = apiNumber(record, ["id_stay", "idStay", "stay_id", "id"]);
  const reservationId = apiNumber(record, [
    "id_reservation",
    "idReservation",
    "reservation_id",
    "reservationId",
  ]);

  if (!stayId || !reservationId) return null;

  const minibarCharges = apiArray(record.minibar_charges)
    .map(mapCheckoutMinibarCharge)
    .filter((charge): charge is CheckoutMinibarCharge => Boolean(charge));

  return {
    stayId: String(stayId),
    reservationId: String(reservationId),
    paidAmount: apiNumber(record, ["paid_amount", "paidAmount"]),
    pendingAmount: apiNumber(record, ["pending_amount", "pendingAmount"]),
    invoicedAmount: apiNumber(record, ["invoiced_amount", "invoicedAmount"]),
    pendingToInvoiceAmount: apiNumber(record, [
      "pending_to_invoice_amount",
      "pendingToInvoiceAmount",
    ]),
    minibarTotalAmount: apiNumber(record, ["minibar_total_amount", "minibarTotalAmount"]) ?? 0,
    minibarInvoicedAmount: apiNumber(record, ["minibar_invoiced_amount", "minibarInvoicedAmount"]) ?? 0,
    minibarPendingToInvoiceAmount:
      apiNumber(record, [
        "minibar_pending_to_invoice_amount",
        "minibarPendingToInvoiceAmount",
      ]) ?? 0,
    payments: apiArray(record.payments)
      .map(mapCheckoutPayment)
      .filter((payment): payment is PaymentRecord => Boolean(payment)),
    minibarCharges,
  };
}

function mapInvoiceConceptOption(item: unknown): InvoiceConceptOption | null {
  const record = apiRecord(item);
  const id = apiNumber(record, [
    "id_invoice_concept",
    "idInvoiceConcept",
    "invoice_concept_id",
    "id",
  ]);

  if (!id) return null;

  return {
    id,
    name: apiString(record, ["name"], `Concepto ${id}`),
    itemType: apiString(record, ["item_type", "itemType"], INVOICE_ITEM_TYPES.SERVICIO),
    defaultDescription: apiString(record, ["default_description", "defaultDescription"]),
    defaultPrice: apiNumber(record, ["default_price", "defaultPrice"]),
  };
}

function invoiceConceptForItemType(
  concepts: InvoiceConceptOption[],
  itemType: InvoiceItemType,
) {
  return concepts.find((concept) => concept.itemType === itemType);
}

function invoiceRemainingSummary(value: unknown): InvoiceRemainingSummary | null {
  const record = apiRecord(value);
  const dataRecord = apiRecord(record.data);
  const nested = Object.keys(dataRecord).length ? dataRecord : record;
  const total = apiNumber(nested, ["total", "total_dtes", "totalDtes", "total_quantity"]);
  const used = apiNumber(nested, ["used", "used_dtes", "usedDtes", "used_quantity"]);
  const remaining = apiNumber(nested, [
    "remaining",
    "available",
    "remaining_dtes",
    "remainingDtes",
    "remaining_quantity",
  ]);

  if (total === undefined && used === undefined && remaining === undefined) return null;
  return { total, used, remaining };
}

function invoiceResponseRecord(value: unknown) {
  const record = apiRecord(value);
  const dataRecord = apiRecord(record.data);
  return Object.keys(dataRecord).length ? dataRecord : record;
}

function invoiceResponseFields(value: unknown) {
  const nested = invoiceResponseRecord(value);
  return [
    ["Identificador", apiString(nested, ["id_invoice", "idInvoice", "invoice_id", "id"])],
    ["Serie", apiString(nested, ["digifact_serie", "digifactSerie", "serie", "series"])],
    ["Numero", apiString(nested, ["digifact_numero", "digifactNumero", "number", "invoice_number"])],
    ["Identificador fiscal", apiString(nested, ["uuid", "authorization_uuid", "authorizationNumber"])],
    ["Documentos fiscales restantes", apiString(nested, ["remaining_quantity", "remainingQuantity"])],
  ].filter(([, value]) => value);
}

async function reprintStayInvoice(invoiceId: string) {
  try {
    await printOfficialInvoice(invoiceId);
  } catch (error) {
    toast.error("No se pudo abrir la factura para imprimir.", {
      description: error instanceof Error ? error.message : "Intenta nuevamente.",
    });
  }
}

function reservationCodeForGuest(stay: Stay) {
  return stay.code.replace(/-[A-Z]$/, "");
}

function stayTotalDue(stay: Stay) {
  return stay.total + stay.extraCharges;
}

function stayBalance(stay: Stay) {
  return Math.max(stayTotalDue(stay) - stay.paid, 0);
}

function stayIsPaidInFull(stay: Stay) {
  return stayBalance(stay) <= 0;
}

function checkInPaymentHandled(stay: Stay) {
  return (
    stayIsPaidInFull(stay) ||
    stay.checklist.paymentCollectedAtCheckIn ||
    stay.checklist.paymentDeferredToCheckOut
  );
}

function checkOutPaymentHandled(stay: Stay) {
  return stayIsPaidInFull(stay) || stay.checklist.paymentClosedAtCheckOut;
}

function stayReadyForCheckIn(
  stay: Stay,
  cashInvoicePreferences: Record<string, CashInvoicePreference> = {},
) {
  return (
    checkInInguatHandled(stay, cashInvoicePreferences) &&
    checkInPaymentHandled(stay) &&
    stay.checklist.key &&
    stay.checklist.remote
  );
}

function stayReadyForCheckOut(stay: Stay) {
  return (
    stay.checklist.roomInspection &&
    stay.checklist.keyReturned &&
    stay.checklist.remoteReturned &&
    stay.checklist.chargesReviewed &&
    checkOutPaymentHandled(stay)
  );
}

function stayOperationalNotes(stay: Stay) {
  const notes = stay.notes ? [stay.notes] : [];

  if (stay.checklist.paymentCollectedAtCheckIn) {
    notes.push("Saldo restante cobrado en check-in.");
  }

  if (stay.checklist.paymentDeferredToCheckOut) {
    notes.push("Saldo restante queda abierto para pagos durante la estadía o al momento de salida.");
  }

  if (stay.checklist.paymentClosedAtCheckOut) {
    notes.push("Saldo final cerrado en check-out.");
  }

  return notes;
}

function paymentsForFelStage(stay: Stay, stage: FelPaymentStage) {
  return stay.payments.filter(
    (payment) => payment.stage === stage && Number(payment.amount || 0) > 0,
  );
}

function paymentsForInvoiceAction(stay: Stay, stage: FelPaymentStage) {
  void stage;
  return stay.payments.filter((payment) => Number(payment.amount || 0) > 0);
}

function mergeBackendPayments(
  payments: PaymentRecord[],
  backendPayments: PaymentRecord[],
) {
  const seen = new Set(payments.map((payment) => `${payment.backendPaymentType ?? ""}:${payment.id}`));
  const merged = [...payments];

  backendPayments.forEach((payment) => {
    const key = `${payment.backendPaymentType ?? ""}:${payment.id}`;
    if (!seen.has(key)) {
      merged.push(payment);
      seen.add(key);
    }
  });

  return merged;
}

function dispatchesForFelStage(
  felDispatches: FelDispatch[],
  stayId: string,
  stage: FelPaymentStage,
) {
  return felDispatches.filter(
    (dispatch) =>
      felDispatchKey(dispatch.stayId, dispatch.stage) === felDispatchKey(stayId, stage),
  );
}

function backendPaymentInvoicedAmount(payment: PaymentRecord) {
  const amount = Number(payment.amount || 0);
  const isInvoiced =
    Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
    (Number.isFinite(payment.invoicedAmount) &&
      Number(payment.invoicedAmount) > 0.01) ||
    (Number.isFinite(payment.pendingToInvoiceAmount) &&
      Number(payment.pendingToInvoiceAmount) <= 0.01);
  return isInvoiced ? amount : 0;
}

function sessionPaymentInvoicedAmount(payment: PaymentRecord, dispatches: FelDispatch[]) {
  return dispatches.some((dispatch) =>
    dispatch.paymentIds.includes(paymentRecordKey(payment)),
  )
    ? Number(payment.amount || 0)
    : 0;
}

function paymentInvoiceableAmount(payment: PaymentRecord, dispatches: FelDispatch[]) {
  const amount = Number(payment.amount || 0);
  const alreadyInvoiced =
    backendPaymentInvoicedAmount(payment) + sessionPaymentInvoicedAmount(payment, dispatches);

  return alreadyInvoiced > 0.01 ? 0 : roundCurrency(amount);
}

function paymentAlreadyInvoiced(payment: PaymentRecord, dispatches: FelDispatch[]) {
  return paymentInvoiceableAmount(payment, dispatches) <= 0.01;
}

function paymentCanBeRemoved(payment: PaymentRecord, dispatches: FelDispatch[]) {
  const isLocalDraft =
    !payment.backendPaymentId &&
    !payment.backendPaymentType &&
    !payment.issueSourceId &&
    !payment.issueSourceModule &&
    numericApiId(payment.id) === null;
  if (isLocalDraft) return true;
  return !paymentAlreadyInvoiced(payment, dispatches);
}

function removableBackendPaymentIds(
  previousPayments: PaymentRecord[],
  nextPayments: PaymentRecord[],
  dispatches: FelDispatch[],
) {
  const nextKeys = new Set(nextPayments.map(paymentRecordKey));
  return previousPayments
    .filter((payment) => {
      if (nextKeys.has(paymentRecordKey(payment))) return false;
      if (!paymentCanBeRemoved(payment, dispatches)) return false;
      const paymentId = numericApiId(payment.id);
      if (!paymentId) return false;
      return (payment.backendPaymentType ?? "reservation") !== "stay";
    })
    .map((payment) => numericApiId(payment.id))
    .filter((id): id is number => Boolean(id));
}

function invoiceablePaymentsForStage(
  payments: PaymentRecord[],
  dispatches: FelDispatch[],
) {
  return payments.filter(
    (payment) =>
      paymentInvoiceableAmount(payment, dispatches) > 0.01 &&
      numericApiId(payment.id) !== null,
  );
}

function invoiceablePaymentTotal(payments: PaymentRecord[], dispatches: FelDispatch[]) {
  return roundCurrency(
    payments.reduce((sum, payment) => sum + paymentInvoiceableAmount(payment, dispatches), 0),
  );
}

function stageAlreadyInvoicedAmount(
  payments: PaymentRecord[],
  dispatches: FelDispatch[],
) {
  return roundCurrency(
    payments.reduce((sum, payment) => {
      const amount = Number(payment.amount || 0);
      const invoiced =
        backendPaymentInvoicedAmount(payment) + sessionPaymentInvoicedAmount(payment, dispatches);
      return sum + Math.min(amount, invoiced);
    }, 0),
  );
}

function stageInvoiceAvailableAmount(
  payments: PaymentRecord[],
  dispatches: FelDispatch[],
) {
  return invoiceablePaymentTotal(
    invoiceablePaymentsForStage(payments, dispatches),
    dispatches,
  );
}

function minibarChargeAlreadyInvoiced(
  charge: CheckoutMinibarCharge,
  dispatches: FelDispatch[],
) {
  return (
    Boolean(charge.isInvoiced) ||
    dispatches.some((dispatch) => dispatch.minibarReviewDetailIds?.includes(charge.id))
  );
}

function invoiceableMinibarCharges(
  charges: CheckoutMinibarCharge[] | undefined,
  dispatches: FelDispatch[],
) {
  return (charges ?? []).filter(
    (charge) =>
      Number(charge.amount || 0) > 0 &&
      numericApiId(charge.id) !== null &&
      !minibarChargeAlreadyInvoiced(charge, dispatches),
  );
}

function minibarChargeTotal(charges: CheckoutMinibarCharge[]) {
  return roundCurrency(charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0));
}

function checkoutMinibarChargesForStays(stays: Stay[]) {
  return stays.flatMap((stay) => stay.checkoutMinibarCharges ?? []);
}

function targetInvoiceAvailableAmount(
  target: StayInvoiceTarget,
  dispatches: FelDispatch[],
) {
  const paymentAmount = stageInvoiceAvailableAmount(target.payments, dispatches);
  const minibarAmount =
    target.stage === "check-out"
      ? minibarChargeTotal(invoiceableMinibarCharges(target.minibarCharges, dispatches))
      : 0;

  return roundCurrency(paymentAmount + minibarAmount);
}

function paymentBackendType(
  payment: PaymentRecord,
  stage: FelPaymentStage,
): PaymentRecord["backendPaymentType"] {
  if (payment.backendPaymentType) return payment.backendPaymentType;
  return stage === "check-out" ? "stay" : "reservation";
}

function canChooseCashInvoicePreference(stay: Stay, stage: FelPaymentStage) {
  const payments = paymentsForInvoiceAction(stay, stage);
  return payments.length > 0 && payments.every((payment) => payment.method === "efectivo");
}

function felDispatchKey(stayId: string, stage: FelPaymentStage) {
  return `${stayId}|${stage}`;
}

function cashInvoicePreferenceFor(
  stayId: string,
  stage: FelPaymentStage,
  preferences: Record<string, CashInvoicePreference>,
) {
  return preferences[felDispatchKey(stayId, stage)] ?? "con-factura";
}

function stayCanSkipInguatReview(
  stay: Stay,
  preferences: Record<string, CashInvoicePreference>,
) {
  return (
    canChooseCashInvoicePreference(stay, "check-in") &&
    cashInvoicePreferenceFor(stay.id, "check-in", preferences) === "sin-factura"
  );
}

function checkInInguatHandled(
  stay: Stay,
  preferences: Record<string, CashInvoicePreference>,
) {
  return stay.checklist.inguat || stayCanSkipInguatReview(stay, preferences);
}

function groupTotalDue(stays: Stay[]) {
  return stays.reduce((sum, stay) => sum + stayTotalDue(stay), 0);
}

function groupPaymentBalance(stays: Stay[], payments: PaymentRecord[]) {
  return Math.max(groupTotalDue(stays) - paymentTotal(payments), 0);
}

function groupCanSkipInguatReview(
  groupKey: string,
  payments: PaymentRecord[],
  preferences: Record<string, CashInvoicePreference>,
) {
  const checkInPayments = payments.filter(
    (payment) => payment.stage === "check-in" && Number(payment.amount || 0) > 0,
  );

  return (
    checkInPayments.length > 0 &&
    checkInPayments.every((payment) => payment.method === "efectivo") &&
    cashInvoicePreferenceFor(groupKey, "check-in", preferences) === "sin-factura"
  );
}

function groupReadyForCheckIn(
  groupKey: string,
  stays: Stay[],
  payments: PaymentRecord[],
  preferences: Record<string, CashInvoicePreference>,
) {
  const inguatHandled =
    stays.every((stay) => stay.checklist.inguat) ||
    groupCanSkipInguatReview(groupKey, payments, preferences);
  const paymentHandled =
    groupPaymentBalance(stays, payments) <= 0 ||
    stays.every((stay) => stay.checklist.paymentDeferredToCheckOut);
  const roomBasicsHandled = stays.every(
    (stay) => stay.checklist.key && stay.checklist.remote,
  );

  return inguatHandled && paymentHandled && roomBasicsHandled;
}

function groupReadyForCheckOut(stays: Stay[], payments: PaymentRecord[]) {
  const paymentHandled =
    groupPaymentBalance(stays, payments) <= 0 ||
    stays.every((stay) => stay.checklist.paymentClosedAtCheckOut);
  const roomBasicsHandled = stays.every(
    (stay) =>
      stay.checklist.keyReturned &&
      stay.checklist.remoteReturned &&
      stay.checklist.chargesReviewed &&
      stay.checklist.roomInspection,
  );

  return paymentHandled && roomBasicsHandled;
}

function felDispatchIsCurrent(
  stay: Stay,
  stage: FelPaymentStage,
  dispatch?: FelDispatch,
) {
  if (!dispatch) return false;
  const payments = paymentsForInvoiceAction(stay, stage);
  return (
    dispatch.amount === paymentTotal(payments) &&
    dispatch.paymentIds.join("|") === payments.map(paymentRecordKey).join("|")
  );
}

function felKindForStay(stay: Stay): FelDispatch["kind"] {
  return stayBalance(stay) <= 0 ? "Pago total" : "Abono";
}

function StatusBadge({ status }: { status: StayStatus | RoomStatus }) {
  const styles: Record<string, string> = {
    "Lista para check-in": "border-blue-200 bg-blue-50 text-blue-700",
    "En habitación": "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Check-out finalizado": "border-zinc-200 bg-zinc-100 text-zinc-700",
    Disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Reservada: "border-amber-200 bg-amber-50 text-amber-700",
    Ocupada: "border-blue-200 bg-blue-50 text-blue-700",
    Limpieza: "border-violet-200 bg-violet-50 text-violet-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "border-muted bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: typeof LogIn;
  tone?: "default" | "warning" | "success" | "danger" | "info";
}) {
  const tones = {
    default: "border-border bg-card",
    warning: "border-amber-200 bg-amber-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    danger: "border-red-200 bg-red-50/80",
    info: "border-blue-200 bg-blue-50/80",
  };

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          ) : null}
        </div>
        <div className="rounded-2xl bg-background/80 p-2 text-primary shadow-sm">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
        props.className ?? ""
      }`}
    />
  );
}

function guestKey(stay: Stay) {
  return `${stay.dpi || stay.phone || stay.guestName}`.trim().toLowerCase();
}

function groupStaysByGuestAndDate(stays: Stay[], mode: "checkin" | "checkout") {
  const groups = new Map<string, Stay[]>();

  stays.forEach((stay) => {
    const actionDate = mode === "checkin" ? stay.checkIn : stay.checkOut;
    const key = `${guestKey(stay)}|${actionDate}`;
    groups.set(key, [...(groups.get(key) ?? []), stay]);
  });

  return Array.from(groups.entries())
    .map(([id, groupedStays]) => ({
      id,
      actionDate: mode === "checkin" ? groupedStays[0].checkIn : groupedStays[0].checkOut,
      newestReservationId: Math.max(
        ...groupedStays.map((stay) => numericApiId(stay.id) ?? 0),
      ),
      stays: groupedStays.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
    }))
    .sort((a, b) => {
      if (mode === "checkin") return b.newestReservationId - a.newestReservationId;
      return a.actionDate.localeCompare(b.actionDate) || b.newestReservationId - a.newestReservationId;
    });
}

function CheckItem({
  checked,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  checked: boolean;
  title: string;
  description: string;
  icon: typeof KeyRound;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "bg-background hover:bg-muted/40"
      }`}
    >
      <div
        className={`rounded-2xl p-2 ${
          checked ? "bg-emerald-100 text-emerald-700" : "bg-muted text-primary"
        }`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {checked ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
    </button>
  );
}

function ExpandToggleButton({
  expanded,
  label,
  onClick,
  tone = "default",
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
  tone?: "default" | "money";
}) {
  const colorClass =
    tone === "money"
      ? "border-emerald-600 bg-emerald-600 text-white ring-emerald-300/70 shadow-emerald-500/35 hover:border-emerald-700 hover:bg-emerald-700"
      : "border-primary bg-primary text-primary-foreground ring-primary/35 shadow-primary/30 hover:border-primary/90 hover:bg-primary/90";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`shrink-0 gap-2 rounded-full border-2 font-semibold shadow-lg ring-2 ring-offset-1 ring-offset-background transition hover:-translate-y-0.5 ${colorClass}`}
      onClick={onClick}
    >
      {tone === "money" ? (
        <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs font-bold leading-none">
          Q.
        </span>
      ) : null}
      <ChevronDown
        className={`size-4 transition-transform duration-300 ${
          expanded ? "rotate-180" : ""
        }`}
      />
      {expanded ? "Minimizar" : label}
    </Button>
  );
}

function PaymentSummary({ stay }: { stay: Stay }) {
  const totalDue = stayTotalDue(stay);
  const balance = stayBalance(stay);
  const isPaidInFull = stayIsPaidInFull(stay);

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-2xl bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Fechas</p>
        <p className="font-semibold">
          {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
        </p>
      </div>

      <div className="rounded-2xl bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Personas</p>
        <p className="font-semibold">
          {stay.occupancy} · {stay.guests} huésped(es)
        </p>
      </div>

      <div className="rounded-2xl border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">Total estadía</p>
        <p className="text-lg font-bold">{money(stay.total)}</p>
      </div>

      <div className="rounded-2xl border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">Anticipo / pagado</p>
        <p className="text-lg font-bold">{money(stay.paid)}</p>
        {stay.extraCharges > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Extras: {money(stay.extraCharges)}
          </p>
        ) : null}
      </div>

      <div
        className={`rounded-2xl border p-3 ${
          isPaidInFull
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <p className="text-xs">
          {isPaidInFull ? "Pago completo" : "Saldo pendiente"}
        </p>
        <p className="text-lg font-bold">{money(balance)}</p>
        <p className="mt-1 text-xs">Total a cubrir: {money(totalDue)}</p>
      </div>
    </div>
  );
}

function PaidInFullBox() {
  return (
    <div className="flex w-full items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-950">
      <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
        <CreditCard className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Pago completo</p>
        <p className="mt-1 text-sm text-emerald-800/80">
          El huésped ya cubrió el total registrado. No queda saldo pendiente.
        </p>
      </div>
      <CheckCircle2 className="size-5 text-emerald-600" />
    </div>
  );
}

function DeferredBalanceNotice({ balance }: { balance: number }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="font-semibold">Saldo abierto durante la estadía</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Este huésped entró con saldo pendiente. Puede hacer abonos durante la estadía y antes de finalizar la salida,
            recepción debe cobrar {money(balance)} o registrar autorización de gerencia.
          </p>
        </div>
      </div>
    </div>
  );
}

function FelPaymentNotice({
  stay,
  stage,
  dispatches,
  minibarCharges = [],
  onSend,
}: {
  stay: Stay;
  stage: FelPaymentStage;
  dispatches: FelDispatch[];
  minibarCharges?: CheckoutMinibarCharge[];
  onSend: () => void;
}) {
  const stagePayments = paymentsForInvoiceAction(stay, stage);
  const amount = paymentTotal(stagePayments);
  const pendingMinibarCharges =
    stage === "check-out" ? invoiceableMinibarCharges(minibarCharges, dispatches) : [];
  const pendingMinibarAmount = minibarChargeTotal(pendingMinibarCharges);
  const kind = felKindForStay(stay);
  const stageLabel = stage === "check-in" ? "check-in" : "check-out";
  const registeredLabel =
    stage === "check-out" ? "pagado durante toda la estadía" : `registrado en ${stageLabel}`;
  const alreadyInvoiced = stageAlreadyInvoicedAmount(stagePayments, dispatches);
  const unsavedCheckoutPaymentAmount =
    stage === "check-out"
      ? roundCurrency(
          stagePayments
            .filter(
              (payment) =>
                payment.stage === "check-out" &&
                numericApiId(payment.id) === null &&
                Number(payment.amount || 0) > 0,
            )
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        )
      : 0;
  const availableToInvoice = roundCurrency(
    stageInvoiceAvailableAmount(stagePayments, dispatches) +
      unsavedCheckoutPaymentAmount +
      pendingMinibarAmount,
  );
  const registeredAmount = roundCurrency(amount + pendingMinibarAmount);
  const hasPendingInvoice = availableToInvoice > 0.01;
  const hasUnsavedCheckInPayments =
    stage === "check-in" &&
    stagePayments.some(
      (payment) =>
        payment.stage === "check-in" &&
        Number(payment.amount || 0) > 0 &&
        numericApiId(payment.id) === null,
    );
  const issuedInvoiceIds = Array.from(
    new Set(
      [
        ...stagePayments.map((payment) => payment.invoiceId),
        ...dispatches.map((dispatch) => dispatch.invoiceId),
      ].filter((invoiceId): invoiceId is string => Boolean(invoiceId)),
    ),
  );

  if (stage === "check-out" && !hasPendingInvoice && issuedInvoiceIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-blue-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Facturación FEL</p>
            <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800">
              {kind}
            </span>
            {alreadyInvoiced > 0 ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                Facturado {money(alreadyInvoiced)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-blue-900/80">
            {!hasPendingInvoice && issuedInvoiceIds.length > 0
              ? `Todos los pagos registrados ya están facturados. Puedes volver a imprimir la factura desde aquí.`
              : hasUnsavedCheckInPayments
                ? `${money(registeredAmount)} registrado durante la estadía. Pendiente total por facturar: ${money(availableToInvoice)}. Completa el check-in para guardar los pagos.`
              : registeredAmount > 0
              ? `${money(registeredAmount)} ${registeredLabel}. Disponible para facturar: ${money(availableToInvoice)}.`
              : `Cuando registres un abono o pago total en ${stageLabel}, aparecerá aquí para enviarlo a FEL.`}
          </p>
          {pendingMinibarAmount > 0 ? (
            <p className="mt-1 text-xs font-medium text-blue-900/75">
              Incluye consumos/minibar pendientes: {money(pendingMinibarAmount)}.
            </p>
          ) : null}
          {dispatches.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {dispatches.slice(0, 3).map((dispatch) => (
                <span
                  key={dispatch.id}
                  className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800"
                >
                  {dispatch.invoiceId ? `#${dispatch.invoiceId} - ` : ""}
                  {dispatch.buyerTaxId || "CF"} - {money(dispatch.amount)}
                </span>
              ))}
            </div>
          ) : null}
          {issuedInvoiceIds.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {issuedInvoiceIds.map((invoiceId) => (
                <Button
                  key={invoiceId}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 rounded-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                  onClick={() => void reprintStayInvoice(invoiceId)}
                >
                  <Printer className="size-3.5" />
                  Reimprimir factura #{invoiceId}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {registeredAmount > 0 && (hasPendingInvoice || hasUnsavedCheckInPayments) ? (
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-2 rounded-full"
            title={
              hasUnsavedCheckInPayments
                ? "Completa el check-in para guardar el pago antes de emitir factura."
                : undefined
            }
            onClick={onSend}
          >
            <Receipt className="size-4" />
            Facturar pendiente
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StayCard({
  stay,
  mode,
  expanded,
  onToggleExpanded,
  onToggle,
  onCheckInPaymentDecision,
  onClosePaymentAtCheckOut,
  onUndoCheckInPayment,
  onPaymentsChange,
  paymentsSaving = false,
  felDispatches,
  cashInvoicePreference,
  onSendToFel,
  onCompleteCheckIn,
  onCompleteCheckOut,
  onCancelBeforeCheckIn,
  onPrint,
  creditInfo,
  showGuestDetails = true,
  hideFinalAction = false,
  accountManagedByGroup = false,
  allowCollapse = true,
}: {
  stay: Stay;
  mode: "checkin" | "checkout";
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggle: (key: ChecklistKey) => void;
  onCheckInPaymentDecision: (decision: "collect-now" | "defer-to-checkout") => void;
  onClosePaymentAtCheckOut: () => void;
  onUndoCheckInPayment: () => void;
  onPaymentsChange: (payments: PaymentRecord[], stage: "check-in" | "check-out") => void;
  paymentsSaving?: boolean;
  felDispatches: FelDispatch[];
  cashInvoicePreference: CashInvoicePreference;
  onSendToFel: (preferredPaymentId?: string) => void;
  onCompleteCheckIn?: () => Promise<void>;
  onCompleteCheckOut?: () => void;
  onCancelBeforeCheckIn?: () => void;
  onPrint: () => void;
  creditInfo?: CreditPaymentInfo;
  showGuestDetails?: boolean;
  hideFinalAction?: boolean;
  accountManagedByGroup?: boolean;
  allowCollapse?: boolean;
}) {
  const balance = stayBalance(stay);
  const isPaidInFull = stayIsPaidInFull(stay);
  const operationalNotes = accountManagedByGroup ? [] : stayOperationalNotes(stay);
  const hasUnsavedCheckoutPayment = stay.payments.some(
    (payment) =>
      payment.stage === "check-out" &&
      Number(payment.amount || 0) > 0 &&
      numericApiId(payment.id) === null,
  );
  const checkoutPaymentsEditable = balance > 0.01 || hasUnsavedCheckoutPayment;
  const showPaymentBreakdown =
    mode === "checkin" || balance > 0.01 || stay.payments.length > 0;
  const inguatCanBeSkipped =
    mode === "checkin" &&
    canChooseCashInvoicePreference(stay, "check-in") &&
    cashInvoicePreference === "sin-factura";

  const checkInReady = stayReadyForCheckIn(
    stay,
    inguatCanBeSkipped
      ? { [felDispatchKey(stay.id, "check-in")]: "sin-factura" }
      : {},
  );
  const checkOutReady = stayReadyForCheckOut(stay);

  if (!expanded) {
    return (
      <article
        id={`stay-card-${stay.id}`}
        className="rounded-3xl border bg-background p-4 shadow-sm transition hover:border-primary/30"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">Habitación {stay.roomNumber}</h3>
              <StatusBadge status={stay.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {stay.roomType} · {stay.occupancy} · {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
            </p>
          </div>

          {accountManagedByGroup ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
              <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {mode === "checkin" ? "Llave" : "Llave"}
                </p>
                <p className="truncate font-bold">
                  {mode === "checkin"
                    ? stay.checklist.key
                      ? "Entregada"
                      : "Pendiente"
                    : stay.checklist.keyReturned
                      ? "Recibida"
                      : "Pendiente"}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Control TV</p>
                <p className="truncate font-bold">
                  {mode === "checkin"
                    ? stay.checklist.remote
                      ? "Entregado"
                      : "Pendiente"
                    : stay.checklist.remoteReturned
                      ? "Recibido"
                      : "Pendiente"}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {mode === "checkin" ? "Desayuno" : "Revision"}
                </p>
                <p className="truncate font-bold">
                  {mode === "checkin"
                    ? stay.checklist.breakfast
                      ? "Entregado"
                      : "Pendiente"
                    : stay.checklist.roomInspection
                      ? "Lista"
                      : "Pendiente"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
              <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="truncate font-bold">{money(stayTotalDue(stay))}</p>
              </div>
              <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Pagado</p>
                <p className="truncate font-bold">{money(stay.paid)}</p>
              </div>
              <div
                className={`min-w-0 rounded-2xl border px-3 py-2 ${
                  balance > 0
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <p className="text-xs">Saldo</p>
                <p className="truncate font-bold">{money(balance)}</p>
              </div>
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {mode === "checkin" && onCancelBeforeCheckIn ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={onCancelBeforeCheckIn}
              >
                <XCircle className="size-4" />
                No se presentó
              </Button>
            ) : null}
            <ExpandToggleButton
              expanded={false}
              label={mode === "checkout" ? "Iniciar check-out" : "Abrir habitación"}
              onClick={onToggleExpanded}
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      id={`stay-card-${stay.id}`}
      className="rounded-3xl border bg-background p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">Habitación {stay.roomNumber}</h3>
            <StatusBadge status={stay.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Reserva {reservationCodeForGuest(stay)} · {stay.occupancy}
          </p>
          {showGuestDetails ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {stay.guestName} · DPI/NIT {stay.dpi} · Tel. {stay.phone}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border bg-muted/30 px-3 py-2 text-sm">
            Habitación <span className="font-semibold">{stay.roomNumber}</span> ·{" "}
            {stay.roomType}
          </div>
          {allowCollapse ? (
            <ExpandToggleButton
              expanded
              label="Cerrar habitación"
              onClick={onToggleExpanded}
            />
          ) : null}
        </div>
      </div>

      {accountManagedByGroup ? null : (
        <>
      <PaymentSummary stay={stay} />

      {showPaymentBreakdown ? (
        <PaymentBreakdownCard
          title={mode === "checkin" ? "Pagos en check-in" : "Pagos de checkout"}
          description={
            mode === "checkin"
              ? "Registra abonos o pagos parciales. Luego define si el saldo restante se cobra ahora o queda abierto para pagos durante la estadía; todo se guarda al completar el check-in."
              : checkoutPaymentsEditable
                ? "Puedes registrar varios pagos hasta cubrir el saldo pendiente. Al completar la salida solo se enviarán los pagos nuevos."
                : "La cuenta ya está cubierta. Este desglose es únicamente de consulta."
          }
          total={stayTotalDue(stay)}
          payments={stay.payments}
          onChange={
            mode === "checkin" || checkoutPaymentsEditable
              ? (payments) =>
                  onPaymentsChange(
                    payments,
                    mode === "checkin" ? "check-in" : "check-out",
                  )
              : undefined
          }
          isPaymentReadOnly={(payment) => numericApiId(payment.id) !== null}
          isPaymentRemovable={(payment) => paymentCanBeRemoved(payment, felDispatches)}
          stage={mode === "checkin" ? "check-in" : "check-out"}
          allowCredit={Boolean(creditInfo)}
          creditInfo={creditInfo}
          readOnly={mode === "checkout" && !checkoutPaymentsEditable}
          showInvoiceStatus
          headerLayout="inline"
          className="mt-4"
        />
      ) : null}

      <FelPaymentNotice
        stay={stay}
        stage={mode === "checkin" ? "check-in" : "check-out"}
        dispatches={felDispatches}
        minibarCharges={stay.checkoutMinibarCharges}
        onSend={() => onSendToFel()}
      />
        </>
      )}

      {mode === "checkin" ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {accountManagedByGroup ? null : (
            <>
          <CheckItem
            checked={stay.checklist.inguat || inguatCanBeSkipped}
            title={
              inguatCanBeSkipped && !stay.checklist.inguat
                ? "Libro INGUAT no requerido"
                : "Libro INGUAT revisado"
            }
            description={
              inguatCanBeSkipped && !stay.checklist.inguat
                ? "Pago en efectivo marcado sin factura. Para este caso puntual, el check-in puede completarse sin revisar INGUAT."
                : "Confirmar que los datos del huésped están listos para el registro."
            }
            icon={FileText}
            onClick={() => onToggle("inguat")}
          />

          {isPaidInFull && !stay.checklist.paymentCollectedAtCheckIn ? (
            <PaidInFullBox />
          ) : (
            <>
              <CheckItem
                checked={stay.checklist.paymentCollectedAtCheckIn}
                title="Cobrar saldo restante ahora"
                description={`Falta cobrar ${money(balance)}. Esta opción agrega el restante como pago de check-in para cerrar el saldo antes de entrar.`}
                icon={CreditCard}
                onClick={() => onCheckInPaymentDecision("collect-now")}
              />

              <CheckItem
                checked={stay.checklist.paymentDeferredToCheckOut}
                title="Dejar saldo abierto durante la estadía"
                description={`Falta cobrar ${money(balance)}. Puedes registrar abonos parciales ahora y dejar el restante abierto para pagarlo durante la estadía o al salir.`}
                icon={Receipt}
                onClick={() => onCheckInPaymentDecision("defer-to-checkout")}
              />
            </>
          )}
            </>
          )}

          <CheckItem
            checked={stay.checklist.key}
            title="Llave entregada"
            description="Registrar que recepción entregó la llave de habitación."
            icon={KeyRound}
            onClick={() => onToggle("key")}
          />

          <CheckItem
            checked={stay.checklist.remote}
            title="Control TV entregado"
            description="Registrar entrega del control de televisión."
            icon={MonitorPlay}
            onClick={() => onToggle("remote")}
          />

          <CheckItem
            checked={stay.checklist.breakfast}
            title="Ticket físico de desayuno entregado"
            description="Opcional: márcalo solo si se entregó ticket físico. Si el huésped usa el QR de desayunos, no bloquea el check-in."
            icon={Ticket}
            onClick={() => onToggle("breakfast")}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {!accountManagedByGroup && stay.checklist.paymentDeferredToCheckOut && balance > 0 ? (
            <DeferredBalanceNotice balance={balance} />
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <CheckItem
              checked={stay.checklist.keyReturned}
              title="Llave recibida"
              description="Recepción confirma que el huésped devolvió la llave."
              icon={KeyRound}
              onClick={() => onToggle("keyReturned")}
            />

            <CheckItem
              checked={stay.checklist.remoteReturned}
              title="Control TV recibido"
              description="Recepción confirma que el control fue devuelto."
              icon={MonitorPlay}
              onClick={() => onToggle("remoteReturned")}
            />

            <CheckItem
              checked={stay.checklist.chargesReviewed}
              title="Consumos revisados"
              description="Verificar snacks, cargos extra, daños o facturas pendientes."
              icon={Receipt}
              onClick={() => onToggle("chargesReviewed")}
            />

            <CheckItem
              checked={stay.checklist.roomInspection}
              title="Habitación revisada"
              description="Camarería confirma estado de habitación y blancos."
              icon={ClipboardCheck}
              onClick={() => onToggle("roomInspection")}
            />

            {accountManagedByGroup ? null : isPaidInFull && !stay.checklist.paymentClosedAtCheckOut ? (
              <PaidInFullBox />
            ) : (
              <CheckItem
                checked={stay.checklist.paymentClosedAtCheckOut}
                title={
                  stay.checklist.paymentClosedAtCheckOut
                    ? "Saldo final cobrado"
                    : "Saldo final pendiente"
                }
                description={
                  stay.checklist.paymentClosedAtCheckOut
                    ? "El saldo fue marcado como cerrado al salir. Si fue un error, vuelve a hacer click para desmarcarlo y restaurar el saldo anterior."
                    : `Falta cobrar ${money(balance)}. Márcalo solo cuando el huésped pague el saldo final o gerencia autorice cerrarlo.`
                }
                icon={CheckCircle2}
                onClick={onClosePaymentAtCheckOut}
              />
            )}
          </div>
        </div>
      )}

      {!accountManagedByGroup && mode === "checkin" && stay.checklist.paymentCollectedAtCheckIn ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Pago marcado como cobrado en check-in</p>
              <p className="mt-1 text-sm text-amber-900/80">
                Si recepción lo marcó por error, usa este botón para regresar al saldo anterior.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={onUndoCheckInPayment}
            >
              Deshacer pago marcado
            </Button>
          </div>
        </div>
      ) : null}

      {operationalNotes.length > 0 ? (
        <div className="mt-4 rounded-2xl border bg-muted/20 p-3 text-sm">
          <p className="font-semibold">Notas:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {operationalNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {mode === "checkin" && onCancelBeforeCheckIn ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={onCancelBeforeCheckIn}
          >
            <XCircle className="size-4" />
            No se presentó
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="gap-2 rounded-full"
          onClick={onPrint}
        >
          <Printer className="size-4" />
          Imprimir resumen
        </Button>

        {hideFinalAction ? null : mode === "checkin" ? (
          <Button
            className="gap-2 rounded-full"
            disabled={!checkInReady || paymentsSaving}
            onClick={onCompleteCheckIn}
          >
            <LogIn className="size-4" />
            Completar check-in
          </Button>
        ) : (
          <Button
            className="gap-2 rounded-full"
            disabled={!checkOutReady}
            onClick={onCompleteCheckOut}
          >
            <LogOut className="size-4" />
            Finalizar check-out
          </Button>
        )}
      </div>
    </article>
  );
}

function GuestStayGroup({
  groupKey,
  stays,
  mode,
  expanded,
  onToggleExpanded,
  accountExpanded,
  onToggleAccountExpanded,
  expandedStayIds,
  onToggleStayExpanded,
  onToggle,
  onCheckInPaymentDecision,
  onClosePaymentAtCheckOut,
  onUndoCheckInPayment,
  onPaymentsChange,
  savingCheckInPaymentIds,
  groupPayments,
  onGroupPaymentsChange,
  felDispatches,
  cashInvoicePreferences,
  onSendToFel,
  onSendGroupToFel,
  onCompleteCheckIn,
  onCompleteCheckOut,
  onCancelBeforeCheckIn,
  onPrint,
  onSetChecklistMany,
  onMarkCheckInBasics,
  onCollectGroupCheckInBalance,
  onDeferGroupCheckInBalance,
  onMarkCheckOutBasics,
  onCloseGroupCheckOutBalance,
  onCompleteGroupCheckIn,
  onCompleteGroupCheckOut,
  creditInfo,
}: {
  groupKey: string;
  stays: Stay[];
  mode: "checkin" | "checkout";
  expanded: boolean;
  onToggleExpanded: () => void;
  accountExpanded: boolean;
  onToggleAccountExpanded: () => void;
  expandedStayIds: Set<string>;
  onToggleStayExpanded: (stayId: string) => void;
  onToggle: (stayId: string, key: ChecklistKey) => void;
  onCheckInPaymentDecision: (
    stayId: string,
    decision: "collect-now" | "defer-to-checkout",
  ) => void;
  onClosePaymentAtCheckOut: (stayId: string) => void;
  onUndoCheckInPayment: (stayId: string) => void;
  onPaymentsChange: (
    stayId: string,
    payments: PaymentRecord[],
    stage: "check-in" | "check-out",
  ) => void;
  savingCheckInPaymentIds: Set<string>;
  groupPayments: PaymentRecord[];
  onGroupPaymentsChange: (
    payments: PaymentRecord[],
    stage: "check-in" | "check-out",
  ) => void;
  felDispatches: FelDispatch[];
  cashInvoicePreferences: Record<string, CashInvoicePreference>;
  onSendToFel: (
    stayId: string,
    stage: FelPaymentStage,
    preferredPaymentId?: string,
  ) => void;
  onSendGroupToFel: (stage: FelPaymentStage) => void;
  onCompleteCheckIn: (stayId: string) => Promise<void>;
  onCompleteCheckOut: (stayId: string) => void;
  onCancelBeforeCheckIn?: (stays: Stay[]) => void;
  onPrint: (stay: Stay) => void;
  onSetChecklistMany: (
    stayIds: string[],
    key: ChecklistKey,
    checked: boolean,
  ) => void;
  onMarkCheckInBasics: (stayIds: string[]) => void;
  onCollectGroupCheckInBalance: () => void;
  onDeferGroupCheckInBalance: () => void;
  onMarkCheckOutBasics: (stayIds: string[]) => void;
  onCloseGroupCheckOutBalance: () => void;
  onCompleteGroupCheckIn: () => Promise<void>;
  onCompleteGroupCheckOut: () => void;
  creditInfo?: CreditPaymentInfo;
}) {
  const primary = stays[0];
  const stayIds = stays.map((stay) => stay.id);
  const actionDate = mode === "checkin" ? primary.checkIn : primary.checkOut;
  const total = groupTotalDue(stays);
  const isGroup = stays.length > 1;
  const groupStage: FelPaymentStage = mode === "checkin" ? "check-in" : "check-out";
  const groupPaid = paymentTotal(groupPayments);
  const groupBalance = groupPaymentBalance(stays, groupPayments);
  const paid = isGroup ? groupPaid : stays.reduce((sum, stay) => sum + stay.paid, 0);
  const balance = isGroup
    ? groupBalance
    : stays.reduce((sum, stay) => sum + stayBalance(stay), 0);
  const checkInBasicsAreMarked = stays.every(
    (stay) =>
      stay.checklist.key &&
      stay.checklist.remote,
  );
  const checkOutBasicsAreMarked = stays.every(
    (stay) =>
      stay.checklist.keyReturned &&
      stay.checklist.remoteReturned &&
      stay.checklist.chargesReviewed &&
      stay.checklist.roomInspection,
  );
  const checkInBalancesCollected = stays.every(
    (stay) => stay.checklist.paymentCollectedAtCheckIn,
  );
  const checkInBalancesDeferred = stays.every(
    (stay) => stay.checklist.paymentDeferredToCheckOut,
  );
  const checkOutBalancesClosed = stays.every(
    (stay) => stay.checklist.paymentClosedAtCheckOut,
  );
  const groupStagePayments = groupPayments.filter(
    (payment) => payment.stage === groupStage && Number(payment.amount || 0) > 0,
  );
  const groupInvoicePayments =
    mode === "checkout"
      ? groupPayments.filter((payment) => Number(payment.amount || 0) > 0)
      : groupStagePayments;
  const hasUnsavedGroupCheckoutPayment = groupPayments.some(
    (payment) =>
      payment.stage === "check-out" &&
      Number(payment.amount || 0) > 0 &&
      numericApiId(payment.id) === null,
  );
  const groupCheckoutPaymentsEditable =
    groupBalance > 0.01 || hasUnsavedGroupCheckoutPayment;
  const showGroupPaymentBreakdown =
    mode === "checkin" || groupBalance > 0.01 || groupPayments.length > 0;
  const groupPaymentsSaving = stays.some((stay) =>
    savingCheckInPaymentIds.has(stay.id),
  );
  const groupCanChooseInvoice =
    groupInvoicePayments.length > 0 &&
    groupInvoicePayments.every((payment) => payment.method === "efectivo");
  const groupInvoicePreference = cashInvoicePreferenceFor(
    groupKey,
    groupStage,
    cashInvoicePreferences,
  );
  const groupInguatCanBeSkipped =
    mode === "checkin" &&
    groupCanChooseInvoice &&
    groupInvoicePreference === "sin-factura";
  const allReady = isGroup
    ? mode === "checkin"
      ? groupReadyForCheckIn(
          groupKey,
          stays,
          groupPayments,
          cashInvoicePreferences,
        )
      : groupReadyForCheckOut(stays, groupPayments)
    : mode === "checkin"
      ? stays.every((stay) => stayReadyForCheckIn(stay, cashInvoicePreferences))
      : stays.every(stayReadyForCheckOut);
  const groupPaymentProxy: Stay = {
    ...primary,
    id: groupKey,
    roomNumber: `${stays.length} habitaciones`,
    total: stays.reduce((sum, stay) => sum + stay.total, 0),
    paid: groupPaid,
    payments: groupPayments,
    extraCharges: stays.reduce((sum, stay) => sum + stay.extraCharges, 0),
    checkoutMinibarCharges: checkoutMinibarChargesForStays(stays),
    checklist: primary.checklist,
  };
  const groupFelDispatches = dispatchesForFelStage(
    felDispatches,
    groupKey,
    groupStage,
  );
  const groupChecklistChecked = (key: ChecklistKey) =>
    stays.every((stay) => stay.checklist[key]);
  const toggleGroupChecklist = (key: ChecklistKey) =>
    onSetChecklistMany(stayIds, key, !groupChecklistChecked(key));

  const roomNumbersSummary = stays
    .map((stay) => stay.roomNumber)
    .filter((roomNumber) => roomNumber && roomNumber !== "-")
    .join(", ");
  const roomSummary = roomNumbersSummary
    ? stays.length === 1
      ? `Habitación ${roomNumbersSummary}`
      : `Habitaciones ${roomNumbersSummary}`
    : `${stays.length} habitación(es)`;

  if (!expanded) {
    return (
      <section className="rounded-3xl border bg-background p-4 shadow-sm transition hover:border-primary/30">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {mode === "checkin" ? "Check-in" : "Check-out"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold">{primary.guestName}</h3>
              <StatusBadge status={primary.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "checkin" ? "Entrada" : "Salida"} {formatDate(actionDate)} · {roomSummary} · Tel. {primary.phone}
            </p>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-4 xl:min-w-[560px]">
            <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Habitación(es)</p>
              <p className="truncate font-bold">{roomNumbersSummary || stays.length}</p>
            </div>
            <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="truncate font-bold">{money(total)}</p>
            </div>
            <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="truncate font-bold">{money(paid)}</p>
            </div>
            <div
              className={`min-w-0 rounded-2xl border px-3 py-2 ${
                balance > 0
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              <p className="text-xs">Saldo</p>
              <p className="truncate font-bold">{money(balance)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === "checkin" && onCancelBeforeCheckIn ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => onCancelBeforeCheckIn(stays)}
              >
                <XCircle className="size-4" />
                No se presentó
              </Button>
            ) : null}
            <ExpandToggleButton
              expanded={false}
              label={mode === "checkout" ? "Iniciar check-out" : "Abrir cliente"}
              onClick={onToggleExpanded}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 2xl:grid-cols-[340px_1fr]">
      <article className="rounded-3xl border bg-background p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Cliente
        </p>
        <h3 className="mt-1 text-xl font-semibold">{primary.guestName}</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>DPI/NIT {primary.dpi}</p>
          <p>Tel. {primary.phone}</p>
          <p>
            {mode === "checkin" ? "Entrada" : "Salida"}:{" "}
            <span className="font-semibold text-foreground">{formatDate(actionDate)}</span>
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Habitaciones</p>
            <p className="text-lg font-bold">{stays.length}</p>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Total cuenta</p>
            <p className="text-lg font-bold">{money(total)}</p>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="text-lg font-bold">{money(paid)}</p>
          </div>
          <div
            className={`rounded-2xl border p-3 ${
              balance > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <p className="text-xs">Saldo del cliente</p>
            <p className="text-lg font-bold">{money(balance)}</p>
          </div>
        </div>
      </article>

      <article className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {mode === "checkin" ? "Check-in" : "Check-out"} por habitación
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              {isGroup
                ? `${stays.length} habitaciones con la misma fecha`
                : "Una habitación para procesar"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isGroup
                ? "Estas habitaciones son del mismo cliente y la misma fecha. Puedes aplicar acciones a todas, y volver a presionar el mismo botón para desmarcarlas si fue un error."
                : "Si el mismo cliente tiene otra fecha, aparecerá en otra card separada."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "checkin" && onCancelBeforeCheckIn ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => onCancelBeforeCheckIn(stays)}
              >
                <XCircle className="size-4" />
                No se presentó
              </Button>
            ) : null}
            {isGroup ? (
              mode === "checkin" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    title="Marca o desmarca llave y control TV en todas estas habitaciones."
                    onClick={() => onMarkCheckInBasics(stayIds)}
                  >
                    {checkInBasicsAreMarked
                      ? "Desmarcar básicos"
                      : "Marcar básicos"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!allReady || groupPaymentsSaving}
                    onClick={onCompleteGroupCheckIn}
                  >
                    Check-in conjunto
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    title="Marca o desmarca llave recibida, control recibido, consumos revisados y habitación revisada."
                    onClick={() => onMarkCheckOutBasics(stayIds)}
                  >
                    {checkOutBasicsAreMarked
                      ? "Desmarcar devolución"
                      : "Marcar devolución revisada"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={!allReady}
                    onClick={onCompleteGroupCheckOut}
                  >
                    Check-out conjunto
                  </Button>
                </>
              )
            ) : null}
            <ExpandToggleButton
              expanded
              label="Abrir cliente"
              onClick={onToggleExpanded}
            />
          </div>
        </div>

        {isGroup ? (
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Cuenta del cliente
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  Total de {stays.length} habitaciones
                </h3>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="truncate font-bold">{money(total)}</p>
                </div>
                <div className="min-w-0 rounded-2xl border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="truncate font-bold">{money(groupPaid)}</p>
                </div>
                <div
                  className={`min-w-0 rounded-2xl border px-3 py-2 ${
                    groupBalance > 0
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  <p className="text-xs">Saldo</p>
                  <p className="truncate font-bold">{money(groupBalance)}</p>
                </div>
              </div>

              <ExpandToggleButton
                expanded={accountExpanded}
                label="Abrir cuenta"
                tone="money"
                onClick={onToggleAccountExpanded}
              />
            </div>

            {accountExpanded ? (
              <>
                {showGroupPaymentBreakdown ? (
                  <PaymentBreakdownCard
                    title={mode === "checkin" ? "Cuenta del cliente" : "Pagos de checkout"}
                    description={
                      mode === "checkin"
                        ? `Pago conjunto de ${stays.length} habitaciones. Puedes registrar uno o varios pagos y el sistema reparte el monto en las habitaciones.`
                        : groupCheckoutPaymentsEditable
                          ? `Puedes registrar varios pagos hasta cubrir el saldo pendiente de las ${stays.length} habitaciones.`
                          : "La cuenta ya está cubierta. Este desglose es únicamente de consulta."
                    }
                    total={total}
                    payments={groupPayments}
                    onChange={
                      mode === "checkin" || groupCheckoutPaymentsEditable
                        ? (payments) => onGroupPaymentsChange(payments, groupStage)
                        : undefined
                    }
                    isPaymentReadOnly={(payment) => numericApiId(payment.id) !== null}
                    stage={groupStage}
                    allowCredit={Boolean(creditInfo)}
                    creditInfo={creditInfo}
                    readOnly={mode === "checkout" && !groupCheckoutPaymentsEditable}
                    showInvoiceStatus
                    className="mt-4"
                  />
                ) : null}

                <FelPaymentNotice
                  stay={groupPaymentProxy}
                  stage={groupStage}
                  dispatches={groupFelDispatches}
                  minibarCharges={groupPaymentProxy.checkoutMinibarCharges}
                  onSend={() => onSendGroupToFel(groupStage)}
                />

                {mode === "checkin" ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    <CheckItem
                      checked={groupChecklistChecked("inguat") || groupInguatCanBeSkipped}
                      title={
                        groupInguatCanBeSkipped && !groupChecklistChecked("inguat")
                          ? "Libro INGUAT no requerido"
                          : "Libro INGUAT revisado"
                      }
                      description={
                        groupInguatCanBeSkipped && !groupChecklistChecked("inguat")
                          ? "Pago grupal en efectivo marcado sin factura. Para este caso puntual, el check-in conjunto puede completarse sin revisar INGUAT."
                          : "Confirmar una sola vez los datos de llegada del cliente para todas sus habitaciones."
                      }
                      icon={FileText}
                      onClick={() => toggleGroupChecklist("inguat")}
                    />

                    {groupBalance <= 0 ? (
                      <PaidInFullBox />
                    ) : (
                      <>
                        <CheckItem
                          checked={checkInBalancesCollected}
                          title="Saldo grupal cobrado ahora"
                          description={`Falta cobrar ${money(groupBalance)} en la cuenta total del cliente.`}
                          icon={CreditCard}
                          onClick={onCollectGroupCheckInBalance}
                        />
                        <CheckItem
                          checked={checkInBalancesDeferred}
                          title="Cobrar cuenta grupal al salir"
                          description="Marca esto si el saldo de todas las habitaciones quedará abierto para pagarse durante la estadía o al salir."
                          icon={Receipt}
                          onClick={onDeferGroupCheckInBalance}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {checkInBalancesDeferred && groupBalance > 0 ? (
                      <DeferredBalanceNotice balance={groupBalance} />
                    ) : null}

                    <div className="grid gap-3">
                      {groupBalance <= 0 ? (
                        <PaidInFullBox />
                      ) : (
                        <CheckItem
                          checked={checkOutBalancesClosed}
                          title="Saldo final grupal cobrado"
                          description={`Falta cobrar ${money(groupBalance)} en la cuenta total del cliente.`}
                          icon={CheckCircle2}
                          onClick={onCloseGroupCheckOutBalance}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  {mode === "checkin" ? (
                    <Button
                      className="gap-2 rounded-full"
                      disabled={!allReady || groupPaymentsSaving}
                      onClick={onCompleteGroupCheckIn}
                    >
                      <LogIn className="size-4" />
                      Check-in conjunto
                    </Button>
                  ) : (
                    <Button
                      className="gap-2 rounded-full"
                      disabled={!allReady}
                      onClick={onCompleteGroupCheckOut}
                    >
                      <LogOut className="size-4" />
                      Check-out conjunto
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {stays.map((stay) => (
            <StayCard
              key={stay.id}
              stay={stay}
              mode={mode}
              expanded={!isGroup || expandedStayIds.has(stay.id)}
              onToggleExpanded={() => onToggleStayExpanded(stay.id)}
              allowCollapse={isGroup}
              showGuestDetails={false}
              hideFinalAction={isGroup}
              accountManagedByGroup={isGroup}
              onToggle={(key) => onToggle(stay.id, key)}
              onCheckInPaymentDecision={(decision) =>
                onCheckInPaymentDecision(stay.id, decision)
              }
              onClosePaymentAtCheckOut={() => onClosePaymentAtCheckOut(stay.id)}
              onUndoCheckInPayment={() => onUndoCheckInPayment(stay.id)}
              onPaymentsChange={(payments, stage) =>
                onPaymentsChange(stay.id, payments, stage)
              }
              paymentsSaving={savingCheckInPaymentIds.has(stay.id)}
              felDispatches={dispatchesForFelStage(
                felDispatches,
                stay.id,
                mode === "checkin" ? "check-in" : "check-out",
              )}
              cashInvoicePreference={cashInvoicePreferenceFor(
                stay.id,
                mode === "checkin" ? "check-in" : "check-out",
                cashInvoicePreferences,
              )}
              onSendToFel={(preferredPaymentId) =>
                onSendToFel(
                  stay.id,
                  mode === "checkin" ? "check-in" : "check-out",
                  preferredPaymentId,
                )
              }
              onCompleteCheckIn={() => onCompleteCheckIn(stay.id)}
              onCompleteCheckOut={() => onCompleteCheckOut(stay.id)}
              onCancelBeforeCheckIn={
                isGroup && onCancelBeforeCheckIn
                  ? () => onCancelBeforeCheckIn([stay])
                  : undefined
              }
              onPrint={() => onPrint(stay)}
              creditInfo={creditInfo}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

function stayStatusFromReservation(status: Reservation["status"]): StayStatus {
  if (status === "in-house") return "En habitación";
  if (status === "checkout") return "Check-out finalizado";
  return "Lista para check-in";
}

function roomStatusFromStore(status: string): RoomStatus {
  if (status === "ready-for-check-in") return "Lista para check-in";
  if (status === "ocupada") return "Ocupada";
  if (status === "reservada") return "Reservada";
  if (status === "limpieza" || status === "mantenimiento") return "Limpieza";
  return "Disponible";
}

function occupancyLabel(people: number): Stay["occupancy"] {
  if (people <= 1) return "1 persona";
  if (people === 2) return "2 personas";
  if (people === 3) return "3 personas";
  return "4 personas";
}

function defaultChecklistForReservation(reservation: Reservation) {
  const checklist = { ...emptyChecklist };

  if (reservation.status === "in-house" || reservation.status === "checkout") {
    checklist.inguat = true;
    checklist.key = true;
    checklist.remote = true;
    checklist.breakfast = true;
    checklist.paymentCollectedAtCheckIn = reservation.paid >= reservation.total;
    checklist.paymentDeferredToCheckOut = reservation.paid < reservation.total;
  }

  if (reservation.status === "checkout") {
    checklist.roomInspection = true;
    checklist.keyReturned = true;
    checklist.remoteReturned = true;
    checklist.chargesReviewed = true;
    checklist.paymentClosedAtCheckOut = reservation.paid >= reservation.total;
  }

  return checklist;
}

function paymentsForReservation(
  reservation: Reservation,
  advances: Advance[],
): PaymentRecord[] {
  if (reservation.payments?.length) return reservation.payments;

  let remainingPaid = reservation.paid;
  const reservationAdvances = advances
    .filter((advance) => advance.reservationId === reservation.id)
    .map<PaymentRecord | null>((advance) => {
      if (remainingPaid <= 0) return null;
      const amount = Math.min(advance.amount, remainingPaid);
      remainingPaid -= amount;

      return {
        id: `pay-${advance.id}`,
        method: advance.method,
        amount,
        reference: advance.notes ?? advance.receivedBy,
        stage: "reserva",
        date: advance.date,
      };
    })
    .filter((payment): payment is PaymentRecord => Boolean(payment));

  const advanceTotal = paymentTotal(reservationAdvances);
  const remainder = Math.max(0, reservation.paid - advanceTotal);

  if (remainder > 0) {
    reservationAdvances.push({
      id: `pay-${reservation.id}-previo`,
      method: "transferencia",
      amount: remainder,
      reference: "Pago registrado previamente",
      stage: (
        reservation.status === "pendiente" ||
        reservation.status === "confirmada" ||
        reservation.status === "ready-for-check-in"
      )
        ? "reserva"
        : "check-in",
      date: reservation.createdAt,
    });
  }

  return reservationAdvances;
}

function paymentNotes(payments: PaymentRecord[]) {
  if (payments.length === 0) return "Sin pagos registrados.";
  return payments
    .map((payment) => {
      const reference = payment.reference ? ` (${payment.reference})` : "";
      return `${paymentMethodLabel(payment.method)} ${money(payment.amount)}${reference}`;
    })
    .join(" · ");
}

function groupPaymentsForStays(stays: Stay[]) {
  return stays.flatMap((stay) => stay.payments);
}

function allocatePaymentsToStays(stays: Stay[], payments: PaymentRecord[]) {
  const buckets = stays.map((stay) => ({
    stay,
    remaining: stayTotalDue(stay),
    payments: [] as PaymentRecord[],
  }));

  payments.forEach((payment, paymentIndex) => {
    let remainingPayment = Number(payment.amount || 0);
    if (remainingPayment <= 0) return;

    for (const bucket of buckets) {
      if (remainingPayment <= 0) break;
      if (bucket.remaining <= 0) continue;

      const amount = Math.min(bucket.remaining, remainingPayment);
      bucket.remaining -= amount;
      remainingPayment -= amount;

      bucket.payments.push({
        ...payment,
        id: `${payment.id}-${bucket.stay.id}-${paymentIndex}`,
        amount,
      });
    }
  });

  return new Map(buckets.map((bucket) => [bucket.stay.id, bucket.payments]));
}

function paymentsWithFallbackForBalance(
  stay: Stay,
  stage: "check-in" | "check-out",
) {
  const balance = stayBalance(stay);
  if (balance <= 0) return stay.payments;

  return [
    ...stay.payments,
    {
      ...createPaymentRecord(stage, "efectivo"),
      amount: balance,
      reference:
        stage === "check-in"
          ? "Saldo marcado en check-in"
          : "Saldo abierto durante la estadía",
    },
  ];
}

function numericApiId(value: string | null | undefined) {
  if (!value) return null;
  const text = String(value);
  if (/^\d+$/.test(text)) return Number(text);
  const reservationRoomMatch = text.match(/^(\d+)-\d+$/);
  return reservationRoomMatch ? Number(reservationRoomMatch[1]) : null;
}

function paymentPayload(payment: PaymentRecord) {
  return {
    amount: Number(payment.amount || 0),
    payment_method: payment.method,
    payment_reference: payment.reference,
    notes: payment.reference,
  };
}

function invoicePrimaryGuest(stays: Stay[], guests: Guest[]) {
  const primary = stays[0];
  return primary?.guestId
    ? guests.find((guest) => guest.id === primary.guestId)
    : undefined;
}

function defaultInvoiceTaxId(stays: Stay[], guests: Guest[]) {
  const guest = invoicePrimaryGuest(stays, guests);
  const nit = guest?.nit?.trim();
  if (nit) return nit.toUpperCase();

  return "CF";
}

function defaultStayInvoiceBuyerName(stays: Stay[], guests: Guest[], taxId: string) {
  if (taxId === "CF") return "CONSUMIDOR FINAL";
  return invoicePrimaryGuest(stays, guests)?.name ?? stays[0]?.guestName ?? "";
}

function defaultStayInvoiceDescription(target: StayInvoiceTarget) {
  const codes = Array.from(new Set(target.stays.map(reservationCodeForGuest))).join(", ");
  const rooms = target.stays.map((stay) => stay.roomNumber).join(", ");
  const extras = target.stays.reduce((sum, stay) => sum + stay.extraCharges, 0);

  if (target.stage === "check-out" && extras > 0) {
    return `Hospedaje y consumos checkout ${codes} hab. ${rooms}`;
  }

  return target.stage === "check-in"
    ? `Abono hospedaje check-in ${codes} hab. ${rooms}`
    : `Hospedaje checkout ${codes} hab. ${rooms}`;
}

function defaultStayInvoiceForm(
  target: StayInvoiceTarget,
  guests: Guest[],
  concepts: InvoiceConceptOption[],
  dispatches: FelDispatch[],
  preferredPaymentIds?: string[],
): StayInvoiceForm {
  const taxId = defaultInvoiceTaxId(target.stays, guests);
  const isFinalConsumer = taxId === "CF";
  const guest = invoicePrimaryGuest(target.stays, guests);
  const serviceConcept = invoiceConceptForItemType(
    concepts,
    INVOICE_ITEM_TYPES.SERVICIO,
  );
  const invoiceablePayments = invoiceablePaymentsForStage(target.payments, dispatches);
  const preferredIds = preferredPaymentIds?.length
    ? new Set(preferredPaymentIds)
    : null;
  const selectedPayments = preferredIds
    ? invoiceablePayments.filter(
        (payment) =>
          preferredIds.has(paymentRecordKey(payment)) ||
          preferredIds.has(payment.id),
      )
    : invoiceablePayments;
  const selectedPaymentIds = selectedPayments.map(paymentRecordKey);
  const selectedPaymentTotal = invoiceablePaymentTotal(selectedPayments, dispatches);
  const selectedMinibarTotal =
    target.stage === "check-out"
      ? minibarChargeTotal(invoiceableMinibarCharges(target.minibarCharges, dispatches))
      : 0;
  const totalToInvoice = roundCurrency(selectedPaymentTotal + selectedMinibarTotal);

  return {
    useCustomerTaxInfo: true,
    taxId,
    name: isFinalConsumer
      ? "CONSUMIDOR FINAL"
      : defaultStayInvoiceBuyerName(target.stays, guests, taxId),
    address: "CIUDAD",
    city: "09001",
    district: guest?.department ?? "Quetzaltenango",
    state: guest?.department ?? "Quetzaltenango",
    country: "GT",
    format: INVOICE_FORMATS.PDF_XML,
    conceptId: serviceConcept ? String(serviceConcept.id) : "",
    itemType: INVOICE_ITEM_TYPES.SERVICIO,
    amountToInvoice: String(totalToInvoice),
    description: defaultStayInvoiceDescription(target),
    notes: `Facturacion por pagos y consumos seleccionados: ${money(totalToInvoice)}`,
    selectedPaymentIds,
  };
}

function invoiceIdFromResponse(response: unknown) {
  return apiString(invoiceResponseRecord(response), [
    "id_invoice",
    "idInvoice",
    "invoice_id",
    "id",
  ]);
}

function checkoutPaymentReferencesFromResponse(response: unknown) {
  return collectApiRecords(response)
    .map((record) => {
      const id = apiNumber(record, [
        "id_stay_payment",
        "idStayPayment",
        "stay_payment_id",
      ]);
      if (!id) return null;

      return {
        id: String(id),
        amount: apiNumber(record, ["amount"]),
        stage: paymentStageFromApi(
          apiString(record, ["payment_stage", "paymentStage", "stage"], "CheckOut"),
        ),
      };
    })
    .filter((item): item is { id: string; amount: number | undefined; stage: PaymentRecord["stage"] } =>
      Boolean(item),
    )
    .filter((item) => item.stage === "check-out");
}

function reservationPaymentFromResponse(response: unknown) {
  for (const record of collectApiRecords(response)) {
    const id = apiNumber(record, [
      "id_reservation_payment",
      "idReservationPayment",
      "reservation_payment_id",
      "id_payment",
      "payment_id",
      "id",
    ]);
    if (!id) continue;

    return {
      id: String(id),
      backendPaymentType: "reservation" as const,
      isInvoiced: apiBoolean(record, ["is_invoiced", "isInvoiced"], false),
      invoiceId: apiString(record, ["id_invoice", "idInvoice", "invoice_id"]),
      invoicedAmount: apiNumber(record, ["invoiced_amount", "invoicedAmount"]),
      pendingToInvoiceAmount: apiNumber(record, [
        "pending_to_invoice_amount",
        "pendingToInvoiceAmount",
      ]),
      invoicedAt: apiString(record, ["invoiced_at", "invoicedAt"]),
    };
  }

  return null;
}

function apiNumberFromResponse(response: unknown, keys: string[]) {
  for (const record of collectApiRecords(response)) {
    const value = apiNumber(record, keys);
    if (value) return value;
  }
  return undefined;
}

function applyPaymentIdUpdates(
  payments: PaymentRecord[],
  updates: PaymentIdUpdate[],
) {
  return payments.map((payment) => {
    const update = updates.find((candidate) => candidate.localId === payment.id);
    return update
      ? {
          ...payment,
          id: update.backendId,
          backendPaymentId: update.backendId,
          backendPaymentType: update.backendPaymentType ?? payment.backendPaymentType,
          isInvoiced: update.isInvoiced ?? payment.isInvoiced,
          invoiceId: update.invoiceId ?? payment.invoiceId,
          invoicedAmount: update.invoicedAmount ?? payment.invoicedAmount,
          pendingToInvoiceAmount:
            update.pendingToInvoiceAmount ?? payment.pendingToInvoiceAmount,
          invoicedAt: update.invoicedAt ?? payment.invoicedAt,
        }
      : payment;
  });
}

function reconcileStagePayments(
  localPayments: PaymentRecord[],
  backendPayments: PaymentRecord[],
  stage: FelPaymentStage,
) {
  const availableBackend = backendPayments.filter(
    (payment) => payment.stage === stage && Number(payment.amount || 0) > 0,
  );
  const usedBackendIds = new Set(
    localPayments
      .filter((payment) => payment.backendPaymentType === "stay")
      .map((payment) => payment.id),
  );

  return localPayments.map((payment) => {
    if (
      payment.stage !== stage ||
      (numericApiId(payment.id) && payment.backendPaymentType)
    ) {
      return payment;
    }

    const match = availableBackend.find(
      (candidate) =>
        !usedBackendIds.has(candidate.id) &&
        Math.abs(Number(candidate.amount || 0) - Number(payment.amount || 0)) <= 0.01 &&
        candidate.method === payment.method,
    );
    if (!match) return payment;
    usedBackendIds.add(match.id);
    return match;
  });
}

function saveableCheckInPayments(
  stay: Stay,
  dirtyCheckInPaymentIds: DirtyCheckInPayments,
) {
  const dirtyIds = new Set(dirtyCheckInPaymentIds[stay.id] ?? []);

  return stay.payments.filter(
    (payment) =>
      payment.stage === "check-in" &&
      Number(payment.amount || 0) > 0 &&
      (dirtyIds.has(payment.id) ||
        !numericApiId(payment.id) ||
        !payment.backendPaymentType),
  );
}

function paymentsWithFallbackForGroupBalance(
  stays: Stay[],
  payments: PaymentRecord[],
  stage: "check-in" | "check-out",
) {
  const balance = groupPaymentBalance(stays, payments);
  if (balance <= 0) return payments;

  return [
    ...payments,
    {
      ...createPaymentRecord(stage, "efectivo"),
      amount: balance,
      reference:
        stage === "check-in"
          ? "Saldo grupal marcado en check-in"
          : "Saldo grupal abierto durante la estadía",
    },
  ];
}

export function RecepcionCheckinPage() {
  const [searchParams] = useSearchParams();
  const requestedCheckoutReservation = searchParams.get("reservation");
  const checkoutFocusHandled = useRef(false);
  const {
    reservations,
    advances,
    creditAccounts,
    guests,
    rooms: storeRooms,
    roomTypes,
    dispatch,
    refreshApiState,
  } = useStore();
  const [stayOverrides, setStayOverrides] = useState<Record<string, Partial<Stay>>>({});
  const [roomOverrides, setRoomOverrides] = useState<Record<string, RoomStatus>>({});
  const [felDispatches, setFelDispatches] = useState<FelDispatch[]>([]);
  const [cashInvoicePreferences] = useState<
    Record<string, CashInvoicePreference>
  >({});
  const [expandedGuestGroups, setExpandedGuestGroups] = useState<Record<string, boolean>>({});
  const [expandedGroupAccounts, setExpandedGroupAccounts] = useState<Record<string, boolean>>({});
  const [expandedStayCards, setExpandedStayCards] = useState<Record<string, boolean>>({});
  const [groupPaymentOverrides, setGroupPaymentOverrides] = useState<
    Record<string, PaymentRecord[]>
  >({});
  const [dirtyCheckInPaymentIds, setDirtyCheckInPaymentIds] =
    useState<DirtyCheckInPayments>({});
  const [savingCheckInPaymentIds, setSavingCheckInPaymentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [checkoutSnapshots, setCheckoutSnapshots] = useState<CheckoutStaySnapshot[]>([]);
  const checkoutSnapshotsRef = useRef<CheckoutStaySnapshot[]>([]);
  const checkoutSnapshotsLoadedAtRef = useRef(0);
  const checkoutSnapshotsRequestRef = useRef<Promise<CheckoutStaySnapshot[] | null> | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<StayInvoiceTarget | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<StayInvoiceForm | null>(null);
  const [invoiceNitLookupStatus, setInvoiceNitLookupStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "error"
  >("idle");
  const [invoiceConcepts, setInvoiceConcepts] = useState<InvoiceConceptOption[]>([]);
  const [invoiceRemaining, setInvoiceRemaining] = useState<InvoiceRemainingSummary | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [issuedInvoiceResponse, setIssuedInvoiceResponse] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("tab") === "checkout" ? "checkout" : "checkin",
  );
  const [query, setQuery] = useState("");
  const [cancelledArrivalIds, setCancelledArrivalIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [arrivalCancelTarget, setArrivalCancelTarget] =
    useState<ArrivalCancelTarget | null>(null);
  const [arrivalCancelReason, setArrivalCancelReason] = useState(
    "Huésped no se presento",
  );
  const [arrivalCancelSubmitting, setArrivalCancelSubmitting] = useState(false);
  const canCancelArrival =
    Boolean(arrivalCancelTarget) &&
    arrivalCancelReason.trim().length >= 5 &&
    !arrivalCancelSubmitting;

  const loadCheckoutSnapshots = useCallback(async (options: { force?: boolean } = {}) => {
    const force = options.force ?? false;
    const now = Date.now();
    const isFresh = now - checkoutSnapshotsLoadedAtRef.current < 30_000;

    if (!force && checkoutSnapshotsLoadedAtRef.current > 0 && isFresh) {
      return checkoutSnapshotsRef.current;
    }

    if (!force && checkoutSnapshotsRequestRef.current) {
      return checkoutSnapshotsRequestRef.current;
    }

    const request = api.checkOut.listInHouse<unknown>()
      .then((response) => {
        const snapshots = apiArray(response)
          .map(mapCheckoutStaySnapshot)
          .filter((snapshot): snapshot is CheckoutStaySnapshot => Boolean(snapshot));
        checkoutSnapshotsRef.current = snapshots;
        checkoutSnapshotsLoadedAtRef.current = Date.now();
        setCheckoutSnapshots(snapshots);
        return snapshots;
      })
      .catch(() => {
        // Conserva el ultimo estado valido para no desaparecer cards de checkout
        // por una falla temporal de red.
        return null;
      })
      .finally(() => {
        if (checkoutSnapshotsRequestRef.current === request) {
          checkoutSnapshotsRequestRef.current = null;
        }
      });

    checkoutSnapshotsRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void loadCheckoutSnapshots({ force: true });
  }, [loadCheckoutSnapshots]);


  useEffect(() => {
    if (activeTab === "checkout") {
      void loadCheckoutSnapshots({ force: false });
    }
  }, [activeTab, loadCheckoutSnapshots]);

  useEffect(() => {
    if (!invoiceForm || invoiceForm.useCustomerTaxInfo) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);
    if (!taxId || taxId === "CF") {
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateStayInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupStayInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId, invoiceForm?.useCustomerTaxInfo]);


  const checkoutSnapshotByReservationId = useMemo(
    () =>
      new Map(
        checkoutSnapshots.map((snapshot) => [snapshot.reservationId, snapshot]),
      ),
    [checkoutSnapshots],
  );

  const stays = useMemo<Stay[]>(
    () =>
      reservations
        .filter(
          (reservation) =>
            reservation.status !== "cancelada" &&
            reservation.status !== "no-show" &&
            !cancelledArrivalIds.has(reservation.id),
        )
        .map((reservation) => {
          const guest = guests.find((item) => item.id === reservation.guestId);
          const room = storeRooms.find((item) => item.id === reservation.roomId);
          const roomType = roomTypes.find((item) => item.id === room?.typeId);
          const baseTotal = reservation.rate * reservation.nights;
          const override = stayOverrides[reservation.id] ?? {};
          const checklist = override.checklist ?? defaultChecklistForReservation(reservation);
          const people = reservation.adults + reservation.children;
          const checkoutSnapshot =
            checkoutSnapshotByReservationId.get(String(numericApiId(reservation.id) ?? ""));
          const localPayments = override.payments ?? paymentsForReservation(reservation, advances);
          const payments = mergeBackendPayments(localPayments, checkoutSnapshot?.payments ?? []);
          const backendExtraCharges = checkoutSnapshot?.minibarTotalAmount ?? 0;

          return {
            id: reservation.id,
            backendStayId: checkoutSnapshot?.stayId,
            reservationRoomId: reservation.reservationRoomId,
            guestId: reservation.guestId,
            code: reservation.code,
            guestName: guest?.name ?? "Huésped",
            dpi: guest?.document ?? "Sin documento",
            phone: guest?.phone ?? "Sin teléfono",
            roomNumber: room?.number ?? "-",
            roomType: roomType?.name.includes("Jr") ? "Jr. Suite" : "Estándar",
            occupancy: occupancyLabel(people),
            guests: people,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
            total: baseTotal,
            paid: override.paid ?? paymentTotal(payments),
            paidBeforeCheckIn: override.paidBeforeCheckIn,
            paidBeforeCheckOut: override.paidBeforeCheckOut,
            payments,
            paymentsBeforeCheckIn: override.paymentsBeforeCheckIn,
            paymentsBeforeCheckOut: override.paymentsBeforeCheckOut,
            extraCharges: Math.max(0, reservation.total - baseTotal, backendExtraCharges),
            checkoutMinibarCharges: checkoutSnapshot?.minibarCharges,
            status:
              override.status ??
              (checkoutSnapshot
                ? "En habitación"
                : stayStatusFromReservation(reservation.status)),
            notes: reservation.notes ?? "",
            checklist,
          } satisfies Stay;
        }),
    [
      advances,
      cancelledArrivalIds,
      checkoutSnapshotByReservationId,
      guests,
      reservations,
      roomTypes,
      stayOverrides,
      storeRooms,
    ],
  );

  const rooms = useMemo<Room[]>(
    () =>
      storeRooms.map((room) => {
        const roomType = roomTypes.find((item) => item.id === room.typeId);
        return {
          number: room.number,
          type: roomType?.name.includes("Jr") ? "Jr. Suite" : "Estándar",
          status: roomOverrides[room.number] ?? roomStatusFromStore(room.status),
        };
      }),
    [roomOverrides, roomTypes, storeRooms],
  );

  function setStays(updater: (current: Stay[]) => Stay[]) {
    const nextStays = updater(stays);
    setStayOverrides((current) => {
      const next = { ...current };

      nextStays.forEach((stay) => {
        next[stay.id] = {
          ...(next[stay.id] ?? {}),
          status: stay.status,
          paid: stay.paid,
          paidBeforeCheckIn: stay.paidBeforeCheckIn,
          paidBeforeCheckOut: stay.paidBeforeCheckOut,
          payments: stay.payments,
          paymentsBeforeCheckIn: stay.paymentsBeforeCheckIn,
          paymentsBeforeCheckOut: stay.paymentsBeforeCheckOut,
          checklist: stay.checklist,
        };
      });

      return next;
    });
  }

  function setRooms(updater: (current: Room[]) => Room[]) {
    const nextRooms = updater(rooms);
    setRoomOverrides((current) => {
      const next = { ...current };

      nextRooms.forEach((room) => {
        next[room.number] = room.status;
      });

      return next;
    });
  }

  function toggleGuestGroup(groupKey: string) {
    setExpandedGuestGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function toggleGroupAccount(groupKey: string) {
    setExpandedGroupAccounts((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function toggleStayCard(stayId: string) {
    setExpandedStayCards((current) => ({
      ...current,
      [stayId]: !current[stayId],
    }));
  }

  function openArrivalCancelDialog(selectedStays: Stay[]) {
    if (selectedStays.length === 0) return;
    setArrivalCancelTarget({ stays: selectedStays });
    setArrivalCancelReason("Huésped no se presento");
  }

  function closeArrivalCancelDialog() {
    if (arrivalCancelSubmitting) return;
    setArrivalCancelTarget(null);
    setArrivalCancelReason("Huésped no se presento");
  }

  async function confirmArrivalCancel() {
    const target = arrivalCancelTarget;
    const reason = arrivalCancelReason.trim();
    if (!target || reason.length < 5) return;

    const missingBackendId = target.stays.find((stay) => !numericApiId(stay.id));
    if (missingBackendId) {
      toast.error("No se pudo cancelar la llegada", {
        description:
          "Falta el identificador de la reserva en la respuesta del sistema.",
      });
      return;
    }

    setArrivalCancelSubmitting(true);

    try {
      for (const stay of target.stays) {
        const reservationId = numericApiId(stay.id);
        if (!reservationId) continue;
        await api.reservations.cancel(reservationId, { reason });
      }

      const cancelledIds = target.stays.map((stay) => stay.id);
      setCancelledArrivalIds((current) => {
        const next = new Set(current);
        cancelledIds.forEach((id) => next.add(id));
        return next;
      });
      setExpandedStayCards((current) => {
        const next = { ...current };
        cancelledIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setDirtyCheckInPaymentIds((current) => {
        const next = { ...current };
        cancelledIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });

      await refreshApiState(["reservations", "rooms"], { force: true });

      toast.success("Llegada cancelada", {
        description:
          target.stays.length === 1
            ? `${target.stays[0]?.guestName ?? "Cliente"} - Habitación ${
                target.stays[0]?.roomNumber ?? "-"
              }`
            : `${target.stays[0]?.guestName ?? "Cliente"} - ${
                target.stays.length
              } habitaciones`,
      });

      setArrivalCancelTarget(null);
      setArrivalCancelReason("Huésped no se presento");
    } catch (error) {
      toast.error("No se pudo cancelar la llegada", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setArrivalCancelSubmitting(false);
    }
  }

  const arrivals = stays.filter((stay) => stay.status === "Lista para check-in");
  const inHouse = stays.filter((stay) => stay.status === "En habitación");

  const filteredArrivals = useMemo(() => {
    const text = query.toLowerCase().trim();
    if (!text) return arrivals;

    return arrivals.filter((stay) =>
      [stay.code, stay.guestName, stay.dpi, stay.phone, stay.roomNumber]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [arrivals, query]);

  const filteredInHouse = useMemo(() => {
    const text = query.toLowerCase().trim();
    if (!text) return inHouse;

    return inHouse.filter((stay) =>
      [stay.code, stay.guestName, stay.dpi, stay.phone, stay.roomNumber]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [inHouse, query]);

  const groupedArrivals = useMemo(
    () => groupStaysByGuestAndDate(filteredArrivals, "checkin"),
    [filteredArrivals],
  );

  const groupedInHouse = useMemo(
    () => groupStaysByGuestAndDate(filteredInHouse, "checkout"),
    [filteredInHouse],
  );

  useEffect(() => {
    if (!requestedCheckoutReservation || checkoutFocusHandled.current) return;
    const requestedId = numericApiId(requestedCheckoutReservation);
    const targetStay = inHouse.find(
      (stay) =>
        stay.id === requestedCheckoutReservation ||
        (requestedId !== null && numericApiId(stay.id) === requestedId),
    );
    if (!targetStay) return;

    const targetGroup = groupedInHouse.find((group) =>
      group.stays.some((stay) => stay.id === targetStay.id),
    );
    const groupKey = targetGroup ? `checkout|${targetGroup.id}` : null;

    checkoutFocusHandled.current = true;
    setActiveTab("checkout");
    setQuery("");
    setExpandedStayCards((current) => ({
      ...current,
      [targetStay.id]: true,
    }));
    if (groupKey) {
      setExpandedGuestGroups((current) => ({
        ...current,
        [groupKey]: true,
      }));
      setExpandedGroupAccounts((current) => ({
        ...current,
        [groupKey]: true,
      }));
    }

    window.setTimeout(() => {
      document
        .getElementById(`stay-card-${targetStay.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [groupedInHouse, inHouse, requestedCheckoutReservation]);

  const pendingCheckoutCharges = inHouse.reduce(
    (sum, stay) => sum + stay.extraCharges,
    0,
  );

  const deferredBalances = inHouse.reduce((sum, stay) => {
    if (!stay.checklist.paymentDeferredToCheckOut) return sum;
    return sum + stayBalance(stay);
  }, 0);

  function toggleChecklist(stayId: string, key: ChecklistKey) {
    setStays((current) =>
      current.map((stay) =>
        stay.id === stayId
          ? {
              ...stay,
              checklist: {
                ...stay.checklist,
                [key]: !stay.checklist[key],
              },
            }
          : stay,
      ),
    );
  }

  function patchChecklistMany(
    stayIds: string[],
    patch: Partial<Record<ChecklistKey, boolean>>,
  ) {
    const ids = new Set(stayIds);
    setStays((current) =>
      current.map((stay) =>
        ids.has(stay.id)
          ? {
              ...stay,
              checklist: {
                ...stay.checklist,
                ...patch,
              },
            }
          : stay,
      ),
    );
  }

  function setChecklistMany(stayIds: string[], key: ChecklistKey, checked: boolean) {
    patchChecklistMany(stayIds, { [key]: checked });
  }

  function creditAccountForStay(stay: Stay) {
    const normalizedName = normalizeSearchValue(stay.guestName);
    return creditAccounts.find(
      (account) =>
        account.guestId === stay.guestId ||
        normalizeSearchValue(account.company) === normalizedName,
    );
  }

  function creditInfoForStay(stay?: Stay) {
    if (!stay) return undefined;
    return creditPaymentInfo(creditAccountForStay(stay));
  }

  function creditAmountForPayments(payments: PaymentRecord[]) {
    return roundCurrency(paymentTotalByMethod(payments, "credito"));
  }

  function creditAccountForCharge(stay: Stay, payments: PaymentRecord[]) {
    const amount = creditAmountForPayments(payments);
    if (amount <= 0) return undefined;

    const account = creditAccountForStay(stay);
    if (!account) {
      throw new Error(`El cliente ${stay.guestName} no tiene crédito asignado.`);
    }

    const disabledReason = creditDisabledReason(account);
    if (disabledReason) {
      throw new Error(`${disabledReason} para ${stay.guestName}.`);
    }

    if (amount > creditAccountAvailable(account) + 0.01) {
      throw new Error(
        `El crédito usado (${money(amount)}) supera el disponible de ${stay.guestName} (${money(creditAccountAvailable(account))}).`,
      );
    }

    return account;
  }

  function validateCreditPayments(stay: Stay, payments: PaymentRecord[]) {
    creditAccountForCharge(stay, payments);
  }

  async function syncCreditChargeForPayments(
    stay: Stay,
    payments: PaymentRecord[],
    sourceModule: "CheckIn" | "CheckOut",
    sourceId?: number,
  ) {
    const amount = creditAmountForPayments(payments);
    if (amount <= 0) return false;

    const account = creditAccountForCharge(stay, payments);
    const accountId = numericApiId(account?.id);
    if (!accountId) {
      throw new Error(`No se encontró el identificador de crédito para ${stay.guestName}.`);
    }

    await api.credit.createAccountMovement(accountId, {
      concept:
        sourceModule === "CheckIn"
          ? "Cargo por pago en check-in"
          : "Cargo por pago en check-out",
      amount,
      source_module: sourceModule,
      source_id: sourceId,
      reference: reservationCodeForGuest(stay),
      notes: `Crédito usado por ${stay.guestName} en habitación ${stay.roomNumber}.`,
    });

    return true;
  }

  function queueUnsavedCheckInPayments(
    stayId: string,
    previousPayments: PaymentRecord[],
    nextPayments: PaymentRecord[],
    stage: "check-in" | "check-out",
  ) {
    if (stage !== "check-in") return;

    const previousIds = new Set(previousPayments.map((payment) => payment.id));
    const nextIds = new Set(nextPayments.map((payment) => payment.id));

    setDirtyCheckInPaymentIds((current) => {
      const dirtyIds = new Set(current[stayId] ?? []);

      nextPayments.forEach((payment) => {
        if (payment.stage !== "check-in") return;
        if (!previousIds.has(payment.id) || dirtyIds.has(payment.id)) {
          dirtyIds.add(payment.id);
        }
      });

      Array.from(dirtyIds).forEach((id) => {
        if (!nextIds.has(id)) dirtyIds.delete(id);
      });

      const next = { ...current };
      if (dirtyIds.size > 0) {
        next[stayId] = Array.from(dirtyIds);
      } else {
        delete next[stayId];
      }

      return next;
    });
  }

  function updateStayPayments(
    stayId: string,
    payments: PaymentRecord[],
    stage: "check-in" | "check-out",
  ) {
    const paid = paymentTotal(payments);
    const selectedStay = stays.find((stay) => stay.id === stayId);
    const stageDispatches = dispatchesForFelStage(felDispatches, stayId, stage);
    const paymentIdsToDelete = selectedStay
      ? removableBackendPaymentIds(selectedStay.payments, payments, stageDispatches)
      : [];
    const totalDue = selectedStay ? stayTotalDue(selectedStay) : 0;
    const isPaid = paid >= totalDue && totalDue > 0;

    if (paymentIdsToDelete.length > 0) {
      void Promise.allSettled(
        paymentIdsToDelete.map((paymentId) => api.reservations.deletePayment(paymentId)),
      ).then((results) => {
        const failed = results.find((result) => result.status === "rejected");
        if (failed) {
          toast.error("No se pudo eliminar un pago guardado.", {
            description:
              failed.status === "rejected"
                ? getApiErrorMessage(failed.reason)
                : "Actualiza la pantalla y vuelve a intentar.",
          });
        } else {
          toast.success("Pago eliminado.");
        }
      });
    }

    queueUnsavedCheckInPayments(
      stayId,
      selectedStay?.payments ?? [],
      payments,
      stage,
    );

    setStays((current) =>
      current.map((stay) => {
        if (stay.id !== stayId) return stay;

        return {
          ...stay,
          paid,
          payments,
          checklist: {
            ...stay.checklist,
            paymentCollectedAtCheckIn:
              stage === "check-in" && isPaid
                ? true
                : stay.checklist.paymentCollectedAtCheckIn && isPaid,
            paymentDeferredToCheckOut: isPaid
              ? false
              : stay.checklist.paymentDeferredToCheckOut,
            paymentClosedAtCheckOut:
              stage === "check-out" && isPaid
                ? true
                : stay.checklist.paymentClosedAtCheckOut && isPaid,
          },
        };
      }),
    );
  }

  function updateGroupPayments(
    groupKey: string,
    selectedStays: Stay[],
    payments: PaymentRecord[],
    stage: "check-in" | "check-out",
  ) {
    setGroupPaymentOverrides((current) => ({
      ...current,
      [groupKey]: payments,
    }));

    const allocatedPayments = allocatePaymentsToStays(selectedStays, payments);
    const selectedIds = new Set(selectedStays.map((stay) => stay.id));

    selectedStays.forEach((stay) => {
      queueUnsavedCheckInPayments(
        stay.id,
        stay.payments,
        allocatedPayments.get(stay.id) ?? [],
        stage,
      );
    });

    setStays((current) =>
      current.map((stay) => {
        if (!selectedIds.has(stay.id)) return stay;

        const nextPayments = allocatedPayments.get(stay.id) ?? [];
        const paid = paymentTotal(nextPayments);
        const isPaid = paid >= stayTotalDue(stay) && stayTotalDue(stay) > 0;

        return {
          ...stay,
          paid,
          payments: nextPayments,
          checklist: {
            ...stay.checklist,
            paymentCollectedAtCheckIn:
              stage === "check-in" && isPaid
                ? true
                : stay.checklist.paymentCollectedAtCheckIn && isPaid,
            paymentDeferredToCheckOut: isPaid
              ? false
              : stay.checklist.paymentDeferredToCheckOut,
            paymentClosedAtCheckOut:
              stage === "check-out" && isPaid
                ? true
                : stay.checklist.paymentClosedAtCheckOut && isPaid,
          },
        };
      }),
    );
  }

  function collectGroupCheckInBalance(
    groupKey: string,
    selectedStays: Stay[],
    payments: PaymentRecord[],
  ) {
    const nextPayments = paymentsWithFallbackForGroupBalance(
      selectedStays,
      payments,
      "check-in",
    );

    updateGroupPayments(groupKey, selectedStays, nextPayments, "check-in");
  }

  function deferGroupCheckInBalance(selectedStays: Stay[]) {
    const stayIds = selectedStays.map((stay) => stay.id);
    const shouldUnmark = selectedStays.every(
      (stay) => stay.checklist.paymentDeferredToCheckOut,
    );

    patchChecklistMany(stayIds, {
      paymentCollectedAtCheckIn: false,
      paymentDeferredToCheckOut: !shouldUnmark,
    });
  }

  function closeGroupCheckOutBalance(
    groupKey: string,
    selectedStays: Stay[],
    payments: PaymentRecord[],
  ) {
    const nextPayments = paymentsWithFallbackForGroupBalance(
      selectedStays,
      payments,
      "check-out",
    );

    updateGroupPayments(groupKey, selectedStays, nextPayments, "check-out");
  }

  async function checkoutStayApiId(stay: Stay) {
    const directId = numericApiId(stay.backendStayId);
    if (directId) return directId;

    const reservationId = numericApiId(stay.id);
    if (!reservationId) return null;

    const cached = checkoutSnapshots.find(
      (snapshot) => snapshot.reservationId === String(reservationId),
    );
    const cachedId = numericApiId(cached?.stayId);
    if (cachedId) return cachedId;

    const response = await api.checkOut.listInHouse<unknown>();
    const snapshots = apiArray(response)
      .map(mapCheckoutStaySnapshot)
      .filter((snapshot): snapshot is CheckoutStaySnapshot => Boolean(snapshot));
    setCheckoutSnapshots(snapshots);

    const snapshot = snapshots.find(
      (item) => item.reservationId === String(reservationId),
    );
    return numericApiId(snapshot?.stayId);
  }

  function applyCheckoutPaymentUpdatesToState(
    stay: Stay,
    updates: PaymentIdUpdate[],
  ) {
    const nextPayments = applyPaymentIdUpdates(stay.payments, updates);

    setStays((current) =>
      current.map((item) =>
        item.id === stay.id
          ? {
              ...item,
              payments: applyPaymentIdUpdates(item.payments, updates),
            }
          : item,
      ),
    );
    setGroupPaymentOverrides((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, payments]) => [
          key,
          applyPaymentIdUpdates(payments, updates),
        ]),
      ),
    );
    dispatch({
      type: "RES_UPDATE",
      id: stay.id,
      patch: {
        payments: nextPayments,
        paid: paymentTotal(nextPayments),
      },
    });

    return {
      ...stay,
      payments: nextPayments,
      paid: paymentTotal(nextPayments),
    };
  }

  function applyCheckInPaymentUpdatesToState(
    stay: Stay,
    updates: PaymentIdUpdate[],
  ) {
    const nextPayments = applyPaymentIdUpdates(stay.payments, updates);
    const updatedStay = {
      ...stay,
      payments: nextPayments,
      paid: paymentTotal(nextPayments),
    };
    const updatedLocalIds = new Set(updates.map((update) => update.localId));

    setStays((current) =>
      current.map((item) =>
        item.id === stay.id
          ? {
              ...item,
              payments: nextPayments,
              paid: paymentTotal(nextPayments),
            }
          : item,
      ),
    );
    setDirtyCheckInPaymentIds((current) => {
      const currentIds = current[stay.id] ?? [];
      const remainingIds = currentIds.filter((id) => !updatedLocalIds.has(id));
      const next = { ...current };

      if (remainingIds.length > 0) {
        next[stay.id] = remainingIds;
      } else {
        delete next[stay.id];
      }

      return next;
    });

    return updatedStay;
  }

  async function ensureCheckInPaymentsSaved(selectedStays: Stay[]) {
    const updatedStays: Stay[] = [];
    let chargedCredit = false;

    for (const stay of selectedStays) {
      const unsavedPayments = paymentsForFelStage(stay, "check-in").filter(
        (payment) =>
          Number(payment.amount || 0) > 0 &&
          numericApiId(payment.id) === null,
      );

      if (unsavedPayments.length === 0) {
        updatedStays.push(stay);
        continue;
      }

      const reservationId = numericApiId(stay.id);
      const reservationRoomId = numericApiId(stay.reservationRoomId);
      if (!reservationId || !reservationRoomId) {
        toast.error("No se pudieron guardar los abonos de check-in.", {
          description: "Falta el identificador de reserva o habitación en el sistema.",
        });
        return null;
      }

      validateCreditPayments(stay, unsavedPayments);

      const updates: PaymentIdUpdate[] = [];
      for (const payment of unsavedPayments) {
        const response = await api.reservations.createNightPayment<unknown>(
          reservationId,
          {
            id_reservation_room: reservationRoomId,
            night_date: stay.checkIn,
            payments: [paymentPayload(payment)],
            notes:
              payment.reference?.trim() ||
              `Abono guardado para facturacion check-in ${reservationCodeForGuest(stay)}.`,
          },
        );
        const backendPayment = reservationPaymentFromResponse(response);

        if (!backendPayment) {
          throw new Error(
            "El sistema guardó el abono, pero no devolvió el identificador del pago.",
          );
        }

        updates.push({
          localId: payment.id,
          backendId: backendPayment.id,
          backendPaymentType: backendPayment.backendPaymentType,
          isInvoiced: backendPayment.isInvoiced,
          invoiceId: backendPayment.invoiceId,
          invoicedAmount: backendPayment.invoicedAmount,
          pendingToInvoiceAmount: backendPayment.pendingToInvoiceAmount,
          invoicedAt: backendPayment.invoicedAt,
        });
      }

      chargedCredit =
        (await syncCreditChargeForPayments(
          stay,
          unsavedPayments,
          "CheckIn",
          numericApiId(stay.backendStayId) ?? reservationId,
        )) || chargedCredit;
      updatedStays.push(applyCheckInPaymentUpdatesToState(stay, updates));
    }

    if (chargedCredit) {
      await refreshApiState(["creditAccounts"], { force: true });
    }

    return updatedStays;
  }

  async function saveInHouseNightPayment(stayId: string, payment: PaymentRecord) {
    const amount = Number(payment.amount || 0);
    if (amount <= 0) return;

    const stay = stays.find((item) => item.id === stayId);
    if (!stay) {
      toast.error("No se pudo guardar el pago durante estadía.", {
        description: "La estadía ya no está disponible en pantalla.",
      });
      return;
    }

    if (numericApiId(payment.id) !== null || payment.backendPaymentId || payment.backendPaymentType) {
      return;
    }

    const reservationId = numericApiId(stay.id);
    const reservationRoomId = numericApiId(stay.reservationRoomId);
    if (!reservationId || !reservationRoomId) {
      toast.error("No se pudo guardar el pago durante estadía.", {
        description: "Falta el identificador de reserva o habitación en el sistema.",
      });
      return;
    }

    setSavingCheckInPaymentIds((current) => {
      const next = new Set(current);
      next.add(stay.id);
      return next;
    });

    try {
      validateCreditPayments(stay, [payment]);

      const response = await api.reservations.createNightPayment<unknown>(
        reservationId,
        {
          id_reservation_room: reservationRoomId,
          night_date: payment.date || stay.checkIn,
          payments: [paymentPayload({ ...payment, stage: "check-in" })],
          notes:
            payment.reference?.trim() ||
            `Pago durante estadía registrado para ${reservationCodeForGuest(stay)}.`,
        },
      );
      const backendPayment = reservationPaymentFromResponse(response);

      if (!backendPayment) {
        throw new Error(
          "El sistema guardó el pago, pero no devolvió el identificador del pago.",
        );
      }

      const updatedStay = applyCheckInPaymentUpdatesToState(stay, [
        {
          localId: payment.id,
          backendId: backendPayment.id,
          backendPaymentType: backendPayment.backendPaymentType,
          isInvoiced: backendPayment.isInvoiced,
          invoiceId: backendPayment.invoiceId,
          invoicedAmount: backendPayment.invoicedAmount,
          pendingToInvoiceAmount: backendPayment.pendingToInvoiceAmount,
          invoicedAt: backendPayment.invoicedAt,
        },
      ]);

      const chargedCredit = await syncCreditChargeForPayments(
        updatedStay,
        [payment],
        "CheckIn",
        numericApiId(updatedStay.backendStayId) ?? reservationId,
      );
      if (chargedCredit) {
        await refreshApiState(["creditAccounts"], { force: true });
      }

      toast.success("Pago durante estadía guardado.", {
        description: `${stay.guestName} · Habitación ${stay.roomNumber}`,
      });
    } catch (error) {
      toast.error("No se pudo guardar el pago durante estadía.", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setSavingCheckInPaymentIds((current) => {
        const next = new Set(current);
        next.delete(stay.id);
        return next;
      });
    }
  }

  async function ensureCheckoutPaymentsSaved(selectedStays: Stay[]) {
    const updatedStays: Stay[] = [];
    let chargedCredit = false;

    for (const stay of selectedStays) {
      const unsavedPayments = paymentsForFelStage(stay, "check-out").filter(
        (payment) => numericApiId(payment.id) === null && Number(payment.amount || 0) > 0,
      );

      if (unsavedPayments.length === 0) {
        updatedStays.push(stay);
        continue;
      }

      const stayId = await checkoutStayApiId(stay);
      if (!stayId) {
        toast.error("No se pudo guardar el pago de checkout.", {
          description: "El sistema no devolvió el identificador de la estadía.",
        });
        return null;
      }
      validateCreditPayments(stay, unsavedPayments);

      const response = await api.checkOut.closePayment<unknown>(stayId, {
        payments: unsavedPayments.map(paymentPayload),
        notes: `Pago guardado para facturacion checkout ${reservationCodeForGuest(stay)}.`,
      });
      chargedCredit =
        (await syncCreditChargeForPayments(
          stay,
          unsavedPayments,
          "CheckOut",
          stayId,
        )) || chargedCredit;
      const references = checkoutPaymentReferencesFromResponse(response);
      let updatedStay = stay;

      if (references.length >= unsavedPayments.length) {
        const updates = unsavedPayments.map((payment, index) => ({
          localId: payment.id,
          backendId: references[index]!.id,
          backendPaymentType: "stay" as const,
        }));
        updatedStay = applyCheckoutPaymentUpdatesToState(stay, updates);
      } else {
        const snapshots = await loadCheckoutSnapshots({ force: true });
        const snapshot = snapshots?.find(
          (item) => numericApiId(item.stayId) === stayId,
        );
        if (!snapshot) {
          toast.error("El pago se envió, pero no se pudo actualizar la estadía.", {
            description: "Recarga la pantalla antes de volver a intentar.",
          });
          return null;
        }
        const payments = reconcileStagePayments(
          stay.payments,
          snapshot.payments,
          "check-out",
        );
        setStays((current) =>
          current.map((item) =>
            item.id === stay.id
              ? { ...item, payments, paid: paymentTotal(payments) }
              : item,
          ),
        );
        updatedStay = {
          ...stay,
          payments,
          paid: paymentTotal(payments),
        };
      }

      updatedStays.push({
        ...updatedStay,
        backendStayId: String(stayId),
      });
    }

    if (chargedCredit) {
      await refreshApiState(["creditAccounts"], { force: true });
    }

    return updatedStays;
  }

  async function loadStayInvoiceSupportData(target: StayInvoiceTarget) {
    setInvoiceLoading(true);

    const [conceptsResult, remainingResult] = await Promise.allSettled([
      api.invoiceConcepts.list<unknown[]>(),
      api.invoices.getRemaining<unknown>(),
    ]);

    if (conceptsResult.status === "fulfilled") {
      const concepts = apiArray(conceptsResult.value)
        .map(mapInvoiceConceptOption)
        .filter((concept): concept is InvoiceConceptOption => Boolean(concept));
      const serviceConcept = invoiceConceptForItemType(
        concepts,
        INVOICE_ITEM_TYPES.SERVICIO,
      );

      setInvoiceConcepts(concepts);

      if (serviceConcept) {
        setInvoiceForm((current) =>
          current
            ? {
                ...current,
                conceptId: current.conceptId ? current.conceptId : String(serviceConcept.id),
                itemType: serviceConcept.itemType as InvoiceItemType,
              }
            : current,
        );
      }
    } else {
      setInvoiceConcepts([]);
      toast.error("No se pudieron cargar los conceptos de factura.", {
        description: getApiErrorMessage(conceptsResult.reason),
      });
    }

    if (remainingResult.status === "fulfilled") {
      setInvoiceRemaining(invoiceRemainingSummary(remainingResult.value));
    } else {
      setInvoiceRemaining(null);
      toast.error("No se pudo consultar el bolson de facturas.", {
        description: getApiErrorMessage(remainingResult.reason),
      });
    }

    setInvoiceLoading(false);
  }

  function openStayInvoice(
    target: StayInvoiceTarget,
    preferredPaymentIds?: string[],
  ) {
    const dispatches = dispatchesForFelStage(felDispatches, target.key, target.stage);
    const availableAmount = targetInvoiceAvailableAmount(target, dispatches);
    const invoiceablePayments = invoiceablePaymentsForStage(target.payments, dispatches);
    const invoiceableMinibar =
      target.stage === "check-out"
        ? invoiceableMinibarCharges(target.minibarCharges, dispatches)
        : [];

    if (availableAmount <= 0) {
      toast.info("No hay monto pendiente para facturar en esta etapa.");
      return;
    }

    if (invoiceablePayments.length === 0 && invoiceableMinibar.length === 0) {
      toast.error("No hay pagos guardados para facturar.", {
        description: "Guarda el pago primero o genera comprobante sin factura.",
      });
      return;
    }

    setInvoiceTarget(target);
    setInvoiceNitLookupStatus("idle");
    setIssuedInvoiceResponse(null);
    setInvoiceForm(
      defaultStayInvoiceForm(
        target,
        guests,
        invoiceConcepts,
        dispatches,
        preferredPaymentIds,
      ),
    );
    void loadStayInvoiceSupportData(target);
  }

  function closeStayInvoice(open: boolean) {
    if (open || invoiceSubmitting) return;
    setInvoiceTarget(null);
    setInvoiceForm(null);
    setInvoiceNitLookupStatus("idle");
    setIssuedInvoiceResponse(null);
  }

  function updateStayInvoiceForm(patch: Partial<StayInvoiceForm>) {
    setInvoiceForm((current) => (current ? { ...current, ...patch } : current));
  }

  async function lookupStayInvoiceNitInfo(options: { silent?: boolean; taxIdOverride?: string } = {}) {
    if (!invoiceForm) return;
    const taxId = normalizeNitForLookup(options.taxIdOverride ?? invoiceForm.taxId);
    if (!taxId || taxId === "CF") {
      updateStayInvoiceForm({ name: "CONSUMIDOR FINAL" });
      setInvoiceNitLookupStatus("idle");
      return null;
    }

    setInvoiceNitLookupStatus("loading");
    try {
      const response = await api.invoices.getNitInfo<unknown>(taxId);
      const info = invoiceNitInfo(response);
      if (!info.name) {
        setInvoiceNitLookupStatus("not-found");
        if (!options.silent) {
          toast.warning("No se encontró nombre para ese NIT", {
            description: "Puedes escribir el nombre del receptor manualmente.",
          });
        }
        return;
      }
      setInvoiceNitLookupStatus("found");
      updateStayInvoiceForm({
        taxId,
        name: info.name,
        address: info.address || invoiceForm.address,
        city: info.city || invoiceForm.city,
        state: info.state || invoiceForm.state,
      });
      if (!options.silent) {
        toast.success("Datos fiscales cargados", { description: `${taxId} · ${info.name}` });
      }
    } catch (error) {
      setInvoiceNitLookupStatus("error");
      if (!options.silent) {
        toast.error("No se pudo consultar el NIT", {
          description: getApiErrorMessage(error),
        });
      }
    }
  }

  function toggleStayInvoicePayment(payment: PaymentRecord, checked: boolean) {
    if (!invoiceTarget) return;

    setInvoiceForm((current) => {
      if (!current) return current;

      const paymentKey = paymentRecordKey(payment);
      const selectedIds = new Set(current.selectedPaymentIds);
      if (checked) {
        selectedIds.add(paymentKey);
      } else {
        selectedIds.delete(paymentKey);
      }

      const selectedPaymentIds = Array.from(selectedIds);
      const dispatches = dispatchesForFelStage(
        felDispatches,
        invoiceTarget.key,
        invoiceTarget.stage,
      );
      const selectedPayments = invoiceablePaymentsForStage(
        invoiceTarget.payments,
        dispatches,
      ).filter((candidate) =>
        selectedIds.has(paymentRecordKey(candidate)),
      );
      const selectedMinibarTotal =
        invoiceTarget.stage === "check-out"
          ? minibarChargeTotal(
              invoiceableMinibarCharges(invoiceTarget.minibarCharges, dispatches),
            )
          : 0;

      return {
        ...current,
        selectedPaymentIds,
        amountToInvoice: String(
          roundCurrency(
            invoiceablePaymentTotal(selectedPayments, dispatches) +
              selectedMinibarTotal,
          ),
        ),
      };
    });
  }

  async function invoiceSourceIdForTarget(
    target: StayInvoiceTarget,
    sourceModule: string,
  ) {
    const primaryReservationId = numericApiId(target.stays[0]?.id);
    const primaryStayId = numericApiId(target.stays[0]?.backendStayId);

    if (sourceModule === INVOICE_SOURCE_MODULES.RESERVATION) {
      return primaryReservationId;
    }

    if (primaryStayId) {
      return primaryStayId;
    }

    if (!primaryReservationId) return null;

    try {
      const response = await api.checkOut.listInHouse<unknown>();
      const stay = apiArray(response).find((item) => {
        const record = apiRecord(item);
        return apiNumber(record, ["id_reservation", "idReservation", "reservation_id"]) === primaryReservationId;
      });
      const stayId = apiNumber(apiRecord(stay), ["id_stay", "idStay", "stay_id", "id"]);
      return stayId ?? null;
    } catch {
      return null;
    }
  }

  async function issueStayInvoice() {
    if (!invoiceTarget || !invoiceForm) return;

    const dispatches = dispatchesForFelStage(
      felDispatches,
      invoiceTarget.key,
      invoiceTarget.stage,
    );
    const selectedPaymentIds = new Set(invoiceForm.selectedPaymentIds);
    const selectedPayments = invoiceablePaymentsForStage(
      invoiceTarget.payments,
      dispatches,
    ).filter((payment) => selectedPaymentIds.has(paymentRecordKey(payment)));
    const selectedPaymentTotal = invoiceablePaymentTotal(selectedPayments, dispatches);
    const selectedMinibarCharges =
      invoiceTarget.stage === "check-out"
        ? invoiceableMinibarCharges(invoiceTarget.minibarCharges, dispatches)
        : [];
    const selectedMinibarTotal = minibarChargeTotal(selectedMinibarCharges);
    const selectedAvailableAmount = roundCurrency(selectedPaymentTotal + selectedMinibarTotal);
    const amountToInvoice = roundCurrency(Number(invoiceForm.amountToInvoice));
    const availableAmount = targetInvoiceAvailableAmount(invoiceTarget, dispatches);
    const guestId = numericApiId(invoiceTarget.stays[0]?.guestId);
    const taxId = invoiceForm.taxId.trim().toUpperCase() || "CF";
    const buyerName = invoiceForm.name.trim();
    const buyerNameForPayload = invoiceForm.useCustomerTaxInfo
      ? buyerName || (taxId === "CF" ? "CONSUMIDOR FINAL" : " ")
      : taxId === "CF"
        ? "CONSUMIDOR FINAL"
        : buyerName || " ";
    const description = invoiceForm.description.trim();

    const itemTypeForPayload =
      selectedPayments.length === 0 && selectedMinibarCharges.length > 0
        ? INVOICE_ITEM_TYPES.BIEN
        : INVOICE_ITEM_TYPES.SERVICIO;
    const conceptId =
      invoiceConceptForItemType(invoiceConcepts, itemTypeForPayload)?.id ??
      numericApiId(invoiceForm.conceptId);

    if (!conceptId) {
      toast.error(
        itemTypeForPayload === INVOICE_ITEM_TYPES.BIEN
          ? "No hay concepto activo de factura para bienes."
          : "No hay concepto activo de factura para servicios.",
      );
      return;
    }

    if (!description) {
      toast.error("Completa la descripcion de la factura.");
      return;
    }

    if (!Number.isFinite(amountToInvoice) || amountToInvoice <= 0) {
      toast.error("El monto a facturar debe ser mayor a cero.");
      return;
    }

    if (Math.abs(amountToInvoice - selectedAvailableAmount) > 0.01) {
      toast.error("El monto debe coincidir exactamente con lo seleccionado.", {
        description: `Total seleccionado: ${money(selectedAvailableAmount)}.`,
      });
      return;
    }

    if (selectedPayments.length === 0 && selectedMinibarCharges.length === 0) {
      toast.error("Selecciona al menos un pago o consumo guardado para facturar.");
      return;
    }

    const reservationPaymentIds: number[] = [];
    const stayPaymentIds: number[] = [];
    const minibarReviewDetailIds = selectedMinibarCharges
      .map((charge) => numericApiId(charge.id))
      .filter((id): id is number => id !== null);
    const selectedBackendTypes = new Set(
      selectedPayments.map((payment) => paymentBackendType(payment, invoiceTarget.stage)),
    );

    if (selectedBackendTypes.has("event")) {
      toast.error("Este pago pertenece a Eventos y no puede facturarse desde recepción.");
      return;
    }

    selectedPayments.forEach((payment) => {
      const id = numericApiId(payment.id);
      if (!id) return;

      const backendType = paymentBackendType(payment, invoiceTarget.stage);
      if (backendType === "stay") {
        stayPaymentIds.push(id);
      } else if (backendType === "reservation") {
        reservationPaymentIds.push(id);
      }
    });

    const hasStayPayments = stayPaymentIds.length > 0;
    const sourceModule =
      invoiceTarget.stage === "check-out"
        ? INVOICE_SOURCE_MODULES.CHECK_OUT
        : hasStayPayments
          ? INVOICE_SOURCE_MODULES.CHECK_IN
          : reservationPaymentIds.length > 0
            ? INVOICE_SOURCE_MODULES.RESERVATION
            : INVOICE_SOURCE_MODULES.MINIBAR;
    setInvoiceSubmitting(true);
    const sourceId = await invoiceSourceIdForTarget(invoiceTarget, sourceModule);

    if (!sourceId) {
      setInvoiceSubmitting(false);
      toast.error("No se encontro el identificador del origen para facturar.");
      return;
    }

    const payload: IssueInvoiceModel = {
      source_module: sourceModule,
      source_id: sourceId,
      id_guest: guestId,
      buyer: {
        taxId,
        name: buyerNameForPayload,
        address: invoiceForm.address.trim() || "CIUDAD",
        city: invoiceForm.city.trim() || "09001",
        district: invoiceForm.district.trim() || "Quetzaltenango",
        state: invoiceForm.state.trim() || "Quetzaltenango",
        country: invoiceForm.country.trim() || "GT",
      },
      format: INVOICE_FORMATS.PDF_XML,
      billing_mode: INVOICE_BILLING_MODES.BY_PAYMENTS,
      reservation_payment_ids: reservationPaymentIds,
      stay_payment_ids: stayPaymentIds,
      event_payment_ids: [],
      minibar_review_detail_ids: minibarReviewDetailIds,
      items: [
        {
          id_invoice_concept: conceptId,
          item_type: itemTypeForPayload,
          description,
          quantity: 1,
          unit_price_with_tax: amountToInvoice,
          notes: invoiceForm.notes.trim() || null,
        },
      ],
    };

    try {
      const response = await api.invoices.issue<unknown>(payload);
      const invoiceId = invoiceIdFromResponse(response);
      const dispatchRecord: FelDispatch = {
        id: `fel-${invoiceTarget.key}-${invoiceTarget.stage}-${Date.now()}`,
        stayId: invoiceTarget.key,
        stage: invoiceTarget.stage,
        kind:
          amountToInvoice >= availableAmount - 0.01
            ? "Pago total"
            : "Abono",
        amount: amountToInvoice,
        paymentIds: selectedPayments.map(paymentRecordKey),
        paymentAllocations: Object.fromEntries(
          selectedPayments.map((payment) => [
            paymentRecordKey(payment),
            Number(payment.amount || 0),
          ]),
        ),
        minibarReviewDetailIds: selectedMinibarCharges.map((charge) => charge.id),
        createdAt: new Date().toLocaleString("es-GT", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        invoiceId,
        buyerName: buyerNameForPayload,
        buyerTaxId: taxId,
        billingMode: INVOICE_BILLING_MODES.BY_PAYMENTS,
      };

      setFelDispatches((current) => [dispatchRecord, ...current]);
      const invoicedPaymentIds = new Set(
        selectedPayments.map(paymentRecordKey),
      );
      const invoicedAt = new Date().toISOString();
      setStays((current) =>
        current.map((stay) =>
          invoiceTarget.stays.some((targetStay) => targetStay.id === stay.id)
            ? {
                ...stay,
                payments: stay.payments.map((payment) =>
                  invoicedPaymentIds.has(paymentRecordKey(payment))
                    ? {
                        ...payment,
                        isInvoiced: true,
                        invoiceId,
                        invoicedAmount: payment.amount,
                        pendingToInvoiceAmount: 0,
                        invoicedAt,
                      }
                    : payment,
                ),
              }
            : stay,
        ),
      );
      setIssuedInvoiceResponse(response);
      toast.success("Factura emitida", {
        description: `${buyerNameForPayload.trim() || "Nombre fiscal SAT"} - ${taxId} - ${money(amountToInvoice)}`,
      });
      setInvoiceSubmitting(false);
      void printOfficialInvoice(invoiceId, response).catch((printError) => {
        toast.warning("La factura se emitió, pero no se pudo abrir automáticamente.", {
          description:
            printError instanceof Error
              ? printError.message
              : "Puedes reimprimirla desde la vista.",
        });
      });
      if (invoiceTarget.stage === "check-out") {
        void api.checkOut.listInHouse<unknown>().then((snapshotResponse) => {
          const snapshots = apiArray(snapshotResponse)
            .map(mapCheckoutStaySnapshot)
            .filter((snapshot): snapshot is CheckoutStaySnapshot => Boolean(snapshot));
          setCheckoutSnapshots(snapshots);
        });
      }
    } catch (error) {
      toast.error("No se pudo emitir la factura.", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  async function sendStayPaymentToFel(
    stayId: string,
    stage: FelPaymentStage,
    preferredPaymentId?: string,
  ) {
    const stay = stays.find((item) => item.id === stayId);
    if (!stay) return;

    const payments = paymentsForInvoiceAction(stay, stage);
    const preferredPayment = preferredPaymentId
      ? payments.find((payment) => payment.id === preferredPaymentId)
      : undefined;
    const preferredPaymentIndex = preferredPayment
      ? payments.findIndex((payment) => payment.id === preferredPayment.id)
      : -1;

    if (preferredPaymentId && !preferredPayment) {
      toast.info("No se encontró el pago seleccionado.", {
        description: "Actualiza la vista y vuelve a intentar facturar el pago.",
      });
      return;
    }

    const amount = preferredPayment
      ? Number(preferredPayment.amount || 0)
      : paymentTotal(payments);
    const minibarCharges =
      stage === "check-out" && !preferredPaymentId
        ? checkoutMinibarChargesForStays([stay])
        : [];
    const minibarAmount = minibarChargeTotal(
      invoiceableMinibarCharges(
        minibarCharges,
        dispatchesForFelStage(felDispatches, stay.id, stage),
      ),
    );
    if (amount <= 0 && minibarAmount <= 0) {
      toast.error("No hay pago para enviar a FEL", {
        description: `Registra un abono o pago total en ${stage === "check-in" ? "check-in" : "check-out"}.`,
      });
      return;
    }

    if (
      canChooseCashInvoicePreference(stay, stage) &&
      cashInvoicePreferenceFor(stay.id, stage, cashInvoicePreferences) === "sin-factura"
    ) {
      toast.info("Pago marcado sin factura", {
        description: "Al ser efectivo y sin factura, no se envía a FEL.",
      });
      return;
    }

    let targetStays: Stay[] | null;
    try {
      targetStays =
        stage === "check-out"
          ? await ensureCheckoutPaymentsSaved([stay])
          : await ensureCheckInPaymentsSaved([stay]);
    } catch (error) {
      toast.error("No se pudieron guardar los pagos antes de facturar.", {
        description: getApiErrorMessage(error),
      });
      return;
    }
    if (!targetStays) return;
    const targetStay = targetStays[0] ?? stay;
    const targetStagePayments = paymentsForInvoiceAction(targetStay, stage);
    const resolvedPreferredPaymentId =
      preferredPaymentIndex >= 0
        ? targetStagePayments[preferredPaymentIndex]?.id
        : undefined;

    openStayInvoice({
      key: targetStay.id,
      stage,
      stays: [targetStay],
      payments: targetStagePayments,
      minibarCharges:
        stage === "check-out" && !preferredPaymentId
          ? checkoutMinibarChargesForStays([targetStay])
          : [],
    }, resolvedPreferredPaymentId ? [resolvedPreferredPaymentId] : undefined);

  }

  async function sendGroupPaymentToFel(
    groupKey: string,
    selectedStays: Stay[],
    payments: PaymentRecord[],
    stage: FelPaymentStage,
  ) {
    const stagePayments = payments.filter(
      (payment) =>
        (stage === "check-out" || payment.stage === stage) &&
        Number(payment.amount || 0) > 0,
    );
    const targetPaymentsFromStays = selectedStays.flatMap((stay) =>
      paymentsForInvoiceAction(stay, stage),
    );
    const paymentsForInvoicePreference = targetPaymentsFromStays.length
      ? targetPaymentsFromStays
      : stagePayments;
    const amount = paymentTotal(targetPaymentsFromStays) || paymentTotal(stagePayments);
    const minibarCharges =
      stage === "check-out" ? checkoutMinibarChargesForStays(selectedStays) : [];
    const minibarAmount = minibarChargeTotal(
      invoiceableMinibarCharges(
        minibarCharges,
        dispatchesForFelStage(felDispatches, groupKey, stage),
      ),
    );

    if (amount <= 0 && minibarAmount <= 0) {
      toast.error("No hay pago para enviar a FEL", {
        description: `Registra un abono o pago total en ${stage === "check-in" ? "check-in" : "check-out"}.`,
      });
      return;
    }

    const allCash =
      paymentsForInvoicePreference.length > 0 &&
      paymentsForInvoicePreference.every((payment) => payment.method === "efectivo");
    if (
      allCash &&
      cashInvoicePreferenceFor(groupKey, stage, cashInvoicePreferences) === "sin-factura"
    ) {
      toast.info("Pago grupal marcado sin factura", {
        description: "Al ser efectivo y sin factura, no se envía a FEL.",
      });
      return;
    }

    let targetStays: Stay[] | null;
    try {
      targetStays =
        stage === "check-out"
          ? await ensureCheckoutPaymentsSaved(selectedStays)
          : await ensureCheckInPaymentsSaved(selectedStays);
    } catch (error) {
      toast.error("No se pudieron guardar los pagos antes de facturar.", {
        description: getApiErrorMessage(error),
      });
      return;
    }
    if (!targetStays) return;
    const targetPayments = targetStays.flatMap((stay) =>
      paymentsForInvoiceAction(stay, stage),
    );
    if (
      targetPayments.some(
        (payment) =>
          Number(payment.amount || 0) > 0 &&
          !numericApiId(payment.id),
      )
    ) {
      toast.info("Guarda los abonos del grupo antes de facturarlos.", {
        description: "Después podrás enviar juntos todos los payment_ids guardados.",
      });
      return;
    }

    openStayInvoice({
      key: groupKey,
      stage,
      stays: targetStays,
      payments: targetPayments,
      minibarCharges:
        stage === "check-out" ? checkoutMinibarChargesForStays(targetStays) : [],
    });

  }

  function handleCheckInPaymentDecision(
    stayId: string,
    decision: "collect-now" | "defer-to-checkout",
  ) {
    const selectedStay = stays.find((stay) => stay.id === stayId);
    if (selectedStay) {
      const nextPayments =
        decision === "collect-now"
          ? selectedStay.checklist.paymentCollectedAtCheckIn
            ? selectedStay.paymentsBeforeCheckIn ?? selectedStay.payments
            : paymentsWithFallbackForBalance(selectedStay, "check-in")
          : selectedStay.checklist.paymentCollectedAtCheckIn
            ? selectedStay.paymentsBeforeCheckIn ?? selectedStay.payments
            : selectedStay.payments;
      const nextPaid =
        decision === "collect-now" && !selectedStay.checklist.paymentCollectedAtCheckIn
          ? paymentTotal(nextPayments)
          : selectedStay.checklist.paymentCollectedAtCheckIn
            ? selectedStay.paidBeforeCheckIn ?? selectedStay.paid
            : selectedStay.paid;
      const isUnmarking =
        decision === "collect-now"
          ? selectedStay.checklist.paymentCollectedAtCheckIn
          : selectedStay.checklist.paymentDeferredToCheckOut;
      if (decision === "collect-now" && !isUnmarking) {
        queueUnsavedCheckInPayments(
          stayId,
          selectedStay.payments,
          nextPayments,
          "check-in",
        );
      }

      // La decisión del saldo se mantiene local mientras recepción prepara el check-in.
      // Se envía al backend en POST /api/check-in/{reservationId}/complete junto con los pagos nuevos.
      // Evitamos llamar payment-decision aquí porque en backend local responde 404 y rompe el flujo.
      void nextPaid;
    }

    setStays((current) =>
      current.map((stay) => {
        if (stay.id !== stayId) return stay;

        if (decision === "collect-now") {
          if (stay.checklist.paymentCollectedAtCheckIn) {
            const restoredPayments = stay.paymentsBeforeCheckIn ?? stay.payments;
            return {
              ...stay,
              paid: stay.paidBeforeCheckIn ?? stay.paid,
              payments: restoredPayments,
              paidBeforeCheckIn: undefined,
              paymentsBeforeCheckIn: undefined,
              checklist: {
                ...stay.checklist,
                paymentCollectedAtCheckIn: false,
                paymentDeferredToCheckOut: false,
              },
            };
          }

          const nextPayments = paymentsWithFallbackForBalance(stay, "check-in");
          return {
            ...stay,
            paidBeforeCheckIn: stay.paidBeforeCheckIn ?? stay.paid,
            paymentsBeforeCheckIn: stay.paymentsBeforeCheckIn ?? stay.payments,
            paid: paymentTotal(nextPayments),
            payments: nextPayments,
            checklist: {
              ...stay.checklist,
              paymentCollectedAtCheckIn: true,
              paymentDeferredToCheckOut: false,
            },
          };
        }

        if (stay.checklist.paymentDeferredToCheckOut) {
          return {
            ...stay,
            checklist: {
              ...stay.checklist,
              paymentCollectedAtCheckIn: false,
              paymentDeferredToCheckOut: false,
            },
          };
        }

        return {
          ...stay,
          paid:
            stay.checklist.paymentCollectedAtCheckIn &&
            stay.paidBeforeCheckIn !== undefined
              ? stay.paidBeforeCheckIn
              : stay.paid,
          payments:
            stay.checklist.paymentCollectedAtCheckIn &&
            stay.paymentsBeforeCheckIn !== undefined
              ? stay.paymentsBeforeCheckIn
              : stay.payments,
          paidBeforeCheckIn: undefined,
          paymentsBeforeCheckIn: undefined,
          checklist: {
            ...stay.checklist,
            paymentCollectedAtCheckIn: false,
            paymentDeferredToCheckOut: true,
          },
        };
      }),
    );
  }

  function undoCheckInPayment(stayId: string) {
    const selectedStay = stays.find((stay) => stay.id === stayId);
    if (selectedStay) {
      dispatch({
        type: "RES_UPDATE",
        id: stayId,
        patch: {
          paid: selectedStay.paidBeforeCheckIn ?? selectedStay.paid,
          payments: selectedStay.paymentsBeforeCheckIn ?? selectedStay.payments,
        },
      });
    }

    setStays((current) =>
      current.map((stay) => {
        if (stay.id !== stayId) return stay;

        return {
          ...stay,
          paid: stay.paidBeforeCheckIn ?? stay.paid,
          payments: stay.paymentsBeforeCheckIn ?? stay.payments,
          paidBeforeCheckIn: undefined,
          paymentsBeforeCheckIn: undefined,
          checklist: {
            ...stay.checklist,
            paymentCollectedAtCheckIn: false,
            paymentDeferredToCheckOut: false,
          },
        };
      }),
    );
  }

  function closePaymentAtCheckOut(stayId: string) {
    const selectedStay = stays.find((stay) => stay.id === stayId);
    if (selectedStay) {
      const shouldUnmark = selectedStay.checklist.paymentClosedAtCheckOut;
      const nextPayments = shouldUnmark
        ? selectedStay.paymentsBeforeCheckOut ?? selectedStay.payments
        : paymentsWithFallbackForBalance(selectedStay, "check-out");
      dispatch({
        type: "RES_UPDATE",
        id: stayId,
        patch: {
          paid: shouldUnmark
            ? selectedStay.paidBeforeCheckOut ?? selectedStay.paid
            : paymentTotal(nextPayments),
          payments: nextPayments,
        },
      });
    }

    setStays((current) =>
      current.map((stay) => {
        if (stay.id !== stayId) return stay;

        if (stay.checklist.paymentClosedAtCheckOut) {
          return {
            ...stay,
            paid: stay.paidBeforeCheckOut ?? stay.paid,
            payments: stay.paymentsBeforeCheckOut ?? stay.payments,
            paidBeforeCheckOut: undefined,
            paymentsBeforeCheckOut: undefined,
            checklist: {
              ...stay.checklist,
              paymentClosedAtCheckOut: false,
            },
          };
        }

        const nextPayments = paymentsWithFallbackForBalance(stay, "check-out");

        return {
          ...stay,
          paidBeforeCheckOut: stay.paidBeforeCheckOut ?? stay.paid,
          paymentsBeforeCheckOut: stay.paymentsBeforeCheckOut ?? stay.payments,
          paid: paymentTotal(nextPayments),
          payments: nextPayments,
          checklist: {
            ...stay.checklist,
            paymentClosedAtCheckOut: true,
          },
        };
      }),
    );
  }

  function markCheckInBasics(stayIds: string[]) {
    const ids = new Set(stayIds);
    setStays((current) => {
      const selected = current.filter((stay) => ids.has(stay.id));
      const shouldUnmark = selected.every(
        (stay) =>
          stay.checklist.key &&
          stay.checklist.remote,
      );

      return current.map((stay) =>
        ids.has(stay.id)
          ? {
            ...stay,
            checklist: {
              ...stay.checklist,
              key: !shouldUnmark,
              remote: !shouldUnmark,
              },
            }
          : stay,
      );
    });
  }

  function markCheckOutBasics(stayIds: string[]) {
    const ids = new Set(stayIds);
    setStays((current) => {
      const selected = current.filter((stay) => ids.has(stay.id));
      const shouldUnmark = selected.every(
        (stay) =>
          stay.checklist.keyReturned &&
          stay.checklist.remoteReturned &&
          stay.checklist.chargesReviewed &&
          stay.checklist.roomInspection,
      );

      return current.map((stay) =>
        ids.has(stay.id)
          ? {
              ...stay,
              checklist: {
                ...stay.checklist,
                keyReturned: !shouldUnmark,
                remoteReturned: !shouldUnmark,
                chargesReviewed: !shouldUnmark,
                roomInspection: !shouldUnmark,
              },
            }
          : stay,
      );
    });
  }

  function applyCheckInPaymentDecisionToMany(
    stayIds: string[],
    decision: "collect-now" | "defer-to-checkout",
  ) {
    const ids = new Set(stayIds);
    const selectedBeforeChange = stays.filter((stay) => ids.has(stay.id));
    const shouldUnmarkBeforeChange = selectedBeforeChange.every((stay) =>
      decision === "collect-now"
        ? stay.checklist.paymentCollectedAtCheckIn
        : stay.checklist.paymentDeferredToCheckOut,
    );

    selectedBeforeChange.forEach((stay) => {
      let nextPayments = stay.payments;
      let nextPaid = stay.paid;

      if (shouldUnmarkBeforeChange) {
        nextPayments =
          stay.checklist.paymentCollectedAtCheckIn && stay.paymentsBeforeCheckIn
            ? stay.paymentsBeforeCheckIn
            : stay.payments;
        nextPaid =
          stay.checklist.paymentCollectedAtCheckIn && stay.paidBeforeCheckIn !== undefined
            ? stay.paidBeforeCheckIn
            : stay.paid;
      } else if (decision === "collect-now" && !stayIsPaidInFull(stay)) {
        nextPayments = paymentsWithFallbackForBalance(stay, "check-in");
        nextPaid = paymentTotal(nextPayments);
      } else if (decision === "defer-to-checkout" && stay.checklist.paymentCollectedAtCheckIn) {
        nextPayments = stay.paymentsBeforeCheckIn ?? stay.payments;
        nextPaid = stay.paidBeforeCheckIn ?? stay.paid;
      }

      if (shouldUnmarkBeforeChange) {
        dispatch({
          type: "RES_UPDATE",
          id: stay.id,
          patch: {
            paid: nextPaid,
            payments: nextPayments,
          },
        });
        return;
      }

      if (decision === "collect-now") {
        queueUnsavedCheckInPayments(
          stay.id,
          stay.payments,
          nextPayments,
          "check-in",
        );
      }

      dispatch({
        type: "RES_UPDATE",
        id: stay.id,
        patch: {
          paid: nextPaid,
          payments: nextPayments,
        },
      });
    });

    setStays((current) => {
      const selected = current.filter((stay) => ids.has(stay.id));
      const shouldUnmark = selected.every((stay) =>
        decision === "collect-now"
          ? stay.checklist.paymentCollectedAtCheckIn
          : stay.checklist.paymentDeferredToCheckOut,
      );

      return current.map((stay) => {
        if (!ids.has(stay.id)) return stay;

        if (shouldUnmark) {
          return {
            ...stay,
            paid:
              stay.checklist.paymentCollectedAtCheckIn &&
              stay.paidBeforeCheckIn !== undefined
                ? stay.paidBeforeCheckIn
                : stay.paid,
            payments:
              stay.checklist.paymentCollectedAtCheckIn &&
              stay.paymentsBeforeCheckIn !== undefined
                ? stay.paymentsBeforeCheckIn
                : stay.payments,
            paidBeforeCheckIn:
              stay.checklist.paymentCollectedAtCheckIn
                ? undefined
                : stay.paidBeforeCheckIn,
            paymentsBeforeCheckIn:
              stay.checklist.paymentCollectedAtCheckIn
                ? undefined
                : stay.paymentsBeforeCheckIn,
            checklist: {
              ...stay.checklist,
              paymentCollectedAtCheckIn: false,
              paymentDeferredToCheckOut: false,
            },
          };
        }

        if (stayIsPaidInFull(stay) && !stay.checklist.paymentCollectedAtCheckIn) {
          return stay;
        }

        if (decision === "collect-now") {
          const nextPayments = paymentsWithFallbackForBalance(stay, "check-in");
          return {
            ...stay,
            paidBeforeCheckIn: stay.paidBeforeCheckIn ?? stay.paid,
            paymentsBeforeCheckIn: stay.paymentsBeforeCheckIn ?? stay.payments,
            paid: paymentTotal(nextPayments),
            payments: nextPayments,
            checklist: {
              ...stay.checklist,
              paymentCollectedAtCheckIn: true,
              paymentDeferredToCheckOut: false,
            },
          };
        }

        return {
          ...stay,
          paid:
            stay.checklist.paymentCollectedAtCheckIn &&
            stay.paidBeforeCheckIn !== undefined
              ? stay.paidBeforeCheckIn
              : stay.paid,
          payments:
            stay.checklist.paymentCollectedAtCheckIn &&
            stay.paymentsBeforeCheckIn !== undefined
              ? stay.paymentsBeforeCheckIn
              : stay.payments,
          paidBeforeCheckIn: undefined,
          paymentsBeforeCheckIn: undefined,
          checklist: {
            ...stay.checklist,
            paymentCollectedAtCheckIn: false,
            paymentDeferredToCheckOut: true,
          },
        };
      });
    });
  }

  function closePaymentAtCheckOutForMany(stayIds: string[]) {
    const ids = new Set(stayIds);
    const selectedBeforeChange = stays.filter((stay) => ids.has(stay.id));
    const shouldUnmarkBeforeChange = selectedBeforeChange.every(
      (stay) => stay.checklist.paymentClosedAtCheckOut,
    );

    selectedBeforeChange.forEach((stay) => {
      const nextPayments = shouldUnmarkBeforeChange
        ? stay.paymentsBeforeCheckOut ?? stay.payments
        : paymentsWithFallbackForBalance(stay, "check-out");
      dispatch({
        type: "RES_UPDATE",
        id: stay.id,
        patch: {
          paid: shouldUnmarkBeforeChange
            ? stay.paidBeforeCheckOut ?? stay.paid
            : paymentTotal(nextPayments),
          payments: nextPayments,
        },
      });
    });

    setStays((current) => {
      const selected = current.filter((stay) => ids.has(stay.id));
      const shouldUnmark = selected.every(
        (stay) => stay.checklist.paymentClosedAtCheckOut,
      );

      return current.map((stay) => {
        if (!ids.has(stay.id)) return stay;

        if (shouldUnmark) {
          return {
            ...stay,
            paid:
              stay.checklist.paymentClosedAtCheckOut &&
              stay.paidBeforeCheckOut !== undefined
                ? stay.paidBeforeCheckOut
                : stay.paid,
            payments:
              stay.checklist.paymentClosedAtCheckOut &&
              stay.paymentsBeforeCheckOut !== undefined
                ? stay.paymentsBeforeCheckOut
                : stay.payments,
            paidBeforeCheckOut:
              stay.checklist.paymentClosedAtCheckOut
                ? undefined
                : stay.paidBeforeCheckOut,
            paymentsBeforeCheckOut:
              stay.checklist.paymentClosedAtCheckOut
                ? undefined
                : stay.paymentsBeforeCheckOut,
            checklist: {
              ...stay.checklist,
              paymentClosedAtCheckOut: false,
            },
          };
        }

        if (stayIsPaidInFull(stay) && !stay.checklist.paymentClosedAtCheckOut) {
          return stay;
        }

        const nextPayments = paymentsWithFallbackForBalance(stay, "check-out");
        return {
          ...stay,
          paidBeforeCheckOut: stay.paidBeforeCheckOut ?? stay.paid,
          paymentsBeforeCheckOut: stay.paymentsBeforeCheckOut ?? stay.payments,
          paid: paymentTotal(nextPayments),
          payments: nextPayments,
          checklist: {
            ...stay.checklist,
            paymentClosedAtCheckOut: true,
          },
        };
      });
    });
  }

  async function completeCheckIn(stayId: string) {
    const stay = stays.find((item) => item.id === stayId);
    if (!stay) return;
    if (!stayReadyForCheckIn(stay, cashInvoicePreferences)) return;
    const reservationId = numericApiId(stay.id);
    if (!reservationId) {
      toast.error("No se encontró el identificador de la reservación.");
      return;
    }

    const pendingPayments = saveableCheckInPayments(
      stay,
      dirtyCheckInPaymentIds,
    );
    validateCreditPayments(stay, pendingPayments);
    setSavingCheckInPaymentIds((current) => new Set(current).add(stay.id));

    try {
      const response = await api.checkIn.complete<unknown>(reservationId, {
        inguat_book_reviewed: checkInInguatHandled(
          stay,
          cashInvoicePreferences,
        ),
        collect_balance_at_checkout:
          stay.checklist.paymentDeferredToCheckOut,
        tv_control_delivered: stay.checklist.remote,
        balance_collected:
          stayIsPaidInFull(stay) ||
          stay.checklist.paymentCollectedAtCheckIn,
        key_delivered: stay.checklist.key,
        breakfast_ticket_delivered: true,
        payments: pendingPayments.length
          ? pendingPayments.map(paymentPayload)
          : undefined,
        notes: "Check-in completado desde recepción.",
      });

      const responseStayId =
        apiNumberFromResponse(response, ["id_stay", "idStay", "stay_id"]) ??
        numericApiId(stay.backendStayId) ??
        undefined;
      const chargedCredit = await syncCreditChargeForPayments(
        stay,
        pendingPayments,
        "CheckIn",
        responseStayId,
      );

      const snapshots = await loadCheckoutSnapshots({ force: true });
      const snapshot = snapshots?.find(
        (item) => item.reservationId === String(reservationId),
      );

      setStays((current) =>
        current.map((item) => {
          if (item.id !== stayId) return item;
          const reconciledPayments = snapshot
            ? reconcileStagePayments(
                item.payments,
                snapshot.payments,
                "check-in",
              )
            : item.payments;
          const payments = snapshot
            ? mergeBackendPayments(reconciledPayments, snapshot.payments)
            : reconciledPayments;

          return {
            ...item,
            backendStayId: snapshot?.stayId ?? item.backendStayId,
            status: "En habitación",
            payments,
            paid: snapshot?.paidAmount ?? paymentTotal(payments),
          };
        }),
      );
      setRooms((current) =>
        current.map((room) =>
          room.number === stay.roomNumber
            ? { ...room, status: "Ocupada" }
            : room,
        ),
      );
      setDirtyCheckInPaymentIds((current) => {
        const next = { ...current };
        delete next[stay.id];
        return next;
      });
      await refreshApiState(
        chargedCredit
          ? ["reservations", "rooms", "creditAccounts"]
          : ["reservations", "rooms"],
        { force: true },
      );
      setActiveTab("checkout");
      toast.success("Check-in completado", {
        description: `${stay.guestName} · Habitación ${stay.roomNumber}`,
      });
    } catch (error) {
      toast.error("No se pudo completar el check-in", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setSavingCheckInPaymentIds((current) => {
        const next = new Set(current);
        next.delete(stay.id);
        return next;
      });
    }
  }

  async function completeCheckInMany(
    stayIds: string[],
    groupKey: string,
    groupPayments: PaymentRecord[],
  ) {
    const ids = new Set(stayIds);
    const selectedStays = stays.filter((stay) => ids.has(stay.id));
    if (
      !groupReadyForCheckIn(
        groupKey,
        selectedStays,
        groupPayments,
        cashInvoicePreferences,
      )
    ) {
      return;
    }

    const staysByReservation = new Map<number, Stay[]>();
    selectedStays.forEach((stay) => {
      const reservationId = numericApiId(stay.id);
      if (!reservationId) return;
      staysByReservation.set(reservationId, [
        ...(staysByReservation.get(reservationId) ?? []),
        stay,
      ]);
    });
    if (staysByReservation.size === 0) {
      toast.error("No se encontraron identificadores de reservación válidos.");
      return;
    }

    setSavingCheckInPaymentIds((current) => {
      const next = new Set(current);
      stayIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      let chargedCredit = false;
      for (const [reservationId, reservationStays] of staysByReservation) {
        reservationStays.forEach((stay) =>
          validateCreditPayments(
            stay,
            saveableCheckInPayments(stay, dirtyCheckInPaymentIds),
          ),
        );
        const pendingPayments = reservationStays.flatMap((stay) =>
          saveableCheckInPayments(stay, dirtyCheckInPaymentIds),
        );
        const response = await api.checkIn.complete<unknown>(reservationId, {
          inguat_book_reviewed: reservationStays.every((stay) =>
            checkInInguatHandled(stay, cashInvoicePreferences),
          ),
          collect_balance_at_checkout: reservationStays.some(
            (stay) => stay.checklist.paymentDeferredToCheckOut,
          ),
          tv_control_delivered: reservationStays.every(
            (stay) => stay.checklist.remote,
          ),
          balance_collected: reservationStays.every(stayIsPaidInFull),
          key_delivered: reservationStays.every((stay) => stay.checklist.key),
          breakfast_ticket_delivered: true,
          payments: pendingPayments.length
            ? pendingPayments.map(paymentPayload)
            : undefined,
          notes: "Check-in conjunto completado desde recepción.",
        });
        const responseStayId =
          apiNumberFromResponse(response, ["id_stay", "idStay", "stay_id"]) ??
          reservationId;
        for (const stay of reservationStays) {
          const stayPayments = saveableCheckInPayments(stay, dirtyCheckInPaymentIds);
          chargedCredit =
            (await syncCreditChargeForPayments(
              stay,
              stayPayments,
              "CheckIn",
              responseStayId,
            )) || chargedCredit;
        }
      }

      const snapshots = await loadCheckoutSnapshots({ force: true });
      setStays((current) =>
        current.map((stay) => {
          if (!ids.has(stay.id)) return stay;
          const reservationId = numericApiId(stay.id);
          const snapshot = snapshots?.find(
            (item) => item.reservationId === String(reservationId),
          );
          const reconciledPayments = snapshot
            ? reconcileStagePayments(
                stay.payments,
                snapshot.payments,
                "check-in",
              )
            : stay.payments;
          const payments = snapshot
            ? mergeBackendPayments(reconciledPayments, snapshot.payments)
            : reconciledPayments;
          return {
            ...stay,
            backendStayId: snapshot?.stayId ?? stay.backendStayId,
            status: "En habitación",
            payments,
            paid: snapshot?.paidAmount ?? paymentTotal(payments),
          };
        }),
      );
      const roomNumbers = new Set(
        selectedStays.map((stay) => stay.roomNumber),
      );
      setRooms((current) =>
        current.map((room) =>
          roomNumbers.has(room.number)
            ? { ...room, status: "Ocupada" }
            : room,
        ),
      );
      setDirtyCheckInPaymentIds((current) => {
        const next = { ...current };
        stayIds.forEach((id) => delete next[id]);
        return next;
      });
      await refreshApiState(
        chargedCredit
          ? ["reservations", "rooms", "creditAccounts"]
          : ["reservations", "rooms"],
        { force: true },
      );
      setActiveTab("checkout");
      toast.success("Check-in conjunto completado");
    } catch (error) {
      await loadCheckoutSnapshots({ force: true });
      await refreshApiState(["reservations", "rooms"], { force: true });
      toast.error("No se pudo completar todo el check-in conjunto", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setSavingCheckInPaymentIds((current) => {
        const next = new Set(current);
        stayIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  async function completeCheckOut(stayId: string) {
    const stay = stays.find((item) => item.id === stayId);
    if (!stay) return;
    if (!stayReadyForCheckOut(stay)) return;

    try {
      // El pago final se registra primero en close-payment, tal como exige el
      // contrato de checkout. Solo después se completa la salida.
      const savedStays = await ensureCheckoutPaymentsSaved([stay]);
      const savedStay = savedStays?.[0];
      if (!savedStay) return;
      const backendStayId = await checkoutStayApiId(savedStay);
      if (!backendStayId) {
        toast.error("No se encontró el identificador de la estadía.");
        return;
      }

      await api.checkOut.complete(backendStayId, {
        key_received: savedStay.checklist.keyReturned,
        consumptions_reviewed: savedStay.checklist.chargesReviewed,
        final_balance_pending: stayBalance(savedStay) > 0,
        tv_control_received: savedStay.checklist.remoteReturned,
        room_reviewed: savedStay.checklist.roomInspection,
        notes: "Check-out completado desde recepción.",
      });

      setStays((current) =>
        current.map((item) =>
          item.id === stayId
            ? { ...item, status: "Check-out finalizado" }
            : item,
        ),
      );
      setRooms((current) =>
        current.map((room) =>
          room.number === stay.roomNumber
            ? { ...room, status: "Limpieza" }
            : room,
        ),
      );
      await Promise.all([
        loadCheckoutSnapshots({ force: true }),
        refreshApiState(["reservations", "rooms"], { force: true }),
      ]);
      toast.success("Check-out completado", {
        description: `${stay.guestName} · Habitación ${stay.roomNumber}`,
      });
    } catch (error) {
      toast.error("No se pudo completar el check-out", {
        description: getApiErrorMessage(error),
      });
    }
  }

  async function completeCheckOutMany(
    stayIds: string[],
    groupPayments: PaymentRecord[],
  ) {
    const ids = new Set(stayIds);
    const selectedStays = stays.filter((stay) => ids.has(stay.id));
    if (!groupReadyForCheckOut(selectedStays, groupPayments)) return;

    try {
      const savedStays = await ensureCheckoutPaymentsSaved(selectedStays);
      if (!savedStays) return;
      const uniqueStays = new Map<number, Stay>();
      for (const stay of savedStays) {
        const backendStayId = await checkoutStayApiId(stay);
        if (backendStayId && !uniqueStays.has(backendStayId)) {
          uniqueStays.set(backendStayId, stay);
        }
      }
      if (uniqueStays.size === 0) {
        toast.error("No se encontraron identificadores de estadía válidos.");
        return;
      }

      for (const [backendStayId, stay] of uniqueStays) {
        await api.checkOut.complete(backendStayId, {
          key_received: stay.checklist.keyReturned,
          consumptions_reviewed: stay.checklist.chargesReviewed,
          final_balance_pending: stayBalance(stay) > 0,
          tv_control_received: stay.checklist.remoteReturned,
          room_reviewed: stay.checklist.roomInspection,
          notes: "Check-out conjunto completado desde recepción.",
        });
      }

      setStays((current) =>
        current.map((stay) =>
          ids.has(stay.id)
            ? { ...stay, status: "Check-out finalizado" }
            : stay,
        ),
      );
      const roomNumbers = new Set(
        selectedStays.map((stay) => stay.roomNumber),
      );
      setRooms((current) =>
        current.map((room) =>
          roomNumbers.has(room.number)
            ? { ...room, status: "Limpieza" }
            : room,
        ),
      );
      await Promise.all([
        loadCheckoutSnapshots({ force: true }),
        refreshApiState(["reservations", "rooms"], { force: true }),
      ]);
      toast.success("Check-out conjunto completado");
    } catch (error) {
      await loadCheckoutSnapshots({ force: true });
      await refreshApiState(["reservations", "rooms"], { force: true });
      toast.error("No se pudo completar todo el check-out conjunto", {
        description: getApiErrorMessage(error),
      });
    }
  }

  function markRoomClean(roomNumber: string) {
    const room = storeRooms.find((item) => item.number === roomNumber);
    if (room) {
      dispatch({ type: "ROOM_STATUS", roomId: room.id, status: "disponible" });
    }

    setRooms((current) =>
      current.map((room) =>
        room.number === roomNumber ? { ...room, status: "Disponible" } : room,
      ),
    );
    toast.success(`Habitación ${roomNumber} disponible`, {
      id: ROOM_CLEAN_TOAST_ID,
      duration: 2400,
    });
  }

  function printStay(stay: Stay) {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${stay.code}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #2f2a24; font-size: 12px; }
            .card { border: 1px solid #d8c7ac; border-radius: 18px; overflow: hidden; }
            .header { padding: 18px; background: #fbf5ea; border-bottom: 2px solid #b79263; display: flex; justify-content: space-between; }
            h1 { margin: 0; font-family: Georgia, serif; color: #5d4631; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px; }
            .box { border: 1px solid #eadfce; border-radius: 14px; padding: 12px; background: #fffdf8; }
            .label { color: #8b755f; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
            .value { margin-top: 4px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <h1>Casa Luna Boutique Hotel</h1>
                <div>Resumen operativo de estadía</div>
              </div>
              <div><strong>${stay.code}</strong><br/>${stay.status}</div>
            </div>
            <div class="grid">
              <div class="box"><div class="label">Huésped</div><div class="value">${stay.guestName}</div></div>
              <div class="box"><div class="label">DPI/NIT</div><div class="value">${stay.dpi}</div></div>
              <div class="box"><div class="label">Habitación</div><div class="value">${stay.roomNumber} · ${stay.roomType}</div></div>
              <div class="box"><div class="label">Fechas</div><div class="value">${formatDate(stay.checkIn)} → ${formatDate(stay.checkOut)}</div></div>
              <div class="box"><div class="label">Total estadía</div><div class="value">${money(stay.total)}</div></div>
              <div class="box"><div class="label">Extras</div><div class="value">${money(stay.extraCharges)}</div></div>
              <div class="box"><div class="label">Pagado</div><div class="value">${money(stay.paid)}</div></div>
              <div class="box"><div class="label">Saldo</div><div class="value">${money(stayBalance(stay))}</div></div>
              <div class="box" style="grid-column: 1 / -1;"><div class="label">Desglose de pagos</div><div class="value">${paymentNotes(stay.payments)}</div></div>
            </div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); }</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  const activeInvoiceDispatches = invoiceTarget
    ? dispatchesForFelStage(felDispatches, invoiceTarget.key, invoiceTarget.stage)
    : [];
  const activeInvoiceablePayments = invoiceTarget
    ? invoiceablePaymentsForStage(invoiceTarget.payments, activeInvoiceDispatches)
    : [];
  const activeSavedInvoicePayments = invoiceTarget
    ? invoiceTarget.payments.filter(
        (payment) =>
          Number(payment.amount || 0) > 0 &&
          numericApiId(payment.id) !== null,
      )
    : [];
  const activeInvoiceableMinibarCharges =
    invoiceTarget?.stage === "check-out"
      ? invoiceableMinibarCharges(invoiceTarget.minibarCharges, activeInvoiceDispatches)
      : [];
  const activeSelectedPaymentIds = new Set(invoiceForm?.selectedPaymentIds ?? []);
  const activeSelectedInvoicePayments = activeInvoiceablePayments.filter((payment) =>
    activeSelectedPaymentIds.has(paymentRecordKey(payment)),
  );
  const activeSelectedInvoiceTotal = roundCurrency(
    invoiceablePaymentTotal(activeSelectedInvoicePayments, activeInvoiceDispatches),
  );
  const activeMinibarInvoiceTotal = minibarChargeTotal(activeInvoiceableMinibarCharges);
  const activeInvoiceAvailableAmount = invoiceTarget
    ? targetInvoiceAvailableAmount(invoiceTarget, activeInvoiceDispatches)
    : 0;
  const activeSelectedAvailableAmount = roundCurrency(
    activeSelectedInvoiceTotal + activeMinibarInvoiceTotal,
  );
  const activeInvoiceAmount = invoiceForm
    ? roundCurrency(Number(invoiceForm.amountToInvoice))
    : 0;
  const canIssueStayInvoice =
    Boolean(invoiceTarget && invoiceForm) &&
    !issuedInvoiceResponse &&
    !invoiceLoading &&
    !invoiceSubmitting &&
    Number.isFinite(activeInvoiceAmount) &&
    activeInvoiceAmount > 0 &&
    Math.abs(activeInvoiceAmount - activeSelectedAvailableAmount) <= 0.01 &&
    (activeSelectedInvoicePayments.length > 0 || activeInvoiceableMinibarCharges.length > 0);
  const issuedInvoiceFields = issuedInvoiceResponse
    ? invoiceResponseFields(issuedInvoiceResponse)
    : [];
  const arrivalCancelStays = arrivalCancelTarget?.stays ?? [];
  const arrivalCancelPrimary = arrivalCancelStays[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Check-in / Check-out"
        description="Recibe huéspedes, entrega lo necesario por habitación y deja claro si el saldo se cobró hoy o si se cobrará cuando salgan."
      />

      <QuickGuide
        title="Guía rápida para check-in y check-out"
        description="Usa esta pantalla para recibir huéspedes, revisar saldos, registrar pagos y cerrar salidas con el estado correcto de cada habitación."
        steps={[
          { icon: KeyRound, title: "Recibe al huésped", text: "Busca la reserva, revisa habitación, saldo y datos del cliente antes de entregar la llave." },
          { icon: CreditCard, title: "Registra pagos", text: "Si el cliente abona o paga el saldo, agrega el pago con método, referencia y nota antes de completar el movimiento." },
          { icon: ClipboardCheck, title: "Completa el check-in", text: "Marca INGUAT, llave, control de TV y desayuno según corresponda. La reserva pasará a En habitación." },
          { icon: LogOut, title: "Completa el check-out", text: "Al salir, revisa consumos, recibe llave y control, registra el pago final y cierra la habitación." },
          { icon: Receipt, title: "Facturación", text: "Los pagos pendientes de factura se emitirán desde el botón de facturación cuando el flujo FEL quede confirmado." },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Llegadas pendientes"
          value={arrivals.length}
          helper="Reservas listas para recibir"
          icon={LogIn}
          tone="info"
        />
        <MetricCard
          label="En habitación"
          value={inHouse.length}
          helper="Huéspedes actualmente alojados"
          icon={BedDouble}
          tone="success"
        />
        <MetricCard
          label="Extras pendientes"
          value={money(pendingCheckoutCharges)}
          helper="Snacks, daños u otros cargos"
          icon={Receipt}
          tone="warning"
        />
        <MetricCard
          label="Saldo abierto"
          value={money(deferredBalances)}
          helper="Pendiente de pago durante la estadía"
          icon={AlertTriangle}
          tone={deferredBalances > 0 ? "warning" : "default"}
        />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="pagos-estadia">Pagos durante estadía</TabsTrigger>
          <TabsTrigger value="checkout">Check-out</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" className="space-y-4">
          <Panel
            title="Llegadas listas para check-in"
            description="Las habitaciones del mismo cliente y con la misma fecha de entrada se procesan juntas. Si tienen fechas distintas, aparecen separadas."
            action={
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar huésped, DPI, habitación..."
                  className="pl-9"
                />
              </div>
            }
          >
            <div className="space-y-3">
              {groupedArrivals.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay llegadas pendientes con ese filtro.
                </div>
              ) : (
                groupedArrivals.map((group) => {
                  const groupKey = `checkin|${group.id}`;
                  const groupPayments =
                    groupPaymentOverrides[groupKey] ?? groupPaymentsForStays(group.stays);
                  const groupCreditInfo = creditInfoForStay(group.stays[0]);

                  return (
                    <GuestStayGroup
                      key={groupKey}
                      groupKey={groupKey}
                      stays={group.stays}
                      mode="checkin"
                      expanded={Boolean(expandedGuestGroups[groupKey])}
                      onToggleExpanded={() => toggleGuestGroup(groupKey)}
                      accountExpanded={Boolean(expandedGroupAccounts[groupKey])}
                      onToggleAccountExpanded={() => toggleGroupAccount(groupKey)}
                      expandedStayIds={
                        new Set(
                          group.stays
                            .filter((stay) => expandedStayCards[stay.id])
                            .map((stay) => stay.id),
                        )
                      }
                      onToggleStayExpanded={toggleStayCard}
                      onToggle={toggleChecklist}
                      onCheckInPaymentDecision={handleCheckInPaymentDecision}
                      onClosePaymentAtCheckOut={closePaymentAtCheckOut}
                      onUndoCheckInPayment={undoCheckInPayment}
                      onPaymentsChange={updateStayPayments}
                      savingCheckInPaymentIds={savingCheckInPaymentIds}
                      groupPayments={groupPayments}
                      onGroupPaymentsChange={(payments, stage) =>
                        updateGroupPayments(groupKey, group.stays, payments, stage)
                      }
                      felDispatches={felDispatches}
                      cashInvoicePreferences={cashInvoicePreferences}
                      onSendToFel={sendStayPaymentToFel}
                      onSendGroupToFel={(stage) =>
                        sendGroupPaymentToFel(groupKey, group.stays, groupPayments, stage)
                      }
                      onCompleteCheckIn={completeCheckIn}
                      onCompleteCheckOut={completeCheckOut}
                      onCancelBeforeCheckIn={openArrivalCancelDialog}
                      onPrint={printStay}
                      onSetChecklistMany={setChecklistMany}
                      onMarkCheckInBasics={markCheckInBasics}
                      onCollectGroupCheckInBalance={() =>
                        collectGroupCheckInBalance(groupKey, group.stays, groupPayments)
                      }
                      onDeferGroupCheckInBalance={() =>
                        deferGroupCheckInBalance(group.stays)
                      }
                      onMarkCheckOutBasics={markCheckOutBasics}
                      onCloseGroupCheckOutBalance={() =>
                        closeGroupCheckOutBalance(groupKey, group.stays, groupPayments)
                      }
                      onCompleteGroupCheckIn={() =>
                        completeCheckInMany(
                          group.stays.map((stay) => stay.id),
                          groupKey,
                          groupPayments,
                        )
                      }
                      onCompleteGroupCheckOut={() =>
                        completeCheckOutMany(
                          group.stays.map((stay) => stay.id),
                          groupPayments,
                        )
                      }
                      creditInfo={groupCreditInfo}
                    />
                  );
                })
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="pagos-estadia" className="space-y-4">
          <Panel
            title="Pagos durante estadía"
            description="Registra abonos de huéspedes que ya están hospedados. Estos pagos se guardan con night-payments, no con cierre de check-out."
            action={
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar huésped, DPI, habitación..."
                  className="pl-9"
                />
              </div>
            }
          >
            <div className="space-y-3">
              {filteredInHouse.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay huéspedes en habitación con ese filtro.
                </div>
              ) : (
                filteredInHouse.map((stay) => {
                  const creditInfo = creditInfoForStay(stay);
                  const stayPayments = stay.payments.filter(
                    (payment) => payment.stage !== "check-out",
                  );

                  return (
                    <article key={stay.id} className="rounded-3xl border bg-background p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Habitación {stay.roomNumber}
                          </p>
                          <h3 className="mt-1 text-xl font-bold">{stay.guestName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {stay.code} · {formatDate(stay.checkIn)} al {formatDate(stay.checkOut)}
                          </p>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
                          <p className="text-xs text-muted-foreground">Saldo actual</p>
                          <p className="text-lg font-bold">{money(stayBalance(stay))}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <PaymentBreakdownCard
                          title="Abonos durante la estadía"
                          description="Agrega el pago y presiona Guardar pago. El backend usado es /api/reservations/{id}/night-payments."
                          total={stayTotalDue(stay)}
                          payments={stayPayments}
                          onChange={(payments) =>
                            updateStayPayments(
                              stay.id,
                              [
                                ...payments,
                                ...stay.payments.filter((payment) => payment.stage === "check-out"),
                              ],
                              "check-in",
                            )
                          }
                          isPaymentReadOnly={(payment) => numericApiId(payment.id) !== null}
                          isPaymentRemovable={(payment) => paymentCanBeRemoved(payment, felDispatches)}
                          stage="check-in"
                          allowCredit={Boolean(creditInfo)}
                          creditInfo={creditInfo}
                          addLabel="Agregar abono"
                          paidLabel="Pagos registrados"
                          emptyLabel="Aún no hay abonos durante la estadía."
                          referencePlaceholder="Boleta, voucher, transferencia o nota..."
                          showInvoiceStatus
                          requireApply
                          applyLabel={savingCheckInPaymentIds.has(stay.id) ? "Guardando..." : "Guardar pago"}
                          onApplyPayment={(payment) => void saveInHouseNightPayment(stay.id, payment)}
                          readOnly={savingCheckInPaymentIds.has(stay.id)}
                        />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="checkout" className="space-y-4">
          <Panel
            title="Habitaciones con huésped"
            description="Las habitaciones se ordenan por la salida más próxima. Puedes buscar por huésped, DPI, teléfono o habitación."
            action={
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar huésped, DPI, habitación..."
                  className="pl-9"
                />
              </div>
            }
          >
            <div className="space-y-3">
              {groupedInHouse.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay huéspedes en habitación con ese filtro.
                </div>
              ) : (
                groupedInHouse.map((group) => {
                  const groupKey = `checkout|${group.id}`;
                  const groupPayments =
                    groupPaymentOverrides[groupKey] ?? groupPaymentsForStays(group.stays);
                  const groupCreditInfo = creditInfoForStay(group.stays[0]);

                  return (
                    <GuestStayGroup
                      key={groupKey}
                      groupKey={groupKey}
                      stays={group.stays}
                      mode="checkout"
                      expanded={Boolean(expandedGuestGroups[groupKey])}
                      onToggleExpanded={() => toggleGuestGroup(groupKey)}
                      accountExpanded={Boolean(expandedGroupAccounts[groupKey])}
                      onToggleAccountExpanded={() => toggleGroupAccount(groupKey)}
                      expandedStayIds={
                        new Set(
                          group.stays
                            .filter((stay) => expandedStayCards[stay.id])
                            .map((stay) => stay.id),
                        )
                      }
                      onToggleStayExpanded={toggleStayCard}
                      onToggle={toggleChecklist}
                      onCheckInPaymentDecision={handleCheckInPaymentDecision}
                      onClosePaymentAtCheckOut={closePaymentAtCheckOut}
                      onUndoCheckInPayment={undoCheckInPayment}
                      onPaymentsChange={updateStayPayments}
                      savingCheckInPaymentIds={savingCheckInPaymentIds}
                      groupPayments={groupPayments}
                      onGroupPaymentsChange={(payments, stage) =>
                        updateGroupPayments(groupKey, group.stays, payments, stage)
                      }
                      felDispatches={felDispatches}
                      cashInvoicePreferences={cashInvoicePreferences}
                      onSendToFel={sendStayPaymentToFel}
                      onSendGroupToFel={(stage) =>
                        sendGroupPaymentToFel(groupKey, group.stays, groupPayments, stage)
                      }
                      onCompleteCheckIn={completeCheckIn}
                      onCompleteCheckOut={completeCheckOut}
                      onPrint={printStay}
                      onSetChecklistMany={setChecklistMany}
                      onMarkCheckInBasics={markCheckInBasics}
                      onCollectGroupCheckInBalance={() =>
                        collectGroupCheckInBalance(groupKey, group.stays, groupPayments)
                      }
                      onDeferGroupCheckInBalance={() =>
                        deferGroupCheckInBalance(group.stays)
                      }
                      onMarkCheckOutBasics={markCheckOutBasics}
                      onCloseGroupCheckOutBalance={() =>
                        closeGroupCheckOutBalance(groupKey, group.stays, groupPayments)
                      }
                      onCompleteGroupCheckIn={() =>
                        completeCheckInMany(
                          group.stays.map((stay) => stay.id),
                          groupKey,
                          groupPayments,
                        )
                      }
                      onCompleteGroupCheckOut={() =>
                        completeCheckOutMany(
                          group.stays.map((stay) => stay.id),
                          groupPayments,
                        )
                      }
                      creditInfo={groupCreditInfo}
                    />
                  );
                })
              )}
            </div>
          </Panel>
        </TabsContent>


      </Tabs>

      <Dialog
        open={Boolean(arrivalCancelTarget)}
        onOpenChange={(open) => {
          if (!open) closeArrivalCancelDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancelar llegada antes del check-in</DialogTitle>
            <DialogDescription>
              {arrivalCancelPrimary
                ? arrivalCancelStays.length === 1
                  ? `${arrivalCancelPrimary.guestName} - Habitación ${arrivalCancelPrimary.roomNumber}`
                  : `${arrivalCancelPrimary.guestName} - ${arrivalCancelStays.length} habitaciones`
                : "Indica el motivo para cancelar esta llegada."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Esto cancela la reserva antes del check-in y libera la habitacion
              para volver a venderse. No se completa check-in ni se registra salida.
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Motivo
              <textarea
                value={arrivalCancelReason}
                onChange={(event) => setArrivalCancelReason(event.target.value)}
                disabled={arrivalCancelSubmitting}
                className="min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Ej. Huésped no se presento o cancelo antes de ingresar"
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={arrivalCancelSubmitting}
              onClick={closeArrivalCancelDialog}
            >
              Volver
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-full bg-red-600 text-white hover:bg-red-700"
              disabled={!canCancelArrival}
              onClick={confirmArrivalCancel}
            >
              <XCircle className="size-4" />
              {arrivalCancelSubmitting ? "Cancelando..." : "Confirmar cancelacion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(invoiceTarget)} onOpenChange={closeStayInvoice}>
        <DialogContent className="!w-[min(1080px,calc(100vw-2rem))] !max-w-none rounded-3xl">
          <DialogHeader>
            <DialogTitle>Emitir factura FEL</DialogTitle>
            <DialogDescription>
              {invoiceTarget
                ? `${invoiceTarget.stage === "check-in" ? "Check-in" : "Check-out"} - ${invoiceTarget.stays[0]?.guestName ?? "Cliente"}`
                : "Factura de recepción"}
            </DialogDescription>
          </DialogHeader>

          {invoiceSubmitting ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <div>
                  <p className="font-semibold text-foreground">Espera un momento, emitiendo factura FEL...</p>
                  <p className="text-xs text-muted-foreground">
                    DIGIFACT puede tardar varios segundos. No cierres esta ventana.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {invoiceForm && invoiceTarget ? (
            <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-2">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Total etapa</p>
                  <p className="mt-1 text-lg font-bold">
                    {money(
                      paymentTotal(invoiceTarget.payments) +
                        minibarChargeTotal(invoiceTarget.minibarCharges),
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="mt-1 text-lg font-bold">{money(activeInvoiceAvailableAmount)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Esta factura</p>
                  <p className="mt-1 text-lg font-bold">{money(activeInvoiceAmount)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Documentos fiscales restantes</p>
                  <p className="mt-1 text-lg font-bold">
                    {invoiceRemaining?.remaining ?? (invoiceLoading ? "..." : "N/D")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Pagos de la reservación y estadía</p>
                        <p className="text-xs text-muted-foreground">
                          {activeSelectedInvoicePayments.length} de{" "}
                          {activeInvoiceablePayments.length} pendientes seleccionados
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeInvoiceablePayments.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full"
                            onClick={() =>
                              updateStayInvoiceForm({
                                selectedPaymentIds:
                                  activeInvoiceablePayments.map(paymentRecordKey),
                                amountToInvoice: String(
                                  roundCurrency(
                                    invoiceablePaymentTotal(
                                      activeInvoiceablePayments,
                                      activeInvoiceDispatches,
                                    ) + activeMinibarInvoiceTotal,
                                  ),
                                ),
                              })
                            }
                          >
                            Seleccionar pendientes
                          </Button>
                        ) : null}
                        <p className="text-sm font-bold">
                          {money(activeSelectedInvoiceTotal)}
                        </p>
                      </div>
                    </div>

                    {activeSavedInvoicePayments.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No hay pagos guardados para mostrar.
                        {activeInvoiceableMinibarCharges.length > 0
                          ? " Se emitirá con los consumos incluidos."
                          : " Guarda el pago primero o genera comprobante sin factura."}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {activeSavedInvoicePayments.map((payment) => {
                          const paymentKey = paymentRecordKey(payment);
                          const alreadyInvoiced = paymentAlreadyInvoiced(
                            payment,
                            activeInvoiceDispatches,
                          );
                          const selected = activeSelectedPaymentIds.has(paymentKey);
                          const invoiceId =
                            payment.invoiceId ??
                            activeInvoiceDispatches.find((dispatch) =>
                              dispatch.paymentIds.includes(paymentKey),
                            )?.invoiceId;
                          const stageLabel =
                            payment.stage === "reserva"
                              ? "Reservación"
                              : payment.stage === "check-in"
                                ? "Check-in"
                                : "Check-out";

                          return (
                            <div
                              key={paymentKey}
                              className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${
                                alreadyInvoiced
                                  ? "border-emerald-200 bg-emerald-50/50"
                                  : "transition hover:border-primary/40 hover:bg-muted/30"
                              }`}
                            >
                              {alreadyInvoiced ? (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                              ) : (
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(checked) =>
                                    toggleStayInvoicePayment(payment, checked === true)
                                  }
                                  aria-label={`Seleccionar pago ${paymentMethodLabel(payment.method)}`}
                                />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {paymentMethodLabel(payment.method)} - {payment.date}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {stageLabel}
                                </span>
                                {payment.reference ? (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {payment.reference}
                                  </span>
                                ) : null}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="font-semibold">
                                  {money(Number(payment.amount || 0))}
                                </span>
                                {alreadyInvoiced ? (
                                  <>
                                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                      Facturado{invoiceId ? ` #${invoiceId}` : ""}
                                    </span>
                                    {invoiceId ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="size-8 rounded-full border-emerald-200 text-emerald-800"
                                        title={`Reimprimir factura #${invoiceId}`}
                                        onClick={() => void reprintStayInvoice(invoiceId)}
                                      >
                                        <Printer className="size-4" />
                                      </Button>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="rounded-full border bg-muted/30 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {activeInvoiceableMinibarCharges.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Consumos/minibar incluidos</p>
                        <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold">
                          {money(activeMinibarInvoiceTotal)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {activeInvoiceableMinibarCharges.map((charge) => (
                          <div
                            key={charge.id}
                            className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white/70 p-3 text-sm"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold">{charge.description}</span>
                              <span className="block truncate text-xs text-amber-900/75">
                                Código {charge.id}
                                {charge.roomNumber ? ` - Habitación ${charge.roomNumber}` : ""}
                              </span>
                            </span>
                            <strong>{money(charge.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {issuedInvoiceFields.length > 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                      <p className="font-semibold">Factura emitida</p>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {issuedInvoiceFields.map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-emerald-800">{label}</dt>
                            <dd className="font-semibold">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-4">
                    <div className="grid gap-3">
                      <div className="space-y-1 text-sm font-medium">
                        <div className="flex items-center justify-between gap-2">
                          <span>NIT</span>
                          <Button
                            type="button"
                            variant={invoiceForm.useCustomerTaxInfo ? "outline" : "default"}
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs font-semibold shadow-sm"
                            onClick={() => {
                              if (!invoiceTarget) return;
                              setInvoiceNitLookupStatus("idle");
                              setInvoiceForm((current) => {
                                if (!current) return current;
                                if (current.useCustomerTaxInfo) {
                                  return {
                                    ...current,
                                    useCustomerTaxInfo: false,
                                    taxId: "",
                                    name: "",
                                  };
                                }

                                const customerTaxId = defaultInvoiceTaxId(invoiceTarget.stays, guests);
                                return {
                                  ...current,
                                  useCustomerTaxInfo: true,
                                  taxId: customerTaxId,
                                  name: defaultStayInvoiceBuyerName(
                                    invoiceTarget.stays,
                                    guests,
                                    customerTaxId,
                                  ),
                                };
                              });
                            }}
                          >
                            {invoiceForm.useCustomerTaxInfo
                              ? "Facturar a otro nombre"
                              : "Usar datos del cliente"}
                          </Button>
                        </div>
                        <TextInput
                          value={invoiceForm.taxId}
                          readOnly={invoiceForm.useCustomerTaxInfo}
                          className={invoiceForm.useCustomerTaxInfo ? "bg-muted/40" : undefined}
                          onChange={(event) => {
                            setInvoiceNitLookupStatus("idle");
                            updateStayInvoiceForm({
                              taxId: event.target.value.toUpperCase(),
                              name: "",
                            });
                          }}
                          placeholder="CF"
                        />
                        {!invoiceForm.useCustomerTaxInfo ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8 rounded-full px-3 text-xs"
                            onClick={() => void lookupStayInvoiceNitInfo()}
                          >
                            Consultar NIT
                          </Button>
                        ) : null}
                      </div>

                      <div className="space-y-1 text-sm font-medium">
                        Nombre receptor
                        {invoiceForm.useCustomerTaxInfo ? (
                          <div className="flex min-h-10 whitespace-normal break-words rounded-2xl border bg-muted/20 px-3 py-2 text-sm font-semibold">
                            {invoiceForm.name || "CONSUMIDOR FINAL"}
                          </div>
                        ) : (
                          <>
                            <TextInput
                              value={
                                invoiceForm.taxId.trim().toUpperCase() === "CF"
                                  ? "CONSUMIDOR FINAL"
                                  : invoiceForm.name
                              }
                              readOnly={invoiceForm.taxId.trim().toUpperCase() === "CF"}
                              onChange={(event) =>
                                updateStayInvoiceForm({ name: event.target.value })
                              }
                              placeholder="DIGIFACT lo completa o puedes escribirlo"
                            />
                            <p className="text-xs font-normal text-muted-foreground">
                              {invoiceNitLookupStatus === "loading"
                                ? "Consultando NIT..."
                                : invoiceNitLookupStatus === "found"
                                  ? "Nombre cargado desde certificador."
                                  : invoiceNitLookupStatus === "not-found"
                                    ? "No se encontró automáticamente. Puedes escribirlo manualmente."
                                    : invoiceNitLookupStatus === "error"
                                      ? "No se pudo consultar. Puedes escribirlo manualmente."
                                      : "Se consulta automáticamente al escribir el NIT."}
                            </p>
                          </>
                        )}
                      </div>

                      <label className="space-y-1 text-sm font-medium">
                        Dirección
                        <TextInput
                          value={invoiceForm.address}
                          onChange={(event) => updateStayInvoiceForm({ address: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Descripción enviada a FEL
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {invoiceForm.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      El sistema genera este concepto automáticamente según los pagos seleccionados.
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Monto a facturar</p>
                    <p className="mt-1 text-2xl font-bold">
                      {money(activeSelectedAvailableAmount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Total exacto de pagos/consumos seleccionados. Cada pago se factura completo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={invoiceSubmitting}
              onClick={() => closeStayInvoice(false)}
            >
              Cerrar
            </Button>
            {issuedInvoiceResponse ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="size-4" />
                Factura emitida correctamente
              </div>
            ) : (
              <Button
                type="button"
                className="gap-2 rounded-full"
                disabled={!canIssueStayInvoice}
                onClick={issueStayInvoice}
              >
                <Receipt className="size-4" />
                {invoiceSubmitting ? "Emitiendo..." : "Emitir factura"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RecepcionCheckinPage;
