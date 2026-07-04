"use client"

import { Cell, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const revenueByCategory: Array<{ name: string; value: number; color: string }> = []

function money(value: number) {
  const amount = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(Math.abs(value))
  return `${value < 0 ? "-" : ""}Q. ${amount}`
}

const total = revenueByCategory.reduce((sum, item) => sum + item.value, 0)

const config: ChartConfig = revenueByCategory.reduce<ChartConfig>(
  (acc, item) => ({
    ...acc,
    [item.name]: { label: item.name, color: item.color },
  }),
  {},
)

export function RevenueChart() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Ingresos por rubro
            </CardTitle>
            <CardDescription>Datos pendientes del servidor</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {revenueByCategory.length === 0 ? (
          <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Sin ingresos por rubro desde el servidor.
          </div>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[200px_1fr]">
            <div className="relative mx-auto">
              <ChartContainer config={config} className="aspect-square w-44">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={revenueByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={82}
                    strokeWidth={2}
                    stroke="var(--color-card)"
                    paddingAngle={2}
                  >
                    {revenueByCategory.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
                  Total
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {money(total)}
                </span>
              </div>
            </div>
            <ul className="space-y-2.5">
              {revenueByCategory.map((item) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0"
                return (
                  <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="text-foreground/80">{item.name}</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium">{money(item.value)}</span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
