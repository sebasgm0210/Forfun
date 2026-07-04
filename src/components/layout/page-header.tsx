import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 pb-4 sm:gap-4 sm:pb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
        {eyebrow && (
          <p className="mobile-safe-text text-[0.62rem] font-medium uppercase tracking-[0.22em] text-primary/80 sm:text-[0.65rem] sm:tracking-[0.32em]">
            {eyebrow}
          </p>
        )}
        <h1 className="mobile-safe-text font-serif text-2xl font-light tracking-tight text-foreground text-balance sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mobile-safe-text max-w-2xl text-xs leading-5 text-muted-foreground text-pretty sm:text-sm sm:leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="touch-scroll -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 md:justify-end [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
