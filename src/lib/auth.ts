import { clearApiToken, getApiToken, isJwtExpired, setApiToken } from "@/lib/api"
import type { NavSection } from "@/lib/navigation"
import type { AppUser, UserRole } from "@/lib/types"

export type Permission =
  | "*"
  | "dashboard"
  | "recepcion"
  | "facturacion"
  | "credito"
  | "desayunos"
  | "eventos"
  | "habitaciones"
  | "mantenimiento"
  | "inventarios"
  | "tarifas"
  | "creditos.admin"
  | "usuarios"
  | "auditoria"
  | "configuracion"

type AccessMode = "legacy" | "backend"

export interface SessionMenuPermission {
  id?: number
  route?: string
  key?: string
  canView: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

export interface LoginMenuContext {
  menuCatalog?: unknown
  roleMenus?: unknown
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: string[]
  roleId?: number
  accessMode: AccessMode
  menuIds: number[]
  menuRoutes: string[]
  menuPermissions: SessionMenuPermission[]
}

export const SESSION_STORAGE_KEY = "casa-luna-session"
const SESSION_USER_STORAGE_KEY = "casa-luna-session-user"

export const DEFAULT_ADMIN_SESSION: SessionUser = {
  id: "admin",
  name: "Maria Recinos",
  email: "admin@casaluna.gt",
  role: "gerencia",
  permissions: ["*"],
  accessMode: "legacy",
  menuIds: [],
  menuRoutes: [],
  menuPermissions: [],
}

const ROLE_LABELS: Record<UserRole, string> = {
  gerencia: "Gerencia general",
  administrador: "Administracion",
  inventario: "Inventario",
  contabilidad: "Contabilidad",
  recepcion: "Recepcion",
  mantenimiento: "Mantenimiento",
  camarera: "Camarera",
}

const ROLE_BY_ID: Record<number, UserRole> = {
  1: "gerencia",
  2: "administrador",
  3: "inventario",
  4: "contabilidad",
  5: "mantenimiento",
  6: "camarera",
  7: "recepcion",
}

const BACKEND_ADMIN_ROLE_IDS = new Set([2])

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  gerencia: ["*"],
  administrador: [
    "dashboard",
    "recepcion",
    "facturacion",
    "credito",
    "desayunos",
    "eventos",
    "habitaciones",
    "mantenimiento",
    "inventarios",
    "tarifas",
    "creditos.admin",
    "usuarios",
    "auditoria",
    "configuracion",
  ],
  recepcion: [
    "dashboard",
    "recepcion",
    "facturacion",
    "credito",
    "desayunos",
    "habitaciones",
  ],
  inventario: ["dashboard", "inventarios", "habitaciones"],
  contabilidad: ["dashboard", "facturacion", "credito"],
  mantenimiento: ["dashboard", "habitaciones", "mantenimiento"],
  camarera: ["dashboard", "habitaciones", "inventarios", "desayunos"],
}

const PATH_PERMISSIONS: Array<{ path: string; permissions: Permission[] }> = [
  { path: "/dashboard", permissions: ["dashboard"] },
  { path: "/reportes", permissions: ["dashboard", "facturacion"] },
  { path: "/recepcion/reservaciones", permissions: ["recepcion"] },
  { path: "/recepcion/clientes", permissions: ["recepcion"] },
  { path: "/recepcion/check-in", permissions: ["recepcion", "facturacion"] },
  { path: "/recepcion/estancias-activas", permissions: ["recepcion", "facturacion"] },
  { path: "/recepcion/credito", permissions: ["credito"] },
  { path: "/recepcion/cierres", permissions: ["recepcion", "facturacion"] },
  { path: "/desayunos", permissions: ["desayunos"] },
  { path: "/salones", permissions: ["eventos"] },
  { path: "/eventos", permissions: ["eventos"] },
  { path: "/habitaciones", permissions: ["habitaciones"] },
  { path: "/mantenimiento", permissions: ["mantenimiento"] },
  { path: "/inventarios/snacks", permissions: ["inventarios"] },
  { path: "/inventarios/blancos", permissions: ["inventarios"] },
  { path: "/inventarios/suministros", permissions: ["inventarios"] },
  { path: "/administracion/tarifas", permissions: ["tarifas"] },
  { path: "/administracion/creditos", permissions: ["creditos.admin"] },
  { path: "/administracion/facturacion", permissions: ["facturacion"] },
  { path: "/usuarios", permissions: ["usuarios"] },
  { path: "/administracion/auditoria", permissions: ["auditoria"] },
  { path: "/administracion/configuracion", permissions: ["configuracion"] },
  { path: "/administracion/configuracion/cierres-turno", permissions: ["configuracion"] },
]

