import {
  ApiError,
  api,
  type ApiId,
  type CreateInventoryMovementModel,
  type PaymentItemModel,
  type UpdateInventoryItemModel,
} from "@/lib/api"
import { getSessionUser } from "@/lib/auth"
import type {
  Action,
  BackendResource,
  BackendSourceState,
  BackendSources,
  State,
} from "@/lib/store"
import type {
  AppUser,
  BreakfastOption,
  BreakfastVoucher,
  CashClose,
  CreditAccount,
  CreditAuthorizationRequest,
  CreditMovement,
  EventSalon,
  Guest,
  HotelEvent,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTicket,
  PaymentMethod,
  PaymentRecord,
  Reservation,
  ReservationBillingStatus,
  ReservationRateType,
  ReservationSource,
  ReservationStatus,
  Room,
  RoomRateOption,
  RoomSpecificRate,
  RoomStatus,
  RoomType,
  UserRole,
} from "@/lib/types"

type ApiRecord = Record<string, unknown>
type ApiLoadResult<T = unknown> = {
  data: T | undefined
  source: BackendSourceState
}
type ApiSyncResult =
  | BackendResource
  | BackendResource[]
  | {
      resource?: BackendResource | BackendResource[]
      action?: Action
    }
  | void

const API_RESOURCES: BackendResource[] = [
  "roomTypes",
  "rooms",
  "roomRateOptions",
  "guests",
  "reservations",
  "breakfastOptions",
  "breakfasts",
  "creditAccounts",
  "creditMovements",
  "creditAuthorizationRequests",
  "cashShiftConfigs",
  "cashCloses",
  "salons",
  "events",
  "maintenance",
  "inventory",
  "inventoryMovements",
  "roles",
  "menuRoles",
  "users",
]

const BREAKFAST_ACCENTS = [
  "border-sky-200 bg-sky-50 text-sky-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-lime-200 bg-lime-50 text-lime-950",
  "border-violet-200 bg-violet-50 text-violet-950",
]

export async function loadApiState(resources: BackendResource[] = API_RESOURCES): Promise<Partial<State>> {
  const requested = new Set(resources)
  const shouldLoad = (resource: BackendResource) => requested.has(resource)
  const shouldLoadRooms = shouldLoad("rooms") || shouldLoad("roomRateOptions")
  const shouldLoadCreditAccounts = shouldLoad("creditAccounts") || shouldLoad("creditMovements")
  const loadResource = <T>(
    resource: BackendResource,
    loader: () => Promise<T>,
  ): Promise<ApiLoadResult<T>> =>
    shouldLoad(resource)
      ? safeLoad(loader)
      : Promise.resolve({ data: undefined, source: "empty" })
  const loadWhen = <T>(
    enabled: boolean,
    loader: () => Promise<T>,
  ): Promise<ApiLoadResult<T>> =>
    enabled ? safeLoad(loader) : Promise.resolve({ data: undefined, source: "empty" })

  const [
    roomTypesData,
    roomsData,
    guestsData,
    reservationsData,
    breakfastOptionsData,
    breakfastVouchersData,
    creditAccountsData,
    creditRequestsData,
    cashShiftConfigsData,
    cashShiftData,
    salonsData,
    eventsData,
    maintenanceData,
    inventoryData,
    inventoryMovementsData,
    rolesData,
    menusData,
    usersData,
  ] = await Promise.all([
    loadResource("roomTypes", () => api.roomTypes.list()),
    loadWhen(shouldLoadRooms, () => api.rooms.list()),
    loadResource("guests", () => api.guests.list()),
    loadResource("reservations", () => api.reservations.list()),
    loadResource("breakfastOptions", () => api.breakfast.listOptions()),
    loadResource("breakfasts", () => api.breakfast.listTodayVouchers()),
    loadWhen(shouldLoadCreditAccounts, () => api.credit.listAccounts()),
    loadResource("creditAuthorizationRequests", () => api.credit.listAuthorizationRequests()),
    loadResource("cashShiftConfigs", () => api.cashShifts.listConfigs()),
    loadResource("cashCloses", () => api.cashShifts.getCurrent()),
    loadResource("salons", () => api.eventSalons.list()),
    loadResource("events", () => api.events.list()),
    loadResource("maintenance", () => api.maintenance.listTickets()),
    loadResource("inventory", () => api.inventory.listItems()),
    loadResource("inventoryMovements", () => api.inventory.getMovementsReport()),
    loadResource("roles", () => api.roles.list()),
    loadResource("menuRoles", () => api.menuRoles.listMenus()),
    loadResource("users", () => api.users.list()),
  ])

  const apiSources = createApiSources({
    ...(shouldLoad("roomTypes") ? { roomTypes: roomTypesData.source } : {}),
    ...(shouldLoad("rooms") ? { rooms: roomsData.source } : {}),
    ...(shouldLoad("roomRateOptions") ? { roomRateOptions: roomsData.source } : {}),
    ...(shouldLoad("guests") ? { guests: guestsData.source } : {}),
    ...(shouldLoad("reservations") ? { reservations: reservationsData.source } : {}),
    ...(shouldLoad("breakfastOptions") ? { breakfastOptions: breakfastOptionsData.source } : {}),
    ...(shouldLoad("breakfasts") ? { breakfasts: breakfastVouchersData.source } : {}),
    ...(shouldLoad("creditAccounts") ? { creditAccounts: creditAccountsData.source } : {}),
    ...(shouldLoad("creditMovements") ? { creditMovements: creditAccountsData.source } : {}),
    ...(shouldLoad("creditAuthorizationRequests")
      ? { creditAuthorizationRequests: creditRequestsData.source }
      : {}),
    ...(shouldLoad("cashShiftConfigs") ? { cashShiftConfigs: cashShiftConfigsData.source } : {}),
    ...(shouldLoad("cashCloses") ? { cashCloses: cashShiftData.source } : {}),
    ...(shouldLoad("salons") ? { salons: salonsData.source } : {}),
    ...(shouldLoad("events") ? { events: eventsData.source } : {}),
    ...(shouldLoad("maintenance") ? { maintenance: maintenanceData.source } : {}),
    ...(shouldLoad("inventory") ? { inventory: inventoryData.source } : {}),
    ...(shouldLoad("inventoryMovements")
      ? { inventoryMovements: inventoryMovementsData.source }
      : {}),
    ...(shouldLoad("roles") ? { roles: rolesData.source } : {}),
    ...(shouldLoad("menuRoles") ? { menuRoles: menusData.source } : {}),
    ...(shouldLoad("users") ? { users: usersData.source } : {}),
  })

  const patch: Partial<State> = {
    apiSources: apiSources as BackendSources,
  }

  if (shouldLoad("roomTypes") && isHydratableSource(roomTypesData.source)) {
    patch.roomTypes = toArray(roomTypesData.data).map(mapRoomType)
  }

  if (shouldLoadRooms && isHydratableSource(roomsData.source)) {
    const rooms = toArray(roomsData.data).map(mapRoom)
    patch.rooms = shouldLoad("roomRateOptions") ? await loadRoomRateOptions(rooms) : rooms
  }

  if (shouldLoad("guests") && isHydratableSource(guestsData.source)) {
    patch.guests = toArray(guestsData.data).map(mapGuest)
  }

  if (shouldLoad("reservations") && isHydratableSource(reservationsData.source)) {
    patch.reservations = mapReservations(toArray(reservationsData.data))
  }

  if (shouldLoad("breakfastOptions") && isHydratableSource(breakfastOptionsData.source)) {
    patch.breakfastOptions = toArray(breakfastOptionsData.data).map(mapBreakfastOption)
  }

  if (shouldLoad("breakfasts") && isHydratableSource(breakfastVouchersData.source)) {
    patch.breakfasts = toArray(breakfastVouchersData.data).map(mapBreakfastVoucher)
  }

  if (shouldLoadCreditAccounts && isHydratableSource(creditAccountsData.source)) {
    const accounts = toArray(creditAccountsData.data).map(mapCreditAccount)
    if (shouldLoad("creditAccounts")) {
      patch.creditAccounts = accounts
    }
    if (shouldLoad("creditMovements")) {
      patch.creditMovements = await loadCreditMovements(accounts)
    }
  }

  if (
    shouldLoad("creditAuthorizationRequests") &&
    isHydratableSource(creditRequestsData.source)
  ) {
    patch.creditAuthorizationRequests = toArray(creditRequestsData.data).map(
      mapCreditAuthorizationRequest,
    )
  }

  if (shouldLoad("cashCloses") && isHydratableSource(cashShiftData.source)) {
    const shifts = toArray(cashShiftData.data)
    const cashItems = Array.isArray(cashShiftData.data)
      ? shifts
      : shifts.length
        ? shifts
        : [cashShiftData.data]
    patch.cashCloses = cashItems.map(mapCashClose)
  }

  if (shouldLoad("salons") && isHydratableSource(salonsData.source)) {
    patch.salons = toArray(salonsData.data).filter(isVisibleOperationalRecord).map(mapEventSalon)
  }

  if (shouldLoad("events") && isHydratableSource(eventsData.source)) {
    patch.events = toArray(eventsData.data).filter(isVisibleOperationalRecord).map(mapHotelEvent)
  }

  if (shouldLoad("maintenance") && isHydratableSource(maintenanceData.source)) {
    patch.maintenance = toArray(maintenanceData.data).map(mapMaintenanceTicket)
  }

  if (shouldLoad("inventory") && isHydratableSource(inventoryData.source)) {
    patch.inventory = toArray(inventoryData.data).map(mapInventoryItem)
  }

  if (shouldLoad("inventoryMovements") && isHydratableSource(inventoryMovementsData.source)) {
    patch.inventoryMovements = toArray(inventoryMovementsData.data).map(mapInventoryMovement)
  }

  if (shouldLoad("users") && isHydratableSource(usersData.source)) {
    patch.users = toArray(usersData.data).map(mapAppUser)
  }

  return patch
}

