import { useEffect, useMemo, useState } from "react"
import { KeyRound, RotateCcw, Save, ShieldPlus, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EndpointPanel, FieldGrid, MiniTable, SectionCard, StatCard, StatusPill } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiErrorMessage, getApiToken, setApiToken } from "@/lib/api"
import { useStore } from "@/lib/store"
import type { AppUser, UserRole } from "@/lib/types"

type ApiRecord = Record<string, unknown>

type BackendRole = {
  id: number
  name: string
  description: string
}

type BackendMenu = {
  id: number
  key: string
  label: string
  route: string
}

type RolePermission = {
  id_menu: number
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

type PermissionKey = keyof Omit<RolePermission, "id_menu">

type UserForm = {
  names: string
  lastnames: string
  username: string
  password: string
  phone: string
  roleId: string
}

type RoleForm = {
  name: string
  description: string
}

const emptyForm: UserForm = {
  names: "",
  lastnames: "",
  username: "",
  password: "",
  phone: "",
  roleId: "",
}

const emptyRoleForm: RoleForm = {
  name: "",
  description: "",
}

const permissionColumns: Array<{ key: PermissionKey; label: string }> = [
  { key: "can_view", label: "Ver" },
  { key: "can_create", label: "Crear" },
  { key: "can_edit", label: "Editar" },
  { key: "can_delete", label: "Eliminar" },
]

const selectClass = "h-10 rounded-full border bg-background px-3 text-sm"

export function UsuariosPage() {
  const { users, dispatch, apiSources, refreshApiState } = useStore()
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm)
  const [passwordUserId, setPasswordUserId] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [backendRoles, setBackendRoles] = useState<BackendRole[]>([])
  const [backendMenus, setBackendMenus] = useState<BackendMenu[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [permissions, setPermissions] = useState<Record<number, RolePermission>>({})
  const [token, setToken] = useState(() => getApiToken() ?? "")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)

  const roleOptions = useMemo(
    () => [...backendRoles].sort((left, right) => left.id - right.id),
    [backendRoles],
  )
  const roleById = useMemo(
    () => new Map(roleOptions.map((role) => [role.id, role])),
    [roleOptions],
  )
  const selectedRole = selectedRoleId ? roleById.get(selectedRoleId) : undefined
  const selectedPermissionCount = Object.values(permissions).filter((item) => item.can_view).length
  const usersNeedToken = apiSources.users === "unauthorized"
  const securityNeedsToken = apiSources.roles === "unauthorized" || apiSources.menuRoles === "unauthorized"
  const canCreate =
    form.names.trim().length > 2 &&
    form.username.trim().length > 2 &&
    form.password.trim().length > 2 &&
    Number.isFinite(Number(form.roleId)) &&
    Number(form.roleId) > 0
  const canCreateRole = roleForm.name.trim().length > 2 && backendMenus.length > 0

  async function updateUserPassword() {
    const id = Number(passwordUserId)
    if (!Number.isFinite(id) || id <= 0 || newPassword.trim().length < 4) {
      toast.error("Selecciona usuario y escribe una contrasena valida")
      return
    }
    try {
      await api.users.updatePassword({
        id_user: id,
        password: newPassword,
      })
      toast.success("Contrasena actualizada")
      setPasswordUserId("")
      setNewPassword("")
    } catch (error) {
      toast.error("No se pudo actualizar la contrasena", {
        description: getApiErrorMessage(error),
      })
    }
  }

  useEffect(() => {
    void loadSecurityData()
  }, [])

  async function loadSecurityData(preferredRoleId = selectedRoleId) {
    setIsLoadingSecurity(true)

    try {
      const [rolesPayload, menusPayload] = await Promise.all([
        api.roles.list<unknown[]>(),
        api.menuRoles.listMenus<unknown[]>(),
      ])
      const nextRoles = toArray(rolesPayload).map(mapBackendRole).filter(isBackendRole)
      const nextMenus = uniqueMenus(toArray(menusPayload).flatMap(flattenBackendMenu))
      const nextRoleId =
        preferredRoleId && nextRoles.some((role) => role.id === preferredRoleId)
          ? preferredRoleId
          : nextRoles.find((role) => role.id === 2)?.id ?? nextRoles[0]?.id ?? null

      setBackendRoles(nextRoles)
      setBackendMenus(nextMenus)
      setSelectedRoleId(nextRoleId)

      if (nextRoleId) {
        await loadRolePermissions(nextRoleId, nextMenus)
      } else {
        setPermissions(createPermissionMap(nextMenus))
      }
    } catch (error) {
      toast.error("No se pudieron cargar roles y menus", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setIsLoadingSecurity(false)
    }
  }

  async function loadRolePermissions(roleId: number, menus = backendMenus) {
    try {
      const payload = await api.menu.getMenusByRole<unknown[]>({ id_rol: roleId })
      const nextPermissions = createPermissionMap(menus)

      toArray(payload)
        .map(mapRolePermission)
        .filter(isRolePermission)
        .forEach((permission) => {
          nextPermissions[permission.id_menu] = permission
        })

      setPermissions(nextPermissions)
    } catch (error) {
      setPermissions(createPermissionMap(menus))
      toast.error("No se pudieron cargar permisos del rol", {
        description: getApiErrorMessage(error),
      })
    }
  }

  const createUser = async () => {
    if (!canCreate) {
      toast.error("Nombre, usuario, contrasena y rol son obligatorios")
      return
    }
    if (usersNeedToken) {
      toast.error("Conecta un token antes de crear usuarios en el servidor")
      return
    }

    setIsCreating(true)

    try {
      await api.users.create({
        names: form.names.trim(),
        lastnames: form.lastnames.trim(),
        status: true,
        user_name: form.username.trim(),
        password: form.password,
        phone_number: form.phone.trim(),
        id_rol: Number(form.roleId),
      })
      await refreshApiState(["users", "roles", "menuRoles"])
      toast.success("Usuario creado correctamente", {
        description: "Ya aparece en la lista de usuarios del servidor.",
      })
      setForm({ ...emptyForm, roleId: form.roleId })
    } catch (error) {
      toast.error("No se pudo crear en el servidor", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setIsCreating(false)
    }
  }

  const createRole = async () => {
    if (!canCreateRole) {
      toast.error("Nombre de rol y menus disponibles son obligatorios")
      return
    }

    setIsCreatingRole(true)

    try {
      await api.menuRoles.create({
        name_rol: roleForm.name.trim(),
        rol_description: roleForm.description.trim() || null,
        menu_permissions: permissionPayload(),
      })
      await refreshApiState(["roles", "menuRoles", "users"])
      await loadSecurityData()
      toast.success("Rol creado correctamente")
      setRoleForm(emptyRoleForm)
    } catch (error) {
      toast.error("No se pudo crear el rol", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setIsCreatingRole(false)
    }
  }

  const saveRolePermissions = async () => {
    if (!selectedRole) {
      toast.error("Selecciona un rol")
      return
    }

    setIsSavingRole(true)

    try {
      await api.menuRoles.update({
        id_rol: selectedRole.id,
        name_rol: selectedRole.name,
        rol_description: selectedRole.description || null,
        menu_permissions: permissionPayload(),
      })
      await refreshApiState(["roles", "menuRoles", "users"])
      await loadSecurityData(selectedRole.id)
      toast.success("Permisos actualizados")
    } catch (error) {
      toast.error("No se pudieron guardar permisos", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setIsSavingRole(false)
    }
  }

  const connectToken = async () => {
    const cleanToken = token.trim().replace(/^Bearer\s+/i, "")

    if (!cleanToken) {
      toast.error("Pega un token valido")
      return
    }

    setIsConnecting(true)
    setApiToken(cleanToken)

    try {
      await refreshApiState(["users", "roles", "menuRoles"])
      await loadSecurityData()
      toast.success("Token guardado; reintentando servidor")
    } finally {
      setIsConnecting(false)
    }
  }

  const retryBackend = async () => {
    setIsConnecting(true)

    try {
      await refreshApiState(["users", "roles", "menuRoles"])
      await loadSecurityData()
      toast.success("Servidor reintentado")
    } finally {
      setIsConnecting(false)
    }
  }

  const toggleUser = (id: string) => {
    if (usersNeedToken) {
      toast.error("Conecta un token antes de cambiar usuarios en el servidor")
      return
    }

    dispatch({ type: "USER_TOGGLE", id })
    toast.success("Estado de usuario actualizado")
  }

  const changeRole = (id: string, roleIdText: string) => {
    if (usersNeedToken) {
      toast.error("Conecta un token antes de cambiar usuarios en el servidor")
      return
    }

    const roleId = Number(roleIdText)
    const backendRole = roleById.get(roleId)
    if (!backendRole) return

    const role = userRoleFromBackendRole(backendRole)
    dispatch({
      type: "USER_UPDATE",
      id,
      patch: {
        role,
        roleId: backendRole.id,
        roleName: backendRole.name,
        permissions: backendRole.id === 2 ? ["*"] : [backendRole.name],
      },
    })
    toast.success("Rol actualizado")
  }

  const updatePermission = (menuId: number, key: PermissionKey, checked: boolean) => {
    setPermissions((current) => {
      const nextPermission = {
        ...(current[menuId] ?? emptyPermission(menuId)),
        [key]: checked,
      }

      if (key === "can_view" && !checked) {
        nextPermission.can_create = false
        nextPermission.can_edit = false
        nextPermission.can_delete = false
      }

      if (key !== "can_view" && checked) {
        nextPermission.can_view = true
      }

      return {
        ...current,
        [menuId]: nextPermission,
      }
    })
  }

  const selectRole = async (roleIdText: string) => {
    const roleId = Number(roleIdText)
    if (!Number.isFinite(roleId)) return

    setSelectedRoleId(roleId)
    await loadRolePermissions(roleId)
  }

  function permissionPayload() {
    return backendMenus.map((menu) => {
      const permission = permissions[menu.id] ?? emptyPermission(menu.id)

      return {
        id_menu: menu.id,
        can_view: permission.can_view,
        can_create: permission.can_create,
        can_edit: permission.can_edit,
        can_delete: permission.can_delete,
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracion"
        title="Usuarios y roles"
        description="Login individual, roles del servidor y permisos por menu para controlar acceso directo por direccion."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Usuarios" value={users.length} />
        <StatCard label="Activos" value={users.filter((user) => user.status === "activo").length} tone="success" />
        <StatCard label="Roles del servidor" value={roleOptions.length} tone={securityNeedsToken ? "warning" : "info"} />
        <StatCard label="Menus" value={backendMenus.length} tone={securityNeedsToken ? "warning" : "info"} />
        <StatCard label="Usuarios del servidor" value={apiSources.users} tone={usersNeedToken ? "warning" : apiSources.users === "connected" ? "success" : "info"} />
      </section>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="nuevo">Crear usuario</TabsTrigger>
          <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <SectionCard title="Usuarios actuales">
            <MiniTable
              headers={["Nombre", "Usuario", "Rol", "Estado", "Ultimo login", "Permisos", "Acciones"]}
              rows={users.map((user) => [
                user.name,
                user.email,
                <select
                  value={String(roleIdForUser(user, roleOptions) ?? "")}
                  onChange={(event) => changeRole(user.id, event.target.value)}
                  className={selectClass}
                  disabled={!roleOptions.length || usersNeedToken}
                >
                  <option value="" disabled>Sin rol del servidor</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>,
                <StatusPill tone={user.status === "activo" ? "success" : "muted"}>{user.status}</StatusPill>,
                user.lastLogin || "Sin registro",
                user.permissions.join(", "),
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleUser(user.id)} disabled={usersNeedToken}>
                  {user.status === "activo" ? "Desactivar" : "Activar"}
                </Button>,
              ])}
            />
          </SectionCard>

          <SectionCard
            title="Actualizar contrasena"
            description="Accion conectada a PUT /api/v1/user/update-password."
          >
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
              <label className="space-y-1 text-sm font-medium">
                Usuario
                <select value={passwordUserId} onChange={(event) => setPasswordUserId(event.target.value)} className={selectClass} disabled={usersNeedToken}>
                  <option value="">Selecciona usuario</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Nueva contrasena
                <Input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-full" type="password" />
              </label>
              <Button type="button" className="rounded-full" onClick={() => void updateUserPassword()} disabled={usersNeedToken}>
                Actualizar
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="nuevo">
          <SectionCard
            title="Crear usuario"
            description="El rol seleccionado se envia como identificador real del servidor."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Input value={form.names} onChange={(event) => setForm((current) => ({ ...current, names: event.target.value }))} placeholder="Nombres" className="rounded-full" />
              <Input value={form.lastnames} onChange={(event) => setForm((current) => ({ ...current, lastnames: event.target.value }))} placeholder="Apellidos" className="rounded-full" />
              <Input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Usuario para login" className="rounded-full" />
              <Input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Contrasena" className="rounded-full" />
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefono" className="rounded-full" />
              <select value={form.roleId} onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))} className={selectClass} disabled={!roleOptions.length}>
                <option value="" disabled>Selecciona rol</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="gap-2 rounded-full" onClick={createUser} disabled={!canCreate || isCreating || usersNeedToken}>
                <UserPlus className="size-3.5" />
                {isCreating ? "Creando..." : "Crear"}
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <SectionCard title="Roles del servidor">
            <MiniTable
              headers={["Identificador", "Rol", "Descripcion"]}
              rows={roleOptions.map((role) => [
                role.id,
                role.name,
                role.description || "Sin descripcion",
              ])}
            />
          </SectionCard>

          <SectionCard
            title="Crear rol"
            description="El nuevo rol se crea con los permisos marcados en la matriz."
            actions={
              <Button size="sm" className="gap-2 rounded-full" onClick={createRole} disabled={!canCreateRole || isCreatingRole || securityNeedsToken}>
                <ShieldPlus className="size-3.5" />
                {isCreatingRole ? "Creando..." : "Crear rol"}
              </Button>
            }
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <Input value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del rol" className="rounded-full" />
              <Textarea value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descripcion" className="min-h-10 rounded-2xl" />
            </div>
          </SectionCard>

          <SectionCard
            title="Permisos por menu"
            description={selectedRole ? `${selectedRole.name}: ${selectedPermissionCount} menus con vista habilitada.` : "Selecciona un rol para editar permisos."}
            actions={
              <>
                <select
                  value={selectedRoleId ? String(selectedRoleId) : ""}
                  onChange={(event) => void selectRole(event.target.value)}
                  className={selectClass}
                  disabled={!roleOptions.length || isLoadingSecurity}
                >
                  <option value="" disabled>Selecciona rol</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <Button size="sm" className="gap-2 rounded-full" onClick={saveRolePermissions} disabled={!selectedRole || isSavingRole || securityNeedsToken}>
                  <Save className="size-3.5" />
                  {isSavingRole ? "Guardando..." : "Guardar"}
                </Button>
              </>
            }
          >
            <MiniTable
              headers={["Menu", ...permissionColumns.map((column) => column.label)]}
              rows={backendMenus.map((menu) => {
                const permission = permissions[menu.id] ?? emptyPermission(menu.id)

                return [
                  <div className="min-w-56">
                    <p className="font-medium">{menu.label}</p>
                    <code className="mt-1 block break-all text-xs text-muted-foreground">{menu.route || menu.key}</code>
                  </div>,
                  ...permissionColumns.map((column) => (
                    <Checkbox
                      checked={permission[column.key]}
                      onCheckedChange={(checked) => updatePermission(menu.id, column.key, checked === true)}
                      aria-label={`${column.label} ${menu.label}`}
                      disabled={securityNeedsToken || isLoadingSecurity}
                    />
                  )),
                ]
              })}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="backend">
          <div className="space-y-4">
            <SectionCard
              title="Conexion con el servidor"
              description="Pega aqui el Bearer token si necesitas reintentar endpoints protegidos."
              actions={
                <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={retryBackend} disabled={isConnecting || isLoadingSecurity}>
                  <RotateCcw className="size-3.5" />
                  Reintentar
                </Button>
              }
            >
              <div className="grid gap-3 2xl:grid-cols-[1fr_auto]">
                <Input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Bearer token"
                  className="rounded-full"
                  autoComplete="off"
                />
                <Button className="gap-2 rounded-full" onClick={connectToken} disabled={isConnecting || isLoadingSecurity}>
                  <KeyRound className="size-3.5" />
                  Conectar token
                </Button>
              </div>
              <div className="mt-4">
                <FieldGrid
                  items={[
                    { label: "Usuarios", value: apiSources.users },
                    { label: "Roles", value: apiSources.roles },
                    { label: "Menus por rol", value: apiSources.menuRoles },
                    { label: "Roles cargados", value: roleOptions.length },
                    { label: "Menus cargados", value: backendMenus.length },
                    { label: "Rol seleccionado", value: selectedRole?.name ?? "Sin rol" },
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard title="Endpoints reales para Usuarios y seguridad">
              <EndpointPanel
                endpoints={[
                  "POST /api/v1/user/login",
                  "GET /api/v1/user/get-all",
                  "POST /api/v1/user/create",
                  "POST /api/v1/user/update",
                  "PUT /api/v1/user/update-password",
                  "DELETE /api/v1/user/delete/{id_user}",
                  "GET /api/v1/rol/get-all",
                  "POST /api/v1/rol/create",
                  "POST /api/v1/rol/getMenusByIdRol",
                  "GET /api/v1/menu_roles/get-all-menus",
                  "POST /api/v1/menu_roles/create",
                  "POST /api/v1/menu_roles/update",
                ]}
              />
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.data)) return value.data
  return []
}

function toRecord(value: unknown): ApiRecord {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pickString(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }

  return fallback
}

function pickNumber(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return undefined
}

function pickBoolean(record: ApiRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value !== 0
    if (typeof value === "string") {
      const normalized = normalizeForMatch(value)
      if (["true", "1", "si", "yes", "y"].includes(normalized)) return true
      if (["false", "0", "no", "n"].includes(normalized)) return false
    }
  }

  return fallback
}

function mapBackendRole(item: unknown): BackendRole | null {
  const record = toRecord(item)
  const id = pickNumber(record, ["id_rol", "idRol", "role_id", "roleId", "id"])
  const name = pickString(record, ["name_rol", "rol_name", "rol_nombre", "role", "name"], "")

  if (!id || !name) return null

  return {
    id,
    name,
    description: pickString(record, ["rol_description", "description", "descripcion"], ""),
  }
}

function isBackendRole(value: BackendRole | null): value is BackendRole {
  return Boolean(value)
}

function flattenBackendMenu(item: unknown): BackendMenu[] {
  const record = toRecord(item)
  const children = toArray(record.children).flatMap(flattenBackendMenu)
  const id = pickNumber(record, ["id_menu", "idMenu", "id"])

  if (!id) return children

  const key = pickString(record, ["menu_id", "menuId", "key", "name"], "")
  const label = pickString(record, ["label", "menu_name", "name", "title"], key || `Menu ${id}`)
  const route = pickString(record, ["route", "ruta", "path", "url"], "")

  return [{ id, key, label, route }, ...children]
}

function uniqueMenus(items: BackendMenu[]) {
  const map = new Map<number, BackendMenu>()
  items.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

function mapRolePermission(item: unknown): RolePermission | null {
  const record = toRecord(item)
  const id = pickNumber(record, ["id_menu", "idMenu", "id"])

  if (!id) return null

  return {
    id_menu: id,
    can_view: pickBoolean(record, ["can_view", "canView", "permiso_read", "permiso_view", "read", "view"], false),
    can_create: pickBoolean(record, ["can_create", "canCreate", "permiso_create", "create"], false),
    can_edit: pickBoolean(record, ["can_edit", "canEdit", "permiso_update", "permiso_edit", "update", "edit"], false),
    can_delete: pickBoolean(record, ["can_delete", "canDelete", "permiso_delete", "delete"], false),
  }
}

function isRolePermission(value: RolePermission | null): value is RolePermission {
  return Boolean(value)
}

function emptyPermission(menuId: number): RolePermission {
  return {
    id_menu: menuId,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }
}

function createPermissionMap(menus: BackendMenu[]) {
  return Object.fromEntries(menus.map((menu) => [menu.id, emptyPermission(menu.id)]))
}

function roleIdForUser(user: AppUser, roles: BackendRole[]) {
  if (user.roleId && roles.some((role) => role.id === user.roleId)) return user.roleId

  const roleName = normalizeForMatch(user.roleName ?? user.role)
  return roles.find((role) => normalizeForMatch(role.name) === roleName)?.id
}

function userRoleFromBackendRole(role: BackendRole): UserRole {
  const roleById: Record<number, UserRole> = {
    1: "gerencia",
    2: "administrador",
    3: "inventario",
    4: "contabilidad",
    5: "mantenimiento",
    6: "camarera",
    7: "recepcion",
  }

  return roleById[role.id] ?? userRoleFromName(role.name)
}

function userRoleFromName(role: string): UserRole {
  const value = normalizeForMatch(role)
  if (value.includes("ger")) return "gerencia"
  if (value.includes("admin")) return "administrador"
  if (value.includes("invent")) return "inventario"
  if (value.includes("conta")) return "contabilidad"
  if (value.includes("mant")) return "mantenimiento"
  if (value.includes("camar")) return "camarera"
  return "recepcion"
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export default UsuariosPage