const PERMISSION_ALIASES: Record<string, string[]> = {
  recepcion: ["reservas", "reservaciones", "checkin", "checkout"],
  inventarios: ["inventario"],
  "creditos.admin": ["creditos", "credito-admin"],
}

const ROUTE_BY_MENU_KEY: Record<string, string> = {
  dashboard: "/dashboard",
  centrodeoperaciones: "/dashboard",
  reportes: "/reportes",
  reportesdeutilidad: "/reportes",
  reservaciones: "/recepcion/reservaciones",
  reservas: "/recepcion/reservaciones",
  recepcionreservaciones: "/recepcion/reservaciones",
  clientes: "/recepcion/clientes",
  recepcionclientes: "/recepcion/clientes",
  checkin: "/recepcion/check-in",
  checkout: "/recepcion/check-in",
  checkincheckout: "/recepcion/check-in",
  checkincheckoutrecepcion: "/recepcion/check-in",
  estanciasactivas: "/recepcion/check-in",
  habitacionesocupadas: "/recepcion/check-in",
  huespedeshospedados: "/recepcion/check-in",
  facturacion: "/administracion/facturacion",
  facturacionfel: "/administracion/facturacion",
  historialfacturas: "/administracion/facturacion",
  historialdefacturas: "/administracion/facturacion",
  administracionfacturacion: "/administracion/facturacion",
  credito: "/recepcion/credito",
  creditos: "/recepcion/credito",
  clientesalcredito: "/recepcion/credito",
  cierres: "/recepcion/cierres",
  cierresdeturno: "/recepcion/cierres",
  desayunos: "/desayunos",
  desayunosqr: "/desayunos",
  salones: "/salones",
  salonesycoworking: "/salones",
  coworking: "/salones",
  eventos: "/eventos",
  habitaciones: "/habitaciones",
  habitacionesytarifas: "/habitaciones",
  mantenimiento: "/mantenimiento",
  snacks: "/inventarios/snacks",
  minibar: "/inventarios/snacks",
  snacksminibar: "/inventarios/snacks",
  blancos: "/inventarios/blancos",
  blancosymobiliario: "/inventarios/blancos",
  suministros: "/inventarios/suministros",
  tarifas: "/administracion/tarifas",
  controldecreditos: "/administracion/creditos",
  creditosadministracion: "/administracion/creditos",
  usuarios: "/usuarios",
  roles: "/usuarios",
  usuariosyroles: "/usuarios",
  auditoria: "/administracion/auditoria",
  configuracion: "/administracion/configuracion",
  configuraciondecierres: "/administracion/configuracion/cierres-turno",
  configuracioncierres: "/administracion/configuracion/cierres-turno",
  turnosdecierre: "/administracion/configuracion/cierres-turno",
  cierresdeturnoadmin: "/administracion/configuracion/cierres-turno",
}

const MENU_COLLECTION_KEYS = [
  "menu_permissions",
  "menuPermissions",
  "menu_permission",
  "menuPermission",
  "menus",
  "menu",
  "menu_roles",
  "menuRoles",
  "role_menus",
  "roleMenus",
  "permissions",
  "permisos",
  "access",
  "accesos",
]

const UNWRAP_KEYS = ["data", "user", "session", "result", "results", "payload"]

function storedSessionToken() {
  if (typeof window === "undefined") return null

  const session = window.localStorage.getItem(SESSION_STORAGE_KEY)
  const apiToken = getApiToken()

  if (apiToken) return apiToken
  if (session && session !== "admin") return session

  return null
}

export function clearStoredSession() {
  if (typeof window === "undefined") return

  clearApiToken()
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY)
}