export async function syncActionWithApi(action: Action, state: State): Promise<ApiSyncResult> {
  try {
    switch (action.type) {
      case "ROOM_CREATE": {
        const backendRoomId = roomIdFromCreateResponse(
          await api.rooms.create(roomPayload(action.room, state)),
          action.room.id,
        )
        await syncRoomConfiguration(
          backendRoomId,
          action.room,
        )

        if (backendRoomId && String(backendRoomId) !== action.room.id) {
          return {
            resource: "rooms",
            action: {
              type: "ROOM_ADOPT_BACKEND_ID",
              temporaryId: action.room.id,
              backendId: String(backendRoomId),
            },
          }
        }

        return "rooms"
      }

      case "ROOM_UPDATE": {
        const id = numericId(action.id)
        const room = state.rooms.find((item) => item.id === action.id)
        if (!id || !room) return
        const nextRoom = { ...room, ...action.patch }
        await api.rooms.update(id, roomPayload(nextRoom, state))
        await syncRoomConfiguration(id, nextRoom, room)
        return "rooms"
      }

      case "ROOM_STATUS": {
        const id = numericId(action.roomId)
        if (!id) return
        await api.rooms.updateStatus(id, { status: roomStatusPayload(action.status) })
        return
      }

      case "GUEST_CREATE":
        await api.guests.create(guestPayload(action.guest))
        return "guests"

      case "GUEST_UPDATE": {
        const id = numericId(action.id)
        const guest = state.guests.find((item) => item.id === action.id)
        if (!id || !guest) return
        await api.guests.update(id, guestPayload({ ...guest, ...action.patch }))
        return "guests"
      }

      case "GUEST_TOGGLE_FREQUENT": {
        const id = numericId(action.id)
        const guest = state.guests.find((item) => item.id === action.id)
        if (!id || !guest) return
        await api.guests.update(id, guestPayload({ ...guest, vip: !guest.vip }))
        return "guests"
      }

      case "GUEST_DELETE": {
        const id = numericId(action.id)
        if (!id) return
        await api.guests.delete(id)
        return "guests"
      }

      case "RES_CREATE": {
        const payload = reservationPayload(action.reservation, state)
        if (!payload) return
        const response = await api.reservations.create(payload)
        const chargedCredit = await syncReservationCreditCharge(
          reservationIdFromCreateResponse(response, action.reservation.id),
          action.reservation,
          action.reservation.payments ?? [],
          state,
        )
        return chargedCredit ? ["reservations", "creditAccounts"] : "reservations"
      }

      case "RES_CANCEL": {
        const id = reservationNumericId(action.id)
        if (!id) return
        await api.reservations.cancel(id, { reason: action.reason ?? "Cancelada desde recepcion" })
        return ["reservations", "rooms"]
      }

      case "RES_SEND_TO_CHECKIN": {
        const id = reservationNumericId(action.id)
        if (!id) return
        await api.reservations.sendToCheckIn(id)
        return "reservations"
      }

      case "RES_UPDATE": {
        const reservation = state.reservations.find((item) => item.id === action.id)
        const removedPayments =
          reservation && action.patch.payments
            ? paymentsRemovedSince(reservation.payments ?? [], action.patch.payments)
            : []
        await deleteReservationPayments(removedPayments)

        const id = reservationNumericId(action.id)
        if (!id) return removedPayments.length ? "reservations" : undefined

        if (action.patch.status === "confirmada") {
          await api.reservations.confirm(id, {
            notes: action.patch.notes,
            payments: action.patch.payments?.map(paymentPayload),
          })
          return "reservations"
        } else if (action.patch.status === "cancelada") {
          await api.reservations.cancel(id, { reason: action.patch.notes })
          return "reservations"
        } else if (reservation && action.patch.payments) {
          const newPayments = paymentsAddedSince(reservation.payments ?? [], action.patch.payments)
          const reservationPayments = newPayments.filter(isReservationStagePayment)
          await syncReservationNightPayments(id, reservation, reservationPayments)
          const chargedCredit = await syncReservationCreditCharge(
            id,
            reservation,
            reservationPayments,
            state,
          )
          return chargedCredit ? ["reservations", "creditAccounts"] : "reservations"
        }
        return
      }

      case "CREDIT_ACCOUNT_CREATE": {
        const guestId = action.account.guestId ? numericId(action.account.guestId) : null
        if (!guestId) return
        await api.credit.createAccount({
          id_guest: guestId,
          credit_limit: action.account.limit,
          notes: action.account.authorizationNote ?? action.account.company,
        })
        return "creditAccounts"
      }

      case "CREDIT_ACCOUNT_UPDATE": {
        const id = numericId(action.id)
        if (!id) return
        const account = state.creditAccounts.find((item) => item.id === action.id)
        await api.credit.updateAccount(id, {
          credit_limit: action.patch.limit ?? account?.limit,
          due_date: action.patch.dueDate ?? account?.dueDate,
          notes: action.patch.authorizationNote ?? account?.authorizationNote,
        })
        return "creditAccounts"
      }

      case "CREDIT_ACCOUNT_DELETE": {
        const id = numericId(action.id)
        if (!id) return
        await api.credit.deleteAccount(id)
        return "creditAccounts"
      }

      case "CREDIT_ACCOUNT_STATUS": {
        const id = numericId(action.accountId)
        if (!id) return
        const body = {
          changed_by: sessionActorName(),
          notes: action.authorizationNote ?? "Cambio de estado desde administración.",
        }
        if (action.creditStatus === "pausado") {
          await api.credit.pauseAccount(id, body)
        } else if (action.creditStatus === "bloqueado") {
          await api.credit.blockAccount(id, body)
        } else {
          await api.credit.reactivateAccount(id, body)
        }
        return "creditAccounts"
      }

      case "CREDIT_AUTH_REQUEST_CREATE": {
        const accountId = numericId(action.request.accountId)
        if (!accountId) return
        const account = state.creditAccounts.find((item) => item.id === action.request.accountId)
        await api.credit.createAuthorizationRequest({
          id_credit_account: accountId,
          request_type: "IncreaseLimit",
          requested_amount: account?.limit,
          reason: action.request.reason,
          requested_by: action.request.requestedBy,
        })
        return
      }

      case "CREDIT_AUTH_REQUEST_RESOLVE": {
        const id = numericId(action.id)
        if (!id) return
        const body = { reviewed_by: sessionActorName(), review_notes: action.notes }
        if (action.status === "aprobada") {
          await api.credit.approveAuthorizationRequest(id, body)
        } else {
          await api.credit.rejectAuthorizationRequest(id, body)
        }
        return
      }

      case "CREDIT_PAYMENT": {
        const id = numericId(action.accountId)
        if (!id) return
        await api.credit.createAccountPayment(id, {
          payments: [
            {
              amount: action.amount,
              payment_method: "efectivo",
              payment_reference: action.reference,
            },
          ],
        })
        return "creditAccounts"
      }

      case "CASH_CLOSE": {
        const id = numericId(action.id)
        if (!id) return
        await api.cashShifts.close(id, {
          counted_cash: action.totals?.cash ?? action.counted,
          counted_card: action.totals?.card ?? 0,
          counted_transfer: action.totals?.transfer ?? 0,
          counted_deposit: action.totals?.deposit ?? 0,
        })
        return
      }

      case "BREAKFAST_REDEEM": {
        const id = numericId(action.id)
        if (!id) return
        await api.breakfast.redeemVoucher(id, { redeemed_by: "Recepcion" })
        return
      }

      case "BREAKFAST_CREATE": {
        const stayId = numericId(action.voucher.reservationId)
        const optionId = numericId(action.voucher.type)
        if (!stayId || !optionId) return
        await api.breakfast.createVoucher({
          id_stay_room: stayId,
          id_breakfast_option: optionId,
          guest_name: action.voucher.guestName,
          notes: action.voucher.notes,
        })
        return
      }

      case "BREAKFAST_OPTION_CREATE":
        await api.breakfast.createOption(breakfastOptionPayload(action.option))
        return

      case "BREAKFAST_OPTION_UPDATE": {
        const id = numericId(action.id)
        const option = state.breakfastOptions.find((item) => item.id === action.id)
        if (!id || !option) return
        await api.breakfast.updateOption(id, breakfastOptionPayload({ ...option, ...action.patch }))
        return
      }

      case "BREAKFAST_OPTION_DELETE": {
        const id = numericId(action.id)
        if (!id) return
        await api.breakfast.deleteOption(id)
        return
      }

      case "SALON_CREATE":
        await api.eventSalons.create({
          name: action.salon.name,
          description: action.salon.description,
          capacity: action.salon.capacity,
          base_price: 0,
        })
        return "salons"

      case "EVENT_CREATE":
        await api.events.create(eventPayload(action.event))
        return "events"

      case "EVENT_UPDATE": {
        const id = numericId(action.id)
        if (!id) return
        if (action.patch.status === "confirmado") await api.events.confirm(id)
        if (action.patch.status === "realizado") await api.events.complete(id)
        if (action.patch.status === "cancelado") {
          await api.events.cancel(id, { reason: action.patch.notes })
        }
        return
      }

      case "EVENT_CANCEL": {
        const id = numericId(action.id)
        if (!id) return
        await api.events.cancel(id, { reason: "Cancelado desde eventos" })
        return
      }

      case "MTO_CREATE": {
        const roomId = action.ticket.roomNumber
          ? numericId(roomIdFromNumber(action.ticket.roomNumber, state))
          : null
        await api.maintenance.createTicket({
          id_room: roomId ?? 0,
          category: action.ticket.type,
          urgency: maintenancePriorityPayload(action.ticket.priority),
          description: action.ticket.description,
          responsible: action.ticket.assignedTo,
          estimated_cost: action.ticket.cost,
          block_room: action.ticket.priority === "urgente",
        })
        return
      }

      case "MTO_UPDATE": {
        const id = numericId(action.id)
        if (!id) return
        if (action.patch.status === "en progreso") await api.maintenance.startTicket(id)
        if (action.patch.status === "resuelto") {
          await api.maintenance.resolveTicket(id, {
            final_cost: action.patch.cost,
            resolution_notes: action.patch.description,
            send_room_to_cleaning: true,
          })
        }
        if (action.patch.status === "cancelado") {
          await api.maintenance.cancelTicket(id, {
            cancel_reason: action.patch.description,
          })
        }
        return "reservations"
      }

      case "INV_ITEM_CREATE":
        await api.inventory.createItem(inventoryItemPayload(action.item))
        return "inventory"

      case "INV_ITEM_UPDATE": {
        const id = numericId(action.id)
        const item = state.inventory.find((candidate) => candidate.id === action.id)
        if (!id || !item) return
        await api.inventory.updateItem(id, inventoryItemPayload({ ...item, ...action.patch }))
        return "inventory"
      }

      case "INV_ITEM_DELETE": {
        const id = numericId(action.id)
        if (!id) return
        await api.inventory.deleteItem(id)
        return "inventory"
      }

      case "INV_MOVEMENT": {
        const payload = inventoryMovementPayload(action.movement)
        if (!payload.id_inventory_item) return
        await api.inventory.createMovement(payload)
        return ["inventory", "inventoryMovements"]
      }

      case "USER_CREATE":
        await api.users.create(userPayload(action.user))
        return

      case "USER_UPDATE": {
        const id = numericId(action.id)
        const user = state.users.find((item) => item.id === action.id)
        if (!id || !user) return
        await api.users.update(userUpdatePayload({ ...user, ...action.patch }, id))
        return
      }

      case "USER_TOGGLE": {
        const id = numericId(action.id)
        const user = state.users.find((item) => item.id === action.id)
        if (!id || !user) return
        await api.users.update(userUpdatePayload(
          { ...user, status: user.status === "activo" ? "inactivo" : "activo" },
          id,
        ))
        return
      }

      default:
        return
    }
  } catch (error) {
    console.warn("[Casa Luna API] No se pudo sincronizar la accion", action.type, error)
  }
}

