import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { CreditAccount, CreditAuthorizationRequest, Guest } from "@/lib/types"

type AccountHealth =
  | "al dia"
  | "por vencer"
  | "vencido"
  | "pausado"
  | "bloqueado"
  | "autorizado"
  | "sin credito"

type AccountView = CreditAccount & {
  guest?: Guest
  available: number
  usage: number
  daysToDue: number
  health: AccountHealth
  paused: boolean
  blocked: boolean
  authorized: boolean
}

type CreditForm = {
  guestId: string
  company: string
  contact: string
  email: string
  phone: string
  limit: number
  balance: number
  dueDate: string
  status: CreditAccount["status"]
  creditStatus: NonNullable<CreditAccount["creditStatus"]>
  authorizationNote: string
}

type PendingDialog = {
  title: string
  description: string
  confirmLabel: string
  tone: "default" | "danger"
  onConfirm: () => void
} | null

const emptyCreditForm: CreditForm = {
  guestId: "",
  company: "",
  contact: "",
  email: "",
  phone: "",
  limit: 0,
  balance: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  status: "al dia",
  creditStatus: "activo",
  authorizationNote: "",
}

const healthLabels: Record<AccountHealth, string> = {
  "al dia": "Al día",
  "por vencer": "Por vencer",
  vencido: "Vencido",
  pausado: "Crédito pausado",
  bloqueado: "Credito bloqueado",
  autorizado: "Autorizado por admin",
  "sin credito": "Sin crédito disponible",
}

const healthStyles: Record<AccountHealth, string> = {
  "al dia": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "por vencer": "border-amber-200 bg-amber-50 text-amber-900",
  vencido: "border-red-200 bg-red-50 text-red-900",
  pausado: "border-zinc-300 bg-zinc-100 text-zinc-800",
  bloqueado: "border-red-300 bg-red-100 text-red-950",
  autorizado: "border-blue-200 bg-blue-50 text-blue-900",
  "sin credito": "border-orange-200 bg-orange-50 text-orange-900",
}

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

function daysBetweenToday(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function healthForAccount(account: CreditAccount): AccountHealth {
  if (account.creditStatus === "bloqueado") return "bloqueado"
  if (account.creditStatus === "pausado") return "pausado"
  if (account.creditStatus === "autorizado") return "autorizado"
  if (account.status === "vencido") return "vencido"
  if (account.balance >= account.limit) return "sin credito"
  if (account.status === "por vencer") return "por vencer"
  return "al dia"
}

function CreditBadge({ health }: { health: AccountHealth }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        healthStyles[health],
      )}
    >
      {health === "al dia" ? <CheckCircle2 className="size-3.5" /> : null}
      {health === "por vencer" ? <CalendarClock className="size-3.5" /> : null}
      {health === "vencido" ? <ShieldAlert className="size-3.5" /> : null}
      {health === "pausado" ? <Ban className="size-3.5" /> : null}
      {health === "bloqueado" ? <LockKeyhole className="size-3.5" /> : null}
      {health === "autorizado" ? <BadgeCheck className="size-3.5" /> : null}
      {health === "sin credito" ? <AlertTriangle className="size-3.5" /> : null}
      {healthLabels[health]}
    </span>
  )
}