export function hasValidStoredSession() {
  if (typeof window === "undefined") return false

  const session = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!session) return false
  if (session === "admin") {
    clearStoredSession()
    return false
  }

  const token = storedSessionToken()
  if (token && isJwtExpired(token)) {
    clearStoredSession()
    return false
  }

  if (token && !getApiToken()) {
    setApiToken(token)
  }

  return Boolean(token)
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null
  if (!hasValidStoredSession()) return null

  const stored = window.localStorage.getItem(SESSION_USER_STORAGE_KEY)
  if (stored) {
    try {
      return normalizeSessionUser(JSON.parse(stored))
    } catch {
      window.localStorage.removeItem(SESSION_USER_STORAGE_KEY)
    }
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY) ? DEFAULT_ADMIN_SESSION : null
}

export function setSessionUser(user: SessionUser) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(normalizeSessionUser(user)))
}

export function clearSessionUser() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY)
}

export function sessionUserFromAppUser(user: AppUser): SessionUser {
  return normalizeSessionUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    accessMode: "legacy",
  })
}

export function createSessionUserFromLogin(
  payload: unknown,
  username: string,
  menuContext: LoginMenuContext = {},
): SessionUser {
  const record = findUserRecord(payload)
  const roleId = pickNumber(record, ["id_rol", "idRol", "role_id", "roleId", "id_role"])
  const role = mapUserRoleById(roleId) ??
    mapUserRole(
      pickString(
        record,
        ["role", "name_rol", "rol_name", "rol_nombre", "rol", "roleName"],
        username === "admin" ? "administrador" : "recepcion",
      ),
    )
  const menuPermissions = pickMenuPermissions(payload, record, menuContext)

  return normalizeSessionUser({
    id: pickString(record, ["id_user", "id", "userId"], username),
    name: `${pickString(record, ["name", "fullName", "names", "user_name"], username)} ${pickString(record, ["lastnames", "lastName"], "")}`.trim(),
    email: pickString(record, ["email", "user_name", "username"], username),
    role,
    roleId,
    accessMode: "backend",
    permissions: pickPermissions(record),
    menuIds: menuPermissions.map((item) => item.id).filter(isNumber),
    menuRoutes: menuPermissions.map((item) => item.route).filter(isString),
    menuPermissions,
  })
}

export function normalizeSessionUser(user: Partial<SessionUser>): SessionUser {
  const role = user.role ?? mapUserRoleById(user.roleId) ?? "recepcion"
  const roleId = user.roleId
  const accessMode = user.accessMode ?? "legacy"
  const menuPermissions = normalizeStoredMenuPermissions(user.menuPermissions ?? [])
  const menuRoutes = uniqueStrings([
    ...(user.menuRoutes ?? []),
    ...menuPermissions.map((item) => item.route).filter(isString),
  ].map(normalizeRoute).filter(isString))
  const menuIds = uniqueNumbers([
    ...(user.menuIds ?? []),
    ...menuPermissions.map((item) => item.id).filter(isNumber),
  ])
  const backendAdmin = roleId !== undefined && BACKEND_ADMIN_ROLE_IDS.has(roleId)
  const basePermissions = accessMode === "legacy" ? ROLE_PERMISSIONS[role] : []
  const permissions = uniqueStrings([
    ...basePermissions,
    ...(backendAdmin ? ["*"] : []),
    ...(user.permissions ?? []),
  ].filter(Boolean))

  return {
    id: user.id || user.email || role,
    name: user.name || user.email || ROLE_LABELS[role],
    email: user.email || "",
    role,
    permissions,
    roleId,
    accessMode,
    menuIds,
    menuRoutes,
    menuPermissions,
  }
}

export function sessionUserNeedsMenuCatalog(user: SessionUser) {
  if (user.permissions.includes("*")) return false
  if (user.accessMode !== "backend") return false
  return user.menuRoutes.length === 0 || user.menuIds.length > user.menuRoutes.length
}

export function getUserRoleLabel(user: SessionUser) {
  return ROLE_LABELS[user.role]
}

export function getUserInitials(user: SessionUser) {
  const parts = user.name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]).join("")
  return (initials || user.email.slice(0, 2) || "CL").toUpperCase()
}