async function loadCreditMovements(accounts: CreditAccount[] | undefined) {
  if (!accounts?.length) return []

  const movements = await Promise.all(
    accounts.map(async (account) => {
      const id = numericId(account.id)
      if (!id) return []
      const result = await safeLoad(() => api.credit.listAccountMovements(id))
      return toArray(result.data).map((item) => mapCreditMovement(item, account.id))
    }),
  )

  return movements.flat()
}

async function loadRoomRateOptions(rooms: Room[]) {
  if (!rooms.length) return rooms

  const enrichedRooms = await Promise.all(
    rooms.map(async (room) => {
      const id = numericId(room.id)
      if (!id) return room

      const result = await safeLoad(() => api.rooms.listRateOptions(id))
      if (!isHydratableSource(result.source) || !hasApiPayloadData(result.data)) {
        return room
      }

      const options = mapRoomRateOptionsPayload(result.data)

      return {
        ...room,
        maxOccupancy: options.maxOccupancy ?? room.maxOccupancy,
        occupancyOptions: options.occupancyOptions.length
          ? options.occupancyOptions
          : room.occupancyOptions,
        rateOptions: options.rateOptions.length ? options.rateOptions : room.rateOptions,
        specificRates: options.specificRates.length ? options.specificRates : room.specificRates,
      }
    }),
  )

  return enrichedRooms
}

async function safeLoad<T>(loader: () => Promise<T>): Promise<ApiLoadResult<T>> {
  try {
    const data = await loader()
    const source = hasApiPayloadData(data) ? "connected" : "empty"
    return { data, source }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      console.info("[Casa Luna API] Endpoint requiere autenticacion.", error)
      return { data: undefined, source: "unauthorized" }
    }

    console.info("[Casa Luna API] Endpoint no disponible para hidratacion.", error)
    return { data: undefined, source: "empty" }
  }
}

function createApiSources(sources: Partial<BackendSources>): Partial<BackendSources> {
  return sources
}

function isHydratableSource(source: BackendSourceState) {
  return source === "connected"
}

function hasApiPayloadData(data: unknown) {
  if (Array.isArray(data)) return true
  if (isRecord(data) && Array.isArray(data.data)) return true
  if (isRecord(data)) return Object.keys(data).length > 0
  return data !== undefined && data !== null
}

function mapRoomType(item: unknown): RoomType {
  const record = toRecord(item)
  const backendId = pickId(record, ["id_room_type", "idRoomType", "room_type_id", "id"])
  const name = pickString(record, ["name", "room_type", "roomType"], "Tipo de habitacion")
  const rates = toArray(record.rates ?? record.rate_options ?? record.rateOptions).map(
    (rate) => mapRoomRateOption(rate, "tipo"),
  )

  return {
    id: roomTypeId(backendId, name),
    name,
    description: pickString(record, ["description"], ""),
    basePrice: pickNumber(record, ["base_price", "basePrice", "price"], 0),
    corporatePrice: pickNumber(record, ["corporate_price", "corporatePrice"], 0) || undefined,
    capacity: pickNumber(record, ["capacity", "people_count"], 1),
    beds: pickString(record, ["beds"], "Segun ocupacion"),
    amenities: pickStringArray(record, ["amenities"], [
      "Desayuno incluido",
      "Lavanderia disponible",
      "Snacks y bebidas con cargo",
    ]),
    rates,
  }
}

function mapRoomRateOption(item: unknown, fallbackSource: RoomRateOption["source"] = "tipo"): RoomRateOption {
  const record = toRecord(item)
  const peopleCount = pickNumber(record, ["people_count", "peopleCount", "occupancy", "guests"], 1)
  const source = normalize(pickString(record, ["source", "rate_source", "rateSource"], ""))
  const specificPrice = pickOptionalNumber(record, [
    "specific_price",
    "specificPrice",
    "special_price",
    "specialPrice",
    "room_price",
    "roomPrice",
  ])
  const isSpecific =
    pickBoolean(
      record,
      [
        "is_specific",
        "isSpecific",
        "specific",
        "has_specific_rate",
        "hasSpecificRate",
        "is_special",
        "isSpecial",
      ],
      false,
    ) ||
    Boolean(specificPrice) ||
    source.includes("habitacion") ||
    source.includes("room") ||
    source.includes("specific") ||
    source.includes("special")

  return {
    peopleCount,
    price: pickNumber(
      record,
      [
        "final_price",
        "finalPrice",
        "final_rate",
        "finalRate",
        "effective_price",
        "effectivePrice",
        "effective_rate",
        "effectiveRate",
        "specific_price",
        "specificPrice",
        "special_price",
        "specialPrice",
        "room_price",
        "roomPrice",
        "price",
        "rate",
        "amount",
        "nightly_rate",
        "nightlyRate",
        "base_price",
        "basePrice",
        "normal_price",
        "normalPrice",
        "normal_rate",
        "normalRate",
        "default_rate",
        "defaultRate",
      ],
      0,
    ),
    isSpecific,
    reason: pickOptionalString(record, ["reason", "special_rate_reason", "manual_rate_reason", "notes"]),
    source: isSpecific ? "habitacion" : fallbackSource,
  }
}

function mapRoomSpecificRate(item: unknown): RoomSpecificRate {
  const rate = mapRoomRateOption(item, "habitacion")
  return {
    peopleCount: rate.peopleCount,
    price: rate.price,
    reason: rate.reason,
  }
}

function mapRoomRateOptionsPayload(data: unknown) {
  const record = toRecord(data)
  const rateSource =
    Array.isArray(data)
      ? data
      : record.rate_options ??
        record.rateOptions ??
        record.room_rate_options ??
        record.roomRateOptions ??
        record.rates ??
        record.options ??
        record.data
  const rateOptions = toArray(rateSource).map((rate) => mapRoomRateOption(rate))
  const explicitSpecificRates = toArray(
    record.specific_rates ??
      record.specificRates ??
      record.room_specific_rates ??
      record.roomSpecificRates,
  ).map(mapRoomSpecificRate)
  const specificRates = explicitSpecificRates.length
    ? explicitSpecificRates
    : rateOptions
        .filter((rate) => rate.isSpecific)
        .map((rate) => ({
          peopleCount: rate.peopleCount,
          price: rate.price,
          reason: rate.reason,
        }))
  const occupancyOptions = toNumberArray(
    record.occupancy_options ??
      record.occupancyOptions ??
      record.people_counts ??
      record.peopleCounts,
  )
  const maxOccupancy =
    pickNumber(
      record,
      [
        "max_occupancy",
        "maxOccupancy",
        "maximum_occupancy",
        "maximumOccupancy",
        "max_capacity",
        "maxCapacity",
        "guest_capacity",
        "guestCapacity",
        "max_guests",
        "maxGuests",
        "people_capacity",
        "peopleCapacity",
        "capacity",
      ],
      0,
    ) || Math.max(0, ...occupancyOptions)

  return {
    rateOptions,
    specificRates,
    occupancyOptions,
    maxOccupancy: maxOccupancy || undefined,
  }
}