function AdminMetric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string
  value: string | number
  helper: string
  tone?: "default" | "warning" | "danger" | "success" | "info"
}) {
  const tones = {
    default: "border-border bg-card",
    warning: "border-amber-200 bg-amber-50/80",
    danger: "border-red-200 bg-red-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    info: "border-blue-200 bg-blue-50/80",
  }

  return (
    <div className={cn("rounded-3xl border p-4 shadow-sm", tones[tone])}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

export function AdminCreditosPage() {
  const { creditAccounts, creditAuthorizationRequests, guests, dispatch } = useStore()
  const [activeTab, setActiveTab] = useState<"solicitudes" | "cuentas" | "backend">(
    "cuentas",
  )
  const [query, setQuery] = useState("")
  const [guestSearch, setGuestSearch] = useState("")
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState<CreditForm>(emptyCreditForm)
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null)
  const creditFormRef = useRef<HTMLDivElement>(null)

  const accounts = useMemo<AccountView[]>(
    () =>
      creditAccounts.map((account) => {
        const available = Math.max(0, account.limit - account.balance)
        return {
          ...account,
          guest: account.guestId ? guests.find((guest) => guest.id === account.guestId) : undefined,
          available,
          usage:
            account.limit > 0
              ? Math.min(100, Math.round((account.balance / account.limit) * 100))
              : 0,
          daysToDue: daysBetweenToday(account.dueDate),
          health: healthForAccount(account),
          paused: account.creditStatus === "pausado",
          blocked: account.creditStatus === "bloqueado",
          authorized: account.creditStatus === "autorizado",
        }
      }),
    [creditAccounts, guests],
  )

  const pendingRequests = creditAuthorizationRequests.filter(
    (request) => request.status === "pendiente",
  )
  const resolvedRequests = creditAuthorizationRequests.filter(
    (request) => request.status !== "pendiente",
  )
  const overdueAccounts = accounts.filter((account) => account.status === "vencido")
  const pausedAccounts = accounts.filter((account) => account.paused)
  const blockedAccounts = accounts.filter((account) => account.blocked)
  const authorizedAccounts = accounts.filter((account) => account.authorized)
  const riskyAccounts = accounts.filter((account) =>
    ["vencido", "pausado", "bloqueado", "sin credito"].includes(account.health),
  )
  const filteredAccounts = accounts.filter((account) => {
    const text = query.trim().toLowerCase()
    if (!text) return true
    return [
      account.company,
      account.guest?.name ?? "",
      account.guest?.document ?? "",
      account.guest?.nit ?? "",
      account.contact,
      account.email,
      account.phone,
      account.health,
    ]
      .join(" ")
      .toLowerCase()
      .includes(text)
  })
  const filteredGuestOptions = useMemo(() => {
    const text = guestSearch.trim().toLowerCase()
    const filtered = text
      ? guests.filter((guest) =>
          [guest.name, guest.nit, guest.document, guest.phone ?? "", guest.email ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(text),
        )
      : guests
    const selectedGuest = guests.find((guest) => guest.id === creditForm.guestId)

    if (selectedGuest && !filtered.some((guest) => guest.id === selectedGuest.id)) {
      return [selectedGuest, ...filtered]
    }

    return filtered
  }, [creditForm.guestId, guestSearch, guests])

  function accountForRequest(request: CreditAuthorizationRequest) {
    return accounts.find((account) => account.id === request.accountId)
  }

  function resolveRequest(
    request: CreditAuthorizationRequest,
    status: "aprobada" | "rechazada",
  ) {
    const account = accountForRequest(request)
    dispatch({
      type: "CREDIT_AUTH_REQUEST_RESOLVE",
      id: request.id,
      status,
      notes:
        status === "aprobada"
          ? "Autorizado por administración para operar al crédito."
          : "Solicitud rechazada; requiere abono o revisión de gerencia.",
    })
    setPendingDialog(null)
    toast.success(
      status === "aprobada"
        ? "Crédito autorizado correctamente"
        : "Solicitud rechazada",
      {
        description: account?.company ?? "Cuenta de crédito",
      },
    )
  }

  function updateCreditStatus(
    account: AccountView,
    creditStatus: NonNullable<CreditAccount["creditStatus"]>,
  ) {
    dispatch({
      type: "CREDIT_ACCOUNT_STATUS",
      accountId: account.id,
      creditStatus,
      authorizationNote:
        creditStatus === "autorizado"
          ? "Reanudado por administración para operación controlada."
          : creditStatus === "bloqueado"
            ? "Bloqueado por administracion. No debe operar al credito."
            : undefined,
    })
    setPendingDialog(null)
    toast.success(
      creditStatus === "bloqueado"
        ? "Credito bloqueado correctamente"
        : creditStatus === "pausado"
        ? "Crédito pausado correctamente"
        : creditStatus === "autorizado"
          ? "Crédito reanudado con autorización"
          : "Crédito reanudado correctamente",
      {
        description: account.company,
      },
    )
  }

  function nextResumeStatus(account: AccountView): NonNullable<CreditAccount["creditStatus"]> {
    return account.status === "vencido" || account.balance >= account.limit
      ? "autorizado"
      : "activo"
  }

  function resetCreditForm() {
    setEditingAccountId(null)
    setCreditForm(emptyCreditForm)
  }

  function fillCreditFormFromGuest(guestId: string) {
    const guest = guests.find((item) => item.id === guestId)
    setCreditForm((current) => ({
      ...current,
      guestId,
      company: guest?.name ?? current.company,
      contact: guest?.name ?? current.contact,
      email: guest?.email ?? current.email,
      phone: guest?.phone ?? current.phone,
    }))
  }

  function editCreditAccount(account: AccountView) {
    setEditingAccountId(account.id)
    setCreditForm({
      guestId: account.guestId ?? "",
      company: account.company,
      contact: account.contact,
      email: account.email,
      phone: account.phone,
      limit: account.limit,
      balance: account.balance,
      dueDate: account.dueDate,
      status: account.status,
      creditStatus: account.creditStatus ?? "activo",
      authorizationNote: account.authorizationNote ?? "",
    })
    setActiveTab("cuentas")
    window.setTimeout(() => {
      creditFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)
  }

  function saveCreditAccount() {
    const company = creditForm.company.trim()
    if (!company || creditForm.limit <= 0 || !creditForm.dueDate) {
      toast.error("Completa cliente/empresa, limite y fecha de vencimiento")
      return
    }

    const duplicatedGuest = creditForm.guestId
      ? creditAccounts.some(
          (account) =>
            account.guestId === creditForm.guestId && account.id !== editingAccountId,
        )
      : false

    if (duplicatedGuest) {
      toast.error("Ese cliente ya tiene una cuenta de credito asignada")
      return
    }

    const payload: CreditAccount = {
      id: editingAccountId ?? `ca-${Date.now()}`,
      guestId: creditForm.guestId || undefined,
      company,
      contact: creditForm.contact.trim() || company,
      email: creditForm.email.trim(),
      phone: creditForm.phone.trim(),
      limit: Math.max(0, creditForm.limit),
      balance: Math.max(0, creditForm.balance),
      dueDate: creditForm.dueDate,
      status: creditForm.status,
      creditStatus: creditForm.creditStatus,
      authorizationNote:
        creditForm.creditStatus === "autorizado" || creditForm.creditStatus === "bloqueado"
          ? creditForm.authorizationNote.trim() ||
            (creditForm.creditStatus === "bloqueado"
              ? "Bloqueado por administracion."
              : "Autorizado por administracion.")
          : undefined,
    }

    if (editingAccountId) {
      dispatch({ type: "CREDIT_ACCOUNT_UPDATE", id: editingAccountId, patch: payload })
      toast.success("Credito actualizado", { description: payload.company })
    } else {
      dispatch({ type: "CREDIT_ACCOUNT_CREATE", account: payload })
      toast.success("Credito asignado", { description: payload.company })
    }

    resetCreditForm()
  }

  function deleteCreditAccount(account: AccountView) {
    dispatch({ type: "CREDIT_ACCOUNT_DELETE", id: account.id })
    if (editingAccountId === account.id) resetCreditForm()
    setPendingDialog(null)
    toast.success("Cuenta de credito eliminada", { description: account.company })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Control de créditos"
        description="CRUD administrativo para asignar, editar, pausar o eliminar creditos de clientes y empresas."
        actions={
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => {
              setActiveTab("solicitudes")
              const first = pendingRequests[0]
              if (!first) {
                toast.info("No hay solicitudes pendientes")
                return
              }
              const account = accountForRequest(first)
              toast.info("Primera solicitud pendiente", {
                description: account?.company ?? "Cuenta de crédito",
              })
            }}
          >
            <ShieldCheck className="size-3.5" />
            Revisar solicitudes
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="Solicitudes pendientes"
          value={pendingRequests.length}
          helper="Recepción espera respuesta"
          tone={pendingRequests.length ? "warning" : "success"}
        />
        <AdminMetric
          label="Cuota vencida"
          value={overdueAccounts.length}
          helper="Empresas con fecha de pago vencida"
          tone={overdueAccounts.length ? "danger" : "success"}
        />
        <AdminMetric
          label="Crédito pausado"
          value={pausedAccounts.length}
          helper="No deberían operar sin aprobación"
          tone={pausedAccounts.length ? "danger" : "success"}
        />
        <AdminMetric
          label="Autorizadas"
          value={authorizedAccounts.length}
          helper="Operación permitida por admin"
          tone="info"
        />
      </section>

      {riskyAccounts.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Cuentas que necesitan criterio de administración</h2>
              <p className="mt-1 text-sm text-amber-900/80">
                Revisa vencimientos, saldo y margen antes de pausar o reanudar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {riskyAccounts.slice(0, 4).map((account) => (
                <CreditBadge key={account.id} health={account.health} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "solicitudes" | "cuentas" | "backend")
        }
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
          <TabsTrigger value="cuentas">CRUD de créditos</TabsTrigger>
          <TabsTrigger value="backend">Servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitudes" className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Solicitudes de autorización</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando recepción encuentra una cuenta pausada o vencida, la solicitud aparece aquí.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {pendingRequests.length} pendiente(s)
              </span>
            </div>

            {false ? (<div className="mt-5 grid gap-3">
              {pendingRequests.map(() => (
                <>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-semibold">
                    {editingAccountId ? "Editar credito asignado" : "Asignar credito a cliente/empresa"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Solo administracion puede crear, editar o quitar credito. Recepcion solo vera la etiqueta y reglas al reservar.
                  </p>
                </div>
                {editingAccountId ? (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={resetCreditForm}>
                    Cancelar edicion
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm font-medium">
                  Cliente guardado
                  <Input
                    value={guestSearch}
                    onChange={(event) => setGuestSearch(event.target.value)}
                    className="rounded-2xl"
                    placeholder="Buscar por nombre, NIT, DPI, telefono..."
                  />
                  <select
                    value={creditForm.guestId}
                    onChange={(event) => fillCreditFormFromGuest(event.target.value)}
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Empresa manual / sin cliente</option>
                    {filteredGuestOptions.map((guest) => (
                      <option key={guest.id} value={guest.id}>
                        {guest.name} · {guest.nit || guest.document}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Cliente / empresa
                  <Input
                    value={creditForm.company}
                    onChange={(event) => setCreditForm((current) => ({ ...current, company: event.target.value }))}
                    className="rounded-2xl"
                    placeholder="Nombre comercial o cliente"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Contacto
                  <Input
                    value={creditForm.contact}
                    onChange={(event) => setCreditForm((current) => ({ ...current, contact: event.target.value }))}
                    className="rounded-2xl"
                    placeholder="Responsable"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Telefono
                  <Input
                    value={creditForm.phone}
                    onChange={(event) => setCreditForm((current) => ({ ...current, phone: event.target.value }))}
                    className="rounded-2xl"
                    placeholder="+502 0000 0000"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Correo
                  <Input
                    value={creditForm.email}
                    onChange={(event) => setCreditForm((current) => ({ ...current, email: event.target.value }))}
                    className="rounded-2xl"
                    placeholder="correo@empresa.com"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Limite de credito (Q.)
                  <Input
                    type="number"
                    min={0}
                    value={creditForm.limit || ""}
                    onChange={(event) => setCreditForm((current) => ({ ...current, limit: event.target.value === "" ? 0 : Number(event.target.value) }))}
                    className="rounded-2xl"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Saldo usado (Q.)
                  <Input
                    type="number"
                    min={0}
                    value={creditForm.balance || ""}
                    onChange={(event) => setCreditForm((current) => ({ ...current, balance: event.target.value === "" ? 0 : Number(event.target.value) }))}
                    className="rounded-2xl"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Vencimiento
                  <Input
                    type="date"
                    value={creditForm.dueDate}
                    onChange={(event) => setCreditForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="rounded-2xl"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Estado financiero
                  <select
                    value={creditForm.status}
                    onChange={(event) => setCreditForm((current) => ({ ...current, status: event.target.value as CreditAccount["status"] }))}
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="al dia">Al dia</option>
                    <option value="por vencer">Por vencer</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Estado operativo
                  <select
                    value={creditForm.creditStatus}
                    onChange={(event) => setCreditForm((current) => ({ ...current, creditStatus: event.target.value as NonNullable<CreditAccount["creditStatus"]> }))}
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="autorizado">Autorizado por admin</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium md:col-span-2">
                  Nota administrativa
                  <Input
                    value={creditForm.authorizationNote}
                    onChange={(event) => setCreditForm((current) => ({ ...current, authorizationNote: event.target.value }))}
                    className="rounded-2xl"
                    placeholder="Motivo de bloqueo, autorizacion especial o comentario interno"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="rounded-full" onClick={resetCreditForm}>
                  Limpiar
                </Button>
                <Button className="gap-2 rounded-full" onClick={saveCreditAccount}>
                  <Plus className="size-4" />
                  {editingAccountId ? "Guardar credito" : "Asignar credito"}
                </Button>
              </div>
                </>
              ))}
            </div>

            ) : null}

            <div className="mt-5 grid gap-3">
              {pendingRequests.map((request) => {
                const account = accountForRequest(request)
                if (!account) return null

                return (
                  <article
                    key={request.id}
                    className="rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <Building2 className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{account.company}</h3>
                            <p className="text-sm text-muted-foreground">
                              Solicitado por {request.requestedBy} · {formatDate(request.requestedAt)}
                            </p>
                          </div>
                          <CreditBadge health={account.health} />
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {request.reason}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:w-[260px]">
                        <div className="rounded-2xl border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className="font-bold">{money(account.balance)}</p>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Vence</p>
                          <p className="font-bold">{formatDate(account.dueDate)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full border-red-200 text-red-800 hover:bg-red-50"
                        onClick={() =>
                          setPendingDialog({
                            title: "Rechazar solicitud",
                            description: `Recepción verá que ${account.company} necesita abono o revisión antes de operar al crédito.`,
                            confirmLabel: "Sí, rechazar",
                            tone: "danger",
                            onConfirm: () => resolveRequest(request, "rechazada"),
                          })
                        }
                      >
                        <XCircle className="size-4" />
                        Rechazar
                      </Button>
                      <Button
                        className="gap-2 rounded-full"
                        onClick={() =>
                          setPendingDialog({
                            title: "Autorizar crédito",
                            description: `Esto permitirá que ${account.company} vuelva a operar al crédito con autorización administrativa.`,
                            confirmLabel: "Sí, autorizar",
                            tone: "default",
                            onConfirm: () => resolveRequest(request, "aprobada"),
                          })
                        }
                      >
                        <ShieldCheck className="size-4" />
                        Autorizar crédito
                      </Button>
                    </div>
                  </article>
                )
              })}

              {pendingRequests.length === 0 ? (
                <div className="rounded-3xl border border-dashed p-10 text-center">
                  <p className="font-semibold">No hay solicitudes pendientes</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cuando recepción pida permiso para una cuenta pausada o vencida, aparecerá aquí.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          {resolvedRequests.length > 0 ? (
            <section className="rounded-3xl border bg-card p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Historial de decisiones</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {resolvedRequests.map((request) => {
                  const account = accountForRequest(request)
                  return (
                    <div key={request.id} className="rounded-2xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {account?.company ?? "Cuenta de crédito"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.resolvedBy ?? "Admin"} · {request.resolvedAt ? formatDate(request.resolvedAt) : "Sin fecha"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            request.status === "aprobada"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-red-50 text-red-800",
                          )}
                        >
                          {request.status === "aprobada" ? "Aprobada" : "Rechazada"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{request.notes}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="cuentas">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Control de cuentas al crédito</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pausa cuentas de riesgo o reanúdalas cuando administración lo autorice.
                </p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="rounded-2xl pl-9"
                  placeholder="Buscar empresa, contacto, estado..."
                />
              </div>
            </div>

            <div ref={creditFormRef} className="mt-5 rounded-3xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-semibold">
                    {editingAccountId ? "Editar credito asignado" : "Asignar credito a cliente/empresa"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Solo administracion puede crear, editar o quitar credito. Recepcion solo vera la etiqueta y reglas al reservar.
                  </p>
                </div>
                {editingAccountId ? (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={resetCreditForm}>
                    Cancelar edicion
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm font-medium">
                  Cliente guardado
                  <Input
                    value={guestSearch}
                    onChange={(event) => setGuestSearch(event.target.value)}
                    className="rounded-2xl"
                    placeholder="Buscar por nombre, NIT, DPI, telefono..."
                  />
                  <select
                    value={creditForm.guestId}
                    onChange={(event) => fillCreditFormFromGuest(event.target.value)}
                    className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Empresa manual / sin cliente</option>
                    {filteredGuestOptions.map((guest) => (
                      <option key={guest.id} value={guest.id}>
                        {guest.name} · {guest.nit || guest.document}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Cliente / empresa
                  <Input value={creditForm.company} onChange={(event) => setCreditForm((current) => ({ ...current, company: event.target.value }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Limite de credito (Q.)
                  <Input type="number" min={0} value={creditForm.limit || ""} onChange={(event) => setCreditForm((current) => ({ ...current, limit: event.target.value === "" ? 0 : Number(event.target.value) }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Saldo usado (Q.)
                  <Input type="number" min={0} value={creditForm.balance || ""} onChange={(event) => setCreditForm((current) => ({ ...current, balance: event.target.value === "" ? 0 : Number(event.target.value) }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Vencimiento
                  <Input type="date" value={creditForm.dueDate} onChange={(event) => setCreditForm((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Estado financiero
                  <select value={creditForm.status} onChange={(event) => setCreditForm((current) => ({ ...current, status: event.target.value as CreditAccount["status"] }))} className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <option value="al dia">Al dia</option>
                    <option value="por vencer">Por vencer</option>
                    <option value="vencido">Vencido</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Estado operativo
                  <select value={creditForm.creditStatus} onChange={(event) => setCreditForm((current) => ({ ...current, creditStatus: event.target.value as NonNullable<CreditAccount["creditStatus"]> }))} className="h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="autorizado">Autorizado por admin</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Contacto
                  <Input value={creditForm.contact} onChange={(event) => setCreditForm((current) => ({ ...current, contact: event.target.value }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Telefono
                  <Input value={creditForm.phone} onChange={(event) => setCreditForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Correo
                  <Input value={creditForm.email} onChange={(event) => setCreditForm((current) => ({ ...current, email: event.target.value }))} className="rounded-2xl" />
                </label>

                <label className="space-y-2 text-sm font-medium xl:col-span-2">
                  Nota administrativa
                  <Input value={creditForm.authorizationNote} onChange={(event) => setCreditForm((current) => ({ ...current, authorizationNote: event.target.value }))} className="rounded-2xl" placeholder="Motivo de bloqueo, autorizacion especial o comentario interno" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="rounded-full" onClick={resetCreditForm}>Limpiar</Button>
                <Button className="gap-2 rounded-full" onClick={saveCreditAccount}>
                  <Plus className="size-4" />
                  {editingAccountId ? "Guardar credito" : "Asignar credito"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {filteredAccounts.map((account) => (
                <article
                  key={account.id}
                  className="rounded-3xl border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                          <Building2 className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{account.company}</h3>
                          <p className="text-sm text-muted-foreground">
                            {account.contact} · {account.phone}
                          </p>
                        </div>
                        <CreditBadge health={account.health} />
                      </div>
                      {account.authorizationNote ? (
                        <p className="mt-3 max-w-3xl rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                          {account.authorizationNote}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
                      <div className="rounded-2xl border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-bold">{money(account.balance)}</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Disponible</p>
                        <p className="font-bold">{money(account.available)}</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Vence</p>
                        <p className="font-bold">{formatDate(account.dueDate)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={() => editCreditAccount(account)}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>

                    {account.authorized ? (
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full"
                        onClick={() =>
                          setPendingDialog({
                            title: "Quitar autorización",
                            description: `${account.company} volverá a seguir la regla normal de crédito según saldo y vencimiento.`,
                            confirmLabel: "Quitar autorización",
                            tone: "default",
                            onConfirm: () => updateCreditStatus(account, "activo"),
                          })
                        }
                      >
                        <LockKeyhole className="size-4" />
                        Quitar autorización
                      </Button>
                    ) : null}

                    {account.blocked ? (
                      <Button
                        className="gap-2 rounded-full"
                        onClick={() =>
                          setPendingDialog({
                            title: "Reanudar credito bloqueado",
                            description: `${account.company} volvera a operar segun su saldo y vencimiento.`,
                            confirmLabel: "Reanudar",
                            tone: "default",
                            onConfirm: () => updateCreditStatus(account, nextResumeStatus(account)),
                          })
                        }
                      >
                        <Unlock className="size-4" />
                        Reanudar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full border-red-300 text-red-900 hover:bg-red-50"
                        onClick={() =>
                          setPendingDialog({
                            title: "Bloquear credito",
                            description: `${account.company} no podra operar al credito hasta que administracion lo reactive.`,
                            confirmLabel: "Si, bloquear",
                            tone: "danger",
                            onConfirm: () => updateCreditStatus(account, "bloqueado"),
                          })
                        }
                      >
                        <LockKeyhole className="size-4" />
                        Bloquear
                      </Button>
                    )}

                    {account.paused ? (
                      <Button
                        className="gap-2 rounded-full"
                        onClick={() =>
                          setPendingDialog({
                            title: "Reanudar crédito",
                            description: `${account.company} podrá operar de nuevo. Si tiene cuota vencida, quedará marcado como autorizado por administración.`,
                            confirmLabel: "Sí, reanudar",
                            tone: "default",
                            onConfirm: () =>
                              updateCreditStatus(account, nextResumeStatus(account)),
                          })
                        }
                      >
                        <Unlock className="size-4" />
                        Reanudar crédito
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="gap-2 rounded-full border-red-200 text-red-800 hover:bg-red-50"
                        onClick={() =>
                          setPendingDialog({
                            title: "Pausar crédito",
                            description: `${account.company} no debería operar al crédito hasta que administración lo reactive.`,
                            confirmLabel: "Sí, pausar",
                            tone: "danger",
                            onConfirm: () => updateCreditStatus(account, "pausado"),
                          })
                        }
                      >
                        <Ban className="size-4" />
                        Pausar crédito
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="gap-2 rounded-full border-red-200 text-red-800 hover:bg-red-50"
                      onClick={() =>
                        setPendingDialog({
                          title: "Eliminar cuenta de credito",
                          description: `Esto quitara el credito asignado a ${account.company} y su historial operativo asociado.`,
                          confirmLabel: "Eliminar credito",
                          tone: "danger",
                          onConfirm: () => deleteCreditAccount(account),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="backend">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Endpoints para Control de créditos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contrato para que administración pueda pausar, reanudar y resolver solicitudes sin depender de recepción.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {[
                ["GET", "/api/credit/accounts", "Listado de empresas con límite, saldo, vencimiento, estado financiero y estado operativo del crédito."],
                ["POST", "/api/credit/accounts", "Crear cuenta de credito para cliente guardado o empresa manual. Accion exclusiva de administracion."],
                ["PATCH", "/api/credit/accounts/{id}", "Editar limite, saldo usado, vencimiento, contacto y estado operativo del credito."],
                ["DELETE", "/api/credit/accounts/{id}", "Eliminar cuenta de credito y su historial operativo asociado."],
                ["PATCH", "/api/credit/accounts/{id}/pause", "Pausar crédito desde administración, guardando usuario, motivo y fecha."],
                ["PATCH", "/api/credit/accounts/{id}/reactivate", "Reactivar credito desde administracion, guardando usuario, motivo y fecha."],
                ["PATCH", "/api/credit/accounts/{id}/block", "Bloquear credito desde administracion cuando la cuenta no debe operar."],
                ["GET", "/api/credit/authorization-requests", "Solicitudes pendientes, aprobadas y rechazadas enviadas por recepción."],
                ["PATCH", "/api/credit/authorization-requests/{id}/approve", "Aprobar solicitud y marcar la cuenta como autorizada por administración."],
                ["PATCH", "/api/credit/authorization-requests/{id}/reject", "Rechazar solicitud con nota visible para recepción."],
                ["GET", "/api/credit/accounts/{id}/statement", "Estado de cuenta imprimible de la cuenta seleccionada."],
              ].map(([method, endpoint, description]) => (
                <div key={endpoint} className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                      {method}
                    </span>
                    <code className="text-sm font-semibold">{endpoint}</code>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(pendingDialog)}
        onOpenChange={(open) => {
          if (!open) setPendingDialog(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "rounded-full",
                pendingDialog?.tone === "danger"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              onClick={pendingDialog?.onConfirm}
            >
              {pendingDialog?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AdminCreditosPage
