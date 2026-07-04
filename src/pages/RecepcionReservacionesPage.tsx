import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CirclePlus,
  CreditCard,
  Download,
  Hotel,
  LogOut,
  MessageCircle,
  Phone,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { QuickGuide } from "@/components/modules/view-kit";
import {
  PaymentBreakdownCard,
  paymentMethodLabel,
  paymentRecordKey,
  paymentTotal,
} from "@/components/payments/payment-breakdown-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { printOfficialInvoice } from "@/lib/invoice-document";
import { printSimpleReceipt } from "@/lib/simple-receipt";
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
import { formatDate, formatDateShort, useStore } from "@/lib/store";
import { addIsoDateDays, cn, localDateIso } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import type {
  CreditAccount,
  Guest,
  PaymentMethod as SplitPaymentMethod,
  PaymentRecord,
  ReservationBillingStatus,
  Reservation as StoreReservation,
  Room as StoreRoom,
  RoomType as StoreRoomType,
} from "@/lib/types";

type ReservationSource = "Llamada" | "WhatsApp" | "Correo" | "Presencial";
type ReservationStatus =
  | "Pre-reserva"
  | "Confirmada"
  | "Reservada"
  | "Lista para check-in"
  | "Ocupada"
  | "Checkout"
  | "Cancelada";
type RoomType = "Estándar" | "Jr. Suite";
type Occupancy = "1 persona" | "2 personas" | "3 personas" | "4 personas";
type PaymentMethod =
  | "Efectivo"
  | "Tarjeta"
  | "Transferencia"
  | "Depósito"
  | "Crédito";
type RateType = "Normal" | "Corporativa" | "Manual con autorización";

type Reservation = {
  id: string;
  reservationRoomId?: string;
  code: string;
  guestId: string;
  guestName: string;
  dpi: string;
  nit: string;
  phone: string;
  email: string;
  source: ReservationSource;
  roomType: RoomType;
  roomNumber: string;
  occupancy: Occupancy;
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  rateType: RateType;
  nightlyRate: number;
  total: number;
  paid: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  payments: PaymentRecord[];
  status: ReservationStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  billingStatus?: ReservationBillingStatus;
  lastInvoiceId?: string;
  invoicedAmount?: number;
  pendingToInvoiceAmount?: number;
};

type RoomAvailability = {
  number: string;
  type: RoomType;
  status:
    | "Disponible"
    | "Reservada"
    | "Lista para check-in"
    | "Ocupada"
    | "Limpieza";
  maxOccupancy?: number;
  occupancyOptions?: number[];
  rateOptions?: StoreRoom["rateOptions"];
  specificRates?: StoreRoom["specificRates"];
};

type HistoryItem = {
  id: string;
  date: string;
  action: string;
  reservationCode: string;
  user: string;
  detail: string;
};

type CancellationAuthorization = {
  supervisor: string;
  reason: string;
};

type CleaningBlock = {
  roomNumber: string;
  date: string;
};

type PlannerExtensionDraft = {
  reservation: Reservation;
  newCheckOut: string;
  conflict?: string | null;
  previewEndPx?: number | null;
};

type GuestOption = {
  id: string;
  guestName: string;
  dpi: string;
  nit: string;
  phone: string;
  email: string;
  country: string;
  department?: string;
  frequent: boolean;
  frequentBenefitBlocked: boolean;
  stays: number;
  credit?: GuestCreditInfo;
};

type GuestCreditHealth =
  | "al dia"
  | "por vencer"
  | "vencido"
  | "pausado"
  | "bloqueado"
  | "autorizado"
  | "sin credito";

type GuestCreditInfo = {
  accountId: string;
  company: string;
  available: number;
  limit: number;
  balance: number;
  dueDate: string;
  health: GuestCreditHealth;
};

type RoomCartItem = {
  id: string;
  roomNumber: string;
  roomType: RoomType;
  occupancy: Occupancy;
  checkIn: string;
  checkOut: string;
  rateType: RateType;
  manualRate: number;
};

type RateCalculationState = {
  status: "loading" | "ready" | "error";
  signature: string;
  nightlyRate: number;
  total: number;
  error?: string;
};

type InvoiceConceptOption = {
  id: number;
  name: string;
  itemType: InvoiceItemType | string;
  defaultDescription: string;
  defaultPrice?: number;
};

type ReservationInvoiceForm = {
  billingMode: InvoiceBillingMode;
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
  description: string;
  quantity: string;
  unitPriceWithTax: string;
  notes: string;
  selectedReservationPaymentIds: string[];
};

type InvoiceRemainingSummary = {
  total?: number;
  used?: number;
  remaining?: number;
};

type InvoiceNitLookupStatus =
  | "idle"
  | "loading"
  | "found"
  | "not-found"
  | "error";

type ReservationCancellationRequestRow = {
  id: string;
  reservationId: string;
  reason: string;
  requestedBy: string;
  status: string;
};

const plannerDayWidth = 116;
const plannerRoomWidth = 188;
const plannerCompactMetrics = { dayWidth: 82, roomWidth: 124, rowHeight: 68 };
const plannerLaptopMetrics = { dayWidth: 96, roomWidth: 154, rowHeight: 72 };
const plannerDesktopMetrics = {
  dayWidth: plannerDayWidth,
  roomWidth: plannerRoomWidth,
  rowHeight: 76,
};

function currentReservationResponsible() {
  const user = getSessionUser();
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email;
  return "Recepción";
}

const roomRates: Record<RoomType, Record<Occupancy, number>> = {
  Estándar: {
    "1 persona": 350,
    "2 personas": 650,
    "3 personas": 900,
    "4 personas": 1100,
  },
  "Jr. Suite": {
    "1 persona": 425,
    "2 personas": 750,
    "3 personas": 1000,
    "4 personas": 1150,
  },
};

const corporateRates: Record<RoomType, number> = {
  Estándar: 280,
  "Jr. Suite": 375,
};

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}Q. ${amount}`;
}

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function numericBackendId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  if (/^\d+$/.test(text)) return Number(text);
  const match = text.match(/^(\d+)(?:-\d+)?$/);
  return match ? Number(match[1]) : null;
}

function paymentBackendId(payment: PaymentRecord) {
  return numericBackendId(payment.backendPaymentId ?? payment.id);
}

function paymentIssueSourceModule(payment: PaymentRecord) {
  const sourceModule = payment.issueSourceModule?.trim().toLowerCase();
  if (sourceModule === "reservation") return INVOICE_SOURCE_MODULES.RESERVATION;
  if (sourceModule === "checkin" || sourceModule === "check-in") {
    return INVOICE_SOURCE_MODULES.CHECK_IN;
  }
  if (sourceModule === "checkout" || sourceModule === "check-out") {
    return INVOICE_SOURCE_MODULES.CHECK_OUT;
  }
  if (sourceModule === "event") return INVOICE_SOURCE_MODULES.EVENT;

  if (payment.backendPaymentType === "stay") {
    return payment.stage === "check-out"
      ? INVOICE_SOURCE_MODULES.CHECK_OUT
      : INVOICE_SOURCE_MODULES.CHECK_IN;
  }
  if (payment.backendPaymentType === "event")
    return INVOICE_SOURCE_MODULES.EVENT;
  return INVOICE_SOURCE_MODULES.RESERVATION;
}

function paymentIssueSourceId(
  payment: PaymentRecord,
  reservation: Reservation,
) {
  return (
    numericBackendId(payment.issueSourceId) ??
    (paymentIssueSourceModule(payment) === INVOICE_SOURCE_MODULES.RESERVATION
      ? numericBackendId(reservation.id)
      : null)
  );
}

function apiRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function apiArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = apiRecord(value);
  return Array.isArray(record.data) ? record.data : [];
}

function collectApiRecords(
  value: unknown,
  depth = 0,
): Array<Record<string, unknown>> {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectApiRecords(item, depth + 1));
  }

  const record = apiRecord(value);
  if (Object.keys(record).length === 0) return [];

  return [
    record,
    ...Object.values(record).flatMap((item) =>
      collectApiRecords(item, depth + 1),
    ),
  ];
}

function apiString(
  record: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
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

function mapReservationCancellationRequest(
  value: unknown,
  index: number,
): ReservationCancellationRequestRow {
  const row = apiRecord(value);
  return {
    id: apiString(
      row,
      [
        "id_reservation_cancellation_request",
        "idReservationCancellationRequest",
        "id",
      ],
      String(index + 1),
    ),
    reservationId: apiString(
      row,
      ["id_reservation", "idReservation", "reservation_id"],
      "-",
    ),
    reason: apiString(
      row,
      ["reason", "notes", "request_notes"],
      "Solicitud de cancelación",
    ),
    requestedBy: apiString(
      row,
      ["requested_by", "requestedBy", "created_by"],
      "Recepcion",
    ),
    status: apiString(row, ["status"], "Pendiente"),
  };
}

function apiNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }
  return undefined;
}

function apiBoolean(
  record: Record<string, unknown>,
  keys: string[],
  fallback = false,
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      return ["1", "true", "si", "sí", "yes"].includes(
        value.trim().toLowerCase(),
      );
    }
  }
  return fallback;
}

function apiReservationIdFromResponse(response: unknown) {
  if (typeof response === "number" && Number.isFinite(response))
    return response;
  if (typeof response === "string" && /^\d+$/.test(response.trim())) {
    return Number(response.trim());
  }

  for (const record of collectApiRecords(response)) {
    const id = apiNumber(record, [
      "id_reservation",
      "idReservation",
      "reservation_id",
      "reservationId",
    ]);
    if (id) return id;
  }

  const root = apiRecord(response);
  const data = apiRecord(root.data);
  const fallbackRecord = Object.keys(data).length ? data : root;
  return apiNumber(fallbackRecord, ["id"]);
}

function apiReservationRoomIdFromResponse(response: unknown) {
  for (const record of collectApiRecords(response)) {
    const id = apiNumber(record, [
      "id_reservation_room",
      "idReservationRoom",
      "reservation_room_id",
    ]);
    if (id) return id;
  }

  return undefined;
}

function apiReservationCodeFromResponse(response: unknown) {
  for (const record of collectApiRecords(response)) {
    const code = apiString(record, ["code", "reservation_code"]);
    if (code) return code;
  }

  return undefined;
}

function paymentPayload(payment: PaymentRecord) {
  return {
    amount: payment.amount,
    payment_method: payment.method,
    payment_reference: payment.reference,
  };
}

function paymentMethodFromApiText(value: string): SplitPaymentMethod {
  const method = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (method.includes("tarjeta") || method.includes("card")) return "tarjeta";
  if (method.includes("transfer")) return "transferencia";
  if (method.includes("deposit")) return "deposito";
  if (method.includes("credit")) return "credito";
  return "efectivo";
}

function reservationPaymentFromResponse(response: unknown) {
  const records = [
    apiRecord(response),
    apiRecord(apiRecord(response).data),
    ...apiArray(response).map(apiRecord),
    ...apiArray(apiRecord(response).payments).map(apiRecord),
    ...apiArray(apiRecord(apiRecord(response).data).payments).map(apiRecord),
  ];

  for (const record of records) {
    const id = apiNumber(record, [
      "id_reservation_payment",
      "idReservationPayment",
      "reservation_payment_id",
      "reservationPaymentId",
      "id_payment",
      "idPayment",
      "id",
      "payment_id",
      "paymentId",
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

function reservationPaymentsFromResponse(
  response: unknown,
  fallbackPayments: PaymentRecord[],
): PaymentRecord[] {
  const seen = new Set<string>();
  const backendPayments = collectApiRecords(response)
    .map((record) => {
      const reservationPaymentId = apiNumber(record, [
        "id_reservation_payment",
        "idReservationPayment",
        "reservation_payment_id",
        "reservationPaymentId",
      ]);
      const stayPaymentId = apiNumber(record, [
        "id_stay_payment",
        "idStayPayment",
        "stay_payment_id",
        "stayPaymentId",
      ]);
      const eventPaymentId = apiNumber(record, [
        "id_event_payment",
        "idEventPayment",
        "event_payment_id",
        "eventPaymentId",
      ]);
      const specificId =
        reservationPaymentId ?? stayPaymentId ?? eventPaymentId;
      const amount = apiNumber(record, [
        "amount",
        "total_amount",
        "totalAmount",
        "payment_amount",
        "paymentAmount",
        "paid_amount",
        "paidAmount",
      ]);
      const methodText = apiString(record, [
        "payment_method",
        "paymentMethod",
        "method",
        "payment_type",
        "paymentType",
      ]);
      const method = methodText
        ? paymentMethodFromApiText(methodText)
        : undefined;
      const genericPaymentId =
        amount && methodText
          ? apiNumber(record, [
              "id_payment",
              "idPayment",
              "payment_id",
              "paymentId",
              "id",
            ])
          : undefined;
      const id = specificId ?? genericPaymentId;
      const issueSourceModule = apiString(record, [
        "issue_source_module",
        "issueSourceModule",
        "source_module",
        "sourceModule",
      ]);
      const normalizedSourceModule = issueSourceModule
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const stage =
        normalizedSourceModule.includes("checkout") ||
        normalizedSourceModule.includes("check-out")
          ? ("check-out" as const)
          : normalizedSourceModule.includes("checkin") ||
              normalizedSourceModule.includes("check-in")
            ? ("check-in" as const)
            : ("reserva" as const);

      if (!id || !amount || amount <= 0 || seen.has(String(id))) return null;
      seen.add(String(id));

      return {
        id: String(id),
        amount,
        method,
        reference: apiString(record, [
          "payment_reference",
          "paymentReference",
          "reference",
          "notes",
        ]),
        date: apiString(
          record,
          ["payment_date", "paymentDate", "date", "created_at", "createdAt"],
          todayIso(),
        ),
        stage,
        backendPaymentType: stayPaymentId
          ? ("stay" as const)
          : eventPaymentId
            ? ("event" as const)
            : ("reservation" as const),
        issueSourceModule,
        issueSourceId: apiString(record, [
          "issue_source_id",
          "issueSourceId",
          "source_id",
          "sourceId",
          "id_reservation",
          "idReservation",
          "reservation_id",
          "reservationId",
        ]),
        isInvoiced: apiBoolean(record, ["is_invoiced", "isInvoiced"], false),
        invoiceId: apiString(record, ["id_invoice", "idInvoice", "invoice_id"]),
        invoicedAmount: apiNumber(record, [
          "invoiced_amount",
          "invoicedAmount",
        ]),
        pendingToInvoiceAmount: apiNumber(record, [
          "pending_to_invoice_amount",
          "pendingToInvoiceAmount",
        ]),
        invoicedAt: apiString(record, ["invoiced_at", "invoicedAt"]),
      };
    })
    .filter((payment): payment is NonNullable<typeof payment> =>
      Boolean(payment),
    );

  if (backendPayments.length === 0) return fallbackPayments;

  if (fallbackPayments.length === 0) {
    return backendPayments.map((payment) => ({
      id: payment.id,
      backendPaymentId: payment.id,
      method: payment.method ?? "efectivo",
      amount: payment.amount,
      reference: payment.reference,
      stage: payment.stage,
      date: payment.date,
      backendPaymentType: payment.backendPaymentType,
      issueSourceModule: payment.issueSourceModule,
      issueSourceId: payment.issueSourceId,
      isInvoiced: payment.isInvoiced,
      invoiceId: payment.invoiceId,
      invoicedAmount: payment.invoicedAmount,
      pendingToInvoiceAmount: payment.pendingToInvoiceAmount,
      invoicedAt: payment.invoicedAt,
    }));
  }

  return fallbackPayments.map((payment, index) => {
    const backendPayment = backendPayments[index];
    if (!backendPayment) return payment;

    return {
      ...payment,
      id: backendPayment.id,
      backendPaymentId: backendPayment.id,
      backendPaymentType: backendPayment.backendPaymentType,
      issueSourceModule:
        backendPayment.issueSourceModule || payment.issueSourceModule,
      issueSourceId: backendPayment.issueSourceId || payment.issueSourceId,
      amount: backendPayment.amount || payment.amount,
      method: backendPayment.method || payment.method,
      reference: backendPayment.reference || payment.reference,
      stage: backendPayment.stage || payment.stage,
      date: backendPayment.date || payment.date,
      isInvoiced: backendPayment.isInvoiced,
      invoiceId: backendPayment.invoiceId,
      invoicedAmount: backendPayment.invoicedAmount,
      pendingToInvoiceAmount: backendPayment.pendingToInvoiceAmount,
      invoicedAt: backendPayment.invoicedAt,
    };
  });
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

  const itemType = apiString(
    record,
    ["item_type", "itemType"],
    INVOICE_ITEM_TYPES.SERVICIO,
  );

  return {
    id,
    name: apiString(record, ["name"], `Concepto ${id}`),
    itemType,
    defaultDescription: apiString(record, [
      "default_description",
      "defaultDescription",
    ]),
    defaultPrice: apiNumber(record, ["default_price", "defaultPrice"]),
  };
}

function invoiceConceptForItemType(
  concepts: InvoiceConceptOption[],
  itemType: InvoiceItemType,
) {
  return concepts.find((concept) => concept.itemType === itemType);
}

function invoiceRemainingSummary(
  value: unknown,
): InvoiceRemainingSummary | null {
  const record = apiRecord(value);
  const dataRecord = apiRecord(record.data);
  const nested = Object.keys(dataRecord).length ? dataRecord : record;
  const total = apiNumber(nested, [
    "total",
    "total_dtes",
    "totalDtes",
    "purchased",
    "compradas",
  ]);
  const used = apiNumber(nested, ["used", "usadas", "used_dtes", "usedDtes"]);
  const remaining = apiNumber(nested, [
    "remaining",
    "restantes",
    "available",
    "remaining_dtes",
    "remainingDtes",
  ]);

  if (total === undefined && used === undefined && remaining === undefined)
    return null;
  return { total, used, remaining };
}

function buildReservationInvoiceDescription(reservation: Reservation) {
  return `Servicio de hospedaje reservacion ${reservation.code}`;
}

function buildReservationPartialInvoiceDescription(reservation: Reservation) {
  return `Abonos de hospedaje reservación ${reservation.code}`;
}

function paymentInvoiceSourceLabel(payment: PaymentRecord) {
  const sourceModule = paymentIssueSourceModule(payment);
  if (sourceModule === INVOICE_SOURCE_MODULES.RESERVATION) return "reservación";
  if (sourceModule === INVOICE_SOURCE_MODULES.CHECK_IN) return "check-in";
  if (sourceModule === INVOICE_SOURCE_MODULES.CHECK_OUT) return "check-out";
  return sourceModule.toLowerCase();
}

function buildReservationPaymentInvoiceDescription(
  reservation: Reservation,
  payments: PaymentRecord[],
) {
  const uniqueSources = Array.from(
    new Set(payments.map(paymentInvoiceSourceLabel)),
  );
  if (uniqueSources.length === 0)
    return buildReservationPartialInvoiceDescription(reservation);

  const sourceText =
    uniqueSources.length === 1
      ? uniqueSources[0]
      : `${uniqueSources.slice(0, -1).join(", ")} y ${uniqueSources.at(-1)}`;

  return `Servicio de hospedaje ${reservation.code} - pagos de ${sourceText}`;
}

function reservationPaymentInvoicedAmount(payment: PaymentRecord) {
  const amount = Number(payment.amount || 0);
  const isInvoiced =
    Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
    (Number.isFinite(payment.invoicedAmount) &&
      Number(payment.invoicedAmount) > 0.01) ||
    (Number.isFinite(payment.pendingToInvoiceAmount) &&
      Number(payment.pendingToInvoiceAmount) <= 0.01);
  return isInvoiced ? amount : 0;
}

function reservationPaymentInvoiceableAmount(payment: PaymentRecord) {
  return Math.max(
    0,
    roundCurrency(
      Number(payment.amount || 0) - reservationPaymentInvoicedAmount(payment),
    ),
  );
}

function reservationInvoiceablePayments(reservation: Reservation) {
  return reservation.payments.filter(
    (payment) =>
      reservationPaymentInvoiceableAmount(payment) > 0.01 &&
      paymentBackendId(payment) !== null,
  );
}

function reservationSelectedInvoicePayments(
  reservation: Reservation,
  selectedPaymentIds: string[],
) {
  const selected = new Set(selectedPaymentIds);
  return reservationInvoiceablePayments(reservation).filter((payment) =>
    selected.has(paymentRecordKey(payment)),
  );
}

function reservationInvoiceablePaymentTotal(payments: PaymentRecord[]) {
  return roundCurrency(
    payments.reduce(
      (sum, payment) => sum + reservationPaymentInvoiceableAmount(payment),
      0,
    ),
  );
}

function defaultReservationInvoiceMode(reservation: Reservation) {
  void reservation;
  return INVOICE_BILLING_MODES.BY_PAYMENTS;
}

function defaultReservationInvoiceForm(
  reservation: Reservation,
  guest: Guest | undefined,
  concept?: InvoiceConceptOption,
  preferredPaymentIds?: string[],
): ReservationInvoiceForm {
  const taxId =
    (reservation.nit || guest?.nit || "CF").trim().toUpperCase() || "CF";
  const isFinalConsumer = taxId === "CF";
  const billingMode = defaultReservationInvoiceMode(reservation);
  const invoiceablePayments = reservationInvoiceablePayments(reservation);
  const invoiceablePaymentIds = invoiceablePayments.map(paymentRecordKey);
  const preferredIds = preferredPaymentIds?.length
    ? new Set(preferredPaymentIds)
    : null;
  const selectedReservationPaymentIds =
    billingMode === INVOICE_BILLING_MODES.BY_PAYMENTS
      ? preferredIds
        ? invoiceablePayments
            .filter(
              (payment) =>
                preferredIds.has(paymentRecordKey(payment)) ||
                preferredIds.has(payment.id),
            )
            .map(paymentRecordKey)
        : invoiceablePaymentIds
      : [];
  const selectedPayments = reservationSelectedInvoicePayments(
    reservation,
    selectedReservationPaymentIds,
  );
  const selectedPaymentTotal =
    reservationInvoiceablePaymentTotal(selectedPayments);
  const isPartial = true;

  return {
    billingMode,
    useCustomerTaxInfo: true,
    taxId,
    name: isFinalConsumer ? "CONSUMIDOR FINAL" : reservation.guestName,
    address: "CIUDAD",
    city: "09001",
    district: guest?.department ?? "Quetzaltenango",
    state: guest?.department ?? "Quetzaltenango",
    country: "GT",
    format: INVOICE_FORMATS.PDF_XML,
    conceptId: concept ? String(concept.id) : "",
    itemType: INVOICE_ITEM_TYPES.SERVICIO,
    description: isPartial
      ? buildReservationPaymentInvoiceDescription(reservation, selectedPayments)
      : concept?.defaultDescription ||
        buildReservationInvoiceDescription(reservation),
    quantity: "1",
    unitPriceWithTax: String(roundCurrency(selectedPaymentTotal)),
    notes: isPartial
      ? "Facturación de pagos seleccionados"
      : "Facturación total de reservación",
    selectedReservationPaymentIds,
  };
}

function invoiceResponseFields(value: unknown) {
  const nested = invoiceResponseRecord(value);
  const fields = [
    [
      "Identificador",
      apiString(nested, ["id_invoice", "idInvoice", "invoice_id", "id"]),
    ],
    ["Estado FEL", apiString(nested, ["fel_status", "felStatus"])],
    [
      "Autorización",
      apiString(nested, [
        "digifact_auth_number",
        "digifactAuthNumber",
        "uuid",
        "certification_uuid",
      ]),
    ],
    [
      "Serie",
      apiString(nested, ["digifact_serie", "digifactSerie", "serie", "series"]),
    ],
    [
      "Número",
      apiString(nested, [
        "digifact_numero",
        "digifactNumero",
        "correlativo",
        "number",
        "invoice_number",
      ]),
    ],
    [
      "Total",
      apiString(nested, [
        "total_amount",
        "totalAmount",
        "total",
        "grand_total",
      ]),
    ],
    ["Origen", apiString(nested, ["source_module", "sourceModule"])],
    ["Modo", apiString(nested, ["billing_mode", "billingMode"])],
    [
      "Documentos fiscales restantes",
      apiString(nested, ["remaining_quantity", "remainingQuantity"]),
    ],
    ["Mensaje", apiString(nested, ["message"])],
  ].filter(([, fieldValue]) => fieldValue);

  return fields;
}

function invoiceResponseRecord(value: unknown) {
  const record = apiRecord(value);
  const dataRecord = apiRecord(record.data);
  return Object.keys(dataRecord).length ? dataRecord : record;
}

async function reprintReservationInvoice(invoiceId: string) {
  try {
    await printOfficialInvoice(invoiceId);
  } catch (error) {
    toast.error("No se pudo abrir la factura para imprimir.", {
      description:
        error instanceof Error ? error.message : "Intenta nuevamente.",
    });
  }
}

function nowLabel() {
  return new Date().toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateOnlyIso(value: string) {
  return value ? value.slice(0, 10) : value;
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${dateOnlyIso(start)}T00:00:00`);
  const endDate = new Date(`${dateOnlyIso(end)}T00:00:00`);
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  return Math.max(diff || 1, 1);
}

