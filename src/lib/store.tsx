"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import { setLatestExportState } from "./export-state"
import { loadApiState, syncActionWithApi } from "./api-store"
import type {
  Advance,
  AppUser,
  BreakfastOption,
  BreakfastVoucher,
  CashClose,
  CreditAccount,
  CreditAuthorizationRequest,
  CreditMovement,
  EventSalon,
  Guest,
  HousekeepingTask,
  HotelEvent,
  InventoryItem,
  InventoryMovement,
  Invoice,
  MaintenanceTicket,
  PaymentRecord,
  Reservation,
  Room,
  RoomStatus,
  RoomType,
} from "./types"

export type BackendResource =
  | "roomTypes"
  | "rooms"
  | "roomRateOptions"
  | "guests"
  | "reservations"
  | "breakfastOptions"
  | "breakfasts"
  | "creditAccounts"
  | "creditMovements"
  | "creditAuthorizationRequests"
  | "cashShiftConfigs"
  | "cashCloses"
  | "salons"
  | "events"
  | "maintenance"
  | "inventory"
  | "inventoryMovements"
  | "roles"
  | "menuRoles"
  | "users"

export type BackendSourceState = "connected" | "empty" | "unauthorized"

export type BackendSources = Record<BackendResource, BackendSourceState>
type CashCloseTotals = Partial<Pick<CashClose, "cash" | "card" | "transfer" | "deposit" | "other" | "expected">>
type RefreshApiStateOptions = {
  force?: boolean
}

const RESOURCE_REFRESH_TTL_MS: Record<BackendResource, number> = {
  rooms: 30_000,
  reservations: 30_000,
  guests: 30_000,
  creditAccounts: 30_000,
  creditAuthorizationRequests: 30_000,
  cashCloses: 30_000,
  breakfasts: 30_000,
  events: 30_000,
  maintenance: 45_000,
  inventory: 45_000,
  creditMovements: 120_000,
  inventoryMovements: 120_000,
  cashShiftConfigs: 300_000,
  roomTypes: 300_000,
  roomRateOptions: 300_000,
  breakfastOptions: 300_000,
  salons: 300_000,
  roles: 300_000,
  menuRoles: 300_000,
  users: 300_000,
}

export interface State {
  rooms: Room[]
  roomTypes: RoomType[]
  guests: Guest[]
  reservations: Reservation[]
  advances: Advance[]
  creditAccounts: CreditAccount[]
  creditAuthorizationRequests: CreditAuthorizationRequest[]
  creditMovements: CreditMovement[]
  cashCloses: CashClose[]
  breakfasts: BreakfastVoucher[]
  breakfastOptions: BreakfastOption[]
  salons: EventSalon[]
  events: HotelEvent[]
  maintenance: MaintenanceTicket[]
  housekeepingTasks: HousekeepingTask[]
  inventory: InventoryItem[]
  inventoryMovements: InventoryMovement[]
  invoices: Invoice[]
  users: AppUser[]
  apiSources: BackendSources
}