export function userHasPermission(user: SessionUser | null, permissions?: string[]) {
  if (!permissions?.length) return true
  if (!user) return false

  const granted = user.permissions.map(normalizePermission)
  if (granted.includes("*")) return true

  return permissions.some((permission) => {
    const required = normalizePermission(permission)
    const aliases = PERMISSION_ALIASES[required] ?? []

    return granted.some(
      (item) =>
        item === required ||
        aliases.includes(item) ||
        required.startsWith(`${item}.`) ||
        item.startsWith(`${required}.`),
    )
  })
}

export function canAccessPath(user: SessionUser | null, path: string) {
  if (path === "/" || path === "*") return true
  const normalizedPath = normalizeRoute(path)
  if (!normalizedPath) return false
  if (!user) return false
  if (user.permissions.map(normalizePermission).includes("*")) return true

  if (usesBackendMenuAccess(user)) {
    return user.menuRoutes.some((route) => pathMatchesRoute(normalizedPath, route))
  }

  const match = PATH_PERMISSIONS
    .filter((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]

  return match ? userHasPermission(user, match.permissions) : false
}

export function getDefaultPath(user: SessionUser | null) {
  const firstAllowed = PATH_PERMISSIONS.find((item) => canAccessPath(user, item.path))
  if (firstAllowed) return firstAllowed.path

  const firstKnownMenuRoute = user?.menuRoutes.find((route) =>
    PATH_PERMISSIONS.some((item) => route === item.path || item.path.startsWith(`${route}/`)),
  )

  return firstKnownMenuRoute ?? "/dashboard"
}

export function filterNavigationForUser(sections: NavSection[], user: SessionUser | null) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessPath(user, item.href)),
    }))
    .filter((section) => section.items.length > 0)
}

function usesBackendMenuAccess(user: SessionUser) {
  return user.accessMode === "backend" || user.menuRoutes.length > 0 || user.menuIds.length > 0
}

function pickMenuPermissions(
  payload: unknown,
  userRecord: Record<string, unknown>,
  menuContext: LoginMenuContext,
) {
  const catalog = buildMenuCatalog(payload, menuContext.menuCatalog, menuContext.roleMenus)
  const records = [
    ...collectMenuRecords(userRecord, false),
    ...collectMenuRecords(payload, false),
    ...collectMenuRecords(menuContext.roleMenus, true),
  ]

  return dedupeMenuPermissions(
    records
      .map((record) => normalizeMenuPermissionRecord(record, catalog))
      .filter((item): item is SessionMenuPermission => Boolean(item)),
  )
}

function buildMenuCatalog(...sources: unknown[]) {
  const catalog = new Map<number, { route?: string; key?: string }>()

  for (const source of sources) {
    for (const record of collectMenuRecords(source, true)) {
      const nested = pickNestedMenuRecord(record)
      const id = pickNumber(record, ["id_menu", "idMenu", "menu_id", "menuId", "id"]) ??
        pickNumber(nested, ["id_menu", "idMenu", "menu_id", "menuId", "id"])
      if (!isNumber(id)) continue

      const route = pickRoute(record) ?? pickRoute(nested)
      const key = pickMenuKey(record) || pickMenuKey(nested)
      catalog.set(id, {
        route: route ?? routeFromMenuKey(key),
        key,
      })
    }
  }

  return catalog
}

function collectMenuRecords(source: unknown, includeRootArray: boolean, depth = 0): Record<string, unknown>[] {
  if (source === undefined || source === null || depth > 6) return []

  if (Array.isArray(source)) {
    if (!includeRootArray) return []
    return source.flatMap((item) => {
      if (typeof item === "string") return [{ key: item }]
      if (typeof item === "number") return [{ id_menu: item }]
      const record = toRecord(item)
      return looksLikeMenuRecord(record)
        ? [record, ...collectNestedMenuRecords(record, depth + 1)]
        : collectMenuRecords(item, true, depth + 1)
    })
  }

  const record = toRecord(source)
  if (Object.keys(record).length === 0) return []

  return collectNestedMenuRecords(record, depth)
}

