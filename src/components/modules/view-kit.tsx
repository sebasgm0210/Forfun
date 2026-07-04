import type { ComponentProps, ReactNode } from "react"
import { ArrowRight, CircleCheck, CircleDashed, Download, FileSpreadsheet, FileText, Printer, ShieldCheck, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportCurrentView } from "@/lib/view-export"
import { cn } from "@/lib/utils"

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted"

const toneClass: Record<Tone, string> = {
  default: "border-border bg-card text-foreground",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  muted: "border-muted bg-muted/50 text-muted-foreground",
}

export function StatusPill({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  return <Badge variant="outline" className={cn("rounded-full capitalize", toneClass[tone])}>{children}</Badge>
}

export function StatCard({ label, value, helper, tone = "default" }: { label: string; value: ReactNode; helper?: string; tone?: Tone }) {
  return (
    <Card className={cn("min-w-0 overflow-hidden border-dashed", toneClass[tone])}>
      <CardHeader className="pb-2">
        <CardDescription className="mobile-safe-text text-xs uppercase tracking-[0.22em]">{label}</CardDescription>
        <CardTitle className="mobile-safe-text text-xl font-semibold tracking-tight sm:text-2xl">{value}</CardTitle>
      </CardHeader>
      {helper && <CardContent className="mobile-safe-text pt-0 text-xs text-muted-foreground">{helper}</CardContent>}
    </Card>
  )
}

export function SectionCard({ title, description, children, actions, className }: { title: string; description?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0 border-border/70 bg-card/95 shadow-sm", className)}>
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <CardTitle className="mobile-safe-text font-serif text-xl font-light tracking-tight">{title}</CardTitle>
          {description && <CardDescription className="mt-1 max-w-2xl leading-relaxed">{description}</CardDescription>}
        </div>
        {actions && <div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

export function EmptyAction({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/25 p-6 text-center">
      <CircleDashed className="mx-auto mb-3 size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function ExportActions() {
  const printPdf = () => {
    exportCurrentView({ title: document.title || "Reporte", format: "pdf" })
    toast.success("Vista lista para guardar como documento")
  }

  const printView = () => {
    exportCurrentView({ title: document.title || "Reporte", format: "print" })
    toast.success("Reporte listo para imprimir")
  }

  const exportExcel = () => {
    exportCurrentView({ title: document.title || "Reporte", format: "excel" })
    toast.success("Excel generado")
  }

  const exportWord = () => {
    exportCurrentView({ title: document.title || "Reporte", format: "word" })
    toast.success("Word generado")
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={printPdf}><Download className="size-3.5" />Documento</Button>
      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={exportExcel}><FileSpreadsheet className="size-3.5" />Excel</Button>
      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={exportWord}><FileText className="size-3.5" />Word</Button>
      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={printView}><Printer className="size-3.5" />Imprimir</Button>
    </>
  )
}

export function MiniTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="touch-scroll max-w-full overflow-x-auto rounded-2xl border bg-background/60">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow className="bg-muted/50">
            {headers.map((header) => <TableHead key={header} className="whitespace-nowrap text-xs uppercase tracking-[0.18em] text-muted-foreground">{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => <TableCell key={cellIndex} className="mobile-safe-text max-w-[320px] align-top text-sm">{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function FieldGrid({ items }: { items: Array<{ label: string; value: ReactNode; helper?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-background/60 p-3 sm:rounded-2xl sm:p-4">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground sm:tracking-[0.22em]">{item.label}</p>
          <div className="mt-1 font-medium">{item.value}</div>
          {item.helper && <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>}
        </div>
      ))}
    </div>
  )
}

export function Workflow({ steps }: { steps: Array<{ title: string; description: string; done?: boolean }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.title} className="rounded-2xl border bg-white/70 p-3 text-blue-950">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-blue-100 text-blue-700">
              {step.done ? <CircleCheck className="size-4" /> : <ArrowRight className="size-4" />}
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Paso {index + 1}
            </span>
          </div>
          <p className="mt-3 font-semibold">{step.title}</p>
          <p className="mt-1 text-sm leading-5 text-blue-900/75">{step.description}</p>
        </div>
      ))}
    </div>
  )
}

export function QuickGuide({
  title,
  description,
  steps,
}: {
  title: string
  description: string
  steps: Array<{ icon: LucideIcon; title: string; text: string }>
}) {
  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/95 p-3 text-blue-950 sm:rounded-3xl sm:p-4">
      <div className="min-w-0">
        <h2 className="mobile-safe-text text-sm font-semibold sm:text-base">{title}</h2>
        <p className="mobile-safe-text mt-1 text-xs leading-5 text-blue-900/80 sm:text-sm sm:leading-6">{description}</p>
      </div>

      <div className="touch-scroll mt-3 grid auto-cols-[minmax(13.5rem,78vw)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
        {steps.map((step, index) => {
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
  )
}

export function EndpointPanel({ endpoints }: { endpoints: string[] }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-dashed bg-muted/25 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {endpoints.map((endpoint) => (
        <div key={endpoint} className="flex min-w-0 items-center gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" />
          <code className="min-w-0 break-all">{endpoint}</code>
        </div>
      ))}
    </div>
  )
}

export function ProgressMetric({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div className="space-y-2 rounded-2xl border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

export function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  const value = props.value === 0 ? "" : props.value

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
        Q.
      </span>
      <Input
        {...props}
        value={value}
        type="number"
        className={cn("pl-10 tabular-nums", className)}
      />
    </div>
  )
}

export function money(n: number) {
  const value = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(Math.abs(n))
  return `${n < 0 ? "-" : ""}Q. ${value}`
}
