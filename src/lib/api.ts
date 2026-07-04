import type { CheckInPaymentDecision } from "./types"

export type ApiId = string | number
export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>

export interface ApiEnvelope<T = unknown> {
  statusCode?: number
  success?: boolean
  message?: string | null
  data?: T
}

export interface PaymentItemModel {
  amount?: number
  payment_method?: string | null
  payment_reference?: string | null
  notes?: string | null
}

export interface MenuPermissionModel {
  id_menu?: number
  can_view?: boolean
  can_create?: boolean
  can_edit?: boolean
  can_delete?: boolean
}

export interface AssignCashShiftUserModel {
  id_user?: number
}

export interface CalculateRateModel {
  id_room?: number
  people_count?: number
  rate_type?: string | null
  check_in_date?: string
  check_out_date?: string
  manual_rate?: number | null
  manual_rate_reason?: string | null
}

export interface CancelEventModel {
  reason?: string | null
}

export interface CancelMaintenanceTicketModel {
  cancel_reason?: string | null
}

export interface CancelReservationModel {
  reason?: string | null
}

export interface CheckInPaymentDecisionModel {
  payment_decision?: CheckInPaymentDecision | null
  amount?: number
  payment_method?: string | null
  payment_reference?: string | null
  notes?: string | null
}

export interface CloseCashShiftModel {
  counted_cash?: number
  counted_card?: number
  counted_transfer?: number
  counted_deposit?: number
  difference_notes?: string | null
}

export interface ClosePaymentModel {
  payments?: PaymentItemModel[] | null
  notes?: string | null
}

export interface CompleteCheckInModel {
  inguat_book_reviewed?: boolean
  collect_balance_at_checkout?: boolean
  tv_control_delivered?: boolean
  balance_collected?: boolean
  key_delivered?: boolean
  breakfast_ticket_delivered?: boolean
  payments?: PaymentItemModel[] | null
  notes?: string | null
}

export interface CompleteCheckOutModel {
  key_received?: boolean
  consumptions_reviewed?: boolean
  final_balance_pending?: boolean
  tv_control_received?: boolean
  room_reviewed?: boolean
  notes?: string | null
}

export const INVOICE_SOURCE_MODULES = {
  RESERVATION: "Reservation",
  CHECK_IN: "CheckIn",
  CHECK_OUT: "CheckOut",
  MINIBAR: "Minibar",
  EVENT: "Event",
  CREDIT: "Credit",
  MANUAL: "Manual",
} as const

export const INVOICE_ITEM_TYPES = {
  BIEN: "BIEN",
  SERVICIO: "SERVICIO",
} as const

export const INVOICE_BILLING_MODES = {
  BY_PAYMENTS: "ByPayments",
  FULL_AMOUNT: "FullAmount",
  MANUAL: "Manual",
} as const

export const INVOICE_FORMATS = {
  PDF_XML: "PDF|XML",
  PDF: "PDF",
  XML: "XML",
} as const

export type InvoiceSourceModule =
  (typeof INVOICE_SOURCE_MODULES)[keyof typeof INVOICE_SOURCE_MODULES]

export type InvoiceItemType =
  (typeof INVOICE_ITEM_TYPES)[keyof typeof INVOICE_ITEM_TYPES]

export type InvoiceBillingMode =
  (typeof INVOICE_BILLING_MODES)[keyof typeof INVOICE_BILLING_MODES]

export type InvoiceFormat =
  (typeof INVOICE_FORMATS)[keyof typeof INVOICE_FORMATS]

export interface InvoiceBuyerInfo {
  taxId?: string | null
  name?: string | null
  address?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  country?: string | null
}

export interface IssueInvoiceItemModel {
  id_invoice_concept?: number | null
  item_type?: InvoiceItemType | string | null
  description?: string | null
  quantity?: number
  unit_price_with_tax?: number
  notes?: string | null
}

export interface IssueInvoiceModel {
  source_module?: InvoiceSourceModule | string | null
  source_id?: number | null
  id_guest?: number | null
  buyer?: InvoiceBuyerInfo | null
  format?: InvoiceFormat | string | null
  billing_mode?: InvoiceBillingMode | string | null
  items?: IssueInvoiceItemModel[] | null
  reservation_payment_ids?: number[] | null
  stay_payment_ids?: number[] | null
  event_payment_ids?: number[] | null
  minibar_review_detail_ids?: number[] | null
}

export interface CreateInvoiceConceptModel {
  name?: string | null
  item_type?: InvoiceItemType | string | null
  default_description?: string | null
  default_price?: number | null
}

export interface UpdateInvoiceConceptModel extends CreateInvoiceConceptModel {}

export interface InvoiceConceptsQuery extends QueryParams {
  item_type?: InvoiceItemType | string
  search?: string
}

export interface InvoicesQuery extends QueryParams {
  from?: string
  to?: string
  status?: string
  nit?: string
  customer?: string
  source_module?: InvoiceSourceModule | string
}

export interface CancelInvoiceModel {
  reason?: string | null
  notes?: string | null
}

export interface ConfirmReservationModel {
  payments?: PaymentItemModel[] | null
  notes?: string | null
}

export interface CreateBreakfastOptionModel {
  name?: string | null
  description?: string | null
  image_url?: string | null
  color?: number
  display_order?: number
  unit_cost?: number
}

export interface CreateBreakfastSelectionFromQrModel {
  qr_code?: string | null
  id_breakfast_option?: number
  beverage?: string | null
  guest_name?: string | null
  notes?: string | null
}

export interface CreateBreakfastVoucherModel {
  id_stay_room?: number
  id_breakfast_option?: number
  beverage?: string | null
  guest_name?: string | null
  notes?: string | null
}

export interface CreateCashShiftManualEntryModel {
  entry_type?: string | null
  movement_type?: string | null
  amount?: number
  payment_method?: string | null
  description?: string | null
  reference?: string | null
  registered_by?: string | null
}

export interface CreateCreditAccountModel {
  id_guest?: number
  credit_limit?: number
  notes?: string | null
}

export interface UpdateCreditAccountModel {
  credit_limit?: number
  due_date?: string | null
  notes?: string | null
}

export interface ChangeCreditAccountStatusModel {
  changed_by?: string | null
  notes?: string | null
}

export interface CreateCreditAuthorizationRequestModel {
  id_credit_account?: number
  request_type?: string | null
  requested_amount?: number | null
  reason?: string | null
  requested_by?: string | null
}

export interface CreateCreditMovementModel {
  concept?: string | null
  amount?: number
  source_module?: string | null
  source_id?: number | null
  reference?: string | null
  notes?: string | null
}