function collectNestedMenuRecords(record: Record<string, unknown>, depth: number) {
  const records: Record<string, unknown>[] = []

  for (const key of MENU_COLLECTION_KEYS) {
    if (!(key in record)) continue

    const value = record[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          records.push({ key: item })
          continue
        }
        if (typeof item === "number") {
          records.push({ id_menu: item })
          continue
        }

        const itemRecord = toRecord(item)
        if (looksLikeMenuRecord(itemRecord)) records.push(itemRecord)
        records.push(...collectMenuRecords(item, true, depth + 1))
      }
      continue
    }

    const valueRecord = toRecord(value)
    if (looksLikeMenuRecord(valueRecord)) records.push(valueRecord)
    records.push(...collectMenuRecords(value, true, depth + 1))
  }

  for (const key of UNWRAP_KEYS) {
    if (key in record) records.push(...collectMenuRecords(record[key], true, depth + 1))
  }

  return records
}

function normalizeMenuPermissionRecord(
  record: Record<string, unknown>,
  catalog: Map<number, { route?: string; key?: string }>,
): SessionMenuPermission | null {
  const nested = pickNestedMenuRecord(record)
  const idKeys = hasMenuAccessFlag(record)
    ? ["id_menu", "idMenu", "menu_id", "menuId", "id"]
    : ["id_menu", "idMenu", "menu_id", "menuId"]
  const id = pickNumber(record, idKeys) ??
    pickNumber(nested, ["id_menu", "idMenu", "menu_id", "menuId", "id"])
  const catalogEntry = isNumber(id) ? catalog.get(id) : undefined
  const key = pickMenuKey(record) || pickMenuKey(nested) || catalogEntry?.key
  const route = pickRoute(record) ?? pickRoute(nested) ?? catalogEntry?.route ?? routeFromMenuKey(key)
  const canView = pickOptionalBoolean(record, [
    "can_view",
    "canView",
    "permiso_read",
    "permiso_view",
    "permission_read",
    "view",
    "read",
    "ver",
    "is_visible",
    "visible",
  ])

  if (canView === false) return null
  if (!isNumber(id) && !route && !key) return null

  return {
    id,
    route,
    key,
    canView: true,
    canCreate: pickOptionalBoolean(record, ["can_create", "canCreate", "permiso_create", "permission_create", "create", "crear"]),
    canEdit: pickOptionalBoolean(record, ["can_edit", "canEdit", "permiso_update", "permiso_edit", "permission_update", "permission_edit", "edit", "update", "editar"]),
    canDelete: pickOptionalBoolean(record, ["can_delete", "canDelete", "permiso_delete", "permission_delete", "delete", "eliminar"]),
  }
}

function normalizeStoredMenuPermissions(items: SessionMenuPermission[]) {
  return dedupeMenuPermissions(
    items
      .map((item) => ({
        id: isNumber(item.id) ? item.id : undefined,
        route: normalizeRoute(item.route),
        key: item.key,
        canView: item.canView !== false,
        canCreate: item.canCreate,
        canEdit: item.canEdit,
        canDelete: item.canDelete,
      }))
      .filter((item) => item.canView && (isNumber(item.id) || item.route || item.key)),
  )
}

function dedupeMenuPermissions(items: SessionMenuPermission[]) {
  const map = new Map<string, SessionMenuPermission>()

  for (const item of items) {
    const key = item.route ? `route:${item.route}` : item.id !== undefined ? `id:${item.id}` : `key:${item.key}`
    const previous = map.get(key)
    map.set(key, {
      ...previous,
      ...item,
      canView: true,
      canCreate: Boolean(previous?.canCreate || item.canCreate),
      canEdit: Boolean(previous?.canEdit || item.canEdit),
      canDelete: Boolean(previous?.canDelete || item.canDelete),
    })
  }

  return Array.from(map.values())
}

function looksLikeMenuRecord(record: Record<string, unknown>) {
  return Boolean(
    pickNumber(record, ["id_menu", "idMenu", "menu_id", "menuId"]) ??
      (hasMenuAccessFlag(record) ? pickNumber(record, ["id"]) : undefined) ??
      pickRoute(record) ??
      pickMenuKey(record) ??
      pickNestedMenuRecord(record).id_menu,
  )
}

function hasMenuAccessFlag(record: Record<string, unknown>) {
  return [
    "can_view",
    "canView",
    "can_create",
    "canCreate",
    "can_edit",
    "canEdit",
    "can_delete",
    "canDelete",
    "permiso_read",
    "permiso_view",
    "permiso_create",
    "permiso_update",
    "permiso_edit",
    "permiso_delete",
  ].some((key) => key in record)
}