export type Action =
  | { type: "HYDRATE_FROM_API"; patch: Partial<State> }
  | { type: "API_SOURCE_UPDATE"; resource: BackendResource; source: BackendSourceState }
  | { type: "ROOM_STATUS"; roomId: string; status: RoomStatus }
  | { type: "ROOM_CREATE"; room: Room }
  | { type: "ROOM_ADOPT_BACKEND_ID"; temporaryId: string; backendId: string }
  | { type: "ROOM_UPDATE"; id: string; patch: Partial<Room> }
  | { type: "RES_CREATE"; reservation: Reservation; guest?: Guest }
  | { type: "RES_UPDATE"; id: string; patch: Partial<Reservation> }
  | { type: "RES_SEND_TO_CHECKIN"; id: string }
  | { type: "RES_CANCEL"; id: string; reason?: string }
  | { type: "GUEST_CREATE"; guest: Guest }
  | { type: "GUEST_UPDATE"; id: string; patch: Partial<Guest> }
  | { type: "GUEST_DELETE"; id: string }
  | { type: "GUEST_TOGGLE_FREQUENT"; id: string }
  | { type: "ADVANCE_CREATE"; advance: Advance }
  | { type: "CREDIT_ACCOUNT_CREATE"; account: CreditAccount }
  | { type: "CREDIT_ACCOUNT_UPDATE"; id: string; patch: Partial<CreditAccount> }
  | { type: "CREDIT_ACCOUNT_DELETE"; id: string }
  | {
      type: "CREDIT_ACCOUNT_STATUS"
      accountId: string
      creditStatus: NonNullable<CreditAccount["creditStatus"]>
      authorizationNote?: string
    }
  | { type: "CREDIT_AUTH_REQUEST_CREATE"; request: CreditAuthorizationRequest }
  | {
      type: "CREDIT_AUTH_REQUEST_RESOLVE"
      id: string
      status: "aprobada" | "rechazada"
      notes?: string
    }
  | { type: "CREDIT_PAYMENT"; accountId: string; amount: number; reference: string }
  | { type: "CASH_OPEN"; close: CashClose }
  | {
      type: "CASH_CLOSE"
      id: string
      counted: number
      totals?: CashCloseTotals
    }
  | { type: "BREAKFAST_REDEEM"; id: string }
  | { type: "BREAKFAST_CREATE"; voucher: BreakfastVoucher }
  | { type: "BREAKFAST_OPTION_CREATE"; option: BreakfastOption }
  | { type: "BREAKFAST_OPTION_UPDATE"; id: string; patch: Partial<BreakfastOption> }
  | { type: "BREAKFAST_OPTION_DELETE"; id: string }
  | { type: "SALON_CREATE"; salon: EventSalon }
  | { type: "SALON_UPDATE"; id: string; patch: Partial<EventSalon> }
  | { type: "SALON_DELETE"; id: string }
  | { type: "EVENT_CREATE"; event: HotelEvent }
  | { type: "EVENT_UPDATE"; id: string; patch: Partial<HotelEvent> }
  | { type: "EVENT_CANCEL"; id: string }
  | { type: "MTO_CREATE"; ticket: MaintenanceTicket }
  | { type: "MTO_UPDATE"; id: string; patch: Partial<MaintenanceTicket> }
  | { type: "HK_CREATE"; task: HousekeepingTask }
  | { type: "HK_UPDATE"; id: string; patch: Partial<HousekeepingTask> }
  | { type: "INV_MOVEMENT"; movement: InventoryMovement }
  | { type: "INV_ITEM_CREATE"; item: InventoryItem }
  | { type: "INV_ITEM_UPDATE"; id: string; patch: Partial<InventoryItem> }
  | { type: "INV_ITEM_DELETE"; id: string }
  | { type: "INVOICE_CREATE"; invoice: Invoice }
  | { type: "INVOICE_VOID"; id: string }
  | { type: "USER_CREATE"; user: AppUser }
  | { type: "USER_UPDATE"; id: string; patch: Partial<AppUser> }
  | { type: "USER_TOGGLE"; id: string }

const initialState: State = {
  rooms: [],
  roomTypes: [],
  guests: [],
  reservations: [],
  advances: [],
  creditAccounts: [],
  creditAuthorizationRequests: [],
  creditMovements: [],
  cashCloses: [],
  breakfasts: [],
  breakfastOptions: [],
  salons: [],
  events: [],
  maintenance: [],
  housekeepingTasks: [],
  inventory: [],
  inventoryMovements: [],
  invoices: [],
  users: [],
  apiSources: {
    roomTypes: "empty",
    rooms: "empty",
    roomRateOptions: "empty",
    guests: "empty",
    reservations: "empty",
    breakfastOptions: "empty",
    breakfasts: "empty",
    creditAccounts: "empty",
    creditMovements: "empty",
    creditAuthorizationRequests: "empty",
    cashShiftConfigs: "empty",
    cashCloses: "empty",
    salons: "empty",
    events: "empty",
    maintenance: "empty",
    inventory: "empty",
    inventoryMovements: "empty",
    roles: "empty",
    menuRoles: "empty",
    users: "empty",
  },
}