function mapRoom(item: unknown): Room {
  const record = toRecord(item)
  const backendId = pickId(record, ["id_room", "idRoom", "room_id", "id"])
  const number = pickString(record, ["room_number", "roomNumber", "number"], String(backendId ?? ""))
  const roomType = toRecord(record.room_type ?? record.roomType)
  const typeName =
    pickString(roomType, ["name"], "") ||
    pickString(record, ["room_type_name", "roomTypeName", "room_type", "roomType"], "")
  const typeId = pickId(record, ["id_room_type", "idRoomType", "room_type_id"])
  const occupancyOptions = toNumberArray(
    record.occupancy_options ?? record.occupancyOptions ?? record.people_counts ?? record.peopleCounts,
  )
  const rateOptions = toArray(
    record.rate_options ??
      record.rateOptions ??
      record.room_rate_options ??
      record.roomRateOptions ??
      record.rates,
  ).map((rate) => mapRoomRateOption(rate))
  const specificRates = toArray(
    record.specific_rates ??
      record.specificRates ??
      record.room_specific_rates ??
      record.roomSpecificRates,
  ).map(mapRoomSpecificRate)
  const maxOccupancy =
    pickNumber(
      record,
      [
        "max_occupancy",
        "maxOccupancy",
        "maximum_occupancy",
        "maximumOccupancy",
        "max_capacity",
        "maxCapacity",
        "guest_capacity",
        "guestCapacity",
        "max_guests",
        "maxGuests",
        "people_capacity",
        "peopleCapacity",
        "capacity",
      ],
      0,
    ) || Math.max(0, ...occupancyOptions)

  return {
    id: backendId ? String(backendId) : `r-${slug(number)}`,
    number,
    floor: pickNumber(record, ["floor"], 1),
    typeId: roomTypeId(typeId, typeName),
    status: mapRoomStatus(pickString(record, ["status"], "disponible")),
    maxOccupancy: maxOccupancy || undefined,
    occupancyOptions,
    rateOptions,
    specificRates,
    breakfastQrCode: pickOptionalString(record, [
      "breakfast_qr_code",
      "breakfastQrCode",
      "qr_code",
      "qrCode",
    ]),
    notes: pickOptionalString(record, ["internal_notes", "notes"]),
  }
}

function mapGuest(item: unknown): Guest {
  const record = toRecord(item)
  const documentType = pickString(record, ["document_type", "documentType"], "DPI")

  return {
    id: String(pickId(record, ["id_guest", "idGuest", "guest_id", "id"]) ?? cryptoId("guest")),
    name: pickString(record, ["name_or_company", "name", "company"], "Cliente sin nombre"),
    document: pickString(record, ["document_number", "document", "dpi"], ""),
    documentType: documentType.toLowerCase().includes("pasaporte") ? "Pasaporte" : "DPI",
    nit: pickString(record, ["nit"], "CF"),
    email: pickOptionalString(record, ["email"]),
    phone: pickOptionalString(record, ["phone", "phone_number"]),
    country: pickString(record, ["country"], "Guatemala"),
    department: pickOptionalString(record, ["department"]),
    vip: pickBoolean(record, ["is_frequent_customer", "vip"], false),
    notes: pickOptionalString(record, ["notes"]),
  }
}

function mapReservations(items: unknown[]) {
  return items.flatMap((item) => {
    const record = toRecord(item)
    const rooms = toArray(record.rooms ?? record.reservation_rooms ?? record.stay_rooms)

    if (!rooms.length) return [mapReservation(record)]

    return rooms.map((room, index) => mapReservation(record, toRecord(room), index, rooms.length))
  })
}

function mapReservation(
  record: ApiRecord,
  roomRecord: ApiRecord = {},
  index = 0,
  roomCount = 1,
): Reservation {
  const backendId = pickId(record, ["id_reservation", "idReservation", "reservation_id", "id"])
  const reservationRoomId = pickId(roomRecord, [
    "id_reservation_room",
    "idReservationRoom",
    "reservation_room_id",
  ])
  const roomId = pickId(roomRecord, ["id_room", "idRoom", "room_id"]) ??
    pickId(record, ["id_room", "idRoom", "room_id"])
  const guestRecord = toRecord(record.guest)
  const guestId = pickId(record, ["id_guest", "idGuest", "guest_id"]) ??
    pickId(guestRecord, ["id_guest", "id"])
  const checkIn = dateOnly(
    pickString(roomRecord, ["check_in_date", "checkIn"], "") ||
      pickString(record, ["check_in_date", "checkIn"], ""),
  )
  const checkOut = dateOnly(
    pickString(roomRecord, ["check_out_date", "checkOut"], "") ||
      pickString(record, ["check_out_date", "checkOut"], ""),
  )
  const total = pickNumber(roomRecord, ["total", "quoted_total"], pickNumber(record, ["total"], 0))
  const reservationTotal = pickNumber(record, ["total"], total)
  const advanceAmount = pickNumber(record, ["advance_amount", "paid"], 0)
  const allocatedAdvance =
    roomCount > 1 && reservationTotal > 0
      ? Math.min(total, advanceAmount * (total / reservationTotal))
      : advanceAmount
  const allPaymentRecords = toArray(record.all_payments ?? record.allPayments)
  const fallbackPaymentRecords = [
    ...toArray(record.payments),
    ...toArray(record.stay_payments ?? record.stayPayments),
  ]
  const explicitPayments = (
    allPaymentRecords.length > 0 ? allPaymentRecords : fallbackPaymentRecords
  ).map(mapPaymentRecord)
  const payments =
    explicitPayments.length || allocatedAdvance <= 0
      ? explicitPayments
      : [
          {
            id: `advance-${backendId ?? cryptoId("reservation")}-${index}`,
            method: mapPaymentMethod(
              pickString(record, ["advance_payment_method", "payment_method"], "efectivo"),
            ),
            amount: allocatedAdvance,
            reference: pickOptionalString(record, ["payment_reference", "reference"]),
            notes: pickOptionalString(record, ["notes", "payment_notes", "paymentNotes"]),
            stage: "reserva" as const,
            date: dateOnly(pickString(record, ["createdAt", "created_at"], new Date().toISOString())),
          },
        ]
  const paymentIsInvoiced = (payment: PaymentRecord) =>
    Boolean(payment.isInvoiced || payment.invoiceId || payment.invoicedAt) ||
    (Number.isFinite(payment.invoicedAmount) && Number(payment.invoicedAmount) > 0.01) ||
    (Number.isFinite(payment.pendingToInvoiceAmount) &&
      Number(payment.pendingToInvoiceAmount) <= 0.01)
  const paymentsInvoicedAmount = payments.reduce(
    (sum, payment) =>
      sum +
      (paymentIsInvoiced(payment)
        ? Number(payment.amount || 0)
        : 0),
    0,
  )
  const paymentsPendingToInvoiceAmount = payments.reduce(
    (sum, payment) =>
      sum +
      (paymentIsInvoiced(payment)
        ? 0
        : Number(payment.amount || 0)),
    0,
  )
  const lastInvoiceId = pickOptionalString(record, ["last_invoice_id", "lastInvoiceId"])
  const aggregateInvoicedAmount = pickOptionalNumber(record, ["invoiced_amount", "invoicedAmount"])
  const aggregatePendingToInvoiceAmount = pickOptionalNumber(record, [
    "pending_to_invoice_amount",
    "pendingToInvoiceAmount",
  ])
  const invoicedAmount = payments.length > 0
    ? paymentsInvoicedAmount
    : aggregateInvoicedAmount
  const pendingToInvoiceAmount = payments.length > 0
    ? paymentsPendingToInvoiceAmount
    : aggregatePendingToInvoiceAmount
  const explicitBillingStatus = mapReservationBillingStatus(
    pickString(record, ["billing_status", "billingStatus"], ""),
  )

  return {
    id: backendId ? `${backendId}${index ? `-${index}` : ""}` : cryptoId("reservation"),
    reservationRoomId: reservationRoomId ? String(reservationRoomId) : undefined,
    code: pickString(record, ["code", "reservation_code"], backendId ? `RES-${backendId}` : "RES"),
    guestId: guestId ? String(guestId) : "",
    roomId: roomId ? String(roomId) : "",
    checkIn,
    checkOut,
    nights: pickNumber(record, ["nights"], daysBetween(checkIn, checkOut)),
    adults: pickNumber(roomRecord, ["adults", "people_count"], 1),
    children: pickNumber(roomRecord, ["children"], 0),
    rate: pickNumber(roomRecord, ["rate", "manual_rate", "nightly_rate"], total),
    rateType: mapReservationRateType(pickString(roomRecord, ["rate_type", "rateType"], "")),
    manualRateReason: pickOptionalString(roomRecord, ["manual_rate_reason", "manualRateReason"]),
    total,
    paid: paymentTotal(payments) || allocatedAdvance,
    status: mapReservationStatus(
      pickString(record, ["status"], "pendiente"),
      record,
      roomRecord,
    ),
    source: mapReservationSource(pickString(record, ["origin", "source"], "directo")),
    notes: pickOptionalString(record, ["notes"]),
    createdAt: dateOnly(pickString(record, ["createdAt", "created_at"], new Date().toISOString())),
    payments,
    billingStatus: payments.length > 0
      ? inferReservationBillingStatus(invoicedAmount, pendingToInvoiceAmount, lastInvoiceId)
      : explicitBillingStatus ??
        inferReservationBillingStatus(invoicedAmount, pendingToInvoiceAmount, lastInvoiceId),
    lastInvoiceId,
    invoicedAmount,
    pendingToInvoiceAmount,
  }
}

