import { cn } from "@/lib/utils"

interface CasaLunaMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

/**
 * Monograma SVG inspirado en el logo de Casa Luna Boutique Hotel.
 * Representa una luna asomada sobre un horizonte curvo, contenida en un círculo.
 * Se usa cuando se necesita una marca compacta (sidebar contraído, favicon, etc).
 */
export function CasaLunaMark({ className, ...props }: CasaLunaMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-8", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Círculo exterior */}
      <circle cx="32" cy="32" r="26" />

      {/* Horizonte / cuenco curvo inferior */}
      <path d="M 9 33 Q 32 53 55 33" />

      {/* Línea sutil sobre el horizonte */}
      <path d="M 13 30 Q 32 46 51 30" opacity="0.55" />

      {/* Luna / arco vertical (forma de huevo abierto inferior) */}
      <path d="M 24 39 Q 24 22 32 22 Q 40 22 40 39" />
    </svg>
  )
}
