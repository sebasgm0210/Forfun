import { useEffect, useMemo, useState } from "react"
import { Clock3, RefreshCcw, Save, UserRoundCheck, UsersRound } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyAction, FieldGrid, SectionCard, StatCard, StatusPill } from "@/components/modules/view-kit"
import { Button } from "@/components/ui/button"
import { api, getApiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type ApiRecord = Record<string, unknown>

type ShiftConfig = {
  id: number
  name: string
  startTime: string
  endTime: string
  isOvernight: boolean
  userId: number | null
  userName: string | null
}

type UserOption = {
  id: number
  name: string
  username: string
  role: string
  active: boolean
}

const selectClass = "h-10 rounded-full border bg-background px-3 text-sm"

export function AdminCierresTurnoPage() {
  const [configs, setConfigs] = useState<ShiftConfig[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const assignedCount = configs.filter((config) => config.userId).length
  const unassignedCount = configs.length - assignedCount
  const overnightCount = configs.filter((config) => config.isOvernight).length
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const userOptions = useMemo(
    () =>
      [...users].sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1
        return left.name.localeCompare(right.name, "es")
      }),
    [users],
  )

  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage() {
    setIsLoading(true)
    setUsersError(null)

    try {
      const [configsPayload, usersResult] = await Promise.allSettled([
        api.cashShifts.listConfigs<unknown>(),
        api.users.list<unknown>(),
      ])

      if (configsPayload.status === "rejected") {
        throw configsPayload.reason
      }

      const nextConfigs = toArray(configsPayload.value)
        .map(mapShiftConfig)
        .filter(isShiftConfig)
        .sort((left, right) => left.startTime.localeCompare(right.startTime))

      setConfigs(nextConfigs)
      setSelectedUsers(Object.fromEntries(nextConfigs.map((config) => [config.id, config.userId ? String(config.userId) : ""])))

      if (usersResult.status === "fulfilled") {
        setUsers(toArray(usersResult.value).map(mapUserOption).filter(isUserOption))
      } else {
        setUsers([])
        setUsersError(getApiErrorMessage(usersResult.reason))
      }
    } catch (error) {
      toast.error("No se pudieron cargar los turnos de cierre", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function reloadConfigs() {
    try {
      const payload = await api.cashShifts.listConfigs<unknown>()
      const nextConfigs = toArray(payload)
        .map(mapShiftConfig)
        .filter(isShiftConfig)
        .sort((left, right) => left.startTime.localeCompare(right.startTime))

      setConfigs(nextConfigs)
      setSelectedUsers(Object.fromEntries(nextConfigs.map((config) => [config.id, config.userId ? String(config.userId) : ""])))
    } catch (error) {
      toast.error("No se pudieron refrescar los turnos", {
        description: getApiErrorMessage(error),
      })
    }
  }

  async function assignUser(config: ShiftConfig) {
    const rawUserId = selectedUsers[config.id]
    const userId = Number(rawUserId)

    if (!Number.isFinite(userId) || userId <= 0) {
      toast.error("Selecciona un encargado para este turno")
      return
    }

    const user = usersById.get(userId)
    setSavingId(config.id)

    try {
      await api.cashShifts.assignConfigUser(config.id, { id_user: userId })
      await reloadConfigs()
      toast.success("Encargado actualizado", {
        description: `${config.name} quedó asignado a ${user?.name ?? "el usuario seleccionado"}.`,
      })
    } catch (error) {
      toast.error("No se pudo asignar el encargado", {
        description: getApiErrorMessage(error),
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Cierres de turno"
        description="Define qué usuario queda encargado de cada turno operativo. Recepción usa esta configuración para abrir y cerrar caja contra el turno correcto."
        actions={
          <Button variant="outline" className="gap-2 rounded-full" onClick={loadPage} disabled={isLoading}>
            <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
            Refrescar
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Turnos configurados" value={configs.length} helper="Vienen del backend local." />
        <StatCard label="Con encargado" value={assignedCount} helper={`${unassignedCount} pendiente(s) de asignar.`} tone={unassignedCount ? "warning" : "success"} />
        <StatCard label="Turnos nocturnos" value={overnightCount} helper="Cruzan de un día al siguiente." tone="info" />
      </div>

      <SectionCard
        title="Encargados por turno"
        description="Asigna usuarios existentes del sistema. Esta pantalla no crea turnos ni usuarios; solo consume la configuración que ya entrega el backend."
        actions={<StatusPill tone={usersError ? "warning" : "success"}>{usersError ? "Usuarios no cargados" : "Servidor conectado"}</StatusPill>}
      >
        {isLoading ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
            Cargando turnos de cierre...
          </div>
        ) : configs.length === 0 ? (
          <EmptyAction title="No hay turnos configurados" description="El backend no devolvió configuraciones de cash-shifts/configs." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {configs.map((config) => {
              const assignedUser = config.userId ? usersById.get(config.userId) : undefined
              const selectedUser = Number(selectedUsers[config.id])
              const changed = selectedUser > 0 && selectedUser !== (config.userId ?? 0)

              return (
                <article key={config.id} className="rounded-3xl border bg-background/70 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Turno #{config.id}</p>
                      <h3 className="mobile-safe-text mt-1 font-serif text-xl font-light">{config.name}</h3>
                    </div>
                    <StatusPill tone={config.userId ? "success" : "warning"}>
                      {config.userId ? "Asignado" : "Sin encargado"}
                    </StatusPill>
                  </div>

                  <FieldGrid
                    items={[
                      {
                        label: "Horario",
                        value: `${formatTime(config.startTime)} - ${formatTime(config.endTime)}`,
                        helper: config.isOvernight ? "Cruza medianoche" : "Mismo día",
                      },
                      {
                        label: "Encargado actual",
                        value: config.userName ?? assignedUser?.name ?? "Sin asignar",
                        helper: assignedUser?.role,
                      },
                    ]}
                  />

                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Nuevo encargado
                    </label>
                    <select
                      className={cn(selectClass, "w-full")}
                      value={selectedUsers[config.id] ?? ""}
                      onChange={(event) =>
                        setSelectedUsers((current) => ({
                          ...current,
                          [config.id]: event.target.value,
                        }))
                      }
                      disabled={Boolean(usersError) || userOptions.length === 0 || savingId === config.id}
                    >
                      <option value="">Seleccionar usuario</option>
                      {userOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.role}{user.active ? "" : " · inactivo"}
                        </option>
                      ))}
                    </select>

                    <Button
                      className="w-full gap-2 rounded-full"
                      onClick={() => assignUser(config)}
                      disabled={Boolean(usersError) || savingId === config.id || !changed}
                    >
                      {savingId === config.id ? (
                        <RefreshCcw className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Guardar encargado
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {usersError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">No se pudieron cargar usuarios.</p>
            <p className="mt-1">
              Los turnos sí cargaron, pero para asignar encargados necesitás entrar con una sesión/token que tenga permiso para listar usuarios.
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Guía rápida" description="Usa esta pantalla para dejar claro quién es responsable de cada turno de caja antes de que recepción empiece a operar.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Clock3,
              title: "Revisa los horarios",
              text: "Confirma que cada turno tenga el horario correcto, especialmente el nocturno porque cruza medianoche.",
            },
            {
              icon: UsersRound,
              title: "Elige al encargado",
              text: "Selecciona a la persona que será responsable de contar, revisar y cerrar la caja de ese turno.",
            },
            {
              icon: UserRoundCheck,
              title: "Guarda el cambio",
              text: "Presiona Guardar encargado para que la asignación quede aplicada en el sistema.",
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div key={item.title} className="rounded-2xl border bg-muted/20 p-4">
                <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <p className="mt-3 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

function mapShiftConfig(item: unknown): ShiftConfig {
  const record = toRecord(item)
  const nestedUser = pickRecord(record, ["assigned_user", "assignedUser", "user", "responsible", "encargado"])
  const assignedUserId =
    pickOptionalNumber(record, ["id_user", "user_id", "idUser", "assigned_user_id", "assignedUserId"]) ??
    pickOptionalNumber(nestedUser, ["id_user", "user_id", "idUser", "id"])
  const assignedUserName =
    pickOptionalString(record, ["assigned_user_name", "assignedUserName", "user_name", "userName", "responsible_name", "encargado_nombre"]) ??
    personNameFromUserRecord(nestedUser)

  return {
    id: pickNumber(record, ["id_cash_shift_config", "id_shift_config", "cash_shift_config_id", "shift_config_id", "id"], 0),
    name: cleanShiftName(pickString(record, ["shift_name", "name"], "Turno")),
    startTime: pickString(record, ["start_time", "startTime"], ""),
    endTime: pickString(record, ["end_time", "endTime"], ""),
    isOvernight: pickBoolean(record, ["is_overnight", "isOvernight"], false),
    userId: assignedUserId,
    userName: assignedUserName,
  }
}

function isShiftConfig(config: ShiftConfig) {
  return Number.isFinite(config.id) && config.id > 0
}

function mapUserOption(item: unknown): UserOption {
  const record = toRecord(item)
  const id = pickNumber(record, ["id_user", "id"], 0)
  const username = pickString(record, ["user_name", "username", "email"], "")
  const role = pickString(record, ["role", "name_rol", "rol_name", "rol_nombre", "rol"], "Usuario")
  const name = personNameFromUserRecord(record) || username || `Usuario ${id}`

  return {
    id,
    name,
    username,
    role,
    active: pickBoolean(record, ["status", "is_active"], true),
  }
}

function isUserOption(user: UserOption) {
  return Number.isFinite(user.id) && user.id > 0
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = toRecord(value)
  if (Array.isArray(record.data)) return record.data
  return []
}

function toRecord(value: unknown): ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ApiRecord)
    : {}
}

function pickRecord(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = toRecord(record[key])
    if (Object.keys(value).length > 0) return value
  }

  return {}
}

function personNameFromUserRecord(record: ApiRecord) {
  const names = pickString(record, ["names", "first_name", "firstName"], "")
  const lastnames = pickString(record, ["lastnames", "lastname", "last_name", "lastName"], "")
  const fullName = `${names} ${lastnames}`.trim()

  return (
    fullName ||
    pickString(record, ["full_name", "fullName", "display_name", "displayName", "name", "user_name", "username", "email"], "")
  ) || null
}

function pickString(record: ApiRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return fallback
}

function pickOptionalString(record: ApiRecord, keys: string[]) {
  const value = pickString(record, keys, "")
  return value || null
}

function pickNumber(record: ApiRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return fallback
}

function pickOptionalNumber(record: ApiRecord, keys: string[]) {
  const value = pickNumber(record, keys, NaN)
  return Number.isFinite(value) ? value : null
}

function pickBoolean(record: ApiRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1
    if (typeof value === "string") {
      const normalized = value.toLowerCase().trim()
      if (["true", "1", "si", "sí", "activo"].includes(normalized)) return true
      if (["false", "0", "no", "inactivo"].includes(normalized)) return false
    }
  }
  return fallback
}

function formatTime(value: string) {
  if (!value) return "--:--"
  return value.slice(0, 5)
}

function cleanShiftName(value: string) {
  return value
    .replace(/ma\?\?ana/gi, "mañana")
    .replace(/ma\uFFFDana/gi, "mañana")
    .replace(/ma\u00C3\u00B1ana/gi, "mañana")
    .replace(/\bma[nñ]ana\b/gi, "mañana")
}

export default AdminCierresTurnoPage