function mapPaymentRecord(item: unknown, index = 0): PaymentRecord {
  const record = toRecord(item)
  const reservationPaymentId = pickId(record, [
    "id_reservation_payment",
    "idReservationPayment",
    "reservation_payment_id",
  ])
  const stayPaymentId = pickId(record, [
    "id_stay_payment",
    "idStayPayment",
    "stay_payment_id",
  ])
  const eventPaymentId = pickId(record, [
    "id_event_payment",
    "idEventPayment",
    "event_payment_id",
  ])
  const paymentId = reservationPaymentId ?? stayPaymentId ?? eventPaymentId ??
    pickId(record, ["id_payment", "id"])
  const backendPaymentType =
    stayPaymentId !== undefined && stayPaymentId !== null
      ? "stay"
      : eventPaymentId !== undefined && eventPaymentId !== null
        ? "event"
        : reservationPaymentId !== undefined && reservationPaymentId !== null
          ? "reservation"
          : undefined
  const issueSourceModule = pickOptionalString(record, [
    "issue_source_module",
    "issueSourceModule",
    "source_module",
    "sourceModule",
  ])
  const issueSourceId = pickId(record, [
    "issue_source_id",
    "issueSourceId",
    "source_id",
    "sourceId",
  ]) ??
    (backendPaymentType === "stay"
      ? pickId(record, ["id_stay", "idStay", "stay_id"])
      : backendPaymentType === "reservation"
        ? pickId(record, ["id_reservation", "idReservation", "reservation_id"])
        : undefined)

  return {
    id: String(paymentId ?? `payment-${index}`),
    backendPaymentId: paymentId === undefined || paymentId === null
      ? undefined
      : String(paymentId),
    method: mapPaymentMethod(pickString(record, ["payment_method", "method"], "efectivo")),
    amount: pickNumber(record, ["amount"], 0),
    reference: pickOptionalString(record, ["payment_reference", "reference"]),
    notes: pickOptionalString(record, ["notes", "payment_notes", "paymentNotes"]),
    stage: mapPaymentStage(
      pickString(record, [
        "payment_stage",
        "paymentStage",
        "stage",
        "payment_scope",
        "paymentScope",
        "issue_source_module",
        "issueSourceModule",
        "source_module",
        "sourceModule",
      ]),
    ),
    date: dateOnly(pickString(record, ["date", "createdAt"], new Date().toISOString())),
    backendPaymentType,
    issueSourceModule,
    issueSourceId: issueSourceId === undefined || issueSourceId === null
      ? undefined
      : String(issueSourceId),
    isInvoiced: pickBoolean(record, ["is_invoiced", "isInvoiced"], false),
    invoiceId: pickOptionalString(record, ["id_invoice", "idInvoice", "invoice_id"]),
    invoicedAmount: pickOptionalNumber(record, ["invoiced_amount", "invoicedAmount"]),
    pendingToInvoiceAmount: pickOptionalNumber(record, [
      "pending_to_invoice_amount",
      "pendingToInvoiceAmount",
    ]),
    invoicedAt: pickOptionalString(record, ["invoiced_at", "invoicedAt"]),
  }
}

function mapPaymentStage(stage: string): PaymentRecord["stage"] {
  const value = normalize(stage)
  if (value.includes("checkout") || value.includes("check-out") || value.includes("salida")) {
    return "check-out"
  }
  if (value.includes("checkin") || value.includes("check-in") || value.includes("entrada")) {
    return "check-in"
  }
  return "reserva"
}

function mapBreakfastOption(item: unknown, index = 0): BreakfastOption {
  const record = toRecord(item)
  const id = pickId(record, ["id_breakfast_option", "idBreakfastOption", "id"])
  const color = pickNumber(record, ["color", "display_order"], index + 1)
  const accentIndex = Math.max(0, (color > 0 ? color - 1 : index) % BREAKFAST_ACCENTS.length)

  return {
    id: id ? String(id) : slug(pickString(record, ["name"], `opcion-${index}`)),
    label: pickString(record, ["name", "label"], "Desayuno"),
    description: pickString(record, ["description"], ""),
    accent: BREAKFAST_ACCENTS[accentIndex],
    imageUrl: pickOptionalString(record, ["image_url", "imageUrl", "photo_url", "photoUrl", "picture"]),
  }
}

function mapBreakfastVoucher(item: unknown, index = 0): BreakfastVoucher {
  const record = toRecord(item)
  const id = pickId(record, ["id_breakfast_voucher", "id_breakfast_selection", "id"])
  const optionId = pickId(record, ["id_breakfast_option", "breakfast_option_id"])

  return {
    id: id ? String(id) : `bf-${index}`,
    reservationId: String(pickId(record, ["id_stay_room", "id_reservation", "reservation_id"]) ?? ""),
    date: dateOnly(pickString(record, ["date", "createdAt"], new Date().toISOString())),
    guestName: pickString(record, ["guest_name", "guestName"], "Huesped"),
    room: pickString(record, ["room_number", "room"], ""),
    type: optionId ? String(optionId) : pickString(record, ["type", "breakfast_option"], "continental"),
    redeemed: mapRedeemed(record),
    redeemedAt: pickOptionalString(record, ["redeemed_at", "redeemedAt"]),
    notes: pickOptionalString(record, ["notes", "beverage"]),
  }
}

function mapCreditAccount(item: unknown): CreditAccount {
  const record = toRecord(item)
  const guestRecord = toRecord(record.guest)
  const guestId = pickId(record, ["id_guest", "idGuest", "guest_id"]) ??
    pickId(guestRecord, ["id_guest", "id"])
  const balance = pickNumber(record, ["balance", "used_amount", "usedAmount"], 0)
  const available = pickNumber(record, ["available_credit", "availableCredit"], 0)
  const limit = pickNumber(record, ["credit_limit", "limit"], balance + available)

  return {
    id: String(pickId(record, ["id_credit_account", "idCreditAccount", "id"]) ?? cryptoId("credit")),
    guestId: guestId ? String(guestId) : undefined,
    company: pickString(record, ["company", "name_or_company", "guest_name", "client_name"], pickString(guestRecord, ["name_or_company", "name"], "Cuenta credito")),
    contact: pickString(record, ["contact", "guest_name", "client_name"], pickString(guestRecord, ["name_or_company", "name"], "")),
    email: pickString(record, ["email"], pickString(guestRecord, ["email"], "")),
    phone: pickString(record, ["phone", "guest_phone"], pickString(guestRecord, ["phone"], "")),
    limit,
    balance,
    dueDate: dateOnly(pickString(record, ["due_date", "dueDate"], new Date().toISOString())),
    status: mapCreditStatus(pickString(record, ["status"], balance > limit ? "vencido" : "al dia")),
    creditStatus: mapCreditAccountStatus(pickString(record, ["credit_status", "creditStatus"], "activo")),
    authorizationNote: pickOptionalString(record, ["authorization_note", "notes"]),
  }
}

function mapCreditMovement(item: unknown, accountId: string): CreditMovement {
  const record = toRecord(item)
  const amount = pickNumber(record, ["amount"], 0)
  const movementType = normalize(pickString(record, ["movement_type", "type"], "charge"))

  return {
    id: String(pickId(record, ["id_credit_movement", "id"]) ?? cryptoId("movement")),
    accountId,
    date: dateOnly(pickString(record, ["date", "createdAt"], new Date().toISOString())),
    concept: pickString(record, ["concept", "description"], "Movimiento"),
    charge: movementType.includes("pay") || movementType.includes("pago") ? 0 : amount,
    payment: movementType.includes("pay") || movementType.includes("pago") ? amount : 0,
    reference: pickString(record, ["reference"], ""),
  }
}

function mapCreditAuthorizationRequest(item: unknown): CreditAuthorizationRequest {
  const record = toRecord(item)

  return {
    id: String(pickId(record, ["id_credit_authorization_request", "id"]) ?? cryptoId("auth")),
    accountId: String(pickId(record, ["id_credit_account", "account_id"]) ?? ""),
    requestedBy: pickString(record, ["requested_by", "requestedBy"], "Recepcion"),
    requestedAt: dateOnly(pickString(record, ["requested_at", "createdAt"], new Date().toISOString())),
    reason: pickString(record, ["reason"], ""),
    status: mapAuthorizationStatus(pickString(record, ["status"], "pendiente")),
    resolvedAt: pickOptionalString(record, ["reviewed_at", "resolvedAt"]),
    resolvedBy: pickOptionalString(record, ["reviewed_by", "resolvedBy"]),
    notes: pickOptionalString(record, ["review_notes", "notes"]),
  }
}

function mapCashClose(item: unknown): CashClose {
  const record = toRecord(item)
  const cash = pickNumber(record, ["cash", "cash_total"], 0)
  const card = pickNumber(record, ["card", "card_total"], 0)
  const transfer = pickNumber(record, ["transfer", "transfer_total"], 0)
  const deposit = pickNumber(record, ["deposit", "deposit_total"], 0)
  const other = pickNumber(record, ["other", "other_total", "manual_other"], 0)
  const expenses = pickNumber(record, ["expenses"], 0)
  const expected = pickNumber(record, ["expected"], cash + card + transfer + deposit + other - expenses)
  const counted = pickNumber(record, ["counted", "counted_cash"], 0)

  return {
    id: String(pickId(record, ["id_cash_shift", "id"]) ?? cryptoId("cash")),
    shift: mapShift(pickString(record, ["shift", "shift_name", "name"], "matutino")),
    user: pickString(record, ["user", "user_name", "assigned_user"], "Encargado no encontrado"),
    openedAt: pickString(
      record,
      ["opened_at", "openedAt", "start_at", "shift_date"],
      new Date().toISOString(),
    ),
    closedAt: pickOptionalString(record, ["closed_at", "closedAt", "end_at"]),
    opening: pickNumber(record, ["opening", "opening_cash"], 0),
    cash,
    card,
    transfer,
    deposit,
    other,
    expenses,
    expected,
    counted,
    difference: counted ? counted - expected : 0,
    status: normalize(pickString(record, ["status"], "abierto")).includes("cerr")
      ? "cerrado"
      : "abierto",
    notes: pickOptionalString(record, ["notes"]),
  }
}

function sessionActorName() {
  return getSessionUser()?.name?.trim() || "Usuario de sesión no encontrado"
}

function mapEventSalon(item: unknown): EventSalon {
  const record = toRecord(item)
  const name = pickString(record, ["name"], "Salon")

  return {
    id: String(pickId(record, ["id_event_salon", "id"]) ?? slug(name)),
    name,
    capacity: pickNumber(record, ["capacity"], 1),
    kind: normalize(name).includes("cowork") ? "coworking" : "salon",
    description: pickString(record, ["description"], ""),
    freeForGuests: normalize(name).includes("cowork"),
  }
}

