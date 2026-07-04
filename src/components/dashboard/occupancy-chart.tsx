"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const occupancyByDay: Array<{ day: string; ocupacion: number; disponible: number }> = []

const config: ChartConfig = {
  ocupacion: {
    label: "Ocupacion",
    color: "var(--color-chart-1)",
  },
  disponible: {
    label: "Disponibles",
    color: "var(--color-chart-2)",
  },
}

export function OccupancyChart() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Ocupacion semanal
          </CardTitle>
          <CardDescription>Datos semanales pendientes del servidor</CardDescription>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-[var(--color-chart-1)]" />
            Ocupacion
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-[var(--color-chart-2)]" />
            Disponibles
          </span>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        {occupancyByDay.length === 0 ? (
          <div className="grid h-[260px] place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Sin datos de ocupacion semanal desde el servidor.
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
            <AreaChart data={occupancyByDay} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillOcupacion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillDisponible" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                stroke="var(--color-muted-foreground)"
                fontSize={12}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip cursor={{ stroke: "var(--color-border)" }} content={<ChartTooltipContent indicator="dot" />} />
              <Area
                type="monotone"
                dataKey="ocupacion"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#fillOcupacion)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="disponible"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#fillDisponible)"
                stackId="1"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
