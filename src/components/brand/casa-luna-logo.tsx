import { cn } from "@/lib/utils"
import { CasaLunaMark } from "./casa-luna-mark"

interface CasaLunaLogoProps {
  variant?: "stacked" | "horizontal" | "compact"
  tone?: "light" | "dark"
  className?: string
}

/**
 * Lockup tipográfico de Casa Luna Boutique Hotel.
 * - stacked: marca arriba, texto debajo (login, splash)
 * - horizontal: marca + nombre en línea (header de sidebar)
 * - compact: solo monograma (sidebar colapsado)
 */
export function CasaLunaLogo({
  variant = "horizontal",
  tone = "light",
  className,
}: CasaLunaLogoProps) {
  const colorClass =
    tone === "light" ? "text-sidebar-foreground" : "text-foreground"

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-center", colorClass, className)}>
        <CasaLunaMark className="size-9" />
      </div>
    )
  }

  if (variant === "stacked") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-4 text-center",
          colorClass,
          className,
        )}
      >
        <CasaLunaMark className="size-16" strokeWidth={1.25} />
        <div className="flex flex-col items-center gap-1">
          <span className="font-serif text-2xl font-light tracking-[0.18em] uppercase">
            Casa Luna
          </span>
          <span className="text-[0.6rem] tracking-[0.4em] uppercase opacity-80">
            Boutique Hotel
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3", colorClass, className)}>
      <CasaLunaMark className="size-10 shrink-0" strokeWidth={1.4} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="font-serif text-base font-light tracking-[0.2em] uppercase">
          Casa Luna
        </span>
        <span className="text-[0.55rem] tracking-[0.32em] uppercase opacity-70">
          Boutique Hotel
        </span>
      </div>
    </div>
  )
}