function mapHotelEvent(item: unknown): HotelEvent {
  const record = toRecord(item)
  const salonId = pickId(record, ["id_event_salon", "salon_id"])
  const guestId = pickId(record, ["id_guest", "guest_id"])
  const payments = toArray(record.payments).map(mapPaymentRecord)
  const invoicedAmount = pickOptionalNumber(record, ["invoiced_amount", "invoicedAmount"])
  const pendingToInvoiceAmount = pickOptionalNumber(record, [
    "pending_to_invoice_amount",
    "pendingToInvoiceAmount",
  ])
  const lastInvoiceId = pickOptionalString(record, ["last_invoice_id", "lastInvoiceId"])

  return {
    id: String(pickId(record, ["id_event", "id"]) ?? cryptoId("event")),
    guestId: guestId ? String(guestId) : undefined,
    title: pickString(record, ["event_name", "title"], "Evento"),
    client: pickString(record, ["client_name", "client"], "Cliente"),
    contact: pickString(record, ["contact_phone", "contact"], ""),
    salonId: salonId ? String(salonId) : undefined,
    salon: pickString(record, ["salon", "salon_name"], "Salon"),
    date: dateOnly(pickString(record, ["event_date", "date"], new Date().toISOString())),
    startTime: timeOnly(pickString(record, ["start_time", "startTime"], "08:00")),
    endTime: timeOnly(pickString(record, ["end_time", "endTime"], "17:00")),
    guests: pickNumber(record, ["people_count", "guests"], 1),
    type: mapEventType(pickString(record, ["event_type", "type"], "alquiler")),
    clientKind: normalize(pickString(record, ["client_kind"], "externo")).includes("huesped")
      ? "huesped"
      : "externo",
    total: pickNumber(record, ["quoted_total", "total"], 0),
    paid: paymentTotal(payments) || pickNumber(record, ["paid", "paid_amount", "advance_amount"], 0),
    payments,
    billingStatus:
      mapReservationBillingStatus(pickString(record, ["billing_status", "billingStatus"], "")) ??
      inferReservationBillingStatus(invoicedAmount, pendingToInvoiceAmount, lastInvoiceId),
    lastInvoiceId,
    invoicedAmount,
    pendingToInvoiceAmount,
    status: mapEventStatus(pickString(record, ["status"], "reservado")),
    notes: pickOptionalString(record, ["services_notes", "notes"]),
  }
}

function mapMaintenanceTicket(item: unknown): MaintenanceTicket {
  const record = toRecord(item)
  const roomRecord = toRecord(record.room)

  return {
    id: String(pickId(record, ["id_maintenance_ticket", "id"]) ?? cryptoId("mto")),
    code: pickString(record, ["code"], `MTO-${pickId(record, ["id"]) ?? ""}`),
    roomNumber: pickOptionalString(record, ["room_number"]) ?? pickOptionalString(roomRecord, ["room_number"]),
    area: pickOptionalString(record, ["area"]),
    type: mapMaintenanceType(pickString(record, ["category", "type"], "otro")),
    priority: mapMaintenancePriority(pickString(record, ["urgency", "priority"], "media")),
    status: mapMaintenanceStatus(pickString(record, ["status"], "abierto")),
    description: pickString(record, ["description"], ""),
    reportedBy: pickString(record, ["reported_by"], "Recepcion"),
    assignedTo: pickOptionalString(record, ["responsible", "assigned_to"]),
    createdAt: dateOnly(pickString(record, ["createdAt", "created_at"], new Date().toISOString())),
    resolvedAt: pickOptionalString(record, ["resolved_at"]),
    cost: pickOptionalNumber(record, ["estimated_cost", "final_cost", "cost"]),
  }
}

function isVisibleOperationalRecord(item: unknown) {
  const record = toRecord(item)
  const internalMarkers = [
    ["co", "dex"].join(""),
    ["co", "dx"].join(""),
    ["_", "te", "st", "_"].join(""),
  ]
  const searchable = [
    record.name,
    record.description,
    record.event_name,
    record.title,
    record.client_name,
    record.client,
    record.contact_phone,
    record.contact,
    record.services_notes,
    record.notes,
  ]
    .map((value) => (typeof value === "string" ? normalize(value) : ""))
    .join(" ")

  return !internalMarkers.some((marker) => searchable.includes(marker))
}

function mapInventoryItem(item: unknown): InventoryItem {
  const record = toRecord(item)
  const id = pickId(record, ["id_inventory_item", "idInventoryItem", "inventory_item_id", "id"])
  const name = pickString(record, ["name", "item_name"], "Producto")

  return {
    id: id ? String(id) : cryptoId("inv"),
    sku: pickString(record, ["code", "sku"], id ? `INV-${id}` : `INV-${slug(name)}`),
    name,
    category: mapInventoryCategory(pickString(record, ["category"], "snack")),
    unit: pickString(record, ["unit_name", "unit", "presentation"], "unidad"),
    stock: pickNumber(record, ["stock_quantity", "available_quantity", "current_stock", "stock"], 0),
    minStock: pickNumber(record, ["minimum_quantity", "minimum_stock", "minStock"], 0),
    cost: pickNumber(record, ["cost_price", "replacement_cost", "cost"], 0),
    price: pickNumber(record, ["guest_price", "sale_price", "price"], 0),
    location: pickString(record, ["warehouse_name", "location", "storage"], "Bodega"),
  }
}

function mapInventoryMovement(item: unknown): InventoryMovement {
  const record = toRecord(item)
  const itemRecord = toRecord(record.inventory_item ?? record.item)
  const itemId = pickId(record, ["id_inventory_item", "inventory_item_id"]) ??
    pickId(itemRecord, ["id_inventory_item", "id"])

  return {
    id: String(pickId(record, ["id_inventory_movement", "idInventoryMovement", "id"]) ?? cryptoId("mov")),
    itemId: itemId ? String(itemId) : "",
    type: mapInventoryMovementType(pickString(record, ["movement_type", "type"], "ajuste")),
    qty: Math.abs(pickNumber(record, ["quantity", "qty"], 0)),
    reason: pickString(record, ["reason", "notes", "description"], "Movimiento de inventario"),
    room: pickOptionalString(record, ["room_number", "room"]),
    user: pickString(record, ["registered_by", "user", "created_by"], "Sistema"),
    date: dateOnly(pickString(record, ["created_at", "date", "createdAt"], new Date().toISOString())),
  }
}

function mapAppUser(item: unknown): AppUser {
  const record = toRecord(item)
  const id = pickId(record, ["id_user", "id"])
  const names = pickString(record, ["names", "name"], "")
  const lastnames = pickString(record, ["lastnames", "lastname"], "")
  const roleId = pickOptionalNumber(record, ["id_rol", "idRol", "role_id", "roleId", "id_role"])
  const roleName = pickString(record, ["role", "name_rol", "rol_name", "rol_nombre", "rol"], "")
  const role = mapUserRoleById(roleId) ?? mapUserRole(roleName || "recepcion")

  return {
    id: id ? String(id) : cryptoId("user"),
    name: `${names} ${lastnames}`.trim() || pickString(record, ["user_name"], "Usuario"),
    email: pickString(record, ["email", "user_name"], ""),
    role,
    roleId,
    roleName: roleName || undefined,
    status: pickBoolean(record, ["status", "is_active"], true) ? "activo" : "inactivo",
    lastLogin: pickString(record, ["last_login", "lastLogin"], ""),
    permissions: role === "gerencia" ? ["*"] : [role],
  }
}

function roomPayload(room: Room, state: State) {
  return {
    room_number: room.number,
    floor: room.floor,
    id_room_type: roomTypeBackendId(room.typeId, state) ?? 0,
    status: roomStatusPayload(room.status),
    internal_notes: room.notes,
    amenity_ids: [],
  }
}

async function syncRoomConfiguration(roomId: ApiId | null, room: Room, previousRoom?: Room) {
  if (!roomId) return

  const peopleCounts = room.occupancyOptions?.length
    ? room.occupancyOptions
    : Array.from({ length: room.maxOccupancy ?? 0 }, (_, index) => index + 1)

  if (peopleCounts.length > 0) {
    await api.rooms.setOccupancyOptions(roomId, { people_counts: peopleCounts })
  }

  const previousRates = new Map(
    previousRoom?.specificRates?.map((rate) => [rate.peopleCount, rate]) ?? [],
  )
  const ratesToSync = previousRoom
    ? (room.specificRates ?? []).filter((rate) => {
        const previousRate = previousRates.get(rate.peopleCount)
        return (
          !previousRate ||
          previousRate.price !== rate.price ||
          (previousRate.reason ?? "") !== (rate.reason ?? "")
        )
      })
    : room.specificRates ?? []

  for (const rate of ratesToSync) {
    if (!rate.peopleCount || !rate.price) continue
    await api.rooms.createSpecificRate(roomId, {
      people_count: rate.peopleCount,
      price: rate.price,
      reason: rate.reason,
    })
  }
}

function roomIdFromCreateResponse(response: unknown, fallbackId: string) {
  return pickRoomIdFromValue(response) ?? numericId(fallbackId)
}

function reservationIdFromCreateResponse(response: unknown, fallbackId: string) {
  return pickReservationIdFromValue(response) ?? numericId(fallbackId)
}

function pickRoomIdFromValue(value: unknown): ApiId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim()

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = pickRoomIdFromValue(item)
      if (id) return id
    }
    return null
  }

  const record = toRecord(value)
  if (!Object.keys(record).length) return null

  const ownId = pickId(record, ["id_room", "idRoom", "room_id", "roomId", "id"])
  if (ownId) return ownId

  for (const key of [
    "room",
    "created_room",
    "createdRoom",
    "new_room",
    "newRoom",
    "result",
    "data",
    "item",
  ]) {
    const id = pickRoomIdFromValue(record[key])
    if (id) return id
  }

  return null
}

