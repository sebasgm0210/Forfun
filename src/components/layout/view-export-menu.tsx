import { useMemo, useState } from "react"
import { CalendarDays, Download, FileSpreadsheet, FileText, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { exportCurrentView, type ViewExportFormat } from "@/lib/view-export"

type ViewExportMenuProps = {
  title: string
}

const exportOptions: Array<{
  format: ViewExportFormat
  label: string
  description: string
  icon: typeof FileText
}> = [
  {
    format: "excel",
    label: "Excel",
    description: "Libro de calculo con indicadores, graficas y tablas.",
    icon: FileSpreadsheet,
  },
  {
    format: "word",
    label: "Word",
    description: "Documento .doc con layout de reporte.",
    icon: FileText,
  },
  {
    format: "pdf",
    label: "Documento",
    description: "Abre el reporte para guardarlo como documento.",
    icon: Download,
  },
  {
    format: "print",
    label: "Imprimir",
    description: "Abre la impresion del reporte limpio.",
    icon: Printer,
  },
]

export function ViewExportMenu({ title }: ViewExportMenuProps) {
  const today = useMemo(() => localDateValue(), [])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [rangeFrom, rangeTo] = useMemo(() => normalizeRange(from, to, today), [from, to, today])
  const periodLabel = rangeFrom === rangeTo ? formatShortDate(rangeFrom) : `${formatShortDate(rangeFrom)} - ${formatShortDate(rangeTo)}`

  function handleExport(format: ViewExportFormat) {
    exportCurrentView({ title, format, from: rangeFrom, to: rangeTo })

    if (format === "pdf") {
      toast.success(`Vista lista para guardar como documento: ${periodLabel}`)
      return
    }

    if (format === "print") {
      toast.success(`Vista lista para imprimir: ${periodLabel}`)
      return
    }

    toast.success(`Reporte ${format === "excel" ? "Excel" : "Word"} generado: ${periodLabel}`)
  }

  function applyQuickRange(days: number) {
    const end = new Date(`${today}T00:00:00`)
    const start = new Date(end)
    start.setDate(end.getDate() - (days - 1))
    setFrom(localDateValue(start))
    setTo(localDateValue(end))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="hidden gap-2 rounded-full sm:inline-flex"
          aria-label="Exportar vista"
          title="Exportar vista"
          data-export-exclude
        >
          <Download className="size-3.5" />
          <span className="hidden 2xl:inline">Exportar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]" data-export-exclude>
        <div
          className="space-y-3 px-2 py-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium leading-none">Periodo del reporte</p>
              <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Desde
              <Input
                aria-label="Desde"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-8 text-xs"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Hasta
              <Input
                aria-label="Hasta"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-8 text-xs"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => applyQuickRange(1)}>
              Hoy
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => applyQuickRange(7)}>
              7 dias
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => applyQuickRange(30)}>
              30 dias
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {exportOptions.map((option) => {
          const Icon = option.icon

          return (
            <DropdownMenuItem
              key={option.format}
              className="flex items-start gap-2"
              onClick={() => handleExport(option.format)}
            >
              <Icon className="mt-0.5 size-4" />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function normalizeRange(from: string, to: string, fallback: string): [string, string] {
  const safeFrom = from || to || fallback
  const safeTo = to || from || fallback
  return safeFrom <= safeTo ? [safeFrom, safeTo] : [safeTo, safeFrom]
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}