export interface CreateCreditPaymentModel {
  payments?: PaymentItemModel[] | null
  notes?: string | null
}

export interface CreateEventModel {
  id_event_salon?: number
  event_name?: string | null
  event_type?: string | null
  client_name?: string | null
  contact_phone?: string | null
  people_count?: number
  event_date?: string
  start_time?: string
  end_time?: string
  services_notes?: string | null
  quoted_total?: number
  meal_unit_cost?: number
  calculate_total_by_consumption?: boolean
  advance_amount?: number
  payment_method?: string | null
  payment_reference?: string | null
  confirm_event?: boolean
}

export interface CreateEventPaymentModel {
  amount?: number
  payment_method?: string | null
  payment_reference?: string | null
  notes?: string | null
}

export interface CreateEventSalonModel {
  name?: string | null
  description?: string | null
  capacity?: number
  base_price?: number
}

export interface CreateGuestModel {
  name_or_company?: string | null
  document_type?: string | null
  document_number?: string | null
  nit?: string | null
  phone?: string | null
  email?: string | null
  country?: string | null
  department?: string | null
  notes?: string | null
  is_frequent_customer?: boolean
}

export interface CreateInventoryItemModel {
  name?: string | null
  category?: string | null
  stock_quantity?: number
  minimum_quantity?: number
  unit_name?: string | null
  cost_price?: number
  guest_price?: number
  warehouse_name?: string | null
  supplier_name?: string | null
}

export interface UpdateInventoryItemModel extends CreateInventoryItemModel {
  is_active?: boolean
}

export interface CreateInventoryMovementModel {
  id_inventory_item?: number
  movement_type?: string | null
  quantity?: number
  notes?: string | null
  registered_by?: string | null
}

export interface CreateInventoryPurchaseOrderDetailModel {
  id_inventory_item?: number
  ordered_quantity?: number
  unit_cost?: number
}

export interface CreateInventoryPurchaseOrderModel {
  category?: string | null
  supplier_name?: string | null
  ordered_by?: string | null
  notes?: string | null
  items?: CreateInventoryPurchaseOrderDetailModel[] | null
}

export interface ReceiveInventoryPurchaseOrderDetailModel {
  id_inventory_purchase_order_detail?: number
  received_quantity?: number
}

export interface ReceiveInventoryPurchaseOrderModel {
  received_by?: string | null
  notes?: string | null
  items?: ReceiveInventoryPurchaseOrderDetailModel[] | null
}

export interface CreateLinenItemModel {
  code?: string | null
  name?: string | null
  category?: string | null
  available_quantity?: number
  minimum_quantity?: number
  replacement_cost?: number
  notes?: string | null
}

export interface UpdateLinenItemModel extends CreateLinenItemModel {
  is_active?: boolean
}

export interface CreateLinenAssignmentModel {
  id_room?: number
  id_linen_item?: number
  quantity?: number
  assigned_by?: string | null
  notes?: string | null
}

export interface SendLinenAssignmentToLaundryModel {
  id_linen_assignment?: number
  quantity?: number
  sent_by?: string | null
  estimated_return_at?: string | null
  notes?: string | null
}

export interface SendRoomLinenToLaundryModel {
  id_room?: number
  sent_by?: string | null
  estimated_return_at?: string | null
  notes?: string | null
}

export interface CreateLinenDamageFromAssignmentModel {
  id_linen_assignment?: number
  quantity?: number
  reason?: string | null
  reported_by?: string | null
  should_charge_guest?: boolean
  notes?: string | null
}

export interface ChargeLinenDamageModel {
  charged_by?: string | null
  notes?: string | null
}

export interface MarkLinenLaundryReadyModel {
  ready_by?: string | null
  notes?: string | null
}

export interface ReturnLinenLaundryToAvailableModel {
  returned_by?: string | null
  notes?: string | null
}

export interface ReturnLinenLaundryToRoomModel {
  returned_by?: string | null
  notes?: string | null
}

export interface RetireLinenDamageModel {
  retired_by?: string | null
  notes?: string | null
}

export interface CreateMaintenanceTicketModel {
  id_room?: number
  category?: string | null
  urgency?: string | null
  description?: string | null
  responsible?: string | null
  estimated_cost?: number | null
  block_room?: boolean
}

export interface CreateMenuRolesModel {
  name_rol?: string | null
  rol_description?: string | null
  menu_permissions?: MenuPermissionModel[] | null
}

export interface CreateReservationRoomModel {
  id_room?: number
  check_in_date?: string
  check_out_date?: string
  people_count?: number
  rate_type?: string | null
  manual_rate?: number | null
  manual_rate_reason?: string | null
}

export interface CreateReservationModel {
  id_guest?: number
  origin?: string | null
  responsible?: string | null
  notes?: string | null
  payments?: PaymentItemModel[] | null
  rooms?: CreateReservationRoomModel[] | null
}

export interface CreateReservationCancellationRequestModel {
  reason?: string | null
  requested_by?: string | null
}

export interface CreateReservationNightPaymentModel {
  id_reservation_room?: number
  night_date?: string
  payments?: PaymentItemModel[] | null
  notes?: string | null
}

export interface ExtendReservationRoomModel {
  new_check_out_date?: string
  responsible?: string | null
  reason?: string | null
}

export interface ReviewReservationCancellationRequestModel {
  reviewed_by?: string | null
  review_notes?: string | null
}

export interface CreateRolModel {
  name_rol?: string | null
  rol_description?: string | null
  menu_roles?: number[] | null
}

export interface CreateMinibarRoomReviewDetailModel {
  id_inventory_item?: number
  consumed_quantity?: number
}

export interface CreateMinibarRoomReviewModel {
  id_room?: number
  id_stay?: number
  reviewed_by?: string | null
  notes?: string | null
  items?: CreateMinibarRoomReviewDetailModel[] | null
}

export interface RestockRoomMinibarItemModel {
  id_inventory_item?: number
  quantity?: number
  expected_quantity?: number
}

export interface RestockRoomMinibarModel {
  items?: RestockRoomMinibarItemModel[] | null
  registered_by?: string | null
  notes?: string | null
}

export interface ConfigureRoomMinibarItemModel {
  id_inventory_item?: number
  expected_quantity?: number
}

export interface ConfigureRoomMinibarModel {
  items?: ConfigureRoomMinibarItemModel[] | null
}

export interface CreateRoomModel {
  room_number?: string | null
  floor?: number
  id_room_type?: number
  status?: string | null
  internal_notes?: string | null
  amenity_ids?: number[] | null
}