function daysOffset(start: string, end: string) {
  const startDate = new Date(`${dateOnlyIso(start)}T00:00:00`);
  const endDate = new Date(`${dateOnlyIso(end)}T00:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function todayIso() {
  return localDateIso();
}

function addDaysIso(date: string, days: number) {
  return addIsoDateDays(dateOnlyIso(date), days);
}

function dateRange(start: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDaysIso(start, index));
}

function formatPlannerDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("es-GT", {
    weekday: "short",
    day: "numeric",
  }).format(parsed);
}

function formatPlannerRange(start: string, days: number) {
  const end = addDaysIso(start, days - 1);
  const formatter = new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(new Date(`${start}T00:00:00`))} - ${formatter.format(
    new Date(`${end}T00:00:00`),
  )}`;
}

function monthInputValue(date: string) {
  return date.slice(0, 7);
}

function firstDayOfMonth(month: string) {
  return `${month}-01`;
}

function daysInMonthIso(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
}

function currentMonthStartIso() {
  return firstDayOfMonth(monthInputValue(todayIso()));
}

function addMonthsIso(date: string, months: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setMonth(parsed.getMonth() + months, 1);
  return parsed.toISOString().slice(0, 10);
}

function cellKey(roomNumber: string, date: string) {
  return `${roomNumber}|${date}`;
}

function parseCellKey(key: string) {
  const [roomNumber, date] = key.split("|");
  return { roomNumber, date };
}

function createCartItemId(
  roomNumber: string,
  checkIn: string,
  checkOut: string,
) {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${roomNumber}|${checkIn}|${checkOut}|${randomId}`;
}

function dateInReservation(reservation: Reservation, date: string) {
  const currentDate = dateOnlyIso(date);
  const checkIn = dateOnlyIso(reservation.checkIn);
  const checkOut = dateOnlyIso(reservation.checkOut);

  return (
    reservation.status !== "Cancelada" &&
    currentDate >= checkIn &&
    currentDate < checkOut
  );
}

function cartItemDates(item: RoomCartItem) {
  const nights = Math.max(0, daysOffset(item.checkIn, item.checkOut));
  return dateRange(item.checkIn, nights);
}

function groupConsecutiveDates(dates: string[]) {
  return [...new Set(dates)].sort().reduce<string[][]>((groups, date) => {
    const currentGroup = groups[groups.length - 1];

    if (
      !currentGroup ||
      daysOffset(currentGroup[currentGroup.length - 1], date) !== 1
    ) {
      groups.push([date]);
      return groups;
    }

    currentGroup.push(date);
    return groups;
  }, []);
}

function cartItemsFromDateGroups(base: RoomCartItem, dates: string[]) {
  return groupConsecutiveDates(dates).map<RoomCartItem>((group) => ({
    ...base,
    id: createCartItemId(
      base.roomNumber,
      group[0],
      addDaysIso(group[group.length - 1], 1),
    ),
    checkIn: group[0],
    checkOut: addDaysIso(group[group.length - 1], 1),
  }));
}

function getGuestsFromOccupancy(occupancy: Occupancy) {
  const map: Record<Occupancy, number> = {
    "1 persona": 1,
    "2 personas": 2,
    "3 personas": 3,
    "4 personas": 4,
  };

  return map[occupancy];
}

function occupancyFromGuests(guests: number): Occupancy {
  if (guests <= 1) return "1 persona";
  if (guests === 2) return "2 personas";
  if (guests === 3) return "3 personas";
  return "4 personas";
}

function roomMaxGuests(roomType: RoomType) {
  return roomType === "Jr. Suite" ? 4 : 4;
}

function occupancyOptionsForRoom(roomType: RoomType) {
  return Array.from({ length: roomMaxGuests(roomType) }, (_, index) =>
    occupancyFromGuests(index + 1),
  );
}

function occupancyOptionsForRoomAvailability(room: RoomAvailability) {
  const configured = room.occupancyOptions?.length
    ? room.occupancyOptions
    : Array.from(
        { length: room.maxOccupancy ?? roomMaxGuests(room.type) },
        (_, index) => index + 1,
      );

  return [...new Set(configured)]
    .filter((people) => people >= 1 && people <= 4)
    .sort((a, b) => a - b)
    .map(occupancyFromGuests);
}

function defaultOccupancyForRoomAvailability(room: RoomAvailability) {
  const options = occupancyOptionsForRoomAvailability(room);
  return options.includes("2 personas")
    ? "2 personas"
    : (options[0] ?? "1 persona");
}

function occupancyTextForRoomAvailability(room: RoomAvailability) {
  const options = occupancyOptionsForRoomAvailability(room).map(
    getGuestsFromOccupancy,
  );
  const min = Math.min(...options);
  const max = Math.max(...options);

  if (min === max) return `${max} huésped${max > 1 ? "es" : ""}`;
  return `${min} a ${max} huéspedes`;
}

function sourceIcon(source: ReservationSource) {
  if (source === "WhatsApp") return MessageCircle;
  if (source === "Llamada") return Phone;
  if (source === "Correo") return CalendarClock;
  return UserRound;
}

function guestStayCount(
  guestId: string,
  reservations: { guestId: string; status: string }[],
) {
  return reservations.filter(
    (reservation) =>
      reservation.guestId === guestId &&
      !["cancelada", "no-show"].includes(reservation.status),
  ).length;
}

function storeRoomTypeToLocal(
  room: StoreRoom,
  roomTypes: StoreRoomType[],
): RoomType {
  const type = roomTypes.find((item) => item.id === room.typeId);
  const name = normalizeGuestText(type?.name ?? "");
  return name.includes("jr") || name.includes("suite")
    ? "Jr. Suite"
    : "Estándar";
}

function storeRoomStatusToLocal(
  status: StoreRoom["status"],
): RoomAvailability["status"] {
  if (status === "ready-for-check-in") return "Lista para check-in";
  if (status === "ocupada") return "Ocupada";
  if (status === "reservada") return "Reservada";
  if (status === "limpieza" || status === "mantenimiento") return "Limpieza";
  return "Disponible";
}

function storeReservationStatusToLocal(
  status: StoreReservation["status"],
): ReservationStatus {
  if (status === "pendiente") return "Pre-reserva";
  if (status === "ready-for-check-in") return "Lista para check-in";
  if (status === "checkout") return "Checkout";
  if (status === "cancelada" || status === "no-show") return "Cancelada";
  if (status === "in-house") return "Ocupada";
  return "Reservada";
}

function storeSourceToLocal(
  source: StoreReservation["source"],
): ReservationSource {
  if (
    source === "booking" ||
    source === "expedia" ||
    source === "airbnb" ||
    source === "agencia"
  )
    return "Correo";
  if (source === "corporativo") return "Correo";
  return "Presencial";
}

function localSourceToStore(
  source: ReservationSource,
): StoreReservation["source"] {
  if (source === "Correo") return "agencia";
  return "directo";
}

function storeRateTypeToLocal(
  rateType: StoreReservation["rateType"],
  source: StoreReservation["source"],
): RateType {
  if (rateType === "manual") return "Manual con autorización";
  if (rateType === "corporativa" || source === "corporativo")
    return "Corporativa";
  return "Normal";
}

function localRateTypeToStore(
  rateType: RateType,
): StoreReservation["rateType"] {
  if (rateType === "Manual con autorización") return "manual";
  if (rateType === "Corporativa") return "corporativa";
  return "normal";
}

function storePaymentMethodToLocal(
  method: SplitPaymentMethod | undefined,
): PaymentMethod {
  if (method === "tarjeta") return "Tarjeta";
  if (method === "transferencia") return "Transferencia";
  if (method === "deposito") return "Depósito";
  if (method === "credito") return "Crédito";
  return "Efectivo";
}

function roomAvailabilityFromStore(
  room: StoreRoom,
  roomTypes: StoreRoomType[],
): RoomAvailability {
  const type = roomTypes.find((item) => item.id === room.typeId);
  const maxOccupancy =
    room.maxOccupancy ??
    (Math.max(0, ...(room.occupancyOptions ?? [])) || type?.capacity);

  return {
    number: room.number,
    type: storeRoomTypeToLocal(room, roomTypes),
    status: storeRoomStatusToLocal(room.status),
    maxOccupancy,
    occupancyOptions: room.occupancyOptions,
    rateOptions: room.rateOptions,
    specificRates: room.specificRates,
  };
}

function reservationFromStore(
  reservation: StoreReservation,
  guests: Guest[],
  rooms: StoreRoom[],
  roomTypes: StoreRoomType[],
): Reservation {
  const guest = guests.find((item) => item.id === reservation.guestId);
  const room = rooms.find((item) => item.id === reservation.roomId);
  const roomType = room ? storeRoomTypeToLocal(room, roomTypes) : "Estándar";
  const people = Math.max(1, reservation.adults + reservation.children);
  const primaryPayment = reservation.payments?.[0];

  return {
    id: reservation.id,
    reservationRoomId: reservation.reservationRoomId,
    code: reservation.code,
    guestId: reservation.guestId,
    guestName: guest?.name ?? "Cliente sin nombre",
    dpi: guest?.document ?? "",
    nit: guest?.nit ?? "CF",
    phone: guest?.phone ?? "",
    email: guest?.email ?? "",
    source: storeSourceToLocal(reservation.source),
    roomType,
    roomNumber: room?.number ?? "",
    occupancy: occupancyFromGuests(people),
    guests: people,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    nights: reservation.nights,
    rateType: storeRateTypeToLocal(reservation.rateType, reservation.source),
    nightlyRate: reservation.rate,
    total: reservation.total,
    paid: reservation.paid,
    paymentMethod: storePaymentMethodToLocal(primaryPayment?.method),
    paymentReference: paymentReferenceSummary(reservation.payments ?? []),
    payments: reservation.payments ?? [],
    status: storeReservationStatusToLocal(reservation.status),
    notes: reservation.notes ?? "",
    createdBy: "Sistema",
    createdAt: reservation.createdAt,
    billingStatus: reservation.billingStatus,
    lastInvoiceId: reservation.lastInvoiceId,
    invoicedAmount: reservation.invoicedAmount,
    pendingToInvoiceAmount: reservation.pendingToInvoiceAmount,
  };
}

function guestIsFrequent(_guest: Guest, stayCount: number) {
  return stayCount >= 3;
}

function normalizeGuestText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const roomNumberCollator = new Intl.Collator("es-GT", {
  numeric: true,
  sensitivity: "base",
});

function compareRoomNumbers(a: string, b: string) {
  const numericA = Number(a);
  const numericB = Number(b);
  const bothAreNumbers = Number.isFinite(numericA) && Number.isFinite(numericB);

  if (bothAreNumbers && numericA !== numericB) return numericA - numericB;
  return roomNumberCollator.compare(a, b);
}

function compareRoomAvailability(a: RoomAvailability, b: RoomAvailability) {
  return compareRoomNumbers(a.number, b.number);
}

function creditHealthForAccount(account: CreditAccount): GuestCreditHealth {
  if (account.creditStatus === "bloqueado") return "bloqueado";
  if (account.creditStatus === "pausado") return "pausado";
  if (account.creditStatus === "autorizado") return "autorizado";
  if (account.status === "vencido") return "vencido";
  if (account.balance >= account.limit) return "sin credito";
  if (account.status === "por vencer") return "por vencer";
  return "al dia";
}

function creditLabel(credit: GuestCreditInfo) {
  const available = money(credit.available);
  if (credit.health === "bloqueado")
    return `Credito bloqueado · queda ${available}`;
  if (credit.health === "pausado")
    return `Credito pausado · queda ${available}`;
  if (credit.health === "vencido")
    return `Credito vencido · queda ${available}`;
  if (credit.health === "sin credito") return "Sin credito disponible";
  if (credit.health === "autorizado")
    return `Credito autorizado · queda ${available}`;
  if (credit.health === "por vencer")
    return `Credito por vencer · queda ${available}`;
  return `Credito disponible · queda ${available}`;
}

function creditDisabledReason(credit?: GuestCreditInfo) {
  if (!credit) return undefined;
  if (credit.health === "bloqueado") return "Credito bloqueado";
  if (credit.health === "pausado") return "Credito pausado";
  if (credit.health === "vencido") return "Credito vencido";
  if (credit.health === "sin credito") return "Sin credito disponible";
  if (credit.available <= 0) return "Sin credito disponible";
  return undefined;
}

function paymentCardCreditInfo(credit?: GuestCreditInfo) {
  if (!credit) return undefined;
  return {
    available: Math.max(0, credit.available),
    limit: credit.limit,
    balance: credit.balance,
    disabledReason: creditDisabledReason(credit),
    label: `Limite ${money(credit.limit)} · usado ${money(credit.balance)} · vence ${credit.dueDate}`,
  };
}

function creditBadgeClass(health: GuestCreditHealth) {
  if (health === "al dia" || health === "autorizado")
    return "border-blue-200 bg-blue-50 text-blue-800";
  if (health === "por vencer")
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (health === "vencido" || health === "bloqueado")
    return "border-red-200 bg-red-50 text-red-800";
  return "border-zinc-300 bg-zinc-100 text-zinc-800";
}

function reservationPaymentMethod(method?: SplitPaymentMethod): PaymentMethod {
  if (method === "efectivo") return "Efectivo";
  if (method === "tarjeta") return "Tarjeta";
  if (method === "transferencia") return "Transferencia";
  if (method === "deposito") return "Depósito";
  if (method === "credito") return "Crédito";
  return "Transferencia";
}

function paymentReferenceSummary(payments: PaymentRecord[]) {
  return payments
    .map((payment) => {
      const reference = payment.reference?.trim();
      return reference
        ? `${paymentMethodLabel(payment.method)} ${reference}`
        : paymentMethodLabel(payment.method);
    })
    .join(" / ");
}

function paymentBreakdownText(payments: PaymentRecord[]) {
  if (payments.length === 0) return "sin abonos registrados";
  return payments
    .map(
      (payment) =>
        `${paymentMethodLabel(payment.method)} ${money(payment.amount)}`,
    )
    .join(", ");
}

function printReservationReceipt(
  reservation: Reservation,
  payment?: PaymentRecord,
) {
  const amount = payment ? Number(payment.amount || 0) : reservation.paid;
  if (amount <= 0) {
    toast.error("No hay monto para imprimir recibo.");
    return;
  }

  printSimpleReceipt({
    title: "Recibo simple de reserva",
    code: reservation.code,
    customer: reservation.guestName,
    concept: payment
      ? `Abono de reserva habitación ${reservation.roomNumber}`
      : `Abonos de reserva habitación ${reservation.roomNumber}`,
    amount,
    method: payment
      ? paymentMethodLabel(payment.method)
      : reservation.paymentMethod,
    reference: payment?.reference ?? reservation.paymentReference,
    date: payment?.date ?? reservation.createdAt,
    receivedBy: reservation.createdBy,
    details: [
      {
        label: "Habitación",
        value: `${reservation.roomNumber} - ${reservation.roomType}`,
      },
      {
        label: "Fechas",
        value: `${formatDate(reservation.checkIn)} a ${formatDate(reservation.checkOut)}`,
      },
      { label: "Total reserva", value: money(reservation.total) },
      {
        label: "Saldo",
        value: money(Math.max(reservation.total - reservation.paid, 0)),
      },
    ],
  });
}

function reservationHasCashPayment(reservation: Reservation) {
  return (
    reservation.payments.some(
      (payment) =>
        payment.method === "efectivo" && Number(payment.amount || 0) > 0,
    ) ||
    (reservation.paymentMethod === "Efectivo" && reservation.paid > 0)
  );
}

function reservationInvoiceDisplayAmounts(reservation: Reservation) {
  const paymentInvoicedAmount = roundCurrency(
    reservation.payments.reduce(
      (sum, payment) => sum + reservationPaymentInvoicedAmount(payment),
      0,
    ),
  );
  const paymentPendingAmount = reservationInvoiceablePaymentTotal(
    reservation.payments,
  );

  return {
    invoiced:
      reservation.payments.length > 0
        ? paymentInvoicedAmount
        : (reservation.invoicedAmount ?? 0),
    pending:
      reservation.payments.length > 0
        ? paymentPendingAmount
        : (reservation.pendingToInvoiceAmount ?? 0),
  };
}

function allocatePaymentsToRooms(
  payments: PaymentRecord[],
  roomTotals: number[],
): PaymentRecord[][] {
  const remainingPayments = payments.map((payment) => ({
    ...payment,
    amount: Number(payment.amount || 0),
  }));

  return roomTotals.map((roomTotal, roomIndex) => {
    let remainingRoomTotal = roomTotal;
    const roomPayments: PaymentRecord[] = [];

    for (const payment of remainingPayments) {
      if (remainingRoomTotal <= 0) break;
      if (payment.amount <= 0) continue;

      const amount = Math.min(payment.amount, remainingRoomTotal);
      payment.amount -= amount;
      remainingRoomTotal -= amount;

      roomPayments.push({
        ...payment,
        id: `${payment.id}-room-${roomIndex}`,
        amount,
      });
    }

    return roomPayments;
  });
}

function guestPriority(guest: GuestOption) {
  if (guest.credit) return 0;
  if (guest.frequent) return 1;
  return 2;
}

function guestSearchText(guest: GuestOption) {
  return [
    guest.id,
    guest.guestName,
    guest.dpi,
    guest.nit,
    guest.phone,
    guest.email,
    guest.country,
    guest.department,
    guest.frequent ? "frecuente vip" : "comun normal",
    guest.credit
      ? `credito al credito ${guest.credit.company} ${creditLabel(guest.credit)}`
      : "",
  ].join(" ");
}

function StatusBadge({
  status,
}: {
  status: ReservationStatus | RoomAvailability["status"];
}) {
  const styles: Record<string, string> = {
    "Pre-reserva": "border-amber-200 bg-amber-50 text-amber-700",
    Confirmada: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Reservada: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Lista para check-in": "border-blue-200 bg-blue-50 text-blue-700",
    Ocupada: "border-blue-200 bg-blue-50 text-blue-700",
    Checkout: "border-sky-200 bg-sky-50 text-sky-700",
    Cancelada: "border-red-200 bg-red-50 text-red-700",
    Disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

function BillingStatusBadge({ status }: { status?: ReservationBillingStatus }) {
  if (!status) return null;

  const styles: Record<ReservationBillingStatus, string> = {
    NoFacturada: "border-zinc-200 bg-zinc-50 text-zinc-700",
    Parcial: "border-amber-200 bg-amber-50 text-amber-800",
    Facturada: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  const labels: Record<ReservationBillingStatus, string> = {
    NoFacturada: "No facturada",
    Parcial: "Facturada parcial",
    Facturada: "Facturada",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
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
  icon: typeof CalendarCheck;
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
    <section className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mobile-safe-text mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="min-w-0 xl:max-w-[55%]">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
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

function MoneyTextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
        Q.
      </span>
      <TextInput
        {...props}
        type="number"
        className={`pl-10 tabular-nums ${className ?? ""}`}
      />
    </div>
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
        props.className ?? ""
      }`}
    />
  );
}

function plannerReservationStyle(
  reservation: Reservation,
  room: RoomAvailability,
) {
  const isCurrentStay =
    room.status === "Ocupada" && dateInReservation(reservation, todayIso());

  if (reservation.status === "Checkout") {
    return "border-blue-500/30 bg-blue-600 text-white shadow-blue-900/20";
  }

  if (isCurrentStay) {
    return "border-rose-500/30 bg-rose-500 text-white shadow-rose-900/20";
  }

  if (
    reservation.status === "Lista para check-in" ||
    reservation.status === "Ocupada"
  ) {
    return "border-blue-500/30 bg-blue-600 text-white shadow-blue-900/20";
  }

  if (reservation.paid > 0) {
    return "border-emerald-600/30 bg-emerald-600 text-white shadow-emerald-900/20";
  }

  return "border-amber-500/30 bg-amber-500 text-white shadow-amber-900/20";
}

function plannerReservationLabel(
  reservation: Reservation,
  room: RoomAvailability,
) {
  if (reservation.status === "Checkout") return "Checkout realizado";
  if (room.status === "Ocupada" && dateInReservation(reservation, todayIso())) {
    return "Ocupada";
  }
  if (reservation.status === "Ocupada") return "Ocupada";
  if (reservation.status === "Lista para check-in")
    return "Lista para check-in";
  if (reservation.paid > 0) return "Reservada con abono";
  return "Reservada sin abono";
}

