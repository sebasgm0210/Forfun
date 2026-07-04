import { CasaLunaMark } from "@/components/brand/casa-luna-mark"
import { Card } from "@/components/ui/card"

interface ModulePlaceholderProps {
  title: string
  description: string
  features: string[]
}

export function ModulePlaceholder({
  title,
  description,
  features,
}: ModulePlaceholderProps) {
  return (
    <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-secondary/40 p-8 md:p-12">
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-[0.08] pattern-colonial"
      />
      <div className="relative grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex size-20 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
          <CasaLunaMark className="size-10" strokeWidth={1.4} />
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.32em] text-primary/80">
              Módulo en preparación
            </p>
            <h2 className="font-serif text-2xl font-light tracking-tight md:text-3xl">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
              >
                <span className="size-1.5 rounded-full bg-primary" />
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