function pickReservationIdFromValue(value: unknown): ApiId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim()

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = pickReservationIdFromValue(item)
      if (id) return id
    }
    return null
  }

  const record = toRecord(value)
  if (!Object.keys(record).length) return null

  const ownId = pickId(record, [
    "id_reservation",
    "idReservation",
    "reservation_id",
    "reservationId",
    "id",
  ])
  if (ownId) return ownId

  for (const key of ["reservation", "created_reservation", "createdReservation", "result", "data"]) {
    const id = pickReservationIdFromValue(record[key])
    if (id) return id
  }

  return null
}

function paymentsAddedSince(previous: PaymentRecord[], next: PaymentRecord[]) {
  const previousIds = new Set(previous.map((payment) => payment.id))
  return next.filter((payment) => !previousIds.has(payment.id) && Number(payment.amount || 0) > 0)
}

function paymentsRemovedSince(previous: PaymentRecord[], next: PaymentRecord[]) {
  const nextIds = new Set(next.map((payment) => payment.id))
  return previous.filter((payment) => !nextIds.has(payment.id) && Number(payment.amount || 0) > 0)
}

function isReservationStagePayment(payment: PaymentRecord) {
  return !payment.stage || payment.stage === "reserva"
}

async function deleteReservationPayments(payments: PaymentRecord[]) {
  for (const payment of payments) {
    const id = numericId(payment.id)
    if (id) await api.reservations.deletePayment(id)
  }
}

async function syncReservationNightPayments(
  reservationId: ApiId,
  reservation: Reservation,
  payments: PaymentRecord[],
) {
  const reservationRoomId = numericId(reservation.reservationRoomId)
  if (!reservationRoomId || payments.length === 0) return

  for (const payment of payments) {
    await api.reservations.createNightPayment(reservationId, {
      id_reservation_room: reservationRoomId,
      night_date: reservation.checkIn,
      payments: [paymentPayload(payment)],
      notes: payment.reference ?? `Abono agregado a ${reservation.code}`,
    })
  }
}

async function syncReservationCreditCharge(
  reservationId: ApiId | null,
  reservation: Reservation,
  payments: PaymentRecord[],
  state: State,
) {
  const amount = payments
    .filter((payment) => payment.method === "credito")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  if (amount <= 0) return false

  const account = state.creditAccounts.find(
    (item) =>
      item.guestId === reservation.guestId ||
      normalize(item.company) === normalize(state.guests.find((guest) => guest.id === reservation.guestId)?.name ?? ""),
  )
  const accountId = numericId(account?.id)
  if (!accountId) return false

  await api.credit.createAccountMovement(accountId, {
    concept: "Cargo por reservacion",
    amount,
    source_module: "Reservation",
    source_id: reservationId ? numericId(reservationId) : undefined,
    reference: reservation.code,
    notes: `Credito usado en la reserva ${reservation.code}.`,
  })

  return true
}

function guestPayload(guest: Partial<Guest>) {
  return {
    name_or_company: guest.name,
    document_type: guest.documentType,
    document_number: guest.document,
    nit: guest.nit,
    phone: guest.phone,
    email: guest.email,
    country: guest.country,
    department: guest.department,
    notes: guest.notes,
    is_frequent_customer: Boolean(guest.vip),
  }
}

function reservationPayload(reservation: Reservation, state: State) {
  const guestId = numericId(reservation.guestId)
  const roomId = numericId(reservation.roomId)
  if (!guestId || !roomId) return null
  const rateType = reservation.rateType ?? "normal"

  return {
    id_guest: guestId,
    origin: reservation.source,
    responsible: "Recepcion",
    notes: reservation.notes,
    payments: reservation.payments?.map(paymentPayload),
    rooms: [
      {
        id_room: roomId,
        check_in_date: reservation.checkIn,
        check_out_date: reservation.checkOut,
        people_count: reservation.adults + reservation.children,
        rate_type: reservationRateTypePayload(rateType),
        manual_rate:
          rateType === "manual" || rateType === "corporativa" ? reservation.rate : undefined,
        manual_rate_reason: rateType === "manual" ? reservation.manualRateReason : undefined,
      },
    ],
  }
}

function paymentPayload(payment: PaymentRecord): PaymentItemModel {
  return {
    amount: payment.amount,
    payment_method: payment.method,
    payment_reference: payment.reference,
    notes: payment.notes,
  }
}

function breakfastOptionPayload(option: Partial<BreakfastOption>) {
  const color = Math.max(1, BREAKFAST_ACCENTS.findIndex((accent) => accent === option.accent) + 1)

  return {
    name: option.label,
    description: option.description,
    image_url: option.imageUrl,
    color,
    display_order: color,
    is_active: true,
  }
}

function eventPayload(event: HotelEvent) {
  return {
    id_event_salon: numericId(event.salonId ?? "") ?? 0,
    event_name: event.title,
    event_type: event.type,
    client_name: event.client,
    contact_phone: event.contact,
    people_count: event.guests,
    event_date: `${event.date}T00:00:00`,
    start_time: event.startTime.length === 5 ? `${event.startTime}:00` : event.startTime,
    end_time: event.endTime.length === 5 ? `${event.endTime}:00` : event.endTime,
    services_notes: event.notes,
    quoted_total: event.total,
    meal_unit_cost: event.type === "consumo" && event.guests > 0 ? event.total / event.guests : undefined,
    calculate_total_by_consumption: event.type === "consumo",
    advance_amount: event.paid,
    payment_method: event.paid > 0 ? "efectivo" : undefined,
    payment_reference: event.paid > 0 ? `Anticipo ${event.title}` : undefined,
    confirm_event: event.status === "confirmado",
  }
}

function inventoryItemPayload(item: Partial<InventoryItem>): UpdateInventoryItemModel {
  return {
    name: item.name,
    category: item.category,
    stock_quantity: item.stock ?? 0,
    minimum_quantity: item.minStock ?? 0,
    unit_name: item.unit,
    cost_price: item.cost ?? 0,
    guest_price: item.price ?? item.cost ?? 0,
    warehouse_name: item.location,
    supplier_name: null,
    is_active: true,
  }
}

function inventoryMovementPayload(movement: InventoryMovement): CreateInventoryMovementModel {
  return {
    id_inventory_item: numericId(movement.itemId) ?? 0,
    movement_type: inventoryMovementTypePayload(movement.type),
    quantity: movement.qty,
    notes: [movement.reason, movement.room ? `Habitacion ${movement.room}` : ""]
      .filter(Boolean)
      .join(" - "),
    registered_by: movement.user,
  }
}

function userPayload(user: AppUser) {
  return {
    names: user.name,
    lastnames: "",
    status: user.status === "activo",
    user_name: user.email,
    password: "Temporal123!",
    phone_number: "",
    id_rol: user.roleId ?? userRoleId(user.role),
  }
}

function userUpdatePayload(user: AppUser, id: number) {
  return {
    id_user: id,
    names: user.name,
    lastnames: "",
    status: user.status === "activo",
    user_name: user.email,
    phone_number: "",
    id_rol: user.roleId ?? userRoleId(user.role),
    usa_serie_factura: false,
    serie_factura: "",
    comision_venta: 0,
  }
}

function roomIdFromNumber(roomNumber: string, state: State): ApiId | null {
  return state.rooms.find((room) => room.number === roomNumber)?.id ?? null
}

function roomTypeBackendId(typeId: string, state: State) {
  const numeric = numericId(typeId)
  if (numeric) return numeric

  const type = state.roomTypes.find((item) => item.id === typeId)
  const normalized = normalize(type?.name ?? typeId)
  if (normalized.includes("estandar") || normalized.includes("standard")) return 1
  if (normalized.includes("jr") || normalized.includes("junior")) return 2
  return null
}

function roomTypeId(id: ApiId | null, name: string) {
  const normalized = normalize(name)
  if (normalized.includes("estandar") || normalized.includes("est") || normalized.includes("standard")) return "rt-est"
  if (normalized.includes("jr") || normalized.includes("junior")) return "rt-jr"
  if (id) return `rt-${id}`
  return `rt-${slug(name)}`
}

function numericId(value: ApiId | null | undefined) {
  if (value === null || value === undefined || value === "") return null
  const text = String(value)
  if (/^\d+$/.test(text)) return Number(text)
  const match = text.match(/^rt-(\d+)$/)
  if (match) return Number(match[1])
  const reservationRoomMatch = text.match(/^(\d+)-\d+$/)
  return reservationRoomMatch ? Number(reservationRoomMatch[1]) : null
}

function reservationNumericId(value: ApiId | null | undefined) {
  return numericId(value)
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.data)) return value.data
  return []
}

function toRecord(value: unknown): ApiRecord {
  return isRecord(value) ? value : {}
}

function toNumberArray(value: unknown): number[] {
  return toArray(value)
    .map((item) => {
      if (typeof item === "number") return item
      if (typeof item === "string" && Number.isFinite(Number(item))) return Number(item)
      const record = toRecord(item)
      return pickNumber(record, ["people_count", "peopleCount", "value", "count"], 0)
    })
    .filter((item) => item > 0)
    .sort((a, b) => a - b)
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pickId(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" || typeof value === "string") return value
  }
  return null
}

function pickString(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function pickOptionalString(record: ApiRecord, keys: string[]) {
  const value = pickString(record, keys, "")
  return value || undefined
}

function pickNumber(record: ApiRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return fallback
}

function pickOptionalNumber(record: ApiRecord, keys: string[]) {
  const value = pickNumber(record, keys, Number.NaN)
  return Number.isFinite(value) ? value : undefined
}

function pickBoolean(record: ApiRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      if (["true", "1", "activo", "active"].includes(normalize(value))) return true
      if (["false", "0", "inactivo", "inactive"].includes(normalize(value))) return false
    }
  }
  return fallback
}

function pickStringArray(record: ApiRecord, keys: string[], fallback: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      const items = value.map((item) => String(item)).filter(Boolean)
      if (items.length) return items
    }
  }
  return fallback
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item"
}

function dateOnly(value: string) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function timeOnly(value: string) {
  if (!value) return "00:00"
  return value.slice(0, 5)
}

function cryptoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
  return Math.max(diff || 1, 1)
}