function setRoom(rooms: Room[], id: string, status: RoomStatus): Room[] {
  return rooms.map((r) => (r.id === id ? { ...r, status } : r))
}

function mergeHydratedRooms(currentRooms: Room[], nextRooms: Room[]): Room[] {
  return nextRooms.map((room) => {
    const currentRoom = currentRooms.find(
      (item) => item.id === room.id || item.number === room.number,
    )

    return {
      ...room,
      occupancyOptions: room.occupancyOptions?.length
        ? room.occupancyOptions
        : currentRoom?.occupancyOptions,
      rateOptions: room.rateOptions?.length ? room.rateOptions : currentRoom?.rateOptions,
      specificRates: room.specificRates?.length
        ? room.specificRates
        : currentRoom?.specificRates,
      maxOccupancy: room.maxOccupancy ?? currentRoom?.maxOccupancy,
    }
  })
}

function closeCashShift(
  close: CashClose,
  counted: number,
  totals: CashCloseTotals | undefined,
): CashClose {
  const next = { ...close, ...totals }
  const expected =
    totals?.expected ?? next.cash + next.card + next.transfer + next.deposit + next.other - next.expenses

  return {
    ...next,
    expected,
    status: "cerrado",
    closedAt: new Date().toISOString(),
    counted,
    difference: counted - expected,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE_FROM_API": {
      const patch = action.patch.rooms
        ? {
            ...action.patch,
            rooms: mergeHydratedRooms(state.rooms, action.patch.rooms),
          }
        : action.patch

      return {
        ...state,
        ...patch,
        apiSources: {
          ...state.apiSources,
          ...(patch.apiSources ?? {}),
        },
      }
    }

    case "API_SOURCE_UPDATE":
      return {
        ...state,
        apiSources: {
          ...state.apiSources,
          [action.resource]: action.source,
        },
      }

    case "ROOM_STATUS":
      return { ...state, rooms: setRoom(state.rooms, action.roomId, action.status) }

    case "ROOM_CREATE":
      return { ...state, rooms: [action.room, ...state.rooms] }

    case "ROOM_ADOPT_BACKEND_ID":
      if (action.temporaryId === action.backendId) return state

      return {
        ...state,
        rooms: state.rooms.map((room) =>
          room.id === action.temporaryId ? { ...room, id: action.backendId } : room,
        ),
        reservations: state.reservations.map((reservation) =>
          reservation.roomId === action.temporaryId
            ? { ...reservation, roomId: action.backendId }
            : reservation,
        ),
        housekeepingTasks: state.housekeepingTasks.map((task) =>
          task.roomId === action.temporaryId ? { ...task, roomId: action.backendId } : task,
        ),
      }

    case "ROOM_UPDATE":
      return {
        ...state,
        rooms: state.rooms.map((room) =>
          room.id === action.id ? { ...room, ...action.patch } : room,
        ),
      }

    case "RES_CREATE": {
      const guests = action.guest ? [...state.guests, action.guest] : state.guests
      return {
        ...state,
        guests,
        reservations: [action.reservation, ...state.reservations],
        rooms: setRoom(state.rooms, action.reservation.roomId, "reservada"),
      }
    }

    case "RES_UPDATE":
      return {
        ...state,
        reservations: state.reservations.map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      }

    case "RES_SEND_TO_CHECKIN": {
      const res = state.reservations.find((r) => r.id === action.id)
      const rooms = res ? setRoom(state.rooms, res.roomId, "ready-for-check-in") : state.rooms
      return {
        ...state,
        reservations: state.reservations.map((r) =>
          r.id === action.id ? { ...r, status: "ready-for-check-in" } : r,
        ),
        rooms,
      }
    }

    case "RES_CANCEL": {
      const res = state.reservations.find((r) => r.id === action.id)
      const rooms = res ? setRoom(state.rooms, res.roomId, "disponible") : state.rooms
      return {
        ...state,
        reservations: state.reservations.map((r) =>
          r.id === action.id ? { ...r, status: "cancelada" } : r,
        ),
        rooms,
      }
    }

    case "GUEST_CREATE":
      return { ...state, guests: [action.guest, ...state.guests] }

    case "GUEST_UPDATE":
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.id ? { ...guest, ...action.patch } : guest,
        ),
      }

    case "GUEST_DELETE": {
      const guestCreditAccountIds = new Set(
        state.creditAccounts
          .filter((account) => account.guestId === action.id)
          .map((account) => account.id),
      )
      return {
        ...state,
        guests: state.guests.filter((guest) => guest.id !== action.id),
        reservations: state.reservations.filter((res) => res.guestId !== action.id),
        creditAccounts: state.creditAccounts.filter(
          (account) => account.guestId !== action.id,
        ),
        creditMovements: state.creditMovements.filter(
          (movement) => !guestCreditAccountIds.has(movement.accountId),
        ),
        creditAuthorizationRequests: state.creditAuthorizationRequests.filter(
          (request) => !guestCreditAccountIds.has(request.accountId),
        ),
      }
    }

    case "GUEST_TOGGLE_FREQUENT":
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.id ? { ...guest, vip: !guest.vip } : guest,
        ),
      }

    case "ADVANCE_CREATE":
      return {
        ...state,
        advances: [action.advance, ...state.advances],
        reservations: state.reservations.map((r) =>
          r.id === action.advance.reservationId
            ? {
                ...r,
                paid: r.paid + action.advance.amount,
                payments: [
                  ...(r.payments ?? []),
                  {
                    id: `pay-${action.advance.id}`,
                    method: action.advance.method,
                    amount: action.advance.amount,
                    reference: action.advance.notes ?? action.advance.receivedBy,
                    stage: "reserva",
                    date: action.advance.date,
                  },
                ],
              }
            : r,
        ),
      }

    case "CREDIT_ACCOUNT_CREATE":
      return { ...state, creditAccounts: [action.account, ...state.creditAccounts] }

    case "CREDIT_ACCOUNT_UPDATE":
      return {
        ...state,
        creditAccounts: state.creditAccounts.map((account) =>
          account.id === action.id ? { ...account, ...action.patch } : account,
        ),
      }

    case "CREDIT_ACCOUNT_DELETE":
      return {
        ...state,
        creditAccounts: state.creditAccounts.filter((account) => account.id !== action.id),
        creditMovements: state.creditMovements.filter((movement) => movement.accountId !== action.id),
        creditAuthorizationRequests: state.creditAuthorizationRequests.filter(
          (request) => request.accountId !== action.id,
        ),
      }

    case "CREDIT_ACCOUNT_STATUS":
      return {
        ...state,
        creditAccounts: state.creditAccounts.map((account) =>
          account.id === action.accountId
            ? {
                ...account,
                creditStatus: action.creditStatus,
                authorizationNote:
                  action.creditStatus === "autorizado" || action.creditStatus === "bloqueado"
                    ? action.authorizationNote
                    : undefined,
              }
            : account,
        ),
      }

    case "CREDIT_AUTH_REQUEST_CREATE":
      return {
        ...state,
        creditAuthorizationRequests: [
          action.request,
          ...state.creditAuthorizationRequests,
        ],
      }

    case "CREDIT_AUTH_REQUEST_RESOLVE":
      return {
        ...state,
        creditAuthorizationRequests: state.creditAuthorizationRequests.map(
          (request) =>
            request.id === action.id
              ? {
                  ...request,
                  status: action.status,
                  resolvedAt: new Date().toISOString().slice(0, 10),
                  resolvedBy: "Admin",
                  notes: action.notes,
                }
              : request,
        ),
        creditAccounts:
          action.status === "aprobada"
            ? state.creditAccounts.map((account) => {
                const request = state.creditAuthorizationRequests.find(
                  (item) => item.id === action.id,
                )
                return request?.accountId === account.id
                  ? {
                      ...account,
                      creditStatus: "autorizado",
                      authorizationNote:
                        action.notes || "Autorizado por administración.",
                    }
                  : account
              })
            : state.creditAccounts,
      }

    case "CREDIT_PAYMENT": {
      const movement: CreditMovement = {
        id: `cm-${Date.now()}`,
        accountId: action.accountId,
        date: new Date().toISOString().slice(0, 10),
        concept: "Pago recibido",
        charge: 0,
        payment: action.amount,
        reference: action.reference,
      }
      return {
        ...state,
        creditMovements: [movement, ...state.creditMovements],
        creditAccounts: state.creditAccounts.map((a) =>
          a.id === action.accountId
            ? {
                ...a,
                balance: Math.max(0, a.balance - action.amount),
                status: a.balance - action.amount <= 0 ? "al dia" : a.status,
                creditStatus:
                  a.balance - action.amount <= 0 && a.creditStatus !== "bloqueado"
                    ? "activo"
                    : a.creditStatus,
                authorizationNote:
                  a.balance - action.amount <= 0 && a.creditStatus !== "bloqueado"
                    ? undefined
                    : a.authorizationNote,
              }
            : a,
        ),
      }
    }

    case "CASH_OPEN":
      return { ...state, cashCloses: [action.close, ...state.cashCloses] }

    case "CASH_CLOSE":
      return {
        ...state,
        cashCloses: state.cashCloses.map((c) =>
          c.id === action.id
            ? closeCashShift(c, action.counted, action.totals)
            : c,
        ),
      }

    case "BREAKFAST_REDEEM":
      return {
        ...state,
        breakfasts: state.breakfasts.map((b) =>
          b.id === action.id
            ? {
                ...b,
                redeemed: true,
                redeemedAt: new Date().toLocaleTimeString("es-GT", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : b,
        ),
      }

    case "BREAKFAST_CREATE":
      return { ...state, breakfasts: [action.voucher, ...state.breakfasts] }

    case "BREAKFAST_OPTION_CREATE":
      return {
        ...state,
        breakfastOptions: [action.option, ...state.breakfastOptions],
      }

    case "BREAKFAST_OPTION_UPDATE":
      return {
        ...state,
        breakfastOptions: state.breakfastOptions.map((option) =>
          option.id === action.id ? { ...option, ...action.patch } : option,
        ),
      }

    case "BREAKFAST_OPTION_DELETE":
      return {
        ...state,
        breakfastOptions: state.breakfastOptions.filter(
          (option) => option.id !== action.id,
        ),
      }

    case "SALON_CREATE":
      return { ...state, salons: [action.salon, ...state.salons] }

    case "SALON_UPDATE": {
      const previous = state.salons.find((salon) => salon.id === action.id)
      const nextName = action.patch.name
      return {
        ...state,
        salons: state.salons.map((salon) =>
          salon.id === action.id ? { ...salon, ...action.patch } : salon,
        ),
        events:
          previous && nextName
            ? state.events.map((event) =>
                event.salonId === action.id
                  ? { ...event, salon: nextName }
                  : event,
              )
            : state.events,
      }
    }

    case "SALON_DELETE":
      return {
        ...state,
        salons: state.salons.filter((salon) => salon.id !== action.id),
      }

    case "EVENT_CREATE":
      return { ...state, events: [action.event, ...state.events] }

    case "EVENT_UPDATE":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      }

    case "EVENT_CANCEL":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, status: "cancelado" } : e,
        ),
      }

    case "MTO_CREATE":
      return { ...state, maintenance: [action.ticket, ...state.maintenance] }

    case "MTO_UPDATE":
      return {
        ...state,
        maintenance: state.maintenance.map((t) =>
          t.id === action.id ? { ...t, ...action.patch } : t,
        ),
      }

    case "HK_CREATE":
      return { ...state, housekeepingTasks: [action.task, ...state.housekeepingTasks] }

    case "HK_UPDATE":
      return {
        ...state,
        housekeepingTasks: state.housekeepingTasks.map((task) =>
          task.id === action.id ? { ...task, ...action.patch } : task,
        ),
      }

    case "INV_MOVEMENT": {
      const m = action.movement
      const delta =
        m.type === "entrada" ? m.qty : m.type === "ajuste" ? m.qty : -Math.abs(m.qty)
      return {
        ...state,
        inventoryMovements: [m, ...state.inventoryMovements],
        inventory: state.inventory.map((i) =>
          i.id === m.itemId ? { ...i, stock: Math.max(0, i.stock + delta) } : i,
        ),
      }
    }

    case "INV_ITEM_CREATE":
      return { ...state, inventory: [action.item, ...state.inventory] }

    case "INV_ITEM_UPDATE":
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      }

    case "INV_ITEM_DELETE":
      return {
        ...state,
        inventory: state.inventory.filter((item) => item.id !== action.id),
      }

    case "INVOICE_CREATE":
      return { ...state, invoices: [action.invoice, ...state.invoices] }

    case "INVOICE_VOID":
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.id ? { ...i, status: "anulada" } : i,
        ),
      }

    case "USER_CREATE":
      return { ...state, users: [action.user, ...state.users] }

    case "USER_UPDATE":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.id ? { ...u, ...action.patch } : u,
        ),
      }

    case "USER_TOGGLE":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.id
            ? { ...u, status: u.status === "activo" ? "inactivo" : "activo" }
            : u,
        ),
      }

    default:
      return state
  }
}