export interface SetRoomOccupancyOptionsModel {
  people_counts?: number[] | null
}

export interface CreateRoomSpecificRateModel {
  people_count?: number
  price?: number
  reason?: string | null
}

export interface CreateUserModel {
  names?: string | null
  lastnames?: string | null
  status?: boolean
  user_name?: string | null
  password?: string | null
  phone_number?: string | null
  id_rol?: number
}

export interface FinishEventModel {
  allow_pending_balance?: boolean
  notes?: string | null
}

export interface GetMenuListByIdRequestModel {
  id_rol?: number
}

export interface LoginRequestModel {
  username?: string | null
  password?: string | null
}

export interface QuoteRateModel {
  id_room?: number
  check_in_date?: string
  check_out_date?: string
  people_count?: number
  rate_type?: string | null
  manual_rate?: number | null
}

export interface RedeemBreakfastSelectionModel {
  redeemed_by?: string | null
}

export interface ResolveMaintenanceTicketModel {
  final_cost?: number | null
  resolution_notes?: string | null
  send_room_to_cleaning?: boolean
}

export interface ReviewCreditAuthorizationRequestModel {
  reviewed_by?: string | null
  review_notes?: string | null
}

export interface UpdateBreakfastOptionModel {
  name?: string | null
  description?: string | null
  image_url?: string | null
  color?: number
  display_order?: number
  unit_cost?: number
  is_active?: boolean
}

export interface UpdateCashShiftChecklistModel {
  cash_counted?: boolean
  pos_card_reviewed?: boolean
  transfers_deposits_reviewed?: boolean
  invoices_reviewed?: boolean
  accounting_rubrics_reviewed?: boolean
  observations_added_if_difference?: boolean
}

export interface UpdateGuestModel extends CreateGuestModel {}

export interface UpdateMenuRolesModel {
  id_rol?: number
  name_rol?: string | null
  rol_description?: string | null
  menu_permissions?: MenuPermissionModel[] | null
}

export interface UpdateRoomModel extends CreateRoomModel {}

export interface UpdateRoomStatusModel {
  status?: string | null
  notes?: string | null
}

export interface UpdateUserModel {
  id_user?: number
  names?: string | null
  lastnames?: string | null
  status?: boolean
  user_name?: string | null
  phone_number?: string | null
  id_rol?: number
  usa_serie_factura?: boolean
  serie_factura?: string | null
  comision_venta?: number
  route_number?: number | null
}

export interface UpdateUserPasswordModel {
  id_user?: number
  password?: string | null
}

export interface BreakfastStatusQuery extends QueryParams {
  status?: string
}

export interface AuthorizationRequestsQuery extends QueryParams {
  status?: string
}

export interface EventSalonAvailabilityQuery extends QueryParams {
  id_event_salon?: number
  event_date?: string
  start_time?: string
  end_time?: string
}

export interface RoomAvailabilityQuery extends QueryParams {
  check_in_date?: string
  check_out_date?: string
  id_room_type?: number
  people_count?: number
}

export interface InventoryItemsQuery extends QueryParams {
  category?: string
  search?: string
  stockStatus?: string
}

export interface InventoryPurchaseOrdersQuery extends QueryParams {
  category?: string
  status?: string
}

export interface InventoryMovementsQuery extends QueryParams {
  category?: string
  id_inventory_item?: number
  movement_type?: string
  from?: string
  to?: string
}

export interface LinenItemsQuery extends QueryParams {
  search?: string
}

export interface LinenLaundryQuery extends QueryParams {
  status?: string
}

export interface LinenDamagesQuery extends QueryParams {
  status?: string
}

export interface LinenMovementsQuery extends QueryParams {
  id_linen_item?: number
  id_room?: number
  movement_type?: string
  from?: string
  to?: string
}

export interface MinibarPendingChargesQuery extends QueryParams {
  status?: string
}

export interface ReportQuery extends QueryParams {
  from?: string
  to?: string
  granularity?: string
}

export interface HotelDashboardReportQuery extends ReportQuery {
  selected_date?: string
}

export interface ReservationCancelRequestsQuery extends QueryParams {
  status?: string
}

interface ApiRequestOptions<TBody> extends Omit<RequestInit, "body"> {
  body?: TBody
  query?: QueryParams
}

const API_TOKEN_STORAGE_KEY = "casa-luna-api-token"
const API_SESSION_STORAGE_KEY = "casa-luna-session"
export const API_AUTH_EXPIRED_EVENT = "casa-luna-api-auth-expired"
const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export function getApiToken() {
  if (typeof window === "undefined") return null

  const apiToken = window.localStorage.getItem(API_TOKEN_STORAGE_KEY)
  const sessionToken = window.localStorage.getItem(API_SESSION_STORAGE_KEY)
  const validSessionToken =
    sessionToken && sessionToken !== "admin" && !isJwtExpired(sessionToken)
      ? sessionToken
      : null
  const validApiToken =
    apiToken && !isJwtExpired(apiToken)
      ? apiToken
      : null
  const token = validSessionToken ?? validApiToken ?? apiToken ?? (
    sessionToken && sessionToken !== "admin" ? sessionToken : null
  )

  if (token && token !== apiToken) {
    window.localStorage.setItem(API_TOKEN_STORAGE_KEY, token)
  }

  return token
}

function getAlternateApiToken(currentToken: string | null) {
  if (typeof window === "undefined") return null

  const tokens = [
    window.localStorage.getItem(API_SESSION_STORAGE_KEY),
    window.localStorage.getItem(API_TOKEN_STORAGE_KEY),
  ]
    .filter((token): token is string => Boolean(token && token !== "admin"))
    .filter((token, index, items) => items.indexOf(token) === index)

  return tokens.find((token) => token !== currentToken && !isJwtExpired(token)) ?? null
}