function pickNestedMenuRecord(record: Record<string, unknown>) {
  for (const key of ["menu", "menu_role", "menuRole", "menu_detail", "menuDetails"]) {
    const nested = toRecord(record[key])
    if (Object.keys(nested).length > 0) return nested
  }

  return {}
}

function findUserRecord(payload: unknown): Record<string, unknown> {
  const direct = toRecord(payload)
  const data = toRecord(direct.data)
  const candidates = [
    toRecord(data.user),
    toRecord(data.session),
    data,
    toRecord(direct.user),
    toRecord(direct.session),
    direct,
  ]

  return candidates.find(looksLikeUserRecord) ??
    candidates.find((item) => Object.keys(item).length > 0) ??
    {}
}

function looksLikeUserRecord(record: Record<string, unknown>) {
  return Boolean(
    pickString(record, ["id_user", "id", "userId", "user_name", "username", "email", "names", "name"]) ||
      pickNumber(record, ["id_rol", "idRol", "role_id", "roleId", "id_role"]) !== undefined ||
      MENU_COLLECTION_KEYS.some((key) => key in record),
  )
}

function pickPermissions(record: Record<string, unknown>) {
  const value = record.permissions
  if (Array.isArray(value)) return value.filter(isString)

  const menuPermissions = record.menu_permissions ?? record.menuPermissions
  if (Array.isArray(menuPermissions)) {
    return menuPermissions
      .map((item) => pickMenuKey(toRecord(item)))
      .filter(Boolean)
  }

  return []
}

function mapUserRoleById(roleId?: number): UserRole | undefined {
  return roleId !== undefined ? ROLE_BY_ID[roleId] : undefined
}

function mapUserRole(role: string): UserRole {
  const value = normalizePermission(role)
  if (value.includes("ger")) return "gerencia"
  if (value.includes("admin")) return "administrador"
  if (value.includes("invent")) return "inventario"
  if (value.includes("conta")) return "contabilidad"
  if (value.includes("mant")) return "mantenimiento"
  if (value.includes("camar")) return "camarera"
  return "recepcion"
}

function pickString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return undefined
}

function pickOptionalBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value !== 0
    if (typeof value === "string") {
      const normalized = normalizePermission(value)
      if (["true", "1", "si", "yes", "y"].includes(normalized)) return true
      if (["false", "0", "no", "n"].includes(normalized)) return false
    }
  }
  return undefined
}

function pickRoute(record: Record<string, unknown>) {
  return normalizeRoute(
    pickString(record, [
      "route",
      "ruta",
      "path",
      "url",
      "href",
      "link",
      "menu_route",
      "menuRoute",
      "route_menu",
      "routeMenu",
    ]),
  )
}

function pickMenuKey(record: Record<string, unknown>) {
  return pickString(record, [
    "key",
    "menu",
    "name",
    "name_menu",
    "menu_name",
    "menuName",
    "module",
    "modulo",
    "title",
    "label",
    "description",
  ])
}

function normalizeRoute(value?: string) {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined

  const alias = routeFromMenuKey(raw)
  if (alias) return alias

  let path = raw
  try {
    if (/^https?:\/\//i.test(raw)) path = new URL(raw).pathname
  } catch {
    path = raw
  }

  path = path.split("?")[0]?.split("#")[0]?.trim() ?? ""
  if (!path) return undefined
  if (!path.startsWith("/")) {
    if (!path.includes("/")) return undefined
    path = `/${path}`
  }

  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path
  return normalizedPath === "/facturacion" ? "/recepcion/check-in" : normalizedPath
}

function routeFromMenuKey(value?: string) {
  if (!value) return undefined
  return ROUTE_BY_MENU_KEY[normalizeMenuKey(value)]
}

function pathMatchesRoute(path: string, route: string) {
  if (route === "/") return path === "/"
  return path === route || path.startsWith(`${route}/`)
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizePermission(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizeMenuKey(value: string) {
  return normalizePermission(value).replace(/[^a-z0-9]/g, "")
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter(Number.isFinite)))
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