function paymentTotal(payments: PaymentRecord[]) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0)
}

function mapRoomStatus(status: string): RoomStatus {
  const value = normalize(status)
  if (value.includes("ready") || value.includes("checkin") || value.includes("check-in") || value.includes("lista")) return "ready-for-check-in"
  if (value.includes("ocup")) return "ocupada"
  if (value.includes("reserv")) return "reservada"
  if (value.includes("limp") || value.includes("clean")) return "limpieza"
  if (value.includes("mant") || value.includes("block")) return "mantenimiento"
  return "disponible"
}

function roomStatusPayload(status: RoomStatus) {
  const statuses: Record<RoomStatus, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    "ready-for-check-in": "ListaParaCheckIn",
    limpieza: "Limpieza",
    mantenimiento: "Mantenimiento",
  }

  return statuses[status]
}

function mapReservationStatus(
  status: string,
  record: ApiRecord = {},
  roomRecord: ApiRecord = {},
): ReservationStatus {
  const value = normalize(status)
  const currentStayStatus = normalize(
    pickString(record, ["current_stay_status", "currentStayStatus"], ""),
  )
  const currentStayId = pickId(record, [
    "id_current_stay",
    "idCurrentStay",
    "current_stay_id",
    "currentStayId",
  ])
  const checkInAt = pickOptionalString(record, ["check_in_at", "checkInAt"])
  const checkOutAt = pickOptionalString(record, ["check_out_at", "checkOutAt"])
  const roomStatus = normalize(pickString(roomRecord, ["status"], ""))
  const hasCompletedCheckIn =
    Boolean(checkInAt) ||
    (Boolean(currentStayId) &&
      (currentStayStatus.includes("checkin") ||
        currentStayStatus.includes("check-in") ||
        currentStayStatus.includes("house") ||
        currentStayStatus.includes("ocup")))

  if (
    value.includes("checkout") ||
    value.includes("salida") ||
    currentStayStatus.includes("checkout") ||
    currentStayStatus.includes("salida") ||
    Boolean(checkOutAt)
  ) return "checkout"
  if (value.includes("cancel")) return "cancelada"
  if (value.includes("show")) return "no-show"
  if (
    value.includes("ready") ||
    value.includes("lista") ||
    value.includes("enviada") ||
    value.includes("send-to-check") ||
    value.includes("ready-for-check")
  ) return "ready-for-check-in"
  if (value.includes("checkin") || value.includes("check-in")) {
    return hasCompletedCheckIn ? "in-house" : "ready-for-check-in"
  }
  if (
    value.includes("house") ||
    value.includes("in-house") ||
    value.includes("ocup") ||
    (roomStatus.includes("checkin") && hasCompletedCheckIn)
  ) return "in-house"
  if (value.includes("confirm") || value.includes("reserv")) return "confirmada"
  return "pendiente"
}

function mapReservationBillingStatus(status: string): ReservationBillingStatus | undefined {
  const value = normalize(status)
  if (!value) return undefined
  if (value.includes("parcial") || value.includes("partial")) return "Parcial"
  if (value.includes("facturada") || value.includes("invoiced")) {
    if (value.includes("no")) return "NoFacturada"
    return "Facturada"
  }
  if (value.includes("nofacturada") || value.includes("notinvoiced")) return "NoFacturada"
  return undefined
}

function inferReservationBillingStatus(
  invoicedAmount: number | undefined,
  pendingToInvoiceAmount: number | undefined,
  lastInvoiceId?: string,
): ReservationBillingStatus {
  const invoiced = invoicedAmount ?? 0
  const pending = pendingToInvoiceAmount ?? 0

  if (invoiced <= 0 && !lastInvoiceId) return "NoFacturada"
  if (pending <= 0) return "Facturada"
  return "Parcial"
}

function mapReservationSource(source: string): ReservationSource {
  const value = normalize(source)
  if (value.includes("booking")) return "booking"
  if (value.includes("expedia")) return "expedia"
  if (value.includes("airbnb")) return "airbnb"
  if (value.includes("agencia")) return "agencia"
  if (value.includes("corp")) return "corporativo"
  return "directo"
}

function mapReservationRateType(rateType: string): ReservationRateType {
  const value = normalize(rateType)
  if (value.includes("corp")) return "corporativa"
  if (value.includes("manual")) return "manual"
  return "normal"
}

function reservationRateTypePayload(rateType: ReservationRateType) {
  const rateTypes: Record<ReservationRateType, string> = {
    normal: "Normal",
    corporativa: "Corporativa",
    manual: "Manual",
  }

  return rateTypes[rateType]
}

function mapPaymentMethod(method: string): PaymentMethod {
  const value = normalize(method)
  if (value.includes("tarj") || value.includes("card")) return "tarjeta"
  if (value.includes("trans")) return "transferencia"
  if (value.includes("dep")) return "deposito"
  if (value.includes("cred")) return "credito"
  return "efectivo"
}

function mapRedeemed(record: ApiRecord) {
  const status = normalize(pickString(record, ["status"], ""))
  return pickBoolean(record, ["redeemed", "is_redeemed"], false) ||
    status.includes("redeem") ||
    status.includes("canje")
}

function mapCreditStatus(status: string): CreditAccount["status"] {
  const value = normalize(status)
  if (value.includes("vencer")) return "por vencer"
  if (value.includes("venc")) return "vencido"
  return "al dia"
}

function mapCreditAccountStatus(status: string): CreditAccount["creditStatus"] {
  const value = normalize(status)
  if (value.includes("paus")) return "pausado"
  if (value.includes("bloq")) return "bloqueado"
  if (value.includes("autor")) return "autorizado"
  return "activo"
}

function mapAuthorizationStatus(status: string): CreditAuthorizationRequest["status"] {
  const value = normalize(status)
  if (value.includes("apro")) return "aprobada"
  if (value.includes("rech")) return "rechazada"
  return "pendiente"
}

function mapShift(shift: string): CashClose["shift"] {
  const value = normalize(shift)
  if (value.includes("ves") || value.includes("tarde")) return "vespertino"
  if (value.includes("noc") || value.includes("noche")) return "nocturno"
  return "matutino"
}

function mapEventType(type: string): HotelEvent["type"] {
  const value = normalize(type)
  if (value.includes("cons")) return "consumo"
  if (value.includes("cowork")) return "coworking"
  return "alquiler"
}

function mapEventStatus(status: string): HotelEvent["status"] {
  const value = normalize(status)
  if (value.includes("confirm")) return "confirmado"
  if (value.includes("real") || value.includes("complete") || value.includes("final")) return "realizado"
  if (value.includes("cancel")) return "cancelado"
  return "reservado"
}

function mapMaintenanceType(type: string): MaintenanceTicket["type"] {
  const value = normalize(type)
  if (value.includes("elect")) return "electrico"
  if (value.includes("plom")) return "plomeria"
  if (value.includes("ac") || value.includes("aire")) return "AC"
  if (value.includes("carp")) return "carpinteria"
  if (value.includes("limp")) return "limpieza"
  return "otro"
}

function mapMaintenancePriority(priority: string): MaintenancePriority {
  const value = normalize(priority)
  if (value.includes("baja") || value.includes("low")) return "baja"
  if (value.includes("alta") || value.includes("high")) return "alta"
  if (value.includes("urg")) return "urgente"
  return "media"
}

function maintenancePriorityPayload(priority: MaintenancePriority) {
  const priorities: Record<MaintenancePriority, string> = {
    baja: "Baja",
    media: "Media",
    alta: "Alta",
    urgente: "Urgente",
  }

  return priorities[priority]
}

function mapMaintenanceStatus(status: string): MaintenanceStatus {
  const value = normalize(status)
  if (value.includes("progreso") || value.includes("progress")) return "en progreso"
  if (value.includes("res")) return "resuelto"
  if (value.includes("cancel")) return "cancelado"
  return "abierto"
}

function mapInventoryCategory(category: string): InventoryCategory {
  const value = normalize(category)
  if (value.includes("blanco") || value.includes("linen") || value.includes("lino")) {
    return "blanco"
  }
  if (value.includes("sumin") || value.includes("supply") || value.includes("limpieza")) {
    return "suministro"
  }
  return "snack"
}

function mapInventoryMovementType(type: string): InventoryMovement["type"] {
  const value = normalize(type)
  if (value === "in" || value.includes("entrada") || value.includes("compra")) {
    return "entrada"
  }
  if (value.includes("consumo") || value.includes("minibar")) return "consumo"
  if (value === "out" || value.includes("salida")) return "salida"
  return "ajuste"
}

function inventoryMovementTypePayload(type: InventoryMovement["type"]) {
  const movementTypes: Record<InventoryMovement["type"], string> = {
    entrada: "In",
    salida: "Out",
    ajuste: "Adjustment",
    consumo: "Out",
  }

  return movementTypes[type]
}

function mapUserRole(role: string): UserRole {
  const value = normalize(role)
  if (value.includes("ger")) return "gerencia"
  if (value.includes("admin")) return "administrador"
  if (value.includes("invent")) return "inventario"
  if (value.includes("conta")) return "contabilidad"
  if (value.includes("mant")) return "mantenimiento"
  if (value.includes("camar")) return "camarera"
  return "recepcion"
}

function mapUserRoleById(roleId?: number): UserRole | undefined {
  if (roleId === undefined) return undefined

  const roleIds: Record<number, UserRole> = {
    1: "gerencia",
    2: "administrador",
    3: "inventario",
    4: "contabilidad",
    5: "mantenimiento",
    6: "camarera",
    7: "recepcion",
  }

  return roleIds[roleId]
}

function userRoleId(role: UserRole) {
  const roleIds: Record<UserRole, number> = {
    gerencia: 1,
    administrador: 2,
    inventario: 3,
    contabilidad: 4,
    recepcion: 7,
    mantenimiento: 5,
    camarera: 6,
  }

  return roleIds[role]
}