interface StoreContextValue extends State {
  dispatch: React.Dispatch<Action>
  refreshApiState: (resources?: BackendResource[], options?: RefreshApiStateOptions) => Promise<void>
  // Helpers
  getRoom: (id: string) => Room | undefined
  getRoomType: (id: string) => RoomType | undefined
  getGuest: (id: string) => Guest | undefined
  getReservation: (id: string) => Reservation | undefined
  isRoomAvailable: (roomId: string, checkIn: string, checkOut: string, excludeRes?: string) => boolean
  availableRoomsFor: (checkIn: string, checkOut: string, typeId?: string) => Room[]
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({
  children,
  apiEnabled = false,
}: {
  children: ReactNode
  apiEnabled?: boolean
}) {
  const [state, baseDispatch] = useReducer(reducer, initialState)
  const lastApiRefreshAt = useRef<Partial<Record<BackendResource, number>>>({})
  const inFlightApiResources = useRef(new Set<BackendResource>())

  const refreshApiState = useCallback(async (
    resources?: BackendResource[],
    options: RefreshApiStateOptions = {},
  ) => {
    if (!apiEnabled) return

    const force = options.force ?? true
    const now = Date.now()
    const requestedResources = resources ? Array.from(new Set(resources)) : undefined
    const resourcesToLoad = requestedResources?.filter((resource) => {
      if (force) return true
      if (inFlightApiResources.current.has(resource)) return false

      const lastLoadedAt = lastApiRefreshAt.current[resource] ?? 0
      return now - lastLoadedAt >= RESOURCE_REFRESH_TTL_MS[resource]
    })

    if (requestedResources && resourcesToLoad?.length === 0) return

    resourcesToLoad?.forEach((resource) => {
      inFlightApiResources.current.add(resource)
    })

    const loadedResources = resourcesToLoad ?? requestedResources

    try {
      const patch = await loadApiState(resourcesToLoad ?? resources)

      loadedResources?.forEach((resource) => {
        lastApiRefreshAt.current[resource] = Date.now()
      })

      if (Object.keys(patch).length > 0) {
        baseDispatch({ type: "HYDRATE_FROM_API", patch })
      }
    } finally {
      loadedResources?.forEach((resource) => {
        inFlightApiResources.current.delete(resource)
      })
    }
  }, [apiEnabled])

  useEffect(() => {
    setLatestExportState(state)
  }, [state])

  useEffect(() => {
    if (!apiEnabled) return

    let cancelled = false
    const securityResources: BackendResource[] = ["users", "roles", "menuRoles"]

    securityResources.forEach((resource) => {
      inFlightApiResources.current.add(resource)
    })

    loadApiState(securityResources)
      .then((patch) => {
        if (!cancelled && Object.keys(patch).length > 0) {
          securityResources.forEach((resource) => {
            lastApiRefreshAt.current[resource] = Date.now()
          })
          baseDispatch({ type: "HYDRATE_FROM_API", patch })
        }
      })
      .finally(() => {
        securityResources.forEach((resource) => {
          inFlightApiResources.current.delete(resource)
        })
      })

    return () => {
      cancelled = true
    }
  }, [apiEnabled])

  const dispatch = useCallback<React.Dispatch<Action>>(
    (action) => {
      baseDispatch(action)

      if (
        apiEnabled &&
        action.type !== "HYDRATE_FROM_API" &&
        action.type !== "ROOM_ADOPT_BACKEND_ID"
      ) {
        void syncActionWithApi(action, state).then((result) => {
          const resource = Array.isArray(result) || typeof result === "string" ? result : result?.resource
          const followUpAction =
            !Array.isArray(result) && typeof result !== "string" ? result?.action : undefined
          const resources = Array.isArray(resource) ? resource : resource ? [resource] : []

          if (followUpAction) {
            baseDispatch(followUpAction)
          }

          resources.forEach((item) => {
            baseDispatch({
              type: "API_SOURCE_UPDATE",
              resource: item,
              source: "connected",
            })
          })

          if (resources.length > 0) {
            void loadApiState(resources).then((patch) => {
              resources.forEach((resource) => {
                lastApiRefreshAt.current[resource] = Date.now()
              })
              if (Object.keys(patch).length > 0) {
                baseDispatch({ type: "HYDRATE_FROM_API", patch })
              }
            })
          }
        }).catch((error) => {
          console.error("No se pudo sincronizar la acción con el backend", error)
          void loadApiState().then((patch) => {
            if (Object.keys(patch).length > 0) {
              baseDispatch({ type: "HYDRATE_FROM_API", patch })
            }
          })
        })
      }
    },
    [apiEnabled, state],
  )

  const value = useMemo<StoreContextValue>(() => {
    const getRoom = (id: string) => state.rooms.find((r) => r.id === id)
    const getRoomType = (id: string) => state.roomTypes.find((t) => t.id === id)
    const getGuest = (id: string) => state.guests.find((g) => g.id === id)
    const getReservation = (id: string) => state.reservations.find((r) => r.id === id)

    const overlap = (aIn: string, aOut: string, bIn: string, bOut: string) =>
      aIn < bOut && bIn < aOut

    const isRoomAvailable = (
      roomId: string,
      checkIn: string,
      checkOut: string,
      excludeRes?: string,
    ) => {
      const room = getRoom(roomId)
      if (!room) return false
      if (room.status === "mantenimiento") return false
      const conflicts = state.reservations.some(
        (r) =>
          r.roomId === roomId &&
          r.id !== excludeRes &&
          (
            r.status === "confirmada" ||
            r.status === "ready-for-check-in" ||
            r.status === "in-house" ||
            r.status === "pendiente"
          ) &&
          overlap(r.checkIn, r.checkOut, checkIn, checkOut),
      )
      return !conflicts
    }

    const availableRoomsFor = (checkIn: string, checkOut: string, typeId?: string) =>
      state.rooms.filter(
        (r) =>
          (!typeId || r.typeId === typeId) &&
          isRoomAvailable(r.id, checkIn, checkOut),
      )

    return {
      ...state,
      dispatch,
      refreshApiState,
      getRoom,
      getRoomType,
      getGuest,
      getReservation,
      isRoomAvailable,
      availableRoomsFor,
    }
  }, [dispatch, refreshApiState, state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

// Utilidades de formato
export function formatQ(n: number) {
  const value = new Intl.NumberFormat("es-GT", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
  return `${n < 0 ? "-" : ""}Q. ${value}`
}

export function formatDate(iso: string) {
  if (!iso) return ""
  const datePart = iso.slice(0, 10)
  const d = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

export function formatDateShort(iso: string) {
  if (!iso) return ""
  const datePart = iso.slice(0, 10)
  const d = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "2-digit" }).format(d)
}
