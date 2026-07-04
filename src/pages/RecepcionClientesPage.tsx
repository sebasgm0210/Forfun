import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react"
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate, formatQ, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { CreditAccount, Guest, Reservation } from "@/lib/types"

type ClientFilter = "todos" | "comunes" | "frecuentes" | "crédito"

const countries = [
  "Afganistán",
  "Albania",
  "Alemania",
  "Andorra",
  "Angola",
  "Antigua y Barbuda",
  "Arabia Saudita",
  "Argelia",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaiyán",
  "Bahamas",
  "Baréin",
  "Bangladés",
  "Barbados",
  "Bélgica",
  "Belice",
  "Benín",
  "Bielorrusia",
  "Bolivia",
  "Bosnia y Herzegovina",
  "Botsuana",
  "Brasil",
  "Brunéi",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Bután",
  "Cabo Verde",
  "Camboya",
  "Camerún",
  "Canadá",
  "Catar",
  "Chad",
  "Chile",
  "China",
  "Chipre",
  "Colombia",
  "Comoras",
  "Congo",
  "Corea del Norte",
  "Corea del Sur",
  "Costa de Marfil",
  "Costa Rica",
  "Croacia",
  "Cuba",
  "Dinamarca",
  "Dominica",
  "Ecuador",
  "Egipto",
  "El Salvador",
  "Emiratos Árabes Unidos",
  "Eritrea",
  "Eslovaquia",
  "Eslovenia",
  "España",
  "Estados Unidos",
  "Estonia",
  "Esuatini",
  "Etiopía",
  "Filipinas",
  "Finlandia",
  "Fiyi",
  "Francia",
  "Gabón",
  "Gambia",
  "Georgia",
  "Ghana",
  "Granada",
  "Grecia",
  "Guatemala",
  "Guinea",
  "Guinea-Bisáu",
  "Guinea Ecuatorial",
  "Guyana",
  "Haití",
  "Honduras",
  "Hungría",
  "India",
  "Indonesia",
  "Irak",
  "Irán",
  "Irlanda",
  "Islandia",
  "Islas Marshall",
  "Islas Salomón",
  "Israel",
  "Italia",
  "Jamaica",
  "Japón",
  "Jordania",
  "Kazajistán",
  "Kenia",
  "Kirguistán",
  "Kiribati",
  "Kuwait",
  "Laos",
  "Lesoto",
  "Letonia",
  "Líbano",
  "Liberia",
  "Libia",
  "Liechtenstein",
  "Lituania",
  "Luxemburgo",
  "Madagascar",
  "Malasia",
  "Malaui",
  "Maldivas",
  "Malí",
  "Malta",
  "Marruecos",
  "Mauricio",
  "Mauritania",
  "México",
  "Micronesia",
  "Moldavia",
  "Mónaco",
  "Mongolia",
  "Montenegro",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Nicaragua",
  "Níger",
  "Nigeria",
  "Noruega",
  "Nueva Zelanda",
  "Omán",
  "Países Bajos",
  "Pakistán",
  "Palaos",
  "Panamá",
  "Papúa Nueva Guinea",
  "Paraguay",
  "Perú",
  "Polonia",
  "Portugal",
  "Reino Unido",
  "República Centroafricana",
  "República Checa",
  "República Democrática del Congo",
  "República Dominicana",
  "Ruanda",
  "Rumania",
  "Rusia",
  "Samoa",
  "San Cristóbal y Nieves",
  "San Marino",
  "San Vicente y las Granadinas",
  "Santa Lucía",
  "Santo Tomé y Príncipe",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leona",
  "Singapur",
  "Siria",
  "Somalia",
  "Sri Lanka",
  "Sudáfrica",
  "Sudán",
  "Sudán del Sur",
  "Suecia",
  "Suiza",
  "Surinam",
  "Tailandia",
  "Tanzania",
  "Tayikistán",
  "Timor Oriental",
  "Togo",
  "Tonga",
  "Trinidad y Tobago",
  "Túnez",
  "Turkmenistán",
  "Turquía",
  "Tuvalu",
  "Ucrania",
  "Uganda",
  "Uruguay",
  "Uzbekistán",
  "Vanuatu",
  "Vaticano",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Yibuti",
  "Zambia",
  "Zimbabue",
]

