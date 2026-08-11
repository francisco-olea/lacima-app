'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { salesByHour } from '@/lib/data'

const chartConfig = {
  ventas: {
    label: 'Ventas',
    color: 'var(--gold)',
  },
} satisfies ChartConfig

export function SalesChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Ventas por hora</CardTitle>
        <CardDescription>Ingresos de hoy en tiempo real</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={salesByHour} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--gold)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="hora"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              className="text-xs"
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) => `$${Number(value).toLocaleString('es-MX')}`}
                />
              }
            />
            <Area
              dataKey="ventas"
              type="monotone"
              stroke="var(--gold)"
              strokeWidth={2}
              fill="url(#fillVentas)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