export function setApiToken(token: string | null | undefined) {
  if (typeof window === "undefined") return

  if (token) {
    window.localStorage.setItem(API_TOKEN_STORAGE_KEY, token)
    window.localStorage.setItem(API_SESSION_STORAGE_KEY, token)
  } else {
    window.localStorage.removeItem(API_TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(API_SESSION_STORAGE_KEY)
  }
}

export function clearApiToken() {
  setApiToken(null)
}

function notifyAuthExpired() {
  clearApiToken()

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(API_AUTH_EXPIRED_EVENT))
  }
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".")
  if (!payload || typeof window === "undefined") return null

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=")

  try {
    return JSON.parse(window.atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function isJwtExpired(token: string | null | undefined, skewMs = 30_000) {
  if (!token) return true
  if (token.split(".").length !== 3) return true

  const payload = decodeJwtPayload(token)
  const exp = typeof payload?.exp === "number" ? payload.exp : null
  if (!exp) return true

  return Date.now() + skewMs >= exp * 1000
}

export function extractApiToken(payload: unknown): string | null {
  const tokenKeys = new Set([
    "token",
    "accessToken",
    "access_token",
    "jwt",
    "bearerToken",
    "bearer_token",
  ])

  const visit = (value: unknown, depth: number): string | null => {
    if (!isRecord(value) || depth > 3) return null

    for (const [key, nested] of Object.entries(value)) {
      if (tokenKeys.has(key) && typeof nested === "string" && nested.length > 0) {
        return nested
      }
    }

    for (const nested of Object.values(value)) {
      const token = visit(nested, depth + 1)
      if (token) return token
    }

    return null
  }

  return visit(payload, 0)
}

export function getApiErrorMessage(error: unknown, fallback = "No se pudo completar la solicitud.") {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

export async function apiRequest<T = unknown, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<T> {
  const { body, headers, query, ...fetchOptions } = options
  const requestHeaders = new Headers(headers)
  const isLoginRequest = path === "/api/v1/user/login"
  const url = buildApiUrl(path, query)
  const serializedBody = body === undefined ? undefined : JSON.stringify(body)
  requestHeaders.set("Accept", "application/json")

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json")
  }

  const token = getApiToken()
  if (token && !isLoginRequest) {
    if (isJwtExpired(token)) {
      notifyAuthExpired()
      throw new ApiError("Tu sesion expiro. Inicia sesion otra vez.", 401, null)
    }

    if (!requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", `Bearer ${token}`)
    }
  }

  let response = await fetch(url, {
    ...fetchOptions,
    body: serializedBody,
    headers: requestHeaders,
  })
  let payload = await parseResponse(response)
  if (response.status === 401 && !isLoginRequest) {
    const alternateToken = getAlternateApiToken(token)
    if (alternateToken) {
      setApiToken(alternateToken)
      requestHeaders.set("Authorization", `Bearer ${alternateToken}`)
      response = await fetch(url, {
        ...fetchOptions,
        body: serializedBody,
        headers: requestHeaders,
      })
      payload = await parseResponse(response)
    }
  }
  const envelope = isApiEnvelope(payload) ? payload : null

  if (!response.ok) {
    throw new ApiError(
      getPayloadMessage(payload) ?? `Solicitud fallida (${response.status})`,
      response.status,
      payload,
    )
  }

  if (envelope?.success === false) {
    throw new ApiError(
      envelope.message ?? `Solicitud fallida (${envelope.statusCode ?? response.status})`,
      envelope.statusCode ?? response.status,
      payload,
    )
  }

  return (envelope ? envelope.data : payload) as T
}

export const api = {
  breakfast: {
    listOptions: <T = unknown[]>() => apiRequest<T>("/api/breakfast/options"),
    createOption: <T = unknown>(body: CreateBreakfastOptionModel) =>
      apiRequest<T, CreateBreakfastOptionModel>("/api/breakfast/options", {
        method: "POST",
        body,
      }),
    updateOption: <T = unknown>(id: ApiId, body: UpdateBreakfastOptionModel) =>
      apiRequest<T, UpdateBreakfastOptionModel>(`/api/breakfast/options/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    deleteOption: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/breakfast/options/${segment(id)}`, { method: "DELETE" }),
    listRoomQrCodes: <T = unknown[]>() => apiRequest<T>("/api/breakfast/rooms/qr-codes"),
    createSelectionFromQr: <T = unknown>(body: CreateBreakfastSelectionFromQrModel) =>
      apiRequest<T, CreateBreakfastSelectionFromQrModel>(
        "/api/breakfast/selections/from-qr",
        {
          method: "POST",
          body,
        },
      ),
    listTodaySelections: <T = unknown[]>(query?: BreakfastStatusQuery) =>
      apiRequest<T>("/api/breakfast/selections/today", { query }),
    redeemSelection: <T = unknown>(id: ApiId, body: RedeemBreakfastSelectionModel) =>
      apiRequest<T, RedeemBreakfastSelectionModel>(
        `/api/breakfast/selections/${segment(id)}/redeem`,
        {
          method: "PATCH",
          body,
        },
      ),
    restoreSelection: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/breakfast/selections/${segment(id)}/restore`, {
        method: "PATCH",
      }),
    listTodayVouchers: <T = unknown[]>(query?: BreakfastStatusQuery) =>
      apiRequest<T>("/api/breakfast/vouchers/today", { query }),
    createVoucher: <T = unknown>(body: CreateBreakfastVoucherModel) =>
      apiRequest<T, CreateBreakfastVoucherModel>("/api/breakfast/vouchers", {
        method: "POST",
        body,
      }),
    redeemVoucher: <T = unknown>(id: ApiId, body: RedeemBreakfastSelectionModel) =>
      apiRequest<T, RedeemBreakfastSelectionModel>(
        `/api/breakfast/vouchers/${segment(id)}/redeem`,
        {
          method: "PATCH",
          body,
        },
      ),
    getDailyReport: <T = unknown>() => apiRequest<T>("/api/breakfast/reports/daily"),
  },

  cashShifts: {
    listConfigs: <T = unknown[]>() => apiRequest<T>("/api/cash-shifts/configs"),
    assignConfigUser: <T = unknown>(id: ApiId, body: AssignCashShiftUserModel) =>
      apiRequest<T, AssignCashShiftUserModel>(
        `/api/cash-shifts/configs/${segment(id)}/assign-user`,
        {
          method: "PATCH",
          body,
        },
      ),
    getCurrent: <T = unknown>() => apiRequest<T>("/api/cash-shifts/current"),
    getSummary: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/cash-shifts/${segment(id)}/summary`),
    createManualEntry: <T = unknown>(id: ApiId, body: CreateCashShiftManualEntryModel) =>
      apiRequest<T, CreateCashShiftManualEntryModel>(
        `/api/cash-shifts/${segment(id)}/manual-entries`,
        {
          method: "POST",
          body,
        },
      ),
    updateChecklist: <T = unknown>(id: ApiId, body: UpdateCashShiftChecklistModel) =>
      apiRequest<T, UpdateCashShiftChecklistModel>(
        `/api/cash-shifts/${segment(id)}/checklist`,
        {
          method: "PATCH",
          body,
        },
      ),
    close: <T = unknown>(id: ApiId, body: CloseCashShiftModel) =>
      apiRequest<T, CloseCashShiftModel>(`/api/cash-shifts/${segment(id)}/close`, {
        method: "POST",
        body,
      }),
  },

  checkIn: {
    listArrivals: <T = unknown[]>() => apiRequest<T>("/api/check-in/arrivals"),
    savePaymentDecision: <T = unknown>(
      reservationId: ApiId,
      body: CheckInPaymentDecisionModel,
    ) =>
      apiRequest<T, CheckInPaymentDecisionModel>(
        `/api/check-in/${segment(reservationId)}/payment-decision`,
        {
          method: "POST",
          body,
        },
      ),
    complete: <T = unknown>(reservationId: ApiId, body: CompleteCheckInModel) =>
      apiRequest<T, CompleteCheckInModel>(
        `/api/check-in/${segment(reservationId)}/complete`,
        {
          method: "POST",
          body,
        },
      ),
  },

  checkOut: {
    listInHouse: <T = unknown[]>() => apiRequest<T>("/api/check-out/in-house"),
    closePayment: <T = unknown>(stayId: ApiId, body: ClosePaymentModel) =>
      apiRequest<T, ClosePaymentModel>(`/api/check-out/${segment(stayId)}/close-payment`, {
        method: "POST",
        body,
      }),
    complete: <T = unknown>(stayId: ApiId, body: CompleteCheckOutModel) =>
      apiRequest<T, CompleteCheckOutModel>(`/api/check-out/${segment(stayId)}/complete`, {
        method: "POST",
        body,
      }),
  },

  invoices: {
    getRemaining: <T = unknown>() => apiRequest<T>("/api/invoices/remaining"),
    list: <T = unknown[]>(query?: InvoicesQuery) =>
      apiRequest<T>("/api/invoices", { query }),
    issue: <T = unknown>(body: IssueInvoiceModel) =>
      apiRequest<T, IssueInvoiceModel>("/api/invoices/issue", {
        method: "POST",
        body,
      }),
    getById: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/invoices/${segment(id)}`),
    cancel: <T = unknown>(id: ApiId, body: CancelInvoiceModel) =>
      apiRequest<T, CancelInvoiceModel>(`/api/invoices/${segment(id)}/cancel`, {
        method: "POST",
        body,
      }),
    getNitInfo: <T = unknown>(nit: string) =>
      apiRequest<T>(`/api/invoices/nit-info/${segment(nit)}`),
  },

  invoiceConcepts: {
    list: <T = unknown[]>(query?: InvoiceConceptsQuery) =>
      apiRequest<T>("/api/invoice-concepts", { query }),
    create: <T = unknown>(body: CreateInvoiceConceptModel) =>
      apiRequest<T, CreateInvoiceConceptModel>("/api/invoice-concepts", {
        method: "POST",
        body,
      }),
    update: <T = unknown>(id: ApiId, body: UpdateInvoiceConceptModel) =>
      apiRequest<T, UpdateInvoiceConceptModel>(`/api/invoice-concepts/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    delete: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/invoice-concepts/${segment(id)}`, { method: "DELETE" }),
  },

  reports: {
    getProfitability: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/profitability", { query }),
    getRevenueAccounting: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/revenue/accounting", { query }),
    getPayments: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/payments", { query }),
    getDailyOccupancy: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/occupancy/daily", { query }),
    getMinibarProfitability: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/minibar/profitability", { query }),
    getBreakfastProfitability: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/breakfast/profitability", { query }),
    getEventsProfitability: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/events/profitability", { query }),
    getCurrentAccounts: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/credits/current-accounts", { query }),
    getDirectCosts: <T = unknown>(query?: ReportQuery) =>
      apiRequest<T>("/api/reports/costs/direct", { query }),
    getHotelDashboard: <T = unknown>(query?: HotelDashboardReportQuery) =>
      apiRequest<T>("/api/reports/hotel-dashboard", { query }),
  },

  credit: {
    listAccounts: <T = unknown[]>() => apiRequest<T>("/api/credit/accounts"),
    createAccount: <T = unknown>(body: CreateCreditAccountModel) =>
      apiRequest<T, CreateCreditAccountModel>("/api/credit/accounts", {
        method: "POST",
        body,
      }),
    updateAccount: <T = unknown>(id: ApiId, body: UpdateCreditAccountModel) =>
      apiRequest<T, UpdateCreditAccountModel>(`/api/credit/accounts/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    deleteAccount: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/credit/accounts/${segment(id)}`, { method: "DELETE" }),
    pauseAccount: <T = unknown>(id: ApiId, body: ChangeCreditAccountStatusModel) =>
      apiRequest<T, ChangeCreditAccountStatusModel>(
        `/api/credit/accounts/${segment(id)}/pause`,
        {
          method: "PATCH",
          body,
        },
      ),
    blockAccount: <T = unknown>(id: ApiId, body: ChangeCreditAccountStatusModel) =>
      apiRequest<T, ChangeCreditAccountStatusModel>(
        `/api/credit/accounts/${segment(id)}/block`,
        {
          method: "PATCH",
          body,
        },
      ),
    reactivateAccount: <T = unknown>(id: ApiId, body: ChangeCreditAccountStatusModel) =>
      apiRequest<T, ChangeCreditAccountStatusModel>(
        `/api/credit/accounts/${segment(id)}/reactivate`,
        {
          method: "PATCH",
          body,
        },
      ),
    listAccountMovements: <T = unknown[]>(id: ApiId) =>
      apiRequest<T>(`/api/credit/accounts/${segment(id)}/movements`),
    createAccountMovement: <T = unknown>(id: ApiId, body: CreateCreditMovementModel) =>
      apiRequest<T, CreateCreditMovementModel>(
        `/api/credit/accounts/${segment(id)}/movements`,
        {
          method: "POST",
          body,
        },
      ),
    getAccountStatement: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/credit/accounts/${segment(id)}/statement`),
    createAccountPayment: <T = unknown>(id: ApiId, body: CreateCreditPaymentModel) =>
      apiRequest<T, CreateCreditPaymentModel>(
        `/api/credit/accounts/${segment(id)}/payments`,
        {
          method: "POST",
          body,
        },
      ),
    listAuthorizationRequests: <T = unknown[]>(query?: AuthorizationRequestsQuery) =>
      apiRequest<T>("/api/credit/authorization-requests", { query }),
    createAuthorizationRequest: <T = unknown>(body: CreateCreditAuthorizationRequestModel) =>
      apiRequest<T, CreateCreditAuthorizationRequestModel>(
        "/api/credit/authorization-requests",
        {
          method: "POST",
          body,
        },
      ),
    approveAuthorizationRequest: <T = unknown>(
      id: ApiId,
      body: ReviewCreditAuthorizationRequestModel,
    ) =>
      apiRequest<T, ReviewCreditAuthorizationRequestModel>(
        `/api/credit/authorization-requests/${segment(id)}/approve`,
        {
          method: "PATCH",
          body,
        },
      ),
    rejectAuthorizationRequest: <T = unknown>(
      id: ApiId,
      body: ReviewCreditAuthorizationRequestModel,
    ) =>
      apiRequest<T, ReviewCreditAuthorizationRequestModel>(
        `/api/credit/authorization-requests/${segment(id)}/reject`,
        {
          method: "PATCH",
          body,
        },
      ),
    getReceptionSummary: <T = unknown>() =>
      apiRequest<T>("/api/credit/report/reception-summary"),
  },

  events: {
    list: <T = unknown[]>() => apiRequest<T>("/api/events"),
    create: <T = unknown>(body: CreateEventModel) =>
      apiRequest<T, CreateEventModel>("/api/events", { method: "POST", body }),
    getSalonAvailability: <T = unknown>(query?: EventSalonAvailabilityQuery) =>
      apiRequest<T>("/api/events/salon-availability", { query }),
    createPayment: <T = unknown>(id: ApiId, body: CreateEventPaymentModel) =>
      apiRequest<T, CreateEventPaymentModel>(`/api/events/${segment(id)}/payments`, {
        method: "POST",
        body,
      }),
    confirm: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/events/${segment(id)}/confirm`, { method: "PATCH" }),
    complete: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/events/${segment(id)}/complete`, { method: "PATCH" }),
    finish: <T = unknown>(id: ApiId, body: FinishEventModel) =>
      apiRequest<T, FinishEventModel>(`/api/events/${segment(id)}/finish`, {
        method: "PATCH",
        body,
      }),
    cancel: <T = unknown>(id: ApiId, body: CancelEventModel) =>
      apiRequest<T, CancelEventModel>(`/api/events/${segment(id)}/cancel`, {
        method: "PATCH",
        body,
      }),
  },

  eventSalons: {
    list: <T = unknown[]>() => apiRequest<T>("/api/event-salons"),
    create: <T = unknown>(body: CreateEventSalonModel) =>
      apiRequest<T, CreateEventSalonModel>("/api/event-salons", {
        method: "POST",
        body,
      }),
  },

  guests: {
    list: <T = unknown[]>() => apiRequest<T>("/api/guests"),
    create: <T = unknown>(body: CreateGuestModel) =>
      apiRequest<T, CreateGuestModel>("/api/guests/create", { method: "POST", body }),
    update: <T = unknown>(id: ApiId, body: UpdateGuestModel) =>
      apiRequest<T, UpdateGuestModel>(`/api/guests/update/${segment(id)}`, {
        method: "PUT",
        body,
      }),
    delete: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/guests/delete/${segment(id)}`, { method: "DELETE" }),
    getReservationRules: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/guests/${segment(id)}/reservation-rules`),
  },

  inventory: {
    listItems: <T = unknown[]>(query?: InventoryItemsQuery) =>
      apiRequest<T>("/api/inventory/items", { query }),
    createItem: <T = unknown>(body: CreateInventoryItemModel) =>
      apiRequest<T, CreateInventoryItemModel>("/api/inventory/items", {
        method: "POST",
        body,
      }),
    updateItem: <T = unknown>(id: ApiId, body: UpdateInventoryItemModel) =>
      apiRequest<T, UpdateInventoryItemModel>(`/api/inventory/items/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    deleteItem: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/inventory/items/${segment(id)}`, {
        method: "DELETE",
      }),
    listMovements: <T = unknown[]>(query?: InventoryMovementsQuery) =>
      apiRequest<T>("/api/inventory/reports/movements", { query }),
    createMovement: <T = unknown>(body: CreateInventoryMovementModel) =>
      apiRequest<T, CreateInventoryMovementModel>("/api/inventory/movements", {
        method: "POST",
        body,
      }),
    listPurchaseOrders: <T = unknown[]>(query?: InventoryPurchaseOrdersQuery) =>
      apiRequest<T>("/api/inventory/purchase-orders", { query }),
    createPurchaseOrder: <T = unknown>(body: CreateInventoryPurchaseOrderModel) =>
      apiRequest<T, CreateInventoryPurchaseOrderModel>("/api/inventory/purchase-orders", {
        method: "POST",
        body,
      }),
    receivePurchaseOrder: <T = unknown>(
      id: ApiId,
      body: ReceiveInventoryPurchaseOrderModel,
    ) =>
      apiRequest<T, ReceiveInventoryPurchaseOrderModel>(
        `/api/inventory/purchase-orders/${segment(id)}/received`,
        {
          method: "PATCH",
          body,
        },
      ),
    getMovementsReport: <T = unknown>(query?: InventoryMovementsQuery) =>
      apiRequest<T>("/api/inventory/reports/movements", { query }),
    configureRoomMinibar: <T = unknown>(roomId: ApiId, body: ConfigureRoomMinibarModel) =>
      apiRequest<T, ConfigureRoomMinibarModel>(
        `/api/inventory/rooms/${segment(roomId)}/items/configure`,
        {
          method: "POST",
          body,
        },
      ),
  },

  linen: {
    listItems: <T = unknown[]>(query?: LinenItemsQuery) =>
      apiRequest<T>("/api/linen/items", { query }),
    createItem: <T = unknown>(body: CreateLinenItemModel) =>
      apiRequest<T, CreateLinenItemModel>("/api/linen/items", {
        method: "POST",
        body,
      }),
    updateItem: <T = unknown>(id: ApiId, body: UpdateLinenItemModel) =>
      apiRequest<T, UpdateLinenItemModel>(`/api/linen/items/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    deleteItem: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/linen/items/${segment(id)}`, { method: "DELETE" }),
    listAssignments: <T = unknown[]>() =>
      apiRequest<T>("/api/linen/assignments/by-room"),
    listAssignmentsByRoom: <T = unknown[]>() =>
      apiRequest<T>("/api/linen/assignments/by-room"),
    createAssignment: <T = unknown>(body: CreateLinenAssignmentModel) =>
      apiRequest<T, CreateLinenAssignmentModel>("/api/linen/assignments", {
        method: "POST",
        body,
      }),
    listLaundry: <T = unknown[]>(query?: LinenLaundryQuery) =>
      apiRequest<T>("/api/linen/laundry", { query }),
    sendAssignmentToLaundry: <T = unknown>(body: SendLinenAssignmentToLaundryModel) =>
      apiRequest<T, SendLinenAssignmentToLaundryModel>("/api/linen/laundry/from-assignment", {
        method: "POST",
        body,
      }),
    sendRoomToLaundry: <T = unknown>(body: SendRoomLinenToLaundryModel) =>
      apiRequest<T, SendRoomLinenToLaundryModel>("/api/linen/laundry/from-room", {
        method: "POST",
        body,
      }),
    markLaundryReady: <T = unknown>(id: ApiId, body: MarkLinenLaundryReadyModel) =>
      apiRequest<T, MarkLinenLaundryReadyModel>(`/api/linen/laundry/${segment(id)}/ready`, {
        method: "PATCH",
        body,
      }),
    returnLaundryToAvailable: <T = unknown>(
      id: ApiId,
      body: ReturnLinenLaundryToAvailableModel,
    ) =>
      apiRequest<T, ReturnLinenLaundryToAvailableModel>(
        `/api/linen/laundry/${segment(id)}/return`,
        {
          method: "PATCH",
          body,
        },
      ),
    returnLaundryToRoom: <T = unknown>(id: ApiId, body: ReturnLinenLaundryToRoomModel) =>
      apiRequest<T, ReturnLinenLaundryToRoomModel>(
        `/api/linen/laundry/${segment(id)}/return-to-room`,
        {
          method: "PATCH",
          body,
        },
      ),
    listDamages: <T = unknown[]>(query?: LinenDamagesQuery) =>
      apiRequest<T>("/api/linen/damages", { query }),
    reportDamageFromAssignment: <T = unknown>(body: CreateLinenDamageFromAssignmentModel) =>
      apiRequest<T, CreateLinenDamageFromAssignmentModel>("/api/linen/damages/from-assignment", {
        method: "POST",
        body,
      }),
    chargeDamage: <T = unknown>(id: ApiId, body: ChargeLinenDamageModel) =>
      apiRequest<T, ChargeLinenDamageModel>(`/api/linen/damages/${segment(id)}/charge`, {
        method: "PATCH",
        body,
      }),
    retireDamage: <T = unknown>(id: ApiId, body: RetireLinenDamageModel) =>
      apiRequest<T, RetireLinenDamageModel>(`/api/linen/damages/${segment(id)}/retire`, {
        method: "PATCH",
        body,
      }),
    listMovements: <T = unknown[]>(query?: LinenMovementsQuery) =>
      apiRequest<T>("/api/linen/movements", { query }),
  },

  maintenance: {
    listTickets: <T = unknown[]>() => apiRequest<T>("/api/maintenance/tickets"),
    createTicket: <T = unknown>(body: CreateMaintenanceTicketModel) =>
      apiRequest<T, CreateMaintenanceTicketModel>("/api/maintenance/tickets", {
        method: "POST",
        body,
      }),
    startTicket: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/maintenance/tickets/${segment(id)}/start`, {
        method: "PATCH",
      }),
    resolveTicket: <T = unknown>(id: ApiId, body: ResolveMaintenanceTicketModel) =>
      apiRequest<T, ResolveMaintenanceTicketModel>(
        `/api/maintenance/tickets/${segment(id)}/resolve`,
        {
          method: "PATCH",
          body,
        },
      ),
    cancelTicket: <T = unknown>(id: ApiId, body: CancelMaintenanceTicketModel) =>
      apiRequest<T, CancelMaintenanceTicketModel>(
        `/api/maintenance/tickets/${segment(id)}/cancel`,
        {
          method: "PATCH",
          body,
        },
      ),
    listRoomAlerts: <T = unknown[]>() => apiRequest<T>("/api/maintenance/room-alerts"),
    listHistory: <T = unknown[]>() => apiRequest<T>("/api/maintenance/history"),
  },

  menu: {
    getMenusByRole: <T = unknown>(body: GetMenuListByIdRequestModel) =>
      apiRequest<T, GetMenuListByIdRequestModel>("/api/v1/rol/getMenusByIdRol", {
        method: "POST",
        body,
      }),
  },

  menuRoles: {
    listMenus: <T = unknown[]>() => apiRequest<T>("/api/v1/menu_roles/get-all-menus"),
    create: <T = unknown>(body: CreateMenuRolesModel) =>
      apiRequest<T, CreateMenuRolesModel>("/api/v1/menu_roles/create", {
        method: "POST",
        body,
      }),
    update: <T = unknown>(body: UpdateMenuRolesModel) =>
      apiRequest<T, UpdateMenuRolesModel>("/api/v1/menu_roles/update", {
        method: "POST",
        body,
      }),
  },

  minibar: {
    listRooms: <T = unknown[]>() => apiRequest<T>("/api/minibar/rooms"),
    listRoomItems: <T = unknown[]>(id: ApiId) =>
      apiRequest<T>(`/api/minibar/rooms/${segment(id)}/items`),
    restockRoom: <T = unknown>(id: ApiId, body: RestockRoomMinibarModel) =>
      apiRequest<T, RestockRoomMinibarModel>(`/api/minibar/rooms/${segment(id)}/restock`, {
        method: "POST",
        body,
      }),
    createRoomReview: <T = unknown>(body: CreateMinibarRoomReviewModel) =>
      apiRequest<T, CreateMinibarRoomReviewModel>("/api/minibar/room-reviews", {
        method: "POST",
        body,
      }),
    listPendingCharges: <T = unknown[]>(query?: MinibarPendingChargesQuery) =>
      apiRequest<T>("/api/minibar/pending-charges", { query }),
    listStayCharges: <T = unknown[]>(stayId: ApiId) =>
      apiRequest<T>(`/api/minibar/stay/${segment(stayId)}/charges`),
    deletePendingCharge: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/minibar/pending-charges/${segment(id)}`, {
        method: "DELETE",
      }),
    chargePendingCharge: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/minibar/pending-charges/${segment(id)}/charge`, {
        method: "POST",
      }),
  },

  rates: {
    calculate: <T = unknown>(body: CalculateRateModel) =>
      apiRequest<T, CalculateRateModel>("/api/rates/calculate", {
        method: "POST",
        body,
      }),
    quote: <T = unknown>(body: QuoteRateModel) =>
      apiRequest<T, QuoteRateModel>("/api/rates/quote", { method: "POST", body }),
  },

  reservations: {
    list: <T = unknown[]>() => apiRequest<T>("/api/reservations"),
    create: <T = unknown>(body: CreateReservationModel) =>
      apiRequest<T, CreateReservationModel>("/api/reservations", {
        method: "POST",
        body,
      }),
    getById: <T = unknown>(id: ApiId) => apiRequest<T>(`/api/reservations/${segment(id)}`),
    confirm: <T = unknown>(id: ApiId, body: ConfirmReservationModel) =>
      apiRequest<T, ConfirmReservationModel>(`/api/reservations/${segment(id)}/confirm`, {
        method: "PATCH",
        body,
      }),
    cancel: <T = unknown>(id: ApiId, body: CancelReservationModel) =>
      apiRequest<T, CancelReservationModel>(`/api/reservations/${segment(id)}/cancel`, {
        method: "PATCH",
        body,
      }),
    requestCancellation: <T = unknown>(
      id: ApiId,
      body: CreateReservationCancellationRequestModel,
    ) =>
      apiRequest<T, CreateReservationCancellationRequestModel>(
        `/api/reservations/${segment(id)}/cancel-requests`,
        {
          method: "POST",
          body,
        },
      ),
    listCancellationRequests: <T = unknown[]>(query?: ReservationCancelRequestsQuery) =>
      apiRequest<T>("/api/reservations/cancel-requests", { query }),
    approveCancellationRequest: <T = unknown>(
      id: ApiId,
      body: ReviewReservationCancellationRequestModel,
    ) =>
      apiRequest<T, ReviewReservationCancellationRequestModel>(
        `/api/reservations/cancel-requests/${segment(id)}/approve`,
        {
          method: "PATCH",
          body,
        },
      ),
    rejectCancellationRequest: <T = unknown>(
      id: ApiId,
      body: ReviewReservationCancellationRequestModel,
    ) =>
      apiRequest<T, ReviewReservationCancellationRequestModel>(
        `/api/reservations/cancel-requests/${segment(id)}/reject`,
        {
          method: "PATCH",
          body,
        },
      ),
    createNightPayment: <T = unknown>(id: ApiId, body: CreateReservationNightPaymentModel) =>
      apiRequest<T, CreateReservationNightPaymentModel>(
        `/api/reservations/${segment(id)}/night-payments`,
        {
          method: "POST",
          body,
        },
      ),
    extendRoom: <T = unknown>(
      reservationId: ApiId,
      reservationRoomId: ApiId,
      body: ExtendReservationRoomModel,
    ) =>
      apiRequest<T, ExtendReservationRoomModel>(
        `/api/reservations/${segment(reservationId)}/rooms/${segment(reservationRoomId)}/extend`,
        {
          method: "PATCH",
          body,
        },
      ),
    getPaymentPlan: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/reservations/${segment(id)}/payment-plan`),
    deletePayment: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/reservations/payments/${segment(id)}`, {
        method: "DELETE",
      }),
    sendToCheckIn: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/reservations/${segment(id)}/send-to-check-in`, {
        method: "PATCH",
      }),
  },

  roles: {
    create: <T = unknown>(body: CreateRolModel) =>
      apiRequest<T, CreateRolModel>("/api/v1/rol/create", { method: "POST", body }),
    list: <T = unknown[]>() => apiRequest<T>("/api/v1/rol/get-all"),
  },

  rooms: {
    list: <T = unknown[]>() => apiRequest<T>("/api/rooms"),
    create: <T = unknown>(body: CreateRoomModel) =>
      apiRequest<T, CreateRoomModel>("/api/rooms", { method: "POST", body }),
    update: <T = unknown>(id: ApiId, body: UpdateRoomModel) =>
      apiRequest<T, UpdateRoomModel>(`/api/rooms/${segment(id)}`, {
        method: "PATCH",
        body,
      }),
    updateStatus: <T = unknown>(id: ApiId, body: UpdateRoomStatusModel) =>
      apiRequest<T, UpdateRoomStatusModel>(`/api/rooms/${segment(id)}/status`, {
        method: "PATCH",
        body,
      }),
    setOccupancyOptions: <T = unknown>(id: ApiId, body: SetRoomOccupancyOptionsModel) =>
      apiRequest<T, SetRoomOccupancyOptionsModel>(
        `/api/rooms/${segment(id)}/occupancy-options`,
        {
          method: "PATCH",
          body,
        },
      ),
    createSpecificRate: <T = unknown>(id: ApiId, body: CreateRoomSpecificRateModel) =>
      apiRequest<T, CreateRoomSpecificRateModel>(`/api/rooms/${segment(id)}/specific-rates`, {
        method: "POST",
        body,
      }),
    listRateOptions: <T = unknown>(id: ApiId) =>
      apiRequest<T>(`/api/rooms/${segment(id)}/rate-options`),
    listAuditLog: <T = unknown[]>() => apiRequest<T>("/api/rooms/audit-log"),
    listAvailability: <T = unknown[]>(query?: RoomAvailabilityQuery) =>
      apiRequest<T>("/api/rooms/availability", { query }),
    markClean: <T = unknown>(roomId: ApiId) =>
      apiRequest<T>(`/api/rooms/${segment(roomId)}/clean`, { method: "PATCH" }),
  },

  roomTypes: {
    list: <T = unknown[]>() => apiRequest<T>("/api/room-types"),
  },

  users: {
    update: <T = unknown>(body: UpdateUserModel) =>
      apiRequest<T, UpdateUserModel>("/api/v1/user/update", { method: "POST", body }),
    updatePassword: <T = unknown>(body: UpdateUserPasswordModel) =>
      apiRequest<T, UpdateUserPasswordModel>("/api/v1/user/update-password", {
        method: "PUT",
        body,
      }),
    delete: <T = unknown>(idUser: ApiId) =>
      apiRequest<T>(`/api/v1/user/delete/${segment(idUser)}`, { method: "DELETE" }),
    list: <T = unknown[]>() => apiRequest<T>("/api/v1/user/get-all"),
    create: <T = unknown>(body: CreateUserModel) =>
      apiRequest<T, CreateUserModel>("/api/v1/user/create", { method: "POST", body }),
    login: <T = unknown>(body: LoginRequestModel) =>
      apiRequest<T, LoginRequestModel>("/api/v1/user/login", { method: "POST", body }),
  },
} as const

function normalizeBaseUrl(value: string | undefined) {
  return (value ?? "").replace(/\/+$/, "")
}

function buildApiUrl(path: string, query?: QueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const baseUrl = `${API_BASE_URL}${normalizedPath}`
  const searchParams = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    searchParams.set(key, String(value))
  })

  const queryString = searchParams.toString()
  if (!queryString) return baseUrl

  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${queryString}`
}

function segment(value: ApiId) {
  return encodeURIComponent(String(value))
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return isRecord(value) && ("success" in value || "statusCode" in value) && "data" in value
}

function getPayloadMessage(payload: unknown) {
  if (isRecord(payload)) {
    const message = payload.message ?? payload.title
    if (typeof message === "string" && message.length > 0) return message
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