const guatemalaDepartments = [
  "Alta Verapaz",
  "Baja Verapaz",
  "Chimaltenango",
  "Chiquimula",
  "El Progreso",
  "Escuintla",
  "Guatemala",
  "Huehuetenango",
  "Izabal",
  "Jalapa",
  "Jutiapa",
  "Petén",
  "Quetzaltenango",
  "Quiché",
  "Retalhuleu",
  "Sacatepéquez",
  "San Marcos",
  "Santa Rosa",
  "Sololá",
  "Suchitepéquez",
  "Totonicapán",
  "Zacapa",
]

const emptyForm = {
  name: "",
  document: "",
  documentType: "DPI" as Guest["documentType"],
  nit: "",
  phone: "",
  email: "",
  country: "Guatemala",
  department: "Guatemala",
  notes: "",
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

const FREQUENT_BENEFIT_BLOCK_TOKEN = "[BENEFICIO_FRECUENTE_RETIRADO]"

function hasFrequentBenefitBlocked(guest: Guest) {
  return (guest.notes ?? "").includes(FREQUENT_BENEFIT_BLOCK_TOKEN)
}

function visibleGuestNotes(notes?: string) {
  return (notes ?? "")
    .replace(FREQUENT_BENEFIT_BLOCK_TOKEN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function appendFrequentBlockToken(notes?: string) {
  const cleanNotes = visibleGuestNotes(notes)
  return [cleanNotes, FREQUENT_BENEFIT_BLOCK_TOKEN].filter(Boolean).join("\n")
}

function removeFrequentBlockToken(notes?: string) {
  return visibleGuestNotes(notes)
}

function stayCountForClient(guestId: string, reservations: Reservation[]) {
  return reservations.filter(
    (reservation) =>
      reservation.guestId === guestId &&
      !["cancelada", "no-show"].includes(reservation.status),
  ).length
}

function lastStayForClient(guestId: string, reservations: Reservation[]) {
  return reservations
    .filter((reservation) => reservation.guestId === guestId)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0]
}

function creditAccountForGuest(guest: Guest, creditAccounts: CreditAccount[]) {
  const guestName = normalizeSearch(guest.name)
  return creditAccounts.find(
    (account) =>
      account.guestId === guest.id ||
      normalizeSearch(account.company) === guestName,
  )
}

export function RecepcionClientesPage() {
  const { creditAccounts, guests, reservations, dispatch } = useStore()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ClientFilter>("todos")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formVisible, setFormVisible] = useState(true)
  const [formMessage, setFormMessage] = useState<{
    tone: "success" | "deleted"
    text: string
  } | null>(null)
  const [deletingClient, setDeletingClient] = useState<Guest | null>(null)
  const [frequentAnimation, setFrequentAnimation] = useState<{
    guestId: string
    type: "mark" | "remove"
  } | null>(null)
  const messageTimer = useRef<number | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  const enrichedClients = useMemo(
    () =>
      guests.map((guest) => {
        const stays = stayCountForClient(guest.id, reservations)
        const lastStay = lastStayForClient(guest.id, reservations)
        const manualFrequent = false
        const automaticFrequent = stays >= 3
        const frequentBenefitBlocked = false
        const frequent = automaticFrequent
        const creditAccount = creditAccountForGuest(guest, creditAccounts)
        return {
          guest,
          stays,
          lastStay,
          frequent,
          manualFrequent,
          automaticFrequent,
          frequentBenefitBlocked,
          creditAccount,
        }
      }),
    [creditAccounts, guests, reservations],
  )

  const filteredClients = useMemo(() => {
    const text = normalizeSearch(query)

    return enrichedClients.filter(({ guest, frequent, automaticFrequent, frequentBenefitBlocked, creditAccount }) => {
      const common = !frequent && !creditAccount
      const matchesFilter =
        filter === "todos" ||
        (filter === "comunes" && common) ||
        (filter === "frecuentes" && frequent) ||
        (filter === "crédito" && Boolean(creditAccount))

      const matchesSearch =
        !text ||
        normalizeSearch(
          [
            guest.name,
            guest.document,
            guest.nit,
            guest.phone,
            guest.email,
            guest.country,
            guest.department,
            frequent ? "frecuente" : "común normal",
            automaticFrequent ? "califica por historial" : "",
            creditAccount ? "crédito al crédito" : "",
          ].join(" "),
        ).includes(text)

      return matchesFilter && matchesSearch
    })
  }, [enrichedClients, filter, query])

  const frequentCount = enrichedClients.filter((client) => client.frequent).length
  const creditCount = enrichedClients.filter((client) => client.creditAccount).length
  const commonCount = enrichedClients.filter(
    (client) => !client.frequent && !client.creditAccount,
  ).length

  function showFormMessage(tone: "success" | "deleted", text: string) {
    if (messageTimer.current) {
      window.clearTimeout(messageTimer.current)
    }
    setFormMessage({ tone, text })
    messageTimer.current = window.setTimeout(() => {
      setFormMessage(null)
      messageTimer.current = null
    }, 4200)
  }

  function swapForm(next: () => void) {
    setFormVisible(false)
    window.setTimeout(() => {
      next()
      setFormVisible(true)
    }, 160)
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function editClient(guest: Guest) {
    swapForm(() => {
      setFormMessage(null)
      setEditingId(guest.id)
      setForm({
        name: guest.name,
        document: guest.document,
        documentType: guest.documentType,
        nit: guest.nit ?? "",
        phone: guest.phone ?? "",
        email: guest.email ?? "",
        country: guest.country,
        department:
          guest.country === "Guatemala"
            ? guest.department ?? "Guatemala"
            : "",
        notes: visibleGuestNotes(guest.notes),
      })
    })
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 220)
  }

  function setCountry(country: string) {
    setForm((current) => ({
      ...current,
      country,
      department:
        country === "Guatemala"
          ? current.department || "Guatemala"
          : "",
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !form.name.trim() ||
      !form.document.trim() ||
      !form.nit.trim() ||
      !form.phone.trim()
    ) return

    const guestId = editingId ?? `g-${Date.now()}`

    const existingGuest = editingId
      ? guests.find((guest) => guest.id === editingId)
      : undefined
    const cleanNotes = form.notes.trim()

    const payload: Guest = {
      id: guestId,
      name: form.name.trim(),
      document: form.document.trim(),
      documentType: form.documentType,
      nit: form.nit.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      country: form.country.trim() || "Guatemala",
      department: form.country === "Guatemala" ? form.department : undefined,
      notes: cleanNotes,
    }

    if (editingId) {
      dispatch({ type: "GUEST_UPDATE", id: editingId, patch: payload })
      showFormMessage("success", "Cambios guardados correctamente.")
    } else {
      dispatch({ type: "GUEST_CREATE", guest: payload })
      showFormMessage("success", "Nuevo cliente agregado correctamente.")
    }

    resetForm()
  }


  function confirmDeleteClient() {
    if (!deletingClient) return
    dispatch({ type: "GUEST_DELETE", id: deletingClient.id })
    if (editingId === deletingClient.id) {
      resetForm()
    }
    showFormMessage("deleted", "Cliente eliminado correctamente.")
    setDeletingClient(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recepción"
        title="Clientes"
        description="Administra los huéspedes del hotel, identifica clientes comunes, frecuentes y al crédito, y mantén la información lista para nuevas reservaciones."
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
        <div className="min-w-0">
          <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">Guía rápida para clientes</h2>
          <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">
            Usa esta pantalla para encontrar o guardar los datos de una persona antes de reservar o facturar.
          </p>
        </div>

        <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
          {[
            {
              icon: Search,
              title: "Busca primero",
              text: "Antes de crear uno nuevo, revisa si el cliente ya está guardado.",
            },
            {
              icon: UserRound,
              title: "Completa lo básico",
              text: "Nombre, documento, NIT y teléfono ayudan a reservar y facturar sin atrasos.",
            },
            {
              icon: Pencil,
              title: "Corrige datos",
              text: "Si el teléfono, correo o NIT está mal, cámbialo aquí para que quede listo.",
            },
            {
              icon: BadgeCheck,
              title: "Revisa historial",
              text: "El sistema marca como frecuente al cliente desde su tercera estadía registrada.",
            },
          ].map((step, index) => {
            const StepIcon = step.icon

            return (
              <div key={step.title} className="min-w-0 rounded-xl border bg-white/75 p-2.5 sm:rounded-2xl sm:p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 sm:size-8 sm:rounded-xl">
                    <StepIcon className="size-4" />
                  </div>
                  <span className="mobile-safe-text text-[0.65rem] font-bold uppercase tracking-wide text-blue-700 sm:text-xs">
                    Paso {index + 1}
                  </span>
                </div>
                <p className="mobile-safe-text mt-2 text-sm font-semibold sm:mt-3 sm:text-base">{step.title}</p>
                <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/75 sm:text-sm">{step.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-card p-3 shadow-sm sm:rounded-3xl sm:p-4">
          <p className="mobile-safe-text text-xs text-muted-foreground sm:text-sm">Clientes registrados</p>
          <p className="mobile-safe-text mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">{guests.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-950 shadow-sm sm:rounded-3xl sm:p-4">
          <p className="mobile-safe-text text-xs sm:text-sm">Frecuentes</p>
          <p className="mobile-safe-text mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">{frequentCount}</p>
          <p className="mobile-safe-text mt-1 text-[0.7rem] leading-4 sm:text-xs">3 o más estadías registradas</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 text-blue-950 shadow-sm sm:rounded-3xl sm:p-4">
          <p className="mobile-safe-text text-xs sm:text-sm">Al crédito</p>
          <p className="mobile-safe-text mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">{creditCount}</p>
          <p className="mobile-safe-text mt-1 text-[0.7rem] leading-4 sm:text-xs">Con límite asignado</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-slate-950 shadow-sm sm:rounded-3xl sm:p-4">
          <p className="mobile-safe-text text-xs sm:text-sm">Comúnes</p>
          <p className="mobile-safe-text mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">{commonCount}</p>
          <p className="mobile-safe-text mt-1 text-[0.7rem] leading-4 sm:text-xs">Menos de 3 estadías</p>
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[360px_1fr]">
        <form
          ref={formRef}
          key={editingId ?? "new-client"}
          onSubmit={handleSubmit}
          className={cn(
            "rounded-3xl border bg-card p-5 shadow-sm transition-all duration-200",
            formVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "-translate-y-2 scale-[0.98] opacity-0",
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {editingId ? "Editar cliente" : "Nuevo cliente"}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {editingId ? "Actualizar datos" : "Agregar cliente"}
              </h2>
            </div>
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => swapForm(resetForm)}
              >
                Cancelar
              </Button>
            ) : null}
          </div>

          {formMessage ? (
            <div
              className={cn(
                "mb-4 rounded-2xl border px-3 py-2 text-sm font-medium animate-in fade-in-0 slide-in-from-top-1 duration-300",
                formMessage.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900",
              )}
            >
              {formMessage.text}
            </div>
          ) : null}

          <div className="space-y-3">
            <ClientField label="Nombre / empresa">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-2xl"
                placeholder="Ej. Andrea Morales"
              />
            </ClientField>

            <div className="grid grid-cols-[120px_1fr] gap-2">
              <ClientField label="Tipo">
                <select
                  value={form.documentType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documentType: event.target.value as Guest["documentType"],
                    }))
                  }
                  className="h-9 w-full rounded-2xl border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option>DPI</option>
                  <option>Pasaporte</option>
                </select>
              </ClientField>

              <ClientField label="Documento">
                <Input
                  value={form.document}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      document: event.target.value,
                    }))
                  }
                  className="rounded-2xl"
                  placeholder={form.documentType === "DPI" ? "Número de DPI" : "Número de pasaporte"}
                />
              </ClientField>
            </div>

            <ClientField label="NIT para facturación FEL">
              <Input
                value={form.nit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nit: event.target.value,
                  }))
                }
                className="rounded-2xl"
                placeholder="Ej. 1234567-8 o CF"
              />
            </ClientField>

            <ClientField label="Teléfono">
              <Input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="rounded-2xl"
                placeholder="+502 5555 5555"
              />
            </ClientField>

            <ClientField label="Correo">
              <Input
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="rounded-2xl"
                placeholder="Opcional"
              />
            </ClientField>

            <ClientField label="País">
              <CountryCombobox value={form.country} onChange={setCountry} />
            </ClientField>

            {form.country === "Guatemala" ? (
              <ClientField label="Departamento">
                <DepartmentCombobox
                  value={form.department}
                  onChange={(department) =>
                    setForm((current) => ({
                      ...current,
                      department,
                    }))
                  }
                />
              </ClientField>
            ) : null}

            {form.country !== "Guatemala" ? (
              <div className="rounded-2xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                El departamento solo se solicita para clientes de Guatemala.
              </div>
            ) : null}

            <ClientField label="Notas">
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="min-h-24 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Preferencias, empresa, alergias, observaciones de recepción..."
              />
            </ClientField>
          </div>

          <Button
            type="submit"
            className="mt-5 w-full rounded-2xl"
            disabled={
              !form.name.trim() ||
              !form.document.trim() ||
              !form.nit.trim() ||
              !form.phone.trim()
            }
          >
            <Plus className="size-4" />
            {editingId ? "Guardar cambios" : "Agregar cliente"}
          </Button>
        </form>

        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Listado de clientes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Busca, filtra e identifica clientes comunes, frecuentes y al crédito.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-2xl pl-9"
                placeholder="Buscar cliente, DPI, teléfono, crédito..."
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["todos", "Todos"],
              ["comunes", "Comunes"],
              ["frecuentes", "Frecuentes"],
              ["crédito", "Al crédito"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {filteredClients.map(({ guest, stays, lastStay, frequent, manualFrequent, automaticFrequent, frequentBenefitBlocked, creditAccount }) => (
              <article
                key={guest.id}
                className="relative overflow-hidden rounded-3xl border bg-background p-4 transition hover:border-primary/30 hover:shadow-sm"
              >
                {frequentAnimation?.guestId === guest.id ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute right-6 top-5 z-10 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm",
                      frequentAnimation.type === "mark"
                        ? "animate-frequent-hop border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "animate-frequent-trash border-red-200 bg-red-50 text-red-800",
                    )}
                  >
                    {frequentAnimation.type === "mark" ? (
                      <BadgeCheck className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Frecuente
                  </div>
                ) : null}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <UserRound className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{guest.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {guest.documentType} {guest.document} · {guest.country}
                          {guest.department ? `, ${guest.department}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          NIT FEL: {guest.nit || "Pendiente"}
                        </p>
                      </div>
                      <ClientStatusTags frequent={frequent} manualFrequent={manualFrequent} automaticFrequent={automaticFrequent} benefitBlocked={frequentBenefitBlocked} creditAccount={creditAccount} />
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 2xl:grid-cols-[minmax(120px,0.8fr)_minmax(220px,1.7fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(140px,1fr)]">
                      <p className="flex min-w-0 items-center gap-2">
                        <Phone className="size-4 shrink-0 text-primary" />
                        {guest.phone || "Sin teléfono"}
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <Mail className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 break-all">{guest.email || "Sin correo"}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-primary" />
                        {stays} estadía(s)
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <Sparkles className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 break-words">
                          {lastStay ? formatDate(lastStay.checkIn) : "Sin reservas"}
                        </span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 break-words">
                          {guest.country === "Guatemala" && guest.department
                            ? guest.department
                            : guest.country}
                        </span>
                      </p>
                    </div>

                    {visibleGuestNotes(guest.notes) ? (
                      <p className="mt-3 rounded-2xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {visibleGuestNotes(guest.notes)}
                      </p>
                    ) : null}

                    {creditAccount ? (
                      <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <CreditCard className="size-4" />
                        <span className="font-semibold">Crédito asignado</span>
                        <span>
                          Límite {formatQ(creditAccount.limit)} - saldo {formatQ(creditAccount.balance)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => editClient(guest)}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-destructive hover:text-destructive"
                      onClick={() => setDeletingClient(guest)}
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </article>
            ))}

            {filteredClients.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No hay clientes que coincidan con ese filtro.
              </div>
            ) : null}
          </div>
        </section>
      </section>



      <AlertDialog
        open={Boolean(deletingClient)}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar a {deletingClient?.name}? Esta acción
              se guardará en el sistema y la lista se recargará con los datos vigentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteClient}
            >
              Sí, eliminar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ClientStatusTags({
  frequent,
  manualFrequent,
  automaticFrequent,
  benefitBlocked,
  creditAccount,
}: {
  frequent: boolean
  manualFrequent: boolean
  automaticFrequent: boolean
  benefitBlocked: boolean
  creditAccount?: CreditAccount
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {!frequent && !creditAccount ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <UserRound className="size-3.5" />
          Común
        </span>
      ) : null}
      {frequent ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <BadgeCheck className="size-3.5" />
          Frecuente
        </span>
      ) : null}
      {creditAccount ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
          <CreditCard className="size-3.5" />
          Al crédito
        </span>
      ) : null}
    </div>
  )
}

function ClientField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function CountryCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-2xl bg-background px-3 font-normal"
        >
          <span className="truncate">{value || "Seleccionar país"}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(country, search) =>
            normalizeSearch(country).startsWith(normalizeSearch(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Escribe GU, ESPA, ES..." />
          <CommandList>
            <CommandEmpty>No hay países con ese inicio.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country}
                  value={country}
                  onSelect={() => {
                    onChange(country)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === country ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{country}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function DepartmentCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-2xl bg-background px-3 font-normal"
        >
          <span className="truncate">{value || "Seleccionar departamento"}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(department, search) =>
            normalizeSearch(department).startsWith(normalizeSearch(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Escribe GUA, SACA, QUET..." />
          <CommandList>
            <CommandEmpty>No hay departamentos con ese inicio.</CommandEmpty>
            <CommandGroup>
              {guatemalaDepartments.map((department) => (
                <CommandItem
                  key={department}
                  value={department}
                  onSelect={() => {
                    onChange(department)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === department ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{department}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default RecepcionClientesPage