function PlannerReservationDetails({
  reservation,
  room,
}: {
  reservation: Reservation;
  room: RoomAvailability;
}) {
  const balance = Math.max(0, reservation.total - reservation.paid);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {reservation.guestName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {reservation.code}
            </p>
          </div>
          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold">
            {plannerReservationLabel(reservation, room)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Habitación</p>
          <p className="mt-1 font-semibold">
            {room.number} · {room.type}
          </p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Personas</p>
          <p className="mt-1 font-semibold">{reservation.occupancy}</p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Entrada</p>
          <p className="mt-1 font-semibold">
            {formatDate(reservation.checkIn)}
          </p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">
            {reservation.status === "Checkout" ? "Checkout" : "Salida"}
          </p>
          <p className="mt-1 font-semibold">
            {formatDate(reservation.checkOut)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Noches</p>
          <p className="mt-1 font-semibold">{reservation.nights}</p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Abono</p>
          <p className="mt-1 font-semibold">{money(reservation.paid)}</p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Saldo</p>
          <p className="mt-1 font-semibold">{money(balance)}</p>
        </div>
      </div>

      {reservation.notes ? (
        <p className="rounded-2xl border bg-muted/20 p-2.5 text-xs text-muted-foreground">
          {reservation.notes}
        </p>
      ) : null}
      {reservation.status === "Checkout" ? (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-2.5 text-xs font-medium text-blue-900">
          Estancia cerrada. Se conserva en el mapa para auditar cuándo se usó la
          habitación.
        </p>
      ) : null}
    </div>
  );
}

function PlannerCleaningDetails({
  room,
  date,
}: {
  room: RoomAvailability;
  date: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Habitación en limpieza</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Bloqueo operativo para {formatPlannerDay(date)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border bg-muted/20 p-2.5">
          <p className="text-muted-foreground">Habitación</p>
          <p className="mt-1 font-semibold">
            {room.number} · {room.type}
          </p>
        </div>
        <div className="rounded-2xl border bg-violet-50 p-2.5 text-violet-900">
          <p className="text-violet-700">Estado</p>
          <p className="mt-1 font-semibold">Limpieza</p>
        </div>
      </div>
      <p className="rounded-2xl border bg-muted/20 p-2.5 text-xs text-muted-foreground">
        Cuando la camarera cambie la habitación a disponible en Habitaciónes,
        esta marca morada desaparece del mapa.
      </p>
    </div>
  );
}

function usePlannerMetrics() {
  const [metrics, setMetrics] = useState(plannerDesktopMetrics);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setMetrics(plannerCompactMetrics);
        return;
      }
      if (width < 1440) {
        setMetrics(plannerLaptopMetrics);
        return;
      }
      setMetrics(plannerDesktopMetrics);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return metrics;
}

function PlannerBoard({
  rooms,
  reservations,
  cleaningBlocks,
  dates,
  selectedCells,
  cartCells,
  onCellSet,
  onCartCellRemove,
  onSendSelection,
  onClearSelection,
  onReservationOpen,
  onReservationExtend,
}: {
  rooms: RoomAvailability[];
  reservations: Reservation[];
  cleaningBlocks: CleaningBlock[];
  dates: string[];
  selectedCells: string[];
  cartCells: string[];
  onCellSet: (roomNumber: string, date: string, selected: boolean) => void;
  onCartCellRemove: (roomNumber: string, date: string) => void;
  onSendSelection: () => void;
  onClearSelection: () => void;
  onReservationOpen: (reservation: Reservation) => void;
  onReservationExtend: (
    reservation: Reservation,
    newCheckOut: string,
  ) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "remove" | "cart-remove">(
    "select",
  );
  const [extensionDragging, setExtensionDragging] = useState(false);
  const extensionDraggingRef = useRef(false);
  const extensionHandleOffsetRef = useRef(22);
  const extensionPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const extensionAnimationFrameRef = useRef<number | null>(null);
  const extensionRowRectRef = useRef<DOMRect | null>(null);
  const extensionLastRenderKeyRef = useRef<string>("");
  const extensionDraftRef = useRef<PlannerExtensionDraft | null>(null);
  const [extensionDraft, setExtensionDraft] =
    useState<PlannerExtensionDraft | null>(null);
  const { dayWidth, roomWidth, rowHeight } = usePlannerMetrics();
  const selectedSet = new Set(selectedCells);
  const cartSet = new Set(cartCells);
  const cleaningSet = new Set(
    cleaningBlocks.map((block) => cellKey(block.roomNumber, block.date)),
  );
  const firstDate = dates[0];
  const lastCheckout = addDaysIso(dates[dates.length - 1], 1);
  const today = todayIso();
  const hasHistoricalDates = dates.some((date) => date < today);

  useEffect(() => {
    extensionDraftRef.current = extensionDraft;
  }, [extensionDraft]);

  function canExtendReservation(reservation: Reservation) {
    return !["Cancelada", "Checkout"].includes(reservation.status);
  }

  function reservationCheckoutOnDate(roomNumber: string, date: string) {
    const currentDate = dateOnlyIso(date);
    return reservations.find(
      (reservation) =>
        reservation.roomNumber === roomNumber &&
        reservation.status !== "Cancelada" &&
        dateOnlyIso(reservation.checkOut) === currentDate,
    );
  }

  function isTurnoverCleaning(roomNumber: string, date: string) {
    return (
      cleaningSet.has(cellKey(roomNumber, date)) &&
      Boolean(reservationCheckoutOnDate(roomNumber, date))
    );
  }

  function getExtensionElement(
    kind: "reservation" | "handle" | "badge",
    reservationId: string,
  ) {
    const attribute = `data-extension-${kind}`;
    return (
      Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
        (element) => element.getAttribute(attribute) === reservationId,
      ) ?? null
    );
  }

  function applyExtensionDomPreview(
    draft: PlannerExtensionDraft,
    previewEndPx: number,
  ) {
    const reservationId = draft.reservation.id;
    const startIndex = Math.max(
      0,
      daysOffset(firstDate, draft.reservation.checkIn),
    );
    const reservationLeft = startIndex * dayWidth + 6;
    const maxGridWidth = dates.length * dayWidth;
    const width = Math.max(42, previewEndPx - reservationLeft);
    const handleLeft = Math.min(
      Math.max(0, previewEndPx - 44),
      Math.max(0, maxGridWidth - 44),
    );
    const extraNights = Math.max(
      0,
      daysOffset(draft.reservation.checkOut, draft.newCheckOut),
    );
    const controlsLeft = Math.min(
      Math.max(0, handleLeft),
      Math.max(0, maxGridWidth - 220),
    );

    const reservationElement = getExtensionElement(
      "reservation",
      reservationId,
    );
    if (reservationElement) {
      reservationElement.style.width = `${width}px`;
      reservationElement.style.transition = "none";
    }

    const handleElement = getExtensionElement("handle", reservationId);
    if (handleElement) {
      handleElement.style.left = `${handleLeft}px`;
      handleElement.style.transition = "none";
    }

    const badgeElement = getExtensionElement("badge", reservationId);
    if (badgeElement) {
      if (extraNights > 0) {
        badgeElement.style.display = "flex";
        badgeElement.style.left = `${controlsLeft}px`;
        badgeElement.textContent = `+${extraNights} noche${extraNights === 1 ? "" : "s"}`;
      } else {
        badgeElement.style.display = "none";
      }
    }
  }

  function extensionConflict(
    reservation: Reservation,
    newCheckOutDate: string,
  ) {
    const newCheckOut = dateOnlyIso(newCheckOutDate);
    const checkout = dateOnlyIso(reservation.checkOut);

    if (newCheckOut < checkout) {
      return "La extensión debe empezar desde el día de checkout actual.";
    }

    const nightsToAdd = Math.max(0, daysOffset(checkout, newCheckOut));
    const extensionDates = dateRange(checkout, nightsToAdd);

    for (const date of extensionDates) {
      if (date < today) return "No se puede extender hacia fechas históricas.";

      const checkoutReservation = reservationCheckoutOnDate(
        reservation.roomNumber,
        date,
      );
      const ownCheckoutCleaning =
        date === checkout && checkoutReservation?.id === reservation.id;

      if (
        cleaningSet.has(cellKey(reservation.roomNumber, date)) &&
        !ownCheckoutCleaning
      ) {
        return `La habitación ${reservation.roomNumber} está en limpieza el ${formatDate(date)}.`;
      }

      if (cartSet.has(cellKey(reservation.roomNumber, date))) {
        return `La habitación ${reservation.roomNumber} ya está en el carrito el ${formatDate(date)}.`;
      }

      const blockingReservation = reservations.find(
        (other) =>
          other.id !== reservation.id &&
          other.roomNumber === reservation.roomNumber &&
          dateInReservation(other, date),
      );

      if (blockingReservation) {
        return `La habitación ${reservation.roomNumber} ya tiene otra reserva el ${formatDate(date)}.`;
      }
    }

    return null;
  }

  function startExtensionDrag(
    reservation: Reservation,
    event?: React.PointerEvent<HTMLElement>,
  ) {
    if (!canExtendReservation(reservation)) {
      toast.error("No se puede extender esta reserva.", {
        description:
          "Solo se pueden extender reservas activas o huéspedes hospedados.",
      });
      return;
    }

    const checkoutIndex = daysOffset(firstDate, reservation.checkOut);
    const initialEndPx = Math.min(
      dates.length * dayWidth,
      Math.max(0, (checkoutIndex + 1) * dayWidth),
    );

    if (event) {
      const handleRect = event.currentTarget.getBoundingClientRect();
      const rowElement = event.currentTarget.closest<HTMLElement>(
        "[data-planner-grid-row]",
      );
      extensionRowRectRef.current = rowElement?.getBoundingClientRect() ?? null;
      extensionHandleOffsetRef.current = Math.min(
        44,
        Math.max(0, event.clientX - handleRect.left),
      );
    } else {
      extensionRowRectRef.current = null;
      extensionHandleOffsetRef.current = 22;
    }

    const initialDraft = {
      reservation,
      newCheckOut: dateOnlyIso(reservation.checkOut),
      conflict: null,
      previewEndPx: initialEndPx,
    };

    extensionDraggingRef.current = true;
    extensionDraftRef.current = initialDraft;
    extensionPointerRef.current = null;
    extensionLastRenderKeyRef.current = `${reservation.id}|${dateOnlyIso(reservation.checkOut)}|`;
    setDragging(false);
    onClearSelection();
    setExtensionDragging(true);
    setExtensionDraft(initialDraft);
  }

  function updateExtensionDraft(
    roomNumber: string,
    date: string,
    previewEndPx?: number,
  ) {
    const currentDraft = extensionDraftRef.current;
    if (!extensionDraggingRef.current || !currentDraft) return;
    if (roomNumber !== currentDraft.reservation.roomNumber) return;

    const checkout = dateOnlyIso(currentDraft.reservation.checkOut);
    const targetDate = dateOnlyIso(date);
    const nextCheckOut = targetDate <= checkout ? checkout : targetDate;
    const conflict =
      nextCheckOut > checkout
        ? extensionConflict(currentDraft.reservation, nextCheckOut)
        : null;
    const nextPreviewEndPx =
      typeof previewEndPx === "number"
        ? previewEndPx
        : currentDraft.previewEndPx;

    const nextDraft = {
      reservation: currentDraft.reservation,
      newCheckOut: nextCheckOut,
      conflict,
      previewEndPx: nextPreviewEndPx,
    };

    extensionDraftRef.current = nextDraft;

    if (
      typeof nextPreviewEndPx === "number" &&
      Number.isFinite(nextPreviewEndPx)
    ) {
      applyExtensionDomPreview(nextDraft, nextPreviewEndPx);
    }

    // Durante el drag no dejamos que React repinte la tabla por cada cambio de celda.
    // El preview vivo lo mueve el DOM directo; React solo se sincroniza al soltar.
    if (extensionDraggingRef.current) return;

    const renderKey = `${nextDraft.reservation.id}|${nextCheckOut}|${conflict ?? ""}`;
    if (extensionLastRenderKeyRef.current === renderKey) return;

    extensionLastRenderKeyRef.current = renderKey;
    setExtensionDraft(nextDraft);
  }

  function updateExtensionFromPointer(clientX: number, clientY: number) {
    try {
      const currentDraft = extensionDraftRef.current;
      if (!extensionDraggingRef.current || !currentDraft) return;

      const roomNumber = currentDraft.reservation.roomNumber;
      const rowRect = extensionRowRectRef.current;
      if (!rowRect || !dates.length || dayWidth <= 0) return;

      const checkout = dateOnlyIso(currentDraft.reservation.checkOut);
      const checkoutIndex = daysOffset(firstDate, checkout);
      if (!Number.isFinite(checkoutIndex)) return;

      const maxEndPx = dates.length * dayWidth;
      const minEndPx = Math.min(
        maxEndPx,
        Math.max(0, (checkoutIndex + 1) * dayWidth),
      );
      const rawHandleLeft =
        clientX - rowRect.left - extensionHandleOffsetRef.current;
      const handleLeft = Math.min(
        Math.max(minEndPx - 44, rawHandleLeft),
        Math.max(0, maxEndPx - 44),
      );
      const previewEndPx = Math.min(
        maxEndPx,
        Math.max(minEndPx, handleLeft + 44),
      );
      if (!Number.isFinite(previewEndPx)) return;

      const rawSnapIndex = Math.ceil(previewEndPx / dayWidth) - 1;
      const snapIndex = Math.min(
        dates.length - 1,
        Math.max(checkoutIndex, rawSnapIndex),
      );
      const snappedCheckOut =
        snapIndex <= checkoutIndex ? checkout : (dates[snapIndex] ?? checkout);

      updateExtensionDraft(roomNumber, snappedCheckOut, previewEndPx);
    } catch (error) {
      console.error("Error actualizando extensión de reserva", error);
      cancelExtensionDrag();
      toast.error("Se canceló la extensión.", {
        description:
          "El movimiento salió del rango válido del mapa. Intenta de nuevo.",
      });
    }
  }

  useEffect(() => {
    if (!extensionDragging) return;

    const flushExtensionPointer = () => {
      extensionAnimationFrameRef.current = null;
      const pointer = extensionPointerRef.current;
      if (!pointer) return;
      updateExtensionFromPointer(pointer.clientX, pointer.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      extensionPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (extensionAnimationFrameRef.current !== null) return;
      extensionAnimationFrameRef.current = window.requestAnimationFrame(
        flushExtensionPointer,
      );
    };
    const handlePointerUp = (event: PointerEvent) => {
      extensionPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      updateExtensionFromPointer(event.clientX, event.clientY);
      finishExtensionDrag();
    };
    const handlePointerCancel = () => cancelExtensionDrag();

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (extensionAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(extensionAnimationFrameRef.current);
        extensionAnimationFrameRef.current = null;
      }
    };
  }, [extensionDragging]);

  function clearExtensionPointerFrame() {
    extensionPointerRef.current = null;
    if (extensionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(extensionAnimationFrameRef.current);
      extensionAnimationFrameRef.current = null;
    }
  }

  function finishExtensionDrag() {
    if (!extensionDraggingRef.current && !extensionDragging) return;
    const latestDraft = extensionDraftRef.current;
    extensionDraggingRef.current = false;
    extensionRowRectRef.current = null;
    extensionLastRenderKeyRef.current = "";
    clearExtensionPointerFrame();
    setDragging(false);
    setExtensionDragging(false);
    onClearSelection();

    if (!latestDraft) {
      extensionDraftRef.current = null;
      setExtensionDraft(null);
      return;
    }

    if (latestDraft.conflict) {
      const nextDraft = {
        reservation: latestDraft.reservation,
        newCheckOut: latestDraft.newCheckOut,
        conflict: latestDraft.conflict,
      };
      extensionDraftRef.current = nextDraft;
      setExtensionDraft(nextDraft);
      return;
    }

    if (latestDraft.newCheckOut <= latestDraft.reservation.checkOut) {
      extensionDraftRef.current = null;
      setExtensionDraft(null);
      return;
    }

    const nextDraft = {
      reservation: latestDraft.reservation,
      newCheckOut: latestDraft.newCheckOut,
      conflict: null,
    };
    extensionDraftRef.current = nextDraft;
    setExtensionDraft(nextDraft);
  }

  function applyExtensionDraft() {
    const draft = extensionDraft;
    if (!draft) return;
    if (draft.conflict) {
      toast.error("No se puede extender la estancia.", {
        description: draft.conflict,
      });
      return;
    }
    if (draft.newCheckOut <= draft.reservation.checkOut) {
      setExtensionDraft(null);
      return;
    }

    extensionDraggingRef.current = false;
    extensionDraftRef.current = null;
    extensionRowRectRef.current = null;
    extensionLastRenderKeyRef.current = "";
    clearExtensionPointerFrame();
    setExtensionDraft(null);
    setDragging(false);
    setExtensionDragging(false);
    onClearSelection();
    void onReservationExtend(draft.reservation, draft.newCheckOut);
  }

  function cancelExtensionDrag() {
    extensionDraggingRef.current = false;
    extensionDraftRef.current = null;
    extensionRowRectRef.current = null;
    extensionLastRenderKeyRef.current = "";
    clearExtensionPointerFrame();
    setDragging(false);
    setExtensionDragging(false);
    setExtensionDraft(null);
    onClearSelection();
  }

  return (
    <div className="overflow-hidden rounded-3xl border bg-background shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Leyenda del mapa</p>
            {hasHistoricalDates ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                Histórico activo
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            El color vive en el calendario por fecha; una habitación puede estar
            ocupada solo algunos días y libre en los demás.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
            Verde: con abono
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
            Amarillo: reservado sin abono
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-800">
            Rojo: ocupada
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">
            Azul: checkout/lista
          </span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800">
            Morado: limpieza
          </span>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-800">
            Turquesa: en carrito
          </span>
        </div>
      </div>
      <div
        className="touch-scroll max-h-[70vh] overflow-auto"
        onPointerLeave={() => {
          setDragging(false);

          if (extensionDraggingRef.current || extensionDragging) {
            cancelExtensionDrag();
          }
        }}
        onPointerUp={finishExtensionDrag}
        onPointerCancel={() => {
          setDragging(false);
          cancelExtensionDrag();
        }}
      >
        <div
          className="min-w-fit"
          style={{ width: roomWidth + dates.length * dayWidth }}
        >
          <div className="sticky top-0 z-30 flex border-b bg-background/95 shadow-sm backdrop-blur">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-background px-3 py-3 sm:px-4"
              style={{ width: roomWidth }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Habitaciónes
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {rooms.length} cuartos
                </p>
              </div>
            </div>
            <div
              className="grid shrink-0"
              style={{
                width: dates.length * dayWidth,
                gridTemplateColumns: `repeat(${dates.length}, ${dayWidth}px)`,
              }}
            >
              {dates.map((date) => {
                const weekend = [0, 6].includes(
                  new Date(`${date}T00:00:00`).getDay(),
                );
                const isPastDate = date < today;
                return (
                  <div
                    key={date}
                    className={cn(
                      "border-r px-2 py-3 text-xs sm:px-3 sm:text-sm",
                      date === today
                        ? "bg-primary/10 text-primary"
                        : isPastDate
                          ? "bg-slate-50 text-muted-foreground"
                          : weekend
                            ? "bg-muted/50"
                            : "bg-background",
                    )}
                  >
                    <p className="truncate font-semibold capitalize">
                      {formatPlannerDay(date)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {date === today
                        ? "Hoy"
                        : isPastDate
                          ? "Histórico"
                          : formatDateShort(date)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="flex border-b">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-background px-3 sm:px-4"
                style={{ width: roomWidth, minHeight: rowHeight * 2 }}
              >
                <p className="text-sm font-semibold text-muted-foreground">
                  Sin cuartos
                </p>
              </div>
              <div
                className="flex shrink-0 items-center justify-center p-6 text-center"
                style={{
                  width: dates.length * dayWidth,
                  minHeight: rowHeight * 2,
                }}
              >
                <div className="max-w-md text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    No hay habitaciones registradas para pintar el mapa.
                  </p>
                  <p className="mt-1">
                    Crea las habitaciones en el catálogo y luego vuelve a
                    reservaciones.
                  </p>
                  <Link
                    to="/habitaciónes"
                    className="mt-3 inline-flex rounded-full border px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    Ir a habitaciones
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            rooms.map((room) => {
              const roomReservations = reservations
                .filter(
                  (reservation) =>
                    reservation.roomNumber === room.number &&
                    reservation.status !== "Cancelada" &&
                    reservation.checkOut > firstDate &&
                    reservation.checkIn < lastCheckout,
                )
                .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
              const roomHasCheckoutMarker = dates.some((date) =>
                Boolean(reservationCheckoutOnDate(room.number, date)),
              );
              const roomHasExtensionDraft =
                extensionDraft?.reservation.roomNumber === room.number;
              const rowMinHeight =
                rowHeight +
                (roomHasExtensionDraft ? 82 : roomHasCheckoutMarker ? 38 : 0);

              return (
                <div
                  key={room.number}
                  className="flex border-b last:border-b-0"
                >
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background px-3 sm:gap-3 sm:px-4"
                    style={{ width: roomWidth, minHeight: rowMinHeight }}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-2xl border bg-muted/30 text-base font-bold sm:size-11 sm:text-lg">
                      {room.number}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {room.type}
                      </p>
                    </div>
                  </div>

                  <div
                    data-planner-grid-row={room.number}
                    className="relative grid shrink-0"
                    style={{
                      width: dates.length * dayWidth,
                      minHeight: rowMinHeight,
                      gridTemplateColumns: `repeat(${dates.length}, ${dayWidth}px)`,
                    }}
                  >
                    {dates.map((date) => {
                      const checkoutReservation = reservationCheckoutOnDate(
                        room.number,
                        date,
                      );
                      const cleaning = cleaningSet.has(
                        cellKey(room.number, date),
                      );
                      const turnoverCleaning =
                        cleaning && Boolean(checkoutReservation);
                      const cleaningBlocksCell = cleaning && !turnoverCleaning;
                      const occupiedNight = roomReservations.some(
                        (reservation) => dateInReservation(reservation, date),
                      );
                      const busy = occupiedNight || cleaningBlocksCell;
                      const isPastDate = date < today;
                      const key = cellKey(room.number, date);
                      const extensionActiveForRoom =
                        extensionDraft?.reservation.roomNumber === room.number;
                      const selected =
                        !extensionActiveForRoom && selectedSet.has(key);
                      const inCart = cartSet.has(key);
                      const inExtensionDraft =
                        !extensionDragging &&
                        extensionActiveForRoom &&
                        date >= extensionDraft.reservation.checkOut &&
                        date < extensionDraft.newCheckOut;
                      const locked = busy || isPastDate;
                      const weekend = [0, 6].includes(
                        new Date(`${date}T00:00:00`).getDay(),
                      );

                      if (cleaningBlocksCell) {
                        return (
                          <HoverCard key={key} openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <div
                                data-planner-room={room.number}
                                data-planner-date={date}
                                className="relative cursor-default border-r bg-violet-100/80 text-left transition focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                style={{ minHeight: rowMinHeight }}
                                title="Habitación en limpieza"
                              >
                                <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full border border-violet-200 bg-white/70 px-2 py-1 text-center text-[11px] font-semibold text-violet-800 shadow-sm">
                                  Limpieza
                                </span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="right"
                              align="start"
                              className="w-80 max-w-[calc(100vw-1rem)] rounded-3xl p-4 shadow-xl"
                            >
                              <PlannerCleaningDetails room={room} date={date} />
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          data-planner-room={room.number}
                          data-planner-date={date}
                          disabled={locked}
                          aria-pressed={selected}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            if (
                              extensionDraggingRef.current ||
                              extensionDragging
                            )
                              return;
                            if (inCart) {
                              setDragging(true);
                              setDragMode("cart-remove");
                              onCartCellRemove(room.number, date);
                              return;
                            }
                            const nextMode = selected ? "remove" : "select";
                            setDragging(true);
                            setDragMode(nextMode);
                            onCellSet(room.number, date, nextMode === "select");
                          }}
                          onPointerEnter={() => {
                            if (
                              extensionDraggingRef.current ||
                              extensionDragging
                            )
                              return;
                            if (!dragging) return;
                            if (dragMode === "cart-remove") {
                              if (inCart) onCartCellRemove(room.number, date);
                              return;
                            }
                            if (locked || inCart) return;
                            onCellSet(room.number, date, dragMode === "select");
                          }}
                          onPointerUp={() => setDragging(false)}
                          onPointerCancel={() => setDragging(false)}
                          className={cn(
                            "relative border-r text-left transition focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary/40",
                            isPastDate
                              ? "bg-slate-50/80"
                              : turnoverCleaning || checkoutReservation
                                ? "bg-amber-50/60"
                                : weekend
                                  ? "bg-muted/30"
                                  : "bg-background",
                            locked
                              ? "cursor-default"
                              : inCart
                                ? "cursor-pointer hover:bg-teal-100"
                                : "cursor-pointer hover:bg-primary/5",
                            inCart &&
                              !selected &&
                              "bg-teal-100/60 ring-2 ring-inset ring-teal-300/60",
                            inExtensionDraft &&
                              "bg-orange-100/70 ring-2 ring-inset ring-orange-300/70",
                            selected &&
                              "bg-primary/10 ring-2 ring-inset ring-primary/40",
                          )}
                          style={{ minHeight: rowMinHeight }}
                          title={
                            busy
                              ? "Ya existe una reserva, estancia activa o limpieza en esta noche"
                              : turnoverCleaning
                                ? "Checkout 12:00 PM. Puede reservarse para entrada posterior, pero debe limpiarse antes del check-in."
                                : checkoutReservation
                                  ? "Día de checkout. Puede reservarse para entrada posterior a limpieza."
                                  : inExtensionDraft
                                    ? "Nueva noche de extensión pendiente"
                                    : isPastDate
                                      ? "Fecha histórica solo de consulta"
                                      : inCart
                                        ? "Quitar del carrito"
                                        : `Seleccionar ${room.number} para ${formatDate(date)}`
                          }
                        >
                          {selected ? (
                            <span className="absolute bottom-2 left-2 right-2 rounded-full bg-primary px-2 py-1 text-center text-[11px] font-semibold text-primary-foreground">
                              Seleccionado
                            </span>
                          ) : null}
                          {inCart && !selected ? (
                            <span className="absolute bottom-2 left-2 right-2 rounded-full border border-teal-200 bg-white/80 px-2 py-1 text-center text-[11px] font-semibold text-teal-800 shadow-sm">
                              En carrito
                            </span>
                          ) : null}
                        </button>
                      );
                    })}

                    {roomReservations.map((reservation) => {
                      const startIndex = Math.max(
                        0,
                        daysOffset(firstDate, reservation.checkIn),
                      );
                      const draftForReservation =
                        extensionDraft?.reservation.id === reservation.id
                          ? extensionDraft
                          : null;
                      const extraNights = draftForReservation
                        ? Math.max(
                            0,
                            daysOffset(
                              reservation.checkOut,
                              draftForReservation.newCheckOut,
                            ),
                          )
                        : 0;
                      const visibleCheckOut =
                        draftForReservation && extraNights > 0
                          ? draftForReservation.newCheckOut
                          : reservation.checkOut;
                      const checkoutIndex = daysOffset(
                        firstDate,
                        visibleCheckOut,
                      );
                      const visualEndIndex = Math.min(
                        dates.length,
                        Math.max(startIndex + 1, checkoutIndex + 1),
                      );
                      const span = Math.max(1, visualEndIndex - startIndex);
                      const checkoutMarkerVisible =
                        checkoutIndex >= 0 && checkoutIndex < dates.length;
                      const handleVisible = checkoutMarkerVisible;
                      const extendable = canExtendReservation(reservation);
                      const livePreviewEndPx =
                        extensionDragging && draftForReservation?.previewEndPx
                          ? draftForReservation.previewEndPx
                          : null;
                      const reservationLeft = startIndex * dayWidth + 6;
                      const reservationWidth =
                        livePreviewEndPx !== null
                          ? Math.max(42, livePreviewEndPx - reservationLeft)
                          : Math.max(42, span * dayWidth - 12);
                      const handleLeft =
                        livePreviewEndPx !== null
                          ? Math.min(
                              Math.max(0, livePreviewEndPx - 44),
                              Math.max(0, dates.length * dayWidth - 44),
                            )
                          : Math.min(
                              Math.max(0, visualEndIndex * dayWidth - 44),
                              Math.max(0, dates.length * dayWidth - 44),
                            );
                      const checkoutLabelLeft = Math.min(
                        Math.max(0, checkoutIndex * dayWidth + 4),
                        Math.max(0, dates.length * dayWidth - 218),
                      );
                      const checkoutLabelWidth = Math.max(
                        88,
                        Math.min(
                          214,
                          dates.length * dayWidth - checkoutLabelLeft - 4,
                        ),
                      );
                      const checkoutNeedsCleaning = cleaningSet.has(
                        cellKey(room.number, visibleCheckOut),
                      );
                      const checkoutLabel = checkoutNeedsCleaning
                        ? "Salida 12:00 · sucia hasta limpieza"
                        : "Salida 12:00 · limpiar antes de check-in";
                      const controlsLeft = Math.min(
                        Math.max(0, handleLeft),
                        Math.max(0, dates.length * dayWidth - 220),
                      );

                      return (
                        <div key={reservation.id} className="contents">
                          <HoverCard openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                data-extension-reservation={reservation.id}
                                onClick={() => onReservationOpen(reservation)}
                                className={cn(
                                  "absolute top-9 z-10 flex h-9 items-center gap-2 overflow-hidden rounded-full border px-2 text-left text-xs font-semibold shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:px-3",
                                  plannerReservationStyle(reservation, room),
                                  extensionDragging &&
                                    "pointer-events-none transition-none duration-0",
                                  draftForReservation &&
                                    "ring-2 ring-orange-300/80",
                                )}
                                style={{
                                  left: reservationLeft,
                                  width: reservationWidth,
                                }}
                                title={`${reservation.guestName} · ${formatDate(reservation.checkIn)} a ${formatDate(draftForReservation?.newCheckOut ?? reservation.checkOut)}`}
                              >
                                <span className="truncate">
                                  {reservation.guestName}
                                </span>
                                {extraNights > 0 ? (
                                  <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-[10px]">
                                    +{extraNights} noche
                                    {extraNights === 1 ? "" : "s"}
                                  </span>
                                ) : reservation.paid > 0 ? (
                                  <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                                    {money(reservation.paid)}
                                  </span>
                                ) : null}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="top"
                              align="start"
                              className="w-96 max-w-[calc(100vw-1rem)] rounded-3xl p-4 shadow-xl"
                            >
                              <PlannerReservationDetails
                                reservation={reservation}
                                room={room}
                              />
                            </HoverCardContent>
                          </HoverCard>
                          {checkoutMarkerVisible ? (
                            <span
                              className="absolute top-1 z-30 truncate rounded-full border border-amber-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-amber-800 shadow-sm"
                              style={{
                                left: checkoutLabelLeft,
                                width: checkoutLabelWidth,
                              }}
                              title={checkoutLabel}
                            >
                              {checkoutLabel}
                            </span>
                          ) : null}
                          {handleVisible &&
                          extendable &&
                          (!extensionDragging ||
                            Boolean(draftForReservation)) ? (
                            <button
                              type="button"
                              data-planner-room={room.number}
                              data-planner-date={reservation.checkOut}
                              data-extension-handle={reservation.id}
                              className={cn(
                                "absolute top-9 z-30 flex h-9 items-center rounded-full border border-orange-200 bg-white/95 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700 shadow-lg transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-xl",
                                extensionDragging &&
                                  "scale-105 border-orange-300 bg-orange-50 shadow-xl transition-none duration-0",
                              )}
                              style={{
                                left: handleLeft,
                                width: 44,
                              }}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toast.info(
                                  "Arrastra este botón hacia la derecha para extender la estancia.",
                                );
                              }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                startExtensionDrag(reservation, event);
                              }}
                              title={`Checkout ${formatDate(reservation.checkOut)} · salida estimada 12:00 · arrastra hacia la derecha para extender`}
                            >
                              Ext.
                            </button>
                          ) : null}
                          {draftForReservation && extensionDragging ? (
                            <div
                              data-extension-badge={reservation.id}
                              className="pointer-events-none absolute top-[82px] z-30 flex max-w-[160px] items-center rounded-full border border-orange-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-orange-800 shadow-xl"
                              style={{
                                left: controlsLeft,
                                display: extraNights > 0 ? "flex" : "none",
                              }}
                            >
                              +{extraNights} noche{extraNights === 1 ? "" : "s"}
                            </div>
                          ) : null}
                          {draftForReservation &&
                          extraNights > 0 &&
                          !extensionDragging ? (
                            <div
                              className="absolute top-[82px] z-30 flex max-w-[210px] items-center gap-1 rounded-full border border-orange-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-orange-800 shadow-xl"
                              style={{ left: controlsLeft }}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span className="whitespace-nowrap px-1">
                                +{extraNights} noche
                                {extraNights === 1 ? "" : "s"}
                              </span>
                              <button
                                type="button"
                                className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
                                onClick={applyExtensionDraft}
                                title="Aplicar extensión"
                              >
                                <Check className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="grid size-6 place-items-center rounded-full bg-rose-600 text-white transition hover:bg-rose-700"
                                onClick={cancelExtensionDrag}
                                title="Cancelar extensión"
                              >
                                <XCircle className="size-3.5" />
                              </button>
                            </div>
                          ) : null}
                          {draftForReservation?.conflict ? (
                            <div
                              className={cn(
                                "absolute top-[82px] z-30 max-w-[260px] rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-rose-700 shadow-xl",
                                extensionDragging && "pointer-events-none",
                              )}
                              style={{ left: controlsLeft }}
                            >
                              {draftForReservation.conflict}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={selectedCells.length === 0}
            onClick={onClearSelection}
          >
            Limpiar selección
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2 rounded-full"
            disabled={selectedCells.length === 0}
            onClick={onSendSelection}
          >
            <ShoppingCart className="size-4" />
            Enviar selección al carrito
          </Button>
        </div>
      </div>
    </div>
  );
}

function GuestStatusTags({ guest }: { guest: GuestOption }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {!guest.frequent && !guest.credit ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
          <UserRound className="size-3" />
          Común
        </span>
      ) : null}
      {guest.frequent ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          <BadgeCheck className="size-3" />
          Frecuente
        </span>
      ) : null}
      {guest.credit ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
            creditBadgeClass(guest.credit.health),
          )}
        >
          <CreditCard className="size-3" />
          Al crédito
        </span>
      ) : null}
    </div>
  );
}

function GuestCombobox({
  guests,
  value,
  onChange,
}: {
  guests: GuestOption[];
  value: string;
  onChange: (guestId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedGuest = guests.find((guest) => guest.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between gap-3 rounded-2xl bg-background px-3 py-2 text-left font-normal"
        >
          {selectedGuest ? (
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-semibold">
                {selectedGuest.guestName}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {selectedGuest.dpi || selectedGuest.phone}
                </span>
                <GuestStatusTags guest={selectedGuest} />
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Buscar o seleccionar cliente
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command
          filter={(value, search) =>
            normalizeGuestText(value).includes(normalizeGuestText(search))
              ? 1
              : 0
          }
        >
          <CommandInput placeholder="Buscar por nombre, DPI, NIT, telefono..." />
          <CommandList className="max-h-[380px]">
            <CommandEmpty>No hay clientes con esa busqueda.</CommandEmpty>
            <CommandGroup>
              {selectedGuest ? (
                <CommandItem
                  value="limpiar seleccion"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Limpiar seleccion
                </CommandItem>
              ) : null}
              {guests.map((guest) => (
                <CommandItem
                  key={guest.id}
                  value={guestSearchText(guest)}
                  className="items-start gap-3 py-3"
                  onSelect={() => {
                    onChange(guest.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mt-1 size-4",
                      value === guest.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{guest.guestName}</span>
                      <GuestStatusTags guest={guest} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {guest.dpi || "Sin documento"} -{" "}
                      {guest.phone || "Sin telefono"} - NIT{" "}
                      {guest.nit || "Pendiente"}
                    </p>
                    {guest.credit ? (
                      <p className="mt-1 text-xs font-medium text-blue-800">
                        {creditLabel(guest.credit)}
                      </p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
        props.className ?? ""
      }`}
    />
  );
}

function ReservationCard({
  reservation,
  credit,
  onConfirm,
  onSendToCheckIn,
  onCancel,
  onPrint,
  onPrintReceipt,
  onPrintPaymentReceipt,
  onIssueInvoice,
  onAbonosChange,
}: {
  reservation: Reservation;
  credit?: GuestCreditInfo;
  onConfirm: () => void;
  onSendToCheckIn: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onPrintReceipt: () => void;
  onPrintPaymentReceipt: (payment: PaymentRecord) => void;
  onIssueInvoice: () => void;
  onAbonosChange: (payments: PaymentRecord[]) => void;
}) {
  const balance = reservation.total - reservation.paid;
  const invoiceAmounts = reservationInvoiceDisplayAmounts(reservation);
  const hasInvoiceablePayments =
    reservationInvoiceablePayments(reservation).length > 0;
  const hasUnsavedInvoicePayments = reservation.payments.some(
    (payment) =>
      Number(payment.amount || 0) > 0 && paymentBackendId(payment) === null,
  );
  const canAttemptInvoice = hasInvoiceablePayments || hasUnsavedInvoicePayments;
  const checkoutCompleted = reservation.status === "Checkout";
  const canManageAbonos = [
    "Confirmada",
    "Reservada",
    "Lista para check-in",
    "Ocupada",
  ].includes(reservation.status);
  const canSendToCheckIn = ["Confirmada", "Reservada"].includes(
    reservation.status,
  );
  const readyForCheckIn = reservation.status === "Lista para check-in";
  const creditInfo = paymentCardCreditInfo(credit);
  const issuedInvoiceIds = Array.from(
    new Set(
      [
        reservation.lastInvoiceId,
        ...reservation.payments.map((payment) => payment.invoiceId),
      ].filter((invoiceId): invoiceId is string => Boolean(invoiceId)),
    ),
  );

  return (
    <article className="rounded-3xl border bg-background p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold leading-tight text-foreground">
              {reservation.guestName}
            </h3>
            <StatusBadge status={reservation.status} />
            <BillingStatusBadge status={reservation.billingStatus} />
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Reserva {reservation.code} · Documento {reservation.dpi} · NIT{" "}
            {reservation.nit}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Habitación</p>
          <p className="font-semibold">
            {reservation.roomNumber || "Sin asignar"} · {reservation.roomType}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Fechas</p>
          <p className="font-semibold">
            {formatDate(reservation.checkIn)} →{" "}
            {formatDate(reservation.checkOut)}
          </p>
          <p className="text-xs text-muted-foreground">
            {reservation.nights} noche(s)
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Personas</p>
          <p className="font-semibold">
            {reservation.occupancy} · {reservation.guests} huésped(es)
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Total / saldo</p>
          <p className="font-semibold">{money(reservation.total)}</p>
          <p className="text-xs font-semibold text-emerald-700">
            Abonado {money(Math.max(reservation.paid, 0))}
          </p>
          <p
            className={
              balance > 0
                ? "text-xs font-semibold text-amber-700"
                : "text-xs text-emerald-700"
            }
          >
            Saldo {money(Math.max(balance, 0))}
          </p>
          {reservation.billingStatus ? (
            <p className="text-xs text-muted-foreground">
              Facturado {money(invoiceAmounts.invoiced)} · por facturar{" "}
              {money(invoiceAmounts.pending)}
            </p>
          ) : null}
        </div>
      </div>

      {reservation.notes ? (
        <div className="mt-4 rounded-2xl border bg-muted/20 p-3 text-sm">
          <span className="font-semibold">Notas:</span> {reservation.notes}
        </div>
      ) : null}

      {canManageAbonos ? (
        <>
          <PaymentBreakdownCard
            title={
              reservation.status === "Ocupada"
                ? "Pagos de la reserva y estadía"
                : "Pagos de la reserva"
            }
            description={
              reservation.status === "Ocupada"
                ? "Puedes registrar pagos adicionales mientras la habitación esté ocupada."
                : "Agrega pagos antes de enviar la reserva a check-in. Luego podrás facturarlos desde esta misma reserva."
            }
            total={reservation.total}
            payments={reservation.payments}
            onChange={onAbonosChange}
            isPaymentReadOnly={(payment) => paymentBackendId(payment) !== null}
            isPaymentRemovable={(payment) =>
              paymentBackendId(payment) === null ||
              reservationPaymentInvoicedAmount(payment) <= 0.01
            }
            stage="reserva"
            allowCredit={
              Boolean(creditInfo) ||
              reservation.payments.some((payment) => payment.method === "credito")
            }
            creditInfo={creditInfo}
            addLabel="Agregar pago"
            paidLabel="Pagos registrados"
            emptyLabel="Sin pagos registrados todavía."
            referencePlaceholder="Noche 1, boleta, voucher..."
            onPrintPayment={onPrintPaymentReceipt}
            showInvoiceStatus
            headerLayout="inline"
            className="mt-4"
          />

          {hasUnsavedPaymentChanges ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Pagos pendientes de guardar</p>
                <p className="text-xs text-amber-900/80">
                  Los cambios no se enviarán al backend hasta presionar Guardar pagos.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={onSavePayments}
              >
                Guardar pagos
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          {checkoutCompleted
            ? "El checkout ya fue finalizado. Ya no se pueden registrar abonos; únicamente puedes facturar los pagos pendientes."
            : "Los pagos se pueden registrar antes de check-in o durante la estadía."}
        </div>
      )}

      {canAttemptInvoice ||
      issuedInvoiceIds.length > 0 ||
      invoiceAmounts.invoiced > 0 ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-blue-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Facturación FEL</p>
                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                  Reserva
                </span>
                {invoiceAmounts.invoiced > 0 ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    Facturado {money(invoiceAmounts.invoiced)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-blue-900/80">
                {canAttemptInvoice
                  ? `Disponible para facturar: ${money(invoiceAmounts.pending)}.`
                  : issuedInvoiceIds.length > 0
                    ? "Todos los pagos registrados ya están facturados. Puedes reimprimir las facturas desde aquí."
                    : "Cuando existan pagos pendientes, aparecerán aquí para enviarlos a FEL."}
              </p>
              {issuedInvoiceIds.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {issuedInvoiceIds.map((invoiceId) => (
                    <Button
                      key={invoiceId}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 rounded-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                      onClick={() => void reprintReservationInvoice(invoiceId)}
                    >
                      <Printer className="size-3.5" />
                      Reimprimir factura #{invoiceId}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            {canAttemptInvoice ? (
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-2 rounded-full"
                disabled={
                  reservation.status === "Cancelada" || reservation.total <= 0
                }
                title={
                  hasUnsavedInvoicePayments
                    ? "Se guardarán los pagos antes de abrir FEL."
                    : undefined
                }
                onClick={onIssueInvoice}
              >
                <BadgeCheck className="size-4" />
                Facturar pendiente
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {reservation.status === "Pre-reserva" ? (
          <Button
            size="sm"
            className="group/action gap-2 rounded-full shadow-sm hover:shadow-md"
            onClick={onConfirm}
          >
            <CheckCircle2 className="size-4 transition-transform group-hover/action:scale-110" />
            Confirmar reserva
          </Button>
        ) : null}

        {canSendToCheckIn ? (
          <Button
            variant="outline"
            size="sm"
            className="group/action gap-2 rounded-full hover:border-primary/50 hover:shadow-sm"
            onClick={onSendToCheckIn}
          >
            <Hotel className="size-4 transition-transform group-hover/action:-translate-y-0.5" />
            Enviar a check-in
          </Button>
        ) : null}

        {readyForCheckIn ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="group/action gap-2 rounded-full border-blue-200 text-blue-800 hover:bg-blue-50 hover:shadow-sm"
          >
            <Link
              to={`/recepcion/check-in?reservation=${encodeURIComponent(
                reservation.id,
              )}`}
            >
              <Hotel className="size-4 transition-transform group-hover/action:-translate-y-0.5" />
              Ir a check-in
            </Link>
          </Button>
        ) : null}

        {reservation.status === "Ocupada" ? (
          <Button
            asChild
            size="sm"
            className="group/action gap-2 rounded-full shadow-sm hover:shadow-md"
          >
            <Link
              to={`/recepcion/check-in?tab=checkout&reservation=${encodeURIComponent(
                reservation.id,
              )}`}
            >
              <LogOut className="size-4 transition-transform group-hover/action:translate-x-0.5" />
              Iniciar check-out
            </Link>
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="group/action gap-2 rounded-full hover:shadow-sm"
          onClick={onPrint}
        >
          <Printer className="size-4 transition-transform group-hover/action:scale-110" />
          Imprimir resumen
        </Button>

        {reservation.paid > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="group/action gap-2 rounded-full border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:shadow-sm"
            onClick={onPrintReceipt}
          >
            <Printer className="size-4 transition-transform group-hover/action:scale-110" />
            Recibo sin factura
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="group/action gap-2 rounded-full hover:border-destructive/40 hover:text-destructive hover:shadow-sm"
          disabled={[
            "Lista para check-in",
            "Ocupada",
            "Checkout",
            "Cancelada",
          ].includes(reservation.status)}
          onClick={onCancel}
        >
          <XCircle className="size-4 transition-transform group-hover/action:rotate-12" />
          Cancelar
        </Button>
      </div>
    </article>
  );
}

export function RecepcionReservacionesPage() {
  const {
    creditAccounts,
    dispatch,
    guests: clientDirectory,
    refreshApiState,
    roomTypes: hotelRoomTypes,
    rooms: hotelRooms,
    reservations: clientStayHistory,
  } = useStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dirtyReservationPaymentIds, setDirtyReservationPaymentIds] = useState<
    Set<string>
  >(() => new Set());
  const dirtyReservationPaymentIdsRef = useRef<Set<string>>(new Set());
  const deletedReservationPaymentIdsRef = useRef<Record<string, number[]>>({});
  const [rooms, setRooms] = useState<RoomAvailability[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [reservationDateFrom, setReservationDateFrom] = useState("");
  const [reservationDateTo, setReservationDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("mapa");
  const [plannerStart, setPlannerStart] = useState(() => todayIso());
  const [plannerDays, setPlannerDays] = useState(30);
  const [selectedPlannerCells, setSelectedPlannerCells] = useState<string[]>(
    [],
  );
  const [selectedRoomNumbers, setSelectedRoomNumbers] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<RoomCartItem[]>([]);
  const [rateCalculations, setRateCalculations] = useState<
    Record<string, RateCalculationState>
  >({});
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [reservationPayments, setReservationPayments] = useState<
    PaymentRecord[]
  >([]);
  const [reservationCreateMode, setReservationCreateMode] = useState<
    "save" | "invoice" | null
  >(null);
  const [reservationError, setReservationError] = useState("");
  const [roomToRemove, setRoomToRemove] = useState<string | null>(null);
  const [reservationToCancel, setReservationToCancel] =
    useState<Reservation | null>(null);
  const [cancelSupervisor, setCancelSupervisor] = useState("");
  const [cancelReason, setCancelReason] = useState("Huésped no se presentó");

  const [invoiceReservation, setInvoiceReservation] =
    useState<Reservation | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<ReservationInvoiceForm | null>(
    null,
  );
  const [invoiceConcepts, setInvoiceConcepts] = useState<
    InvoiceConceptOption[]
  >([]);
  const [invoiceRemaining, setInvoiceRemaining] =
    useState<InvoiceRemainingSummary | null>(null);
  const [invoiceReservationServerNotes, setInvoiceReservationServerNotes] =
    useState<string[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceNitLookupStatus, setInvoiceNitLookupStatus] =
    useState<InvoiceNitLookupStatus>("idle");
  const [issuedInvoiceResponse, setIssuedInvoiceResponse] =
    useState<unknown>(null);

  const [form, setForm] = useState({
    guestName: "",
    dpi: "",
    phone: "",
    email: "",
    source: "WhatsApp" as ReservationSource,
    roomType: "Estándar" as RoomType,
    roomNumber: "",
    occupancy: "2 personas" as Occupancy,
    checkIn: todayIso(),
    checkOut: addDaysIso(todayIso(), 1),
    rateType: "Normal" as RateType,
    manualRate: 0,
    paid: "",
    paymentMethod: "Transferencia" as PaymentMethod,
    paymentReference: "",
    notes: "",
    createdBy: currentReservationResponsible(),
  });

  useEffect(() => {
    const nextRooms = hotelRooms
      .map((room) => roomAvailabilityFromStore(room, hotelRoomTypes))
      .sort(compareRoomAvailability);
    setRooms(nextRooms);
    setForm((current) => {
      if (nextRooms.some((room) => room.number === current.roomNumber))
        return current;
      return {
        ...current,
        roomNumber:
          nextRooms.find((room) => room.status === "Disponible")?.number ??
          nextRooms[0]?.number ??
          "",
      };
    });
  }, [hotelRooms, hotelRoomTypes]);

  useEffect(() => {
    const incomingReservations = clientStayHistory.map((reservation) =>
      reservationFromStore(
        reservation,
        clientDirectory,
        hotelRooms,
        hotelRoomTypes,
      ),
    );
    const paymentLockedReservationIds = new Set(
      incomingReservations
        .filter((reservation) => reservation.status !== "Ocupada")
        .map((reservation) => reservation.id),
    );

    paymentLockedReservationIds.forEach((id) => {
      dirtyReservationPaymentIdsRef.current.delete(id);
    });
    setDirtyReservationPaymentIds((current) => {
      const next = new Set(current);
      paymentLockedReservationIds.forEach((id) => next.delete(id));
      return next;
    });

    setReservations((current) => {
      const currentById = new Map(
        current.map((reservation) => [reservation.id, reservation]),
      );

      return incomingReservations.map((incoming) => {
        if (!dirtyReservationPaymentIdsRef.current.has(incoming.id)) {
          return incoming;
        }

        const draft = currentById.get(incoming.id);
        if (!draft) return incoming;

        return {
          ...incoming,
          paid: draft.paid,
          paymentMethod: draft.paymentMethod,
          paymentReference: draft.paymentReference,
          payments: draft.payments,
        };
      });
    });
  }, [clientDirectory, clientStayHistory, hotelRooms, hotelRoomTypes]);
  const paidAmount = 0;

  const filteredReservations = useMemo(() => {
    const text = query.toLowerCase().trim();

    return reservations.filter((reservation) => {
      const matchesText =
        !text ||
        [
          reservation.code,
          reservation.guestName,
          reservation.dpi,
          reservation.phone,
          reservation.roomNumber,
          reservation.source,
          reservation.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      const matchesDateFrom =
        !reservationDateFrom || reservation.checkOut > reservationDateFrom;
      const matchesDateTo =
        !reservationDateTo || reservation.checkIn <= reservationDateTo;

      return matchesText && matchesDateFrom && matchesDateTo;
    });
  }, [query, reservationDateFrom, reservationDateTo, reservations]);

  const availableRooms = rooms
    .filter((room) => room.status === "Disponible")
    .sort(compareRoomAvailability);

  const existingGuests = useMemo<GuestOption[]>(() => {
    return clientDirectory
      .map((guest) => {
        const stays = guestStayCount(guest.id, clientStayHistory);
        const creditAccount = creditAccounts.find(
          (account) =>
            account.guestId === guest.id ||
            normalizeGuestText(account.company) ===
              normalizeGuestText(guest.name),
        );
        const credit = creditAccount
          ? {
              accountId: creditAccount.id,
              company: creditAccount.company,
              available: Math.max(
                0,
                creditAccount.limit - creditAccount.balance,
              ),
              limit: creditAccount.limit,
              balance: creditAccount.balance,
              dueDate: creditAccount.dueDate,
              health: creditHealthForAccount(creditAccount),
            }
          : undefined;
        const frequentBenefitBlocked = false;
        return {
          id: guest.id,
          guestName: guest.name,
          dpi: guest.document,
          nit: guest.nit,
          phone: guest.phone ?? "",
          email: guest.email ?? "",
          country: guest.country,
          department: guest.department,
          frequent: guestIsFrequent(guest, stays),
          frequentBenefitBlocked,
          stays,
          credit,
        };
      })
      .sort(
        (a, b) =>
          guestPriority(a) - guestPriority(b) ||
          normalizeGuestText(a.guestName).localeCompare(
            normalizeGuestText(b.guestName),
          ),
      );
  }, [clientDirectory, clientStayHistory, creditAccounts]);

  const selectedGuest = existingGuests.find(
    (guest) => guest.id === selectedGuestId,
  );
  const canCancelReservation =
    cancelSupervisor.trim().length >= 3 && cancelReason.trim().length >= 5;
  const plannerDates = useMemo(
    () => dateRange(plannerStart, plannerDays),
    [plannerStart, plannerDays],
  );
  const cleaningBlocks = useMemo<CleaningBlock[]>(
    () =>
      hotelRooms
        .filter((room) => room.status === "limpieza")
        .map((room) => ({
          roomNumber: room.number,
          date: todayIso(),
        })),
    [hotelRooms],
  );
  const plannerSelectedRooms = new Set(
    selectedPlannerCells.map((key) => parseCellKey(key).roomNumber),
  ).size;
  const plannerCartCells = useMemo(() => {
    const cells: string[] = [];

    cartItems.forEach((item) => {
      cartItemDates(item).forEach((date) => {
        cells.push(cellKey(item.roomNumber, date));
      });
    });

    return cells;
  }, [cartItems]);

  const selectedRooms = availableRooms.filter((room) =>
    selectedRoomNumbers.includes(room.number),
  );

  function storeRoomForNumber(roomNumber: string) {
    return hotelRooms.find((room) => room.number === roomNumber);
  }

  function roomRateOption(roomNumber: string, occupancy: Occupancy) {
    const people = getGuestsFromOccupancy(occupancy);
    const storeRoom = storeRoomForNumber(roomNumber);
    const storeRoomType = storeRoom
      ? hotelRoomTypes.find((type) => type.id === storeRoom.typeId)
      : undefined;
    const specificRate = storeRoom?.specificRates?.find(
      (rate) => rate.peopleCount === people,
    );
    const configuredRate =
      storeRoom?.rateOptions?.find((rate) => rate.peopleCount === people) ??
      storeRoomType?.rates?.find((rate) => rate.peopleCount === people);

    return {
      people,
      price: specificRate?.price ?? configuredRate?.price,
      isSpecific: Boolean(specificRate ?? configuredRate?.isSpecific),
      reason: specificRate?.reason ?? configuredRate?.reason,
    };
  }

  function normalRateForRoom(
    roomNumber: string,
    roomType: RoomType,
    occupancy: Occupancy,
  ) {
    return (
      roomRateOption(roomNumber, occupancy).price ??
      roomRates[roomType][occupancy]
    );
  }

  function occupancyOptionsForCartItem(item: RoomCartItem) {
    const storeRoom = storeRoomForNumber(item.roomNumber);
    const roomTypeCapacity = hotelRoomTypes.find(
      (type) => type.id === storeRoom?.typeId,
    )?.capacity;
    const maxAllowedGuests = Math.max(
      1,
      storeRoom?.maxOccupancy ??
        roomTypeCapacity ??
        roomMaxGuests(item.roomType),
    );
    const configured = storeRoom?.occupancyOptions?.length
      ? storeRoom.occupancyOptions
      : Array.from(
          {
            length: maxAllowedGuests,
          },
          (_, index) => index + 1,
        );

    return [...new Set(configured)]
      .filter(
        (people) => people >= 1 && people <= Math.min(maxAllowedGuests, 4),
      )
      .sort((a, b) => a - b)
      .map(occupancyFromGuests);
  }

  useEffect(() => {
    setCartItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        const options = occupancyOptionsForCartItem(item);
        if (options.includes(item.occupancy)) return item;

        changed = true;
        const maxGuests = Math.max(...options.map(getGuestsFromOccupancy));
        return {
          ...item,
          occupancy: occupancyFromGuests(maxGuests),
        };
      });

      return changed ? next : current;
    });
  }, [hotelRooms, hotelRoomTypes]);

  function rateForCartItem(item: RoomCartItem) {
    const calculation = rateCalculations[item.id];
    if (
      calculation?.signature === rateCalculationSignature(item) &&
      calculation.status === "ready"
    ) {
      return calculation.nightlyRate;
    }
    if (item.rateType === "Corporativa") return corporateRates[item.roomType];
    if (item.rateType === "Manual con autorización")
      return Number(item.manualRate || 0);
    return normalRateForRoom(item.roomNumber, item.roomType, item.occupancy);
  }

  function nightsForCartItem(item: RoomCartItem) {
    return daysBetween(item.checkIn, item.checkOut);
  }

  function totalForCartItem(item: RoomCartItem) {
    const calculation = rateCalculations[item.id];
    if (
      calculation?.signature === rateCalculationSignature(item) &&
      calculation.status === "ready"
    ) {
      return calculation.total;
    }
    return rateForCartItem(item) * nightsForCartItem(item);
  }

  function rateCalculationSignature(item: RoomCartItem) {
    const storeRoom = storeRoomForNumber(item.roomNumber);
    return [
      storeRoom?.id ?? item.roomNumber,
      item.occupancy,
      item.checkIn,
      item.checkOut,
      item.rateType,
      item.manualRate || 0,
    ].join("|");
  }

  function rateTypeForApi(rateType: RateType) {
    if (rateType === "Manual con autorización") return "Manual";
    if (rateType === "Corporativa") return "Corporativa";
    return "Normal";
  }

  function manualRateForCalculation(item: RoomCartItem) {
    if (item.rateType === "Manual con autorización")
      return Number(item.manualRate || 0);
    if (item.rateType === "Corporativa") return corporateRates[item.roomType];
    return undefined;
  }

  function calculationForCartItem(item: RoomCartItem) {
    const calculation = rateCalculations[item.id];
    return calculation?.signature === rateCalculationSignature(item)
      ? calculation
      : undefined;
  }

  function cartItemCanRequestCalculation(item: RoomCartItem) {
    const storeRoom = storeRoomForNumber(item.roomNumber);
    const people = getGuestsFromOccupancy(item.occupancy);
    const allowedGuests = occupancyOptionsForCartItem(item).map(
      getGuestsFromOccupancy,
    );
    const manualRate = manualRateForCalculation(item);

    return Boolean(
      storeRoom &&
      /^\d+$/.test(storeRoom.id) &&
      item.checkIn &&
      item.checkOut &&
      daysBetween(item.checkIn, item.checkOut) > 0 &&
      allowedGuests.includes(people) &&
      (item.rateType !== "Manual con autorización" ||
        Number(manualRate || 0) > 0),
    );
  }

  function cartItemCanUseLocalCalculation(
    item: RoomCartItem,
    fallbackNightlyRate: number,
    fallbackTotal: number,
  ) {
    const people = getGuestsFromOccupancy(item.occupancy);
    const allowedGuests = occupancyOptionsForCartItem(item).map(
      getGuestsFromOccupancy,
    );

    return (
      Boolean(item.checkIn) &&
      Boolean(item.checkOut) &&
      daysBetween(item.checkIn, item.checkOut) > 0 &&
      allowedGuests.includes(people) &&
      Number.isFinite(fallbackNightlyRate) &&
      fallbackNightlyRate > 0 &&
      Number.isFinite(fallbackTotal) &&
      fallbackTotal > 0
    );
  }

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + totalForCartItem(item),
    0,
  );
  const allCartRoomsReady = cartItems.every((item) => {
    const calculation = calculationForCartItem(item);
    return (
      cartItemCanRequestCalculation(item) &&
      calculation?.status === "ready" &&
      rateForCartItem(item) > 0
    );
  });

  function parseRateCalculation(
    payload: unknown,
    fallbackNightlyRate: number,
    fallbackTotal: number,
    nights: number,
  ) {
    const total = pickCalculationNumber(payload, [
      "total",
      "total_amount",
      "totalAmount",
      "quoted_total",
      "quotedTotal",
      "amount",
    ]);
    const nightlyRate = pickCalculationNumber(payload, [
      "nightly_rate",
      "nightlyRate",
      "rate",
      "price",
      "unit_price",
      "unitPrice",
      "daily_rate",
      "dailyRate",
    ]);
    const resolvedTotal =
      total ?? (nightlyRate ? nightlyRate * nights : fallbackTotal);
    const resolvedNightlyRate =
      nightlyRate ??
      (total ? total / Math.max(nights, 1) : fallbackNightlyRate);

    return {
      nightlyRate: Number.isFinite(resolvedNightlyRate)
        ? resolvedNightlyRate
        : fallbackNightlyRate,
      total: Number.isFinite(resolvedTotal) ? resolvedTotal : fallbackTotal,
    };
  }

  function pickCalculationNumber(payload: unknown, keys: string[]) {
    const records = calculationRecords(payload);

    for (const record of records) {
      for (const key of keys) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (
          typeof value === "string" &&
          value.trim() &&
          Number.isFinite(Number(value))
        ) {
          return Number(value);
        }
      }
    }

    return undefined;
  }

  function calculationRecords(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload.flatMap(calculationRecords);
    if (typeof payload !== "object" || payload === null) return [];

    const record = payload as Record<string, unknown>;
    return [
      record,
      ...["data", "result", "rate", "quote", "calculation"].flatMap((key) =>
        calculationRecords(record[key]),
      ),
    ];
  }

  useEffect(() => {
    let cancelled = false;
    const activeCartItemIds = new Set(cartItems.map((item) => item.id));

    setRateCalculations((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([cartItemId]) =>
          activeCartItemIds.has(cartItemId),
        ),
      ),
    );

    cartItems.forEach((item) => {
      const signature = rateCalculationSignature(item);
      const existing = rateCalculations[item.id];
      if (
        existing?.signature === signature &&
        ["loading", "ready"].includes(existing.status)
      ) {
        return;
      }

      if (!cartItemCanRequestCalculation(item)) {
        setRateCalculations((current) => ({
          ...current,
          [item.id]: {
            status: "error",
            signature,
            nightlyRate: 0,
            total: 0,
            error: "Completa fechas, personas y tarifa.",
          },
        }));
        return;
      }

      const storeRoom = storeRoomForNumber(item.roomNumber);
      const roomId = Number(storeRoom?.id);
      const people = getGuestsFromOccupancy(item.occupancy);
      const nights = nightsForCartItem(item);
      const fallbackNightlyRate =
        item.rateType === "Corporativa"
          ? corporateRates[item.roomType]
          : item.rateType === "Manual con autorización"
            ? Number(item.manualRate || 0)
            : normalRateForRoom(item.roomNumber, item.roomType, item.occupancy);
      const fallbackTotal = fallbackNightlyRate * nights;
      const manualRate = manualRateForCalculation(item);

      setRateCalculations((current) => ({
        ...current,
        [item.id]: {
          status: "loading",
          signature,
          nightlyRate: fallbackNightlyRate,
          total: fallbackTotal,
        },
      }));

      void api.rates
        .quote({
          id_room: roomId,
          people_count: people,
          rate_type: rateTypeForApi(item.rateType),
          check_in_date: item.checkIn,
          check_out_date: item.checkOut,
          manual_rate: manualRate,
        })
        .then((response) => {
          if (cancelled) return;
          const parsed = parseRateCalculation(
            response,
            fallbackNightlyRate,
            fallbackTotal,
            nights,
          );
          setRateCalculations((current) => ({
            ...current,
            [item.id]: {
              status: "ready",
              signature,
              nightlyRate: parsed.nightlyRate,
              total: parsed.total,
            },
          }));
        })
        .catch((error) => {
          if (cancelled) return;
          const canUseLocalCalculation = cartItemCanUseLocalCalculation(
            item,
            fallbackNightlyRate,
            fallbackTotal,
          );
          setRateCalculations((current) => ({
            ...current,
            [item.id]: {
              status: canUseLocalCalculation ? "ready" : "error",
              signature,
              nightlyRate: fallbackNightlyRate,
              total: fallbackTotal,
              error: canUseLocalCalculation
                ? undefined
                : getApiErrorMessage(error, "No se pudo calcular la tarifa."),
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [cartItems, hotelRooms, hotelRoomTypes]);

  function reservationBlocksRange(
    reservation: Reservation,
    roomNumber: string,
    checkIn: string,
    checkOut: string,
  ) {
    const candidateCheckIn = dateOnlyIso(checkIn);
    const candidateCheckOut = dateOnlyIso(checkOut);
    const reservationCheckIn = dateOnlyIso(reservation.checkIn);
    const reservationCheckOut = dateOnlyIso(reservation.checkOut);

    return (
      reservation.roomNumber === roomNumber &&
      reservation.status !== "Cancelada" &&
      reservation.status !== "Checkout" &&
      candidateCheckIn < reservationCheckOut &&
      candidateCheckOut > reservationCheckIn
    );
  }

  function hasCheckoutTurnover(roomNumber: string, date: string) {
    const currentDate = dateOnlyIso(date);
    return reservations.some(
      (reservation) =>
        reservation.roomNumber === roomNumber &&
        reservation.status !== "Cancelada" &&
        dateOnlyIso(reservation.checkOut) === currentDate,
    );
  }

  function cleaningBlocksRange(
    roomNumber: string,
    checkIn: string,
    checkOut: string,
  ) {
    const candidateCheckIn = dateOnlyIso(checkIn);
    const candidateCheckOut = dateOnlyIso(checkOut);

    return cleaningBlocks.some((block) => {
      const blockDate = dateOnlyIso(block.date);
      if (
        block.roomNumber === roomNumber &&
        blockDate === candidateCheckIn &&
        hasCheckoutTurnover(roomNumber, blockDate)
      ) {
        return false;
      }

      return (
        block.roomNumber === roomNumber &&
        blockDate >= candidateCheckIn &&
        blockDate < candidateCheckOut
      );
    });
  }

  function cartBlocksRange(
    candidate: RoomCartItem,
    allItems: RoomCartItem[] = cartItems,
  ) {
    const candidateCheckIn = dateOnlyIso(candidate.checkIn);
    const candidateCheckOut = dateOnlyIso(candidate.checkOut);

    return allItems.some((item) => {
      const itemCheckIn = dateOnlyIso(item.checkIn);
      const itemCheckOut = dateOnlyIso(item.checkOut);

      return (
        item.id !== candidate.id &&
        item.roomNumber === candidate.roomNumber &&
        candidateCheckIn < itemCheckOut &&
        candidateCheckOut > itemCheckIn
      );
    });
  }

  function cartItemAvailabilityError(
    item: RoomCartItem,
    allItems: RoomCartItem[] = cartItems,
  ) {
    if (!item.checkIn || !item.checkOut || item.checkOut <= item.checkIn) {
      return `La habitación ${item.roomNumber} necesita una fecha de salida posterior a la entrada.`;
    }

    const existingReservation = reservations.find((reservation) =>
      reservationBlocksRange(
        reservation,
        item.roomNumber,
        item.checkIn,
        item.checkOut,
      ),
    );
    if (existingReservation) {
      return `La habitación ${item.roomNumber} ya está ocupada/reservada del ${formatDate(existingReservation.checkIn)} al ${formatDate(existingReservation.checkOut)}. Puedes reservar desde el día de checkout (${formatDate(existingReservation.checkOut)}), no antes.`;
    }

    if (cleaningBlocksRange(item.roomNumber, item.checkIn, item.checkOut)) {
      return `La habitación ${item.roomNumber} está en limpieza en ese rango. Debe quedar disponible antes de reservar.`;
    }

    if (cartBlocksRange(item, allItems)) {
      return `La habitación ${item.roomNumber} ya tiene otro bloque en el carrito para esas fechas.`;
    }

    return null;
  }

  function cartItemTurnoverWarning(item: RoomCartItem) {
    const checkIn = dateOnlyIso(item.checkIn);
    if (!hasCheckoutTurnover(item.roomNumber, checkIn)) return null;

    return `El ${formatDate(checkIn)} hay checkout previo en esta habitación. La reserva puede entrar ese día, pero recepción debe confirmar limpieza antes de hacer check-in.`;
  }

  function plannerCellAvailable(roomNumber: string, date: string) {
    const checkOut = addDaysIso(date, 1);
    return !cartItemAvailabilityError({
      id: `probe-${roomNumber}-${date}`,
      roomNumber,
      roomType:
        rooms.find((room) => room.number === roomNumber)?.type ?? "Estándar",
      occupancy: "1 persona",
      checkIn: date,
      checkOut,
      rateType: "Normal",
      manualRate: 0,
    });
  }

  function reservationExtensionAvailabilityError(
    reservation: Reservation,
    newCheckOut: string,
  ) {
    if (newCheckOut <= reservation.checkOut) {
      return "La nueva fecha de checkout debe ser posterior al checkout actual.";
    }

    const probe: RoomCartItem = {
      id: `extend-${reservation.id}`,
      roomNumber: reservation.roomNumber,
      roomType: reservation.roomType,
      occupancy: reservation.occupancy,
      checkIn: reservation.checkOut,
      checkOut: newCheckOut,
      rateType: reservation.rateType,
      manualRate:
        reservation.rateType === "Manual con autorización"
          ? reservation.nightlyRate
          : 0,
    };

    const existingReservation = reservations.find(
      (item) =>
        item.id !== reservation.id &&
        reservationBlocksRange(
          item,
          probe.roomNumber,
          probe.checkIn,
          probe.checkOut,
        ),
    );
    if (existingReservation) {
      return `La habitación ${reservation.roomNumber} ya está ocupada/reservada del ${formatDate(existingReservation.checkIn)} al ${formatDate(existingReservation.checkOut)}.`;
    }

    if (cleaningBlocksRange(probe.roomNumber, probe.checkIn, probe.checkOut)) {
      return `La habitación ${reservation.roomNumber} tiene limpieza dentro de la extensión.`;
    }

    if (cartBlocksRange(probe)) {
      return `La habitación ${reservation.roomNumber} ya tiene noches en el carrito dentro de la extensión.`;
    }

    return null;
  }

  async function extendReservationFromPlanner(
    reservation: Reservation,
    newCheckOut: string,
  ) {
    const availabilityError = reservationExtensionAvailabilityError(
      reservation,
      newCheckOut,
    );
    if (availabilityError) {
      toast.error("No se puede extender la estancia.", {
        description: availabilityError,
      });
      return;
    }

    if (!reservation.reservationRoomId) {
      toast.error("No se puede extender esta estancia desde el mapa.", {
        description:
          "El backend no envió el id de la habitación dentro de la reserva.",
      });
      return;
    }

    try {
      await api.reservations.extendRoom(
        reservation.id,
        reservation.reservationRoomId,
        {
          new_check_out_date: newCheckOut,
          responsible: currentReservationResponsible(),
          reason: "Extensión solicitada desde mapa de reservaciones",
        },
      );

      setReservations((current) =>
        current.map((item) =>
          item.id === reservation.id
            ? {
                ...item,
                checkOut: newCheckOut,
                nights: daysBetween(item.checkIn, newCheckOut),
              }
            : item,
        ),
      );

      toast.success("Extensión aplicada", {
        description: `${reservation.roomNumber} · nuevo checkout ${formatDate(newCheckOut)}`,
      });
    } catch (error) {
      toast.error("No se pudo guardar la extensión en backend.", {
        description: getApiErrorMessage(
          error,
          "Alejandro debe habilitar PATCH /api/reservations/{reservationId}/rooms/{reservationRoomId}/extend.",
        ),
      });
    }
  }

  function toggleRoomSelection(roomNumber: string) {
    setSelectedRoomNumbers((current) =>
      current.includes(roomNumber)
        ? current.filter((number) => number !== roomNumber)
        : [...current, roomNumber],
    );
  }

  function addSelectedRoomsToCart() {
    if (selectedRooms.length === 0) return;

    setCartItems((current) => {
      const alreadyInCart = new Set(current.map((item) => item.roomNumber));
      const newItems = selectedRooms
        .filter((room) => !alreadyInCart.has(room.number))
        .map<RoomCartItem>((room) => ({
          id: createCartItemId(room.number, form.checkIn, form.checkOut),
          roomNumber: room.number,
          roomType: room.type,
          occupancy: defaultOccupancyForRoomAvailability(room),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          rateType: "Normal",
          manualRate: 0,
        }));

      return [...current, ...newItems];
    });

    setSelectedRoomNumbers([]);
    setReservationError("");
    setActiveTab("crear");
  }

  function setPlannerCell(roomNumber: string, date: string, selected: boolean) {
    if (selected && !plannerCellAvailable(roomNumber, date)) {
      toast.error("Noche no disponible", {
        description:
          "La habitación ya tiene reserva, estancia activa o limpieza en esa fecha.",
      });
      return;
    }

    const key = cellKey(roomNumber, date);
    setSelectedPlannerCells((current) => {
      const exists = current.includes(key);
      if (selected && !exists) return [...current, key];
      if (!selected && exists) return current.filter((item) => item !== key);
      return current;
    });
  }

  function addPlannerSelectionToCart() {
    if (selectedPlannerCells.length === 0) return;

    const grouped = selectedPlannerCells.reduce<Record<string, string[]>>(
      (acc, key) => {
        const { roomNumber, date } = parseCellKey(key);
        acc[roomNumber] = [...(acc[roomNumber] ?? []), date];
        return acc;
      },
      {},
    );

    const nextItems: RoomCartItem[] = [];

    for (const [roomNumber, dates] of Object.entries(grouped)) {
      const room = rooms.find((item) => item.number === roomNumber);
      if (!room) continue;

      const sortedDates = [...dates].sort();
      const hasGap = sortedDates.some(
        (date, index) =>
          index > 0 && daysOffset(sortedDates[index - 1], date) !== 1,
      );

      if (hasGap) {
        toast.error(
          `La habitación ${roomNumber} tiene fechas separadas. Selecciona noches consecutivas.`,
        );
        return;
      }

      nextItems.push({
        id: createCartItemId(
          roomNumber,
          sortedDates[0],
          addDaysIso(sortedDates[sortedDates.length - 1], 1),
        ),
        roomNumber,
        roomType: room.type,
        occupancy: defaultOccupancyForRoomAvailability(room),
        checkIn: sortedDates[0],
        checkOut: addDaysIso(sortedDates[sortedDates.length - 1], 1),
        rateType: "Normal",
        manualRate: 0,
      });
    }

    const availabilityError = nextItems
      .map((item) =>
        cartItemAvailabilityError(item, [...cartItems, ...nextItems]),
      )
      .find(Boolean);
    if (availabilityError) {
      toast.error("No se puede enviar al carrito.", {
        description: availabilityError,
      });
      return;
    }

    if (nextItems.length === 0) return;

    setCartItems((current) => {
      let mergedCart = current;

      nextItems.forEach((nextItem) => {
        const existingRoomItems = mergedCart.filter(
          (item) => item.roomNumber === nextItem.roomNumber,
        );
        const otherItems = mergedCart.filter(
          (item) => item.roomNumber !== nextItem.roomNumber,
        );
        const baseItem = existingRoomItems[0] ?? nextItem;
        const mergedDates = [
          ...existingRoomItems.flatMap(cartItemDates),
          ...cartItemDates(nextItem),
        ];

        mergedCart = [
          ...otherItems,
          ...cartItemsFromDateGroups(
            {
              ...baseItem,
              occupancy: baseItem.occupancy || nextItem.occupancy,
              rateType: baseItem.rateType || nextItem.rateType,
              manualRate: baseItem.manualRate || nextItem.manualRate,
            },
            mergedDates,
          ),
        ];
      });

      return mergedCart;
    });

    setForm((current) => ({
      ...current,
      checkIn: nextItems[0].checkIn,
      checkOut: nextItems[0].checkOut,
    }));
    setSelectedPlannerCells([]);
    setSelectedRoomNumbers([]);
    setReservationError("");
    setActiveTab("crear");
    toast.success("Selección enviada al carrito", {
      description: `${nextItems.length} habitación(es) para el mismo cliente.`,
    });
  }

  function updateCartItem(cartItemId: string, changes: Partial<RoomCartItem>) {
    const currentItem = cartItems.find((item) => item.id === cartItemId);
    if (!currentItem) return;

    const nextItem = { ...currentItem, ...changes };
    if (changes.occupancy) {
      const allowedGuests = occupancyOptionsForCartItem(currentItem).map(
        getGuestsFromOccupancy,
      );
      const maxAllowedGuests = allowedGuests.length
        ? Math.max(...allowedGuests)
        : roomMaxGuests(currentItem.roomType);
      nextItem.occupancy = occupancyFromGuests(
        Math.min(getGuestsFromOccupancy(changes.occupancy), maxAllowedGuests),
      );
    }

    const nextCart = cartItems.map((item) =>
      item.id === cartItemId ? nextItem : item,
    );
    const availabilityError = cartItemAvailabilityError(nextItem, nextCart);
    if (availabilityError) {
      toast.error("Fechas no disponibles", { description: availabilityError });
      return;
    }

    setCartItems(nextCart);
  }

  function removeCartItem(cartItemId: string) {
    setCartItems((current) => current.filter((item) => item.id !== cartItemId));
  }

  function removeCartCell(roomNumber: string, date: string) {
    setCartItems((current) =>
      current.flatMap((item) => {
        if (
          item.roomNumber !== roomNumber ||
          date < item.checkIn ||
          date >= item.checkOut
        ) {
          return [item];
        }

        const remainingDates = cartItemDates(item).filter(
          (itemDate) => itemDate !== date,
        );
        return cartItemsFromDateGroups(item, remainingDates);
      }),
    );
    setSelectedPlannerCells((current) =>
      current.filter((key) => key !== cellKey(roomNumber, date)),
    );
  }

  function selectExistingGuest(guestId: string) {
    setSelectedGuestId(guestId);

    const guest = existingGuests.find((item) => item.id === guestId);
    if (!guest) {
      setForm((current) => ({
        ...current,
        guestName: "",
        dpi: "",
        phone: "",
        email: "",
      }));
      setReservationPayments((current) =>
        current.filter((payment) => payment.method !== "credito"),
      );
      return;
    }

    setForm((current) => ({
      ...current,
      guestName: guest.guestName,
      dpi: guest.dpi,
      phone: guest.phone,
      email: guest.email,
    }));

    if (!guest.credit) {
      setReservationPayments((current) =>
        current.filter((payment) => payment.method !== "credito"),
      );
    }
  }

  function roomDetails(room: RoomAvailability) {
    if (room.type === "Jr. Suite") {
      return {
        capacity: occupancyTextForRoomAvailability(room),
        beds: "Cama amplia, sala pequeña y escritorio",
        includes: "Desayuno incluido, TV, WiFi, baño privado y amenidades",
        bestFor: "Parejas, ejecutivos o huéspedes que buscan más espacio",
      };
    }

    return {
      capacity: occupancyTextForRoomAvailability(room),
      beds: "Configuración según cantidad de personas",
      includes: "Desayuno incluido, TV, WiFi, baño privado y amenidades",
      bestFor: "Estadías rápidas, familias pequeñas o tarifa estándar",
    };
  }

  const totals = useMemo(() => {
    return reservations.reduce(
      (acc, reservation) => {
        acc.active +=
          reservation.status !== "Cancelada" &&
          reservation.status !== "Checkout"
            ? 1
            : 0;
        acc.pre += reservation.status === "Pre-reserva" ? 1 : 0;
        acc.confirmed += ["Confirmada", "Reservada"].includes(
          reservation.status,
        )
          ? 1
          : 0;
        acc.ready += ["Lista para check-in", "Ocupada"].includes(
          reservation.status,
        )
          ? 1
          : 0;
        acc.withAbonos += reservation.paid > 0 ? 1 : 0;
        acc.sales += reservation.status !== "Cancelada" ? reservation.total : 0;
        return acc;
      },
      {
        active: 0,
        pre: 0,
        confirmed: 0,
        ready: 0,
        withAbonos: 0,
        sales: 0,
      },
    );
  }, [reservations]);

  function addHistory(
    action: string,
    reservationCode: string,
    user: string,
    detail: string,
  ) {
    setHistory((current) => [
      {
        id: `HIS-${String(current.length + 1).padStart(3, "0")}`,
        date: nowLabel(),
        action,
        reservationCode,
        user,
        detail,
      },
      ...current,
    ]);
  }

  function updateReservationStatus(
    id: string,
    status: ReservationStatus,
    authorization?: CancellationAuthorization,
  ) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;

    setReservations((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );

    if (status === "Cancelada") {
      setRooms((current) =>
        current.map((room) =>
          room.number === reservation.roomNumber
            ? { ...room, status: "Disponible" }
            : room,
        ),
      );
      dispatch({
        type: "RES_CANCEL",
        id,
      });
    } else if (status === "Reservada" || status === "Confirmada") {
      setRooms((current) =>
        current.map((room) =>
          room.number === reservation.roomNumber
            ? { ...room, status: "Reservada" }
            : room,
        ),
      );
      dispatch({
        type: "RES_UPDATE",
        id,
        patch: {
          status: "confirmada",
          notes: reservation.notes,
        },
      });
    } else if (status === "Lista para check-in") {
      setRooms((current) =>
        current.map((room) =>
          room.number === reservation.roomNumber
            ? { ...room, status: "Lista para check-in" }
            : room,
        ),
      );
      dispatch({
        type: "RES_SEND_TO_CHECKIN",
        id,
      });
    } else if (status === "Ocupada") {
      setRooms((current) =>
        current.map((room) =>
          room.number === reservation.roomNumber
            ? { ...room, status: "Ocupada" }
            : room,
        ),
      );
    }

    addHistory(
      status,
      reservation.code,
      authorization?.supervisor.trim() || reservation.createdBy,
      authorization
        ? `Cancelación autorizada por ${authorization.supervisor.trim()} por abono en efectivo. Motivo: ${authorization.reason.trim()}.`
        : `Estado cambiado a ${status}.`,
    );

    const messages: Record<ReservationStatus, string> = {
      "Pre-reserva": "Reserva marcada como pre-reserva.",
      Confirmada: "Reserva confirmada correctamente.",
      Reservada: "Reserva marcada como reservada.",
      "Lista para check-in": "Reserva enviada a check-in correctamente.",
      Ocupada: "Reserva marcada como ocupada.",
      Checkout: "Checkout registrado correctamente.",
      Cancelada: "Reserva cancelada correctamente.",
    };
    toast.success(messages[status], {
      description: `${reservation.guestName} · ${reservation.code}`,
    });
  }

  function updateReservationPayments(id: string, payments: PaymentRecord[]) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;

    if (paymentTotal(payments) > reservation.total) {
      toast.error("Los pagos no pueden superar el total de la reserva.");
      return;
    }

    const nextPaymentKeys = new Set(payments.map(paymentRecordKey));
    const deletedBackendPaymentIds = reservation.payments
      .filter((payment) => !nextPaymentKeys.has(paymentRecordKey(payment)))
      .filter((payment) => reservationPaymentInvoicedAmount(payment) <= 0.01)
      .map(paymentBackendId)
      .filter((paymentId): paymentId is number => paymentId !== null);

    if (deletedBackendPaymentIds.length > 0) {
      const currentDeleted = deletedReservationPaymentIdsRef.current[id] ?? [];
      deletedReservationPaymentIdsRef.current[id] = Array.from(
        new Set([...currentDeleted, ...deletedBackendPaymentIds]),
      );
    }

    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              paid: paymentTotal(payments),
              payments,
            }
          : reservation,
      ),
    );
    dirtyReservationPaymentIdsRef.current.add(id);
    setDirtyReservationPaymentIds((current) => new Set(current).add(id));
  }

  async function saveReservationPayments(
    id: string,
    options: { silent?: boolean } = {},
  ) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return null;
    const reservationId = numericBackendId(reservation.id);
    const reservationRoomId = numericBackendId(reservation.reservationRoomId);
    const newPayments = reservation.payments.filter(
      (payment) =>
        payment.stage === "reserva" &&
        Number(payment.amount || 0) > 0 &&
        paymentBackendId(payment) === null,
    );

    if (!reservationId || !reservationRoomId) {
      toast.error("No se pudieron guardar los pagos.", {
        description:
          "Falta el identificador de reserva o habitación en el sistema.",
      });
      return null;
    }

    try {
      const idUpdates: Array<{
        localId: string;
        backendId: string;
        backendPaymentType: PaymentRecord["backendPaymentType"];
        isInvoiced?: boolean;
        invoiceId?: string;
        invoicedAmount?: number;
        pendingToInvoiceAmount?: number;
        invoicedAt?: string;
      }> = [];

      const deletedPaymentIds =
        deletedReservationPaymentIdsRef.current[id] ?? [];
      for (const paymentId of deletedPaymentIds) {
        await api.reservations.deletePayment(paymentId);
      }

      for (const payment of newPayments) {
        const response = await api.reservations.createNightPayment<unknown>(
          reservationId,
          {
            id_reservation_room: reservationRoomId,
            night_date: reservation.checkIn,
            payments: [paymentPayload(payment)],
            notes:
              payment.reference?.trim() ||
              `Pago agregado a ${reservation.code}`,
          },
        );
        const backendPayment = reservationPaymentFromResponse(response);

        if (!backendPayment) {
          throw new Error(
            "El sistema guardó el pago, pero no devolvió el identificador del pago.",
          );
        }

        idUpdates.push({
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

      let updatedReservation = reservation;
      if (idUpdates.length > 0) {
        const applyUpdates = (payments: PaymentRecord[]) =>
          payments.map((payment) => {
            const update = idUpdates.find(
              (candidate) => candidate.localId === payment.id,
            );
            return update
              ? {
                  ...payment,
                  id: update.backendId,
                  backendPaymentId: update.backendId,
                  backendPaymentType: update.backendPaymentType,
                  isInvoiced: update.isInvoiced,
                  invoiceId: update.invoiceId,
                  invoicedAmount: update.invoicedAmount,
                  pendingToInvoiceAmount: update.pendingToInvoiceAmount,
                  invoicedAt: update.invoicedAt,
                }
              : payment;
          });
        const updatedPayments = applyUpdates(reservation.payments);
        updatedReservation = {
          ...reservation,
          paid: paymentTotal(updatedPayments),
          paymentReference: paymentReferenceSummary(updatedPayments),
          paymentMethod: reservationPaymentMethod(updatedPayments[0]?.method),
          payments: updatedPayments,
        };

        setReservations((current) =>
          current.map((item) => {
            if (item.id !== id) return item;
            const payments = applyUpdates(item.payments);

            return {
              ...item,
              paid: paymentTotal(payments),
              paymentReference: paymentReferenceSummary(payments),
              paymentMethod: reservationPaymentMethod(payments[0]?.method),
              payments,
            };
          }),
        );
      }

      await refreshApiState(["reservations"], { force: true });

      dirtyReservationPaymentIdsRef.current.delete(id);
      delete deletedReservationPaymentIdsRef.current[id];
      setDirtyReservationPaymentIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });

      if (!options.silent) {
        toast.success("Pagos guardados correctamente.", {
          description: `${reservation.guestName} · ${reservation.code}`,
        });
      }

      return updatedReservation;
    } catch (error) {
      toast.error("No se pudieron guardar los pagos.", {
        description: getApiErrorMessage(error),
      });
      return null;
    }
  }

  // En Reservaciones los pagos se guardan manualmente con el botón "Guardar pagos".
  // No usar autosave aquí: al escribir montos como 300, un debounce podía guardar solo "3".

  async function loadInvoiceSupportData(reservation: Reservation) {
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
        setInvoiceForm((current) => {
          if (!current) return current;
          const isPartial =
            current.billingMode === INVOICE_BILLING_MODES.BY_PAYMENTS;
          return {
            ...current,
            conceptId: current.conceptId
              ? current.conceptId
              : String(serviceConcept.id),
            description:
              !isPartial &&
              current.description ===
                buildReservationInvoiceDescription(reservation) &&
              serviceConcept.defaultDescription
                ? serviceConcept.defaultDescription
                : current.description,
            unitPriceWithTax: isPartial
              ? current.unitPriceWithTax
              : current.unitPriceWithTax ||
                String(serviceConcept.defaultPrice ?? ""),
          };
        });
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
      console.warn("No se pudo consultar el saldo de documentos fiscales.", remainingResult.reason);
    }

    setInvoiceLoading(false);
  }

  async function findFreshReservationForInvoice(
    createdReservation: Reservation,
  ) {
    const reservationId = numericBackendId(createdReservation.id);
    let bestReservation = createdReservation;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
      }

      try {
        let mergedPayments = bestReservation.payments;

        if (reservationId !== null) {
          const [detailResult, planResult] = await Promise.allSettled([
            api.reservations.getById<unknown>(reservationId),
            api.reservations.getPaymentPlan<unknown>(reservationId),
          ]);

          if (detailResult.status === "fulfilled") {
            mergedPayments = reservationPaymentsFromResponse(
              detailResult.value,
              mergedPayments,
            );
          }
          if (planResult.status === "fulfilled") {
            mergedPayments = reservationPaymentsFromResponse(
              planResult.value,
              mergedPayments,
            );
          }
        }

        const candidate = {
          ...bestReservation,
          payments: mergedPayments,
          paid: paymentTotal(mergedPayments) || bestReservation.paid,
          paymentReference: paymentReferenceSummary(mergedPayments),
          paymentMethod: reservationPaymentMethod(mergedPayments[0]?.method),
        };

        bestReservation = candidate;

        setReservations((current) => {
          const exists = current.some((item) => item.id === candidate.id);
          return exists
            ? current.map((item) =>
                item.id === candidate.id ? candidate : item,
              )
            : [candidate, ...current];
        });

        if (reservationInvoiceablePayments(candidate).length > 0) {
          return candidate;
        }
      } catch {
        // Reintentamos porque el backend puede tardar un momento en devolver los pagos con ID.
      }
    }

    return bestReservation;
  }

  async function openReservationInvoice(
    reservation: Reservation,
    preferredPaymentIds?: string[],
  ) {
    let targetReservation = reservation;

    if (dirtyReservationPaymentIdsRef.current.has(reservation.id)) {
      toast.warning("Guarda los pagos antes de facturar.", {
        description:
          "Hay cambios pendientes en los pagos de esta reserva. Presiona Guardar pagos y luego vuelve a facturar.",
      });
      return;
    }

    const reservationId = numericBackendId(targetReservation.id);
    if (reservationId !== null) {
      try {
        const [detailResult, planResult] = await Promise.allSettled([
          api.reservations.getById<unknown>(reservationId),
          api.reservations.getPaymentPlan<unknown>(reservationId),
        ]);

        let mergedPayments = targetReservation.payments;
        if (detailResult.status === "fulfilled") {
          mergedPayments = reservationPaymentsFromResponse(
            detailResult.value,
            mergedPayments,
          );
        }
        if (planResult.status === "fulfilled") {
          mergedPayments = reservationPaymentsFromResponse(
            planResult.value,
            mergedPayments,
          );
        }

        const refreshedPaymentsChanged =
          mergedPayments.length !== targetReservation.payments.length ||
          mergedPayments.some((payment, index) => {
            const previous = targetReservation.payments[index];
            return (
              !previous ||
              paymentRecordKey(payment) !== paymentRecordKey(previous) ||
              paymentBackendId(payment) !== paymentBackendId(previous) ||
              payment.invoiceId !== previous.invoiceId ||
              payment.pendingToInvoiceAmount !== previous.pendingToInvoiceAmount
            );
          });

        if (mergedPayments.length > 0 && refreshedPaymentsChanged) {
          targetReservation = {
            ...targetReservation,
            payments: mergedPayments,
            paid: paymentTotal(mergedPayments),
            paymentReference: paymentReferenceSummary(mergedPayments),
            paymentMethod: reservationPaymentMethod(mergedPayments[0]?.method),
          };

          setReservations((current) =>
            current.map((item) =>
              item.id === targetReservation.id
                ? {
                    ...item,
                    payments: mergedPayments,
                    paid: paymentTotal(mergedPayments),
                    paymentReference: paymentReferenceSummary(mergedPayments),
                    paymentMethod: reservationPaymentMethod(
                      mergedPayments[0]?.method,
                    ),
                  }
                : item,
            ),
          );
        }
      } catch {
        // Si el detalle adicional falla, seguimos con los pagos ya cargados en la vista.
      }
    }

    if (reservationInvoiceablePayments(targetReservation).length === 0) {
      toast.info("No hay pagos registrados pendientes para facturar.", {
        description:
          "Registra un pago por el monto que deseas facturar; cada pago se factura completo.",
      });
      return;
    }

    const guest = clientDirectory.find(
      (item) => item.id === targetReservation.guestId,
    );
    const serviceConcept = invoiceConceptForItemType(
      invoiceConcepts,
      INVOICE_ITEM_TYPES.SERVICIO,
    );

    setInvoiceReservation(targetReservation);
    setIssuedInvoiceResponse(null);
    setInvoiceNitLookupStatus("idle");
    setInvoiceForm(
      defaultReservationInvoiceForm(
        targetReservation,
        guest,
        serviceConcept,
        preferredPaymentIds,
      ),
    );
    void loadInvoiceSupportData(targetReservation);
    setInvoiceReservationServerNotes([]);
  }

  function closeReservationInvoice(open: boolean) {
    if (open) return;
    if (invoiceSubmitting) return;
    setInvoiceReservation(null);
    setInvoiceForm(null);
    setIssuedInvoiceResponse(null);
  }

  function updateInvoiceForm(patch: Partial<ReservationInvoiceForm>) {
    setInvoiceForm((current) => (current ? { ...current, ...patch } : current));
  }

  useEffect(() => {
    if (!invoiceForm) return;
    const taxId = normalizeNitForLookup(invoiceForm.taxId);

    if (!taxId || taxId === "CF") {
      setInvoiceNitLookupStatus("idle");
      if (invoiceForm.name !== "CONSUMIDOR FINAL") {
        updateInvoiceForm({ name: "CONSUMIDOR FINAL" });
      }
      return;
    }

    if (taxId.length < 7) {
      setInvoiceNitLookupStatus("idle");
      return;
    }

    setInvoiceNitLookupStatus("loading");
    const timeout = window.setTimeout(() => {
      void lookupInvoiceNitInfo({ silent: true, taxIdOverride: taxId });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [invoiceForm?.taxId]);

  async function lookupInvoiceNitInfo(
    options: { silent?: boolean; taxIdOverride?: string } = {},
  ) {
    if (!invoiceForm) return;
    const taxId = normalizeNitForLookup(
      options.taxIdOverride ?? invoiceForm.taxId,
    );
    if (!taxId || taxId === "CF") {
      updateInvoiceForm({ name: "CONSUMIDOR FINAL" });
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
      updateInvoiceForm({
        name: info.name,
        address: info.address || invoiceForm.address,
        city: info.city || invoiceForm.city,
        state: info.state || invoiceForm.state,
      });
      if (!options.silent) {
        toast.success("Datos fiscales cargados", {
          description: `${taxId} · ${info.name}`,
        });
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

  async function createCancellationRequest() {
    if (!reservationToCancel) return;
    const reservationId = numericBackendId(reservationToCancel.id);
    if (reservationId === null) {
      toast.error(
        "La reserva no tiene identificador del sistema para solicitar cancelación",
      );
      return;
    }
    try {
      await api.reservations.requestCancellation(reservationId, {
        requested_by: cancelSupervisor.trim() || "Recepción",
        reason:
          cancelReason.trim() || "Solicitud de cancelación desde reservaciones",
      });
      toast.success("Solicitud de cancelación enviada", {
        description: "Quedará pendiente de aprobación en Administración.",
      });
      setReservationToCancel(null);
      setCancelSupervisor("");
      setCancelReason("Huésped no se presentó");
    } catch (error) {
      toast.error("No se pudo crear la solicitud de cancelación", {
        description: getApiErrorMessage(error),
      });
    }
  }

  function toggleReservationInvoicePayment(
    payment: PaymentRecord,
    checked: boolean,
  ) {
    if (!invoiceReservation) return;

    setInvoiceForm((current) => {
      if (!current) return current;

      const paymentKey = paymentRecordKey(payment);
      const selectedIds = new Set(current.selectedReservationPaymentIds);
      if (checked) {
        selectedIds.add(paymentKey);
      } else {
        selectedIds.delete(paymentKey);
      }

      const selectedReservationPaymentIds = Array.from(selectedIds);
      const selectedPayments = reservationSelectedInvoicePayments(
        invoiceReservation,
        selectedReservationPaymentIds,
      );

      return {
        ...current,
        selectedReservationPaymentIds,
        description: buildReservationPaymentInvoiceDescription(
          invoiceReservation,
          selectedPayments,
        ),
        unitPriceWithTax: String(
          reservationInvoiceablePaymentTotal(selectedPayments),
        ),
      };
    });
  }

  async function issueReservationInvoice() {
    if (!invoiceReservation || !invoiceForm) return;

    const guestId = numericBackendId(invoiceReservation.guestId);
    const conceptId =
      invoiceConceptForItemType(invoiceConcepts, INVOICE_ITEM_TYPES.SERVICIO)
        ?.id ?? numericBackendId(invoiceForm.conceptId);
    const unitPriceWithTax = Number(invoiceForm.unitPriceWithTax);
    const taxId = invoiceForm.taxId.trim().toUpperCase() || "CF";
    const buyerName = invoiceForm.name.trim();
    const buyerNameForPayload = invoiceForm.useCustomerTaxInfo
      ? buyerName || (taxId === "CF" ? "CONSUMIDOR FINAL" : " ")
      : taxId === "CF"
        ? "CONSUMIDOR FINAL"
        : buyerName || " ";
    const description = invoiceForm.description.trim();
    const selectedInvoicePayments = reservationSelectedInvoicePayments(
      invoiceReservation,
      invoiceForm.selectedReservationPaymentIds,
    );
    const stayPayment =
      selectedInvoicePayments.find(
        (payment) =>
          payment.backendPaymentType === "stay" &&
          paymentIssueSourceModule(payment) ===
            INVOICE_SOURCE_MODULES.CHECK_OUT &&
          paymentIssueSourceId(payment, invoiceReservation) !== null,
      ) ??
      selectedInvoicePayments.find(
        (payment) =>
          payment.backendPaymentType === "stay" &&
          paymentIssueSourceId(payment, invoiceReservation) !== null,
      );
    const sourceModule = stayPayment
      ? paymentIssueSourceModule(stayPayment)
      : INVOICE_SOURCE_MODULES.RESERVATION;
    const sourceId = stayPayment
      ? paymentIssueSourceId(stayPayment, invoiceReservation)
      : numericBackendId(invoiceReservation.id);
    const reservationPaymentIds = selectedInvoicePayments
      .filter((payment) => payment.backendPaymentType !== "stay")
      .map(paymentBackendId)
      .filter((id): id is number => id !== null);
    const stayPaymentIds = selectedInvoicePayments
      .filter((payment) => payment.backendPaymentType === "stay")
      .map(paymentBackendId)
      .filter((id): id is number => id !== null);
    const selectedPaymentTotal = reservationInvoiceablePaymentTotal(
      selectedInvoicePayments,
    );
    const quantityToInvoice = 1;
    const unitPriceToInvoice = unitPriceWithTax;

    if (!conceptId) {
      toast.error("No hay concepto activo de factura para servicios.");
      return;
    }

    if (!sourceId || !sourceModule) {
      toast.error("No se encontró el identificador del origen del pago.", {
        description: "Actualiza la reservación antes de volver a facturar.",
      });
      return;
    }

    if (!guestId) {
      toast.error("No se encontró el id del cliente para facturar.");
      return;
    }

    if (sourceModule === INVOICE_SOURCE_MODULES.EVENT) {
      toast.error(
        "Los pagos de eventos deben facturarse desde el módulo de Eventos.",
      );
      return;
    }

    if (reservationPaymentIds.length === 0 && stayPaymentIds.length === 0) {
      toast.error("Selecciona al menos un pago pendiente para facturar.");
      return;
    }

    if (!description) {
      toast.error("No se pudo generar la descripción de la factura.");
      return;
    }

    if (
      !invoiceForm.useCustomerTaxInfo &&
      taxId !== "CF" &&
      !buyerName.trim()
    ) {
      toast.error("Completa el nombre del receptor.", {
        description:
          "Si DIGIFACT no lo encuentra, puedes escribirlo manualmente.",
      });
      return;
    }

    if (!Number.isFinite(unitPriceToInvoice) || unitPriceToInvoice <= 0) {
      toast.error("El precio final con impuesto debe ser mayor a cero.");
      return;
    }

    if (Math.abs(unitPriceToInvoice - selectedPaymentTotal) > 0.01) {
      toast.error(
        "El monto debe coincidir con el saldo pendiente seleccionado.",
        {
          description: `Pendiente seleccionado: ${money(selectedPaymentTotal)}.`,
        },
      );
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
      minibar_review_detail_ids: [],
      items: [
        {
          id_invoice_concept: conceptId,
          item_type: INVOICE_ITEM_TYPES.SERVICIO,
          description,
          quantity: quantityToInvoice,
          unit_price_with_tax: unitPriceToInvoice,
          notes: invoiceForm.notes.trim() || null,
        },
      ],
    };

    setInvoiceSubmitting(true);
    try {
      const response = await api.invoices.issue<unknown>(payload);
      const responseRecord = invoiceResponseRecord(response);
      const invoiceId = apiString(responseRecord, [
        "id_invoice",
        "idInvoice",
        "invoice_id",
        "id",
      ]);
      const issuedTotal =
        apiNumber(responseRecord, [
          "total_amount",
          "totalAmount",
          "total",
          "grand_total",
        ]) ?? quantityToInvoice * unitPriceToInvoice;

      setIssuedInvoiceResponse(response);
      setReservations((current) =>
        current.map((reservation) => {
          if (reservation.id !== invoiceReservation.id) return reservation;

          const selectedPaymentIds = new Set(
            invoiceForm.selectedReservationPaymentIds,
          );
          const invoicedAt = new Date().toISOString();
          const payments = reservation.payments.map((payment) => {
            if (!selectedPaymentIds.has(paymentRecordKey(payment))) {
              return payment;
            }

            const paymentAmount = roundCurrency(Number(payment.amount || 0));

            return {
              ...payment,
              isInvoiced: true,
              invoiceId: invoiceId || payment.invoiceId,
              invoicedAmount: paymentAmount,
              pendingToInvoiceAmount: 0,
              invoicedAt,
            };
          });
          const nextInvoicedAmount = roundCurrency(
            payments.reduce(
              (sum, payment) => sum + reservationPaymentInvoicedAmount(payment),
              0,
            ),
          );
          const nextPendingToInvoiceAmount =
            reservationInvoiceablePaymentTotal(payments);
          const billingStatus: ReservationBillingStatus =
            nextPendingToInvoiceAmount <= 0.01
              ? "Facturada"
              : nextInvoicedAmount > 0.01
                ? "Parcial"
                : "NoFacturada";

          return {
            ...reservation,
            payments,
            billingStatus,
            lastInvoiceId: invoiceId || reservation.lastInvoiceId,
            invoicedAmount: nextInvoicedAmount,
            pendingToInvoiceAmount: nextPendingToInvoiceAmount,
          };
        }),
      );
      addHistory(
        "Factura emitida",
        invoiceReservation.code,
        invoiceReservation.createdBy,
        `Factura emitida por pagos completos seleccionados: ${money(issuedTotal)}.`,
      );
      toast.success("Factura emitida correctamente.", {
        description: `${invoiceReservation.guestName} · ${invoiceReservation.code}`,
      });
      setInvoiceSubmitting(false);
      void printOfficialInvoice(invoiceId, response).catch((printError) => {
        toast.warning(
          "La factura se emitió, pero no se pudo abrir automáticamente.",
          {
            description:
              printError instanceof Error
                ? printError.message
                : "Puedes reimprimirla desde la reservación.",
          },
        );
      });
      void loadInvoiceSupportData(invoiceReservation);
    } catch (error) {
      toast.error("No se pudo emitir la factura.", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  function printDraftReservationPaymentReceipt(payment: PaymentRecord) {
    const amount = Number(payment.amount || 0);
    if (amount <= 0) {
      toast.error("No hay monto para imprimir recibo.");
      return;
    }

    printSimpleReceipt({
      title: "Recibo simple de reserva",
      code: "Reserva en creacion",
      customer:
        (selectedGuest?.guestName ?? form.guestName.trim()) || "Cliente",
      concept: `Abono de reserva (${cartItems.length || 1} habitación(es))`,
      amount,
      method: paymentMethodLabel(payment.method),
      reference: payment.reference,
      date: payment.date,
      receivedBy: form.createdBy,
      details: [
        { label: "Total carrito", value: money(cartTotal) },
        {
          label: "Habitaciónes",
          value:
            cartItems.map((item) => item.roomNumber).join(", ") ||
            "Por asignar",
        },
      ],
    });
  }

  async function handleCreateReservation(openInvoiceAfterCreate = false) {
    if (!selectedGuest) {
      setReservationError(
        "Selecciona un cliente existente antes de crear la reserva. Si es nuevo, agrégalo primero en Clientes.",
      );
      return;
    }

    if (cartItems.length === 0) {
      setReservationError(
        "Agrega al carrito al menos una habitación disponible.",
      );
      return;
    }

    if (!allCartRoomsReady) {
      setReservationError(
        "Revisa fechas, ocupacion, tarifa y calculo de cada habitación del carrito.",
      );
      return;
    }

    if (paidAmount > cartTotal) {
      setReservationError(
        "Los abonos no pueden ser mayores que el total del carrito.",
      );
      return;
    }

    const creditAmount = 0;

    setReservationCreateMode("save");

    const nextNumber = reservations.length + 1;
    const createdAt = nowLabel();
    const paymentAllocations: PaymentRecord[][] = cartItems.map(() => []);
    const newReservations = cartItems.map<Reservation>((item, index) => {
      const roomTotal = totalForCartItem(item);
      const roomPayments = paymentAllocations[index] ?? [];
      const paidForRoom = Math.min(
        roomTotal,
        Math.max(paymentTotal(roomPayments), 0),
      );

      return {
        id: `RSV-${String(nextNumber + index).padStart(3, "0")}`,
        code: `CL-${String(nextNumber + index).padStart(4, "0")}`,
        guestId: selectedGuest.id,
        guestName: form.guestName.trim(),
        dpi: form.dpi.trim(),
        nit: selectedGuest.nit,
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source,
        roomType: item.roomType,
        roomNumber: item.roomNumber,
        occupancy: item.occupancy,
        guests: getGuestsFromOccupancy(item.occupancy),
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        nights: nightsForCartItem(item),
        rateType: item.rateType,
        nightlyRate: rateForCartItem(item),
        total: roomTotal,
        paid: paidForRoom,
        paymentMethod: reservationPaymentMethod(roomPayments[0]?.method),
        paymentReference: paymentReferenceSummary(roomPayments),
        payments: roomPayments,
        status: "Reservada",
        notes: form.notes.trim(),
        createdBy: form.createdBy,
        createdAt,
        billingStatus: "NoFacturada",
        invoicedAmount: 0,
        pendingToInvoiceAmount: roomTotal,
      };
    });

    try {
      const createdReservations: Reservation[] = [];
      const guestId = numericBackendId(selectedGuest.id);

      if (!guestId) {
        throw new Error(
          "El cliente seleccionado no tiene identificador del sistema.",
        );
      }

      for (const reservation of newReservations) {
        const storeRoom = hotelRooms.find(
          (room) => room.number === reservation.roomNumber,
        );
        const roomId = numericBackendId(storeRoom?.id);
        const rateType = localRateTypeToStore(reservation.rateType);

        if (!storeRoom || !roomId) {
          throw new Error(
            `La habitación ${reservation.roomNumber} no tiene identificador del sistema.`,
          );
        }

        const createResponse = await api.reservations.create<unknown>({
          id_guest: guestId,
          origin: localSourceToStore(reservation.source),
          responsible: form.createdBy.trim() || currentReservationResponsible(),
          notes: reservation.notes,
          payments: undefined,
          rooms: [
            {
              id_room: roomId,
              check_in_date: reservation.checkIn,
              check_out_date: reservation.checkOut,
              people_count: reservation.guests,
              rate_type:
                rateType === "manual"
                  ? "Manual"
                  : rateType === "corporativa"
                    ? "Corporativa"
                    : "Normal",
              manual_rate:
                rateType === "manual" || rateType === "corporativa"
                  ? reservation.nightlyRate
                  : undefined,
              manual_rate_reason:
                rateType === "manual"
                  ? "Tarifa manual autorizada desde recepción"
                  : undefined,
            },
          ],
        });
        const reservationId = apiReservationIdFromResponse(createResponse);
        let reservationDetail = createResponse;
        let reservationPaymentPlan: unknown = null;

        if (reservationId) {
          try {
            reservationDetail =
              await api.reservations.getById<unknown>(reservationId);
          } catch {
            reservationDetail = createResponse;
          }

          try {
            reservationPaymentPlan =
              await api.reservations.getPaymentPlan<unknown>(reservationId);
          } catch {
            reservationPaymentPlan = null;
          }
        }

        const responsePayments = reservationPaymentsFromResponse(
          reservationPaymentPlan,
          reservationPaymentsFromResponse(
            reservationDetail,
            reservationPaymentsFromResponse(
              createResponse,
              reservation.payments,
            ),
          ),
        );
        const createdReservation = {
          ...reservation,
          id: reservationId ? String(reservationId) : reservation.id,
          reservationRoomId:
            String(
              apiReservationRoomIdFromResponse(reservationDetail) ??
                apiReservationRoomIdFromResponse(createResponse) ??
                "",
            ) || reservation.reservationRoomId,
          code:
            apiReservationCodeFromResponse(reservationDetail) ??
            apiReservationCodeFromResponse(createResponse) ??
            reservation.code,
          payments: responsePayments,
          paid: paymentTotal(responsePayments) || reservation.paid,
          paymentMethod: reservationPaymentMethod(responsePayments[0]?.method),
          paymentReference: paymentReferenceSummary(responsePayments),
        };

        const creditPaymentAmount = responsePayments
          .filter((payment) => payment.method === "credito")
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const creditAccountId = numericBackendId(
          selectedGuest.credit?.accountId,
        );

        if (creditPaymentAmount > 0 && creditAccountId) {
          await api.credit.createAccountMovement(creditAccountId, {
            concept: "Cargo por reservacion",
            amount: creditPaymentAmount,
            source_module: INVOICE_SOURCE_MODULES.RESERVATION,
            source_id: numericBackendId(createdReservation.id),
            reference: createdReservation.code,
            notes: `Credito usado en la reserva ${createdReservation.code}.`,
          });
        }

        createdReservations.push(createdReservation);
      }

      setReservations((current) => [...createdReservations, ...current]);

      const reservedNumbers = new Set(cartItems.map((item) => item.roomNumber));
      setRooms((current) =>
        current.map((room) =>
          reservedNumbers.has(room.number)
            ? { ...room, status: "Reservada" }
            : room,
        ),
      );

      createdReservations.forEach((reservation) => {
        addHistory(
          "Reserva creada",
          reservation.code,
          reservation.createdBy,
          reservation.paid > 0
            ? `Habitación ${reservation.roomNumber} reservada con abonos: ${paymentBreakdownText(reservation.payments)}.`
            : `Habitación ${reservation.roomNumber} reservada sin abono inicial.`,
        );
      });

      await refreshApiState(
        creditAmount > 0
          ? ["reservations", "rooms", "creditAccounts"]
          : ["reservations", "rooms"],
        { force: true },
      );

      toast.success(
        createdReservations.length > 1
          ? "Reservaciones creadas correctamente."
          : "Reservación creada correctamente.",
        {
          description: `${form.guestName.trim()} · ${createdReservations
            .map((reservation) => reservation.code)
            .join(", ")}`,
        },
      );

      setForm({
        guestName: "",
        dpi: "",
        phone: "",
        email: "",
        source: "WhatsApp",
        roomType: "Estándar",
        roomNumber: "",
        occupancy: "2 personas",
        checkIn: todayIso(),
        checkOut: addDaysIso(todayIso(), 1),
        rateType: "Normal",
        manualRate: 0,
        paid: "",
        paymentMethod: "Transferencia",
        paymentReference: "",
        notes: "",
        createdBy: currentReservationResponsible(),
      });

      setCartItems([]);
      setSelectedRoomNumbers([]);
      setSelectedGuestId("");
      setReservationPayments([]);
      setReservationError("");
      if (!openInvoiceAfterCreate) {
        setActiveTab("reservas");
      }

      void openInvoiceAfterCreate;
    } catch (error) {
      toast.error("No se pudo crear la reserva.", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setReservationCreateMode(null);
    }
  }

  function printReservation(reservation: Reservation) {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${reservation.code}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #2f2a24; font-size: 12px; }
            .card { border: 1px solid #d8c7ac; border-radius: 18px; overflow: hidden; }
            .header { padding: 18px; background: #fbf5ea; border-bottom: 2px solid #b79263; display: flex; justify-content: space-between; }
            h1 { margin: 0; font-family: Georgia, serif; color: #5d4631; }
            .meta { text-align: right; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px; }
            .box { border: 1px solid #eadfce; border-radius: 14px; padding: 12px; background: #fffdf8; }
            .label { color: #8b755f; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
            .value { margin-top: 4px; font-weight: 700; }
            .footer { padding: 18px; border-top: 1px solid #eadfce; font-size: 11px; color: #8b755f; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <h1>Casa Luna Boutique Hotel</h1>
                <div>Resumen de reservación</div>
              </div>
              <div class="meta">
                <strong>${reservation.code}</strong><br/>
                ${nowLabel()}
              </div>
            </div>
            <div class="grid">
              <div class="box"><div class="label">Huésped</div><div class="value">${reservation.guestName}</div></div>
              <div class="box"><div class="label">Documento</div><div class="value">${reservation.dpi}</div></div>
              <div class="box"><div class="label">NIT FEL</div><div class="value">${reservation.nit}</div></div>
              <div class="box"><div class="label">Teléfono</div><div class="value">${reservation.phone}</div></div>
              <div class="box"><div class="label">Origen</div><div class="value">${reservation.source}</div></div>
              <div class="box"><div class="label">Habitación</div><div class="value">${reservation.roomNumber} · ${reservation.roomType}</div></div>
              <div class="box"><div class="label">Personas</div><div class="value">${reservation.occupancy}</div></div>
              <div class="box"><div class="label">Entrada</div><div class="value">${formatDate(reservation.checkIn)}</div></div>
              <div class="box"><div class="label">Salida</div><div class="value">${formatDate(reservation.checkOut)}</div></div>
              <div class="box"><div class="label">Total</div><div class="value">${money(reservation.total)}</div></div>
              <div class="box"><div class="label">Abonado</div><div class="value">${money(reservation.paid)}</div></div>
              <div class="box"><div class="label">Estado</div><div class="value">${reservation.status}</div></div>
              <div class="box"><div class="label">Responsable</div><div class="value">${reservation.createdBy}</div></div>
              <div class="box" style="grid-column: 1 / -1;"><div class="label">Abonos registrados</div><div class="value">${paymentBreakdownText(reservation.payments)}</div></div>
            </div>
            <div class="footer">Este documento es un resumen operativo de la reservación.</div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); }</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  function printReservationsReport() {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Reporte de reservas</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #2f2a24; font-size: 11px; }
            h1 { font-family: Georgia, serif; color: #5d4631; margin: 0 0 4px; }
            .meta { color: #8b755f; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #fbf5ea; color: #6b563f; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
            th, td { border: 1px solid #eadfce; padding: 8px; vertical-align: top; }
            tr:nth-child(even) td { background: #fffaf2; }
          </style>
        </head>
        <body>
          <h1>Casa Luna Boutique Hotel</h1>
          <div class="meta">Reporte operativo de reservas · ${nowLabel()}</div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Huésped</th>
                <th>Habitación</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${reservations
                .map(
                  (reservation) => `
                <tr>
                  <td>${reservation.code}</td>
                  <td>${reservation.guestName}</td>
                  <td>${reservation.roomNumber} · ${reservation.roomType}</td>
                  <td>${formatDate(reservation.checkIn)} a ${formatDate(reservation.checkOut)}</td>
                  <td>${reservation.status}</td>
                  <td>${money(reservation.total)}</td>
                  <td>${money(Math.max(0, reservation.total - reservation.paid))}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <script>window.onload = () => { window.focus(); window.print(); }</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  const invoiceableReservationPayments = invoiceReservation
    ? reservationInvoiceablePayments(invoiceReservation)
    : [];
  const savedReservationInvoicePayments = invoiceReservation
    ? invoiceReservation.payments.filter(
        (payment) =>
          Number(payment.amount || 0) > 0 && paymentBackendId(payment) !== null,
      )
    : [];
  const selectedReservationInvoicePayments =
    invoiceReservation && invoiceForm
      ? reservationSelectedInvoicePayments(
          invoiceReservation,
          invoiceForm.selectedReservationPaymentIds,
        )
      : [];
  const selectedReservationInvoicePaymentTotal =
    reservationInvoiceablePaymentTotal(selectedReservationInvoicePayments);
  const isPartialInvoice =
    invoiceForm?.billingMode === INVOICE_BILLING_MODES.BY_PAYMENTS;
  const invoiceLineTotal =
    invoiceForm &&
    Number.isFinite(Number(invoiceForm.quantity)) &&
    Number.isFinite(Number(invoiceForm.unitPriceWithTax))
      ? Number(invoiceForm.quantity) * Number(invoiceForm.unitPriceWithTax)
      : 0;
  const partialInvoiceAmount = invoiceForm
    ? Number(invoiceForm.unitPriceWithTax)
    : 0;
  const canIssueInvoice =
    Boolean(invoiceForm) &&
    !invoiceSubmitting &&
    !invoiceLoading &&
    !issuedInvoiceResponse &&
    (!isPartialInvoice ||
      (Number.isFinite(partialInvoiceAmount) &&
        partialInvoiceAmount > 0 &&
        Math.abs(
          partialInvoiceAmount - selectedReservationInvoicePaymentTotal,
        ) <= 0.01)) &&
    (!isPartialInvoice || selectedReservationInvoicePayments.length > 0);
  const issuedInvoiceFields = issuedInvoiceResponse
    ? invoiceResponseFields(issuedInvoiceResponse)
    : [];
  const showCartPaymentsBelowRooms = cartItems.length === 1;
  const cartItemToRemove = roomToRemove
    ? cartItems.find((item) => item.id === roomToRemove)
    : undefined;

  function renderCartPaymentsCard(
    headerLayout: "stacked" | "inline" = "stacked",
    className?: string,
  ) {
    return (
      <PaymentBreakdownCard
        title="Abonos de reserva"
        description="Opcional: registra abonos iniciales o por noche. La reserva se puede crear aunque no tenga abono."
        total={cartTotal}
        payments={reservationPayments}
        onChange={(payments) => {
          setReservationError("");
          setReservationPayments(payments);
        }}
        stage="reserva"
        allowCredit={Boolean(selectedGuest?.credit)}
        creditInfo={paymentCardCreditInfo(selectedGuest?.credit)}
        creditProjectionLabel="Si se realiza esta reserva, el nuevo crédito será"
        addLabel="Agregar abono"
        paidLabel="Abonos registrados"
        emptyLabel="Sin abono inicial. Puedes crear la reserva igual."
        referencePlaceholder="Noche 1, boleta, voucher..."
        onPrintPayment={printDraftReservationPaymentReceipt}
        headerLayout={headerLayout}
        className={className}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Reservaciones"
        description="Primero revisa disponibilidad, luego usa una habitación libre para crear, confirmar y preparar la reservación."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
              onClick={printReservationsReport}
            >
              <Download className="size-4" />
              Reporte de reservas
            </Button>
          </div>
        }
      />

      <QuickGuide
        title="Guía rápida para reservaciones"
        description="Usa el mapa para revisar disponibilidad por fecha, armar el carrito y crear reservas con o sin abono inicial."
        steps={[
          {
            icon: Search,
            title: "Elige el rango",
            text: "Selecciona el mes o rango de días para ver disponibilidad actual, futura o histórica.",
          },
          {
            icon: Hotel,
            title: "Agrega habitaciones",
            text: "En el mapa, selecciona una o varias noches disponibles. También puedes arrastrar sin soltar para marcar varios días y habitaciones.",
          },
          {
            icon: UserRound,
            title: "Selecciona cliente",
            text: "Elige el huésped o empresa responsable antes de crear la reserva.",
          },
          {
            icon: CreditCard,
            title: "Registra abono",
            text: "Agrega pagos iniciales si el cliente deja anticipo. El saldo queda visible para recepción.",
          },
          {
            icon: CalendarCheck,
            title: "Crea y prepara",
            text: "Crea la reserva, revisa que aparezca en el mapa y envíala a check-in cuando corresponda.",
          },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reservas activas"
          value={totals.active}
          helper="Pendientes o confirmadas"
          icon={CalendarCheck}
        />
        <MetricCard
          label="Con abonos"
          value={totals.withAbonos}
          helper="Pagos parciales registrados"
          icon={CreditCard}
          tone="warning"
        />
        <MetricCard
          label="Listas para check-in"
          value={totals.ready}
          helper="Atender en la pantalla de check-in"
          icon={Hotel}
          tone="info"
        />
        <MetricCard
          label="Venta reservada"
          value={money(totals.sales)}
          helper="Reservas y estancias no canceladas"
          icon={CreditCard}
          tone="success"
        />
      </section>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="habitaciónes">Disponibilidad</TabsTrigger>
          <TabsTrigger value="crear" className="gap-2">
            Carrito
            {cartItems.length > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                {cartItems.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="mapa" className="space-y-4">
          <Panel
            title="Mapa de reservaciones"
            description="Consulta pasado, presente y futuro por habitación. Puedes hacer clic o arrastrar para seleccionar varias noches antes de enviarlas al carrito."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border bg-background px-4 py-2 text-sm font-semibold">
                  {formatPlannerRange(plannerStart, plannerDays)}
                </div>
                <TextInput
                  type="month"
                  value={monthInputValue(plannerStart)}
                  onChange={(event) => {
                    if (event.target.value) {
                      setPlannerStart(firstDayOfMonth(event.target.value));
                      if (plannerDays < 30) setPlannerDays(30);
                    }
                  }}
                  className="min-w-36 rounded-full sm:w-40"
                  title="Elegir mes"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setPlannerStart((current) => addMonthsIso(current, -1))
                  }
                >
                  -1 mes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setPlannerStart((current) => addMonthsIso(current, 1))
                  }
                >
                  +1 mes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setPlannerStart(addDaysIso(todayIso(), -30));
                    setPlannerDays(30);
                  }}
                >
                  Histórico
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setPlannerStart((current) => addDaysIso(current, -7))
                  }
                >
                  -7
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setPlannerStart(todayIso());
                    setPlannerDays(30);
                  }}
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const monthStart = currentMonthStartIso();
                    setPlannerStart(monthStart);
                    setPlannerDays(daysInMonthIso(monthStart));
                  }}
                >
                  Este mes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    setPlannerStart((current) => addDaysIso(current, 7))
                  }
                >
                  +7
                </Button>
                <SelectInput
                  value={String(plannerDays)}
                  onChange={(event) =>
                    setPlannerDays(Number(event.target.value))
                  }
                  className="min-w-32 flex-1 rounded-full sm:w-[150px] sm:flex-none"
                >
                  <option value="7">1 semana</option>
                  <option value="14">2 semanas</option>
                  <option value="21">3 semanas</option>
                  <option value="30">30 días</option>
                  <option value="45">45 días</option>
                  <option value="60">60 días</option>
                  <option value="90">90 días</option>
                </SelectInput>
                <div className="mobile-safe-text rounded-full border bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
                  {selectedPlannerCells.length} noche(s) ·{" "}
                  {plannerSelectedRooms} habitación(es)
                </div>
              </div>
            }
          >
            <PlannerBoard
              rooms={rooms}
              reservations={reservations}
              cleaningBlocks={cleaningBlocks}
              dates={plannerDates}
              selectedCells={selectedPlannerCells}
              cartCells={plannerCartCells}
              onCellSet={setPlannerCell}
              onCartCellRemove={removeCartCell}
              onClearSelection={() => setSelectedPlannerCells([])}
              onSendSelection={addPlannerSelectionToCart}
              onReservationOpen={(reservation) => {
                setQuery(reservation.guestName);
                setActiveTab("reservas");
              }}
              onReservationExtend={extendReservationFromPlanner}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="habitaciónes" className="space-y-4">
          <Panel
            title="Disponibilidad para reservar"
            description="Solo se muestran habitaciones disponibles. Selecciona una o varias, revisa precios y envíalas al carrito antes de crear la reserva."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border bg-muted/30 px-4 py-2 text-sm font-medium">
                  {selectedRooms.length} seleccionada(s)
                </div>
                <Button
                  size="sm"
                  className="gap-2 rounded-full"
                  disabled={selectedRooms.length === 0}
                  onClick={addSelectedRoomsToCart}
                >
                  <ShoppingCart className="size-4" />
                  Enviar al carrito
                </Button>
              </div>
            }
          >
            <div className="mb-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
              <strong>Disponible significa lista para ofrecer.</strong> Las
              habitaciones ocupadas, reservadas o en limpieza ya no aparecen
              aquí para evitar errores de recepción.
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {availableRooms.map((room) => {
                const details = roomDetails(room);
                const selected = selectedRoomNumbers.includes(room.number);
                const inCart = cartItems.some(
                  (item) => item.roomNumber === room.number,
                );

                return (
                  <article
                    key={room.number}
                    onClick={() => {
                      if (!inCart) toggleRoomSelection(room.number);
                    }}
                    className={`group/room relative cursor-pointer overflow-hidden rounded-3xl border bg-background p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border"
                    } ${inCart ? "cursor-default opacity-75 hover:translate-y-0 hover:shadow-sm" : ""}`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 h-1 transition ${
                        selected
                          ? "bg-primary"
                          : "bg-primary/0 group-hover/room:bg-primary/60"
                      }`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Habitación disponible
                        </p>
                        <h3 className="mt-1 text-3xl font-bold">
                          {room.number}
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground">
                          {room.type}
                        </p>
                      </div>
                      <StatusBadge status="Disponible" />
                    </div>

                    {!selected && !inCart ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition group-hover/room:border-primary/40 group-hover/room:bg-primary/10">
                        <CirclePlus className="size-4" />
                        Toca la card o el botón para seleccionarla
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          Capacidad máxima
                        </p>
                        <p className="font-semibold">{details.capacity}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          Tipo de espacio
                        </p>
                        <p className="font-semibold">{details.beds}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Incluye</p>
                        <p className="font-semibold">{details.includes}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          Ideal para
                        </p>
                        <p className="font-semibold">{details.bestFor}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Precios por noche
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        {occupancyOptionsForRoomAvailability(room).map(
                          (occupancy) => {
                            const rate = roomRateOption(room.number, occupancy);

                            return (
                              <div
                                key={occupancy}
                                className="rounded-xl bg-background px-2 py-1.5"
                              >
                                <span className="text-muted-foreground">
                                  {occupancy}
                                </span>
                                <p className="font-semibold">
                                  {money(
                                    normalRateForRoom(
                                      room.number,
                                      room.type,
                                      occupancy,
                                    ),
                                  )}
                                </p>
                                <p
                                  className={
                                    rate.isSpecific
                                      ? "text-[11px] font-semibold text-amber-700"
                                      : "text-[11px] text-muted-foreground"
                                  }
                                >
                                  {rate.isSpecific ? "Especial" : "Normal"}
                                </p>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant={selected ? "default" : "secondary"}
                        className={`w-full rounded-full border font-semibold shadow-sm transition-all ${
                          selected
                            ? "shadow-primary/20"
                            : "border-primary/25 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        }`}
                        disabled={inCart}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRoomSelection(room.number);
                        }}
                      >
                        {inCart
                          ? "Ya está en carrito"
                          : selected
                            ? "Quitar selección"
                            : "Seleccionar habitación"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {availableRooms.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {rooms.length === 0 ? (
                  <>
                    <p className="font-semibold text-foreground">
                      No hay habitaciones registradas todavía.
                    </p>
                    <p className="mt-1">
                      Crea las habitaciones en el catálogo para que aparezcan
                      aquí y en el mapa.
                    </p>
                    <Link
                      to="/habitaciónes"
                      className="mt-3 inline-flex rounded-full border px-4 py-2 font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      Ir a habitaciones
                    </Link>
                  </>
                ) : (
                  "No hay habitaciones disponibles para ofrecer en este momento."
                )}
              </div>
            ) : null}
          </Panel>
        </TabsContent>

        <TabsContent value="crear" className="space-y-4">
          <Panel
            title="Crear reserva desde carrito"
            description="Primero confirma el cliente. Luego revisa cada habitación seleccionada antes de guardar la reserva."
            action={
              <div className="rounded-full border bg-muted/30 px-4 py-2 text-sm font-medium">
                {cartItems.length} habitación(es) · {money(cartTotal)}
              </div>
            }
          >
            {cartItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-8 text-center">
                <ShoppingCart className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-semibold">El carrito está vacío</p>
                <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                  Ve al mapa de reservaciones, selecciona una o varias
                  habitaciones disponibles y presiona “Enviar al carrito”.
                </p>
                <Button
                  className="mt-4 rounded-full"
                  onClick={() => setActiveTab("mapa")}
                >
                  Ver mapa de reservaciones
                </Button>
              </div>
            ) : null}

            {reservationError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                {reservationError}
              </div>
            ) : null}

            <div className="grid gap-4 2xl:grid-cols-[380px_1fr]">
              <section className="space-y-4 rounded-3xl border bg-background p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Cliente
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    Información del huésped
                  </h3>
                </div>

                <Field label="Cliente existente">
                  <GuestCombobox
                    guests={existingGuests}
                    value={selectedGuestId}
                    onChange={selectExistingGuest}
                  />
                </Field>

                {selectedGuest ? (
                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {selectedGuest.guestName}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Documento {selectedGuest.dpi} · {selectedGuest.phone}
                        </p>
                        <p className="text-muted-foreground">
                          NIT FEL {selectedGuest.nit || "Pendiente"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <GuestStatusTags guest={selectedGuest} />
                      </div>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {selectedGuest.email || "Sin correo registrado"}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedGuest.stays} estadía(s) registradas ·{" "}
                      {selectedGuest.country}
                      {selectedGuest.department
                        ? `, ${selectedGuest.department}`
                        : ""}
                    </p>
                    {selectedGuest.credit ? (
                      <div
                        className={`mt-3 rounded-2xl border p-3 ${creditBadgeClass(selectedGuest.credit.health)}`}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <CreditCard className="size-4" />
                          {creditLabel(selectedGuest.credit)}
                        </div>
                        <p className="mt-1 text-xs">
                          Limite {money(selectedGuest.credit.limit)} · usado{" "}
                          {money(selectedGuest.credit.balance)} · vence{" "}
                          {selectedGuest.credit.dueDate}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                      El carrito solo crea la reserva. Los pagos se agregan
                      después desde la lista de Reservaciones.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Elige un cliente del listado. Para registrar uno nuevo o
                    corregir datos, ve a{" "}
                    <Link
                      to="/recepcion/clientes"
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Clientes
                    </Link>
                    .
                  </div>
                )}

                <div className="grid gap-3">
                  <Field label="Origen">
                    <SelectInput
                      value={form.source}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          source: event.target.value as ReservationSource,
                        }))
                      }
                    >
                      <option>Llamada</option>
                      <option>WhatsApp</option>
                      <option>Correo</option>
                      <option>Presencial</option>
                    </SelectInput>
                  </Field>

                  <Field label="Responsable">
                    <div className="flex h-10 items-center rounded-2xl border bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                      {form.createdBy || currentReservationResponsible()}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Se toma automáticamente del usuario que inició sesión.
                    </p>
                  </Field>

                  <Field label="Notas">
                    <TextArea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Llegada tarde, parqueo, empresa con crédito, observaciones..."
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                {cartItems.map((item, index) => {
                  const roomNights = nightsForCartItem(item);
                  const nightlyRate = rateForCartItem(item);
                  const roomTotal = totalForCartItem(item);
                  const occupancyOptions = occupancyOptionsForCartItem(item);
                  const calculation = calculationForCartItem(item);
                  const selectedRateOption = roomRateOption(
                    item.roomNumber,
                    item.occupancy,
                  );
                  const maxGuests = Math.max(
                    ...occupancyOptions.map(getGuestsFromOccupancy),
                  );
                  const turnoverWarning = cartItemTurnoverWarning(item);

                  return (
                    <article
                      key={item.id}
                      className="rounded-3xl border bg-background p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Habitación {index + 1}
                          </p>
                          <h3 className="mt-1 text-2xl font-bold">
                            Habitación {item.roomNumber}
                          </h3>
                          <p className="text-sm font-medium text-muted-foreground">
                            {item.roomType}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            Máximo {maxGuests} persona{maxGuests > 1 ? "s" : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => setRoomToRemove(item.id)}
                        >
                          <Trash2 className="size-4" />
                          Quitar habitación
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Fecha entrada">
                          <TextInput
                            type="date"
                            value={item.checkIn}
                            onChange={(event) =>
                              updateCartItem(item.id, {
                                checkIn: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Fecha salida">
                          <TextInput
                            type="date"
                            value={item.checkOut}
                            onChange={(event) =>
                              updateCartItem(item.id, {
                                checkOut: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Cantidad de personas">
                          <SelectInput
                            value={item.occupancy}
                            onChange={(event) =>
                              updateCartItem(item.id, {
                                occupancy: event.target.value as Occupancy,
                              })
                            }
                          >
                            {occupancyOptions.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </SelectInput>
                        </Field>

                        <Field label="Tipo de tarifa">
                          <SelectInput
                            value={item.rateType}
                            onChange={(event) =>
                              updateCartItem(item.id, {
                                rateType: event.target.value as RateType,
                              })
                            }
                          >
                            <option>Normal</option>
                            <option>Corporativa</option>
                            <option>Manual con autorización</option>
                          </SelectInput>
                        </Field>

                        <Field label="Tipo de habitación">
                          <div className="flex h-10 w-full items-center rounded-2xl border bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                            {item.roomType}
                          </div>
                        </Field>

                        <Field label="Tarifa manual (Q.)">
                          <MoneyTextInput
                            min={0}
                            disabled={
                              item.rateType !== "Manual con autorización"
                            }
                            value={item.manualRate || ""}
                            onChange={(event) =>
                              updateCartItem(item.id, {
                                manualRate:
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value),
                              })
                            }
                          />
                        </Field>

                        <div className="rounded-2xl border bg-muted/10 p-4">
                          <p className="text-xs text-muted-foreground">
                            Tarifa por noche
                          </p>
                          <p className="mt-1 text-xl font-bold">
                            {money(nightlyRate)}
                          </p>
                        </div>

                        <div className="rounded-2xl border bg-muted/10 p-4">
                          <p className="text-xs text-muted-foreground">
                            Total habitación
                          </p>
                          <p className="mt-1 text-xl font-bold">
                            {money(roomTotal)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {roomNights} noche(s)
                          </p>
                        </div>
                      </div>

                      {turnoverWarning ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                          <strong>Entrada el mismo día de checkout:</strong>{" "}
                          {turnoverWarning}
                        </div>
                      ) : null}

                      <div
                        className={`mt-4 rounded-2xl border p-4 text-sm ${
                          calculation?.status === "error"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : calculation?.status === "loading"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-emerald-200 bg-emerald-50 text-emerald-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">
                            {calculation?.status === "error"
                              ? "No se pudo calcular"
                              : calculation?.status === "loading"
                                ? "Calculando tarifa"
                                : "Tarifa confirmada"}
                          </span>
                          <span className="rounded-full border bg-background/70 px-2.5 py-1 text-xs font-semibold">
                            {selectedRateOption.isSpecific
                              ? "Especial"
                              : item.rateType}
                          </span>
                        </div>
                        {calculation?.status === "error" ? (
                          <p className="mt-1">{calculation.error}</p>
                        ) : (
                          <p className="mt-1">
                            {item.occupancy} · {roomNights} noche(s) ·{" "}
                            {money(roomTotal)}
                          </p>
                        )}
                      </div>

                      {item.rateType === "Manual con autorización" ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <strong>Tarifa manual:</strong> debe quedar autorizada
                          por gerencia o administración antes de emitir la
                          reserva final.
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">Habitaciónes</p>
                <p className="mt-1 text-xl font-bold">{cartItems.length}</p>
              </div>
              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">Noches totales</p>
                <p className="mt-1 text-xl font-bold">
                  {cartItems.reduce(
                    (sum, item) => sum + nightsForCartItem(item),
                    0,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">Total carrito</p>
                <p className="mt-1 text-xl font-bold">{money(cartTotal)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="text-xs">Estado al guardar</p>
                <p className="mt-1 text-xl font-bold">Confirmadas</p>
                <p className="mt-1 text-xs">Pagos iniciales: no aplica</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={reservationCreateMode !== null}
                onClick={() => setActiveTab("mapa")}
              >
                Volver al mapa de reservaciones
              </Button>
              {paidAmount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="group/action gap-2 rounded-full border-blue-200 text-blue-800 hover:bg-blue-50 hover:shadow-sm"
                  onClick={() => void handleCreateReservation(true)}
                  disabled={
                    cartItems.length === 0 || reservationCreateMode !== null
                  }
                  title="Guarda la reserva y abre FEL con los pagos pendientes."
                >
                  <BadgeCheck className="size-4 transition-transform group-hover/action:scale-110" />
                  Facturar pendiente
                </Button>
              ) : null}
              <Button
                className="gap-2 rounded-full"
                onClick={() => void handleCreateReservation(false)}
                disabled={
                  cartItems.length === 0 || reservationCreateMode !== null
                }
              >
                <CalendarPlus className="size-4" />
                {reservationCreateMode === "save"
                  ? "Creando..."
                  : "Crear reserva"}
              </Button>
            </div>
          </Panel>

          <AlertDialog
            open={Boolean(roomToRemove)}
            onOpenChange={(open) => {
              if (!open) setRoomToRemove(null);
            }}
          >
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Quitar habitación del carrito
                </AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Seguro que quieres quitar la habitación{" "}
                  {cartItemToRemove?.roomNumber ?? ""} del{" "}
                  {cartItemToRemove?.checkIn ?? ""} al{" "}
                  {cartItemToRemove?.checkOut ?? ""}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (roomToRemove) removeCartItem(roomToRemove);
                    setRoomToRemove(null);
                  }}
                >
                  Sí, quitar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="reservas" className="space-y-4">
          <Panel
            title="Reservaciones"
            description="Controla reservas confirmadas, abonos y envíos a check-in."
            action={
              <div className="flex w-full flex-wrap items-end gap-2 xl:justify-end">
                <label className="min-w-[150px] flex-1 space-y-1 text-xs font-medium text-muted-foreground sm:flex-none">
                  Desde
                  <TextInput
                    type="date"
                    value={reservationDateFrom}
                    max={reservationDateTo || undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReservationDateFrom(value);
                      if (reservationDateTo && value > reservationDateTo) {
                        setReservationDateTo(value);
                      }
                    }}
                  />
                </label>
                <label className="min-w-[150px] flex-1 space-y-1 text-xs font-medium text-muted-foreground sm:flex-none">
                  Hasta
                  <TextInput
                    type="date"
                    value={reservationDateTo}
                    min={reservationDateFrom || undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReservationDateTo(value);
                      if (reservationDateFrom && value < reservationDateFrom) {
                        setReservationDateFrom(value);
                      }
                    }}
                  />
                </label>
                <div className="relative min-w-[240px] flex-1 sm:w-80 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <TextInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar huésped, DPI, teléfono..."
                    className="pl-9"
                  />
                </div>
                {reservationDateFrom || reservationDateTo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-full"
                    onClick={() => {
                      setReservationDateFrom("");
                      setReservationDateTo("");
                    }}
                  >
                    Limpiar fechas
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="space-y-3">
              {filteredReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay reservaciones con ese filtro.
                </div>
              ) : (
                filteredReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    credit={
                      existingGuests.find(
                        (guest) => guest.id === reservation.guestId,
                      )?.credit
                    }
                    onConfirm={() =>
                      updateReservationStatus(reservation.id, "Reservada")
                    }
                    onSendToCheckIn={() =>
                      updateReservationStatus(
                        reservation.id,
                        "Lista para check-in",
                      )
                    }
                    onCancel={() => setReservationToCancel(reservation)}
                    onPrint={() => printReservation(reservation)}
                    onPrintReceipt={() => printReservationReceipt(reservation)}
                    onPrintPaymentReceipt={(payment) =>
                      printReservationReceipt(reservation, payment)
                    }
                    onIssueInvoice={() => openReservationInvoice(reservation)}
                    onAbonosChange={(payments) =>
                      updateReservationPayments(reservation.id, payments)
                    }
                    hasUnsavedPaymentChanges={dirtyReservationPaymentIds.has(
                      reservation.id,
                    )}
                    onSavePayments={() => {
                      void saveReservationPayments(reservation.id);
                    }}
                  />
                ))
              )}
            </div>
          </Panel>

          <AlertDialog
            open={Boolean(invoiceReservation)}
            onOpenChange={closeReservationInvoice}
          >
            <AlertDialogContent className="!w-[min(1080px,calc(100vw-2rem))] !max-w-none rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Emitir factura</AlertDialogTitle>
                <AlertDialogDescription>
                  {invoiceReservation
                    ? `${invoiceReservation.code} · ${invoiceReservation.guestName}`
                    : "Reservación seleccionada"}
                </AlertDialogDescription>
              </AlertDialogHeader>

              {invoiceSubmitting ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Espera un momento, emitiendo factura FEL...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        DIGIFACT puede tardar varios segundos. No cierres esta
                        ventana.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {invoiceForm ? (
                <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-2">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Total pendiente
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {money(
                          reservationInvoiceablePaymentTotal(
                            invoiceableReservationPayments,
                          ),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Disponible
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {money(
                          reservationInvoiceablePaymentTotal(
                            invoiceableReservationPayments,
                          ),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Esta factura
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {money(selectedReservationInvoicePaymentTotal)}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Documentos fiscales restantes
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {invoiceRemaining?.remaining ??
                          (invoiceLoading ? "..." : "N/D")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="rounded-2xl border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Pagos de la reservación y estadía
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedReservationInvoicePayments.length} de{" "}
                            {invoiceableReservationPayments.length} pendientes
                            seleccionados
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {invoiceableReservationPayments.length > 0 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full"
                              onClick={() => {
                                const selectedReservationPaymentIds =
                                  invoiceableReservationPayments.map(
                                    paymentRecordKey,
                                  );
                                updateInvoiceForm({
                                  selectedReservationPaymentIds,
                                  description: invoiceReservation
                                    ? buildReservationPaymentInvoiceDescription(
                                        invoiceReservation,
                                        invoiceableReservationPayments,
                                      )
                                    : invoiceForm.description,
                                  unitPriceWithTax: String(
                                    reservationInvoiceablePaymentTotal(
                                      invoiceableReservationPayments,
                                    ),
                                  ),
                                });
                              }}
                            >
                              Seleccionar pendientes
                            </Button>
                          ) : null}
                          <p className="text-sm font-bold">
                            {money(selectedReservationInvoicePaymentTotal)}
                          </p>
                        </div>
                      </div>

                      {savedReservationInvoicePayments.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No hay pagos guardados para mostrar.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {savedReservationInvoicePayments.map((payment) => {
                            const paymentKey = paymentRecordKey(payment);
                            const sourceModule =
                              paymentIssueSourceModule(payment);
                            const alreadyInvoiced =
                              reservationPaymentInvoiceableAmount(payment) <=
                              0.01;
                            const selected =
                              invoiceForm.selectedReservationPaymentIds.includes(
                                paymentKey,
                              );

                            return (
                              <div
                                key={paymentKey}
                                className={cn(
                                  "flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 text-sm",
                                  alreadyInvoiced
                                    ? "border-emerald-200 bg-emerald-50/50"
                                    : "transition hover:border-primary/40 hover:bg-muted/30",
                                )}
                              >
                                {alreadyInvoiced ? (
                                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={(checked) =>
                                      toggleReservationInvoicePayment(
                                        payment,
                                        checked === true,
                                      )
                                    }
                                    aria-label={`Seleccionar pago ${paymentMethodLabel(payment.method)}`}
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {paymentMethodLabel(payment.method)} -{" "}
                                    {formatDateShort(payment.date)}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {sourceModule ===
                                    INVOICE_SOURCE_MODULES.RESERVATION
                                      ? "Reservación"
                                      : sourceModule ===
                                          INVOICE_SOURCE_MODULES.CHECK_IN
                                        ? "Check-in"
                                        : sourceModule ===
                                            INVOICE_SOURCE_MODULES.CHECK_OUT
                                          ? "Check-out"
                                          : sourceModule}
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
                                        Facturado
                                        {payment.invoiceId
                                          ? ` #${payment.invoiceId}`
                                          : ""}
                                      </span>
                                      {payment.invoiceId ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="size-8 rounded-full border-emerald-200 text-emerald-800"
                                          title={`Reimprimir factura #${payment.invoiceId}`}
                                          onClick={() =>
                                            void reprintReservationInvoice(
                                              payment.invoiceId!,
                                            )
                                          }
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

                    <div className="space-y-4">
                      <div className="rounded-2xl border bg-background p-4">
                        <div className="grid gap-3">
                          <div className="space-y-1 text-sm font-medium">
                            <div className="flex items-center justify-between gap-2">
                              <span>NIT</span>
                              <Button
                                type="button"
                                variant={
                                  invoiceForm.useCustomerTaxInfo
                                    ? "outline"
                                    : "default"
                                }
                                size="sm"
                                className="h-8 rounded-full px-3 text-xs font-semibold shadow-sm"
                                onClick={() => {
                                  if (!invoiceReservation) return;
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

                                    const guest = clientDirectory.find(
                                      (item) =>
                                        item.id === invoiceReservation.guestId,
                                    );
                                    const customerTaxId =
                                      (
                                        invoiceReservation.nit ||
                                        guest?.nit ||
                                        "CF"
                                      )
                                        .trim()
                                        .toUpperCase() || "CF";
                                    return {
                                      ...current,
                                      useCustomerTaxInfo: true,
                                      taxId: customerTaxId,
                                      name:
                                        customerTaxId === "CF"
                                          ? "CONSUMIDOR FINAL"
                                          : invoiceReservation.guestName,
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
                              className={
                                invoiceForm.useCustomerTaxInfo
                                  ? "bg-muted/40"
                                  : undefined
                              }
                              onChange={(event) => {
                                setInvoiceNitLookupStatus("idle");
                                updateInvoiceForm({
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
                                onClick={() => void lookupInvoiceNitInfo()}
                              >
                                Consultar NIT
                              </Button>
                            ) : null}
                          </div>

                          <Field label="Nombre receptor">
                            {invoiceForm.useCustomerTaxInfo ? (
                              <div className="flex min-h-10 whitespace-normal break-words rounded-2xl border bg-muted/20 px-3 py-2 text-sm font-semibold">
                                {invoiceForm.name || "CONSUMIDOR FINAL"}
                              </div>
                            ) : (
                              <>
                                <TextInput
                                  value={
                                    invoiceForm.taxId.trim().toUpperCase() ===
                                    "CF"
                                      ? "CONSUMIDOR FINAL"
                                      : invoiceForm.name
                                  }
                                  readOnly={
                                    invoiceForm.taxId.trim().toUpperCase() ===
                                    "CF"
                                  }
                                  onChange={(event) =>
                                    updateInvoiceForm({
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder="DIGIFACT lo completa o puedes escribirlo"
                                />
                                <p className="text-xs text-muted-foreground">
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
                          </Field>

                          <Field label="Dirección">
                            <TextInput
                              value={invoiceForm.address}
                              onChange={(event) =>
                                updateInvoiceForm({
                                  address: event.target.value,
                                })
                              }
                            />
                          </Field>
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
                          El sistema genera este concepto automáticamente según
                          los pagos seleccionados.
                        </p>
                      </div>

                      <div className="rounded-2xl border bg-background p-4">
                        <p className="text-xs text-muted-foreground">
                          Monto a facturar
                        </p>
                        <p className="mt-1 text-2xl font-bold">
                          {money(selectedReservationInvoicePaymentTotal)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Total exacto de los pagos seleccionados.
                        </p>
                      </div>

                      {issuedInvoiceResponse ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                          <p className="font-semibold">Factura emitida</p>
                          {issuedInvoiceFields.length > 0 ? (
                            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                              {issuedInvoiceFields.map(([label, value]) => (
                                <div key={label}>
                                  <dt className="text-xs text-emerald-800">
                                    {label}
                                  </dt>
                                  <dd className="font-semibold">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="mt-1 text-emerald-800">
                              Factura emitida correctamente.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel
                  className="rounded-full"
                  disabled={invoiceSubmitting}
                >
                  Cerrar
                </AlertDialogCancel>
                {issuedInvoiceResponse ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                    <BadgeCheck className="size-4" />
                    Factura emitida correctamente
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="gap-2 rounded-full"
                    onClick={issueReservationInvoice}
                    disabled={!canIssueInvoice}
                  >
                    <BadgeCheck className="size-4" />
                    {invoiceSubmitting ? "Emitiendo..." : "Emitir factura"}
                  </Button>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={Boolean(reservationToCancel)}
            onOpenChange={(open) => {
              if (!open) {
                setReservationToCancel(null);
                setCancelSupervisor("");
                setCancelReason("Huésped no se presentó");
              }
            }}
          >
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Solicitar cancelación</AlertDialogTitle>
                <AlertDialogDescription>
                  La reserva {reservationToCancel?.code} de{" "}
                  {reservationToCancel?.guestName} no se cancelará de inmediato.
                  La solicitud quedará pendiente para revisión en
                  Administración.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4 text-sm">
                <p className="text-muted-foreground">
                  Usa este flujo cuando recepción necesita cancelar una
                  reservación. La habitación se libera únicamente cuando la
                  solicitud sea aprobada.
                </p>
                <Field label="Solicitado por">
                  <TextInput
                    value={cancelSupervisor}
                    onChange={(event) =>
                      setCancelSupervisor(event.target.value)
                    }
                    placeholder="Nombre del usuario que solicita"
                  />
                </Field>
                <Field label="Motivo de cancelación">
                  <TextArea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="Ej. Huésped no se presentó"
                    className="min-h-20"
                  />
                </Field>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">
                  Volver
                </AlertDialogCancel>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={!canCancelReservation}
                  onClick={() => void createCancellationRequest()}
                >
                  Enviar solicitud
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Panel
            title="Historial de cambios"
            description="Auditoría visual: quién creó, confirmó, solicitó cancelación o preparó una reservación."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Acción</th>
                    <th className="py-3 pr-4">Reserva</th>
                    <th className="py-3 pr-4">Usuario</th>
                    <th className="py-3 pr-4">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-4 pr-4">{item.date}</td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold">
                          {item.action}
                        </span>
                      </td>
                      <td className="py-4 pr-4 font-semibold">
                        {item.reservationCode}
                      </td>
                      <td className="py-4 pr-4">{item.user}</td>
                      <td className="py-4 pr-4">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RecepcionReservacionesPage;
